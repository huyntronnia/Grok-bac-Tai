# Vidora – sửa NV2 không nhập prompt và không bấm Send

Ngày: 2026-08-04  
Source gốc của lượt sửa: `d0602ca2463f60753018ec1af4afb2ae906d5c7102c595901340275b519c63e4`

## Dấu hiệu trong log thật

NV2 dừng ở attachment đầu tiên với lỗi:

`chatgpt-upload-did-not-create-visible-attachment`

Pipeline chưa chạy tới `UPLOAD_FINISHED`, `PROMPT_INSERT_BEGIN` hay thao tác Send. Bộ đếm tự phục hồi đã lên `autoRestartCount: 76` nhưng mỗi vòng đều thất bại ở cùng bước xác minh keyframe.

## Nguyên nhân

ChatGPT hiển thị keyframe trong composer dưới dạng thumbnail nhưng không hiển thị tên `scene_001_keyframe.png`. Detector cũ chỉ công nhận attachment khi đọc được đúng tên file, nên coi thumbnail ảnh đang hiện là upload thất bại.

Ngoài ra, bước xác minh từng attachment dùng `expectedFilePaths.slice(0, index + 1)`. Nếu file TXT từ lần trước vẫn còn trong composer trong lúc kiểm tra keyframe đầu tiên, số attachment thực tế là hai nhưng tập mong đợi chỉ có một. Kết quả vẫn là lỗi dù keyframe đã tải đúng.

## Thay đổi

- Phân loại attachment ảnh và file có tên.
- Ảnh được xác minh bằng thumbnail raster hoặc nút `Remove image`, số attachment và trạng thái không còn tải.
- File TXT vẫn phải khớp đúng tên file.
- Bước kiểm tra sau từng lần tải chỉ xác nhận file vừa tải đã hiện, không yêu cầu composer chỉ chứa tập tiền tố.
- Cổng cuối vẫn bắt buộc đúng tổng số attachment, đúng TXT, có đúng số thumbnail ảnh, hết trạng thái tải, control prompt đúng và nút Send sẵn sàng.
- Attachment ảnh còn lại từ vòng phục hồi được nhận diện; pipeline không tiếp tục tải trùng vô hạn.

## Kiểm thử

- Test hồi quy mới mô phỏng đúng DOM: keyframe chỉ có thumbnail, không có tên file.
- Test trường hợp chỉ có keyframe trước khi thêm TXT.
- Test trạng thái ảnh còn đang tải vẫn bị chặn.
- Test NV1, NV2, payload gate, attachment settle, retry và auto-restart vẫn đạt.
- Toàn bộ 56/56 test file đạt.
- Toàn bộ JavaScript trong `electron/` qua `node --check`.

## Giới hạn

Môi trường hiện tại không chạy được Electron với phiên ChatGPT Windows thật. Cần smoke test trên máy thật để xác nhận chuỗi log:

1. `visible attachment confirmed: scene_001_keyframe.png`
2. `visible attachment confirmed: scene_001_nv2_request.txt`
3. `ATTACHMENT_SETTLE_BEGIN`
4. `UPLOAD_FINISHED`
5. `PROMPT_INSERT_BEGIN`
6. Send được xác nhận và NV2 bắt đầu sinh phản hồi.
