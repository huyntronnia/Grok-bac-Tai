"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "electron", "main.js"), "utf8");
const renderer = fs.readFileSync(path.join(root, "electron", "renderer.js"), "utf8");
const preload = fs.readFileSync(path.join(root, "electron", "preload.js"), "utf8");
const ipc = fs.readFileSync(
  path.join(root, "electron", "main", "ipc", "ipc_handlers.js"),
  "utf8",
);

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert(start >= 0 && end > start, `Missing source block: ${startMarker}`);
  return source.slice(start, end);
}

const autoMain = sliceBetween(
  main,
  "async function runVeoUpAutomation",
  "async function getVeoUpBatchStatusHandler",
);
const manualMain = sliceBetween(
  main,
  "async function scanProjectAndRunVeoUpHandler",
  "app.whenReady()",
);
assert(autoMain.includes("getVeoUpBatchCoordinator().requestBatch"), "Auto trigger must use the global coordinator");
assert(manualMain.includes("getVeoUpBatchCoordinator().requestBatch"), "Manual scan must use the same global coordinator");
assert(manualMain.includes("expectedSceneIds"), "Manual scan must validate explicit expected scene IDs");
assert(main.includes("createVeoUpBatchCoordinator"), "Main process batch coordinator must be initialized once");

const adapter = fs.readFileSync(
  path.join(root, "electron", "main", "veoup", "veoup.js"),
  "utf8",
);
assert(adapter.includes("activeVeoUpAutomationExecution"), "Adapter must lock batch and per-scene PowerShell globally");
assert(adapter.includes("veoup-automation-busy"), "Adapter contention must fail with a structured busy status");

const autoRenderer = sliceBetween(
  renderer,
  "async function maybeRunVeoUpAutomationAfterPipeline",
  "function getSelectedWebProvider",
);
assert(
  autoRenderer.includes("if (!isKeyframeMotionPromptOnlyModeEnabled()) return"),
  "Auto batch must be limited to the NV1/NV2-only mode to avoid duplicating per-scene VeoUp",
);
assert(autoRenderer.includes("isProjectCompleteForVeoUp()"), "Auto batch must require every project scene to be ready");
assert(autoRenderer.includes("trigger: reason"), "Auto request must identify its trigger");

const recovery = sliceBetween(renderer, "async function recoverWorkflowRun()", "async function openChatGptWindow()");
assert(recovery.includes("trigger: 'workflow-recovery'"), "Recovery must identify its coordinator trigger");
assert(recovery.includes("expectedSceneIds:"), "Recovery must send exact expected scene IDs");

const manualRenderer = sliceBetween(renderer, "(function initVeoUpProjectScan()", "})();");
assert(manualRenderer.includes("trigger: 'manual-scan'"), "Scan button must identify its coordinator trigger");
assert(manualRenderer.includes("expectedSceneIds:"), "Scan button must send exact expected scene IDs");

assert(preload.includes("veoup:get-batch-status"), "Batch status API must be exposed by preload");
assert(preload.includes("veoup:cancel-batch"), "Batch cancellation API must be exposed by preload");
assert(ipc.includes('"veoup:get-batch-status"'), "Batch status IPC handler missing");
assert(ipc.includes('"veoup:cancel-batch"'), "Batch cancellation IPC handler missing");

console.log("VeoUp unified batch trigger tests passed");
