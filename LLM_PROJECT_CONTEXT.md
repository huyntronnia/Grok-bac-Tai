# LLM Project Context

## Repo

- Repository: `Zazaa0606/Grok-bac-Tai`
- Local path: `D:\bac_tai\Grok-bac-Tai`
- App: Electron desktop app named Vidora.
- Main entry: `electron/main.js`
- Renderer/UI: `electron/renderer.js`, `electron/index.html`, `electron/style.css`
- Preload bridge: `electron/preload.js`
- Current branch at handoff: `codex/chatgpt-pipeline-recovery`
- Current branch HEAD at scan time: `76a6b16 Improve ChatGPT and Grok pipeline recovery`

## Product Goal

Vidora automates an AI video production workflow:

- User creates a project from scene text.
- App sends scene/image prompts through ChatGPT or API.
- App produces/reviews keyframe images.
- App generates motion prompts.
- App sends keyframe plus motion prompt to VeoUp for production video.
- App stores scene outputs, resumes interrupted batches, and builds final timeline/preview.

The app uses persistent browser/CDP sessions for ChatGPT and legacy/dormant providers where still present. Production video must not open, poll, or depend on Grok/PixVerse. It must never store browser cookies, raw sessions, API keys, passwords, bearer tokens, refresh tokens, or full private emails in project/package files.

## Mandatory Production Pipeline

Vidora now has one mandatory production architecture:

1. Scene N image.
2. Motion prompt.
3. Scene N video through VeoUp.
4. Verify the video exists and is usable.
5. Extract the actual final frame from the completed video.
6. Use that final frame as continuity input for Scene N+1.
7. Advance only after all required outputs for Scene N are valid.

Grok is not part of the active production runtime. Do not open Grok, poll Grok login, route scene video generation to Grok, or fall back to Grok when VeoUp is selected/missing. Any remaining Grok code is legacy/dormant compatibility unless a future owner request explicitly reactivates it.

There must be no supported image-only, prompt-only, ChatGPT-only, no-VeoUp, partial-run, or parallel-scene execution path. Old optional partial-run modes must be removed end-to-end.

Pressing Start Pipeline must always execute the complete closed-loop scene lifecycle above.

## Rule Precedence For Active Production Cleanup

The owner authorizes direct integration changes to the Electron production source for cleanup that enforces the mandatory pipeline.

Historical sandbox restrictions such as these do not apply to that active production cleanup task:

- Only edit files inside `dev_sandbox_project_session/`.
- Only edit files inside `dev_sandbox_grok_account_router/`.
- Do not edit `electron/` without approval.

Those sandbox rules remain scoped only to work performed inside those sandbox projects. Do not delete sandbox folders merely because their local rules are not applicable to production cleanup. Do not create a sandbox prototype for this cleanup; implement directly in the active Electron application.

## Code Search Workflow

Before broad Grep, Glob, or manual reading:

1. Read this `LLM_PROJECT_CONTEXT.md` file if it exists.
2. Run `git branch --show-current`.
3. Run `git status --short`.
4. Use `mcp__semble__search` to locate relevant implementation.
5. Use `mcp__semble__find_related` after promising search results to trace connected paths.
6. Use Grep or literal search afterward for exhaustive references to discovered identifiers, visible UI labels, IPC names, project fields, and state flags.
7. Use direct file reads only for exact files or missing context.

Search-tool rules must not prevent an exhaustive final reference audit.

## Obsolete UI Modes To Remove

Remove the complete UI containers for:

1. `CHI TAO ANH + MOTION PROMPT` (visible source text may be mojibake/encoded Vietnamese).
2. `CHI CHAY CHATGPT (KHONG CHAY VEOUP)` (visible source text may be mojibake/encoded Vietnamese).

Do not hide them with CSS. Remove checkbox inputs, labels, descriptions, parent cards or wrappers used only by these controls, empty gaps left behind, dedicated unused CSS, and accessibility attributes or DOM IDs specific to them. Keep existing visual style and allow the Start Pipeline area to collapse naturally.

Remove all code exclusively supporting these modes, including DOM references, event listeners, boolean flags, mode enums, renderer state, `localStorage` or session persistence, project save/load fields, IPC payload properties, preload bridge parameters, main-process arguments, branches that skip VeoUp, branches that stop after image or motion-prompt generation, mode-specific validation, status text, retry branches, mocks, fixtures, tests, obsolete comments, unused imports, constants, and helpers.

