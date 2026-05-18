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
- Dirty/saved state tracking for project edits and Project Session controls.
- Open Project restores into waiting-for-user-start state and never auto-runs.
- Grok router account id, policy, and status labels restore as non-secret metadata only.

## B. Not Implemented / Future Work

- Secure credential storage inside `.grokproj` is intentionally not supported.
- Encrypted project files can be added later if needed.
- Full visual UI click QA remains manual if Electron cannot be launched from CLI.
- Manual UI QA still recommended for the mid-keyframe save/open/resume path.
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

## D. Security Notes

- `.grokproj` files must not contain API keys, cookies, passwords, session tokens, refresh tokens, bearer tokens, raw browser storage, full private emails, or account-router secrets.
- Loaded `.grokproj` files are untrusted JSON data.
- Project files are parsed and validated only; no file content is executed.
- Account Router secrets stay outside project files.
- Open Project forces `autoRun: false` and `waitingForUserStart: true`.

## E. Rollback Instructions

- Disable Project Session UI controls in `electron/index.html` if needed.
- Revert Project Session IPC changes in `electron/main.js`.
- Revert Project Session preload APIs in `electron/preload.js`.
- Revert Project Session renderer save/open/new and UI status wiring in `electron/renderer.js`.
- Revert minimal Project Session CSS in `electron/style.css`.
- LocalStorage restore fallback remains available.
- Account Router branch/code should not be touched.
