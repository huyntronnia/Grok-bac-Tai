# Playwright Regression Testing Checklist

Danh sách kiểm tra (Checklist) chi tiết nhằm xác minh độ ổn định và ngăn ngừa lỗi phát sinh (regression) sau khi hoàn tất quá trình migration sang Playwright.

---

## 1. Nhóm 1: Quản lý Vòng đời & Trạng thái Trình duyệt

- [ ] **Khởi chạy thành công**: Kích hoạt `ensureChromeDebug()`, trình duyệt Chrome mở đúng cổng debug `9223`.
- [ ] **Kết nối Adapter**: Playwright kết nối thành công qua `connectOverCDP()`, lấy được Page ChatGPT mà không bị treo.
- [ ] **Lưu trữ Session**: Đăng nhập ChatGPT, đóng ứng dụng và mở lại, trạng thái đăng nhập (Cookies, Session) được giữ nguyên, không yêu cầu đăng nhập lại.
- [ ] **Đóng ứng dụng sạch**: Khi tắt Vidora, tiến trình trình duyệt Chrome con được dọn dẹp và đóng hoàn toàn, giải phóng cổng `9223`.

---

## 2. Nhóm 2: Thao tác gửi Prompt & Đọc trạng thái (ChatGPT)

- [ ] **Focus Input**: Hộp soạn thảo văn bản `#prompt-textarea` tự động được focus khi bắt đầu cảnh mới.
- [ ] **Nhập văn bản lớn**: Điền prompt thành công với độ dài ký tự lớn (>5000 ký tự) mà không bị mất chữ, trôi chữ hay thiếu ký tự cuối.
- [ ] **Nhấn gửi**: Click nút gửi prompt thành công, trạng thái gửi (`setChatGptSendState`) chuyển đổi chính xác từ `PREPARING` -> `READY` -> `CLICKING`.
- [ ] **Nhận diện trạng thái hội thoại**: Đọc đúng trạng thái `composerState` (ví dụ: `BUSY` khi đang tạo ảnh, `READY` khi sẵn sàng).

---

## 3. Nhóm 3: Upload & Đính kèm File

- [ ] **Upload hình ảnh**: Đính kèm ảnh keyframe của cảnh trước hoặc ảnh nhân vật thành công bằng `setInputFiles`.
- [ ] **Đồng bộ hóa tên ảnh**: `verifyAttachmentsReady` trả về `true` sau khi toàn bộ ảnh được đính kèm và nhận diện đúng tên tệp trên UI của ChatGPT.
- [ ] **Dọn dẹp ảnh cũ**: Hệ thống tự động xóa bỏ các ảnh cũ không thuộc cảnh hiện tại trước khi bắt đầu tải ảnh mới lên.

---

## 4. Nhóm 4: Pipeline Đóng (Closed-loop Pipeline)

- [ ] **Luồng tuần tự**: Cảnh N hoàn thành tạo ảnh và video rồi mới chuyển sang cảnh N+1.
- [ ] **Bảo toàn ảnh nhân vật**: Gửi kèm mô tả nhân vật (.txt) và ảnh preset nhân vật chính xác ở đầu mỗi phiên hội thoại mới.
- [ ] **Video VeoUp**: Pipeline tự động lưu file video, kiểm tra video hợp lệ và trích xuất ảnh frame cuối làm dữ liệu đầu vào cho cảnh tiếp theo.

---

## 5. Nhóm 5: Khôi phục Lỗi (Error Recovery)

- [ ] **Lỗi Overlays**: Khi xuất hiện hộp thoại chặn (như thông báo nâng cấp gói, xác nhận), hệ thống tự động gửi phím `Escape` để đóng hộp thoại và tiếp tục chạy.
- [ ] **Reload trang**: Nếu ChatGPT bị đơ hoặc lỗi kết nối, hệ thống tự động reload trang và tái tạo kết nối Playwright.
- [ ] **Hạn chế Reload trong lúc gửi**: Bảo vệ chống reload trang được kích hoạt đúng lúc khi đang gửi prompt nhằm tránh mất dữ liệu.
