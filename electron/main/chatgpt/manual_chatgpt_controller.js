"use strict";

const fs = require("fs/promises");
const path = require("path");
const { evaluateOnCdpPage, getConversationState } = require("./chatgpt_core");
const {
  readChatGptImageStateScript,
  readLatestAssistantScript,
} = require("./chatgpt_dom");
const { isChatGptActivelyGenerating, isChatGptDotLoadingCanvasAsset } = require("../state");
const { writeSceneSnapshot, readSceneSnapshot, writeActionJournal } = require("../state/state");
const { enqueueProjectWrite } = require("../project");
const { validateMotionPromptTextContent } = require("../pipeline/asset_validation");
const {
  extractLatestChatGPTGeneratedImageBytes,
  decodeImageBufferToPng,
  validateSavedImageFile,
  captureChatGptImageElementScreenshot,
} = require("./chatgpt_pipeline");

const VALID_MANUAL_STAGES = ["REQUEST_1", "REQUEST_2", "NV1", "NV2"];

function normalizeSceneToken(sceneId) {
  if (typeof sceneId === "string" && sceneId.startsWith("scene_")) {
    const num = parseInt(sceneId.replace("scene_", ""), 10);
    if (Number.isInteger(num) && num > 0) {
      return `scene_${String(num).padStart(3, "0")}`;
    }
    return sceneId;
  }
  const num = Number(sceneId);
  if (Number.isInteger(num) && num > 0) {
    return `scene_${String(num).padStart(3, "0")}`;
  }
  return String(sceneId || "scene_001");
}

function resolveSceneDir(projectPath, sceneToken) {
  if (!projectPath) return "";
  const base = path.basename(projectPath);
  if (base === sceneToken) return projectPath;
  return path.join(projectPath, sceneToken);
}

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

async function extractManualChatGptImage(page, { sceneId = "" } = {}) {
  if (!page) return { ok: false, error: "no-page" };

  // 1. First attempt: standard pipeline extraction
  let extracted = await extractLatestChatGPTGeneratedImageBytes(page, { existingUrls: [] }).catch(() => null);
  if (extracted?.ok && extracted.base64) {
    return extracted;
  }

  // 2. Second attempt: element screenshot fallback if candidate element was identified
  if (extracted?.screenshotCandidate) {
    const shot = await captureChatGptImageElementScreenshot(page, extracted.screenshotCandidate, { sceneId }).catch(() => null);
    if (shot?.ok && shot.base64) {
      return shot;
    }
  }

  // 3. Third attempt: direct DOM query for any completed img/canvas in latest agent-turn
  const directExtract = await evaluateOnCdpPage(page, `(async () => {
    try {
      const candidates = [
        ...document.querySelectorAll('.agent-turn .group\\\\/imagegen-image img'),
        ...document.querySelectorAll('.agent-turn img'),
        ...document.querySelectorAll('[data-message-author-role="assistant"] img'),
        ...document.querySelectorAll('.agent-turn .group\\\\/imagegen-image canvas'),
      ].filter((el) => {
        if (!el) return false;
        if (el.tagName === 'IMG') {
          return el.complete && (el.naturalWidth >= 256 || el.clientWidth >= 256) && (el.naturalHeight >= 256 || el.clientHeight >= 256);
        }
        if (el.tagName === 'CANVAS') {
          return (el.width >= 256 || el.clientWidth >= 256) && (el.height >= 256 || el.clientHeight >= 256);
        }
        return false;
      });

      if (!candidates.length) return { ok: false, error: 'no-completed-image-elements' };
      const el = candidates[candidates.length - 1];

      if (el.tagName === 'CANVAS') {
        const dataUrl = el.toDataURL('image/png');
        const base64 = dataUrl.replace(/^data:image\\/[a-z]+;base64,/, '');
        return { ok: true, base64, contentType: 'image/png', width: el.width, height: el.height, method: 'canvas' };
      }

      const src = el.currentSrc || el.src || el.getAttribute('src');
      if (!src) return { ok: false, error: 'img-has-no-src' };

      if (src.startsWith('data:image/')) {
        const base64 = src.replace(/^data:image\\/[a-z]+;base64,/, '');
        return { ok: true, base64, contentType: 'image/png', width: el.naturalWidth, height: el.naturalHeight, method: 'data-url' };
      }

      const resp = await fetch(src, { credentials: 'include', cache: 'no-store' });
      if (!resp.ok) return { ok: false, error: 'fetch-failed-' + resp.status };
      const blob = await resp.blob();
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const res = String(reader.result || '');
          resolve(res.replace(/^data:image\\/[a-z]+;base64,/, ''));
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      return {
        ok: true,
        base64,
        contentType: blob.type || 'image/png',
        byteLength: blob.size,
        width: el.naturalWidth,
        height: el.naturalHeight,
        method: 'fetch-blob',
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  })()`).catch(() => null);

  if (directExtract?.ok && directExtract.base64) {
    return directExtract;
  }

  return {
    ok: false,
    error: directExtract?.error || extracted?.error || "Không tìm thấy ảnh đã hoàn thành trên ChatGPT",
  };
}

