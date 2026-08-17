# Vidora V6 — Audit lỗi pipeline dừng ở biên 10 scene và VeoUp không bấm Open

Ngày lập: 2026-07-20  
Source được audit: Vidora V6, bản VeoUp batch stable ngày 2026-07-19  
Phạm vi: chẩn đoán và lập kế hoạch; chưa sửa mã nguồn vận hành trong tài liệu này

## 1. Tóm tắt kết luận

Hai lỗi là hai sự cố độc lập:

| Sự cố | Kết luận | Mức chắc chắn |
|---|---|---|
| Pipeline không chạy tiếp sau nhóm 10 scene | Scene cuối đã hoàn tất và đã lưu checkpoint, nhưng lời gọi từ renderer sang main process chưa nhận được kết quả trả về. Điểm dừng quan sát được là khoảng nghỉ 10 giây nằm sau khi đã commit thành công scene. Vì renderer còn giữ mã phiên chạy nên giao diện bị khóa ở trạng thái đang chạy. | Cao đối với vị trí treo và chuỗi hậu quả; trung bình đối với nguyên nhân cấp hệ điều hành khiến timer không trở lại. |
| VeoUp chọn toàn bộ keyframe nhưng không bấm Open | Code đang dùng số lượng phần tử mà Windows UI Automation nhìn thấy làm điều kiện chặn. Với danh sách ảnh dạng ảo hóa, số đếm có thể thiếu; code thoát trước lệnh Enter/Open và để nguyên hộp thoại. | Cao. Ảnh chụp và thứ tự lệnh trong source khớp trực tiếp với nhánh lỗi. |

Không có bằng chứng cho thấy hai lỗi do nội dung prompt, file ảnh hỏng, Autosave `.vdra`, Request 2 lấy 10 keyframe, hoặc cơ chế refresh bộ nhớ ChatGPT.

## 2. Audit lỗi pipeline

### 2.1. Bằng chứng từ log

Log được cung cấp kết thúc tại scene 42 với chuỗi sự kiện:

1. Keyframe `scene_042_keyframe.png` đã được xác thực.
2. Lần gửi NV2 đầu tiên gặp lỗi `nv2-user-message-not-confirmed-after-send`.
3. Cơ chế phục hồi thử lại và nhận được phản hồi NV2 hợp lệ.
4. Motion prompt đã được ghi vào `motion_prompt.txt`.
5. Scene được gắn `keyframe_motion_complete`.
6. `pipeline_state.json` đã được lưu với stage `complete`.
7. Log xác nhận scene hoàn tất thành công.
8. Dòng cuối cùng là:

```text
Scene 42 completed in this run: sleeping 10000ms before returning success...
```

Thời điểm sao chép log muộn hơn dòng cuối hơn 10 phút nhưng không có thêm sự kiện. Vì khoảng nghỉ dự kiến chỉ 10 giây, đây không phải một khoảng nghỉ bình thường.

Các tín hiệu phủ định cũng quan trọng:

- Không có `PIPELINE_PAUSED_AFTER_RECOVERY_LIMIT`.
- Không có lệnh dừng từ người dùng.
- Không có lỗi CDP hoặc renderer sau khi scene hoàn tất.
- Bộ đếm refresh là `2/5`, chưa tới ngưỡng refresh định kỳ.
- Không có dòng `Renderer run-scene raw result`, nghĩa là renderer chưa nhận được kết quả IPC của scene 42.

### 2.2. Đường đi trong source

Các file liên quan:

- `electron/main/pipeline/pipeline_runner.js`
- `electron/renderer.js`
- `tests/pipeline-stop-cancellation.test.js`

Trong `pipeline_runner.js`, kết quả scene đã được xác thực và checkpoint đã được ghi trước đoạn sau:

```js
await sleep(10000);
assertPipelineRunActive(runId);
return result;
```

Renderer đang chờ tại:

```js
const result = await window.videoPlannerAPI.runScenePipeline(...);
```

Vì lời gọi chưa trả về, renderer chưa thể:

- Cập nhật scene 42 vào state giao diện.
- Ghi log `Renderer run-scene raw result`.
- Kết thúc vòng lặp của batch hiện tại.
- Chọn batch scene kế tiếp.
- Chạy nhánh `Auto-advancing batch segment`.

