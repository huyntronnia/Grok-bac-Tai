"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { createManualChatGptController } = require("../electron/main/chatgpt/manual_chatgpt_controller");

(async () => {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-manual-ui-retry-"));
  const sceneDir = path.join(projectPath, "scene_001");
  const keyframePath = path.join(sceneDir, "scene_001_keyframe.png");
  const motionPromptPath = path.join(sceneDir, "motion_prompt.txt");
  await fs.mkdir(sceneDir);
  await fs.writeFile(keyframePath, "keyframe fixture");
  await fs.writeFile(motionPromptPath, "motion fixture");

  const auditProject = async () => ({
    ok: true,
    complete: true,
    expectedCount: 1,
    readyCount: 1,
    scenes: [{
      sceneId: 1,
      keyframe: { exists: true, valid: true, path: keyframePath, hash: "image-hash" },
      motionPrompt: { exists: true, valid: true, path: motionPromptPath, hash: "motion-hash" },
      readyForVeoUp: true,
    }],
  });
  let submissions = 0;
  const controller = createManualChatGptController({
    auditProject,
    submitVeoUp: async () => {
      submissions += 1;
      if (submissions === 1) throw new Error("PowerShell process exited with code 1");
      return { ok: false, error: "Windows file dialog timed out" };
    },
  });

  try {
    await controller.initialize({ projectPath, expectedSceneIds: [1], scenes: [{ id: 1 }] });
    const beforeInvalidRedo = await controller.getViewModel({ projectPath });
    const invalidRedo = await controller.redo({ projectPath, sceneId: 80, stage: "NV1" });
    assert.equal(invalidRedo.ok, false);
    assert.equal(invalidRedo.code, "INVALID_REDO_TARGET");
    assert.equal((await controller.getViewModel({ projectPath })).state, beforeInvalidRedo.state,
      "an invalid Redo target must not cancel the workflow");
    const first = await controller.submitVeoUp({ projectPath });
    assert.equal(first.ok, false);
    assert.equal(first.viewModel.state, "BLOCKED");
    assert.equal(first.viewModel.canRetryVeoUp, true, "an exception must leave Retry available");

    const second = await controller.submitVeoUp({ projectPath });
    assert.equal(second.ok, false);
    assert.equal(second.viewModel.state, "BLOCKED");
    assert.equal(second.viewModel.canRetryVeoUp, true, "a generic VeoUp error must leave Retry available");
    assert.equal(submissions, 2);
    console.log("Manual UI VeoUp retry visibility tests passed");
  } finally {
    controller.dispose();
    await fs.rm(projectPath, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
