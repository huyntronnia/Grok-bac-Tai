# Refactor Plan - Modularizing `main.js`

This plan proposes dividing the monolithic `electron/main.js` into 15 separate, single-responsibility modules under `electron/main/` during subsequent phases.

---

## 1. `logging.js` (Module: `logging/`)
Handles application console output formatting, error logging to file, crash logs, and exit trace hooks.

* **Functions to Move**:
  - `__vidoraCompactConsoleArg`
  - `appendAppLog`
  - `getAppLogPath`
  - `writeCrashLog`
  - `vidoraTraceExit`
  - `vidoraCompactLogDetails`
  - `vidoraShouldThrottleLog`
* **Dependencies**:
  - `fs/promises`
  - `path`
* **Globals Used**:
  - `globalThis.__vidoraLogThrottle`
* **IPC Related**:
  - `app:append-log`
  - `app:get-log-path`

---

## 2. `utils.js` (Module: `utils/`)
Pure helpers, path checking, filesystem diagnostics, sleeping, name sanitization, and execution of FFmpeg.

* **Functions to Move**:
  - `sleep`
  - `sanitizeFileName`
  - `pathExists`
  - `checkAssetExists`
  - `getAssetStat`
  - `formatBytes`
  - `formatDelta`
  - `getFfmpegBinaryPath`
  - `runFfmpeg`
* **Dependencies**:
  - `fs/promises`
  - `path`
  - `child_process`
* **Globals Used**:
  - None (Leaf dependency)
* **IPC Related**:
  - `asset:exists`
  - `asset:stat`

---

## 3. `chromeDebug.js` (Module: `pipeline/` or `utils/`)
Manages Chromium process lifecycle, finding installation paths, and attaching Chrome Remote Interface (CDP) client.

* **Functions to Move**:
  - `ensureChromeDebug`
  - `closeChromeDebug`
  - `isChromeDebugReady`
  - `findChromeExecutable`
  - `openCdpTab`
  - `getCdpPage`
* **Dependencies**:
  - `chrome-remote-interface`
  - `child_process`
* **Globals Used**:
  - `chromeProcess` (let)
  - `globalThis.activeCdpClient`
* **IPC Related**:
  - None (Internal backend automation service)

---

## 4. `rendererBridge.js` (Module: `state/`)
Manages electron app window creation, menus, showing dialogs, folder prompts, and sending progress notifications to Renderer.

* **Functions to Move**:
  - `createWindow`
  - `notifyRenderer`
  - `sendProjectMenuCommand`
  - `buildAppMenu`
  - `chooseFolder`
  - `chooseOutputFolder`
  - `chooseProjectRootFolder`
  - `getPipelineLogVisibility`
  - `broadcastPipelineLogVisibility`
* **Dependencies**:
  - `electron` (BrowserWindow, Menu, dialog, shell)
  - `logging.js`
* **Globals Used**:
  - `webWindows` (Map)
  - `showPipelineLog` (let)
* **IPC Related**:
  - `output:choose-folder`
  - `project:choose-root-folder`
  - `folder:choose`
  - `view:get-pipeline-log-visible`

---

## 5. `projectSession.js` (Module: `state/` or `utils/`)
Encapsulates new, open, save, and overwrite project files (`.vdra` and `.grokproj`), assets encoding/decoding, and payload schema validations.

* **Functions to Move**:
  - `newProjectSession`
  - `saveProjectSessionFile`
  - `overwriteProjectSessionFile`
  - `createProjectSessionFile`
  - `openProjectSessionFile`
  - `validateProjectPayload`
  - `assertObjectField`
  - `assertNoProjectSecrets`
  - `sanitizeProjectValue`
  - `embedProjectAssets`
  - `restoreEmbeddedProjectAssets`
  - `ensureProjectSceneFolders`
* **Dependencies**:
  - `fs/promises`
  - `path`
  - `utils.js`
  - `logging.js`
* **Globals Used**:
  - `globalThis.__vidoraLastValidProjectPath`
  - `globalThis.__vidoraLastProjectName`
  - `globalThis.__vidoraDisableSidebarSelection`
* **IPC Related**:
  - `project:new-session`
  - `project:save-session-file`
  - `project:overwrite-session-file`
  - `project:create-session-file`
  - `project:open-session-file`
  - `project:ensure-scene-folders`

---

## 6. `sceneState.js` (Module: `state/`)
Manages durable execution snapshots, action journals, task files, and local prompts templates.

* **Functions to Move**:
  - `getPipelineStateFile`
  - `writeSceneSnapshot`
  - `readSceneSnapshot`
  - `writeActionJournal`
  - `readActionJournal`
  - `readPipelineSceneState`
  - `writePipelineSceneState`
  - `persistDurableStage`
  - `ensureAndMigratePrompts`
  - `findBundledPromptTemplate`
  - `ensureUserPromptFile`
  - `readHardPromptConfig`
  - `writeHardPromptConfig`
  - `resolveEditablePromptPath`
  - `getHardPromptFileInfo`
  - `chooseHardPromptFile`
  - `openHardPromptFile`
  - `loadHardPromptTasks`
