# Implementation Plan: Open / New / Save Project

## Boundary
This is a planning/prototype area only. Do not modify production files from this folder.

## Feature goals

1. New Project
   - Reset current in-memory state.
   - Ask user to save unsaved changes first.
   - Clear active batch, preview, and pipeline logs if confirmed.

2. Save Project
   - Save current full state into a `.grokproj` JSON file.
   - Include project, prompts, configs, scene statuses, asset paths, final preview timeline.
   - Do not include API keys by default.

3. Open Project
   - Pick a `.grokproj` file.
   - Validate schema and migrate if needed.
   - Restore all UI controls and pipeline state.
   - Reconcile missing asset paths and show warnings.

## Suggested production integration later

Potential files to edit after approval:

- `electron/main.js`
  - Add IPC handlers:
    - `project:new-session`
    - `project:save-session-file`
    - `project:open-session-file`
  - Use Electron dialogs for `.grokproj`.

- `electron/preload.js`
  - Expose APIs:
    - `newProjectSession()`
    - `saveProjectSession(payload)`
    - `openProjectSession()`

- `electron/renderer.js`
  - Add menu/buttons for New/Open/Save.
  - Build export payload from current state.
  - Restore controls from loaded payload.

- `electron/index.html`
  - Add UI buttons if not using native menu only.

## Validation checklist

- `.grokproj` must be valid JSON.
- `schemaVersion` must exist.
- `project.scenes` must be array.
- Unknown fields should be preserved if possible.
- Missing local image/video files should not crash load.

## Security

- Do not save API key unless user explicitly enables it.
- Treat loaded file content as untrusted.
- Do not execute code from project files.
