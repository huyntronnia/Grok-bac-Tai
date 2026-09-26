"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const {
  WORKFLOW_MODE,
  setWorkflowMode,
  getWorkflowMode,
  assertAutomaticChatGptMutationAllowed,
} = require("../electron/main/state/workflow_mode");
const {
  buildManualStageBundle,
} = require("../electron/main/chatgpt/manual_stage_bundle");
const {
  auditManualProject,
} = require("../electron/main/chatgpt/manual_project_audit");
const {
  createManualChatGptController,
  matchOwnedUserTurn,
} = require("../electron/main/chatgpt/manual_chatgpt_controller");

const VALID_PNG = require("./helpers/manual-workflow-fixture").validPng();

const MOTION = "A slow cinematic tracking movement follows the subject with stable framing, layered parallax, natural secondary motion, consistent lighting, precise timing, and a clean final settle for continuity into the next scene.";

function snapshot(conversationId, messages, generating = false) {
  return { conversationId, messages, generating };
}

async function createBundleInput(root, stage, sceneId = 1) {
  return buildManualStageBundle({
    projectPath: root,
    sceneId,
    stage,
    scene: {
      id: sceneId,
      text: `Scene ${sceneId} text`,
      nv1: "Create one production keyframe.",
      nv2: "Write one detailed motion prompt.",
    },
    collectPrepromptFiles: async () => [],
    collectRecentKeyframes: async () => [],
  });
}

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-manual-primary-"));
  try {
    setWorkflowMode(WORKFLOW_MODE);
    assert.strictEqual(getWorkflowMode(), "manual_keyframe_motion");
    assert.throws(
      () => assertAutomaticChatGptMutationAllowed("send-prompt"),
      /manual-mode-automatic-chatgpt-mutation-blocked/,
    );
    assert.throws(() => setWorkflowMode("automatic"), /unsupported-workflow-mode/);

    const nv1 = await createBundleInput(root, "NV1");
    assert.match(nv1.clipboardText, /scene_001_nv1_request\.txt/);
    assert.strictEqual(nv1.attachmentNames[0], "scene_001_nv1_request.txt");

    // NV1 and NV2 must be independently buildable.  A missing NV2 template
    // may never prevent the next scene's NV1 from being prepared.
    const isolatedNv1 = await buildManualStageBundle({
      projectPath: root,
      sceneId: 17,
      stage: "NV1",
      scene: { id: 17, text: "Scene 17 text", nv1: "Create scene 17 keyframe.", nv2: "" },
    });
    assert.match(isolatedNv1.clipboardText, /scene_017_nv1_request\.txt/);
    const scene17Dir = path.join(root, "scene_017");
    const existingRequest = path.join(scene17Dir, "scene_017_nv1_request.txt");
    await fs.writeFile(existingRequest, "Saved Scene 17 NV1 request", "utf8");
    const recoveredNv1 = await buildManualStageBundle({
      projectPath: root,
      sceneId: 17,
      stage: "NV1",
      scene: { id: 17, text: "Scene 17 text", nv1: "", nv2: "" },
    });
    assert.match(recoveredNv1.clipboardText, /scene_017_nv1_request\.txt/);
    assert.strictEqual(await fs.readFile(existingRequest, "utf8"), "Saved Scene 17 NV1 request", "manual recovery must retain the project's existing request file");
    await fs.mkdir(path.join(root, "scene_001"), { recursive: true });
    await fs.writeFile(path.join(root, "scene_001", "scene_001_keyframe.png"), VALID_PNG);
    const nv2 = await createBundleInput(root, "NV2");
    assert.deepStrictEqual(nv2.attachmentNames, [
      "scene_001_nv2_request.txt",
      "scene_001_keyframe.png",
    ]);
    await fs.rm(path.join(root, "scene_001", "scene_001_keyframe.png"));
    const domNormalizedTurn = matchOwnedUserTurn({
      text: `\u200B${nv1.clipboardText.replace("the following", "the   following").replace("'", "’")}`,
      attachmentNames: [],
    }, {
      clipboardText: nv1.clipboardText,
      attachmentNames: ["scene_001_nv1_request.txt"],
    });
    assert.strictEqual(domNormalizedTurn.matches, true, "ChatGPT DOM normalization must not reject the armed user turn");
    assert.deepStrictEqual(domNormalizedTurn.missingAttachments, ["scene_001_nv1_request.txt"], "missing DOM attachment labels must remain observable");

    let browserSnapshot = snapshot("conv-1", []);
    let browserReadable = true;
    const veoCalls = [];
    const runtime = {
      readConversationSnapshot: async () => {
        if (!browserReadable) throw new Error("manual-chrome-not-connected");
        return browserSnapshot;
      },
      buildStageBundle: ({ projectPath, stage, sceneId }) =>
        createBundleInput(projectPath, stage, sceneId),
      submitVeoUp: async (payload) => {
        veoCalls.push(payload);
        return { ok: true, status: "submitted", batchId: "batch-1" };
      },
    };
    let controller = createManualChatGptController(runtime);
    await controller.initialize({ projectPath: root, expectedSceneIds: [1, 2] });
    let view = await controller.getViewModel({ projectPath: root });
    assert.strictEqual(view.state, "SCENE_NV1_READY");
    const observation = await controller.getObservation({ projectPath: root });
    assert.strictEqual(observation.ok, true);
    assert.strictEqual(observation.observation.conversationId, "conv-1");
    assert.strictEqual(observation.observation.messageCount, 0);

    // Preparation is local: the prompt and attachment checklist must remain
    // available before the user has opened/logged into Manual Chrome.
    browserReadable = false;
    const offlinePrepared = await controller.prepare({ projectPath: root, sceneId: 1, stage: "NV1" });
    assert(offlinePrepared.ok, JSON.stringify(offlinePrepared));
    assert.match(offlinePrepared.bundle.clipboardText, /scene_001_nv1_request\.txt/);
    browserReadable = true;
    const prepared = await controller.prepare({ projectPath: root, sceneId: 1, stage: "NV1" });
    const armed = await controller.arm({ projectPath: root, bundle: prepared.bundle });
    const armedAgain = await controller.arm({ projectPath: root, bundle: prepared.bundle });
    assert(armed.ok, JSON.stringify(armed));
    assert(armedAgain.ok, JSON.stringify(armedAgain));
    assert.strictEqual(armedAgain.attempt.attemptId, armed.attempt.attemptId, "repeated copy/arm must preserve the active baseline");
    assert.strictEqual(armed.attempt.baselineAssistantCount, 0);

    controller = createManualChatGptController(runtime);
    view = await controller.resume({ projectPath: root });
    assert.strictEqual(view.activeAttempt.attemptId, armed.attempt.attemptId, "restart must preserve the waiting attempt");

    browserSnapshot = snapshot("other-conversation", [
      { id: "u1", role: "user", text: prepared.bundle.clipboardText },
      { id: "a1", role: "assistant", text: "Generated keyframe", imageBuffer: VALID_PNG },
    ]);
    let captured = await controller.capture({
      projectPath: root,
      attemptId: armed.attempt.attemptId,
      sceneId: 1,
      stage: "NV1",
    });
    assert.strictEqual(captured.ok, false);
    assert.strictEqual(captured.code, "CONVERSATION_MISMATCH");

    await controller.cancel({ projectPath: root, reason: "test-reset" });
    browserSnapshot = snapshot("conv-1", []);
    const rePrepared = await controller.prepare({ projectPath: root, sceneId: 1, stage: "NV1" });
    const reArmed = await controller.arm({ projectPath: root, bundle: rePrepared.bundle });
    browserSnapshot = snapshot("conv-1", [
      { id: "u2", role: "user", text: rePrepared.bundle.clipboardText, attachmentNames: [] },
      { id: "a2", role: "assistant", text: "Generated keyframe", imageBuffer: VALID_PNG, settled: true },
    ]);
    captured = await controller.capture({
      projectPath: root,
      attemptId: reArmed.attempt.attemptId,
      sceneId: 1,
      stage: "NV1",
    });
    assert.strictEqual(captured.ok, true);
    assert.strictEqual(captured.attempt.capturedAssistantTurnId, "a2");
    assert.strictEqual(captured.viewModel.state, "SCENE_NV2_READY", "a saved NV1 keyframe must advance directly to NV2");
    assert.strictEqual(captured.viewModel.preparedBundle.stage, "NV2", "the next stage must be prepared automatically");
    assert.strictEqual(captured.viewModel.preparedBundle.sceneId, 1);
    assert.strictEqual(captured.observation.observedOutputs[0].kind, "image", "observation must classify the GPT keyframe output");
    assert.strictEqual(captured.observation.savedOutputs[0].fileName, "scene_001_keyframe.png", "observation must expose the saved keyframe filename");

    // A user can explicitly save a response already visible in ChatGPT when
    // they prepared the correct stage but forgot to Arm before pressing Send.
    const nv2Prepared = await controller.prepare({ projectPath: root, sceneId: 1, stage: "NV2" });
    browserSnapshot = snapshot("conv-1", [
      { id: "u3", role: "user", text: "Attached the requested files", attachmentNames: nv2Prepared.bundle.attachmentNames },
      { id: "a3", role: "assistant", text: MOTION, settled: true },
    ]);
    const readyToSave = await controller.getObservation({ projectPath: root });
    assert.strictEqual(readyToSave.observation.capturablePreparedResponse.stage, "NV2");
    const adoptedCapture = await controller.capture({ projectPath: root, adoptPrepared: true });
    assert.strictEqual(adoptedCapture.ok, true, JSON.stringify(adoptedCapture));
    assert.strictEqual(adoptedCapture.attempt.adoptedPreparedResponse, true);
    assert.strictEqual(adoptedCapture.attempt.artifactPath.endsWith("motion_prompt.txt"), true);
    assert.strictEqual(adoptedCapture.viewModel.preparedBundle.stage, "NV1", "the next scene must be prepared automatically");
    assert.strictEqual(adoptedCapture.viewModel.preparedBundle.sceneId, 2);

    const incompleteAudit = await auditManualProject(root, [1, 2]);
    assert.strictEqual(incompleteAudit.readyCount, 1);
    const rejected = await controller.submitVeoUp({ projectPath: root, allowPartial: true });
    assert.strictEqual(rejected.ok, false);
    assert.strictEqual(veoCalls.length, 0, "N-1/N must never reach VeoUp");

    for (const sceneId of [1, 2]) {
      const token = `scene_${String(sceneId).padStart(3, "0")}`;
      const sceneDir = path.join(root, token);
      await fs.mkdir(sceneDir, { recursive: true });
      await fs.writeFile(path.join(sceneDir, `${token}_keyframe.png`), VALID_PNG);
      await fs.writeFile(path.join(sceneDir, "motion_prompt.txt"), MOTION, "utf8");
    }
    const completeAudit = await auditManualProject(root, [1, 2]);
    assert.strictEqual(completeAudit.readyCount, 2);
    const resumedAuto = await controller.resume({ projectPath: root });
    assert.strictEqual(resumedAuto.autoVeoUp.ok, true, "a complete disk audit must start VeoUp automatically");
    assert.strictEqual(veoCalls.length, 1);
    assert.strictEqual(veoCalls[0].allowPartial, false, "workflow submission is always strict");
    assert.deepStrictEqual(veoCalls[0].expectedSceneIds, [1, 2]);
    assert.strictEqual(veoCalls[0].trigger, "manual-auto-resume");
    await controller.resume({ projectPath: root });
    assert.strictEqual(veoCalls.length, 1, "a successful batch must not auto-run again after resume");

    await fs.rm(path.join(root, "scene_002", "motion_prompt.txt"));
    const blockedAfterReady = await controller.submitVeoUp({ projectPath: root });
    assert.strictEqual(blockedAfterReady.ok, false, "pre-submit re-audit must catch deleted source artifacts");
    assert.strictEqual(veoCalls.length, 1);

    console.log("Manual primary workflow behavioral tests passed");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
