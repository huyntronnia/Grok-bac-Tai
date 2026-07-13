# Browser Automation API Inventory

Bảng thống kê toàn bộ các API CDP (`chrome-remote-interface`) được sử dụng trong mã nguồn hiện tại của dự án Vidora.

## 1. Thống kê Tần suất sử dụng API CDP

| Danh mục API CDP | Phương thức cụ thể | Số lần xuất hiện | Các file chính sử dụng | Ghi chú |
| :--- | :--- | :---: | :--- | :--- |
| **Runtime Domain** | `Runtime.evaluate` | **180+** | `chatgpt_core.js`, `main.js`, `chatgpt_send.js`, `chatgpt_recovery.js` | Dùng để thực thi code JS trên trang web. Hầu hết thông qua hàm bọc `evaluateOnCdpPage`. |
| | `Runtime.enable` | **3** | `main.js`, `chatgpt_runtime_monitor.js` | Bật tính năng thực thi runtime của CDP. |
| | `Runtime.addBinding` | **2** | `chatgpt_runtime_monitor.js` | Tạo hàm `chatgptUiMonitorBinding` để trang web gọi ngược về Node.js. |
| **Input Domain** | `Input.dispatchMouseEvent` | **40** | `main.js`, `chatgpt_send.js` | Giả lập di chuột, click chuột xuống/lên. |
| | `Input.dispatchKeyEvent` | **11** | `main.js`, `chatgpt_send.js`, `chatgpt_recovery.js` | Giả lập nhấn phím (KeyDown, KeyUp), đặc biệt là phím Escape. |
| | `Input.insertText` | **4** | `main.js`, `chatgpt_send.js` | Nhập văn bản prompt thô vào input selector. |
| **DOM Domain** | `DOM.getDocument` | **8** | `chatgpt_upload.js`, `main.js`, `chatgpt_send.js` | Lấy nút gốc (root node) của DOM để tìm kiếm phần tử. |
| | `DOM.querySelector` | **10** | `chatgpt_upload.js`, `main.js`, `chatgpt_send.js` | Tìm kiếm Node ID dựa vào CSS Selector. |
| | `DOM.setFileInputFiles` | **5** | `chatgpt_upload.js`, `main.js` | Gán tệp tin vào phần tử `input[type="file"]`. |
| | `DOM.focus` | **1** | `chatgpt_send.js` | Trực tiếp focus vào phần tử nhập liệu. |
| | `DOM.enable` | **2** | `main.js` | Kích hoạt domain DOM của CDP. |
| **Page Domain** | `Page.enable` | **2** | `main.js`, `chatgpt_runtime_monitor.js` | Kích hoạt các sự kiện liên quan đến trang (load, reload). |
| | `Page.reload` | **4** | `main.js`, `chatgpt_recovery.js` | Reload lại trang web, có kiểm soát luồng. |
| **Network Domain**| `Network.enable` | **2** | `main.js` | Kích hoạt để theo dõi tài nguyên mạng. |
| **CDP Client** | `CDP.List` | **4** | `main.js`, `chatgpt_recovery.js` | Lấy danh sách các tab đang mở của Chrome. |
| | `CDP(...)` | **4** | `main.js` | Khởi tạo kết nối CDP client đến một tab cụ thể. |

## 2. Phân tích Khối lượng Công việc Chuyển đổi (Migration Volume)

Dựa trên bảng thống kê, các tác vụ chính bao gồm:
1. **Thay thế 180+ lệnh `evaluateOnCdpPage`**: Chuyển sang `page.evaluate(...)` của Playwright.
2. **Loại bỏ hoàn toàn các hàm DOM cấp thấp (`DOM.getDocument`, `DOM.querySelector`)**: Thay thế bằng các Playwright locators trực quan (ví dụ: `page.setInputFiles(...)`).
3. **Thay thế giả lập sự kiện Input cấp thấp**: Thay đổi `Input.dispatchMouseEvent` và `Input.insertText` sang `page.click()`, `page.fill()`, và `page.press()`.
4. **Thay thế các CDP Listeners**: Chuyển đổi các sự kiện mạng và binding về dạng event listeners sạch sẽ của Playwright.
