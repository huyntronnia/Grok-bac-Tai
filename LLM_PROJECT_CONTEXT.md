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
- App sends keyframe plus motion prompt to Grok/PixVerse for video.
- App stores scene outputs, resumes interrupted batches, and builds final timeline/preview.

The app uses persistent browser/CDP sessions for ChatGPT/Grok/PixVerse. It must never store browser cookies, raw sessions, API keys, passwords, bearer tokens, refresh tokens, or full private emails in project/package files.

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

Never commit or store:

- API keys
- cookies
- passwords
- session tokens
- refresh tokens
- bearer tokens
- raw browser storage
- full private emails
- account-router secrets
- real local `.grokproj`, `.grokpkg`, or `.vdra` user files
- generated media assets unless intentionally tiny test fixtures

Secret-like strings in docs/tests are guardrails only. Real secrets are not allowed.

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
3. If task touches Project Session package features, compare current branch with `feature/project-session-grokproj` commit `1a558ff`.
4. If task touches ChatGPT/Grok recovery, focus current branch files:
   - `electron/main.js`
   - `electron/renderer.js`
   - `electron/preload.js`
   - `electron/index.html`
5. Run validation before final:
   - `node --check electron/main.js`
   - `node --check electron/preload.js`
   - `node --check electron/renderer.js`
   - `cd dev_sandbox_project_session; npm.cmd test`
   - `git diff --check`
6. Audit changed files for secrets before commit/push.
