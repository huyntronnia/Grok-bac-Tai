# Project Knowledge Map - Vidora

## File Analysis

### [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)

* **Relative Path**: `electron/main.js`
* **Purpose**: App bootstrap and Electron main process entry point.
* **Exported Symbols**: *None*
* **Imported Symbols**: `child_process`, `electron/main/logging/index.js`, `electron/main/utils/index.js`, `electron/main/memory/index.js`, `electron/main/state/index.js`, `electron/main/state/chatgpt_state.js`, `electron/main/chatgpt/chatgpt_dom.js`, `electron/main/chatgpt/chatgpt_core.js`, `electron/main/chatgpt/browser_adapter.js`, `electron/main/chatgpt/chatgpt_upload.js`, `electron/main/chatgpt/chatgpt_send.js`, `electron/main/chatgpt/chatgpt_recovery.js`, `electron/main/bootstrap/index.js`, `electron/main/ipc/index.js`, `electron/main/chatgpt/index.js`, `electron/main/recovery/index.js`, `electron`, `ffmpeg-static`, `fs/promises`, `path`, `crypto`, `async_hooks`, `electron/main/veoup/index.js`, `electron/main/pipeline/index.js`, `./chatgptStability`, `fs`, `chrome-remote-interface`
* **Classes**: *None*
* **Functions**: `logChatGptStage`, `setChatGptSendState`, `loginRequiredMessage`, `sanitizeProjectValue`, `assertNoProjectSecrets`, `assertObjectField`, `validateProjectPayload`, `resolveProjectPrepromptFolder`, `importCharacterPresetsHandler`, `newProjectSession`, `saveProjectSessionFile`, `openProjectSessionFile`, `embedProjectAssets`, `restoreEmbeddedProjectAssets`, `normalizeCredentialProvider`, `maskEmail`, `ensureCredentialEncryptionAvailable`, `readWebAccountStore`, `writeWebAccountStore`, `safeWebAccount`, `listWebAccountsSafe`, `saveWebAccount`, `deleteWebAccount`, `pickWebAccount`, `sanitizeChatTitleForLog`, `checkProactiveMemoryGuard`, `getChatGptLocationState`, `invalidateChatGptConversationIdentity`, `forceCleanChatGptNewChatRotation`, `isChatGptRequestRotationEligible`, `captureChatGptDiagnosticSnapshotScript`, `captureAndLogChatGptDiagnostics`, `updateChatGptConversationIdentity`, `getSafeGrokAccounts`, `getGrokRouterStatus`, `setGrokAccountState`, `selectGrokAccount`, `setAccountRouterEnabled`, `classifyGrokRouterError`, `writeGrokRouterCheckpoint`, `resumeFromRouterCheckpoint`, `notifyRenderer`, `notifyChatGptPolicyRefusal`, `ensureAndMigratePrompts`, `sanitizePromptSourcePathForLog`, `findBundledPromptTemplate`, `ensureUserPromptFile`, `readHardPromptConfig`, `writeHardPromptConfig`, `resolveEditablePromptPath`, `getHardPromptFileInfo`, `chooseHardPromptFile`, `openHardPromptFile`, `loadHardPromptTasks`, `collectPrepromptRequestFiles`, `openGrokRouterFolder`, `listGrokAccountsSafe`, `broadcastPipelineLogVisibility`, `sendProjectMenuCommand`, `buildAppMenu`, `getPipelineLogVisibility`, `openWebLogin`, `normalizeWebProvider`, `closeChromeDebug`, `ensureChromeDebug`, `isChromeDebugReady`, `openCdpTab`, `findChromeExecutable`, `chooseFolder`, `scanFolder`, `collectFromDir`, `getSceneNumber`, `extractLastFrameToPathHandler`, `extractLastFrame`, `extractLastFrameFromVideo`, `getContinuityReferenceDir`, `formatFfmpegTimestamp`, `probeVideoDurationSeconds`, `extractLastFrameToPath`, `getSceneMediaPaths`, `isTemporaryDownloadPath`, `waitForStableFileSize`, `validateLocalVideoFile`, `copyImageToClipboard`, `getPreviousFrame`, `mergeVideos`, `exportFinalVideo`, `mergeVideoFiles`, `runFfmpeg`, `splitPromptWithAI`, `readJsonResponse`, `parseJsonFromModel`, `generateScenePrompts`, `chooseOutputFolder`, `chooseProjectRootFolder`, `checkWebLogin`, `clearProviderSession`, `sendPromptViaWeb`, `isValidChatGptConversationUrl`, `openFreshChatGptRootPage`, `assertChatGptNotExistingConversation`, `summarizeGrokGenerationError`, `waitForGrokImagineReady`, `sanitizeGrokUrlForLog`, `isGrokImagineAgentUrl`, `isGrokImagineReadyRoute`, `getGrokRouteState`, `waitForGrokImagineAgentReady`, `forceGrokNormalImagineVideoMode`, `visible`, `textOf`, `ensureGrokImagineAgentPage`, `assertGrokImagineAgentReady`, `closeGrokTemplateModal`, `validateGeneratedVideoFile`, `visible`, `textOf`, `clickByText`, `getCdpPage`, `closeUnexpectedProviderTabs`, `forceGrokNormalImagineMode`, `textOf`, `ensureGrokEmptyCanvas`, `collectExistingProjectVideos`, `restoreProjectKeyframesToChatGPT`, `waitForGrokUploadSettled`, `summarizeGrokSendState`, `waitForGrokSendPreflight`, `clickGrokSendButtonOnce`, `clearGrokCanvasSelection`, `buildGrokSafeMotionPrompt`, `recoverGrokAfterContentPolicy`, `recoverGrokCanvasAfterLimit`, `addMediaFileToGrokCanvas`, `labelGrokCanvas`, `clearGrokCanvasChat`, `confirmGrokVideoGenerationIfAsked`, `sendGrokConfirmationText`, `waitForCdpAssistantResponse`, `waitForNewImageUrl`, `selectChatGptConversationByTitle`, `norm`, `getChatTitleStableKey`, `markChatTitleStable`, `isChatTitleStable`, `renameChatGptCurrentConversation`, `waitForNewVideoUrl`, `downloadBrowserAsset`, `captureLatestImageElement`, `checkAssetExists`, `getAssetStat`, `waitForGrokUploadedAsset`, `clickGrokUploadAndChooseFile`, `handler`, `setFirstFileInput`, `uploadFileViaCdp`, `pasteImageViaClipboard`, `submitPixVersePrompt`, `submitGrokVideoPrompt`, `pressEnterToSubmit`, `sleep`, `onCancel`, `downloadAssetInPageScript`, `fillProviderLoginScript`, `textOf`, `visible`, `setValue`, `clickButton`, `detectVideoCapabilityScript`, `getPromptInputCandidates`, `clickChatGptStartNewChatScript`, `fold`, `visible`, `collectVideoUrlsScript`, `detectGrokPageFailureScript`, `visible`, `getGrokReadyStateScript`, `visible`, `getGrokRouteStateScript`, `visible`, `textOf`, `detectGrokTemplateModalScript`, `closeGrokTemplateModalScript`, `textOf`, `visible`, `getGrokTemplateViewportFallbackPointsScript`, `visible`, `textOf`, `scanGrokTemplateModalScript`, `visible`, `textOf`, `selectGrokPhotoVideoTemplateScript`, `visible`, `textOf`, `forceHideGrokTemplateModalScript`, `visible`, `prepareGrokVideoComposerScript`, `sleep`, `textOf`, `visible`, `clickNode`, `findClickable`, `clickExact`, `preparePixVerseComposerScript`, `textOf`, `visible`, `clickByText`, `setPixVersePromptScript`, `setGrokComposerTextScript`, `visible`, `focusGrokComposerScript`, `labelGrokCanvasScript`, `clearGrokCanvasChatScript`, `clickGrokUploadImageMenuItemScript`, `clickGrokCanvasUploadImageScript`, `focusGrokWorkspaceScript`, `setGrokVideoPromptScript`, `detectGrokConfirmationQuestionScript`, `getGrokSendPreflightScript`, `visible`, `boxOf`, `textOf`, `normalize`, `detectGrokUploadStateScript`, `clickGrokComposerAreaScript`, `visible`, `dismissGrokConnectorsScript`, `textOf`, `visible`, `forceGrokVideoModeScript`, `textOf`, `visible`, `captureGrokSubmitStateScript`, `detectGrokGeneratingStateScript`, `detectGrokGenerationProblemScript`, `clickGrokRetryButton`, `clickGrokGenerateScript`, `clickPixVerseCreateScript`, `readLatestAssistantScript`, `visible`, `readAssistantAfterIndexScript`, `visible`, `findChatGptConversationScript`, `normalize`, `runVeoUpAutomation`, `exportProject`, `getVeoUpCoordinateConfigHandler`, `startVeoUpCoordinateSetupHandler`, `captureVeoUpCoordinateHandler`, `saveVeoUpCoordinateConfigHandler`, `deleteVeoUpCoordinateConfigHandler`, `cancelVeoUpCoordinateSetupHandler`, `scanProjectAndRunVeoUpHandler`
* **Approximate Responsibility**:
  * Configure Electron window options
  * Initialize IPC listeners
  * Manage browser profile directories
* **Dependencies**: `child_process`, `electron/main/logging/index.js`, `electron/main/utils/index.js`, `electron/main/memory/index.js`, `electron/main/state/index.js`, `electron/main/state/chatgpt_state.js`, `electron/main/chatgpt/chatgpt_dom.js`, `electron/main/chatgpt/chatgpt_core.js`, `electron/main/chatgpt/browser_adapter.js`, `electron/main/chatgpt/chatgpt_upload.js`, `electron/main/chatgpt/chatgpt_send.js`, `electron/main/chatgpt/chatgpt_recovery.js`, `electron/main/bootstrap/index.js`, `electron/main/ipc/index.js`, `electron/main/chatgpt/index.js`, `electron/main/recovery/index.js`, `electron`, `ffmpeg-static`, `fs/promises`, `path`, `crypto`, `async_hooks`, `electron/main/veoup/index.js`, `electron/main/pipeline/index.js`, `./chatgptStability`, `fs`, `chrome-remote-interface`
* **Who imports this file**: *None*

### [preload.js](file:///d:/bac_tai/Grok-bac-Tai/electron/preload.js)

* **Relative Path**: `electron/preload.js`
* **Purpose**: IPC bridge between Main and Renderer processes.
* **Exported Symbols**: *None*
* **Imported Symbols**: `electron`
* **Classes**: *None*
* **Functions**: `listener`, `listener`, `listener`, `listener`
* **Approximate Responsibility**:
  * Expose secure API functions to renderer process
  * Sanitize context communication
* **Dependencies**: `electron`
* **Who imports this file**: *None*

### [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)

* **Relative Path**: `electron/renderer.js`
* **Purpose**: Main UI behavior and orchestration.
* **Exported Symbols**: *None*
* **Imported Symbols**: *None*
* **Classes**: *None*
* **Functions**: `normalizeSceneDuration`, `applySceneDurationValue`, `getReviewSettings`, `shouldSkipReview`, `applyReviewSettings`, `isKeyframeMotionPromptOnlyModeEnabled`, `applyPipelineModeSettings`, `getContinuityReferenceSettings`, `applyContinuityReferenceSettings`, `getGrokRecoverySettings`, `applyGrokRecoverySettings`, `getChatGptStabilitySettings`, `applyChatGptStabilitySettings`, `getProjectTargetSceneDefault`, `syncTargetSceneCountToProjectDefault`, `buildRecentScenesForHydration`, `getImageGenerationSettings`, `applyImageGenerationSettings`, `embedRouterPanelInSettings`, `moveProjectActionsOutsideSettings`, `openSettingsDialog`, `saveSettingsDialog`, `createPipelineRunId`, `getActivePipelineRunId`, `isPipelineRunActive`, `makePipelineCancelledError`, `assertPipelineRunActive`, `clearPipelineTimers`, `hasPipelineTimers`, `pipelineDelay`, `sleep`, `schedulePipelineTimer`, `updateStopPipelineControls`, `beginPipelineRun`, `finishPipelineRun`, `isPipelineCancelledError`, `stopPipelineFromClick`, `queueAutoContinue`, `createProject`, `parseScenes`, `runNextBatch`, `syncProjectSceneFolders`, `generateWithProvider`, `buildImagePrompt`, `buildMotionPrompt`, `approveBatch`, `pauseRun`, `resumeRun`, `findFirstIncompleteSceneForWorkflow`, `recoverWorkflowRun`, `openChatGptWindow`, `openFreshChatGptWindow`, `clearChatGptCache`, `openWebLogin`, `chooseOutputFolder`, `importCharacterPresetsFlow`, `checkSelectedWebLogin`, `sendCurrentBatchViaWeb`, `ensureChatChoiceFields`, `shouldAskChatGptChatChoice`, `requireChatGptChatChoiceBeforeRun`, `getSceneVideoPathValue`, `getSceneKeyframePathValue`, `hasValidSceneOutputPath`, `sceneHasRequiredOutputForCurrentMode`, `findFirstIncompleteSceneBefore`, `shouldBlockSceneBecausePreviousVideoMissing`, `safeAddPipelineLog`, `sceneHasVideoOutput`, `findFirstSceneMissingVideo`, `forceResumeFirstIncompleteSceneIfNeeded`, `getCompletedScenesCount`, `getNextBatchForSegment`, `runFullPipeline`, `isSceneCompleteForVeoUp`, `isProjectCompleteForVeoUp`, `maybeRunVeoUpAutomationAfterPipeline`, `getSelectedWebProvider`, `getSelectedVideoPlatform`, `getSelectedVideoAccount`, `getVideoProviderConfig`, `syncVideoPlatformConfig`, `estimatePixVerseEnergy`, `isPixVerseProConfig`, `suggestPixVerseConfig`, `updatePixVerseConfigAdvice`, `waitForProviderReady`, `isRetryableChatGptWorkflowError`, `parseLoginRequiredError`, `recoverLoginAndRetryScene`, `startPipelineFromClick`, `autoRunRoute`, `norm`, `exportProject`, `buildCsv`, `render`, `handleTableClick`, `openEditor`, `saveEdit`, `copyText`, `setStatus`, `summarizeLogDetails`, `appendPipelineLog`, `showPipelineNotice`, `formatPipelineLogsForCopy`, `copyPipelineLog`, `renderPipelineLog`, `setPipelineLogVisible`, `loadTextFileToTextarea`, `setRunning`, `statusLabel`, `renderAssetReview`, `renderImagePreview`, `renderVideoPreview`, `getCurrentReviewScene`, `isReviewable`, `openAssetReview`, `renderAssetReviewModal`, `renderFocusedMedia`, `setReviewZoom`, `handleReviewWheelZoom`, `isAssetReviewOpen`, `startReviewPan`, `moveReviewPan`, `stopReviewPan`, `handleReviewShortcut`, `releaseReviewShortcut`, `approveCurrentReviewScene`, `regenerateCurrentReviewScene`, `escapeHtml`, `fileUrl`, `mergeAndShowFinalPreview`, `renderFinalPreview`, `clamp`, `getGrokRouterSettings`, `renderGrokRouterStatus`, `refreshGrokRouterStatus`, `getSelectedText`, `getSceneRef`, `isVideoCompleteForResume`, `hasKeyframeForResume`, `findSceneByRuntimeRef`, `normalizeActiveBatchIdsForRuntime`, `getOrderedResumeScenes`, `getNextResumeAction`, `getCurrentResumeScene`, `getRuntimeSnapshot`, `getSceneFileRecord`, `getPreviewTimeline`, `getProjectAssets`, `getCurrentSceneRef`, `stripObsoleteProjectModeFields`, `getRouterMetadata`, `getProjectSessionPayload`, `normalizeRendererScene`, `normalizeProjectSessionForRenderer`, `setControlValue`, `migrateProjectAssetPathsToOutputFolder`, `applyProjectSessionPayload`, `renderProjectSessionStatus`, `markProjectDirty`, `confirmUnsavedProjectAction`, `openChatResolveDialog`, `closeChatResolveDialog`, `resolveChatAndContinue`, `forceCloseNewProjectDialog`, `createBlankProjectFromName`, `createInitialProjectFileInOutputFolder`, `newProjectSessionFlow`, `submitNewProjectDialog`, `saveProjectSessionFlow`, `openProjectSessionFlow`, `persist`, `reconcileSavedAssets`, `missingPath`, `statPath`, `saveSessionForNextLaunch`, `restore`, `ensureHardPromptFilePickerUi`, `refreshLabel`, `updateVeoUpSetupUI`, `updateScanButtonVisibility`, `setStepActive`, `runCalibrationLoop`, `cleanupSetupUI`
* **Approximate Responsibility**:
  * Render scene timeline grids
  * Process user clicks and start pipeline
  * Listen for IPC updates
* **Dependencies**: *None*
* **Who imports this file**: *None*

### [index.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/index.js)

* **Relative Path**: `electron/main/index.js`
* **Purpose**: Main exports rollup.
* **Exported Symbols**: `chatgpt`, `pipeline`, `recovery`, `state`, `utils`, `logging`, `memory`
* **Imported Symbols**: `electron/main/chatgpt/index.js`, `electron/main/pipeline/index.js`, `electron/main/recovery/index.js`, `electron/main/state/index.js`, `electron/main/utils/index.js`, `electron/main/logging/index.js`, `electron/main/memory/index.js`
* **Classes**: *None*
* **Functions**: *None*
* **Approximate Responsibility**:
  * Rollup exports of main process submodules
* **Dependencies**: `electron/main/chatgpt/index.js`, `electron/main/pipeline/index.js`, `electron/main/recovery/index.js`, `electron/main/state/index.js`, `electron/main/utils/index.js`, `electron/main/logging/index.js`, `electron/main/memory/index.js`
* **Who imports this file**: *None*

### [index.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/bootstrap/index.js)

* **Relative Path**: `electron/main/bootstrap/index.js`
* **Purpose**: Bootstrap module rollup.
* **Exported Symbols**: `initBootstrap`, `initializeApplication`, `createMainWindow`
* **Imported Symbols**: `electron/main/bootstrap/bootstrap.js`
* **Classes**: *None*
* **Functions**: *None*
* **Approximate Responsibility**:
  * Export bootstrap function
* **Dependencies**: `electron/main/bootstrap/bootstrap.js`
* **Who imports this file**: `electron/main.js`

### [bootstrap.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/bootstrap/bootstrap.js)

* **Relative Path**: `electron/main/bootstrap/bootstrap.js`
* **Purpose**: Application directory and files initialization.
* **Exported Symbols**: `initBootstrap`, `initializeApplication`, `createMainWindow`
* **Imported Symbols**: *None*
* **Classes**: *None*
* **Functions**: `initBootstrap`, `initializeApplication`, `createMainWindow`
* **Approximate Responsibility**:
  * Verify asset directories exist
  * Create fallback configs
* **Dependencies**: *None*
* **Who imports this file**: `electron/main/bootstrap/index.js`

### [index.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/index.js)

* **Relative Path**: `electron/main/chatgpt/index.js`
* **Purpose**: ChatGPT module rollup.
* **Exported Symbols**: `...require("./chatgpt_core")`, `...require("./chatgpt_dom")`, `...require("./chatgpt_send")`, `...require("./chatgpt_upload")`, `...require("./chatgpt_recovery")`, `...require("./chatgpt_pipeline")`, `chatGptRuntimeMonitor`, `ChatGptPipelineAdapter`
* **Imported Symbols**: `electron/main/chatgpt/chatgpt_core.js`, `electron/main/chatgpt/chatgpt_dom.js`, `electron/main/chatgpt/chatgpt_send.js`, `electron/main/chatgpt/chatgpt_upload.js`, `electron/main/chatgpt/chatgpt_recovery.js`, `electron/main/chatgpt/chatgpt_pipeline.js`, `electron/main/chatgpt/chatgpt_runtime_monitor.js`, `electron/main/chatgpt/chatgpt_pipeline_adapter.js`
* **Classes**: *None*
* **Functions**: *None*
* **Approximate Responsibility**:
  * Export ChatGPT pipeline and automation adapters
* **Dependencies**: `electron/main/chatgpt/chatgpt_core.js`, `electron/main/chatgpt/chatgpt_dom.js`, `electron/main/chatgpt/chatgpt_send.js`, `electron/main/chatgpt/chatgpt_upload.js`, `electron/main/chatgpt/chatgpt_recovery.js`, `electron/main/chatgpt/chatgpt_pipeline.js`, `electron/main/chatgpt/chatgpt_runtime_monitor.js`, `electron/main/chatgpt/chatgpt_pipeline_adapter.js`
* **Who imports this file**: `electron/main.js`, `electron/main/index.js`, `electron/main/pipeline/pipeline_runner.js`

### [browser_adapter.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/browser_adapter.js)

* **Relative Path**: `electron/main/chatgpt/browser_adapter.js`
* **Purpose**: Abstraction for Playwright / CDP browser instances.
* **Exported Symbols**: `BrowserAdapter`
* **Imported Symbols**: `electron/main/logging/index.js`, `playwright-core`
* **Classes**: `BrowserAdapter`
* **Functions**: `constructor`, `on`, `off`, `connect`, `evaluate`, `setInputFiles`, `disconnect`, `close`
* **Approximate Responsibility**:
  * Spawn browser process
  * Attach to active tab
* **Dependencies**: `electron/main/logging/index.js`, `playwright-core`
* **Who imports this file**: `electron/main.js`

### [chatgpt_core.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_core.js)

* **Relative Path**: `electron/main/chatgpt/chatgpt_core.js`
* **Purpose**: Core evaluate wrapper for browser integration.
* **Exported Symbols**: `getChatGptSendState`, `getConversationState`, `waitForCdpLoad`, `evaluateOnCdpPage`
* **Imported Symbols**: `electron/main/logging/index.js`, `electron/main/utils/index.js`, `electron/main/chatgpt/chatgpt_dom.js`
* **Classes**: *None*
* **Functions**: `getChatGptSendState`, `getConversationState`, `waitForCdpLoad`, `evaluateOnCdpPage`, `__safe`, `runEvaluate`, `__safe`
* **Approximate Responsibility**:
  * Safe injection of scripts into page
  * Wrap Playwright selectors
* **Dependencies**: `electron/main/logging/index.js`, `electron/main/utils/index.js`, `electron/main/chatgpt/chatgpt_dom.js`
* **Who imports this file**: `electron/main.js`, `electron/main/chatgpt/index.js`, `electron/main/chatgpt/chatgpt_pipeline.js`, `electron/main/chatgpt/chatgpt_recovery.js`, `electron/main/chatgpt/chatgpt_send.js`, `electron/main/chatgpt/chatgpt_upload.js`

### [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)

* **Relative Path**: `electron/main/chatgpt/chatgpt_dom.js`
* **Purpose**: ChatGPT DOM selector mappings and mutation monitors.
* **Exported Symbols**: `clickChatGptStartNewChatScript`, `sendPromptScript`, `clickSendButtonScript`, `inspectAndClickChatGptSendButtonSafely`, `inspectAndClickChatGptSendButton`, `forceSubmitChatGptComposerScript`, `dispatchNv2ComposerInputEventsScript`, `clearNv2ComposerScript`, `deepFocusNv2ComposerScript`, `setPromptInputValueScript`, `focusPromptInputScript`, `detectLoginScript`, `countAssistantMessagesScript`, `detectBrowserCrashPageScript`, `dismissChatGptBlockingUiScript`, `detectChatGptResponseChoiceUiScript`, `detectChatGptActiveGenerationScript`, `detectChatGptActiveGenerationScriptStrict`, `getComposerTextScript`, `getActiveComposerTextScript`, `inspectNv2ComposerSubmitStateScript`, `countChatGptAssistantRootsScript`, `getConversationStateScript`, `clickChatGptStopGeneratingScript`, `readChatGptImageStateScript`, `detectUploadedAssetScript`, `clickUploadButtonScript`, `prepareChatGptCreateImageScript`, `readAssistantMessageSnapshotScript`, `readLatestAssistantScript`, `extractConversationSnapshot`
* **Imported Symbols**: *None*
* **Classes**: *None*
* **Functions**: `detectLoginScript`, `detectBrowserCrashPageScript`, `dismissChatGptBlockingUiScript`, `textOf`, `fold`, `isUnsafeDismissTarget`, `isExactDismissText`, `visible`, `clickNode`, `detectChatGptResponseChoiceUiScript`, `visible`, `detectChatGptActiveGenerationScript`, `visible`, `detectChatGptActiveGenerationScriptStrict`, `visible`, `nearComposer`, `getComposerTextScript`, `getActiveComposerTextScript`, `inspectNv2ComposerSubmitStateScript`, `normalize`, `visible`, `nearComposer`, `clickChatGptStopGeneratingScript`, `clickUploadButtonScript`, `visible`, `textOf`, `detectUploadedAssetScript`, `focusPromptInputScript`, `setPromptInputValueScript`, `deepFocusNv2ComposerScript`, `visible`, `clearNv2ComposerScript`, `dispatchNv2ComposerInputEventsScript`, `forceSubmitChatGptComposerScript`, `norm`, `visible`, `isSendButton`, `inspectAndClickChatGptSendButton`, `inspectAndClickChatGptSendButtonSafely`, `norm`, `visible`, `labelOf`, `isStopButton`, `isRejectedToolButton`, `isStrictSendButton`, `extractNodeInfo`, `getActiveButtonType`, `sleepMs`, `clickSendButtonScript`, `sendPromptScript`, `clickChatGptStartNewChatScript`, `fold`, `visible`, `prepareChatGptCreateImageScript`, `textOf`, `visible`, `clickNode`, `extractConversationSnapshot`, `visible`, `hashText`, `readStableId`, `readAssistantText`, `nearComposerButton`, `createOptimizedWrapper`, `fn`
* **Approximate Responsibility**:
  * Observe chat state changes
  * Extract text responses
* **Dependencies**: *None*
* **Who imports this file**: `electron/main.js`, `electron/main/chatgpt/index.js`, `electron/main/chatgpt/chatgpt_core.js`, `electron/main/chatgpt/chatgpt_pipeline.js`, `electron/main/chatgpt/chatgpt_recovery.js`, `electron/main/chatgpt/chatgpt_runtime_monitor.js`, `electron/main/chatgpt/chatgpt_send.js`, `electron/main/chatgpt/chatgpt_upload.js`

### [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)

* **Relative Path**: `electron/main/chatgpt/chatgpt_pipeline.js`
* **Purpose**: ChatGPT orchestration pipeline for prompting, images, and motion.
* **Exported Symbols**: `initChatGptPipeline`, `generateImageAndMotionWithChatGPT`, `generateMotionPromptWithChatGPT`, `generateMotionPromptWithChatGPTOnce`, `validateMotionPromptResponse`, `sanitizeAssetUrlForLog`, `startChatGptImageNetworkCapture`, `tryExtractChatGptNetworkImage`, `chatGptImageCandidateSignature`, `countVisibleChatGptImageCandidates`, `hasVisibleChatGptImageCandidate`, `classifyChatGptImageReadiness`, `captureChatGptImageElementScreenshot`, `saveChatGPTGeneratedImageAsset`, `isLikelyChatGptLoadingPlaceholderImage`, `isPreferredChatGptRealImageAsset`, `isFalseChatGptImageGeneratingState`, `refreshChatGptPageBeforeImageExtract`, `waitForChatGptImageGenerationDoneBeforeExtract`, `waitForLatestChatGPTGeneratedImage`, `extractLatestChatGPTGeneratedImageBytes`, `decodeImageBufferToPng`, `validateSavedImageFile`, `collectGeneratedImageUrlsScript`, `checkExistingCompletedImageScript`, `ensureChatGptImageLoadedAndHydratedScript`, `adoptExistingSceneImage`, `extractLatestChatGPTGeneratedImageBytesScript`, `getChatGptImageCandidateBoxScript`, `getLatestImageBoxScript`, `waitForChatGptImageOrRetry`, `waitForChatGptResponse`, `maybeRenameChatGptCurrentConversationUntilTitle`, `renameChatGptCurrentConversationUntilTitle`, `waitForChatGptRecentItem`, `checkChatGptCurrentConversationTitle`, `getChatTitleStableKey`, `markChatTitleStable`, `isChatTitleStable`, `sanitizeChatTitleForLog`, `clearAllChatGptPipelineLocks`, `hydrateFreshChatGptContextAfterRotation`
* **Imported Symbols**: `electron`, `fs/promises`, `path`, `electron/main/chatgpt/chatgpt_runtime_monitor.js`, `electron/main/chatgpt/chatgpt_pipeline_adapter.js`, `electron/main/logging/index.js`, `electron/main/utils/index.js`, `electron/main/memory/index.js`, `electron/main/state/index.js`, `electron/main/state/chatgpt_state.js`, `electron/main/chatgpt/chatgpt_dom.js`, `electron/main/chatgpt/chatgpt_core.js`, `electron/main/chatgpt/chatgpt_send.js`, `electron/main/chatgpt/chatgpt_upload.js`, `../../chatgptStability`, `electron/main/chatgpt/chatgpt_recovery.js`, `electron/main/recovery/index.js`, `electron/main/chatgpt/chatgpt_pipeline_adapter.js`, `electron/main/chatgpt/chatgpt_runtime_monitor.js`
* **Classes**: *None*
* **Functions**: `isPipelineCancelledError`, `initChatGptPipeline`, `sleep`, `sanitizeAssetUrlForLog`, `startChatGptImageNetworkCapture`, `isLikelyImage`, `onResponse`, `onFinished`, `candidates`, `summary`, `stop`, `tryExtractChatGptNetworkImage`, `chatGptImageCandidateSignature`, `countVisibleChatGptImageCandidates`, `hasVisibleChatGptImageCandidate`, `saveChatGPTGeneratedImageAsset`, `isLikelyChatGptLoadingPlaceholderImage`, `isPreferredChatGptRealImageAsset`, `isFalseChatGptImageGeneratingState`, `refreshChatGptPageBeforeImageExtract`, `waitForLatestChatGPTGeneratedImage`, `resendImagePrompt`, `extractLatestChatGPTGeneratedImageBytes`, `decodeImageBufferToPng`, `validateSavedImageFile`, `collectGeneratedImageUrlsScript`, `checkExistingCompletedImageScript`, `findAssistantMessageWithImage`, `verifyImg`, `verifyCanvas`, `hasPlaceholder`, `ensureChatGptImageLoadedAndHydratedScript`, `findAssistantMessageWithImage`, `findTarget`, `verifyImg`, `verifyCanvas`, `hasPlaceholder`, `tryClickScrollBtn`, `adoptExistingSceneImage`, `findTargetAssistant`, `verifyImg`, `verifyCanvas`, `sanitizeUrl`, `rectInfo`, `isVisible`, `nodeText`, `hasSpinner`, `sourceFromSrcset`, `rootsFrom`, `toRoots`, `dedupeRoots`, `addElementId`, `pushUrlCandidate`, `readBlobBase64`, `getChatGptImageCandidateBoxScript`, `getLatestImageBoxScript`, `isImageNode`, `resendImagePrompt`, `waitForChatGptResponse`, `retryMotionPrompt`, `maybeRenameChatGptCurrentConversationUntilTitle`, `renameChatGptCurrentConversationUntilTitle`, `waitForChatGptRecentItem`, `checkChatGptCurrentConversationTitle`, `norm`, `getChatTitleStableKey`, `markChatTitleStable`, `isChatTitleStable`, `sanitizeChatTitleForLog`, `isValidChatGptConversationUrl`, `clearAllChatGptPipelineLocks`
* **Approximate Responsibility**:
  * Loop through scene inputs
  * Submit image generation prompts
  * Wait for keyframe readiness
* **Dependencies**: `electron`, `fs/promises`, `path`, `electron/main/chatgpt/chatgpt_runtime_monitor.js`, `electron/main/chatgpt/chatgpt_pipeline_adapter.js`, `electron/main/logging/index.js`, `electron/main/utils/index.js`, `electron/main/memory/index.js`, `electron/main/state/index.js`, `electron/main/state/chatgpt_state.js`, `electron/main/chatgpt/chatgpt_dom.js`, `electron/main/chatgpt/chatgpt_core.js`, `electron/main/chatgpt/chatgpt_send.js`, `electron/main/chatgpt/chatgpt_upload.js`, `../../chatgptStability`, `electron/main/chatgpt/chatgpt_recovery.js`, `electron/main/recovery/index.js`, `electron/main/chatgpt/chatgpt_pipeline_adapter.js`, `electron/main/chatgpt/chatgpt_runtime_monitor.js`
* **Who imports this file**: `electron/main/chatgpt/index.js`

### [chatgpt_pipeline_adapter.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline_adapter.js)

