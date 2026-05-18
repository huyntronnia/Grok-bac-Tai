# Phase 2 Integration Plan: Project Session `.grokproj`

Production integration must be approved before editing Electron files. This plan maps the sandbox helpers to the app without storing secrets or auto-running loaded projects.

## `electron/main.js`

Add IPC handlers:

- `project:new-session`
  - Optionally coordinate with renderer confirmation state.
  - Do not clear secure credential stores.
- `project:save-session-file`
  - Use Electron `dialog.showSaveDialog` with `.grokproj` filter.
  - Validate/sanitize payload before writing.
  - Write formatted UTF-8 JSON only.
  - Reject or strip secret-like fields before save.
- `project:open-session-file`
  - Use Electron `dialog.showOpenDialog` with `.grokproj` filter.
  - Validate extension before reading.
  - Parse JSON safely and treat content as untrusted data.
  - Validate schema before returning a payload to renderer.
  - Return warnings for missing assets; never auto-run.

## `electron/preload.js`

Expose narrow project APIs:

- `newProjectSession()`
- `saveProjectSession(payload)`
- `openProjectSession()`

Do not expose raw filesystem access, credentials, cookies, browser storage, account secrets, or unrestricted IPC channels.

## `electron/renderer.js`

- Build save payload from current renderer state using the Phase 1 schema shape.
- Include project identity, prompts, config, scene statuses, asset paths, runtime checkpoint fields, and final preview timeline.
- Restore controls from loaded payload only after validation succeeds.
- Reconcile missing assets and display warnings without crashing.
- Restore Grok router metadata only: account id, routing policy, provider/model/account labels, and safe status labels.
- Never restore cookies, tokens, raw sessions, API keys, passwords, refresh tokens, bearer tokens, or raw browser storage.
- After Open Project, set state to waiting for user Start; do not auto-run pipeline work.
- Preserve dirty/saved state and prompt before destructive New Project resets.

## `electron/index.html`

If native menus are not enough, add explicit controls for:

- New Project
- Open Project
- Save Project
- Save As Project
- Missing asset warnings/status

## `electron/style.css`

Add minimal styles if needed for:

- save/open status
- unsaved changes indicator
- missing asset warning list
- safe restore/waiting-for-start banner

## Security gates before merge

- Run sandbox tests.
- Run Electron syntax checks for edited production JS.
- Manually verify New/Open/Save does not touch account secrets.
- Confirm loaded `.grokproj` never executes code and never auto-runs.
- Run a secret audit over changed files.
- Confirm rollback path: disable project-session controls or revert integration files.
