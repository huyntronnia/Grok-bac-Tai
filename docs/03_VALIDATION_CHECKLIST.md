# Vidora cleanup validation checklist

Run this checklist after each cleanup phase. Stop and fix failures before continuing.

## 1. Static source scan

From the Electron project directory:

```bash
rg -n -i "grok|pixverse" . \
  -g '*.js' -g '*.html' -g '*.css' -g '*.json'
```

Expected final result:

- No runtime reference remains.
- A legacy migration test may mention the old provider strings intentionally.
- Documentation is outside runtime scope and may still contain the names.

Scan Grok router IPC:

```bash
rg -n "router:|openGrok|GrokRouter|grokRouter" . -g '*.js'
```

Expected final result: no Grok router runtime route or symbol.

## 2. JavaScript syntax

```bash
status=0
while IFS= read -r file; do
  node --check "$file" || status=1
done < <(find . -type f -name '*.js' | sort)
exit "$status"
```

Expected: all files pass.

## 3. Existing tests

```bash
node --test chatgptAutomation.test.js chatgptRecovery.test.js
```

Expected: 2/2 pass.

## 4. Add migration tests

Create tests covering at least:

1. Project with `videoProvider: 'grok'` loads as VeoUp.
2. Project with `videoProvider: 'pixverse'` loads as VeoUp.
3. Legacy `grokRouter`, `grokRecovery`, `pixverse`, `sendToGrok` fields do not reach a new saved payload.
4. Scene paths, prompts and generated assets survive migration unchanged.
5. No credential values are copied into project output.

## 5. IPC parity

Compare every literal `ipcRenderer.invoke()` channel in `preload.js` with every literal `ipcMain.handle()` channel in `main.js` and `main/ipc/ipc_handlers.js`.

Expected:

- Missing handlers: `[]`
- No `router:*` channels.
- `chatgpt:clear-cache` exists.
- `chatgpt:open-fresh-chat` exists.

## 6. Module reference scan

For each deleted function/export:

```bash
rg -n "SYMBOL_NAME" . -g '*.js'
```

Expected: no import, call, dependency injection entry, export or test reference remains.

Check for undefined runtime dependencies in:

- `initChatGptRecovery()`
- `initPipelineRunner()`
- `initIpcHandlers()`
- `initBootstrap()`
- the `app.whenReady()` dependency objects

## 7. Renderer smoke checks

- App opens without renderer exceptions.
- No blank settings section remains.
- No Grok/PixVerse wording is visible.
- ChatGPT login button works.
- ChatGPT clear-cache button succeeds without logout.
- Manual new-chat button refuses while a pipeline/send is active.
- Manual new-chat button works when idle.
- Settings save/load works.
- Old project open does not crash.

## 8. Pipeline smoke checks

Use one short test scene:

1. Start pipeline.
2. ChatGPT NV1 creates and saves a valid scene-scoped keyframe.
3. ChatGPT NV2 uploads the correct keyframe and saves `motion_prompt.txt`.
4. No automatic new chat is created.
5. VeoUp receives the same scene keyframe and prompt.
6. VeoUp generation acknowledgement is detected.
7. Video is copied/validated to the correct scene path.
8. Durable stage reaches `complete`.

## 9. Resume and cancellation

- Stop during NV1 and resume.
- Stop during NV2 and resume without duplicate send.
- Stop during VeoUp and verify child-process cleanup.
- Resume a project with an existing valid keyframe.
- Resume a project with an existing motion prompt.
- Resume a project with an existing valid video.
- Ensure no cross-scene path contamination.

## 10. Regression guards

Verify these remain true:

- `contextIsolation: true`
- `nodeIntegration: false`
- no automatic ChatGPT rotation
- no cookie deletion during manual cache clear
- logs continue to mask emails, tokens, URLs and secrets
- no project file stores API keys or passwords
- VeoUp result association checks run ID and scene ID
- existing-video validation still runs before skip

## 11. Final packaging check

```bash
zip -q -r vidora-cleaned.zip electron
unzip -t vidora-cleaned.zip
```

Expected: archive integrity passes and contains no backup files, Grok/PixVerse assets, or generated runtime data.