Trong khi đó, `activePipelineRunId` vẫn còn hiệu lực. Logic khóa nút Start xem một phiên có mã chạy là phiên đang hoạt động, nên giao diện tiếp tục hiển thị “Đang chạy pipeline” dù không có tiến triển mới.

### 2.3. Vì sao lỗi có vẻ xảy ra sau mỗi 10 scene

`project.batchSize` đang bị giới hạn từ 1 đến 10. Sau scene thứ 10 của một batch, renderer phải nhận kết quả cuối rồi mới tạo/chọn batch kế tiếp.

Khoảng nghỉ 10 giây trong main process thực tế được gọi sau mỗi scene, không phải chỉ sau mỗi 10 scene. Tuy nhiên ở biên batch, một kết quả bị treo sẽ chặn luôn bước chuyển batch, nên người dùng quan sát thấy quy luật “dừng sau 10 scene”.

Request 2 lấy 10 keyframe gần nhất không tham gia vào quyết định dừng/chuyển batch và không phải nguyên nhân của lỗi này.

### 2.4. Lỗ hổng kiểm thử hiện tại

Test hiện tại chỉ kiểm tra bằng chuỗi rằng source vẫn chứa:

```js
await sleep(10000)
```

Không có test thực thi mô phỏng 11 scene trở lên. Vì vậy toàn bộ test có thể pass nhưng lỗi chuyển qua biên batch vẫn tồn tại.

## 3. Audit lỗi VeoUp không bấm Open

### 3.1. Bằng chứng

Ảnh chụp cho thấy:

- Hộp thoại chọn file đã mở đúng thư mục `keyframes/_batch_ready`.
- Nhiều keyframe đã được chọn.
- Ô File name chứa danh sách tên file đã chọn.
- Nút Open vẫn chưa được kích hoạt.

File log VeoUp được gửi kèm có dung lượng 0 byte, nên không có telemetry runtime để phân biệt giữa số đếm sai và lời gọi UI Automation bị treo. Tuy vậy cả hai trường hợp đều đi qua cùng một điểm thiết kế có vấn đề: code xác minh selection trước khi bấm Open.

### 3.2. Đường đi trong source

File liên quan chính:

- `electron/main/veoup/veoup.js`

Trình tự hiện tại:

1. Chuyển tới `_batch_ready` bằng thanh địa chỉ.
2. Đưa tên file đầu tiên vào File name.
3. Chuyển focus về danh sách file.
4. Gửi `Ctrl+A`.
5. Gọi `Get-OpenFileDialogSelectionProof(expectedCount)`.
6. Nếu số đếm khác kỳ vọng, thử `Ctrl+A` thêm một lần.
7. Nếu vẫn khác, trả kết quả lỗi rồi `exit 0`.
8. Lệnh `Enter` để xác nhận hộp thoại chỉ nằm sau nhánh trên.

Nhánh lỗi hiện tại thoát mà không bấm Open và cũng không gửi Esc để đóng hộp thoại.

### 3.3. Nguyên nhân số đếm không đáng tin

`Get-OpenFileDialogSelectionProof` quét toàn bộ cây Windows UI Automation rồi đếm các phần tử có `SelectionItemPattern`.

Danh sách thumbnail của hộp thoại Windows có thể dùng cơ chế ảo hóa:

- Chỉ các file đang hiển thị trên màn hình được materialize thành phần tử UI Automation.
- Ảnh đã được chọn nhưng nằm ngoài vùng nhìn thấy có thể không xuất hiện trong cây đang quét.
- Chuỗi trạng thái “N items selected” phụ thuộc ngôn ngữ Windows; regex hiện tại chủ yếu nhận tiếng Anh.
- Quét sâu toàn bộ cây UIA có thể chậm hoặc treo ở lời gọi COM của một phần tử.

Do đó số lượng UIA không được dùng làm điều kiện chặn trước Open, đặc biệt với 75–300 ảnh.

### 3.4. Vì sao các test hiện tại vẫn pass

Test VeoUp hiện tại chủ yếu kiểm tra source có:

- Thư mục `_batch_ready`.
- `Shift+Tab` và `Ctrl+A`.
- Nhánh xác minh sau khi nạp.

Test không chạy hộp thoại Windows thật và không kiểm tra rằng lệnh Open chắc chắn được gọi sau `Ctrl+A`.

## 4. Nguyên tắc sửa để không ảnh hưởng luồng đang hoạt động

Các hành vi sau phải được giữ nguyên:

