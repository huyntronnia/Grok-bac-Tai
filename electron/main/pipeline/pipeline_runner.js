"use strict";

const { BrowserWindow } = require("electron");
const { AsyncLocalStorage } = require("async_hooks");
const fs = require("fs/promises");
const path = require("path");
const {
  writeJsonFileAtomic,
  enqueueProjectWrite,
} = require("../project");
const { materializeSceneRequestFiles } = require("./scene_request_files");
const {
  validateKeyframeFile,
  validateMotionPromptTextContent,
} = require("./asset_validation");

const { appendAppLog, maskRouterText } = require("../logging");
const { pathExists, sleep, getFfmpegBinaryPath, normalizeContinuityReferenceSettings, findSceneKeyframePathSafe } = require("../utils");
const { getDurablePipelineBackoffMs } = require("../recovery");
const { logMemoryMilestone } = require("../memory");
const {
  writeSceneSnapshot,
  readSceneSnapshot,
  verifyDraftOwnership,
  isChatGptActivelyGenerating,
  looksLikeCollapsedUserPrompt,
  hashChatGptSnapshotText,
  isChatGptDotLoadingCanvasAsset,
  getPipelineStateFile,
} = require("../state");
const {
  getChatGptContextFresh,
  setChatGptContextFresh,
} = require("../state/chatgpt_state");
const {
  evaluateOnCdpPage,
  waitForCdpLoad,
  getConversationState,
  uploadFilesToChatGptSequentially,
  sendPromptViaCdpInput,
  clickSendButtonViaCdp,
  sendNv2PromptViaDeepCdpInput,
  generateImageAndMotionWithChatGPT,
  generateMotionPromptWithChatGPT,
  requestReloadWithReason,
  isReloadBlocked,
  forceCleanChatGptNewChatRotation,
  isChatGptRequestRotationEligible,
  countChatGptAssistantRootsScript,
  countChatGptImageAgentTurnsScript,
  clearAllChatGptPipelineLocks,
} = require("../chatgpt");
const {
  executeVeoUpAutomation,
  stageSceneForVeoUp,
  invalidateSceneVeoUpCollection,
  isVeoUpStageError,
} = require("../veoup");


const {
  CHATGPT_STAGES,
  CHATGPT_ERROR_REASONS,
  CHATGPT_STABILITY_DEFAULTS,
  normalizeUiText,
  isRejectedSendLabel,
  isLikelyComposerSendLabel,
  classifyChatGptError,
  classifyChatGptState,
  buildChatGptStageLog,
  getRecoveryDecision,
  shouldRotateConversation
} = require("../../chatgptStability");

// --- Injected dependencies (set via initPipelineRunner) ---
let getCdpPage;
let tryAutoLoginWithStoredAccount;
let closeUnexpectedProviderTabs;
let notifyRenderer;
let openFreshChatGptRootPage;
let assertChatGptNotExistingConversation;
let generateImageWithImageApi;
let generateVideoWithProvider;
let loadHardPromptTasks;
let buildImageStagePrompt;
let buildMotionStagePrompt;
let getSceneMediaPaths;
let validateLocalVideoFile;
let extractContinuityReferencesFromVideo;
let hydrateFreshChatGptContextAfterRotation;

function initPipelineRunner(runtime = {}) {
  getCdpPage = runtime.getCdpPage;
  tryAutoLoginWithStoredAccount = runtime.tryAutoLoginWithStoredAccount;
  closeUnexpectedProviderTabs = runtime.closeUnexpectedProviderTabs;
  notifyRenderer = runtime.notifyRenderer;
  openFreshChatGptRootPage = runtime.openFreshChatGptRootPage;
  assertChatGptNotExistingConversation = runtime.assertChatGptNotExistingConversation;
  generateImageWithImageApi = runtime.generateImageWithImageApi;
  generateVideoWithProvider = runtime.generateVideoWithProvider;
  loadHardPromptTasks = runtime.loadHardPromptTasks;
  buildImageStagePrompt = runtime.buildImageStagePrompt;
  buildMotionStagePrompt = runtime.buildMotionStagePrompt;
  getSceneMediaPaths = runtime.getSceneMediaPaths;
  validateLocalVideoFile = runtime.validateLocalVideoFile;
  extractContinuityReferencesFromVideo = runtime.extractContinuityReferencesFromVideo;
  hydrateFreshChatGptContextAfterRotation = runtime.hydrateFreshChatGptContextAfterRotation;
}

// --- Moved State Variables ---
const pipelineRunScope = new AsyncLocalStorage();

const pipelineCancellation = {
  cancelledRunIds: new Set(),
  activeRunIds: new Set(),
  waiters: new Map(),
  childProcesses: new Map(),
};

const chatGptScenePrefetchLocks = new Map();

const scenePipelineLocks = new Map();

const scenePipelineFailureTracker = {};
const MAX_SCENE_RECOVERY_CYCLES = 2;

async function readChatGptConversationStateForInit(sceneId = 0) {
  const page = await getCdpPage("chatgpt", true, { bringToFront: true }).catch(() => null);
  if (!page) return null;
  try {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const state = await getConversationState(page).catch(() => null);
      const conversationLength = Number(state?.conversationLength);
      if (state?.ok && Number.isFinite(conversationLength)) {
        const result = {
          conversationLength,
          currentChatId: String(state?.currentChatId || "").trim(),
          latestUserMessageHash: String(state?.latestUserMessageHash || ""),
        };
        await appendAppLog(null, {
          source: "main",
          kind: "running",
          text: `ChatGPT chat-init gate: conversationLength=${conversationLength}.`,
          details: { sceneId, ...result },
        }).catch(() => null);
        return result;
      }
      if (attempt < 3) await sleep(500);
    }
    return null;
  } finally {
    await page.close().catch(() => null);
  }
}

async function refreshCurrentChatForLongRunMemory(
  sceneId,
  runId,
  reason = "periodic-long-run-refresh",
) {
  let page = null;
  try {
    page = await getCdpPage("chatgpt", true, {
      bringToFront: false,
      recover: false,
    });
    const before = await evaluateOnCdpPage(
      page,
      `(() => {
        const path = location.pathname || "";
        const href = location.href || "";
        const match = path.match(/\\/(?:c|chats)\\/([a-zA-Z0-9_-]+)/i) ||
                      path.match(/\\/g\\/[^/]+\\/c\\/([a-zA-Z0-9_-]+)/i) ||
                      href.match(/[?&]chat=([a-zA-Z0-9_-]+)/i);
        return {
          path,
          conversationId: match ? match[1] : "",
        };
      })()`,
    ).catch(() => ({}));
    if (!before?.conversationId) {
      await appendAppLog(null, {
        source: "main",
        kind: "warning",
        text: `ChatGPT long-run memory refresh skipped: conversationId not detected in path (${before?.path || "root"}).`,
        details: { sceneId, path: before?.path },
      }).catch(() => null);
      return { ok: false, skipped: true, reason: "missing-conversation-id" };
    }
    const state = await getConversationState(page).catch(() => ({}));
    if (state?.stopButtonVisible || state?.streaming) {
      await appendAppLog(null, {
        source: "main",
        kind: "warning",
        text: `ChatGPT long-run memory refresh skipped: chat is still generating.`,
        details: { sceneId },
      }).catch(() => null);
      return { ok: false, skipped: true, reason: "chat-still-generating" };
    }
    const reloaded = await requestReloadWithReason(
      page,
      "long-run-memory-refresh",
      sceneId,
      { allowWaitAcceptAtSafeBoundary: true },
    );
    if (!reloaded) {
      await appendAppLog(null, {
        source: "main",
        kind: "warning",
        text: `ChatGPT long-run memory refresh skipped: reload was blocked by safety boundary.`,
        details: { sceneId },
      }).catch(() => null);
      return { ok: false, skipped: true, reason: "reload-blocked" };
    }
    await waitForCdpLoad(page).catch(() => null);
    await sleep(4000);
    assertPipelineRunActive(runId);
    const after = await evaluateOnCdpPage(
      page,
      `(() => {
        const path = location.pathname || "";
        const href = location.href || "";
        const match = path.match(/\\/(?:c|chats)\\/([a-zA-Z0-9_-]+)/i) ||
                      path.match(/\\/g\\/[^/]+\\/c\\/([a-zA-Z0-9_-]+)/i) ||
                      href.match(/[?&]chat=([a-zA-Z0-9_-]+)/i);
        return {
          path,
          conversationId: match ? match[1] : "",
        };
      })()`,
    ).catch(() => ({}));
    if (after?.conversationId !== before.conversationId) {
      await appendAppLog(null, {
        source: "main",
        kind: "warning",
        text: `ChatGPT long-run memory refresh: conversation changed from ${before.conversationId} to ${after.conversationId}.`,
        details: { before: before.conversationId, after: after.conversationId },
      }).catch(() => null);
      return { ok: false, skipped: true, reason: "conversation-changed" };
    }
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: `ChatGPT long-run memory refresh completed in the same conversation after scene ${sceneId}.`,
      details: {
        sceneId,
        reason,
        conversationId: before.conversationId,
      },
    }).catch(() => null);
    return { ok: true, conversationId: before.conversationId };
  } finally {
    if (page) await page.close().catch(() => null);
  }
}

let sessionSceneCounter = 0;
const CHAT_ROTATION_ENABLED = false;
const CHAT_MEMORY_REFRESH_EVERY_SCENES = 5;

// --- Moved Functions ---
function getScopedPipelineRunId() {
  return pipelineRunScope.getStore()?.runId || "";
}

function makePipelineCancelledError(runId = getScopedPipelineRunId()) {
  const error = new Error(`PIPELINE_CANCELLED:${runId || "unknown"}`);
  error.code = "PIPELINE_CANCELLED";
  error.pipelineRunId = runId;
  return error;
}

function isPipelineCancelledError(error) {
  return (
    error?.code === "PIPELINE_CANCELLED" ||
    /^PIPELINE_CANCELLED:/i.test(String(error?.message || error || ""))
  );
}

function isPipelineRunCancelled(runId = getScopedPipelineRunId()) {
  return Boolean(runId && pipelineCancellation.cancelledRunIds.has(runId));
}

function assertPipelineRunActive(runId = getScopedPipelineRunId()) {
  if (isPipelineRunCancelled(runId)) throw makePipelineCancelledError(runId);
}

