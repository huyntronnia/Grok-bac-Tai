# Vidora Phase 3 Change Manifest

## Baseline

- Input: accepted Phase 2 build in the current worktree.
- Phase 2 archive: `vidora-phase2-built.zip`.

## Scope completed

### VeoUp-only pipeline

- Fixed the pipeline video provider to `veoup` internally.
- Removed Grok account-router selection, status, checkpoint and error-classification dependencies from the pipeline runner.
- Removed router/account metadata from scene results and durable video checkpoints.
- Retained cancellation, durable stages, resume validation, NV1/NV2, continuity extraction and final video validation.

### Main process

- Replaced the multi-provider video dispatcher with one VeoUp adapter.
- Removed Grok/PixVerse browser-video generation, upload, prompt submission, download and recovery engines.
- Removed Grok router state and helpers from `main.js` and runtime dependency composition.
- Reduced browser metadata, provider normalization, login checking, account normalization and upload behavior to ChatGPT only.
- Removed obsolete Grok/PixVerse DOM-script clusters from `main.js`.

### Shared modules

- Reduced ChatGPT login/upload DOM helpers to ChatGPT-only behavior.
- Removed Grok challenge recovery and Grok generation retry helpers.
- Made shared video-provider normalization resolve to VeoUp and removed `sendToGrok` from normalized continuity settings.
- Updated package description to describe ChatGPT + VeoUp behavior.

### Tests

- Updated the Phase 1 static assertion to accept the new unconditional VeoUp adapter.
- Added `tests/phase3-veoup-main-cleanup.test.js`.
- Added the Phase 3 test to `npm test`.

## Files changed in Phase 3

- `electron/main.js`
- `electron/main/pipeline/pipeline_runner.js`
- `electron/main/chatgpt/chatgpt_dom.js`
- `electron/main/chatgpt/chatgpt_recovery.js`
- `electron/main/chatgpt/chatgpt_pipeline.js`
- `electron/main/recovery/recovery.js`
- `electron/main/utils/utils.js`
- `electron/main/logging/logging.js`
- `package.json`
- `tests/partial-mode-cleanup.test.js`
- `tests/phase3-veoup-main-cleanup.test.js`

## Intentionally retained compatibility

- Legacy `.grokproj` import/export schema and file filter remain so existing Vidora projects can still be opened.
- Renderer legacy-field scrubbing remains so obsolete Grok/PixVerse fields are ignored and removed on the next save.
- These compatibility-only names do not route runtime generation to Grok or PixVerse.

## Deferred

- Decide in a later compatibility-breaking phase whether to rename/remove the `.grokproj` file format.
- Resolve the ten pre-existing direct-test failures listed in `PHASE3_VALIDATION.txt`; none were introduced by Phase 3.