1. Luồng NV1 tạo keyframe.
2. Luồng NV2 tạo motion prompt và cơ chế phục hồi hiện tại.
3. Request 2 sử dụng tối đa 10 keyframe gần nhất.
4. Cơ chế staging tăng dần và ghi atomic:
   - `keyframes/scene_XXX_keyframe.png`
   - `motion_prompts/scene_XXX_motion_prompt.txt`
   - `veoup_prompts_ready.txt`
   - `pipeline_state.json`
5. Luồng VeoUp từng scene vẫn dùng một đường dẫn file duy nhất.
6. Luồng batch vẫn dùng `_batch_ready`, không quay lại dán chuỗi đường dẫn dài.
7. Scan thủ công vẫn cho phép tập con sạch; auto-run cuối pipeline vẫn strict.
8. Nút Stop phải hủy được delay, batch kế tiếp và tiến trình VeoUp.
9. Autosave `.vdra` tiếp tục lưu đường dẫn asset; không nhúng lại toàn bộ ảnh base64.
10. Không thay nội dung NV1/NV2, prompt tổng hoặc quy tắc nhận diện ảnh.

## 5. Kế hoạch triển khai

### Bước 0 — Tạo test tái hiện trước khi sửa

Mục tiêu: chứng minh hai lỗi có thể được bắt bằng test và tránh sửa dựa trên phỏng đoán.

Công việc:

- Thêm test mô phỏng pipeline 12 scene với batch size 10.
- Xác minh scene 11 được gọi tự động sau scene 10.
- Xác minh renderer nhận kết quả scene trước khi bước nghỉ giữa scene bắt đầu.
- Thêm test kiểm tra callback chuyển batch luôn có xử lý lỗi, không tạo Promise rejection không được bắt.
- Thêm test source/script bảo đảm nhánh mismatch selection không được phép `exit` trước khi thử xác nhận Open.
- Giữ test staging chính xác 75 file hiện có.

File dự kiến:

- `tests/pipeline-multi-batch-continuation.test.js`
- `tests/veoup-open-dialog-confirmation.test.js`
- Cập nhật `tests/pipeline-stop-cancellation.test.js`
- Cập nhật `tests/veoup-batch-modernization.test.js`

Điều kiện hoàn tất:

- Test mới thất bại trên source hiện tại vì tái hiện đúng lỗ hổng.
- Test cũ vẫn chạy bình thường.

### Bước 1 — Sửa điểm trả kết quả của pipeline

Mục tiêu: scene đã commit thành công phải được trả về renderer ngay, không giữ IPC bởi một khoảng nghỉ không thiết yếu.

Công việc trong `electron/main/pipeline/pipeline_runner.js`:

- Bỏ khoảng nghỉ 10 giây nằm giữa checkpoint thành công và `return result`.
- Thêm log rõ ràng ngay trước khi trả kết quả:

```text
Scene N durable success committed; returning result to renderer.
```

- Không thay đổi checkpoint, bộ đếm refresh, NV1/NV2 recovery hoặc xác thực đầu ra.

Công việc trong `electron/renderer.js`:

- Giữ khoảng nghỉ giảm tải nhưng chuyển nó sang renderer, sau khi renderer đã nhận và persist kết quả scene.
- Dùng `pipelineDelay(..., runId)` để nút Stop có thể hủy khoảng nghỉ.
- Ghi log bắt đầu/kết thúc khoảng nghỉ để phân biệt “đang nghỉ” với “đang treo”.
- Bổ sung xử lý lỗi cho callback chuyển batch; mọi exception phải:
  - Được ghi log.
  - Mở khóa trạng thái chạy hợp lệ.
  - Giữ checkpoint scene đã hoàn tất.
  - Không gửi lại NV1/NV2 nếu scene đã complete.

Phương án ưu tiên là giữ cơ chế chuyển batch hiện tại để giảm phạm vi thay đổi, nhưng bọc callback bằng `try/catch`. Chỉ chuyển sang vòng lặp batch lớn nếu test cho thấy timer hiện tại vẫn gây lỗi.

Điều kiện hoàn tất:

- Renderer nhận kết quả scene ngay sau khi main commit.
- Khoảng nghỉ vẫn tồn tại nhưng hiển thị được trạng thái và hủy được.
- Scene 11 tự chạy sau scene 10 mà không cần bấm Start lại.
- Không tăng số lần gửi prompt hoặc upload keyframe.

### Bước 2 — Sửa xác nhận Open của VeoUp

