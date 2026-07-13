# Playwright Non-Functional & Performance Checklist

Danh sách kiểm tra các yêu cầu phi chức năng (Non-Functional Requirements) bao gồm hiệu năng, bộ nhớ, thời gian phản hồi và rò rỉ tài nguyên sau khi nâng cấp sang Playwright.

---

## 1. Yêu cầu Hiệu năng và Thời gian Phản hồi (Performance & Response Time)

- [ ] **Thời gian khởi động trình duyệt (Startup Time)**:
  - Thời gian từ khi kích hoạt chạy pipeline đến lúc mở và kết nối thành công Playwright tới trang ChatGPT không được vượt quá **15 giây** (tương đương với CDP cũ).
- [ ] **Thời gian phản hồi khi điều hướng (Navigation Latency)**:
  - Chuyển đổi giữa các hội thoại (conversation switching) hoặc mở tab mới qua Playwright có độ trễ dưới **2 giây**.
- [ ] **Thời gian gửi tin nhắn (Message Dispatch Time)**:
  - Thao tác điền prompt bằng `page.fill` và gửi tin nhắn hoàn tất trong vòng **1.5 giây** (không bao gồm thời gian cooldown nhân tạo).

---

## 2. Quản lý Tài nguyên & Bộ nhớ (Resource & Memory Management)

- [ ] **Rò rỉ bộ nhớ (Memory Leak Check)**:
  - Chạy liên tục pipeline qua 20-50 cảnh (scenes). Bộ nhớ RAM của Main Process Electron và tiến trình nền Playwright phải ổn định, không tăng lũy tiến vô hạn.
  - Sử dụng `process.memoryUsage()` để ghi log kiểm tra sau mỗi 5 cảnh.
- [ ] **Dọn dẹp tiến trình con (Zombie Process Prevention)**:
  - Khi tab bị đóng đột ngột hoặc kết nối bị đứt, tiến trình con Playwright/Node và Chrome không được treo làm tăng tải CPU.
  - Đảm bảo gọi `browser.close()` hoặc giải phóng mọi kết nối CDP thô khi kết thúc.

---

## 3. Khả năng chịu tải và Xử lý Giới hạn (Robustness & Timeout Handling)

- [ ] **Giới hạn thời gian (Timeout Integration)**:
  - Tất cả các lệnh đợi phần tử (`page.waitForSelector`, `page.waitForNavigation`) phải có cài đặt `timeout` tối đa là 30 giây để tránh treo ứng dụng vô hạn khi mạng chậm.
- [ ] **Khôi phục khi đứt kết nối mạng (Network Disconnection)**:
  - Giả lập ngắt kết nối mạng Wifi/LAN trong 10 giây khi đang chạy pipeline. Đảm bảo Playwright tự động bắt được lỗi ngắt kết nối, chuyển sang trạng thái hồi phục mạng và kết nối lại sau khi mạng có lại mà không bị sập nguồn ứng dụng.
- [ ] **Độc lập Iframe (Iframe Sandbox Isolation)**:
  - Đảm bảo Playwright không bị ảnh hưởng bởi các lỗi script xảy ra bên trong các khung quảng cáo hoặc iframe của bên thứ ba tích hợp trong trang ChatGPT.