Do not retain dormant flags that could reactivate partial execution later. Old project files containing removed fields must still load safely; ignore those fields without restoring old behavior.

## Continuity Invariants

Retain these behaviors while enforcing the mandatory pipeline:

- Scene N must finish before Scene N+1 begins.
- Character preset images.
- Character `.txt` descriptions.
- `isChatGptContextFresh`.
- Sequential attachment upload.
- Removal of stale attachments before upload.
- Character references on a fresh ChatGPT context.
- Previous scene last-frame input.
- Passive motion-prompt polling.
- Existing human-like cooldown delays.
- Maximum two local retries.
- `forceCleanChatGptNewChatRotation()`.
- Rehydrating character context after chat rotation.
- Safe recursive or controlled pipeline restart.
- `window.isVidoraPipelineBusy` locking.
- Correct busy-flag release on success, failure, and restart.
- Rebuilding the queue from Scene N-1 when the previous video or final frame is unavailable.

Never substitute an unrelated static image when the previous scene's real final video frame is required.

## Batch Mode Audit Rules

Search for historical Batch Mode and alternate execution paths. Candidates for removal include batch-only scene loops, parallel scene generation, duplicate queue iteration, old image-only modes, old motion-prompt-only modes, old ChatGPT-only modes, old no-video modes, duplicate cooldown systems, duplicate retry systems, deprecated statuses, unreachable recovery functions, and old flags that no longer affect the active pipeline.

Remove an item only after tracing its references and proving it is unused by the current closed-loop pipeline. Do not perform a broad speculative rewrite. Do not rename or reformat unrelated code. Avoid repository-wide encoding conversion because existing source contains mojibake-looking Vietnamese text.

## Runtime State Guidance

Runtime state should represent real scene progress rather than optional modes. Prefer existing equivalent states such as `pending`, `image_processing`, `image_done`, `motion_prompt_processing`, `motion_prompt_done`, `video_processing`, `video_done`, `last_frame_processing`, `complete`, and `failed`.

Do not rewrite the state architecture if the current model already expresses these stages reliably.

## Major Work Completed

### Grok Account Router

- Safe Grok Account Router subset was implemented in branch `feature/grok-account-router-safe-subset`.
- Commit: `4536929 feat: add safe Grok account router subset`
- Purpose: track safe account metadata/status, not secrets.
- Important sandbox folder: `dev_sandbox_grok_account_router/`
- Guardrail: do not modify `dev_sandbox_grok_account_router/` unless a task explicitly asks.

### Project Session `.grokproj`

Project Session was implemented and pushed on branch `feature/project-session-grokproj`.

- Latest pushed commit: `1a558ff feat: add grokproj project session workflow`
- Branch pushed to GitHub: `feature/project-session-grokproj`
- PR is stacked on `feature/grok-account-router-safe-subset`.
- Compare/create URL:
  `https://github.com/Zazaa0606/Grok-bac-Tai/compare/feature/grok-account-router-safe-subset...feature/project-session-grokproj?expand=1`

Implemented:

- New/Open/Save `.grokproj` workflow.
- Native File menu New/Open/Save wired to real flows.
- Safe main-process IPC handlers.
- Safe preload APIs.
- Renderer save/restore logic.
- Dirty Save / Discard / Cancel flow.
- Missing asset warnings.
- No auto-run after Open.
- Mid-batch restore fix: if scenes 1 and 2 have videos and scene 3 was keyframe/image-generating at save time, open/Start resumes scene 3 image/keyframe stage instead of jumping to video-only routing.
- Portability fix: missing linked media files do not delete scene rows, raw scene text, image prompts, motion prompts, statuses, runtime, or timeline metadata.

### Portable Package `.grokpkg`

Portable Project Package support was added and hardened on `feature/project-session-grokproj` commit `1a558ff`.

Format:

- `.grokpkg` is a ZIP-style portable bundle.
- Contains:
  - `manifest.json`
  - `project.grokproj`
  - `checksums.json`
  - `assets/images/**`
  - `assets/videos/**`
  - `assets/final/**`

Security/hardening:

