"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { createManualChatGptController } = require("../electron/main/chatgpt/manual_chatgpt_controller");

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function promptly(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} blocked behind VeoUp`)), 500)),
  ]);
}

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-veoup-responsive-"));
  const sceneDir = path.join(root, "scene_001");
  const keyframePath = path.join(sceneDir, "scene_001_keyframe.png");
  const motionPromptPath = path.join(sceneDir, "motion_prompt.txt");
  await fs.mkdir(sceneDir);
  await fs.writeFile(keyframePath, "image fixture");
  await fs.writeFile(motionPromptPath, "motion fixture");
  const entered = deferred();
  const release = deferred();
  const states = [];
  let cancelled = false;
  const controller = createManualChatGptController({
    auditProject: async () => ({
      ok: true, complete: true, expectedCount: 1, readyCount: 1, firstIncompleteSceneId: null,
      scenes: [{ sceneId: 1, keyframe: { path: keyframePath, valid: true, hash: "image" }, motionPrompt: { path: motionPromptPath, valid: true, hash: "motion" }, readyForVeoUp: true }],
    }),
    getVeoUpBatchStatus: async () => ({ active: false }),
    cancelVeoUpBatch: async () => ({ ok: true, cancelled: true }),
    onChanged: ({ viewModel }) => states.push(viewModel.state),
    submitVeoUp: async (payload) => {
      entered.resolve();
      await release.promise;
      cancelled = payload.isCancelled();
      return cancelled ? { ok: false, cancelled: true, error: "cancelled" } : { ok: true, status: "submitted" };
    },
  });
  try {
    await controller.initialize({ projectPath: root, expectedSceneIds: [1] });
    const submission = controller.submitVeoUp({ projectPath: root });
    await promptly(entered.promise, "submission start");
    const during = await promptly(controller.getViewModel({ projectPath: root }), "status read");
    assert.equal(during.state, "VEOUP_RUNNING");
    assert.equal(during.canCancelVeoUp, true);
    const resumed = await promptly(controller.resume({ projectPath: root }), "resume");
    assert.equal(resumed.state, "VEOUP_RUNNING", "an in-process submission must not look interrupted");
    const stop = await promptly(controller.cancelVeoUp({ projectPath: root }), "cancel");
    assert.equal(stop.ok, true);
    release.resolve();
    const finished = await submission;
    assert.equal(cancelled, true);
    assert.equal(finished.viewModel.state, "BLOCKED");
    assert.deepEqual(states, ["VEOUP_RUNNING", "VEOUP_RUNNING", "BLOCKED"]);
    console.log("Manual VeoUp status and cancellation remain responsive during a long batch");
  } finally {
    controller.dispose();
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
