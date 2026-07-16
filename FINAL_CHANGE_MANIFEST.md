# Vidora final change manifest

Ngày kiểm chứng: 2026-07-14 (Asia/Ho_Chi_Minh)

## Kết quả chính

- Xóa hoàn toàn feature/naming `character` khỏi source Electron; thay bằng folder và IPC `preprompt`.
- Hoàn tất vòng đời `.vdra`: tạo cạnh folder output, từ chối trùng tên, autosave debounce 1 giây, checkpoint tức thời, flush trước khi đóng, nhớ và tự mở project gần nhất nhưng không tự chạy.
- Bỏ yêu cầu trường schema router cũ để project mới có thể tạo `.vdra` hợp lệ sau khi module cũ đã bị dọn.
- Thêm prompt NV1/NV2 mặc định cho lần chạy mới; người dùng vẫn có thể mở và sửa hai file prompt riêng.
- Khóa pipeline ChatGPT theo conversation ID; NV2 không chọn sidebar và không `Page.navigate`.
- Request 1 và Request 2 xác minh user-message ownership trước khi chuyển bước.
- Luồng scene là NV1 -> phát hiện/lưu keyframe -> upload keyframe + NV2 -> phát hiện/lưu motion prompt -> scene kế tiếp.
- NV1: chờ 8 phút, F5 cùng chat, chờ 5 phút, gửi lại NV1 đúng một lần, rồi chờ lượt cuối.
- NV2: yêu cầu response tối thiểu 120 ký tự, hoàn tất, không streaming, ổn định 3 tick và 4 giây; timeout chỉ F5 cùng chat một lần, không gửi trùng.
- Giới hạn 2 chu kỳ phục hồi cho mỗi scene; sau đó lưu checkpoint và pause, renderer không tự retry lại marker này.
- Siết ảnh CDP network tối thiểu 512x512 và 120 KB trước khi nhận là ảnh cuối.
- Cập nhật theo DOM image-generation mới của ChatGPT: NV1 chỉ poll/hydrate/adopt/extract từ `.agent-turn > .group/imagegen-image > img[alt^="Generated image"]`; không còn tìm ảnh trong logical assistant message. Baseline image-turn được lưu riêng cho từng scene để không lấy nhầm ảnh cũ.
- Bỏ phụ thuộc vào `alt="Generated image"` tiếng Anh: NV1 nhận mọi `img` nằm trong image card thuộc đúng lượt, sau đó vẫn kiểm tra visibility, kích thước, trạng thái tải, nội dung và ownership.
- Khi stop button đã biến mất nhưng grey wrapper chưa hydrate ảnh, Vidora chờ 15 giây rồi F5 đúng conversation hiện tại tối đa một lần. Sau F5 phải xác minh lại conversation ID và hash NV1; không gửi lại prompt.
- Giữ nguyên đường NV2 đọc text từ logical assistant/markdown; image card không được dùng làm nguồn motion prompt.
- Sửa NV2 với DOM tái sử dụng assistant node: `readLatestAssistantScript` nay trả hash thật; response text thay đổi ngay trong node cũ được nhận là `assistant-role-in-place-mutation` chỉ khi latest user prompt vẫn thuộc NV2. Chỉ lưu sau khi hash ổn định 3 tick/4 giây và cả hard-generating lẫn soft-busy đều tắt.
- Sửa runtime monitor: toàn bộ MutationObserver script nay thực sự được inject; image states không bị nhầm thành HYDRATING khi composer tạm vắng.
- Sửa OOM/not responding ở run dài: bỏ hoàn toàn `imageDataUrl` khỏi kết quả IPC và dữ liệu scene persist; renderer chỉ giữ đường dẫn file cùng metadata pipeline rút gọn.
- Sửa phép đo RAM Electron dùng đúng trường `private`/`residentSet` (KiB), đồng thời ghi thêm JS heap, DOM node, document và event-listener của tab ChatGPT.
- Đóng BrowserAdapter/CDP session trên mọi nhánh thoát và gỡ đủ listener Playwright khi runtime monitor restart/stop.
- Sau mỗi 5 scene ChatGPT hoàn tất, refresh đúng conversation ID hiện tại để giải phóng tài nguyên run dài; chính sách không tự đổi/new chat vẫn được giữ nguyên.
- Sửa deadlock wrapper xám ở scene đầu: chỉ recovery `stale NV1 wrapper` được phép vượt `WAIT_ACCEPT` để F5 đúng chat; active action, upload và send state vẫn chặn reload.
- Sửa lỗi ảnh đã hiện nhưng app không nhận sau khi ChatGPT reload/virtualize DOM: baseline `.agent-turn` tuyệt đối được rebase chỉ khi latest user-message hash vẫn thuộc NV1 hiện tại, image card nằm sau đúng user turn, ảnh đã hoàn chỉnh và Stop/placeholder đều biến mất. Ảnh owned đã hiện sau rebase sẽ tiếp tục được extract mà không F5 hoặc gửi trùng NV1.
- Resume scene đang dở chấp nhận cả hash NV1 gốc và hash `RETRY 1` chuẩn; hash retry được ghi vào scene snapshot để mở lại app vẫn tiếp tục nhận đúng ảnh hiện có.
- `npm test` nay chạy toàn bộ `tests/*.test.js` thay vì một danh sách con.

## File trọng tâm

- `electron/main.js`
- `electron/renderer.js`
- `electron/preload.js`
- `electron/main/bootstrap/bootstrap.js`
- `electron/main/ipc/ipc_handlers.js`
- `electron/main/chatgpt/chatgpt_pipeline.js`
- `electron/main/chatgpt/chatgpt_runtime_monitor.js`
- `electron/main/pipeline/pipeline_runner.js`
- `package.json`
- `tests/run-all-tests.js`
- `tests/chatgpt-agent-turn-image-root.test.js`
- `tests/chatgpt-nv2-in-place-response.test.js`
- `tests/long-run-oom-gray-wrapper.test.js`

## Artifact

- `vidora-final-source.zip`: source, tests và tài liệu; không chứa `node_modules`, cache hay `dist`.
- `vidora-windows-portable.zip`: bản Windows x64 giải nén và chạy `Vidora.exe`; có `resources/ffmpeg.exe`.
- NSIS installer chưa được tạo trong môi trường Linux vì electron-builder yêu cầu Wine ở bước cuối. Có thể chạy `npm run dist` trên Windows để tạo installer.
