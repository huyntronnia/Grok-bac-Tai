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
  const { BrowserWindow, ipcMain, path, electronDir } = runtimeDeps;
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
  let closeAllowed = false;
  let closeHandshake = null;
  const finishClose = () => {
    if (closeAllowed || mainWindow.isDestroyed()) return;
    closeAllowed = true;
    mainWindow.close();
  };
  mainWindow.on("close", (event) => {
    if (closeAllowed || mainWindow.isDestroyed()) return;
    event.preventDefault();
    if (closeHandshake) return;
    const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const channel = "project:flush-before-close-complete";
    const cleanup = () => {
      if (!closeHandshake) return;
      clearTimeout(closeHandshake.timer);
      ipcMain.removeListener(channel, closeHandshake.listener);
      closeHandshake = null;
    };
    const listener = (ipcEvent, payload = {}) => {
      if (ipcEvent.sender !== mainWindow.webContents || payload.token !== token) return;
      cleanup();
      finishClose();
    };
    closeHandshake = {
      listener,
      timer: setTimeout(() => {
        cleanup();
        finishClose();
      }, 7000),
    };
    ipcMain.on(channel, listener);
    mainWindow.webContents.send("project:flush-before-close", token);
  });
}

module.exports = {
  initBootstrap,
  initializeApplication,
  createMainWindow,
};
