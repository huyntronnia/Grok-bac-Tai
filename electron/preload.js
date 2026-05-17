const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('videoPlannerAPI', {
  appendAppLog: (entry) => ipcRenderer.invoke('app:append-log', entry),
  getAppLogPath: () => ipcRenderer.invoke('app:get-log-path'),
  openGrokRouterFolder: () => ipcRenderer.invoke('router:open-grok-folder'),
  getGrokRouterStatus: () => ipcRenderer.invoke('router:get-status'),
  listGrokAccountsSafe: () => ipcRenderer.invoke('router:list-accounts-safe'),
  selectGrokAccount: (accountId) => ipcRenderer.invoke('router:select-account', accountId),
  setAccountRouterEnabled: (enabled) => ipcRenderer.invoke('router:set-enabled', enabled),
  resumeFromRouterCheckpoint: () => ipcRenderer.invoke('router:resume-checkpoint'),
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
  openWebLogin: (provider) => ipcRenderer.invoke('browser:open-login', provider),
  checkWebLogin: (provider) => ipcRenderer.invoke('browser:check-login', provider),
  chooseOutputFolder: () => ipcRenderer.invoke('output:choose-folder'),
  sendPromptViaWeb: (options) => ipcRenderer.invoke('browser:send-prompt', options),
  runScenePipeline: (options) => ipcRenderer.invoke('pipeline:run-scene', options),
  generateScenePrompts: (options) => ipcRenderer.invoke('ai:generate-scene-prompts', options),
  exportProject: (payload) => ipcRenderer.invoke('project:export', payload),

  chooseFolder: () => ipcRenderer.invoke('folder:choose'),
  scanFolder: (folderPath) => ipcRenderer.invoke('folder:scan', folderPath),
  extractLastFrame: (videoPath) => ipcRenderer.invoke('video:extract-last-frame', videoPath),
  mergeVideos: (folderPath) => ipcRenderer.invoke('video:merge', folderPath),
  exportFinalVideo: (folderPath) => ipcRenderer.invoke('video:export-final', folderPath),
  copyImageToClipboard: (imagePath) => ipcRenderer.invoke('image:copy-to-clipboard', imagePath),
  assetExists: (filePath) => ipcRenderer.invoke('asset:exists', filePath),
  getPreviousFrame: (folderPath, currentSceneIndex) => ipcRenderer.invoke('frame:get-previous', folderPath, currentSceneIndex),
  splitPromptWithAI: (options) => ipcRenderer.invoke('ai:split-prompt', options),
});
