# Vidora Manual Mode — Codex Implementation Task + `$ship` Prompt

Repository: `https://github.com/Zazaa0606/Grok-bac-Tai`  
Audit baseline: commit `a82fcc082bb3268fef11be83fca0c9d3428197d8` (`a82fcc0`)  
Audit source: `VIDORA_MANUAL_MODE_AUDIT_2026-09-19.md`

## 1. Mục tiêu

Đưa Vidora về một chức năng chính: **Manual ChatGPT Keyframe + Motion Prompt workflow**.

Người dùng là bên thực hiện mọi thao tác gửi lên ChatGPT:

- tự attach file;
- tự paste prompt;
- tự bấm Send;
- tự chọn/mở conversation mới khi cần.

Vidora chỉ:

- tạo đúng prompt bundle và danh sách attachment;
- copy prompt cho người dùng;
- hướng dẫn stage hiện tại;
- theo dõi phản hồi sau khi stage đã được arm;
- lưu và validate keyframe/motion prompt;
- checkpoint và resume;
- chuyển sang scene tiếp theo;
- chỉ mở VeoUp sau khi đủ toàn bộ scene.

## 2. Hành vi sản phẩm đã chốt

### 2.1. Luồng canonical

Giữ semantic giống luồng `Generate Keyframe + Motion Prompt only` hiện tại:

```text
Nếu ChatGPT là chat mới/rỗng:
REQUEST_1 -> capture ready response
REQUEST_2 -> capture ready response

Sau khi hydrate:
Scene 1: NV1 -> save/validate keyframe -> NV2 -> save/validate motion prompt
Scene 2: NV1 -> save/validate keyframe -> NV2 -> save/validate motion prompt
...
Scene N: NV1 -> save/validate keyframe -> NV2 -> save/validate motion prompt

Disk audit xác nhận N/N scene hợp lệ
-> VEOUP_READY
-> chạy strict VeoUp batch
```

Request 1/2 là hydration theo conversation mới/rỗng, **không lặp lại ở từng scene**. Giữ cùng conversation trong toàn bộ run; không tự động tạo chat mới. Nếu người dùng chủ động mở chat mới thì workflow phải yêu cầu hydrate Request 1/2 lại trước NV1.

### 2.2. Không được tự động gửi ChatGPT

Khi workflow mode là manual, mọi đường production sau phải bị chặn ở main process:

- nhập/paste prompt tự động;
- click Send tự động;
- upload attachment tự động;
- chọn conversation từ sidebar;
- tự tạo/rotate chat;
- recovery tự gửi lại prompt.

Renderer flag không đủ. Guard phải tồn tại ở main process và được bật/tắt bằng IPC canonical.

### 2.3. Prompt và attachment

Manual Mode phải dùng lại cùng prompt compiler/collector với pipeline hiện tại:

- Request 1: prompt hydration + danh sách preprompt files;
- Request 2: prompt hydration + danh sách recent keyframes theo giới hạn canonical;
- NV1: control prompt + `scene_xxx_nv1_request.txt`;
- NV2: control prompt + `scene_xxx_nv2_request.txt` và keyframe hiện tại nếu contract yêu cầu.

UI phải hiển thị rõ:

- text cần copy;
- attachment nào người dùng phải thêm;
- đường dẫn/tên file;
- nút mở thư mục hoặc copy path nếu hạ tầng hiện có hỗ trợ an toàn;
- trạng thái “chưa arm / đang chờ / đã capture”.

Vidora không tự attach file trong mode này.

### 2.4. Capture

- Auto-capture chỉ chạy sau khi stage đã được arm và có immutable `attemptId`.
- Normal capture không được dùng `force:true` hoặc `skipBaselineCheck`.
- Output phải được chứng minh thuộc đúng conversation, scene, stage và attempt.
- Nếu DOM virtualization làm ownership không thể chứng minh, trả về `UNPROVEN`; không lấy “latest” một cách mù quáng.
- Có thể giữ override thủ công như đường cứu hộ, nhưng phải preview + confirm, ghi journal `manual_override` và không auto-advance.

### 2.5. VeoUp

- Chỉ chạy khi main-process disk audit xác nhận đủ N/N scene.
- Workflow chính luôn gọi coordinator với `allowPartial:false`.
- Không dựa vào button state hoặc các path string trong renderer.
- Scan partial nếu vẫn cần cho công cụ debug phải tách khỏi workflow chính và không được truy cập nhầm từ nút Manual Mode.

## 3. Yêu cầu kỹ thuật

