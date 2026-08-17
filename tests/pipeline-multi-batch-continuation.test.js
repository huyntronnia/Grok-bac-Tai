"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const renderer = fs.readFileSync(path.join(root, "electron/renderer.js"), "utf8");
const runner = fs.readFileSync(
  path.join(root, "electron/main/pipeline/pipeline_runner.js"),
  "utf8",
);

const successStart = runner.indexOf("const sceneAlreadyCompleted");
const successEnd = runner.indexOf("return result;", successStart);
assert(successStart >= 0 && successEnd > successStart, "durable success return block missing");
const successBlock = runner.slice(successStart, successEnd);

assert(
  !successBlock.includes("await sleep(10000)"),
  "main process must not hold a committed scene result during the inter-scene breather",
);
assert(
  successBlock.includes("durable success committed; returning result to renderer"),
  "main process must log the durable result handoff",
);
assert(
  runner.includes("alreadyCompleted: Boolean(result.alreadyCompleted)"),
  "sanitized scene results must preserve the cached-completion marker",
);

assert(
  renderer.includes("const INTER_SCENE_BREATHER_MS = 10000"),
  "renderer-owned inter-scene breather constant missing",
);
assert(
  renderer.includes("async function waitForInterSceneBreather"),
  "cancellable renderer inter-scene breather helper missing",
);
assert(
  renderer.includes("await waitForInterSceneBreather(runId, currentScene.id)"),
  "completed keyframe/motion scene must wait in renderer before continuing",
);

const schedulerStart = renderer.indexOf("function schedulePipelineTimer");
const schedulerEnd = renderer.indexOf("function updateStopPipelineControls", schedulerStart);
assert(schedulerStart >= 0 && schedulerEnd > schedulerStart, "pipeline scheduler block missing");
const schedulerBlock = renderer.slice(schedulerStart, schedulerEnd);
assert(
  /try\s*\{[\s\S]*?await callback\(\)[\s\S]*?\}\s*catch\s*\(error\)/.test(schedulerBlock),
  "scheduled batch callback errors must be caught",
);
assert(
  schedulerBlock.includes("Scheduled pipeline continuation failed"),
  "scheduled batch callback failure must be visible in the pipeline log",
);

function getNextBatchForSegment(scenes, doneSceneId, batchSize) {
  const sorted = [...scenes].sort((a, b) => a.id - b.id);
  const next = sorted.find((scene) => scene.id > doneSceneId && !scene.complete);
  if (!next) return [];
  return sorted
    .map((scene) => scene.id)
    .filter((id) => id >= next.id)
    .slice(0, batchSize);
}

const simulatedScenes = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  complete: false,
}));
const batches = [];
let lastSceneId = 0;
while (simulatedScenes.some((scene) => !scene.complete)) {
  const batch = getNextBatchForSegment(simulatedScenes, lastSceneId, 10);
  assert(batch.length > 0, "batch planner stalled before all 12 scenes completed");
  batches.push(batch);
  for (const id of batch) simulatedScenes[id - 1].complete = true;
  lastSceneId = Math.max(...batch);
}

assert.deepStrictEqual(batches[0], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
assert.deepStrictEqual(batches[1], [11, 12]);

console.log("pipeline multi-batch continuation regression tests passed");
