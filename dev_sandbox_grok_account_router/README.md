# Dev sandbox: Grok Account Router

External-dev task folder for designing/prototyping Grok multi-account routing.

## What this folder owns
This folder owns the design for **Grok accounts used by the main video/motion batch pipeline**.
It does not own 9Router, OpenAI, Gemini, Anthropic, or prompt API accounts.

The production app currently links to this folder from the **Grok Account Router** card under the API key field. That link is only a bridge; the full router still needs to be designed here first.

## Read first
1. `CODE_RULES.md`
2. `implementation_plan.md`
3. `account_router_design.md`
4. `account_security_model.md`
5. `TESTING.md`
6. `DONE_CHECKLIST.md`

## Review flow
A reviewer should be able to answer:
- What is an account-wide Grok limit?
- How is it different from a canvas-local limit?
- Which account state should be assigned after each error?
- Which account is selected next?
- How are secrets protected?
- How does the pipeline resume after switching account?

## Quick smoke test
From repo root:
```powershell
npm start
```
Then:
1. Find **Grok Account Router** under API key.
2. Click **MÃ¡Â»Å¸ folder router**.
3. Confirm this folder opens.
4. Change Active Grok account and Routing policy.
5. Confirm the app does not crash.

## Done signal
The task is ready for review when `DONE_CHECKLIST.md` is filled and all required tests in `TESTING.md` pass.

## Phase 1 prototype
Implemented in this sandbox only. It does not touch production Electron files and does not use real Grok credentials.

### Files
- `prototype/accountRouter.js` contains the account model, state machine helpers, round-robin routing, fake error classifier, checkpoint helpers, resume helper, and mock encrypted storage.
- `tests/sample_account_router.json` contains no-secret account metadata fixtures.
- `tests/accountRouter.test.mjs` contains lightweight Node tests for the prototype behavior.

### Run prototype tests
From this sandbox folder:
```powershell
node tests/accountRouter.test.mjs
```

Or from repo root:
```powershell
node dev_sandbox_grok_account_router/tests/accountRouter.test.mjs
```

### Verified behaviors
- `account_limit` marks the active account `limited` and switches to the next selectable account.
- `canvas_limit` keeps the same account and returns a simulated canvas switch action.
- `login_required` marks the current account `login_required` and pauses.
- No available accounts pauses and preserves checkpoint metadata.
- `disabled_by_user`, `limited`, `login_required`, and `invalid` accounts are skipped by routing.
- Invalid state transitions are safely ignored with non-secret account labels.
- Checkpoints reject secret-like plaintext and full private emails.
- Account metadata rejects raw credential fields and full private emails.
- The mock encrypted storage rejects secret-like plaintext and is only sandbox obfuscation.

### Security notes
- This prototype uses masked/no-secret account records only.
- Mock encrypted storage is base64 obfuscation for interface testing; it is not production security.
- Production must use OS-protected credential storage, Electron `safeStorage`, or approved `keytar`.
- Production Electron files were not modified for this Phase 1 sandbox prototype.

### Still Phase 2 / production integration
- Real Electron IPC handlers and UI management controls.
- OS-protected credential storage using Windows Credential Manager/DPAPI, macOS Keychain, Linux Secret Service, Electron `safeStorage`, or approved `keytar`.
- Real Grok session/profile switching and Chrome/CDP orchestration.
- Real checkpoint persistence around production scene generation.
