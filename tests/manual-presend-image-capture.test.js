"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const {
  createManualChatGptController,
  manualWorkflowPaths,
  readManualWorkflowCheckpoint,
} = require("../electron/main/chatgpt/manual_chatgpt_controller");
const { buildManualStageBundle } = require("../electron/main/chatgpt/manual_stage_bundle");
const { validPng } = require("./helpers/manual-workflow-fixture");

const IMAGE = validPng();

async function scenario({ legacyBaseline = false, unrelatedUser = false, imageBeforeArm = false } = {}) {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-presend-image-"));
  let browser = { conversationId: "scene-17-conversation", messages: [], generating: false };
  const controller = createManualChatGptController({
    readConversationSnapshot: async () => browser,
    buildStageBundle: ({ stage, sceneId }) => buildManualStageBundle({
      projectPath,
      sceneId,
      stage,
      scene: { id: sceneId, text: `Scene ${sceneId}`, nv1: "Create the keyframe", nv2: "Write the motion prompt" },
    }),
  });
  try {
    await controller.initialize({ projectPath, expectedSceneIds: [17, 18] });
    const prepared = await controller.prepare({ projectPath, sceneId: 17, stage: "NV1" });
    assert(prepared.ok, JSON.stringify(prepared));
    const user = {
      id: "user-scene-17",
      role: "user",
      text: unrelatedUser ? "Generate a completely unrelated image" : prepared.bundle.clipboardText,
      attachmentNames: prepared.bundle.attachmentNames,
    };
    const assistant = { id: "manual-imagegen:1", role: "assistant", text: "[ChatGPT generated keyframe image]", imageBuffer: IMAGE, settled: true };
    browser = { ...browser, messages: imageBeforeArm ? [user, assistant] : [user] };
    const armed = await controller.arm({ projectPath, bundle: prepared.bundle });
    assert(armed.ok, JSON.stringify(armed));
    if (!unrelatedUser && !legacyBaseline && !imageBeforeArm) {
      assert.deepStrictEqual(armed.attempt.baselineTurnIds, [], "a matching pre-sent prompt must remain fresh");
    }
    if (legacyBaseline) {
      const checkpoint = await readManualWorkflowCheckpoint(projectPath);
      const attempt = checkpoint.attempts.find((item) => item.attemptId === armed.attempt.attemptId);
      attempt.baselineTurnIds = [user.id];
      attempt.baselineUserTurnId = user.id;
      attempt.baselineUserCount = 1;
      await fs.writeFile(manualWorkflowPaths(projectPath).checkpointPath, JSON.stringify(checkpoint), "utf8");
    }
    browser = { ...browser, messages: [user, assistant] };
    if (imageBeforeArm) {
      const automaticCapture = await controller.capture({
        projectPath,
        attemptId: armed.attempt.attemptId,
        sceneId: 17,
        stage: "NV1",
      });
      assert.strictEqual(automaticCapture.ok, false, "the watcher must not adopt a pre-existing image");
    }
    const capture = await controller.capture({
      projectPath,
      attemptId: armed.attempt.attemptId,
      sceneId: 17,
      stage: "NV1",
      adoptPrepared: imageBeforeArm,
    });
    if (unrelatedUser) {
      assert.strictEqual(capture.ok, false, "an unrelated pre-existing prompt must not own the image");
      assert.strictEqual(capture.error, "manual-owned-user-turn-not-found");
    } else {
      assert(capture.ok, JSON.stringify(capture));
      assert.strictEqual(capture.attempt.capturedAssistantTurnId, "manual-imagegen:1");
      assert.deepStrictEqual(await fs.readFile(path.join(projectPath, "scene_017", "scene_017_keyframe.png")), IMAGE);
      assert.strictEqual(capture.viewModel.preparedBundle.stage, "NV2");
    }
  } finally {
    controller.dispose();
    await fs.rm(projectPath, { recursive: true, force: true });
  }
}

async function imageExtractionRetry() {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-image-extraction-retry-"));
  let browser = { conversationId: "image-retry-conversation", messages: [], generating: false };
  let extractionCalls = 0;
  const controller = createManualChatGptController({
    readConversationSnapshot: async () => browser,
    extractOwnedImage: async () => {
      extractionCalls += 1;
      if (extractionCalls === 1) throw new Error("temporary-image-fetch-failed");
      return IMAGE;
    },
    buildStageBundle: ({ stage, sceneId }) => buildManualStageBundle({
      projectPath, sceneId, stage,
      scene: { id: sceneId, text: "Scene 17", nv1: "Create keyframe", nv2: "Write motion prompt" },
    }),
  });
  try {
    await controller.initialize({ projectPath, expectedSceneIds: [17, 18] });
    const prepared = await controller.prepare({ projectPath, sceneId: 17, stage: "NV1" });
    const armed = await controller.arm({ projectPath, bundle: prepared.bundle });
    browser = { ...browser, messages: [
      { id: "owned-user", role: "user", text: prepared.bundle.clipboardText },
      { id: "manual-imagegen:0", role: "assistant", generatedImageCard: true,
        images: [{ src: "mock-image", width: 1024, height: 1024 }], settled: true },
    ] };
    const input = { projectPath, attemptId: armed.attempt.attemptId, sceneId: 17, stage: "NV1" };
    const failed = await controller.capture(input);
    assert.strictEqual(failed.code, "ARTIFACT_SAVE_FAILED");
    assert.match(failed.error, /temporary-image-fetch-failed/);
    assert.strictEqual((await controller.getViewModel({ projectPath })).activeAttempt.attemptId, armed.attempt.attemptId);
    const retried = await controller.capture(input);
    assert(retried.ok, JSON.stringify(retried));
    assert.deepStrictEqual(await fs.readFile(path.join(projectPath, "scene_017", "scene_017_keyframe.png")), IMAGE);
  } finally {
    controller.dispose();
    await fs.rm(projectPath, { recursive: true, force: true });
  }
}

(async () => {
  await scenario();
  await scenario({ legacyBaseline: true });
  await scenario({ imageBeforeArm: true });
  await scenario({ unrelatedUser: true });
  await imageExtractionRetry();
  console.log("Manual pre-sent image capture tests passed");
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
