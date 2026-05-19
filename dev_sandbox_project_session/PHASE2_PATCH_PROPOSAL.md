# Phase 2 Patch Proposal: Production `.grokproj` Integration

## Boundary

This is a readiness proposal only. Do not edit production Electron files until explicit Phase 2 approval is granted.

Production files are read-only for this pass.

## Production files expected to change later

- `electron/main.js`
- `electron/preload.js`
- `electron/renderer.js`
- `electron/index.html`
- `electron/style.css`

## Main-process IPC plan

Add safe IPC handlers in `electron/main.js`:

- `project:new-session`
  - Coordinate with renderer-owned unsaved-change confirmation.
  - Return a narrow result only; renderer owns in-memory reset.
  - Do not clear secure credential stores.
- `project:save-session-file`
  - Use Electron `dialog.showSaveDialog` with a `.grokproj` filter.
  - Validate and force the `.grokproj` extension.
  - Validate schema and sanitize payload before writing.
  - Reject unsupported future schema versions.
  - Write formatted UTF-8 JSON only.
- `project:open-session-file`
  - Use Electron `dialog.showOpenDialog` with a `.grokproj` filter.
  - Validate the `.grokproj` extension before reading.
  - Parse JSON safely.
  - Validate schema before returning payload.
  - Reject unsupported future schema versions.
  - Treat loaded file content as untrusted data.
  - Never execute code from project files.

Main process must never save or return API keys, cookies, passwords, session tokens, refresh tokens, bearer tokens, raw browser storage, or full private emails.

## Preload API plan

Expose narrow safe APIs in `electron/preload.js`:

- `newProjectSession()`
- `saveProjectSession(payload)`
- `openProjectSession()`

Preload requirements:

- Expose only narrow project-session APIs.
- Do not expose raw filesystem internals.
- Do not expose unrestricted IPC channels.
- Do not expose secrets, cookies, browser storage, account secrets, or credential stores.

## Renderer integration plan

Add production equivalents of the sandbox helpers in `electron/renderer.js`:

- Build save payload from current renderer state.
- Include project identity, prompts, configs, scene statuses, asset paths, final preview timeline, and safe runtime state.
- Include selected provider/model/account labels as non-secret metadata.
- Include selected Grok router account id and routing policy as non-secret metadata only.
- Restore UI controls from loaded payload after validation succeeds.
- Restore current batch, current scene, and paused state.
- Force opened projects into waiting-for-user-start state.
- Reconcile missing image/video/final output paths and show warnings.
- Track dirty/saved state for prompt edits, project form changes, scene status changes, router metadata changes, and output folder changes.
- Ask user to Save, Discard, or Cancel before destructive New/Open actions when dirty.
- Never auto-run after Open Project; wait for explicit Start.

## UI plan

Add or wire controls in `electron/index.html` as approved:

- New Project control.
- Open Project control.
- Save Project control.
- Save/open status area.
- Missing asset warning area.

Add compact styles in `electron/style.css` as needed for:

- Save/open status.
- Unsaved-changes indicator.
- Missing asset warning list.
- Waiting-for-user-start banner.

## Security plan

- No API keys in `.grokproj`.
- No cookies in `.grokproj`.
- No passwords in `.grokproj`.
- No session tokens in `.grokproj`.
- No refresh tokens in `.grokproj`.
- No bearer tokens in `.grokproj`.
- No raw browser storage in `.grokproj`.
- No full private emails in `.grokproj`.
- Account router secrets remain in secure account storage, not `.grokproj`.
- Loaded project content is untrusted JSON data.
- Loaded project content must never execute code.
- Loaded project must never auto-run.

## Test plan after approval

1. Run syntax checks for edited Electron files.
2. Run sandbox project session tests: `cd Grok-bac-Tai/dev_sandbox_project_session; npm test`.
3. Run production smoke test: `cd Grok-bac-Tai; npm start`.
4. Confirm New Project asks about unsaved changes.
5. Confirm Save Project creates a valid `.grokproj` file.
6. Confirm Open Project restores UI controls and runtime state.
7. Confirm missing assets show warnings and do not crash the app.
8. Confirm Open Project does not auto-run and waits for Start.
9. Confirm Grok router metadata restores as non-secret metadata only.
10. Run a secret audit on saved `.grokproj` output.

## Rollback plan

- Remove or disable Project Session UI controls.
- Remove Project Session IPC handlers.
- Keep the existing localStorage restore fallback in place.
- Ensure existing projects/session data are not corrupted.
- Revert only Phase 2 integration files if production behavior regresses.
