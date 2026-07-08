function initIpcHandlers(runtime) {
  const {
    app,
    ipcMain,
    safeIpcHandler,
    getVeoUpCoordinateConfigHandler,
    startVeoUpCoordinateSetupHandler,
    captureVeoUpCoordinateHandler,
    deleteVeoUpCoordinateConfigHandler,
    saveVeoUpCoordinateConfigHandler,
    cancelVeoUpCoordinateSetupHandler,
    scanProjectAndRunVeoUpHandler,
    appendAppLog,
    getAppLogPath,
    openHardPromptFile,
    getHardPromptFileInfo,
    chooseHardPromptFile,
    openGrokRouterFolder,
    getGrokRouterStatus,
    listGrokAccountsSafe,
    selectGrokAccount,
    setAccountRouterEnabled,
    resumeFromRouterCheckpoint,
    listWebAccountsSafe,
    saveWebAccount,
    deleteWebAccount,
    getPipelineLogVisibility,
    openWebLogin,
    checkWebLogin,
    sendPromptViaWeb,
    runScenePipeline,
    stopPipeline,
    chooseOutputFolder,
    chooseProjectRootFolder,
    chooseFolder,
    scanFolder,
    extractLastFrame,
    extractLastFrameToPathHandler,
    mergeVideos,
    exportFinalVideo,
    copyImageToClipboard,
    checkAssetExists,
    getAssetStat,
    getPreviousFrame,
    splitPromptWithAI,
    generateScenePrompts,
    renameChatGptCurrentConversation,
    exportProject,
    newProjectSession,
    saveProjectSessionFile,
    overwriteProjectSessionFile,
    createProjectSessionFile,
    openProjectSessionFile,
    ensureProjectSceneFolders,
    importCharacterPresetsHandler,
    runVeoUpAutomation,
    getChatGptSendState,
    isReloadBlocked,
  } = runtime;

  ipcMain.handle(
    "veoup:get-coordinate-config",
    safeIpcHandler(getVeoUpCoordinateConfigHandler),
  );
  ipcMain.handle(
    "veoup:start-coordinate-setup",
    safeIpcHandler(startVeoUpCoordinateSetupHandler),
  );
  ipcMain.handle(
    "veoup:capture-coordinate",
    safeIpcHandler(captureVeoUpCoordinateHandler),
  );
  ipcMain.handle(
    "veoup:delete-coordinate-config",
    safeIpcHandler(deleteVeoUpCoordinateConfigHandler),
  );
  ipcMain.handle(
    "veoup:save-coordinate-config",
    safeIpcHandler(saveVeoUpCoordinateConfigHandler),
  );
  ipcMain.handle(
    "veoup:cancel-coordinate-setup",
    safeIpcHandler(cancelVeoUpCoordinateSetupHandler),
  );
  ipcMain.handle(
    "veoup:scan-project-and-run",
    safeIpcHandler(scanProjectAndRunVeoUpHandler),
  );

  ipcMain.handle("app:append-log", appendAppLog);
  ipcMain.handle("app:get-log-path", getAppLogPath);
  ipcMain.handle("prompt:open-hard-file", openHardPromptFile);
  ipcMain.handle("prompt:get-hard-file", getHardPromptFileInfo);
  ipcMain.handle("prompt:choose-hard-file", chooseHardPromptFile);
  ipcMain.handle("router:open-grok-folder", openGrokRouterFolder);
  ipcMain.handle("router:get-status", getGrokRouterStatus);
  ipcMain.handle("router:list-accounts-safe", listGrokAccountsSafe);
  ipcMain.handle("router:select-account", selectGrokAccount);
  ipcMain.handle("router:set-enabled", setAccountRouterEnabled);
  ipcMain.handle("router:resume-checkpoint", resumeFromRouterCheckpoint);
  ipcMain.handle("accounts:list-safe", listWebAccountsSafe);
  ipcMain.handle("accounts:save", saveWebAccount);
  ipcMain.handle("accounts:delete", deleteWebAccount);
  ipcMain.handle("view:get-pipeline-log-visible", getPipelineLogVisibility);
  ipcMain.handle("browser:open-login", openWebLogin);
  ipcMain.handle("browser:check-login", checkWebLogin);
  ipcMain.handle("browser:send-prompt", sendPromptViaWeb);
  ipcMain.handle("pipeline:run-scene", safeIpcHandler(runScenePipeline));
  ipcMain.handle('pipeline:stop', safeIpcHandler(stopPipeline));
  ipcMain.handle("output:choose-folder", chooseOutputFolder);
  ipcMain.handle("project:choose-root-folder", chooseProjectRootFolder);
  ipcMain.handle("folder:choose", chooseFolder);
  ipcMain.handle("folder:scan", scanFolder);
  ipcMain.handle("video:extract-last-frame", extractLastFrame);
  ipcMain.handle(
    "video:extract-last-frame-to-path",
    safeIpcHandler(extractLastFrameToPathHandler),
  );
  ipcMain.handle("video:merge", mergeVideos);
  ipcMain.handle("video:export-final", exportFinalVideo);
  ipcMain.handle("image:copy-to-clipboard", copyImageToClipboard);
  ipcMain.handle("asset:exists", checkAssetExists);
  ipcMain.handle("asset:stat", getAssetStat);
  ipcMain.handle("frame:get-previous", getPreviousFrame);
  ipcMain.handle("ai:split-prompt", splitPromptWithAI);
  ipcMain.handle("ai:generate-scene-prompts", generateScenePrompts);
  ipcMain.handle(
    "chatgpt:rename-current-chat",
    renameChatGptCurrentConversation,
  );
  ipcMain.handle("project:export", exportProject);
  ipcMain.handle("project:new-session", newProjectSession);
  ipcMain.handle("project:save-session-file", saveProjectSessionFile);
  ipcMain.handle("project:overwrite-session-file", overwriteProjectSessionFile);
  ipcMain.handle("project:create-session-file", createProjectSessionFile);
  ipcMain.handle("project:open-session-file", openProjectSessionFile);
  ipcMain.handle("project:ensure-scene-folders", ensureProjectSceneFolders);
  ipcMain.handle(
    "project:import-character-presets",
    safeIpcHandler(importCharacterPresetsHandler),
  );
  ipcMain.handle("veoup:run-automation", safeIpcHandler(runVeoUpAutomation));

  app.on("web-contents-created", (event, contents) => {
    appendAppLog(null, {
      source: "main",
      kind: "info",
      text: `[ELECTRON EVENT] WebContents created, id=${contents.id}, url=${contents.getURL()}`,
    }).catch(() => null);

    const originalReload = contents.reload;
    contents.reload = function () {
      const stack = new Error().stack || "";
      const timestamp = new Date().toISOString();
      const currentSceneId = globalThis.__vidoraLastProcessedSceneId || "unknown";
      const sendState = getChatGptSendState(currentSceneId);

      const blockedReason = isReloadBlocked(currentSceneId);
      if (blockedReason) {
        appendAppLog(currentSceneId, {
          source: "main",
          kind: "warning",
          text: `CHATGPT_RELOAD_BLOCKED: webContents.reload() canceled. ${blockedReason}`,
          details: { stack }
        }).catch(() => null);
        return;
      }

      appendAppLog(currentSceneId, {
        source: "main",
        kind: "warning",
        text: `CHATGPT_RELOAD_REQUESTED`,
        details: {
          timestamp,
          sceneId: currentSceneId,
          stage: sendState,
          reason: `webContents.reload() called for WebContents id=${contents.id}`,
          caller: "Electron webContents",
          stack
        },
      }).catch(() => null);

      if (sendState === "PREPARING" || sendState === "READY" || sendState === "CLICKING") {
        appendAppLog(currentSceneId, {
          source: "main",
          kind: "error",
          text: `RELOAD_BEFORE_SEND: webContents.reload() requested before SEND_CLICK_BEGIN! State = ${sendState}`,
          details: { stack },
        }).catch(() => null);
      }

      return originalReload.apply(this, arguments);
    };

    const originalReloadIgnoringCache = contents.reloadIgnoringCache;
    contents.reloadIgnoringCache = function () {
      const stack = new Error().stack || "";
      const timestamp = new Date().toISOString();
      const currentSceneId = globalThis.__vidoraLastProcessedSceneId || "unknown";
      const sendState = getChatGptSendState(currentSceneId);

      const blockedReason = isReloadBlocked(currentSceneId);
      if (blockedReason) {
        appendAppLog(currentSceneId, {
          source: "main",
          kind: "warning",
          text: `CHATGPT_RELOAD_BLOCKED: webContents.reloadIgnoringCache() canceled. ${blockedReason}`,
          details: { stack }
        }).catch(() => null);
        return;
      }

      appendAppLog(currentSceneId, {
        source: "main",
        kind: "warning",
        text: `CHATGPT_RELOAD_REQUESTED`,
        details: {
          timestamp,
          sceneId: currentSceneId,
          stage: sendState,
          reason: `webContents.reloadIgnoringCache() called for WebContents id=${contents.id}`,
          caller: "Electron webContents",
          stack
        },
      }).catch(() => null);

      if (sendState === "PREPARING" || sendState === "READY" || sendState === "CLICKING") {
        appendAppLog(currentSceneId, {
          source: "main",
          kind: "error",
          text: `RELOAD_BEFORE_SEND: webContents.reloadIgnoringCache() requested before SEND_CLICK_BEGIN! State = ${sendState}`,
          details: { stack },
        }).catch(() => null);
      }

      return originalReloadIgnoringCache.apply(this, arguments);
    };

    contents.on("render-process-gone", (e, details) => {
      appendAppLog(null, {
        source: "main",
        kind: "error",
        text: `CHATGPT_RENDERER_CRASH: WebContents id=${contents.id} render-process-gone: reason=${details?.reason || "unknown"}, exitCode=${details?.exitCode || 0}`,
        details: { details, isOom: details?.reason === "oom" || details?.reason === "out-of-memory" },
      }).catch(() => null);
    });

    contents.on("unresponsive", () => {
      appendAppLog(null, {
        source: "main",
        kind: "error",
        text: `[ELECTRON EVENT] WebContents id=${contents.id} unresponsive`,
      }).catch(() => null);
    });

    contents.on("crashed", (e, killed) => {
      appendAppLog(null, {
        source: "main",
        kind: "error",
        text: `CHATGPT_RENDERER_CRASH: WebContents id=${contents.id} crashed (killed=${killed})`,
      }).catch(() => null);
    });

    contents.on("did-fail-load", (e, errorCode, errorDescription, validatedURL, isMainFrame) => {
      appendAppLog(null, {
        source: "main",
        kind: "error",
        text: `CHATGPT_RENDERER_CRASH: WebContents id=${contents.id} did-fail-load: errorCode=${errorCode}, desc=${errorDescription}, url=${validatedURL}, mainFrame=${isMainFrame}`,
      }).catch(() => null);
    });

    contents.on("did-start-loading", () => {
      appendAppLog(null, {
        source: "main",
        kind: "info",
        text: `[ELECTRON EVENT] WebContents id=${contents.id} did-start-loading`,
      }).catch(() => null);
    });

    contents.on("did-stop-loading", () => {
      appendAppLog(null, {
        source: "main",
        kind: "info",
        text: `[ELECTRON EVENT] WebContents id=${contents.id} did-stop-loading`,
      }).catch(() => null);
    });
  });
}

module.exports = {
  initIpcHandlers,
};
