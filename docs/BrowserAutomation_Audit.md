# Browser Automation Audit Report (CDP)

Báo cáo phân tích hiện trạng hệ thống tự động hóa trình duyệt sử dụng Chrome DevTools Protocol (CDP) thông qua thư viện `chrome-remote-interface` của Vidora, có bổ sung phân tích chi tiết về Browser State, Vòng đời Trình duyệt, cơ chế safe-eval và vòng đời ngắt kết nối.

---

## 1. Hiện trạng Kiến trúc Browser Automation (CDP)

Hệ thống hiện tại điều khiển tiến trình Google Chrome hoặc Microsoft Edge thông qua cổng debug `9223` bằng kết nối CDP trực tiếp.

### Các thành phần chính và chức năng:

1. **Khởi chạy trình duyệt (`electron/main.js`):**
   - **`findChromeExecutable()`**: Quét các đường dẫn cài đặt mặc định trên Windows hoặc lệnh shell để tìm Chrome/Edge.
   - **`ensureChromeDebug(openUrl)`**: Khởi chạy Chrome với cổng remote debugging `9223` và thư mục profile chuyên dụng (`CHROME_USER_DATA_DIR`).
   - **`isChromeDebugReady()`**: Thử kết nối đến cổng debug bằng cách fetch endpoint `/json/version`.
   - **`openCdpTab(url)`**: Gửi HTTP PUT `/json/new` để mở tab mới.

2. **Quản lý Connection & Tab (`electron/main.js`):**
   - **`getCdpPage(provider, createIfMissing, options)`**: Tìm kiếm tab đang mở có chứa hostname của `provider` (ví dụ: `chatgpt.com`). Kết nối client bằng `CDP({ target, host, port })`. Kích hoạt các domain CDP: `Page`, `Runtime`, `DOM`, `Network`. Ghi đè hàm `Page.reload` để kiểm soát và chặn hành vi reload không mong muốn trong khi gửi prompt.

3. **Thực thi Scripts & DOM Queries (`electron/main/chatgpt/chatgpt_core.js`):**
   - **`evaluateOnCdpPage(client, expression)`**: Thực thi mã JS qua `Runtime.evaluate`. Có hàm bọc safe-eval tự động để xử lý lỗi tuần tự hóa khi trả về các cấu trúc đối tượng phức tạp hoặc tham chiếu vòng.
   - **`waitForCdpLoad(client)`**: Vòng lặp đợi `document.readyState` chuyển sang trạng thái sẵn sàng.

4. **Tương tác Input & File Upload (`electron/main/chatgpt/chatgpt_send.js` & `chatgpt_upload.js`):**
   - **Nhập prompt**: Sử dụng `client.Input.insertText` kết hợp các sự kiện giả lập bàn phím.
   - **Upload ảnh**: Lấy Document Root qua `page.DOM.getDocument`, tìm kiếm node ID của phần tử input bằng `page.DOM.querySelector`, sau đó gán tệp tin qua `page.DOM.setFileInputFiles`.

---

## 2. Phân tích Trạng thái Trình duyệt (Browser State Audit)

Hệ thống Browser Automation đang tương tác và quản lý các trạng thái sau trên trình duyệt:

1. **Cookies & Session**:
   - Trình duyệt Chrome chạy với profile chuyên dụng tại thư mục `CHROME_USER_DATA_DIR`. Toàn bộ cookies và phiên đăng nhập (session) của ChatGPT được lưu giữ tự động trong thư mục này bởi Chromium.
   - Khi chuyển sang Playwright, chúng ta **phải kết nối tới profile thực tế này thông qua connectOverCDP** để tái sử dụng toàn bộ phiên làm việc của người dùng mà không cần bắt họ đăng nhập lại từ đầu.
2. **LocalStorage & IndexedDB**:
   - ChatGPT sử dụng LocalStorage và IndexedDB để lưu giữ lịch sử chat tạm thời và cấu hình UI.
   - Vidora sử dụng script trong trang để đọc/ghi các giá trị cấu hình liên quan đến trạng thái gửi prompt.
3. **Browser Permission**:
   - Trình duyệt cần cấp quyền truy cập Clipboard (để đọc kết quả sao chép) và thông báo.
   - Cần giữ nguyên cấu hình profile để không làm mất các quyền này.