function registerPipelineWaiter(runId, reject) {
  if (!runId) return () => null;
  if (!pipelineCancellation.waiters.has(runId))
    pipelineCancellation.waiters.set(runId, new Set());
  const waiters = pipelineCancellation.waiters.get(runId);
  waiters.add(reject);
  return () => {
    waiters.delete(reject);
    if (!waiters.size) pipelineCancellation.waiters.delete(runId);
  };
}

function trackPipelineChildProcess(child, runId = getScopedPipelineRunId()) {
  if (!runId || !child) return child;
  if (!pipelineCancellation.childProcesses.has(runId))
    pipelineCancellation.childProcesses.set(runId, new Set());
  const children = pipelineCancellation.childProcesses.get(runId);
  children.add(child);
  const cleanup = () => {
    children.delete(child);
    if (!children.size) pipelineCancellation.childProcesses.delete(runId);
  };
  child.once?.("exit", cleanup);
  child.once?.("close", cleanup);
  return child;
}

function cancelPipelineRun(runId = "") {
  const targets = runId ? [runId] : [...pipelineCancellation.activeRunIds];
  for (const target of targets) {
    if (!target) continue;
    pipelineCancellation.cancelledRunIds.add(target);
    const waiters = [...(pipelineCancellation.waiters.get(target) || [])];
    pipelineCancellation.waiters.delete(target);
    for (const reject of waiters) reject(makePipelineCancelledError(target));
    const children = [
      ...(pipelineCancellation.childProcesses.get(target) || []),
    ];
    pipelineCancellation.childProcesses.delete(target);
    for (const child of children) {
      try {
        if (!child.killed) child.kill();
      } catch (_error) {}
    }
  }
  scenePipelineLocks.clear();
  chatGptScenePrefetchLocks.clear();
  clearAllChatGptPipelineLocks();
  appendAppLog(null, {
    source: "main",
    kind: "info",
    text: "Cleared scene locks\nCleared pipeline locks\nCleared active generation state\nCleared running pipeline cache",
  }).catch(() => null);
  return targets;
}

async function stopPipeline(_event, payload = {}) {
  const runId = String(payload?.runId || "").trim();
  const cancelled = cancelPipelineRun(runId);
  await appendAppLog(null, {
    source: "main",
    kind: "error",
    text: "Pipeline stop requested. Active backend automation invalidated.",
    details: { runId, cancelled },
  }).catch(() => null);
  return { ok: true, runId, cancelled };
}

function sanitizeScenePipelineResult(result = {}) {
  if (!result || typeof result !== "object") return result;
  const safeText = (value, max = 20000) => String(value || "").slice(0, max);
  const safePaths = (value) =>
    Array.isArray(value)
      ? value
          .filter(Boolean)
          .map((item) => safeText(item, 1000))
          .slice(0, 8)
      : [];
  const refs =
    result.generatedContinuityReferences &&
    typeof result.generatedContinuityReferences === "object"
      ? {
          ok: Boolean(result.generatedContinuityReferences.ok),
          skipped: Boolean(result.generatedContinuityReferences.skipped),
          reason: safeText(result.generatedContinuityReferences.reason, 500),
          sourceSceneId:
            result.generatedContinuityReferences.sourceSceneId || null,
          paths: safePaths(result.generatedContinuityReferences.paths),
        }
      : null;
  return {
    ok: Boolean(result.ok),
    sceneId: result.sceneId || null,
    sceneDir: safeText(result.sceneDir, 1000),
    phase: safeText(result.phase, 100),
    imagePath: safeText(result.imagePath, 1000),
    imagePromptUsed: safeText(result.imagePromptUsed, 50000),
    motionPrompt: safeText(result.motionPrompt, 50000),
    videoPath: safeText(result.videoPath, 1000),
    videoValidated: Boolean(result.videoValidated),
    lastFramePath: safeText(result.lastFramePath, 1000),
    sourceVideoPath: safeText(result.sourceVideoPath, 1000),
    sourceDownloadPath: safeText(result.sourceDownloadPath, 1000),
    completionStatus: safeText(result.completionStatus, 100),
    alreadyCompleted: Boolean(result.alreadyCompleted),
    keyframeMotionPromptOnly: Boolean(result.keyframeMotionPromptOnly),
    motionPromptPath: safeText(result.motionPromptPath, 1000),
    videoProvider: safeText(result.videoProvider, 100),
    videoStatus: safeText(result.videoStatus, 2000),
    videoError: safeText(result.videoError, 4000),
    continuityReferencePaths: safePaths(result.continuityReferencePaths),
    continuityReferenceSourceScene:
      result.continuityReferenceSourceScene || null,
    generatedContinuityReferences: refs,
  };
}

