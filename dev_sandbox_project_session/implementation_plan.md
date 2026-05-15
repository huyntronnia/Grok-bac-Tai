# Implementation Plan: Open / New / Save Project

## Boundary
This is a planning/prototype area only. Do not modify production files from this folder without owner approval.

## Current production context
Production currently has:
- menu placeholders for New/Open Project
- localStorage session restore for next launch
- pipeline state in renderer memory
- Grok Account Router UI metadata separate from account secrets

This sandbox defines the full `.grokproj` file workflow.

## Feature goals

1. New Project
   - Ask user to save unsaved changes first.
   - Reset current in-memory state.
   - Clear active batch, preview, and pipeline logs if confirmed.
   - Preserve app settings only if explicitly classified as global settings.

2. Save Project
   - Save current full state into a `.grokproj` JSON file.
   - Include project, prompts, configs, scene statuses, asset paths, final preview timeline.
   - Include selected provider/model/account labels as non-secret metadata.
   - Include selected Grok router account id/policy as non-secret metadata.
   - Do not include API keys, cookies, passwords, or session tokens by default.

3. Open Project
   - Pick a `.grokproj` file.
   - Validate schema and migrate if needed.
   - Restore all UI controls and pipeline state.
   - Reconcile missing asset paths and show warnings.
   - Never auto-run immediately after open; wait for user Start.

## Suggested production integration later
Potential files to edit after approval:

- `electron/main.js`
  - Add IPC handlers:
    - `project:new-session`
    - `project:save-session-file`
    - `project:open-session-file`
  - Use Electron dialogs for `.grokproj`.
  - Validate path extension and JSON before returning payload.

- `electron/preload.js`
  - Expose APIs:
    - `newProjectSession()`
    - `saveProjectSession(payload)`
    - `openProjectSession()`

- `electron/renderer.js`
  - Build export payload from current state.
  - Restore controls from loaded payload.
  - Reconcile missing assets using existing asset existence checks.
  - Restore Grok router metadata only, never secrets.

- `electron/index.html`
  - Add UI buttons if not using native menu only.

- `electron/style.css`
  - Add save/open status and warning styles if needed.

## Validation checklist
- `.grokproj` must be valid JSON.
- `schemaVersion` must exist.
- `project.scenes` must be array.
- `runtime` must exist.
- Unknown fields should be preserved if possible.
- Missing local image/video files should not crash load.
- Loaded project must not execute code.

## Migration/versioning
- `schemaVersion: 1` is the initial format.
- Future versions must use migration functions.
- Unknown future major versions should be rejected with a clear message.
- Unknown extra fields in compatible versions should be preserved in `extensions` or ignored safely.

## Security
- Do not save API key unless user explicitly enables it.
- Do not save Grok cookies/session tokens in `.grokproj`.
- Treat loaded file content as untrusted.
- Do not execute code from project files.
- Account router secrets belong in secure account storage, not project files.

## Test plan
See `TESTING.md` for repeatable steps.
Minimum required tests:
1. Validate `tests/sample.grokproj` JSON shape.
2. Confirm sample contains no secrets.
3. Confirm schema documents runtime restore fields.
4. Confirm implementation plan explains New/Open/Save.
5. Run production smoke test with `npm start`.

## Done evidence
Before handoff, fill `DONE_CHECKLIST.md` with:
- date/time
- files changed
- tests run
- pass/fail result
- remaining risks
- confirmation that no real secrets are included
