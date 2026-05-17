# Phase 2 Patch Proposal

This is a patch proposal only. Do not apply it until the Phase 2 approval gates in `PHASE2_APPROVAL_CHECKLIST.md` are checked.

## Goals
- Keep the existing single-account Grok/PixVerse/ChatGPT pipeline working by default.
- Add account routing behind `accountRouterEnabled` so rollback is a one-flag action.
- Persist only safe account metadata and checkpoint references in app data.
- Never expose plaintext credentials, cookies, browser storage, or session tokens to the renderer.

## Proposed files
- New: `electron/accountRouter.cjs`
  - CommonJS production-safe port of the sandbox state machine from `prototype/accountRouter.js`.
  - Exports account states, error types, `pickNextAccount`, `transitionAccount`, `classifyGenerationError`, checkpoint helpers, and sanitizers.
- Modify: `electron/main.js`
  - Add app-data paths for `account-router-state.json` and `account-router-checkpoints.json`.
  - Add IPC handlers: `account-router:get-state`, `account-router:save-account`, `account-router:remove-account`, `account-router:set-active`, `account-router:disable-account`, `account-router:pause`, `account-router:resume-checkpoint`, `account-router:classify-error`.
  - Call `pickNextAccount` before Grok scene video generation when `accountRouterEnabled` is true.
  - Write checkpoint before scene start and after classified generation errors.
  - Route only `account_limit` to account switch; keep `canvas_limit` on same account/canvas recovery path.
- Modify: `electron/preload.js`
  - Expose a minimal `videoPlannerAPI.accountRouter` object.
  - Return sanitized account metadata only.
- Modify: `electron/renderer.js`
  - Add account state loading, active-account display, pause/resume controls, and manual switch actions.
  - Reflect last classification/action on scene errors.
- Modify: `electron/index.html` and `electron/style.css`
  - Add compact account-router panel and status badges using the current app design language.

## Main integration sketch

```js
// electron/main.js
const accountRouter = require('./accountRouter.cjs');
const ACCOUNT_ROUTER_STATE_FILE = path.join(app.getPath('userData'), 'account-router-state.json');
const ACCOUNT_ROUTER_CHECKPOINT_FILE = path.join(app.getPath('userData'), 'account-router-checkpoints.json');
let accountRouterState = accountRouter.createDefaultRouterState();

async function loadAccountRouterState() {
  accountRouterState = accountRouter.sanitizeRouterState(
    await readJsonFile(ACCOUNT_ROUTER_STATE_FILE).catch(() => accountRouter.createDefaultRouterState()),
  );
  return accountRouterState;
}

async function saveAccountRouterState(nextState = accountRouterState) {
  accountRouterState = accountRouter.sanitizeRouterState(nextState);
  await fs.writeFile(ACCOUNT_ROUTER_STATE_FILE, JSON.stringify(accountRouterState, null, 2), 'utf8');
  return accountRouter.getPublicRouterState(accountRouterState);
}

async function getAccountRouterState() {
  await loadAccountRouterState();
  return accountRouter.getPublicRouterState(accountRouterState);
}
```

```js
// Around Grok scene-video generation only.
const routing = await selectGrokAccountForScene({ sceneId, sceneDir, imagePath, motionPrompt });
if (routing.enabled && !routing.account) {
  return { phase: 'video', videoStatus: 'account-router-paused', videoError: routing.reason };
}
```

```js
// Existing error catch path.
const classification = accountRouter.classifyGenerationError(error);
await writeSceneCheckpoint({ sceneId, sceneDir, imagePath, motionPrompt, accountId, classification });
if (classification === accountRouter.ERROR_TYPES.ACCOUNT_LIMIT) {
  return switchToNextGrokAccountAndResume(...);
}
if (classification === accountRouter.ERROR_TYPES.CANVAS_LIMIT) {
  return recoverGrokCanvasAfterLimit(page, ...);
}
return { phase: 'video', videoStatus: 'account-router-paused', videoError: classification };
```

## Security requirements for the patch
- Account records may contain: `accountId`, `displayName`, `maskedEmail`, `status`, `priority`, `lastUsedAt`, `cooldownUntil`, `encryptedSecretRef`, `canvasRef`, `profileRef`.
- Account records must not contain: password, cookie, bearer token, refresh token, session token, API key, localStorage/sessionStorage dumps, raw CDP profile data.
- Checkpoints may contain non-secret prompts and file refs, but must reject secret-like plaintext before writing.
- Renderer receives only `getPublicRouterState` output.

## Rollback
- Set `accountRouterEnabled` to false or hide the UI toggle.
- Existing single-account flow remains unchanged when disabled.
- Delete or ignore versioned router JSON files if schema is incompatible.
