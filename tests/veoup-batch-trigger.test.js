"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "electron/main.js"), "utf8");
const controller = fs.readFileSync(path.join(root, "electron/main/chatgpt/manual_chatgpt_controller.js"), "utf8");
const html = fs.readFileSync(path.join(root, "electron/index.html"), "utf8");
const preload = fs.readFileSync(path.join(root, "electron/preload.js"), "utf8");
const ipc = fs.readFileSync(path.join(root, "electron/main/ipc/ipc_handlers.js"), "utf8");
const adapter = fs.readFileSync(path.join(root, "electron/main/veoup/veoup.js"), "utf8");

assert(main.includes("createVeoUpBatchCoordinator"), "Main process batch coordinator must be initialized once");
assert(main.includes("canonicalManualWorkflowController.submitVeoUp"), "legacy scan IPC must delegate to the canonical manual controller");
assert(controller.includes("autoStartVeoUpWhenReady"), "Manual completion must start VeoUp automatically");
assert(controller.includes('"manual-auto-complete"'), "automatic completion must identify its trigger");
assert(controller.includes("allowPartial: false"), "Manual workflow submission must always be strict");
assert(controller.includes("preSubmitAudit"), "Manual workflow must audit again just before submission");
assert(controller.includes("checkpoint.state === \"VEOUP_RUNNING\""), "Manual workflow must reject a concurrent VeoUp run");
assert(!html.includes('id="manual-veoup-btn"'), "generic manual VeoUp action must not be visible");
assert(!html.includes('id="veoup-scan-run-btn"'), "legacy manual VeoUp scan must not be visible");

assert(adapter.includes("activeVeoUpAutomationExecution"), "Adapter must lock batch and per-scene PowerShell globally");
assert(adapter.includes("veoup-automation-busy"), "Adapter contention must fail with a structured busy status");
assert(preload.includes("veoup:get-batch-status"), "Batch status API must be exposed by preload");
assert(preload.includes("veoup:cancel-batch"), "Batch cancellation API must be exposed by preload");
assert(ipc.includes('"veoup:get-batch-status"'), "Batch status IPC handler missing");
assert(ipc.includes('"veoup:cancel-batch"'), "Batch cancellation IPC handler missing");

console.log("Manual VeoUp batch trigger tests passed");