- Treat package input as untrusted.
- Reject path traversal, encoded traversal, double-encoded traversal, absolute paths, and duplicate ZIP entries.
- Skip executable/script entries: `.exe`, `.bat`, `.cmd`, `.ps1`, `.js`, `.vbs`, `.sh`, `.dll`, `.msi`, `.scr`.
- Extract only allowed media: `.png`, `.jpg`, `.jpeg`, `.webp`, `.mp4`, `.mov`, `.webm`, `.wav`, `.mp3`.
- Verify SHA256 checksums from `checksums.json`.
- If checksum mismatch: skip asset, warn, preserve scene data/prompts.
- Sanitize untrusted manifest warnings before display.
- Extract into app-managed unique folder.
- No auto-run after package open.
- No secrets in `.grokproj` or `.grokpkg`.

Important caveat: current branch `codex/chatgpt-pipeline-recovery` does not contain the latest `.grokpkg` hardening commit `1a558ff`. It contains older Project Session commit `bc516e3` through merged `origin/main`.

## Current Branch: `codex/chatgpt-pipeline-recovery`

This branch was pulled and scanned after Project Session work.

Current branch delta vs fresh `origin/main`:

- `electron/main.js`
- `electron/renderer.js`
- `electron/preload.js`
- `electron/index.html`
- `electron/style.css`
- `package.json`
- `package-lock.json`

Key branch changes:

- ChatGPT login/session recovery.
- Grok/PixVerse login/session recovery.
- ChatGPT missing-chat recovery dialog.
- ChatGPT conversation select/rename workflow.
- ChatGPT image-generation retry when stuck, text-only, or no-image.
- Hard prompt file workflow.
- New `.vdra` Vidora project file flow with embedded base64 assets.
- Electron builder config added.

Current branch uses `.vdra` project files:

- Save/Open use `.vdra`.
- Open also accepts legacy `.grokproj`.
- Save embeds scene image/video assets as base64 inside `embeddedAssets`.
- Open restores embedded assets into a sibling project folder.
- This `.vdra` behavior is different from `.grokproj` plus `.grokpkg` design on `feature/project-session-grokproj`.

## Important Files

- `electron/main.js`
  - IPC handlers.
  - Project save/open.
  - Browser/CDP automation.
  - ChatGPT/Grok/PixVerse pipeline logic.
  - Asset embedding/restoration on current branch.
- `electron/renderer.js`
  - Project UI state.
  - Start/Resume pipeline.
  - Login recovery UI.
  - Chat resolve dialogs.
  - Project save/open flows.
- `electron/preload.js`
  - Safe renderer API surface.
- `electron/index.html`
  - App UI and dialogs.
- `electron/style.css`
  - UI styling.
- `dev_sandbox_project_session/`
  - Sandbox tests/docs for `.grokproj` Project Session.
- `dev_sandbox_grok_account_router/`
  - Sandbox tests/docs for safe Grok Account Router.

## Validation Already Run

On `feature/project-session-grokproj` before push:

- `node --check electron/main.js`: passed
- `node --check electron/preload.js`: passed
- `node --check electron/renderer.js`: passed
- `cd dev_sandbox_project_session; npm.cmd test`: passed
- `git diff --check`: passed
- Secret audit: guardrail/code/test dummy hits only, no real secrets.

After switching to `codex/chatgpt-pipeline-recovery`:

- `git pull --ff-only`: already up to date
- `node --check electron/main.js`: passed
- `node --check electron/preload.js`: passed
- `node --check electron/renderer.js`: passed
- `cd dev_sandbox_project_session; npm.cmd test`: passed
- `git diff --check origin/main...HEAD`: passed
- Worktree was clean before this context file was created.

## Security Rules

Never commit, export, log, hard-code, or place inside project/package files:

- API keys
- passwords
- cookies
- session tokens
- refresh tokens
- bearer tokens
- raw browser storage
- full private emails
- account-router secrets
- real local `.grokproj`, `.grokpkg`, or `.vdra` user files
- generated media assets unless intentionally tiny test fixtures

Secret-like strings in docs/tests are guardrails only. Real secrets are not allowed.

Electron or Chromium may retain login state inside its normal app-managed browser profile when required for application operation. Do not manually serialize that browser state into Git-tracked files, `.vdra`, `.grokproj`, `.grokpkg`, debug logs, or exported backups. Do not disable legitimate Chromium session persistence merely to satisfy an overly broad historical "never store cookies" rule.

Treat all imported project and package data as untrusted. Opening a project or package must never automatically start the pipeline. Never execute content loaded from a project/package. Paths loaded from saved projects may be missing, moved, invalid, or malicious and must be validated defensively.

## Project Format Rules

Do not assume `.vdra`, `.grokproj`, or `.grokpkg` is obsolete solely because historical documents disagree. Audit current production references first.

Classify each format as one of:

