"use strict";

const assert = require("assert");
const { sendPromptViaCdpInput } = require("../electron/main/chatgpt/chatgpt_send");
const { setWorkflowMode } = require("../electron/main/state/workflow_mode");

async function runTests() {
  console.log("Starting Manual ChatGPT No-Send Safety Tests...");

  // The main-process workflow mode is canonical; renderer payload flags cannot disable it.
  setWorkflowMode();
  let threw = false;
  try {
    await sendPromptViaCdpInput({}, "test prompt");
  } catch (err) {
    threw = true;
    assert.strictEqual(err.code, "MANUAL_MODE_AUTOMATION_BLOCKED");
    assert.match(err.message, /manual-mode-automatic-chatgpt-mutation-blocked:send-prompt-via-cdp/);
  }
  assert(threw, "sendPromptViaCdpInput must never run in canonical manual mode");

  console.log("Manual ChatGPT No-Send Safety Tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
