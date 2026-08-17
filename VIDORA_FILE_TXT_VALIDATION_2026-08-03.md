# Vidora v6 — Xác minh và checklist smoke test payload file TXT

Ngày xác minh tự động: 2026-08-03

## Đã xác minh trong môi trường hiện tại

| Hạng mục | Kết quả |
|---|---:|
| SHA-256 source gốc | Khớp `694d5c47…1fc2b60e` |
| Kiểm tra cú pháp 9 file JavaScript trọng yếu | Đạt |
| Test hành vi mới/chính chạy trực tiếp, không nạp normalization hook | 7/7 đạt |
| Toàn bộ test file của source | 52/52 đạt |
| Test file baseline trước sửa | 46/46 đạt |

Bảy test hành vi mới/chính chạy độc lập gồm:

1. Tạo request artifact và tính hash/fingerprint.
2. Exact attachment gate.
3. Atomic payload gate trước Send.
4. NV1 initial/retry/recovery dùng request TXT.
5. NV2 dùng keyframe + request TXT.
6. Ghi nguyên tử scene snapshot và action journal.
7. Tự khởi động lại pipeline sau hai lần phục hồi, không pause, không xóa keyframe và mở lại NV2 recovery đúng scene.

Suite 52 test vẫn có nhiều test kiểm tra cấu trúc source, vì vậy kết quả này không thay thế smoke test giao diện thật.

## Chưa thể xác minh trong môi trường hiện tại

- ChatGPT DOM và file-input thật của tài khoản đang đăng nhập.
- Electron/Chrome runtime thật trên Windows.
- File dialog, F5 và phục hồi trong một conversation ChatGPT thật.
- Chạy dài nhiều scene và mức sử dụng bộ nhớ renderer Chrome thật.
- Build/installer Windows.

Không nên phát hành production trước khi hoàn tất checklist dưới đây.

## Checklist smoke test Windows bắt buộc

### A. Chuẩn bị và artifact

- [ ] Sao lưu project và source production hiện tại.
- [ ] Tạo project test có ít nhất 3 scene với nội dung dễ phân biệt.
- [ ] Xác nhận mỗi `scene_XXX` có `scene_XXX_nv1_request.txt` và `scene_XXX_nv2_request.txt`.
- [ ] Xác nhận hai file không rỗng, chứa đúng preprompt của stage và đúng scene.
- [ ] Sửa kịch bản một scene rồi materialize lại; xác nhận nội dung, SHA-256 và control id thay đổi.

### B. NV1 bình thường

- [ ] Trước Send, composer có đúng một attachment là `scene_XXX_nv1_request.txt`.
- [ ] Không có keyframe hoặc ảnh tham chiếu trong composer NV1.
- [ ] Composer chỉ chứa control prompt ngắn, không chứa toàn bộ NV1.
- [ ] Control prompt có đúng tên file và id SHA-256 rút gọn.
- [ ] Sau Send, chỉ tạo một user turn thuộc scene hiện tại.
- [ ] Ảnh được detect và lưu đúng tên như phiên bản trước.

### C. NV1 retry và F5

- [ ] Cưỡng bức một text-only response hoặc timeout an toàn để kích hoạt single retry.
- [ ] Retry tải lại đúng request TXT và gửi control prompt có `retry=1`.
- [ ] Không có prompt dài được dán lại.
- [ ] F5 trước khi Send; xác nhận pipeline tải lại attachment rồi mới gửi.
- [ ] F5 sau khi user turn đã tồn tại; xác nhận ownership nhận ra lượt cũ và không gửi trùng.

### D. NV2 bình thường

- [ ] Composer có đúng hai attachment: keyframe hiện tại và `scene_XXX_nv2_request.txt`.
- [ ] Không đính kèm `motion_prompt.txt` hoặc file request của scene khác.
- [ ] Composer chỉ chứa control prompt ngắn của NV2.
- [ ] Attachment gate chờ cả hai file upload hoàn tất trước Enter/click Send.
- [ ] Câu trả lời được lưu vào `motion_prompt.txt` và `motion_prompt_from_chatgpt.txt` như trước.

### E. NV2 recovery

- [ ] F5 khi draft NV2 đang tồn tại; xác nhận keyframe và request TXT được tải lại đầy đủ.
- [ ] Xóa một attachment khỏi composer; xác nhận pipeline không gửi payload thiếu.
- [ ] Thêm một attachment thừa; xác nhận pipeline dọn draft hoặc dừng, không gửi nhầm.
- [ ] Đổi tên file gần giống file dự kiến; xác nhận exact-name gate không báo đạt nhầm.
- [ ] Làm thay đổi nội dung request file sau materialize; xác nhận hash mismatch dừng stage.

### F. Trạng thái và crash recovery

- [ ] Kiểm tra `scene_snapshot.json`, `action_journal.json` và `pipeline_state.json` chứa fingerprint/attachment metadata.
- [ ] Tắt app tại điểm trước Send rồi mở lại; xác nhận không gửi trùng và không dùng attachment cũ.
- [ ] Mô phỏng lỗi ghi snapshot; xác nhận pipeline fail-closed thay vì chạy tiếp.
- [ ] Manual recovery NV2 vẫn giữ keyframe hợp lệ và mở lại retry budget.
- [ ] Cưỡng bức scene lỗi đủ hai lần; xác nhận không có popup, trạng thái vẫn Running và scene tự chạy lại sau 15 giây.
- [ ] Để lỗi tiếp tục thêm một chu kỳ; xác nhận lần sau chờ 30 giây, không tạo pipeline/song song hoặc gửi trùng.
- [ ] Khi NV2 lỗi đủ hai lần, xác nhận keyframe cũ còn nguyên và payload được phục hồi đúng scene.
- [ ] Bấm Dừng tool trong thời gian chờ tự chạy lại; xác nhận không có lần thử mới sau khi hủy.

### G. VeoUp và regression

- [ ] `motion_prompt.txt` đầu ra vẫn ghép đúng với keyframe trong `_batch_ready`.
- [ ] VeoUp chọn toàn bộ ảnh, bấm Open và xác nhận đúng số hàng.
- [ ] Request 2 vẫn tải tối đa 10 keyframe.
- [ ] Autosave `.vdra` vẫn path-only và mở lại project bình thường.
- [ ] Dừng pipeline và chạy lại không để lại send lock.

### H. Chạy dài

- [ ] Chạy tối thiểu 20 scene trong cùng điều kiện từng gây unresponsive.
- [ ] Theo dõi độ dài user message: chỉ còn control prompt ngắn, không tăng theo preprompt.
- [ ] Ghi CPU/RAM Chrome sau scene 1, 5, 10 và 20.
- [ ] Không có duplicate send, attachment lẫn scene hoặc tab unresponsive.

## Điều kiện phát hành

Chỉ đánh dấu bản sửa sẵn sàng phát hành khi:

- toàn bộ mục A–G đạt;
- chạy dài H không tái hiện lỗi;
- có log hoặc ảnh chụp chứng minh payload NV1/NV2 đúng;
- installer Windows được build và chạy thử trên một máy sạch;
- source ZIP/installer được ghi SHA-256 để rollback và đối chiếu.
