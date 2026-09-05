"use strict";

const fs = require("fs/promises");
const path = require("path");
const { evaluateOnCdpPage, getConversationState } = require("./chatgpt_dom");
const { isChatGptActivelyGenerating } = require("../state");
const { writeSceneSnapshot, readSceneSnapshot, writeActionJournal } = require("../state/state");
const { enqueueProjectWrite } = require("../project");
const { validateMotionPromptTextContent } = require("../pipeline/asset_validation");
const {
  extractLatestChatGPTGeneratedImageBytes,
  saveChatGPTGeneratedImageAsset,
  validateSavedImageFile,
} = require("./chatgpt_pipeline");

const VALID_MANUAL_STAGES = ["REQUEST_1", "REQUEST_2", "NV1", "NV2"];

async function readLatestAssistantTurnText(page) {
  if (!page) return "";
  const result = await evaluateOnCdpPage(page, `(() => {
    const turns = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
    if (!turns.length) return "";
    const last = turns[turns.length - 1];
    return String(last.innerText || last.textContent || "").trim();
  })()`).catch(() => "");
  return String(result || "").trim();
}

async function startManualStage(projectPath, sceneId, stage, runtime = {}) {
  const { getCdpPage } = runtime;
  if (!sceneId) throw new Error("manual-chatgpt-stage: missing sceneId");
  if (!VALID_MANUAL_STAGES.includes(stage)) {
    throw new Error(`manual-chatgpt-stage: invalid stage '${stage}'`);
  }

  const sceneDir = path.join(projectPath, sceneId);
  const snapshot = await readSceneSnapshot(sceneDir);

  let conversationState = null;
  if (getCdpPage) {
    const page = await getCdpPage().catch(() => null);
    if (page) {
      conversationState = await getConversationState(page).catch(() => null);
    }
  }

  const baseline = {
    sceneId,
    stage,
    conversationId: conversationState?.conversationId || "",
    userCount: Number(conversationState?.userTurnCount || conversationState?.userCount || 0),
    assistantCount: Number(conversationState?.assistantTurnCount || conversationState?.assistantCount || 0),
    latestUserHash: conversationState?.latestUserHash || "",
    timestamp: new Date().toISOString(),
  };

  const manualState = snapshot.manualChatGpt || { enabled: true, stages: {} };
  manualState.enabled = true;
  manualState.currentStage = stage;
  manualState.baseline = baseline;
  manualState.stages = manualState.stages || {};
  manualState.stages[stage] = {
    started: true,
    completed: false,
    capturedAt: null,
    ...(stage === "REQUEST_1" || stage === "REQUEST_2" ? { responsePath: null } : {}),
    ...(stage === "NV1" ? { keyframePath: null } : {}),
    ...(stage === "NV2" ? { motionPromptPath: null } : {}),
  };

  await writeSceneSnapshot(sceneDir, { manualChatGpt: manualState });
  await writeActionJournal(sceneDir, {
    kind: "manual_stage_started",
    stage,
    sceneId,
    baseline,
  });

  return { ok: true, stage, baseline };
}

async function validateManualOwnership(page, baseline, targetSceneId, targetStage) {
  // Cross-scene & stage validation
  if (baseline && baseline.sceneId && baseline.sceneId !== targetSceneId) {
    return { ok: false, reason: `Response belongs to scene ${baseline.sceneId}, not ${targetSceneId}.` };
  }
  if (baseline && baseline.stage && baseline.stage !== targetStage) {
    return { ok: false, reason: `Response belongs to stage ${baseline.stage}, not ${targetStage}.` };
  }

  if (!page) return { ok: false, reason: "No active browser page found." };
  
  const currentState = await getConversationState(page).catch(() => null);
  if (!currentState) {
    return { ok: false, reason: "Could not read ChatGPT conversation state." };
  }

  // Conversation identity match (if baseline recorded conversationId)
  if (baseline && baseline.conversationId && currentState.conversationId) {
    if (baseline.conversationId !== currentState.conversationId) {
      return { ok: false, reason: "Conversation changed since capture baseline was recorded." };
    }
  }

  // Check if assistant is currently generating or streaming
  const isGenerating = await isChatGptActivelyGenerating(currentState).catch(() => false);
  if (isGenerating || currentState.composerBusy || currentState.stopButtonVisible) {
    return { ok: false, reason: "Assistant response is still streaming." };
  }

  // Check new user turn and assistant response exist after baseline
  const currentAssistantCount = Number(currentState.assistantTurnCount || currentState.assistantCount || 0);

  if (baseline) {
    if (currentAssistantCount <= baseline.assistantCount) {
      return { ok: false, reason: "No new assistant response found since stage started." };
    }
  } else if (currentAssistantCount <= 0) {
    return { ok: false, reason: "No assistant response found in conversation." };
  }

  return { ok: true, currentState };
}

