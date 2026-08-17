# Vidora v6 — Báo cáo triển khai payload file TXT

Ngày triển khai: 2026-08-03  
Source gốc: `Vidora-v6-pipeline-batch-veoup-open-fix-2026-07-20.zip`  
SHA-256 source gốc: `694d5c47e3e69a2a9166c9e90b1e200f82d16cbb5ac2e3b338e164111fc2b60e`

## Kết quả

Luồng NV1/NV2 đã được chuyển từ dán prompt dài vào composer ChatGPT sang payload file `.txt` có version theo nội dung.

- NV1 gửi đúng một file yêu cầu TXT, không gửi ảnh tham chiếu.
- NV2 gửi keyframe hiện tại và đúng một file yêu cầu TXT.
- Composer chỉ nhận control prompt ngắn có tên file và 12 ký tự đầu của SHA-256 nội dung.
- Attachment, control prompt và fingerprint được kiểm tra như một payload nguyên tử trước khi Send.
- Sau F5 hoặc retry, attachment bắt buộc được tải lại và kiểm tra lại trước khi gửi.
- `motion_prompt.txt` vẫn chỉ là đầu ra của NV2 và đầu vào của VeoUp; nó không được dùng làm file yêu cầu NV2.
- Khi một scene dùng hết hai lần phục hồi, pipeline không còn hiện popup và dừng. Nó tự đặt lại ngân sách retry, giữ checkpoint/tài sản hợp lệ, chờ 15–30 giây rồi tiếp tục chính scene đó trong cùng `runId`.

## Dạng artifact theo scene

Mỗi `scene_XXX` được materialize nguyên tử với hai file:

| Stage | File yêu cầu | Attachment gửi ChatGPT |
|---|---|---|
| NV1 | `scene_XXX_nv1_request.txt` | File TXT này |
| NV2 | `scene_XXX_nv2_request.txt` | Keyframe + file TXT này |

Nội dung mỗi file yêu cầu được tạo từ preprompt đúng stage và kịch bản scene. Nhãn phân cách mới là:

`--- KỊCH BẢN CẦN TẠO: ---`

Control prompt có dạng:

`Thực hiện yêu cầu trong file sau: <tên-file> | id=<sha256-rút-gọn>`

Lần retry đơn của NV1 dùng cùng tên file và SHA-256, thêm `| retry=1`; không ghép lại prompt dài.

## Các thay đổi chính

| File | Thay đổi |
|---|---|
| `electron/main/pipeline/scene_request_files.js` | Module mới tạo nội dung NV1/NV2, ghi file nguyên tử, tính SHA-256, control prompt và payload fingerprint. |
| `electron/main/pipeline/index.js` | Export module artifact mới. |
| `electron/main.js` | Materialize request files khi chuẩn bị scene folder; các builder cũ ủy quyền cho builder mới. |
| `electron/main/pipeline/pipeline_runner.js` | Tạo artifact trước mỗi scene; web flow chỉ truyền request artifact; lưu metadata payload; tự mở vòng phục hồi mới từ checkpoint sau hai lần lỗi, giữ keyframe và mở quyền resend NV2 khi cần. |
| `electron/main/chatgpt/chatgpt_upload.js` | Chọn input tương thích theo loại file; upload tuần tự; xác minh đúng toàn bộ tên file, đúng số lượng và ổn định hai lần đọc. |
| `electron/main/chatgpt/chatgpt_dom.js` | Trả thêm trạng thái attachment hoàn tất, progress và composer busy. |
| `electron/main/chatgpt/chatgpt_core.js` | Bổ sung giá trị mặc định cho trạng thái attachment. |
| `electron/main/chatgpt/chatgpt_send.js` | Payload gate trước Send/Enter; payload có file không được rơi xuống force-submit. |
| `electron/main/chatgpt/chatgpt_pipeline.js` | NV1/NV2 dùng control prompt + artifact; recovery/retry tải lại file; ownership dựa trên control hash và payload fingerprint. |
| `electron/main/state/state.js` | Match attachment theo tên đầy đủ một chiều; snapshot và action journal chuyển sang ghi JSON nguyên tử theo hàng đợi; lỗi ghi được đẩy lên caller. |
| `electron/renderer.js` | Notice tự phục hồi chỉ cập nhật trạng thái/log, không gọi `window.alert`; có nhánh fallback tự chạy lại nếu nhận mã lỗi pause từ backend cũ. |

## Tự khởi động lại sau lỗi phục hồi

- Hai lần thử trong mỗi chu kỳ vẫn được giữ để tận dụng cơ chế phục hồi hiện có.
- Hết chu kỳ, `retryCount` được đặt lại về 0 và `recoveryLimitReached` luôn là `false`.
- `paused=false`, `active=true`, `waitingForUserStart=false`; không cần người dùng bấm Start.
- Lần tự khởi động lại đầu chờ 15 giây; các lần tiếp theo chờ tối đa 30 giây để tránh lặp quá nhanh.
- Vòng mới tiếp tục trong cùng pipeline lock và cùng `runId`, vì vậy không mở hai pipeline cho cùng scene.
- Nếu đang ở NV2 và keyframe còn hợp lệ nhưng chưa có `motion_prompt.txt`, keyframe được giữ và snapshot cho phép một lần resend payload NV2 đúng scene.
- Nút Dừng tool vẫn hủy `runId`; sau khoảng chờ hiện tại, pipeline kiểm tra hủy trước khi thử lại.

## Ownership và trạng thái phục hồi

Snapshot và `pipeline_state.json` hiện lưu các trường liên quan đến request artifact:

- đường dẫn file yêu cầu;
- SHA-256 nội dung;
- hash control prompt;
- danh sách tên attachment dự kiến;
- SHA-256 file cục bộ;
- số attachment;
- payload fingerprint;
- sent payload fingerprint.

Một draft chỉ được coi là thuộc scene hiện tại khi control prompt và toàn bộ attachment khớp. Tên gần giống, file cũ của scene khác, attachment thừa, attachment đang upload hoặc composer busy đều không được coi là sẵn sàng gửi.

## Hành vi fail-closed

Pipeline không bấm Send khi xảy ra một trong các trường hợp sau:

- thiếu request artifact hoặc hash file không khớp;
- thiếu một attachment hoặc có attachment ngoài payload;
- attachment chưa upload xong;
- control prompt trong composer chưa khớp;
- composer đang busy;
- ownership sau gửi không xác nhận được;
- snapshot/action journal không thể ghi an toàn.

## Tương thích và phạm vi giữ nguyên

- Project cũ được materialize request files khi scene folders được bảo đảm hoặc khi pipeline chuẩn bị scene; không cần migration thủ công.
- Không đổi tên keyframe, `motion_prompt.txt`, `motion_prompt_from_chatgpt.txt` hay batch manifest của VeoUp.
- Không thay đổi giới hạn Request 2 gồm tối đa 10 keyframe.
- Không thay đổi conversation lock, detector ảnh, NV2 manual recovery, autosave path-only và VeoUp Open-dialog confirmation.

## Nợ kỹ thuật còn lại

`waitForChatGptImageOrRetry()` cũ vẫn tồn tại để giữ tương thích export nhưng dừng ngay bằng lỗi `legacy-nv1-text-retry-disabled-use-file-payload`. Phần code nằm sau lệnh dừng là unreachable và không có call-site sống trong pipeline mới. Có thể xóa riêng trong một đợt cleanup sau khi smoke test Windows hoàn tất.