* **Relative Path**: `electron/main/chatgpt/chatgpt_pipeline_adapter.js`
* **Purpose**: Adapter between pipeline and browser pages.
* **Exported Symbols**: `ChatGptPipelineAdapter`
* **Imported Symbols**: *None*
* **Classes**: `ChatGptPipelineAdapter`
* **Functions**: `constructor`, `waitForImageReady`, `waitForResponseReady`, `isDraftRecovered`
* **Approximate Responsibility**:
  * Format inputs for pipeline consumption
* **Dependencies**: *None*
* **Who imports this file**: `electron/main/chatgpt/index.js`, `electron/main/chatgpt/chatgpt_pipeline.js`

### [chatgpt_recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_recovery.js)

* **Relative Path**: `electron/main/chatgpt/chatgpt_recovery.js`
* **Purpose**: ChatGPT login and tab recovery flows.
* **Exported Symbols**: `forceCleanChatGptNewChatRotation`, `isChatGptRequestRotationEligible`, `initChatGptRecovery`, `isReloadBlocked`, `requestReloadWithReason`, `performDurableRecovery`, `detectLoginWithRetry`, `recoverCdpPageIfCrashed`, `recoverProviderFromCacheOrChallenge`, `recoverChatGptBlockingUi`, `recoverChatGptResponseChoiceChat`
* **Imported Symbols**: `electron/main/logging/index.js`, `electron/main/utils/index.js`, `electron/main/chatgpt/chatgpt_core.js`, `electron/main/chatgpt/chatgpt_dom.js`, `electron/main/chatgpt/chatgpt_upload.js`, `electron/main/chatgpt/chatgpt_send.js`, `electron/main/state/index.js`, `electron/main/state/chatgpt_state.js`, `chrome-remote-interface`
* **Classes**: *None*
* **Functions**: `getCdpPage`, `tryAutoLoginWithStoredAccount`, `closeUnexpectedProviderTabs`, `invalidateChatGptConversationIdentity`, `resetSessionSceneCounter`, `assertPipelineRunActive`, `shouldRecoverFromCacheOrChallenge`, `initChatGptRecovery`, `isReloadBlocked`, `requestReloadWithReason`, `performDurableRecovery`, `isCdpCrashError`, `detectLoginWithRetry`, `recoverChatGptBlockingUi`, `recoverChatGptResponseChoiceChat`, `forceCleanChatGptNewChatRotation`, `isChatGptRequestRotationEligible`
* **Approximate Responsibility**:
  * Reload broken tabs
  * Clear annoying overlay popups
* **Dependencies**: `electron/main/logging/index.js`, `electron/main/utils/index.js`, `electron/main/chatgpt/chatgpt_core.js`, `electron/main/chatgpt/chatgpt_dom.js`, `electron/main/chatgpt/chatgpt_upload.js`, `electron/main/chatgpt/chatgpt_send.js`, `electron/main/state/index.js`, `electron/main/state/chatgpt_state.js`, `chrome-remote-interface`
* **Who imports this file**: `electron/main.js`, `electron/main/chatgpt/index.js`, `electron/main/chatgpt/chatgpt_pipeline.js`

### [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)

* **Relative Path**: `electron/main/chatgpt/chatgpt_runtime_monitor.js`
* **Purpose**: Monitors ChatGPT page actions in real-time.
* **Exported Symbols**: `globalThis`
* **Imported Symbols**: `events`, `electron/main/logging/index.js`, `electron/main/chatgpt/chatgpt_dom.js`
* **Classes**: `ChatGPTRuntimeMonitor`
* **Functions**: `hashText`, `constructor`, `reset`, `startMonitoring`, `getReqId`, `stopMonitoring`, `getCurrentState`, `getHealth`, `getDiagnostics`, `captureSnapshot`, `setIntentOverride`, `replay`, `subscribe`, `waitUntil`, `cleanup`, `checkCondition`, `waitForTransition`, `cleanup`, `checkTransition`, `waitForIntent`, `cleanup`, `checkIntent`, `waitForSignal`, `cleanup`, `checkSignal`, `onResponseReceived`, `onLoadingFinished`, `onBindingCalled`, `onConsoleAPICalled`, `onExceptionThrown`, `onFrameNavigated`, `processIncomingEvent`, `clearStabilityTimer`, `scheduleStateReevaluation`, `triggerStateUpdate`, `runIntentDetector`, `runStateMachine`, `computeConfidence`, `manageWatchdogs`, `clearAllWatchdogs`, `logEvent`, `getBrowserScriptCode`, `emitEvent`, `collectMetrics`, `triggerDebounce`, `wrapHistory`
* **Approximate Responsibility**:
  * Track console logs
  * Monitor network requests for failures
* **Dependencies**: `events`, `electron/main/logging/index.js`, `electron/main/chatgpt/chatgpt_dom.js`
* **Who imports this file**: `electron/main/chatgpt/index.js`, `electron/main/chatgpt/chatgpt_pipeline.js`, `electron/main/chatgpt/chatgpt_send.js`

### [chatgpt_send.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_send.js)

* **Relative Path**: `electron/main/chatgpt/chatgpt_send.js`
* **Purpose**: Handles textual typing and input submission to ChatGPT.
* **Exported Symbols**: `initChatGptSend`, `isLikelyChatGptSendButtonText`, `clickSendButtonViaCdp`, `forceClickChatGptComposerSubmit`, `waitForHeavyChatGptPromptDomCooldown`, `runChatGptRobustSendLadder`, `forceSubmitChatGptComposerWithCdp`, `sendPromptViaCdpInput`, `waitForChatGptComposerIdle`, `waitForPromptSendAcknowledged`, `sendPromptViaCdpInputSingle`, `focusNv2ComposerWithCdp`, `waitForNv2GenerationStartGuard`, `sendNv2PromptViaDeepCdpInput`, `vidoraReadChatGptComposerStateReal`, `vidoraClickChatGptRealSendButton`, `vidoraChatGptInputGate`, `vidoraClearChatGptInputBeforePaste`
* **Imported Symbols**: `electron/main/logging/index.js`, `electron/main/utils/index.js`, `electron/main/state/index.js`, `electron/main/chatgpt/chatgpt_core.js`, `electron/main/chatgpt/chatgpt_dom.js`, `electron/main/chatgpt/chatgpt_runtime_monitor.js`, `electron/main/chatgpt/chatgpt_runtime_monitor.js`
* **Classes**: *None*
* **Functions**: `setChatGptSendState`, `assertPipelineRunActive`, `initChatGptSend`, `isLikelyChatGptSendButtonText`, `clickSendButtonViaCdp`, `forceClickChatGptComposerSubmit`, `waitForHeavyChatGptPromptDomCooldown`, `sendPromptViaCdpInput`, `sendPromptViaCdpInputSingle`, `focusNv2ComposerWithCdp`, `sendNv2PromptViaDeepCdpInput`, `vidoraReadChatGptComposerStateReal`, `norm`, `vidoraClickChatGptRealSendButton`, `vidoraChatGptInputGate`, `vidoraClearChatGptInputBeforePaste`
* **Approximate Responsibility**:
  * Inject text into prompt textbox
  * Click submit button
* **Dependencies**: `electron/main/logging/index.js`, `electron/main/utils/index.js`, `electron/main/state/index.js`, `electron/main/chatgpt/chatgpt_core.js`, `electron/main/chatgpt/chatgpt_dom.js`, `electron/main/chatgpt/chatgpt_runtime_monitor.js`, `electron/main/chatgpt/chatgpt_runtime_monitor.js`
* **Who imports this file**: `electron/main.js`, `electron/main/chatgpt/index.js`, `electron/main/chatgpt/chatgpt_pipeline.js`, `electron/main/chatgpt/chatgpt_recovery.js`

### [chatgpt_upload.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_upload.js)

* **Relative Path**: `electron/main/chatgpt/chatgpt_upload.js`
* **Purpose**: Manages image/attachment uploading in ChatGPT composer.
* **Exported Symbols**: `initChatGptUpload`, `verifyAttachmentsReady`, `uploadFilesToChatGptSequentially`, `uploadFileToChatGptDirectly`
* **Imported Symbols**: `path`, `electron/main/logging/index.js`, `electron/main/utils/index.js`, `electron/main/chatgpt/chatgpt_dom.js`, `electron/main/chatgpt/chatgpt_core.js`
* **Classes**: *None*
* **Functions**: `setChatGptSendState`, `initChatGptUpload`, `verifyAttachmentsReady`, `uploadFileToChatGptDirectly`
* **Approximate Responsibility**:
  * Trigger file picker upload
  * Wait for attachments to settle
* **Dependencies**: `path`, `electron/main/logging/index.js`, `electron/main/utils/index.js`, `electron/main/chatgpt/chatgpt_dom.js`, `electron/main/chatgpt/chatgpt_core.js`
* **Who imports this file**: `electron/main.js`, `electron/main/chatgpt/index.js`, `electron/main/chatgpt/chatgpt_pipeline.js`, `electron/main/chatgpt/chatgpt_recovery.js`

### [debug.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/debug.js)

* **Relative Path**: `electron/main/chatgpt/debug.js`
* **Purpose**: Helper for debug prints and session logs.
* **Exported Symbols**: *None*
* **Imported Symbols**: `playwright`, `repl`
* **Classes**: *None*
* **Functions**: *None*
* **Approximate Responsibility**:
  * Format logs for stdout
* **Dependencies**: `playwright`, `repl`
* **Who imports this file**: *None*

### [index.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/ipc/index.js)

* **Relative Path**: `electron/main/ipc/index.js`
* **Purpose**: IPC module rollup.
* **Exported Symbols**: `...require("./ipc_handlers")`
* **Imported Symbols**: `electron/main/ipc/ipc_handlers.js`
* **Classes**: *None*
* **Functions**: *None*
* **Approximate Responsibility**:
  * Export IPC setup functions
* **Dependencies**: `electron/main/ipc/ipc_handlers.js`
* **Who imports this file**: `electron/main.js`

### [ipc_handlers.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/ipc/ipc_handlers.js)

* **Relative Path**: `electron/main/ipc/ipc_handlers.js`
* **Purpose**: IPC listener registry and message routing.
* **Exported Symbols**: `initIpcHandlers`
* **Imported Symbols**: *None*
* **Classes**: *None*
* **Functions**: `initIpcHandlers`
* **Approximate Responsibility**:
  * Route frontend requests to main handlers
* **Dependencies**: *None*
* **Who imports this file**: `electron/main/ipc/index.js`

### [index.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/logging/index.js)

* **Relative Path**: `electron/main/logging/index.js`
* **Purpose**: Logging module rollup.
* **Exported Symbols**: `logging`
* **Imported Symbols**: `electron/main/logging/logging.js`
* **Classes**: *None*
* **Functions**: *None*
* **Approximate Responsibility**:
  * Export loggers
* **Dependencies**: `electron/main/logging/logging.js`
* **Who imports this file**: `electron/main.js`, `electron/main/index.js`, `electron/main/chatgpt/browser_adapter.js`, `electron/main/chatgpt/chatgpt_core.js`, `electron/main/chatgpt/chatgpt_pipeline.js`, `electron/main/chatgpt/chatgpt_recovery.js`, `electron/main/chatgpt/chatgpt_runtime_monitor.js`, `electron/main/chatgpt/chatgpt_send.js`, `electron/main/chatgpt/chatgpt_upload.js`, `electron/main/memory/memory.js`, `electron/main/pipeline/pipeline_runner.js`, `electron/main/recovery/recovery.js`, `electron/main/utils/utils.js`, `electron/main/veoup/veoup.js`

### [logging.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/logging/logging.js)

* **Relative Path**: `electron/main/logging/logging.js`
* **Purpose**: File-based and console application logger.
* **Exported Symbols**: `__vidoraCompactConsoleArg`, `appendAppLog`, `getAppLogPath`, `writeCrashLog`, `vidoraTraceExit`, `vidoraCompactLogDetails`, `vidoraShouldThrottleLog`, `sanitizeLogString`, `sanitizeLogValue`, `sanitizeIpcValue`, `safeIpcHandler`, `maskRouterText`, `SECRET_KEY_PATTERN`, `SECRET_VALUE_PATTERN`, `EMAIL_PATTERN`, `LOG_URL_PATTERN`, `APP_LOG_FILE`, `VIDORA_CRASH_LOG`
* **Imported Symbols**: `electron`, `fs/promises`, `fs`, `path`
* **Classes**: *None*
* **Functions**: `__vidoraCompactConsoleArg`, `maskRouterText`, `sanitizeLogString`, `sanitizeLogValue`, `sanitizeIpcValue`, `safeIpcHandler`, `vidoraCompactLogDetails`, `vidoraShouldThrottleLog`, `appendAppLog`, `getAppLogPath`, `writeCrashLog`, `vidoraTraceExit`
* **Approximate Responsibility**:
  * Log application stages
  * Rotate local log files
* **Dependencies**: `electron`, `fs/promises`, `fs`, `path`
* **Who imports this file**: `electron/main/logging/index.js`

### [index.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/memory/index.js)

* **Relative Path**: `electron/main/memory/index.js`
* **Purpose**: Memory module rollup.
* **Exported Symbols**: `memory`
* **Imported Symbols**: `electron/main/memory/memory.js`
* **Classes**: *None*
* **Functions**: *None*
* **Approximate Responsibility**:
  * Export memory monitoring
* **Dependencies**: `electron/main/memory/memory.js`
* **Who imports this file**: `electron/main.js`, `electron/main/index.js`, `electron/main/chatgpt/chatgpt_pipeline.js`, `electron/main/pipeline/pipeline_runner.js`

### [memory.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/memory/memory.js)

* **Relative Path**: `electron/main/memory/memory.js`
* **Purpose**: Tracks memory utilization to avoid memory leaks.
* **Exported Symbols**: `getCdpPageMemoryMetrics`, `logMemoryMilestone`
* **Imported Symbols**: `electron`, `electron/main/logging/index.js`
* **Classes**: *None*
* **Functions**: `getCdpPageMemoryMetrics`, `logMemoryMilestone`, `formatBytes`, `formatDelta`
* **Approximate Responsibility**:
  * Garbage collect browser instances if usage is high
* **Dependencies**: `electron`, `electron/main/logging/index.js`
* **Who imports this file**: `electron/main/memory/index.js`

### [index.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/index.js)

* **Relative Path**: `electron/main/pipeline/index.js`
* **Purpose**: Pipeline module rollup.
* **Exported Symbols**: `...require("./pipeline_runner")`
* **Imported Symbols**: `electron/main/pipeline/pipeline_runner.js`
* **Classes**: *None*
* **Functions**: *None*
* **Approximate Responsibility**:
  * Export pipeline runner
* **Dependencies**: `electron/main/pipeline/pipeline_runner.js`
* **Who imports this file**: `electron/main.js`, `electron/main/index.js`

### [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)

* **Relative Path**: `electron/main/pipeline/pipeline_runner.js`
* **Purpose**: Closed-loop pipeline orchestrator running the main loop.
* **Exported Symbols**: `initPipelineRunner`, `runScenePipeline`, `runScenePipelineLocked`, `runScenePipelineLockedInternal`, `stopPipeline`, `cancelPipelineRun`, `registerPipelineWaiter`, `trackPipelineChildProcess`, `assertPipelineRunActive`, `isPipelineRunCancelled`, `isPipelineCancelledError`, `makePipelineCancelledError`, `getScopedPipelineRunId`, `prepareSceneContext`, `validateSceneVideoAndLastFrame`, `finalizeValidatedSceneVideo`, `checkIfAllScenesComplete`, `buildVeoUpPromptsReadyFile`, `isVeoUpStageError`, `readPipelineSceneState`, `writePipelineSceneState`, `persistDurableStage`, `assertDurableSceneSuccess`, `isSceneScopedFilePath`, `startNextSceneChatGptPrefetch`, `imageFileToDataUrl`, `pipelineCancellation`, `ensureContinuityReferencesForPreviousScene`, `buildContinuityPromptInstruction`, `appendContinuityGuidanceToMotionPrompt`, `buildImageMotionOnlyPipelineResult`, `resetSessionSceneCounter`
* **Imported Symbols**: `electron`, `async_hooks`, `fs/promises`, `path`, `electron/main/logging/index.js`, `electron/main/utils/index.js`, `electron/main/recovery/index.js`, `electron/main/memory/index.js`, `electron/main/state/index.js`, `electron/main/state/chatgpt_state.js`, `electron/main/chatgpt/index.js`, `electron/main/veoup/index.js`, `../../chatgptStability`
* **Classes**: *None*
* **Functions**: `initPipelineRunner`, `getScopedPipelineRunId`, `makePipelineCancelledError`, `isPipelineCancelledError`, `isPipelineRunCancelled`, `assertPipelineRunActive`, `registerPipelineWaiter`, `trackPipelineChildProcess`, `cleanup`, `cancelPipelineRun`, `stopPipeline`, `sanitizeScenePipelineResult`, `safeText`, `safePaths`, `runScenePipeline`, `checkIfAllScenesComplete`, `readPipelineSceneState`, `writePipelineSceneState`, `assertDurableSceneSuccess`, `isSceneScopedFilePath`, `prepareSceneContext`, `clearMismatchedPath`, `runScenePipelineLocked`, `runScenePipelineLockedInternal`, `startNextSceneChatGptPrefetch`, `imageFileToDataUrl`, `ensureContinuityReferencesForSceneVideo`, `ensureContinuityReferencesForPreviousScene`, `buildContinuityPromptInstruction`, `appendContinuityGuidanceToMotionPrompt`
* **Approximate Responsibility**:
  * Coordinate scene sequential processing
  * Trigger VeoUp and ChatGPT in sequence
* **Dependencies**: `electron`, `async_hooks`, `fs/promises`, `path`, `electron/main/logging/index.js`, `electron/main/utils/index.js`, `electron/main/recovery/index.js`, `electron/main/memory/index.js`, `electron/main/state/index.js`, `electron/main/state/chatgpt_state.js`, `electron/main/chatgpt/index.js`, `electron/main/veoup/index.js`, `../../chatgptStability`
* **Who imports this file**: `electron/main/pipeline/index.js`

### [index.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/recovery/index.js)

* **Relative Path**: `electron/main/recovery/index.js`
* **Purpose**: Recovery module rollup.
* **Exported Symbols**: `recovery`
* **Imported Symbols**: `electron/main/recovery/recovery.js`
* **Classes**: *None*
* **Functions**: *None*
* **Approximate Responsibility**:
  * Export global recovery utils
* **Dependencies**: `electron/main/recovery/recovery.js`
* **Who imports this file**: `electron/main.js`, `electron/main/index.js`, `electron/main/chatgpt/chatgpt_pipeline.js`, `electron/main/pipeline/pipeline_runner.js`

### [recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/recovery/recovery.js)

* **Relative Path**: `electron/main/recovery/recovery.js`
* **Purpose**: Durable recovery logic for application-wide crashes.
* **Exported Symbols**: `maybeResetChatGptPageForLongRun`, `maybeRotateChatGptConversation`, `getDurablePipelineBackoffMs`, `normalizeChatGptRetryText`, `isRetryableChatGptToolErrorText`, `isChatGptPolicyRefusalText`, `normalizeGrokResultRetryLimit`, `makeRetryableGrokGenerationError`, `isRetryableGrokGenerationError`, `shouldRecoverFromCacheOrChallenge`
* **Imported Symbols**: `electron/main/logging/index.js`
* **Classes**: *None*
* **Functions**: `maybeResetChatGptPageForLongRun`, `maybeRotateChatGptConversation`, `getDurablePipelineBackoffMs`, `normalizeChatGptRetryText`, `isRetryableChatGptToolErrorText`, `isChatGptPolicyRefusalText`, `normalizeGrokResultRetryLimit`, `makeRetryableGrokGenerationError`, `isRetryableGrokGenerationError`, `shouldRecoverFromCacheOrChallenge`
* **Approximate Responsibility**:
  * Dump crash dumps
  * Restore dirty projects
* **Dependencies**: `electron/main/logging/index.js`
* **Who imports this file**: `electron/main/recovery/index.js`

### [index.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/index.js)

* **Relative Path**: `electron/main/state/index.js`
* **Purpose**: State module rollup.
* **Exported Symbols**: `state`
* **Imported Symbols**: `electron/main/state/state.js`
* **Classes**: *None*
* **Functions**: *None*
* **Approximate Responsibility**:
  * Export global state
* **Dependencies**: `electron/main/state/state.js`
* **Who imports this file**: `electron/main.js`, `electron/main/index.js`, `electron/main/chatgpt/chatgpt_pipeline.js`, `electron/main/chatgpt/chatgpt_recovery.js`, `electron/main/chatgpt/chatgpt_send.js`, `electron/main/pipeline/pipeline_runner.js`

### [chatgpt_state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/chatgpt_state.js)

* **Relative Path**: `electron/main/state/chatgpt_state.js`
* **Purpose**: Isolated state for ChatGPT session tracking.
* **Exported Symbols**: `getChatGptContextFresh() {
    return chatGptContextFresh;`
* **Imported Symbols**: *None*
* **Classes**: *None*
* **Functions**: `getChatGptContextFresh`, `setChatGptContextFresh`
* **Approximate Responsibility**:
  * Store session tokens
* **Dependencies**: *None*
* **Who imports this file**: `electron/main.js`, `electron/main/chatgpt/chatgpt_pipeline.js`, `electron/main/chatgpt/chatgpt_recovery.js`, `electron/main/pipeline/pipeline_runner.js`

### [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)

* **Relative Path**: `electron/main/state/state.js`
* **Purpose**: Centralized runtime project and application state.
* **Exported Symbols**: `getPipelineStateFile`, `hashChatGptSnapshotText`, `normalizeChatTitleValue`, `normalizeChatGptPromptCompareText`, `getChatGptConversationIdFromPath`, `isSameChatTitle`, `verifyDraftOwnership`, `writeSceneSnapshot`, `readSceneSnapshot`, `writeActionJournal`, `readActionJournal`, `isChatGptActivelyGenerating`, `sanitizeChatGptImageSnapshot`, `isNv2SnapshotGenerationActive`, `extractCompletedNv2ResponseFromSnapshot`, `selectLatestCompletedAssistantMessage`, `selectNewAssistantMessageAfterBaseline`, `looksLikeCollapsedUserPrompt`, `isChatGptLimitText`, `isChatGptDotLoadingCanvasAsset`
* **Imported Symbols**: `fs/promises`, `path`, `electron/main/utils/index.js`
* **Classes**: *None*
* **Functions**: `getPipelineStateFile`, `hashChatGptSnapshotText`, `normalizeChatTitleValue`, `normalizeChatGptPromptCompareText`, `getChatGptConversationIdFromPath`, `isSameChatTitle`, `verifyDraftOwnership`, `writeSceneSnapshot`, `readSceneSnapshot`, `writeActionJournal`, `readActionJournal`, `isChatGptActivelyGenerating`, `sanitizeChatGptImageSnapshot`, `isNv2SnapshotGenerationActive`, `extractCompletedNv2ResponseFromSnapshot`, `selectLatestCompletedAssistantMessage`, `selectNewAssistantMessageAfterBaseline`, `afterCurrentNv2User`, `looksLikeCollapsedUserPrompt`, `isChatGptLimitText`, `isChatGptDotLoadingCanvasAsset`
* **Approximate Responsibility**:
  * Save and restore active projects
* **Dependencies**: `fs/promises`, `path`, `electron/main/utils/index.js`
* **Who imports this file**: `electron/main/state/index.js`

### [index.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/utils/index.js)

* **Relative Path**: `electron/main/utils/index.js`
* **Purpose**: Utilities rollup.
* **Exported Symbols**: `utils`
* **Imported Symbols**: `electron/main/utils/utils.js`
* **Classes**: *None*
* **Functions**: *None*
* **Approximate Responsibility**:
  * Export utility functions
* **Dependencies**: `electron/main/utils/utils.js`
* **Who imports this file**: `electron/main.js`, `electron/main/index.js`, `electron/main/chatgpt/chatgpt_core.js`, `electron/main/chatgpt/chatgpt_pipeline.js`, `electron/main/chatgpt/chatgpt_recovery.js`, `electron/main/chatgpt/chatgpt_send.js`, `electron/main/chatgpt/chatgpt_upload.js`, `electron/main/pipeline/pipeline_runner.js`, `electron/main/state/state.js`

### [utils.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/utils/utils.js)

* **Relative Path**: `electron/main/utils/utils.js`
* **Purpose**: Utility functions for paths, file I/O, and sleep.
* **Exported Symbols**: `sanitizeFileName`, `sleep`, `normalizeVideoProvider`, `normalizeContinuityReferenceSettings`, `findSceneKeyframePathSafe`, `validateContinuityReferenceImage`, `pathExists`, `getFileStat`, `getFfmpegBinaryPath`, `ensureProjectFilePath`, `hasFullPrivateEmail`, `getUserPromptDir`, `getHardPromptConfigPath`, `HARD_PROMPT_FILENAME`
* **Imported Symbols**: `electron`, `ffmpeg-static`, `fs/promises`, `path`, `electron/main/logging/index.js`
* **Classes**: *None*
* **Functions**: `sanitizeFileName`, `sleep`, `normalizeVideoProvider`, `normalizeContinuityReferenceSettings`, `findSceneKeyframePathSafe`, `validateContinuityReferenceImage`, `pathExists`, `getFileStat`, `getFfmpegBinaryPath`, `ensureProjectFilePath`, `hasFullPrivateEmail`, `getUserPromptDir`, `getHardPromptConfigPath`
* **Approximate Responsibility**:
  * Implement safe file writes
  * Delay utility functions
* **Dependencies**: `electron`, `ffmpeg-static`, `fs/promises`, `path`, `electron/main/logging/index.js`
* **Who imports this file**: `electron/main/utils/index.js`

### [index.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/index.js)

* **Relative Path**: `electron/main/veoup/index.js`
* **Purpose**: VeoUp module rollup.
* **Exported Symbols**: `...require("./veoup")`
* **Imported Symbols**: `electron/main/veoup/veoup.js`
* **Classes**: *None*
* **Functions**: *None*
* **Approximate Responsibility**:
  * Export VeoUp wrapper
* **Dependencies**: `electron/main/veoup/veoup.js`
* **Who imports this file**: `electron/main.js`, `electron/main/pipeline/pipeline_runner.js`

### [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)

* **Relative Path**: `electron/main/veoup/veoup.js`
* **Purpose**: VeoUp desktop app automation.
* **Exported Symbols**: `initVeoUp`, `getVeoUpVideoSourcePath`, `assertVeoUpResultAssociation`, `buildVeoUpPromptsReadyFile`, `isVeoUpStageError`, `runVeoUpScriptAsPromise`, `executeVeoUpAutomation`, `normalizeWhitespace`, `collectKeyframes`, `collectMotionPrompts`, `convertVeoUpClientPointToScreen`, `prepareVeoUpKeyframesFolder`, `exportVeoUpPromptFile`, `findVeoupExecutable`, `startCoordinateSetup`, `captureVeoUpCoordinate`, `getVeoUpCoordinateConfig`, `saveVeoUpCoordinateConfig`, `deleteVeoUpCoordinateConfig`, `cancelCoordinateSetup`, `scanProjectAndRunVeoUp`
* **Imported Symbols**: `fs`, `fs/promises`, `os`, `path`, `child_process`, `electron`, `electron/main/logging/index.js`
* **Classes**: `VidoraVeoUpWindowProbe`, `DpiUtil`, `Win32Window`, `VidoraNativeWin`, `DpiUtil`, `Win32Window`, `VidoraNativeWin`, `VidoraNativeWin`, `VidoraNativeWin`, `Win32Cursor`
* **Functions**: `initVeoUp`, `findRunningVeoUpExecutablePaths`, `findVeoupExecutable`, `searchExesInDir`, `parseVersion`, `compareVersions`, `isProcessRunning`, `findRunningVeoUpWindow`, `foreach`, `findWindowsShortcutLaunchers`, `walk`, `resolveVeoUpLauncher`, `normalizeWhitespace`, `pathExists`, `sceneNumberFrom`, `sortBySceneNumber`, `sceneFileToken`, `listPngFiles`, `collectKeyframes`, `readPromptFile`, `isSavedPromptPlaceholder`, `collectMotionPrompts`, `quoteForFileDialog`, `convertVeoUpClientPointToScreen`, `prepareVeoUpKeyframesFolder`, `exportVeoUpPromptFile`, `buildPowerShellScript`, `EnumWindows`, `foreach`, `foreach`, `foreach`, `foreach`, `foreach`, `foreach`, `foreach`, `foreach`, `foreach`, `foreach`, `foreach`, `foreach`, `foreach`, `foreach`, `foreach`, `foreach`, `foreach`, `foreach`, `foreach`, `runPowerShell`, `handleExit`, `readJsonFileStripBom`, `executeVeoUpAutomation`, `throwIfCancelled`, `startCoordinateSetup`, `EnumWindows`, `foreach`, `waitForHotkey`, `cleanup`, `trigger`, `cancelCoordinateSetup`, `validateBlueBoxCoordinate`, `previewStartButtonCoordinate`, `captureVeoUpCoordinate`, `saveVeoUpCoordinateConfig`, `getVeoUpCoordinateConfig`, `deleteVeoUpCoordinateConfig`, `scanProjectAndRunVeoUp`, `getVeoUpVideoSourcePath`, `isVeoUpStageError`
* **Approximate Responsibility**:
  * Automate clicking and rendering of videos via VeoUp
* **Dependencies**: `fs`, `fs/promises`, `os`, `path`, `child_process`, `electron`, `electron/main/logging/index.js`
* **Who imports this file**: `electron/main/veoup/index.js`


## Function Analysis

### `logChatGptStage()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, stage, context = {}, extra = {})`
* **Returns**: `unknown`
* **Calls**: `setChatGptSendState()`, `initChatGptRecovery()`, `initChatGptSend()`, `vidoraReadChatGptComposerStateReal()`, `initChatGptUpload()`, `appendAppLog()`, `setChatGptContextFresh()`
* **Called By**: `isPipelineCancelledError()`
* **Description**: Orchestrates behavior for `logChatGptStage`.

### `setChatGptSendState()`