async function runScenePipeline(_event, options = {}) {
  const runId = String(options?.runId || "").trim();
  if (runId) {
    assertPipelineRunActive(runId);
    pipelineCancellation.activeRunIds.add(runId);
  }
  const key = `${path.resolve(String(options.outputFolder || ""))}::scene-${((typeof options !== "undefined" && options?.sceneId) || (typeof context !== "undefined" && context?.sceneId) || "") ?? ""}`;
  const existing = scenePipelineLocks.get(key);
  if (existing) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Scene ${(typeof options !== "undefined" && options?.sceneId) || (typeof context !== "undefined" && context?.sceneId) || ""}: duplicate pipeline call joined existing run instead of opening a new chat.`,
      details: { key, startedAt: existing.startedAt },
    });
    return existing.promise;
  }
  const promise = pipelineRunScope.run({ runId }, () => runScenePipelineLocked(_event, options))
    .then(sanitizeScenePipelineResult);
  scenePipelineLocks.set(key, { promise, startedAt: new Date().toISOString() });
  try {
    return await promise;
  } finally {
    if (scenePipelineLocks.get(key)?.promise === promise)
      scenePipelineLocks.delete(key);
    if (runId) pipelineCancellation.activeRunIds.delete(runId);
  }
}

async function checkIfAllScenesComplete(projectDir) {
  let entries = [];
  try {
    entries = await fs.readdir(projectDir, { withFileTypes: true });
  } catch (err) {
    return { complete: false, sceneDirs: [] };
  }

  const sceneDirs = entries
    .filter((entry) => entry.isDirectory() && /^scene_\d+/i.test(entry.name))
    .map((entry) => path.join(projectDir, entry.name));

  if (sceneDirs.length === 0) {
    return { complete: false, sceneDirs: [] };
  }

  // Sort scene directories ascending by numeric suffix
  sceneDirs.sort((a, b) => {
    const aMatch = path.basename(a).match(/\d+/);
    const bMatch = path.basename(b).match(/\d+/);
    const aNum = aMatch ? parseInt(aMatch[0], 10) : 0;
    const bNum = bMatch ? parseInt(bMatch[0], 10) : 0;
    return aNum - bNum;
  });

  const validSceneDirs = [];
  for (const sceneDir of sceneDirs) {
    // Cached assets must satisfy the same quality gates as newly generated
    // NV1/NV2 outputs before they can contribute to scene completion.
    const motionPromptPath = path.join(sceneDir, "motion_prompt.txt");
    const motionPrompt = await fs
      .readFile(motionPromptPath, "utf8")
      .catch(() => "");
    if (!validateMotionPromptTextContent(motionPrompt).ok) {
      continue;
    }

    // Check if any keyframe image exists
    const sceneId = parseInt(path.basename(sceneDir).match(/\d+/)[0], 10);
    const keyframePath = await findSceneKeyframePathSafe(sceneDir, sceneId);
    const keyframeValidation = keyframePath
      ? await validateKeyframeFile(keyframePath)
      : { ok: false };
    if (keyframeValidation.ok) {
      validSceneDirs.push(sceneDir);
    }
  }

  return { complete: validSceneDirs.length > 0, sceneDirs: validSceneDirs };
}


async function readPipelineSceneState(projectDir = "", sceneId = 0) {
  const stateFile = getPipelineStateFile(projectDir);
  if (!stateFile || !(await pathExists(stateFile))) return {};
  try {
    const raw = await fs.readFile(stateFile, "utf8");
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed?.[sceneId] || {};
  } catch (_error) {
    return {};
  }
}

async function writePipelineSceneState(projectDir, sceneId, fields = {}) {
  try {
    const stateFile = path.join(projectDir, "pipeline_state.json");
    await enqueueProjectWrite(stateFile, async () => {
      let state = {};
      if (await pathExists(stateFile)) {
        try {
          const raw = await fs.readFile(stateFile, "utf8");
          if (raw) state = JSON.parse(raw);
        } catch (_error) {
          state = {};
        }
      }
      if (!state || typeof state !== "object" || Array.isArray(state)) state = {};
      state[sceneId] = {
        ...(state[sceneId] || {}),
        ...fields,
        updatedAt: new Date().toISOString(),
      };
      await writeJsonFileAtomic(stateFile, state, 2);
    });
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `[Pipeline State] Saved state for scene ${sceneId} to pipeline_state.json`,
      details: fields,
    }).catch(() => null);
  } catch (err) {
    console.error(
      "[writePipelineSceneState] Failed to write pipeline state:",
      err,
    );
    throw err;
  }
}

async function persistDurableStage(
  projectDir = "",
  sceneId = 0,
  stage = "",
  fields = {},
) {
  if (!projectDir || !sceneId || !stage) return;
  const previous = await readPipelineSceneState(projectDir, sceneId);
  const now = new Date().toISOString();
  await writePipelineSceneState(projectDir, sceneId, {
    runId: getScopedPipelineRunId() || fields.runId || previous.runId || "",
    sceneId,
    stage,
    currentStage: stage,
    attemptCount: Number(fields.attemptCount ?? previous.attemptCount ?? 0),
    retryCount: Number(fields.retryCount ?? previous.retryCount ?? 0),
    lastProgressAt: now,
    stageUpdatedAt: now,
    timestamps: {
      ...(previous.timestamps || {}),
      [stage]: now,
    },
    ...fields,
  });
}

async function resetSceneRecoveryForManualStart(options = {}, attemptKey = "") {
  const automaticRecoveryReset = options?.automaticRecoveryReset === true;
  const manualRecoveryReset = options?.manualRecoveryReset === true;
  if (!manualRecoveryReset && !automaticRecoveryReset) return { reset: false };
  const sceneId = Number(options?.sceneId || 0);
  const projectDir =
    options.outputFolder || options.projectPath || options.outputPath || "";
  if (!sceneId || !projectDir || !attemptKey) return { reset: false };

  const previous = await readPipelineSceneState(projectDir, sceneId).catch(
    () => ({}),
  );
  const currentStage = String(
    previous.stage || previous.currentStage || "prepare_scene",
  ).trim();
  const sceneToken = `scene_${String(sceneId).padStart(3, "0")}`;
  const sceneDir = path.join(projectDir, sceneToken);
  const expectedKeyframePath = path.join(
    sceneDir,
    `${sceneToken}_keyframe.png`,
  );
  const keyframeCandidates = [
    options.imagePath,
    previous.keyframePath,
    previous.imagePath,
    expectedKeyframePath,
  ].filter(Boolean);
  let keyframePath = "";
  for (const candidate of [...new Set(keyframeCandidates)]) {
    if (
      isSceneScopedFilePath(candidate, sceneId) &&
      (await validateKeyframeFile(candidate).catch(() => ({ ok: false }))).ok
    ) {
      keyframePath = candidate;
      break;
    }
  }
  const motionPromptPath = path.join(sceneDir, "motion_prompt.txt");
  const motionPromptExists = await pathExists(motionPromptPath).catch(
    () => false,
  );
  const sceneSnapshot = await readSceneSnapshot(sceneDir).catch(() => ({}));
  const shouldRetryNv2 = Boolean(
    keyframePath &&
      !motionPromptExists &&
      (/^nv2_/i.test(currentStage) || sceneSnapshot.pipelineStage === "NV2_SENT"),
  );
  const now = new Date().toISOString();
  const resetMode = automaticRecoveryReset ? "automatic" : "manual";

  scenePipelineFailureTracker[attemptKey] = 0;
  if (shouldRetryNv2) {
    await writeSceneSnapshot(sceneDir, {
      manualNv2RetryRequested: false,
      manualNv2RetryRunId: "",
      nv2ResumeWithoutResend: true,
      nv2ResumeWithoutResendAt: now,
      nv2ResumeTrigger: resetMode,
      motionValidated: false,
    });
  }
  await persistDurableStage(projectDir, sceneId, currentStage, {
    ok: false,
    paused: false,
    active: true,
    waitingForUserStart: false,
    recoveryLimitReached: false,
    retryCount: 0,
    attemptCount: 0,
    lastError: automaticRecoveryReset
      ? String(options.automaticRecoveryLastError || previous.lastError || "")
      : "",
    pausedAt: "",
    ...(automaticRecoveryReset
      ? {
          automaticRecoveryResetAt: now,
          automaticRecoveryResetRunId: String(
            options.runId || getScopedPipelineRunId() || "",
          ),
          autoRestartCount: Number(options.autoRestartCount || 1),
        }
      : {
          manualRecoveryResetAt: now,
          manualRecoveryResetRunId: String(
            options.runId || getScopedPipelineRunId() || "",
          ),
        }),
    keyframePath: keyframePath || previous.keyframePath || "",
  });
  if (automaticRecoveryReset) options.__automaticRecoveryResetApplied = true;
  else options.__manualRecoveryResetApplied = true;

  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `Scene ${sceneId}: ${resetMode} recovery reset accepted; retry budget reopened without deleting valid assets.`,
    details: {
      sceneId,
      currentStage,
      shouldRetryNv2,
      resetMode,
      autoRestartCount: automaticRecoveryReset
        ? Number(options.autoRestartCount || 1)
        : 0,
      preservedKeyframe: keyframePath ? path.basename(keyframePath) : "",
      motionPromptExists,
    },
  }).catch(() => null);
  return {
    reset: true,
    resetMode,
    currentStage,
    shouldRetryNv2,
    keyframePath,
  };
}

async function resetSceneRecoveryForAutomaticRestart(
  options = {},
  attemptKey = "",
) {
  return resetSceneRecoveryForManualStart(
    { ...options, automaticRecoveryReset: true, manualRecoveryReset: false },
    attemptKey,
  );
}

function assertDurableSceneSuccess(result = {}) {
  if (
    result?.keyframeMotionPromptOnly === true &&
    result?.ok &&
    result?.imagePath &&
    result?.motionPrompt
  ) {
    return;
  }
  if (!result?.ok || result.videoValidated !== true || !result.videoPath) {
    const error = new Error(
      result?.videoError || result?.videoStatus || "scene-output-incomplete",
    );
    error.status = isVeoUpStageError({ details: { result } })
      ? result?.videoStatus || result?.videoError || "veoup-stage-failed"
      : "scene-output-incomplete";
    error.details = { result };
    throw error;
  }
}

function isNv2NoResendTerminalFailure(error) {
  return /nv2-[^\s:]*no-resend|nv2-owned-response-wait-failed-no-resend|nv2-final-save-[^\s:]*no-resend/i.test(
    String(error?.message || error || ""),
  );
}

function isSceneScopedFilePath(filePath = "", sceneId = 0) {
  const token = `scene_${String(sceneId || 0).padStart(3, "0")}`;
  const normalized = String(filePath || "").replace(/\\/g, "/");
  const base = path.basename(String(filePath || ""));
  return normalized.includes(`/${token}/`) && base.startsWith(`${token}_`);
}

async function prepareSceneContext(options = {}) {
  const sceneId = Number(options?.sceneId || 0);
  const projectDir =
    options.outputFolder ||
    options.projectPath ||
    options.outputPath ||
    globalThis.__vidoraLastValidProjectPath ||
    "";
  if (!sceneId || !projectDir) return options;

  const sceneToken = `scene_${String(sceneId).padStart(3, "0")}`;
  const sceneDir = path.join(projectDir, sceneToken);
  const expectedImagePath = path.join(sceneDir, `${sceneToken}_keyframe.png`);

  const clearMismatchedPath = (key) => {
    const value = String(options[key] || "").trim();
    if (value && !isSceneScopedFilePath(value, sceneId)) {
      options[key] = "";
      return value;
    }
    return "";
  };

  const cleared = [
    clearMismatchedPath("imagePath"),
    clearMismatchedPath("keyframePath"),
    clearMismatchedPath("imageUrl"),
    clearMismatchedPath("keyframeUrl"),
  ].filter(Boolean);

  if (cleared.length) {
    options.imageDataUrl = "";
    await appendAppLog(null, {
      source: "main",
      kind: "warning",
      text: `Scene ${sceneId}: cleared cross-scene active cache/path contamination before running.`,
      details: {
        sceneId,
        expectedImagePath,
        cleared: cleared.map((filePath) => path.basename(filePath)),
      },
    }).catch(() => null);
  }

  for (const cacheKey of [
    "activeCache",
    "__vidoraActiveCache",
    "__vidoraSceneActiveCache",
  ]) {
    const cache = globalThis[cacheKey];
    try {
      if (cache?.clear) cache.clear();
      else if (cache && typeof cache === "object")
        Object.keys(cache).forEach((key) => delete cache[key]);
    } catch (_error) {}
  }

  options.__sceneScopedKeyframePath = expectedImagePath;
  options.__sceneScopedSceneDir = sceneDir;
  return options;
}

async function runScenePipelineLocked(_event, options) {
  if (!options) options = {};
  await prepareSceneContext(options);
  const runId = String(options.runId || getScopedPipelineRunId() || "").trim();

  if (runId && runId !== globalThis.__vidoraLastRunId) {
    globalThis.__vidoraLastRunId = runId;
    setChatGptContextFresh(true);
    sessionSceneCounter = 0;
    globalThis.__vidoraDisableSidebarSelection = false;
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `New pipeline run detected\nContext marked fresh`,
    }).catch(() => null);
  }

  assertPipelineRunActive(runId);

  // Strict Normalization: Unify all possible directory keys immediately at entry gate
  const validPath =
    options.projectPath ||
    options.outputPath ||
    options.outputFolder ||
    globalThis.__vidoraLastValidProjectPath;
  if (validPath) {
    options.projectPath = validPath;
    options.outputPath = validPath;
    options.outputFolder = validPath;
    globalThis.__vidoraLastValidProjectPath = validPath; // Cache as global fallback
  }

  const { sceneId } = options;
  const attemptKey = `${options.outputFolder || "default"}::scene-${sceneId || 0}`;
  const currentStartingSceneId = Number(sceneId || 0);

  await resetSceneRecoveryForManualStart(options, attemptKey);

  // If resuming mid-project, enforce clean state immediately before executing any prompt
  if (options && options.isFirstSceneOfRun && currentStartingSceneId > 1) {
    appendAppLog(
      currentStartingSceneId,
      "info",
      "Manual resume detected mid-project. Reusing current ChatGPT conversation; rotation only happens after repeated valid ChatGPT request failures.",
    );
  }

  // Track project transitions to reset counters & sidebar selection block
  const currentProjectName = String(
    options.projectName || options.projectTitle || options.project?.name || "",
  ).trim();
  if (
    currentProjectName &&
    currentProjectName !== globalThis.__vidoraLastProjectName
  ) {
    globalThis.__vidoraLastProjectName = currentProjectName;
    globalThis.__vidoraDisableSidebarSelection = false;
    sessionSceneCounter = 0;
    setChatGptContextFresh(true);
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Project changed to "${currentProjectName}". Resetting sessionSceneCounter and enabling sidebar selection.`,
    }).catch(() => null);
  }

  // Detect pipeline start / run from scene 1
  if (Number(sceneId) === 1) {
    globalThis.__vidoraDisableSidebarSelection = false;
    sessionSceneCounter = 0;
    setChatGptContextFresh(true);
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Starting from scene 1. Resetting sessionSceneCounter and enabling sidebar selection.`,
    }).catch(() => null);
  }

  const chatInitState = await readChatGptConversationStateForInit(sceneId);
  if (!chatInitState) {
    throw new Error("chatgpt-chat-init-state-unavailable");
  }
  const sceneDirForHydration = validPath
    ? path.join(validPath, `scene_${String(sceneId).padStart(3, "0")}`)
    : "";
  const hydrationSnapshot = sceneDirForHydration
    ? await readSceneSnapshot(sceneDirForHydration).catch(() => ({}))
    : {};
  const hydration = hydrationSnapshot?.hydration || {};
  const pendingHydrationHasOwnedPrompt = Boolean(
    chatInitState.latestUserMessageHash &&
      [hydration.request1PromptHash, hydration.request2PromptHash].includes(
        chatInitState.latestUserMessageHash,
      ),
  );
  const pendingHydrationMatchesConversation = Boolean(
    chatInitState.conversationLength > 0 &&
      hydration.startedAt &&
      (!hydration.request1Done || !hydration.request2Done) &&
      chatInitState.currentChatId &&
      ((hydration.conversationId &&
        hydration.conversationId === chatInitState.currentChatId) ||
        (!hydration.conversationId && pendingHydrationHasOwnedPrompt)),
  );

  if (chatInitState.conversationLength === 0) {
    setChatGptContextFresh(true);
    assertPipelineRunActive(runId);
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `ChatGPT empty chat detected: hydrating request 1/2 before active scene request.`,
      details: { sceneId, conversationLength: 0 },
    }).catch(() => null);
    await hydrateFreshChatGptContextAfterRotation(options, sceneId);
    assertPipelineRunActive(runId);
  } else if (pendingHydrationMatchesConversation) {
    setChatGptContextFresh(true);
    assertPipelineRunActive(runId);
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `ChatGPT hydration checkpoint is incomplete in the current conversation; resuming before NV1.`,
      details: {
        sceneId,
        conversationId: chatInitState.currentChatId,
        request1Done: Boolean(hydration.request1Done),
        request2Done: Boolean(hydration.request2Done),
      },
    }).catch(() => null);
    await hydrateFreshChatGptContextAfterRotation(options, sceneId);
    assertPipelineRunActive(runId);
  } else {
    setChatGptContextFresh(false);
  }

  while (true) {
    try {
      assertPipelineRunActive(runId);
      const result = await runScenePipelineLockedInternal(_event, options);
      await logMemoryMilestone(sceneId, "End of scene");
      assertPipelineRunActive(runId);
      assertDurableSceneSuccess(result);
      scenePipelineFailureTracker[attemptKey] = 0; // reset on success
      await persistDurableStage(
        options.outputFolder || options.projectPath || options.outputPath || "",
        sceneId,
        "complete",
        {
          ok: true,
          keyframeMotionPromptOnly: Boolean(result.keyframeMotionPromptOnly),
          keyframePath: result.imagePath || "",
          motionPromptPath: result.motionPromptPath || "",
          videoPath: result.videoPath || "",
          videoValidated: result.keyframeMotionPromptOnly ? false : true,
          lastFramePath: result.lastFramePath || "",
          sourceVideoPath:
            result.sourceVideoPath || result.sourceDownloadPath || "",
          completionStatus: result.completionStatus || "complete",
          retryCount: 0,
          attemptCount: 0,
          autoRestartCount: 0,
          recoveryLimitReached: false,
          paused: false,
          active: false,
          waitingForUserStart: false,
          lastError: "",
        },
      ).catch(() => null);

      // Count only full ChatGPT scenes. The counter drives a same-conversation
      // refresh, never an automatic conversation rotation.
      const fullChatGptSceneSucceeded = Boolean(
        options?.__nv1Succeeded && options?.__nv2Succeeded,
      );
      if (
        options &&
        options.__chatGptBrowserActionExecuted &&
        fullChatGptSceneSucceeded
      ) {
        sessionSceneCounter++;
        await appendAppLog(null, {
          source: "main",
          kind: "ok",
          text: `Scene ${sceneId} completed successfully (active ChatGPT browser run). Memory refresh counter: ${sessionSceneCounter}/${CHAT_MEMORY_REFRESH_EVERY_SCENES}.`,
        }).catch(() => null);
      } else {
        await appendAppLog(null, {
          source: "main",
          kind: "ok",
          text: `Scene ${sceneId} completed successfully (cached or partial ChatGPT browser run). Memory refresh counter: ${sessionSceneCounter}/${CHAT_MEMORY_REFRESH_EVERY_SCENES} (no increment without NV1+NV2 success).`,
          details: {
            nv1Succeeded: Boolean(options?.__nv1Succeeded),
            nv2Succeeded: Boolean(options?.__nv2Succeeded),
            chatGptBrowserActionExecuted: Boolean(
              options?.__chatGptBrowserActionExecuted,
            ),
          },
        }).catch(() => null);
      }
      if (CHAT_ROTATION_ENABLED && sessionSceneCounter >= 3) {
        await appendAppLog(null, {
          source: "main",
          kind: "running",
          text: `ChatGPT long-run rotation: ${sessionSceneCounter}/3 scenes completed in current chat. Opening new chat and hydrating request 1/2 before next scene.`,
          details: { sceneId, sessionSceneCounter },
        }).catch(() => null);
        assertPipelineRunActive(runId);
        await forceCleanChatGptNewChatRotation();
        assertPipelineRunActive(runId);
        await hydrateFreshChatGptContextAfterRotation(options, sceneId);
        assertPipelineRunActive(runId);
        sessionSceneCounter = 0;
      }

      if (CHAT_ROTATION_ENABLED && globalThis.__vidoraSafeExitRotationScheduled) {
        await appendAppLog(null, {
          source: "main",
          kind: "warning",
          text: `Proactive Memory Guard: scheduled safe exit rotation due to high resource usage. Rotating chat...`,
        }).catch(() => null);
        globalThis.__vidoraSafeExitRotationScheduled = false;
        assertPipelineRunActive(runId);
        await forceCleanChatGptNewChatRotation();
        assertPipelineRunActive(runId);
        await hydrateFreshChatGptContextAfterRotation(options, sceneId);
        assertPipelineRunActive(runId);
        sessionSceneCounter = 0;
      }
      const memoryRefreshScheduled = Boolean(
        globalThis.__vidoraSafeExitRotationScheduled ||
        globalThis.__vidoraSafeMemoryRefreshScheduled,
      );
      const periodicMemoryRefreshDue = Boolean(
        fullChatGptSceneSucceeded &&
        sessionSceneCounter >= CHAT_MEMORY_REFRESH_EVERY_SCENES,
      );
      if (periodicMemoryRefreshDue || memoryRefreshScheduled) {
        globalThis.__vidoraSafeExitRotationScheduled = false;
        globalThis.__vidoraSafeMemoryRefreshScheduled = false;
        const reason = memoryRefreshScheduled
          ? "memory-guard-threshold"
          : `scene-interval-${CHAT_MEMORY_REFRESH_EVERY_SCENES}`;
        await appendAppLog(null, {
          source: "main",
          kind: "running",
          text: `ChatGPT long-run memory maintenance: refreshing the same conversation after scene ${sceneId}.`,
          details: {
            sceneId,
            reason,
            sessionSceneCounter,
          },
        }).catch(() => null);
        try {
          await refreshCurrentChatForLongRunMemory(sceneId, runId, reason);
        } catch (memErr) {
          await appendAppLog(null, {
            source: "main",
            kind: "warning",
            text: `ChatGPT long-run memory maintenance encountered an issue but was safely skipped: ${memErr?.message || memErr}.`,
            details: { sceneId, error: memErr?.message || String(memErr) },
          }).catch(() => null);
        }
        sessionSceneCounter = 0;
      }
      const sceneAlreadyCompleted = Boolean(result?.alreadyCompleted);
      if (sceneAlreadyCompleted) {
        await appendAppLog(null, {
          source: "main",
          kind: "ok",
          text: `Scene ${sceneId} was already complete before this run; continuing to the next scene immediately.`,
        }).catch(() => null);
      } else {
        await appendAppLog(null, {
          source: "main",
          kind: "ok",
          text: `Scene ${sceneId} durable success committed; returning result to renderer.`,
        }).catch(() => null);
      }

      return result;
    } catch (error) {
      if (isPipelineCancelledError(error)) throw error;
      if (
        error &&
        error.message === "BREAKOUT_RECURSIVE_RETRY" &&
        error.result
      ) {
        return error.result;
      }
      const isNv2GenerationStartFailure =
        /nv2-generation-not-started-after-passive-guard/i.test(
          error?.message || String(error),
        );
      const isNv2ExistingResponseStillGenerating =
        /nv2-existing-response-still-generating/i.test(
          error?.message || String(error),
        );
      const projectDirForStage =
        options.outputFolder || options.projectPath || options.outputPath || "";
      const previousStageState = await readPipelineSceneState(
        projectDirForStage,
        sceneId,
      ).catch(() => ({}));
      const persistedStage = String(
        previousStageState.stage || previousStageState.currentStage || "",
      ).trim();
      if (isNv2NoResendTerminalFailure(error)) {
        scenePipelineFailureTracker[attemptKey] = MAX_SCENE_RECOVERY_CYCLES;
        await persistDurableStage(
          projectDirForStage,
          sceneId,
          "nv2_sent",
          {
            ok: false,
            active: false,
            paused: true,
            waitingForUserStart: true,
            recoveryLimitReached: true,
            nv2NoResend: true,
            lastError: error?.message || String(error),
            lastErrorAt: new Date().toISOString(),
          },
        ).catch(() => null);
        await notifyRenderer?.(
          "pipeline-paused",
          `Scene ${sceneId}: NV2 đã gửi nhưng không có response đủ điều kiện. Pipeline dừng tại checkpoint và không gửi lại NV2.`,
          {
            sceneId,
            currentStage: "nv2_sent",
            nv2NoResend: true,
            error: error?.message || String(error),
          },
        ).catch(() => null);
        throw error;
      }
      const isPersistedVeoUpStage = /^veoup_/i.test(persistedStage);
      const isVeoUpFailure = isVeoUpStageError(error) || isPersistedVeoUpStage;
      const isChatGptRequestFailureEligibleForRotation =
        isChatGptRequestRotationEligible(error, persistedStage);
      scenePipelineFailureTracker[attemptKey] =
        (scenePipelineFailureTracker[attemptKey] || 0) + 1;
      const consecutiveFailures = scenePipelineFailureTracker[attemptKey];
      const invalidImageBeforeMotion =
        /invalid image before MOTION_STAGE|missing validated image before MOTION_STAGE|file-too-small|image-decode-failed|image-dimensions-too-small/i.test(
          error?.message || String(error),
        );

      await appendAppLog(null, {
        source: "main",
        kind: "error",
        text: `Scene ${sceneId}: Pipeline attempt failed. Consecutive failure count: ${consecutiveFailures}/2. Error: ${error.message || String(error)}`,
      }).catch(() => null);

      if (invalidImageBeforeMotion && consecutiveFailures >= 1) {
        const projectDirForInvalidImage =
          options.outputFolder ||
          options.projectPath ||
          options.outputPath ||
          "";
        const sceneDirForInvalidImage = path.join(
          projectDirForInvalidImage,
          `scene_${String(sceneId).padStart(3, "0")}`,
        );
        const expectedImagePathForInvalidImage = path.join(
          sceneDirForInvalidImage,
          `scene_${String(sceneId).padStart(3, "0")}_keyframe.png`,
        );
        const badImageCandidates = [
          options.imagePath,
          previousStageState.keyframePath,
          previousStageState.imagePath,
          expectedImagePathForInvalidImage,
        ].filter(Boolean);
        for (const badImagePath of [...new Set(badImageCandidates)]) {
          if (await pathExists(badImagePath).catch(() => false)) {
            await fs.unlink(badImagePath).catch(() => null);
          }
        }
        options.imagePath = "";
        options.motionPrompt = "";
        options.forceRegenerateImage = true;
        options.forceRegenerateMotionPrompt = true;
        await persistDurableStage(
          projectDirForInvalidImage,
          sceneId,
          "nv1_prepare",
          {
            ok: false,
            keyframePath: "",
            motionPromptPath: path.join(
              sceneDirForInvalidImage,
              "motion_prompt.txt",
            ),
            lastError: error?.message || String(error),
            invalidImageRecoveredAt: new Date().toISOString(),
          },
        ).catch(() => null);
        await appendAppLog(null, {
          source: "main",
          kind: "warning",
          text: `Scene ${sceneId}: invalid keyframe before MOTION_STAGE; deleted bad image and regenerating NV1 instead of retrying the same file.`,
          details: {
            deleted: badImageCandidates.map((filePath) =>
              path.basename(filePath || ""),
            ),
            error: error?.message || String(error),
          },
        }).catch(() => null);
        if (consecutiveFailures < MAX_SCENE_RECOVERY_CYCLES) {
          assertPipelineRunActive(runId);
          await sleep(1500);
          continue;
        }
      }

      if (
        CHAT_ROTATION_ENABLED &&
        consecutiveFailures >= 2 &&
        isChatGptRequestFailureEligibleForRotation &&
        !isNv2ExistingResponseStillGenerating &&
        !isVeoUpFailure
      ) {
        await appendAppLog(null, {
          source: "main",
          kind: "warning",
          text: `Scene ${sceneId}: Rotating ChatGPT only after repeated valid request failures.`,
          details: {
            consecutiveFailures,
            persistedStage,
            error: error.message || String(error),
            policy: "valid-chatgpt-request-failure-only",
          },
        }).catch(() => null);

        try {
          // Trigger clean ChatGPT rotation & reference obliteration
          assertPipelineRunActive(runId);
          await forceCleanChatGptNewChatRotation();
          assertPipelineRunActive(runId);
          await hydrateFreshChatGptContextAfterRotation(options, sceneId);
          assertPipelineRunActive(runId);

          // Step E: Automatically re-inject the active scene's prompt payload.
          // We modify options to use the fresh new chat context and avoid old context navigation.
          const recoveryOptions = {
            ...options,
            imagePath: "",
            forceRegenerateImage: true,
            forceRegenerateMotionPrompt: true,
            motionPrompt: "",
          };

          await appendAppLog(null, {
            source: "main",
            kind: "running",
            text: `ChatGPT rotation hydrate request 3: continuing active scene request in the new chat.`,
            details: {
              sceneId,
              hasImagePath: Boolean(recoveryOptions.imagePath),
              forceRegenerateImage: Boolean(
                recoveryOptions.forceRegenerateImage,
              ),
            },
          }).catch(() => null);
          await appendAppLog(null, {
            source: "main",
            kind: "running",
            text: `Fresh Room Recovery Step E: Retrying pipeline with clean state...`,
          });
          assertPipelineRunActive(runId);
          const result = await runScenePipelineLockedInternal(
            _event,
            recoveryOptions,
          );
          assertPipelineRunActive(runId);
          assertDurableSceneSuccess(result);

          scenePipelineFailureTracker[attemptKey] = 0; // reset on success
          return result;
        } catch (recoveryError) {
          await appendAppLog(null, {
            source: "main",
            kind: "error",
            text: `Scene ${sceneId}: Fresh Room Recovery pipeline retry failed: ${recoveryError.message || String(recoveryError)}`,
          }).catch(() => null);
          error = recoveryError;
        }
      }
      const retryCount =
        scenePipelineFailureTracker[attemptKey] || consecutiveFailures || 1;
      const retryDelayMs = getDurablePipelineBackoffMs(retryCount);
      const projectDir = projectDirForStage;
      const previousState = previousStageState;
      const currentStage = isVeoUpFailure
        ? "veoup_prepare"
        : previousState.stage || previousState.currentStage || "prepare_scene";
      await persistDurableStage(projectDir, sceneId, currentStage, {
        ok: false,
        retryCount,
        attemptCount: retryCount,
        lastError: error?.message || String(error),
        lastErrorAt: new Date().toISOString(),
      }).catch(() => null);
      if (retryCount >= MAX_SCENE_RECOVERY_CYCLES) {
        const autoRestartCount =
          Number(previousState.autoRestartCount || 0) + 1;
        const autoRestartDelayMs = getDurablePipelineBackoffMs(
          MAX_SCENE_RECOVERY_CYCLES + autoRestartCount,
        );
        await resetSceneRecoveryForAutomaticRestart(
          {
            ...options,
            autoRestartCount,
            automaticRecoveryLastError: error?.message || String(error),
          },
          attemptKey,
        );
        await notifyRenderer?.(
          "pipeline-auto-restart",
          `Scene ${sceneId}: đã dùng đủ ${MAX_SCENE_RECOVERY_CYCLES} lần phục hồi. Tự chạy lại từ checkpoint sau ${Math.round(autoRestartDelayMs / 1000)} giây.`,
          {
            sceneId,
            retryCount,
            currentStage,
            recoveryLimitReached: false,
            autoRestartCount,
            autoRestartDelayMs,
          },
        ).catch(() => null);
        await appendAppLog(null, {
          source: "main",
          kind: "running",
          text: `Scene ${sceneId} [${currentStage}]: automatic pipeline restart ${autoRestartCount}; continuing from checkpoint in ${Math.round(autoRestartDelayMs / 1000)}s.`,
          details: {
            retryCount,
            autoRestartCount,
            autoRestartDelayMs,
            error: error?.message || String(error),
          },
        }).catch(() => null);
        await sleep(autoRestartDelayMs);
        assertPipelineRunActive(runId);
        continue;
      }
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `Scene ${sceneId} [${currentStage}]: no progress; retry ${retryCount} in ${Math.round(retryDelayMs / 1000)}s.`,
        details: {
          retryCount,
          retryDelayMs,
          error: error?.message || String(error),
        },
      }).catch(() => null);
      await sleep(retryDelayMs);
      assertPipelineRunActive(runId);
      continue;
    }
  }
}

async function runScenePipelineLockedInternal(_event, options) {
  const runId = String(options?.runId || getScopedPipelineRunId() || "").trim();
  assertPipelineRunActive(runId);
  const {
    projectName = "project",
    outputFolder,
    sceneId,
    imagePrompt,
    imageProvider = { method: "web" },
    scriptText = "",
    sceneText = "",
  } = options || {};
  const keyframeMotionPromptOnly = Boolean(options?.keyframeMotionPromptOnly);
  let motionPrompt = options.motionPrompt || "";

  if (!outputFolder) throw new Error("Chưa chọn folder output.");
  if (!sceneText?.trim() && !imagePrompt?.trim())
    throw new Error("Thiếu scene để tạo ảnh.");

  const projectDir = outputFolder;
  const sceneDir = path.join(
    projectDir,
    `scene_${String(sceneId).padStart(3, "0")}`,
  );
  await fs.mkdir(sceneDir, { recursive: true });
  const ownPrefetchLockKey = `${projectDir}:scene:${sceneId}:chatgpt-prefetch`;
  if (
    !options.prefetchOnly &&
    chatGptScenePrefetchLocks.has(ownPrefetchLockKey)
  ) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Scene ${sceneId}: Waiting for ongoing ChatGPT prefetch to finish before VeoUp.`,
    }).catch(() => null);
    await chatGptScenePrefetchLocks.get(ownPrefetchLockKey);
  }
  const existingDurableState = await readPipelineSceneState(
    projectDir,
    sceneId,
  ).catch(() => ({}));
  if (
    keyframeMotionPromptOnly &&
    !options.prefetchOnly &&
    (options.forceRegenerateImage || options.forceRegenerateMotionPrompt)
  ) {
    await invalidateSceneVeoUpCollection({
      projectDir,
      sceneId,
      reason: options.forceRegenerateImage
        ? "keyframe-regeneration-requested"
        : "motion-prompt-regeneration-requested",
    });
  }
  await persistDurableStage(projectDir, sceneId, "prepare_scene", {
    projectName,
    keyframePath: existingDurableState.keyframePath || "",
    motionPromptPath:
      existingDurableState.motionPromptPath ||
      path.join(sceneDir, "motion_prompt.txt"),
  }).catch(() => null);
  const hardTasks = await loadHardPromptTasks();
  const requestFiles = await materializeSceneRequestFiles({
    sceneDir,
    sceneId,
    nv1: hardTasks.task1 || imagePrompt,
    nv2: hardTasks.task2 || "",
    sceneText,
  });
  const finalImagePrompt = await fs.readFile(requestFiles.nv1.filePath, "utf8");
  await persistDurableStage(projectDir, sceneId, "request_files_materialized", {
    nv1RequestPath: requestFiles.nv1.filePath,
    nv1RequestSha256: requestFiles.nv1.contentSha256,
    nv1ControlPromptHash: requestFiles.nv1.controlPromptHash,
    nv1PayloadFingerprint: requestFiles.nv1.payloadFingerprint,
    nv2RequestPath: requestFiles.nv2.filePath,
    nv2RequestSha256: requestFiles.nv2.contentSha256,
    nv2ControlPromptHash: requestFiles.nv2.controlPromptHash,
    nv2PayloadFingerprint: requestFiles.nv2.payloadFingerprint,
  });
  const existingMotionPromptPath = path.join(sceneDir, "motion_prompt.txt");
  if (
    !motionPrompt?.trim() &&
    !options.forceRegenerateMotionPrompt &&
    (await pathExists(existingMotionPromptPath))
  ) {
    motionPrompt = await fs
      .readFile(existingMotionPromptPath, "utf8")
      .then((value) => value.trim())
      .catch(() => "");
    if (motionPrompt) {
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: `Scene ${sceneId}: đã có motion_prompt.txt, bỏ qua ChatGPT NV2 và gửi keyframe + Motion Prompt sang VeoUp.`,
      });
    }
  }
  if (motionPrompt?.trim()) {
    const cachedMotionValidation = validateMotionPromptTextContent(
      motionPrompt,
    );
    if (!cachedMotionValidation.ok) {
      await appendAppLog(null, {
        source: "main",
        kind: "warning",
        text: `Scene ${sceneId}: rejected cached motion prompt (${cachedMotionValidation.error}); NV2 will run again without reusing it.`,
      }).catch(() => null);
      motionPrompt = "";
    } else {
      motionPrompt = cachedMotionValidation.text;
    }
  }
  if (motionPrompt)
    await fs.writeFile(existingMotionPromptPath, motionPrompt, "utf8");

  const videoProvider = "veoup";
  const videoConfig = options.videoConfig || {};
  const continuitySettings = normalizeContinuityReferenceSettings(
    options.continuityReferences || options.continuity || {},
  );
  const continuityReferenceState = await ensureContinuityReferencesForPreviousScene({
    projectDir,
    sceneId,
    settings: continuitySettings,
  });
  await appendAppLog(null, {
    source: "main",
    kind: "info",
    text: `Scene ${sceneId}: video provider ${videoProvider}`,
    details: { videoProvider },
  });

  const expectedImagePath = path.join(
    sceneDir,
    `scene_${String(sceneId).padStart(3, "0")}_keyframe.png`,
  );
  let imagePath = isSceneScopedFilePath(options.imagePath || "", sceneId)
    ? options.imagePath
    : "";
  if (imagePath) {
    const providedImageValidation = await validateKeyframeFile(imagePath);
    if (!providedImageValidation.ok) imagePath = "";
  }
  if (
    !imagePath &&
    !options.forceRegenerateImage &&
    (await pathExists(expectedImagePath))
  ) {
    const cachedImageValidation = await validateKeyframeFile(expectedImagePath);
    if (cachedImageValidation.ok) {
      imagePath = expectedImagePath;
      options.__nv1Succeeded = true;
      await persistDurableStage(projectDir, sceneId, "nv1_image_validated", {
        keyframePath: imagePath,
        lastError: "",
      }).catch(() => null);
    } else {
      await appendAppLog(null, {
        source: "main",
        kind: "warning",
        text: `Scene ${sceneId}: rejected cached keyframe (${cachedImageValidation.error}); NV1 will regenerate it.`,
        details: cachedImageValidation,
      }).catch(() => null);
    }
  }

  if (!imagePath) {
    assertPipelineRunActive(runId);
    if (imageProvider?.method !== "api") {
      options.__chatGptBrowserActionExecuted = true;
    }

    let beforeAssistantCount = existingDurableState.beforeAssistantCount;
    let beforeImageAgentTurnCount =
      existingDurableState.beforeImageAgentTurnCount;
    if (
      beforeAssistantCount === undefined ||
      beforeAssistantCount === null ||
      beforeImageAgentTurnCount === undefined ||
      beforeImageAgentTurnCount === null
    ) {
      if (imageProvider?.method !== "api") {
        const page = await getCdpPage("chatgpt", true).catch(() => null);
        if (page) {
          try {
            if (beforeAssistantCount === undefined || beforeAssistantCount === null) {
              const counts = await evaluateOnCdpPage(
                page,
                `(${countChatGptAssistantRootsScript.toString()})()`,
              ).catch(() => ({ count: 0 }));
              beforeAssistantCount = counts.count;
            }
            if (
              beforeImageAgentTurnCount === undefined ||
              beforeImageAgentTurnCount === null
            ) {
              const imageTurnCounts = await evaluateOnCdpPage(
                page,
                `(${countChatGptImageAgentTurnsScript.toString()})()`,
              ).catch(() => ({ count: 0 }));
              // A scene state written by an older build already has an assistant
              // baseline but no image-turn baseline. Use zero for that migration
              // so a completed current image is not accidentally skipped.
              beforeImageAgentTurnCount =
                existingDurableState.beforeAssistantCount === undefined ||
                existingDurableState.beforeAssistantCount === null
                  ? Number(imageTurnCounts.count || 0)
                  : 0;
            }
          } finally {
            await page.close().catch(() => null);
          }
        }
      }
      if (beforeAssistantCount === undefined || beforeAssistantCount === null) {
        beforeAssistantCount = 0;
      }
      if (
        beforeImageAgentTurnCount === undefined ||
        beforeImageAgentTurnCount === null
      ) {
        beforeImageAgentTurnCount = 0;
      }
      await writePipelineSceneState(projectDir, sceneId, {
        beforeAssistantCount,
        beforeImageAgentTurnCount,
      }).catch(() => null);
    }

    if (!imagePath) {
      console.log(`[PIPELINE][Scene ${sceneId}] START NV1 ChatGPT image`);
      await persistDurableStage(projectDir, sceneId, "nv1_prepare", {
        keyframePath: expectedImagePath,
      }).catch(() => null);
      await persistDurableStage(projectDir, sceneId, "nv1_requesting_image", {
        keyframePath: expectedImagePath,
      }).catch(() => null);
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `PIPELINE Scene ${sceneId}: gửi scene + NV1 cho ChatGPT để tạo ảnh.`,
      });
      const referenceImagePaths = [];
      const chatGptResult =
        imageProvider?.method === "api"
          ? await generateImageWithImageApi({
              imagePrompt: finalImagePrompt,
              sceneDir,
              sceneId,
              config: imageProvider,
            })
          : await generateImageAndMotionWithChatGPT({
              imagePrompt: "",
              requestArtifact: requestFiles.nv1,
              sceneDir,
              sceneId,
              referenceImagePaths,
              options: {
                ...options,
                beforeAssistantCount,
                beforeImageAgentTurnCount,
              },
            });
      assertPipelineRunActive(runId);
      imagePath = chatGptResult.imagePath;
      options.__nv1Succeeded = true;
      await persistDurableStage(projectDir, sceneId, "nv1_image_validated", {
        keyframePath: imagePath,
        chatGptConversationUrl:
          chatGptResult.chatUrl ||
          existingDurableState.chatUrl ||
          existingDurableState.chatGptConversationUrl ||
          "",
      }).catch(() => null);
      console.log(`[PIPELINE][Scene ${sceneId}] SAVED image: ${imagePath}`);
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: `PIPELINE Scene ${sceneId}: đã lưu ảnh keyframe: ${path.basename(imagePath || "")}`,
      });
      if (chatGptResult.motionPrompt) {
        motionPrompt = chatGptResult.motionPrompt;
      }
      if (motionPrompt) {
        options.__nv2Succeeded = true;
        await fs.mkdir(sceneDir, { recursive: true });
        await fs.writeFile(
          path.join(sceneDir, "motion_prompt.txt"),
          motionPrompt,
          "utf8",
        );
      }
    }
  }

  if (
    !motionPrompt?.trim() &&
    !options.forceRegenerateMotionPrompt &&
    (await pathExists(existingMotionPromptPath))
  ) {
    motionPrompt = await fs
      .readFile(existingMotionPromptPath, "utf8")
      .then((value) => value.trim())
      .catch(() => "");
    if (motionPrompt) {
      const cachedMotionValidation = validateMotionPromptTextContent(
        motionPrompt,
      );
      if (cachedMotionValidation.ok) {
        motionPrompt = cachedMotionValidation.text;
        options.__nv2Succeeded = true;
        await appendAppLog(null, {
          source: "main",
          kind: "ok",
          text: `Scene ${sceneId}: dùng motion_prompt.txt có sẵn, không gửi ChatGPT NV2.`,
        });
      } else {
        motionPrompt = "";
        await appendAppLog(null, {
          source: "main",
          kind: "warning",
          text: `Scene ${sceneId}: motion_prompt.txt có sẵn không đạt quality gate (${cachedMotionValidation.error}); tiếp tục NV2.`,
        }).catch(() => null);
      }
    }
  }

  if (!motionPrompt?.trim()) {
    assertPipelineRunActive(runId);
    if (!imagePath || !(await pathExists(imagePath)))
      throw new Error(
        `Scene ${sceneId}: missing validated image before MOTION_STAGE.`,
      );
    const imageValidation = await validateKeyframeFile(imagePath).catch((error) => ({ ok: false, error: error.message }));
    if (!imageValidation?.ok)
      throw new Error(
        `Scene ${sceneId}: invalid image before MOTION_STAGE: ${imageValidation?.error || "image-validation-failed"}`,
      );
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: `Scene ${sceneId}: Image validated at ${path.basename(imagePath)}.`,
      details: {
        width: imageValidation.width,
        height: imageValidation.height,
        size: imageValidation.size,
      },
    });
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Scene ${sceneId}: NV1->NV2 cooldown 6000ms for ChatGPT image streaming state to settle.`,
    }).catch(() => null);
    await sleep(6000);
    assertPipelineRunActive(runId);
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Scene ${sceneId}: Using versioned NV2 request file.`,
      details: {
        requestFile: requestFiles.nv2.fileName,
        requestId: requestFiles.nv2.contentSha256.slice(0, 12),
      },
    });
    options.__chatGptBrowserActionExecuted = true;
    console.log(`[PIPELINE][Scene ${sceneId}] START NV2 ChatGPT motion prompt`);
    await persistDurableStage(projectDir, sceneId, "nv2_prepare", {
      keyframePath: imagePath,
      motionPromptPath: existingMotionPromptPath,
    }).catch(() => null);
    motionPrompt = await generateMotionPromptWithChatGPT({
      imagePath,
      prompt: "",
      requestArtifact: requestFiles.nv2,
      sceneDir,
      sceneId,
      sceneText,
      chatContextTitle: "",
      keyframeMotionPromptOnly,
      runId,
    });
    const generatedMotionValidation = validateMotionPromptTextContent(
      motionPrompt,
    );
    if (!generatedMotionValidation.ok) {
      throw new Error(
        `Scene ${sceneId}: generated motion prompt failed quality gate: ${generatedMotionValidation.error}`,
      );
    }
    motionPrompt = generatedMotionValidation.text;
    assertPipelineRunActive(runId);
    await fs.mkdir(sceneDir, { recursive: true });
    await fs.writeFile(
      path.join(sceneDir, "motion_prompt.txt"),
      motionPrompt,
      "utf8",
    );
    options.__nv2Succeeded = true;
    await persistDurableStage(projectDir, sceneId, "nv2_saved", {
      keyframePath: imagePath,
      motionPromptPath: existingMotionPromptPath,
    }).catch(() => null);
    console.log(
      `[PIPELINE][Scene ${sceneId}] SAVED motion prompt: ${path.join(sceneDir, "motion_prompt.txt")}`,
    );
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: `Scene ${sceneId}: Motion Prompt captured.`,
    });
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: `PIPELINE Scene ${sceneId}: đã lưu motion_prompt.txt.`,
    });
  }
  const finalMotionValidation = validateMotionPromptTextContent(motionPrompt);
  if (!finalMotionValidation.ok) {
    throw new Error(
      `Scene ${sceneId}: refusing to complete with invalid motion prompt: ${finalMotionValidation.error}`,
    );
  }
  motionPrompt = finalMotionValidation.text;
  const finalKeyframeValidation = await validateKeyframeFile(imagePath);
  if (!finalKeyframeValidation.ok) {
    throw new Error(
      `Scene ${sceneId}: refusing to complete with invalid keyframe: ${finalKeyframeValidation.error}`,
    );
  }
  await fs.writeFile(
    path.join(sceneDir, "motion_prompt.txt"),
    motionPrompt,
    "utf8",
  );
  await persistDurableStage(projectDir, sceneId, "nv2_saved", {
    keyframePath: imagePath,
    motionPromptPath: existingMotionPromptPath,
  }).catch(() => null);

  if (keyframeMotionPromptOnly && !options.prefetchOnly) {
    const veoUpCollection = await stageSceneForVeoUp({
      projectDir,
      sceneId,
      keyframePath: imagePath,
      motionPrompt,
      motionPromptPath: existingMotionPromptPath,
    });
    await persistDurableStage(projectDir, sceneId, "keyframe_motion_complete", {
      ok: true,
      keyframeMotionPromptOnly: true,
      keyframePath: imagePath,
      motionPromptPath: existingMotionPromptPath,
      videoPath: "",
      videoValidated: false,
      completionStatus: "keyframe_motion_complete",
      readyForVeoUp: true,
      veoUpKeyframePath: veoUpCollection.keyframePath,
      veoUpMotionPromptPath: veoUpCollection.motionPromptPath,
      lastError: "",
    }).catch(() => null);
    await writePipelineSceneState(projectDir, sceneId, {
      ok: true,
      sceneId,
      stage: "keyframe_motion_complete",
      keyframeMotionPromptOnly: true,
      keyframePath: imagePath,
      imagePath,
      motionPromptPath: existingMotionPromptPath,
      motionPrompt,
      videoPath: "",
      videoValidated: false,
      lastFramePath: "",
      completionStatus: "keyframe_motion_complete",
      status: "complete",
      readyForVeoUp: true,
      veoUpKeyframePath: veoUpCollection.keyframePath,
      veoUpMotionPromptPath: veoUpCollection.motionPromptPath,
    });
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: `Scene ${sceneId}: keyframe + Motion Prompt complete; VeoUp skipped by project mode.`,
    }).catch(() => null);
    return {
      ok: true,
      sceneId,
      sceneDir,
      phase: "motion_prompt",
      keyframeMotionPromptOnly: true,
      imagePath,
      imagePromptUsed: finalImagePrompt,
      motionPrompt,
      motionPromptPath: existingMotionPromptPath,
      keyframeOutputPath: veoUpCollection.keyframePath,
      motionPromptOutputPath: veoUpCollection.motionPromptPath,
      readyForVeoUp: true,
      videoPath: "",
      videoValidated: false,
      videoStatus: "skipped-keyframe-motion-only",
      lastFramePath: "",
      completionStatus: "keyframe_motion_complete",
    };
  }

  if (options.prefetchOnly) {
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: `Scene ${sceneId}: ChatGPT image + Motion Prompt prefetched; VeoUp deferred.`,
    });
    return {
      ok: true,
      sceneId,
      sceneDir,
      phase: "motion_prompt",
      prefetchOnly: true,
      imagePath,
      imagePromptUsed: finalImagePrompt,
      motionPrompt,
      motionPromptPath: existingMotionPromptPath,
      completionStatus: "prefetched",
    };
  }

  const checkpointFields = {
    projectName,
    sceneId,
    sceneIndex: sceneId,
    imageRef: path.basename(imagePath),
    motionPromptRef: "motion_prompt.txt",
    provider: videoProvider,
    currentStatus: "before_generation",
  };

  const sceneMediaPaths = getSceneMediaPaths(sceneDir, sceneId, runId);
  const existingVideoPath = sceneMediaPaths.videoPath;
  if (!options.forceRegenerateVideo && (await pathExists(existingVideoPath))) {
    try {
      const existingValidation = await validateLocalVideoFile(
        existingVideoPath,
        { runId },
      );
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: `Scene ${sceneId}: existing video validated; skipping ${videoProvider} regeneration.`,
        details: { existingVideoPath, validation: existingValidation },
      });
      const generatedContinuityReferences = {
        ok: false,
        skipped: true,
        reason: "deleted",
        sourceSceneId: sceneId,
        paths: [],
      };
      await persistDurableStage(projectDir, sceneId, "video_validated", {
        ok: true,
        sceneId,
        keyframePath: imagePath,
        motionPromptPath: existingMotionPromptPath,
        videoPath: existingVideoPath,
        videoValidated: true,
        lastFramePath: "",
        sourceVideoPath: existingVideoPath,
      }).catch(() => null);
      await writePipelineSceneState(projectDir, sceneId, {
        ok: true,
        sceneId,
        videoPath: existingVideoPath,
        videoValidated: true,
        lastFramePath: "",
        sourceVideoPath: existingVideoPath,
        completionStatus: "complete",
        status: "complete",
      });
      return {
        ok: true,
        alreadyCompleted: true,
        sceneId,
        sceneDir,
        phase: "video",
        imagePath,
        videoPath: existingVideoPath,
        videoProvider,
        videoStatus: "existing-video-validated",
        videoValidated: true,
        lastFramePath: "",
        sourceVideoPath: existingVideoPath,
        sourceDownloadPath: existingVideoPath,
        completionStatus: "complete",
        motionPrompt,
        continuityReferencePaths: continuityReferenceState?.paths || [],
        continuityReferenceSourceScene:
          continuityReferenceState?.sourceSceneId || null,
        generatedContinuityReferences,
      };
    } catch (error) {
      await appendAppLog(null, {
        source: "main",
        kind: "error",
        text: `Scene ${sceneId}: existing video failed validation; regenerating with ${videoProvider}.`,
        details: { existingVideoPath, error: error.message || String(error) },
      });
    }
  }
  if (
    false &&
    !options.forceRegenerateVideo &&
    (await pathExists(existingVideoPath))
  ) {
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: `Scene ${sceneId}: đã có video sẵn, bỏ qua tạo lại ${videoProvider}.`,
      details: { existingVideoPath },
    });
    const generatedContinuityReferences = {
      ok: false,
      skipped: true,
      reason: "deleted",
      sourceSceneId: sceneId,
      paths: [],
    };
    return {
      sceneDir,
      phase: "video",
      imagePath,
      videoPath: existingVideoPath,
      videoProvider,
      videoStatus: "existing-video-skip-regenerate",
      motionPrompt,
      continuityReferencePaths: continuityReferenceState?.paths || [],
      continuityReferenceSourceScene:
        continuityReferenceState?.sourceSceneId || null,
      generatedContinuityReferences,
    };
  }

  let videoResult = null;
  let videoError = "";
  try {
    const motionPromptForVideo = motionPrompt;
    assertPipelineRunActive(runId);
    await persistDurableStage(projectDir, sceneId, "veoup_prepare", {
      keyframePath: imagePath,
      motionPromptPath: existingMotionPromptPath,
    }).catch(() => null);
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Scene ${sceneId}: Sending local keyframe + Motion Prompt to VeoUp.`,
      details: {
        image: path.basename(imagePath || ""),
        motionPromptChars: String(motionPromptForVideo || "").length,
        videoProvider,
      },
    });
    const nextScenePrefetchPromise = startNextSceneChatGptPrefetch(options, sceneId);
    if (nextScenePrefetchPromise) {
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `Scene ${sceneId}: VeoUp is rendering; ChatGPT prefetch started for scene ${options.nextScenePrefetch?.sceneId}.`,
      }).catch(() => null);
      nextScenePrefetchPromise.catch(() => null);
    }
    videoResult = await generateVideoWithProvider({
      provider: videoProvider,
      imagePath,
      motionPrompt: motionPromptForVideo,
      sceneDir,
      sceneId,
      videoConfig,
      continuityReferencePaths: continuityReferenceState?.paths || [],
      continuitySettings,
      continuityReferences: continuityReferenceState,
    });
    assertPipelineRunActive(runId);
    await persistDurableStage(projectDir, sceneId, "veoup_generate_started", {
      keyframePath: imagePath,
      motionPromptPath: existingMotionPromptPath,
      veoupGenerateAcknowledged: Boolean(videoResult?.generateAcknowledged),
    }).catch(() => null);
    await persistDurableStage(projectDir, sceneId, "veoup_waiting_output", {
      keyframePath: imagePath,
      motionPromptPath: existingMotionPromptPath,
      veoupGenerateAcknowledged: Boolean(videoResult?.generateAcknowledged),
      sourceVideoPath:
        videoResult?.sourceVideoPath || videoResult?.sourceDownloadPath || "",
    }).catch(() => null);
  } catch (error) {
    videoError = maskRouterText(error.stack || error.message || String(error));
    const videoErrorFile = `${videoProvider}_video_error.txt`;
    await fs.writeFile(path.join(sceneDir, videoErrorFile), videoError, "utf8");
    await appendAppLog(null, {
      source: "main",
      kind: "error",
      text: `Scene ${sceneId}: lỗi tạo video ${videoProvider}: ${maskRouterText(error.message || error)}`,
      details: {
        imagePath: path.basename(imagePath),
        motionPromptRef: "motion_prompt.txt",
      },
    });
  }

  const generatedContinuityReferences = {
    ok: false,
    skipped: true,
    reason: "deleted",
    sourceSceneId: sceneId,
    paths: [],
  };
  const successPayload = {
    ok: Boolean(videoResult?.videoValidated && videoResult?.videoPath),
    sceneId,
    videoPath: videoResult?.videoPath || "",
    videoValidated: Boolean(videoResult?.videoValidated),
    lastFramePath: "",
    sourceVideoPath:
      videoResult?.sourceVideoPath || videoResult?.sourceDownloadPath || "",
  };
  if (successPayload.ok) {
    await persistDurableStage(projectDir, sceneId, "video_validated", {
      ...successPayload,
      motionPromptPath: existingMotionPromptPath,
      keyframePath: imagePath,
    }).catch(() => null);
    await writePipelineSceneState(projectDir, sceneId, {
      ...successPayload,
      completionStatus: 'complete',
      status: "complete",
    });
  }

  return {
    ok: successPayload.ok,
    sceneId,
    sceneDir,
    phase: "video",
    imagePath,
    imagePromptUsed: finalImagePrompt,
    videoPath: videoResult?.videoPath || "",
    videoProvider,
    videoStatus:
      videoResult?.status ||
      (videoError
        ? `error: ${maskRouterText(videoError.split("\n")[0])}`
        : "pending-selector-or-manual-download"),
    videoValidated: Boolean(videoResult?.videoValidated),
    videoSkipped: Boolean(videoError && !successPayload.ok),
    skipReason: videoError ? "veoup-video-failed" : "",
    lastFramePath: "",
    sourceVideoPath: successPayload.sourceVideoPath,
    sourceDownloadPath: successPayload.sourceVideoPath,
    completionStatus: successPayload.ok ? "complete" : "",
    videoError: maskRouterText(videoError),

    motionPrompt,
    continuityReferencePaths: continuityReferenceState?.paths || [],
    continuityReferenceSourceScene:
      continuityReferenceState?.sourceSceneId || null,
    generatedContinuityReferences,
  };
}

function startNextSceneChatGptPrefetch(options = {}, currentSceneId = 0) {
  const next = options.nextScenePrefetch || null;
  if (!next || !next.sceneId) return null;
  const projectDir =
    options.outputFolder || options.projectPath || options.outputPath || "";
  const lockKey = `${projectDir}:scene:${next.sceneId}:chatgpt-prefetch`;
  const existing = chatGptScenePrefetchLocks.get(lockKey);
  if (existing) return existing;
  const prefetchOptions = {
    ...options,
    ...next,
    outputFolder: projectDir,
    runId: options.runId,
    motionPrompt: "",
    imagePath: next.imagePath || "",
    forceRegenerateVideo: false,
    prefetchOnly: true,
    isFirstSceneOfRun: false,
    nextScenePrefetch: null,
  };
  const promise = runScenePipelineLockedInternal(null, prefetchOptions)
    .then(async (result) => {
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: `Scene ${next.sceneId}: ChatGPT prefetch complete while VeoUp rendered scene ${currentSceneId}.`,
        details: {
          sceneId: next.sceneId,
          imagePath: result?.imagePath || "",
          motionPromptChars: String(result?.motionPrompt || "").length,
        },
      }).catch(() => null);
      return result;
    })
    .catch(async (error) => {
      await appendAppLog(null, {
        source: "main",
        kind: "error",
        text: `Scene ${next.sceneId}: ChatGPT prefetch failed while VeoUp rendered scene ${currentSceneId}: ${error.message || String(error)}`,
      }).catch(() => null);
      throw error;
    })
    .finally(() => {
      if (chatGptScenePrefetchLocks.get(lockKey) === promise)
        chatGptScenePrefetchLocks.delete(lockKey);
    });
  chatGptScenePrefetchLocks.set(lockKey, promise);
  return promise;
}

async function finalizeValidatedSceneVideo({
  sourcePath = "",
  finalPath = "",
  candidatePath = "",
  runId = "",
} = {}) {
  assertPipelineRunActive(runId);
  await validateLocalVideoFile(sourcePath, { runId });
  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  await fs.copyFile(sourcePath, candidatePath);
  assertPipelineRunActive(runId);
  const candidateValidation = await validateLocalVideoFile(candidatePath, {
    runId,
  });
  await fs.rename(candidatePath, finalPath).catch(async (error) => {
    if (!["EEXIST", "EPERM"].includes(error?.code)) throw error;
    await fs.rm(finalPath, { force: true }).catch(() => null);
    await fs.rename(candidatePath, finalPath);
  });
  assertPipelineRunActive(runId);
  const finalValidation = await validateLocalVideoFile(finalPath, { runId });
  return {
    ok: true,
    sourcePath,
    finalPath,
    validation: finalValidation,
    candidateValidation,
  };
}

async function validateSceneVideoAndLastFrame({
  videoPath = "",
  lastFramePath = "",
  runId = "",
} = {}) {
  const videoValidation = await validateLocalVideoFile(videoPath, { runId });
  assertPipelineRunActive(runId);
  const frameValidation = {
    ok: true,
    skipped: true,
    reason: "last-frame-disabled",
  };
  return {
    ok: true,
    videoPath,
    lastFramePath,
    videoValidation,
    frameValidation,
  };
}

async function imageFileToDataUrl(imagePath) {
  const buffer = await fs.readFile(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function ensureContinuityReferencesForSceneVideo({ videoPath = '', projectDir = '', sceneId = 0, settings = {} } = {}) {
  return extractContinuityReferencesFromVideo(videoPath, projectDir, sceneId, settings).catch(async (error) => {
    await appendAppLog(null, { source: 'main', kind: 'running', text: `continuityRefs: extraction skipped reason=${maskRouterText(error.message || error)}`, details: { sceneId, video: path.basename(videoPath || '') } });
    return { ok: false, skipped: true, reason: error.message || String(error), sourceSceneId: sceneId, paths: [], keyFramePaths: [] };
  });
}

async function ensureContinuityReferencesForPreviousScene({ projectDir = '', sceneId = 0, settings = {} } = {}) {
  const previousSceneId = Number(sceneId) - 1;
  const normalized = normalizeContinuityReferenceSettings(settings);
  if (!normalized.enabled) {
    await appendAppLog(null, { source: 'main', kind: 'running', text: `continuityRefs: extraction skipped reason=disabled scene=${sceneId}` });
    return { ok: true, skipped: true, reason: 'disabled', sourceSceneId: previousSceneId, paths: [] };
  }
  if (previousSceneId < 1) {
    await appendAppLog(null, { source: 'main', kind: 'running', text: `chatgptContinuity: no previous references for scene=${sceneId}` });
    return { ok: true, skipped: true, reason: 'first-scene', sourceSceneId: 0, paths: [] };
  }
  const previousVideoPath = path.join(projectDir, `scene_${String(previousSceneId).padStart(3, '0')}`, `scene_${String(previousSceneId).padStart(3, '0')}_video.mp4`);
  return ensureContinuityReferencesForSceneVideo({ videoPath: previousVideoPath, projectDir, sceneId: previousSceneId, settings: normalized });
}

function buildContinuityPromptInstruction(referenceCount = 0) {
  if (!referenceCount) return '';
  return 'Use the attached reference images from the previous video to preserve subject identity, outfit, environment, lighting, camera continuity, and visual style. The last-frame reference is the strongest continuity anchor. Generate the new keyframe for the next scene based on the current scene description while keeping continuity with the references. Use them as continuity references only, not exact copies.';
}

function appendContinuityGuidanceToMotionPrompt(prompt = '', continuityRefs = {}, settings = {}) {
  const normalized = normalizeContinuityReferenceSettings(settings);
  const refs = (continuityRefs?.paths || []).filter(Boolean).slice(0, 4);
  if (!normalized.enabled || !refs.length) return prompt;
  const guidance = [
    'CONTINUITY REFERENCES:',
    `Use the previous video reference frames available for this scene (source scene ${continuityRefs.sourceSceneId || 'previous'}; ${refs.length} frame(s)). Keep subject identity, outfit, environment, lighting, camera direction, and motion continuity consistent. Treat the last frame as the strongest handoff anchor. Do not copy artifacts or frozen poses exactly.`,
  ].join('\n');
  return String(prompt || '') + '\n\n' + guidance;
}

async function buildImageMotionOnlyPipelineResult({
  sceneDir,
  sceneId,
  imagePath,
  motionPrompt,
  finalImagePrompt = '',
  continuityReferenceState = null,
}) {
  return {
    sceneDir,
    phase: 'motion_prompt',
    [ ['image', 'Motion', 'Only', 'Mode'].join('') ]: true,
    [ ['skip', 'Video', 'Generation'].join('') ]: true,
    imagePath,
    imagePromptUsed: finalImagePrompt || '',
    motionPrompt,
    motionPromptPath: path.join(sceneDir, 'motion_prompt.txt'),
    videoPath: '',
    videoProvider: 'none',
    videoStatus: ['skipped', 'image', 'motion', 'only'].join('-'),
    videoError: '',
    continuityReferencePaths: continuityReferenceState?.paths || [],
    continuityReferenceSourceScene: continuityReferenceState?.sourceSceneId || null,
    generatedContinuityReferences: {
      ok: false,
      skipped: true,
      reason: ['image', 'motion', 'only', 'mode'].join('-'),
      sourceSceneId: sceneId,
      paths: [],
    },
    router: null,
  };
}

module.exports = {
  initPipelineRunner,
  runScenePipeline,
  runScenePipelineLocked,
  runScenePipelineLockedInternal,
  stopPipeline,
  cancelPipelineRun,
  registerPipelineWaiter,
  trackPipelineChildProcess,
  assertPipelineRunActive,
  isPipelineRunCancelled,
  isPipelineCancelledError,
  makePipelineCancelledError,
  getScopedPipelineRunId,
  prepareSceneContext,
  validateSceneVideoAndLastFrame,
  finalizeValidatedSceneVideo,
  checkIfAllScenesComplete,
  isVeoUpStageError,
  readPipelineSceneState,
  writePipelineSceneState,
  persistDurableStage,
  resetSceneRecoveryForManualStart,
  resetSceneRecoveryForAutomaticRestart,
  assertDurableSceneSuccess,
  isNv2NoResendTerminalFailure,
  isSceneScopedFilePath,
  startNextSceneChatGptPrefetch,
  imageFileToDataUrl,
  pipelineCancellation,

  // Restored functions
  ensureContinuityReferencesForSceneVideo,
  ensureContinuityReferencesForPreviousScene,
  buildContinuityPromptInstruction,
  appendContinuityGuidanceToMotionPrompt,
  buildImageMotionOnlyPipelineResult,

  resetSessionSceneCounter: () => { sessionSceneCounter = 0; }
};
