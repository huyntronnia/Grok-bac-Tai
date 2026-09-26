"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { createManualChatGptController } = require("../electron/main/chatgpt/manual_chatgpt_controller");
const { buildManualStageBundle } = require("../electron/main/chatgpt/manual_stage_bundle");
const { validPng } = require("./helpers/manual-workflow-fixture");

const OLD = "LINE 1: An earlier scene shows the kitten waiting at a food bowl on the roof while the man watches from the side. LINE 2: The camera stays still, the lighting is consistent, and the animal remains near its original position with gentle secondary movement.";
const NEW = "LINE 1: The next scene starts from its exact saved keyframe, with the kitten and young man in their established rooftop positions. LINE 2: The kitten walks forward in a smooth continuous motion as the camera follows, preserving daylight, composition, and every visible background element.";

(async () => {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-nv2-inplace-"));
  let now = 0;
  let browser = { conversationId: "same-conversation", generating: false, messages: [
    { id: "old-user", role: "user", text: "An earlier scene" },
    { id: "assistant-slot", role: "assistant", text: OLD, settled: true },
  ] };
  const controller = createManualChatGptController({
    now: () => now,
    readConversationSnapshot: async () => browser,
    buildStageBundle: ({ sceneId, stage }) => buildManualStageBundle({
      projectPath, sceneId, stage,
      scene: { id: sceneId, text: "Next scene", nv1: "Create keyframe", nv2: "Write motion prompt" },
    }),
  });
  try {
    await fs.mkdir(path.join(projectPath, "scene_017"), { recursive: true });
    await fs.writeFile(path.join(projectPath, "scene_017", "scene_017_keyframe.png"), validPng());
    await controller.initialize({ projectPath, expectedSceneIds: [17, 18] });
    const prepared = await controller.prepare({ projectPath, sceneId: 17, stage: "NV2" });
    const armed = await controller.arm({ projectPath, bundle: prepared.bundle });
    assert(armed.ok, JSON.stringify(armed));
    browser = { ...browser, messages: [
      browser.messages[0],
      { ...browser.messages[1], text: NEW },
      { id: "wrong-user", role: "user", text: "Unrelated request" },
    ] };
    let result = await controller.capture({ projectPath, attemptId: armed.attempt.attemptId, sceneId: 17, stage: "NV2", autoCapture: true });
    assert.strictEqual(result.error, "manual-owned-user-turn-not-found", "in-place text cannot bypass prompt ownership");
    browser = { ...browser, messages: [browser.messages[0], browser.messages[1],
      { id: "owned-user", role: "user", text: prepared.bundle.clipboardText },
    ] };
    for (const [time, ready] of [[0, false], [1000, false], [4001, true]]) {
      now = time;
      result = await controller.capture({ projectPath, attemptId: armed.attempt.attemptId, sceneId: 17, stage: "NV2", autoCapture: true });
      assert.strictEqual(result.ok, ready, `NV2 in-place response stability at ${time} ms`);
    }
    assert.strictEqual(await fs.readFile(path.join(projectPath, "scene_017", "motion_prompt.txt"), "utf8"), NEW);
    console.log("Manual NV2 in-place ownership and stability tests passed");
  } finally {
    controller.dispose();
    await fs.rm(projectPath, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