### 3.1. Một workflow mode canonical

Thay các boolean chồng lấn bằng một enum hoặc state canonical, ví dụ:

```js
workflowMode: "manual_keyframe_motion"
```

Yêu cầu tương thích:

- project `.vdra` cũ vẫn mở được;
- migrate `manualChatGPT`/`keyframeMotionPromptOnly` sang mode mới khi load;
- không làm mất đường dẫn asset hợp lệ;
- không nhúng base64 vào project state.

Manual Mode là mode chính và mặc định trong UI. Không còn toggle khiến người dùng vô tình quay lại auto-send ChatGPT. Có thể giữ code legacy không reachable trong một commit trung gian, nhưng trước khi hoàn tất phải chứng minh không có UI/IPC production nào kích hoạt nó.

### 3.2. Main-process state machine

Tạo một orchestrator duy nhất, ưu tiên mở rộng/đổi tên `manual_chatgpt_controller.js` thay vì tiếp tục duy trì hai implementation.

State tối thiểu:

```text
PROJECT_AUDIT
HYDRATE_REQUEST_1_READY
HYDRATE_REQUEST_1_WAITING
HYDRATE_REQUEST_1_CAPTURED
HYDRATE_REQUEST_2_READY
HYDRATE_REQUEST_2_WAITING
HYDRATE_REQUEST_2_CAPTURED
SCENE_NV1_READY
SCENE_NV1_WAITING
SCENE_NV1_CAPTURED
SCENE_NV2_READY
SCENE_NV2_WAITING
SCENE_COMPLETE
PROJECT_COMPLETE
VEOUP_READY
VEOUP_RUNNING
VEOUP_COMPLETE
BLOCKED
CANCELLED
```

Renderer không tự tính transition. Renderer nhận một view model từ main process và chỉ phát command.

### 3.3. Attempt receipt

Mỗi lần arm một stage phải lưu receipt bền vững:

```json
{
  "attemptId": "uuid",
  "sceneId": 1,
  "stage": "NV1",
  "conversationId": "conversation-id",
  "promptFingerprint": "sha256",
  "baselineUserTurnId": "message-id-or-null",
  "baselineUserCount": 2,
  "baselineAssistantCount": 2,
  "baselineImageCount": 0,
  "createdAt": "ISO-8601",
  "status": "WAITING",
  "capturedAssistantTurnId": null,
  "artifactPath": null
}
```

Quy tắc:

- render/navigation không tạo attempt;
- copy lại khi attempt đang `WAITING` không reset baseline;
- stage complete không bị reset nếu user chưa chọn “Làm lại”;
- recapture tạo attempt mới và giữ lịch sử cũ;
- chỉ một attempt active cho mỗi workflow;
- mọi transition ghi journal.

### 3.4. Prompt bundle API

Tạo API main-process kiểu:

```js
buildManualStageBundle({ projectPath, sceneId, stage })
```

Trả về tối thiểu:

```js
{
  stage,
  sceneId,
  clipboardText,
  attachmentPaths,
  attachmentNames,
  contentSha256,
  payloadFingerprint,
  instructions
}
```

Dùng lại:

- `materializeSceneRequestFiles()`;
- `buildRequestControlPrompt()`;
- preprompt collector;
- recent keyframe collector;
- giới hạn hydration canonical;
- asset validators hiện có.

Không tạo prompt builder thứ ba trong renderer.

### 3.5. Disk audit là source of truth

Tạo API:

```js
auditManualProject(projectPath, expectedSceneIds)
```

Kết quả chứa từng scene:

```text
sceneId
keyframe.exists / valid / path / hash / error
motionPrompt.exists / valid / path / hash / error
stage
readyForVeoUp
```

Mọi nơi sau phải dùng cùng kết quả audit:

- scene selector/status badge;
- first incomplete scene;
- auto-advance;
- resume sau restart;
- project progress N/N;
- VeoUp gate.

### 3.6. Hợp nhất implementation

Không để hai watcher/capture engine cạnh tranh.

Xử lý các phần hiện tại:

- `manual_chatgpt_controller.js`: trở thành controller canonical hoặc được thay bằng controller canonical mới;
- `chatgpt_manual_detector.js`: merge primitive cần thiết rồi xóa/thu gọn;
- `captureManualSceneAssets()` trong `chatgpt_pipeline.js`: xóa hoặc route hoàn toàn về controller canonical;
- `pipeline:manual-step-changed`, `pipeline:manual-force-capture` và IPC duplicate: xóa hoặc migrate sang một namespace duy nhất;
- clipboard: dùng một implementation IPC duy nhất.

