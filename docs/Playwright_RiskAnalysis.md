# Playwright Migration Risk Analysis

Tài liệu phân tích các rủi ro kỹ thuật khi chuyển đổi lớp Browser Automation từ CDP sang Playwright và phương án giảm thiểu (Mitigation Strategies).

---

## 1. Rủi ro 1: Lỗi Locator khi ChatGPT cập nhật DOM (DOM Changes)
- **Mô tả**: ChatGPT thường xuyên cập nhật cấu trúc DOM và thay đổi tên class hoặc thuộc tính của các thẻ (ví dụ nút gửi, vùng nhập prompt). Nếu Playwright sử dụng locator cứng (như `[data-testid="send-button"]`), quá trình tự động hóa có thể bị gián đoạn.
- **Mức độ ảnh hưởng**: Rất cao.
- **Phương án giảm thiểu**:
  - Sử dụng các bộ lọc selector linh hoạt, kết hợp kiểm tra thẻ aria-label hoặc cấu trúc tương đối: `[data-testid="send-button"], [data-testid*="submit"], main form button[type="submit"]`.
  - Tận dụng cơ chế **Auto-waiting** của Playwright để đợi phần tử xuất hiện trước khi tương tác.
  - Tách các selectors ra thành file cấu hình riêng (`electron/main/chatgpt/chatgpt_dom.js`) để dễ dàng cập nhật khi ChatGPT thay đổi cấu trúc mà không cần sửa logic cốt lõi.

---

## 2. Rủi ro 2: Khác biệt về cơ chế Tự động hóa và Tránh phát hiện bot (Bot Detection)
- **Mô tả**: Playwright kích hoạt các biến cờ nội bộ của Chromium biểu thị môi trường tự động hóa (như `navigator.webdriver`). ChatGPT có các hệ thống Cloudflare / Arkose Labs để chặn bot, việc sử dụng các API tự động hóa của Playwright có thể kích hoạt các thử thách Challenge (Captcha) thường xuyên hơn.
- **Mức độ ảnh hưởng**: Trung bình.
- **Phương án giảm thiểu**:
  - Không sử dụng chế độ chạy ẩn danh (Incognito) mặc định của Playwright. Thay vào đó, kết nối qua CDP (`connectOverCDP`) đến tiến trình Chrome thực tế của người dùng đã được cấu hình từ trước.
  - Sử dụng các khoảng trễ ngẫu nhiên (cooldown delays) giữa các hành động điền prompt, upload hình ảnh và bấm gửi nhằm mô phỏng hành vi của con người.

---

## 3. Rủi ro 3: Treo kết nối khi mất mạng hoặc tab crash (Connection Leaks)
- **Mô tả**: Nếu tab trình duyệt bị reload, crash hoặc kết nối mạng bị gián đoạn trong khi Playwright đang chờ một hành động (ví dụ `page.waitForSelector`), các hàm không có timeout rõ ràng có thể bị treo vô hạn.
- **Mức độ ảnh hưởng**: Cao.
- **Phương án giảm thiểu**:
  - Thiết lập thuộc tính `timeout` rõ ràng cho mọi hành động của Playwright (ví dụ tối đa 30,000ms).
  - Lắng nghe sự kiện `disconnected` của Browser và `crash` của Page để kích hoạt luồng khôi phục (`recoverCdpPageIfCrashed`).

---

## 4. Rủi ro 4: Xung đột tài nguyên của Profile Người dùng (Session Conflicts)
- **Mô tả**: Khi khởi chạy Chrome với thư mục dữ liệu người dùng (`--user-data-dir`), nếu có một tiến trình Chrome khác đang chạy trên cùng profile đó, Chrome sẽ chặn không cho mở cổng debug hoặc Playwright không thể khóa (lock) dữ liệu.
- **Mức độ ảnh hưởng**: Trung bình.
- **Phương án giảm thiểu**:
  - Kiểm tra trạng thái cổng debug bằng hàm `isChromeDebugReady` trước khi khởi chạy.
  - Đưa ra cảnh báo thân thiện yêu cầu người dùng tắt hoàn toàn Chrome cũ nếu không thể mở cổng debugging.