* **Located in**: [chatgpt_upload.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_upload.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `logChatGptStage()`, `assertPipelineRunActive()`, `waitForHeavyChatGptPromptDomCooldown()`, `sendPromptViaCdpInput()`, `sendNv2PromptViaDeepCdpInput()`, `verifyAttachmentsReady()`
* **Description**: Orchestrates behavior for `setChatGptSendState`.

### `loginRequiredMessage()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(provider, detail = "")`
* **Returns**: `unknown`
* **Calls**: `normalizeWebProvider()`
* **Called By**: `sendPromptViaWeb()`, `validateGeneratedVideoFile()`, `waitForNewVideoUrl()`, `isPipelineCancelledError()`, `waitForLatestChatGPTGeneratedImage()`, `resendImagePrompt()`
* **Description**: Orchestrates behavior for `loginRequiredMessage`.

### `sanitizeProjectValue()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(value)`
* **Returns**: `unknown`
* **Calls**: `maskRouterText()`
* **Called By**: `saveProjectSessionFile()`, `openProjectSessionFile()`
* **Description**: Orchestrates behavior for `sanitizeProjectValue`.

### `assertNoProjectSecrets()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(value, keyPath = [])`
* **Returns**: `unknown`
* **Calls**: `hasFullPrivateEmail()`
* **Called By**: `validateProjectPayload()`
* **Description**: Orchestrates behavior for `assertNoProjectSecrets`.

### `assertObjectField()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(payload, key)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `validateProjectPayload()`
* **Description**: Orchestrates behavior for `assertObjectField`.

### `validateProjectPayload()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(payload)`
* **Returns**: `unknown`
* **Calls**: `assertNoProjectSecrets()`, `assertObjectField()`
* **Called By**: `saveProjectSessionFile()`, `openProjectSessionFile()`, `forceCleanChatGptNewChatRotation()`
* **Description**: Orchestrates behavior for `validateProjectPayload`.

### `resolveProjectPrepromptFolder()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(projectRoot = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `resolveProjectPrepromptFolder`.

### `importCharacterPresetsHandler()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, projectPath)`
* **Returns**: `unknown`
* **Calls**: `appendAppLog()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `importCharacterPresetsHandler`.

### `newProjectSession()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(event, options = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `newProjectSession`.

### `saveProjectSessionFile()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, payload = {})`
* **Returns**: `unknown`
* **Calls**: `sanitizeProjectValue()`, `validateProjectPayload()`, `embedProjectAssets()`, `sanitizeFileName()`, `ensureProjectFilePath()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `saveProjectSessionFile`.

### `openProjectSessionFile()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `sanitizeProjectValue()`, `validateProjectPayload()`, `restoreEmbeddedProjectAssets()`, `sanitizeFileName()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `openProjectSessionFile`.

### `embedProjectAssets()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(payload = {})`
* **Returns**: `unknown`
* **Calls**: `pathExists()`
* **Called By**: `saveProjectSessionFile()`
* **Description**: Orchestrates behavior for `embedProjectAssets`.

### `restoreEmbeddedProjectAssets()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(payload = {}, projectFolder = "")`
* **Returns**: `unknown`
* **Calls**: `sanitizeFileName()`, `pathExists()`
* **Called By**: `openProjectSessionFile()`
* **Description**: Orchestrates behavior for `restoreEmbeddedProjectAssets`.

### `normalizeCredentialProvider()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(provider)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `readWebAccountStore()`, `safeWebAccount()`, `listWebAccountsSafe()`, `saveWebAccount()`, `deleteWebAccount()`, `pickWebAccount()`, `clearProviderSession()`
* **Description**: Orchestrates behavior for `normalizeCredentialProvider`.

### `maskEmail()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(email = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `safeWebAccount()`, `saveWebAccount()`, `clearProviderSession()`
* **Description**: Orchestrates behavior for `maskEmail`.

### `ensureCredentialEncryptionAvailable()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `readWebAccountStore()`, `writeWebAccountStore()`
* **Description**: Orchestrates behavior for `ensureCredentialEncryptionAvailable`.

### `readWebAccountStore()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `({ includeSecrets = false } = {})`
* **Returns**: `unknown`
* **Calls**: `normalizeCredentialProvider()`, `ensureCredentialEncryptionAvailable()`, `pathExists()`
* **Called By**: `listWebAccountsSafe()`, `saveWebAccount()`, `deleteWebAccount()`, `pickWebAccount()`
* **Description**: Orchestrates behavior for `readWebAccountStore`.

### `writeWebAccountStore()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(store = {})`
* **Returns**: `unknown`
* **Calls**: `ensureCredentialEncryptionAvailable()`
* **Called By**: `saveWebAccount()`, `deleteWebAccount()`, `pickWebAccount()`
* **Description**: Orchestrates behavior for `writeWebAccountStore`.

### `safeWebAccount()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(account = {})`
* **Returns**: `unknown`
* **Calls**: `normalizeCredentialProvider()`, `maskEmail()`, `maskRouterText()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `safeWebAccount`.

### `listWebAccountsSafe()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, provider = "")`
* **Returns**: `unknown`
* **Calls**: `normalizeCredentialProvider()`, `readWebAccountStore()`
* **Called By**: `deleteWebAccount()`, `norm()`
* **Description**: Orchestrates behavior for `listWebAccountsSafe`.

### `saveWebAccount()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, input = {})`
* **Returns**: `unknown`
* **Calls**: `normalizeCredentialProvider()`, `maskEmail()`, `readWebAccountStore()`, `writeWebAccountStore()`, `appendAppLog()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `saveWebAccount`.

### `deleteWebAccount()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, accountId = "")`
* **Returns**: `unknown`
* **Calls**: `normalizeCredentialProvider()`, `readWebAccountStore()`, `writeWebAccountStore()`, `listWebAccountsSafe()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `deleteWebAccount`.

### `pickWebAccount()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(provider = "", { rotate = false } = {})`
* **Returns**: `unknown`
* **Calls**: `normalizeCredentialProvider()`, `readWebAccountStore()`, `writeWebAccountStore()`, `sanitizeChatTitleForLog()`, `maskRouterText()`
* **Called By**: `clearProviderSession()`
* **Description**: Orchestrates behavior for `pickWebAccount`.

### `sanitizeChatTitleForLog()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(title = "")`
* **Returns**: `unknown`
* **Calls**: `maskRouterText()`
* **Called By**: `pickWebAccount()`, `updateChatGptConversationIdentity()`, `selectChatGptConversationByTitle()`, `maybeRenameChatGptCurrentConversationUntilTitle()`, `renameChatGptCurrentConversationUntilTitle()`, `checkChatGptCurrentConversationTitle()`
* **Description**: Orchestrates behavior for `sanitizeChatTitleForLog`.

### `checkProactiveMemoryGuard()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(sceneId, pageState)`
* **Returns**: `unknown`
* **Calls**: `appendAppLog()`
* **Called By**: `isPipelineCancelledError()`
* **Description**: Orchestrates behavior for `checkProactiveMemoryGuard`.

### `getChatGptLocationState()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page)`
* **Returns**: `unknown`
* **Calls**: `invalidateChatGptConversationIdentity()`, `forceCleanChatGptNewChatRotation()`, `isChatGptRequestRotationEligible()`, `getCdpPage()`, `sleep()`, `assertPipelineRunActive()`, `getChatGptSendState()`, `waitForCdpLoad()`, `evaluateOnCdpPage()`, `isReloadBlocked()`, `requestReloadWithReason()`, `appendAppLog()`, `setChatGptContextFresh()`
* **Called By**: `updateChatGptConversationIdentity()`, `selectChatGptConversationByTitle()`, `isPipelineCancelledError()`, `maybeRenameChatGptCurrentConversationUntilTitle()`, `checkChatGptCurrentConversationTitle()`
* **Description**: Orchestrates behavior for `getChatGptLocationState`.

### `invalidateChatGptConversationIdentity()`

* **Located in**: [chatgpt_recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_recovery.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `getChatGptLocationState()`, `updateChatGptConversationIdentity()`, `isPipelineCancelledError()`, `maybeRenameChatGptCurrentConversationUntilTitle()`, `forceCleanChatGptNewChatRotation()`
* **Description**: Orchestrates behavior for `invalidateChatGptConversationIdentity`.

### `forceCleanChatGptNewChatRotation()`

* **Located in**: [chatgpt_recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_recovery.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `validateProjectPayload()`, `ensureProjectFilePath()`, `invalidateChatGptConversationIdentity()`, `getCdpPage()`, `sleep()`, `assertPipelineRunActive()`, `getChatGptSendState()`, `waitForCdpLoad()`, `evaluateOnCdpPage()`, `resetSessionSceneCounter()`, `isReloadBlocked()`, `requestReloadWithReason()`, `appendAppLog()`, `setChatGptContextFresh()`
* **Called By**: `getChatGptLocationState()`, `assertPipelineRunActive()`, `runScenePipelineLocked()`
* **Description**: Orchestrates behavior for `forceCleanChatGptNewChatRotation`.

### `isChatGptRequestRotationEligible()`

* **Located in**: [chatgpt_recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_recovery.js)
* **Parameters**: `(error, persistedStage = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `getChatGptLocationState()`, `runScenePipelineLocked()`
* **Description**: Orchestrates behavior for `isChatGptRequestRotationEligible`.

### `captureChatGptDiagnosticSnapshotScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `captureChatGptDiagnosticSnapshotScript`.

### `captureAndLogChatGptDiagnostics()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, sceneId, beforeCount, stage = "unknown")`
* **Returns**: `unknown`
* **Calls**: `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: `waitForLatestChatGPTGeneratedImage()`, `isValidChatGptConversationUrl()`
* **Description**: Orchestrates behavior for `captureAndLogChatGptDiagnostics`.

### `updateChatGptConversationIdentity()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(locationState = {}, title = "")`
* **Returns**: `unknown`
* **Calls**: `sanitizeChatTitleForLog()`, `getChatGptLocationState()`, `invalidateChatGptConversationIdentity()`, `selectChatGptConversationByTitle()`, `appendAppLog()`, `getChatGptConversationIdFromPath()`, `isSameChatTitle()`
* **Called By**: `selectChatGptConversationByTitle()`, `maybeRenameChatGptCurrentConversationUntilTitle()`, `checkChatGptCurrentConversationTitle()`
* **Description**: Orchestrates behavior for `updateChatGptConversationIdentity`.

### `getSafeGrokAccounts()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `maskRouterText()`
* **Called By**: `getGrokRouterStatus()`, `selectGrokAccount()`, `listGrokAccountsSafe()`
* **Description**: Orchestrates behavior for `getSafeGrokAccounts`.

### `getGrokRouterStatus()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `getSafeGrokAccounts()`
* **Called By**: `selectGrokAccount()`, `setAccountRouterEnabled()`, `writeGrokRouterCheckpoint()`, `resumeFromRouterCheckpoint()`, `refreshGrokRouterStatus()`, `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `getGrokRouterStatus`.

### `setGrokAccountState()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(accountId, state)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `writeGrokRouterCheckpoint()`
* **Description**: Orchestrates behavior for `setGrokAccountState`.

### `selectGrokAccount()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, accountId)`
* **Returns**: `unknown`
* **Calls**: `getSafeGrokAccounts()`, `getGrokRouterStatus()`
* **Called By**: `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `selectGrokAccount`.

### `setAccountRouterEnabled()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, enabled)`
* **Returns**: `unknown`
* **Calls**: `getGrokRouterStatus()`
* **Called By**: `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `setAccountRouterEnabled`.

### `classifyGrokRouterError()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(error)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `classifyGrokRouterError`.

### `writeGrokRouterCheckpoint()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(sceneDir, fields = {})`
* **Returns**: `unknown`
* **Calls**: `getGrokRouterStatus()`, `setGrokAccountState()`, `notifyRenderer()`, `maskRouterText()`, `normalizeVideoProvider()`
* **Called By**: `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `writeGrokRouterCheckpoint`.

### `resumeFromRouterCheckpoint()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `getGrokRouterStatus()`, `pathExists()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `resumeFromRouterCheckpoint`.

### `notifyRenderer()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(type, message, details = null)`
* **Returns**: `unknown`
* **Calls**: `sanitizeLogValue()`, `sanitizeIpcValue()`, `appendAppLog()`
* **Called By**: `writeGrokRouterCheckpoint()`, `notifyChatGptPolicyRefusal()`, `clearProviderSession()`, `waitForNewVideoUrl()`, `waitForLatestChatGPTGeneratedImage()`, `resendImagePrompt()`
* **Description**: Orchestrates behavior for `notifyRenderer`.

### `notifyChatGptPolicyRefusal()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(sceneId, stage, text)`
* **Returns**: `unknown`
* **Calls**: `notifyRenderer()`, `appendAppLog()`
* **Called By**: `resendImagePrompt()`, `retryMotionPrompt()`
* **Description**: Orchestrates behavior for `notifyChatGptPolicyRefusal`.

### `ensureAndMigratePrompts()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `appendAppLog()`, `pathExists()`, `getUserPromptDir()`
* **Called By**: `loadHardPromptTasks()`, `clickNode()`, `initializeApplication()`
* **Description**: Orchestrates behavior for `ensureAndMigratePrompts`.

### `sanitizePromptSourcePathForLog()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(filePath = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `ensureUserPromptFile()`
* **Description**: Orchestrates behavior for `sanitizePromptSourcePathForLog`.

### `findBundledPromptTemplate()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(filename = HARD_PROMPT_FILENAME)`
* **Returns**: `unknown`
* **Calls**: `pathExists()`
* **Called By**: `ensureUserPromptFile()`
* **Description**: Orchestrates behavior for `findBundledPromptTemplate`.

### `ensureUserPromptFile()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(filename = HARD_PROMPT_FILENAME)`
* **Returns**: `unknown`
* **Calls**: `sanitizePromptSourcePathForLog()`, `findBundledPromptTemplate()`, `appendAppLog()`, `pathExists()`, `getUserPromptDir()`
* **Called By**: `resolveEditablePromptPath()`
* **Description**: Orchestrates behavior for `ensureUserPromptFile`.

### `readHardPromptConfig()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `getHardPromptConfigPath()`
* **Called By**: `resolveEditablePromptPath()`, `getHardPromptFileInfo()`
* **Description**: Orchestrates behavior for `readHardPromptConfig`.

### `writeHardPromptConfig()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(config = {})`
* **Returns**: `unknown`
* **Calls**: `getHardPromptConfigPath()`
* **Called By**: `chooseHardPromptFile()`
* **Description**: Orchestrates behavior for `writeHardPromptConfig`.

### `resolveEditablePromptPath()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(filename = HARD_PROMPT_FILENAME)`
* **Returns**: `unknown`
* **Calls**: `ensureUserPromptFile()`, `readHardPromptConfig()`, `appendAppLog()`
* **Called By**: `getHardPromptFileInfo()`
* **Description**: Orchestrates behavior for `resolveEditablePromptPath`.

### `getHardPromptFileInfo()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `readHardPromptConfig()`, `resolveEditablePromptPath()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getHardPromptFileInfo`.

### `chooseHardPromptFile()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `writeHardPromptConfig()`, `appendAppLog()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `chooseHardPromptFile`.

### `openHardPromptFile()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(event, key)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `openHardPromptFile`.

### `loadHardPromptTasks()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `ensureAndMigratePrompts()`, `getUserPromptDir()`
* **Called By**: `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `loadHardPromptTasks`.

### `collectPrepromptRequestFiles()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `({ outputFolder = "" } = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `isValidChatGptConversationUrl()`
* **Description**: Orchestrates behavior for `collectPrepromptRequestFiles`.

### `openGrokRouterFolder()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `openGrokRouterFolder`.

### `listGrokAccountsSafe()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `getSafeGrokAccounts()`
* **Called By**: `refreshGrokRouterStatus()`
* **Description**: Orchestrates behavior for `listGrokAccountsSafe`.

### `broadcastPipelineLogVisibility()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `buildAppMenu()`
* **Description**: Orchestrates behavior for `broadcastPipelineLogVisibility`.

### `sendProjectMenuCommand()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(command)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `buildAppMenu()`
* **Description**: Orchestrates behavior for `sendProjectMenuCommand`.

### `buildAppMenu()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `broadcastPipelineLogVisibility()`, `sendProjectMenuCommand()`
* **Called By**: `initializeApplication()`
* **Description**: Orchestrates behavior for `buildAppMenu`.

### `getPipelineLogVisibility()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `openWebLogin()`, `normalizeWebProvider()`, `getCdpPage()`, `close()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getPipelineLogVisibility`.

### `openWebLogin()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(provider)`
* **Returns**: `unknown`
* **Calls**: `setStatus()`
* **Called By**: `getPipelineLogVisibility()`, `waitForProviderReady()`
* **Description**: Orchestrates behavior for `openWebLogin`.

### `normalizeWebProvider()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(provider)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `loginRequiredMessage()`, `getPipelineLogVisibility()`, `checkWebLogin()`, `sendPromptViaWeb()`
* **Description**: Orchestrates behavior for `normalizeWebProvider`.

### `closeChromeDebug()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `close()`
* **Called By**: `scanProjectAndRunVeoUpHandler()`
* **Description**: Orchestrates behavior for `closeChromeDebug`.

### `ensureChromeDebug()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(openUrl)`
* **Returns**: `unknown`
* **Calls**: `isChromeDebugReady()`, `findChromeExecutable()`, `sleep()`
* **Called By**: `validateGeneratedVideoFile()`
* **Description**: Orchestrates behavior for `ensureChromeDebug`.

### `isChromeDebugReady()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `ensureChromeDebug()`
* **Description**: Orchestrates behavior for `isChromeDebugReady`.

### `openCdpTab()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(url)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `validateGeneratedVideoFile()`
* **Description**: Orchestrates behavior for `openCdpTab`.

### `findChromeExecutable()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `ensureChromeDebug()`
* **Description**: Orchestrates behavior for `findChromeExecutable`.

### `chooseFolder()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `chooseFolder`.

### `scanFolder()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, folderPath)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `getPreviousFrame()`, `mergeVideos()`
* **Description**: Orchestrates behavior for `scanFolder`.

### `collectFromDir()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(dir, sceneHint = null)`
* **Returns**: `unknown`
* **Calls**: `getSceneNumber()`, `pathExists()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `collectFromDir`.

### `getSceneNumber()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(fileName)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `collectFromDir()`
* **Description**: Orchestrates behavior for `getSceneNumber`.

### `extractLastFrameToPathHandler()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, { videoPath, outputPath, runId = '' })`
* **Returns**: `unknown`
* **Calls**: `extractLastFrameToPath()`, `assertPipelineRunActive()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `extractLastFrameToPathHandler`.

### `extractLastFrame()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, videoPath)`
* **Returns**: `unknown`
* **Calls**: `extractLastFrameFromVideo()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `extractLastFrame`.

### `extractLastFrameFromVideo()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(videoPath)`
* **Returns**: `unknown`
* **Calls**: `runFfmpeg()`
* **Called By**: `extractLastFrame()`, `getPreviousFrame()`
* **Description**: Orchestrates behavior for `extractLastFrameFromVideo`.

### `getContinuityReferenceDir()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(projectDir = "", sceneId = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `validateLocalVideoFile()`
* **Description**: Orchestrates behavior for `getContinuityReferenceDir`.

### `formatFfmpegTimestamp()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(seconds = 0)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `probeVideoDurationSeconds()`
* **Description**: Orchestrates behavior for `formatFfmpegTimestamp`.

### `probeVideoDurationSeconds()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(videoPath = "")`
* **Returns**: `unknown`
* **Calls**: `formatFfmpegTimestamp()`, `runFfmpeg()`, `on()`, `getScopedPipelineRunId()`, `trackPipelineChildProcess()`, `validateContinuityReferenceImage()`, `getFfmpegBinaryPath()`
* **Called By**: `extractLastFrameToPath()`, `validateLocalVideoFile()`, `validateGeneratedVideoFile()`
* **Description**: Orchestrates behavior for `probeVideoDurationSeconds`.

### `extractLastFrameToPath()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(videoPath = "", outputPath = "")`
* **Returns**: `unknown`
* **Calls**: `probeVideoDurationSeconds()`, `runFfmpeg()`, `validateContinuityReferenceImage()`
* **Called By**: `extractLastFrameToPathHandler()`, `validateLocalVideoFile()`, `runFullPipeline()`
* **Description**: Orchestrates behavior for `extractLastFrameToPath`.

### `getSceneMediaPaths()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(sceneDir = "", sceneId = "", runId = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `isValidChatGptConversationUrl()`, `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `getSceneMediaPaths`.

### `isTemporaryDownloadPath()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(filePath = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `validateLocalVideoFile()`
* **Description**: Orchestrates behavior for `isTemporaryDownloadPath`.

### `waitForStableFileSize()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(filePath = "", options = {})`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `assertPipelineRunActive()`, `getScopedPipelineRunId()`
* **Called By**: `validateLocalVideoFile()`
* **Description**: Orchestrates behavior for `waitForStableFileSize`.

### `validateLocalVideoFile()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(filePath = "", options = {})`
* **Returns**: `unknown`
* **Calls**: `getContinuityReferenceDir()`, `probeVideoDurationSeconds()`, `extractLastFrameToPath()`, `isTemporaryDownloadPath()`, `waitForStableFileSize()`, `validateGeneratedVideoFile()`, `assertPipelineRunActive()`, `appendAppLog()`, `getScopedPipelineRunId()`, `normalizeContinuityReferenceSettings()`, `validateContinuityReferenceImage()`, `pathExists()`
* **Called By**: `runScenePipelineLockedInternal()`, `startNextSceneChatGptPrefetch()`
* **Description**: Orchestrates behavior for `validateLocalVideoFile`.

### `copyImageToClipboard()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, imagePath)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `copyImageToClipboard`.

### `getPreviousFrame()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, folderPath, currentSceneIndex)`
* **Returns**: `unknown`
* **Calls**: `scanFolder()`, `extractLastFrameFromVideo()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getPreviousFrame`.

### `mergeVideos()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, folderPath, options = {})`
* **Returns**: `unknown`
* **Calls**: `scanFolder()`, `appendAppLog()`
* **Called By**: `mergeAndShowFinalPreview()`
* **Description**: Orchestrates behavior for `mergeVideos`.

### `exportFinalVideo()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, folderPath)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `exportFinalVideo`.

### `mergeVideoFiles()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(videos, outputPath)`
* **Returns**: `unknown`
* **Calls**: `runFfmpeg()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `mergeVideoFiles`.

### `runFfmpeg()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(args)`
* **Returns**: `unknown`
* **Calls**: `assertPipelineRunActive()`, `on()`, `getScopedPipelineRunId()`, `trackPipelineChildProcess()`, `getFfmpegBinaryPath()`
* **Called By**: `extractLastFrameFromVideo()`, `probeVideoDurationSeconds()`, `extractLastFrameToPath()`, `mergeVideoFiles()`
* **Description**: Orchestrates behavior for `runFfmpeg`.

### `splitPromptWithAI()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, options)`
* **Returns**: `unknown`
* **Calls**: `readJsonResponse()`, `parseJsonFromModel()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `splitPromptWithAI`.

### `readJsonResponse()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(response)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `splitPromptWithAI()`
* **Description**: Orchestrates behavior for `readJsonResponse`.

### `parseJsonFromModel()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(text)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `splitPromptWithAI()`, `generateScenePrompts()`
* **Description**: Orchestrates behavior for `parseJsonFromModel`.

### `generateScenePrompts()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, options)`
* **Returns**: `unknown`
* **Calls**: `parseJsonFromModel()`, `chooseOutputFolder()`
* **Called By**: `generateWithProvider()`
* **Description**: Orchestrates behavior for `generateScenePrompts`.

### `chooseOutputFolder()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `render()`, `setStatus()`, `markProjectDirty()`, `persist()`
* **Called By**: `generateScenePrompts()`, `recoverWorkflowRun()`, `sendCurrentBatchViaWeb()`, `runFullPipeline()`, `autoRunRoute()`
* **Description**: Orchestrates behavior for `chooseOutputFolder`.

### `chooseProjectRootFolder()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `chooseProjectRootFolder`.

### `checkWebLogin()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, provider, options = {})`
* **Returns**: `unknown`
* **Calls**: `normalizeWebProvider()`, `getCdpPage()`, `sleep()`, `close()`, `evaluateOnCdpPage()`, `tryAutoLoginWithStoredAccount()`, `shouldRecoverFromCacheOrChallenge()`, `appendAppLog()`
* **Called By**: `checkSelectedWebLogin()`, `waitForProviderReady()`
* **Description**: Orchestrates behavior for `checkWebLogin`.

### `clearProviderSession()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page, provider)`
* **Returns**: `unknown`
* **Calls**: `normalizeCredentialProvider()`, `maskEmail()`, `pickWebAccount()`, `notifyRenderer()`, `sleep()`, `waitForCdpLoad()`, `evaluateOnCdpPage()`, `tryAutoLoginWithStoredAccount()`, `appendAppLog()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `clearProviderSession`.

### `sendPromptViaWeb()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, options)`
* **Returns**: `unknown`
* **Calls**: `loginRequiredMessage()`, `normalizeWebProvider()`, `isValidChatGptConversationUrl()`, `getCdpPage()`, `waitForCdpAssistantResponse()`, `evaluateOnCdpPage()`, `sendPromptViaCdpInput()`, `sanitizeFileName()`, `findSceneKeyframePathSafe()`, `pathExists()`
* **Called By**: `sendCurrentBatchViaWeb()`
* **Description**: Orchestrates behavior for `sendPromptViaWeb`.

### `isValidChatGptConversationUrl()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(url = "")`
* **Returns**: `unknown`
* **Calls**: `getSceneMediaPaths()`, `assertPipelineRunActive()`, `appendAppLog()`, `getScopedPipelineRunId()`, `getVeoUpVideoSourcePath()`, `captureAndLogChatGptDiagnostics()`, `collectPrepromptRequestFiles()`, `getCdpPage()`, `sleep()`, `waitForCdpLoad()`, `evaluateOnCdpPage()`, `requestReloadWithReason()`, `sendPromptViaCdpInput()`, `writePipelineSceneState()`, `getChatGptContextFresh()`, `setChatGptContextFresh()`, `writeSceneSnapshot()`, `readSceneSnapshot()`, `sanitizeFileName()`, `pathExists()`
* **Called By**: `sendPromptViaWeb()`
* **Description**: Orchestrates behavior for `isValidChatGptConversationUrl`.

### `openFreshChatGptRootPage()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(reason = "new-chat")`
* **Returns**: `unknown`
* **Calls**: `appendAppLog()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `openFreshChatGptRootPage`.

### `assertChatGptNotExistingConversation()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, sceneId = "")`
* **Returns**: `unknown`
* **Calls**: `evaluateOnCdpPage()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `assertChatGptNotExistingConversation`.

### `summarizeGrokGenerationError()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(error)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `validateGeneratedVideoFile()`
* **Description**: Orchestrates behavior for `summarizeGrokGenerationError`.

### `waitForGrokImagineReady()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page, sceneId = "")`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `waitForGrokImagineReady`.

### `sanitizeGrokUrlForLog()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(value = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `getGrokRouteState()`, `summarizeGrokSendState()`
* **Description**: Orchestrates behavior for `sanitizeGrokUrlForLog`.

### `isGrokImagineAgentUrl()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(value = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `ensureGrokImagineAgentPage()`
* **Description**: Orchestrates behavior for `isGrokImagineAgentUrl`.

### `isGrokImagineReadyRoute()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(route)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `waitForGrokImagineAgentReady()`, `ensureGrokImagineAgentPage()`, `assertGrokImagineAgentReady()`
* **Description**: Orchestrates behavior for `isGrokImagineReadyRoute`.

### `getGrokRouteState()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page)`
* **Returns**: `unknown`
* **Calls**: `sanitizeGrokUrlForLog()`, `evaluateOnCdpPage()`
* **Called By**: `waitForGrokImagineAgentReady()`, `ensureGrokImagineAgentPage()`, `assertGrokImagineAgentReady()`
* **Description**: Orchestrates behavior for `getGrokRouteState`.

### `waitForGrokImagineAgentReady()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page, sceneId = "", options = {})`
* **Returns**: `unknown`
* **Calls**: `isGrokImagineReadyRoute()`, `getGrokRouteState()`, `sleep()`, `appendAppLog()`
* **Called By**: `ensureGrokImagineAgentPage()`
* **Description**: Orchestrates behavior for `waitForGrokImagineAgentReady`.

### `forceGrokNormalImagineVideoMode()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page, sceneId = "")`
* **Returns**: `unknown`
* **Calls**: `textOf()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `forceGrokNormalImagineVideoMode`.

### `visible()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(node)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `getGrokReadyStateScript()`, `closeGrokTemplateModalScript()`, `getGrokTemplateViewportFallbackPointsScript()`, `forceHideGrokTemplateModalScript()`, `isExactDismissText()`, `detectChatGptResponseChoiceUiScript()`, `normalize()`, `deepFocusNv2ComposerScript()`, `isSendButton()`, `isStrictSendButton()`, `getActiveButtonType()`
* **Description**: Orchestrates behavior for `visible`.

### `textOf()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(node)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `forceGrokNormalImagineVideoMode()`, `validateGeneratedVideoFile()`, `clickByText()`, `forceGrokNormalImagineMode()`, `clickButton()`, `getGrokRouteStateScript()`, `closeGrokTemplateModalScript()`, `getGrokTemplateViewportFallbackPointsScript()`, `scanGrokTemplateModalScript()`, `selectGrokPhotoVideoTemplateScript()`, `findClickable()`, `clickExact()`, `boxOf()`, `dismissGrokConnectorsScript()`, `forceGrokVideoModeScript()`, `isExactDismissText()`, `clickNode()`, `clickUploadButtonScript()`
* **Description**: Orchestrates behavior for `textOf`.

### `ensureGrokImagineAgentPage()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page, sceneId = "", config = {})`
* **Returns**: `unknown`
* **Calls**: `isGrokImagineAgentUrl()`, `isGrokImagineReadyRoute()`, `getGrokRouteState()`, `waitForGrokImagineAgentReady()`, `sleep()`, `waitForCdpLoad()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: `closeGrokTemplateModal()`, `validateGeneratedVideoFile()`, `clickGrokSendButtonOnce()`, `uploadFileViaCdp()`, `submitGrokVideoPrompt()`
* **Description**: Orchestrates behavior for `ensureGrokImagineAgentPage`.

### `assertGrokImagineAgentReady()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page, stage = "send", sceneId = "")`
* **Returns**: `unknown`
* **Calls**: `isGrokImagineReadyRoute()`, `getGrokRouteState()`, `appendAppLog()`
* **Called By**: `validateGeneratedVideoFile()`, `uploadFileViaCdp()`, `submitGrokVideoPrompt()`
* **Description**: Orchestrates behavior for `assertGrokImagineAgentReady`.

### `closeGrokTemplateModal()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page, sceneId = "")`
* **Returns**: `unknown`
* **Calls**: `ensureGrokImagineAgentPage()`, `waitForGrokUploadSettled()`, `uploadFileViaCdp()`, `sleep()`, `evaluateOnCdpPage()`, `appendAppLog()`, `makeRetryableGrokGenerationError()`, `normalizeContinuityReferenceSettings()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `closeGrokTemplateModal`.

### `validateGeneratedVideoFile()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(filePath)`
* **Returns**: `unknown`
* **Calls**: `loginRequiredMessage()`, `ensureChromeDebug()`, `openCdpTab()`, `probeVideoDurationSeconds()`, `summarizeGrokGenerationError()`, `textOf()`, `ensureGrokImagineAgentPage()`, `assertGrokImagineAgentReady()`, `clickByText()`, `getCdpPage()`, `closeUnexpectedProviderTabs()`, `waitForGrokUploadSettled()`, `labelGrokCanvas()`, `clearGrokCanvasChat()`, `confirmGrokVideoGenerationIfAsked()`, `waitForNewVideoUrl()`, `downloadBrowserAsset()`, `uploadFileViaCdp()`, `submitPixVersePrompt()`, `submitGrokVideoPrompt()`, `sleep()`, `on()`, `connect()`, `close()`, `getChatGptSendState()`, `waitForCdpLoad()`, `evaluateOnCdpPage()`, `isReloadBlocked()`, `detectLoginWithRetry()`, `sendPromptViaCdpInput()`, `maskRouterText()`, `sanitizeLogString()`, `appendAppLog()`, `normalizeGrokResultRetryLimit()`, `makeRetryableGrokGenerationError()`, `isRetryableGrokGenerationError()`, `normalizeContinuityReferenceSettings()`
* **Called By**: `validateLocalVideoFile()`
* **Description**: Orchestrates behavior for `validateGeneratedVideoFile`.

### `clickByText()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(pattern)`
* **Returns**: `unknown`
* **Calls**: `textOf()`
* **Called By**: `validateGeneratedVideoFile()`
* **Description**: Orchestrates behavior for `clickByText`.

### `getCdpPage()`

* **Located in**: [chatgpt_recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_recovery.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `getChatGptLocationState()`, `getPipelineLogVisibility()`, `checkWebLogin()`, `sendPromptViaWeb()`, `validateGeneratedVideoFile()`, `isPipelineCancelledError()`, `isValidChatGptConversationUrl()`, `assertPipelineRunActive()`, `forceCleanChatGptNewChatRotation()`, `runScenePipelineLocked()`, `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `getCdpPage`.

### `closeUnexpectedProviderTabs()`

* **Located in**: [chatgpt_recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_recovery.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `validateGeneratedVideoFile()`, `recoverChatGptBlockingUi()`
* **Description**: Orchestrates behavior for `closeUnexpectedProviderTabs`.

### `forceGrokNormalImagineMode()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page, sceneId = "")`
* **Returns**: `unknown`
* **Calls**: `textOf()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `forceGrokNormalImagineMode`.

### `ensureGrokEmptyCanvas()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page, sceneId = "", forceNew = false)`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `waitForCdpLoad()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: `recoverGrokCanvasAfterLimit()`
* **Description**: Orchestrates behavior for `ensureGrokEmptyCanvas`.

### `collectExistingProjectVideos()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(sceneDir, currentSceneId = 0)`
* **Returns**: `unknown`
* **Calls**: `addMediaFileToGrokCanvas()`, `sleep()`, `pathExists()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `collectExistingProjectVideos`.

### `restoreProjectKeyframesToChatGPT()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page, sceneDir, sceneId = 0)`
* **Returns**: `unknown`
* **Calls**: `uploadFileViaCdp()`, `sleep()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `restoreProjectKeyframesToChatGPT`.

### `waitForGrokUploadSettled()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page, sceneId = "")`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `evaluateOnCdpPage()`
* **Called By**: `closeGrokTemplateModal()`, `validateGeneratedVideoFile()`
* **Description**: Orchestrates behavior for `waitForGrokUploadSettled`.

### `summarizeGrokSendState()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(state = {})`
* **Returns**: `unknown`
* **Calls**: `sanitizeGrokUrlForLog()`, `appendAppLog()`
* **Called By**: `waitForGrokSendPreflight()`, `submitGrokVideoPrompt()`
* **Description**: Orchestrates behavior for `summarizeGrokSendState`.