Không xóa primitive dùng chung của auto pipeline nếu vẫn có test/runtime dependency. Trước khi xóa phải dùng `rg` xác minh call sites.

## 4. Work packages và thứ tự bắt buộc

### WP0 — Baseline và safety

- Kiểm tra `AGENTS.md` và hướng dẫn repo.
- Ghi lại HEAD hiện tại; audit baseline là `a82fcc0`, nhưng nếu HEAD đã đổi thì re-check tất cả call sites liên quan.
- Kiểm tra worktree; giữ nguyên mọi thay đổi không thuộc task.
- Cài dependency theo lockfile.
- Chạy test baseline và ghi kết quả.
- Tạo branch `fix/manual-mode-primary-workflow`; không commit trực tiếp lên default branch.

### WP1 — Characterization tests trước khi refactor

Viết test fail trước cho:

1. UI toggle manual phải bật main-process guard.
2. Request 1/2 có stage thật và có thể resume.
3. Normal capture không gửi `force:true`.
4. Output cũ/sai scene/sai conversation bị reject.
5. Copy lần hai không reset active baseline.
6. Disk audit là nguồn readiness duy nhất.
7. N-1/N scene không thể gọi VeoUp.
8. Workflow main không bao giờ gửi `allowPartial:true`.

Không chỉ dùng test `source.includes(...)`. Ưu tiên gọi IPC handler/controller thật với filesystem temp và mocked CDP boundary.

### WP2 — Canonical mode và main guard

- Thêm/migrate `workflowMode`.
- Thêm IPC set/get mode.
- Guard toàn bộ send/click/upload/rotation/recovery boundary.
- Làm Manual Mode mặc định và duy nhất trên UI production.
- Thêm test chứng minh toggle/restore thật sự thay đổi guard main-process.

### WP3 — Controller và durable state machine

- Tạo orchestrator canonical.
- Implement idempotent prepare/arm/capture/complete/redo/cancel/resume.
- Lưu per-stage attempt receipt.
- Không reset stage complete trong render/navigation.
- Journal đầy đủ.

### WP4 — Request 1/2 và prompt bundles

- Đưa Request 1/2 ra UI thật.
- Dùng canonical collectors/compiler.
- Hiển thị attachment checklist.
- Capture/validate ready response.
- Khi conversation thay đổi, quay về hydrate Request 1 thay vì tiếp tục NV1.

### WP5 — Ownership-safe NV1/NV2 capture

- Stage-aware watcher chỉ chạy khi có active attempt.
- NV1 bind image với owned assistant turn.
- NV2 bind text với owned assistant turn và quality gate.
- Bỏ `force:true` khỏi normal buttons.
- Override cứu hộ tách riêng, có confirm/preview/journal, không auto-advance.

### WP6 — Project audit, resume và UI

- Tạo project disk audit canonical.
- Renderer chỉ render view model.
- Resume từ disk/snapshot sau restart.
- Auto-advance sau `SCENE_COMPLETE` sang scene chưa hoàn tất tiếp theo.
- Không cho navigation làm thay đổi active attempt ngoài command có chủ đích.

### WP7 — Strict VeoUp transition

- Nối `PROJECT_COMPLETE -> VEOUP_READY` tới coordinator hiện có.
- Luôn `allowPartial:false` trong workflow chính.
- Main process re-audit ngay trước submit.
- Nếu một artifact thay đổi/mất sau khi UI báo ready, block và trả lỗi scene cụ thể.

### WP8 — Cleanup và migration

- Xóa/route duplicate IPC và capture implementation.
- Bỏ hidden Request 1/2 legacy controls.
- Bỏ toggle/mode UI gây xung đột.
- Giữ migration cho project cũ.
- Cập nhật README và tài liệu manual workflow.

### WP9 — Verification

- Chạy syntax checks/lint nếu repo có.
- Chạy toàn bộ `npm test`.
- Chạy hai test độc lập trong `electron/` nếu default runner vẫn bỏ qua chúng.
- Chạy test E2E/integration mới.
- Kiểm tra `git diff --check`.
- Kiểm tra `git status` và không đưa artifact/log/dependency ngoài ý muốn vào commit.

## 5. Test acceptance bắt buộc

### 5.1. Unit/integration

