# Playwright Rollback Plan & Dual-Driver Strategy

Tài liệu hướng dẫn kế hoạch quay lui (Rollback) và cấu hình Driver song song để ứng phó khi gặp sự cố nghiêm trọng trong quá trình migration sang Playwright.

---

## 1. Thiết kế Hỗ trợ Hai Driver (Dual-Driver Strategy)

Để đảm bảo có thể chuyển hướng ngay lập tức về CDP driver cũ mà không cần chỉnh sửa lại mã nguồn, lớp `BrowserAdapter` sẽ được thiết kế để đọc cấu hình chạy động.

### Biến môi trường cấu hình:
Định nghĩa biến cờ trong tệp tin môi trường hoặc cấu hình hệ thống:
```bash
# Lựa chọn driver điều khiển: 'cdp' hoặc 'playwright'
BROWSER_AUTOMATION_PROVIDER=playwright
```

### Triển khai trong Mã nguồn:
Hàm khởi tạo kết nối trong `main.js`:
```javascript
const browserProvider = process.env.BROWSER_AUTOMATION_PROVIDER || 'playwright';

async function getCdpPage(provider, createIfMissing = true, options = {}) {
  if (browserProvider === 'cdp') {
    // Luồng kết nối CDP thô sử dụng chrome-remote-interface cũ
    return getCdpPageLegacy(provider, createIfMissing, options);
  } else {
    // Luồng kết nối Playwright mới
    return getPlaywrightPage(provider, createIfMissing, options);
  }
}
```

---

## 2. Kịch bản Kích hoạt Rollback

Quyết định quay lui về CDP driver cũ được đưa ra nếu xảy ra một trong các trường hợp sau trong môi trường Product/Staging:
1. **Lỗi kết nối liên tục (Reconnection Failures)**: Playwright không thể thiết lập kết nối WebSocket tới Chrome debug port sau 3 lần thử lại, mặc dù Chrome đang chạy.
2. **Arkose Captcha / Cloudflare Block**: Tỷ lệ xuất hiện thử thách captcha tăng đột biến (>50% số cảnh) so với luồng CDP cũ do hệ thống chống bot nhận diện được vân tay (fingerprint) tự động của Playwright.
3. **Memory Leak nghiêm trọng**: Tiến trình con Playwright tiêu tốn RAM tăng dần theo thời gian chạy pipeline dài và gây crash ứng dụng Electron.

---

## 3. Quy trình thực hiện Rollback khẩn cấp

Nếu xảy ra sự cố nghiêm trọng:

### Bước 1: Chuyển cấu hình driver về CDP
Chỉnh sửa biến môi trường trong file cấu hình dự án hoặc file chạy:
```bash
BROWSER_AUTOMATION_PROVIDER=cdp
```

### Bước 2: Restart ứng dụng
Đóng hoàn toàn ứng dụng Vidora và tiến trình Chrome cũ. Khởi động lại ứng dụng.

### Bước 3: Xác minh khôi phục
1. Kiểm tra log ứng dụng, đảm bảo xuất hiện dòng chữ: `[SYSTEM] Using Legacy CDP Browser Driver`.
2. Chạy thử 1 cảnh để đảm bảo các hành động gửi prompt và upload file diễn ra bình thường theo cơ chế cũ.

---

## 4. Thời hạn duy trì cấu hình Dual-Driver
Lớp driver CDP cũ (`chrome-remote-interface`) sẽ được giữ lại trong mã nguồn tối thiểu **30 ngày** kể từ khi triển khai Playwright lên môi trường Staging/Production để đảm bảo đã trải qua đầy đủ các bài test tải và test trường hợp ngoại lệ.
Sau thời gian này, nếu không có phản hồi lỗi, chúng ta mới bắt đầu thực hiện Phase 4 và Phase 5 của kế hoạch migration (xóa bỏ mã nguồn cũ).
