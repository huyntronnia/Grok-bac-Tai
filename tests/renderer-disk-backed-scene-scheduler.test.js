"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const renderer = fs.readFileSync(path.join(root, "electron/renderer.js"), "utf8");
const main = fs.readFileSync(path.join(root, "electron/main.js"), "utf8");

function extractFunction(name) {
  const start = renderer.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} source not found`);
  const bodyStart = renderer.indexOf("{", start);
  assert(bodyStart > start, `${name} source body not found`);
  let depth = 0;
  for (let index = bodyStart; index < renderer.length; index++) {
    if (renderer[index] === "{") depth++;
    if (renderer[index] === "}") depth--;
    if (depth === 0) return renderer.slice(start, index + 1);
  }
  assert.fail(`${name} source end not found`);
}

assert.match(
  renderer,
  /ensureProjectSceneFolders\(\{ outputFolder, scenes: project\.scenes, inspectOnly: repairFromDisk \}\)/,
  "repairFromDisk must use the read-only asset audit path",
);
assert.match(
  main,
  /inspectOnly\s*=\s*false/,
  "the scene-folder IPC must expose an inspect-only mode",
);
assert.match(main, /keyframeValid:/, "disk audit must return keyframe validation");
assert.match(main, /motionPromptValid:/, "disk audit must return motion-prompt validation");
assert.match(
  renderer,
  /const startDiskAudit = await syncProjectSceneFolders\(\{ repairFromDisk: true \}\);[\s\S]*?forceResumeFirstIncompleteSceneIfNeeded\(\);/,
  "Start/resume must audit disk before choosing the active scene",
);
assert.match(
  renderer,
  /Disk scheduler audit selected scene[\s\S]*?nearbySceneOutputs/,
  "scheduler diagnostics must explain the selected scene using nearby disk outputs",
);
assert.match(
  renderer,
  /Disk audit failed before auto-advance; batch cursor was not moved\./,
  "auto-advance must fail closed if the final disk audit is unavailable",
);
assert.match(
  main,
  /if \(!inspectOnly\) await fs\.mkdir\(outputFolder, \{ recursive: true \}\);/,
  "inspect-only audit must not create the project output folder",
);
assert.match(
  main,
  /if \(!inspectOnly && scene\?\.motionPrompt\)/,
  "inspect-only audit must not rewrite motion_prompt.txt",
);

const makeComplete = (id) => ({
  id,
  imagePath: `D:/project/scene_${String(id).padStart(3, "0")}/keyframe.png`,
  motionPromptPath: `D:/project/scene_${String(id).padStart(3, "0")}/motion_prompt.txt`,
  keyframeFileExists: true,
  keyframeFileValid: true,
  motionPromptFileExists: true,
  motionPromptFileValid: true,
  assetStatCheckedAtMs: Date.now(),
});

const sandbox = {
  isKeyframeMotionPromptOnlyModeEnabled: () => true,
  safeAddPipelineLog: () => null,
  clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
};
vm.createContext(sandbox);
vm.runInContext(`
const SCENE_OUTPUT_STAT_TTL_MS = 5 * 60 * 1000;
const SCENE_ASSET_AUDIT_TTL_MS = 5 * 60 * 1000;
${extractFunction("hasValidSceneOutputPath")}
${extractFunction("sceneHasRequiredOutputForCurrentMode")}
${extractFunction("sceneHasVideoOutput")}
${extractFunction("findFirstSceneMissingVideo")}
${extractFunction("forceResumeFirstIncompleteSceneIfNeeded")}
${extractFunction("getNextBatchForSegment")}
this.sceneHasRequiredOutputForCurrentMode = sceneHasRequiredOutputForCurrentMode;
this.forceResumeFirstIncompleteSceneIfNeeded = forceResumeFirstIncompleteSceneIfNeeded;
this.getNextBatchForSegment = getNextBatchForSegment;
`, sandbox);

assert.strictEqual(
  sandbox.sceneHasRequiredOutputForCurrentMode(makeComplete(35)),
  true,
  "fresh disk-validated keyframe + motion prompt must remain complete",
);
assert.strictEqual(
  sandbox.sceneHasRequiredOutputForCurrentMode({
    id: 36,
    imagePath: "D:/stale/scene_036_keyframe.png",
    motionPromptPath: "D:/stale/motion_prompt.txt",
  }),
  false,
  "stale path strings alone must never mark a scene complete",
);

sandbox.project = {
  batchSize: 10,
  scenes: Array.from({ length: 15 }, (_, index) => makeComplete(index + 31)),
};
const missing36 = sandbox.project.scenes.find((scene) => scene.id === 36);
missing36.imagePath = "";
missing36.keyframeFileExists = false;
missing36.keyframeFileValid = false;
sandbox.activeBatchIds = [41, 42, 43, 44, 45];

assert.strictEqual(sandbox.forceResumeFirstIncompleteSceneIfNeeded(), true);
assert.deepStrictEqual(
  Array.from(sandbox.activeBatchIds),
  [36],
  "a missing scene 36 must replace a stale future batch starting at scene 41",
);
assert.strictEqual(
  sandbox.getNextBatchForSegment(40)[0],
  36,
  "auto-advance must choose the smallest incomplete scene, even behind the old cursor",
);

sandbox.isKeyframeMotionPromptOnlyModeEnabled = () => false;
assert.strictEqual(
  sandbox.sceneHasRequiredOutputForCurrentMode({
    id: 1,
    videoPath: "D:/project/scene_001_video.mp4",
    videoFileExists: true,
    outputStatCheckedAtMs: Date.now(),
  }),
  true,
  "the existing disk-backed video completion flow must remain unchanged",
);

console.log("renderer disk-backed scene scheduler tests passed");
