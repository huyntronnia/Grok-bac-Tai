# Vidora Phase 2 Change Manifest

## Baseline

- Input: accepted Phase 1 build.
- Phase 1 archive SHA-256: `a854e45595289ad79a20ae34f88778392673761b9b5a796d2f88726901d7b56c`.

## Scope completed

### UI and CSS

- Removed the Grok/PixVerse video-platform selector and complete PixVerse configuration panel.
- Removed the Grok continuity toggle and Grok recovery settings section.
- Reduced account settings UI to ChatGPT only.
- Removed Grok/PixVerse-only CSS selectors while retaining shared layout styles.

### Renderer

- Removed Grok/PixVerse DOM bindings, state, router UI functions and listeners.
- Removed PixVerse energy/config calculations.
- Reduced web provider behavior and login recovery to ChatGPT.
- Kept the video target fixed to VeoUp and retained the Phase 1 legacy migration scrubber.
- Old project files can still load; legacy fields are ignored and stripped on the next save.

### IPC

- Removed six renderer bridge methods and matching handler registrations:
  - `router:open-grok-folder`
  - `router:get-status`
  - `router:list-accounts-safe`
  - `router:select-account`
  - `router:set-enabled`
  - `router:resume-checkpoint`
- Removed matching dependencies from `runtimeIpcHandlers` composition.
- Preserved generic account IPC and both manual ChatGPT IPC handlers.

## Files changed in Phase 2

- `electron/index.html`
- `electron/style.css`
- `electron/renderer.js`
- `electron/preload.js`
- `electron/main/ipc/ipc_handlers.js`
- `electron/main.js`
- `tests/phase2-ui-ipc-cleanup.test.js`

## Deferred to Phase 3

- Grok router state/functions in `main.js`.
- Grok router dependencies in pipeline composition.
- Legacy Grok/PixVerse browser-video engines and DOM scripts.
- VeoUp-only pipeline simplification.