- Prompt bundles Request 1/2/NV1/NV2 giữ semantic contract hiện có.
- Manual guard thực sự được bật qua renderer -> preload -> IPC -> main.
- Không automatic send/click/upload/new-chat trong manual mode.
- Normal capture reject stale output.
- Reject conversation mismatch, scene mismatch và stage mismatch.
- Copy lại không thay baseline của attempt `WAITING`.
- Stage completed không bị reset do render/navigation/restart.
- Recapture tạo attempt mới và giữ journal.
- Disk audit reject missing/corrupt keyframe và invalid motion prompt.
- Project gate reject N-1/N.
- VeoUp workflow luôn strict.

### 5.2. End-to-end/integration xuyên lớp

Ít nhất phải có các scenario:

1. Hai scene: Request 1 -> Request 2 -> NV1 -> NV2 -> scene 2 NV1 -> NV2 -> VeoUp.
2. Restart tại mỗi stage và resume không duplicate capture/send.
3. Chat có nhiều image/text cũ nhưng app vẫn chọn đúng output mới.
4. Đổi conversation trong lúc chờ khiến stage bị block và yêu cầu hydrate lại.
5. Thiếu motion prompt ở một scene khiến VeoUp không chạy.
6. Artifact bị xóa sau khi UI báo ready khiến pre-submit audit chặn VeoUp.
7. Override capture có confirm + journal và không auto-advance.

Nếu không thể chạy live ChatGPT/VeoUp trong CI, dựng contract/integration test với mocked CDP và mocked VeoUp coordinator nhưng phải chạy qua IPC/controller thật, không chỉ kiểm tra chuỗi source.

## 6. Definition of Done

Chỉ hoàn tất khi tất cả điều kiện sau đúng:

1. Manual Mode là workflow production chính và mặc định.
2. Không có reachable UI path tự gửi prompt ChatGPT.
3. Main-process guard chặn mọi automatic ChatGPT action trong manual mode.
4. Request 1/2 hoạt động và resume được trên chat mới/rỗng.
5. Mỗi scene bắt buộc NV1 hợp lệ trước NV2.
6. Output gắn đúng conversation/scene/stage/attempt.
7. Restart không làm mất hoặc lặp stage complete.
8. UI và main-process disk audit luôn đồng nhất.
9. Chỉ đủ N/N scene mới có thể gọi VeoUp.
10. Workflow chính không bao giờ chạy partial VeoUp.
11. Không còn hai manual capture engine production cạnh tranh.
12. Project cũ mở được và asset path hợp lệ được giữ nguyên.
13. Tất cả test cũ và test mới đạt.
14. README mô tả đúng flow mới.

## 7. File trọng tâm

| Khu vực | File |
|---|---|
| UI | `electron/index.html` |
| Renderer | `electron/renderer.js` |
| Bridge | `electron/preload.js` |
| Main/IPC | `electron/main.js`, `electron/main/ipc/ipc_handlers.js` |
| Manual controller | `electron/main/chatgpt/manual_chatgpt_controller.js` |
| Duplicate detector | `electron/main/chatgpt/chatgpt_manual_detector.js` |
| ChatGPT pipeline | `electron/main/chatgpt/chatgpt_pipeline.js` |
| ChatGPT send guard | `electron/main/chatgpt/chatgpt_send.js` |
| Pipeline runner | `electron/main/pipeline/pipeline_runner.js` |
| Prompt contract | `electron/main/pipeline/scene_request_files.js` |
| Asset validation | `electron/main/pipeline/asset_validation.js` |
| VeoUp manifest/coordinator | `electron/main/veoup/batch_manifest.js` và coordinator liên quan |
| Tests | `tests/manual-*.test.js`, `tests/veoup-*.test.js`, test integration mới |

Danh sách này là điểm bắt đầu, không phải quyền sửa toàn repo. Chỉ sửa file khác khi call graph/test chứng minh cần thiết.

## 8. Quy tắc thực thi và bàn giao

- Không sửa thẳng default branch.
- Không dùng destructive git commands.
- Không xóa thay đổi không liên quan của người dùng.
- Không giảm validation để làm test xanh.
- Không thay prompt semantic nếu không cần cho Manual Mode.
- Không viết lại VeoUp automation; tái sử dụng coordinator/manifest hiện có.
- Không tuyên bố hoàn tất nếu chỉ có source-string tests.
- Mỗi commit phải nhỏ, có chủ đề rõ và test tương ứng.
- Nếu phát hiện audit không còn đúng do HEAD thay đổi, cập nhật plan dựa trên code thực tế và giải thích trong PR.
- Mở PR nhưng không merge.

PR phải có:

