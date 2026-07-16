# Browser Automation Function Map

Bảng phân loại phạm vi ảnh hưởng và mức độ cần chỉnh sửa/thay thế của từng module trong hệ thống khi chuyển đổi từ CDP sang Playwright.

## 1. Bản đồ Phân loại Mức độ Thay thế

| Tên Module / File | Vai trò hiện tại | Mức độ thay đổi (%) | Đánh giá & Định hướng Thay thế |
| :--- | :--- | :---: | :--- |
| **`electron/main.js`** | Khởi chạy Chrome, dọn dẹp tab, khởi tạo kết nối CDP thô qua `getCdpPage`. | **80%** | Thay thế `chrome-remote-interface` bằng `playwright-core`. Triển khai **Adapter Pattern** cho việc quản lý Browser Instance và Tab/Page. Giữ nguyên hàm tìm Chrome executable. |
| **`chatgpt_core.js`** | Hàm bọc evaluate (`evaluateOnCdpPage`), chờ tải trang, lấy trạng thái hội thoại. | **90%** | Chuyển đổi `evaluateOnCdpPage` sang `page.evaluate`. Gỡ bỏ cơ chế an toàn safe-eval tự chế vì Playwright tự động tuần tự hóa và bọc lỗi rất tốt. |
| **`chatgpt_send.js`** | Nhập văn bản prompt bằng cách giả lập bàn phím CDP, click nút gửi. | **95%** | Thay thế toàn bộ mã nguồn dispatch event và `Input.insertText` bằng `page.fill()` và `page.click()`. Đây là nơi mã nguồn sẽ rút gọn nhiều nhất. |
| **`chatgpt_upload.js`** | Tìm kiếm input file chooser qua Node ID CDP và gán files. | **95%** | Thay thế toàn bộ logic Node ID thô bằng Playwright native API: `page.setInputFiles(...)`. |
| **`chatgpt_runtime_monitor.js`** | Đăng ký CDP listeners, binding JS, Mutation Observer trong DOM. | **70%** | Thay đổi cơ chế lắng nghe sự kiện sang Playwright Event API (`page.on`). Thay thế `page.Runtime.addBinding` bằng `page.exposeFunction()`. |
| **`chatgpt_recovery.js`** | Phát hiện lỗi và hồi phục (Escape overlays, reload trang, giải quyết lựa chọn). | **50%** | Giữ nguyên logic quyết định hồi phục (recovery logic) và trạng thái, nhưng thay thế các lệnh bấm ESC, click chuột hoặc reload bằng Playwright Page API tương ứng. |
| **`chatgpt_pipeline.js`** | Điều phối toàn bộ vòng lặp pipeline của ChatGPT. | **5%** | Không thay đổi logic nghiệp vụ. Chỉ cập nhật tham số truyền vào từ CDP client sang Playwright page. |

## 2. Các Module không thay đổi (0% Thay đổi)
- **`electron/main/veoup/veoup.js`**: Tự động hóa ứng dụng VeoUp độc lập, không liên quan đến trình duyệt.
- **`electron/main/logging/index.js`**: Hệ thống ghi log ứng dụng.
- **`electron/main/utils/index.js`**: Tiện ích chung cho hệ thống tệp và cấu hình.
- **`electron/renderer.js`**: Mã renderer UI chính.