* **Dependencies**:
  - `fs/promises`
  - `path`
  - `utils.js`
* **Globals Used**:
  - None
* **IPC Related**:
  - `prompt:open-hard-file`
  - `prompt:get-hard-file`
  - `prompt:choose-hard-file`

---

## 7. `continuityReference.js` (Module: `pipeline/`)
Extracts final keyframes and validates continuity imagery from completed scene video files.

* **Functions to Move**:
  - `extractLastFrame`
  - `extractLastFrameToPath`
  - `extractLastFrameFromVideo`
  - `probeVideoDurationSeconds`
  - `extractVideoFrameAtSeconds`
  - `validateContinuityReferenceImage`
  - `getPreviousFrame`
  - `getContinuityReferenceDir`
  - `normalizeContinuityReferenceSettings`
  - `extractContinuityReferencesFromVideo`
* **Dependencies**:
  - `utils.js` (runFfmpeg)
  - `logging.js`
* **Globals Used**:
  - None
* **IPC Related**:
  - `video:extract-last-frame`
  - `frame:get-previous`

---

## 8. `chatgptAutomation.js` (Module: `chatgpt/`)
Orchestrates ChatGPT UI automation, prompt submissions, image/video candidates extraction, and paste actions.

* **Functions to Move**:
  - `generateImageAndMotionWithChatGPT`
  - `generateMotionPromptWithChatGPT`
  - `generateMotionPromptWithChatGPTOnce`
  - `runChatGptRobustSendLadder`
  - `sendPromptViaCdpInput`
  - `sendPromptViaCdpInputSingle`
  - `waitForChatGptComposerIdle`
  - `waitForPromptSendAcknowledged`
  - `vidoraReadChatGptComposerStateReal`
  - `vidoraClickChatGptRealSendButton`
  - `vidoraChatGptInputGate`
  - `vidoraClearChatGptInputBeforePaste`
  - `waitForChatGptImageGenerationDoneBeforeExtract`
  - `waitForLatestChatGPTGeneratedImage`
  - `extractLatestChatGPTGeneratedImageBytes`
  - `saveChatGPTGeneratedImageAsset`
  - `refreshChatGptPageBeforeImageExtract`
  - `inspectAndClickChatGptSendButton`
  - `inspectAndClickChatGptSendButtonSafely`
  - `forceSubmitChatGptComposerScript`
  - `clickSendButtonScript`
  - `sendPromptScript`
  - `collectGeneratedImageUrlsScript`
  - `focusPromptInputScript`
* **Dependencies**:
  - `chromeDebug.js`
  - `logging.js`
  - `utils.js`
* **Globals Used**:
  - `globalThis.chatGptSendStates`
  - `globalThis.__vidoraActiveActionLock`
  - `globalThis.__vidoraPendingAction`
  - `globalThis.__vidoraLastComposerState`
  - `globalThis.__vidoraLastProcessedSceneId`
  - `globalThis.activeConversationUrl`
* **IPC Related**:
  - None (Called by pipelineRunner)

---

## 9. `chatgptHydration.js` (Module: `chatgpt/`)
Manages context hydration by uploading recent scene keyframes and prompts after chat rotations.

* **Functions to Move**:
  - `hydrateFreshChatGptContextAfterRotation`
  - `collectRecentProjectKeyframes`
  - `uploadFilesToChatGptSequentially`
  - `uploadFileToChatGptDirectly`
  - `buildRecentScenesHydrationFile`
* **Dependencies**:
  - `chatgptAutomation.js`
  - `logging.js`
* **Globals Used**:
  - `isChatGptContextFresh` (let)
* **IPC Related**:
  - None (Called by pipelineRunner)

---

## 10. `chatgptRecovery.js` (Module: `chatgpt/` or `recovery/`)
Classifies errors, performs page soft reloads, rotates threads, recovers Cloudflare challenges, and bypasses blocking modals.

* **Functions to Move**:
  - `recoverChatGptBlockingUi`
  - `recoverChatGptResponseChoiceChat`
  - `requestReloadWithReason`
  - `forceCleanChatGptNewChatRotation`
  - `maybeRotateChatGptConversation`
  - `maybeResetChatGptPageForLongRun`
  - `selectChatGptConversationByTitle`
  - `maybeSelectChatGptConversationByTitle`
  - `updateChatGptConversationIdentity`
  - `checkChatGptCurrentConversationTitle`
  - `renameChatGptCurrentConversation`
  - `invalidateChatGptConversationIdentity`
* **Dependencies**:
  - `chatgptAutomation.js`
  - `chromeDebug.js`
  - `logging.js`
* **Globals Used**:
  - `globalThis.__vidoraSafeExitRotationScheduled`
  - `globalThis.__vidoraChatGptNewChatMode`
  - `globalThis.__vidoraDisableSidebarSelection`
  - `chatGptSceneOrdinal` (let)
  - `chatGptConversationIdentityCache`
* **IPC Related**:
  - None

