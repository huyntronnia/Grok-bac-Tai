"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { createManualChatGptController } = require("../electron/main/chatgpt/manual_chatgpt_controller");
const { buildManualStageBundle } = require("../electron/main/chatgpt/manual_stage_bundle");
const { validPng } = require("./helpers/manual-workflow-fixture");

const MOTION = "LINE 1: A stable cinematic frame shows the ginger kitten and the young man on the rooftop, with accurate body positions and daylight continuity. LINE 2: The kitten walks smoothly toward its food bowl while the camera tracks gently, preserving the keyframe composition, natural motion, and consistent background throughout the shot.";

async function waitFor(check, label, timeoutMs = 2500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

(async () => {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-manual-auto-stages-"));
  let now = 0;
  let browser = {
    conversationId: "owned-conversation",
    messages: [
      { id: "nv1-old-user", role: "user", text: "Tạo ảnh theo file sau: scene_017_nv1_request.txt" },
      { id: "manual-imagegen:1", role: "assistant", generatedImageCard: true, imageBuffer: validPng(), settled: true },
    ],
    generating: false,
  };
  const batches = [];
  const controller = createManualChatGptController({
    watchIntervalMs: 10,
    now: () => { now += 1500; return now; },
    readConversationSnapshot: async () => browser,
    buildStageBundle: ({ stage, sceneId }) => buildManualStageBundle({
      projectPath,
      sceneId,
      stage,
      scene: { id: sceneId, text: `Scene ${sceneId}`, nv1: "Create the scene keyframe", nv2: "Write the scene motion prompt" },
    }),
    submitVeoUp: async (payload) => {
      batches.push(payload);
      return { ok: true, batchId: "automatic-batch" };
    },
  });
  try {
    await fs.mkdir(path.join(projectPath, "scene_017"), { recursive: true });
    await fs.writeFile(path.join(projectPath, "scene_017", "scene_017_keyframe.png"), validPng());
    await controller.initialize({ projectPath, expectedSceneIds: [17, 18] });
    await controller.resume({ projectPath });
    const first = await waitFor(async () => {
      const view = await controller.getViewModel({ projectPath });
      return view.activeAttempt?.sceneId === 17 && view.activeAttempt?.stage === "NV2" ? view : null;
    }, "Scene 17 NV2 auto-arm");
    assert.strictEqual(first.activeAttempt.baselineTurnIds.at(-1), "manual-imagegen:1");
    const nv2User = { id: "nv2-scene-17-user", role: "user", text: first.activeAttempt.bundle.clipboardText };
    const nv2Assistant = { id: "nv2-scene-17-assistant", role: "assistant", text: MOTION, settled: true };
    browser = { ...browser, messages: [browser.messages[0], nv2User, nv2Assistant], generating: true };
    await new Promise((resolve) => setTimeout(resolve, 70));
    assert.strictEqual(await fs.stat(path.join(projectPath, "scene_017", "motion_prompt.txt")).then(() => true, () => false), false,
      "NV2 must not save while ChatGPT is generating");
    browser = { ...browser, generating: false };
    const second = await waitFor(async () => {
      const view = await controller.getViewModel({ projectPath });
      return view.currentSceneId === 18 && view.preparedBundle?.stage === "NV1" ? view : null;
    }, "Scene 17 NV2 auto-save and Scene 18 NV1 prepare");
    assert.strictEqual(await fs.readFile(path.join(projectPath, "scene_017", "motion_prompt.txt"), "utf8"), MOTION);
    const nv1User = { id: "nv1-scene-18-user", role: "user", text: second.preparedBundle.clipboardText };
    browser = { ...browser, messages: [...browser.messages, nv1User, {
      id: "manual-imagegen:1", role: "assistant", generatedImageCard: true,
      imageBuffer: validPng(), settled: true,
    }] };
    const third = await waitFor(async () => {
      const view = await controller.getViewModel({ projectPath });
      return view.currentSceneId === 18 && view.preparedBundle?.stage === "NV2" ? view : null;
    }, "Scene 18 NV1 auto-save and NV2 prepare");
    assert.deepStrictEqual(await fs.readFile(path.join(projectPath, "scene_018", "scene_018_keyframe.png")), validPng());
    browser = { ...browser, messages: [
      ...browser.messages.filter((message) => !message.generatedImageCard),
      { id: "nv2-scene-18-user", role: "user", text: third.preparedBundle.clipboardText },
      { id: "nv2-scene-18-assistant", role: "assistant", text: MOTION.replace("ginger kitten", "small tabby kitten"), settled: true },
    ] };
    await waitFor(async () => {
      const view = await controller.getViewModel({ projectPath });
      return view.audit.readyCount === 2 && batches.length === 1 ? view : null;
    }, "Scene 18 NV2 auto-save and strict VeoUp submit");
    assert.strictEqual(batches[0].allowPartial, false);
    assert.strictEqual((await fs.readFile(path.join(projectPath, "scene_018", "motion_prompt.txt"), "utf8")).includes("small tabby kitten"), true);
    console.log("Manual auto detection across NV2 -> next-scene NV1/NV2 passed");
  } finally {
    controller.dispose();
    await fs.rm(projectPath, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