async function captureManualStage(projectPath, sceneId, stage, runtime = {}) {
  const { getCdpPage } = runtime;
  if (!sceneId) throw new Error("manual-chatgpt-capture: missing sceneId");
  if (!VALID_MANUAL_STAGES.includes(stage)) {
    throw new Error(`manual-chatgpt-capture: invalid stage '${stage}'`);
  }

  const sceneDir = path.join(projectPath, sceneId);
  const snapshot = await readSceneSnapshot(sceneDir);
  const manualState = snapshot.manualChatGpt || {};
  const baseline = manualState.baseline || null;

  const page = getCdpPage ? await getCdpPage().catch(() => null) : null;
  if (!page) {
    return { ok: false, reason: "ChatGPT browser page not available." };
  }

  // Ownership validation
  const ownership = await validateManualOwnership(page, baseline, sceneId, stage);
  if (!ownership.ok) {
    await writeActionJournal(sceneDir, {
      kind: "manual_response_rejected",
      stage,
      sceneId,
      reason: ownership.reason,
    }).catch(() => null);
    return { ok: false, reason: ownership.reason };
  }

  const timestamp = new Date().toISOString();
  await fs.mkdir(sceneDir, { recursive: true });

  if (stage === "REQUEST_1" || stage === "REQUEST_2") {
    const text = await readLatestAssistantTurnText(page);
    if (!text) {
      return { ok: false, reason: "Extracted assistant text response was empty." };
    }
    const fileName = stage === "REQUEST_1" ? "request_1_response.txt" : "request_2_response.txt";
    const filePath = path.join(sceneDir, fileName);

    await enqueueProjectWrite(filePath, async () => {
      await fs.writeFile(filePath, text, "utf8");
    });

    const updatedManual = {
      ...manualState,
      currentStage: stage,
      stages: {
        ...(manualState.stages || {}),
        [stage]: {
          started: true,
          completed: true,
          capturedAt: timestamp,
          responsePath: fileName,
        },
      },
    };
    await writeSceneSnapshot(sceneDir, { manualChatGpt: updatedManual });
    await writeActionJournal(sceneDir, {
      kind: stage === "REQUEST_1" ? "manual_request_1_captured" : "manual_request_2_captured",
      stage,
      sceneId,
      filePath: fileName,
    });
    return { ok: true, stage, filePath: fileName, artifactPath: filePath };
  }

  if (stage === "NV1") {
    const imageBytes = await extractLatestChatGPTGeneratedImageBytes(page, { timeoutMs: 30000 }).catch(() => null);
    if (!imageBytes || !imageBytes.length) {
      return { ok: false, reason: "No valid image response found in ChatGPT." };
    }
    const keyframeFileName = `${sceneId}_keyframe.png`;
    const keyframeFilePath = path.join(sceneDir, keyframeFileName);

    const saved = await saveChatGPTGeneratedImageAsset(imageBytes, keyframeFilePath).catch((err) => ({ ok: false, error: err.message }));
    if (!saved || saved.ok === false) {
      return { ok: false, reason: `Failed to save NV1 keyframe: ${saved?.error || "unknown"}` };
    }
    const val = await validateSavedImageFile(keyframeFilePath).catch(() => ({ ok: false }));
    if (!val.ok) {
      return { ok: false, reason: `Saved NV1 image failed validation: ${val.error || "invalid"}` };
    }

    const updatedManual = {
      ...manualState,
      currentStage: "NV1",
      stages: {
        ...(manualState.stages || {}),
        NV1: {
          started: true,
          completed: true,
          capturedAt: timestamp,
          keyframePath: keyframeFileName,
        },
      },
    };
    await writeSceneSnapshot(sceneDir, { manualChatGpt: updatedManual });
    await writeActionJournal(sceneDir, {
      kind: "manual_nv1_captured",
      stage: "NV1",
      sceneId,
      filePath: keyframeFileName,
    });
    return { ok: true, stage: "NV1", filePath: keyframeFileName, artifactPath: keyframeFilePath };
  }

  if (stage === "NV2") {
    const text = await readLatestAssistantTurnText(page);
    if (!text) {
      return { ok: false, reason: "Extracted assistant motion prompt text was empty." };
    }
    const val = validateMotionPromptTextContent(text);
    if (!val.ok) {
      return { ok: false, reason: `NV2 response failed content validation: ${val.error}` };
    }
    const motionFileName = "motion_prompt.txt";
    const motionFilePath = path.join(sceneDir, motionFileName);

    await enqueueProjectWrite(motionFilePath, async () => {
      await fs.writeFile(motionFilePath, val.text, "utf8");
    });

    const updatedManual = {
      ...manualState,
      currentStage: "NV2",
      stages: {
        ...(manualState.stages || {}),
        NV2: {
          started: true,
          completed: true,
          capturedAt: timestamp,
          motionPromptPath: motionFileName,
        },
      },
    };
    await writeSceneSnapshot(sceneDir, { manualChatGpt: updatedManual });
    await writeActionJournal(sceneDir, {
      kind: "manual_nv2_captured",
      stage: "NV2",
      sceneId,
      filePath: motionFileName,
    });
    return { ok: true, stage: "NV2", filePath: motionFileName, artifactPath: motionFilePath };
  }

  return { ok: false, reason: "Unknown stage" };
}

async function getManualStatus(projectPath, sceneId) {
  if (!sceneId) return { ok: false, error: "missing-scene-id" };
  const sceneDir = path.join(projectPath, sceneId);
  const snapshot = await readSceneSnapshot(sceneDir);
  const manualState = snapshot.manualChatGpt || { enabled: false, stages: {} };
  return { ok: true, sceneId, manualState };
}

async function cancelManualStage(projectPath, sceneId) {
  if (!sceneId) return { ok: false, error: "missing-scene-id" };
  const sceneDir = path.join(projectPath, sceneId);
  const snapshot = await readSceneSnapshot(sceneDir);
  if (snapshot.manualChatGpt) {
    snapshot.manualChatGpt.baseline = null;
    await writeSceneSnapshot(sceneDir, { manualChatGpt: snapshot.manualChatGpt });
    await writeActionJournal(sceneDir, { kind: "manual_capture_cancelled", sceneId });
  }
  return { ok: true, sceneId };
}

module.exports = {
  VALID_MANUAL_STAGES,
  startManualStage,
  validateManualOwnership,
  captureManualStage,
  getManualStatus,
  cancelManualStage,
  readLatestAssistantTurnText,
};