### `waitForGrokSendPreflight()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, prompt, options = {})`
* **Returns**: `unknown`
* **Calls**: `summarizeGrokSendState()`, `sleep()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: `clickGrokSendButtonOnce()`, `submitGrokVideoPrompt()`
* **Description**: Orchestrates behavior for `waitForGrokSendPreflight`.

### `clickGrokSendButtonOnce()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, sceneId = "")`
* **Returns**: `unknown`
* **Calls**: `ensureGrokImagineAgentPage()`, `waitForGrokSendPreflight()`, `uploadFileViaCdp()`, `sleep()`, `clickGrokRetryButton()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: `submitGrokVideoPrompt()`
* **Description**: Orchestrates behavior for `clickGrokSendButtonOnce`.

### `clearGrokCanvasSelection()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page)`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `evaluateOnCdpPage()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `clearGrokCanvasSelection`.

### `buildGrokSafeMotionPrompt()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(originalPrompt = "", retryCount = 1)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `recoverGrokAfterContentPolicy()`
* **Description**: Orchestrates behavior for `buildGrokSafeMotionPrompt`.

### `recoverGrokAfterContentPolicy()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page, options = {})`
* **Returns**: `unknown`
* **Calls**: `buildGrokSafeMotionPrompt()`, `recoverGrokCanvasAfterLimit()`, `clearGrokCanvasChat()`, `confirmGrokVideoGenerationIfAsked()`, `submitGrokVideoPrompt()`
* **Called By**: `waitForNewVideoUrl()`
* **Description**: Orchestrates behavior for `recoverGrokAfterContentPolicy`.

### `recoverGrokCanvasAfterLimit()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page, options = {})`
* **Returns**: `unknown`
* **Calls**: `ensureGrokEmptyCanvas()`, `clearGrokCanvasChat()`, `confirmGrokVideoGenerationIfAsked()`, `uploadFileViaCdp()`, `submitGrokVideoPrompt()`, `evaluateOnCdpPage()`
* **Called By**: `recoverGrokAfterContentPolicy()`
* **Description**: Orchestrates behavior for `recoverGrokCanvasAfterLimit`.

### `addMediaFileToGrokCanvas()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, filePath, mediaType = "image")`
* **Returns**: `unknown`
* **Calls**: `waitForGrokUploadedAsset()`, `clickGrokUploadAndChooseFile()`
* **Called By**: `collectExistingProjectVideos()`
* **Description**: Orchestrates behavior for `addMediaFileToGrokCanvas`.

### `labelGrokCanvas()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page, sceneId = "", sceneDir = "")`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: `validateGeneratedVideoFile()`
* **Description**: Orchestrates behavior for `labelGrokCanvas`.

### `clearGrokCanvasChat()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page, sceneId = "")`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: `validateGeneratedVideoFile()`, `recoverGrokAfterContentPolicy()`, `recoverGrokCanvasAfterLimit()`
* **Description**: Orchestrates behavior for `clearGrokCanvasChat`.

### `confirmGrokVideoGenerationIfAsked()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page, sceneId = "")`
* **Returns**: `unknown`
* **Calls**: `sendGrokConfirmationText()`, `sleep()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: `validateGeneratedVideoFile()`, `recoverGrokAfterContentPolicy()`, `recoverGrokCanvasAfterLimit()`
* **Description**: Orchestrates behavior for `confirmGrokVideoGenerationIfAsked`.

### `sendGrokConfirmationText()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(page, text)`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: `confirmGrokVideoGenerationIfAsked()`
* **Description**: Orchestrates behavior for `sendGrokConfirmationText`.

### `waitForCdpAssistantResponse()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, beforeCount)`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `close()`, `evaluateOnCdpPage()`
* **Called By**: `sendPromptViaWeb()`
* **Description**: Orchestrates behavior for `waitForCdpAssistantResponse`.

### `waitForNewImageUrl()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, existingUrls = [])`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `evaluateOnCdpPage()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `waitForNewImageUrl`.

### `selectChatGptConversationByTitle()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, title = "")`
* **Returns**: `unknown`
* **Calls**: `sanitizeChatTitleForLog()`, `getChatGptLocationState()`, `updateChatGptConversationIdentity()`, `norm()`, `getChatTitleStableKey()`, `markChatTitleStable()`, `isChatTitleStable()`, `sleep()`, `waitForCdpLoad()`, `evaluateOnCdpPage()`, `waitForChatGptRecentItem()`, `checkChatGptCurrentConversationTitle()`, `appendAppLog()`, `isSameChatTitle()`
* **Called By**: `updateChatGptConversationIdentity()`
* **Description**: Orchestrates behavior for `selectChatGptConversationByTitle`.

### `norm()`

* **Located in**: [chatgpt_send.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_send.js)
* **Parameters**: `(v)`
* **Returns**: `unknown`
* **Calls**: `listWebAccountsSafe()`, `decodeImageBufferToPng()`, `validateSavedImageFile()`, `appendAppLog()`, `isChatGptDotLoadingCanvasAsset()`
* **Called By**: `selectChatGptConversationByTitle()`, `autoRunRoute()`, `isSendButton()`, `isStopButton()`, `checkChatGptCurrentConversationTitle()`
* **Description**: Orchestrates behavior for `norm`.

### `getChatTitleStableKey()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(pathname = "", title = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `selectChatGptConversationByTitle()`, `markChatTitleStable()`, `isChatTitleStable()`
* **Description**: Orchestrates behavior for `getChatTitleStableKey`.

### `markChatTitleStable()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(pathname = "", title = "", ok = false)`
* **Returns**: `unknown`
* **Calls**: `getChatTitleStableKey()`
* **Called By**: `selectChatGptConversationByTitle()`, `renameChatGptCurrentConversationUntilTitle()`
* **Description**: Orchestrates behavior for `markChatTitleStable`.

### `isChatTitleStable()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(pathname = "", title = "")`
* **Returns**: `unknown`
* **Calls**: `getChatTitleStableKey()`
* **Called By**: `selectChatGptConversationByTitle()`, `renameChatGptCurrentConversationUntilTitle()`
* **Description**: Orchestrates behavior for `isChatTitleStable`.

### `renameChatGptCurrentConversation()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, title = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `renameChatGptCurrentConversationUntilTitle()`
* **Description**: Orchestrates behavior for `renameChatGptCurrentConversation`.

### `waitForNewVideoUrl()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, existingUrls = [], options = {})`
* **Returns**: `unknown`
* **Calls**: `loginRequiredMessage()`, `notifyRenderer()`, `recoverGrokAfterContentPolicy()`, `sleep()`, `evaluateOnCdpPage()`, `appendAppLog()`, `makeRetryableGrokGenerationError()`
* **Called By**: `validateGeneratedVideoFile()`
* **Description**: Orchestrates behavior for `waitForNewVideoUrl`.

### `downloadBrowserAsset()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, url, outputPath)`
* **Returns**: `unknown`
* **Calls**: `evaluateOnCdpPage()`
* **Called By**: `validateGeneratedVideoFile()`
* **Description**: Orchestrates behavior for `downloadBrowserAsset`.

### `captureLatestImageElement()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, outputPath, expectedRef = "")`
* **Returns**: `unknown`
* **Calls**: `evaluateOnCdpPage()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `captureLatestImageElement`.

### `checkAssetExists()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, filePath)`
* **Returns**: `unknown`
* **Calls**: `pathExists()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `checkAssetExists`.

### `getAssetStat()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, filePath)`
* **Returns**: `unknown`
* **Calls**: `getFileStat()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getAssetStat`.

### `waitForGrokUploadedAsset()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, timeoutMs = 45000)`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: `addMediaFileToGrokCanvas()`, `uploadFileViaCdp()`
* **Description**: Orchestrates behavior for `waitForGrokUploadedAsset`.

### `clickGrokUploadAndChooseFile()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, filePath)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `addMediaFileToGrokCanvas()`, `uploadFileViaCdp()`
* **Description**: Orchestrates behavior for `clickGrokUploadAndChooseFile`.

### `handler()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: `setFirstFileInput()`, `sleep()`, `evaluateOnCdpPage()`
* **Called By**: `safeIpcHandler()`
* **Description**: Orchestrates behavior for `handler`.

### `setFirstFileInput()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, filePath)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `handler()`
* **Description**: Orchestrates behavior for `setFirstFileInput`.

### `uploadFileViaCdp()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, filePath, provider = "grok")`
* **Returns**: `unknown`
* **Calls**: `ensureGrokImagineAgentPage()`, `assertGrokImagineAgentReady()`, `waitForGrokUploadedAsset()`, `clickGrokUploadAndChooseFile()`, `pasteImageViaClipboard()`, `sleep()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: `closeGrokTemplateModal()`, `validateGeneratedVideoFile()`, `restoreProjectKeyframesToChatGPT()`, `clickGrokSendButtonOnce()`, `recoverGrokCanvasAfterLimit()`, `retryMotionPrompt()`
* **Description**: Orchestrates behavior for `uploadFileViaCdp`.

### `pasteImageViaClipboard()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, imagePath, target = "composer")`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: `uploadFileViaCdp()`
* **Description**: Orchestrates behavior for `pasteImageViaClipboard`.

### `submitPixVersePrompt()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, prompt, config = {})`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `evaluateOnCdpPage()`
* **Called By**: `validateGeneratedVideoFile()`
* **Description**: Orchestrates behavior for `submitPixVersePrompt`.

### `submitGrokVideoPrompt()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, prompt, config = {})`
* **Returns**: `unknown`
* **Calls**: `ensureGrokImagineAgentPage()`, `assertGrokImagineAgentReady()`, `summarizeGrokSendState()`, `waitForGrokSendPreflight()`, `clickGrokSendButtonOnce()`, `sleep()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: `validateGeneratedVideoFile()`, `recoverGrokAfterContentPolicy()`, `recoverGrokCanvasAfterLimit()`
* **Description**: Orchestrates behavior for `submitGrokVideoPrompt`.

### `pressEnterToSubmit()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `assertPipelineRunActive()`, `evaluateOnCdpPage()`, `appendAppLog()`, `getScopedPipelineRunId()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `pressEnterToSubmit`.

### `sleep()`

* **Located in**: [utils.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/utils/utils.js)
* **Parameters**: `(ms)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `getChatGptLocationState()`, `ensureChromeDebug()`, `waitForStableFileSize()`, `checkWebLogin()`, `clearProviderSession()`, `waitForGrokImagineReady()`, `waitForGrokImagineAgentReady()`, `ensureGrokImagineAgentPage()`, `closeGrokTemplateModal()`, `validateGeneratedVideoFile()`, `ensureGrokEmptyCanvas()`, `collectExistingProjectVideos()`, `restoreProjectKeyframesToChatGPT()`, `waitForGrokUploadSettled()`, `waitForGrokSendPreflight()`, `clickGrokSendButtonOnce()`, `clearGrokCanvasSelection()`, `labelGrokCanvas()`, `clearGrokCanvasChat()`, `confirmGrokVideoGenerationIfAsked()`, `sendGrokConfirmationText()`, `waitForCdpAssistantResponse()`, `waitForNewImageUrl()`, `selectChatGptConversationByTitle()`, `waitForNewVideoUrl()`, `waitForGrokUploadedAsset()`, `handler()`, `uploadFileViaCdp()`, `pasteImageViaClipboard()`, `submitPixVersePrompt()`, `submitGrokVideoPrompt()`, `pressEnterToSubmit()`, `findClickable()`, `clickExact()`, `pipelineDelay()`, `waitForCdpLoad()`, `isPipelineCancelledError()`, `initChatGptPipeline()`, `refreshChatGptPageBeforeImageExtract()`, `waitForLatestChatGPTGeneratedImage()`, `resendImagePrompt()`, `retryMotionPrompt()`, `renameChatGptCurrentConversationUntilTitle()`, `waitForChatGptRecentItem()`, `isValidChatGptConversationUrl()`, `assertPipelineRunActive()`, `detectLoginWithRetry()`, `recoverChatGptBlockingUi()`, `forceCleanChatGptNewChatRotation()`, `waitForHeavyChatGptPromptDomCooldown()`, `sendPromptViaCdpInput()`, `sendPromptViaCdpInputSingle()`, `focusNv2ComposerWithCdp()`, `sendNv2PromptViaDeepCdpInput()`, `vidoraClickChatGptRealSendButton()`, `vidoraChatGptInputGate()`, `verifyAttachmentsReady()`, `uploadFileToChatGptDirectly()`, `runScenePipelineLocked()`, `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `sleep`.

### `onCancel()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(error)`
* **Returns**: `unknown`
* **Calls**: `assertPipelineRunActive()`, `cleanup()`, `registerPipelineWaiter()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `onCancel`.

### `downloadAssetInPageScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(url)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `downloadAssetInPageScript`.

### `fillProviderLoginScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(provider, email, password)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `fillProviderLoginScript`.

### `setValue()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(node, value)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `clickButton()`
* **Description**: Orchestrates behavior for `setValue`.

### `clickButton()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(pattern)`
* **Returns**: `unknown`
* **Calls**: `textOf()`, `setValue()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `clickButton`.

### `detectVideoCapabilityScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(provider)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `detectVideoCapabilityScript`.

### `getPromptInputCandidates()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `clickChatGptStartNewChatScript()`, `fold()`, `normalize()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getPromptInputCandidates`.

### `clickChatGptStartNewChatScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `getPromptInputCandidates()`, `sendPromptScript()`
* **Description**: Orchestrates behavior for `clickChatGptStartNewChatScript`.

### `fold()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(value)`
* **Returns**: `unknown`
* **Calls**: `normalize()`, `prepareChatGptCreateImageScript()`
* **Called By**: `getPromptInputCandidates()`, `isUnsafeDismissTarget()`, `isExactDismissText()`
* **Description**: Orchestrates behavior for `fold`.

### `collectVideoUrlsScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `collectVideoUrlsScript`.

### `detectGrokPageFailureScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `detectGrokPageFailureScript`.

### `getGrokReadyStateScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `visible()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getGrokReadyStateScript`.

### `getGrokRouteStateScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `textOf()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getGrokRouteStateScript`.

### `detectGrokTemplateModalScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `detectGrokTemplateModalScript`.

### `closeGrokTemplateModalScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `visible()`, `textOf()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `closeGrokTemplateModalScript`.

### `getGrokTemplateViewportFallbackPointsScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `visible()`, `textOf()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getGrokTemplateViewportFallbackPointsScript`.

### `scanGrokTemplateModalScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `textOf()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `scanGrokTemplateModalScript`.

### `selectGrokPhotoVideoTemplateScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `textOf()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `selectGrokPhotoVideoTemplateScript`.

### `forceHideGrokTemplateModalScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `visible()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `forceHideGrokTemplateModalScript`.

### `prepareGrokVideoComposerScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(config = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `prepareGrokVideoComposerScript`.

### `clickNode()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(node)`
* **Returns**: `unknown`
* **Calls**: `ensureAndMigratePrompts()`, `appendAppLog()`, `getUserPromptDir()`, `textOf()`
* **Called By**: `findClickable()`, `clickExact()`, `isExactDismissText()`
* **Description**: Orchestrates behavior for `clickNode`.

### `findClickable()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(pattern)`
* **Returns**: `unknown`
* **Calls**: `textOf()`, `sleep()`, `clickNode()`
* **Called By**: `clickExact()`
* **Description**: Orchestrates behavior for `findClickable`.

### `clickExact()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(pattern)`
* **Returns**: `unknown`
* **Calls**: `textOf()`, `sleep()`, `clickNode()`, `findClickable()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `clickExact`.

### `preparePixVerseComposerScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(config = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `preparePixVerseComposerScript`.

### `setPixVersePromptScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(prompt)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `setPixVersePromptScript`.

### `setGrokComposerTextScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(text)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `setGrokComposerTextScript`.

### `focusGrokComposerScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `focusGrokComposerScript`.

### `labelGrokCanvasScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(label)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `labelGrokCanvasScript`.

### `clearGrokCanvasChatScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `clearGrokCanvasChatScript`.

### `clickGrokUploadImageMenuItemScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `clickGrokUploadImageMenuItemScript`.

### `clickGrokCanvasUploadImageScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `clickGrokCanvasUploadImageScript`.

### `focusGrokWorkspaceScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `focusGrokWorkspaceScript`.

### `setGrokVideoPromptScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(prompt)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `setGrokVideoPromptScript`.

### `detectGrokConfirmationQuestionScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `detectGrokConfirmationQuestionScript`.

### `getGrokSendPreflightScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(expectedPrompt = "", options = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getGrokSendPreflightScript`.

### `boxOf()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(node)`
* **Returns**: `unknown`
* **Calls**: `textOf()`, `normalize()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `boxOf`.

### `normalize()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(value = "")`
* **Returns**: `unknown`
* **Calls**: `pathExists()`, `visible()`
* **Called By**: `getPromptInputCandidates()`, `boxOf()`, `findChatGptConversationScript()`, `autoRunRoute()`, `dismissChatGptBlockingUiScript()`, `fold()`, `detectChatGptResponseChoiceUiScript()`, `nearComposer()`, `inspectAndClickChatGptSendButtonSafely()`, `isLikelyChatGptSendButtonText()`, `normalizeChatGptRetryText()`
* **Description**: Orchestrates behavior for `normalize`.

### `detectGrokUploadStateScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `detectGrokUploadStateScript`.

### `clickGrokComposerAreaScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `clickGrokComposerAreaScript`.

### `dismissGrokConnectorsScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `textOf()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `dismissGrokConnectorsScript`.

### `forceGrokVideoModeScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `textOf()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `forceGrokVideoModeScript`.

### `captureGrokSubmitStateScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `captureGrokSubmitStateScript`.

### `detectGrokGeneratingStateScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(before = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `detectGrokGeneratingStateScript`.

### `detectGrokGenerationProblemScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `detectGrokGenerationProblemScript`.

### `clickGrokRetryButton()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(client, state = null)`
* **Returns**: `unknown`
* **Calls**: `evaluateOnCdpPage()`
* **Called By**: `clickGrokSendButtonOnce()`
* **Description**: Orchestrates behavior for `clickGrokRetryButton`.

### `clickGrokGenerateScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `clickGrokGenerateScript`.

### `clickPixVerseCreateScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `clickPixVerseCreateScript`.

### `readLatestAssistantScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `readLatestAssistantScript`.

### `readAssistantAfterIndexScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(minCount = 0)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `readAssistantAfterIndexScript`.

### `findChatGptConversationScript()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(title = "")`
* **Returns**: `unknown`
* **Calls**: `normalize()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `findChatGptConversationScript`.

### `runVeoUpAutomation()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, payload = {})`
* **Returns**: `unknown`
* **Calls**: `exportProject()`, `assertPipelineRunActive()`, `isPipelineCancelledError()`, `on()`, `appendAppLog()`, `writeCrashLog()`, `vidoraTraceExit()`, `getScopedPipelineRunId()`, `isPipelineRunCancelled()`, `trackPipelineChildProcess()`, `sanitizeFileName()`, `executeVeoUpAutomation()`
* **Called By**: `maybeRunVeoUpAutomationAfterPipeline()`
* **Description**: Orchestrates behavior for `runVeoUpAutomation`.

### `exportProject()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `appendAppLog()`, `buildCsv()`, `setStatus()`
* **Called By**: `runVeoUpAutomation()`
* **Description**: Orchestrates behavior for `exportProject`.

### `getVeoUpCoordinateConfigHandler()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `getVeoUpCoordinateConfig()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getVeoUpCoordinateConfigHandler`.

### `startVeoUpCoordinateSetupHandler()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, payload = {})`
* **Returns**: `unknown`
* **Calls**: `startCoordinateSetup()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `startVeoUpCoordinateSetupHandler`.

### `captureVeoUpCoordinateHandler()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, pointType)`
* **Returns**: `unknown`
* **Calls**: `captureVeoUpCoordinate()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `captureVeoUpCoordinateHandler`.

### `saveVeoUpCoordinateConfigHandler()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, config)`
* **Returns**: `unknown`
* **Calls**: `saveVeoUpCoordinateConfig()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `saveVeoUpCoordinateConfigHandler`.

### `deleteVeoUpCoordinateConfigHandler()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, payload = {})`
* **Returns**: `unknown`
* **Calls**: `deleteVeoUpCoordinateConfig()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `deleteVeoUpCoordinateConfigHandler`.

### `cancelVeoUpCoordinateSetupHandler()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `cancelCoordinateSetup()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `cancelVeoUpCoordinateSetupHandler`.

### `scanProjectAndRunVeoUpHandler()`

* **Located in**: [main.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main.js)
* **Parameters**: `(_event, payload = {})`
* **Returns**: `unknown`
* **Calls**: `closeChromeDebug()`, `initBootstrap()`, `initializeApplication()`, `createMainWindow()`, `on()`, `getChatGptSendState()`, `isReloadBlocked()`, `appendAppLog()`, `writeCrashLog()`, `checkIfAllScenesComplete()`, `findSceneKeyframePathSafe()`, `getVeoUpCoordinateConfig()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `scanProjectAndRunVeoUpHandler`.

### `listener()`

* **Located in**: [preload.js](file:///d:/bac_tai/Grok-bac-Tai/electron/preload.js)
* **Parameters**: `(_event, command)`
* **Returns**: `unknown`
* **Calls**: `on()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `listener`.

### `normalizeSceneDuration()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(value)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `applySceneDurationValue()`, `getVideoProviderConfig()`, `getPreviewTimeline()`, `getProjectSessionPayload()`, `normalizeProjectSessionForRenderer()`
* **Description**: Orchestrates behavior for `normalizeSceneDuration`.

### `applySceneDurationValue()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(value)`
* **Returns**: `unknown`
* **Calls**: `normalizeSceneDuration()`
* **Called By**: `createProject()`, `applyProjectSessionPayload()`, `createBlankProjectFromName()`, `restore()`
* **Description**: Orchestrates behavior for `applySceneDurationValue`.

### `getReviewSettings()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `shouldSkipReview()`, `getProjectSessionPayload()`, `persist()`
* **Description**: Orchestrates behavior for `getReviewSettings`.

### `shouldSkipReview()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(type = 'all')`
* **Returns**: `unknown`
* **Calls**: `getReviewSettings()`
* **Called By**: `runFullPipeline()`, `getProjectSessionPayload()`
* **Description**: Orchestrates behavior for `shouldSkipReview`.

### `applyReviewSettings()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(settings = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `applyProjectSessionPayload()`, `restore()`
* **Description**: Orchestrates behavior for `applyReviewSettings`.

### `isKeyframeMotionPromptOnlyModeEnabled()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `createProject()`, `sceneHasRequiredOutputForCurrentMode()`, `forceResumeFirstIncompleteSceneIfNeeded()`, `runFullPipeline()`, `maybeRunVeoUpAutomationAfterPipeline()`, `autoRunRoute()`, `getProjectSessionPayload()`, `persist()`, `restore()`
* **Description**: Orchestrates behavior for `isKeyframeMotionPromptOnlyModeEnabled`.

### `applyPipelineModeSettings()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(settings = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `applyProjectSessionPayload()`, `restore()`
* **Description**: Orchestrates behavior for `applyPipelineModeSettings`.

### `getContinuityReferenceSettings()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `createProject()`, `runFullPipeline()`, `getRuntimeSnapshot()`, `getProjectSessionPayload()`, `persist()`
* **Description**: Orchestrates behavior for `getContinuityReferenceSettings`.

### `applyContinuityReferenceSettings()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(settings = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `applyProjectSessionPayload()`, `restore()`
* **Description**: Orchestrates behavior for `applyContinuityReferenceSettings`.

### `getGrokRecoverySettings()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `clamp()`
* **Called By**: `getVideoProviderConfig()`, `getProjectSessionPayload()`, `persist()`
* **Description**: Orchestrates behavior for `getGrokRecoverySettings`.

### `applyGrokRecoverySettings()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(settings = {})`
* **Returns**: `unknown`
* **Calls**: `clamp()`
* **Called By**: `applyProjectSessionPayload()`, `restore()`
* **Description**: Orchestrates behavior for `applyGrokRecoverySettings`.

### `getChatGptStabilitySettings()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `getProjectTargetSceneDefault()`, `clamp()`
* **Called By**: `recoverWorkflowRun()`, `runFullPipeline()`, `getProjectSessionPayload()`, `persist()`
* **Description**: Orchestrates behavior for `getChatGptStabilitySettings`.

### `applyChatGptStabilitySettings()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(settings = {})`
* **Returns**: `unknown`
* **Calls**: `getProjectTargetSceneDefault()`, `clamp()`
* **Called By**: `applyProjectSessionPayload()`, `restore()`
* **Description**: Orchestrates behavior for `applyChatGptStabilitySettings`.

### `getProjectTargetSceneDefault()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `clamp()`
* **Called By**: `getChatGptStabilitySettings()`, `applyChatGptStabilitySettings()`, `syncTargetSceneCountToProjectDefault()`, `startPipelineFromClick()`, `restore()`
* **Description**: Orchestrates behavior for `getProjectTargetSceneDefault`.

### `syncTargetSceneCountToProjectDefault()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `getProjectTargetSceneDefault()`
* **Called By**: `createProject()`, `applyProjectSessionPayload()`
* **Description**: Orchestrates behavior for `syncTargetSceneCountToProjectDefault`.

### `buildRecentScenesForHydration()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(currentSceneId = 0, limit = 20)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `runFullPipeline()`
* **Description**: Orchestrates behavior for `buildRecentScenesForHydration`.

### `getImageGenerationSettings()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `runFullPipeline()`, `getRuntimeSnapshot()`, `getProjectSessionPayload()`, `persist()`
* **Description**: Orchestrates behavior for `getImageGenerationSettings`.

### `applyImageGenerationSettings()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(settings = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `applyProjectSessionPayload()`, `restore()`
* **Description**: Orchestrates behavior for `applyImageGenerationSettings`.

### `embedRouterPanelInSettings()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `openSettingsDialog()`, `refreshLabel()`
* **Description**: Orchestrates behavior for `embedRouterPanelInSettings`.

### `moveProjectActionsOutsideSettings()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `openSettingsDialog()`, `refreshLabel()`
* **Description**: Orchestrates behavior for `moveProjectActionsOutsideSettings`.

### `openSettingsDialog()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `embedRouterPanelInSettings()`, `moveProjectActionsOutsideSettings()`, `updateVeoUpSetupUI()`
* **Called By**: `refreshLabel()`
* **Description**: Orchestrates behavior for `openSettingsDialog`.

### `saveSettingsDialog()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `setStatus()`, `persist()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `saveSettingsDialog`.

### `createPipelineRunId()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `beginPipelineRun()`
* **Description**: Orchestrates behavior for `createPipelineRunId`.

### `getActivePipelineRunId()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `isPipelineRunActive()`, `pipelineDelay()`, `schedulePipelineTimer()`, `finishPipelineRun()`, `stopPipelineFromClick()`, `queueAutoContinue()`, `runFullPipeline()`, `maybeRunVeoUpAutomationAfterPipeline()`, `waitForProviderReady()`, `autoRunRoute()`
* **Description**: Orchestrates behavior for `getActivePipelineRunId`.

### `isPipelineRunActive()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(runId = getActivePipelineRunId()`
* **Returns**: `unknown`
* **Calls**: `getActivePipelineRunId()`, `makePipelineCancelledError()`, `assertPipelineRunActive()`
* **Called By**: `pipelineDelay()`, `schedulePipelineTimer()`, `queueAutoContinue()`
* **Description**: Orchestrates behavior for `isPipelineRunActive`.

### `makePipelineCancelledError()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(runId = getScopedPipelineRunId()`
* **Returns**: `unknown`
* **Calls**: `getScopedPipelineRunId()`
* **Called By**: `isPipelineRunActive()`, `clearPipelineTimers()`, `pipelineDelay()`, `assertPipelineRunActive()`, `cancelPipelineRun()`
* **Description**: Orchestrates behavior for `makePipelineCancelledError`.

### `assertPipelineRunActive()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(runId = getScopedPipelineRunId()`
* **Returns**: `unknown`
* **Calls**: `forceCleanChatGptNewChatRotation()`, `getCdpPage()`, `sleep()`, `waitForCdpLoad()`, `evaluateOnCdpPage()`, `requestReloadWithReason()`, `clickSendButtonViaCdp()`, `appendAppLog()`, `writeSceneSnapshot()`, `setChatGptSendState()`, `captureSnapshot()`, `waitForHeavyChatGptPromptDomCooldown()`, `makePipelineCancelledError()`, `getScopedPipelineRunId()`, `isPipelineRunCancelled()`
* **Called By**: `getChatGptLocationState()`, `extractLastFrameToPathHandler()`, `waitForStableFileSize()`, `validateLocalVideoFile()`, `runFfmpeg()`, `isValidChatGptConversationUrl()`, `pressEnterToSubmit()`, `onCancel()`, `runVeoUpAutomation()`, `isPipelineRunActive()`, `pipelineDelay()`, `schedulePipelineTimer()`, `queueAutoContinue()`, `runFullPipeline()`, `maybeRunVeoUpAutomationAfterPipeline()`, `waitForProviderReady()`, `autoRunRoute()`, `isPipelineCancelledError()`, `initChatGptPipeline()`, `waitForLatestChatGPTGeneratedImage()`, `retryMotionPrompt()`, `forceCleanChatGptNewChatRotation()`, `focusNv2ComposerWithCdp()`, `runScenePipeline()`, `runScenePipelineLocked()`, `runScenePipelineLockedInternal()`, `startNextSceneChatGptPrefetch()`, `isVeoUpStageError()`
* **Description**: Orchestrates behavior for `assertPipelineRunActive`.

### `clearPipelineTimers()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(runId = '')`
* **Returns**: `unknown`
* **Calls**: `makePipelineCancelledError()`
* **Called By**: `finishPipelineRun()`, `stopPipelineFromClick()`
* **Description**: Orchestrates behavior for `clearPipelineTimers`.

### `hasPipelineTimers()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(runId = '')`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `autoRunRoute()`
* **Description**: Orchestrates behavior for `hasPipelineTimers`.

### `pipelineDelay()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(ms, runId = getActivePipelineRunId()`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `getActivePipelineRunId()`, `isPipelineRunActive()`, `makePipelineCancelledError()`, `assertPipelineRunActive()`
* **Called By**: `runFullPipeline()`, `waitForProviderReady()`
* **Description**: Orchestrates behavior for `pipelineDelay`.

### `schedulePipelineTimer()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(callback, delay = 0, runId = getActivePipelineRunId()`
* **Returns**: `unknown`
* **Calls**: `getActivePipelineRunId()`, `isPipelineRunActive()`, `assertPipelineRunActive()`
* **Called By**: `queueAutoContinue()`, `runFullPipeline()`
* **Description**: Orchestrates behavior for `schedulePipelineTimer`.

### `updateStopPipelineControls()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `beginPipelineRun()`, `finishPipelineRun()`, `stopPipelineFromClick()`, `setRunning()`
* **Description**: Orchestrates behavior for `updateStopPipelineControls`.

### `beginPipelineRun()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `createPipelineRunId()`, `updateStopPipelineControls()`
* **Called By**: `runFullPipeline()`, `startPipelineFromClick()`, `autoRunRoute()`
* **Description**: Orchestrates behavior for `beginPipelineRun`.

### `finishPipelineRun()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(runId = getActivePipelineRunId()`
* **Returns**: `unknown`
* **Calls**: `getActivePipelineRunId()`, `clearPipelineTimers()`, `updateStopPipelineControls()`, `isPipelineCancelledError()`, `setRunning()`
* **Called By**: `stopPipelineFromClick()`, `autoRunRoute()`
* **Description**: Orchestrates behavior for `finishPipelineRun`.

### `isPipelineCancelledError()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(error)`
* **Returns**: `unknown`
* **Calls**: `logChatGptStage()`, `loginRequiredMessage()`, `checkProactiveMemoryGuard()`, `getChatGptLocationState()`, `invalidateChatGptConversationIdentity()`, `getCdpPage()`, `sleep()`, `assertPipelineRunActive()`, `close()`, `getConversationState()`, `waitForCdpLoad()`, `evaluateOnCdpPage()`, `startChatGptImageNetworkCapture()`, `stop()`, `saveChatGPTGeneratedImageAsset()`, `decodeImageBufferToPng()`, `validateSavedImageFile()`, `adoptExistingSceneImage()`, `waitForChatGptResponse()`, `tryAutoLoginWithStoredAccount()`, `requestReloadWithReason()`, `clickSendButtonViaCdp()`, `sendPromptViaCdpInput()`, `sendNv2PromptViaDeepCdpInput()`, `appendAppLog()`, `getChatGptContextFresh()`, `hashChatGptSnapshotText()`, `verifyDraftOwnership()`, `writeSceneSnapshot()`, `readSceneSnapshot()`, `pathExists()`
* **Called By**: `runVeoUpAutomation()`, `finishPipelineRun()`, `queueAutoContinue()`, `runFullPipeline()`, `autoRunRoute()`, `refreshChatGptPageBeforeImageExtract()`, `waitForLatestChatGPTGeneratedImage()`, `retryMotionPrompt()`, `runScenePipelineLocked()`
* **Description**: Orchestrates behavior for `isPipelineCancelledError`.

