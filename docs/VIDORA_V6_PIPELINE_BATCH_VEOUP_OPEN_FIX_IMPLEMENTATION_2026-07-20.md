# Vidora v6 — Biên bản triển khai sửa pipeline batch và xác nhận Open của VeoUp

Ngày: 2026-07-20  
Phạm vi: source v6, giữ nguyên các luồng NV1/NV2, Request 2 = 10 keyframe gần nhất, autosave path-only và cơ chế `_batch_ready` hiện có.

## 1. Kết quả

Đã triển khai hai nhóm sửa độc lập:

1. Pipeline không còn bị giữ ở tiến trình main thêm 10 giây sau khi một scene đã hoàn tất và ghi checkpoint. Kết quả được trả về renderer ngay sau durable commit; khoảng nghỉ 10 giây vẫn được giữ nhưng được renderer quản lý, có thể hủy và không khóa IPC.
2. Luồng chọn ảnh batch của VeoUp không còn dùng số lượng item UI Automation trong File Explorer làm điều kiện chặn trước khi bấm Open. Sau `Ctrl+A`, tool chủ động tìm và kích hoạt nút Open; nếu UI Automation không dùng được thì fallback bằng Enter, đồng thời có timeout và cleanup bằng Esc.

## 2. Nguyên nhân gốc đã xử lý

### 2.1 Pipeline dừng sau một cụm scene

Sau khi scene thành công, `pipeline_runner.js` từng chờ cố định 10 giây trước khi trả kết quả IPC cho renderer. Trong thời gian đó renderer vẫn coi lượt chạy đang hoạt động. Việc tiếp tục scene kế tiếp vì vậy phụ thuộc vào một Promise bị giữ ở main process; khi trạng thái UI, autosave hoặc lịch chạy thay đổi ở ranh giới batch, pipeline có thể trông như tự dừng dù checkpoint đã lưu.

Ngoài ra, callback của timer tiếp tục pipeline trước đây không có hàng rào bắt lỗi riêng. Nếu callback phát sinh lỗi ngoài nhánh dự kiến, trạng thái có thể không được kết thúc và ghi lại đầy đủ.

### 2.2 VeoUp chọn đủ ảnh nhưng không bấm Open

Windows File Explorer dùng danh sách ảo hóa. Số item được báo qua UI Automation không phải bằng chứng tin cậy rằng toàn bộ file đã được chọn. Code cũ kiểm tra selection count trước khi xác nhận hộp thoại nên có thể dừng ngay sau `Ctrl+A`, đúng với hiện tượng ảnh đã sáng chọn nhưng cửa sổ Open vẫn còn mở.

## 3. Thay đổi mã nguồn

| File | Thay đổi |
|---|---|
| `electron/main/pipeline/pipeline_runner.js` | Trả kết quả ngay sau durable commit; bổ sung cờ `alreadyCompleted` vào kết quả đã sanitize; bỏ sleep 10 giây ở main process. |
| `electron/renderer.js` | Chuyển khoảng nghỉ 10 giây thành inter-scene breather có thể hủy; chỉ nghỉ sau scene mới hoàn tất; không nghỉ lại với scene đã hoàn tất trước đó; bắt lỗi callback của timer, lưu trạng thái và kết thúc run an toàn. |
| `electron/main/veoup/veoup.js` | Bỏ pre-gate dựa trên selection count; thêm `Confirm-OpenFileDialogSelection`; ưu tiên InvokePattern/click nút Open, fallback Enter, chờ dialog đóng và Esc cleanup khi thất bại; giữ validation sau import. |

## 4. Test hồi quy

Đã thêm hoặc cập nhật:

- `tests/pipeline-multi-batch-continuation.test.js`
- `tests/pipeline-stop-cancellation.test.js`
- `tests/veoup-open-dialog-confirmation.test.js`
- `tests/veoup-batch-modernization.test.js`
- `tests/veoup-batch-adapter-contract.test.js`

Kết quả kiểm thử tự động cuối cùng:

- Syntax check: đạt cho `pipeline_runner.js`, `renderer.js`, `veoup.js`.
- Full regression: **46/46 test files đạt**.

## 5. Các luồng được giữ nguyên

- NV1/NV2 và thứ tự xử lý scene.
- Request 2 sử dụng 10 keyframe gần nhất.
- Ghi `pipeline_state.json` và checkpoint trước khi chuyển scene.
- Autosave không nhúng lại asset base64; asset tiếp tục được tham chiếu bằng đường dẫn.
- Quét project, manifest, đối chiếu prompt và keyframe.
- Atomic staging vào `keyframes/_batch_ready`.
- Per-scene fallback của VeoUp và validation row/prompt sau khi import.
- Nút dừng tool: khoảng nghỉ renderer mới có thể bị hủy theo run ID.

## 6. Checklist kiểm thử trên Windows

Môi trường hiện tại không chạy được giao diện thật của `VeoUp.exe`, vì vậy cần smoke test trên máy Windows theo thứ tự:

1. Project 2 scene: xác nhận mỗi scene tiếp tục sau khoảng nghỉ và VeoUp nhập ảnh sau khi hộp thoại Open đóng.
2. Project 12 scene: xác nhận pipeline vượt ranh giới scene 10 mà không dừng.
3. Project 75 scene: xác nhận batch staging, thứ tự ảnh/prompt và khả năng chạy dài.
4. Trong lúc đang nghỉ 10 giây, bấm Dừng tool: xác nhận không có scene mới tự khởi động.
5. Cố ý làm hộp thoại Open không phản hồi: xác nhận tool báo `veoup-file-dialog-confirm-failed`, đóng dialog bằng cleanup và không nhập prompt lệch hàng.

Log mong đợi ở pipeline:

- `durable success committed; returning result to renderer`
- `inter-scene breather started (10000ms)`
- `inter-scene breather completed`

Proof mong đợi ở VeoUp khi batch thành công:

- `exact-folder-ctrl-a-open-confirmed`

## 7. Giới hạn xác minh

Toàn bộ kiểm thử tĩnh và tự động đã đạt. Việc click thực tế trên native Windows File Open dialog và giao diện VeoUp vẫn cần xác minh bằng smoke test trên đúng máy đang chạy production.
