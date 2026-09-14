const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('videoPlannerAPI', {
  appendAppLog: (entry) => ipcRenderer.invoke('app:append-log', entry),
  getAppLogPath: () => ipcRenderer.invoke('app:get-log-path'),
  openHardPromptFile: (key) => ipcRenderer.invoke('prompt:open-hard-file', key),
  getHardPromptFile: () => ipcRenderer.invoke('prompt:get-hard-file'),
  chooseHardPromptFile: () => ipcRenderer.invoke('prompt:choose-hard-file'),
  listWebAccountsSafe: (provider) => ipcRenderer.invoke('accounts:list-safe', provider),
  saveWebAccount: (account) => ipcRenderer.invoke('accounts:save', account),
  deleteWebAccount: (accountId) => ipcRenderer.invoke('accounts:delete', accountId),
  getPipelineLogVisible: () => ipcRenderer.invoke('view:get-pipeline-log-visible'),
  onPipelineLogVisible: (callback) => {
    const listener = (_event, visible) => callback(Boolean(visible));
    ipcRenderer.on('view:pipeline-log-visible', listener);
    return () => ipcRenderer.removeListener('view:pipeline-log-visible', listener);
  },
  onPipelineNotice: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('pipeline:notice', listener);
    return () => ipcRenderer.removeListener('pipeline:notice', listener);
  },
  onPipelineLogEntry: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('pipeline:log-entry', listener);
    return () => ipcRenderer.removeListener('pipeline:log-entry', listener);
  },
  openWebLogin: (provider) => ipcRenderer.invoke('browser:open-login', provider),
  checkWebLogin: (provider, options) => ipcRenderer.invoke('browser:check-login', provider, options),
  chooseOutputFolder: () => ipcRenderer.invoke('output:choose-folder'),
  sendPromptViaWeb: (options) => ipcRenderer.invoke('browser:send-prompt', options),
  runScenePipeline: (options) => ipcRenderer.invoke('pipeline:run-scene', options),
  stopPipeline: (options) => ipcRenderer.invoke('pipeline:stop', options),
  clearChatGptCache: () => ipcRenderer.invoke('chatgpt:clear-cache'),
  openFreshChatGpt: () => ipcRenderer.invoke('chatgpt:open-fresh-chat'),
  startManualStage: (payload) => ipcRenderer.invoke('chatgpt:manual-start-stage', payload),
  captureManualStage: (payload) => ipcRenderer.invoke('chatgpt:manual-capture-stage', payload),
  forceCaptureManual: (payload) => ipcRenderer.invoke('pipeline:manual-force-capture', payload),
  copyPromptToClipboard: (text) => ipcRenderer.invoke('pipeline:manual-copy-prompt', text),
  onManualStepChanged: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('pipeline:manual-step-changed', listener);
    return () => ipcRenderer.removeListener('pipeline:manual-step-changed', listener);
  },
  getManualStatus: (payload) => ipcRenderer.invoke('chatgpt:manual-get-status', payload),
  cancelManualStage: (payload) => ipcRenderer.invoke('chatgpt:manual-cancel-stage', payload),
  getManualSceneAudit: (payload) => ipcRenderer.invoke('chatgpt:manual-get-scene-audit', payload),
  detectChatGPTProgress: (payload) => ipcRenderer.invoke('chatgpt:manual-detect-progress', payload),
  openSceneFolder: (folderPath) => ipcRenderer.invoke('shell:open-folder', folderPath),
  openProjectPrepromptFolder: (projectPath) => ipcRenderer.invoke('project:open-preprompt-folder', projectPath),
  runVeoUpAutomation: (options) => ipcRenderer.invoke('veoup:run-automation', options),
  getVeoUpCoordinateConfig: () => ipcRenderer.invoke('veoup:get-coordinate-config'),
  startVeoUpCoordinateSetup: () => ipcRenderer.invoke('veoup:start-coordinate-setup'),
  captureVeoUpCoordinate: (pointType) => ipcRenderer.invoke('veoup:capture-coordinate', pointType),
  saveVeoUpCoordinateConfig: (config) => ipcRenderer.invoke('veoup:save-coordinate-config', config),
  deleteVeoUpCoordinateConfig: (payload) => ipcRenderer.invoke('veoup:delete-coordinate-config', payload),
  cancelVeoUpCoordinateSetup: () => ipcRenderer.invoke('veoup:cancel-coordinate-setup'),
  scanProjectAndRunVeoUp: (options) => ipcRenderer.invoke('veoup:scan-project-and-run', options),
  getVeoUpBatchStatus: (options) => ipcRenderer.invoke('veoup:get-batch-status', options),
  cancelVeoUpBatch: (options) => ipcRenderer.invoke('veoup:cancel-batch', options),
  generateScenePrompts: (options) => ipcRenderer.invoke('ai:generate-scene-prompts', options),
  exportProject: (payload) => ipcRenderer.invoke('project:export', payload),
  newProjectSession: (options) => ipcRenderer.invoke('project:new-session', options),
  saveProjectSession: (payload) => ipcRenderer.invoke('project:save-session-file', payload),
  overwriteProjectSession: (options) => ipcRenderer.invoke('project:overwrite-session-file', options),
  createProjectSession: (options) => ipcRenderer.invoke('project:create-session-file', options),
  chooseProjectRootFolder: () => ipcRenderer.invoke('project:choose-root-folder'),
  ensureProjectSceneFolders: (options) => ipcRenderer.invoke('project:ensure-scene-folders', options),
  openProjectSession: () => ipcRenderer.invoke('project:open-session-file'),
  openLastProjectSession: () => ipcRenderer.invoke('project:open-last-session-file'),
  onProjectFlushBeforeClose: (callback) => {
    const listener = async (_event, token) => {
      let ok = false;
      try {
        ok = (await callback(token)) !== false;
      } catch (_error) {}
      ipcRenderer.send('project:flush-before-close-complete', { token, ok });
    };
    ipcRenderer.on('project:flush-before-close', listener);
    return () => ipcRenderer.removeListener('project:flush-before-close', listener);
  },
  renameChatGptCurrentChat: (title) => ipcRenderer.invoke('chatgpt:rename-current-chat', title),
  onProjectMenuCommand: (callback) => {
    const allowed = new Set(['new', 'open', 'save', 'settings']);
    const listener = (_event, command) => {
      if (allowed.has(command)) callback(command);
    };
    ipcRenderer.on('project:menu-command', listener);
    return () => ipcRenderer.removeListener('project:menu-command', listener);
  },

  chooseFolder: () => ipcRenderer.invoke('folder:choose'),
  scanFolder: (folderPath) => ipcRenderer.invoke('folder:scan', folderPath),
  extractLastFrame: (videoPath) => ipcRenderer.invoke('video:extract-last-frame', videoPath),
  extractLastFrameToPath: (videoPath, outputPath, options = {}) => ipcRenderer.invoke('video:extract-last-frame-to-path', { videoPath, outputPath, ...options }),
  mergeVideos: (folderPath, options = {}) => ipcRenderer.invoke('video:merge', folderPath, options),
  exportFinalVideo: (folderPath) => ipcRenderer.invoke('video:export-final', folderPath),
  copyImageToClipboard: (imagePath) => ipcRenderer.invoke('image:copy-to-clipboard', imagePath),
  assetExists: (filePath) => ipcRenderer.invoke('asset:exists', filePath),
  assetStat: (filePath) => ipcRenderer.invoke('asset:stat', filePath),
  getPreviousFrame: (folderPath, currentSceneIndex) => ipcRenderer.invoke('frame:get-previous', folderPath, currentSceneIndex),
  splitPromptWithAI: (options) => ipcRenderer.invoke('ai:split-prompt', options),
});