### `stopPipelineFromClick()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: `getActivePipelineRunId()`, `clearPipelineTimers()`, `updateStopPipelineControls()`, `finishPipelineRun()`, `render()`, `setStatus()`, `setRunning()`, `persist()`
* **Called By**: `restore()`
* **Description**: Orchestrates behavior for `stopPipelineFromClick`.

### `queueAutoContinue()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(delay = 350)`
* **Returns**: `unknown`
* **Calls**: `getActivePipelineRunId()`, `isPipelineRunActive()`, `assertPipelineRunActive()`, `schedulePipelineTimer()`, `isPipelineCancelledError()`, `autoRunRoute()`, `render()`, `setStatus()`, `persist()`
* **Called By**: `runFullPipeline()`, `approveCurrentReviewScene()`, `resolveChatAndContinue()`
* **Description**: Orchestrates behavior for `queueAutoContinue`.

### `createProject()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: `applySceneDurationValue()`, `isKeyframeMotionPromptOnlyModeEnabled()`, `getContinuityReferenceSettings()`, `syncTargetSceneCountToProjectDefault()`, `parseScenes()`, `render()`, `setStatus()`, `clamp()`, `markProjectDirty()`, `persist()`
* **Called By**: `autoRunRoute()`, `submitNewProjectDialog()`
* **Description**: Orchestrates behavior for `createProject`.

### `parseScenes()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(script)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `createProject()`
* **Description**: Orchestrates behavior for `parseScenes`.

### `runNextBatch()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `({ regenerate = false } = {})`
* **Returns**: `unknown`
* **Calls**: `syncProjectSceneFolders()`, `buildImagePrompt()`, `buildMotionPrompt()`, `render()`, `setStatus()`, `setRunning()`, `clamp()`, `getSceneRef()`, `persist()`
* **Called By**: `resumeRun()`, `autoRunRoute()`, `restore()`
* **Description**: Orchestrates behavior for `runNextBatch`.

### `syncProjectSceneFolders()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `({ repairFromDisk = false } = {})`
* **Returns**: `unknown`
* **Calls**: `normalizeActiveBatchIdsForRuntime()`
* **Called By**: `runNextBatch()`, `runFullPipeline()`, `applyProjectSessionPayload()`, `saveProjectSessionFlow()`, `openProjectSessionFlow()`
* **Description**: Orchestrates behavior for `syncProjectSceneFolders`.

### `generateWithProvider()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene)`
* **Returns**: `unknown`
* **Calls**: `generateScenePrompts()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `generateWithProvider`.

### `buildImagePrompt()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `runNextBatch()`, `sendCurrentBatchViaWeb()`, `runFullPipeline()`
* **Description**: Orchestrates behavior for `buildImagePrompt`.

### `buildMotionPrompt()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `runNextBatch()`, `sendCurrentBatchViaWeb()`
* **Description**: Orchestrates behavior for `buildMotionPrompt`.

### `approveBatch()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `render()`, `setStatus()`, `persist()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `approveBatch`.

### `pauseRun()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `render()`, `setStatus()`, `markProjectDirty()`, `persist()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `pauseRun`.

### `resumeRun()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `runNextBatch()`, `autoRunRoute()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `resumeRun`.

### `findFirstIncompleteSceneForWorkflow()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `sceneHasVideoOutput()`
* **Called By**: `recoverWorkflowRun()`
* **Description**: Orchestrates behavior for `findFirstIncompleteSceneForWorkflow`.

### `recoverWorkflowRun()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `chooseOutputFolder()`, `getChatGptStabilitySettings()`, `findFirstIncompleteSceneForWorkflow()`, `autoRunRoute()`, `render()`, `setStatus()`, `persist()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `recoverWorkflowRun`.

### `openChatGptWindow()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `setStatus()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `openChatGptWindow`.

### `openFreshChatGptWindow()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `setStatus()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `openFreshChatGptWindow`.

### `clearChatGptCache()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `setStatus()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `clearChatGptCache`.

### `importCharacterPresetsFlow()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `setStatus()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `importCharacterPresetsFlow`.

### `checkSelectedWebLogin()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `checkWebLogin()`, `getSelectedWebProvider()`, `render()`
* **Called By**: `sendCurrentBatchViaWeb()`
* **Description**: Orchestrates behavior for `checkSelectedWebLogin`.

### `sendCurrentBatchViaWeb()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `chooseOutputFolder()`, `sendPromptViaWeb()`, `buildImagePrompt()`, `buildMotionPrompt()`, `checkSelectedWebLogin()`, `getSelectedWebProvider()`, `render()`, `setStatus()`, `persist()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `sendCurrentBatchViaWeb`.

### `ensureChatChoiceFields()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `runFullPipeline()`
* **Description**: Orchestrates behavior for `ensureChatChoiceFields`.

### `shouldAskChatGptChatChoice()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `shouldAskChatGptChatChoice`.

### `requireChatGptChatChoiceBeforeRun()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `runFullPipeline()`
* **Description**: Orchestrates behavior for `requireChatGptChatChoiceBeforeRun`.

### `getSceneVideoPathValue()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getSceneVideoPathValue`.

### `getSceneKeyframePathValue()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getSceneKeyframePathValue`.

### `hasValidSceneOutputPath()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(value)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `sceneHasRequiredOutputForCurrentMode()`
* **Description**: Orchestrates behavior for `hasValidSceneOutputPath`.

### `sceneHasRequiredOutputForCurrentMode()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene)`
* **Returns**: `unknown`
* **Calls**: `isKeyframeMotionPromptOnlyModeEnabled()`, `hasValidSceneOutputPath()`
* **Called By**: `findFirstIncompleteSceneBefore()`, `sceneHasVideoOutput()`
* **Description**: Orchestrates behavior for `sceneHasRequiredOutputForCurrentMode`.

### `findFirstIncompleteSceneBefore()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(sceneId)`
* **Returns**: `unknown`
* **Calls**: `sceneHasRequiredOutputForCurrentMode()`
* **Called By**: `shouldBlockSceneBecausePreviousVideoMissing()`
* **Description**: Orchestrates behavior for `findFirstIncompleteSceneBefore`.

### `shouldBlockSceneBecausePreviousVideoMissing()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene)`
* **Returns**: `unknown`
* **Calls**: `findFirstIncompleteSceneBefore()`
* **Called By**: `runFullPipeline()`
* **Description**: Orchestrates behavior for `shouldBlockSceneBecausePreviousVideoMissing`.

### `safeAddPipelineLog()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(source, kind, text, details = null)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `forceResumeFirstIncompleteSceneIfNeeded()`, `runFullPipeline()`
* **Description**: Orchestrates behavior for `safeAddPipelineLog`.

### `sceneHasVideoOutput()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene)`
* **Returns**: `unknown`
* **Calls**: `sceneHasRequiredOutputForCurrentMode()`
* **Called By**: `findFirstIncompleteSceneForWorkflow()`, `findFirstSceneMissingVideo()`, `forceResumeFirstIncompleteSceneIfNeeded()`, `getCompletedScenesCount()`, `getNextBatchForSegment()`, `runFullPipeline()`, `isSceneCompleteForVeoUp()`, `autoRunRoute()`, `handleTableClick()`, `renderAssetReviewModal()`
* **Description**: Orchestrates behavior for `sceneHasVideoOutput`.

### `findFirstSceneMissingVideo()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `sceneHasVideoOutput()`
* **Called By**: `forceResumeFirstIncompleteSceneIfNeeded()`
* **Description**: Orchestrates behavior for `findFirstSceneMissingVideo`.

### `forceResumeFirstIncompleteSceneIfNeeded()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `isKeyframeMotionPromptOnlyModeEnabled()`, `safeAddPipelineLog()`, `sceneHasVideoOutput()`, `findFirstSceneMissingVideo()`
* **Called By**: `runFullPipeline()`
* **Description**: Orchestrates behavior for `forceResumeFirstIncompleteSceneIfNeeded`.

### `getCompletedScenesCount()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `sceneHasVideoOutput()`
* **Called By**: `runFullPipeline()`
* **Description**: Orchestrates behavior for `getCompletedScenesCount`.

### `getNextBatchForSegment()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(doneSceneId = 0)`
* **Returns**: `unknown`
* **Calls**: `sceneHasVideoOutput()`, `clamp()`
* **Called By**: `runFullPipeline()`
* **Description**: Orchestrates behavior for `getNextBatchForSegment`.

### `runFullPipeline()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `extractLastFrameToPath()`, `chooseOutputFolder()`, `shouldSkipReview()`, `isKeyframeMotionPromptOnlyModeEnabled()`, `getContinuityReferenceSettings()`, `getChatGptStabilitySettings()`, `buildRecentScenesForHydration()`, `getImageGenerationSettings()`, `getActivePipelineRunId()`, `assertPipelineRunActive()`, `pipelineDelay()`, `schedulePipelineTimer()`, `beginPipelineRun()`, `isPipelineCancelledError()`, `queueAutoContinue()`, `syncProjectSceneFolders()`, `buildImagePrompt()`, `ensureChatChoiceFields()`, `requireChatGptChatChoiceBeforeRun()`, `shouldBlockSceneBecausePreviousVideoMissing()`, `safeAddPipelineLog()`, `sceneHasVideoOutput()`, `forceResumeFirstIncompleteSceneIfNeeded()`, `getCompletedScenesCount()`, `getNextBatchForSegment()`, `isSceneCompleteForVeoUp()`, `maybeRunVeoUpAutomationAfterPipeline()`, `getSelectedVideoPlatform()`, `getVideoProviderConfig()`, `isRetryableChatGptWorkflowError()`, `parseLoginRequiredError()`, `recoverLoginAndRetryScene()`, `render()`, `setStatus()`, `openAssetReview()`, `mergeAndShowFinalPreview()`, `getSceneRef()`, `getNextResumeAction()`, `openChatResolveDialog()`, `persist()`, `runScenePipeline()`
* **Called By**: `autoRunRoute()`
* **Description**: Orchestrates behavior for `runFullPipeline`.

### `isSceneCompleteForVeoUp()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene)`
* **Returns**: `unknown`
* **Calls**: `sceneHasVideoOutput()`
* **Called By**: `runFullPipeline()`
* **Description**: Orchestrates behavior for `isSceneCompleteForVeoUp`.

### `isProjectCompleteForVeoUp()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `maybeRunVeoUpAutomationAfterPipeline()`
* **Description**: Orchestrates behavior for `isProjectCompleteForVeoUp`.

### `maybeRunVeoUpAutomationAfterPipeline()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(reason = 'pipeline-complete', runId = getActivePipelineRunId()`
* **Returns**: `unknown`
* **Calls**: `runVeoUpAutomation()`, `isKeyframeMotionPromptOnlyModeEnabled()`, `getActivePipelineRunId()`, `assertPipelineRunActive()`, `isProjectCompleteForVeoUp()`, `setStatus()`, `persist()`
* **Called By**: `runFullPipeline()`
* **Description**: Orchestrates behavior for `maybeRunVeoUpAutomationAfterPipeline`.

### `getSelectedWebProvider()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `checkSelectedWebLogin()`, `sendCurrentBatchViaWeb()`
* **Description**: Orchestrates behavior for `getSelectedWebProvider`.

### `getSelectedVideoPlatform()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `runFullPipeline()`, `getSelectedVideoAccount()`, `autoRunRoute()`
* **Description**: Orchestrates behavior for `getSelectedVideoPlatform`.

### `getSelectedVideoAccount()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(videoProvider = getSelectedVideoPlatform()`
* **Returns**: `unknown`
* **Calls**: `getSelectedVideoPlatform()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getSelectedVideoAccount`.

### `getVideoProviderConfig()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `normalizeSceneDuration()`, `getGrokRecoverySettings()`
* **Called By**: `runFullPipeline()`, `estimatePixVerseEnergy()`, `isPixVerseProConfig()`, `updatePixVerseConfigAdvice()`
* **Description**: Orchestrates behavior for `getVideoProviderConfig`.

### `syncVideoPlatformConfig()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `updatePixVerseConfigAdvice()`
* **Called By**: `applyProjectSessionPayload()`, `restore()`, `refreshLabel()`
* **Description**: Orchestrates behavior for `syncVideoPlatformConfig`.

### `estimatePixVerseEnergy()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(config = getVideoProviderConfig()`
* **Returns**: `unknown`
* **Calls**: `getVideoProviderConfig()`
* **Called By**: `suggestPixVerseConfig()`, `updatePixVerseConfigAdvice()`
* **Description**: Orchestrates behavior for `estimatePixVerseEnergy`.

### `isPixVerseProConfig()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(config = getVideoProviderConfig()`
* **Returns**: `unknown`
* **Calls**: `getVideoProviderConfig()`
* **Called By**: `suggestPixVerseConfig()`, `updatePixVerseConfigAdvice()`
* **Description**: Orchestrates behavior for `isPixVerseProConfig`.

### `suggestPixVerseConfig()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(energy = 0, hasPro = false)`
* **Returns**: `unknown`
* **Calls**: `estimatePixVerseEnergy()`, `isPixVerseProConfig()`
* **Called By**: `updatePixVerseConfigAdvice()`
* **Description**: Orchestrates behavior for `suggestPixVerseConfig`.

### `updatePixVerseConfigAdvice()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `getVideoProviderConfig()`, `estimatePixVerseEnergy()`, `isPixVerseProConfig()`, `suggestPixVerseConfig()`
* **Called By**: `syncVideoPlatformConfig()`, `applyProjectSessionPayload()`, `restore()`
* **Description**: Orchestrates behavior for `updatePixVerseConfigAdvice`.

### `waitForProviderReady()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(providerValue, label)`
* **Returns**: `unknown`
* **Calls**: `openWebLogin()`, `checkWebLogin()`, `getActivePipelineRunId()`, `assertPipelineRunActive()`, `pipelineDelay()`, `setStatus()`, `close()`
* **Called By**: `recoverLoginAndRetryScene()`, `autoRunRoute()`
* **Description**: Orchestrates behavior for `waitForProviderReady`.

### `isRetryableChatGptWorkflowError()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(message = '')`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `runFullPipeline()`
* **Description**: Orchestrates behavior for `isRetryableChatGptWorkflowError`.

### `parseLoginRequiredError()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(message = '', scene = null)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `runFullPipeline()`
* **Description**: Orchestrates behavior for `parseLoginRequiredError`.

### `recoverLoginAndRetryScene()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(providerValue, scene, message = '')`
* **Returns**: `unknown`
* **Calls**: `waitForProviderReady()`, `render()`, `setStatus()`, `persist()`
* **Called By**: `runFullPipeline()`
* **Description**: Orchestrates behavior for `recoverLoginAndRetryScene`.

### `startPipelineFromClick()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: `getProjectTargetSceneDefault()`, `beginPipelineRun()`, `autoRunRoute()`, `setStatus()`, `clamp()`
* **Called By**: `restore()`
* **Description**: Orchestrates behavior for `startPipelineFromClick`.

### `autoRunRoute()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `chooseOutputFolder()`, `norm()`, `normalize()`, `isKeyframeMotionPromptOnlyModeEnabled()`, `getActivePipelineRunId()`, `assertPipelineRunActive()`, `hasPipelineTimers()`, `beginPipelineRun()`, `finishPipelineRun()`, `isPipelineCancelledError()`, `createProject()`, `runNextBatch()`, `sceneHasVideoOutput()`, `runFullPipeline()`, `getSelectedVideoPlatform()`, `waitForProviderReady()`, `render()`, `setStatus()`, `setRunning()`, `persist()`, `updateVeoUpSetupUI()`, `close()`
* **Called By**: `queueAutoContinue()`, `resumeRun()`, `recoverWorkflowRun()`, `startPipelineFromClick()`
* **Description**: Orchestrates behavior for `autoRunRoute`.

### `buildCsv()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `exportProject()`
* **Description**: Orchestrates behavior for `buildCsv`.

### `render()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `getCurrentReviewScene()`, `renderAssetReviewModal()`, `renderFinalPreview()`, `renderProjectSessionStatus()`, `updateScanButtonVisibility()`
* **Called By**: `stopPipelineFromClick()`, `queueAutoContinue()`, `createProject()`, `runNextBatch()`, `approveBatch()`, `pauseRun()`, `recoverWorkflowRun()`, `chooseOutputFolder()`, `checkSelectedWebLogin()`, `sendCurrentBatchViaWeb()`, `runFullPipeline()`, `recoverLoginAndRetryScene()`, `autoRunRoute()`, `handleTableClick()`, `saveEdit()`, `approveCurrentReviewScene()`, `regenerateCurrentReviewScene()`, `applyProjectSessionPayload()`, `resolveChatAndContinue()`, `createInitialProjectFileInOutputFolder()`, `newProjectSessionFlow()`, `saveProjectSessionFlow()`, `openProjectSessionFlow()`, `restore()`
* **Description**: Orchestrates behavior for `render`.

### `handleTableClick()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: `sceneHasVideoOutput()`, `render()`, `openEditor()`, `copyText()`, `setStatus()`, `markProjectDirty()`, `persist()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `handleTableClick`.

### `openEditor()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene, field)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `handleTableClick()`, `restore()`
* **Description**: Orchestrates behavior for `openEditor`.

### `saveEdit()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `render()`, `markProjectDirty()`, `persist()`, `close()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `saveEdit`.

### `copyText()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(text, button)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `handleTableClick()`
* **Description**: Orchestrates behavior for `copyText`.

### `setStatus()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(text, kind = 'idle')`
* **Returns**: `unknown`
* **Calls**: `appendPipelineLog()`
* **Called By**: `saveSettingsDialog()`, `stopPipelineFromClick()`, `queueAutoContinue()`, `createProject()`, `runNextBatch()`, `approveBatch()`, `pauseRun()`, `recoverWorkflowRun()`, `openChatGptWindow()`, `openFreshChatGptWindow()`, `clearChatGptCache()`, `openWebLogin()`, `chooseOutputFolder()`, `importCharacterPresetsFlow()`, `sendCurrentBatchViaWeb()`, `runFullPipeline()`, `maybeRunVeoUpAutomationAfterPipeline()`, `waitForProviderReady()`, `recoverLoginAndRetryScene()`, `startPipelineFromClick()`, `autoRunRoute()`, `exportProject()`, `handleTableClick()`, `showPipelineNotice()`, `copyPipelineLog()`, `loadTextFileToTextarea()`, `openAssetReview()`, `approveCurrentReviewScene()`, `regenerateCurrentReviewScene()`, `mergeAndShowFinalPreview()`, `openChatResolveDialog()`, `resolveChatAndContinue()`, `createInitialProjectFileInOutputFolder()`, `newProjectSessionFlow()`, `submitNewProjectDialog()`, `saveProjectSessionFlow()`, `openProjectSessionFlow()`, `saveSessionForNextLaunch()`, `restore()`, `refreshLabel()`, `cleanupSetupUI()`
* **Description**: Orchestrates behavior for `setStatus`.

### `summarizeLogDetails()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(details)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `appendPipelineLog()`
* **Description**: Orchestrates behavior for `summarizeLogDetails`.

### `appendPipelineLog()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(text, kind = 'idle', options = {})`
* **Returns**: `unknown`
* **Calls**: `summarizeLogDetails()`, `renderPipelineLog()`
* **Called By**: `setStatus()`, `showPipelineNotice()`
* **Description**: Orchestrates behavior for `appendPipelineLog`.

### `showPipelineNotice()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(payload = {})`
* **Returns**: `unknown`
* **Calls**: `setStatus()`, `appendPipelineLog()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `showPipelineNotice`.

### `formatPipelineLogsForCopy()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `copyPipelineLog()`
* **Description**: Orchestrates behavior for `formatPipelineLogsForCopy`.

### `copyPipelineLog()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `setStatus()`, `formatPipelineLogsForCopy()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `copyPipelineLog`.

### `renderPipelineLog()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `escapeHtml()`
* **Called By**: `appendPipelineLog()`, `setPipelineLogVisible()`, `restore()`, `refreshLabel()`
* **Description**: Orchestrates behavior for `renderPipelineLog`.

### `setPipelineLogVisible()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(visible)`
* **Returns**: `unknown`
* **Calls**: `renderPipelineLog()`
* **Called By**: `refreshLabel()`
* **Description**: Orchestrates behavior for `setPipelineLogVisible`.

### `loadTextFileToTextarea()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(fileInput, textarea, fileNameEl, label)`
* **Returns**: `unknown`
* **Calls**: `setStatus()`, `markProjectDirty()`, `persist()`
* **Called By**: `restore()`
* **Description**: Orchestrates behavior for `loadTextFileToTextarea`.

### `setRunning()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(running)`
* **Returns**: `unknown`
* **Calls**: `updateStopPipelineControls()`
* **Called By**: `finishPipelineRun()`, `stopPipelineFromClick()`, `runNextBatch()`, `autoRunRoute()`
* **Description**: Orchestrates behavior for `setRunning`.

### `statusLabel()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `renderAssetReviewModal()`
* **Description**: Orchestrates behavior for `statusLabel`.

### `renderAssetReview()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene)`
* **Returns**: `unknown`
* **Calls**: `renderImagePreview()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `renderAssetReview`.

### `renderImagePreview()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene)`
* **Returns**: `unknown`
* **Calls**: `escapeHtml()`
* **Called By**: `renderAssetReview()`
* **Description**: Orchestrates behavior for `renderImagePreview`.

### `renderVideoPreview()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene)`
* **Returns**: `unknown`
* **Calls**: `escapeHtml()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `renderVideoPreview`.

### `getCurrentReviewScene()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `render()`, `openAssetReview()`, `renderAssetReviewModal()`, `approveCurrentReviewScene()`, `regenerateCurrentReviewScene()`, `restore()`
* **Description**: Orchestrates behavior for `getCurrentReviewScene`.

### `isReviewable()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `isReviewable`.

### `openAssetReview()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(sceneId)`
* **Returns**: `unknown`
* **Calls**: `setStatus()`, `getCurrentReviewScene()`, `renderAssetReviewModal()`
* **Called By**: `runFullPipeline()`, `restore()`
* **Description**: Orchestrates behavior for `openAssetReview`.

### `renderAssetReviewModal()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `sceneHasVideoOutput()`, `statusLabel()`, `getCurrentReviewScene()`, `renderFocusedMedia()`, `escapeHtml()`
* **Called By**: `render()`, `openAssetReview()`, `setReviewZoom()`
* **Description**: Orchestrates behavior for `renderAssetReviewModal`.

### `renderFocusedMedia()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene, reviewType)`
* **Returns**: `unknown`
* **Calls**: `escapeHtml()`
* **Called By**: `renderAssetReviewModal()`
* **Description**: Orchestrates behavior for `renderFocusedMedia`.

### `setReviewZoom()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(value, { rerender = false } = {})`
* **Returns**: `unknown`
* **Calls**: `renderAssetReviewModal()`, `clamp()`
* **Called By**: `handleReviewWheelZoom()`, `handleReviewShortcut()`, `restore()`
* **Description**: Orchestrates behavior for `setReviewZoom`.

### `handleReviewWheelZoom()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: `setReviewZoom()`, `isAssetReviewOpen()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `handleReviewWheelZoom`.

### `isAssetReviewOpen()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `handleReviewWheelZoom()`, `startReviewPan()`, `handleReviewShortcut()`
* **Description**: Orchestrates behavior for `isAssetReviewOpen`.

### `startReviewPan()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: `isAssetReviewOpen()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `startReviewPan`.

### `moveReviewPan()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `moveReviewPan`.

### `stopReviewPan()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `releaseReviewShortcut()`
* **Description**: Orchestrates behavior for `stopReviewPan`.

### `handleReviewShortcut()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: `setReviewZoom()`, `isAssetReviewOpen()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `handleReviewShortcut`.

### `releaseReviewShortcut()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: `stopReviewPan()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `releaseReviewShortcut`.

### `approveCurrentReviewScene()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `queueAutoContinue()`, `render()`, `setStatus()`, `getCurrentReviewScene()`, `persist()`, `close()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `approveCurrentReviewScene`.

### `regenerateCurrentReviewScene()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `render()`, `setStatus()`, `getCurrentReviewScene()`, `persist()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `regenerateCurrentReviewScene`.

### `escapeHtml()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(value)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `renderPipelineLog()`, `renderImagePreview()`, `renderVideoPreview()`, `renderAssetReviewModal()`, `renderFocusedMedia()`, `renderFinalPreview()`
* **Description**: Orchestrates behavior for `escapeHtml`.

### `fileUrl()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(filePath)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `renderFinalPreview()`
* **Description**: Orchestrates behavior for `fileUrl`.

### `mergeAndShowFinalPreview()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(options = {})`
* **Returns**: `unknown`
* **Calls**: `mergeVideos()`, `setStatus()`, `renderFinalPreview()`
* **Called By**: `runFullPipeline()`, `restore()`
* **Description**: Orchestrates behavior for `mergeAndShowFinalPreview`.

### `renderFinalPreview()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(result = null)`
* **Returns**: `unknown`
* **Calls**: `escapeHtml()`, `fileUrl()`, `persist()`
* **Called By**: `render()`, `mergeAndShowFinalPreview()`
* **Description**: Orchestrates behavior for `renderFinalPreview`.

### `clamp()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(value, min, max)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `getGrokRecoverySettings()`, `applyGrokRecoverySettings()`, `getChatGptStabilitySettings()`, `applyChatGptStabilitySettings()`, `getProjectTargetSceneDefault()`, `createProject()`, `runNextBatch()`, `getNextBatchForSegment()`, `startPipelineFromClick()`, `setReviewZoom()`, `getProjectSessionPayload()`, `normalizeProjectSessionForRenderer()`, `createBlankProjectFromName()`, `restore()`
* **Description**: Orchestrates behavior for `clamp`.

### `getGrokRouterSettings()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `getProjectSessionPayload()`, `persist()`
* **Description**: Orchestrates behavior for `getGrokRouterSettings`.

### `renderGrokRouterStatus()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(status = {}, accounts = [])`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `refreshGrokRouterStatus()`
* **Description**: Orchestrates behavior for `renderGrokRouterStatus`.

### `refreshGrokRouterStatus()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `getGrokRouterStatus()`, `listGrokAccountsSafe()`, `renderGrokRouterStatus()`
* **Called By**: `restore()`, `refreshLabel()`
* **Description**: Orchestrates behavior for `refreshGrokRouterStatus`.

### `getSelectedText()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(control)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `getRouterMetadata()`, `getProjectSessionPayload()`
* **Description**: Orchestrates behavior for `getSelectedText`.

### `getSceneRef()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene, index)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `runNextBatch()`, `runFullPipeline()`, `findSceneByRuntimeRef()`, `getOrderedResumeScenes()`, `getNextResumeAction()`, `getRuntimeSnapshot()`, `getSceneFileRecord()`, `getPreviewTimeline()`, `getProjectAssets()`, `getCurrentSceneRef()`, `applyProjectSessionPayload()`
* **Description**: Orchestrates behavior for `getSceneRef`.

### `isVideoCompleteForResume()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `hasKeyframeForResume()`, `getNextResumeAction()`
* **Description**: Orchestrates behavior for `isVideoCompleteForResume`.

### `hasKeyframeForResume()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene = {})`
* **Returns**: `unknown`
* **Calls**: `isVideoCompleteForResume()`
* **Called By**: `getNextResumeAction()`
* **Description**: Orchestrates behavior for `hasKeyframeForResume`.

### `findSceneByRuntimeRef()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(ref, scenes = project?.scenes || [])`
* **Returns**: `unknown`
* **Calls**: `getSceneRef()`
* **Called By**: `normalizeActiveBatchIdsForRuntime()`, `getCurrentResumeScene()`
* **Description**: Orchestrates behavior for `findSceneByRuntimeRef`.

### `normalizeActiveBatchIdsForRuntime()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(ids = [], scenes = project?.scenes || [])`
* **Returns**: `unknown`
* **Calls**: `findSceneByRuntimeRef()`
* **Called By**: `syncProjectSceneFolders()`, `getOrderedResumeScenes()`, `getRuntimeSnapshot()`, `applyProjectSessionPayload()`, `restore()`
* **Description**: Orchestrates behavior for `normalizeActiveBatchIdsForRuntime`.

### `getOrderedResumeScenes()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(state = {})`
* **Returns**: `unknown`
* **Calls**: `getSceneRef()`, `normalizeActiveBatchIdsForRuntime()`
* **Called By**: `getNextResumeAction()`
* **Description**: Orchestrates behavior for `getOrderedResumeScenes`.

### `getNextResumeAction()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(state = {})`
* **Returns**: `unknown`
* **Calls**: `getSceneRef()`, `isVideoCompleteForResume()`, `hasKeyframeForResume()`, `getOrderedResumeScenes()`
* **Called By**: `runFullPipeline()`, `getCurrentResumeScene()`, `getRuntimeSnapshot()`
* **Description**: Orchestrates behavior for `getNextResumeAction`.

### `getCurrentResumeScene()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `findSceneByRuntimeRef()`, `getNextResumeAction()`
* **Called By**: `getRuntimeSnapshot()`, `getCurrentSceneRef()`
* **Description**: Orchestrates behavior for `getCurrentResumeScene`.

### `getRuntimeSnapshot()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `getContinuityReferenceSettings()`, `getImageGenerationSettings()`, `getSceneRef()`, `normalizeActiveBatchIdsForRuntime()`, `getNextResumeAction()`, `getCurrentResumeScene()`, `getRouterMetadata()`
* **Called By**: `getProjectSessionPayload()`
* **Description**: Orchestrates behavior for `getRuntimeSnapshot`.

### `getSceneFileRecord()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene, index)`
* **Returns**: `unknown`
* **Calls**: `getSceneRef()`, `stripObsoleteProjectModeFields()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getSceneFileRecord`.

### `getPreviewTimeline()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `normalizeSceneDuration()`, `getSceneRef()`
* **Called By**: `getProjectAssets()`, `getProjectSessionPayload()`
* **Description**: Orchestrates behavior for `getPreviewTimeline`.

### `getProjectAssets()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(previewTimeline = getPreviewTimeline()`
* **Returns**: `unknown`
* **Calls**: `getSceneRef()`, `getPreviewTimeline()`
* **Called By**: `getProjectSessionPayload()`
* **Description**: Orchestrates behavior for `getProjectAssets`.

### `getCurrentSceneRef()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `getSceneRef()`, `getCurrentResumeScene()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getCurrentSceneRef`.

### `stripObsoleteProjectModeFields()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(value = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `getSceneFileRecord()`, `getProjectSessionPayload()`
* **Description**: Orchestrates behavior for `stripObsoleteProjectModeFields`.

### `getRouterMetadata()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `getSelectedText()`
* **Called By**: `getRuntimeSnapshot()`, `getProjectSessionPayload()`
* **Description**: Orchestrates behavior for `getRouterMetadata`.

### `getProjectSessionPayload()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `normalizeSceneDuration()`, `getReviewSettings()`, `shouldSkipReview()`, `isKeyframeMotionPromptOnlyModeEnabled()`, `getContinuityReferenceSettings()`, `getGrokRecoverySettings()`, `getChatGptStabilitySettings()`, `getImageGenerationSettings()`, `clamp()`, `getGrokRouterSettings()`, `getSelectedText()`, `getRuntimeSnapshot()`, `getPreviewTimeline()`, `getProjectAssets()`, `stripObsoleteProjectModeFields()`, `getRouterMetadata()`
* **Called By**: `createInitialProjectFileInOutputFolder()`, `saveProjectSessionFlow()`
* **Description**: Orchestrates behavior for `getProjectSessionPayload`.

### `normalizeRendererScene()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene = {}, index = 0)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `normalizeRendererScene`.

### `normalizeProjectSessionForRenderer()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(payload = {})`
* **Returns**: `unknown`
* **Calls**: `normalizeSceneDuration()`, `clamp()`
* **Called By**: `applyProjectSessionPayload()`
* **Description**: Orchestrates behavior for `normalizeProjectSessionForRenderer`.

### `setControlValue()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(control, value)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `applyProjectSessionPayload()`
* **Description**: Orchestrates behavior for `setControlValue`.