async function startManualStage(projectPath, sceneId, stage, runtime = {}) {
  const { getCdpPage } = runtime;
  if (!sceneId) throw new Error("manual-chatgpt-stage: missing sceneId");
  if (!VALID_MANUAL_STAGES.includes(stage)) {
    throw new Error(`manual-chatgpt-stage: invalid stage '${stage}'`);
  }

  const sceneToken = normalizeSceneToken(sceneId);
  const sceneDir = resolveSceneDir(projectPath, sceneToken);
  const snapshot = await readSceneSnapshot(sceneDir);

  let conversationState = null;
  let manualTurns = [];
  if (getCdpPage) {
    const page = await getCdpPage().catch(() => null);
    if (page) {
      conversationState = await getConversationState(page).catch(() => null);
      manualTurns = await evaluateOnCdpPage(page, `(() => [...document.querySelectorAll('[data-message-author-role="user"], [data-message-author-role="assistant"]')].map((node, index) => ({
        id: node.getAttribute('data-message-id') || node.closest('[data-message-id]')?.getAttribute('data-message-id') || (node.getAttribute('data-message-author-role') + ':' + index),
        role: node.getAttribute('data-message-author-role'),
        text: String(node.innerText || node.textContent || '').trim(),
      })))()`).catch(() => []);
    }
  }

  const baseline = {
    sceneId: sceneToken,
    rawSceneId: sceneId,
    stage,
    conversationId: conversationState?.conversationId || "",
    userCount: Number(conversationState?.userTurnCount || conversationState?.userCount || 0),
    assistantCount: Number(conversationState?.assistantTurnCount || conversationState?.assistantCount || 0),
    turns: Array.isArray(manualTurns) ? manualTurns : [],
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
    sceneId: sceneToken,
    baseline,
  });

  return { ok: true, stage, baseline, sceneToken };
}

