# Phase 2 Handoff: Grok Account Router

## What was implemented
- Feature flag `accountRouterEnabled=false` by default.
- Safe Grok Account Router UI in the Electron app.
- Safe IPC/preload APIs for sanitized router status, account selection, checkpoint resume, and sandbox folder opening.
- Safe checkpoint/pause behavior for router-controlled Grok video flow.
- Masked account metadata only; no raw credentials are exposed by router UI/API paths.
- Single-account Grok fallback is preserved when the router is off.

## What was NOT implemented
- Real credential storage.
- Real Grok multi-profile/CDP switching.
- Automatic account switching to bypass provider quota.
- Full production credential manager.
- Full manual UI interaction could not be completed from command output; Electron launched and code paths were verified, but UI clicking/visual inspection was not observable through this CLI environment.

## How to test
Run syntax checks:

```powershell
node --check Grok-bac-Tai/electron/main.js
node --check Grok-bac-Tai/electron/preload.js
node --check Grok-bac-Tai/electron/renderer.js
```

Run sandbox account-router tests:

```powershell
cd Grok-bac-Tai/dev_sandbox_grok_account_router
node tests/accountRouter.test.mjs
```

Launch the Electron app:

```powershell
cd Grok-bac-Tai
npm start
```

Manual UI smoke checklist:
- [ ] App launches successfully.
- [ ] Grok Account Router UI card appears.
- [ ] Router toggle defaults OFF.
- [ ] Single-account Grok fallback remains available when router is OFF.
- [ ] Masked account list displays only safe metadata.
- [ ] No full emails, cookies, passwords, tokens, API keys, raw browser storage, or raw session values appear in UI.
- [ ] Selecting an account updates active account safely.
- [ ] Resume checkpoint button does not expose secrets.
- [ ] `Mo folder router` button opens `Grok-bac-Tai/dev_sandbox_grok_account_router/`.
- [ ] Turning router OFF returns to safe single-account fallback behavior.

## Security notes
- Router work must not write secrets to project files, checkpoints, logs, or UI.
- No raw cookies, tokens, session data, browser storage, or full private emails should be shown or persisted.
- Account metadata is masked/sanitized before reaching renderer/UI surfaces.
- Future credential storage must use OS-protected storage, Electron `safeStorage`, or approved `keytar` integration.

## Runtime behavior
- `canvas_limit`: stay on the same account and pause for canvas recovery.
- `account_limit`: pause, preserve checkpoint, and require explicit authorized account selection or quota resolution.
- `login_required`: pause and require reconnect/login.
- `network_error`: pause/retry safely without silent account switching.
- `unknown_error`: pause and preserve checkpoint for safe review/resume.

## Rollback instructions
- Immediate rollback: turn the router toggle OFF so `accountRouterEnabled=false` and single-account Grok fallback is active.
- Code rollback: revert approved Electron files and related sandbox docs/tests.
