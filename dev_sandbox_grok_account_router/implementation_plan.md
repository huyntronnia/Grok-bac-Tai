# Implementation Plan: Grok Account Router

## Phase 1: Prototype only

Inside this folder, design and test:

- account list model
- account state machine
- fake limit detector
- routing algorithm
- encrypted storage interface mock

## Phase 2: Production integration proposal

Potential future production files, only after approval:

- `electron/main.js`
  - account IPC handlers
  - encrypted secret storage adapter
  - account limit detector
  - account switch orchestration

- `electron/preload.js`
  - account management APIs

- `electron/renderer.js`
  - account management UI
  - status display
  - masked account selection

- `electron/index.html`
  - account router panel

- `electron/style.css`
  - account router UI styles

## Runtime flow

1. User adds Grok account.
2. Tool stores metadata + encrypted secret/session.
3. Pipeline uses active account.
4. If account-wide limit detected:
   - mark account cooldown/limited
   - select next available account
   - switch Grok session/profile
   - verify login
   - restore scene context
   - resume generation

## Limit detector requirement

Detector must classify:

- `canvas_limit`
- `account_limit`
- `network_error`
- `login_required`
- `unknown_error`

Only `account_limit` triggers account switch.