async function validateManualOwnership(page, baseline, targetSceneId, targetStage, options = {}) {
  const targetToken = normalizeSceneToken(targetSceneId);
  const baselineToken = baseline?.sceneId ? normalizeSceneToken(baseline.sceneId) : "";

  // Cross-scene & stage validation
  if (baselineToken && baselineToken !== targetToken) {
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
  const isGenerating = Boolean(isChatGptActivelyGenerating(currentState));
  if (isGenerating || currentState.composerBusy || currentState.stopButtonVisible) {
    return { ok: false, reason: "Assistant response is still streaming." };
  }

  // If force capture or skip baseline check requested, allow bypass
  if (options.force || options.skipBaselineCheck) {
    return { ok: true, currentState };
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

  // Baseline turn list prevents stale images/text from being attributed to a new scene or stage
  if (Array.isArray(baseline?.turns) && baseline.turns.length) {
    const currentTurns = await evaluateOnCdpPage(page, `(() => [...document.querySelectorAll('[data-message-author-role="user"], [data-message-author-role="assistant"]')].map((node, index) => ({
      id: node.getAttribute('data-message-id') || node.closest('[data-message-id]')?.getAttribute('data-message-id') || (node.getAttribute('data-message-author-role') + ':' + index),
      role: node.getAttribute('data-message-author-role'),
      text: String(node.innerText || node.textContent || '').trim(),
    })))()`).catch(() => []);

    if (Array.isArray(currentTurns) && currentTurns.length > 0) {
      const lastBaselineTurn = baseline.turns[baseline.turns.length - 1];
      const matchIdx = currentTurns.findIndex((t) => (lastBaselineTurn.id && t.id === lastBaselineTurn.id) || (lastBaselineTurn.text && t.text === lastBaselineTurn.text));

      let fresh = [];
      if (matchIdx !== -1) {
        fresh = currentTurns.slice(matchIdx + 1);
      } else if (currentTurns.length > baseline.turns.length) {
        fresh = currentTurns.slice(baseline.turns.length);
      }

      if (fresh.length > 0) {
        const userCountInFresh = fresh.filter((t) => t.role === 'user').length;
        const lastTurn = fresh[fresh.length - 1];
        if (userCountInFresh < 1 || lastTurn?.role !== 'assistant') {
          return { ok: false, reason: "Chưa nhận được lượt mới của người dùng và phản hồi ChatGPT tương ứng." };
        }
      }
    }
  }

  return { ok: true, currentState };
}

async function captureManualStage(projectPath, sceneId, stage, runtime = {}, options = {}) {
  const { getCdpPage } = runtime;
  if (!sceneId) throw new Error("manual-chatgpt-capture: missing sceneId");
  if (!VALID_MANUAL_STAGES.includes(stage)) {
    throw new Error(`manual-chatgpt-capture: invalid stage '${stage}'`);
  }

  const sceneToken = normalizeSceneToken(sceneId);
  const sceneDir = resolveSceneDir(projectPath, sceneToken);
  const snapshot = await readSceneSnapshot(sceneDir);
  const manualState = snapshot.manualChatGpt || {};
  const baseline = manualState.baseline || null;

  const page = getCdpPage ? await getCdpPage().catch(() => null) : null;
  if (!page) {
    return { ok: false, reason: "ChatGPT browser page not available." };
  }

  // Ownership validation
  const ownership = await validateManualOwnership(page, baseline, sceneToken, stage, options);
  if (!ownership.ok && !options.force) {
    await writeActionJournal(sceneDir, {
      kind: "manual_response_rejected",
      stage,
      sceneId: sceneToken,
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
      sceneId: sceneToken,
      filePath: fileName,
    });
    return { ok: true, stage, filePath: fileName, artifactPath: filePath, sceneToken };
  }

  if (stage === "NV1") {
    const keyframeFileName = `${sceneToken}_keyframe.png`;
    const keyframeFilePath = path.join(sceneDir, keyframeFileName);

    const imageAsset = await extractManualChatGptImage(page, { sceneId: sceneToken });
    if (!imageAsset || !imageAsset.ok || !imageAsset.base64) {
      return {
        ok: false,
        reason: `Lỗi trích xuất ảnh NV1: ${imageAsset?.error || "Không tìm thấy ảnh hợp lệ trên ChatGPT"}`,
      };
    }

    if (isChatGptDotLoadingCanvasAsset(imageAsset)) {
      return {
        ok: false,
        reason: "Ảnh ChatGPT vẫn đang trong quá trình tạo (placeholder canvas), vui lòng đợi ảnh render xong.",
      };
    }

    let decoded;
    try {
      const sourceBuffer = Buffer.from(imageAsset.base64, "base64");
      decoded = decodeImageBufferToPng(sourceBuffer, imageAsset.contentType || "image/png");
    } catch (decErr) {
      return {
        ok: false,
        reason: `Lỗi giải mã ảnh PNG: ${decErr.message}`,
      };
    }

    await fs.mkdir(sceneDir, { recursive: true });
    await fs.writeFile(keyframeFilePath, decoded.buffer);

    let val;
    try {
      val = await validateSavedImageFile(keyframeFilePath);
    } catch (valErr) {
      return {
        ok: false,
        reason: `Keyframe lưu được không hợp lệ: ${valErr.message}`,
      };
    }

    const stat = await fs.stat(keyframeFilePath).catch(() => ({ size: decoded.buffer.length }));

    let nv2Baseline = null;
    try {
      if (page) {
        const nv2ConvState = await getConversationState(page).catch(() => null);
        const nv2Turns = await evaluateOnCdpPage(page, `(() => [...document.querySelectorAll('[data-message-author-role="user"], [data-message-author-role="assistant"]')].map((node, index) => ({
          id: node.getAttribute('data-message-id') || node.closest('[data-message-id]')?.getAttribute('data-message-id') || (node.getAttribute('data-message-author-role') + ':' + index),
          role: node.getAttribute('data-message-author-role'),
          text: String(node.innerText || node.textContent || '').trim(),
        })))()`).catch(() => []);
        nv2Baseline = {
          sceneId: sceneToken,
          rawSceneId: sceneId,
          stage: "NV2",
          conversationId: nv2ConvState?.conversationId || "",
          userCount: Number(nv2ConvState?.userTurnCount || nv2ConvState?.userCount || 0),
          assistantCount: Number(nv2ConvState?.assistantTurnCount || nv2ConvState?.assistantCount || 0),
          turns: Array.isArray(nv2Turns) ? nv2Turns : [],
          latestUserHash: nv2ConvState?.latestUserHash || "",
          timestamp: new Date().toISOString(),
        };
      }
    } catch (_err) {}

    const updatedManual = {
      ...manualState,
      currentStage: "NV2",
      baseline: nv2Baseline || {
        sceneId: sceneToken,
        rawSceneId: sceneId,
        stage: "NV2",
        conversationId: baseline?.conversationId || "",
        userCount: (baseline?.userCount || 0) + 1,
        assistantCount: (baseline?.assistantCount || 0) + 1,
        turns: [],
        latestUserHash: "",
        timestamp: new Date().toISOString(),
      },
      stages: {
        ...(manualState.stages || {}),
        NV1: {
          started: true,
          completed: true,
          capturedAt: timestamp,
          keyframePath: keyframeFileName,
        },
        NV2: {
          started: true,
          completed: false,
        },
      },
    };
    await writeSceneSnapshot(sceneDir, { manualChatGpt: updatedManual });
    await writeActionJournal(sceneDir, {
      kind: "manual_nv1_captured",
      stage: "NV1",
      sceneId: sceneToken,
      filePath: keyframeFileName,
      size: stat.size,
      width: val.width || decoded.width,
      height: val.height || decoded.height,
    });

    return {
      ok: true,
      stage: "NV1",
      filePath: keyframeFileName,
      artifactPath: keyframeFilePath,
      sceneToken,
      size: stat.size,
      width: val.width || decoded.width,
      height: val.height || decoded.height,
    };
  }

  if (stage === "NV2") {
    let text = "";
    const assistantState = await evaluateOnCdpPage(page, `(${readLatestAssistantScript.toString()})()`).catch(() => null);
    if (assistantState?.text) {
      text = String(assistantState.text).trim();
    } else {
      text = await readLatestAssistantTurnText(page);
    }

    if (!text) {
      return { ok: false, reason: "Phản hồi văn bản từ ChatGPT đang trống." };
    }

    const val = validateMotionPromptTextContent(text);
    if (!val.ok) {
      return { ok: false, reason: `Motion prompt chưa hợp lệ: ${val.error}` };
    }

    const motionFileName = "motion_prompt.txt";
    const motionFilePath = path.join(sceneDir, motionFileName);

    await enqueueProjectWrite(motionFilePath, async () => {
      await fs.writeFile(motionFilePath, val.text, "utf8");
    });

    await fs.writeFile(path.join(sceneDir, "motion_prompt_from_chatgpt.txt"), val.text, "utf8").catch(() => null);

    const stat = await fs.stat(motionFilePath).catch(() => ({ size: Buffer.byteLength(val.text, "utf8") }));

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
      sceneId: sceneToken,
      filePath: motionFileName,
      length: val.text.length,
      size: stat.size,
    });

    return {
      ok: true,
      stage: "NV2",
      filePath: motionFileName,
      artifactPath: motionFilePath,
      sceneToken,
      motionPrompt: val.text,
      size: stat.size,
      length: val.text.length,
    };
  }

  return { ok: false, reason: "Unknown stage" };
}

