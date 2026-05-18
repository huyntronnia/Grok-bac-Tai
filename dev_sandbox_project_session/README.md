# Project Session Sandbox

This sandbox prototypes the `.grokproj` New/Open/Save Project workflow only inside `dev_sandbox_project_session/`. Production Electron files are intentionally out of scope until Phase 2 approval.

## Implemented in Phase 1

- Schema documentation for `.grokproj` version 1 in `grokproj_schema.md`.
- A safe sample project file in `tests/sample.grokproj`.
- Pure JavaScript helpers in `prototype/projectSession.js` for creating, saving, validating, migrating, sanitizing, opening, reconciling, and restoring project state.
- Node tests in `tests/projectSession.test.mjs`.

## Security boundary

`.grokproj` files are untrusted JSON data. Loading must never execute code and must never auto-run a project. A loaded project is restored into `waiting-for-user-start` state.

Allowed router data is metadata only:

- `accountRouterEnabled`
- `selectedGrokAccountId`
- `routingPolicy`
- provider/model/account labels after redaction
- safe status/checkpoint labels

The prototype rejects or strips API keys, cookies, passwords, session tokens, refresh tokens, bearer tokens, raw browser storage, and full private emails.

## Run tests

```powershell
cd Grok-bac-Tai/dev_sandbox_project_session
node tests/projectSession.test.mjs
```

or:

```powershell
npm test
```

## Phase 2 boundary

Future production integration should happen only after explicit approval and should touch `electron/main.js`, `electron/preload.js`, `electron/renderer.js`, and optional UI/style files as described in `PHASE2_INTEGRATION_PLAN.md`.