### `migrateProjectAssetPathsToOutputFolder()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(filePath = '')`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `applyProjectSessionPayload()`
* **Description**: Orchestrates behavior for `migrateProjectAssetPathsToOutputFolder`.

### `applyProjectSessionPayload()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(payload = {}, filePath = '')`
* **Returns**: `unknown`
* **Calls**: `applySceneDurationValue()`, `applyReviewSettings()`, `applyPipelineModeSettings()`, `applyContinuityReferenceSettings()`, `applyGrokRecoverySettings()`, `applyChatGptStabilitySettings()`, `syncTargetSceneCountToProjectDefault()`, `applyImageGenerationSettings()`, `syncProjectSceneFolders()`, `syncVideoPlatformConfig()`, `updatePixVerseConfigAdvice()`, `render()`, `getSceneRef()`, `normalizeActiveBatchIdsForRuntime()`, `normalizeProjectSessionForRenderer()`, `setControlValue()`, `migrateProjectAssetPathsToOutputFolder()`, `persist()`
* **Called By**: `openProjectSessionFlow()`
* **Description**: Orchestrates behavior for `applyProjectSessionPayload`.

### `renderProjectSessionStatus()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `render()`, `markProjectDirty()`
* **Description**: Orchestrates behavior for `renderProjectSessionStatus`.

### `markProjectDirty()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `renderProjectSessionStatus()`
* **Called By**: `createProject()`, `pauseRun()`, `chooseOutputFolder()`, `handleTableClick()`, `saveEdit()`, `loadTextFileToTextarea()`, `resolveChatAndContinue()`, `restore()`
* **Description**: Orchestrates behavior for `markProjectDirty`.

### `confirmUnsavedProjectAction()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(actionLabel)`
* **Returns**: `unknown`
* **Calls**: `saveProjectSessionFlow()`
* **Called By**: `newProjectSessionFlow()`, `openProjectSessionFlow()`
* **Description**: Orchestrates behavior for `confirmUnsavedProjectAction`.

### `openChatResolveDialog()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(scene, message)`
* **Returns**: `unknown`
* **Calls**: `setStatus()`
* **Called By**: `runFullPipeline()`
* **Description**: Orchestrates behavior for `openChatResolveDialog`.

### `closeChatResolveDialog()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `close()`
* **Called By**: `resolveChatAndContinue()`
* **Description**: Orchestrates behavior for `closeChatResolveDialog`.

### `resolveChatAndContinue()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(mode)`
* **Returns**: `unknown`
* **Calls**: `queueAutoContinue()`, `render()`, `setStatus()`, `markProjectDirty()`, `closeChatResolveDialog()`, `persist()`
* **Called By**: `restore()`
* **Description**: Orchestrates behavior for `resolveChatAndContinue`.

### `forceCloseNewProjectDialog()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `close()`
* **Called By**: `submitNewProjectDialog()`
* **Description**: Orchestrates behavior for `forceCloseNewProjectDialog`.

### `createBlankProjectFromName()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `applySceneDurationValue()`, `clamp()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `createBlankProjectFromName`.

### `createInitialProjectFileInOutputFolder()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(rootFolder = outputFolder)`
* **Returns**: `unknown`
* **Calls**: `render()`, `setStatus()`, `getProjectSessionPayload()`, `persist()`
* **Called By**: `submitNewProjectDialog()`
* **Description**: Orchestrates behavior for `createInitialProjectFileInOutputFolder`.

### `newProjectSessionFlow()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `render()`, `setStatus()`, `confirmUnsavedProjectAction()`, `persist()`
* **Called By**: `refreshLabel()`
* **Description**: Orchestrates behavior for `newProjectSessionFlow`.

### `submitNewProjectDialog()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `createProject()`, `setStatus()`, `forceCloseNewProjectDialog()`, `createInitialProjectFileInOutputFolder()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `submitNewProjectDialog`.

### `saveProjectSessionFlow()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(options = {})`
* **Returns**: `unknown`
* **Calls**: `syncProjectSceneFolders()`, `render()`, `setStatus()`, `getProjectSessionPayload()`, `persist()`, `reconcileSavedAssets()`
* **Called By**: `confirmUnsavedProjectAction()`, `restore()`, `refreshLabel()`
* **Description**: Orchestrates behavior for `saveProjectSessionFlow`.

### `openProjectSessionFlow()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `syncProjectSceneFolders()`, `render()`, `setStatus()`, `applyProjectSessionPayload()`, `confirmUnsavedProjectAction()`, `persist()`, `reconcileSavedAssets()`
* **Called By**: `refreshLabel()`
* **Description**: Orchestrates behavior for `openProjectSessionFlow`.

### `persist()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `getReviewSettings()`, `isKeyframeMotionPromptOnlyModeEnabled()`, `getContinuityReferenceSettings()`, `getGrokRecoverySettings()`, `getChatGptStabilitySettings()`, `getImageGenerationSettings()`, `getGrokRouterSettings()`
* **Called By**: `saveSettingsDialog()`, `stopPipelineFromClick()`, `queueAutoContinue()`, `createProject()`, `runNextBatch()`, `approveBatch()`, `pauseRun()`, `recoverWorkflowRun()`, `chooseOutputFolder()`, `sendCurrentBatchViaWeb()`, `runFullPipeline()`, `maybeRunVeoUpAutomationAfterPipeline()`, `recoverLoginAndRetryScene()`, `autoRunRoute()`, `handleTableClick()`, `saveEdit()`, `loadTextFileToTextarea()`, `approveCurrentReviewScene()`, `regenerateCurrentReviewScene()`, `renderFinalPreview()`, `applyProjectSessionPayload()`, `resolveChatAndContinue()`, `createInitialProjectFileInOutputFolder()`, `newProjectSessionFlow()`, `saveProjectSessionFlow()`, `openProjectSessionFlow()`, `saveSessionForNextLaunch()`, `restore()`
* **Description**: Orchestrates behavior for `persist`.

### `reconcileSavedAssets()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `saveProjectSessionFlow()`, `openProjectSessionFlow()`, `saveSessionForNextLaunch()`
* **Description**: Orchestrates behavior for `reconcileSavedAssets`.

### `missingPath()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(filePath)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `statPath()`
* **Description**: Orchestrates behavior for `missingPath`.

### `statPath()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(filePath)`
* **Returns**: `unknown`
* **Calls**: `missingPath()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `statPath`.

### `saveSessionForNextLaunch()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `setStatus()`, `persist()`, `reconcileSavedAssets()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `saveSessionForNextLaunch`.

### `restore()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `applySceneDurationValue()`, `applyReviewSettings()`, `isKeyframeMotionPromptOnlyModeEnabled()`, `applyPipelineModeSettings()`, `applyContinuityReferenceSettings()`, `applyGrokRecoverySettings()`, `applyChatGptStabilitySettings()`, `getProjectTargetSceneDefault()`, `applyImageGenerationSettings()`, `stopPipelineFromClick()`, `runNextBatch()`, `syncVideoPlatformConfig()`, `updatePixVerseConfigAdvice()`, `startPipelineFromClick()`, `render()`, `openEditor()`, `setStatus()`, `renderPipelineLog()`, `loadTextFileToTextarea()`, `getCurrentReviewScene()`, `openAssetReview()`, `setReviewZoom()`, `mergeAndShowFinalPreview()`, `clamp()`, `refreshGrokRouterStatus()`, `normalizeActiveBatchIdsForRuntime()`, `markProjectDirty()`, `resolveChatAndContinue()`, `saveProjectSessionFlow()`, `persist()`
* **Called By**: `refreshLabel()`
* **Description**: Orchestrates behavior for `restore`.

### `ensureHardPromptFilePickerUi()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `refreshLabel()`
* **Description**: Orchestrates behavior for `ensureHardPromptFilePickerUi`.

### `refreshLabel()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `embedRouterPanelInSettings()`, `moveProjectActionsOutsideSettings()`, `openSettingsDialog()`, `syncVideoPlatformConfig()`, `setStatus()`, `renderPipelineLog()`, `setPipelineLogVisible()`, `refreshGrokRouterStatus()`, `newProjectSessionFlow()`, `saveProjectSessionFlow()`, `openProjectSessionFlow()`, `restore()`, `ensureHardPromptFilePickerUi()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `refreshLabel`.

### `updateVeoUpSetupUI()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `openSettingsDialog()`, `autoRunRoute()`, `runCalibrationLoop()`, `cleanupSetupUI()`
* **Description**: Orchestrates behavior for `updateVeoUpSetupUI`.

### `updateScanButtonVisibility()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `render()`
* **Description**: Orchestrates behavior for `updateScanButtonVisibility`.

### `setStepActive()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `(stepNum)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `runCalibrationLoop()`
* **Description**: Orchestrates behavior for `setStepActive`.

### `runCalibrationLoop()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `updateVeoUpSetupUI()`, `setStepActive()`, `cleanupSetupUI()`
* **Called By**: `cleanupSetupUI()`
* **Description**: Orchestrates behavior for `runCalibrationLoop`.

### `cleanupSetupUI()`

