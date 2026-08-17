# Vidora: sửa chờ tệp tải xong và gửi control prompt cho NV1/NV2

## Phạm vi

Bản sửa được áp dụng trên source có SHA-256 `a6d3eb0ea82da6b341802c90ea09aa4ddb14d55d7885b9ccfe86e77d2162e5d8`.

## Nguyên nhân từ log thực tế

Tệp `scene_001_nv1_request.txt` đã được ChatGPT hiển thị thành attachment. Tuy nhiên, cổng gửi đọc hash control prompt từ một composer khác với composer đang hiển thị. ChatGPT có thể giữ textarea cũ hoặc ẩn trong DOM, nên Vidora nhận:

- hash mong đợi: `790fb044`
- hash đọc từ DOM: `811c9dc5`

Vidora vì thế dừng ở `chatgpt-payload-prompt-mismatch` trước khi bấm Send.

## Thay đổi

- Chọn composer đang hiển thị/đang focus thay vì phần tử đầu tiên trong DOM.
- Trả `composerText` thật về payload gate để xác minh trực tiếp.
- Chuẩn hóa Unicode NFC, khoảng trắng và ký tự zero-width trước khi tạo/so sánh hash.
- Vẫn bắt buộc tên tệp và `id` trong control prompt phải khớp; sai một ký tự vẫn bị chặn.
- Sau khi attachment hiện ra và không còn progress, chờ yên 3 giây.
- Sau thời gian chờ, xác minh lại toàn bộ attachment ổn định ba lần rồi mới cho nhập control prompt.
- Áp dụng chung cho NV1 và NV2. NV2 vẫn bắt buộc đủ keyframe và tệp TXT.

## Thứ tự mới

1. Mở đúng menu Add photos & files.
2. Chọn tệp.
3. Chờ attachment hiển thị và hết trạng thái tải.
4. Chờ yên thêm 3 giây.
5. Xác minh lại attachment ba lần.
6. Nhập control prompt.
7. Xác minh text + attachment + nút Send.
8. Bấm Send.

## Kiểm thử

- Test hồi quy riêng cho NV1/NV2: đạt.
- Sai tên tệp, thiếu tệp hoặc sai `id`: vẫn bị chặn.
- NV1 retry/F5 tiếp tục dùng uploader có khoảng chờ.
- NV2 recovery tiếp tục bắt buộc đủ keyframe và tệp TXT.
- Auto-restart pipeline: đạt.
- Toàn bộ bộ kiểm thử: **55/55 tệp test đạt**.
- Toàn bộ JavaScript trong `electron/main`, `electron/main.js`, `renderer.js` và `preload.js` qua kiểm tra cú pháp.
