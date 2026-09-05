"use strict";

const assert = require("assert");
const { sendPromptViaCdpInput } = require("../electron/main/chatgpt/chatgpt_send");

async function runTests() {
  console.log("Starting Manual ChatGPT No-Send Safety Tests...");

  // Test 1: sendPromptViaCdpInput throws error in manual mode via pipelineMode option
  let threw = false;
  try {
    await sendPromptViaCdpInput({}, "test prompt", { pipelineMode: "manualChatGPT" });
  } catch (err) {
    threw = true;
    assert.strictEqual(err.message, "manual mode does not send prompts");
  }
  assert(threw, "sendPromptViaCdpInput must throw when pipelineMode is manualChatGPT");

  // Test 2: sendPromptViaCdpInput throws error in manual mode via manualChatGPT flag
  threw = false;
  try {
    await sendPromptViaCdpInput({}, "test prompt", { manualChatGPT: true });
  } catch (err) {
    threw = true;
    assert.strictEqual(err.message, "manual mode does not send prompts");
  }
  assert(threw, "sendPromptViaCdpInput must throw when manualChatGPT flag is true");

  // Test 3: global flag guard
  globalThis.__vidoraManualChatGPTMode = true;
  threw = false;
  try {
    await sendPromptViaCdpInput({}, "test prompt");
  } catch (err) {
    threw = true;
    assert.strictEqual(err.message, "manual mode does not send prompts");
  } finally {
    globalThis.__vidoraManualChatGPTMode = false;
  }
  assert(threw, "sendPromptViaCdpInput must throw when __vidoraManualChatGPTMode global is true");

  console.log("Manual ChatGPT No-Send Safety Tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
