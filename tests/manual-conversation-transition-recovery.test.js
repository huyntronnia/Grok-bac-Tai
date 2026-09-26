"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { createManualChatGptController, manualWorkflowPaths } = require("../electron/main/chatgpt/manual_chatgpt_controller");
const { buildManualStageBundle, ensureManualProjectRequestFiles } = require("../electron/main/chatgpt/manual_stage_bundle");
const { validPng } = require("./helpers/manual-workflow-fixture");

(async () => {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-manual-conversation-transition-"));
  const scene = { id: 1, original: "Scene 1: a cat sits beside a window" };
  let browser = {
    conversationId: "old-conversation", pageId: "same-tab", generating: false,
    messages: [{ id: "prior-user", role: "user", text: "Earlier prompt" },
      { id: "prior-assistant", role: "assistant", text: "Earlier answer" }],
  };
  const controller = createManualChatGptController({
    readConversationSnapshot: async () => browser,
    ensureProjectFiles: () => ensureManualProjectRequestFiles({
      projectPath, scenes: [scene], nv1: "Create a keyframe", nv2: "Write motion prompt",
    }),
    buildStageBundle: ({ stage, sceneId }) => buildManualStageBundle({
      projectPath, sceneId, stage, scene: { ...scene, nv1: "Create a keyframe", nv2: "Write motion prompt" },
    }),
  });
  try {
    await controller.initialize({ projectPath, expectedSceneIds: [1], scenes: [scene] });
    const ready = await controller.resume({ projectPath });
    assert.equal(ready.viewModel.preparedBundle?.stage, "NV1");
    const armed = await controller.arm({ projectPath });
    assert.equal(armed.ok, true);
    const request = armed.attempt.bundle;
    browser = {
      ...browser, conversationId: "", pathname: "/", messages: [
        { id: "new-user", role: "user", text: request.clipboardText, attachmentNames: request.attachmentNames },
        { id: "new-image", role: "assistant", imageBuffer: validPng(), settled: true },
      ],
    };
    const unresolved = await controller.capture({
      projectPath, attemptId: armed.attempt.attemptId, sceneId: 1, stage: "NV1",
    });
    assert.equal(unresolved.code, "CONVERSATION_UNRESOLVED");
    assert.equal((await controller.getViewModel({ projectPath })).activeAttempt?.attemptId, armed.attempt.attemptId,
      "a transient root URL must not erase the prepared bundle or active attempt");

    browser = { ...browser, conversationId: "new-conversation", pathname: "/c/new-conversation" };
    const captured = await controller.capture({
      projectPath, attemptId: armed.attempt.attemptId, sceneId: 1, stage: "NV1",
    });
    assert.equal(captured.ok, true, JSON.stringify(captured));
    assert.equal(captured.viewModel.state, "SCENE_NV2_READY");
    assert.equal(captured.viewModel.preparedBundle?.stage, "NV2",
      "NV2 bundle should be prepared automatically after saving NV1");
    assert.deepEqual(await fs.readFile(path.join(projectPath, "scene_001", "scene_001_keyframe.png")), validPng());

    const checkpointPath = manualWorkflowPaths(projectPath).checkpointPath;
    const checkpoint = JSON.parse(await fs.readFile(checkpointPath, "utf8"));
    checkpoint.state = "BLOCKED";
    checkpoint.lastError = "manual-conversation-changed-reprepare-required";
    checkpoint.preparedBundle = null;
    checkpoint.activeAttemptId = null;
    await fs.writeFile(checkpointPath, JSON.stringify(checkpoint), "utf8");
    const recovered = await controller.resume({ projectPath });
    assert.equal(recovered.viewModel.preparedBundle?.stage, "NV2",
      "a project blocked by the old mismatch logic should recover on reconnect");
    console.log("Manual conversation transition preserves auto-save and stage recovery");
  } finally {
    controller.dispose();
    await fs.rm(projectPath, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