* **Located in**: [renderer.js](file:///d:/bac_tai/Grok-bac-Tai/electron/renderer.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `setStatus()`, `updateVeoUpSetupUI()`, `runCalibrationLoop()`
* **Called By**: `runCalibrationLoop()`
* **Description**: Orchestrates behavior for `cleanupSetupUI`.

### `initBootstrap()`

* **Located in**: [bootstrap.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/bootstrap/bootstrap.js)
* **Parameters**: `(runtime)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `scanProjectAndRunVeoUpHandler()`
* **Description**: Orchestrates behavior for `initBootstrap`.

### `initializeApplication()`

* **Located in**: [bootstrap.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/bootstrap/bootstrap.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `ensureAndMigratePrompts()`, `buildAppMenu()`, `initChatGptPipeline()`, `initIpcHandlers()`, `appendAppLog()`, `initPipelineRunner()`, `initVeoUp()`
* **Called By**: `scanProjectAndRunVeoUpHandler()`
* **Description**: Orchestrates behavior for `initializeApplication`.

### `createMainWindow()`

* **Located in**: [bootstrap.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/bootstrap/bootstrap.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `scanProjectAndRunVeoUpHandler()`
* **Description**: Orchestrates behavior for `createMainWindow`.

### `constructor()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `on()`, `evaluate()`, `captureSnapshot()`
* **Called By**: *None*
* **Description**: function Object() { [native code] }

### `on()`

* **Located in**: [browser_adapter.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/browser_adapter.js)
* **Parameters**: `(event, callback)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `probeVideoDurationSeconds()`, `runFfmpeg()`, `validateGeneratedVideoFile()`, `runVeoUpAutomation()`, `scanProjectAndRunVeoUpHandler()`, `listener()`, `constructor()`, `onFinished()`, `getReqId()`, `subscribe()`, `checkCondition()`, `checkTransition()`, `checkIntent()`, `checkSignal()`, `initIpcHandlers()`, `findRunningVeoUpExecutablePaths()`, `findRunningVeoUpWindow()`, `foreach()`, `runPowerShell()`, `handleExit()`, `validateBlueBoxCoordinate()`, `previewStartButtonCoordinate()`, `captureVeoUpCoordinate()`
* **Description**: Orchestrates behavior for `on`.

### `off()`

* **Located in**: [browser_adapter.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/browser_adapter.js)
* **Parameters**: `(event, callback)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `stop()`, `stopMonitoring()`, `subscribe()`, `waitUntil()`, `waitForTransition()`, `waitForIntent()`, `waitForSignal()`
* **Description**: Orchestrates behavior for `off`.

### `connect()`

* **Located in**: [browser_adapter.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/browser_adapter.js)
* **Parameters**: `(cdpEndpoint, target)`
* **Returns**: `unknown`
* **Calls**: `appendAppLog()`
* **Called By**: `validateGeneratedVideoFile()`
* **Description**: Orchestrates behavior for `connect`.

### `evaluate()`

* **Located in**: [browser_adapter.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/browser_adapter.js)
* **Parameters**: `(expression, arg)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `constructor()`, `evaluateOnCdpPage()`, `runEvaluate()`, `getReqId()`
* **Description**: Orchestrates behavior for `evaluate`.

### `setInputFiles()`

* **Located in**: [browser_adapter.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/browser_adapter.js)
* **Parameters**: `(selector, filePaths)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `verifyAttachmentsReady()`, `uploadFileToChatGptDirectly()`
* **Description**: Orchestrates behavior for `setInputFiles`.

### `disconnect()`

* **Located in**: [browser_adapter.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/browser_adapter.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `close()`
* **Called By**: `close()`
* **Description**: Orchestrates behavior for `disconnect`.

### `close()`

* **Located in**: [browser_adapter.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/browser_adapter.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `disconnect()`
* **Called By**: `getPipelineLogVisibility()`, `closeChromeDebug()`, `checkWebLogin()`, `validateGeneratedVideoFile()`, `waitForCdpAssistantResponse()`, `waitForProviderReady()`, `autoRunRoute()`, `saveEdit()`, `approveCurrentReviewScene()`, `closeChatResolveDialog()`, `forceCloseNewProjectDialog()`, `disconnect()`, `isPipelineCancelledError()`, `recoverChatGptBlockingUi()`
* **Description**: Orchestrates behavior for `close`.

### `getChatGptSendState()`

* **Located in**: [chatgpt_core.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_core.js)
* **Parameters**: `(sceneId)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `getChatGptLocationState()`, `validateGeneratedVideoFile()`, `scanProjectAndRunVeoUpHandler()`, `isReloadBlocked()`, `detectLoginWithRetry()`, `recoverChatGptBlockingUi()`, `forceCleanChatGptNewChatRotation()`, `initIpcHandlers()`
* **Description**: Orchestrates behavior for `getChatGptSendState`.

### `getConversationState()`

* **Located in**: [chatgpt_core.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_core.js)
* **Parameters**: `(page)`
* **Returns**: `unknown`
* **Calls**: `evaluateOnCdpPage()`
* **Called By**: `isPipelineCancelledError()`, `performDurableRecovery()`, `verifyAttachmentsReady()`
* **Description**: Orchestrates behavior for `getConversationState`.

### `waitForCdpLoad()`

* **Located in**: [chatgpt_core.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_core.js)
* **Parameters**: `(client)`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `evaluateOnCdpPage()`
* **Called By**: `getChatGptLocationState()`, `clearProviderSession()`, `ensureGrokImagineAgentPage()`, `validateGeneratedVideoFile()`, `ensureGrokEmptyCanvas()`, `selectChatGptConversationByTitle()`, `isPipelineCancelledError()`, `refreshChatGptPageBeforeImageExtract()`, `waitForLatestChatGPTGeneratedImage()`, `resendImagePrompt()`, `retryMotionPrompt()`, `isValidChatGptConversationUrl()`, `assertPipelineRunActive()`, `detectLoginWithRetry()`, `forceCleanChatGptNewChatRotation()`, `runScenePipelineLocked()`
* **Description**: Orchestrates behavior for `waitForCdpLoad`.

### `evaluateOnCdpPage()`

* **Located in**: [chatgpt_core.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_core.js)
* **Parameters**: `(client, expression)`
* **Returns**: `unknown`
* **Calls**: `evaluate()`, `__safe()`
* **Called By**: `getChatGptLocationState()`, `captureAndLogChatGptDiagnostics()`, `checkWebLogin()`, `clearProviderSession()`, `sendPromptViaWeb()`, `assertChatGptNotExistingConversation()`, `waitForGrokImagineReady()`, `getGrokRouteState()`, `forceGrokNormalImagineVideoMode()`, `ensureGrokImagineAgentPage()`, `closeGrokTemplateModal()`, `validateGeneratedVideoFile()`, `forceGrokNormalImagineMode()`, `ensureGrokEmptyCanvas()`, `waitForGrokUploadSettled()`, `waitForGrokSendPreflight()`, `clickGrokSendButtonOnce()`, `clearGrokCanvasSelection()`, `recoverGrokCanvasAfterLimit()`, `labelGrokCanvas()`, `clearGrokCanvasChat()`, `confirmGrokVideoGenerationIfAsked()`, `sendGrokConfirmationText()`, `waitForCdpAssistantResponse()`, `waitForNewImageUrl()`, `selectChatGptConversationByTitle()`, `waitForNewVideoUrl()`, `downloadBrowserAsset()`, `captureLatestImageElement()`, `waitForGrokUploadedAsset()`, `handler()`, `uploadFileViaCdp()`, `pasteImageViaClipboard()`, `submitPixVersePrompt()`, `submitGrokVideoPrompt()`, `pressEnterToSubmit()`, `clickGrokRetryButton()`, `getConversationState()`, `waitForCdpLoad()`, `isPipelineCancelledError()`, `hasVisibleChatGptImageCandidate()`, `refreshChatGptPageBeforeImageExtract()`, `waitForLatestChatGPTGeneratedImage()`, `resendImagePrompt()`, `extractLatestChatGPTGeneratedImageBytes()`, `verifyCanvas()`, `adoptExistingSceneImage()`, `retryMotionPrompt()`, `renameChatGptCurrentConversationUntilTitle()`, `waitForChatGptRecentItem()`, `checkChatGptCurrentConversationTitle()`, `isValidChatGptConversationUrl()`, `assertPipelineRunActive()`, `detectLoginWithRetry()`, `recoverChatGptBlockingUi()`, `recoverChatGptResponseChoiceChat()`, `forceCleanChatGptNewChatRotation()`, `clickSendButtonViaCdp()`, `forceClickChatGptComposerSubmit()`, `waitForHeavyChatGptPromptDomCooldown()`, `sendPromptViaCdpInput()`, `sendPromptViaCdpInputSingle()`, `focusNv2ComposerWithCdp()`, `sendNv2PromptViaDeepCdpInput()`, `vidoraReadChatGptComposerStateReal()`, `vidoraClearChatGptInputBeforePaste()`, `verifyAttachmentsReady()`, `uploadFileToChatGptDirectly()`, `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `evaluateOnCdpPage`.

### `__safe()`

* **Located in**: [chatgpt_core.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_core.js)
* **Parameters**: `(value, depth = 0)`
* **Returns**: `unknown`
* **Calls**: `runEvaluate()`, `appendAppLog()`
* **Called By**: `evaluateOnCdpPage()`
* **Description**: Orchestrates behavior for `__safe`.

### `runEvaluate()`

* **Located in**: [chatgpt_core.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_core.js)
* **Parameters**: `(expr, returnByValue = true)`
* **Returns**: `unknown`
* **Calls**: `evaluate()`
* **Called By**: `__safe()`
* **Description**: Orchestrates behavior for `runEvaluate`.

### `detectLoginScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(provider)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `detectLoginScript`.

### `detectBrowserCrashPageScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `detectBrowserCrashPageScript`.

### `dismissChatGptBlockingUiScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(context = {})`
* **Returns**: `unknown`
* **Calls**: `normalize()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `dismissChatGptBlockingUiScript`.

### `isUnsafeDismissTarget()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(item)`
* **Returns**: `unknown`
* **Calls**: `fold()`
* **Called By**: `isExactDismissText()`
* **Description**: Orchestrates behavior for `isUnsafeDismissTarget`.

### `isExactDismissText()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(text)`
* **Returns**: `unknown`
* **Calls**: `visible()`, `textOf()`, `fold()`, `clickNode()`, `isUnsafeDismissTarget()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `isExactDismissText`.

### `detectChatGptResponseChoiceUiScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `visible()`, `normalize()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `detectChatGptResponseChoiceUiScript`.

### `detectChatGptActiveGenerationScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `detectChatGptActiveGenerationScript`.

### `detectChatGptActiveGenerationScriptStrict()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `nearComposer()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `detectChatGptActiveGenerationScriptStrict`.

### `nearComposer()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(item)`
* **Returns**: `unknown`
* **Calls**: `normalize()`
* **Called By**: `detectChatGptActiveGenerationScriptStrict()`
* **Description**: Orchestrates behavior for `nearComposer`.

### `getComposerTextScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getComposerTextScript`.

### `getActiveComposerTextScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getActiveComposerTextScript`.

### `inspectNv2ComposerSubmitStateScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(prompt, beforeCount = 0)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `inspectNv2ComposerSubmitStateScript`.

### `clickChatGptStopGeneratingScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `clickChatGptStopGeneratingScript`.

### `clickUploadButtonScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(provider = "grok")`
* **Returns**: `unknown`
* **Calls**: `textOf()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `clickUploadButtonScript`.

### `detectUploadedAssetScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `detectUploadedAssetScript`.

### `focusPromptInputScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `focusPromptInputScript`.

### `setPromptInputValueScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(prompt)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `setPromptInputValueScript`.

### `deepFocusNv2ComposerScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `visible()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `deepFocusNv2ComposerScript`.

### `clearNv2ComposerScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `clearNv2ComposerScript`.

### `dispatchNv2ComposerInputEventsScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(prompt)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `dispatchNv2ComposerInputEventsScript`.

### `forceSubmitChatGptComposerScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `forceSubmitChatGptComposerScript`.

### `isSendButton()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(button)`
* **Returns**: `unknown`
* **Calls**: `visible()`, `norm()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `isSendButton`.

### `inspectAndClickChatGptSendButton()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `inspectAndClickChatGptSendButton`.

### `inspectAndClickChatGptSendButtonSafely()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `normalize()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `inspectAndClickChatGptSendButtonSafely`.

### `labelOf()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(button)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `isStopButton()`, `isRejectedToolButton()`, `isStrictSendButton()`
* **Description**: Orchestrates behavior for `labelOf`.

### `isStopButton()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(button)`
* **Returns**: `unknown`
* **Calls**: `norm()`, `labelOf()`
* **Called By**: `isStrictSendButton()`, `extractNodeInfo()`, `getActiveButtonType()`
* **Description**: Orchestrates behavior for `isStopButton`.

### `isRejectedToolButton()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(button)`
* **Returns**: `unknown`
* **Calls**: `labelOf()`
* **Called By**: `isStrictSendButton()`
* **Description**: Orchestrates behavior for `isRejectedToolButton`.

### `isStrictSendButton()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(button)`
* **Returns**: `unknown`
* **Calls**: `visible()`, `labelOf()`, `isStopButton()`, `isRejectedToolButton()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `isStrictSendButton`.

### `extractNodeInfo()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(node)`
* **Returns**: `unknown`
* **Calls**: `isStopButton()`
* **Called By**: `getActiveButtonType()`
* **Description**: Orchestrates behavior for `extractNodeInfo`.

### `getActiveButtonType()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `visible()`, `isStopButton()`, `extractNodeInfo()`
* **Called By**: `sleepMs()`
* **Description**: Orchestrates behavior for `getActiveButtonType`.

### `sleepMs()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(ms)`
* **Returns**: `unknown`
* **Calls**: `getActiveButtonType()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `sleepMs`.

### `clickSendButtonScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `clickSendButtonScript`.

### `sendPromptScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(prompt)`
* **Returns**: `unknown`
* **Calls**: `clickChatGptStartNewChatScript()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `sendPromptScript`.

### `prepareChatGptCreateImageScript()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `fold()`
* **Description**: Orchestrates behavior for `prepareChatGptCreateImageScript`.

### `extractConversationSnapshot()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(options = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `collectMetrics()`
* **Description**: Orchestrates behavior for `extractConversationSnapshot`.

### `hashText()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(value = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `readAssistantText()`, `onBindingCalled()`, `processIncomingEvent()`
* **Description**: Orchestrates behavior for `hashText`.

### `readStableId()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(node)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `readAssistantText()`
* **Description**: Orchestrates behavior for `readStableId`.

### `readAssistantText()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(node)`
* **Returns**: `unknown`
* **Calls**: `hashText()`, `readStableId()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `readAssistantText`.

### `nearComposerButton()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(item)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `nearComposerButton`.

### `createOptimizedWrapper()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `(bodyCode)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `fn()`
* **Description**: Orchestrates behavior for `createOptimizedWrapper`.

### `fn()`

* **Located in**: [chatgpt_dom.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_dom.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `createOptimizedWrapper()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `fn`.

### `initChatGptPipeline()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(runtime)`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `assertPipelineRunActive()`
* **Called By**: `initializeApplication()`
* **Description**: Orchestrates behavior for `initChatGptPipeline`.

### `sanitizeAssetUrlForLog()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(value = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `onResponse()`
* **Description**: Orchestrates behavior for `sanitizeAssetUrlForLog`.

### `startChatGptImageNetworkCapture()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(client, context = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `isPipelineCancelledError()`
* **Description**: Orchestrates behavior for `startChatGptImageNetworkCapture`.

### `isLikelyImage()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(response = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `onResponse()`
* **Description**: Orchestrates behavior for `isLikelyImage`.

### `onResponse()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(event = {})`
* **Returns**: `unknown`
* **Calls**: `sanitizeAssetUrlForLog()`, `isLikelyImage()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `onResponse`.

### `onFinished()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(event = {})`
* **Returns**: `unknown`
* **Calls**: `on()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `onFinished`.

### `candidates()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `summary()`, `tryExtractChatGptNetworkImage()`
* **Description**: Orchestrates behavior for `candidates`.

### `summary()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `candidates()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `summary`.

### `stop()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `off()`
* **Called By**: `isPipelineCancelledError()`
* **Description**: Orchestrates behavior for `stop`.

### `tryExtractChatGptNetworkImage()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(client, capture)`
* **Returns**: `unknown`
* **Calls**: `candidates()`, `decodeImageBufferToPng()`
* **Called By**: `waitForLatestChatGPTGeneratedImage()`
* **Description**: Orchestrates behavior for `tryExtractChatGptNetworkImage`.

### `chatGptImageCandidateSignature()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(candidate = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `waitForLatestChatGPTGeneratedImage()`
* **Description**: Orchestrates behavior for `chatGptImageCandidateSignature`.

### `countVisibleChatGptImageCandidates()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(diagnostics = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `hasVisibleChatGptImageCandidate()`
* **Description**: Orchestrates behavior for `countVisibleChatGptImageCandidates`.

### `hasVisibleChatGptImageCandidate()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(extracted = {})`
* **Returns**: `unknown`
* **Calls**: `evaluateOnCdpPage()`, `countVisibleChatGptImageCandidates()`, `decodeImageBufferToPng()`, `appendAppLog()`, `isChatGptActivelyGenerating()`
* **Called By**: `waitForLatestChatGPTGeneratedImage()`
* **Description**: Orchestrates behavior for `hasVisibleChatGptImageCandidate`.

### `saveChatGPTGeneratedImageAsset()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(client, options = {})`
* **Returns**: `unknown`
* **Calls**: `waitForLatestChatGPTGeneratedImage()`, `appendAppLog()`, `logMemoryMilestone()`
* **Called By**: `isPipelineCancelledError()`
* **Description**: Orchestrates behavior for `saveChatGPTGeneratedImageAsset`.

### `isLikelyChatGptLoadingPlaceholderImage()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(asset = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `isPreferredChatGptRealImageAsset()`
* **Description**: Orchestrates behavior for `isLikelyChatGptLoadingPlaceholderImage`.

### `isPreferredChatGptRealImageAsset()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(asset = {})`
* **Returns**: `unknown`
* **Calls**: `isLikelyChatGptLoadingPlaceholderImage()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `isPreferredChatGptRealImageAsset`.

### `isFalseChatGptImageGeneratingState()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(state = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `waitForLatestChatGPTGeneratedImage()`
* **Description**: Orchestrates behavior for `isFalseChatGptImageGeneratingState`.

### `refreshChatGptPageBeforeImageExtract()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(client, context = {})`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `isPipelineCancelledError()`, `waitForCdpLoad()`, `evaluateOnCdpPage()`, `waitForImageReady()`, `requestReloadWithReason()`, `captureSnapshot()`, `appendAppLog()`, `sanitizeChatGptImageSnapshot()`
* **Called By**: `waitForLatestChatGPTGeneratedImage()`
* **Description**: Orchestrates behavior for `refreshChatGptPageBeforeImageExtract`.

### `waitForLatestChatGPTGeneratedImage()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(client, options = {})`
* **Returns**: `unknown`
* **Calls**: `loginRequiredMessage()`, `captureAndLogChatGptDiagnostics()`, `notifyRenderer()`, `sleep()`, `assertPipelineRunActive()`, `isPipelineCancelledError()`, `waitForCdpLoad()`, `evaluateOnCdpPage()`, `tryExtractChatGptNetworkImage()`, `chatGptImageCandidateSignature()`, `hasVisibleChatGptImageCandidate()`, `isFalseChatGptImageGeneratingState()`, `refreshChatGptPageBeforeImageExtract()`, `resendImagePrompt()`, `extractLatestChatGPTGeneratedImageBytes()`, `decodeImageBufferToPng()`, `validateSavedImageFile()`, `adoptExistingSceneImage()`, `requestReloadWithReason()`, `recoverChatGptBlockingUi()`, `startMonitoring()`, `stopMonitoring()`, `captureSnapshot()`, `sendPromptViaCdpInput()`, `vidoraChatGptInputGate()`, `uploadFileToChatGptDirectly()`, `vidoraCompactLogDetails()`, `appendAppLog()`, `logMemoryMilestone()`, `isChatGptActivelyGenerating()`, `sanitizeChatGptImageSnapshot()`, `looksLikeCollapsedUserPrompt()`, `isChatGptDotLoadingCanvasAsset()`, `pathExists()`
* **Called By**: `saveChatGPTGeneratedImageAsset()`
* **Description**: Orchestrates behavior for `waitForLatestChatGPTGeneratedImage`.

### `resendImagePrompt()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(reason, snapshot)`
* **Returns**: `unknown`
* **Calls**: `loginRequiredMessage()`, `notifyRenderer()`, `notifyChatGptPolicyRefusal()`, `sleep()`, `waitForCdpLoad()`, `evaluateOnCdpPage()`, `requestReloadWithReason()`, `sendPromptViaCdpInput()`, `appendAppLog()`, `isChatGptPolicyRefusalText()`, `looksLikeCollapsedUserPrompt()`, `isChatGptLimitText()`
* **Called By**: `waitForLatestChatGPTGeneratedImage()`
* **Description**: Orchestrates behavior for `resendImagePrompt`.

### `extractLatestChatGPTGeneratedImageBytes()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(client, options = {})`
* **Returns**: `unknown`
* **Calls**: `evaluateOnCdpPage()`
* **Called By**: `waitForLatestChatGPTGeneratedImage()`, `verifyCanvas()`
* **Description**: Orchestrates behavior for `extractLatestChatGPTGeneratedImageBytes`.

### `decodeImageBufferToPng()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(buffer, contentType = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `isPipelineCancelledError()`, `tryExtractChatGptNetworkImage()`, `hasVisibleChatGptImageCandidate()`, `waitForLatestChatGPTGeneratedImage()`, `norm()`, `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `decodeImageBufferToPng`.

### `validateSavedImageFile()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(filePath)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `isPipelineCancelledError()`, `waitForLatestChatGPTGeneratedImage()`, `norm()`, `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `validateSavedImageFile`.

### `collectGeneratedImageUrlsScript()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `collectGeneratedImageUrlsScript`.

### `checkExistingCompletedImageScript()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `findAssistantMessageWithImage()`, `verifyImg()`, `verifyCanvas()`, `hasPlaceholder()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `checkExistingCompletedImageScript`.

### `findAssistantMessageWithImage()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `checkExistingCompletedImageScript()`
* **Description**: Orchestrates behavior for `findAssistantMessageWithImage`.

### `verifyImg()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(el)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `checkExistingCompletedImageScript()`, `verifyCanvas()`, `tryClickScrollBtn()`
* **Description**: Orchestrates behavior for `verifyImg`.

### `verifyCanvas()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(el)`
* **Returns**: `unknown`
* **Calls**: `evaluateOnCdpPage()`, `extractLatestChatGPTGeneratedImageBytes()`, `verifyImg()`, `appendAppLog()`
* **Called By**: `checkExistingCompletedImageScript()`, `tryClickScrollBtn()`
* **Description**: Orchestrates behavior for `verifyCanvas`.

### `hasPlaceholder()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `checkExistingCompletedImageScript()`, `tryClickScrollBtn()`
* **Description**: Orchestrates behavior for `hasPlaceholder`.

### `ensureChatGptImageLoadedAndHydratedScript()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(beforeAssistantCount = 0)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `ensureChatGptImageLoadedAndHydratedScript`.

### `findTarget()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `tryClickScrollBtn()`
* **Description**: Orchestrates behavior for `findTarget`.

### `tryClickScrollBtn()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `verifyImg()`, `verifyCanvas()`, `hasPlaceholder()`, `findTarget()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `tryClickScrollBtn`.

### `adoptExistingSceneImage()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(client, beforeAssistantCount, sceneId)`
* **Returns**: `unknown`
* **Calls**: `evaluateOnCdpPage()`
* **Called By**: `isPipelineCancelledError()`, `waitForLatestChatGPTGeneratedImage()`, `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `adoptExistingSceneImage`.

### `findTargetAssistant()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `findTargetAssistant`.

### `sanitizeUrl()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(value = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `pushUrlCandidate()`
* **Description**: Orchestrates behavior for `sanitizeUrl`.

### `rectInfo()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(node)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `pushUrlCandidate()`
* **Description**: Orchestrates behavior for `rectInfo`.

### `isVisible()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(node, relaxed = false)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `rootsFrom()`, `dedupeRoots()`, `pushUrlCandidate()`
* **Description**: Orchestrates behavior for `isVisible`.

### `nodeText()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(node)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `hasSpinner()`, `pushUrlCandidate()`
* **Description**: Orchestrates behavior for `nodeText`.

### `hasSpinner()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(node)`
* **Returns**: `unknown`
* **Calls**: `nodeText()`
* **Called By**: `pushUrlCandidate()`
* **Description**: Orchestrates behavior for `hasSpinner`.

### `sourceFromSrcset()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(srcset = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `pushUrlCandidate()`
* **Description**: Orchestrates behavior for `sourceFromSrcset`.

### `rootsFrom()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `isVisible()`
* **Called By**: `dedupeRoots()`
* **Description**: Orchestrates behavior for `rootsFrom`.

### `toRoots()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(nodes, mode)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `dedupeRoots()`
* **Description**: Orchestrates behavior for `toRoots`.

### `dedupeRoots()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(items)`
* **Returns**: `unknown`
* **Calls**: `isVisible()`, `rootsFrom()`, `toRoots()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `dedupeRoots`.

### `addElementId()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(node, type)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `pushUrlCandidate()`
* **Description**: Orchestrates behavior for `addElementId`.

### `pushUrlCandidate()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(node, root, type, src, extra = {})`
* **Returns**: `unknown`
* **Calls**: `sanitizeUrl()`, `rectInfo()`, `isVisible()`, `nodeText()`, `hasSpinner()`, `sourceFromSrcset()`, `addElementId()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `pushUrlCandidate`.

### `readBlobBase64()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(blob)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `readBlobBase64`.

### `getChatGptImageCandidateBoxScript()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(elementId = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getChatGptImageCandidateBoxScript`.

### `getLatestImageBoxScript()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(expectedRef = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getLatestImageBoxScript`.

### `isImageNode()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(node)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `isImageNode`.

### `waitForChatGptResponse()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(page, before, options = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `isPipelineCancelledError()`
* **Description**: Orchestrates behavior for `waitForChatGptResponse`.

### `retryMotionPrompt()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(reason, state)`
* **Returns**: `unknown`
* **Calls**: `notifyChatGptPolicyRefusal()`, `uploadFileViaCdp()`, `sleep()`, `assertPipelineRunActive()`, `isPipelineCancelledError()`, `waitForCdpLoad()`, `evaluateOnCdpPage()`, `waitForResponseReady()`, `recoverChatGptResponseChoiceChat()`, `startMonitoring()`, `stopMonitoring()`, `sendPromptViaCdpInput()`, `appendAppLog()`, `normalizeChatGptRetryText()`, `isRetryableChatGptToolErrorText()`, `isChatGptPolicyRefusalText()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `retryMotionPrompt`.

### `maybeRenameChatGptCurrentConversationUntilTitle()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(page, title = '', options = {})`
* **Returns**: `unknown`
* **Calls**: `sanitizeChatTitleForLog()`, `getChatGptLocationState()`, `invalidateChatGptConversationIdentity()`, `updateChatGptConversationIdentity()`, `renameChatGptCurrentConversationUntilTitle()`, `appendAppLog()`, `isSameChatTitle()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `maybeRenameChatGptCurrentConversationUntilTitle`.

### `renameChatGptCurrentConversationUntilTitle()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(page, title = '', { sceneId = '', timeoutMs = 60000, waitForRecent = true, maxAttempts = 2, stableTarget = 2 } = {})`
* **Returns**: `unknown`
* **Calls**: `sanitizeChatTitleForLog()`, `markChatTitleStable()`, `isChatTitleStable()`, `renameChatGptCurrentConversation()`, `sleep()`, `evaluateOnCdpPage()`, `waitForChatGptRecentItem()`, `checkChatGptCurrentConversationTitle()`, `appendAppLog()`
* **Called By**: `maybeRenameChatGptCurrentConversationUntilTitle()`
* **Description**: Orchestrates behavior for `renameChatGptCurrentConversationUntilTitle`.

### `waitForChatGptRecentItem()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(page, conversationPath = "", sceneId = "")`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: `selectChatGptConversationByTitle()`, `renameChatGptCurrentConversationUntilTitle()`
* **Description**: Orchestrates behavior for `waitForChatGptRecentItem`.

### `checkChatGptCurrentConversationTitle()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `(page, expectedTitle = "", options = {})`
* **Returns**: `unknown`
* **Calls**: `sanitizeChatTitleForLog()`, `getChatGptLocationState()`, `updateChatGptConversationIdentity()`, `norm()`, `evaluateOnCdpPage()`, `appendAppLog()`, `isSameChatTitle()`
* **Called By**: `selectChatGptConversationByTitle()`, `renameChatGptCurrentConversationUntilTitle()`
* **Description**: Orchestrates behavior for `checkChatGptCurrentConversationTitle`.

### `clearAllChatGptPipelineLocks()`

* **Located in**: [chatgpt_pipeline.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `cancelPipelineRun()`
* **Description**: Orchestrates behavior for `clearAllChatGptPipelineLocks`.

### `waitForImageReady()`

* **Located in**: [chatgpt_pipeline_adapter.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline_adapter.js)
* **Parameters**: `(timeoutMs = 900000, stableFor = 4000)`
* **Returns**: `unknown`
* **Calls**: `waitUntil()`
* **Called By**: `refreshChatGptPageBeforeImageExtract()`
* **Description**: Orchestrates behavior for `waitForImageReady`.

### `waitForResponseReady()`

* **Located in**: [chatgpt_pipeline_adapter.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline_adapter.js)
* **Parameters**: `(timeoutMs = 45000, stableFor = 3000)`
* **Returns**: `unknown`
* **Calls**: `waitUntil()`
* **Called By**: `retryMotionPrompt()`
* **Description**: Orchestrates behavior for `waitForResponseReady`.

### `isDraftRecovered()`

* **Located in**: [chatgpt_pipeline_adapter.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline_adapter.js)
* **Parameters**: `(snapshot, expectedPromptHash)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `isDraftRecovered`.

### `tryAutoLoginWithStoredAccount()`

* **Located in**: [chatgpt_recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_recovery.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `checkWebLogin()`, `clearProviderSession()`, `isPipelineCancelledError()`, `detectLoginWithRetry()`
* **Description**: Orchestrates behavior for `tryAutoLoginWithStoredAccount`.

### `resetSessionSceneCounter()`

* **Located in**: [chatgpt_recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_recovery.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `forceCleanChatGptNewChatRotation()`
* **Description**: Orchestrates behavior for `resetSessionSceneCounter`.

### `shouldRecoverFromCacheOrChallenge()`

* **Located in**: [recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/recovery/recovery.js)
* **Parameters**: `(state, provider)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `checkWebLogin()`, `detectLoginWithRetry()`
* **Description**: Orchestrates behavior for `shouldRecoverFromCacheOrChallenge`.

### `initChatGptRecovery()`

* **Located in**: [chatgpt_recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_recovery.js)
* **Parameters**: `(runtime = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `logChatGptStage()`
* **Description**: Orchestrates behavior for `initChatGptRecovery`.

### `isReloadBlocked()`

* **Located in**: [chatgpt_recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_recovery.js)
* **Parameters**: `(sceneId = "unknown")`
* **Returns**: `unknown`
* **Calls**: `getChatGptSendState()`
* **Called By**: `getChatGptLocationState()`, `validateGeneratedVideoFile()`, `scanProjectAndRunVeoUpHandler()`, `requestReloadWithReason()`, `forceCleanChatGptNewChatRotation()`, `initIpcHandlers()`
* **Description**: Orchestrates behavior for `isReloadBlocked`.

### `requestReloadWithReason()`

* **Located in**: [chatgpt_recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_recovery.js)
* **Parameters**: `(page, reason, sceneId = "unknown")`
* **Returns**: `unknown`
* **Calls**: `isReloadBlocked()`, `appendAppLog()`
* **Called By**: `getChatGptLocationState()`, `isPipelineCancelledError()`, `refreshChatGptPageBeforeImageExtract()`, `waitForLatestChatGPTGeneratedImage()`, `resendImagePrompt()`, `isValidChatGptConversationUrl()`, `assertPipelineRunActive()`, `forceCleanChatGptNewChatRotation()`
* **Description**: Orchestrates behavior for `requestReloadWithReason`.

### `performDurableRecovery()`

* **Located in**: [chatgpt_recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_recovery.js)
* **Parameters**: `(page, options, sceneDir, snapshot, stage, targetPrompt, targetFiles)`
* **Returns**: `unknown`
* **Calls**: `getConversationState()`, `verifyAttachmentsReady()`, `appendAppLog()`, `hashChatGptSnapshotText()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `performDurableRecovery`.

### `isCdpCrashError()`

* **Located in**: [chatgpt_recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_recovery.js)
* **Parameters**: `(error)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `detectLoginWithRetry()`
* **Description**: Orchestrates behavior for `isCdpCrashError`.

### `detectLoginWithRetry()`

* **Located in**: [chatgpt_recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_recovery.js)
* **Parameters**: `(page, provider, sceneId = "")`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `getChatGptSendState()`, `waitForCdpLoad()`, `evaluateOnCdpPage()`, `tryAutoLoginWithStoredAccount()`, `shouldRecoverFromCacheOrChallenge()`, `isCdpCrashError()`, `appendAppLog()`
* **Called By**: `validateGeneratedVideoFile()`
* **Description**: Orchestrates behavior for `detectLoginWithRetry`.

### `recoverChatGptBlockingUi()`

* **Located in**: [chatgpt_recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_recovery.js)
* **Parameters**: `(client, context = {})`
* **Returns**: `unknown`
* **Calls**: `closeUnexpectedProviderTabs()`, `sleep()`, `close()`, `getChatGptSendState()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: `waitForLatestChatGPTGeneratedImage()`
* **Description**: Orchestrates behavior for `recoverChatGptBlockingUi`.

### `recoverChatGptResponseChoiceChat()`

* **Located in**: [chatgpt_recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_recovery.js)
* **Parameters**: `(client, context = {})`
* **Returns**: `unknown`
* **Calls**: `evaluateOnCdpPage()`, `appendAppLog()`, `isChatGptActivelyGenerating()`, `sanitizeChatGptImageSnapshot()`
* **Called By**: `retryMotionPrompt()`
* **Description**: Orchestrates behavior for `recoverChatGptResponseChoiceChat`.

### `reset()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `startMonitoring()`
* **Description**: Orchestrates behavior for `reset`.

### `startMonitoring()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(page)`
* **Returns**: `unknown`
* **Calls**: `reset()`, `onBindingCalled()`, `logEvent()`
* **Called By**: `waitForLatestChatGPTGeneratedImage()`, `retryMotionPrompt()`, `sendPromptViaCdpInput()`
* **Description**: Orchestrates behavior for `startMonitoring`.

### `getReqId()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(req)`
* **Returns**: `unknown`
* **Calls**: `on()`, `evaluate()`, `onResponseReceived()`, `onLoadingFinished()`, `onConsoleAPICalled()`, `onExceptionThrown()`, `onFrameNavigated()`, `logEvent()`, `getBrowserScriptCode()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getReqId`.

### `stopMonitoring()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `off()`, `clearStabilityTimer()`, `clearAllWatchdogs()`, `logEvent()`
* **Called By**: `waitForLatestChatGPTGeneratedImage()`, `retryMotionPrompt()`
* **Description**: Orchestrates behavior for `stopMonitoring`.

### `getCurrentState()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `checkCondition()`, `checkTransition()`, `checkIntent()`, `checkSignal()`
* **Description**: Orchestrates behavior for `getCurrentState`.

### `getHealth()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getHealth`.

### `getDiagnostics()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getDiagnostics`.

### `captureSnapshot()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `refreshChatGptPageBeforeImageExtract()`, `waitForLatestChatGPTGeneratedImage()`, `constructor()`, `checkSignal()`, `assertPipelineRunActive()`, `sendPromptViaCdpInput()`
* **Description**: Orchestrates behavior for `captureSnapshot`.

### `setIntentOverride()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(intent)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `setIntentOverride`.

### `replay()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(log)`
* **Returns**: `unknown`
* **Calls**: `processIncomingEvent()`, `logEvent()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `replay`.

### `subscribe()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(listener)`
* **Returns**: `unknown`
* **Calls**: `on()`, `off()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `subscribe`.

### `waitUntil()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `({ state, confidence = 0.9, stableFor = 1000, timeout = 30000 })`
* **Returns**: `unknown`
* **Calls**: `off()`
* **Called By**: `waitForImageReady()`, `waitForResponseReady()`
* **Description**: Orchestrates behavior for `waitUntil`.

### `cleanup()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `onCancel()`, `checkCondition()`, `checkTransition()`, `checkIntent()`, `checkSignal()`, `trigger()`
* **Description**: Orchestrates behavior for `cleanup`.

### `checkCondition()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: `on()`, `getCurrentState()`, `cleanup()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `checkCondition`.

### `waitForTransition()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(fromState, toState, timeout = 30000)`
* **Returns**: `unknown`
* **Calls**: `off()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `waitForTransition`.

### `checkTransition()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: `on()`, `getCurrentState()`, `cleanup()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `checkTransition`.

### `waitForIntent()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(targetIntent, timeout = 30000)`
* **Returns**: `unknown`
* **Calls**: `off()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `waitForIntent`.

### `checkIntent()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: `on()`, `getCurrentState()`, `cleanup()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `checkIntent`.

### `waitForSignal()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(predicateFn, timeout = 30000)`
* **Returns**: `unknown`
* **Calls**: `off()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `waitForSignal`.

### `checkSignal()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: `on()`, `getCurrentState()`, `captureSnapshot()`, `cleanup()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `checkSignal`.

### `onResponseReceived()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: `triggerStateUpdate()`, `logEvent()`
* **Called By**: `getReqId()`
* **Description**: Orchestrates behavior for `onResponseReceived`.

### `onLoadingFinished()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: `triggerStateUpdate()`, `logEvent()`
* **Called By**: `getReqId()`
* **Description**: Orchestrates behavior for `onLoadingFinished`.

### `onBindingCalled()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: `hashText()`, `triggerStateUpdate()`, `logEvent()`
* **Called By**: `startMonitoring()`
* **Description**: Orchestrates behavior for `onBindingCalled`.

### `onConsoleAPICalled()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: `triggerStateUpdate()`, `logEvent()`
* **Called By**: `getReqId()`
* **Description**: Orchestrates behavior for `onConsoleAPICalled`.

### `onExceptionThrown()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: `triggerStateUpdate()`, `logEvent()`
* **Called By**: `getReqId()`
* **Description**: Orchestrates behavior for `onExceptionThrown`.

### `onFrameNavigated()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(event)`
* **Returns**: `unknown`
* **Calls**: `triggerStateUpdate()`, `logEvent()`
* **Called By**: `getReqId()`
* **Description**: Orchestrates behavior for `onFrameNavigated`.

### `processIncomingEvent()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(record)`
* **Returns**: `unknown`
* **Calls**: `hashText()`, `triggerStateUpdate()`
* **Called By**: `replay()`
* **Description**: Orchestrates behavior for `processIncomingEvent`.

### `clearStabilityTimer()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `stopMonitoring()`, `scheduleStateReevaluation()`
* **Description**: Orchestrates behavior for `clearStabilityTimer`.

### `scheduleStateReevaluation()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(reason, targetIdleMs = 3100)`
* **Returns**: `unknown`
* **Calls**: `clearStabilityTimer()`, `triggerStateUpdate()`
* **Called By**: `triggerStateUpdate()`
* **Description**: Orchestrates behavior for `scheduleStateReevaluation`.

### `triggerStateUpdate()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(reason)`
* **Returns**: `unknown`
* **Calls**: `scheduleStateReevaluation()`, `runIntentDetector()`, `runStateMachine()`, `computeConfidence()`, `manageWatchdogs()`, `logEvent()`
* **Called By**: `onResponseReceived()`, `onLoadingFinished()`, `onBindingCalled()`, `onConsoleAPICalled()`, `onExceptionThrown()`, `onFrameNavigated()`, `processIncomingEvent()`, `scheduleStateReevaluation()`
* **Description**: Orchestrates behavior for `triggerStateUpdate`.

### `runIntentDetector()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `triggerStateUpdate()`
* **Description**: Orchestrates behavior for `runIntentDetector`.

### `runStateMachine()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `triggerStateUpdate()`
* **Description**: Orchestrates behavior for `runStateMachine`.

### `computeConfidence()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `triggerStateUpdate()`
* **Description**: Orchestrates behavior for `computeConfidence`.

### `manageWatchdogs()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `logEvent()`
* **Called By**: `triggerStateUpdate()`
* **Description**: Orchestrates behavior for `manageWatchdogs`.

### `clearAllWatchdogs()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `stopMonitoring()`
* **Description**: Orchestrates behavior for `clearAllWatchdogs`.

### `logEvent()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(source, text, payload = null)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `startMonitoring()`, `getReqId()`, `stopMonitoring()`, `replay()`, `onResponseReceived()`, `onLoadingFinished()`, `onBindingCalled()`, `onConsoleAPICalled()`, `onExceptionThrown()`, `onFrameNavigated()`, `triggerStateUpdate()`, `manageWatchdogs()`
* **Description**: Orchestrates behavior for `logEvent`.

### `getBrowserScriptCode()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `getReqId()`
* **Description**: Orchestrates behavior for `getBrowserScriptCode`.

### `emitEvent()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(type, data)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `collectMetrics()`, `wrapHistory()`
* **Description**: Orchestrates behavior for `emitEvent`.

### `collectMetrics()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `extractConversationSnapshot()`, `emitEvent()`
* **Called By**: `wrapHistory()`
* **Description**: Orchestrates behavior for `collectMetrics`.

### `triggerDebounce()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `triggerDebounce`.

### `wrapHistory()`

* **Located in**: [chatgpt_runtime_monitor.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js)
* **Parameters**: `(type)`
* **Returns**: `unknown`
* **Calls**: `emitEvent()`, `collectMetrics()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `wrapHistory`.

### `initChatGptSend()`

* **Located in**: [chatgpt_send.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_send.js)
* **Parameters**: `(runtime = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `logChatGptStage()`
* **Description**: Orchestrates behavior for `initChatGptSend`.

### `isLikelyChatGptSendButtonText()`

* **Located in**: [chatgpt_send.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_send.js)
* **Parameters**: `(text)`
* **Returns**: `unknown`
* **Calls**: `normalize()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `isLikelyChatGptSendButtonText`.

### `clickSendButtonViaCdp()`

* **Located in**: [chatgpt_send.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_send.js)
* **Parameters**: `(page)`
* **Returns**: `unknown`
* **Calls**: `evaluateOnCdpPage()`
* **Called By**: `isPipelineCancelledError()`, `assertPipelineRunActive()`
* **Description**: Orchestrates behavior for `clickSendButtonViaCdp`.

### `forceClickChatGptComposerSubmit()`

* **Located in**: [chatgpt_send.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_send.js)
* **Parameters**: `(client)`
* **Returns**: `unknown`
* **Calls**: `evaluateOnCdpPage()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `forceClickChatGptComposerSubmit`.

### `waitForHeavyChatGptPromptDomCooldown()`

* **Located in**: [chatgpt_send.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_send.js)
* **Parameters**: `(prompt = "", context = {})`
* **Returns**: `unknown`
* **Calls**: `setChatGptSendState()`, `sleep()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: `assertPipelineRunActive()`
* **Description**: Orchestrates behavior for `waitForHeavyChatGptPromptDomCooldown`.

### `sendPromptViaCdpInput()`

* **Located in**: [chatgpt_send.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_send.js)
* **Parameters**: `(client, prompt, options = {})`
* **Returns**: `unknown`
* **Calls**: `setChatGptSendState()`, `sleep()`, `evaluateOnCdpPage()`, `startMonitoring()`, `captureSnapshot()`, `vidoraClearChatGptInputBeforePaste()`, `appendAppLog()`
* **Called By**: `sendPromptViaWeb()`, `validateGeneratedVideoFile()`, `isPipelineCancelledError()`, `waitForLatestChatGPTGeneratedImage()`, `resendImagePrompt()`, `retryMotionPrompt()`, `isValidChatGptConversationUrl()`
* **Description**: Orchestrates behavior for `sendPromptViaCdpInput`.

### `sendPromptViaCdpInputSingle()`

* **Located in**: [chatgpt_send.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_send.js)
* **Parameters**: `(client, prompt, context = {})`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `sendPromptViaCdpInputSingle`.

### `focusNv2ComposerWithCdp()`

* **Located in**: [chatgpt_send.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_send.js)
* **Parameters**: `(client, prompt, context = {})`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `assertPipelineRunActive()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: `sendNv2PromptViaDeepCdpInput()`
* **Description**: Orchestrates behavior for `focusNv2ComposerWithCdp`.

### `sendNv2PromptViaDeepCdpInput()`

* **Located in**: [chatgpt_send.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_send.js)
* **Parameters**: `(client, prompt, context = {})`
* **Returns**: `unknown`
* **Calls**: `setChatGptSendState()`, `sleep()`, `evaluateOnCdpPage()`, `focusNv2ComposerWithCdp()`, `appendAppLog()`
* **Called By**: `isPipelineCancelledError()`
* **Description**: Orchestrates behavior for `sendNv2PromptViaDeepCdpInput`.

### `vidoraReadChatGptComposerStateReal()`

* **Located in**: [chatgpt_send.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_send.js)
* **Parameters**: `(client, context = {})`
* **Returns**: `unknown`
* **Calls**: `evaluateOnCdpPage()`
* **Called By**: `logChatGptStage()`, `vidoraChatGptInputGate()`, `vidoraClearChatGptInputBeforePaste()`
* **Description**: Orchestrates behavior for `vidoraReadChatGptComposerStateReal`.

### `vidoraClickChatGptRealSendButton()`

* **Located in**: [chatgpt_send.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_send.js)
* **Parameters**: `(client, state)`
* **Returns**: `unknown`
* **Calls**: `sleep()`
* **Called By**: `vidoraChatGptInputGate()`
* **Description**: Orchestrates behavior for `vidoraClickChatGptRealSendButton`.

### `vidoraChatGptInputGate()`

* **Located in**: [chatgpt_send.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_send.js)
* **Parameters**: `(client, context = {})`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `vidoraReadChatGptComposerStateReal()`, `vidoraClickChatGptRealSendButton()`, `appendAppLog()`
* **Called By**: `waitForLatestChatGPTGeneratedImage()`
* **Description**: Orchestrates behavior for `vidoraChatGptInputGate`.

### `vidoraClearChatGptInputBeforePaste()`

* **Located in**: [chatgpt_send.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_send.js)
* **Parameters**: `(client, context = {})`
* **Returns**: `unknown`
* **Calls**: `evaluateOnCdpPage()`, `vidoraReadChatGptComposerStateReal()`, `appendAppLog()`
* **Called By**: `sendPromptViaCdpInput()`
* **Description**: Orchestrates behavior for `vidoraClearChatGptInputBeforePaste`.

### `initChatGptUpload()`

* **Located in**: [chatgpt_upload.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_upload.js)
* **Parameters**: `(runtime = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `logChatGptStage()`
* **Description**: Orchestrates behavior for `initChatGptUpload`.

### `verifyAttachmentsReady()`

* **Located in**: [chatgpt_upload.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_upload.js)
* **Parameters**: `(filePaths, pageState)`
* **Returns**: `unknown`
* **Calls**: `setChatGptSendState()`, `sleep()`, `setInputFiles()`, `getConversationState()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: `performDurableRecovery()`
* **Description**: Orchestrates behavior for `verifyAttachmentsReady`.

### `uploadFileToChatGptDirectly()`

* **Located in**: [chatgpt_upload.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_upload.js)
* **Parameters**: `(page, filePath, sceneId = "")`
* **Returns**: `unknown`
* **Calls**: `sleep()`, `setInputFiles()`, `evaluateOnCdpPage()`, `appendAppLog()`
* **Called By**: `waitForLatestChatGPTGeneratedImage()`
* **Description**: Orchestrates behavior for `uploadFileToChatGptDirectly`.

### `initIpcHandlers()`

* **Located in**: [ipc_handlers.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/ipc/ipc_handlers.js)
* **Parameters**: `(runtime)`
* **Returns**: `unknown`
* **Calls**: `on()`, `getChatGptSendState()`, `isReloadBlocked()`, `safeIpcHandler()`, `appendAppLog()`
* **Called By**: `initializeApplication()`
* **Description**: Orchestrates behavior for `initIpcHandlers`.

### `__vidoraCompactConsoleArg()`

* **Located in**: [logging.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/logging/logging.js)
* **Parameters**: `(arg)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `__vidoraCompactConsoleArg`.

### `maskRouterText()`

* **Located in**: [logging.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/logging/logging.js)
* **Parameters**: `(value = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `sanitizeProjectValue()`, `safeWebAccount()`, `pickWebAccount()`, `sanitizeChatTitleForLog()`, `getSafeGrokAccounts()`, `writeGrokRouterCheckpoint()`, `validateGeneratedVideoFile()`, `sanitizeLogString()`, `runScenePipelineLockedInternal()`, `ensureContinuityReferencesForSceneVideo()`
* **Description**: Orchestrates behavior for `maskRouterText`.

### `sanitizeLogString()`

* **Located in**: [logging.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/logging/logging.js)
* **Parameters**: `(value = "")`
* **Returns**: `unknown`
* **Calls**: `maskRouterText()`
* **Called By**: `validateGeneratedVideoFile()`, `sanitizeLogValue()`, `sanitizeIpcValue()`, `safeIpcHandler()`, `appendAppLog()`
* **Description**: Orchestrates behavior for `sanitizeLogString`.

### `sanitizeLogValue()`

* **Located in**: [logging.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/logging/logging.js)
* **Parameters**: `(value, key = "", depth = 0, seen = new WeakSet()`
* **Returns**: `unknown`
* **Calls**: `sanitizeLogString()`
* **Called By**: `notifyRenderer()`, `appendAppLog()`
* **Description**: Orchestrates behavior for `sanitizeLogValue`.

### `sanitizeIpcValue()`

* **Located in**: [logging.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/logging/logging.js)
* **Parameters**: `(value, key = "", depth = 0, seen = new WeakSet()`
* **Returns**: `unknown`
* **Calls**: `sanitizeLogString()`
* **Called By**: `notifyRenderer()`, `safeIpcHandler()`, `appendAppLog()`
* **Description**: Orchestrates behavior for `sanitizeIpcValue`.

### `safeIpcHandler()`

* **Located in**: [logging.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/logging/logging.js)
* **Parameters**: `(handler)`
* **Returns**: `unknown`
* **Calls**: `handler()`, `sanitizeLogString()`, `sanitizeIpcValue()`
* **Called By**: `initIpcHandlers()`
* **Description**: Orchestrates behavior for `safeIpcHandler`.

### `vidoraCompactLogDetails()`

* **Located in**: [logging.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/logging/logging.js)
* **Parameters**: `(value, depth = 0)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `waitForLatestChatGPTGeneratedImage()`
* **Description**: Orchestrates behavior for `vidoraCompactLogDetails`.

### `vidoraShouldThrottleLog()`

* **Located in**: [logging.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/logging/logging.js)
* **Parameters**: `(key, intervalMs = 12000)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `vidoraShouldThrottleLog`.

### `appendAppLog()`

* **Located in**: [logging.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/logging/logging.js)
* **Parameters**: `(first, second, third, fourth)`
* **Returns**: `unknown`
* **Calls**: `sanitizeLogString()`, `sanitizeLogValue()`, `sanitizeIpcValue()`
* **Called By**: `logChatGptStage()`, `importCharacterPresetsHandler()`, `saveWebAccount()`, `checkProactiveMemoryGuard()`, `getChatGptLocationState()`, `captureAndLogChatGptDiagnostics()`, `updateChatGptConversationIdentity()`, `notifyRenderer()`, `notifyChatGptPolicyRefusal()`, `ensureAndMigratePrompts()`, `ensureUserPromptFile()`, `resolveEditablePromptPath()`, `chooseHardPromptFile()`, `validateLocalVideoFile()`, `mergeVideos()`, `checkWebLogin()`, `clearProviderSession()`, `isValidChatGptConversationUrl()`, `openFreshChatGptRootPage()`, `waitForGrokImagineReady()`, `waitForGrokImagineAgentReady()`, `forceGrokNormalImagineVideoMode()`, `ensureGrokImagineAgentPage()`, `assertGrokImagineAgentReady()`, `closeGrokTemplateModal()`, `validateGeneratedVideoFile()`, `forceGrokNormalImagineMode()`, `ensureGrokEmptyCanvas()`, `summarizeGrokSendState()`, `waitForGrokSendPreflight()`, `clickGrokSendButtonOnce()`, `labelGrokCanvas()`, `clearGrokCanvasChat()`, `confirmGrokVideoGenerationIfAsked()`, `sendGrokConfirmationText()`, `selectChatGptConversationByTitle()`, `waitForNewVideoUrl()`, `waitForGrokUploadedAsset()`, `uploadFileViaCdp()`, `pasteImageViaClipboard()`, `submitGrokVideoPrompt()`, `pressEnterToSubmit()`, `clickNode()`, `runVeoUpAutomation()`, `exportProject()`, `scanProjectAndRunVeoUpHandler()`, `initializeApplication()`, `connect()`, `__safe()`, `isPipelineCancelledError()`, `hasVisibleChatGptImageCandidate()`, `saveChatGPTGeneratedImageAsset()`, `refreshChatGptPageBeforeImageExtract()`, `waitForLatestChatGPTGeneratedImage()`, `resendImagePrompt()`, `verifyCanvas()`, `retryMotionPrompt()`, `maybeRenameChatGptCurrentConversationUntilTitle()`, `renameChatGptCurrentConversationUntilTitle()`, `waitForChatGptRecentItem()`, `checkChatGptCurrentConversationTitle()`, `norm()`, `assertPipelineRunActive()`, `requestReloadWithReason()`, `performDurableRecovery()`, `detectLoginWithRetry()`, `recoverChatGptBlockingUi()`, `recoverChatGptResponseChoiceChat()`, `forceCleanChatGptNewChatRotation()`, `waitForHeavyChatGptPromptDomCooldown()`, `sendPromptViaCdpInput()`, `sendPromptViaCdpInputSingle()`, `focusNv2ComposerWithCdp()`, `sendNv2PromptViaDeepCdpInput()`, `vidoraChatGptInputGate()`, `vidoraClearChatGptInputBeforePaste()`, `verifyAttachmentsReady()`, `uploadFileToChatGptDirectly()`, `initIpcHandlers()`, `formatDelta()`, `cancelPipelineRun()`, `stopPipeline()`, `runScenePipeline()`, `writePipelineSceneState()`, `clearMismatchedPath()`, `runScenePipelineLocked()`, `runScenePipelineLockedInternal()`, `startNextSceneChatGptPrefetch()`, `ensureContinuityReferencesForSceneVideo()`, `ensureContinuityReferencesForPreviousScene()`, `maybeResetChatGptPageForLongRun()`, `scanProjectAndRunVeoUp()`
* **Description**: Orchestrates behavior for `appendAppLog`.

### `getAppLogPath()`

* **Located in**: [logging.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/logging/logging.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `getAppLogPath`.

### `writeCrashLog()`

* **Located in**: [logging.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/logging/logging.js)
* **Parameters**: `(label, error, extra = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `runVeoUpAutomation()`, `scanProjectAndRunVeoUpHandler()`
* **Description**: Orchestrates behavior for `writeCrashLog`.

### `vidoraTraceExit()`

* **Located in**: [logging.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/logging/logging.js)
* **Parameters**: `(label, extra = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `runVeoUpAutomation()`
* **Description**: Orchestrates behavior for `vidoraTraceExit`.

### `getCdpPageMemoryMetrics()`

* **Located in**: [memory.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/memory/memory.js)
* **Parameters**: `(client)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `logMemoryMilestone()`
* **Description**: Orchestrates behavior for `getCdpPageMemoryMetrics`.

### `logMemoryMilestone()`

* **Located in**: [memory.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/memory/memory.js)
* **Parameters**: `(sceneId, milestone)`
* **Returns**: `unknown`
* **Calls**: `getCdpPageMemoryMetrics()`
* **Called By**: `saveChatGPTGeneratedImageAsset()`, `waitForLatestChatGPTGeneratedImage()`, `runScenePipelineLocked()`
* **Description**: Orchestrates behavior for `logMemoryMilestone`.

### `formatBytes()`

* **Located in**: [memory.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/memory/memory.js)
* **Parameters**: `(bytes)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `formatDelta()`
* **Description**: Orchestrates behavior for `formatBytes`.

### `formatDelta()`

* **Located in**: [memory.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/memory/memory.js)
* **Parameters**: `(bytes)`
* **Returns**: `unknown`
* **Calls**: `appendAppLog()`, `formatBytes()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `formatDelta`.

### `initPipelineRunner()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(runtime = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `initializeApplication()`
* **Description**: Orchestrates behavior for `initPipelineRunner`.

### `getScopedPipelineRunId()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `probeVideoDurationSeconds()`, `waitForStableFileSize()`, `validateLocalVideoFile()`, `runFfmpeg()`, `isValidChatGptConversationUrl()`, `pressEnterToSubmit()`, `runVeoUpAutomation()`, `makePipelineCancelledError()`, `isPipelineRunCancelled()`, `assertPipelineRunActive()`, `trackPipelineChildProcess()`, `writePipelineSceneState()`, `runScenePipelineLocked()`, `runScenePipelineLockedInternal()`, `isVeoUpStageError()`
* **Description**: Orchestrates behavior for `getScopedPipelineRunId`.

### `isPipelineRunCancelled()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(runId = getScopedPipelineRunId()`
* **Returns**: `unknown`
* **Calls**: `getScopedPipelineRunId()`
* **Called By**: `runVeoUpAutomation()`, `assertPipelineRunActive()`, `isVeoUpStageError()`
* **Description**: Orchestrates behavior for `isPipelineRunCancelled`.

### `registerPipelineWaiter()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(runId, reject)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `onCancel()`
* **Description**: Orchestrates behavior for `registerPipelineWaiter`.

### `trackPipelineChildProcess()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(child, runId = getScopedPipelineRunId()`
* **Returns**: `unknown`
* **Calls**: `getScopedPipelineRunId()`
* **Called By**: `probeVideoDurationSeconds()`, `runFfmpeg()`, `runVeoUpAutomation()`, `isVeoUpStageError()`
* **Description**: Orchestrates behavior for `trackPipelineChildProcess`.

### `cancelPipelineRun()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(runId = "")`
* **Returns**: `unknown`
* **Calls**: `makePipelineCancelledError()`, `clearAllChatGptPipelineLocks()`, `appendAppLog()`
* **Called By**: `stopPipeline()`
* **Description**: Orchestrates behavior for `cancelPipelineRun`.

### `stopPipeline()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(_event, payload = {})`
* **Returns**: `unknown`
* **Calls**: `appendAppLog()`, `cancelPipelineRun()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `stopPipeline`.

### `sanitizeScenePipelineResult()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(result = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `sanitizeScenePipelineResult`.

### `safeText()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(value, max = 20000)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `safePaths()`
* **Description**: Orchestrates behavior for `safeText`.

### `safePaths()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(value)`
* **Returns**: `unknown`
* **Calls**: `safeText()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `safePaths`.

### `runScenePipeline()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(_event, options = {})`
* **Returns**: `unknown`
* **Calls**: `assertPipelineRunActive()`, `appendAppLog()`, `runScenePipelineLocked()`
* **Called By**: `runFullPipeline()`
* **Description**: Orchestrates behavior for `runScenePipeline`.

### `checkIfAllScenesComplete()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(projectDir)`
* **Returns**: `unknown`
* **Calls**: `findSceneKeyframePathSafe()`
* **Called By**: `scanProjectAndRunVeoUpHandler()`
* **Description**: Orchestrates behavior for `checkIfAllScenesComplete`.

### `readPipelineSceneState()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(projectDir = "", sceneId = 0)`
* **Returns**: `unknown`
* **Calls**: `getPipelineStateFile()`, `pathExists()`
* **Called By**: `writePipelineSceneState()`, `runScenePipelineLocked()`, `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `readPipelineSceneState`.

### `writePipelineSceneState()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(projectDir, sceneId, fields = {})`
* **Returns**: `unknown`
* **Calls**: `appendAppLog()`, `getScopedPipelineRunId()`, `readPipelineSceneState()`, `pathExists()`
* **Called By**: `isValidChatGptConversationUrl()`, `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `writePipelineSceneState`.

### `assertDurableSceneSuccess()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(result = {})`
* **Returns**: `unknown`
* **Calls**: `isVeoUpStageError()`
* **Called By**: `runScenePipelineLocked()`
* **Description**: Orchestrates behavior for `assertDurableSceneSuccess`.

### `isSceneScopedFilePath()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(filePath = "", sceneId = 0)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `clearMismatchedPath()`, `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `isSceneScopedFilePath`.

### `prepareSceneContext()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(options = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `runScenePipelineLocked()`
* **Description**: Orchestrates behavior for `prepareSceneContext`.

### `clearMismatchedPath()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(key)`
* **Returns**: `unknown`
* **Calls**: `appendAppLog()`, `isSceneScopedFilePath()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `clearMismatchedPath`.

### `runScenePipelineLocked()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(_event, options)`
* **Returns**: `unknown`
* **Calls**: `forceCleanChatGptNewChatRotation()`, `isChatGptRequestRotationEligible()`, `getCdpPage()`, `sleep()`, `assertPipelineRunActive()`, `isPipelineCancelledError()`, `waitForCdpLoad()`, `appendAppLog()`, `logMemoryMilestone()`, `getScopedPipelineRunId()`, `readPipelineSceneState()`, `assertDurableSceneSuccess()`, `prepareSceneContext()`, `runScenePipelineLockedInternal()`, `getDurablePipelineBackoffMs()`, `getChatGptContextFresh()`, `setChatGptContextFresh()`, `pathExists()`, `isVeoUpStageError()`
* **Called By**: `runScenePipeline()`
* **Description**: Orchestrates behavior for `runScenePipelineLocked`.

### `runScenePipelineLockedInternal()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(_event, options)`
* **Returns**: `unknown`
* **Calls**: `getGrokRouterStatus()`, `selectGrokAccount()`, `setAccountRouterEnabled()`, `classifyGrokRouterError()`, `writeGrokRouterCheckpoint()`, `loadHardPromptTasks()`, `getSceneMediaPaths()`, `validateLocalVideoFile()`, `getCdpPage()`, `sleep()`, `assertPipelineRunActive()`, `evaluateOnCdpPage()`, `decodeImageBufferToPng()`, `validateSavedImageFile()`, `adoptExistingSceneImage()`, `maskRouterText()`, `appendAppLog()`, `getScopedPipelineRunId()`, `readPipelineSceneState()`, `writePipelineSceneState()`, `isSceneScopedFilePath()`, `startNextSceneChatGptPrefetch()`, `imageFileToDataUrl()`, `ensureContinuityReferencesForPreviousScene()`, `getChatGptContextFresh()`, `normalizeVideoProvider()`, `normalizeContinuityReferenceSettings()`, `validateContinuityReferenceImage()`, `pathExists()`
* **Called By**: `runScenePipelineLocked()`, `startNextSceneChatGptPrefetch()`
* **Description**: Orchestrates behavior for `runScenePipelineLockedInternal`.

### `startNextSceneChatGptPrefetch()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(options = {}, currentSceneId = 0)`
* **Returns**: `unknown`
* **Calls**: `validateLocalVideoFile()`, `assertPipelineRunActive()`, `appendAppLog()`, `runScenePipelineLockedInternal()`
* **Called By**: `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `startNextSceneChatGptPrefetch`.

### `imageFileToDataUrl()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(imagePath)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `runScenePipelineLockedInternal()`, `appendContinuityGuidanceToMotionPrompt()`
* **Description**: Orchestrates behavior for `imageFileToDataUrl`.

### `ensureContinuityReferencesForSceneVideo()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `({ videoPath = '', projectDir = '', sceneId = 0, settings = {} } = {})`
* **Returns**: `unknown`
* **Calls**: `maskRouterText()`, `appendAppLog()`
* **Called By**: `ensureContinuityReferencesForPreviousScene()`
* **Description**: Orchestrates behavior for `ensureContinuityReferencesForSceneVideo`.

### `ensureContinuityReferencesForPreviousScene()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `({ projectDir = '', sceneId = 0, settings = {} } = {})`
* **Returns**: `unknown`
* **Calls**: `appendAppLog()`, `ensureContinuityReferencesForSceneVideo()`, `normalizeContinuityReferenceSettings()`
* **Called By**: `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `ensureContinuityReferencesForPreviousScene`.

### `buildContinuityPromptInstruction()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(referenceCount = 0)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `buildContinuityPromptInstruction`.

### `appendContinuityGuidanceToMotionPrompt()`

* **Located in**: [pipeline_runner.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/pipeline/pipeline_runner.js)
* **Parameters**: `(prompt = '', continuityRefs = {}, settings = {})`
* **Returns**: `unknown`
* **Calls**: `imageFileToDataUrl()`, `normalizeContinuityReferenceSettings()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `appendContinuityGuidanceToMotionPrompt`.

### `maybeResetChatGptPageForLongRun()`

* **Located in**: [recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/recovery/recovery.js)
* **Parameters**: `(client, rotateEveryScenes = 20)`
* **Returns**: `unknown`
* **Calls**: `appendAppLog()`
* **Called By**: `maybeRotateChatGptConversation()`
* **Description**: Orchestrates behavior for `maybeResetChatGptPageForLongRun`.

### `maybeRotateChatGptConversation()`

* **Located in**: [recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/recovery/recovery.js)
* **Parameters**: `(client, options = {})`
* **Returns**: `unknown`
* **Calls**: `maybeResetChatGptPageForLongRun()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `maybeRotateChatGptConversation`.

### `getDurablePipelineBackoffMs()`

* **Located in**: [recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/recovery/recovery.js)
* **Parameters**: `(retryCount = 1)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `runScenePipelineLocked()`
* **Description**: Orchestrates behavior for `getDurablePipelineBackoffMs`.

### `normalizeChatGptRetryText()`

* **Located in**: [recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/recovery/recovery.js)
* **Parameters**: `(text = "")`
* **Returns**: `unknown`
* **Calls**: `normalize()`
* **Called By**: `retryMotionPrompt()`, `isRetryableChatGptToolErrorText()`
* **Description**: Orchestrates behavior for `normalizeChatGptRetryText`.

### `isRetryableChatGptToolErrorText()`

* **Located in**: [recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/recovery/recovery.js)
* **Parameters**: `(text = "", stage = "")`
* **Returns**: `unknown`
* **Calls**: `normalizeChatGptRetryText()`
* **Called By**: `retryMotionPrompt()`
* **Description**: Orchestrates behavior for `isRetryableChatGptToolErrorText`.

### `isChatGptPolicyRefusalText()`

* **Located in**: [recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/recovery/recovery.js)
* **Parameters**: `(text = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `resendImagePrompt()`, `retryMotionPrompt()`
* **Description**: Orchestrates behavior for `isChatGptPolicyRefusalText`.

### `normalizeGrokResultRetryLimit()`

* **Located in**: [recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/recovery/recovery.js)
* **Parameters**: `(config = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `validateGeneratedVideoFile()`
* **Description**: Orchestrates behavior for `normalizeGrokResultRetryLimit`.

### `makeRetryableGrokGenerationError()`

* **Located in**: [recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/recovery/recovery.js)
* **Parameters**: `(reason = "unknown", details = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `closeGrokTemplateModal()`, `validateGeneratedVideoFile()`, `waitForNewVideoUrl()`
* **Description**: Orchestrates behavior for `makeRetryableGrokGenerationError`.

### `isRetryableGrokGenerationError()`

* **Located in**: [recovery.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/recovery/recovery.js)
* **Parameters**: `(error)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `validateGeneratedVideoFile()`
* **Description**: Orchestrates behavior for `isRetryableGrokGenerationError`.

### `getChatGptContextFresh()`

* **Located in**: [chatgpt_state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/chatgpt_state.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `isPipelineCancelledError()`, `isValidChatGptConversationUrl()`, `runScenePipelineLocked()`, `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `getChatGptContextFresh`.

### `setChatGptContextFresh()`

* **Located in**: [chatgpt_state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/chatgpt_state.js)
* **Parameters**: `(val)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `logChatGptStage()`, `getChatGptLocationState()`, `isValidChatGptConversationUrl()`, `forceCleanChatGptNewChatRotation()`, `runScenePipelineLocked()`
* **Description**: Orchestrates behavior for `setChatGptContextFresh`.

### `getPipelineStateFile()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(projectDir = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `readPipelineSceneState()`
* **Description**: Orchestrates behavior for `getPipelineStateFile`.

### `hashChatGptSnapshotText()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(value = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `isPipelineCancelledError()`, `performDurableRecovery()`
* **Description**: Orchestrates behavior for `hashChatGptSnapshotText`.

### `normalizeChatTitleValue()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(title = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `isSameChatTitle()`
* **Description**: Orchestrates behavior for `normalizeChatTitleValue`.

### `normalizeChatGptPromptCompareText()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(value = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `normalizeChatGptPromptCompareText`.

### `getChatGptConversationIdFromPath()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(pathname = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `updateChatGptConversationIdentity()`
* **Description**: Orchestrates behavior for `getChatGptConversationIdFromPath`.

### `isSameChatTitle()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(left = "", right = "")`
* **Returns**: `unknown`
* **Calls**: `normalizeChatTitleValue()`
* **Called By**: `updateChatGptConversationIdentity()`, `selectChatGptConversationByTitle()`, `maybeRenameChatGptCurrentConversationUntilTitle()`, `checkChatGptCurrentConversationTitle()`
* **Description**: Orchestrates behavior for `isSameChatTitle`.

### `verifyDraftOwnership()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(snapshot, pageState, expectedFilePaths = [])`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `isPipelineCancelledError()`
* **Description**: Orchestrates behavior for `verifyDraftOwnership`.

### `writeSceneSnapshot()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(sceneDir, data = {})`
* **Returns**: `unknown`
* **Calls**: `pathExists()`
* **Called By**: `isPipelineCancelledError()`, `isValidChatGptConversationUrl()`, `assertPipelineRunActive()`
* **Description**: Orchestrates behavior for `writeSceneSnapshot`.

### `readSceneSnapshot()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(sceneDir)`
* **Returns**: `unknown`
* **Calls**: `pathExists()`
* **Called By**: `isPipelineCancelledError()`, `isValidChatGptConversationUrl()`
* **Description**: Orchestrates behavior for `readSceneSnapshot`.

### `writeActionJournal()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(sceneDir, action)`
* **Returns**: `unknown`
* **Calls**: `pathExists()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `writeActionJournal`.

### `readActionJournal()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(sceneDir)`
* **Returns**: `unknown`
* **Calls**: `pathExists()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `readActionJournal`.

### `isChatGptActivelyGenerating()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(snapshot = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `hasVisibleChatGptImageCandidate()`, `waitForLatestChatGPTGeneratedImage()`, `recoverChatGptResponseChoiceChat()`
* **Description**: Orchestrates behavior for `isChatGptActivelyGenerating`.

### `sanitizeChatGptImageSnapshot()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(snapshot = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `refreshChatGptPageBeforeImageExtract()`, `waitForLatestChatGPTGeneratedImage()`, `recoverChatGptResponseChoiceChat()`
* **Description**: Orchestrates behavior for `sanitizeChatGptImageSnapshot`.

### `isNv2SnapshotGenerationActive()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(snapshot = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `extractCompletedNv2ResponseFromSnapshot()`, `selectLatestCompletedAssistantMessage()`
* **Description**: Orchestrates behavior for `isNv2SnapshotGenerationActive`.

### `extractCompletedNv2ResponseFromSnapshot()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(snapshot = {}, baseline = {})`
* **Returns**: `unknown`
* **Calls**: `isNv2SnapshotGenerationActive()`, `selectNewAssistantMessageAfterBaseline()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `extractCompletedNv2ResponseFromSnapshot`.

### `selectLatestCompletedAssistantMessage()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(snapshot = {})`
* **Returns**: `unknown`
* **Calls**: `isNv2SnapshotGenerationActive()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `selectLatestCompletedAssistantMessage`.

### `selectNewAssistantMessageAfterBaseline()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(snapshot = {}, baseline = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `extractCompletedNv2ResponseFromSnapshot()`
* **Description**: Orchestrates behavior for `selectNewAssistantMessageAfterBaseline`.

### `afterCurrentNv2User()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(message)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `afterCurrentNv2User`.

### `looksLikeCollapsedUserPrompt()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(text = "", kind = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `waitForLatestChatGPTGeneratedImage()`, `resendImagePrompt()`
* **Description**: Orchestrates behavior for `looksLikeCollapsedUserPrompt`.

### `isChatGptLimitText()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(text = "")`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `resendImagePrompt()`
* **Description**: Orchestrates behavior for `isChatGptLimitText`.

### `isChatGptDotLoadingCanvasAsset()`

* **Located in**: [state.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/state/state.js)
* **Parameters**: `(asset = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `waitForLatestChatGPTGeneratedImage()`, `norm()`
* **Description**: Orchestrates behavior for `isChatGptDotLoadingCanvasAsset`.

### `sanitizeFileName()`

* **Located in**: [utils.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/utils/utils.js)
* **Parameters**: `(value)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `saveProjectSessionFile()`, `openProjectSessionFile()`, `restoreEmbeddedProjectAssets()`, `sendPromptViaWeb()`, `runVeoUpAutomation()`, `isValidChatGptConversationUrl()`
* **Description**: Orchestrates behavior for `sanitizeFileName`.

### `normalizeVideoProvider()`

* **Located in**: [utils.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/utils/utils.js)
* **Parameters**: `(provider)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `writeGrokRouterCheckpoint()`, `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `normalizeVideoProvider`.

### `normalizeContinuityReferenceSettings()`

* **Located in**: [utils.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/utils/utils.js)
* **Parameters**: `(settings = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `validateLocalVideoFile()`, `closeGrokTemplateModal()`, `validateGeneratedVideoFile()`, `runScenePipelineLockedInternal()`, `ensureContinuityReferencesForPreviousScene()`, `appendContinuityGuidanceToMotionPrompt()`
* **Description**: Orchestrates behavior for `normalizeContinuityReferenceSettings`.

### `findSceneKeyframePathSafe()`

* **Located in**: [utils.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/utils/utils.js)
* **Parameters**: `(sceneDir, sceneId)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `sendPromptViaWeb()`, `scanProjectAndRunVeoUpHandler()`, `checkIfAllScenesComplete()`
* **Description**: Orchestrates behavior for `findSceneKeyframePathSafe`.

### `validateContinuityReferenceImage()`

* **Located in**: [utils.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/utils/utils.js)
* **Parameters**: `(filePath = "")`
* **Returns**: `unknown`
* **Calls**: `pathExists()`
* **Called By**: `probeVideoDurationSeconds()`, `extractLastFrameToPath()`, `validateLocalVideoFile()`, `runScenePipelineLockedInternal()`
* **Description**: Orchestrates behavior for `validateContinuityReferenceImage`.

### `pathExists()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(filePath)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `embedProjectAssets()`, `restoreEmbeddedProjectAssets()`, `readWebAccountStore()`, `resumeFromRouterCheckpoint()`, `ensureAndMigratePrompts()`, `findBundledPromptTemplate()`, `ensureUserPromptFile()`, `collectFromDir()`, `validateLocalVideoFile()`, `sendPromptViaWeb()`, `collectExistingProjectVideos()`, `checkAssetExists()`, `normalize()`, `isPipelineCancelledError()`, `waitForLatestChatGPTGeneratedImage()`, `isValidChatGptConversationUrl()`, `readPipelineSceneState()`, `writePipelineSceneState()`, `runScenePipelineLocked()`, `runScenePipelineLockedInternal()`, `writeSceneSnapshot()`, `readSceneSnapshot()`, `writeActionJournal()`, `readActionJournal()`, `validateContinuityReferenceImage()`, `listPngFiles()`, `collectKeyframes()`, `readPromptFile()`, `prepareVeoUpKeyframesFolder()`, `throwIfCancelled()`
* **Description**: Orchestrates behavior for `pathExists`.

### `getFileStat()`

* **Located in**: [utils.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/utils/utils.js)
* **Parameters**: `(filePath)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `getAssetStat()`
* **Description**: Orchestrates behavior for `getFileStat`.

### `getFfmpegBinaryPath()`

* **Located in**: [utils.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/utils/utils.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `probeVideoDurationSeconds()`, `runFfmpeg()`
* **Description**: Orchestrates behavior for `getFfmpegBinaryPath`.

### `ensureProjectFilePath()`

* **Located in**: [utils.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/utils/utils.js)
* **Parameters**: `(filePath)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `saveProjectSessionFile()`, `forceCleanChatGptNewChatRotation()`
* **Description**: Orchestrates behavior for `ensureProjectFilePath`.

### `hasFullPrivateEmail()`

* **Located in**: [utils.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/utils/utils.js)
* **Parameters**: `(value)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `assertNoProjectSecrets()`
* **Description**: Orchestrates behavior for `hasFullPrivateEmail`.

### `getUserPromptDir()`

* **Located in**: [utils.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/utils/utils.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `ensureAndMigratePrompts()`, `ensureUserPromptFile()`, `loadHardPromptTasks()`, `clickNode()`
* **Description**: Orchestrates behavior for `getUserPromptDir`.

### `getHardPromptConfigPath()`

* **Located in**: [utils.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/utils/utils.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `readHardPromptConfig()`, `writeHardPromptConfig()`
* **Description**: Orchestrates behavior for `getHardPromptConfigPath`.

### `initVeoUp()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(runtime)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `initializeApplication()`
* **Description**: Orchestrates behavior for `initVeoUp`.

### `findRunningVeoUpExecutablePaths()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `on()`
* **Called By**: `findVeoupExecutable()`, `resolveVeoUpLauncher()`
* **Description**: Orchestrates behavior for `findRunningVeoUpExecutablePaths`.

### `findVeoupExecutable()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `findRunningVeoUpExecutablePaths()`, `searchExesInDir()`, `parseVersion()`, `compareVersions()`
* **Called By**: `resolveVeoUpLauncher()`, `startCoordinateSetup()`
* **Description**: Orchestrates behavior for `findVeoupExecutable`.

### `searchExesInDir()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(dir, currentDepth, maxDepth)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `findVeoupExecutable()`
* **Description**: Orchestrates behavior for `searchExesInDir`.

### `parseVersion()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(filePath)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `findVeoupExecutable()`
* **Description**: Orchestrates behavior for `parseVersion`.

### `compareVersions()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(v1, v2)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `findVeoupExecutable()`
* **Description**: Orchestrates behavior for `compareVersions`.

### `isProcessRunning()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(processName)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `startCoordinateSetup()`
* **Description**: Orchestrates behavior for `isProcessRunning`.

### `findRunningVeoUpWindow()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `on()`, `foreach()`
* **Called By**: `throwIfCancelled()`
* **Description**: Orchestrates behavior for `findRunningVeoUpWindow`.

### `foreach()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `($win in $windows)`
* **Returns**: `unknown`
* **Calls**: `on()`
* **Called By**: `findRunningVeoUpWindow()`, `buildPowerShellScript()`
* **Description**: Orchestrates behavior for `foreach`.

### `findWindowsShortcutLaunchers()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `resolveVeoUpLauncher()`
* **Description**: Orchestrates behavior for `findWindowsShortcutLaunchers`.

### `walk()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(dir, depth = 0)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `walk`.

### `resolveVeoUpLauncher()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(payload = {})`
* **Returns**: `unknown`
* **Calls**: `findRunningVeoUpExecutablePaths()`, `findVeoupExecutable()`, `findWindowsShortcutLaunchers()`
* **Called By**: `throwIfCancelled()`
* **Description**: Orchestrates behavior for `resolveVeoUpLauncher`.

### `normalizeWhitespace()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(value = '')`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `collectMotionPrompts()`, `exportVeoUpPromptFile()`
* **Description**: Orchestrates behavior for `normalizeWhitespace`.

### `sceneNumberFrom()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(value = '', fallback = 0)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `sortBySceneNumber()`, `collectMotionPrompts()`, `prepareVeoUpKeyframesFolder()`
* **Description**: Orchestrates behavior for `sceneNumberFrom`.

### `sortBySceneNumber()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(items = [])`
* **Returns**: `unknown`
* **Calls**: `sceneNumberFrom()`
* **Called By**: `collectKeyframes()`, `collectMotionPrompts()`, `prepareVeoUpKeyframesFolder()`, `exportVeoUpPromptFile()`
* **Description**: Orchestrates behavior for `sortBySceneNumber`.

### `sceneFileToken()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(sceneId)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `prepareVeoUpKeyframesFolder()`
* **Description**: Orchestrates behavior for `sceneFileToken`.

### `listPngFiles()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(folderPath)`
* **Returns**: `unknown`
* **Calls**: `pathExists()`
* **Called By**: `collectKeyframes()`
* **Description**: Orchestrates behavior for `listPngFiles`.

### `collectKeyframes()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(outputFolder = '', scenes = [])`
* **Returns**: `unknown`
* **Calls**: `pathExists()`, `sortBySceneNumber()`, `listPngFiles()`
* **Called By**: `throwIfCancelled()`
* **Description**: Orchestrates behavior for `collectKeyframes`.

### `readPromptFile()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(filePath)`
* **Returns**: `unknown`
* **Calls**: `pathExists()`
* **Called By**: `collectMotionPrompts()`
* **Description**: Orchestrates behavior for `readPromptFile`.

### `isSavedPromptPlaceholder()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(value = '')`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `collectMotionPrompts()`
* **Description**: Orchestrates behavior for `isSavedPromptPlaceholder`.

### `collectMotionPrompts()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(outputFolder = '', scenes = [])`
* **Returns**: `unknown`
* **Calls**: `normalizeWhitespace()`, `sceneNumberFrom()`, `sortBySceneNumber()`, `readPromptFile()`, `isSavedPromptPlaceholder()`
* **Called By**: `throwIfCancelled()`
* **Description**: Orchestrates behavior for `collectMotionPrompts`.

### `quoteForFileDialog()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(filePath)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `throwIfCancelled()`
* **Description**: Orchestrates behavior for `quoteForFileDialog`.

### `convertVeoUpClientPointToScreen()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `({ clientScreenOrigin = {}, configuredClientPoint = {} } = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: *None*
* **Description**: Orchestrates behavior for `convertVeoUpClientPointToScreen`.

### `prepareVeoUpKeyframesFolder()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(outputFolder = '', keyframes = [])`
* **Returns**: `unknown`
* **Calls**: `pathExists()`, `sceneNumberFrom()`, `sortBySceneNumber()`, `sceneFileToken()`
* **Called By**: `throwIfCancelled()`
* **Description**: Orchestrates behavior for `prepareVeoUpKeyframesFolder`.

### `exportVeoUpPromptFile()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(outputFolder = '', prompts = [])`
* **Returns**: `unknown`
* **Calls**: `normalizeWhitespace()`, `sortBySceneNumber()`
* **Called By**: `throwIfCancelled()`
* **Description**: Orchestrates behavior for `exportVeoUpPromptFile`.

### `buildPowerShellScript()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(coords = {})`
* **Returns**: `unknown`
* **Calls**: `foreach()`, `EnumWindows()`
* **Called By**: `throwIfCancelled()`
* **Description**: Orchestrates behavior for `buildPowerShellScript`.

### `EnumWindows()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(delegate(IntPtr hWnd, IntPtr lParam)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `buildPowerShellScript()`, `startCoordinateSetup()`
* **Description**: Orchestrates behavior for `EnumWindows`.

### `runPowerShell()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(scriptPath, payloadPath, timeoutMs = 120000, options = {})`
* **Returns**: `unknown`
* **Calls**: `on()`
* **Called By**: `throwIfCancelled()`
* **Description**: Orchestrates behavior for `runPowerShell`.

### `handleExit()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(code, signal)`
* **Returns**: `unknown`
* **Calls**: `on()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `handleExit`.

### `readJsonFileStripBom()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(filePath)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `throwIfCancelled()`, `getVeoUpCoordinateConfig()`
* **Description**: Orchestrates behavior for `readJsonFileStripBom`.

### `executeVeoUpAutomation()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(payload = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `runVeoUpAutomation()`, `scanProjectAndRunVeoUp()`, `isVeoUpStageError()`
* **Description**: Orchestrates behavior for `executeVeoUpAutomation`.

### `throwIfCancelled()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: `pathExists()`, `findRunningVeoUpWindow()`, `resolveVeoUpLauncher()`, `collectKeyframes()`, `collectMotionPrompts()`, `quoteForFileDialog()`, `prepareVeoUpKeyframesFolder()`, `exportVeoUpPromptFile()`, `buildPowerShellScript()`, `runPowerShell()`, `readJsonFileStripBom()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `throwIfCancelled`.

### `startCoordinateSetup()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(payload = {})`
* **Returns**: `unknown`
* **Calls**: `findVeoupExecutable()`, `isProcessRunning()`, `EnumWindows()`
* **Called By**: `startVeoUpCoordinateSetupHandler()`
* **Description**: Orchestrates behavior for `startCoordinateSetup`.

### `waitForHotkey()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `captureVeoUpCoordinate()`
* **Description**: Orchestrates behavior for `waitForHotkey`.

### `trigger()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(key)`
* **Returns**: `unknown`
* **Calls**: `cleanup()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `trigger`.

### `cancelCoordinateSetup()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `()`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `cancelVeoUpCoordinateSetupHandler()`
* **Description**: Orchestrates behavior for `cancelCoordinateSetup`.

### `validateBlueBoxCoordinate()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(hwnd, offsetX, offsetY)`
* **Returns**: `unknown`
* **Calls**: `on()`
* **Called By**: `captureVeoUpCoordinate()`
* **Description**: Orchestrates behavior for `validateBlueBoxCoordinate`.

### `previewStartButtonCoordinate()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(hwnd, offsetX, offsetY)`
* **Returns**: `unknown`
* **Calls**: `on()`
* **Called By**: `captureVeoUpCoordinate()`
* **Description**: Orchestrates behavior for `previewStartButtonCoordinate`.

### `captureVeoUpCoordinate()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(pointType, userDataDir)`
* **Returns**: `unknown`
* **Calls**: `on()`, `waitForHotkey()`, `validateBlueBoxCoordinate()`, `previewStartButtonCoordinate()`
* **Called By**: `captureVeoUpCoordinateHandler()`
* **Description**: Orchestrates behavior for `captureVeoUpCoordinate`.

### `saveVeoUpCoordinateConfig()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(userDataDir, config)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `saveVeoUpCoordinateConfigHandler()`
* **Description**: Orchestrates behavior for `saveVeoUpCoordinateConfig`.

### `getVeoUpCoordinateConfig()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(userDataDir)`
* **Returns**: `unknown`
* **Calls**: `readJsonFileStripBom()`
* **Called By**: `getVeoUpCoordinateConfigHandler()`, `scanProjectAndRunVeoUpHandler()`
* **Description**: Orchestrates behavior for `getVeoUpCoordinateConfig`.

### `deleteVeoUpCoordinateConfig()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(payload)`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `deleteVeoUpCoordinateConfigHandler()`
* **Description**: Orchestrates behavior for `deleteVeoUpCoordinateConfig`.

### `scanProjectAndRunVeoUp()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(payload = {})`
* **Returns**: `unknown`
* **Calls**: `appendAppLog()`, `executeVeoUpAutomation()`
* **Called By**: *None*
* **Description**: Orchestrates behavior for `scanProjectAndRunVeoUp`.

### `getVeoUpVideoSourcePath()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(result = {})`
* **Returns**: `unknown`
* **Calls**: *None*
* **Called By**: `isValidChatGptConversationUrl()`
* **Description**: Orchestrates behavior for `getVeoUpVideoSourcePath`.

### `isVeoUpStageError()`

* **Located in**: [veoup.js](file:///d:/bac_tai/Grok-bac-Tai/electron/main/veoup/veoup.js)
* **Parameters**: `(error)`
* **Returns**: `unknown`
* **Calls**: `assertPipelineRunActive()`, `getScopedPipelineRunId()`, `isPipelineRunCancelled()`, `trackPipelineChildProcess()`, `executeVeoUpAutomation()`
* **Called By**: `assertDurableSceneSuccess()`, `runScenePipelineLocked()`
* **Description**: Orchestrates behavior for `isVeoUpStageError`.

