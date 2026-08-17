"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const {
  createVeoUpBatchCoordinator,
} = require("../electron/main/veoup/batch_coordinator");
const {
  readVeoUpBatchState,
} = require("../electron/main/veoup/batch_state_store");

const VALID_PNG = Buffer.concat([
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
  Buffer.alloc(5000),
]);

const motionPrompt = (sceneId, suffix = "") =>
  `Scene ${sceneId}: slow camera tracking with controlled parallax, natural subject movement, stable framing, consistent lighting, and a clean final settle. ${suffix}`.trim();

async function createProject(root, count = 2) {
  for (let sceneId = 1; sceneId <= count; sceneId += 1) {
    const token = `scene_${String(sceneId).padStart(3, "0")}`;
    const sceneDir = path.join(root, token);
    await fs.mkdir(sceneDir, { recursive: true });
    await fs.writeFile(path.join(sceneDir, `${token}_keyframe.png`), VALID_PNG);
    await fs.writeFile(path.join(sceneDir, "motion_prompt.txt"), motionPrompt(sceneId), "utf8");
  }
}

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-veoup-coordinator-"));
  await createProject(root, 2);
  let executeCount = 0;
  const executionPayloads = [];
  const coordinator = createVeoUpBatchCoordinator({
    executeAutomation: async (payload) => {
      executeCount += 1;
      executionPayloads.push(payload);
      return {
        ok: true,
        imageCount: payload.scenes.length,
        promptLineCount: payload.scenes.length,
        expectedRows: payload.expectedRows,
        detectedRows: payload.expectedRows,
        generateAcknowledged: true,
      };
    },
  });

  const first = await coordinator.requestBatch({
    projectDir: root,
    expectedSceneCount: 2,
    autoStartVideoGeneration: true,
  });
  assert.strictEqual(first.ok, true);
  assert.strictEqual(first.status, "submitted");
  assert.strictEqual(executeCount, 1);
  assert.strictEqual(executionPayloads[0].batchMode, true);
  assert.strictEqual(executionPayloads[0].expectedRows, 2);
  assert.strictEqual(executionPayloads[0].chunkIndex, 1);
  assert.strictEqual(executionPayloads[0].chunkCount, 1);
  const saved = await readVeoUpBatchState(root);
  assert.strictEqual(saved.status, "submitted");
  assert.strictEqual(saved.expectedSceneCount, 2);

  const duplicate = await coordinator.requestBatch({
    projectDir: root,
    expectedSceneCount: 2,
    autoStartVideoGeneration: true,
  });
  assert.strictEqual(duplicate.ok, true);
  assert.strictEqual(duplicate.deduplicated, true);
  assert.strictEqual(duplicate.imageCount, 2);
  assert.strictEqual(duplicate.promptLineCount, 2);
  assert.strictEqual(executeCount, 1, "same fingerprint must not execute twice");

  await fs.writeFile(path.join(root, "scene_002", "motion_prompt.txt"), motionPrompt(2, "changed"), "utf8");
  const changed = await coordinator.requestBatch({
    projectDir: root,
    expectedSceneCount: 2,
    autoStartVideoGeneration: true,
  });
  assert.strictEqual(changed.ok, true);
  assert.strictEqual(executeCount, 2, "changed prompt must produce a new batch fingerprint");

  const preview = await coordinator.requestBatch({
    projectDir: root,
    expectedSceneCount: 2,
    previewStartButtonOnly: true,
    autoStartVideoGeneration: true,
  });
  assert.strictEqual(preview.ok, true);
  assert.strictEqual(preview.status, "previewed");
  assert.strictEqual(executeCount, 3);
  assert.strictEqual(executionPayloads[2].previewStartButtonOnly, true);

  const loaded = await coordinator.requestBatch({
    projectDir: root,
    expectedSceneCount: 2,
    autoStartVideoGeneration: false,
  });
  assert.strictEqual(loaded.ok, true);
  assert.strictEqual(loaded.status, "loaded");
  assert.strictEqual(executeCount, 4);
  assert.strictEqual(executionPayloads[3].autoStartVideoGeneration, false);

  let releaseExecution;
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const gate = new Promise((resolve) => { releaseExecution = resolve; });
  const blockingCoordinator = createVeoUpBatchCoordinator({
    executeAutomation: async (payload) => {
      markStarted();
      await gate;
      return {
        ok: true,
        imageCount: payload.scenes.length,
        promptLineCount: payload.scenes.length,
        generateAcknowledged: true,
      };
    },
    readState: async () => null,
  });
  const activeRequest = blockingCoordinator.requestBatch({
    projectDir: root,
    expectedSceneCount: 2,
    autoStartVideoGeneration: true,
  });
  await started;
  const joined = await blockingCoordinator.requestBatch({
    projectDir: root,
    expectedSceneCount: 2,
    autoStartVideoGeneration: true,
  });
  assert.strictEqual(joined.joined, true);
  assert.strictEqual(joined.imageCount, 2);

  await fs.writeFile(path.join(root, "scene_001", "motion_prompt.txt"), motionPrompt(1, "new fingerprint while busy"), "utf8");
  const busy = await blockingCoordinator.requestBatch({
    projectDir: root,
    expectedSceneCount: 2,
    autoStartVideoGeneration: true,
  });
  assert.strictEqual(busy.ok, false);
  assert.strictEqual(busy.error, "veoup-batch-busy");
  releaseExecution();
  await activeRequest;

  const failureLogs = [];
  const failedCoordinator = createVeoUpBatchCoordinator({
    executeAutomation: async () => ({
      ok: false,
      error: "veoup-row-count-unverifiable",
      expectedRows: 2,
      detectedRows: 0,
      imageRows: 0,
      promptRows: 0,
      selectionCount: 2,
      selectionVerified: true,
      selectionMethod: "exact-folder-ctrl-a-dialog-closed",
      verificationMethod: "uia-row-count",
    }),
    appendLog: async (_event, entry) => { failureLogs.push(entry); },
    readState: async () => null,
  });
  const failed = await failedCoordinator.requestBatch({
    projectDir: root,
    expectedSceneCount: 2,
    autoStartVideoGeneration: true,
    force: true,
  });
  assert.strictEqual(failed.ok, false);
  assert.strictEqual(failed.expectedRows, 2);
  assert.strictEqual(failed.selectionVerified, true);
  const failureLog = failureLogs.find((entry) => entry.kind === "error");
  assert.strictEqual(failureLog.details.result.expectedRows, 2);
  assert.strictEqual(failureLog.details.result.selectionCount, 2);

  await fs.rm(root, { recursive: true, force: true });
  console.log("VeoUp batch coordinator single-flight/idempotency tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
