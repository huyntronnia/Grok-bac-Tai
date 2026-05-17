# Phase 2 Approval Checklist

Phase 2 must not start until these approvals are explicitly confirmed.

- [x] Production files approved for edit: `electron/main.js`, `electron/preload.js`, `electron/renderer.js`, `electron/index.html`, `electron/style.css`.
- [x] UI changes approved for masked account list, active account, routing policy, account state, pause/resume state, and error state display.
- [x] IPC/preload contract approved: `getGrokRouterStatus()`, `listGrokAccountsSafe()`, `selectGrokAccount(accountId)`, `setAccountRouterEnabled(enabled)`, `resumeFromRouterCheckpoint()`, `openGrokRouterFolder()`.
- [x] Checkpoint behavior approved, including safe fields, write timing, storage location, and resume rules.
- [x] Credential storage approach approved: OS-protected storage, Electron `safeStorage`, or approved `keytar`.
- [x] Error classification behavior approved: pause on `account_limit` unless the user explicitly selects another authorized account; same-account canvas recovery on `canvas_limit`; pause on login/network/unknown.
- [x] Fallback behavior approved with `accountRouterEnabled=false` preserving the old single-account pipeline.
- [x] Rollback plan approved, including feature flag disablement and preservation of existing project files.
- [x] Test plan approved, including sandbox tests, Electron smoke launch, fallback verification, router behavior tests, and no-secret audit.

## Compliance constraints
- Account routing is limited to user-authorized accounts/profiles in this local tool.
- Do not store real credentials or bypass provider security.
- Do not expose cookies, passwords, tokens, raw sessions, or browser storage.
- If `account_limit` represents a provider quota/plan limit that should not be bypassed, pause and ask the user to choose an authorized account or resolve quota; do not silently evade service limits.
## Final closeout approval evidence
- [x] Final files changed reviewed: approved Electron files plus `dev_sandbox_grok_account_router/` sandbox docs/tests/prototype files only.
- [x] Tests passed: Electron JS syntax checks and sandbox account router tests.
- [x] Smoke launch result recorded: `npm start` launched Electron and remained running; manual UI interaction was not fully observable from command output.
- [x] Secret audit completed with expected false positives only; no real credentials, cookies, sessions, refresh tokens, bearer tokens, API keys, raw browser storage, or full private emails added by the router work.
- [x] Single-account fallback verified: router defaults off and is opt-in.
- [x] Router behavior verified: safe pause/checkpoint behavior for account, login, network, unknown, and canvas-limit cases; no silent quota evasion.
- [x] Checkpoint safety verified: safe references/status/timestamps only.
- [x] Masking fix verified for Grok video errors/status return path.
- [x] Rollback path verified: disable router flag or revert approved files.