- Actively used.
- Import compatibility only.
- Export compatibility only.
- Sandbox/prototype only.
- Unreferenced legacy code.

Do not remove active save/load functionality. If a format is unreferenced legacy code, report it before deleting it unless deletion is clearly within the active task.

If `.grokpkg` remains supported, preserve these protections:

- Reject path traversal.
- Reject encoded traversal.
- Reject double-encoded traversal.
- Reject absolute paths.
- Reject duplicate ZIP entries.
- Skip executable and script entries.
- Extract only explicitly allowed media types.
- Verify SHA-256 checksums.
- Skip corrupted assets while preserving scene text and prompts where possible.
- Sanitize warnings before displaying them.
- Extract to an app-managed unique folder.
- Never include account secrets.

Do not require the account-router or project-session sandbox documentation suites for production maintenance tasks unless files in those sandboxes were modified.

## Account Router Scope

Do not modify or delete multi-account Grok routing merely because it is unrelated to the mandatory pipeline cleanup. Only touch account-router code if one of the removed checkbox modes directly depends on it.

Preserve:

- Account-limit versus canvas-limit distinction.
- Current scene/job state during account switching.
- Secret masking.
- No secrets in logs or project files.

Do not introduce new account switching behavior during partial-mode cleanup.

## Known Branch Caveats

- `codex/chatgpt-pipeline-recovery` does not include latest `.grokpkg` package hardening from `1a558ff`.
- It uses `.vdra` and embedded assets, which may conflict conceptually with `.grokproj` plus `.grokpkg`.
- If next work combines branches, reconcile project-file strategy deliberately:
  - `.grokproj`: lightweight JSON project state.
  - `.grokpkg`: portable project plus referenced assets.
  - `.vdra`: current recovery branch project file with embedded assets.
- Current branch has mojibake-looking Vietnamese text in shell output; source files likely carry existing encoding/content. Avoid broad re-encoding/refactors.
- Human UI/cross-machine QA was accepted by user for previous Project Session work, but automated Electron UI QA was not run in the final commit pass.

## Suggested Next-Step Workflow For Another LLM

1. Check branch and worktree:
   - `git branch --show-current`
   - `git status --short`
2. Read this file first.
3. Use `mcp__semble__search` before broad Grep/Glob/Read.
4. Use `mcp__semble__find_related` after promising results.
5. If task touches Project Session package features, compare current branch with `feature/project-session-grokproj` commit `1a558ff`.
6. If task touches ChatGPT/Grok recovery or the mandatory closed-loop pipeline, focus current branch files:
   - `electron/main.js`
   - `electron/renderer.js`
   - `electron/preload.js`
   - `electron/index.html`
   - `electron/style.css`
7. For partial-mode cleanup, perform exhaustive literal search for:
   - Both visible checkbox labels.
   - All discovered IDs.
   - All discovered variable names.
   - All discovered IPC fields.
   - All discovered project persistence fields.
8. Run validation before final:
   - `node --check electron/main.js`
   - `node --check electron/preload.js`
   - `node --check electron/renderer.js`
   - active repository `npm test` command
   - relevant targeted test suites
   - `git diff --check`
9. Only run tests inside `dev_sandbox_project_session` or `dev_sandbox_grok_account_router` if files in those sandboxes were modified.
10. Audit changed files for secrets before commit/push.

## Required Proof For Partial-Mode Cleanup

Add or update tests proving:

- Both removed controls are absent.
- Their mode flags are not read or written.
- Their payload fields are not sent through IPC.
- Start Pipeline always enters video generation.
- Scene N+1 cannot begin before Scene N video succeeds.
- Scene N+1 cannot begin before final frame extraction succeeds.
- Missing previous video causes recovery from the previous scene.
- Old saved projects containing removed fields load without crashing and cannot reactivate old modes.
- Existing character-context and chat-rotation behavior remains intact.

## Final Report For Partial-Mode Cleanup

Report:

1. Current branch and initial worktree status.
2. Files changed.
3. Removed UI elements.
4. Removed mode flags, branches, IPC fields, project fields, helpers, styles, tests, and comments.
5. Old project compatibility handling retained.
6. Legacy Batch Mode code retained and why it is still needed.
7. Status of `.vdra`, `.grokproj`, and `.grokpkg`.
8. Syntax-check results.
9. Test results.
10. `git diff --check` result.
11. Final mandatory closed-loop pipeline flow.

Do not commit or push unless explicitly requested.
