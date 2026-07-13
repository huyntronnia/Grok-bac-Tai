# Phase 1 Change Manifest

## Baseline

- Approved Phase 1 baseline: `D:\bac_tai\Grok-bac-Tai\electron(1).zip`.
- Baseline SHA-256: `9c6ca7a6d8c7d86dc26583174fa6f3fb012ebef3c970c7a03ac41e64ea4af983`.
- Observed git HEAD: `7e4bfc1bf231ffa826569473913de89c688d9643`.
- Git HEAD is not used as Phase 1 baseline because the worktree was already dirty and earlier Phase 1 snapshots were based on older source.
- `phase1.patch` was not created. Reason: the exact source baseline is known for `electron/` from the approved archive, but `package.json` and `tests/` were allowed to come from the dirty worktree, so a complete Phase 1-only patch across source, package metadata and tests cannot be produced reliably.

## Files Changed in Phase 1

### `docs/00_CLEANUP_OVERVIEW.md`
- Copied cleanup overview into repository docs.
- Reason: reviewer handoff needs the cleanup plan inside the project.

### `docs/01_MAIN_JS_REMOVAL_MAP.md`
- Copied main.js removal map into repository docs.
- Reason: reviewer handoff needs the Phase 1/next-phase removal map inside the project.

### `docs/02_UI_IPC_PIPELINE_REMOVAL.md`
- Copied UI, IPC and pipeline removal plan into repository docs.
- Reason: reviewer handoff needs the planned cleanup boundaries inside the project.

### `docs/03_VALIDATION_CHECKLIST.md`
- Copied validation checklist into repository docs.
- Reason: reviewer handoff needs repeatable validation steps inside the project.

### `electron/main.js`
- Restored manual ChatGPT IPC handlers from the approved baseline shape:
  - `clearChatGptCacheHandler`
  - `openFreshChatGptHandler`
- Injected both handlers into `runtimeIpcHandlers`.
- `clearChatGptCacheHandler` blocks active pipeline/send, clears temporary browser cache via CDP, and does not clear cookies, storage data or current conversation state.
- `openFreshChatGptHandler` blocks active pipeline/send and opens a fresh ChatGPT chat manually without calling `forceCleanChatGptNewChatRotation()`.
- Reason: manual IPC must remain available and must not be wired to automatic rotation.

### `electron/main/ipc/ipc_handlers.js`
- Added dependency injection entries for:
  - `clearChatGptCacheHandler`
  - `openFreshChatGptHandler`
- Added required handlers:
  - `ipcMain.handle("chatgpt:clear-cache", safeIpcHandler(clearChatGptCacheHandler))`
  - `ipcMain.handle("chatgpt:open-fresh-chat", safeIpcHandler(openFreshChatGptHandler))`
- Kept existing `router:*` IPC registrations because UI Grok/PixVerse and Phase 2 removal are out of scope for this batch.
- Reason: preload invokes must have matching main handlers, while legacy router removal is not part of this Phase 1 correction.

### `electron/main/pipeline/pipeline_runner.js`
- Kept `CHAT_ROTATION_ENABLED = false`.
- Gated the consecutive-failure ChatGPT rotation branch behind `CHAT_ROTATION_ENABLED &&`.
- Existing scene-count and safe-exit rotation paths remain disabled by the same flag.
- Reason: no automatic ChatGPT rotation is allowed; only manual open-new-chat behavior may rotate chat.

### `electron/main/chatgpt/chatgpt_recovery.js`
- Recovery Level 8 no longer calls `forceCleanChatGptNewChatRotation()`.
- Recovery Level 8 now logs that automatic chat rotation is disabled and returns wait.
- Reason: recovery must not trigger automatic ChatGPT new-chat rotation.

### `electron/renderer.js`
- Removed `sendToGrok` from continuity reference settings.
- Added `normalizeLegacyVideoProvider()` to normalize legacy video provider values to `veoup`.
- Added recursive `scrubLegacyProjectFields()` that removes legacy Grok/PixVerse/router fields from nested objects while preserving arrays as arrays.
- New save payloads write `videoProvider: "veoup"` and `selectedModels.video: "veoup"`.
- New save payloads no longer persist `router`, `grokRouter`, `grokRecovery`, `pixverse`, `sendToGrok`, `videoPlatform`, `selectedGrokAccountId`, `routingPolicy` or `accountRouterEnabled`.
- Load compatibility still reads old legacy values where needed so old projects can open.
- Reason: new sessions must not persist legacy Grok/PixVerse/router data, while Phase 1 must preserve compatibility and avoid Phase 2 UI deletion.

