# Vidora Phase 1 Change Manifest

## Baseline

- Source archive: `electron(1).zip`
- SHA-256: `9c6ca7a6d8c7d86dc26583174fa6f3fb012ebef3c970c7a03ac41e64ea4af983`
- The `electron/` directory was recreated from this archive before applying Phase 1.

## Phase 1 scope

Phase 1 implements compatibility and renderer schema cleanup. Grok/PixVerse UI, router IPC and main automation are intentionally retained for Phase 2/3.

## Changed runtime files

- `electron/renderer.js`: legacy providers load as VeoUp; project and localStorage saves recursively scrub legacy fields.
- `electron/main.js`: safe manual cache/new-chat handlers; automatic rotation helper hard-disabled.
- `electron/main/ipc/ipc_handlers.js`: registered both manual ChatGPT handlers with `safeIpcHandler`.
- `electron/main/pipeline/pipeline_runner.js`: failure rotation gated by `CHAT_ROTATION_ENABLED = false`.
- `electron/main/chatgpt/chatgpt_recovery.js`: Level 8 waits for manual recovery; rotation helper hard-disabled.
- `electron/chatgptStability.js`: interval zero, attempt 7 waits, rotation policy always false.
- `electron/index.html`: removed automatic new-chat interval control.
- `electron/chatgptAutomation.test.js`: updated no-rotation expectations.

## Tests

- `tests/renderer-legacy-project-migration.test.js`
- `tests/ipc-parity-manual-chatgpt.test.js`
- `tests/no-auto-chatgpt-rotation.test.js`
- `tests/phase1-policy-complete.test.js`

## Deferred

- Grok/PixVerse UI and renderer functions: Phase 2.
- Six `router:*` IPC routes: Phase 2.
- Grok router and web-video automation removal from pipeline/main.js: Phase 3.
- Final token/module cleanup: Phase 4.