- tóm tắt kiến trúc trước/sau;
- migration project state;
- test đã chạy và kết quả;
- screenshot hoặc mô tả UI flow mới;
- rủi ro còn lại;
- checklist Definition of Done.

## 9. Phân công model

Nếu hệ thống `$ship` hỗ trợ role model override, bắt buộc dùng:

- Planner: `gpt-6-astra`, reasoning `high`.
- Tester: `gpt-6-astra`, reasoning `high`.
- Coder: `gpt-5.6-sol`, reasoning `high`.
- Reviewer: `gpt-5.6-sol`, reasoning `high`.

Không tự hạ Planner hoặc Tester xuống model khác. Nếu runtime không hỗ trợ đúng model/effort, dừng trước khi sửa và báo chính xác giới hạn/cấu hình cần thay đổi.

## 10. Prompt `$ship` — copy nguyên khối này vào Codex

```text
$ship

Repository: https://github.com/Zazaa0606/Grok-bac-Tai

Hãy triển khai hoàn chỉnh việc đưa Vidora về một workflow chính là Manual ChatGPT Keyframe + Motion Prompt Mode.

Đọc và thực hiện toàn bộ task trong file `VIDORA_MANUAL_MODE_CODEX_TASK_AND_SHIP_PROMPT.md` tôi cung cấp. Audit tham chiếu được lập tại commit `a82fcc082bb3268fef11be83fca0c9d3428197d8`; trước khi sửa, hãy kiểm tra HEAD hiện tại và re-validate các call site nếu repo đã thay đổi.

Yêu cầu phân công:
- Planner: gpt-6-astra, reasoning high.
- Tester: gpt-6-astra, reasoning high.
- Coder: gpt-5.6-sol, reasoning high.
- Reviewer: gpt-5.6-sol, reasoning high.
- Không tự thay Planner/Tester bằng model khác. Nếu không cấu hình được, dừng và báo cách cấu hình cần thiết.

Các ràng buộc quan trọng nhất:
1. User tự attach, paste và Send trên ChatGPT; app tuyệt đối không tự gửi/click/upload trong manual mode.
2. Request 1/2 chỉ hydrate chat mới/rỗng; sau đó mỗi scene chạy NV1 -> lưu/validate keyframe -> NV2 -> lưu/validate motion prompt -> scene tiếp theo.
3. Giữ cùng conversation; không auto new-chat/rotation. Nếu user đổi sang chat mới thì yêu cầu Request 1/2 lại.
4. Chỉ một main-process state machine và một capture engine production; loại bỏ/route các implementation manual trùng lặp.
5. Mỗi stage dùng immutable attempt receipt; normal capture không được force và phải chứng minh ownership đúng conversation/scene/stage/attempt.
6. Disk audit ở main process là source of truth cho UI, resume, auto-advance và VeoUp gate.
7. Chỉ sau khi đủ N/N scene hợp lệ mới chạy VeoUp; workflow chính luôn allowPartial:false.
8. Project .vdra cũ phải mở được và giữ asset path hợp lệ.
9. Viết characterization/integration tests trước khi refactor; không chỉ dùng source.includes/string tests.
10. Không dừng ở plan. Hãy implement, chạy full test, review diff, sửa regression, cập nhật docs, commit theo nhóm logic và mở PR. Không merge PR.

Quy trình:
- Kiểm tra AGENTS.md, HEAD và dirty worktree.
- Tạo branch `fix/manual-mode-primary-workflow`.
- Chạy baseline tests.
- Thực hiện WP1 -> WP9 trong task theo đúng thứ tự dependency.
- Sau mỗi work package, chạy test liên quan.
- Cuối cùng chạy full suite, hai test electron độc lập nếu npm test không bao phủ, integration/E2E mới, git diff --check và review security/regression.

Chỉ coi là hoàn tất khi toàn bộ Definition of Done trong task đạt. Khi bàn giao, cung cấp PR link, commit list, file thay đổi, test command/result, flow trước/sau và mọi rủi ro còn lại.
```

## 11. Prompt ngắn nếu task file đã nằm trong repo/workspace

```text
$ship

Thực hiện đầy đủ `VIDORA_MANUAL_MODE_CODEX_TASK_AND_SHIP_PROMPT.md` trên repo hiện tại.

Model bắt buộc: Planner và Tester dùng gpt-6-astra high; Coder và Reviewer dùng gpt-5.6-sol high. Không được tự hạ model. Tạo branch `fix/manual-mode-primary-workflow`, implement đến khi toàn bộ Definition of Done và test đạt, mở PR nhưng không merge. Không dừng ở bước lập kế hoạch.
```