4. **Downloads**:
   - Khi tạo ảnh bằng DALL-E trên ChatGPT, hệ thống tự động theo dõi URL ảnh được tạo thông qua CDP Network events, sau đó tải về trực tiếp từ Node.js chứ không thông qua hộp thoại download của trình duyệt Chrome.
5. **User Profile**:
   - Chứa thông tin đăng nhập của tài khoản người dùng. Vidora nghiêm cấm việc ghi hay lưu trữ thông tin nhạy cảm này vào file dự án hay log hệ thống.

---

## 3. Bản đồ Chuyển đổi sang Playwright (chrome-remote-interface -> Playwright)

Mục tiêu chính là **thay thế lớp triển khai `chrome-remote-interface` bằng Playwright-Core**, không phải thay thế giao thức CDP.

| Chức năng CDP hiện tại | Giải pháp thay thế bằng Playwright | Lợi ích |
| :--- | :--- | :--- |
| `ensureChromeDebug` | Giữ nguyên (tự spawn Chrome debug) | Giữ vững cơ chế khởi động trình duyệt ổn định. |
| `CDP.List` & `openCdpTab` | `context.pages()` & `context.newPage()` | Quản lý tab trực quan bằng API mảng Page. |
| `evaluateOnCdpPage` | `page.evaluate(fn, arg)` bên trong evaluate wrapper an toàn | **Hiệu chỉnh**: Giữ lại wrapper safe-eval nhằm tránh lỗi giải tuần tự hóa của IPC khi trả về cấu trúc đối tượng phức tạp / tham chiếu vòng. |
| `page.DOM.setFileInputFiles` | `page.setInputFiles(selector, files)` | Không cần Node ID cấp thấp, chỉ cần 1 dòng code. |
| `client.Input.insertText` | `page.fill`, `page.type` hoặc `page.keyboard` tùy thuộc ngữ cảnh | **Hiệu chỉnh**: Không lạm dụng `page.fill` cho các editor phức tạp của ChatGPT, sử dụng phối hợp `keyboard` để gõ ký tự chân thực và bảo toàn dữ liệu cũ. |
| `Runtime.addBinding` | `page.exposeFunction(name, fn)` | Cung cấp giao tiếp 2 chiều Page -> Main chuẩn hóa. |
| `Network.responseReceived` | `page.on('response', ...)` | Lắng nghe trực tiếp HTTP responses sạch sẽ. |
| `waitForCdpLoad` | Kết hợp `waitForLoadState`, `waitForSelector`, `waitForFunction` | **Hiệu chỉnh**: Với ứng dụng SPA như ChatGPT, cần có các điều kiện chờ giao diện động thay vì chỉ đợi LoadState thô. |
| `client.close()` | `browser.close()` | **Hiệu chỉnh**: Vì lớp `Browser` của Playwright không có API `disconnect()` công khai, phương thức `browser.close()` trên kết nối CDP sẽ tự ngắt kết nối WebSocket kết nối tới Chrome mà không tắt trình duyệt Chrome thực tế của người dùng. |

---

## 4. Các tài liệu phân tích chi tiết liên quan
Để biết thêm thông tin chi tiết về từng thành phần trong đợt chuyển đổi này, vui lòng tham khảo các tài liệu sau:
- [Sơ đồ phụ thuộc (Dependency Graph)](file:///d:/bac_tai/Grok-bac-Tai/docs/BrowserAutomation_Dependency.md)
- [Vòng đời trình duyệt (Browser Lifecycle)](file:///d:/bac_tai/Grok-bac-Tai/docs/BrowserAutomation_Lifecycle.md)
- [Luồng sự kiện (Event Flow)](file:///d:/bac_tai/Grok-bac-Tai/docs/BrowserAutomation_EventFlow.md)
- [Danh mục API CDP hiện có (API Inventory)](file:///d:/bac_tai/Grok-bac-Tai/docs/BrowserAutomation_APIInventory.md)
- [Phân loại mức độ thay thế từng module (Function Map)](file:///d:/bac_tai/Grok-bac-Tai/docs/BrowserAutomation_FunctionMap.md)
