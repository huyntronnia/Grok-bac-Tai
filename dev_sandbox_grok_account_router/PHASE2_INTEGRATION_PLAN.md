# Phase 2 Integration Plan

This is an integration-readiness plan only. Do not modify production Electron files until Phase 2 is explicitly approved.

## A. Production files expected to change later
- `electron/main.js`
- `electron/preload.js`
- `electron/renderer.js`
- `electron/index.html`
- `electron/style.css`

## B. Purpose of each file change
- `electron/main.js`: own router state, safe account metadata persistence, secure credential-reference lookup, checkpoint persistence, generation-pipeline routing decisions, and IPC handlers.
- `electron/preload.js`: expose a narrow safe API to the renderer and return only masked account data, router status, and non-secret checkpoint status.
- `electron/renderer.js`: render router controls, call preload APIs, show pause/resume/error state, and preserve the current single-account flow when routing is disabled.
- `electron/index.html`: add UI mount points for account list, active account, routing policy, account state, pause/resume state, and error messages.
- `electron/style.css`: style router panels and status chips using the existing app visual language without exposing secret values.

## C. Proposed feature flag
- Add `accountRouterEnabled` with default `false` for a safe fallback.
- When `accountRouterEnabled` is `false`, keep the old single-account pipeline and current Grok generation behavior unchanged.
- When enabled, use router-selected account/profile/session references at scene boundaries and classified-error boundaries.
- Store the flag in existing app settings if available; otherwise store it with safe local app config, not inside checkpoint payloads.

## D. UI requirements
- Show a masked account list with display name, masked email, state, priority, and enabled/disabled status.
- Show the selected active account and routing policy display.
- Show account state display for `available`, `active`, `cooldown`, `limited`, `login_required`, `invalid`, and `disabled_by_user`.
- Show pause/resume state and the latest safe checkpoint status.
- Show error state display using classifications only: `account_limit`, `canvas_limit`, `network_error`, `login_required`, `unknown_error`.
- Never show plaintext credentials, cookies, tokens, session values, raw browser storage, or full private emails.

## E. IPC/preload API proposal
- `getGrokRouterStatus()`: returns feature flag, active account safe summary, routing policy, pause state, and latest error classification.
- `listGrokAccountsSafe()`: returns masked account metadata only.
- `selectGrokAccount(accountId)`: selects a known account by safe id and returns the new safe router status.
- `setAccountRouterEnabled(enabled)`: toggles the feature flag and returns safe router status.
- `resumeFromRouterCheckpoint()`: validates the checkpoint account is usable and returns resume/pause action metadata.
- `openGrokRouterFolder()`: opens this sandbox/design folder or future router management folder.

## F. Generation pipeline integration
- Write a safe checkpoint before generation starts for each scene.
- Use only selected `accountId`, `profileRef`, `canvasRef`, and `encryptedSecretRef` references in the generation pipeline.
- Classify generation errors once at the boundary where the error is caught.
- Switch accounts only on `account_limit`.
- Recover from `canvas_limit` by switching or creating a canvas on the same account.
- Pause safely on `login_required`, `network_error`, and `unknown_error`.
- Preserve checkpoint data if all accounts are unavailable after an `account_limit`.

## G. Checkpoint persistence
- Safe fields: `schemaVersion`, `checkpointId`, `project.id`, `project.name`, `scene.id`, `scene.index`, `imageRef`, `motionPrompt` or safe prompt ref, `provider`, `accountId`, `canvasRef`, `sessionProfileRef`, `status`, `lastErrorClassification`, `createdAt`, `updatedAt`.
- Store checkpoints in the existing project/session checkpoint location if one exists; otherwise use an app-data router checkpoint file outside source-controlled project files.
- Never store passwords, cookies, session tokens, refresh tokens, bearer tokens, API keys, raw localStorage/sessionStorage, raw browser profile data, or full private emails.
- Resume should load the latest safe checkpoint, verify the account is still selectable, resume the scene if usable, and pause for user action if unusable.

## H. Credential storage
- Do not store plaintext credentials anywhere in project files.
- Do not store cookies or session tokens in project files, checkpoints, renderer state, or logs.
- Production should use OS-protected credential storage, Electron `safeStorage`, or approved `keytar`.
- Project files and logs should store only safe references such as `encryptedSecretRef`, `accountId`, `profileRef`, and `canvasRef`.

## I. Rollback plan
- Disable `accountRouterEnabled` to restore old single-account behavior.
- Keep old single-account pipeline callable and unchanged until router smoke tests pass.
- Preserve existing project files and checkpoint files; do not rewrite unrelated project data during rollback.
- Avoid data loss by versioning checkpoints and ignoring unsupported router checkpoint versions rather than deleting them.

## J. Test plan
- Run sandbox test: `cd Grok-bac-Tai/dev_sandbox_grok_account_router; node tests/accountRouter.test.mjs`.
- Run Electron smoke launch after approval: `cd Grok-bac-Tai; npm start`.
- Verify old pipeline fallback with `accountRouterEnabled=false`.
- Verify router-enabled behavior with safe fake/mocked accounts before real account testing.
- Verify `account_limit` switches account and preserves checkpoint.
- Verify `canvas_limit` stays on the same account and changes canvas only.
- Verify unavailable accounts pause safely and preserve checkpoint.
- Run a no-secret audit over router files, checkpoints, logs, and fixtures.