---

## 11. `veoupAutomationBridge.js` (Module: `pipeline/`)
Integrates the main process pipeline runner with coordinate offset structures in `./veoupAutomation.js`.

* **Functions to Move**:
  - `getVeoUpCoordinateConfigHandler`
  - `startVeoUpCoordinateSetupHandler`
  - `captureVeoUpCoordinateHandler`
  - `saveVeoUpCoordinateConfigHandler`
  - `deleteVeoUpCoordinateConfigHandler`
  - `cancelVeoUpCoordinateSetupHandler`
  - `scanProjectAndRunVeoUpHandler`
* **Dependencies**:
  - `./veoupAutomation`
  - `rendererBridge.js`
* **Globals Used**:
  - None
* **IPC Related**:
  - `veoup:get-coordinate-config`
  - `veoup:start-coordinate-setup`
  - `veoup:capture-coordinate`
  - `veoup:delete-coordinate-config`
  - `veoup:save-coordinate-config`
  - `veoup:cancel-coordinate-setup`
  - `veoup:scan-project-and-run`
  - `veoup:run-automation`

---

## 12. `grokRouter.js` (Module: `recovery/`)
Tracks router accounts checklist, toggles router activation state, and resumes routing checkpoints.

* **Functions to Move**:
  - `getSafeGrokAccounts`
  - `getGrokRouterStatus`
  - `selectGrokAccount`
  - `setGrokAccountState`
  - `setAccountRouterEnabled`
  - `writeGrokRouterCheckpoint`
  - `resumeFromRouterCheckpoint`
  - `pauseGrokRouterForError`
  - `classifyGrokRouterError`
  - `openGrokRouterFolder`
  - `listGrokAccountsSafe`
* **Dependencies**:
  - `fs/promises`
  - `path`
  - `logging.js`
* **Globals Used**:
  - `GROK_ROUTER_CHECKPOINT_FILE` (const)
* **IPC Related**:
  - `router:open-grok-folder`
  - `router:get-status`
  - `router:list-accounts-safe`
  - `router:select-account`
  - `router:set-enabled`
  - `router:resume-checkpoint`

---

## 13. `webCredentials.js` (Module: `state/`)
Manages the encrypted account passwords database (`web-provider-accounts.secure.json`), saving, deleting, and parsing credentials.

* **Functions to Move**:
  - `readWebAccountStore`
  - `writeWebAccountStore`
  - `listWebAccountsSafe`
  - `saveWebAccount`
  - `deleteWebAccount`
  - `markWebAccountState`
  - `pickWebAccount`
  - `tryAutoLoginWithStoredAccount`
  - `rollProviderAccount`
  - `checkWebLogin`
  - `openWebLogin`
* **Dependencies**:
  - `fs/promises`
  - `path`
  - `electron` (safeStorage)
  - `logging.js`
* **Globals Used**:
  - `WEB_ACCOUNT_STORE_FILE` (const)
* **IPC Related**:
  - `accounts:list-safe`
  - `accounts:save`
  - `accounts:delete`
  - `browser:open-login`
  - `browser:check-login`

---

## 14. `pipelineRunner.js` (Module: `pipeline/`)
The pipeline coordinator running scene sequences, verifying videos, enforcing sequential flow, and handling cancel operations.

* **Functions to Move**:
  - `runScenePipeline`
  - `runScenePipelineLocked`
  - `runScenePipelineLockedInternal`
  - `stopPipeline`
  - `cancelPipelineRun`
  - `registerPipelineWaiter`
  - `trackPipelineChildProcess`
  - `assertPipelineRunActive`
  - `isPipelineRunCancelled`
  - `isPipelineCancelledError`
  - `makePipelineCancelledError`
  - `getScopedPipelineRunId`
  - `performDurableRecovery`
  - `prepareSceneContext`
  - `validateSceneVideoAndLastFrame`
  - `finalizeValidatedSceneVideo`
  - `checkIfAllScenesComplete`
  - `buildVeoUpPromptsReadyFile`
* **Dependencies**:
  - `chatgptAutomation.js`
  - `chatgptHydration.js`
  - `chatgptRecovery.js`
  - `continuityReference.js`
  - `sceneState.js`
  - `projectSession.js`
  - `logging.js`
  - `utils.js`
* **Globals Used**:
  - `pipelineRunScope`
  - `pipelineCancellation`
  - `scenePipelineLocks`
  - `scenePipelineFailureTracker`
* **IPC Related**:
  - `pipeline:run-scene`
  - `pipeline:stop`

---

## 15. `memoryMonitor.js` (Module: `memory/`)
Monages proactive Chromium tab memory checks, memory milestone logs, and GC alerts.

* **Functions to Move**:
  - `checkProactiveMemoryGuard`
  - `getCdpPageMemoryMetrics`
  - `logMemoryMilestone`
* **Dependencies**:
  - `chromeDebug.js`
  - `logging.js`
* **Globals Used**:
  - `globalThis.activeCdpClient`
* **IPC Related**:
  - None (Internal monitor thread)
