# Vidora UI, IPC and pipeline removal plan

## `index.html`

Delete:

- `#video-platform-select`
- Entire `#pixverse-config` block
- `#pixverse-energy-status`
- `#pixverse-resolution-select`
- `#pixverse-ratio-select`
- `#pixverse-duration-select`
- `#pixverse-model-select`
- `#pixverse-preview-toggle`
- `#pixverse-audio-toggle`
- `#pixverse-config-advice`
- `#continuity-grok-toggle`
- Entire “Grok recovery” settings section
- Grok option from `#web-account-provider-select`
- `#web-grok-account-list` and its wrapping column

Update wording:

- “ChatGPT + nền tảng video” -> “ChatGPT + VeoUp”
- Remove all user-facing Grok/PixVerse login, recovery, quota and energy text.

The hidden provider router panel is already legacy. Do not make it visible during this cleanup.

## `style.css`

Delete after HTML removal:

- `.pixverse-config`
- `.grok-account-router-card`
- `.grok-account-list`
- `.grok-account-row`
- Grok account state selectors used by those rows

Do not remove shared `.config-grid`, `.settings-section`, `.state-*`, or credential styles unless a usage scan proves they are exclusive.

## `renderer.js`

### Delete DOM bindings and state

- All `grok*` DOM constants
- All `pixverse*` DOM constants
- `continuityGrokToggle`
- `pixverseCapability`

### Delete functions

- `getGrokRecoverySettings`
- `applyGrokRecoverySettings`
- `estimatePixVerseEnergy`
- `isPixVerseProConfig`
- `suggestPixVerseConfig`
- `updatePixVerseConfigAdvice`
- `getGrokRouterSettings`
- `renderGrokRouterStatus`
- `refreshGrokRouterStatus`

Delete Grok router and PixVerse config event listeners.

### Simplify functions

- `getSelectedWebProvider()` -> return `chatgpt`.
- Keep `getSelectedVideoPlatform()` returning VeoUp, or remove the function and use a constant.
- `getSelectedVideoAccount()` -> remove or return empty string.
- `getVideoProviderConfig()` -> remove Grok/PixVerse output; return `{}` only if a stable call signature is temporarily needed.
- `syncVideoPlatformConfig()` -> remove.
- `waitForProviderReady()` -> ChatGPT-only.
- `parseLoginRequiredError()` -> ChatGPT-only.
- `recoverLoginAndRetryScene()` -> ChatGPT-only labels and behavior.
- `openWebLogin()` status copy -> ChatGPT-only.
- `getContinuityReferenceSettings()` -> remove `sendToGrok`.

### Stop writing legacy project fields

Remove these from project/session output:

- `router`
- `grokRouter`
- `grokRecovery`
- `pixverse`
- `videoPlatform`
- `selectedGrokAccountId`
- `accountRouterEnabled`
- `routingPolicy`
- `sendToGrok`
- Grok/PixVerse selected labels

Write `videoProvider: 'veoup'` if the schema still requires the field.

### Legacy project migration

When loading an existing project:

```js
function normalizeLegacyVideoProvider(value) {
  return 'veoup';
}
```

Ignore legacy router and PixVerse configuration. Do not reject the project. Add a migration marker/log if desired, but do not expose secrets or mutate the original file until the user saves.

## `preload.js`

Delete:

- `openGrokRouterFolder`
- `getGrokRouterStatus`
- `listGrokAccountsSafe`
- `selectGrokAccount`
- `setAccountRouterEnabled`
- `resumeFromRouterCheckpoint`

Keep:

- `listWebAccountsSafe`
- `saveWebAccount`
- `deleteWebAccount`
- `openWebLogin`
- `checkWebLogin`
- `clearChatGptCache`
- `openFreshChatGpt`
- all pipeline/project/VeoUp/file IPC

## `main/ipc/ipc_handlers.js`

Delete handler dependencies and registrations:

- `router:open-grok-folder`
- `router:get-status`
- `router:list-accounts-safe`
- `router:select-account`
- `router:set-enabled`
- `router:resume-checkpoint`

Keep generic account handlers for ChatGPT.

After editing, compute invoke/handler parity. Expected result: zero missing channels.

## `main/pipeline/pipeline_runner.js`

### Delete injected Grok dependencies

- `selectGrokAccount`
- `setAccountRouterEnabled`
- `getGrokRouterStatus`
- `classifyGrokRouterError`
- `writeGrokRouterCheckpoint`
- `pauseGrokRouterForError`

Remove corresponding assignments in `initPipelineRunner()`.

### Simplify video preparation

Remove:

- `videoAccount`
- `requestedRouterEnabled`
- `routerActive`
- `routingPolicy`
- Grok checkpoint construction
- router selection and pause logic
- Grok-specific error filename and classification

Use:

```js
const videoProvider = 'veoup';
```

Prefer deleting the provider abstraction completely once the main video function is VeoUp-only.

### Keep intact

- scene locking
- cancellation/run IDs
- durable stages
- strict scene-scoped paths
- NV1/NV2 success tracking
- keyframe/motion-only mode
- video validation
- continuity references
- prefetch
- resume and existing-video validation

## Other modules

### `main/utils/utils.js`

- Remove Grok/PixVerse branches from `normalizeVideoProvider`; return VeoUp or remove the function.
- Remove `sendToGrok` from normalized continuity settings.

### `main/recovery/recovery.js`

Delete Grok-only retry helpers and environment configuration:

- `VIDORA_GROK_RESULT_RETRY_LIMIT`
- `normalizeGrokResultRetryLimit`
- `makeRetryableGrokGenerationError`
- `isRetryableGrokGenerationError`
- `shouldRecoverFromCacheOrChallenge`

### `main/chatgpt/chatgpt_recovery.js`

- Delete `recoverProviderFromCacheOrChallenge()` and its runtime dependencies.
- Keep ChatGPT composer, tab crash, login, reload and draft recovery.

### `main/chatgpt/chatgpt_dom.js`

- Simplify `detectLoginScript()` to ChatGPT.
- Simplify `clickUploadButtonScript()` to ChatGPT.
- Delete provider-specific Grok/PixVerse branches.

### `main/logging/logging.js`

- Remove `grok.com` from any provider URL allowlist after runtime removal.
- Preserve ChatGPT URL masking and all secret/email masking.

## Whole-file deletion candidates outside this scope

These appear unreferenced internally but should be handled in a separate cleanup because external scripts may rely on them and the snapshot lacks `package.json`:

- `main/chatgpt/debug.js`
- `main/index.js`
- `veoupAutomation.js`

Do not delete them as part of the Grok/PixVerse change unless external entry points and tests are known.

