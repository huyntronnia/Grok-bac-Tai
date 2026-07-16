# Vidora `main.js` removal map

## Purpose

This document guides deletion of Grok and PixVerse from `main.js`. Do not delete by broad line ranges alone: line numbers will drift and several shared ChatGPT helpers are interleaved with provider code. Delete by function/symbol name, then use reference scans to remove dead dependencies.

Current `main.js` is approximately 11,500 lines. A careful removal is expected to eliminate roughly 4,500-5,500 lines.

## Delete: Grok router state and handlers

Delete these symbols and their constants/filesystem paths when no references remain:

- `grokRouterState`
- `getSafeGrokAccounts`
- `getGrokRouterStatus`
- `setGrokAccountState`
- `selectGrokAccount`
- `setAccountRouterEnabled`
- `classifyGrokRouterError`
- `writeGrokRouterCheckpoint`
- `pauseGrokRouterForError`
- `resumeFromRouterCheckpoint`
- `openGrokRouterFolder`
- `listGrokAccountsSafe`
- `GROK_ROUTER_CHECKPOINT_FILE`
- `GROK_ROUTER_ALLOWED_STATES`

Also remove their entries from `runtimePipelineRunner` and `runtimeIpcHandlers` inside `app.whenReady()`.

## Delete: Grok video automation

Delete these functions after `generateVideoWithProvider()` has become VeoUp-only:

- `summarizeGrokGenerationError`
- `waitForGrokImagineReady`
- `sanitizeGrokUrlForLog`
- `isGrokImagineAgentUrl`
- `isGrokImagineReadyRoute`
- `getGrokRouteState`
- `waitForGrokImagineAgentReady`
- `forceGrokNormalImagineVideoMode`
- `ensureGrokImagineAgentPage`
- `assertGrokImagineAgentReady`
- `closeGrokTemplateModal`
- `uploadGrokGenerationInputs`
- `recoverGrokBeforeGenerationRetry`
- `generateGrokVideoWithRecovery`
- `forceGrokComposerImageUploadAndConfig`
- `forceGrokNormalImagineMode`
- `ensureGrokEmptyCanvas`
- `collectExistingProjectVideos`
- `restoreExistingProjectVideosToGrokCanvas`
- `restoreProjectKeyframesToGrokCanvas`
- `waitForGrokUploadSettled`
- `summarizeGrokSendState`
- `logGrokSendPreflight`
- `waitForGrokSendPreflight`
- `clickGrokSendButtonOnce`
- `waitForGrokSendOutcome`
- `retryGrokSendFailure`
- `clearGrokCanvasSelection`
- `buildGrokSafeMotionPrompt`
- `recoverGrokAfterContentPolicy`
- `recoverGrokCanvasAfterLimit`
- `addMediaFileToGrokCanvas`
- `labelGrokCanvas`
- `clearGrokCanvasChat`
- `confirmGrokVideoGenerationIfAsked`
- `sendGrokConfirmationText`
- `waitForGrokUploadedAsset`
- `clickGrokUploadAndChooseFile`
- `setFirstFileInput` if no non-Grok caller remains
- `pasteImageViaClipboard` if no non-Grok caller remains
- `submitGrokVideoPrompt`

## Delete: PixVerse automation

- `submitPixVersePrompt`
- `preparePixVerseComposerScript`
- `setPixVersePromptScript`
- `clickPixVerseCreateScript`
- PixVerse branches in upload, login, capability and provider selection.

## Delete: generic web-video layer that becomes unused

These functions currently exist to support Grok/PixVerse video generation. Delete after confirming no ChatGPT/VeoUp call site remains:

- `generateVideoWithGenericProvider`
- `waitForNewVideoUrl`
- `downloadBrowserAsset`
- `downloadAssetInPageScript`
- `collectVideoUrlsScript`
- `detectVideoCapabilityScript`
- `captureLatestImageElement` if still unreferenced
- `getPromptInputCandidates` if still unreferenced

