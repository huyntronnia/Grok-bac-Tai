# Playwright API Mapping Reference

Tài liệu hướng dẫn ánh xạ các lệnh CDP (`chrome-remote-interface`) hiện có sang API cấp cao của Playwright, đã cập nhật các hiệu chỉnh về nhập liệu, cơ chế chờ SPA và vòng đời kết nối.

---

## 1. Kết nối và Quản lý Vòng đời

| Lệnh CDP hiện tại | API Playwright tương ứng | Ví dụ mã nguồn Playwright |
| :--- | :--- | :--- |
| `CDP.List({ host, port })` | `browser.contexts()[0].pages()` | Lấy danh sách các trang đang mở trong context mặc định. |
| `CDP({ target, host, port })` | `chromium.connectOverCDP(url)` | `const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');` |
| `openCdpTab(url)` | `context.newPage()` | `const page = await context.newPage(); await page.goto(url);` |
| `client.close()` | `browser.close()` | **Lưu ý quan trọng**: Lớp `Browser` của Playwright không có phương thức `disconnect()`. Khi gọi `browser.close()` trên đối tượng có được từ `connectOverCDP()`, nó sẽ giải phóng context/tab và ngắt kết nối WebSocket tới trình duyệt nhưng **không tắt tiến trình Chrome thực tế của người dùng**. |

---

## 2. Tương tác DOM và Nhập liệu

| Lệnh CDP hiện tại | API Playwright tương ứng | Ví dụ mã nguồn Playwright |
| :--- | :--- | :--- |
| `client.Input.insertText({ text })` | `page.fill(selector, text)` hoặc `page.type(selector, text)` hoặc `page.keyboard.insertText(text)` | **Lưu ý**: Không lạm dụng `page.fill()`. Sử dụng `page.fill` cho các trường nhập liệu chuẩn. Đối với các editor phức tạp của ChatGPT, sử dụng `page.focus` kết hợp `page.keyboard.insertText` hoặc `page.type` (mô phỏng gõ phím) để tránh xóa dữ liệu cũ hoặc kích hoạt sai trạng thái React. |
| `client.Input.dispatchKeyEvent` (KeyDown/KeyUp) | `page.press(key)` hoặc `page.keyboard` | `await page.keyboard.press('Escape');` |
| `client.Input.dispatchMouseEvent` | `page.click(selector)` | `await page.click('[data-testid="send-button"]');` |
| `client.DOM.focus({ nodeId })` | `page.focus(selector)` | `await page.focus('#prompt-textarea');` |

---

## 3. Quản lý File Upload

| Lệnh CDP hiện tại | API Playwright tương ứng | Ví dụ mã nguồn Playwright |
| :--- | :--- | :--- |
| `client.DOM.getDocument` | *Không cần thiết* | Playwright tự tìm kiếm phần tử bằng CSS selector. |
| `client.DOM.querySelector` | *Không cần thiết* | Dùng trực tiếp selector trong các hàm tương tác. |
| `client.DOM.setFileInputFiles` | `page.setInputFiles(selector, files)` | `await page.setInputFiles('input[type="file"]', [filePath]);` |

---

## 4. Thực thi JavaScript và Chờ đợi (SPA)

Vì ChatGPT là ứng dụng Single Page Application (SPA), việc chỉ chờ tải trang bằng `waitForLoadState` là không đủ. Cần kết hợp các cơ chế chờ giao diện động:

| Lệnh CDP hiện tại | API Playwright tương ứng | Ví dụ mã nguồn Playwright |
| :--- | :--- | :--- |
| `evaluateOnCdpPage(client, expression)` | `page.evaluate(expression)` | **Lưu ý**: Vẫn duy trì wrapper evaluate an toàn (safe-eval) để xử lý tuần tự hóa (serialization) các đối tượng phức tạp / tham chiếu vòng từ Page context về Electron Main. |
| `waitForCdpLoad(client)` | `page.waitForLoadState('domcontentloaded')` kết hợp với `page.waitForSelector` và `page.waitForFunction` | `await page.waitForLoadState('domcontentloaded');`<br>`await page.waitForSelector('#prompt-textarea', { state: 'visible', timeout: 15000 });`<br>`await page.waitForFunction(() => !document.querySelector('.streaming-text'));` |

---

## 5. Lắng nghe Sự kiện & Network

| Sự kiện CDP hiện tại | API Playwright tương ứng | Ví dụ mã nguồn Playwright |
| :--- | :--- | :--- |
| `Network.responseReceived` | `page.on('response', ...)` | `page.on('response', response => { console.log(response.url()); });` |
| `Runtime.consoleAPICalled` | `page.on('console', ...)` | `page.on('console', msg => { console.log(msg.text()); });` |
| `Runtime.exceptionThrown` | `page.on('pageerror', ...)` | Lắng nghe các exception không được catch trên trang. |
| `Runtime.addBinding` | `page.exposeFunction(...)` | Đăng ký hàm Node về Window: `await page.exposeFunction('chatgptUiMonitorBinding', data => { ... });` |
| `Page.frameNavigated` | `page.on('framenavigated', ...)` | Lắng nghe sự kiện chuyển hướng trang. |
