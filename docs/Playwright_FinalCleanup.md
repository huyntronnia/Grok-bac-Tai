# Playwright Post-Migration Final Cleanup Plan

Tài liệu hướng dẫn các bước dọn dẹp (Cleanup) mã nguồn, cấu hình và tệp tin liên quan sau khi giai đoạn chạy thử nghiệm của Playwright hoàn tất thành công và được xác nhận ổn định.

---

## 1. Gỡ bỏ dependencies không sử dụng

Sau khi Playwright chạy ổn định tối thiểu 30 ngày và không có yêu cầu rollback, chúng ta tiến hành xóa bỏ hoàn toàn thư viện kết nối CDP cũ.

### Các lệnh thực hiện:
```bash
# Gỡ cài đặt thư viện chrome-remote-interface
npm uninstall chrome-remote-interface

# Dọn dẹp các gói phụ thuộc không sử dụng
npm prune
```

Xác minh tệp tin `package.json` không còn dòng nào liên quan đến `"chrome-remote-interface"`.

---

## 2. Loại bỏ mã nguồn Legacy CDP trong các files

Tiến hành loại bỏ các đoạn mã tương thích ngược và driver cũ trong dự án:

### Trong `electron/main/chatgpt/browser_adapter.js`:
- Xóa bỏ nhánh điều kiện `clientType === 'cdp'`.
- Chỉ giữ lại luồng xử lý Playwright thuần túy.
- Chuyển cấu trúc lớp `BrowserAdapter` thành lớp điều khiển mặc định.

### Trong `electron/main.js`:
- Xóa bỏ hàm `getCdpPageLegacy` và các dòng khai báo liên quan đến `CDP = require('chrome-remote-interface')`.
- Loại bỏ các cờ môi trường không cần thiết như `BROWSER_AUTOMATION_PROVIDER`.

---

## 3. Dọn dẹp các tệp tin DOM scripts lỗi thời

Các hàm giả lập sự kiện phím bấm phức tạp được viết trong `electron/main/chatgpt/chatgpt_dom.js` nhằm phục vụ cho CDP nay không còn cần thiết nữa.
- Xóa bỏ hoặc tinh giản các hàm:
  - `focusPromptInputScript`
  - `dispatchNv2ComposerInputEventsScript`
- Làm sạch các chú thích (comments) cũ liên quan đến CDP.

---

## 4. Kiểm tra và Hợp nhất Code (Final Verification & Merge)

1. Chạy toàn bộ các bài test:
   `npm test`
2. Chạy kiểm tra tĩnh mã nguồn để đảm bảo không còn import lỗi hoặc biến chưa định nghĩa:
   `node --check electron/main.js`
   `node --check electron/preload.js`
   `node --check electron/renderer.js`
3. Thực hiện tạo Pull Request hợp nhất nhánh dọn dẹp vào nhánh chính (`main` / `master`).
