"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

async function runTests() {
  console.log("Starting Manual ChatGPT Button UI Tests...");

  const htmlPath = path.resolve(__dirname, "../electron/index.html");
  const htmlContent = fs.readFileSync(htmlPath, "utf8");

  assert(htmlContent.includes('id="manual-resume-btn"'), "manual workflow entry button must be present");
  assert(htmlContent.includes('id="manual-open-chrome-btn"'), "Manual Workflow must provide its dedicated Chrome launcher");
  assert(htmlContent.includes('id="manual-refresh-observation-btn"'), "Manual Workflow must show a GPT observation refresh control");
  assert(htmlContent.includes('id="manual-observation-details"'), "Manual Workflow must show the turns Vidora can read");
  assert(htmlContent.includes('id="manual-action-feedback"'), "Manual Workflow must show durable feedback for user actions");
  assert(htmlContent.includes('id="manual-action-log"'), "Manual Workflow must keep a compact action log below the controls");
  assert(!htmlContent.includes('value="REQUEST_1"'), "Request 1 must not be reachable from Manual Mode UI");
  assert(!htmlContent.includes('value="REQUEST_2"'), "Request 2 must not be reachable from Manual Mode UI");
  assert(htmlContent.includes('id="manual-retry-veoup-btn"'), "only the failure retry action may mention VeoUp");
  assert(!htmlContent.includes('id="manual-chatgpt-btn"'), "legacy Manual Mode toggle must not be reachable");
  assert(!htmlContent.includes('id="manual-chatgpt-toggle"'), "legacy Manual Mode checkbox must not be reachable");
  assert(!htmlContent.includes('id="manual-veoup-btn"'), "generic VeoUp action must not be reachable");
  assert(!htmlContent.includes('id="veoup-scan-run-btn"'), "legacy VeoUp scan action must not be reachable");

  const rendererPath = path.resolve(__dirname, "../electron/renderer.js");
  const rendererContent = fs.readFileSync(rendererPath, "utf8");
  assert(rendererContent.includes("startManualGptWorkflow"), "renderer must start the canonical manual workflow");

  const manualUiPath = path.resolve(__dirname, "../electron/manual_workflow_ui.js");
  const manualUiContent = fs.readFileSync(manualUiPath, "utf8");
  assert(manualUiContent.includes('api.openManualChrome()'), "Manual Chrome button must use its dedicated IPC API");
  assert(manualUiContent.includes('api.getManualObservation'), "Manual UI must retrieve its GPT observation through IPC");
  assert(manualUiContent.includes('function runAction'), "Manual UI buttons must show an in-progress state while commands run");
  assert(manualUiContent.includes('function setActionFeedback'), "Manual UI actions must produce visible success/error feedback");
  assert(manualUiContent.includes('function currentPromptText'), "Manual UI must guard clipboard actions against an empty prompt");
  assert(manualUiContent.includes('Chưa có prompt để copy'), "Manual UI must explain why a copy action is unavailable");

  const mainPath = path.resolve(__dirname, "../electron/main.js");
  const mainContent = fs.readFileSync(mainPath, "utf8");
  assert(mainContent.includes("MANUAL_CHROME_DEBUG_PORT = 9224"), "Manual Workflow must use an isolated Chrome debug port");
  assert(mainContent.includes("endpoint: MANUAL_CHROME_CDP_HOST"), "Manual observer must only attach to the dedicated Chrome instance");

  console.log("Manual ChatGPT Button UI Tests passed!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
