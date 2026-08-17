"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  resetSceneRecoveryForAutomaticRestart,
} = require("../electron/main/pipeline/pipeline_runner");

const root = path.resolve(__dirname, "..");
const runnerSource = fs.readFileSync(
  path.join(root, "electron/main/pipeline/pipeline_runner.js"),
  "utf8",
);
const rendererSource = fs.readFileSync(
  path.join(root, "electron/renderer.js"),
  "utf8",
);

function sha256(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

const VALID_KEYFRAME = Buffer.concat([
  Buffer.from("89504e470d0a1a0a", "hex"),
  Buffer.alloc(5000),
]);

(async () => {
  const projectDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "vidora-pipeline-auto-restart-"),
  );
  try {
    const sceneId = 32;
    const sceneDir = path.join(projectDir, "scene_032");
    const keyframePath = path.join(sceneDir, "scene_032_keyframe.png");
    fs.mkdirSync(sceneDir, { recursive: true });
    fs.writeFileSync(keyframePath, VALID_KEYFRAME);
    const keyframeHashBefore = sha256(keyframePath);

    fs.writeFileSync(
      path.join(projectDir, "pipeline_state.json"),
      JSON.stringify(
        {
          32: {
            sceneId,
            stage: "nv2_prepare",
            currentStage: "nv2_prepare",
            retryCount: 2,
            attemptCount: 2,
            recoveryLimitReached: true,
            paused: true,
            active: false,
            waitingForUserStart: true,
            autoRestartCount: 2,
            keyframePath,
            lastError: "no-new-assistant",
          },
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(sceneDir, "scene_snapshot.json"),
      JSON.stringify(
        {
          pipelineStage: "NV2_SENT",
          imageValidated: true,
          motionValidated: false,
        },
        null,
        2,
      ),
    );

    const result = await resetSceneRecoveryForAutomaticRestart(
      {
        runId: "run-auto-restart-32",
        outputFolder: projectDir,
        sceneId,
        imagePath: keyframePath,
        autoRestartCount: 3,
        automaticRecoveryLastError: "no-new-assistant",
      },
      `${projectDir}::scene-${sceneId}`,
    );

    assert.strictEqual(result.reset, true);
    assert.strictEqual(result.resetMode, "automatic");
    assert.strictEqual(result.shouldRetryNv2, true);
    assert.strictEqual(sha256(keyframePath), keyframeHashBefore);

    const durable = JSON.parse(
      fs.readFileSync(path.join(projectDir, "pipeline_state.json"), "utf8"),
    )[32];
    assert.strictEqual(durable.retryCount, 0);
    assert.strictEqual(durable.attemptCount, 0);
    assert.strictEqual(durable.recoveryLimitReached, false);
    assert.strictEqual(durable.paused, false);
    assert.strictEqual(durable.active, true);
    assert.strictEqual(durable.waitingForUserStart, false);
    assert.strictEqual(durable.autoRestartCount, 3);
    assert.strictEqual(durable.lastError, "no-new-assistant");
    assert.strictEqual(
      durable.automaticRecoveryResetRunId,
      "run-auto-restart-32",
    );

    const snapshot = JSON.parse(
      fs.readFileSync(path.join(sceneDir, "scene_snapshot.json"), "utf8"),
    );
    assert.strictEqual(snapshot.manualNv2RetryRequested, false);
    assert.strictEqual(snapshot.manualNv2RetryRunId, "");
    assert.strictEqual(snapshot.nv2ResumeWithoutResend, true);
    assert.strictEqual(snapshot.nv2ResumeTrigger, "automatic");

    assert(runnerSource.includes('"pipeline-auto-restart"'));
    assert(runnerSource.includes("await sleep(autoRestartDelayMs);"));
    assert(runnerSource.includes("resetSceneRecoveryForAutomaticRestart"));
    assert(runnerSource.includes('"pipeline-paused"'));
    assert(runnerSource.includes("isNv2NoResendTerminalFailure"));
    assert(!runnerSource.includes("PIPELINE_PAUSED_AFTER_RECOVERY_LIMIT"));
    assert(rendererSource.includes("'pipeline-auto-restart'"));
    assert(rendererSource.includes("if (isAutomaticRecoveryNotice) return;"));
    assert(rendererSource.includes("automatic_restart_after_recovery_limit"));

    console.log("pipeline automatic restart tests passed");
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
