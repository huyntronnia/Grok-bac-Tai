"use strict";

const assert = require("assert");
const { validateManualOwnership } = require("../electron/main/chatgpt/manual_chatgpt_controller");

async function runTests() {
  console.log("Starting Manual ChatGPT Cross-Scene Isolation Tests...");

  const baselineScene1 = {
    sceneId: "scene_001",
    stage: "REQUEST_1",
    conversationId: "conv_abc",
    assistantCount: 2,
    userCount: 2,
  };

  const mockPage = {}; // dummy page

  // Test 1: Baseline for scene_001 fails validation when target scene is scene_002
  const res1 = await validateManualOwnership(mockPage, baselineScene1, "scene_002", "REQUEST_1");
  assert.strictEqual(res1.ok, false);
  assert(res1.reason.includes("belongs to scene scene_001, not scene_002"));

  // Test 2: Baseline for stage REQUEST_1 fails validation when target stage is NV1
  const res2 = await validateManualOwnership(mockPage, baselineScene1, "scene_001", "NV1");
  assert.strictEqual(res2.ok, false);
  assert(res2.reason.includes("belongs to stage REQUEST_1, not NV1"));

  console.log("Manual ChatGPT Cross-Scene Isolation Tests passed!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
