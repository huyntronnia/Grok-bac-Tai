"use strict";

const { BrowserWindow } = require("electron");
const { AsyncLocalStorage } = require("async_hooks");
const fs = require("fs/promises");
const path = require("path");

const { appendAppLog, maskRouterText } = require("../logging");
const { pathExists, sleep, getFfmpegBinaryPath, normalizeVideoProvider, normalizeContinuityReferenceSettings, findSceneKeyframePathSafe, validateContinuityReferenceImage } = require("../utils");
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
  adoptExistingSceneImage,
  decodeImageBufferToPng,
  validateSavedImageFile,
  clearAllChatGptPipelineLocks,
} = require("../chatgpt");
const {
  executeVeoUpAutomation,
  scanProjectAndRunVeoUp,
  buildVeoUpPromptsReadyFile,
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
let selectGrokAccount;
let setAccountRouterEnabled;
let getGrokRouterStatus;
let classifyGrokRouterError;
let loadHardPromptTasks;
let buildImageStagePrompt;
let buildMotionStagePrompt;
let getSceneMediaPaths;
let validateLocalVideoFile;
let extractContinuityReferencesFromVideo;
let hydrateFreshChatGptContextAfterRotation;
let writeGrokRouterCheckpoint;
let pauseGrokRouterForError;

function initPipelineRunner(runtime = {}) {
  getCdpPage = runtime.getCdpPage;
  tryAutoLoginWithStoredAccount = runtime.tryAutoLoginWithStoredAccount;
  closeUnexpectedProviderTabs = runtime.closeUnexpectedProviderTabs;
  notifyRenderer = runtime.notifyRenderer;
  openFreshChatGptRootPage = runtime.openFreshChatGptRootPage;
  assertChatGptNotExistingConversation = runtime.assertChatGptNotExistingConversation;
  generateImageWithImageApi = runtime.generateImageWithImageApi;
  generateVideoWithProvider = runtime.generateVideoWithProvider;
  selectGrokAccount = runtime.selectGrokAccount;
  setAccountRouterEnabled = runtime.setAccountRouterEnabled;
  getGrokRouterStatus = runtime.getGrokRouterStatus;
  classifyGrokRouterError = runtime.classifyGrokRouterError;
  loadHardPromptTasks = runtime.loadHardPromptTasks;
  buildImageStagePrompt = runtime.buildImageStagePrompt;
  buildMotionStagePrompt = runtime.buildMotionStagePrompt;
  getSceneMediaPaths = runtime.getSceneMediaPaths;
  validateLocalVideoFile = runtime.validateLocalVideoFile;
  extractContinuityReferencesFromVideo = runtime.extractContinuityReferencesFromVideo;
  hydrateFreshChatGptContextAfterRotation = runtime.hydrateFreshChatGptContextAfterRotation;
  writeGrokRouterCheckpoint = runtime.writeGrokRouterCheckpoint;
  pauseGrokRouterForError = runtime.pauseGrokRouterForError;
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

let sessionSceneCounter = 0;
const CHAT_ROTATION_ENABLED = false;

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
  const router =
    result.router && typeof result.router === "object"
      ? {
          paused: Boolean(result.router.paused),
          selectedAccountId: safeText(result.router.selectedAccountId, 200),
          routingPolicy: safeText(result.router.routingPolicy, 200),
          pauseReason: safeText(result.router.pauseReason, 500),
          lastErrorClassification: safeText(
            result.router.lastErrorClassification,
            300,
          ),
        }
      : null;
  return {
    ok: Boolean(result.ok),
    sceneId: result.sceneId || null,
    sceneDir: safeText(result.sceneDir, 1000),
    phase: safeText(result.phase, 100),
    imagePath: safeText(result.imagePath, 1000),
    imageDataUrl: safeText(result.imageDataUrl, 8_000_000),
    imagePromptUsed: safeText(result.imagePromptUsed, 50000),
    motionPrompt: safeText(result.motionPrompt, 50000),
    videoPath: safeText(result.videoPath, 1000),
    videoValidated: Boolean(result.videoValidated),
    lastFramePath: safeText(result.lastFramePath, 1000),
    sourceVideoPath: safeText(result.sourceVideoPath, 1000),
    sourceDownloadPath: safeText(result.sourceDownloadPath, 1000),
    completionStatus: safeText(result.completionStatus, 100),
    keyframeMotionPromptOnly: Boolean(result.keyframeMotionPromptOnly),
    motionPromptPath: safeText(result.motionPromptPath, 1000),
    videoProvider: safeText(result.videoProvider, 100),
    videoStatus: safeText(result.videoStatus, 2000),
    videoError: safeText(result.videoError, 4000),
    continuityReferencePaths: safePaths(result.continuityReferencePaths),
    continuityReferenceSourceScene:
      result.continuityReferenceSourceScene || null,
    generatedContinuityReferences: refs,
    router,
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
    // Check if motion_prompt.txt exists and has content
    const motionPromptPath = path.join(sceneDir, "motion_prompt.txt");
    let hasMotionPrompt = false;
    try {
      const stat = await fs.stat(motionPromptPath);
      if (stat.size > 0) {
        hasMotionPrompt = true;
      }
    } catch (err) {
      // ignore
    }

    if (!hasMotionPrompt) {
      continue;
    }

    // Check if any keyframe image exists
    const sceneId = parseInt(path.basename(sceneDir).match(/\d+/)[0], 10);
    const keyframePath = await findSceneKeyframePathSafe(sceneDir, sceneId);
    if (keyframePath) {
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
    let state = {};
    if (await pathExists(stateFile)) {
      try {
        const raw = await fs.readFile(stateFile, "utf8");
        if (raw) state = JSON.parse(raw);
      } catch (e) {
        // ignore
      }
    }

    if (!state[sceneId]) {
      state[sceneId] = {};
    }
    state[sceneId] = {
      ...state[sceneId],
      ...fields,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(stateFile, JSON.stringify(state, null, 2), "utf8");
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
      text: `New pipeline run detected (runId: ${runId}). Resetting session state and marking context as fresh.`,
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

  if (getChatGptContextFresh()) {
    assertPipelineRunActive(runId);
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `ChatGPT fresh chat: hydrating request 1/2 before active scene request.`,
      details: { sceneId },
    }).catch(() => null);
    await hydrateFreshChatGptContextAfterRotation(options, sceneId);
    assertPipelineRunActive(runId);
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
          lastError: "",
        },
      ).catch(() => null);

      // Re-implement the Periodic 5-Scene Rotation Counter (Only increment on active browser actions):
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
          text: `Scene ${sceneId} completed successfully (active ChatGPT browser run). Session scene counter: ${sessionSceneCounter}/20.`,
        }).catch(() => null);
      } else {
        await appendAppLog(null, {
          source: "main",
          kind: "ok",
          text: `Scene ${sceneId} completed successfully (cached or partial ChatGPT browser run). Session scene counter: ${sessionSceneCounter}/20 (no increment without NV1+NV2 success).`,
          details: {
            nv1Succeeded: Boolean(options?.__nv1Succeeded),
            nv2Succeeded: Boolean(options?.__nv2Succeeded),
            chatGptBrowserActionExecuted: Boolean(
              options?.__chatGptBrowserActionExecuted,
            ),
          },
        }).catch(() => null);
      }
      if (CHAT_ROTATION_ENABLED && sessionSceneCounter >= 20) {
        await appendAppLog(null, {
          source: "main",
          kind: "running",
          text: `ChatGPT long-run rotation: ${sessionSceneCounter}/20 scenes completed in current chat. Opening new chat and hydrating request 1/2 before next scene.`,
          details: { sceneId, sessionSceneCounter },
        }).catch(() => null);
        assertPipelineRunActive(runId);
        await forceCleanChatGptNewChatRotation();
        assertPipelineRunActive(runId);
        await hydrateFreshChatGptContextAfterRotation(options, sceneId);
        assertPipelineRunActive(runId);
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
      // Inter-Scene Breather Padding: wait 10000ms to release active browser memory cache
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `Scene ${sceneId}: Inter-Scene Breather: sleeping 10000ms before returning success...`,
      }).catch(() => null);
      await sleep(10000);
      assertPipelineRunActive(runId);

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
        assertPipelineRunActive(runId);
        await sleep(1500);
        continue;
      }

      if (
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
      if (!isVeoUpFailure && retryCount >= 3) {
        await appendAppLog(null, {
          source: "main",
          kind: "warning",
          text: `Scene ${sceneId} [${currentStage}]: retry ${retryCount} reached; refreshing ChatGPT before next attempt.`,
          details: {
            retryCount,
            currentStage,
            error: error?.message || String(error),
          },
        }).catch(() => null);
        const refreshPage = await getCdpPage("chatgpt", true, {
          bringToFront: true,
        }).catch(() => null);
        if (refreshPage) {
          if (typeof refreshPage.reload === "function") {
            await refreshPage.reload().catch(() => null);
          } else if (refreshPage.Page?.reload) {
            await refreshPage.Page.reload({ ignoreCache: true }).catch(
              () => null,
            );
          }
          await waitForCdpLoad(refreshPage).catch(() => null);
          await sleep(5000);
        }
      }
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
  await persistDurableStage(projectDir, sceneId, "prepare_scene", {
    projectName,
    keyframePath: existingDurableState.keyframePath || "",
    motionPromptPath:
      existingDurableState.motionPromptPath ||
      path.join(sceneDir, "motion_prompt.txt"),
  }).catch(() => null);
  const hardTasks = await loadHardPromptTasks();
  const continuityStageText =
    Number(sceneId || 0) > 1
      ? "Use the uploaded previous-scene keyframe image as continuity reference. Do not include future scenes."
      : "Opening scene. No previous-scene reference image required.";
  const task1ImagePrompt = buildImageStagePrompt({
    nv1: hardTasks.task1 || imagePrompt,
    sceneText,
    sceneId,
    continuityText: continuityStageText,
  });
  const task2VideoPrompt = hardTasks.task2 || "";
  const finalImagePrompt = task1ImagePrompt;
  await fs.writeFile(
    path.join(sceneDir, "image_prompt.txt"),
    finalImagePrompt,
    "utf8",
  );
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
  if (motionPrompt)
    await fs.writeFile(existingMotionPromptPath, motionPrompt, "utf8");

  const videoProvider = normalizeVideoProvider(options.videoProvider);
  const videoAccount =
    videoProvider === "grok" ? options.videoAccount || "" : "";
  const requestedRouterEnabled =
    videoProvider === "grok" && Boolean(options.accountRouterEnabled);
  const routerActive = requestedRouterEnabled && videoProvider === "grok";
  const routingPolicy = routerActive
    ? "round_robin"
    : options.routingPolicy || "manual";
  const videoConfig = options.videoConfig || {};
  const continuitySettings = normalizeContinuityReferenceSettings(
    options.continuityReferences || options.continuity || {},
  );
  const continuityReferenceState = await ensureContinuityReferencesForPreviousScene({
    projectDir,
    sceneId,
    settings: continuitySettings,
  });
  if (videoProvider === "grok") grokRouterState.routingPolicy = "round_robin";
  if (
    videoProvider === "grok" &&
    requestedRouterEnabled !== grokRouterState.accountRouterEnabled
  ) {
    await setAccountRouterEnabled(null, requestedRouterEnabled);
  }
  if (routerActive && videoAccount)
    await selectGrokAccount(null, videoAccount).catch(() => null);

  await appendAppLog(null, {
    source: "main",
    kind: "info",
    text: `Scene ${sceneId}: video provider ${videoProvider}`,
    details: {
      videoProvider,
      videoAccount: maskRouterText(videoAccount),
      routingPolicy,
      accountRouterEnabled: routerActive,
    },
  });

  const expectedImagePath = path.join(
    sceneDir,
    `scene_${String(sceneId).padStart(3, "0")}_keyframe.png`,
  );
  let imagePath = isSceneScopedFilePath(options.imagePath || "", sceneId)
    ? options.imagePath
    : "";
  if (imagePath && !(await pathExists(imagePath))) imagePath = "";
  if (
    !imagePath &&
    !options.forceRegenerateImage &&
    (await pathExists(expectedImagePath))
  ) {
    imagePath = expectedImagePath;
    options.__nv1Succeeded = true;
    await persistDurableStage(projectDir, sceneId, "nv1_image_validated", {
      keyframePath: imagePath,
      lastError: "",
    }).catch(() => null);
  }

  if (!imagePath) {
    assertPipelineRunActive(runId);
    if (imageProvider?.method !== "api") {
      options.__chatGptBrowserActionExecuted = true;
    }

    let beforeAssistantCount = existingDurableState.beforeAssistantCount;
    if (beforeAssistantCount === undefined || beforeAssistantCount === null) {
      if (imageProvider?.method !== "api") {
        const page = await getCdpPage("chatgpt", true).catch(() => null);
        if (page) {
          const counts = await evaluateOnCdpPage(
            page,
            `(${countChatGptAssistantRootsScript.toString()})()`,
          ).catch(() => ({ count: 0 }));
          beforeAssistantCount = counts.count;
        }
      }
      if (beforeAssistantCount === undefined || beforeAssistantCount === null) {
        beforeAssistantCount = 0;
      }
      await writePipelineSceneState(projectDir, sceneId, { beforeAssistantCount }).catch(() => null);
    }

    // Try adopting existing scene image from chat history before starting NV1 requests
    if (imageProvider?.method !== "api") {
      const page = await getCdpPage("chatgpt", true).catch(() => null);
      if (page) {
        const adoptRes = await adoptExistingSceneImage(page, beforeAssistantCount, sceneId).catch(() => null);
        if (adoptRes?.ok && adoptRes.base64) {
          const sourceBuffer = Buffer.from(adoptRes.base64, "base64");
          const decoded = decodeImageBufferToPng(sourceBuffer, adoptRes.contentType);
          await fs.mkdir(path.dirname(expectedImagePath), { recursive: true });
          await fs.writeFile(expectedImagePath, decoded.buffer);
          await validateSavedImageFile(expectedImagePath);
          
          imagePath = expectedImagePath;
          options.__nv1Succeeded = true;
          await persistDurableStage(projectDir, sceneId, "nv1_image_validated", {
            keyframePath: imagePath,
            chatGptConversationUrl: existingDurableState.chatGptConversationUrl || "",
          }).catch(() => null);
          
          await appendAppLog(null, {
            source: "main",
            kind: "ok",
            text: `Scene ${sceneId}: Adopted existing completed image from chat successfully before NV1. Skipping generate.`,
          });
        }
      }
    }

    if (!imagePath) {
      console.log(`[PIPELINE][Scene ${sceneId}] START NV1 ChatGPT image`);
      await persistDurableStage(projectDir, sceneId, "nv1_prepare", {
        keyframePath: expectedImagePath,
      }).catch(() => null);
      await persistDurableStage(projectDir, sceneId, "nv1_sent", {
        keyframePath: expectedImagePath,
      }).catch(() => null);
      await persistDurableStage(projectDir, sceneId, "nv1_waiting_image", {
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
              imagePrompt: finalImagePrompt,
              sceneDir,
              sceneId,
              referenceImagePaths,
              options: {
                ...options,
                beforeAssistantCount,
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
      options.__nv2Succeeded = true;
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: `Scene ${sceneId}: dùng motion_prompt.txt có sẵn, không gửi ChatGPT NV2.`,
      });
    }
  }

  if (!motionPrompt?.trim()) {
    assertPipelineRunActive(runId);
    if (!imagePath || !(await pathExists(imagePath)))
      throw new Error(
        `Scene ${sceneId}: missing validated image before MOTION_STAGE.`,
      );
    const imageValidation = await validateContinuityReferenceImage(imagePath).catch((error) => ({ ok: false, error: error.message }));
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
      text: `Scene ${sceneId}: Reading NV2_MOTION_PROMPT.txt.`,
      details: { nv2Chars: String(task2VideoPrompt || "").length },
    });
    options.__chatGptBrowserActionExecuted = true;
    console.log(`[PIPELINE][Scene ${sceneId}] START NV2 ChatGPT motion prompt`);
    await persistDurableStage(projectDir, sceneId, "nv2_prepare", {
      keyframePath: imagePath,
      motionPromptPath: existingMotionPromptPath,
    }).catch(() => null);
    motionPrompt = await generateMotionPromptWithChatGPT({
      imagePath,
      prompt: task2VideoPrompt,
      sceneDir,
      sceneId,
      sceneText,
      chatContextTitle: "",
    });
    assertPipelineRunActive(runId);
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
    await persistDurableStage(projectDir, sceneId, "keyframe_motion_complete", {
      ok: true,
      keyframeMotionPromptOnly: true,
      keyframePath: imagePath,
      motionPromptPath: existingMotionPromptPath,
      videoPath: "",
      videoValidated: false,
      completionStatus: "keyframe_motion_complete",
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
      imageDataUrl: imagePath
        ? await imageFileToDataUrl(imagePath).catch(() => "")
        : "",
      imagePromptUsed: finalImagePrompt,
      motionPrompt,
      motionPromptPath: existingMotionPromptPath,
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
      imageDataUrl: imagePath
        ? await imageFileToDataUrl(imagePath).catch(() => "")
        : "",
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
    accountId: grokRouterState.selectedAccountId,
    profileRef: "grok-web-session",
    currentStatus: "before_generation",
  };
  if (routerActive) await writeGrokRouterCheckpoint(sceneDir, checkpointFields);

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
        sceneId,
        sceneDir,
        phase: "video",
        imagePath,
        imageDataUrl: imagePath
          ? await imageFileToDataUrl(imagePath).catch(() => "")
          : "",
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
      imageDataUrl: imagePath
        ? await imageFileToDataUrl(imagePath).catch(() => "")
        : "",
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
    if (routerActive)
      await writeGrokRouterCheckpoint(sceneDir, {
        ...checkpointFields,
        currentStatus: "completed",
      });
  } catch (error) {
    videoError = maskRouterText(error.stack || error.message || String(error));
    const videoErrorFile =
      videoProvider === "grok"
        ? "grok_video_error.txt"
        : `${videoProvider}_video_error.txt`;
    await fs.writeFile(path.join(sceneDir, videoErrorFile), videoError, "utf8");
    if (routerActive) {
      const classification = classifyGrokRouterError(error);
      const safeMessage =
        classification === "account_limit"
          ? `Scene ${sceneId}: Grok account reached a quota/plan limit. Generation is paused; select another authorized account or resolve quota before resume.`
          : classification === "login_required"
            ? `Scene ${sceneId}: Grok login is required. Generation is paused until the selected account is reconnected.`
            : classification === "canvas_limit"
              ? `Scene ${sceneId}: Grok canvas limit was detected. Same account is preserved; retry/resume can recreate canvas context.`
              : classification === "network_error"
                ? `Scene ${sceneId}: Network/timeout issue detected. Generation is paused with checkpoint preserved.`
                : `Scene ${sceneId}: Unknown Grok router error. Generation is paused with checkpoint preserved.`;
      await pauseGrokRouterForError(
        sceneDir,
        classification,
        safeMessage,
        checkpointFields,
      );
    }
    await appendAppLog(null, {
      source: "main",
      kind: "error",
      text: `Scene ${sceneId}: lỗi tạo video ${videoProvider}: ${maskRouterText(error.message || error)}`,
      details: {
        imagePath: path.basename(imagePath),
        routerClassification: routerActive
          ? grokRouterState.lastErrorClassification
          : "",
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
    imageDataUrl: imagePath
      ? await imageFileToDataUrl(imagePath).catch(() => "")
      : "",
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
    router: routerActive ? getGrokRouterStatus() : null,
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
  return 'Use the attached reference images from the previous video to preserve character identity, outfit, environment, lighting, camera continuity, and visual style. The last-frame reference is the strongest continuity anchor. Generate the new keyframe for the next scene based on the current scene description while keeping continuity with the references. Use them as continuity references only, not exact copies.';
}

function appendContinuityGuidanceToMotionPrompt(prompt = '', continuityRefs = {}, settings = {}) {
  const normalized = normalizeContinuityReferenceSettings(settings);
  const refs = (continuityRefs?.paths || []).filter(Boolean).slice(0, 4);
  if (!normalized.enabled || !refs.length) return prompt;
  const guidance = [
    'CONTINUITY REFERENCES:',
    `Use the previous video reference frames available for this scene (source scene ${continuityRefs.sourceSceneId || 'previous'}; ${refs.length} frame(s)). Keep character identity, outfit, environment, lighting, camera direction, and motion continuity consistent. Treat the last frame as the strongest handoff anchor. Do not copy artifacts or frozen poses exactly.`,
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
    imageDataUrl: imagePath ? await imageFileToDataUrl(imagePath).catch(() => '') : '',
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
  buildVeoUpPromptsReadyFile,
  isVeoUpStageError,
  readPipelineSceneState,
  writePipelineSceneState,
  persistDurableStage,
  assertDurableSceneSuccess,
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
