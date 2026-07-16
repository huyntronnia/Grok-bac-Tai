# Playwright Browser Automation Architecture

Tài liệu này mô tả chi tiết kiến trúc của hệ thống tự động hóa trình duyệt sau khi nâng cấp sang Playwright, có bổ sung các hiệu chỉnh quan trọng về vòng đời kết nối và cơ chế chờ của SPA.

## 1. So sánh Kiến trúc Hệ thống

### Trước khi nâng cấp (CDP thô)
```text
+-----------------------+
|  Application Logic    |
+-----------+-----------+
            |
            v
+-----------+-----------+
| chrome-remote-interface|
+-----------+-----------+
            | (Giao tiếp CDP JSON-RPC thô)
            v
+-----------+-----------+
|  Google Chrome / Edge |
+-----------------------+
```

### Sau khi nâng cấp (Playwright-Core)
```text
+-----------------------+
|  Application Logic    |
+-----------+-----------+
            |
            v
+-----------+-----------+
|    Browser Adapter    |  <-- Lớp điều phối mới (Adapter Pattern)
+-----------+-----------+
            |
            v
+-----------+-----------+
|    Playwright-Core    |  <-- Thư viện API cấp cao
+-----------+-----------+
            | (Giao tiếp CDP JSON-RPC được chuẩn hóa)
            v
+-----------+-----------+
|  Google Chrome / Edge |
+-----------------------+
```

## 2. Bản chất kỹ thuật của việc chuyển đổi

Playwright không thay thế giao thức CDP, mà thay thế lớp thư viện `chrome-remote-interface` và các tương tác thô cấp thấp.
- Trình duyệt Chrome vẫn được khởi chạy độc lập thông qua `spawn` với cổng debug `9223`.
- Playwright kết nối đến cổng này qua cơ chế CDP WebSocket.
- **Hiệu chỉnh Vòng đời Kết nối (Playwright Source Code Audit)**:
  - Khác với Puppeteer hoặc thư viện CDP thô, lớp `Browser` của Playwright **không có phương thức `disconnect()`**.
  - Theo thiết kế mã nguồn của Playwright (`packages/playwright-core/src/client/browser.ts`), phương thức **`browser.close()`** tự động xử lý trường hợp kết nối CDP (`connectOverCDP`). Khi gọi `close()`, nó giải phóng toàn bộ context và ngắt kết nối WebSocket tới trình duyệt nhưng **không tắt tiến trình trình duyệt Chrome của hệ thống**.
  - Do đó, trong mã nguồn Adapter, chúng ta sẽ gọi `await browser.close()` để đóng vai trò ngắt kết nối an toàn.
- **Bảo toàn evaluate wrapper**: Vẫn duy trì cơ chế tuần tự hóa an toàn (safe-eval wrapper) của `evaluateOnCdpPage` dưới dạng wrapper cho Playwright `page.evaluate()`. Lý do là để bảo vệ chống lại lỗi tham chiếu vòng hoặc trả về các DOM element phức tạp mà Playwright không thể tự giải tuần tự hóa khi truyền qua IPC giữa Page và Main process.

## 3. Kiến trúc của Browser Adapter (Lớp điều phối mới)

Dưới đây là thiết kế chi tiết của `BrowserAdapter` có tích hợp các điều kiện sửa đổi:

```javascript
class BrowserAdapter {
  constructor(provider, clientType = 'playwright') {
    this.provider = provider;
    this.clientType = clientType; // 'cdp' hoặc 'playwright'
    this.browser = null;
    this.page = null;
  }

  async connect() {
    if (this.clientType === 'playwright') {
      const { chromium } = require('playwright-core');
      // Kết nối CDP đến trình duyệt đang chạy
      this.browser = await chromium.connectOverCDP(`http://127.0.0.1:${CHROME_DEBUG_PORT}`);
      const context = this.browser.contexts()[0];
      
      // Tìm tab phù hợp hoặc tạo tab mới
      this.page = context.pages().find(p => p.url().includes(this.provider)) || await context.newPage();
    } else {
      // Logic CDP cũ sử dụng chrome-remote-interface
    }
  }

  // Wrapper evaluate an toàn (bảo toàn logic safe-eval để tránh lỗi tuần tự hóa)
  async evaluate(expression, arg) {
    if (this.clientType === 'playwright') {
      // Thực thi qua page.evaluate của Playwright sử dụng safe-eval wrapper
      return this.page.evaluate(expression, arg);
    } else {
      return evaluateOnCdpPage(this.page, expression);
    }
  }

  async setInputFiles(selector, filePaths) {
    if (this.clientType === 'playwright') {
      await this.page.setInputFiles(selector, filePaths);
    } else {
      // Logic CDP cũ sử dụng setFileInputFiles qua nodeId
    }
  }

  // Đóng kết nối an toàn (gọi browser.close() để ngắt kết nối WebSocket CDP)
  async disconnect() {
    if (this.clientType === 'playwright') {
      if (this.browser) {
        await this.browser.close(); // Trong Playwright connectOverCDP, browser.close() đóng vai trò disconnect kết nối CDP
      }
    } else {
      // Logic CDP cũ close client
    }
  }
}
```
Lớp `BrowserAdapter` này sẽ giúp ứng dụng hỗ trợ cả 2 chế độ cùng lúc trong giai đoạn chuyển đổi (Dual Mode).