async function getManualSceneAudit(projectPath, sceneId) {
  if (!sceneId) return { ok: false, error: "missing-scene-id" };
  const sceneToken = normalizeSceneToken(sceneId);
  const sceneDir = resolveSceneDir(projectPath, sceneToken);

  const keyframeFileName = `${sceneToken}_keyframe.png`;
  const keyframeFilePath = path.join(sceneDir, keyframeFileName);
  const motionFileName = "motion_prompt.txt";
  const motionFilePath = path.join(sceneDir, motionFileName);

  let keyframeExists = false;
  let keyframeValid = false;
  let keyframeSize = 0;
  let keyframeError = "";
  let width = 0;
  let height = 0;

  try {
    const kfStat = await fs.stat(keyframeFilePath);
    keyframeExists = true;
    keyframeSize = kfStat.size;
    try {
      const val = await validateSavedImageFile(keyframeFilePath);
      keyframeValid = Boolean(val.ok);
      keyframeError = val.error || "";
      width = val.width || 0;
      height = val.height || 0;
    } catch (valErr) {
      keyframeValid = false;
      keyframeError = valErr.message || "Invalid keyframe";
    }
  } catch (statErr) {
    keyframeExists = false;
    keyframeError = statErr.code === "ENOENT" ? "Chưa có file keyframe" : statErr.message;
  }

  let motionPromptExists = false;
  let motionPromptValid = false;
  let motionPromptSize = 0;
  let motionPromptLength = 0;
  let motionPromptText = "";
  let motionPromptError = "";

  try {
    const mpStat = await fs.stat(motionFilePath);
    motionPromptExists = true;
    motionPromptSize = mpStat.size;
    const content = await fs.readFile(motionFilePath, "utf8");
    motionPromptText = content;
    motionPromptLength = content.length;
    const val = validateMotionPromptTextContent(content);
    motionPromptValid = Boolean(val.ok);
    motionPromptError = val.error || "";
  } catch (err) {
    motionPromptExists = false;
    motionPromptError = err.code === "ENOENT" ? "Chưa có file motion prompt" : err.message;
  }

  return {
    ok: true,
    sceneId: sceneToken,
    sceneDir,
    keyframe: {
      exists: keyframeExists,
      valid: keyframeValid,
      path: keyframeFilePath,
      fileName: keyframeFileName,
      size: keyframeSize,
      width,
      height,
      error: keyframeError,
    },
    motionPrompt: {
      exists: motionPromptExists,
      valid: motionPromptValid,
      path: motionFilePath,
      fileName: motionFileName,
      size: motionPromptSize,
      length: motionPromptLength,
      text: motionPromptText,
      error: motionPromptError,
    },
    isSceneComplete: keyframeValid && motionPromptValid,
  };
}