## Delete: Grok/PixVerse DOM scripts

Remove all Grok/PixVerse-only page scripts, including:

- `detectGrokPageFailureScript`
- `getGrokReadyStateScript`
- `getGrokRouteStateScript`
- `detectGrokTemplateModalScript`
- `closeGrokTemplateModalScript`
- `getGrokTemplateViewportFallbackPointsScript`
- `scanGrokTemplateModalScript`
- `selectGrokPhotoVideoTemplateScript`
- `forceHideGrokTemplateModalScript`
- `prepareGrokVideoComposerScript`
- `setGrokComposerTextScript`
- `focusGrokComposerScript`
- `labelGrokCanvasScript`
- `clearGrokCanvasChatScript`
- `clickGrokUploadImageMenuItemScript`
- `clickGrokCanvasUploadImageScript`
- `focusGrokWorkspaceScript`
- `setGrokVideoPromptScript`
- `detectGrokConfirmationQuestionScript`
- `getGrokSendPreflightScript`
- `detectGrokUploadStateScript`
- `clickGrokComposerAreaScript`
- `dismissGrokConnectorsScript`
- `forceGrokVideoModeScript`
- `captureGrokSubmitStateScript`
- `detectGrokGeneratingStateScript`
- `detectGrokGenerationProblemScript`
- `clickGrokRetryButton`
- `clickGrokGenerateScript`

## Keep, but simplify to ChatGPT-only

Do not delete these functions wholesale:

- `getCdpPage`
- `ensureChromeDebug`
- `closeChromeDebug`
- `openWebLogin`
- `checkWebLogin`
- `sendPromptViaWeb`
- `detectLoginScript`
- `fillProviderLoginScript`
- `uploadFileViaCdp`
- `closeUnexpectedProviderTabs`
- `tryAutoLoginWithStoredAccount`
- `listWebAccountsSafe`
- `saveWebAccount`
- `deleteWebAccount`
- `markWebAccountState`
- `pickWebAccount`
- `validateGeneratedVideoFile`
- `collectProjectKeyframes`
- `restoreProjectKeyframesToChatGPT`

Required simplifications:

- `PROVIDER_META` should contain only ChatGPT.
- `normalizeWebProvider()` should return `chatgpt` for every unsupported value.
- `normalizeCredentialProvider()` should only accept/return `chatgpt`.
- `detectLoginScript()` should retain only ChatGPT shell/login detection.
- `fillProviderLoginScript()` should retain only ChatGPT login behavior.
- `uploadFileViaCdp()` should retain only the ChatGPT upload path.
- `getCdpPage()` should no longer create or search Grok/PixVerse tabs.
- `checkWebLogin()` should no longer inspect video capability.

## Replace `generateVideoWithProvider`

Preferred end state:

```js
async function generateVideoWithVeoUp({
  imagePath,
  motionPrompt,
  sceneDir,
  sceneId,
}) {
  // Existing VeoUp branch only.
}
```

The caller should no longer pass:

- `provider`
- `videoConfig.grok`
- `videoConfig.pixverse`
- Grok continuity settings
- account/router data

## Preserve manual ChatGPT IPC behavior

Do not route manual new-chat through deleted rotation functions.

- `clearChatGptCacheHandler()` stays.
- `openFreshChatGptHandler()` stays.
- Both must refuse while a pipeline/send is active.
- Cache clear must preserve cookies.
- Automatic rotation functions must remain disabled or be removed only after all automatic callers are removed.

## Cleanup procedure for `main.js`

1. Make VeoUp the only video generator at the call boundary.
2. Remove Grok router dependency injection.
3. Remove Grok/PixVerse top-level functions.
4. Remove their DOM scripts.
5. Simplify shared provider functions to ChatGPT.
6. Remove now-unused imports and constants.
7. Run `node --check main.js`.
8. Scan all unresolved symbol references.
9. Run IPC parity and tests.

