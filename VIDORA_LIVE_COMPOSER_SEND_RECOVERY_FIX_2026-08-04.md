# Vidora: sửa lỗi đã tải attachment nhưng không Send

## Log dùng để chẩn đoán

`Pasted text(8).txt`, bản nền SHA-256:

`0c9af9d3dd487add48aea106334b3dff07300169ff1c8f90e91875415c293e7d`

## Nguyên nhân

Log xác nhận NV2 đã tải xong đủ hai attachment:

- `scene_001_keyframe.png`
- `scene_001_nv2_request.txt`

Sau `UPLOAD_FINISHED`, Vidora focus composer và chèn control prompt. Tuy nhiên cổng payload cuối lại đọc composer qua một snapshot tổng quát. Sau khi ChatGPT dựng lại vùng attachment, snapshot này có thể chọn textarea cũ/ẩn thay vì composer đang active. Cổng chờ 12 giây rồi trả lỗi mà không ghi nguyên nhân chi tiết.

Khi cổng lỗi, trạng thái gửi vẫn là `PREPARING`. Nhánh `nv2-send-recovery` yêu cầu F5 nhưng cơ chế an toàn lại chặn F5 trong trạng thái này, gây lỗi:

`chatgpt-same-chat-refresh-failed:nv2-send-recovery`

## Thay đổi

- Cả NV1 và NV2 xác minh prompt bằng đúng composer sống vừa được focus và điền nội dung.
- Các bước focus, xóa nội dung, phát sự kiện nhập và payload gate cùng khóa vào một composer.
- NV2 có đủ milestone: `PROMPT_INSERT_BEGIN`, `PROMPT_INSERT_FINISHED`, `SEND_CLICK_BEGIN`, `SEND_CLICK_FINISHED`.
- Nếu chèn prompt hoặc payload gate lỗi, trạng thái đổi từ `PREPARING` sang `FAILED`.
- F5 phục hồi cùng chat được phép chạy khi draft đã được xác nhận là lỗi.
- Log mới ghi loại lỗi gate, mã prompt, độ dài prompt, trạng thái composer và lỗi attachment; không ghi toàn bộ prompt dài.

## Kiểm thử

- Toàn bộ JavaScript qua `node --check`.
- Toàn bộ suite: 57/57 test file đạt.
- Có test hồi quy mới cho composer sống và giải phóng trạng thái trước recovery.
- Stub Electron dùng khi kiểm thử nằm ngoài source và không được đóng gói.

## Giới hạn

Môi trường kiểm thử không điều khiển phiên ChatGPT thật trên Windows. Cần xác nhận log thực tế đi qua chuỗi:

`UPLOAD_FINISHED → PROMPT_INSERT_BEGIN → PROMPT_INSERT_FINISHED → SEND_CLICK_BEGIN → SEND_CLICK_FINISHED`