Mục tiêu: sau khi `_batch_ready` được chọn toàn bộ, tool phải thử bấm Open một cách xác định trước khi dùng các phép xác minh hậu kỳ.

Công việc trong `electron/main/veoup/veoup.js`:

- Giữ nguyên kiểm tra trước khi mở dialog rằng `_batch_ready` chứa chính xác tập file dự kiến.
- Sau `Ctrl+A`, không dùng số lượng phần tử UIA làm điều kiện `exit` trước Open.
- Tạo helper riêng, ví dụ `Confirm-OpenFileDialogSelection`, theo thứ tự:
  1. Xác nhận foreground là dialog `#32770`.
  2. Tìm button có Automation ID chuẩn của nút xác nhận hoặc tên `Open/Mở`.
  3. Gọi `InvokePattern` trực tiếp.
  4. Nếu không invoke được, fallback bằng `Enter`.
  5. Chờ dialog đóng trong thời gian giới hạn.
  6. Nếu vẫn mở, thử invoke thêm một lần rồi mới báo lỗi.
- Không quét sâu toàn bộ cây UIA để đếm 75–300 selection trước khi Open.
- Chuyển selection proof thành telemetry tham khảo:
  - `exact-folder-file-count`
  - `ctrl-a-issued`
  - `open-button-invoked`
  - `dialog-closed`
- Nếu cuối cùng thất bại, gửi `Esc`, trả lỗi có cấu trúc và không để dialog chặn VeoUp.
- Sau khi dialog đóng, tiếp tục dùng validation hàng ảnh/prompt hiện có trước khi bấm Generate.

Luồng từng scene không thay đổi, ngoại trừ có thể dùng chung helper xác nhận Open nếu test chứng minh tương thích.

Điều kiện hoàn tất:

- Dialog đóng sau khi chọn toàn bộ file.
- VeoUp nhận đúng số hàng ảnh.
- Không bấm Generate nếu số ảnh/prompt sau khi nạp không khớp.
- Khi lỗi, dialog không bị bỏ lại trên màn hình.

### Bước 3 — Kiểm thử hồi quy tự động

Chạy toàn bộ test hiện có và test mới.

Ma trận bắt buộc:

| Nhóm | Trường hợp |
|---|---|
| Pipeline | 2 scene, 10 scene, 12 scene, 25 scene giả lập |
| Chuyển batch | 9→10→11 và 19→20→21 |
| Resume | Scene cuối batch đã complete nhưng renderer khởi động lại |
| Stop | Dừng khi đang nghỉ giữa scene và khi đang chờ batch kế tiếp |
| NV2 recovery | Lần đầu gửi không được xác nhận, lần hai thành công |
| VeoUp staging | 1, 2, 75 và 300 keyframe |
| VeoUp dialog | Invoke Open thành công, fallback Enter, dialog không đóng, người dùng đổi focus |
| Tương thích | Luồng một scene và scan project thủ công |
| Autosave | `.vdra` không chứa base64 asset mới |

Điều kiện hoàn tất:

- Toàn bộ 44 test cũ pass.
- Các test mới pass.
- Không còn test buộc khoảng nghỉ phải nằm trong main process.
- Kiểm tra cú pháp pass cho tất cả file JavaScript thay đổi.

### Bước 4 — Smoke test Windows với VeoUp thật

Phần này không thể xác nhận hoàn toàn trong môi trường Linux; cần chạy trên máy Windows có VeoUp.

Thứ tự test:

1. Project 2 scene để kiểm tra Open và mapping prompt cơ bản.
2. Project 12 scene để vượt biên batch 10.
3. Project 75 scene để kiểm tra danh sách file ảo hóa.
4. Chạy Stop trong khoảng nghỉ rồi Start lại.
5. Cố ý đưa một file ảnh lỗi vào staging để xác nhận validation chặn trước VeoUp.

Log cần quan sát:

```text
Scene 10 durable success committed; returning result to renderer.
Renderer received scene 10 result.
Inter-scene breather started/completed.
Auto-advancing batch segment to scenes: 11, 12, ...
VeoUp batch: Ctrl+A issued.
VeoUp batch: Open button invoked.
VeoUp batch: file dialog closed.
VeoUp batch: expected rows validated.
```

### Bước 5 — Đóng gói và bàn giao

