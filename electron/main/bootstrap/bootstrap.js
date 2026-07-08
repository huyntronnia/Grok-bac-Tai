"use strict";

let runtimeDeps = {};

function initBootstrap(runtime) {
  runtimeDeps = runtime;
}

function initializeApplication() {
  const {
    app,
    initChatGptPipeline,
    initVeoUp,
    initPipelineRunner,
    initIpcHandlers,
    ensureAndMigratePrompts,
    appendAppLog,
    buildAppMenu,
    runtimeChatGptPipeline,
    runtimeVeoUp,
    runtimePipelineRunner,
    runtimeIpcHandlers,
  } = runtimeDeps;

  app.setName("Vidora");

  initChatGptPipeline(runtimeChatGptPipeline);
  initVeoUp(runtimeVeoUp);
  initPipelineRunner(runtimePipelineRunner);
  initIpcHandlers(runtimeIpcHandlers);

  ensureAndMigratePrompts().catch((error) => {
    appendAppLog(null, {
      source: "main",
      kind: "error",
      text: `promptFile: startup migration and validation failed`,
      details: { error: error.message },
    }).catch(() => null);
  });

  buildAppMenu();
}

function createMainWindow() {
  const { BrowserWindow, path, electronDir } = runtimeDeps;
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: "Vidora",
    icon: path.join(electronDir, "vidora-icon.svg"),
    backgroundColor: "#090b16",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(electronDir, "preload.js"),
    },
  });

  mainWindow.loadFile(path.join(electronDir, "index.html"));
}

module.exports = {
  initBootstrap,
  initializeApplication,
  createMainWindow,
};
