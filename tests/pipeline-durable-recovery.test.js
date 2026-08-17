"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const runner = fs.readFileSync(
  path.join(root, "electron/main/pipeline/pipeline_runner.js"),
  "utf8",
);
const recovery = fs.readFileSync(
  path.join(root, "electron/main/recovery/recovery.js"),
  "utf8",
);
const main = fs.readFileSync(path.join(root, "electron/main.js"), "utf8");

for (const stage of [
  "prepare_scene",
  "nv1_prepare",
  "nv1_image_validated",
  "nv2_prepare",
  "nv2_saved",
  "veoup_prepare",
  "veoup_waiting_output",
  "video_validated",
  "complete",
]) {
  assert(runner.includes(`"${stage}"`) || runner.includes(`'${stage}'`), `missing durable stage ${stage}`);
}

assert(recovery.includes("const DURABLE_PIPELINE_BACKOFF_MS = [10000, 30000, 60000, 120000];"));
assert(runner.includes("const MAX_SCENE_RECOVERY_CYCLES = 2;"));
assert(runner.includes("retryCount >= MAX_SCENE_RECOVERY_CYCLES"));
assert(runner.includes('"pipeline-auto-restart"'));
assert(runner.includes("resetSceneRecoveryForAutomaticRestart"));
assert(runner.includes("automatic pipeline restart"));
assert(runner.includes("recoveryLimitReached: false"));
assert(runner.includes("waitingForUserStart: false"));
assert(runner.includes('"pipeline-paused"'));
assert(runner.includes("isNv2NoResendTerminalFailure(error)"));
assert(runner.includes("nv2NoResend: true"));
assert(!runner.includes("PIPELINE_PAUSED_AFTER_RECOVERY_LIMIT"));
assert(runner.includes("assertDurableSceneSuccess(result)"));
assert(runner.includes("await sleep(retryDelayMs);"));
assert(runner.includes("await sleep(autoRestartDelayMs);"));
assert(runner.includes("assertPipelineRunActive(runId)"));
assert(runner.includes("persistDurableStage(projectDir, sceneId, currentStage"));
assert(main.includes("await mergePipelineSceneStateIntoProjectPayload(parsed, projectFolder);"));
assert(!/retryCount >= 3[\s\S]{0,300}reload/.test(runner));

console.log("pipeline durable recovery tests passed");