async function detectChatGPTProgress(runtime = {}) {
  const { getCdpPage } = runtime;
  if (!getCdpPage) return { ok: false, reason: "no-runtime" };
  const page = await getCdpPage().catch(() => null);
  if (!page) return { ok: false, reason: "no-page" };
  const currentState = await getConversationState(page).catch(() => null);

  const isGenerating = currentState ? Boolean(isChatGptActivelyGenerating(currentState)) : false;

  const imageState = await evaluateOnCdpPage(page, `(${readChatGptImageStateScript.toString()})()`).catch(() => null);
  const assistantState = await evaluateOnCdpPage(page, `(${readLatestAssistantScript.toString()})()`).catch(() => null);

  const hasImage = Boolean(
    imageState?.completedVisibleImage ||
    (imageState?.urls && imageState.urls.length > 0)
  );

  const text = String(assistantState?.text || currentState?.latestAssistantText || "").trim();
  const textLength = Number(assistantState?.textLength || text.length || 0);
  const sampleText = text.slice(0, 120);

  const activeGenerating = Boolean(
    isGenerating ||
    currentState?.composerBusy ||
    currentState?.stopButtonVisible ||
    imageState?.generating ||
    assistantState?.generating
  );

  return {
    ok: true,
    isGenerating: activeGenerating,
    userTurnCount: Number(currentState?.userTurnCount || currentState?.userCount || 0),
    assistantTurnCount: Number(assistantState?.count || currentState?.assistantTurnCount || 0),
    hasImage,
    imageUrls: imageState?.urls || [],
    textLength,
    sampleText,
    conversationId: currentState?.conversationId || "",
  };
}

async function getManualStatus(projectPath, sceneId) {
  if (!sceneId) return { ok: false, error: "missing-scene-id" };
  const sceneToken = normalizeSceneToken(sceneId);
  const sceneDir = resolveSceneDir(projectPath, sceneToken);
  const snapshot = await readSceneSnapshot(sceneDir);
  const manualState = snapshot.manualChatGpt || { enabled: false, stages: {} };
  return { ok: true, sceneId: sceneToken, manualState };
}

async function cancelManualStage(projectPath, sceneId) {
  if (!sceneId) return { ok: false, error: "missing-scene-id" };
  const sceneToken = normalizeSceneToken(sceneId);
  const sceneDir = resolveSceneDir(projectPath, sceneToken);
  const snapshot = await readSceneSnapshot(sceneDir);
  if (snapshot.manualChatGpt) {
    snapshot.manualChatGpt.baseline = null;
    await writeSceneSnapshot(sceneDir, { manualChatGpt: snapshot.manualChatGpt });
    await writeActionJournal(sceneDir, { kind: "manual_capture_cancelled", sceneId: sceneToken });
  }
  return { ok: true, sceneId: sceneToken };
}

module.exports = {
  VALID_MANUAL_STAGES,
  normalizeSceneToken,
  resolveSceneDir,
  startManualStage,
  validateManualOwnership,
  captureManualStage,
  getManualSceneAudit,
  detectChatGPTProgress,
  getManualStatus,
  cancelManualStage,
  readLatestAssistantTurnText,
  extractManualChatGptImage,
};
