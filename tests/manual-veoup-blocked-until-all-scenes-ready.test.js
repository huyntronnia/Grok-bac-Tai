"use strict";

const assert = require("assert");

function checkAllScenesChatGptReady(project) {
  if (!project?.scenes?.length) return { ready: false, reason: "Chưa có scene nào trong project." };
  for (let index = 0; index < project.scenes.length; index += 1) {
    const scene = project.scenes[index];
    const sceneIdStr = `scene_${String(scene.id || index + 1).padStart(3, "0")}`;
    const hasImage = Boolean(scene.imagePath || scene.keyframePath);
    const hasMotion = Boolean(scene.motionPrompt || scene.motionPromptPath);
    if (!hasImage) {
      return { ready: false, sceneId: sceneIdStr, reason: `${sceneIdStr} chưa hoàn thành NV1 (thiếu keyframe image).` };
    }
    if (!hasMotion) {
      return { ready: false, sceneId: sceneIdStr, reason: `${sceneIdStr} chưa hoàn thành NV2 (thiếu motion prompt).` };
    }
  }
  return { ready: true };
}

async function runTests() {
  console.log("Starting VeoUp Gate Gating Tests...");

  // Scenario A: Scene 001 ready, Scene 002 incomplete -> VeoUp BLOCKED
  const projectA = {
    scenes: [
      { id: 1, keyframePath: "scene_001_keyframe.png", motionPromptPath: "motion_prompt.txt" },
      { id: 2, keyframePath: "scene_002_keyframe.png", motionPromptPath: null },
    ],
  };
  const gateA = checkAllScenesChatGptReady(projectA);
  assert.strictEqual(gateA.ready, false);
  assert(gateA.reason.includes("scene_002 chưa hoàn thành NV2"));

  // Scenario B: All scenes ready -> VeoUp READY
  const projectB = {
    scenes: [
      { id: 1, keyframePath: "scene_001_keyframe.png", motionPromptPath: "motion_prompt.txt" },
      { id: 2, keyframePath: "scene_002_keyframe.png", motionPromptPath: "motion_prompt.txt" },
    ],
  };
  const gateB = checkAllScenesChatGptReady(projectB);
  assert.strictEqual(gateB.ready, true);

  // Scenario C: Verify renderer stepper logic contract
  const fs = require("fs");
  const path = require("path");
  const rendererPath = path.resolve(__dirname, "../electron/renderer.js");
  const rendererContent = fs.readFileSync(rendererPath, "utf8");

  assert(rendererContent.includes("const isAllReady = totalCount > 0 && readyCount === totalCount"), "renderer must compute isAllReady across all scenes");
  assert(rendererContent.includes("stepVeoup.className = 'manual-step locked'"), "stepVeoup must remain locked when not all scenes are ready");
  assert(rendererContent.includes("Phải chạy hết tất cả các scene rồi mới sang VeoUp!"), "Guidance banner must clearly instruct that all scenes must finish before VeoUp");

  console.log("VeoUp Gate Gating Tests passed!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
