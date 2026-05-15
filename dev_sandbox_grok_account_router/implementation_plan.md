# Implementation Plan: Grok Account Router

## Current status
Production now contains a small UI/link bridge:
- A **Grok Account Router** card is shown under the 9Router/API key field.
- The selected Grok account and routing policy are sent as pipeline metadata.
- A button opens this folder from the app.

This sandbox still owns the real design for multi-account session switching. Do not assume full router behavior exists in production yet.

## Phase 1: Prototype only
Inside this folder, design and test:
- account list model
- account state machine
- fake limit detector
- routing algorithm
- encrypted storage interface mock
- switch/resume checkpoint format
- no-secret test fixtures

## Phase 2: Production integration proposal
Potential future production files, only after approval:

- `electron/main.js`
  - account IPC handlers
  - encrypted secret storage adapter
  - account limit detector
  - account switch orchestration
  - per-account Chrome/CDP profile/session selection
  - checkpoint save/restore around scene generation

- `electron/preload.js`
  - account management APIs
  - router state APIs

- `electron/renderer.js`
  - account management UI
  - status display
  - masked account selection
  - policy selection
  - limit/cooldown feedback

- `electron/index.html`
  - account router panel already exists as a starter
  - later add add/edit/remove account controls if approved

- `electron/style.css`
  - account router UI styles already exist as a starter
  - later add table/status/cooldown styles if approved

## Runtime flow
1. User chooses active Grok account in UI.
2. Pipeline starts scene generation.
3. Router records checkpoint:
   - project name
   - scene id
   - image path/keyframe
   - motion prompt
   - selected video provider
   - active account id
4. Tool checks Grok session/profile for active account.
5. Generation runs.
6. If error/limit appears, detector classifies it.
7. If `canvas_limit`:
   - keep same account
   - create/switch canvas
   - restore context assets
8. If `account_limit`:
   - mark account `limited` or `cooldown`
   - choose next available account by policy
   - switch Grok session/profile
   - verify login
   - restore scene context
   - upload keyframe again
   - resend motion prompt
9. If no account is available:
   - pause pipeline
   - show login/quota message
   - keep checkpoint for resume

## Limit detector requirement
Detector must classify:
- `canvas_limit`
- `account_limit`
- `network_error`
- `login_required`
- `unknown_error`

Only `account_limit` triggers account switch.

## Test plan
See `TESTING.md` for repeatable steps.
Minimum required tests:
1. Validate sample account router JSON.
2. Simulate routing from account 1 to account 2 on `account_limit`.
3. Simulate no account switch on `canvas_limit`.
4. Confirm no test fixture contains plaintext secrets.
5. Run production smoke test: `npm start`, click **Mở folder router**, verify this folder opens.

## Done evidence
Before handoff, fill `DONE_CHECKLIST.md` with:
- date/time
- files changed
- tests run
- pass/fail result
- remaining risks
- confirmation that no real secrets are included
