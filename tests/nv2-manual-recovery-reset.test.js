"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  buildNv2OwnedPromptBaseline,
  extractCompletedNv2ResponseFromSnapshot,
  hashChatGptSnapshotText,
} = require("../electron/main/state/state");
const {
  resetSceneRecoveryForManualStart,
} = require("../electron/main/pipeline/pipeline_runner");

const root = path.resolve(__dirname, "..");
const rendererSource = fs.readFileSync(
  path.join(root, "electron/renderer.js"),
  "utf8",
);
const pipelineSource = fs.readFileSync(
  path.join(root, "electron/main/pipeline/pipeline_runner.js"),
  "utf8",
);
const chatGptSource = fs.readFileSync(
  path.join(root, "electron/main/chatgpt/chatgpt_pipeline.js"),
  "utf8",
);
const mainSource = fs.readFileSync(
  path.join(root, "electron/main.js"),
  "utf8",
);

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

(async () => {
  const projectDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "vidora-nv2-manual-recovery-"),
  );
  try {
    const sceneId = 21;
    const sceneDir = path.join(projectDir, "scene_021");
    const keyframePath = path.join(sceneDir, "scene_021_keyframe.png");
    fs.mkdirSync(sceneDir, { recursive: true });
    fs.writeFileSync(keyframePath, Buffer.from("valid-keyframe-must-survive"));
    const keyframeHashBefore = sha256(keyframePath);
    const untouchedSceneState = {
      sceneId: 22,
      stage: "veoup_waiting_output",
      retryCount: 1,
      recoveryLimitReached: false,
      videoPath: "scene_022/scene_022_video.mp4",
    };
    fs.writeFileSync(
      path.join(projectDir, "pipeline_state.json"),
      JSON.stringify(
        {
          21: {
            sceneId,
            stage: "nv2_prepare",
            currentStage: "nv2_prepare",
            retryCount: 2,
            attemptCount: 2,
            recoveryLimitReached: true,
            paused: true,
            active: false,
            waitingForUserStart: true,
            keyframePath,
            lastError: "no-new-assistant",
          },
          22: untouchedSceneState,
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
          manualNv2RetryRequested: false,
        },
        null,
        2,
      ),
    );

    const attemptKey = `${projectDir}::scene-${sceneId}`;
    const reset = await resetSceneRecoveryForManualStart(
      {
        manualRecoveryReset: true,
        runId: "run-manual-recovery-21",
        outputFolder: projectDir,
        sceneId,
        imagePath: keyframePath,
      },
      attemptKey,
    );
    assert.strictEqual(reset.reset, true);
    assert.strictEqual(reset.shouldRetryNv2, true);
    assert.strictEqual(sha256(keyframePath), keyframeHashBefore);

    const durableFile = JSON.parse(
      fs.readFileSync(path.join(projectDir, "pipeline_state.json"), "utf8"),
    );
    const durable = durableFile[21];
    assert.strictEqual(durable.retryCount, 0);
    assert.strictEqual(durable.attemptCount, 0);
    assert.strictEqual(durable.recoveryLimitReached, false);
    assert.strictEqual(durable.paused, false);
    assert.strictEqual(durable.active, true);
    assert.strictEqual(durable.waitingForUserStart, false);
    assert.strictEqual(durable.keyframePath, keyframePath);
    assert.deepStrictEqual(durableFile[22], untouchedSceneState);

    const savedSnapshot = JSON.parse(
      fs.readFileSync(path.join(sceneDir, "scene_snapshot.json"), "utf8"),
    );
    assert.strictEqual(savedSnapshot.pipelineStage, "NV2_SENT");
    assert.strictEqual(savedSnapshot.imageValidated, true);
    assert.strictEqual(savedSnapshot.manualNv2RetryRequested, true);
    assert.strictEqual(
      savedSnapshot.manualNv2RetryRunId,
      "run-manual-recovery-21",
    );

    const promptHash = hashChatGptSnapshotText("NV2 prompt");
    const oldAssistantHash = hashChatGptSnapshotText("old assistant text");
    const ownedPromptSnapshot = {
      url: "https://chatgpt.com/c/example",
      userMessages: [
        { id: "user-nv1", hash: "nv1", turnIndex: 0 },
        { id: "user-nv2", hash: promptHash, turnIndex: 6 },
      ],
      messages: [
        {
          id: "assistant-old",
          hash: oldAssistantHash,
          text: "old assistant text",
          turnIndex: 5,
        },
      ],
      count: 1,
      generationActive: false,
    };
    const baseline = buildNv2OwnedPromptBaseline(
      ownedPromptSnapshot,
      promptHash,
      {},
    );
    assert.strictEqual(baseline.nv2UserTurnIndex, 6);
    assert.strictEqual(baseline.count, 1);
    assert.strictEqual(
      extractCompletedNv2ResponseFromSnapshot(
        ownedPromptSnapshot,
        baseline,
      ).error,
      "no-new-assistant",
    );

    const completedText = "Valid motion prompt response ".padEnd(180, "x");
    const completedSnapshot = {
      ...ownedPromptSnapshot,
      count: 2,
      messages: [
        ...ownedPromptSnapshot.messages,
        {
          id: "assistant-nv2",
          hash: hashChatGptSnapshotText(completedText),
          text: completedText,
          turnIndex: 7,
        },
      ],
    };
    const adopted = extractCompletedNv2ResponseFromSnapshot(
      completedSnapshot,
      baseline,
    );
    assert.strictEqual(adopted.ok, true);
    assert.strictEqual(adopted.text, completedText);

    assert(rendererSource.includes("pendingManualRecoveryResetSceneIds"));
    assert(rendererSource.includes("manualRecoveryReset,"));
    assert(rendererSource.includes("scene.recoveryLimitReached = false"));
    assert(pipelineSource.includes("scenePipelineFailureTracker[attemptKey] = 0"));
    assert(pipelineSource.includes("manualNv2RetryRequested: true"));
    const resetFunctionSource = pipelineSource.slice(
      pipelineSource.indexOf("async function resetSceneRecoveryForManualStart"),
      pipelineSource.indexOf("function assertDurableSceneSuccess"),
    );
    assert(!resetFunctionSource.includes("fs.unlink"));
    assert(chatGptSource.includes("buildNv2OwnedPromptBaseline"));
    assert(chatGptSource.includes("!forceNv2Resend"));
    assert(chatGptSource.includes("motion_prompt_manual_recovery"));
    assert(chatGptSource.includes("runId,"));
    assert(mainSource.includes("saved.recoveryLimitReached === true"));

    console.log("NV2 manual recovery reset tests passed");
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
