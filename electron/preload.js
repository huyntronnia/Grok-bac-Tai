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
  stopPipeline: (options) => ipcRenderer.invoke('pipeline:stop', options),
  clearChatGptCache: () => ipcRenderer.invoke('chatgpt:clear-cache'),
  getWorkflowMode: () => ipcRenderer.invoke('workflow:get-mode'),
  setWorkflowMode: (mode) => ipcRenderer.invoke('workflow:set-mode', mode),
  initializeManualWorkflow: (payload) => ipcRenderer.invoke('manual-workflow:initialize', payload),
  resumeManualWorkflow: (payload) => ipcRenderer.invoke('manual-workflow:resume', payload),
  prepareManualStage: (payload) => ipcRenderer.invoke('manual-workflow:prepare', payload),
  armManualStage: (payload) => ipcRenderer.invoke('manual-workflow:arm', payload),
  captureManualStage: (payload) => ipcRenderer.invoke('manual-workflow:capture', payload),
  continueManualWorkflow: (payload) => ipcRenderer.invoke('manual-workflow:continue', payload),
  cancelManualStage: (payload) => ipcRenderer.invoke('manual-workflow:cancel', payload),
  redoManualStage: (payload) => ipcRenderer.invoke('manual-workflow:redo', payload),
  previewManualOverride: (payload) => ipcRenderer.invoke('manual-workflow:override-preview', payload),
  confirmManualOverride: (payload) => ipcRenderer.invoke('manual-workflow:override-confirm', payload),
  getManualViewModel: (payload) => ipcRenderer.invoke('manual-workflow:get-view-model', payload),
  getManualObservation: (payload) => ipcRenderer.invoke('manual-workflow:get-observation', payload),
  selectManualScene: (payload) => ipcRenderer.invoke('manual-workflow:select-scene', payload),
  onManualWorkflowChanged: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('manual-workflow:changed', listener);
    return () => ipcRenderer.removeListener('manual-workflow:changed', listener);
  },
  onManualWorkflowObservation: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('manual-workflow:observation', listener);
    return () => ipcRenderer.removeListener('manual-workflow:observation', listener);
  },
  submitManualVeoUp: (payload) => ipcRenderer.invoke('manual-workflow:submit-veoup', payload),
  copyManualText: (text) => ipcRenderer.invoke('manual-workflow:copy-text', text),
  openManualFolder: (folderPath) => ipcRenderer.invoke('manual-workflow:open-folder', folderPath),
  openManualChrome: () => ipcRenderer.invoke('manual-workflow:open-chrome'),
  toggleMiniBar: () => ipcRenderer.invoke('window:toggle-mini-bar'),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('window:set-always-on-top', flag),
  onMiniBarStateChanged: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('window:mini-bar-state-changed', listener);
    return () => ipcRenderer.removeListener('window:mini-bar-state-changed', listener);
  },
  openSceneFolder: (folderPath) => ipcRenderer.invoke('shell:open-folder', folderPath),
  openProjectPrepromptFolder: (projectPath) => ipcRenderer.invoke('project:open-preprompt-folder', projectPath),
  getVeoUpCoordinateConfig: () => ipcRenderer.invoke('veoup:get-coordinate-config'),
  startVeoUpCoordinateSetup: () => ipcRenderer.invoke('veoup:start-coordinate-setup'),
  captureVeoUpCoordinate: (pointType) => ipcRenderer.invoke('veoup:capture-coordinate', pointType),
  saveVeoUpCoordinateConfig: (config) => ipcRenderer.invoke('veoup:save-coordinate-config', config),
  deleteVeoUpCoordinateConfig: (payload) => ipcRenderer.invoke('veoup:delete-coordinate-config', payload),
  cancelVeoUpCoordinateSetup: () => ipcRenderer.invoke('veoup:cancel-coordinate-setup'),
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