### `package.json`
- Added Phase 1 guard tests to `npm test`.
- Reason: `npm test` must cover manual IPC parity, no-auto-rotation and legacy payload scrubbing.

### `tests/chatgpt-stage-isolation.test.js`
- Updated assertions so request sequencing still requires waiting for ChatGPT response.
- Added checks that automatic rotation paths are disabled/gated rather than requiring branch deletion.
- Reason: request isolation remains required; rotation policy changed to disabled-by-flag.

### `tests/ipc-parity-manual-chatgpt.test.js`
- Added parity check for preload `ipcRenderer.invoke(...)` channels against `ipcMain.handle(...)`.
- Added explicit manual ChatGPT IPC assertions for `chatgpt:clear-cache` and `chatgpt:open-fresh-chat`.
- Added behavior guards ensuring manual handlers block active send/pipeline, clear only browser cache, and do not call auto-rotation helper.
- Reason: required manual IPC must stay wired and safe.

### `tests/no-auto-chatgpt-rotation.test.js`
- Added static assertions that `CHAT_ROTATION_ENABLED` is false.
- Added checks that consecutive-failure rotation is gated and Recovery Level 8 does not call `forceCleanChatGptNewChatRotation()`.
- Reason: regression coverage for no automatic ChatGPT rotation.

### `tests/renderer-legacy-project-migration.test.js`
- Added/updated assertions for legacy provider normalization to `veoup`.
- Added recursive scrub coverage for nested objects and arrays.
- Added assertions that new saved payloads do not write legacy Grok/PixVerse/router fields.
- Reason: regression coverage for new-session legacy data scrubbing.

## Phase 1 Completed Items

- Approved archive baseline was used for `electron/`.
- Manual IPC `chatgpt:clear-cache` and `chatgpt:open-fresh-chat` restored and wired through main dependency injection and `ipcMain.handle`.
- Manual clear-cache keeps cookies/login/current conversation and only clears temporary browser cache.
- Manual open-fresh-chat does not call auto-rotation.
- Automatic ChatGPT rotation remains disabled by `CHAT_ROTATION_ENABLED = false`.
- Consecutive-failure rotation branch is gated by `CHAT_ROTATION_ENABLED &&`.
- Recovery Level 8 does not call `forceCleanChatGptNewChatRotation()`.
- New saved session/project payloads do not persist legacy Grok/PixVerse/router data.
- Recursive legacy scrub preserves arrays.
- IPC parity and no-auto-rotation tests added.
- UI Grok/PixVerse was not removed.
- Phase 2 cleanup was not performed.

## Legacy Grok/PixVerse Remaining

- Grok/PixVerse UI bindings remain in `electron/renderer.js`, `electron/index.html` and `electron/style.css`.
- `router:*` IPC remains in preload and `ipc_handlers.js`.
- Grok router state and functions remain in `electron/main.js`.
- Grok router pipeline support references remain in `electron/main/pipeline/pipeline_runner.js`.
- These remain because the user explicitly required: do not remove UI Grok/PixVerse and do not perform Phase 2 in this batch.

## Existing Dirty Worktree / Pre-Existing Changes Not Fixed

- The repository already had many deleted/modified/untracked files outside the approved baseline flow, including docs, scratch scripts, Chrome/user data folders, old patch files and previous handoff artifacts.
- These were not reverted or cleaned because they are outside the Phase 1 correction request.
- Full raw `git status --short` output is recorded in `PHASE1_VALIDATION.txt`.

## Validation Summary

- `git status --short`: captured in `PHASE1_VALIDATION.txt`.
- JavaScript syntax check: exit `0`.
- `npm test`: exit `0`.
- Direct `tests/*.test.js`: 16 pass, 9 fail.
- Direct test failures are classified in `PHASE1_VALIDATION.txt` as source assertion / baseline-test mismatch, not dependency/environment failures.
- IPC parity/manual ChatGPT IPC check: exit `0`.
- `rg -n -i "grok|pixverse"` on JS/HTML/CSS/JSON: exit `0`; remaining references are listed in validation output.
- `rg -n "router:|grokRouter|GrokRouter"` on JavaScript: exit `0`; remaining references are listed in validation output.
