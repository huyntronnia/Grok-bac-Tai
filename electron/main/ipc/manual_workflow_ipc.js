"use strict";

const { WORKFLOW_MODE, getWorkflowMode, setWorkflowMode } = require("../state/workflow_mode");

const MANUAL_WORKFLOW_CHANNELS = Object.freeze({
  getMode: "workflow:get-mode",
  setMode: "workflow:set-mode",
  initialize: "manual-workflow:initialize",
  resume: "manual-workflow:resume",
  prepare: "manual-workflow:prepare",
  arm: "manual-workflow:arm",
  capture: "manual-workflow:capture",
  continue: "manual-workflow:continue",
  cancel: "manual-workflow:cancel",
  redo: "manual-workflow:redo",
  previewOverride: "manual-workflow:override-preview",
  confirmOverride: "manual-workflow:override-confirm",
  getViewModel: "manual-workflow:get-view-model",
  getObservation: "manual-workflow:get-observation",
  selectScene: "manual-workflow:select-scene",
  submitVeoUp: "manual-workflow:submit-veoup",
  cancelVeoUp: "manual-workflow:cancel-veoup",
  copyText: "manual-workflow:copy-text",
  openFolder: "manual-workflow:open-folder",
  openChrome: "manual-workflow:open-chrome",
});

function registerManualWorkflowIpc({
  ipcMain,
  safeIpcHandler = (handler) => handler,
  controller,
  copyText,
  openFolder,
  openChrome,
} = {}) {
  if (!ipcMain?.handle) throw new Error("manual-workflow-ipc-main-required");
  if (!controller) throw new Error("manual-workflow-controller-required");
  const register = (channel, handler) => ipcMain.handle(channel, safeIpcHandler(handler));

  register(MANUAL_WORKFLOW_CHANNELS.getMode, async () => ({
    ok: true,
    workflowMode: getWorkflowMode() || setWorkflowMode(WORKFLOW_MODE),
  }));
  register(MANUAL_WORKFLOW_CHANNELS.setMode, async (_event, value) => ({
    ok: true,
    workflowMode: setWorkflowMode(value),
  }));
  for (const [name, method] of [
    ["initialize", "initialize"],
    ["resume", "resume"],
    ["prepare", "prepare"],
    ["arm", "arm"],
    ["capture", "capture"],
    ["continue", "continue"],
    ["cancel", "cancel"],
    ["redo", "redo"],
    ["previewOverride", "previewOverride"],
    ["confirmOverride", "confirmOverride"],
    ["getViewModel", "getViewModel"],
    ["getObservation", "getObservation"],
    ["selectScene", "selectScene"],
    ["submitVeoUp", "submitVeoUp"],
    ["cancelVeoUp", "cancelVeoUp"],
  ]) {
    register(MANUAL_WORKFLOW_CHANNELS[name], (_event, payload = {}) => {
      if (name === "capture" && (payload.force || payload.skipBaselineCheck || payload.options?.force || payload.options?.skipBaselineCheck)) {
        return { ok: false, code: "NORMAL_CAPTURE_BYPASS_FORBIDDEN" };
      }
      return controller[method](payload || {});
    });
  }
  register(MANUAL_WORKFLOW_CHANNELS.copyText, async (_event, value = "") => {
    if (typeof copyText !== "function") throw new Error("manual-workflow-clipboard-unavailable");
    const text = String(value || "").trim();
    if (!text) return { ok: false, code: "PROMPT_NOT_READY", error: "manual-prompt-not-ready" };
    return copyText(text);
  });
  register(MANUAL_WORKFLOW_CHANNELS.openFolder, async (_event, folderPath = "") => {
    if (typeof openFolder !== "function") throw new Error("manual-workflow-shell-unavailable");
    return openFolder(String(folderPath || ""));
  });
  register(MANUAL_WORKFLOW_CHANNELS.openChrome, async () => {
    if (typeof openChrome !== "function") throw new Error("manual-workflow-chrome-unavailable");
    return openChrome();
  });
  return MANUAL_WORKFLOW_CHANNELS;
}

module.exports = {
  MANUAL_WORKFLOW_CHANNELS,
  registerManualWorkflowIpc,
};
