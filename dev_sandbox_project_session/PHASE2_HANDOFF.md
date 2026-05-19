# Phase 2 Handoff: Project Session .grokproj

## A. Implemented

- New Project flow with Save / Discard / Cancel handling for dirty project state.
- Save Project flow for `.grokproj` schema v1 JSON.
- Open Project flow for `.grokproj` schema v1 JSON.
- Safe main-process IPC handlers: `project:new-session`, `project:save-session-file`, and `project:open-session-file`.
- Safe preload APIs: `newProjectSession`, `saveProjectSession`, and `openProjectSession`.
- Renderer save/restore logic for project, prompts, config, scenes, assets, runtime state, and final preview timeline.
- Runtime resume state now includes `currentStage`, `currentBatchIndex`, `currentSceneId`, `activeBatchIds`, `lastCheckpointRef`, `lastAction`, and `resumeMode`.
- Mid-batch restore regression fixed for projects saved while the current scene is still generating a keyframe/image.
- Resume routing now checks keyframe/image, motion prompt, and video readiness in order before video-only routing.
- Missing asset reconciliation with user-visible warnings instead of crashes.
- Portability fix: missing linked image/video/final preview files are marked as missing without deleting scene rows, raw scene text, image prompts, motion prompts, statuses, runtime, or timeline metadata.
- `.grokproj` is a project-state file. It preserves scene data, prompts, motion prompts, config, runtime, final preview metadata, and non-secret Grok router metadata.
- `.grokproj` does not embed heavy image/video assets.
- `.grokpkg` portable package export/open added for project state plus referenced media assets.
- `.grokpkg` contains `manifest.json`, `project.grokproj`, assets under `assets/images`, `assets/videos`, `assets/final`, and `checksums.json`.
- Package export rewrites existing linked media paths to package-relative paths and records missing assets as manifest warnings.
- Package open treats input as untrusted, rejects path traversal/absolute/duplicate entries, skips executable/script entries, extracts allowed media only, rewrites paths to extracted files, verifies listed SHA256 checksums, and preserves no-auto-run.
- Package open skips checksum-mismatched assets with warnings and preserves scene data/prompts.
- Dirty/saved state tracking for project edits and Project Session controls.
- Open Project restores into waiting-for-user-start state and never auto-runs.
- Grok router account id, policy, and status labels restore as non-secret metadata only.

## B. Not Implemented / Future Work

- Secure credential storage inside `.grokproj` is intentionally not supported.
- Encrypted project files can be added later if needed.
- Full visual UI click QA remains manual if Electron cannot be launched from CLI.
- Manual UI QA still recommended for the mid-keyframe save/open/resume path.
- Manual UI QA still recommended for moving `.grokproj` to another folder or machine without linked assets.
- Manual UI QA still recommended for exporting/opening `.grokpkg` across machines.
- Optional encrypted package export is future work if needed.
- Advanced migrations beyond schema v1 are not implemented; unsupported versions are rejected.

## C. Test Commands

- `node --check electron/main.js`
- `node --check electron/preload.js`
- `node --check electron/renderer.js`
- `cd dev_sandbox_project_session; npm.cmd test`
- `cd Grok-bac-Tai; npm start` for manual Electron smoke when GUI launch is available.

Regression coverage added in `tests/projectSession.test.mjs`:

- Scene 1 and 2 video generated, scene 3 keyframe generating: resume chooses keyframe generation and preserves no-auto-run.
- Scene 3 image generated with no video: resume chooses video generation.
- All scenes video generated: resume reports batch complete safely.
- Opening with all linked assets missing: scenes, raw text, image prompts, motion prompts, status, runtime, and no-auto-run state are preserved.
- Saving with missing image/video files: generated motion prompts and scene status remain in the `.grokproj`.
- Missing final preview media: preview timeline metadata remains and is marked missing.
- Portable package export: manifest metadata, asset warnings, package-relative asset paths, missing asset preservation, and no secrets.
- Portable package open: scene/motion restore, extracted local path rewrites, no-auto-run, path traversal/absolute/duplicate rejection, executable skip, checksum mismatch skip, sanitized warnings, and missing/corrupt asset warnings.

## D. Security Notes

- `.grokproj` files must not contain API keys, cookies, passwords, session tokens, refresh tokens, bearer tokens, raw browser storage, full private emails, or account-router secrets.
- Loaded `.grokproj` files are untrusted JSON data.
- Project files are parsed and validated only; no file content is executed.
- Account Router secrets stay outside project files.
- Open Project forces `autoRun: false` and `waitingForUserStart: true`.
- `.grokpkg` packages are untrusted ZIP-style input and must not execute package contents.
- `.grokpkg` must not contain API keys, cookies, passwords, session tokens, refresh tokens, bearer tokens, raw browser storage, full private emails, or account-router secrets.
- `.grokpkg` extracts only media under `assets/`: `.png`, `.jpg`, `.jpeg`, `.webp`, `.mp4`, `.mov`, `.webm`, `.wav`, and `.mp3`.
- `checksums.json` is verified when present/listed. Mismatched assets are skipped; project JSON, scene data, prompts, and motion prompts remain restored.
- Moving projects between machines can use `.grokpkg` to carry linked media, or `.grokproj` plus manual asset folder copy/regeneration.

Manual portable package QA:

- Create a project with 2-3 scenes, generate images/videos, export `.grokpkg`, move it to another folder/machine, and open it.
- Confirm scenes/prompts/motion prompts/runtime/final preview metadata restore, assets restore, no auto-run occurs, no secrets are present, and missing/corrupt assets warn without deleting scene data.

## E. Rollback Instructions

- Disable Project Session UI controls in `electron/index.html` if needed.
- Revert Project Session IPC changes in `electron/main.js`.
- Revert Project Session preload APIs in `electron/preload.js`.
- Revert Project Session renderer save/open/new and UI status wiring in `electron/renderer.js`.
- Revert minimal Project Session CSS in `electron/style.css`.
- LocalStorage restore fallback remains available.
- Account Router branch/code should not be touched.
