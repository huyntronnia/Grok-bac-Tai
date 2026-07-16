# Vidora cleanup: remove Grok and PixVerse

## Goal

Remove all Grok and PixVerse code, configuration, UI, IPC, recovery logic, project fields, and browser automation from Vidora while preserving the working production path:

```text
Renderer -> ChatGPT NV1 image -> ChatGPT NV2 motion prompt -> VeoUp -> validated scene video
```

The authoritative source for this cleanup is the current `electron(1).zip` snapshot.

## Non-negotiable constraints

1. Do not remove or weaken ChatGPT NV1/NV2 generation.
2. Do not remove VeoUp automation, coordinate setup, cancellation, result association, or video validation.
3. Do not re-enable automatic ChatGPT conversation rotation. The current conversation must be preserved throughout a run.
4. The manual `chatgpt:open-fresh-chat` IPC may remain, but it must only run after an explicit user click and must refuse while a pipeline/send is active.
5. Keep `chatgpt:clear-cache`; it must preserve cookies and the current conversation.
6. Preserve durable scene state, resume, cancellation, scene-scoped paths, prefetch, continuity references, logging, memory guards, and recovery.
7. Do not delete generic account IPC until ChatGPT account usage has been separated from Grok.
8. Existing project/session files containing Grok or PixVerse fields must still open without crashing.
9. Work in small commits. Run syntax and tests after every phase.

## Verified current state

- The renderer production path already passes `videoProvider: 'veoup'` to the scene pipeline.
- `getSelectedVideoPlatform()` already returns VeoUp unconditionally.
- Grok/PixVerse are legacy branches rather than the active production path.
- The source currently contains 53 renderer IPC invocations and 53 registered handlers.
- Existing JavaScript syntax checks pass.
- Existing tests pass: `chatgptAutomation.test.js` and `chatgptRecovery.test.js`.
- Automatic ChatGPT rotation is disabled at policy, pipeline, and recovery boundaries.

## Target architecture

```text
electron/
├── main.js                  Electron composition and generic app services
├── preload.js               ChatGPT, project, pipeline, VeoUp and file IPC only
├── renderer.js              ChatGPT + VeoUp workflow UI
├── index.html               No Grok/PixVerse controls
├── style.css                No Grok/PixVerse selectors
└── main/
    ├── chatgpt/             ChatGPT-only browser automation
    ├── pipeline/            ChatGPT -> VeoUp scene pipeline
    ├── veoup/               VeoUp automation
    ├── ipc/                 No router:* Grok handlers
    ├── recovery/            Generic/ChatGPT recovery only
    ├── state/
    ├── logging/
    ├── memory/
    └── utils/
```

## Recommended phases

### Phase 1: Compatibility and renderer schema

- Add a normalization boundary that maps legacy `videoProvider: 'grok'` or `'pixverse'` to `'veoup'` when loading a project.
- Stop writing Grok/PixVerse/router fields to new project files.
- Preserve unknown legacy fields only if round-trip preservation is required; otherwise strip them during save.
- Add tests for loading legacy project payloads.

### Phase 2: UI, renderer and IPC

- Remove Grok/PixVerse HTML and CSS.
- Remove corresponding renderer state, functions, persistence fields and listeners.
- Remove the six `router:*` IPC routes.
- Keep ChatGPT account IPC and the two manual ChatGPT handlers.

### Phase 3: Pipeline and main.js

- Make pipeline video generation VeoUp-only.
- Remove Grok router dependencies from pipeline dependency injection.
- Delete the web-video engines and Grok/PixVerse DOM scripts from `main.js`.
- Simplify shared browser helpers to ChatGPT-only behavior.

### Phase 4: Module cleanup and validation

- Remove Grok-only recovery and utility exports.
- Remove remaining text tokens and dead imports.
- Run the full validation checklist in `03_VALIDATION_CHECKLIST.md`.

## Definition of done

- No case-insensitive `grok` or `pixverse` references remain in runtime source, except an explicit legacy migration test/field scrubber if needed.
- No `router:*` IPC remains.
- Renderer and main IPC sets match exactly.
- ChatGPT NV1 and NV2 work in the same conversation.
- VeoUp receives the correct scene keyframe and motion prompt.
- Resume/cancel and durable state continue to work.
- Old projects that mention Grok/PixVerse load as VeoUp projects.
- All syntax checks and tests pass.

