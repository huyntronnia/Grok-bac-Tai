"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const {
  startManualStage,
  getManualStatus,
  cancelManualStage,
} = require("../electron/main/chatgpt/manual_chatgpt_controller");
const { readSceneSnapshot } = require("../electron/main/state/state");

async function runTests() {
  console.log("Starting Manual ChatGPT Stage & Request Capture Tests...");

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "manual-chatgpt-test-"));
  const sceneId = "scene_001";
  const sceneDir = path.join(tmpDir, sceneId);
  await fs.mkdir(sceneDir, { recursive: true });

  try {
    // Test 1: startManualStage creates baseline and updates snapshot
    const res1 = await startManualStage(tmpDir, sceneId, "REQUEST_1");
    assert.strictEqual(res1.ok, true);
    assert.strictEqual(res1.stage, "REQUEST_1");
    assert(res1.baseline);
    assert.strictEqual(res1.baseline.sceneId, sceneId);

    const snapshot = await readSceneSnapshot(sceneDir);
    assert(snapshot.manualChatGpt);
    assert.strictEqual(snapshot.manualChatGpt.enabled, true);
    assert.strictEqual(snapshot.manualChatGpt.currentStage, "REQUEST_1");
    assert.strictEqual(snapshot.manualChatGpt.stages.REQUEST_1.started, true);

    // Test 2: getManualStatus returns active status
    const status = await getManualStatus(tmpDir, sceneId);
    assert.strictEqual(status.ok, true);
    assert.strictEqual(status.manualState.currentStage, "REQUEST_1");

    // Test 3: cancelManualStage clears active baseline
    const cancelRes = await cancelManualStage(tmpDir, sceneId);
    assert.strictEqual(cancelRes.ok, true);

    const snapshotAfterCancel = await readSceneSnapshot(sceneDir);
    assert.strictEqual(snapshotAfterCancel.manualChatGpt.baseline, null);

    console.log("Manual ChatGPT Stage & Request Capture Tests passed!");
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => null);
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
