# Vidora TXT attachment send hotfix

## Nền sửa

- Source gốc: `VIDORA_V6_FILE_TXT_AUTO_RESTART_2026-08-03.zip`
- SHA-256 source gốc: `f84b3be8d67fb80ed52c65ca8c0b98a21c6a022841d8a5dbe3e7a7297aa90ffa`
- Log tái hiện: Vidora chọn được `scene_001_nv1_request.txt`, nhưng báo `actualLabels: []`, `attachmentCount: 0`, `composerState: EMPTY` và không đi tới bước gửi control prompt.

## Nguyên nhân

Vidora chỉ nhận diện attachment bằng các selector DOM cũ dạng `main form [class*=attachment/file-preview]`. Giao diện ChatGPT hiện tại có thể đặt chip tệp ở cấu trúc khác, nên tệp đã xuất hiện trong composer nhưng bộ xác minh vẫn kết luận không có attachment.

## Thay đổi

- Bổ sung nhận diện attachment trong vùng composer bằng tên tệp hiển thị, thuộc tính DOM, `input.files` và nút xóa tệp.
- Loại trừ nội dung control prompt khỏi việc nhận diện để tên tệp trong câu lệnh không bị hiểu nhầm là attachment.
- Nếu ChatGPT chỉ hiển thị biểu tượng tệp, dùng số nút xóa làm bằng chứng dự phòng sau khi `setInputFiles()` thành công.
- Nếu `input.files` chứa tệp sai, không được phép suy đoán đó là tệp đúng.
- Dùng cùng một trạng thái attachment mới ở cả cổng upload và cổng ngay trước Send.
- Lần chuẩn bị payload lặp lại nhận ra tệp đã có, tránh tải trùng trước khi gửi.
- Mở rộng bước dọn attachment cũ cho cấu trúc composer mới.

Thay đổi dùng chung cho NV1 và NV2. Cơ chế tự khởi động lại pipeline của bản `f84b...90ffa` được giữ nguyên.

## Kiểm thử

- Thêm test hồi quy cho DOM mới, trường hợp chỉ có biểu tượng tệp, trường hợp tên tệp chỉ nằm trong control prompt và trường hợp `input.files` chứa tệp sai.
- Toàn bộ suite: 53/53 test file đạt.
- Các tệp JavaScript trọng yếu qua kiểm tra cú pháp.

Vẫn cần smoke test trên Windows với phiên ChatGPT thật trước khi chạy dài.