- Cập nhật note thay đổi theo file và hàm.
- Chạy lại toàn bộ test lần cuối.
- Đóng gói source, không bao gồm `node_modules`.
- Kiểm tra ZIP bằng `unzip -t`.
- Tính SHA256 sau khi ZIP đã hoàn tất.
- Bàn giao ZIP, SHA256 và báo cáo test.

## 6. File dự kiến thay đổi khi triển khai

| File | Thay đổi dự kiến |
|---|---|
| `electron/main/pipeline/pipeline_runner.js` | Trả kết quả ngay sau durable commit; bỏ khoảng nghỉ khỏi main-side IPC; thêm log handoff. |
| `electron/renderer.js` | Quản lý khoảng nghỉ có thể hủy; bảo vệ lỗi chuyển batch; giữ resume/checkpoint. |
| `electron/main/veoup/veoup.js` | Xác nhận nút Open bằng UIA + fallback; bỏ selection count làm pre-Open gate; cleanup dialog khi lỗi. |
| `tests/pipeline-stop-cancellation.test.js` | Cập nhật vị trí chịu trách nhiệm cho inter-scene delay. |
| `tests/veoup-batch-modernization.test.js` | Bắt buộc có Open confirmation và không exit trước Open. |
| `tests/pipeline-multi-batch-continuation.test.js` | Test vượt biên batch 10. |
| `tests/veoup-open-dialog-confirmation.test.js` | Test cấu trúc xác nhận dialog và cleanup. |

Không dự kiến sửa `collection_store.js`, `batch_manifest.js`, prompt NV1/NV2 hoặc cấu trúc thư mục canonical trừ khi test phát hiện lỗi riêng.

## 7. Rủi ro và biện pháp kiểm soát

| Rủi ro | Biện pháp |
|---|---|
| Trả kết quả sớm khiến scene kế tiếp chạy quá nhanh | Giữ khoảng nghỉ 10 giây ở renderer sau khi persist kết quả. |
| Stop không hủy được khoảng nghỉ | Chỉ dùng `pipelineDelay` gắn `runId`. |
| Timer chuyển batch ném lỗi âm thầm | Bọc callback bằng `try/catch`, log và cập nhật trạng thái chạy. |
| UIA tìm sai nút Open | Ưu tiên Automation ID/control type; kiểm tra dialog đóng; fallback Enter. |
| Enter kích hoạt nhầm file/folder | Chỉ fallback khi foreground đúng dialog `#32770`; sau đó bắt buộc kiểm tra dialog đã đóng. |
| Chọn nhầm file ngoài batch | `_batch_ready` phải được dựng mới và xác thực chính xác trước khi mở dialog. |
| VeoUp chưa render đủ 75 hàng | Giữ bước chờ theo số lượng ảnh và validation sau khi dialog đóng. |
| Ảnh hưởng luồng một scene | Giữ nhánh `batchMode === false`; thêm test riêng cho một file. |

## 8. Tiêu chí nghiệm thu cuối cùng

Bản sửa chỉ được coi là hoàn tất khi đáp ứng toàn bộ điều kiện:

1. Scene 11 tự bắt đầu sau scene 10 mà không cần bấm Start.
2. Không còn trạng thái UI bị khóa vô thời hạn sau log scene complete.
3. Scene đã complete không bị gửi NV1/NV2 lặp lại khi resume.
4. Nút Stop hoạt động trong khoảng nghỉ và tại biên batch.
5. Với 75 keyframe, hộp thoại được xác nhận Open và tự đóng.
6. VeoUp nhận đúng 75 ảnh và 75 prompt theo đúng thứ tự scene.
7. Không dán chuỗi 75 đường dẫn vào File name.
8. Luồng VeoUp một scene vẫn hoạt động.
9. Không thay cấu trúc Autosave sang base64.
10. Toàn bộ test cũ và mới pass.
11. Smoke test Windows 2 scene và 12 scene pass trước khi thử 75 scene.
12. Source cuối được đóng gói, kiểm tra ZIP và cung cấp SHA256.

## 9. Thứ tự ưu tiên đề xuất

1. Sửa pipeline handoff trước vì lỗi này làm app bị khóa và ảnh hưởng trực tiếp khả năng chạy hàng giờ.
2. Sửa xác nhận Open của VeoUp sau khi pipeline vượt được biên batch.
3. Chạy test tự động toàn bộ.
4. Smoke test Windows với 2, 12 rồi 75 scene.
5. Chỉ đóng gói source sau khi cả hai luồng cùng pass.

