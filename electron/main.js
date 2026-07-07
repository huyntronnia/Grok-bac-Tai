const {
  execFileSync,
  spawn } = require("child_process");

const {
  __vidoraCompactConsoleArg,
  appendAppLog,
  getAppLogPath,
  writeCrashLog,
  vidoraTraceExit,
  vidoraCompactLogDetails,
  vidoraShouldThrottleLog,
  sanitizeLogString,
  sanitizeLogValue,
  sanitizeIpcValue,
  safeIpcHandler,
  maskRouterText,
  SECRET_KEY_PATTERN,
  SECRET_VALUE_PATTERN,
  EMAIL_PATTERN,
  LOG_URL_PATTERN,
  APP_LOG_FILE,
  } = require("./main/logging");

const {
  sanitizeFileName,
  pathExists,
  getFileStat,
  getFfmpegBinaryPath,
  ensureProjectFilePath,
  hasFullPrivateEmail,
  getUserPromptDir,
  getHardPromptConfigPath,
  HARD_PROMPT_FILENAME,
  } = require("./main/utils");

const {
  getCdpPageMemoryMetrics,
  logMemoryMilestone,
  } = require("./main/memory");

const {
  getPipelineStateFile,
  hashChatGptSnapshotText,
  normalizeChatTitleValue,
  normalizeChatGptPromptCompareText,
  getChatGptConversationIdFromPath,
  isSameChatTitle,
  verifyDraftOwnership,
  writeSceneSnapshot,
  readSceneSnapshot,
  writeActionJournal,
  readActionJournal,
  isChatGptActivelyGenerating,
  sanitizeChatGptImageSnapshot,
  isNv2SnapshotGenerationActive,
  extractCompletedNv2ResponseFromSnapshot,
  selectLatestCompletedAssistantMessage,
  selectNewAssistantMessageAfterBaseline,
  looksLikeCollapsedUserPrompt,
  isChatGptLimitText,
  isChatGptDotLoadingCanvasAsset,
  } = require("./main/state");

const {
  detectLoginScript,
  countAssistantMessagesScript,
  detectBrowserCrashPageScript,
  dismissChatGptBlockingUiScript,
  detectChatGptResponseChoiceUiScript,
  detectChatGptActiveGenerationScript,
  detectChatGptActiveGenerationScriptStrict,
  getComposerTextScript,
  getActiveComposerTextScript,
  inspectNv2ComposerSubmitStateScript,
  countChatGptAssistantRootsScript,
  getConversationStateScript,
  clickChatGptStopGeneratingScript,
  readChatGptImageStateScript,
  getChatGptSendState,
  getConversationState,
  waitForCdpLoad,
  evaluateOnCdpPage,
  clickUploadButtonScript,
  detectUploadedAssetScript,
  initChatGptUpload,
  verifyAttachmentsReady,
  uploadFilesToChatGptSequentially,
  uploadFileToChatGptDirectly,
  focusPromptInputScript,
  setPromptInputValueScript,
  deepFocusNv2ComposerScript,
  clearNv2ComposerScript,
  dispatchNv2ComposerInputEventsScript,
  forceSubmitChatGptComposerScript,
  inspectAndClickChatGptSendButton,
  inspectAndClickChatGptSendButtonSafely,
  clickSendButtonScript,
  sendPromptScript,
  isLikelyChatGptSendButtonText,
  clickSendButtonViaCdp,
  forceClickChatGptComposerSubmit,
  waitForHeavyChatGptPromptDomCooldown,
  runChatGptRobustSendLadder,
  forceSubmitChatGptComposerWithCdp,
  sendPromptViaCdpInput,
  waitForChatGptComposerIdle,
  waitForPromptSendAcknowledged,
  sendPromptViaCdpInputSingle,
  focusNv2ComposerWithCdp,
  waitForNv2GenerationStartGuard,
  sendNv2PromptViaDeepCdpInput,
  vidoraReadChatGptComposerStateReal,
  vidoraClickChatGptRealSendButton,
  vidoraChatGptInputGate,
  vidoraClearChatGptInputBeforePaste
} = require("./main/chatgpt");

const {
  maybeResetChatGptPageForLongRun,
  maybeRotateChatGptConversation,
  getDurablePipelineBackoffMs,
  normalizeChatGptRetryText,
  isRetryableChatGptToolErrorText,
  isChatGptPolicyRefusalText,
  normalizeGrokResultRetryLimit,
  makeRetryableGrokGenerationError,
  isRetryableGrokGenerationError,
  shouldRecoverFromCacheOrChallenge,
} = require("./main/recovery");

const {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  nativeImage,
  Menu,
  shell,
  safeStorage,
  globalShortcut,
} = require("electron");
const CDP = require("chrome-remote-interface");
const ffmpegPath = require("ffmpeg-static");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { AsyncLocalStorage } = require('async_hooks');
const {
  executeVeoUpAutomation,
  findVeoupExecutable,
  startCoordinateSetup,
  captureVeoUpCoordinate,
  getVeoUpCoordinateConfig,
  saveVeoUpCoordinateConfig,
  deleteVeoUpCoordinateConfig,
  cancelCoordinateSetup,
  scanProjectAndRunVeoUp,
} = require("./veoupAutomation");

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
  shouldRotateConversation,
} = require("./chatgptStability");

async function logChatGptStage(client, stage, context = {}, extra = {}) {
  const state = client
    ? await vidoraReadChatGptComposerStateReal(client, context).catch(
        () => ({}),
      )
    : {};
  const stageLog = buildChatGptStageLog({
    sceneId: context.sceneId || "",
    stage,
    attempt: context.attempt || 1,
    state: { ...state, ...extra.state },
    recoveryAction: extra.reason || extra.recoveryAction || "",
  });

  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `ChatGPT Stage: ${stage} for scene ${context.sceneId || ""}`,
    details: stageLog,
  }).catch(() => null);
}

globalThis.chatGptSendStates = new Map();

function setChatGptSendState(sceneId, state) {
  const key = sceneId ? String(sceneId) : "unknown";
  globalThis.chatGptSendStates.set(key, state);
}

const chatGptRuntime = {
  setChatGptSendState,
};

initChatGptUpload(chatGptRuntime);
initChatGptSend(chatGptRuntime);

const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".mkv",
  ".webm",
  ".avi",
  ".m4v",
]);
const TEMP_VIDEO_EXTENSIONS = new Set([
  ".crdownload",
  ".part",
  ".tmp",
  ".download",
  ".downloading",
]);
const webWindows = new Map();
const PROVIDER_META = {
  chatgpt: {
    url: "https://chatgpt.com/",
    title: "ChatGPT",
    partition: "chatgpt-web-session",
  },
  grok: {
    url: "https://grok.com/",
    title: "Grok",
    partition: "grok-web-session",
  },
  pixverse: {
    url: "https://app.pixverse.ai/",
    title: "PixVerse",
    partition: "pixverse-web-session",
  },
};
const WEB_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const CHROME_DEBUG_PORT = 9223;
const CHROME_CDP_HOST = `http://127.0.0.1:${CHROME_DEBUG_PORT}`;
const CHROME_USER_DATA_DIR = path.join(
  app.getPath("userData"),
  "chrome-cdp-profile",
);
const CHALLENGE_RECOVERY_LIMIT = 2;
const GROK_IMAGINE_AGENT_URL = "https://grok.com/imagine";
const CHAT_TITLE_CHECK_MIN_INTERVAL_MS = 45000;
const GROK_SEND_RETRY_LIMIT = 2;

const pipelineRunScope = new AsyncLocalStorage();
const pipelineCancellation = {
  cancelledRunIds: new Set(),
  activeRunIds: new Set(),
  waiters: new Map(),
  childProcesses: new Map(),
};

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



const CHATGPT_UI_RECOVERY_SEND_RETRY_LIMIT = 18;
const challengeRecoveryAttempts = new Map();
const motionPromptSendLocks = new Map();
const chatGptScenePrefetchLocks = new Map();
const scenePipelineLocks = new Map();
let chromeProcess = null;
let showPipelineLog = true;
const chatTitleStableChecks = new Map();
const chatGptConversationIdentityCache = {
  conversationId: "",
  path: "",
  title: "",
  verifiedAt: 0,
  lastCheckAt: 0,
  invalidatedAt: 0,
  forceAfterInvalidation: false,
};

const chatGptConversationHealth = {
  conversationIndex: 0,
  conversationStartedAt: Date.now(),
  lastResetAt: 0,
  lastResetReason: "",
};

let sessionSceneCounter = 0;
let isChatGptContextFresh = true;
let activeConversationUrl = null;
let currentThreadId = null;
app.setPath("userData", path.join(app.getPath("appData"), "vidora"));
const GROK_ROUTER_CHECKPOINT_FILE = path.join(
  app.getPath("userData"),
  "grok-router-checkpoint.json",
);
const WEB_ACCOUNT_STORE_FILE = path.join(
  app.getPath("userData"),
  "web-provider-accounts.secure.json",
);
const HARD_PROMPT_FILE_NAME = HARD_PROMPT_FILENAME;
const HARD_PROMPT_DEFAULT_CONTENT = [
  "NHIỆM VỤ 1:",
  "Viết prompt tạo ảnh keyframe đầu scene dựa trên kịch bản, continuity, bối cảnh và yêu cầu hình ảnh của Vidora.",
  "",
  "NHIỆM VỤ 2:",
  "Viết motion prompt video dựa trên keyframe đã tạo, giữ đúng hành động scene, không thêm chi tiết ngoài khung hình.",
].join("\n");
const GROK_ROUTER_ALLOWED_STATES = new Set([
  "available",
  "active",
  "cooldown",
  "limited",
  "login_required",
  "invalid",
  "disabled_by_user",
]);

const GROKPROJ_SCHEMA_VERSION = 1;

function loginRequiredMessage(provider, detail = "") {
  const normalized = normalizeWebProvider(provider);
  const title = PROVIDER_META[normalized]?.title || normalized;
  return `LOGIN_REQUIRED:${normalized}: ${title} chưa đăng nhập hoặc session đã hết hạn. Hãy đăng nhập lại trong tab ${title}${detail ? `. Chi tiết: ${detail}` : ""}`;
}


function sanitizeProjectValue(value) {
  if (Array.isArray(value))
    return value.map((item) => sanitizeProjectValue(item));
  if (value && typeof value === "object") {
    const clean = {};
    for (const [key, child] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key)) continue;
      clean[key] = sanitizeProjectValue(child);
    }
    return clean;
  }
  if (typeof value === "string")
    return value.replace(EMAIL_PATTERN, (email) =>
      /^\*+@|\*{2,}/.test(email) ? email : maskRouterText(email),
    );
  return value;
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

function assertNoProjectSecrets(value, keyPath = []) {
  if (Array.isArray(value))
    return value.forEach((item, index) =>
      assertNoProjectSecrets(item, keyPath.concat(String(index))),
    );
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key))
        throw new Error(
          `Project payload contains disallowed secret field: ${keyPath.concat(key).join(".")}`,
        );
      assertNoProjectSecrets(child, keyPath.concat(key));
    }
    return;
  }
  if (typeof value === "string") {
    if (SECRET_VALUE_PATTERN.test(value))
      throw new Error(
        `Project payload contains secret-like value at: ${keyPath.join(".") || "root"}`,
      );
    if (hasFullPrivateEmail(value))
      throw new Error("Project payload contains a full private email address.");
  }
}

function assertObjectField(payload, key) {
  if (
    !payload[key] ||
    typeof payload[key] !== "object" ||
    Array.isArray(payload[key])
  ) {
    throw new Error(`Invalid .grokproj: ${key} is required.`);
  }
}

function validateProjectPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("Invalid .grokproj: root payload must be an object.");
  if (typeof payload.schemaVersion !== "number")
    throw new Error("Invalid .grokproj: schemaVersion is required.");
  if (payload.schemaVersion > GROKPROJ_SCHEMA_VERSION)
    throw new Error(
      `Unsupported future .grokproj schemaVersion ${payload.schemaVersion}. App supports ${GROKPROJ_SCHEMA_VERSION}.`,
    );
  if (payload.schemaVersion !== GROKPROJ_SCHEMA_VERSION)
    throw new Error(
      `Unsupported .grokproj schemaVersion ${payload.schemaVersion}. App supports ${GROKPROJ_SCHEMA_VERSION}.`,
    );
  if (!payload.project || typeof payload.project !== "object")
    throw new Error("Invalid .grokproj: project is required.");
  if (!Array.isArray(payload.project.scenes))
    throw new Error("Invalid .grokproj: project.scenes[] is required.");
  ["inputs", "config", "router", "assets"].forEach((key) =>
    assertObjectField(payload, key),
  );
  if (!Array.isArray(payload.previewTimeline))
    throw new Error("Invalid .grokproj: previewTimeline[] is required.");
  if (!payload.runtime || typeof payload.runtime !== "object")
    throw new Error("Invalid .grokproj: runtime is required.");
  assertNoProjectSecrets(payload);
  return payload;
}

function resolveProjectPrepromptFolder(projectRoot = "") {
  if (!projectRoot) return "";
  return path.join(projectRoot, 'preprompt');
}

async function ensureProjectPrepromptFolder(
  projectRoot = "",
  { logCreated = false } = {},
) {
  const charactersFolderPath = resolveProjectPrepromptFolder(projectRoot);
  if (!charactersFolderPath) {
    throw new Error("Hay tao hoac mo project truoc khi mo thu muc preprompt.");
  }
  await fs.mkdir(charactersFolderPath, { recursive: true });
  if (logCreated) {
    console.log(`Created project preprompt folder: ${charactersFolderPath}`);
  }
  return charactersFolderPath;
}

async function importCharacterPresetsHandler(_event, projectPath) {
  if (!projectPath) {
    throw new Error("Hay tao hoac mo project truoc khi mo thu muc preprompt.");
  }

  const charactersFolderPath = await ensureProjectPrepromptFolder(projectPath);
  const openError = await shell.openPath(charactersFolderPath);
  if (openError) {
    throw new Error(openError);
  }

  console.log(`Opened project preprompt folder: ${charactersFolderPath}`);
  await appendAppLog(null, {
    source: "main",
    kind: "ok",
    text: `Opened project preprompt folder: ${charactersFolderPath}`,
    details: { charactersFolderPath },
  }).catch(() => null);

  return { ok: true, charactersFolderPath };
}

async function newProjectSession(event, options = {}) {
  if (options?.hasUnsavedChanges) {
    const messageOptions = {
      type: "question",
      title: "Unsaved Project",
      message: "Current project has unsaved changes.",
      detail: `Save before ${options.actionLabel || "continuing"}?`,
      buttons: ["Save", "Discard", "Cancel"],
      defaultId: 0,
      cancelId: 2,
    };
    const window = event?.sender
      ? BrowserWindow.fromWebContents(event.sender)
      : null;
    const result = window
      ? await dialog.showMessageBox(window, messageOptions)
      : await dialog.showMessageBox(messageOptions);
    return {
      ok: true,
      action: ["save", "discard", "cancel"][result.response] || "cancel",
    };
  }
  return {
    ok: true,
    schemaVersion: GROKPROJ_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
  };
}

async function saveProjectSessionFile(_event, payload = {}) {
  const embeddedPayload = await embedProjectAssets(payload);
  const safePayload = validateProjectPayload(
    sanitizeProjectValue(embeddedPayload),
  );
  const safeName = sanitizeFileName(
    safePayload.project?.name || "vidora-project",
  );
  const result = await dialog.showSaveDialog({
    title: "Save Vidora Project",
    defaultPath: `${safeName}.vdra`,
    filters: [{ name: "Vidora Project", extensions: ["vdra"] }],
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  const filePath = ensureProjectFilePath(
    result.filePath.toLowerCase().endsWith(".vdra")
      ? result.filePath
      : `${result.filePath}.vdra`,
  );
  const projectFolder = path.join(
    path.dirname(filePath),
    sanitizeFileName(
      path.basename(filePath, path.extname(filePath)) || safeName,
    ),
  );
  safePayload.runtime = {
    ...(safePayload.runtime || {}),
    outputFolder: projectFolder,
  };
  const finalPayload = validateProjectPayload(
    sanitizeProjectValue(safePayload),
  );
  await fs.mkdir(projectFolder, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(finalPayload, null, 2), "utf8");
  await ensureProjectPrepromptFolder(projectFolder);
  return { ok: true, filePath, projectFolder, payload: finalPayload };
}

async function overwriteProjectSessionFile(
  _event,
  { filePath = "", payload = {} } = {},
) {
  if (!filePath) return { ok: false, error: "Missing project file path." };
  const embeddedPayload = await embedProjectAssets(payload);
  const safePayload = validateProjectPayload(
    sanitizeProjectValue(embeddedPayload),
  );
  const targetPath = ensureProjectFilePath(
    filePath.toLowerCase().endsWith(".vdra") ? filePath : `${filePath}.vdra`,
  );
  const projectFolder = path.join(
    path.dirname(targetPath),
    sanitizeFileName(
      path.basename(targetPath, path.extname(targetPath)) ||
        safePayload.project?.name ||
        "vidora-project",
    ),
  );
  safePayload.runtime = {
    ...(safePayload.runtime || {}),
    outputFolder: projectFolder,
  };
  const finalPayload = validateProjectPayload(
    sanitizeProjectValue(safePayload),
  );
  await fs.mkdir(projectFolder, { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(finalPayload, null, 2), "utf8");
  await ensureProjectPrepromptFolder(projectFolder);
  return {
    ok: true,
    filePath: targetPath,
    projectFolder,
    payload: finalPayload,
  };
}

async function createProjectSessionFile(
  _event,
  { folderPath = "", projectName = "", payload = {} } = {},
) {
  if (!folderPath) return { ok: false, error: "Missing output folder." };
  const safePayload = sanitizeProjectValue(payload);
  const safeName = sanitizeFileName(
    projectName || safePayload.project?.name || "ai-scene-project",
  );
  const projectFolder = path.join(folderPath, safeName);
  safePayload.runtime = {
    ...(safePayload.runtime || {}),
    outputFolder: projectFolder,
  };
  const validPayload = validateProjectPayload(safePayload);
  const filePath = ensureProjectFilePath(
    path.join(folderPath, `${safeName}.vdra`),
  );
  await fs.mkdir(projectFolder, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(validPayload, null, 2), "utf8");
  await ensureProjectPrepromptFolder(projectFolder, { logCreated: true });
  return { ok: true, filePath, projectFolder, payload: validPayload };
}

async function openProjectSessionFile() {
  const result = await dialog.showOpenDialog({
    title: "Open Vidora Project",
    properties: ["openFile"],
    filters: [
      { name: "Vidora Project", extensions: ["vdra"] },
      { name: "Legacy Grok Project", extensions: ["grokproj"] },
    ],
  });
  if (result.canceled || !result.filePaths?.[0])
    return { ok: false, canceled: true };
  const filePath = result.filePaths[0];
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (_error) {
    throw new Error("Invalid .vdra: file is not valid JSON.");
  }
  const projectFolderName = sanitizeFileName(
    path.basename(filePath, path.extname(filePath)) ||
      parsed?.project?.name ||
      "ai-scene-project",
  );
  const projectFolder = path.join(path.dirname(filePath), projectFolderName);
  parsed.runtime = { ...(parsed.runtime || {}), outputFolder: projectFolder };
  await fs.mkdir(projectFolder, { recursive: true });
  await ensureProjectPrepromptFolder(projectFolder);
  await restoreEmbeddedProjectAssets(parsed, projectFolder);
  await mergePipelineSceneStateIntoProjectPayload(parsed, projectFolder);
  const payload = validateProjectPayload(sanitizeProjectValue(parsed));
  payload.runtime = {
    ...payload.runtime,
    outputFolder: projectFolder,
    autoRun: false,
    waitingForUserStart: true,
    active: false,
  };
  return { ok: true, filePath, projectFolder, payload };
}

async function mergePipelineSceneStateIntoProjectPayload(
  payload = {},
  projectFolder = "",
) {
  const stateFile = path.join(projectFolder, "pipeline_state.json");
  const raw = await fs.readFile(stateFile, "utf8").catch(() => "");
  if (!raw) return payload;
  let state = {};
  try {
    state = JSON.parse(raw);
  } catch (_error) {
    return payload;
  }
  const scenes = Array.isArray(payload.project?.scenes)
    ? payload.project.scenes
    : [];
  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];
    const keyCandidates = [
      String(scene?.id || ""),
      String(scene?.sceneId || ""),
      String(index + 1),
    ].filter(Boolean);
    const saved = keyCandidates
      .map((key) => state[key])
      .find((item) => item && typeof item === "object");
    if (!saved) continue;
    if (saved.videoPath) scene.videoPath = saved.videoPath;
    if (saved.lastFramePath) scene.lastFramePath = saved.lastFramePath;
    if (saved.sourceVideoPath) scene.sourceVideoPath = saved.sourceVideoPath;
    if (saved.videoValidated === true) scene.videoValidated = true;
    if (saved.completionStatus) scene.completionStatus = saved.completionStatus;
    if (saved.videoValidated === true && saved.videoPath) {
      scene.status = "video_done";
      scene.progressStep = "merge";
      scene.reviewType = "";
    }
  }
  payload.runtime = {
    ...(payload.runtime || {}),
    pipelineSceneStateMerged: true,
  };
  return payload;
}

async function embedProjectAssets(payload = {}) {
  const cloned = JSON.parse(JSON.stringify(payload || {}));
  const scenes = Array.isArray(cloned.project?.scenes)
    ? cloned.project.scenes
    : [];
  cloned.embeddedAssets = { version: 1, encoding: "base64", scenes: [] };
  for (const scene of scenes) {
    const sceneId = scene.sceneId || scene.id;
    const record = { sceneId, files: {} };
    for (const [kind, key] of [
      ["image", "imagePath"],
      ["video", "videoPath"],
    ]) {
      const filePath = scene[key];
      if (!filePath || !(await pathExists(filePath))) continue;
      const buffer = await fs.readFile(filePath);
      record.files[kind] = {
        fileName: path.basename(filePath),
        relativePath: `scene_${String(sceneId).padStart(3, "0")}/${path.basename(filePath)}`,
        mimeType:
          kind === "video"
            ? "video/mp4"
            : `image/${path.extname(filePath).slice(1).toLowerCase() || "png"}`,
        sizeBytes: buffer.length,
        data: buffer.toString("base64"),
      };
    }
    if (Object.keys(record.files).length)
      cloned.embeddedAssets.scenes.push(record);
  }
  return cloned;
}

async function restoreEmbeddedProjectAssets(payload = {}, projectFolder = "") {
  const records = Array.isArray(payload.embeddedAssets?.scenes)
    ? payload.embeddedAssets.scenes
    : [];
  if (!records.length || !projectFolder) return;
  const scenes = Array.isArray(payload.project?.scenes)
    ? payload.project.scenes
    : [];
  for (const record of records) {
    const scene = scenes.find(
      (item) =>
        String(item.id) === String(record.sceneId) ||
        String(item.sceneId) === String(record.sceneId),
    );
    if (!scene) continue;
    const sceneDir = path.join(
      projectFolder,
      `scene_${String(record.sceneId).padStart(3, "0")}`,
    );
    await fs.mkdir(sceneDir, { recursive: true });
    for (const [kind, file] of Object.entries(record.files || {})) {
      if (!file?.data || !file?.fileName) continue;
      const targetPath = path.join(sceneDir, sanitizeFileName(file.fileName));
      if (!(await pathExists(targetPath)))
        await fs.writeFile(targetPath, Buffer.from(file.data, "base64"));
      if (kind === "image") scene.imagePath = targetPath;
      if (kind === "video") scene.videoPath = targetPath;
    }
  }
}

async function ensureProjectSceneFolders(
  _event,
  { outputFolder = "", scenes = [] } = {},
) {
  if (!outputFolder) return { ok: false, error: "Missing output folder." };
  await fs.mkdir(outputFolder, { recursive: true });
  const records = [];
  for (const scene of Array.isArray(scenes) ? scenes : []) {
    const sceneId = scene?.id || scene?.sceneId || records.length + 1;
    const sceneDir = path.join(
      outputFolder,
      `scene_${String(sceneId).padStart(3, "0")}`,
    );
    await fs.mkdir(sceneDir, { recursive: true });
    if (scene?.original || scene?.rawSceneText)
      await fs.writeFile(
        path.join(sceneDir, "scene.txt"),
        scene.original || scene.rawSceneText || "",
        "utf8",
      );
    if (scene?.imagePrompt)
      await fs.writeFile(
        path.join(sceneDir, "image_prompt.txt"),
        scene.imagePrompt,
        "utf8",
      );
    if (scene?.motionPrompt)
      await fs.writeFile(
        path.join(sceneDir, "motion_prompt.txt"),
        scene.motionPrompt,
        "utf8",
      );
    const keyframePath = path.join(
      sceneDir,
      `scene_${String(sceneId).padStart(3, "0")}_keyframe.png`,
    );
    const videoPath = path.join(
      sceneDir,
      `scene_${String(sceneId).padStart(3, "0")}_video.mp4`,
    );
    const lastFramePath = path.join(
      sceneDir,
      `scene_${String(sceneId).padStart(3, "0")}_last_frame.png`,
    );
    const files = await fs.readdir(sceneDir).catch(() => []);
    const fallbackImage = files.find((file) =>
      /\.(png|jpe?g|webp)$/i.test(file),
    );
    const fallbackVideo = files.find((file) => /\.(mp4|webm|mov)$/i.test(file));
    const foundKeyframePath = (await pathExists(keyframePath))
      ? keyframePath
      : fallbackImage
        ? path.join(sceneDir, fallbackImage)
        : keyframePath;
    const foundVideoPath = (await pathExists(videoPath))
      ? videoPath
      : fallbackVideo
        ? path.join(sceneDir, fallbackVideo)
        : videoPath;
    const keyframeStat = await fs.stat(foundKeyframePath).catch(() => null);
    const videoStat = await fs.stat(foundVideoPath).catch(() => null);
    const lastFrameStat = await fs.stat(lastFramePath).catch(() => null);
    records.push({
      sceneId,
      sceneDir,
      keyframePath: foundKeyframePath,
      keyframeExists: Boolean(keyframeStat?.isFile?.()),
      keyframeMtimeMs: keyframeStat?.mtimeMs || 0,
      videoPath: foundVideoPath,
      videoExists: Boolean(videoStat?.isFile?.()),
      videoMtimeMs: videoStat?.mtimeMs || 0,
      lastFramePath,
      lastFrameExists: Boolean(lastFrameStat?.isFile?.()),
      lastFrameMtimeMs: lastFrameStat?.mtimeMs || 0,
    });
  }
  return { ok: true, outputFolder, records };
}

const grokRouterState = {
  accountRouterEnabled: false,
  routingPolicy: "round_robin",
  paused: false,
  pauseReason: "",
  lastErrorClassification: "",
  lastSafeMessage: "",
  selectedAccountId: "grok-default-profile",
  accounts: [
    {
      accountId: "grok-default-profile",
      label: "Grok default profile",
      maskedEmail: "gr***@masked.local",
      state: "active",
      profileRef: "grok-web-session",
      canvasRef: "",
    },
  ],
  checkpoint: null,
};

function normalizeCredentialProvider(provider) {
  return provider === "grok" ? "grok" : "chatgpt";
}

function maskEmail(email = "") {
  const value = String(email || "").trim();
  const [name, domain] = value.split("@");
  if (!name || !domain) return value ? "***" : "";
  return `${name.slice(0, 2)}***@${domain}`;
}

function ensureCredentialEncryptionAvailable() {
  if (!safeStorage?.isEncryptionAvailable?.()) {
    throw new Error(
      "Máy này chưa có Electron safeStorage khả dụng; không lưu account nếu không mã hóa được.",
    );
  }
}

async function readWebAccountStore({ includeSecrets = false } = {}) {
  if (!(await pathExists(WEB_ACCOUNT_STORE_FILE)))
    return { version: 1, accounts: [] };
  ensureCredentialEncryptionAvailable();
  const raw = JSON.parse(await fs.readFile(WEB_ACCOUNT_STORE_FILE, "utf8"));
  const encrypted = Buffer.from(String(raw.data || ""), "base64");
  const payload = JSON.parse(safeStorage.decryptString(encrypted) || "{}");
  const accounts = Array.isArray(payload.accounts) ? payload.accounts : [];
  return {
    version: 1,
    accounts: accounts.map((account) =>
      includeSecrets
        ? account
        : {
            id: account.id,
            provider: normalizeCredentialProvider(account.provider),
            label: account.label || "",
            email: account.email || "",
            state: account.state || "available",
            selected: Boolean(account.selected),
            lastUsedAt: account.lastUsedAt || "",
            updatedAt: account.updatedAt || "",
          },
    ),
  };
}

async function writeWebAccountStore(store = {}) {
  ensureCredentialEncryptionAvailable();
  const payload = {
    version: 1,
    accounts: Array.isArray(store.accounts) ? store.accounts : [],
  };
  const encrypted = safeStorage.encryptString(JSON.stringify(payload));
  await fs.mkdir(path.dirname(WEB_ACCOUNT_STORE_FILE), { recursive: true });
  await fs.writeFile(
    WEB_ACCOUNT_STORE_FILE,
    JSON.stringify(
      { version: 1, encrypted: true, data: encrypted.toString("base64") },
      null,
      2,
    ),
    "utf8",
  );
}

function safeWebAccount(account = {}) {
  return {
    id: account.id,
    provider: normalizeCredentialProvider(account.provider),
    label: maskRouterText(account.label || account.email || ""),
    maskedEmail: maskEmail(account.email || ""),
    state: account.state || "available",
    selected: Boolean(account.selected),
    lastUsedAt: account.lastUsedAt || "",
    updatedAt: account.updatedAt || "",
  };
}

async function listWebAccountsSafe(_event, provider = "") {
  const normalized = provider ? normalizeCredentialProvider(provider) : "";
  const store = await readWebAccountStore();
  const accounts = store.accounts
    .filter(
      (account) =>
        !normalized ||
        normalizeCredentialProvider(account.provider) === normalized,
    )
    .map(safeWebAccount);
  return {
    ok: true,
    encryptionAvailable: Boolean(safeStorage?.isEncryptionAvailable?.()),
    accounts,
  };
}

async function saveWebAccount(_event, input = {}) {
  const provider = normalizeCredentialProvider(input.provider);
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  const password = String(input.password || "");
  const label = String(input.label || "").trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, error: "Email account không hợp lệ." };
  if (!password) return { ok: false, error: "Password không được để trống." };
  const store = await readWebAccountStore({ includeSecrets: true });
  const existing = store.accounts.find(
    (account) =>
      normalizeCredentialProvider(account.provider) === provider &&
      String(account.email || "").toLowerCase() === email,
  );
  const now = new Date().toISOString();
  if (existing) {
    existing.label = label || existing.label || email;
    existing.password = password;
    existing.state = "available";
    existing.updatedAt = now;
  } else {
    store.accounts.push({
      id: crypto.randomUUID(),
      provider,
      label: label || email,
      email,
      password,
      state: "available",
      selected: !store.accounts.some(
        (account) =>
          normalizeCredentialProvider(account.provider) === provider &&
          account.selected,
      ),
      createdAt: now,
      updatedAt: now,
      lastUsedAt: "",
    });
  }
  await writeWebAccountStore(store);
  await appendAppLog(null, {
    source: "main",
    kind: "ok",
    text: `Đã lưu account ${provider}: ${maskEmail(email)} (encrypted safeStorage).`,
  });
  return listWebAccountsSafe(null, provider);
}

async function deleteWebAccount(_event, accountId = "") {
  const id = String(accountId || "").trim();
  const store = await readWebAccountStore({ includeSecrets: true });
  const removed = store.accounts.find((account) => account.id === id);
  store.accounts = store.accounts.filter((account) => account.id !== id);
  if (removed?.selected) {
    const next = store.accounts.find(
      (account) =>
        normalizeCredentialProvider(account.provider) ===
          normalizeCredentialProvider(removed.provider) &&
        !["limited", "login_required", "disabled"].includes(account.state),
    );
    if (next) next.selected = true;
  }
  await writeWebAccountStore(store);
  return listWebAccountsSafe(null, removed?.provider || "");
}

async function markWebAccountState(
  provider = "",
  accountId = "",
  state = "available",
) {
  const normalized = normalizeCredentialProvider(provider);
  const store = await readWebAccountStore({ includeSecrets: true });
  const account =
    store.accounts.find(
      (item) =>
        item.id === accountId &&
        normalizeCredentialProvider(item.provider) === normalized,
    ) ||
    store.accounts.find(
      (item) =>
        item.selected &&
        normalizeCredentialProvider(item.provider) === normalized,
    );
  if (!account) return null;
  account.state = state;
  account.updatedAt = new Date().toISOString();
  await writeWebAccountStore(store);
  return account;
}

async function pickWebAccount(provider = "", { rotate = false } = {}) {
  const normalized = normalizeCredentialProvider(provider);
  const store = await readWebAccountStore({ includeSecrets: true });
  const providerAccounts = store.accounts.filter(
    (account) => normalizeCredentialProvider(account.provider) === normalized,
  );
  if (!providerAccounts.length) return { account: null, store };
  const usable = providerAccounts.filter(
    (account) =>
      !["limited", "login_required", "disabled"].includes(account.state),
  );
  if (!usable.length) return { account: null, store };
  let account = usable.find((item) => item.selected) || usable[0];
  if (rotate && usable.length > 1) {
    const currentIndex = usable.findIndex((item) => item.id === account.id);
    account = usable[(currentIndex + 1) % usable.length];
  }
  providerAccounts.forEach((item) => {
    item.selected = item.id === account.id;
    if (item.selected && item.state !== "limited") item.state = "active";
    else if (item.state === "active") item.state = "available";
  });
  account.lastUsedAt = new Date().toISOString();
  await writeWebAccountStore(store);
  return { account, store };
}

function sanitizeChatTitleForLog(title = "") {
  return maskRouterText(
    String(title || "")
      .replace(/\s+/g, " ")
      .trim(),
  ).slice(0, 120);
}


function isReloadBlocked(sceneId = "unknown") {
  if (globalThis.__vidoraActiveActionLock) {
    return `Blocked reload: Active Action Lock [${globalThis.__vidoraActiveActionLock}] is held.`;
  }
  if (globalThis.__vidoraPendingAction) {
    return `Blocked reload: Pending Action [${globalThis.__vidoraPendingAction}] is active.`;
  }
  const composerState = globalThis.__vidoraLastComposerState || "EMPTY";
  if (composerState === "ATTACHING_FILES" || composerState === "READY_TO_SEND" || composerState === "WAIT_ACCEPT") {
    return `Blocked reload: Composer is in safe state [${composerState}].`;
  }
  const sendState = getChatGptSendState(sceneId);
  if (sendState === "PREPARING" || sendState === "READY" || sendState === "CLICKING" || sendState === "SENDING" || sendState === "ATTACHING") {
    return `Blocked reload: ChatGptSendState is ${sendState}.`;
  }
  return null;
}

async function requestReloadWithReason(page, reason, sceneId = "unknown") {
  await appendAppLog(sceneId, {
    source: "main",
    kind: "warning",
    text: `Scene ${sceneId}: Requesting page reload. Reason: ${reason}`
  }).catch(() => null);

  const blockedReason = isReloadBlocked(sceneId);
  if (blockedReason) {
    await appendAppLog(sceneId, {
      source: "main",
      kind: "warning",
      text: `Scene ${sceneId}: Reload canceled. ${blockedReason}`
    }).catch(() => null);
    return false;
  }

  if (page.reload) {
    await page.reload().catch(() => null);
  } else if (page.Page?.reload) {
    await page.Page.reload({ ignoreCache: true }).catch(() => null);
  }
  return true;
}



async function performDurableRecovery(page, options, sceneDir, snapshot, stage, targetPrompt, targetFiles) {
  const runId = options.runId || "";
  const sceneId = options.sceneId || 0;
  
  let pageState = await getConversationState(page);
  
  await appendAppLog(sceneId, {
    source: "main",
    kind: "running",
    text: `Recovery Check: Stage [${stage}] | Composer ready: ${pageState.composerReady} | Streaming: ${pageState.streaming} | Stop button: ${pageState.stopButtonVisible}`,
    details: {
      pageState: {
        composerHasPrompt: pageState.composerHasPrompt,
        attachmentCount: pageState.attachmentCount,
        composerReady: pageState.composerReady,
        sendButtonVisible: pageState.sendButtonVisible,
        stopButtonVisible: pageState.stopButtonVisible,
        streaming: pageState.streaming,
        placeholderVisible: pageState.placeholderVisible,
        rendererAlive: pageState.rendererAlive,
        rendererOOM: pageState.rendererOOM,
        loggedOut: pageState.loggedOut,
        disconnected: pageState.disconnected,
        currentChatId: pageState.currentChatId
      },
      snapshotStage: snapshot.pipelineStage
    }
  });

  const promptHash = hashChatGptSnapshotText(targetPrompt);
  const composerHasValidDraft = pageState.composerHasPrompt && 
                                pageState.composerPromptHash === promptHash &&
                                verifyAttachmentsReady(targetFiles, pageState);

  if (pageState.streaming || pageState.stopButtonVisible || pageState.placeholderVisible) {
    await appendAppLog(sceneId, {
      source: "main",
      kind: "running",
      text: `Recovery Level 0: ChatGPT is actively generating/processing. Continuing to wait...`
    });
    return { action: "wait", pageState };
  }

  const userMessageMatches = (pageState.latestUserMessageHash === promptHash) ||
    (pageState.latestUserMessageHash && snapshot.promptHash === pageState.latestUserMessageHash);

  if (userMessageMatches) {
    await appendAppLog(sceneId, {
      source: "main",
      kind: "ok",
      text: `Recovery Level 3: Reconciled message. ChatGPT already accepted target prompt. Transitioning...`
    });
    return { action: "mark_sent", pageState };
  }

  if (composerHasValidDraft && pageState.sendButtonVisible) {
    await appendAppLog(sceneId, {
      source: "main",
      kind: "running",
      text: `Recovery Level 2: Composer has valid draft. Clicking Send.`
    });
    const clicked = await clickSendButtonViaCdp(page);
    if (clicked.ok) {
      return { action: "wait", pageState };
    }
  }

  await evaluateOnCdpPage(page, `(${dismissChatGptBlockingUiScript.toString()})()`).catch(() => null);

  let recoveryLevel = snapshot.lastRecoveryLevel || 0;
  recoveryLevel = (recoveryLevel + 1) % 10;
  await writeSceneSnapshot(sceneDir, { lastRecoveryLevel: recoveryLevel });

  if (recoveryLevel <= 1) {
    return { action: "wait", pageState };
  }
  
  if (recoveryLevel === 2) {
    return { action: "restore_composer", pageState };
  }

  if (recoveryLevel === 3) {
    return { action: "wait", pageState };
  }

  if (recoveryLevel === 4) {
    await evaluateOnCdpPage(page, `(${dismissChatGptBlockingUiScript.toString()})()`).catch(() => null);
    return { action: "wait", pageState };
  }

  if (recoveryLevel === 5) {
    await appendAppLog(sceneId, {
      source: "main",
      kind: "warning",
      text: `Recovery Level 5: Reconnecting DevTools/CDP...`
    });
    const reconnectedPage = await getCdpPage("chatgpt", true).catch(() => null);
    if (reconnectedPage) {
      page = reconnectedPage;
    }
    return { action: "wait", pageState };
  }

  if (recoveryLevel === 6) {
    return { action: "restore_composer", pageState };
  }

  if (recoveryLevel === 7) {
    if (composerHasValidDraft) {
      await appendAppLog(sceneId, {
        source: "main",
        kind: "warning",
        text: `Recovery Level 7: Refresh requested, but Golden Rule blocks it because valid composer draft is present. Clicking Send instead.`
      });
      await clickSendButtonViaCdp(page);
      return { action: "wait", pageState };
    }

    if (snapshot.refreshBudget && snapshot.refreshBudget <= 0) {
      await appendAppLog(sceneId, {
        source: "main",
        kind: "warning",
        text: `Recovery Level 7: Refresh budget exhausted. Skipping reload.`
      });
      return { action: "wait", pageState };
    }

    snapshot.refreshBudget = (snapshot.refreshBudget || 1) - 1;
    await writeSceneSnapshot(sceneDir, { refreshBudget: snapshot.refreshBudget });

    const reloadResult = await requestReloadWithReason(page, "recovery_l7", sceneId);
    if (!reloadResult) {
      return { action: "wait", pageState };
    }
    await waitForCdpLoad(page).catch(() => null);
    await sleep(5000);
    return { action: "reread", pageState };
  }

  if (recoveryLevel === 8) {
    if (composerHasValidDraft) {
      await appendAppLog(sceneId, {
        source: "main",
        kind: "warning",
        text: `Recovery Level 8: Rotation requested, but Golden Rule blocks it because valid composer draft is present. Clicking Send instead.`
      });
      await clickSendButtonViaCdp(page);
      return { action: "wait", pageState };
    }

    const rotateAllowed = pageState.rendererOOM || !pageState.rendererAlive || pageState.loggedOut || !pageState.conversationAvailable;
    if (rotateAllowed) {
      if (snapshot.rotationBudget && snapshot.rotationBudget <= 0) {
        await appendAppLog(sceneId, {
          source: "main",
          kind: "warning",
          text: `Recovery Level 8: Rotation budget exhausted.`
        });
        return { action: "wait", pageState };
      }
      await appendAppLog(sceneId, {
        source: "main",
        kind: "warning",
        text: `Recovery Level 8: Rotating chat...`
      });
      snapshot.rotationBudget = (snapshot.rotationBudget || 1) - 1;
      await writeSceneSnapshot(sceneDir, { rotationBudget: snapshot.rotationBudget });
      await forceCleanChatGptNewChatRotation();
      return { action: "rotate", pageState };
    } else {
      await appendAppLog(sceneId, {
        source: "main",
        kind: "warning",
        text: `Recovery Level 8: Chat rotation skipped (chat is not corrupted/OOM).`
      });
      return { action: "wait", pageState };
    }
  }

  if (recoveryLevel === 9) {
    if (composerHasValidDraft) {
      await appendAppLog(sceneId, {
        source: "main",
        kind: "warning",
        text: `Recovery Level 9: Hydration requested, but Golden Rule blocks it because valid composer draft is present. Clicking Send instead.`
      });
      await clickSendButtonViaCdp(page);
      return { action: "wait", pageState };
    }

    if (snapshot.hydrationBudget && snapshot.hydrationBudget <= 0) {
      await appendAppLog(sceneId, {
        source: "main",
        kind: "warning",
        text: `Recovery Level 9: Hydration budget exhausted.`
      });
      return { action: "wait", pageState };
    }
    await appendAppLog(sceneId, {
      source: "main",
      kind: "warning",
      text: `Recovery Level 9: Restarting hydration...`
    });
    snapshot.hydrationBudget = (snapshot.hydrationBudget || 1) - 1;
    await writeSceneSnapshot(sceneDir, { hydrationBudget: snapshot.hydrationBudget });
    return { action: "hydrate", pageState };
  }

  return { action: "wait", pageState };
}

async function checkProactiveMemoryGuard(sceneId, pageState) {
  if (!pageState || !pageState.ok) return;

  let rendererPrivate = 0;
  const activeWin = BrowserWindow.getAllWindows().find((win) => !win.isDestroyed());
  if (activeWin) {
    try {
      const processInfo = await activeWin.webContents.getProcessMemoryInfo().catch(() => null);
      if (processInfo) {
        rendererPrivate = processInfo.privateBytes || 0;
      }
    } catch (_err) {}
  }

  const memoryGB = rendererPrivate / 1024 / 1024 / 1024;
  
  if (memoryGB > 1.6) {
    await appendAppLog(sceneId, {
      source: "main",
      kind: "warning",
      text: `[MEMORY WARNING] Renderer private memory usage is high: ${(rendererPrivate / 1024 / 1024).toFixed(2)} MB (> 1.6 GB).`
    }).catch(() => null);
  }

  if (memoryGB > 1.8) {
    await appendAppLog(sceneId, {
      source: "main",
      kind: "warning",
      text: `[MEMORY CRITICAL] Renderer private memory usage is critical: ${(rendererPrivate / 1024 / 1024).toFixed(2)} MB (> 1.8 GB).`
    }).catch(() => null);
  }

  let scheduleRotation = false;
  let reason = "";

  if (memoryGB > 1.95) {
    scheduleRotation = true;
    reason = `Private bytes exceeds 1.95 GB (${(rendererPrivate / 1024 / 1024).toFixed(2)} MB)`;
  }

  const domNodeCount = pageState.domNodeCount || 0;
  const canvasCount = pageState.canvasCount || 0;

  if (domNodeCount > 35000) {
    scheduleRotation = true;
    reason = `DOM node count is extremely high (${domNodeCount} nodes > 35000)`;
  }

  if (canvasCount > 15) {
    scheduleRotation = true;
    reason = `Canvas count is extremely high (${canvasCount} canvases > 15)`;
  }

  if (scheduleRotation) {
    globalThis.__vidoraSafeExitRotationScheduled = true;
    await appendAppLog(sceneId, {
      source: "main",
      kind: "warning",
      text: `[PROACTIVE GUARD] Safe Exit Rotation scheduled at end of current scene. Reason: ${reason}`
    }).catch(() => null);
  }
}

async function getChatGptLocationState(page) {
  return evaluateOnCdpPage(
    page,
    `(() => {
    try {
      const path = location.pathname || '';
      const id = (path.match(/\/c\/([^/?#]+)/) || [])[1] || '';
      return { ok: true, origin: location.origin, path, conversationId: id, title: document.title || '' };
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : String(error) };
    }
  })()`,
  ).catch((error) => ({ ok: false, error: error.message }));
}

async function invalidateChatGptConversationIdentity(reason = "unknown") {
  chatGptConversationIdentityCache.conversationId = "";
  chatGptConversationIdentityCache.path = "";
  chatGptConversationIdentityCache.title = "";
  chatGptConversationIdentityCache.verifiedAt = 0;
  chatGptConversationIdentityCache.lastCheckAt = 0;
  chatGptConversationIdentityCache.invalidatedAt = Date.now();
  chatGptConversationIdentityCache.forceAfterInvalidation = true;
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `chatTitleCheck: cache invalidated reason=${reason}`,
  });
}

async function forceCleanChatGptNewChatRotation() {
  const currentSceneId = globalThis.__vidoraLastProcessedSceneId || "unknown";
  const sendState = getChatGptSendState(currentSceneId);
  const timestamp = new Date().toISOString();

  await appendAppLog(currentSceneId, {
    source: "main",
    kind: "warning",
    text: `CHATGPT_ROTATION_REQUESTED`,
    details: {
      timestamp,
      sceneId: currentSceneId,
      stage: sendState,
      reason: "forceCleanChatGptNewChatRotation called",
    },
  }).catch(() => null);

  const blockedReason = isReloadBlocked(currentSceneId);
  if (blockedReason || sendState === "PREPARING" || sendState === "READY" || sendState === "CLICKING") {
    await appendAppLog(currentSceneId, {
      source: "main",
      kind: "warning",
      text: `RECOVERY_BLOCKED_BEFORE_SEND: forceCleanChatGptNewChatRotation blocked during sendState = ${sendState}. ${blockedReason || ""}`,
    }).catch(() => null);
    return;
  }
  sessionSceneCounter = 0; // zero out the sessionSceneCounter
  isChatGptContextFresh = true;
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: "Forcing clean ChatGPT New Chat rotation: purging cached conversation anchors...",
  }).catch(() => null);

  // Purge memory references
  await invalidateChatGptConversationIdentity("rotation-forced");
  activeConversationUrl = null;
  currentThreadId = null;
  globalThis.activeConversationUrl = null;
  globalThis.currentThreadId = null;
  globalThis.__vidoraDisableSidebarSelection = true;
  globalThis.__vidoraChatGptNewChatMode = true;
  globalThis.__vidoraPendingChatRenameTitleSafe = "";
  globalThis.__vidoraFreshChatCreatedForProject = "";

  try {
    const page = await getCdpPage("chatgpt", true);
    await evaluateOnCdpPage(
      page,
      `(() => {
      try { localStorage.clear(); } catch (_error) {}
      try { sessionStorage.clear(); } catch (_error) {}
      return true;
    })()`,
    ).catch(() => null);
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Rotation: cleared ChatGPT localStorage/sessionStorage.`,
    }).catch(() => null);

    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Rotation: Reloading ChatGPT page...`,
    });
    assertPipelineRunActive();
    assertPipelineRunActive();
    assertPipelineRunActive();
    assertPipelineRunActive();
    assertPipelineRunActive();
    await requestReloadWithReason(page, "rotation", currentSceneId);
    await waitForCdpLoad(page).catch(() => null);

    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Rotation: Waiting 4000ms for elements to load...`,
    });
    await sleep(4000);

    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Rotation: Clicking New Chat button...`,
    });
    const clicked = await evaluateOnCdpPage(
      page,
      `(${clickChatGptStartNewChatScript.toString()})()`,
    ).catch((err) => ({ ok: false, error: err.message }));
    await appendAppLog(null, {
      source: "main",
      kind: clicked.ok ? "ok" : "error",
      text: `Rotation: Clicked New Chat: ${JSON.stringify(clicked)}`,
    });

    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Rotation: Waiting 3000ms for composer...`,
    });
    await sleep(3000);

    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: `Rotation completed successfully. Ready for clean pipeline execution.`,
    });
  } catch (err) {
    await appendAppLog(null, {
      source: "main",
      kind: "error",
      text: `Rotation failed: ${err.message || String(err)}`,
    });
  }

  // Post-Rotation Padding: Ensure the brand-new chat workspace settles down completely
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: "Post-Rotation Padding: sleeping 7000ms for workspace to settle...",
  }).catch(() => null);
  await sleep(7000);
}

function isChatGptRequestRotationEligible(error, persistedStage = "") {
  const message = String(error?.message || error?.status || error || "");
  const text = message.toLowerCase();
  const stage = String(persistedStage || "").toLowerCase();
  if (
    /^veoup_|veoup|generate acknowledgement|output timeout|video-missing|launcher|pre-submission/i.test(
      `${stage} ${message}`,
    )
  )
    return false;
  if (
    /enoent|eacces|eperm|file|folder|path|missing validated image|invalid image|invalid video|local|ffmpeg|mp4|download|scene-output-incomplete/i.test(
      message,
    )
  )
    return false;
  if (
    /object reference chain|execution context was destroyed|cannot find context|target closed|dom|stale/i.test(
      message,
    )
  )
    return false;
  if (
    /still generating|waiting without resend|composer-busy|composer busy|busy\/streaming|duplicate motion prompt send blocked|stopvisible|stopVisible|sendReady|generating|nv2-existing-response-still-generating/i.test(
      message,
    )
  )
    return false;
  if (
    /conversation changed|url changed|root url|refresh-safe|location\.href/i.test(
      message,
    )
  )
    return false;
  if (
    /validation|validate|videoValidated|last frame|last-frame|output lifecycle/i.test(
      message,
    ) &&
    !/chatgpt|nv1|nv2|motion prompt|response/i.test(message)
  )
    return false;
  if (
    !/nv1|nv2|chatgpt|prompt|composer|send|response|motion prompt|image_stage|motion_stage/i.test(
      `${stage} ${message}`,
    )
  )
    return false;
  return /send|prompt|response|refus|policy|rate.?limit|too many requests|429|no response|missing.*response|not.*start|not.*acknowledged|conversation.*lost|conversation.*unavailable|no-new-assistant|no-assistant|not.*valid|invalid.*response|tool.*failed|image.*failed|generation.*failed/i.test(
    text,
  );
}

async function collectRecentProjectKeyframes(
  projectDir = "",
  limit = 30,
  beforeSceneId = 0,
) {
  const entries = await fs
    .readdir(projectDir, { withFileTypes: true })
    .catch(() => []);
  const files = [];
  const maxSceneId = Number(beforeSceneId || 0);
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^scene_\d+$/i.test(entry.name)) continue;
    const sceneNumber = Number(String(entry.name || "").match(/\d+/)?.[0] || 0);
    if (maxSceneId > 0 && sceneNumber >= maxSceneId) continue;
    const sceneDir = path.join(projectDir, entry.name);
    const keyframePath = path.join(sceneDir, `${entry.name}_keyframe.png`);
    const stat = await fs.stat(keyframePath).catch(() => null);
    if (stat?.isFile?.())
      files.push({
        path: keyframePath,
        sceneNumber,
        mtimeMs: stat.mtimeMs || 0,
      });
  }
  return files
    .sort((a, b) => b.sceneNumber - a.sceneNumber || b.mtimeMs - a.mtimeMs)
    .slice(0, limit)
    .map((item) => item.path);
}

function captureChatGptDiagnosticSnapshotScript() {
  const assistants = [...document.querySelectorAll('[data-message-author-role="assistant"]')];
  const lastAssistant = assistants[assistants.length - 1];
  
  const progressBars = [...document.querySelectorAll('[role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"], progress')]
    .map(el => ({
      outerHTML: el.outerHTML.slice(0, 300),
      className: el.className,
      id: el.id
    }));

  const placeholders = [...document.querySelectorAll('[class*="placeholder"], [data-placeholder]')]
    .map(el => ({
      outerHTML: el.outerHTML.slice(0, 300),
      className: el.className,
      text: el.innerText || el.textContent
    }));

  const streamingIndicators = [...document.querySelectorAll('[class*="result-streaming"], .result-streaming, [aria-busy="true"]')]
    .map(el => ({
      outerHTML: el.outerHTML.slice(0, 300),
      className: el.className
    }));

  const composer = document.querySelector('#prompt-textarea') || document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
  const composerValue = composer ? (composer.value || composer.textContent || "") : "";

  const sendButton = [...document.querySelectorAll('button')]
    .find(btn => /send|submit|gui|arrow-up|paper-plane|composer-submit/i.test(btn.innerText + " " + btn.className + " " + (btn.getAttribute("aria-label") || "") + " " + btn.innerHTML));
  
  const stopButton = [...document.querySelectorAll('button')]
    .find(btn => /stop|cancel|dừng/i.test(btn.innerText + " " + btn.className + " " + (btn.getAttribute("aria-label") || "") + " " + btn.innerHTML));

  return {
    assistantCount: assistants.length,
    latestAssistant: lastAssistant ? {
      id: lastAssistant.id || lastAssistant.getAttribute('data-message-id') || "",
      text: (lastAssistant.innerText || lastAssistant.textContent || "").trim().slice(0, 500),
      htmlSnippet: lastAssistant.outerHTML.slice(0, 800)
    } : null,
    composerValue: composerValue.slice(0, 500),
    sendButtonState: sendButton ? {
      outerHTML: sendButton.outerHTML.slice(0, 300),
      disabled: sendButton.disabled || sendButton.getAttribute('disabled') !== null
    } : null,
    stopButtonState: stopButton ? {
      outerHTML: stopButton.outerHTML.slice(0, 300),
      present: true
    } : null,
    progressBars,
    placeholders,
    streamingIndicators
  };
}

async function captureAndLogChatGptDiagnostics(client, sceneId, beforeCount, stage = "unknown") {
  const result = await evaluateOnCdpPage(
    client,
    `(${captureChatGptDiagnosticSnapshotScript.toString()})()`
  ).catch(err => ({ error: err.message }));

  await appendAppLog(sceneId, {
    source: "main",
    kind: "info",
    text: `CHATGPT_DIAGNOSTICS: post-send snapshot for scene ${sceneId} at stage ${stage}`,
    details: {
      sceneId,
      stage,
      assistantCountBefore: beforeCount,
      assistantCountAfter: result?.assistantCount || 0,
      latestAssistantId: result?.latestAssistant?.id || "none",
      latestAssistantText: result?.latestAssistant?.text || "none",
      latestAssistantHtmlSnippet: result?.latestAssistant?.htmlSnippet || "none",
      composerValue: result?.composerValue || "",
      sendButtonState: result?.sendButtonState || null,
      stopButtonState: result?.stopButtonState || null,
      progressBars: result?.progressBars || [],
      placeholders: result?.placeholders || [],
      streamingIndicators: result?.streamingIndicators || [],
      error: result?.error || null
    }
  }).catch(() => null);
}

async function waitForChatGptHydrationResponse(
  client,
  beforeCount = 0,
  { sceneId = 0, request = 0 } = {},
) {
  await captureAndLogChatGptDiagnostics(client, sceneId, beforeCount, `hydration-request-${request}-init`).catch(() => null);

  let lastText = "";
  let stableTicks = 0;
  const startedAt = Date.now();
  let refreshedAfterIdle = false;
  while (Date.now() - startedAt < 180000) {
    assertPipelineRunActive();
    await sleep(2500);
    const snapshot = await evaluateOnCdpPage(
      client,
      `(${readLatestAssistantScript.toString()})()`,
    ).catch(() => ({}));
    const text = String(snapshot?.text || "").trim();
    const hasNewMessage =
      Number(snapshot?.count || 0) > Number(beforeCount || 0);
    if (hasNewMessage && text.length > 10) {
      if (text === lastText) {
        stableTicks += 1;
      } else {
        stableTicks = 0;
        lastText = text;
      }
      if (stableTicks >= 2 && !snapshot.generating) {
        await appendAppLog(null, {
          source: "main",
          kind: "ok",
          text: `ChatGPT hydration request ${request} acknowledged.`,
          details: { sceneId, chars: text.length },
        }).catch(() => null);
        return text;
      }
    }
    if (
      !refreshedAfterIdle &&
      Date.now() - startedAt > 120000 &&
      !snapshot?.generating &&
      !hasNewMessage
    ) {
      refreshedAfterIdle = true;
      await appendAppLog(null, {
        source: "main",
        kind: "warning",
        text: `ChatGPT hydration request ${request} has no response after 45s and no loading state. Refreshing page once before continuing wait.`,
        details: { sceneId, beforeCount, latestCount: snapshot?.count || 0 },
      }).catch(() => null);
      const reloadResult = await requestReloadWithReason(client, `hydration_timeout_req_${request}`, sceneId);
      if (reloadResult) {
        await waitForCdpLoad(client).catch(() => null);
        await sleep(5000);
      }
    }
  }
  await captureAndLogChatGptDiagnostics(client, sceneId, beforeCount, `hydration-request-${request}-timeout-pre`).catch(() => null);
  throw new Error(`chatgpt-hydration-request-${request}-response-timeout`);
}

async function buildRecentScenesHydrationFile(options = {}, sceneId = 0) {
  const recentScenes = Array.isArray(options.recentScenes)
    ? options.recentScenes
    : [];
  const normalizedScenes = recentScenes
    .map((scene) => ({
      id: Number(scene?.id || scene?.sceneId || 0),
      text: String(
        scene?.text || scene?.sceneText || scene?.original || "",
      ).trim(),
    }))
    .filter((scene) => scene.text)
    .sort((a, b) => a.id - b.id)
    .slice(-20);
  if (!normalizedScenes.length) {
    const fallbackText = String(
      options.sceneText ||
        options.currentSceneText ||
        options.sourceSceneText ||
        "",
    ).trim();
    if (fallbackText)
      normalizedScenes.push({ id: Number(sceneId || 0), text: fallbackText });
  }
  if (!normalizedScenes.length) return "";
  const contextDir =
    options.outputFolder ||
    options.projectPath ||
    options.outputPath ||
    app.getPath("temp");
  await fs.mkdir(contextDir, { recursive: true }).catch(() => null);
  const scenesPath = path.join(
    contextDir,
    "vidora_recent_scenes_request_2.txt",
  );
  const body = normalizedScenes
    .map((scene) => `SCENE ${scene.id || ""}\n${scene.text}`)
    .join("\n\n");
  await fs.writeFile(scenesPath, body, "utf8");
  return scenesPath;
}

async function hydrateFreshChatGptContextAfterRotation(
  options = {},
  sceneId = 0,
) {
  const projectDir =
    options.outputFolder || options.projectPath || options.outputPath || "";
  const sceneDir = path.join(
    projectDir,
    `scene_${String(sceneId).padStart(3, "0")}`,
  );
  
  let snapshot = await readSceneSnapshot(sceneDir);
  if (!snapshot.hydration) {
    snapshot.hydration = {};
  }
  snapshot.hydration.request1Done = !!snapshot.hydration.request1Done;
  snapshot.hydration.request2Done = !!snapshot.hydration.request2Done;
  snapshot.hydration.characterUploadDone = !!snapshot.hydration.characterUploadDone;
  snapshot.hydration.sceneUploadDone = !!snapshot.hydration.sceneUploadDone;
  snapshot.hydration.lastFrameUploadDone = !!snapshot.hydration.lastFrameUploadDone;
  snapshot.hydration.promptUploadDone = !!snapshot.hydration.promptUploadDone;

  const page = await getCdpPage("chatgpt", true, { bringToFront: true });
  
  if (!snapshot.hydration.request1Done) {
    const prepromptFiles = projectDir
      ? await collectPrepromptRequestFiles({ outputFolder: projectDir })
      : [];
    const beforePreprompt = await evaluateOnCdpPage(
      page,
      `(${countChatGptAssistantRootsScript.toString()})()`,
    ).catch(() => ({ count: 0 }));
    if (prepromptFiles.length) {
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `ChatGPT hydrate request 1: uploading ${prepromptFiles.length} preprompt file(s).`,
        details: {
          sceneId,
          prepromptFiles: prepromptFiles.map((file) => path.basename(file)),
        },
      }).catch(() => null);
      const uploadPreprompt = await uploadFilesToChatGptSequentially(
        page,
        prepromptFiles,
        sceneId,
        {
          rotationHydration: true,
          request: 1,
          trailingUploadLog: `Scene ${sceneId}: Uploading preprompt files for ChatGPT hydration...`,
        },
      );
      if (!uploadPreprompt?.ok)
        throw new Error(
          `chatgpt-hydration-preprompt-upload-failed: ${uploadPreprompt?.error || "unknown"}`,
        );
    } else {
      await appendAppLog(null, {
        source: "main",
        kind: "warning",
        text: `ChatGPT hydrate request 1: preprompt folder has no files.`,
        details: { sceneId, projectDir },
      }).catch(() => null);
    }
    const sentPreprompt = await sendPromptViaCdpInput(
      page,
      "Request 1: read and remember all attached preprompt files. Reply only when ready.",
      {
        beforeCount: beforePreprompt?.count || 0,
        sceneId,
        stage: "hydrate-request-1",
      },
    );
    if (!sentPreprompt?.ok)
      throw new Error(
        `chatgpt-hydration-preprompt-message-failed: ${sentPreprompt?.error || "unknown"}`,
      );
    await waitForChatGptHydrationResponse(page, beforePreprompt?.count || 0, { sceneId, request: 1 });
    
    snapshot.hydration.request1Done = true;
    snapshot.pipelineStage = "HYDRATION_2";
    await writeSceneSnapshot(sceneDir, snapshot);
  }

  const deadline = Date.now() + 15000;
  let promotedUrl = "";
  while (Date.now() < deadline) {
    const currentUrl = await evaluateOnCdpPage(page, "location.href").catch(() => "");
    if (isValidChatGptConversationUrl(currentUrl)) {
      promotedUrl = currentUrl;
      break;
    }
    await sleep(500);
  }
  if (promotedUrl) {
    activeConversationUrl = promotedUrl;
    globalThis.activeConversationUrl = promotedUrl;
    await writePipelineSceneState(projectDir, sceneId, {
      chatUrl: promotedUrl,
      chatGptConversationUrl: promotedUrl,
      conversationIndex: chatGptConversationHealth.conversationIndex || 0,
    }).catch(() => null);
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: `Scene ${sceneId}: Saved newly rotated and hydrated ChatGPT conversation URL.`,
      details: { chatUrl: promotedUrl },
    }).catch(() => null);
  }

  if (!snapshot.hydration.request2Done) {
    const recentKeyframes = projectDir
      ? await collectRecentProjectKeyframes(projectDir, 20, sceneId)
      : [];
    const beforeScenes = await evaluateOnCdpPage(
      page,
      `(${countChatGptAssistantRootsScript.toString()})()`,
    ).catch(() => ({ count: 0 }));
    if (recentKeyframes.length) {
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `ChatGPT hydrate request 2: uploading ${recentKeyframes.length} recent keyframe(s).`,
        details: {
          sceneId,
          keyframes: recentKeyframes.map((file) => path.basename(file)),
        },
      }).catch(() => null);
      const uploadKeyframes = await uploadFilesToChatGptSequentially(
        page,
        recentKeyframes,
        sceneId,
        {
          rotationHydration: true,
          request: 2,
          trailingUploadLog: `Scene ${sceneId}: Uploading recent keyframes for ChatGPT hydration...`,
        },
      );
      if (!uploadKeyframes?.ok)
        throw new Error(
          `chatgpt-hydration-keyframes-upload-failed: ${uploadKeyframes?.error || "unknown"}`,
        );
    } else {
      await appendAppLog(null, {
        source: "main",
        kind: "warning",
        text: `ChatGPT hydrate request 2: no previous keyframes available; sending acknowledgement request.`,
        details: { sceneId },
      }).catch(() => null);
    }
    const sentScenes = await sendPromptViaCdpInput(
      page,
      "Request 2: read and remember the attached keyframes from up to 20 previous project scenes. Use them as visual continuity context for upcoming requests. Reply only when ready.",
      {
        beforeCount: beforeScenes?.count || 0,
        sceneId,
        stage: "hydrate-request-2",
      },
    );
    if (!sentScenes?.ok)
      throw new Error(
        `chatgpt-hydration-keyframes-message-failed: ${sentScenes?.error || "unknown"}`,
      );
    await waitForChatGptHydrationResponse(page, beforeScenes?.count || 0, { sceneId, request: 2 });
    
    snapshot.hydration.request2Done = true;
    snapshot.pipelineStage = "NV1_DRAFT_READY";
    await writeSceneSnapshot(sceneDir, snapshot);
  }

  isChatGptContextFresh = false;
  globalThis.__vidoraChatGptNewChatMode = false;
  return;
  const scriptText = String(
    options.scriptText || options.storyText || options.story || "",
  ).trim();
  const sceneScriptText = String(
    options.sceneText || options.currentSceneText || options.imagePrompt || "",
  ).trim();
  const sourceSceneText = String(
    options.sourceSceneText || scriptText || "",
  ).trim();
  const sourceSceneFileName = sanitizeFileName(
    options.sourceSceneFileName || "scene.txt",
  );
  const sourceSceneFilePath = String(options.sourceSceneFilePath || "").trim();
  const contextDir = projectDir || app.getPath("temp");
  if (false && scriptText) {
    const scriptPath = path.join(
      contextDir,
      "vidora_current_project_script.txt",
    );
    await fs.writeFile(scriptPath, scriptText, "utf8").catch(() => null);
    if (await pathExists(scriptPath)) {
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `ChatGPT rotation hydrate request 1: uploading project script txt.`,
        details: { sceneId, scriptPath },
      }).catch(() => null);
      const uploadScript = await uploadFilesToChatGptSequentially(
        page,
        [scriptPath],
        sceneId,
        {
          rotationHydration: true,
          request: 1,
          trailingUploadLog: `Scene ${sceneId}: Uploading project script txt for ChatGPT rotation hydration...`,
        },
      );
      if (!uploadScript?.ok)
        throw new Error(
          `chatgpt-rotation-script-upload-failed: ${uploadScript?.error || "unknown"}`,
        );
      const sentScript = await sendPromptViaCdpInput(
        page,
        "Đây là file kịch bản của project hiện tại. Hãy ghi nhớ ngữ cảnh này cho các request tạo ảnh và motion prompt tiếp theo.",
      );
      if (!sentScript?.ok)
        throw new Error(
          `chatgpt-rotation-script-message-failed: ${sentScript?.error || "unknown"}`,
        );
      await sleep(1500);
    }
  }
  const scriptFiles = [];
  if (sourceSceneFilePath && (await pathExists(sourceSceneFilePath))) {
    scriptFiles.push(sourceSceneFilePath);
  } else if (sourceSceneText || sceneScriptText) {
    const copiedSceneFilePath = path.join(
      contextDir,
      sourceSceneFileName || "scene.txt",
    );
    await fs
      .writeFile(
        copiedSceneFilePath,
        sourceSceneText || sceneScriptText,
        "utf8",
      )
      .catch(() => null);
    if (await pathExists(copiedSceneFilePath))
      scriptFiles.push(copiedSceneFilePath);
  }
  if (scriptFiles.length) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `ChatGPT rotation hydrate request 1: uploading selected scene txt file.`,
      details: { sceneId, scriptFiles },
    }).catch(() => null);
    const uploadScript = await uploadFilesToChatGptSequentially(
      page,
      scriptFiles,
      sceneId,
      {
        rotationHydration: true,
        request: 1,
        trailingUploadLog: `Scene ${sceneId}: Uploading selected scene txt file for ChatGPT rotation hydration...`,
      },
    );
    if (!uploadScript?.ok)
      throw new Error(
        `chatgpt-rotation-script-upload-failed: ${uploadScript?.error || "unknown"}`,
      );
    const sentScript = await sendPromptViaCdpInput(
      page,
      "Day la file scene .txt goc ma user da chon khi tao project. Hay ghi nho ngu canh nay cho cac request tao anh va motion prompt tiep theo.",
    );
    if (!sentScript?.ok)
      throw new Error(
        `chatgpt-rotation-script-message-failed: ${sentScript?.error || "unknown"}`,
      );
    await sleep(1500);
  }
  const keyframes = projectDir
    ? await collectRecentProjectKeyframes(projectDir, 30)
    : [];
  if (keyframes.length) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `ChatGPT rotation hydrate request 2: uploading ${keyframes.length} recent keyframes.`,
      details: {
        sceneId,
        keyframes: keyframes.map((file) => path.basename(file)),
      },
    }).catch(() => null);
    const uploadKeyframes = await uploadFilesToChatGptSequentially(
      page,
      keyframes,
      sceneId,
      {
        rotationHydration: true,
        request: 2,
        trailingUploadLog: `Scene ${sceneId}: Uploading recent keyframe context for ChatGPT rotation hydration...`,
      },
    );
    if (!uploadKeyframes?.ok)
      throw new Error(
        `chatgpt-rotation-keyframe-upload-failed: ${uploadKeyframes?.error || "unknown"}`,
      );
    const sentKeyframes = await sendPromptViaCdpInput(
      page,
      `Đây là ${keyframes.length} keyframe gần nhất đã tạo trong project. Hãy dùng chúng làm ngữ cảnh hình ảnh liên tục cho các scene tiếp theo.`,
    );
    if (!sentKeyframes?.ok)
      throw new Error(
        `chatgpt-rotation-keyframe-message-failed: ${sentKeyframes?.error || "unknown"}`,
      );
    await sleep(1500);
  } else {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `ChatGPT rotation hydrate request 2: no previous keyframes available; continuing.`,
      details: { sceneId },
    }).catch(() => null);
  }
  isChatGptContextFresh = false;
  globalThis.__vidoraChatGptNewChatMode = false;
}

function updateChatGptConversationIdentity(locationState = {}, title = "") {
  const pathValue = String(locationState?.path || "");
  const conversationId =
    locationState?.conversationId ||
    getChatGptConversationIdFromPath(pathValue);
  if (!conversationId) return;
  chatGptConversationIdentityCache.conversationId = conversationId;
  chatGptConversationIdentityCache.path = pathValue;
  chatGptConversationIdentityCache.title = String(
    title || locationState.currentTitle || "",
  ).trim();
  chatGptConversationIdentityCache.verifiedAt = Date.now();
  chatGptConversationIdentityCache.forceAfterInvalidation = false;
}

async function maybeSelectChatGptConversationByTitle(
  page,
  title = "",
  { sceneId = "", force = false, reason = "stage" } = {},
) {
  const wanted = String(title || "").trim();
  if (!wanted) return { ok: true, skipped: true, reason: "missing-title" };
  const locationState = await getChatGptLocationState(page);
  if (globalThis.__vidoraDisableSidebarSelection) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `chatTitleCheck: sidebar selection is disabled (New Chat baseline anchor active). Skipping selection of "${wanted}".`,
    }).catch(() => null);
    return {
      ok: true,
      skipped: true,
      reason: "disable-sidebar-selection",
      location: locationState,
    };
  }
  const currentId =
    locationState?.conversationId ||
    getChatGptConversationIdFromPath(locationState?.path || "");
  const cached = chatGptConversationIdentityCache;
  if (
    !force &&
    currentId &&
    cached.conversationId &&
    currentId !== cached.conversationId
  ) {
    await invalidateChatGptConversationIdentity("chatgpt-url-changed");
  }
  const sameCachedConversation =
    currentId &&
    cached.conversationId === currentId &&
    isSameChatTitle(cached.title, wanted);
  if (!force && !cached.forceAfterInvalidation && sameCachedConversation) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: "chatTitleCheck: using cached conversation identity",
      details: {
        sceneId,
        reason,
        path: locationState?.path || "",
        title: sanitizeChatTitleForLog(wanted),
        verifiedAgoMs: Date.now() - cached.verifiedAt,
      },
    });
    return {
      ok: true,
      skipped: true,
      cached: true,
      title: wanted,
      location: locationState,
    };
  }
  if (
    !force &&
    cached.lastCheckAt &&
    Date.now() - cached.lastCheckAt < CHAT_TITLE_CHECK_MIN_INTERVAL_MS &&
    sameCachedConversation
  ) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `chatTitleCheck: skipped reason=rate-limit-${reason}`,
      details: {
        sceneId,
        path: locationState?.path || "",
        title: sanitizeChatTitleForLog(wanted),
        lastCheckAgoMs: Date.now() - cached.lastCheckAt,
      },
    });
    return {
      ok: true,
      skipped: true,
      rateLimited: true,
      title: wanted,
      location: locationState,
    };
  }
  if (force) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `chatTitleCheck: forced reason=${reason}`,
      details: { sceneId, title: sanitizeChatTitleForLog(wanted) },
    });
  }
  cached.lastCheckAt = Date.now();
  const selected = await selectChatGptConversationByTitle(page, wanted);
  if (selected?.ok) {
    const selectedLocation =
      selected.location || (await getChatGptLocationState(page));
    updateChatGptConversationIdentity(selectedLocation, wanted);
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: `chatTitleCheck: verified title=${sanitizeChatTitleForLog(wanted)}`,
      details: {
        sceneId,
        reason,
        path: selectedLocation?.path || "",
        mode: selected.mode || "",
      },
    });
  }
  return selected;
}

function getSafeGrokAccounts() {
  return grokRouterState.accounts.map((account) => ({
    accountId: account.accountId,
    label: maskRouterText(account.label || account.accountId),
    maskedEmail: maskRouterText(account.maskedEmail || "***@masked.local"),
    state: GROK_ROUTER_ALLOWED_STATES.has(account.state)
      ? account.state
      : "invalid",
    selected: account.accountId === grokRouterState.selectedAccountId,
  }));
}

function getGrokRouterStatus() {
  const active =
    getSafeGrokAccounts().find((account) => account.selected) || null;
  return {
    accountRouterEnabled: Boolean(grokRouterState.accountRouterEnabled),
    routingPolicy: grokRouterState.routingPolicy,
    paused: Boolean(grokRouterState.paused),
    pauseReason: grokRouterState.pauseReason,
    lastErrorClassification: grokRouterState.lastErrorClassification,
    lastSafeMessage: grokRouterState.lastSafeMessage,
    selectedAccountId: grokRouterState.selectedAccountId,
    activeAccount: active,
    checkpointStatus: grokRouterState.checkpoint?.currentStatus || "none",
    checkpointUpdatedAt: grokRouterState.checkpoint?.updatedAt || "",
  };
}

function setGrokAccountState(accountId, state) {
  if (!GROK_ROUTER_ALLOWED_STATES.has(state)) return false;
  const account = grokRouterState.accounts.find(
    (item) => item.accountId === accountId,
  );
  if (!account) return false;
  account.state = state;
  return true;
}

async function selectGrokAccount(_event, accountId) {
  const id = String(accountId || "").trim();
  const account = grokRouterState.accounts.find(
    (item) => item.accountId === id,
  );
  if (!account) return { ok: false, error: "Unknown sanitized Grok account." };
  if (
    ["limited", "login_required", "invalid", "disabled_by_user"].includes(
      account.state,
    )
  ) {
    return { ok: false, error: `Account is not available: ${account.state}` };
  }
  grokRouterState.accounts.forEach((item) => {
    if (item.state === "active") item.state = "available";
  });
  account.state = "active";
  grokRouterState.selectedAccountId = id;
  grokRouterState.paused = false;
  grokRouterState.pauseReason = "";
  grokRouterState.lastSafeMessage = "Grok router account selected safely.";
  return {
    ok: true,
    status: getGrokRouterStatus(),
    accounts: getSafeGrokAccounts(),
  };
}

async function setAccountRouterEnabled(_event, enabled) {
  grokRouterState.accountRouterEnabled = Boolean(enabled);
  if (!grokRouterState.accountRouterEnabled) {
    grokRouterState.paused = false;
    grokRouterState.pauseReason = "";
    grokRouterState.lastSafeMessage =
      "Router disabled; single-account Grok pipeline is active.";
  }
  return getGrokRouterStatus();
}

function classifyGrokRouterError(error) {
  const text = `${error?.message || error || ""}\n${error?.stack || ""}`;
  if (
    /canvas limit|limit trong canvas|đổi canvas|new canvas|empty canvas/i.test(
      text,
    )
  )
    return "canvas_limit";
  if (
    /quota|plan|account.*limit|feature tạo video chưa khả dụng|đổi account/i.test(
      text,
    )
  )
    return "account_limit";
  if (/chưa đăng nhập|sign in|login|đăng nhập/i.test(text))
    return "login_required";
  if (/network|timeout|fetch|net::|econn|timed out|hết thời gian/i.test(text))
    return "network_error";
  return "unknown_error";
}

async function writeGrokRouterCheckpoint(sceneDir, fields = {}) {
  const checkpoint = {
    projectName: maskRouterText(fields.projectName || "project"),
    sceneId: fields.sceneId ?? "",
    sceneIndex: fields.sceneIndex ?? fields.sceneId ?? "",
    imageRef: fields.imageRef || "",
    motionPromptRef: fields.motionPromptRef || "",
    provider: normalizeVideoProvider(fields.provider || "grok"),
    accountId: fields.accountId || grokRouterState.selectedAccountId,
    profileRef: fields.profileRef || "grok-web-session",
    canvasRef: fields.canvasRef || "",
    currentStatus: fields.currentStatus || "checkpointed",
    lastErrorClassification: fields.lastErrorClassification || "",
    createdAt: fields.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  grokRouterState.checkpoint = checkpoint;
  await fs
    .writeFile(
      GROK_ROUTER_CHECKPOINT_FILE,
      JSON.stringify(checkpoint, null, 2),
      "utf8",
    )
    .catch(() => null);
  if (sceneDir)
    await fs
      .writeFile(
        path.join(sceneDir, "grok_router_checkpoint.json"),
        JSON.stringify(checkpoint, null, 2),
        "utf8",
      )
      .catch(() => null);
  return checkpoint;
}

async function pauseGrokRouterForError(
  sceneDir,
  classification,
  safeMessage,
  checkpointFields = {},
) {
  grokRouterState.paused = true;
  grokRouterState.pauseReason = classification;
  grokRouterState.lastErrorClassification = classification;
  grokRouterState.lastSafeMessage = safeMessage;
  if (classification === "account_limit")
    setGrokAccountState(grokRouterState.selectedAccountId, "limited");
  if (classification === "login_required")
    setGrokAccountState(grokRouterState.selectedAccountId, "login_required");
  await writeGrokRouterCheckpoint(sceneDir, {
    ...checkpointFields,
    currentStatus: "paused",
    lastErrorClassification: classification,
  });
  await notifyRenderer(
    "grok-router-paused",
    safeMessage,
    getGrokRouterStatus(),
  );
}

async function resumeFromRouterCheckpoint() {
  if (
    !grokRouterState.checkpoint &&
    (await pathExists(GROK_ROUTER_CHECKPOINT_FILE))
  ) {
    const raw = await fs
      .readFile(GROK_ROUTER_CHECKPOINT_FILE, "utf8")
      .catch(() => "");
    grokRouterState.checkpoint = raw ? JSON.parse(raw) : null;
  }
  if (!grokRouterState.checkpoint)
    return { ok: false, error: "No safe Grok router checkpoint is available." };
  grokRouterState.paused = false;
  grokRouterState.pauseReason = "";
  grokRouterState.lastSafeMessage =
    "Checkpoint is ready; start the pipeline again to resume safely.";
  return {
    ok: true,
    status: getGrokRouterStatus(),
    checkpoint: grokRouterState.checkpoint,
  };
}



async function notifyRenderer(type, message, details = null) {
  const safeDetails = details == null ? null : sanitizeLogValue(details);
  await appendAppLog(null, {
    source: "main",
    kind: "notice",
    text: message,
    details: { type, details: safeDetails },
  });
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      try {
        win.webContents.send(
          "pipeline:notice",
          sanitizeIpcValue({
            type,
            message,
            details: safeDetails,
            ts: new Date().toISOString(),
          }),
        );
      } catch (error) {
        appendAppLog(null, {
          source: "main",
          kind: "error",
          text: `notifyRenderer IPC skipped: ${error.message}`,
        }).catch(() => null);
      }
    }
  });
}

function notifyChatGptPolicyRefusal(sceneId, stage, text) {
  if (typeof appendAppLog === "function") {
    appendAppLog(
      sceneId,
      "warn",
      `[Content Policy Refusal] ChatGPT blocked generation at stage: ${stage}`,
      { sceneId, text },
    );
  }
  if (typeof notifyRenderer === "function") {
    notifyRenderer(
      "chatgpt-policy-refusal",
      `Scene ${sceneId}: ChatGPT chặn content policy ở stage: ${stage}`,
      { sceneId, text },
    );
  }
}



async function ensureAndMigratePrompts() {
  const promptDir = getUserPromptDir();
  const oldFilePath = path.join(promptDir, "2 NHIỆM VỤ BẰNG PROMPT.txt");
  const nv1Path = path.join(promptDir, "NV1_TAO_ANH.txt");
  const nv2Path = path.join(promptDir, "NV2_MOTION_PROMPT.txt");

  await fs.mkdir(promptDir, { recursive: true });

  const oldExists = await pathExists(oldFilePath);
  const nv1Exists = await pathExists(nv1Path);
  const nv2Exists = await pathExists(nv2Path);

  if (!nv1Exists) {
    if (oldExists) {
      const oldContent = await fs.readFile(oldFilePath, "utf8");
      await fs.writeFile(nv1Path, oldContent, "utf8");
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: `Migrated old prompt file content into NV1_TAO_ANH.txt`,
      });
    } else {
      await fs.writeFile(nv1Path, "", "utf8");
    }
  }

  if (!nv2Exists) {
    await fs.writeFile(nv2Path, "", "utf8");
  }
}

function sanitizePromptSourcePathForLog(filePath = "") {
  const value = String(filePath || "");
  if (!value) return "";
  return value.replace(/app\.asar(?:\.unpacked)?/gi, "[app-resource]");
}

async function findBundledPromptTemplate(filename = HARD_PROMPT_FILENAME) {
  const candidates = [
    path.join(process.resourcesPath || "", "prompts", filename),
    path.join(process.resourcesPath || "", filename),
    path.join(
      process.resourcesPath || "",
      "app.asar.unpacked",
      "prompts",
      filename,
    ),
    path.join(process.resourcesPath || "", "app.asar.unpacked", filename),
    path.resolve(__dirname, "..", "prompts", filename),
    path.resolve(__dirname, "..", filename),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (
      candidate.includes("app.asar") &&
      !candidate.includes("app.asar.unpacked")
    )
      continue;
    if (await pathExists(candidate)) return candidate;
  }
  return "";
}

async function ensureUserPromptFile(filename = HARD_PROMPT_FILENAME) {
  const userData = app.getPath("userData");
  const promptDir = getUserPromptDir();
  const targetPath = path.join(promptDir, filename);
  await appendAppLog(null, {
    source: "main",
    kind: "info",
    text: `promptFile: userData=${userData}`,
  });
  await appendAppLog(null, {
    source: "main",
    kind: "info",
    text: `promptFile: promptDir=${promptDir}`,
  });
  try {
    await fs.mkdir(promptDir, { recursive: true });
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: "promptFile: ensuredDir",
      details: { promptDir },
    });
    if (await pathExists(targetPath)) return targetPath;
    const bundled = await findBundledPromptTemplate(filename);
    if (bundled) {
      await fs.copyFile(bundled, targetPath);
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: `promptFile: copiedDefault from=${sanitizePromptSourcePathForLog(bundled)} to=${targetPath}`,
      });
      return targetPath;
    }
    await fs.writeFile(targetPath, HARD_PROMPT_DEFAULT_CONTENT, "utf8");
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: `promptFile: createdDefault file=${targetPath}`,
    });
    return targetPath;
  } catch (error) {
    throw new Error(
      `Cannot create/open editable prompt file at ${targetPath}: ${error.message}`,
    );
  }
}



async function readHardPromptConfig() {
  try {
    const raw = await fs.readFile(getHardPromptConfigPath(), "utf8");
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : {};
  } catch (_error) {
    return {};
  }
}

async function writeHardPromptConfig(config = {}) {
  const configPath = getHardPromptConfigPath();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
  return config;
}

async function resolveEditablePromptPath(filename = HARD_PROMPT_FILENAME) {
  const config = await readHardPromptConfig();
  const selectedPath = String(config.hardPromptPath || "").trim();

  if (selectedPath) {
    try {
      await fs.access(selectedPath);
      return selectedPath;
    } catch (error) {
      await appendAppLog(null, {
        source: "main",
        kind: "error",
        text: "promptFile: selected hard prompt file missing; fallback to AppData default.",
        details: { selectedPath, error: error.message },
      }).catch(() => null);
    }
  }

  return ensureUserPromptFile(filename);
}

async function getHardPromptFileInfo() {
  const config = await readHardPromptConfig();
  const filePath = await resolveEditablePromptPath(HARD_PROMPT_FILENAME);
  return {
    ok: true,
    filePath,
    selectedPath: config.hardPromptPath || "",
    usingCustomFile: Boolean(config.hardPromptPath),
  };
}

async function chooseHardPromptFile() {
  const result = await dialog.showOpenDialog({
    title: "Chọn file hard prompt 2 nhiệm vụ",
    properties: ["openFile"],
    filters: [
      { name: "Text files", extensions: ["txt"] },
      { name: "All files", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePaths?.[0]) {
    return { ok: false, canceled: true };
  }

  const filePath = result.filePaths[0];
  await fs.access(filePath);

  await writeHardPromptConfig({
    hardPromptPath: filePath,
    updatedAt: new Date().toISOString(),
  });

  await appendAppLog(null, {
    source: "main",
    kind: "ok",
    text: "promptFile: selected custom hard prompt file.",
    details: { filePath },
  }).catch(() => null);

  return { ok: true, filePath, usingCustomFile: true };
}

async function openHardPromptFile(event, key) {
  const fileKey = typeof event === "string" ? event : key;
  if (fileKey !== "NV1_TAO_ANH" && fileKey !== "NV2_MOTION_PROMPT") {
    throw new Error(`Invalid or unauthorized prompt file key: ${fileKey}`);
  }
  await ensureAndMigratePrompts();
  const promptDir = getUserPromptDir();
  const filePath = path.join(promptDir, `${fileKey}.txt`);
  await appendAppLog(null, {
    source: "main",
    kind: "info",
    text: `promptFile: opening file=${filePath}`,
  });
  const error = await shell.openPath(filePath);
  if (error)
    throw new Error(
      `Cannot open editable prompt file at ${filePath}: ${error}`,
    );
  return { ok: true, filePath };
}

async function loadHardPromptTasks() {
  await ensureAndMigratePrompts();
  const promptDir = getUserPromptDir();
  const nv1Path = path.join(promptDir, "NV1_TAO_ANH.txt");
  const nv2Path = path.join(promptDir, "NV2_MOTION_PROMPT.txt");
  await appendAppLog(null, {
    source: "main",
    kind: "info",
    text: `promptFile: reading NV1 from ${nv1Path} and NV2 from ${nv2Path}`,
  });
  const task1 = await fs.readFile(nv1Path, "utf8").catch(() => "");
  const task2 = await fs.readFile(nv2Path, "utf8").catch(() => "");
  return { task1: task1.trim(), task2: task2.trim() };
}

function buildTaskPrompt({
  task = "",
  script = "",
  sceneText = "",
  sceneId = "",
} = {}) {
  return [
    task,
    "--- KỊCH BẢN TỔNG / BỐI CẢNH ---",
    script || "(Không có kịch bản tổng riêng)",
    `--- SCENE ${sceneId || ""} HIỆN TẠI ---`,
    sceneText || "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildImageStagePrompt({
  nv1 = "",
  sceneText = "",
  sceneId = "",
  continuityText = "",
} = {}) {
  return [
    '--- IMAGE_STAGE / NV1_TAO_ANH ---',
    nv1,
    `--- CURRENT SCENE ${sceneId || ""} SCRIPT ONLY ---`,
    sceneText || "",
    continuityText ? `--- CONTINUITY INPUTS ---\n${continuityText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildMotionStagePrompt({
  nv2 = "",
  sceneText = "",
  sceneId = "",
} = {}) {
  return [
    '--- MOTION_STAGE / NV2_MOTION_PROMPT ---',
    nv2,
    `--- CURRENT SCENE ${sceneId || ""} SCRIPT ONLY ---`,
    sceneText || "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function collectPrepromptRequestFiles({ outputFolder = "" } = {}) {
  const prepromptDir = await ensureProjectPrepromptFolder(outputFolder || "");
  const files = await fs
    .readdir(prepromptDir, { withFileTypes: true })
    .catch((error) => {
      if (error?.code === "ENOENT") return [];
      throw error;
    });
  const fileNames = files
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return fileNames.map((fileName) => path.join(prepromptDir, fileName));
}

async function openGrokRouterFolder() {
  const routerPath = path.join(
    __dirname,
    "..",
    "dev_sandbox_grok_account_router",
  );
  await fs.mkdir(routerPath, { recursive: true });
  await shell.openPath(routerPath);
  return { ok: true, path: routerPath };
}

async function listGrokAccountsSafe() {
  return getSafeGrokAccounts();
}

app.setName("Vidora");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: "Vidora",
    icon: path.join(__dirname, "vidora-icon.svg"),
    backgroundColor: "#090b16",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

function broadcastPipelineLogVisibility() {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed())
      win.webContents.send("view:pipeline-log-visible", showPipelineLog);
  });
}

function sendProjectMenuCommand(command) {
  const win =
    BrowserWindow.getFocusedWindow() ||
    BrowserWindow.getAllWindows().find((item) => !item.isDestroyed());
  if (!win || win.isDestroyed()) return;
  win.webContents.send("project:menu-command", command);
}

function buildAppMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "New Project",
          accelerator: "CmdOrCtrl+N",
          click: () => sendProjectMenuCommand("new"),
        },
        {
          label: "Open Project...",
          accelerator: "CmdOrCtrl+O",
          click: () => sendProjectMenuCommand("open"),
        },
        {
          label: "Save Project",
          accelerator: "CmdOrCtrl+S",
          click: () => sendProjectMenuCommand("save"),
        },
        {
          label: "Settings...",
          accelerator: "CmdOrCtrl+,",
          click: () => sendProjectMenuCommand("settings"),
        },
        { type: "separator" },
        { role: "quit", label: "Quit" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload", label: "Reload" },
        { role: "forceReload", label: "Force Reload" },
        { role: "toggleDevTools", label: "Toggle Developer Tools" },
        { type: "separator" },
        {
          label: "Hiện log workflow",
          type: "checkbox",
          checked: showPipelineLog,
          click: (item) => {
            showPipelineLog = Boolean(item.checked);
            broadcastPipelineLogVisibility();
          },
        },
        { type: "separator" },
        { role: "resetZoom", label: "Actual Size" },
        { role: "zoomIn", label: "Zoom In" },
        { role: "zoomOut", label: "Zoom Out" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Toggle Full Screen" },
      ],
    },
    { role: "windowMenu", label: "Window" },
    { role: "help", label: "Help" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function getPipelineLogVisibility() {
  return showPipelineLog;
}

async function openWebLogin(_event, provider) {
  const normalizedProvider = normalizeWebProvider(provider);
  const targetUrl =
    PROVIDER_META[normalizedProvider]?.url || PROVIDER_META.chatgpt.url;
  const page = await getCdpPage(normalizedProvider, true);
  await recoverProviderFromCacheOrChallenge(
    page,
    normalizedProvider,
    "open-login",
  ).catch(() => null);
  await page.Page.bringToFront().catch(() => null);
  await page.close().catch(() => null);
  return {
    ok: true,
    url: targetUrl,
    profilePath: CHROME_USER_DATA_DIR,
    port: CHROME_DEBUG_PORT,
  };
}

function normalizeWebProvider(provider) {
  return ["grok", "pixverse", "chatgpt"].includes(provider)
    ? provider
    : "chatgpt";
}

async function closeChromeDebug() {
  for (const win of webWindows.values()) {
    try {
      if (!win.isDestroyed()) win.close();
    } catch (_error) {}
  }
  webWindows.clear();
  try {
    const tabs = await readJson(`${CHROME_CDP_HOST}/json/list`);
    await Promise.all(
      (tabs || []).map((tab) =>
        tab.id
          ? readJson(`${CHROME_CDP_HOST}/json/close/${tab.id}`).catch(
              () => null,
            )
          : null,
      ),
    );
  } catch (_error) {}
  if (chromeProcess?.pid) {
    try {
      process.kill(chromeProcess.pid);
    } catch (_error) {}
  }
  chromeProcess = null;
}

async function ensureChromeDebug(openUrl) {
  if (await isChromeDebugReady()) {
    return true;
  }

  await fs.mkdir(CHROME_USER_DATA_DIR, { recursive: true });
  const chromePath = findChromeExecutable();
  const args = [
    `--remote-debugging-port=${CHROME_DEBUG_PORT}`,
    `--user-data-dir=${CHROME_USER_DATA_DIR}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-popup-blocking",
    openUrl || "about:blank",
  ];
  chromeProcess = spawn(chromePath, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  chromeProcess.unref();

  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    if (await isChromeDebugReady()) return true;
    await sleep(500);
  }
  throw new Error(
    `Không mở được Chrome debug ở port ${CHROME_DEBUG_PORT}. Hãy đóng Chrome debug cũ hoặc đổi port.`,
  );
}

async function isChromeDebugReady() {
  try {
    const response = await fetch(`${CHROME_CDP_HOST}/json/version`);
    return response.ok;
  } catch (_error) {
    return false;
  }
}

async function openCdpTab(url) {
  const response = await fetch(
    `${CHROME_CDP_HOST}/json/new?${encodeURIComponent(url)}`,
    { method: "PUT" },
  );
  if (!response.ok) {
    throw new Error(`Không mở được tab Chrome CDP: ${response.status}`);
  }
  return response.json();
}

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(
      process.env.LOCALAPPDATA || "",
      "Google\\Chrome\\Application\\chrome.exe",
    ),
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      require("fs").accessSync(candidate);
      return candidate;
    } catch (_error) {
      // try next candidate
    }
  }

  try {
    return execFileSync("where", ["chrome"], { encoding: "utf8" })
      .split(/\r?\n/)
      .find(Boolean);
  } catch (_error) {
    throw new Error(
      "Không tìm thấy Chrome/Edge. Hãy cài Chrome hoặc set biến môi trường CHROME_PATH.",
    );
  }
}
async function chooseFolder() {
  const result = await dialog.showOpenDialog({
    title: "Chọn folder chứa video đã tạo",
    properties: ["openDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

async function scanFolder(_event, folderPath) {
  if (!folderPath) {
    return [];
  }

  const videos = [];
  const collectFromDir = async (dir, sceneHint = null) => {
    const entries = await fs
      .readdir(dir, { withFileTypes: true })
      .catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const match = entry.name.match(/^scene[_-]?(\d+)/i);
        await collectFromDir(fullPath, match ? Number(match[1]) : sceneHint);
        continue;
      }
      if (
        !entry.isFile() ||
        !VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      )
        continue;
      if (
        /^(master|final)_?video|^master_video$/i.test(
          path.basename(entry.name, path.extname(entry.name)),
        )
      )
        continue;
      const stat = await fs.stat(fullPath);
      const sceneNumber = getSceneNumber(entry.name) ?? sceneHint;
      const keyframePath = sceneNumber
        ? path.join(
            path.dirname(fullPath),
            `scene_${String(sceneNumber).padStart(3, "0")}_keyframe.png`,
          )
        : "";
      videos.push({
        name: entry.name,
        path: fullPath,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        sceneNumber,
        keyframePath:
          keyframePath && (await pathExists(keyframePath)) ? keyframePath : "",
      });
    }
  };

  await collectFromDir(folderPath);
  return videos.sort((a, b) => {
    const sceneA = a.sceneNumber ?? Number.MAX_SAFE_INTEGER;
    const sceneB = b.sceneNumber ?? Number.MAX_SAFE_INTEGER;
    if (sceneA !== sceneB) return sceneA - sceneB;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

function getSceneNumber(fileName) {
  const match = path
    .basename(fileName, path.extname(fileName))
    .match(/^\D*0*(\d+)/);
  return match ? Number(match[1]) : null;
}

async function extractLastFrameToPathHandler(_event, { videoPath, outputPath, runId = '' }) {
  const scopedRunId = String(runId || "").trim();
  assertPipelineRunActive(scopedRunId);
  if (!videoPath || !outputPath) {
    throw new Error("Thiếu videoPath hoặc outputPath để trích xuất frame.");
  }
  const result = await extractLastFrameToPath(videoPath, outputPath);
  assertPipelineRunActive(scopedRunId);
  if (!result || !result.ok) {
    throw new Error(result?.error || "Trích xuất khung hình cuối thất bại.");
  }
  return result;
}

async function extractLastFrame(_event, videoPath) {
  return extractLastFrameFromVideo(videoPath);
}

async function extractLastFrameFromVideo(videoPath) {
  if (!videoPath) {
    throw new Error("Thiếu đường dẫn video.");
  }

  const folder = path.dirname(videoPath);
  const baseName = path.basename(videoPath, path.extname(videoPath));
  const framesFolder = path.join(folder, "_last_frames");
  const outputPath = path.join(framesFolder, `${baseName}_last_frame.png`);

  await fs.mkdir(framesFolder, { recursive: true });
  await runFfmpeg([
    "-y",
    "-i",
    videoPath,
    "-vf",
    "reverse",
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outputPath,
  ]);

  return outputPath;
}

function normalizeContinuityReferenceSettings(settings = {}) {
  const maxKeyFrames = Math.max(
    0,
    Math.min(3, Number(settings.maxKeyFrames ?? 3) || 3),
  );
  return {
    enabled: settings.enabled !== false,
    includeLastFrame: settings.includeLastFrame !== false,
    maxKeyFrames,
    sendToChatGPT: settings.sendToChatGPT !== false,
    sendToGrok: settings.sendToGrok === true,
  };
}

function getContinuityReferenceDir(projectDir = "", sceneId = "") {
  return path.join(
    projectDir,
    "continuity_refs",
    `scene_${String(sceneId).padStart(3, "0")}`,
  );
}

function formatFfmpegTimestamp(seconds = 0) {
  return Math.max(0, Number(seconds) || 0).toFixed(3);
}

async function probeVideoDurationSeconds(videoPath = "") {
  return new Promise((resolve) => {
    const runId = getScopedPipelineRunId();
    const child = spawn(
      getFfmpegBinaryPath(),
      ["-hide_banner", "-i", videoPath],
      { windowsHide: true },
    );
    trackPipelineChildProcess(child, runId);
    let stderr = "";
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("error", () => resolve(0));
    child.on("close", () => {
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i);
      if (!match) return resolve(0);
      const hours = Number(match[1]) || 0;
      const minutes = Number(match[2]) || 0;
      const seconds = Number(match[3]) || 0;
      resolve(hours * 3600 + minutes * 60 + seconds);
    });
  });
}

async function validateContinuityReferenceImage(filePath = "") {
  if (!filePath || !(await pathExists(filePath)))
    return { ok: false, error: "missing-file", filePath };
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat || stat.size < 2048)
    return {
      ok: false,
      error: "file-too-small",
      filePath,
      size: stat?.size || 0,
    };
  const image = nativeImage.createFromPath(filePath);
  if (image.isEmpty())
    return {
      ok: false,
      error: "image-decode-failed",
      filePath,
      size: stat.size,
    };
  const size = image.getSize();
  if (size.width < 64 || size.height < 64)
    return {
      ok: false,
      error: "image-dimensions-too-small",
      filePath,
      size: stat.size,
      width: size.width,
      height: size.height,
    };
  return {
    ok: true,
    filePath,
    size: stat.size,
    width: size.width,
    height: size.height,
  };
}

async function extractVideoFrameAtSeconds(
  videoPath = "",
  outputPath = "",
  seconds = 0,
) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await runFfmpeg([
    "-y",
    "-ss",
    formatFfmpegTimestamp(seconds),
    "-i",
    videoPath,
    "-frames:v",
    "1",
    outputPath,
  ]);
  return validateContinuityReferenceImage(outputPath);
}

async function extractLastFrameToPath(videoPath = "", outputPath = "") {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const duration = await probeVideoDurationSeconds(videoPath).catch(() => 0);
  if (duration > 0.5) {
    const nearEnd = Math.max(0, duration - 0.15);
    const quick = await extractVideoFrameAtSeconds(
      videoPath,
      outputPath,
      nearEnd,
    ).catch((error) => ({ ok: false, error: error.message }));
    if (quick?.ok) return quick;
  }
  await runFfmpeg([
    "-y",
    "-i",
    videoPath,
    "-vf",
    "reverse",
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outputPath,
  ]);
  return validateContinuityReferenceImage(outputPath);
}

function getSceneMediaPaths(sceneDir = "", sceneId = "", runId = "") {
  const sceneToken = `scene_${String(sceneId).padStart(3, "0")}`;
  const safeRunToken =
    String(runId || "manual")
      .replace(/[^a-z0-9_-]/gi, "")
      .slice(0, 48) || "manual";
  return {
    sceneToken,
    sceneDir,
    videoPath: path.join(sceneDir, `${sceneToken}_video.mp4`),
    candidateVideoPath: path.join(
      sceneDir,
      `${sceneToken}_video_${safeRunToken}_candidate.mp4`,
    ),
    lastFramePath: path.join(sceneDir, `${sceneToken}_last_frame.png`),
  };
}

function isTemporaryDownloadPath(filePath = "") {
  const baseName = path.basename(String(filePath || "")).toLowerCase();
  const ext = path.extname(baseName);
  return (
    TEMP_VIDEO_EXTENSIONS.has(ext) ||
    /\.(crdownload|part|tmp|download|downloading)$/i.test(baseName)
  );
}

async function waitForStableFileSize(filePath = "", options = {}) {
  const runId = String(options.runId || getScopedPipelineRunId() || "").trim();
  const checks = Math.max(2, Number(options.checks || 3) || 3);
  const intervalMs = Math.max(200, Number(options.intervalMs || 750) || 750);
  let previousSize = -1;
  let stableCount = 0;
  for (let attempt = 0; attempt < checks + 8; attempt += 1) {
    assertPipelineRunActive(runId);
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat?.isFile()) throw new Error(`video-file-missing:${filePath}`);
    if (stat.size > 0 && stat.size === previousSize) {
      stableCount += 1;
      if (stableCount >= checks) return stat;
    } else {
      previousSize = stat.size;
      stableCount = 0;
    }
    await sleep(intervalMs);
  }
  throw new Error(`video-file-not-stable:${filePath}`);
}

async function validateLocalVideoFile(filePath = "", options = {}) {
  const runId = String(options.runId || getScopedPipelineRunId() || "").trim();
  assertPipelineRunActive(runId);
  if (!filePath) throw new Error("missing-video-path");
  if (isTemporaryDownloadPath(filePath))
    throw new Error(`temporary-video-download:${filePath}`);
  const ext = path.extname(filePath).toLowerCase();
  if (!VIDEO_EXTENSIONS.has(ext))
    throw new Error(`unsupported-video-extension:${ext || "none"}`);
  const stableStat = await waitForStableFileSize(filePath, { runId });
  assertPipelineRunActive(runId);
  const validation = await validateGeneratedVideoFile(filePath);
  assertPipelineRunActive(runId);
  return { ...validation, stableSize: stableStat.size };
}

function getVeoUpVideoSourcePath(result = {}) {
  const candidates = [
    result.sourceDownloadPath,
    result.downloadedVideoPath,
    result.localVideoPath,
    result.outputVideoPath,
    result.finalVideoPath,
    result.videoPath,
  ];
  return String(
    candidates.find((item) => item && typeof item === "string") || "",
  ).trim();
}

function assertVeoUpResultAssociation(
  result = {},
  { runId = "", sceneId = "" } = {},
) {
  if (result.runId && String(result.runId) !== String(runId)) {
    throw new Error(`veoup-video-run-mismatch:${result.runId}`);
  }
  if (result.sceneId && String(result.sceneId) !== String(sceneId)) {
    throw new Error(`veoup-video-scene-mismatch:${result.sceneId}`);
  }
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

async function extractContinuityReferencesFromVideo(
  videoPath = "",
  projectDir = "",
  sourceSceneId = 0,
  settings = {},
) {
  const normalized = normalizeContinuityReferenceSettings(settings);
  if (!normalized.enabled)
    return {
      ok: true,
      skipped: true,
      reason: "disabled",
      sourceSceneId,
      paths: [],
      keyFramePaths: [],
    };
  if (!videoPath || !(await pathExists(videoPath))) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `continuityRefs: extraction skipped reason=missing-previous-video scene=${sourceSceneId}`,
      details: { sourceSceneId, video: path.basename(videoPath || "") },
    });
    return {
      ok: false,
      skipped: true,
      reason: "missing-previous-video",
      sourceSceneId,
      paths: [],
      keyFramePaths: [],
    };
  }
  const referenceDir = getContinuityReferenceDir(projectDir, sourceSceneId);
  const lastFramePath = path.join(referenceDir, "last_frame.png");
  const keyFramePaths = Array.from(
    { length: normalized.maxKeyFrames },
    (_item, index) =>
      path.join(referenceDir, `key_${String(index + 1).padStart(2, "0")}.png`),
  );
  const expectedPaths = [
    ...(normalized.includeLastFrame ? [lastFramePath] : []),
    ...keyFramePaths,
  ];
  const existingValid = [];
  for (const refPath of expectedPaths) {
    const validation = await validateContinuityReferenceImage(refPath).catch(
      (error) => ({ ok: false, error: error.message }),
    );
    if (validation?.ok) existingValid.push(refPath);
  }
  if (existingValid.length === expectedPaths.length && existingValid.length) {
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: `continuityRefs: validation passed scene=${sourceSceneId} count=${existingValid.length}`,
      details: {
        sourceSceneId,
        paths: existingValid.map((item) => path.basename(item)),
      },
    });
    return {
      ok: true,
      reused: true,
      sourceSceneId,
      referenceDir,
      lastFramePath: normalized.includeLastFrame ? lastFramePath : "",
      keyFramePaths,
      paths: existingValid,
    };
  }

  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `continuityRefs: extracting from previous video scene=${sourceSceneId}`,
    details: { sourceSceneId, video: path.basename(videoPath), referenceDir },
  });
  await fs.mkdir(referenceDir, { recursive: true });
  const paths = [];
  const warnings = [];
  if (normalized.includeLastFrame) {
    const lastValidation = await extractLastFrameToPath(
      videoPath,
      lastFramePath,
    ).catch((error) => ({ ok: false, error: error.message }));
    if (lastValidation?.ok) {
      paths.push(lastFramePath);
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: `continuityRefs: extracted last frame=${path.basename(lastFramePath)}`,
        details: {
          sourceSceneId,
          file: path.basename(lastFramePath),
          width: lastValidation.width,
          height: lastValidation.height,
        },
      });
    } else {
      warnings.push({
        file: path.basename(lastFramePath),
        error: lastValidation?.error || "last-frame-failed",
      });
    }
  }

  const duration = await probeVideoDurationSeconds(videoPath).catch(() => 0);
  const fractions = [0.25, 0.5, 0.75].slice(0, normalized.maxKeyFrames);
  const keyRefs = [];
  for (let index = 0; index < fractions.length; index += 1) {
    const outputPath = keyFramePaths[index];
    const seconds =
      duration > 0 ? Math.max(0, duration * fractions[index]) : index + 1;
    const validation = await extractVideoFrameAtSeconds(
      videoPath,
      outputPath,
      seconds,
    ).catch((error) => ({ ok: false, error: error.message }));
    if (validation?.ok) {
      keyRefs.push(outputPath);
      paths.push(outputPath);
    } else {
      warnings.push({
        file: path.basename(outputPath),
        error: validation?.error || "key-frame-failed",
      });
    }
  }
  await appendAppLog(null, {
    source: "main",
    kind: keyRefs.length ? "ok" : "running",
    text: `continuityRefs: extracted key frames count=${keyRefs.length}`,
    details: {
      sourceSceneId,
      files: keyRefs.map((item) => path.basename(item)),
      warnings,
    },
  });
  const finalValid = [];
  for (const refPath of paths.slice(0, 4)) {
    const validation = await validateContinuityReferenceImage(refPath).catch(
      (error) => ({ ok: false, error: error.message }),
    );
    if (validation?.ok) finalValid.push(refPath);
    else
      warnings.push({
        file: path.basename(refPath),
        error: validation?.error || "validation-failed",
      });
  }
  if (finalValid.length)
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: "continuityRefs: validation passed",
      details: {
        sourceSceneId,
        count: finalValid.length,
        files: finalValid.map((item) => path.basename(item)),
      },
    });
  else
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: "continuityRefs: extraction skipped reason=no-valid-reference-frames",
      details: { sourceSceneId, warnings },
    });
  return {
    ok: Boolean(finalValid.length),
    sourceSceneId,
    referenceDir,
    lastFramePath: normalized.includeLastFrame ? lastFramePath : "",
    keyFramePaths: keyRefs,
    paths: finalValid,
    warnings,
  };
}

async function copyImageToClipboard(_event, imagePath) {
  if (!imagePath) {
    throw new Error("Thiếu đường dẫn ảnh.");
  }

  const image = nativeImage.createFromPath(imagePath);
  if (image.isEmpty()) {
    throw new Error("Không đọc được ảnh frame cuối.");
  }

  clipboard.writeImage(image);
  return true;
}

async function getPreviousFrame(_event, folderPath, currentSceneIndex) {
  const previousSceneIndex = Number(currentSceneIndex) - 1;
  if (!folderPath || previousSceneIndex < 1) {
    return null;
  }

  const videos = await scanFolder(null, folderPath);
  const previousVideo = videos.find(
    (video) => video.sceneNumber === previousSceneIndex,
  );
  if (!previousVideo) {
    return null;
  }

  const framePath = await extractLastFrameFromVideo(previousVideo.path);
  return {
    framePath,
    previousSceneIndex,
    videoName: previousVideo.name,
  };
}

async function mergeVideos(_event, folderPath, options = {}) {
  // Stripped out post-pipeline video merging triggers & FFmpeg aggregation loops
  const totalScenes =
    (await scanFolder(null, folderPath)).filter(
      (file) => file.name && /scene_\d+/i.test(file.name),
    ).length || 50;
  const cleanSuccessMsg = `[Pipeline Chain] All ${totalScenes} scenes processed. Script files aggregated at project root. Automation complete!`;
  console.log(cleanSuccessMsg);
  await appendAppLog(null, {
    source: "main",
    kind: "ok",
    text: cleanSuccessMsg,
  }).catch(() => null);

  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: "Global completion: final merge preview skipped; per-scene VeoUp pipeline already produced validated videos.",
  }).catch(() => null);

  return {
    ok: true,
    skipped: true,
    count: totalScenes,
    outputPath: "",
    veoupResult: null,
  };
}

async function exportFinalVideo(_event, folderPath) {
  // Stripped out post-pipeline video merging triggers & FFmpeg aggregation loops
  return null;
}

async function mergeVideoFiles(videos, outputPath) {
  const listPath = path.join(path.dirname(outputPath), "_concat_list.txt");
  const listContent = videos
    .map((video) => `file '${video.path.replaceAll("'", "'\\''")}'`)
    .join("\n");

  await fs.writeFile(listPath, listContent, "utf8");
  await runFfmpeg([
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    outputPath,
  ]);
}


function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const runId = getScopedPipelineRunId();
    assertPipelineRunActive(runId);
    const binaryPath = getFfmpegBinaryPath();
    const child = spawn(binaryPath, args, { windowsHide: true });
    trackPipelineChildProcess(child, runId);
    let stderr = "";

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      reject(
        new Error(`Không chạy được FFmpeg (${binaryPath}). ${error.message}`),
      );
    });

    child.on("close", (code) => {
      try {
        assertPipelineRunActive(runId);
      } catch (error) {
        reject(error);
        return;
      }
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`FFmpeg lỗi code ${code}: ${stderr.slice(-1200)}`));
    });
  });
}

async function splitPromptWithAI(_event, options) {
  const {
    provider,
    apiKey,
    model,
    basePrompt,
    totalSegments,
    segmentSeconds,
    style,
    notes,
  } = options || {};

  if (!apiKey || !apiKey.trim()) {
    throw new Error("Chưa nhập API key.");
  }
  if (!basePrompt || !basePrompt.trim()) {
    throw new Error("Chưa nhập prompt tổng.");
  }

  const systemPrompt = `Bạn là biên kịch/đạo diễn video AI. Nhiệm vụ: tách prompt tổng thành các scene nối tiếp nhau, mỗi scene có nội dung riêng cụ thể, không lặp ý. Trả về JSON hợp lệ duy nhất, không markdown, không giải thích.`;
  const userPrompt = `Prompt tổng: ${basePrompt}\nSố scene cần tạo: ${totalSegments}\nThời lượng mỗi scene tối đa: ${segmentSeconds}s\nPhong cách: ${style || "cinematic realistic"}\nGhi chú: ${notes || "không có"}\n\nYêu cầu JSON:\n{\n  "beats": [\n    {\n      "title": "mục tiêu cảnh cụ thể",\n      "setting": "bối cảnh riêng, thời điểm/địa điểm cụ thể",\n      "subject": "chủ thể ở trạng thái riêng của scene",\n      "action": "hành động bắt buộc, cụ thể, khác scene trước",\n      "evolution": "ý nghĩa tiến triển/nhân quả của scene này",\n      "camera": "góc máy/chuyển động camera riêng",\n      "endFrame": "mô tả frame cuối sạch để nối scene sau, kèm trạng thái ánh sáng/exposure ổn định"\n    }\n  ]\n}\n\nQuy tắc bắt buộc:\n- beats.length đúng bằng ${totalSegments}.\n- Từ scene 2 trở đi phải phát triển từ scene trước nhưng không lặp cùng mô tả.\n- Mỗi scene phải có bối cảnh, hành động, chủ thể và frame cuối khác nhau.\n- Phải giữ continuity ánh sáng giữa frame cuối scene trước và frame đầu scene sau: không tăng sáng đột ngột, không auto-exposure, không đổi white balance/gamma/contrast ở điểm nối.\n- Nếu cần đổi ánh sáng vì nội dung scene, mô tả đổi rất chậm sau 1 giây hold đầu, không đổi ngay tại frame nối.\n- Ưu tiên tiếng Việt, giàu hình ảnh, dùng được ngay cho AI video.`;

  const text = await callAIProvider({
    provider,
    apiKey,
    model,
    systemPrompt,
    userPrompt,
  });
  const parsed = parseJsonFromModel(text);
  if (!Array.isArray(parsed.beats) || parsed.beats.length === 0) {
    throw new Error("Model không trả về beats hợp lệ.");
  }

  return parsed.beats.slice(0, Number(totalSegments)).map((beat, index) => ({
    title: String(beat.title || `Scene ${index + 1}`),
    setting: String(beat.setting || ""),
    subject: String(beat.subject || ""),
    action: String(beat.action || ""),
    evolution: String(beat.evolution || ""),
    camera: String(beat.camera || "cinematic smooth camera"),
    endFrame: String(
      beat.endFrame || "frame cuối sạch, rõ chủ thể để nối scene sau",
    ),
  }));
}

async function callAIProvider({
  provider,
  apiKey,
  model,
  systemPrompt,
  userPrompt,
}) {
  if (provider === "gemini") {
    const geminiModel = model || "gemini-1.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json",
          },
        }),
      },
    );
    const data = await readJsonResponse(response);
    return (
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .join("\n") || ""
    );
  }

  if (provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-3-5-haiku-latest",
        max_tokens: 4096,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    const data = await readJsonResponse(response);
    return data.content?.map((part) => part.text || "").join("\n") || "";
  }

  const baseUrl =
    provider === "openrouter"
      ? "https://openrouter.ai/api/v1/chat/completions"
      : provider === "ninerouter"
        ? "http://localhost:20128/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(provider === "openrouter"
        ? {
            "HTTP-Referer": "http://localhost",
            "X-Title": "AI Video Prompt Planner",
          }
        : {}),
    },
    body: JSON.stringify({
      model:
        model ||
        (provider === "openrouter"
          ? "openai/gpt-4o-mini"
          : provider === "ninerouter"
            ? "cx/gpt-5.5"
            : "gpt-4o-mini"),
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  const data = await readJsonResponse(response);
  return data.choices?.[0]?.message?.content || "";
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`API lỗi ${response.status}: ${text.slice(0, 600)}`);
  }
  return JSON.parse(text);
}

function parseJsonFromModel(text) {
  const trimmed = String(text || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Model không trả về JSON.");
    }
    return JSON.parse(match[0]);
  }
}

async function generateScenePrompts(_event, options) {
  const {
    provider,
    apiKey,
    model,
    projectName,
    story,
    scene,
    durationSec,
    imageRules,
    motionRules,
    storyRules,
  } = options || {};

  if (!scene?.original) {
    throw new Error("Thiếu scene hiện tại.");
  }

  const localFallback = !apiKey || !apiKey.trim();
  if (localFallback) {
    return buildLocalScenePrompts({
      projectName,
      story,
      scene,
      durationSec,
      imageRules,
      motionRules,
      storyRules,
    });
  }

  const systemPrompt =
    "Bạn là dashboard backend cho workflow sản xuất video AI. Trả về JSON hợp lệ duy nhất, không markdown, gồm imagePrompt và motionPrompt. Tuân thủ nghiêm file quy trình, prompt mẫu tạo ảnh keyframe và prompt mẫu motion 7 dòng.";
  const userPrompt = [
    `Project: ${projectName || "Untitled"}`,
    `Global story context + character bible + continuity: ${story || ""}`,
    scene.previous
      ? `Previous scene: ${scene.previous}`
      : "Previous scene: none",
    `Current scene ${scene.id}: ${scene.original}`,
    scene.next ? `Next scene: ${scene.next}` : "Next scene: none",
    `Duration: ${durationSec || 10}s`,
    `Story rules:\n${storyRules || ""}`,
    `Image keyframe rules:\n${imageRules || ""}`,
    `Motion prompt rules:\n${motionRules || ""}`,
    "Yêu cầu output JSON:",
    '{ "imagePrompt": "prompt ảnh keyframe đầu scene", "motionPrompt": "prompt video 7 dòng" }',
    "imagePrompt phải dựng hiện trường đầu scene, 16:9, 8K live action, continuity 1-1, spatial lock.",
    "SAFETY BẮT BUỘC: nếu story có nhân vật trẻ em/cô bé/cậu bé/teen thì hãy chuyển thành người trưởng thành 25+ tuổi; tuyệt đối không mô tả trẻ em, học sinh, vị thành niên, teen, child, minor.",
    "motionPrompt phải đúng format 7 dòng, chỉ mô tả từ keyframe, có âm thanh diegetic, không nhạc, hành động hoàn tất 100%.",
  ].join("\n\n");

  const text = await callAIProvider({
    provider,
    apiKey,
    model,
    systemPrompt,
    userPrompt,
  });
  const parsed = parseJsonFromModel(text);
  return {
    imagePrompt: String(parsed.imagePrompt || "").trim(),
    motionPrompt: String(parsed.motionPrompt || "").trim(),
  };
}

function buildLocalScenePrompts({
  projectName,
  story,
  scene,
  durationSec,
  imageRules,
  motionRules,
  storyRules,
}) {
  const imagePrompt = [
    `IMAGE PROMPT — SCENE ${scene.id} — KEYFRAME ĐẦU CẢNH`,
    `Project: ${projectName || "Untitled"}`,
    `Global story context: ${story || ""}`,
    scene.previous
      ? `Scene trước để giữ continuity: ${scene.previous}`
      : "Scene trước: không có, đây là cảnh mở đầu.",
    `Scene hiện tại: ${scene.original}`,
    scene.next
      ? `Scene sau để định hướng nối mạch: ${scene.next}`
      : "Scene sau: không có hoặc chưa cần.",
    storyRules || "",
    imageRules || "",
    "SAFETY BẮT BUỘC: tất cả nhân vật phải là người trưởng thành 25+ tuổi. Nếu scene gốc nói cô bé/cậu bé/trẻ em/teen/học sinh/minor thì chuyển thành người trưởng thành 25+ tuổi, không dùng từ trẻ em/teen/minor trong prompt ảnh.",
    "OUTPUT: 1 ảnh duy nhất 16:9, 8K ultra-realistic live action. Dựng hiện trường ở khoảnh khắc chuẩn bị diễn hành động đầu tiên, wide/master shot, rõ vị trí nhân vật, đạo cụ, hướng chuyển động, ánh sáng mạnh trong trẻo, không text/logo/watermark.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const motionPrompt = [
    `MOTION PROMPT — SCENE ${scene.id} — VIDEO ${durationSec || 10} GIÂY`,
    `Scene hiện tại: ${scene.original}`,
    motionRules || "",
    "DÒNG 1: TỔNG QUÁT KHUNG HÌNH: liệt kê chính xác nhân vật/đạo cụ/bối cảnh trong keyframe, chỉ mô tả tạo hình, không ghi tên riêng.",
    "DÒNG 2: NỘI DUNG VIDEO CHUYỂN ĐỘNG: bắt đầu từ đúng keyframe, mô tả 1 ý chính và tối đa 1-2 chuyển động chính theo chuỗi nhân quả, hành động hoàn tất 100%, chuyển động mạnh rõ nếu là cảnh kịch tính.",
    "DÒNG 3: CHUYỂN ĐỘNG PHỤ: mô tả môi trường, đạo cụ, phản ứng phụ đang có trong khung hình và không lạc bối cảnh.",
    "DÒNG 4: ÂM THANH: chỉ foley + âm thanh môi trường + tiếng nhân vật/động vật nếu có, không nhạc nền; MỌI ÂM THANH NỀN Ở BỐI CẢNH VIDEO VÀ MỌI VẬT THỂ đang chuyển động TRONG VIDEO Bắt buộc TẠO ÂM THANH VIDEO PHẢI TO VÀ RÕ RÀNG NHƯ ĐANG BẬT FULL 100% VOLUME LOA.",
    "DÒNG 5: VIDEO TẠO RA ĐÃ ĐẠT ĐƯỢC TẤT CẢ CÁC YÊU CẦU, diễn xuất đúng prompt, mọi chuyển động mượt như phim live action, không chi tiết giả tạo, tuân theo vật lý đời thực, không sáng tạo thêm ngoài prompt.",
    "DÒNG 6: Technical Specifications: 8K ultra-realistic, extreme sharp details, real-world gravity, authentic cloth and fur simulation, consistent powerful natural daylight, high dynamic range (HDR), hyper-smooth 240 FPS motion, organic motion blur only where physically correct. Live action cinematic quality, razor-sharp, true-to-life textures.",
    "DÒNG 7: Negative Prompt: low quality, blurry, out of focus, temporal artifacts, noisy, grainy, inconsistent face, inconsistent clothing, foot skating, sliding, teleporting props, disappearing objects, readable text, subtitles, watermark, logo, cartoon, anime, CGI skin, random stopping, sudden jump cuts, night time, sunset, low light, NO background music, NO cinematic music, NO soundtrack, NO added music, NO score, NO dramatic music, NO film music, NO MUSIC, dialogue, NO SLOW MOTION.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { imagePrompt, motionPrompt };
}

async function chooseOutputFolder() {
  const result = await dialog.showOpenDialog({
    title: "Chọn folder lưu kết quả prompt web",
    properties: ["openDirectory", "createDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
}

async function chooseProjectRootFolder() {
  const result = await dialog.showOpenDialog({
    title: "Chọn vị trí lưu project Vidora",
    properties: ["openDirectory", "createDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
}

async function checkWebLogin(_event, provider, options = {}) {
  const normalizedProvider = normalizeWebProvider(provider);
  const autoOpenSaved = Boolean(
    options?.autoOpenSaved && normalizedProvider === "grok",
  );
  let page;
  try {
    page = await getCdpPage(normalizedProvider, autoOpenSaved, {
      bringToFront: Boolean(options?.bringToFront),
      recover: autoOpenSaved,
    });
  } catch (error) {
    const state = {
      loggedIn: false,
      reason: "no-existing-provider-tab",
      detail: error.message,
      autoOpenSaved,
      cdp: true,
      port: CHROME_DEBUG_PORT,
      profilePath: CHROME_USER_DATA_DIR,
    };
    await appendAppLog(null, {
      source: "main",
      kind: autoOpenSaved ? "error" : "running",
      text: autoOpenSaved
        ? `Login check ${normalizedProvider}: không mở được saved profile tab`
        : `Login check ${normalizedProvider}: no existing tab; skipped opening a new tab`,
      details: state,
    });
    return state;
  }
  let state = { loggedIn: false };
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    state = await evaluateOnCdpPage(
      page,
      `(${detectLoginScript.toString()})(${JSON.stringify(normalizedProvider)})`,
    ).catch((error) => ({ loggedIn: false, reason: error.message }));
    if (state.loggedIn) break;
    await sleep(1500);
  }

  if (
    !state.loggedIn &&
    shouldRecoverFromCacheOrChallenge(state, normalizedProvider)
  ) {
    const recovery = await recoverProviderFromCacheOrChallenge(
      page,
      normalizedProvider,
      "check-login",
    );
    state = await evaluateOnCdpPage(
      page,
      `(${detectLoginScript.toString()})(${JSON.stringify(normalizedProvider)})`,
    ).catch((error) => ({ loggedIn: false, reason: error.message }));
    state.cacheRecovery = recovery;
  }
  if (!state.loggedIn && ["chatgpt", "grok"].includes(normalizedProvider)) {
    const autoLogin = await tryAutoLoginWithStoredAccount(
      page,
      normalizedProvider,
      { reason: "check-login" },
    ).catch((error) => ({ ok: false, error: error.message }));
    state.autoLogin = autoLogin;
    if (autoLogin?.ok) {
      state = await evaluateOnCdpPage(
        page,
        `(${detectLoginScript.toString()})(${JSON.stringify(normalizedProvider)})`,
      ).catch((error) => ({ loggedIn: false, reason: error.message }));
      state.autoLogin = autoLogin;
    } else if (autoLogin?.noStoredAccount) {
      state.noStoredAccount = true;
    }
  }
  await appendAppLog(null, {
    source: "main",
    kind: state.loggedIn ? "ok" : "error",
    text: `Login check ${normalizedProvider}: ${state.loggedIn ? "logged in" : "not logged in"} (${state.reason || state.title || state.url || ""})`,
    details: state,
  });
  const capability = ["grok", "pixverse"].includes(normalizedProvider)
    ? await evaluateOnCdpPage(
        page,
        `(${detectVideoCapabilityScript.toString()})(${JSON.stringify(normalizedProvider)})`,
      ).catch((error) => ({ ok: false, error: error.message }))
    : null;
  if (
    !state.loggedIn &&
    autoOpenSaved &&
    state.reason !== "no-existing-provider-tab"
  ) {
    await page.Page.bringToFront().catch(() => null);
  }
  await page.close().catch(() => null);
  return {
    ...state,
    capability,
    autoOpenSaved,
    cdp: true,
    port: CHROME_DEBUG_PORT,
    profilePath: CHROME_USER_DATA_DIR,
  };
}

async function clearProviderSession(page, provider) {
  const normalized = normalizeCredentialProvider(provider);
  const origin = new URL(PROVIDER_META[normalized].url).origin;
  await page.Storage?.clearDataForOrigin?.({
    origin,
    storageTypes:
      "cookies,local_storage,session_storage,indexeddb,cache_storage",
  }).catch(() => null);
  await page.Network?.clearBrowserCache?.().catch(() => null);
  return { ok: true, origin };
}

async function tryAutoLoginWithStoredAccount(
  page,
  provider,
  { rotate = false, reason = "", sceneId = "" } = {},
) {
  const normalized = normalizeCredentialProvider(provider);
  const { account } = await pickWebAccount(normalized, { rotate });
  if (!account)
    return { ok: false, noStoredAccount: true, provider: normalized };
  if (rotate) await clearProviderSession(page, normalized).catch(() => null);
  const meta = PROVIDER_META[normalized];
  await page.Page.bringToFront().catch(() => null);
  await page.Page.navigate({ url: meta.url }).catch(() => null);
  await waitForCdpLoad(page).catch(() => null);
  await sleep(1200);
  let lastFill = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const state = await evaluateOnCdpPage(
      page,
      `(${detectLoginScript.toString()})(${JSON.stringify(normalized)})`,
    ).catch((error) => ({ loggedIn: false, reason: error.message }));
    if (state?.loggedIn) {
      await markWebAccountState(normalized, account.id, "active");
      return {
        ok: true,
        provider: normalized,
        accountId: account.id,
        maskedEmail: maskEmail(account.email),
        attempt,
        reason,
      };
    }
    lastFill = await evaluateOnCdpPage(
      page,
      `(${fillProviderLoginScript.toString()})(${JSON.stringify(normalized)}, ${JSON.stringify(account.email)}, ${JSON.stringify(account.password)})`,
    ).catch((error) => ({ ok: false, error: error.message }));
    await appendAppLog(null, {
      source: "main",
      kind: lastFill?.ok ? "running" : "error",
      text: `Auto-login ${normalized} ${maskEmail(account.email)} attempt ${attempt}/5: ${lastFill?.mode || lastFill?.error || "waiting"}`,
      details: {
        provider: normalized,
        accountId: account.id,
        maskedEmail: maskEmail(account.email),
        mode: lastFill?.mode || "",
        clicked: lastFill?.clicked || "",
        needsUserAction: lastFill?.needsUserAction || false,
        sceneId,
      },
    });
    await sleep(lastFill?.submitted || lastFill?.clicked ? 3200 : 1800);
  }
  const finalState = await evaluateOnCdpPage(
    page,
    `(${detectLoginScript.toString()})(${JSON.stringify(normalized)})`,
  ).catch((error) => ({ loggedIn: false, reason: error.message }));
  if (finalState?.loggedIn) {
    await markWebAccountState(normalized, account.id, "active");
    return {
      ok: true,
      provider: normalized,
      accountId: account.id,
      maskedEmail: maskEmail(account.email),
      reason,
    };
  }
  await markWebAccountState(normalized, account.id, "login_required");
  return {
    ok: false,
    provider: normalized,
    accountId: account.id,
    maskedEmail: maskEmail(account.email),
    requiresUserAction: true,
    lastFill,
    finalReason: finalState.reason || finalState.url || "",
  };
}

async function rollProviderAccount(
  page,
  provider,
  sceneId = "",
  reason = "limit",
) {
  const normalized = normalizeCredentialProvider(provider);
  await markWebAccountState(
    normalized,
    "",
    reason === "login" ? "login_required" : "limited",
  ).catch(() => null);
  const result = await tryAutoLoginWithStoredAccount(page, normalized, {
    rotate: true,
    reason,
    sceneId,
  }).catch((error) => ({ ok: false, error: error.message }));
  await notifyRenderer(
    "provider-account-roll",
    result?.ok
      ? `Scene ${sceneId}: ${PROVIDER_META[normalized].title} bị ${reason}, đã roll sang account ${result.maskedEmail}.`
      : `Scene ${sceneId}: ${PROVIDER_META[normalized].title} bị ${reason} nhưng chưa roll được account.`,
    result,
  );
  if (result?.ok) return result;
  if (result?.noStoredAccount)
    throw new Error(
      `CREDENTIAL_REQUIRED:${normalized}: Chưa có account ${PROVIDER_META[normalized].title} để tự login/roll.`,
    );
  return result;
}

async function sendPromptViaWeb(_event, options) {
  const {
    provider,
    prompt,
    outputFolder,
    projectName = "project",
    sceneId = "scene",
    promptKind = "prompt",
  } = options || {};

  if (!prompt?.trim()) {
    throw new Error("Prompt rỗng, không thể gửi.");
  }
  if (!outputFolder) {
    throw new Error("Chưa chọn folder lưu kết quả.");
  }

  const normalizedProvider = normalizeWebProvider(provider);
  const page = await getCdpPage(normalizedProvider, true);
  const loginState = await evaluateOnCdpPage(
    page,
    `(${detectLoginScript.toString()})(${JSON.stringify(normalizedProvider)})`,
  );
  if (!loginState.loggedIn) {
    throw new Error(
      loginRequiredMessage(
        normalizedProvider,
        loginState.reason || loginState.url || "",
      ),
    );
  }

  const beforeCount = await evaluateOnCdpPage(
    page,
    `(${countAssistantMessagesScript.toString()})()`,
  );
  const sent = await sendPromptViaCdpInput(page, prompt);
  if (!sent.ok) {
    throw new Error(
      sent.error || "Không tìm thấy ô nhập hoặc nút Send trong Chrome.",
    );
  }

  const responseText = await waitForCdpAssistantResponse(page, beforeCount);
  await fs.mkdir(outputFolder, { recursive: true });
  const baseName = sanitizeFileName(
    `${projectName}_scene-${sceneId}_${promptKind}_${normalizedProvider}`,
  );
  const promptPath = path.join(outputFolder, `${baseName}_prompt.txt`);
  const responsePath = path.join(outputFolder, `${baseName}_response.txt`);
  await fs.writeFile(promptPath, prompt, "utf8");
  await fs.writeFile(responsePath, responseText, "utf8");
  return { responseText, promptPath, responsePath, cdp: true };
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

async function findSceneKeyframePathSafe(sceneDir, sceneId) {
  const candidates = [
    path.join(
      sceneDir,
      `scene_${String(sceneId).padStart(3, "0")}_keyframe.png`,
    ),
    path.join(sceneDir, "scene_keyframe.png"),
    path.join(sceneDir, "keyframe.png"),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch (_error) {}
  }

  return "";
}

async function persistImageMotionOnlySharedOutputs({
  projectDir,
  sceneDir,
  sceneId,
  imagePath,
  motionPrompt,
}) {
  const safeProjectDir = projectDir || path.dirname(sceneDir);
  const sceneToken = `scene_${String(sceneId).padStart(3, "0")}`;
  const keyframesDir = path.join(safeProjectDir, "keyframes");
  const motionPromptsDir = path.join(safeProjectDir, "motion_prompts");
  await fs.mkdir(keyframesDir, { recursive: true });
  await fs.mkdir(motionPromptsDir, { recursive: true });

  const sourceImagePath =
    imagePath && (await pathExists(imagePath))
      ? imagePath
      : await findSceneKeyframePathSafe(sceneDir, sceneId);
  let keyframeOutputPath = "";
  if (sourceImagePath) {
    const extension = path.extname(sourceImagePath) || ".png";
    keyframeOutputPath = path.join(
      keyframesDir,
      `${sceneToken}_keyframe${extension}`,
    );
    if (path.resolve(sourceImagePath) !== path.resolve(keyframeOutputPath)) {
      await fs.copyFile(sourceImagePath, keyframeOutputPath);
    }
  }

  let motionPromptOutputPath = "";
  if (String(motionPrompt || "").trim()) {
    motionPromptOutputPath = path.join(
      motionPromptsDir,
      `${sceneToken}_motion_prompt.txt`,
    );
    await fs.writeFile(
      motionPromptOutputPath,
      String(motionPrompt || "").trim(),
      "utf8",
    );
  }

  return {
    keyframeOutputPath,
    motionPromptOutputPath,
    keyframesDir,
    motionPromptsDir,
  };
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

async function buildVeoUpPromptsReadyFile({
  projectDir,
  sceneDirs,
  expectedSceneCount,
}) {
  const flattenedPrompts = [];

  for (const sceneDir of sceneDirs) {
    const motionPromptPath = path.join(sceneDir, "motion_prompt.txt");
    let rawPrompt = "";
    try {
      rawPrompt = await fs.readFile(motionPromptPath, "utf8");
    } catch (err) {
      throw new Error(
        `Scene folder ${path.basename(sceneDir)} is missing motion_prompt.txt.`,
      );
    }

    const flattened = rawPrompt
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!flattened) {
      throw new Error(
        `Scene folder ${path.basename(sceneDir)} has an empty motion prompt.`,
      );
    }

    flattenedPrompts.push(flattened);
  }

  if (
    expectedSceneCount !== undefined &&
    expectedSceneCount > 0 &&
    flattenedPrompts.length !== expectedSceneCount
  ) {
    throw new Error(
      `Prompt line count mismatch: collected ${flattenedPrompts.length} prompts, expected ${expectedSceneCount}.`,
    );
  }

  const batchText = flattenedPrompts.join("\n");
  const promptsReadyPath = path.join(projectDir, "veoup_prompts_ready.txt");
  await fs.writeFile(promptsReadyPath, batchText, "utf8");

  // Verify file exists and is not empty
  try {
    const stat = await fs.stat(promptsReadyPath);
    if (stat.size <= 0) {
      throw new Error("veoup_prompts_ready.txt is empty.");
    }
  } catch (err) {
    throw new Error(
      `Failed to write or verify veoup_prompts_ready.txt: ${err.message}`,
    );
  }

  return promptsReadyPath;
}

const scenePipelineFailureTracker = {};
const DURABLE_PIPELINE_STAGES = [
  "prepare_scene",
  "nv1_prepare",
  "nv1_sent",
  "nv1_waiting_image",
  "nv1_image_validated",
  "nv2_prepare",
  "nv2_sent",
  "nv2_waiting_response",
  "nv2_saved",
  "veoup_prepare",
  "veoup_image_loaded",
  "veoup_prompt_loaded",
  "veoup_generate_started",
  "veoup_waiting_output",
  "video_validated",
  "last_frame_extracted",
  "complete",
];


function isVeoUpStageError(error) {
  const parts = [
    error?.status,
    error?.code,
    error?.message,
    error?.videoError,
    error?.videoStatus,
    error?.details?.status,
    error?.details?.error,
    error?.details?.videoError,
    error?.details?.result?.videoError,
    error?.details?.result?.videoStatus,
    error?.details?.result?.videoProvider,
    error?.details?.result?.provider,
    error?.details?.result?.status,
    error?.details?.result?.error,
    error,
  ];
  const message = parts
    .map((item) => {
      if (!item) return "";
      if (typeof item === "string") return item;
      try {
        return JSON.stringify(item);
      } catch (_error) {
        return String(item);
      }
    })
    .join(" ");
  return /veoup-launcher-not-found|veoup-pre-submission-cleanup-failed|veoup-window-not-found|output timeout|generate acknowledgement|veoup-generate-click-not-acknowledged|veoup-generate-submission-not-acknowledged|veoup-video-missing-after-submission/i.test(
    message,
  );
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

function isValidChatGptConversationUrl(url = "") {
  return /^https:\/\/chatgpt\.com\/c\/[^/?#]+/i.test(String(url || "").trim());
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
    isChatGptContextFresh = true;
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
    isChatGptContextFresh = true;
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Starting from scene 1. Resetting sessionSceneCounter and enabling sidebar selection.`,
    }).catch(() => null);
  }

  if (isChatGptContextFresh) {
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

      if (sessionSceneCounter >= 20) {
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

      if (globalThis.__vidoraSafeExitRotationScheduled) {
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
  const continuityReferenceState = {
    ok: false,
    skipped: true,
    reason: "deleted",
    paths: [],
  };
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

async function openFreshChatGptRootPage(reason = "new-chat") {
  await appendAppLog(null, {
    source: "main",
    kind: "error",
    text: `Blocked direct ChatGPT New Chat open without rotation hydration.`,
    details: { reason },
  }).catch(() => null);
  throw new Error("direct-chatgpt-new-chat-without-hydration-disabled");
}

async function assertChatGptNotExistingConversation(client, sceneId = "") {
  const location = await evaluateOnCdpPage(client, "location.href").catch(
    () => "",
  );
  if (/chatgpt\.com\/c\//i.test(String(location))) {
    throw new Error(
      `Đã chọn tạo chat mới nhưng ChatGPT vẫn đang ở conversation cũ: ${location}. Đã chặn gửi prompt/rename để không phá đoạn chat hiện tại.`,
    );
  }
  return location;
}

async function generateImageWithImageApi({
  imagePrompt,
  sceneDir,
  sceneId,
  config = {},
}) {
  const endpoint = String(
    config.endpoint || "http://localhost:20128/v1/images/generations",
  ).trim();
  const apiKey = String(config.apiKey || "").trim();
  const model = String(config.model || "cx/gpt-5.5-image").trim();
  const size = String(config.size || "1024x1024").trim();
  if (!apiKey)
    throw new Error("Chưa nhập API key cho 9Router Image API trong Settings.");
  const imagePath = path.join(
    sceneDir,
    `scene_${String(sceneId).padStart(3, "0")}_keyframe.png`,
  );
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.replace(/^Bearer\s+/i, "")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: imagePrompt,
      size,
      response_format: "b64_json",
    }),
  });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `9Router Image API lỗi HTTP ${response.status}: ${maskRouterText(detail).slice(0, 400)}`,
    );
  }
  if (/image\/|application\/octet-stream/i.test(contentType)) {
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(imagePath, buffer);
    return { imagePath, motionPrompt: "" };
  }
  const json = await response.json();
  const b64 = json?.data?.[0]?.b64_json || json?.b64_json || "";
  if (!b64) throw new Error("9Router Image API không trả về b64_json.");
  await fs.writeFile(imagePath, Buffer.from(b64, "base64"));
  await fs.writeFile(
    path.join(sceneDir, "image_api_response.json"),
    JSON.stringify(
      { model, size, endpoint, created: json.created || null },
      null,
      2,
    ),
    "utf8",
  );
  return { imagePath, motionPrompt: "" };
}


async function generateImageAndMotionWithChatGPT({
  imagePrompt,
  sceneDir,
  sceneId,
  chatContextTitle = "",
  pendingChatRenameTitle = "",
  referenceImagePaths = [],
  options = {},
}) {
  const imagePath = path.join(
    sceneDir,
    `scene_${String(sceneId).padStart(3, "0")}_keyframe.png`,
  );
  const currentSceneId = Number(sceneId);
  const projectDir = options.originalOptions?.outputFolder || path.dirname(sceneDir);

  let snapshot = await readSceneSnapshot(sceneDir);
  
  if (snapshot.imageValidated || (await pathExists(imagePath))) {
    snapshot.pipelineStage = "IMAGE_EXTRACTED";
    await writeSceneSnapshot(sceneDir, snapshot);
    return { imagePath, motionPrompt: "" };
  }

  const page = await getCdpPage("chatgpt", true);

  const loginState = await evaluateOnCdpPage(
    page,
    `(${detectLoginScript.toString()})('chatgpt')`,
  );
  if (!loginState.loggedIn) {
    const autoLogin = await tryAutoLoginWithStoredAccount(page, "chatgpt", {
      reason: "image-pipeline",
      sceneId,
    }).catch((error) => ({ ok: false, error: error.message }));
    const retryLoginState = autoLogin?.ok
      ? await evaluateOnCdpPage(
          page,
          `(${detectLoginScript.toString()})('chatgpt')`,
        ).catch(() => ({ loggedIn: false }))
      : { loggedIn: false };
    if (!retryLoginState.loggedIn) {
      await invalidateChatGptConversationIdentity("chatgpt-login-required");
      await page.close();
      if (autoLogin?.noStoredAccount)
        throw new Error(
          `CREDENTIAL_REQUIRED:chatgpt: Chưa có account ChatGPT để tự login.`,
        );
      throw new Error(
        loginRequiredMessage(
          "chatgpt",
          loginState.reason || loginState.url || autoLogin?.finalReason || "",
        ),
      );
    }
  }

  if (snapshot.pipelineStage === "WAIT_IMAGE" || snapshot.pipelineStage === "NV1_SENT") {
    await appendAppLog(sceneId, {
      source: "main",
      kind: "running",
      text: `Scene ${sceneId}: Resuming NV1 image waiting from stage ${snapshot.pipelineStage}.`
    });
    const imageNetworkCapture = startChatGptImageNetworkCapture(page, { sceneId });
    try {
      await saveChatGPTGeneratedImageAsset(page, {
        existingUrls: [],
        minAssistantRootIndex: Number(options.beforeAssistantCount || 0),
        prompt: imagePrompt,
        sceneDir,
        sceneId,
        outputPath: imagePath,
        referenceImagePaths: [],
        networkCapture: imageNetworkCapture,
        originalOptions: options,
      });
      snapshot.pipelineStage = "IMAGE_EXTRACTED";
      snapshot.imageValidated = true;
      await writeSceneSnapshot(sceneDir, snapshot);
    } finally {
      imageNetworkCapture.stop();
    }
    await page.close();
    return { imagePath, motionPrompt: "" };
  }

  snapshot.pipelineStage = "NV1_DRAFT_READY";
  snapshot.promptHash = hashChatGptSnapshotText(imagePrompt);
  snapshot.draftId = `draft-scene-${sceneId}-${Date.now()}`;
  snapshot.createdAt = new Date().toISOString();
  await writeSceneSnapshot(sceneDir, snapshot);

  if (!isChatGptContextFresh) {
    await appendAppLog(sceneId, {
      source: "main",
      kind: "info",
      text: 'Established ChatGPT context detected; preprompt files are not re-uploaded.',
    }).catch(() => null);
  }

  let pageState = await getConversationState(page);
  
  await checkProactiveMemoryGuard(sceneId, pageState);

  const isDraftMatches = verifyDraftOwnership(snapshot, pageState) && pageState.composerReady;
  
  if (isDraftMatches) {
    await appendAppLog(sceneId, {
      source: "main",
      kind: "ok",
      text: `Scene ${sceneId}: Valid unsent NV1 draft recovered in composer. Skipping upload & pasting; clicking Send.`
    });
    const clicked = await clickSendButtonViaCdp(page);
    if (!clicked.ok) {
      throw new Error(`Failed to send recovered NV1 draft: ${clicked.error}`);
    }
    snapshot.pipelineStage = "NV1_SENT";
    await writeSceneSnapshot(sceneDir, snapshot);
  } else {
    const adoptResult = await adoptExistingSceneImage(page, Number(options.beforeAssistantCount || 0), sceneId).catch(() => null);
    if (adoptResult?.ok && adoptResult.base64) {
      const sourceBuffer = Buffer.from(adoptResult.base64, "base64");
      const decoded = decodeImageBufferToPng(sourceBuffer, adoptResult.contentType);
      await fs.mkdir(path.dirname(imagePath), { recursive: true });
      await fs.writeFile(imagePath, decoded.buffer);
      await validateSavedImageFile(imagePath);
      
      snapshot.pipelineStage = "IMAGE_EXTRACTED";
      snapshot.imageValidated = true;
      await writeSceneSnapshot(sceneDir, snapshot);
      await page.close();
      return { imagePath, motionPrompt: "" };
    }

    const userPromptMatches = await evaluateOnCdpPage(
      page,
      `((promptText) => {
        const userMessages = Array.from(document.querySelectorAll('[data-message-author-role="user"]'));
        if (!userMessages.length) return false;
        const lastUser = userMessages[userMessages.length - 1];
        const lastUserText = (lastUser.textContent || lastUser.innerText || "").trim().toLowerCase();
        const cleanPrompt = promptText.trim().toLowerCase();
        return lastUserText.includes(cleanPrompt) || cleanPrompt.includes(lastUserText) || 
               (cleanPrompt.slice(0, 100) && lastUserText.includes(cleanPrompt.slice(0, 100)));
      })(${JSON.stringify(imagePrompt)})`
    ).catch(() => false);

    if (userPromptMatches) {
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: `Scene ${sceneId}: Prompt already sent. Proceeding to wait for image.`,
      });
      snapshot.pipelineStage = "WAIT_IMAGE";
      await writeSceneSnapshot(sceneDir, snapshot);
    } else {
      await evaluateOnCdpPage(
        page,
        `(() => {
          const selectors = [
            'button[aria-label*="Xóa tệp"]',
            'button[aria-label*="Remove file"]',
            'button[aria-label*="Remove"]',
            'button[aria-label*="Cancel"]',
            '[class*="file-preview"] button',
            '[class*="attachment"] [class*="remove"]',
            '[class*="attachment"] button',
            '.file-preview button',
            'main form button[class*="close"]',
            'main form button[class*="remove"]',
            'main form [data-testid*="remove"]',
            'main form [class*="Attachment"] button'
          ];
          let clickedCount = 0;
          for (const selector of selectors) {
            const elms = document.querySelectorAll(selector);
            for (const el of elms) {
              el.click();
              clickedCount++;
            }
          }
          return { ok: true, clickedCount };
        })()`
      ).catch(() => null);
      await sleep(400);

      const finalPrompt = [
        "Create exactly one image from the prompt below. Do not answer with long text. If possible, render or generate the image directly.",
        imagePrompt,
      ].filter(Boolean).join("\n\n");

      await evaluateOnCdpPage(
        page,
        `(${prepareChatGptCreateImageScript.toString()})()`,
      ).catch(() => null);
      await sleep(800);

      const filesToUpload = [];
      if (filesToUpload.length > 0 && !snapshot.hydration?.characterUploadDone) {
        const uploadRes = await uploadFilesToChatGptSequentially(page, filesToUpload, sceneId);
        if (!uploadRes.ok) {
          throw new Error(`ChatGPT sequential upload failed: ${uploadRes.error}`);
        }
        if (!snapshot.hydration) snapshot.hydration = {};
        snapshot.hydration.characterUploadDone = true;
        await writeSceneSnapshot(sceneDir, snapshot);
      }

      pageState = await getConversationState(page);
      snapshot.attachmentHashes = pageState.attachmentHashes || [];
      await writeSceneSnapshot(sceneDir, snapshot);

      await appendAppLog(sceneId, {
        source: "main",
        kind: "running",
        text: 'Scene ${sceneId}: Sending NV1.',
      }).catch(() => null);

      const sentImage = await sendPromptViaCdpInput(page, finalPrompt);
      if (!sentImage?.ok) {
        throw new Error(sentImage?.error || "IMAGE_STAGE NV1 send failed.");
      }

      if (!snapshot.hydration) snapshot.hydration = {};
      snapshot.hydration.promptUploadDone = true;
      snapshot.pipelineStage = "NV1_SENT";
      await writeSceneSnapshot(sceneDir, snapshot);
    }
  }

  const imageNetworkCapture = startChatGptImageNetworkCapture(page, { sceneId });
  try {
    snapshot.pipelineStage = "WAIT_IMAGE";
    await writeSceneSnapshot(sceneDir, snapshot);
    
    await saveChatGPTGeneratedImageAsset(page, {
      existingUrls: [],
      minAssistantRootIndex: Number(options.beforeAssistantCount || 0),
      prompt: imagePrompt,
      sceneDir,
      sceneId,
      outputPath: imagePath,
      referenceImagePaths: [],
      networkCapture: imageNetworkCapture,
      originalOptions: options,
    });
    
    snapshot.pipelineStage = "IMAGE_EXTRACTED";
    snapshot.imageValidated = true;
    await writeSceneSnapshot(sceneDir, snapshot);
  } finally {
    imageNetworkCapture.stop();
  }

  await page.close();
  return { imagePath, motionPrompt: "" };
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

async function generateMotionPromptWithChatGPT({
  imagePath,
  prompt,
  sceneDir,
  sceneId,
  sceneText = "",
  chatContextTitle = "",
  chatGptStability = {},
}) {
  const lockKey = `scene:${sceneId}:motion_prompt`;
  const existing = motionPromptSendLocks.get(lockKey);
  if (existing) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `motionPromptSend: duplicate send suppressed for scene ${sceneId}`,
      details: {
        lockKey,
        attemptId: existing.attemptId,
        startedAt: existing.startedAt,
      },
    });
    return existing.promise;
  }
  const attemptId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `motionPromptSend: acquiring lock for scene ${sceneId}`,
    details: { lockKey, attemptId, stage: "motion_prompt" },
  });
  const promise = generateMotionPromptWithChatGPTOnce(
    {
      imagePath,
      prompt,
      sceneDir,
      sceneId,
      sceneText,
      chatContextTitle,
      chatGptStability,
    },
    { lockKey, attemptId },
  );
  motionPromptSendLocks.set(lockKey, {
    promise,
    attemptId,
    startedAt: new Date().toISOString(),
  });
  try {
    return await promise;
  } finally {
    const current = motionPromptSendLocks.get(lockKey);
    if (current?.attemptId === attemptId) motionPromptSendLocks.delete(lockKey);
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `motionPromptSend: released lock after completion for scene ${sceneId}`,
      details: { lockKey, attemptId, stage: "motion_prompt" },
    });
  }
}

async function generateMotionPromptWithChatGPTOnce(
  {
    imagePath,
    prompt,
    sceneDir,
    sceneId,
    sceneText = "",
    chatContextTitle = "",
    chatGptStability = {},
  },
  lockInfo = {},
) {
  let page;
  try {
    let snapshot = await readSceneSnapshot(sceneDir);
    const motionPromptFile = path.join(sceneDir, "motion_prompt.txt");

    if (snapshot.motionValidated || (await pathExists(motionPromptFile))) {
      snapshot.pipelineStage = "WAIT_VIDEO";
      snapshot.motionValidated = true;
      await writeSceneSnapshot(sceneDir, snapshot);
      return await fs.readFile(motionPromptFile, "utf8");
    }

    page = await getCdpPage("chatgpt", false, { bringToFront: true });

    const loginState = await evaluateOnCdpPage(
      page,
      `(${detectLoginScript.toString()})('chatgpt')`,
    );
    if (!loginState.loggedIn) {
      const autoLogin = await tryAutoLoginWithStoredAccount(page, "chatgpt", {
        reason: "motion-prompt",
        sceneId,
      }).catch((error) => ({ ok: false, error: error.message }));
      const retryLoginState = autoLogin?.ok
        ? await evaluateOnCdpPage(
            page,
            `(${detectLoginScript.toString()})('chatgpt')`,
          ).catch(() => ({ loggedIn: false }))
        : { loggedIn: false };
      if (!retryLoginState.loggedIn) {
        await invalidateChatGptConversationIdentity("chatgpt-login-required");
        if (autoLogin?.noStoredAccount)
          throw new Error(
            `CREDENTIAL_REQUIRED:chatgpt: Chưa có account ChatGPT để tự login.`,
          );
        throw new Error(
          loginRequiredMessage(
            "chatgpt",
            loginState.reason || loginState.url || autoLogin?.finalReason || "",
          ),
        );
      }
    }

    if (chatContextTitle?.trim()) {
      await maybeSelectChatGptConversationByTitle(
        page,
        chatContextTitle.trim(),
        { sceneId, reason: "motion-prompt-stage" },
      ).catch(async (error) => {
        await appendAppLog(null, {
          source: "main",
          kind: "error",
          text: `ChatGPT không chọn được cuộc trò chuyện "${chatContextTitle}": ${error.message}`,
        });
      });
    }

    const currentChatStateForPipeline = await getChatGptLocationState(page).catch(() => ({}));
    let exactConversationUrl = currentChatStateForPipeline?.safeUrl || currentChatStateForPipeline?.url || "";

    const instruction = String(prompt || "").trim();
    if (!instruction)
      throw new Error(`Scene ${sceneId}: NV2_MOTION_PROMPT.txt is empty.`);
    const instructionHash = hashChatGptSnapshotText(instruction);

    const beforeSnapshot = await evaluateOnCdpPage(
      page,
      `(${readAssistantMessageSnapshotScript.toString()})()`,
    ).catch(() => ({ count: 0, ids: [], hashes: [], messages: [] }));

    const before = {
      count: beforeSnapshot?.count || 0,
      userCount: beforeSnapshot?.userCount || 0,
      maxTurnIndex: Number.isFinite(Number(beforeSnapshot?.maxTurnIndex)) ? Number(beforeSnapshot.maxTurnIndex) : -1,
      text: beforeSnapshot?.messages?.at?.(-1)?.text || "",
      ids: beforeSnapshot?.ids || [],
      hashes: beforeSnapshot?.hashes || [],
      userIds: beforeSnapshot?.userIds || [],
      userHashes: beforeSnapshot?.userHashes || [],
      url: exactConversationUrl,
    };

    let pageState = await getConversationState(page);
    await checkProactiveMemoryGuard(sceneId, pageState);

    // If we are resuming from NV2_SENT
    if (snapshot.pipelineStage === "NV2_SENT") {
      await appendAppLog(sceneId, {
        source: "main",
        kind: "running",
        text: `Scene ${sceneId}: Resuming NV2 from stage NV2_SENT.`
      });
    } else {
      snapshot.pipelineStage = "NV2_DRAFT_READY";
      snapshot.promptHash = instructionHash;
      snapshot.draftId = `draft-scene-${sceneId}-nv2-${Date.now()}`;
      snapshot.createdAt = new Date().toISOString();
      await writeSceneSnapshot(sceneDir, snapshot);

      const isDraftMatches = verifyDraftOwnership(snapshot, pageState) && pageState.composerReady;
      if (isDraftMatches) {
        await appendAppLog(sceneId, {
          source: "main",
          kind: "ok",
          text: `Scene ${sceneId}: Valid unsent NV2 draft recovered in composer. Skipping upload & pasting; clicking Send.`
        });
        const clicked = await clickSendButtonViaCdp(page);
        if (!clicked.ok) {
          throw new Error(`Failed to send recovered NV2 draft: ${clicked.error}`);
        }
        snapshot.pipelineStage = "NV2_SENT";
        await writeSceneSnapshot(sceneDir, snapshot);
      } else {
        const userPromptMatches = (pageState.latestUserMessageHash === instructionHash);
        if (userPromptMatches) {
          await appendAppLog(null, {
            source: "main",
            kind: "ok",
            text: `Scene ${sceneId}: NV2 Prompt already sent. Proceeding to wait for response.`,
          });
          snapshot.pipelineStage = "NV2_SENT";
          await writeSceneSnapshot(sceneDir, snapshot);
        } else {
          if (!snapshot.hydration?.sceneUploadDone) {
            await appendAppLog(null, {
              source: "main",
              kind: "running",
              text: `Scene ${sceneId}: Uploading current scene keyframe before NV2.`,
              details: { image: path.basename(imagePath || "") },
            });
            const nv2ImageUpload = await uploadFilesToChatGptSequentially(
              page,
              [imagePath],
              sceneId,
              {
                trailingUploadLog: `Scene ${sceneId}: Uploading current scene keyframe for NV2...`,
                request: "nv2-keyframe",
              },
            );
            if (!nv2ImageUpload?.ok) {
              throw new Error(`Scene ${sceneId}: ChatGPT NV2 keyframe upload failed: ${nv2ImageUpload?.error || "unknown"}`);
            }
            if (!snapshot.hydration) snapshot.hydration = {};
            snapshot.hydration.sceneUploadDone = true;
            await writeSceneSnapshot(sceneDir, snapshot);
          } else {
            await appendAppLog(sceneId, {
              source: "main",
              kind: "info",
              text: `Scene ${sceneId}: Keyframe upload already marked done. Skipping upload.`
            }).catch(() => null);
          }

          pageState = await getConversationState(page);
          snapshot.attachmentHashes = pageState.attachmentHashes || [];
          await writeSceneSnapshot(sceneDir, snapshot);

          const sent = await sendNv2PromptViaDeepCdpInput(page, instruction, {
            sceneId,
            stage: "motion_prompt",
            attemptId: lockInfo.attemptId,
            beforeCount: before.count,
          });
          if (!sent.ok) {
            throw new Error(sent.error || "Không gửi được Nhiệm vụ 2 vào ChatGPT.");
          }

          if (!snapshot.hydration) snapshot.hydration = {};
          snapshot.hydration.promptUploadDone = true;
          snapshot.pipelineStage = "NV2_SENT";
          await writeSceneSnapshot(sceneDir, snapshot);
        }
      }
    }

    await logChatGptStage(page, CHATGPT_STAGES.WAITING_RESPONSE, {
      sceneId,
      stage: "motion_prompt",
      attempt: 1,
    }).catch(() => null);

    const result = await waitForChatGptResponse(page, before, {
      sceneId,
      promptText: instruction,
      promptHash: instructionHash,
      targetTitle: chatContextTitle,
      stage: "motion-prompt-response",
      chatGptStability,
    });
    if (!result?.ok) {
      throw new Error(result?.error || "IMAGE_STAGE NV2 response waiting failed.");
    }

    const stableText = String(result.text || "").trim();
    await fs.writeFile(motionPromptFile, stableText, "utf8");
    await fs.writeFile(path.join(sceneDir, "motion_prompt_from_chatgpt.txt"), stableText, "utf8").catch(() => null);

    snapshot.pipelineStage = "WAIT_VIDEO";
    snapshot.motionValidated = true;
    await writeSceneSnapshot(sceneDir, snapshot);

    await page.close().catch(() => null);
    return stableText;
  } catch (error) {
    if (page) await page.close().catch(() => null);
    throw error;
  }
}

function validateMotionPromptResponse(
  text = "",
  { beforeText = "", instruction = "", taskPrompt = "", state = null } = {},
) {
  const value = String(text || "").trim();
  if (!value) return { ok: false, error: "empty-response" };
  if (
    value.replace(/\s+/g, " ") ===
    String(beforeText || "")
      .replace(/\s+/g, " ")
      .trim()
  )
    return { ok: false, error: "same-as-before" };

  const lower = value.toLowerCase();
  const instructionHead = String(instruction || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
    .toLowerCase();
  const taskHead = String(taskPrompt || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
    .toLowerCase();
  if (instructionHead && lower.startsWith(instructionHead.slice(0, 80)))
    return { ok: false, error: "echoed-user-instruction" };
  if (taskHead && lower.startsWith(taskHead.slice(0, 80)))
    return { ok: false, error: "echoed-task-prompt" };
  if (
    /^thought\s+for\s+\d+/i.test(value) ||
    /^edit$/i.test(value) ||
    /\bThought\s+for\s+\d+[^\n]*(\n|\s)*Edit\b/i.test(String(text || ""))
  )
    return { ok: false, error: "thinking-summary-not-final" };
  if (
    /nhiệm\s*vụ\s*2\s*:|show more|đoạn đầu scene|vừa tạo/i.test(value) &&
    value.length < 900
  )
    return { ok: false, error: "looks-like-collapsed-user-prompt" };

  // New dynamic NV2 validation rules:
  const generation = state ? state.generation : false;
  const streamingIndicator = state ? state.streamingIndicator : false;
  const isTextMode = true; // NV2 is text response

  if (
    isTextMode &&
    generation === false &&
    streamingIndicator === false &&
    value.length > 100
  ) {
    return { ok: true };
  }

  return {
    ok: false,
    error: value.length <= 100 ? "too-short" : "still-generating-or-streaming",
  };
}

function normalizeVideoProvider(provider) {
  if (provider === "grok") return "grok";
  if (provider === "pixverse") return "pixverse";
  return 'veoup';
}



function summarizeGrokGenerationError(error) {
  if (!error) return "unknown";
  return (
    error.grokRetryReason ||
    String(error.message || error)
      .split("\n")[0]
      .slice(0, 240)
  );
}

async function generateVideoWithProvider({
  provider,
  imagePath,
  motionPrompt,
  sceneDir,
  sceneId,
  videoConfig = {},
  continuityReferencePaths = [],
  continuitySettings = {},
  continuityReferences = null,
}) {
  const runId = getScopedPipelineRunId();
  assertPipelineRunActive(runId);
  if (provider === 'veoup') {
    const motionPromptPath = path.join(sceneDir, "motion_prompt.txt");
    const sceneMediaPaths = getSceneMediaPaths(sceneDir, sceneId, runId);
    const result = await runVeoUpScriptAsPromise(
      {},
      sceneDir,
      [
        {
          id: sceneId,
          imagePath,
          keyframeOutputPath: imagePath,
          motionPrompt,
          motionPromptPath,
        },
      ],
      {
        projectName: path.basename(path.dirname(sceneDir)) || "project",
        autoStartVideoGeneration: true,
        runId,
      },
    );
    assertPipelineRunActive(runId);
    assertVeoUpResultAssociation(result, { runId, sceneId });
    if (result?.ok === false) {
      const error = new Error(
        result.error || result.status || "veoup-generation-failed",
      );
      error.status = result.status || result.error || "veoup-generation-failed";
      error.details = { sceneId, runId, result };
      throw error;
    }
    if (result?.generateAcknowledged !== true) {
      const error = new Error("veoup-generate-submission-not-acknowledged");
      error.status = "veoup-generate-submission-not-acknowledged";
      error.details = { sceneId, runId, result };
      throw error;
    }
    const sourceVideoPath = getVeoUpVideoSourcePath(result);
    if (!sourceVideoPath) {
      const error = new Error("veoup-video-missing-after-submission");
      error.status = "veoup-video-missing-after-submission";
      error.details = {
        sceneId,
        runId,
        resultStatus: result?.status || "",
        imageCount: result?.imageCount || 0,
      };
      throw error;
    }
    const finalized = await finalizeValidatedSceneVideo({
      sourcePath: sourceVideoPath,
      finalPath: sceneMediaPaths.videoPath,
      candidatePath: sceneMediaPaths.candidateVideoPath,
      runId,
    }).catch(async (error) => {
      await fs
        .rm(sceneMediaPaths.candidateVideoPath, { force: true })
        .catch(() => null);
      throw error;
    });
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: `Scene ${sceneId}: Video validated as ${path.basename(sceneMediaPaths.videoPath)}.`,
      details: {
        videoPath: sceneMediaPaths.videoPath,
        sourceVideoPath,
        validation: finalized.validation,
      },
    });
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: `Scene ${sceneId}: VeoUp video validated. Last Frame extraction skipped.`,
      details: {
        videoPath: sceneMediaPaths.videoPath,
        sourceVideoPath,
        validation: finalized.validation,
      },
    });
    return {
      ...result,
      ok: true,
      status: 'video-validated',
      runId,
      sceneId,
      sourceVideoPath,
      sourceDownloadPath: sourceVideoPath,
      videoPath: sceneMediaPaths.videoPath,
      videoValidated: true,
      lastFramePath: "",
      validation: finalized.validation,
      lastFrameValidation: { ok: true, skipped: true, reason: 'last-frame-disabled' },
    };
  }
  if (provider === "pixverse") {
    return generateVideoWithGenericProvider({
      provider: "pixverse",
      imagePath,
      motionPrompt,
      sceneDir,
      sceneId,
      config: videoConfig.pixverse || {},
      continuityReferencePaths,
      continuitySettings,
      continuityReferences,
    });
  }
  if (provider === "grok") {
    const grokResult = await generateVideoWithGenericProvider({
      provider: "grok",
      imagePath,
      motionPrompt,
      sceneDir,
      sceneId,
      config: videoConfig.grok || {},
      continuityReferencePaths,
      continuitySettings,
      continuityReferences,
    });
    return grokResult;
  }
  throw new Error(`Unsupported video provider: ${provider || "unknown"}`);
}

async function waitForGrokImagineReady(page, sceneId = "") {
  const startedAt = Date.now();
  let lastState = null;
  while (Date.now() - startedAt < 20000) {
    lastState = await evaluateOnCdpPage(
      page,
      `(${getGrokReadyStateScript.toString()})()`,
    ).catch((error) => ({ ready: false, error: error.message }));
    if (lastState?.ready) {
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: `Scene ${sceneId}: Grok Imagine đã load xong, bắt đầu kiểm tra/upload.`,
        details: lastState,
      });
      return lastState;
    }
    await sleep(1000);
  }
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `Scene ${sceneId}: Grok load chậm, vẫn tiếp tục sau timeout 20s.`,
    details: lastState,
  });
  return lastState;
}

function sanitizeGrokUrlForLog(value = "") {
  try {
    const parsed = new URL(String(value || ""));
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch (_error) {
    return String(value || "")
      .split(/[?#]/)[0]
      .slice(0, 160);
  }
}

function isGrokImagineAgentUrl(value = "") {
  const text = String(value || "");
  try {
    const url = new URL(text, "https://grok.com");
    return (
      url.hostname === "grok.com" &&
      (url.pathname === "/imagine" || url.pathname.startsWith("/imagine/"))
    );
  } catch (_error) {
    return text.includes("grok.com/imagine") || text.startsWith("/imagine");
  }
}

function isGrokImagineReadyRoute(route) {
  return route === "imagine_agent_ready" || route === "imagine_agent_ready";
}

async function getGrokRouteState(page) {
  const state = await evaluateOnCdpPage(
    page,
    `(${getGrokRouteStateScript.toString()})()`,
  ).catch((error) => ({ ok: false, error: error.message }));
  return {
    ...state,
    safeUrl: sanitizeGrokUrlForLog(state?.url || state?.safeUrl || ""),
  };
}

async function waitForGrokImagineAgentReady(page, sceneId = "", options = {}) {
  const timeoutMs = Number(options.timeoutMs || 45000);
  const startedAt = Date.now();
  let lastState = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastState = await getGrokRouteState(page);
    if (
      (isGrokImagineReadyRoute(lastState?.route) ||
        lastState?.route === "imagine_agent_ready") &&
      (!options.requireComposer ||
        lastState.hasComposer ||
        lastState.hasUploadTarget ||
        lastState.hasSendButton)
    ) {
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: "grokRoute: imagine agent ready",
        details: { sceneId, ...lastState },
      });
      return lastState;
    }
    if (lastState?.route === "normal_chat") {
      await appendAppLog(null, {
        source: "main",
        kind: "error",
        text: "grokRoute: blocked send because target was normal chat",
        details: { sceneId, ...lastState },
      });
      return lastState;
    }
    if (lastState?.route === "login_or_challenge") return lastState;
    await sleep(1000);
  }
  return (
    lastState || {
      ok: false,
      route: "timeout",
      error: "timeout-waiting-imagine-agent-ready",
    }
  );
}

async function forceGrokNormalImagineVideoMode(page, sceneId = "") {
  const result = await evaluateOnCdpPage(
    page,
    `
    (() => {
      const body = document.body;
      const out = { ok: true, actions: [], url: location.href };

      const visible = (node) => {
        const r = node.getBoundingClientRect?.();
        return r && r.width > 8 && r.height > 8 && r.bottom > 0 && r.right > 0;
      };

      const textOf = (node) =>
        String(node.innerText || node.textContent || node.getAttribute?.('aria-label') || node.title || '').replace(/\\s+/g, ' ').trim();

      const buttons = Array.from(document.querySelectorAll('button, [role="button"], a')).filter(visible);

      // Không chọn Agent Beta. Chọn Image trước nếu cần, rồi Video nếu có.
      const image = buttons.find((b) => /^image$/i.test(textOf(b)) || / image /i.test(' ' + textOf(b) + ' '));
      if (image && !/selected|active|true/i.test(String(image.getAttribute('aria-pressed') || image.getAttribute('data-state') || ''))) {
        image.click();
        out.actions.push('click-image');
      }

      const video = buttons.find((b) => /^video$/i.test(textOf(b)) || / video /i.test(' ' + textOf(b) + ' '));
      if (video) {
        video.click();
        out.actions.push('click-video');
      }

      return out;
    })()
  `,
  ).catch((error) => ({ ok: false, error: error.message }));

  await appendAppLog(null, {
    source: "main",
    kind: result?.ok ? "ok" : "error",
    text: `Scene ${sceneId}: Grok normal /imagine video mode ${result?.ok ? "ready" : "failed"}`,
    details: result,
  }).catch(() => null);

  return result;
}

async function ensureGrokImagineAgentPage(page, sceneId = "", config = {}) {
  await page.Page.bringToFront().catch(() => null);
  let recovered = false;
  let lastState = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    lastState = await getGrokRouteState(page);
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `grokRoute: currentUrl=${lastState?.safeUrl || ""}`,
      details: { sceneId, attempt, ...lastState },
    });
    if (lastState?.route === "normal_chat") {
      await appendAppLog(null, {
        source: "main",
        kind: "error",
        text: "grokRoute: blocked send because target was normal chat",
        details: { sceneId, attempt, ...lastState },
      });
    }
    if (
      lastState?.route !== "imagine_agent_ready" &&
      lastState?.route !== "imagine_normal_ready" &&
      !isGrokImagineAgentUrl(lastState?.url || lastState?.safeUrl || "")
    ) {
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `grokRoute: navigating to ${GROK_IMAGINE_AGENT_URL}`,
        details: {
          sceneId,
          from: lastState?.safeUrl || "",
          route: lastState?.route || "",
        },
      });
      await page.Page.navigate({ url: GROK_IMAGINE_AGENT_URL }).catch(
        () => null,
      );
      await waitForCdpLoad(page).catch(() => null);
      await sleep(1500);
      recovered = true;
      continue;
    }
    if (lastState?.route === "login_or_challenge") {
      return {
        ok: false,
        error:
          "Grok is showing login/security challenge before Imagine Agent could become ready.",
        state: lastState,
      };
    }
    if (
      (isGrokImagineReadyRoute(lastState?.route) ||
        lastState?.route === "imagine_agent_ready") &&
      (lastState?.hasComposer ||
        lastState?.hasUploadTarget ||
        lastState?.hasSendButton)
    ) {
      if (recovered)
        await appendAppLog(null, {
          source: "main",
          kind: "ok",
          text: "grokRoute: recovered to imagine agent",
          details: { sceneId, ...lastState },
        });
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: "grokRoute: imagine agent ready",
        details: { sceneId, ...lastState },
      });
      return { ok: true, ...lastState };
    }
    const prepared = await evaluateOnCdpPage(
      page,
      `(${prepareGrokVideoComposerScript.toString()})(${JSON.stringify(config || {})})`,
    ).catch((error) => ({ ok: false, error: error.message }));
    await appendAppLog(null, {
      source: "main",
      kind: prepared?.ok ? "running" : "error",
      text: `grokRoute: prepare imagine agent ${prepared?.ok ? prepared.status || "ok" : prepared?.status || prepared?.error || "not-ready"}`,
      details: { sceneId, attempt, prepared },
    });
    if (prepared?.emptyCanvasBox) {
      const box = prepared.emptyCanvasBox;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.Input.dispatchMouseEvent({
        type: "mouseMoved",
        x,
        y,
        button: "none",
      }).catch(() => null);
      await page.Input.dispatchMouseEvent({
        type: "mousePressed",
        x,
        y,
        button: "left",
        clickCount: 1,
      }).catch(() => null);
      await page.Input.dispatchMouseEvent({
        type: "mouseReleased",
        x,
        y,
        button: "left",
        clickCount: 1,
      }).catch(() => null);
    }
    await sleep(1400);
    lastState = await waitForGrokImagineAgentReady(page, sceneId, {
      timeoutMs: 12000,
      requireComposer: false,
    });
    if (
      (isGrokImagineReadyRoute(lastState?.route) ||
        lastState?.route === "imagine_agent_ready") &&
      (lastState?.hasComposer ||
        lastState?.hasUploadTarget ||
        lastState?.hasSendButton)
    ) {
      if (recovered)
        await appendAppLog(null, {
          source: "main",
          kind: "ok",
          text: "grokRoute: recovered to imagine agent",
          details: { sceneId, ...lastState },
        });
      return { ok: true, ...lastState };
    }
  }
  return {
    ok: false,
    error: "Grok Imagine UI was not ready.",
    state: lastState,
  };
}

async function assertGrokImagineAgentReady(page, stage = "send", sceneId = "") {
  const state = await getGrokRouteState(page);
  if (
    (isGrokImagineReadyRoute(state?.route) ||
      state?.route === "imagine_agent_ready") &&
    (state?.hasComposer ||
      state?.hasUploadTarget ||
      state?.hasWorkspace ||
      state?.hasSendButton)
  )
    return { ok: true, state };
  if (state?.route === "normal_chat") {
    await appendAppLog(null, {
      source: "main",
      kind: "error",
      text: "grokRoute: blocked send because target was normal chat",
      details: { stage, sceneId, ...state },
    });
  }
  return {
    ok: false,
    error: `Grok route is not Imagine ready before ${stage}.`,
    state,
  };
}

async function closeGrokTemplateModal(page, sceneId = "") {
  await page.Page.bringToFront().catch(() => null);
  await sleep(300);
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const scan = await evaluateOnCdpPage(
      page,
      `(${scanGrokTemplateModalScript.toString()})()`,
    ).catch((error) => ({ ok: false, error: error.message }));
    if (scan?.open) {
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `Scene ${sceneId}: phát hiện bảng template Grok, ưu tiên bấm X/ẩn bảng thay vì chọn template.`,
        details: { scan },
      });
    }

    await page.Input.dispatchKeyEvent({
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
    }).catch(() => null);
    await page.Input.dispatchKeyEvent({
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
    }).catch(() => null);
    await sleep(250);
    const state = await evaluateOnCdpPage(
      page,
      `(${closeGrokTemplateModalScript.toString()})()`,
    ).catch((error) => ({ ok: false, error: error.message }));
    if (state?.ok && state?.box) {
      const x = state.box.x + state.box.width / 2;
      const y = state.box.y + state.box.height / 2;
      await page.Input.dispatchMouseEvent({
        type: "mouseMoved",
        x,
        y,
        button: "none",
      }).catch(() => null);
      await page.Input.dispatchMouseEvent({
        type: "mousePressed",
        x,
        y,
        button: "left",
        clickCount: 1,
      }).catch(() => null);
      await page.Input.dispatchMouseEvent({
        type: "mouseReleased",
        x,
        y,
        button: "left",
        clickCount: 1,
      }).catch(() => null);
      await sleep(700);
    }
    const after = await evaluateOnCdpPage(
      page,
      `(${detectGrokTemplateModalScript.toString()})()`,
    ).catch(() => ({ open: false }));
    if (!after?.open) {
      if (state?.ok)
        await appendAppLog(null, {
          source: "main",
          kind: "ok",
          text: `Scene ${sceneId}: đã tắt bảng template Grok bằng nút X.`,
          details: state,
        });
      return { ok: true, closed: Boolean(state?.ok), state };
    }
    const viewportFallback = await evaluateOnCdpPage(
      page,
      `(${getGrokTemplateViewportFallbackPointsScript.toString()})()`,
    ).catch((error) => ({ ok: false, error: error.message }));
    if (viewportFallback?.ok) {
      for (const point of viewportFallback.points || []) {
        await page.Input.dispatchMouseEvent({
          type: "mouseMoved",
          x: point.x,
          y: point.y,
          button: "none",
        }).catch(() => null);
        await page.Input.dispatchMouseEvent({
          type: "mousePressed",
          x: point.x,
          y: point.y,
          button: "left",
          clickCount: 1,
        }).catch(() => null);
        await page.Input.dispatchMouseEvent({
          type: "mouseReleased",
          x: point.x,
          y: point.y,
          button: "left",
          clickCount: 1,
        }).catch(() => null);
        await sleep(900);
        const afterFallback = await evaluateOnCdpPage(
          page,
          `(${detectGrokTemplateModalScript.toString()})()`,
        ).catch(() => ({ open: false }));
        await appendAppLog(null, {
          source: "main",
          kind: afterFallback?.open ? "running" : "ok",
          text: `Scene ${sceneId}: Grok fallback click ${point.name} tại (${Math.round(point.x)}, ${Math.round(point.y)}) -> ${afterFallback?.open ? "popup vẫn còn" : "popup đã đổi/tắt"}`,
          details: { viewportFallback, point, afterFallback },
        });
        if (!afterFallback?.open) return { ok: true, fallbackPoint: point };
      }
    }
    await sleep(500);
  }
  const forceHidden = await evaluateOnCdpPage(
    page,
    `(${forceHideGrokTemplateModalScript.toString()})()`,
  ).catch((error) => ({ ok: false, error: error.message }));
  await sleep(500);
  const finalState = await evaluateOnCdpPage(
    page,
    `(${detectGrokTemplateModalScript.toString()})()`,
  ).catch(() => ({ open: true }));
  await appendAppLog(null, {
    source: "main",
    kind: forceHidden?.ok && !finalState?.open ? "ok" : "running",
    text:
      forceHidden?.ok && !finalState?.open
        ? `Scene ${sceneId}: đã ẩn cưỡng bức bảng template Grok để tiếp tục upload.`
        : `Scene ${sceneId}: bảng template Grok vẫn còn; đã thử chọn Photo → Video, bấm X và ẩn cưỡng bức.`,
    details: { forceHidden, finalState },
  });
  return {
    ok: !finalState?.open || Boolean(forceHidden?.ok),
    state: finalState,
    forceHidden,
  };
}

async function detectLoginWithRetry(page, provider, sceneId = "") {
  let lastState = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await waitForCdpLoad(page).catch(() => null);
    lastState = await evaluateOnCdpPage(
      page,
      `(${detectLoginScript.toString()})(${JSON.stringify(provider)})`,
    ).catch((error) => ({ loggedIn: false, reason: error.message }));
    await appendAppLog(null, {
      source: "main",
      kind: lastState?.loggedIn ? "ok" : "running",
      text: `Scene ${sceneId}: check login ${PROVIDER_META[provider]?.title || provider} lần ${attempt}/3: ${lastState?.loggedIn ? "đã login" : "chưa sẵn sàng"}`,
      details: lastState,
    });
    if (lastState?.loggedIn) return lastState;
    if (shouldRecoverFromCacheOrChallenge(lastState, provider)) {
      const recovery = await recoverProviderFromCacheOrChallenge(
        page,
        provider,
        `scene-${sceneId || "unknown"}-login-attempt-${attempt}`,
      ).catch((error) => ({ ok: false, error: error.message }));
      lastState = { ...lastState, cacheRecovery: recovery };
      if (recovery?.ok) continue;
    }
    if (["chatgpt", "grok"].includes(provider)) {
      const autoLogin = await tryAutoLoginWithStoredAccount(page, provider, {
        reason: `scene-login-attempt-${attempt}`,
        sceneId,
      }).catch((error) => ({ ok: false, error: error.message }));
      lastState = { ...lastState, autoLogin };
      if (autoLogin?.ok) {
        lastState = await evaluateOnCdpPage(
          page,
          `(${detectLoginScript.toString()})(${JSON.stringify(provider)})`,
        ).catch((error) => ({
          loggedIn: false,
          reason: error.message,
          autoLogin,
        }));
        if (lastState?.loggedIn) return lastState;
      }
      if (autoLogin?.noStoredAccount) break;
    }
    await sleep(attempt === 1 ? 2500 : 4000);
  }
  return lastState;
}

async function uploadGrokGenerationInputs(
  page,
  {
    imagePath,
    sceneId,
    continuityReferencePaths = [],
    continuitySettings = {},
    continuityReferences = null,
  } = {},
) {
  const route = await ensureGrokImagineAgentPage(page, sceneId, {});
  if (!route?.ok)
    throw makeRetryableGrokGenerationError(
      route?.error || "route-not-ready-before-upload",
      { route },
    );
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: "grokRecovery: upload primary keyframe",
    details: { sceneId, imagePath: path.basename(imagePath || "") },
  });
  const uploadResult = await uploadFileViaCdp(page, imagePath, "grok");
  if (!uploadResult?.ok)
    throw makeRetryableGrokGenerationError(
      uploadResult?.error || "primary-keyframe-upload-failed",
      { uploadResult },
    );
  const settled = await waitForGrokUploadSettled(page, sceneId);
  await appendAppLog(null, {
    source: "main",
    kind: settled?.ok ? "ok" : "running",
    text: "grokRecovery: primary upload settled=" + Boolean(settled?.ok),
    details: { sceneId, settled },
  });

  const grokRefs = (continuityReferencePaths || []).filter(Boolean).slice(0, 4);
  const normalizedContinuity =
    normalizeContinuityReferenceSettings(continuitySettings);
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text:
      "grokContinuity: additional references available count=" +
      grokRefs.length,
    details: {
      sceneId,
      sourceSceneId: continuityReferences?.sourceSceneId || null,
      files: grokRefs.map((item) => path.basename(item)),
    },
  });
  if (grokRefs.length && normalizedContinuity.sendToGrok) {
    let uploadedRefs = 0;
    for (const refPath of grokRefs) {
      const extraUpload = await uploadFileViaCdp(page, refPath, "grok").catch(
        (error) => ({ ok: false, error: error.message }),
      );
      if (extraUpload?.ok) uploadedRefs += 1;
      else
        await appendAppLog(null, {
          source: "main",
          kind: "running",
          text:
            "grokContinuity: reference upload skipped file=" +
            path.basename(refPath) +
            " reason=" +
            (extraUpload?.error || "upload-failed"),
          details: { sceneId, file: path.basename(refPath), extraUpload },
        });
      await sleep(700);
    }
    await appendAppLog(null, {
      source: "main",
      kind: uploadedRefs ? "ok" : "running",
      text:
        "grokContinuity: uploaded additional reference count=" + uploadedRefs,
      details: { sceneId, uploadedRefs },
    });
  } else {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text:
        "grokContinuity: skipped additional references reason=" +
        (grokRefs.length ? "disabled-for-grok-stability" : "none-available"),
      details: { sceneId },
    });
  }
  return { ok: true, uploadResult, settled, referenceCount: grokRefs.length };
}

async function validateGeneratedVideoFile(filePath) {
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat?.isFile() || stat.size < 64 * 1024)
    throw makeRetryableGrokGenerationError("invalid-video-file-too-small", {
      filePath,
      size: stat?.size || 0,
    });
  const duration = await probeVideoDurationSeconds(filePath).catch(() => 0);
  if (!duration || duration < 0.5)
    throw makeRetryableGrokGenerationError("invalid-video-duration", {
      filePath,
      duration,
    });
  return { ok: true, filePath, byteLength: stat.size, duration };
}

async function recoverGrokBeforeGenerationRetry(
  page,
  { sceneId, sceneDir, config = {}, reason = "", attempt = 1 } = {},
) {
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `grokRecovery: reset before retry ${attempt}, reason=${reason}`,
    details: { sceneId, reason, attempt },
  });
  await ensureGrokImagineAgentPage(page, sceneId, config).catch(() => null);
  await clearGrokCanvasChat(page, sceneId).catch(() => null);
  if (/blank|black|request|network|timeout|route|page/i.test(reason)) {
    await page.Page.reload({ ignoreCache: true }).catch(() => null);
    await waitForCdpLoad(page).catch(() => null);
    await sleep(1800);
    await ensureGrokImagineAgentPage(page, sceneId, config).catch(() => null);
  }
  if (sceneDir)
    await labelGrokCanvas(page, sceneId, sceneDir).catch(() => null);
}

async function generateGrokVideoWithRecovery(
  page,
  {
    imagePath,
    motionPrompt,
    sceneDir,
    sceneId,
    config = {},
    continuityReferencePaths = [],
    continuitySettings = {},
    continuityReferences = null,
  } = {},
) {
  const configuredRetryLimit = normalizeGrokResultRetryLimit(config);
  let lastError = null;
  try {
    for (let attempt = 1; ; attempt += 1) {
      const retryIndex = attempt - 1;
      if (retryIndex > 0) {
        await recoverGrokBeforeGenerationRetry(page, {
          sceneId,
          sceneDir,
          config,
          reason: summarizeGrokGenerationError(lastError),
          attempt: retryIndex,
        });
      }
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `grokRecovery: continuous generation attempt=${attempt}`,
        details: {
          sceneId,
          retryIndex,
          configuredRetryLimit,
          reason: summarizeGrokGenerationError(lastError),
        },
      });
      try {
        await ensureGrokImagineAgentPage(page, sceneId, config);
        await labelGrokCanvas(page, sceneId, sceneDir).catch(() => null);
        const upload = await uploadGrokGenerationInputs(page, {
          imagePath,
          sceneId,
          continuityReferencePaths,
          continuitySettings,
          continuityReferences,
        });
        const beforeVideos = await evaluateOnCdpPage(
          page,
          `(${collectVideoUrlsScript.toString()})()`,
        ).catch(() => ({ urls: [] }));
        await appendAppLog(null, {
          source: "main",
          kind: "running",
          text: "grokRecovery: sending exact motion prompt",
          details: {
            sceneId,
            attempt,
            promptHead: String(motionPrompt || "").slice(0, 220),
            upload,
          },
        });
        const sent = await submitGrokVideoPrompt(page, motionPrompt, {
          ...config,
          sceneId,
          imagePath,
        });
        if (!sent?.ok)
          throw makeRetryableGrokGenerationError(
            sent?.error || "send-motion-prompt-failed",
            { sent },
          );
        const confirmed = await confirmGrokVideoGenerationIfAsked(
          page,
          sceneId,
        );
        await appendAppLog(null, {
          source: "main",
          kind: "ok",
          text: "grokRecovery: send accepted, waiting for valid video",
          details: { sceneId, attempt, sent, confirmed },
        });
        const videoUrl = await waitForNewVideoUrl(
          page,
          beforeVideos?.urls || [],
          {
            provider: "grok",
            sceneId,
            sceneDir,
            imagePath,
            motionPrompt,
            retryLimit: configuredRetryLimit,
          },
        );
        if (!videoUrl)
          throw makeRetryableGrokGenerationError("no-new-video-url", {
            beforeVideos,
          });
        const videoPath = path.join(
          sceneDir,
          `scene_${String(sceneId).padStart(3, "0")}_video.mp4`,
        );
        await downloadBrowserAsset(page, videoUrl, videoPath);
        const validation = await validateGeneratedVideoFile(videoPath);
        await appendAppLog(null, {
          source: "main",
          kind: "ok",
          text: `grokRecovery: valid video received on continuous attempt ${attempt}`,
          details: { sceneId, videoUrl, videoPath, validation },
        });
        await page.close();
        return {
          status: retryIndex
            ? "video-downloaded-after-grok-retry"
            : "video-downloaded",
          videoPath,
          retryCount: retryIndex,
          validation,
        };
      } catch (error) {
        lastError = error;
        const reason = summarizeGrokGenerationError(error);
        await fs
          .writeFile(
            path.join(sceneDir, "grok_video_error.txt"),
            maskRouterText(error.stack || error.message || String(error)),
            "utf8",
          )
          .catch(() => null);
        await appendAppLog(null, {
          source: "main",
          kind: "error",
          text: `grokRecovery: continuous attempt ${attempt} failed reason=${maskRouterText(reason)}`,
          details: {
            sceneId,
            attempt,
            configuredRetryLimit,
            retryable: isRetryableGrokGenerationError(error),
            error: maskRouterText(
              error.stack || error.message || String(error),
            ),
          },
        });
        if (!isRetryableGrokGenerationError(error)) break;
        await appendAppLog(null, {
          source: "main",
          kind: "running",
          text: `grokRecovery: retry will re-upload reference image and resend same motion prompt`,
          details: {
            sceneId,
            attempt,
            reason,
            imagePath: path.basename(imagePath || ""),
          },
        });
      }
    }
  } finally {
    if (lastError) await page.close().catch(() => null);
  }
  throw lastError || new Error("Grok did not return a valid video.");
}

async function forceGrokComposerImageUploadAndConfig(
  page,
  imagePath,
  sceneId = "",
) {
  await page.Page.bringToFront().catch(() => null);

  const before = await evaluateOnCdpPage(
    page,
    `
    (() => {
      return {
        url: location.href,
        text: String(document.body?.innerText || '').slice(0, 1200),
        fileInputs: document.querySelectorAll('input[type="file"]').length,
        textboxes: document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]').length,
      };
    })()
  `,
  ).catch((error) => ({ ok: false, error: error.message }));

  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `Scene ${sceneId}: Grok prepare composer upload/config start`,
    details: before,
  }).catch(() => null);

  // Đưa ảnh vào file input của composer, không click workspace/gallery/template.
  const uploadResult = await uploadFileViaCdp(page, imagePath, "grok", {
    sceneId,
    skipRouteCheck: true,
    preferComposerInput: true,
    noWorkspaceClick: true,
  }).catch((error) => ({ ok: false, error: error.message }));

  await appendAppLog(null, {
    source: "main",
    kind: uploadResult?.ok ? "ok" : "error",
    text: `Scene ${sceneId}: Grok composer image upload ${uploadResult?.ok ? "ok" : "failed"}`,
    details: uploadResult,
  }).catch(() => null);

  if (!uploadResult?.ok) {
    throw new Error(
      `Grok upload ảnh vào composer thất bại: ${uploadResult?.error || "unknown"}`,
    );
  }

  // Ép mode/config sau khi upload: Video, 720p, 10s, 16:9.
  const configResult = await evaluateOnCdpPage(
    page,
    `
    (() => {
      const out = { ok: true, actions: [] };

      const visible = (el) => {
        const r = el.getBoundingClientRect?.();
        return r && r.width > 8 && r.height > 8 && r.bottom > 0 && r.right > 0;
      };

      const textOf = (el) =>
        String(el.innerText || el.textContent || el.getAttribute?.('aria-label') || el.title || '')
          .replace(/\\s+/g, ' ')
          .trim();

      const controls = Array.from(document.querySelectorAll('button, [role="button"], a')).filter(visible);

      function clickByText(pattern, label) {
        const found = controls.find((el) => pattern.test(textOf(el)));
        if (found) {
          found.click();
          out.actions.push({ action: label, text: textOf(found) });
          return true;
        }
        out.actions.push({ action: label, missing: true });
        return false;
      }

      // Không bấm Agent Beta, không bấm template cards.
      clickByText(/^Video$/i, 'click-video');
      clickByText(/^720p$/i, 'click-720p');
      clickByText(/^10s$/i, 'click-10s');

      // Aspect ratio dropdown/chip 16:9 nếu có, nếu không thì bỏ qua.
      clickByText(/^16:9$/i, 'click-16x9');

      const composer =
        document.querySelector('[contenteditable="true"]') ||
        document.querySelector('[role="textbox"]') ||
        document.querySelector('textarea');

      const composerText = String(composer?.innerText || composer?.value || composer?.textContent || '');
      const imgs = Array.from(document.querySelectorAll('img')).map((img) => {
        const r = img.getBoundingClientRect();
        return {
          w: Math.round(r.width),
          h: Math.round(r.height),
          top: Math.round(r.top),
          left: Math.round(r.left),
          src: String(img.src || '').slice(0, 120),
        };
      }).filter((x) => x.w > 20 && x.h > 20);

      out.composerTextHead = composerText.slice(0, 300);
      out.imageCount = imgs.length;
      out.images = imgs.slice(-10);
      out.bodyHead = String(document.body?.innerText || '').slice(0, 1200);
      return out;
    })()
  `,
  ).catch((error) => ({ ok: false, error: error.message }));

  await appendAppLog(null, {
    source: "main",
    kind: configResult?.ok ? "ok" : "error",
    text: `Scene ${sceneId}: Grok forced Video/720p/10s config ${configResult?.ok ? "ok" : "failed"}`,
    details: configResult,
  }).catch(() => null);

  return { ok: true, uploadResult, configResult };
}

async function generateVideoWithGenericProvider({
  provider,
  imagePath,
  motionPrompt,
  sceneDir,
  sceneId,
  config = {},
  continuityReferencePaths = [],
  continuitySettings = {},
  continuityReferences = null,
}) {
  if (provider === "grok") {
    const routeGuard = await evaluateOnCdpPage(
      await getCdpPage("grok", true),
      "({ url: location.href, path: location.pathname })",
    ).catch(() => null);
    if (routeGuard?.path?.startsWith("/imagine/agent")) {
      throw new Error(
        "Grok đang ở Agent mode; đã chặn gửi prompt. Tool phải dùng grok.com/imagine thường.",
      );
    }
  }
  const page = await getCdpPage(provider, true);
  const loginState = await detectLoginWithRetry(page, provider, sceneId);
  const title = PROVIDER_META[provider]?.title || provider;
  if (!loginState.loggedIn) {
    await page.close();
    if (loginState?.autoLogin?.noStoredAccount)
      throw new Error(
        `CREDENTIAL_REQUIRED:${provider}: Chưa có account ${title} để tự login.`,
      );
    throw new Error(
      loginRequiredMessage(provider, loginState.reason || loginState.url || ""),
    );
  }

  if (provider === "grok") {
    const route = await ensureGrokImagineAgentPage(page, sceneId, config);
    if (!route?.ok) {
      await page.close();
      throw new Error(route?.error || "Grok Imagine Agent is not ready.");
    }
  }

  const capability = await evaluateOnCdpPage(
    page,
    `(${detectVideoCapabilityScript.toString()})(${JSON.stringify(provider)})`,
  );
  if (!capability?.ok) {
    await page.close();
    throw new Error(
      capability?.error ||
        `${title} account này chưa có feature tạo video/upload ảnh. Hãy đổi account/plan rồi chạy lại.`,
    );
  }

  if (provider === "grok") {
    return generateGrokVideoWithRecovery(page, {
      imagePath,
      motionPrompt,
      sceneDir,
      sceneId,
      config,
      continuityReferencePaths,
      continuitySettings,
      continuityReferences,
    });
  }

  if (provider === "pixverse") {
    await evaluateOnCdpPage(
      page,
      `(${preparePixVerseComposerScript.toString()})(${JSON.stringify(config)})`,
    );
    await sleep(800);
  } else if (provider === "grok") {
    const route = await ensureGrokImagineAgentPage(page, sceneId, config);
    if (!route?.ok)
      throw new Error(
        route?.error || "Grok Imagine Agent is not ready before upload.",
      );
    await sleep(600);
  }

  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `Scene ${sceneId}: bắt đầu upload ảnh vào ${title}.`,
    details: { imagePath },
  });
  if (provider === "grok") {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: "grokContinuity: primary keyframe upload started",
      details: { sceneId, imagePath: path.basename(imagePath || "") },
    });
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: "grokMotionPrompt: uploading keyframe to imagine agent",
      details: { sceneId, imagePath: path.basename(imagePath || "") },
    });
  }
  const uploadResult = await uploadFileViaCdp(page, imagePath, provider);
  if (!uploadResult.ok) {
    throw new Error(
      uploadResult.error || `Không upload được ảnh vào ${title}.`,
    );
  }

  await appendAppLog(null, {
    source: "main",
    kind: "ok",
    text: `Scene ${sceneId}: ${title} đã nhận ảnh upload.`,
    details: uploadResult,
  });
  if (provider === "grok") {
    const settled = await waitForGrokUploadSettled(page, sceneId);
    await appendAppLog(null, {
      source: "main",
      kind: settled?.ok ? "ok" : "running",
      text:
        "Scene " + sceneId + ": Grok upload settled=" + Boolean(settled?.ok),
      details: settled,
    });
    const grokRefs = (continuityReferencePaths || [])
      .filter(Boolean)
      .slice(0, 4);
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text:
        "grokContinuity: additional references available count=" +
        grokRefs.length,
      details: {
        sceneId,
        sourceSceneId: continuityReferences?.sourceSceneId || null,
        files: grokRefs.map((item) => path.basename(item)),
      },
    });
    const normalizedContinuity =
      normalizeContinuityReferenceSettings(continuitySettings);
    if (grokRefs.length && normalizedContinuity.sendToGrok) {
      let uploadedRefs = 0;
      for (const refPath of grokRefs) {
        const extraUpload = await uploadFileViaCdp(
          page,
          refPath,
          provider,
        ).catch((error) => ({ ok: false, error: error.message }));
        if (extraUpload?.ok) uploadedRefs += 1;
        else
          await appendAppLog(null, {
            source: "main",
            kind: "running",
            text:
              "grokContinuity: reference upload skipped file=" +
              path.basename(refPath) +
              " reason=" +
              (extraUpload?.error || "upload-failed"),
            details: { sceneId, file: path.basename(refPath) },
          });
        await sleep(700);
      }
      await appendAppLog(null, {
        source: "main",
        kind: uploadedRefs ? "ok" : "running",
        text:
          "grokContinuity: uploaded additional reference count=" + uploadedRefs,
        details: { sceneId, uploadedRefs },
      });
    } else {
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text:
          "grokContinuity: skipped additional references reason=" +
          (grokRefs.length ? "disabled-for-grok-stability" : "none-available"),
        details: { sceneId },
      });
    }
  }

  const beforeVideos = await evaluateOnCdpPage(
    page,
    `(${collectVideoUrlsScript.toString()})()`,
  );
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `Scene ${sceneId}: bắt đầu paste prompt vào ${title}.`,
  });
  if (provider === "grok") {
    const route = await ensureGrokImagineAgentPage(page, sceneId, config);
    if (!route?.ok)
      throw new Error(
        route?.error || "Grok Imagine Agent is not ready before prompt send.",
      );
    const guard = await assertGrokImagineAgentReady(
      page,
      "motion-prompt-send",
      sceneId,
    );
    if (!guard?.ok)
      throw new Error(
        guard?.error || "Grok Imagine Agent route guard blocked send.",
      );
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: "grokMotionPrompt: pasting motion prompt to imagine agent",
      details: { sceneId, route: guard.state },
    });
  }
  const sent =
    provider === "pixverse"
      ? await submitPixVersePrompt(page, motionPrompt, config)
      : provider === "grok"
        ? await submitGrokVideoPrompt(page, motionPrompt, {
            ...config,
            sceneId,
            imagePath,
          })
        : await sendPromptViaCdpInput(page, motionPrompt);
  if (!sent.ok)
    throw new Error(sent.error || `Không gửi được motion prompt vào ${title}.`);
  if (provider === "grok")
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: "grokMotionPrompt: send started",
      details: { sceneId, sent },
    });
  await appendAppLog(null, {
    source: "main",
    kind: "ok",
    text: `Scene ${sceneId}: đã gửi prompt vào ${title}.`,
    details: sent,
  });
  if (provider === "grok") {
    const confirmed = await confirmGrokVideoGenerationIfAsked(page, sceneId);
    if (confirmed?.ok) {
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: `Scene ${sceneId}: Grok hỏi xác nhận, đã gửi lệnh tạo video.`,
        details: confirmed,
      });
    }
    const generationState = await evaluateOnCdpPage(
      page,
      `(${detectGrokGeneratingStateScript.toString()})({})`,
    ).catch(() => null);
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: "grokMotionPrompt: send completed or generation started",
      details: {
        sceneId,
        generating: Boolean(generationState?.generating),
        mode: generationState?.mode || "",
        confirmed,
      },
    });
  }

  let videoUrl = "";
  try {
    videoUrl = await waitForNewVideoUrl(page, beforeVideos?.urls || [], {
      provider,
      sceneId,
      sceneDir,
      imagePath,
      motionPrompt,
    });
  } catch (error) {
    if (
      /grok_send_failed_external_error/i.test(error.message || String(error))
    ) {
      await page.close();
      throw error;
    }
  }
  if (!videoUrl) {
    await page.close();
    return { status: `${provider}-sent-await-manual-download` };
  }

  const videoPath = path.join(
    sceneDir,
    `scene_${String(sceneId).padStart(3, "0")}_video.mp4`,
  );
  const downloaded = await downloadBrowserAsset(page, videoUrl, videoPath).then(
    () => ({ ok: true }),
    (error) => ({ ok: false, error: error.message }),
  );
  if (!downloaded.ok) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Scene ${sceneId}: ${title} đã tạo video nhưng chưa tải tự động được, cần tải thủ công từ tab Grok.`,
      details: { videoUrl, videoPath, error: downloaded.error },
    });
    await page.close();
    return {
      status: `${provider}-generated-manual-download`,
      videoUrl,
      error: downloaded.error,
    };
  }
  await page.close();
  return { status: "video-downloaded", videoPath };
}

async function getCdpPage(provider, createIfMissing = true, options = {}) {
  await ensureChromeDebug();
  const shouldBringToFront = options.bringToFront !== false;
  const shouldRecover = options.recover !== false;
  const meta = PROVIDER_META[provider] || PROVIDER_META.chatgpt;
  const hostname = new URL(meta.url).hostname;
  const targets = await CDP.List({
    host: "127.0.0.1",
    port: CHROME_DEBUG_PORT,
  });
  if (shouldRecover)
    await closeUnexpectedProviderTabs(targets, provider).catch(() => null);
  const providerTargets = targets
    .filter((target) => target.type === "page")
    .filter((target) => target.url?.includes(hostname));

  let target = null;
  for (const candidate of providerTargets) {
    const probe = await CDP({
      target: candidate,
      host: "127.0.0.1",
      port: CHROME_DEBUG_PORT,
    }).catch(() => null);
    if (!probe) continue;
    await probe.Runtime.enable().catch(() => null);
    const state = await evaluateOnCdpPage(
      probe,
      `(${detectLoginScript.toString()})(${JSON.stringify(provider)})`,
    ).catch(() => null);
    await probe.close().catch(() => null);
    if (state?.loggedIn || state?.hasComposer || state?.hasAppShell) {
      target = candidate;
      break;
    }
  }

  target =
    target ||
    providerTargets.find(
      (candidate) => !candidate.url?.startsWith("about:blank"),
    );
  target = target || (createIfMissing ? await openCdpTab(meta.url) : null);
  if (!target) {
    throw new Error(`Không tìm thấy tab ${meta.title}.`);
  }

  const client = await CDP({
    target,
    host: "127.0.0.1",
    port: CHROME_DEBUG_PORT,
  });
  await client.Page.enable();
  await client.Runtime.enable();
  await client.DOM.enable();
  await client.Network.enable().catch(() => null);

  const originalCdpReload = client.Page.reload;
  client.Page.reload = async function (options = {}) {
    const stack = new Error().stack || "";
    let caller = "unknown";
    if (stack.includes("forceCleanChatGptNewChatRotation")) caller = "forceCleanChatGptNewChatRotation";
    else if (stack.includes("recoverCdpPageIfCrashed")) caller = "recoverCdpPageIfCrashed";
    else if (stack.includes("waitForLatestChatGPTGeneratedImage") || stack.includes("resendImagePrompt")) caller = "waitForLatestChatGPTGeneratedImage";
    else if (stack.includes("refreshChatGptPageBeforeImageExtract")) caller = "refreshChatGptPageBeforeImageExtract";
    else if (stack.includes("recoverChatGptBlockingUi")) caller = "recoverChatGptBlockingUi";
    else if (stack.includes("recoverProviderFromCacheOrChallenge")) caller = "recoverProviderFromCacheOrChallenge";
    
    const timestamp = new Date().toISOString();
    const currentSceneId = globalThis.__vidoraLastProcessedSceneId || "unknown";
    const sendState = getChatGptSendState(currentSceneId);

    const blockedReason = isReloadBlocked(currentSceneId);
    if (blockedReason) {
      await appendAppLog(currentSceneId, {
        source: "main",
        kind: "warning",
        text: `CHATGPT_RELOAD_BLOCKED: Reload requested via CDP was canceled. ${blockedReason}`,
        details: { caller, stack }
      }).catch(() => null);
      return { ok: false, error: blockedReason };
    }

    await appendAppLog(currentSceneId, {
      source: "main",
      kind: "warning",
      text: `CHATGPT_RELOAD_REQUESTED`,
      details: {
        timestamp,
        sceneId: currentSceneId,
        stage: sendState,
        reason: "Page reload requested via CDP",
        caller,
        stack
      },
    }).catch(() => null);

    if (sendState === "PREPARING" || sendState === "READY" || sendState === "CLICKING") {
      await appendAppLog(currentSceneId, {
        source: "main",
        kind: "error",
        text: `RELOAD_BEFORE_SEND: Page reload requested before SEND_CLICK_BEGIN! State = ${sendState}`,
        details: { caller, stack },
      }).catch(() => null);
    }

    return originalCdpReload.call(client.Page, options);
  };

  const originalCdpNavigate = client.Page.navigate;
  client.Page.navigate = async function (params = {}) {
    const stack = new Error().stack || "";
    let caller = "unknown";
    if (stack.includes("forceCleanChatGptNewChatRotation")) caller = "forceCleanChatGptNewChatRotation";
    else if (stack.includes("recoverCdpPageIfCrashed")) caller = "recoverCdpPageIfCrashed";
    else if (stack.includes("waitForLatestChatGPTGeneratedImage") || stack.includes("resendImagePrompt")) caller = "waitForLatestChatGPTGeneratedImage";
    else if (stack.includes("refreshChatGptPageBeforeImageExtract")) caller = "refreshChatGptPageBeforeImageExtract";
    else if (stack.includes("recoverChatGptBlockingUi")) caller = "recoverChatGptBlockingUi";
    else if (stack.includes("recoverProviderFromCacheOrChallenge")) caller = "recoverProviderFromCacheOrChallenge";
    
    const timestamp = new Date().toISOString();
    const currentSceneId = globalThis.__vidoraLastProcessedSceneId || "unknown";
    const sendState = getChatGptSendState(currentSceneId);

    await appendAppLog(currentSceneId, {
      source: "main",
      kind: "warning",
      text: `CHATGPT_NAVIGATION_REQUESTED`,
      details: {
        timestamp,
        sceneId: currentSceneId,
        stage: sendState,
        reason: `Page navigate requested to: ${params.url}`,
        caller,
        stack
      },
    }).catch(() => null);

    if (sendState === "PREPARING" || sendState === "READY" || sendState === "CLICKING") {
      await appendAppLog(currentSceneId, {
        source: "main",
        kind: "error",
        text: `NAVIGATION_BEFORE_SEND: Page navigation requested before SEND_CLICK_BEGIN! State = ${sendState}`,
        details: { url: params.url, caller, stack },
      }).catch(() => null);
    }

    return originalCdpNavigate.call(client.Page, params);
  };

  client.on("disconnect", () => {
    appendAppLog(null, {
      source: "main",
      kind: "error",
      text: `[CDP EVENT] client disconnected for target URL: ${target.url || "unknown"}`,
    }).catch(() => null);
  });

  client.Inspector.targetCrashed(() => {
    globalThis.__vidoraCdpCrashedOom = true;
    appendAppLog(null, {
      source: "main",
      kind: "error",
      text: `CHATGPT_RENDERER_OOM: client targetCrashed (Renderer process crashed/OOM) for target URL: ${target.url || "unknown"}`,
    }).catch(() => null);
  });

  client.Page.frameNavigated((params) => {
    const frame = params.frame;
    if (frame && !frame.parentId) {
      globalThis.__vidoraCdpCrashedOom = false; // Reset on successful navigation/reload
      appendAppLog(null, {
        source: "main",
        kind: "info",
        text: `[CDP EVENT] Main frame navigated/reloaded to: ${frame.url}`,
        details: { frame },
      }).catch(() => null);
    }
  });

  if (shouldBringToFront) await client.Page.bringToFront().catch(() => null);
  await waitForCdpLoad(client);
  if (shouldRecover)
    await recoverProviderFromCacheOrChallenge(
      client,
      provider,
      "get-page",
    ).catch(() => null);
  if (shouldRecover)
    await recoverCdpPageIfCrashed(client, provider, "get-page").catch(
      () => null,
    );
  globalThis.activeCdpClient = client;
  return client;
}

async function closeUnexpectedProviderTabs(targets = [], provider = "chatgpt") {
  const providerHost = new URL(
    (PROVIDER_META[provider] || PROVIDER_META.chatgpt).url,
  ).hostname;
  const unwanted = (targets || [])
    .filter((target) => target.type === "page")
    .filter((target) => {
      const url = String(target.url || "");
      if (!/^https?:/i.test(url)) return false;
      let host = "";
      try {
        host = new URL(url).hostname.toLowerCase();
      } catch (_error) {
        return false;
      }
      if (host === providerHost || host.endsWith(`.${providerHost}`))
        return false;
      return (
        /(^|\.)linkedin\.com$|(^|\.)facebook\.com$|(^|\.)twitter\.com$|(^|\.)x\.com$/i.test(
          host,
        ) || /\/share\b|\/sharing\b|shareArticle|mini=true/i.test(url)
      );
    });
  for (const target of unwanted.slice(0, 12)) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `browserCleanup: closing unexpected external tab while using ${provider}: ${sanitizeLogString(target.url || "")}`,
      details: {
        provider,
        title: String(target.title || "").slice(0, 120),
        url: sanitizeLogString(target.url || ""),
      },
    });
    const id = encodeURIComponent(target.id || "");
    if (id)
      await fetch(
        `http://127.0.0.1:${CHROME_DEBUG_PORT}/json/close/${id}`,
      ).catch(() => null);
  }
  return { ok: true, closed: unwanted.length };
}

function isCdpCrashError(error) {
  return /crash|crashed|Aw, Snap|Out of Memory|cannot find context|execution context.*destroyed|target.*closed|inspected target.*closed|webcontents was destroyed|session closed/i.test(
    String(error?.message || error || ""),
  );
}

async function recoverCdpPageIfCrashed(
  client,
  provider = "chatgpt",
  reason = "unknown",
) {
  const state = await evaluateOnCdpPage(
    client,
    `(${detectBrowserCrashPageScript.toString()})()`,
  ).catch((error) => ({
    ok: false,
    crashed: isCdpCrashError(error),
    error: error.message,
  }));

  const currentSceneId = globalThis.__vidoraLastProcessedSceneId || "unknown";
  const sendState = getChatGptSendState(currentSceneId);

  if (!state?.crashed) {
    if (sendState === "PREPARING" || sendState === "READY" || sendState === "CLICKING") {
      await appendAppLog(currentSceneId, {
        source: "main",
        kind: "warning",
        text: `RECOVERY_BLOCKED_BEFORE_SEND: recoverCdpPageIfCrashed blocked during sendState = ${sendState} (reason: ${reason}).`,
      }).catch(() => null);
      return { ok: true, skipped: true, reason: "RECOVERY_BLOCKED_BEFORE_SEND", state };
    }
    return { ok: true, skipped: true, state };
  }

  const meta = PROVIDER_META[provider] || PROVIDER_META.chatgpt;
  const isOom = state.reason === "out-of-memory" ||
                /Out of Memory|oom/i.test(String(state.error || "")) ||
                globalThis.__vidoraCdpCrashedOom;
  await appendAppLog(null, {
    source: "main",
    kind: "error",
    text: isOom 
      ? `CHATGPT_RENDERER_OOM: ChatGPT renderer crashed with Out of Memory during ${reason}.`
      : `${meta.title}: detected crashed tab (${state.reason || state.error || reason}); recovering by opening provider root.`,
    details: { provider, reason, state, isOom },
  });
  await client.Page.stopLoading().catch(() => null);
  await client.Page.navigate({ url: meta.url }).catch(() => null);
  await waitForCdpLoad(client).catch(() => null);
  await sleep(2200);
  const after = await evaluateOnCdpPage(
    client,
    `(${detectBrowserCrashPageScript.toString()})()`,
  ).catch((error) => ({
    ok: false,
    crashed: isCdpCrashError(error),
    error: error.message,
  }));
  if (after?.crashed) {
    await client.Page.reload({ ignoreCache: true }).catch(() => null);
    await waitForCdpLoad(client).catch(() => null);
    await sleep(2200);
  }
  await appendAppLog(null, {
    source: "main",
    kind: after?.crashed ? "error" : "ok",
    text: `${meta.title}: crash recovery ${after?.crashed ? "still crashed" : "ok"}.`,
    details: { provider, before: state, after },
  });
  return { ok: !after?.crashed, before: state, after };
}

function sanitizeAssetUrlForLog(value = "") {
  const url = String(value || "");
  if (!url) return "";
  if (url.startsWith("data:")) return `data:${url.slice(5, 32)}...`;
  if (url.startsWith("blob:")) {
    try {
      const parsed = new URL(url);
      return `blob:${parsed.origin}/...`;
    } catch (_error) {
      return "blob:...";
    }
  }
  try {
    const parsed = new URL(url);
    const pathPart =
      parsed.pathname.length > 90
        ? `${parsed.pathname.slice(0, 90)}...`
        : parsed.pathname;
    return `${parsed.protocol}//${parsed.host}${pathPart}`;
  } catch (_error) {
    return url.slice(0, 120);
  }
}

function startChatGptImageNetworkCapture(client, context = {}) {
  const startedAt = Date.now();
  const requests = new Map();
  const isLikelyImage = (response = {}) => {
    const mime = String(response.mimeType || "").toLowerCase();
    const url = String(response.url || "");
    return (
      mime.startsWith("image/") ||
      /\.(png|jpe?g|webp)(?:[?#]|$)/i.test(url) ||
      /oaiusercontent|oaidalleapiprodscus|openai/i.test(url)
    );
  };
  const onResponse = (event = {}) => {
    const response = event.response || {};
    if (!event.requestId || !isLikelyImage(response)) return;
    requests.set(event.requestId, {
      requestId: event.requestId,
      mimeType: response.mimeType || "",
      status: response.status || 0,
      url: response.url || "",
      urlSafe: sanitizeAssetUrlForLog(response.url || ""),
      responseAt: Date.now(),
      encodedDataLength: 0,
      finished: false,
      sceneId: context.sceneId || "",
    });
  };
  const onFinished = (event = {}) => {
    const item = requests.get(event.requestId);
    if (!item) return;
    item.finished = true;
    item.finishedAt = Date.now();
    item.encodedDataLength =
      event.encodedDataLength || item.encodedDataLength || 0;
  };
  if (typeof client.on === "function") {
    client.on("Network.responseReceived", onResponse);
    client.on("Network.loadingFinished", onFinished);
  }
  return {
    startedAt,
    candidates() {
      return [...requests.values()]
        .filter((item) => item.responseAt >= startedAt)
        .sort(
          (a, b) =>
            (b.finishedAt || b.responseAt) - (a.finishedAt || a.responseAt),
        );
    },
    summary() {
      return this.candidates()
        .slice(0, 12)
        .map((item) => ({
          requestId: item.requestId,
          mimeType: item.mimeType,
          status: item.status,
          url: item.urlSafe,
          encodedDataLength: item.encodedDataLength || 0,
          finished: Boolean(item.finished),
        }));
    },
    stop() {
      if (typeof client.off === "function") {
        client.off("Network.responseReceived", onResponse);
        client.off("Network.loadingFinished", onFinished);
      } else if (typeof client.removeListener === "function") {
        client.removeListener("Network.responseReceived", onResponse);
        client.removeListener("Network.loadingFinished", onFinished);
      }
    },
  };
}

async function tryExtractChatGptNetworkImage(client, capture) {
  if (!capture?.candidates)
    return { ok: false, mode: "network-capture-unavailable" };
  const candidates = capture
    .candidates()
    .filter(
      (item) =>
        item.finished && /^image\/(png|jpe?g|webp)/i.test(item.mimeType || ""),
    );
  const rejected = [];
  for (const item of candidates) {
    try {
      const body = await client.Network.getResponseBody({
        requestId: item.requestId,
      });
      const base64 = body.base64Encoded
        ? body.body
        : Buffer.from(body.body || "", "utf8").toString("base64");
      const buffer = Buffer.from(base64 || "", "base64");
      const decoded = decodeImageBufferToPng(
        buffer,
        item.mimeType || "image/png",
      );
      return {
        ok: true,
        base64,
        contentType: item.mimeType || "image/png",
        byteLength: buffer.length,
        width: decoded.width,
        height: decoded.height,
        method: "network",
        sourceKind: "cdp-network-response",
        rootIndex: null,
        requestId: item.requestId,
        urlSafe: item.urlSafe,
      };
    } catch (error) {
      rejected.push({
        requestId: item.requestId,
        url: item.urlSafe,
        reason: error.message,
      });
    }
  }
  return {
    ok: false,
    mode: "no-valid-network-image",
    candidateCount: candidates.length,
    rejected: rejected.slice(0, 8),
  };
}

function chatGptImageCandidateSignature(candidate = {}) {
  return [
    candidate.method || candidate.sourceKind || "",
    candidate.rootIndex ?? "",
    candidate.width || 0,
    candidate.height || 0,
    candidate.byteLength || 0,
    candidate.requestId || "",
  ].join("|");
}

function countVisibleChatGptImageCandidates(diagnostics = {}) {
  const items = Array.isArray(diagnostics.imageCandidates)
    ? diagnostics.imageCandidates
    : [];
  return items.filter((item) => {
    if (!item?.visible) return false;
    const box = item.box || {};
    const boxOk =
      Number(box.width || box.clientWidth || 0) >= 128 &&
      Number(box.height || box.clientHeight || 0) >= 128;
    const naturalOk =
      Number(item.naturalWidth || item.width || 0) >= 256 &&
      Number(item.naturalHeight || item.height || 0) >= 256;
    return boxOk || naturalOk;
  }).length;
}

function hasVisibleChatGptImageCandidate(extracted = {}) {
  return (
    Boolean(extracted?.screenshotCandidate) ||
    countVisibleChatGptImageCandidates(extracted?.diagnostics) > 0
  );
}


function classifyChatGptImageReadiness({
  chosen,
  extracted,
  snapshot,
  elapsedMs = 0,
  stallMs = 120000,
} = {}) {
  const visibleCandidate =
    hasVisibleChatGptImageCandidate(extracted) ||
    (Array.isArray(snapshot?.urls) && snapshot.urls.length > 0);
  const activeGeneration = isChatGptActivelyGenerating(snapshot);
  if (chosen?.ok)
    return { state: "image_extractable", visibleCandidate, activeGeneration };
  if (visibleCandidate)
    return {
      state: "image_visible_but_not_extractable",
      visibleCandidate,
      activeGeneration,
    };
  if (activeGeneration)
    return { state: "still_generating", visibleCandidate, activeGeneration };
  if (elapsedMs >= stallMs)
    return { state: "real_stall", visibleCandidate, activeGeneration };
  return { state: "no_candidate_yet", visibleCandidate, activeGeneration };
}

async function captureChatGptImageElementScreenshot(
  client,
  candidate = {},
  context = {},
) {
  if (!candidate.elementId) return { ok: false, mode: "missing-element-id" };
  const target = await evaluateOnCdpPage(
    client,
    `(${getChatGptImageCandidateBoxScript.toString()})(${JSON.stringify(candidate.elementId)})`,
  ).catch((error) => ({ ok: false, error: error.message }));
  if (!target?.ok)
    return {
      ok: false,
      mode: "element-box-unavailable",
      error: target?.error || "missing element",
    };
  const screenshot = await client.Page.captureScreenshot({
    format: "png",
    clip: {
      x: Math.max(0, target.box.x),
      y: Math.max(0, target.box.y),
      width: Math.max(1, target.box.width),
      height: Math.max(1, target.box.height),
      scale: 1,
    },
    captureBeyondViewport: true,
  });
  const buffer = Buffer.from(screenshot.data || "", "base64");
  const decoded = decodeImageBufferToPng(buffer, "image/png");
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: "chatgptImageExtract: saved image via method=element-screenshot-fallback",
    details: {
      sceneId: context.sceneId || "",
      method: "element-screenshot-fallback",
      type: candidate.type || "",
      rootIndex: candidate.rootIndex,
      width: decoded.width,
      height: decoded.height,
      byteLength: buffer.length,
    },
  });
  return {
    ok: true,
    base64: buffer.toString("base64"),
    contentType: "image/png",
    byteLength: buffer.length,
    width: decoded.width,
    height: decoded.height,
    method: "element-screenshot-fallback",
    sourceKind: `element-${candidate.type || "candidate"}`,
    rootIndex: candidate.rootIndex,
    elementId: candidate.elementId,
  };
}


async function forceGrokNormalImagineMode(page, sceneId = "") {
  await page.Page.bringToFront().catch(() => null);

  const result = await evaluateOnCdpPage(
    page,
    `
    (() => {
      const out = { ok: true, url: location.href, actions: [] };

      // Nếu đang lỡ ở Agent canvas, quay về Imagine thường.
      if (location.pathname.startsWith('/imagine/agent')) {
        history.pushState(null, '', '/imagine');
        location.href = 'https://grok.com/imagine';
        out.actions.push('redirect-agent-to-imagine');
        return out;
      }

      const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'));

      function textOf(el) {
        return String(el.innerText || el.textContent || el.getAttribute('aria-label') || el.title || '').trim();
      }

      // Tắt Agent/Beta nếu đang active bằng cách chọn Image trước.
      const imageBtn = buttons.find((el) => /^image$/i.test(textOf(el)) || /\bimage\b/i.test(textOf(el)));
      if (imageBtn) {
        imageBtn.click();
        out.actions.push('click-image-mode');
      }

      // Nếu có Video button thì click video vì bước Grok là image-to-video.
      const videoBtn = buttons.find((el) => /^video$/i.test(textOf(el)) || /\bvideo\b/i.test(textOf(el)));
      if (videoBtn) {
        videoBtn.click();
        out.actions.push('click-video-mode');
      }

      // Không click Agent Beta / Agent.
      out.body = String(document.body?.innerText || '').slice(0, 1000);
      return out;
    })()
  `,
  ).catch((error) => ({ ok: false, error: error.message }));

  await appendAppLog(null, {
    source: "main",
    kind: result?.ok ? "ok" : "error",
    text: `Scene ${sceneId}: Grok normal Imagine mode ${result?.ok ? "ready" : "failed"}`,
    details: result,
  }).catch(() => null);

  return result;
}

async function ensureGrokEmptyCanvas(page, sceneId = "", forceNew = false) {
  await page.Page.bringToFront().catch(() => null);
  const current = await evaluateOnCdpPage(
    page,
    `({ path: location.pathname.toLowerCase(), url: location.href })`,
  ).catch(() => ({ path: "" }));
  if (
    current?.path?.includes("/imagine/agent/") &&
    current.path.length > "/imagine/agent/".length
  ) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Scene ${sceneId}: đang ở canvas Grok cũ, tool sẽ thoát ra và tạo Empty Canvas mới.`,
      details: current,
    });
  }
  await page.Page.navigate({ url: "https://grok.com/imagine" }).catch(
    () => null,
  );
  await waitForCdpLoad(page).catch(() => null);
  await sleep(1800);
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const state = await evaluateOnCdpPage(
      page,
      `(${prepareGrokVideoComposerScript.toString()})()`,
    ).catch((error) => ({ ok: false, error: error.message }));
    await appendAppLog(null, {
      source: "main",
      kind: state?.ok ? "ok" : "running",
      text: `Scene ${sceneId}: Empty Canvas attempt ${attempt}: ${state?.status || state?.error || ""}`,
      details: state,
    });
    if (state?.ok && state?.isAgentCanvas) return { ...state, forceNew };
    if (state?.emptyCanvasBox) {
      const x = state.emptyCanvasBox.x + state.emptyCanvasBox.width / 2;
      const y = state.emptyCanvasBox.y + state.emptyCanvasBox.height / 2;
      await page.Input.dispatchMouseEvent({
        type: "mouseMoved",
        x,
        y,
        button: "none",
      }).catch(() => null);
      await page.Input.dispatchMouseEvent({
        type: "mousePressed",
        x,
        y,
        button: "left",
        clickCount: 1,
      }).catch(() => null);
      await page.Input.dispatchMouseEvent({
        type: "mouseReleased",
        x,
        y,
        button: "left",
        clickCount: 1,
      }).catch(() => null);
      await waitForCdpLoad(page).catch(() => null);
    }
    await sleep(1200);
  }
  const finalState = await evaluateOnCdpPage(
    page,
    `({ url: location.href, text: document.body?.innerText?.slice(0, 1000) || '' })`,
  ).catch((error) => ({ error: error.message }));
  return {
    ok: false,
    error:
      "Không vào được Grok Empty Canvas; đang ở dashboard/template nên không gửi prompt để tránh bấm Create Worlds.",
    finalState,
  };
}

async function collectExistingProjectVideos(sceneDir, currentSceneId = 0) {
  const projectDir = path.dirname(sceneDir);
  const entries = await fs
    .readdir(projectDir, { withFileTypes: true })
    .catch(() => []);
  const videos = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^scene_(\d+)/i);
    if (!match) continue;
    const sceneNo = Number(match[1]);
    if (!sceneNo || sceneNo >= Number(currentSceneId || 0)) continue;
    const dir = path.join(projectDir, entry.name);
    const files = await fs.readdir(dir).catch(() => []);
    for (const file of files) {
      if (!/\.(mp4|webm|mov)$/i.test(file)) continue;
      if (!/video|generated|grok|pixverse/i.test(file)) continue;
      videos.push({ sceneNo, path: path.join(dir, file), file });
    }
  }
  return videos.sort(
    (a, b) => a.sceneNo - b.sceneNo || a.file.localeCompare(b.file),
  );
}

async function restoreExistingProjectVideosToGrokCanvas(
  page,
  sceneDir,
  sceneId = 0,
) {
  const videos = await collectExistingProjectVideos(sceneDir, sceneId);
  const restored = [];
  for (const item of videos) {
    const result = await addMediaFileToGrokCanvas(
      page,
      item.path,
      "video",
    ).catch((error) => ({ ok: false, error: error.message }));
    restored.push({ ...item, result });
    await sleep(1200);
  }
  return {
    ok: true,
    count: restored.filter((item) => item.result?.ok).length,
    total: videos.length,
    restored,
  };
}

async function collectProjectKeyframes(
  sceneDir,
  currentSceneId = 0,
  includeCurrent = false,
) {
  const projectDir = path.dirname(sceneDir);
  const entries = await fs
    .readdir(projectDir, { withFileTypes: true })
    .catch(() => []);
  const frames = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^scene_(\d+)/i);
    if (!match) continue;
    const sceneNo = Number(match[1]);
    if (
      !sceneNo ||
      sceneNo > Number(currentSceneId || 0) ||
      (!includeCurrent && sceneNo === Number(currentSceneId || 0))
    )
      continue;
    const keyframe = path.join(
      projectDir,
      entry.name,
      `scene_${String(sceneNo).padStart(3, "0")}_keyframe.png`,
    );
    if (await pathExists(keyframe))
      frames.push({ sceneNo, path: keyframe, file: path.basename(keyframe) });
  }
  return frames.sort((a, b) => a.sceneNo - b.sceneNo);
}

async function restoreProjectKeyframesToGrokCanvas(
  page,
  sceneDir,
  sceneId = 0,
  includeCurrent = false,
) {
  const frames = await collectProjectKeyframes(
    sceneDir,
    sceneId,
    includeCurrent,
  );
  const restored = [];
  for (const item of frames) {
    const result = await addMediaFileToGrokCanvas(
      page,
      item.path,
      "image",
    ).catch((error) => ({ ok: false, error: error.message }));
    restored.push({ ...item, result });
    await sleep(900);
  }
  return {
    ok: true,
    count: restored.filter((item) => item.result?.ok).length,
    total: frames.length,
    restored,
  };
}

async function restoreProjectKeyframesToChatGPT(page, sceneDir, sceneId = 0) {
  const frames = await collectProjectKeyframes(sceneDir, sceneId, false);
  const restored = [];
  for (const item of frames) {
    const result = await uploadFileViaCdp(page, item.path, "chatgpt").catch(
      (error) => ({ ok: false, error: error.message }),
    );
    restored.push({ ...item, result });
    await sleep(1000);
  }
  return {
    ok: true,
    count: restored.filter((item) => item.result?.ok).length,
    total: frames.length,
    restored,
  };
}

async function waitForGrokUploadSettled(page, sceneId = "") {
  const started = Date.now();
  while (Date.now() - started < 90000) {
    const state = await evaluateOnCdpPage(
      page,
      `(${detectGrokUploadStateScript.toString()})()`,
    ).catch((error) => ({ ok: false, error: error.message }));
    if (state?.ok && !state.uploading) return { ok: true, sceneId, state };
    await sleep(1500);
  }
  return { ok: false, sceneId, error: "timeout-waiting-upload-settled" };
}

function summarizeGrokSendState(state = {}) {
  return {
    route: state.route || "",
    safeUrl: sanitizeGrokUrlForLog(state.safeUrl || state.url || ""),
    attachmentReady: Boolean(state.attachmentReady),
    promptReady: Boolean(state.promptReady),
    promptStable: Boolean(state.promptStable),
    sendButtonEnabled: Boolean(state.sendButtonEnabled),
    uploadProgress: Boolean(state.uploading),
    pageBusy: Boolean(state.pageBusy),
    errorVisible: Boolean(state.sendErrorVisible),
    retryAvailable: Boolean(state.retryAvailable),
    messageBubbleExists: Boolean(state.messageBubbleExists),
    blockingReason: state.blockingReason || "",
    failedReasons: state.failedReasons || [],
    counts: state.counts || {},
  };
}

async function logGrokSendPreflight(
  sceneId = "",
  state = {},
  kind = "running",
) {
  const summary = summarizeGrokSendState(state);
  await appendAppLog(null, {
    source: "main",
    kind,
    text: `grokSend: preflight route=${summary.route || "unknown"}`,
    details: { sceneId, ...summary },
  });
  await appendAppLog(null, {
    source: "main",
    kind,
    text: `grokSend: attachmentReady=${summary.attachmentReady}`,
    details: {
      sceneId,
      attachmentReady: summary.attachmentReady,
      counts: summary.counts,
    },
  });
  await appendAppLog(null, {
    source: "main",
    kind,
    text: `grokSend: promptReady=${summary.promptReady}`,
    details: {
      sceneId,
      promptReady: summary.promptReady,
      promptStable: summary.promptStable,
      messageBubbleExists: summary.messageBubbleExists,
    },
  });
  await appendAppLog(null, {
    source: "main",
    kind,
    text: `grokSend: sendButtonEnabled=${summary.sendButtonEnabled}`,
    details: {
      sceneId,
      sendButtonEnabled: summary.sendButtonEnabled,
      blockingReason: summary.blockingReason,
      failedReasons: summary.failedReasons,
    },
  });
}

async function waitForGrokSendPreflight(client, prompt, options = {}) {
  const sceneId =
    (typeof options !== "undefined" && options?.sceneId) ||
    (typeof context !== "undefined" && context?.sceneId) ||
    "";
  const requireAttachment = options.requireAttachment !== false;
  const timeoutMs = Number(options.timeoutMs || 35000);
  const started = Date.now();
  let last = null;
  let lastFingerprint = "";
  let stableTicks = 0;
  while (Date.now() - started < timeoutMs) {
    last = await evaluateOnCdpPage(
      client,
      `(${getGrokSendPreflightScript.toString()})(${JSON.stringify(prompt || "")}, ${JSON.stringify({ requireAttachment })})`,
    ).catch((error) => ({ ok: false, error: error.message }));
    const fingerprint = String(last?.composerFingerprint || "");
    if (last?.promptReady && fingerprint && fingerprint === lastFingerprint)
      stableTicks += 1;
    else stableTicks = last?.promptReady ? 1 : 0;
    lastFingerprint = fingerprint;
    last = { ...last, promptStable: stableTicks >= 3 };
    const ready =
      last?.route === "imagine_agent_ready" &&
      last.promptReady &&
      last.promptStable &&
      (!requireAttachment || last.attachmentReady) &&
      last.sendButtonEnabled &&
      !last.uploading &&
      !last.pageBusy &&
      !last.blockingModal &&
      !last.sendErrorVisible &&
      !last.loginOrChallenge &&
      !last.normalChatTarget;
    if (ready) {
      await logGrokSendPreflight(sceneId, last, "ok");
      return { ok: true, state: last };
    }
    if (
      last?.normalChatTarget ||
      last?.loginOrChallenge ||
      last?.rateLimit ||
      last?.safetyBlock
    ) {
      await logGrokSendPreflight(sceneId, last, "error");
      await appendAppLog(null, {
        source: "main",
        kind: "error",
        text: `grokSend: blocked send reason=${last.blockingReason || "unsafe-route-or-modal"}`,
        details: { sceneId, state: summarizeGrokSendState(last) },
      });
      return {
        ok: false,
        error: last.blockingReason || "Grok send preflight blocked.",
        state: last,
      };
    }
    await sleep(1200);
  }
  await logGrokSendPreflight(sceneId, last || {}, "error");
  await appendAppLog(null, {
    source: "main",
    kind: "error",
    text: `grokSend: blocked send reason=${last?.blockingReason || last?.failedReasons?.[0] || "preflight-timeout"}`,
    details: { sceneId, state: summarizeGrokSendState(last || {}) },
  });
  return {
    ok: false,
    error:
      last?.blockingReason ||
      last?.failedReasons?.join(", ") ||
      "Grok send preflight timed out.",
    state: last,
  };
}

async function clickGrokSendButtonOnce(client, sceneId = "") {
  const clicked = await evaluateOnCdpPage(
    client,
    `(${clickGrokGenerateScript.toString()})()`,
  ).catch((error) => ({ ok: false, error: error.message }));
  if (clicked?.ok && clicked.box) {
    const x = clicked.box.x + clicked.box.width / 2;
    const y = clicked.box.y + clicked.box.height / 2;
    await client.Input.dispatchMouseEvent({
      type: "mouseMoved",
      x,
      y,
      button: "none",
    }).catch(() => null);
    await client.Input.dispatchMouseEvent({
      type: "mousePressed",
      x,
      y,
      button: "left",
      clickCount: 1,
    }).catch(() => null);
    await client.Input.dispatchMouseEvent({
      type: "mouseReleased",
      x,
      y,
      button: "left",
      clickCount: 1,
    }).catch(() => null);
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: "grokSend: clicked send",
      details: { sceneId, clicked },
    });
    return { ok: true, clicked };
  }
  await appendAppLog(null, {
    source: "main",
    kind: "error",
    text: `grokSend: blocked send reason=${clicked?.error || "send-button-missing"}`,
    details: { sceneId, clicked },
  });
  return {
    ok: false,
    error: clicked?.error || "Grok send button missing.",
    clicked,
  };
}

async function waitForGrokSendOutcome(
  client,
  beforeSubmitState = {},
  options = {},
) {
  const sceneId =
    (typeof options !== "undefined" && options?.sceneId) ||
    (typeof context !== "undefined" && context?.sceneId) ||
    "";
  const started = Date.now();
  const timeoutMs = Number(options.timeoutMs || 24000);
  let lastGenerating = null;
  let lastProblem = null;
  while (Date.now() - started < timeoutMs) {
    await sleep(1800);
    lastGenerating = await evaluateOnCdpPage(
      client,
      `(${detectGrokGeneratingStateScript.toString()})(${JSON.stringify(beforeSubmitState || {})})`,
    ).catch(() => null);
    if (lastGenerating?.generating) {
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: "grokSend: generation started",
        details: {
          sceneId,
          mode: lastGenerating.mode || "",
          state: lastGenerating,
        },
      });
      return {
        ok: true,
        mode: lastGenerating.mode || "generation-started",
        generating: lastGenerating,
      };
    }
    lastProblem = await evaluateOnCdpPage(
      client,
      `(${detectGrokGenerationProblemScript.toString()})()`,
    ).catch((error) => ({ ok: false, error: error.message }));
    if (
      lastProblem?.kind === "send-failed" ||
      lastProblem?.kind === "unable-finish"
    ) {
      await appendAppLog(null, {
        source: "main",
        kind: "error",
        text: `grokSend: detected error="${lastProblem.kind === "send-failed" ? "couldn't send message" : "unable to finish replying"}"`,
        details: { sceneId, problem: lastProblem },
      });
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `grokSend: retry available=${Boolean(lastProblem.hasRetry)}`,
        details: {
          sceneId,
          hasRetry: Boolean(lastProblem.hasRetry),
          retryText: lastProblem.retryText || "",
        },
      });
      return {
        ok: false,
        retryable: true,
        reason: lastProblem.kind,
        problem: lastProblem,
        generating: lastGenerating,
      };
    }
    if (
      lastProblem?.kind === "login-required" ||
      lastProblem?.kind === "limit" ||
      lastProblem?.kind === "content-policy"
    ) {
      return {
        ok: false,
        retryable: false,
        reason: lastProblem.kind,
        problem: lastProblem,
        generating: lastGenerating,
      };
    }
  }
  return {
    ok: false,
    retryable: false,
    reason: "no-generation-start",
    problem: lastProblem,
    generating: lastGenerating,
  };
}

async function retryGrokSendFailure(
  client,
  prompt,
  options = {},
  firstOutcome = {},
) {
  const sceneId =
    (typeof options !== "undefined" && options?.sceneId) ||
    (typeof context !== "undefined" && context?.sceneId) ||
    "";
  let outcome = firstOutcome;
  for (let attempt = 1; attempt <= GROK_SEND_RETRY_LIMIT; attempt += 1) {
    if (!outcome?.retryable) break;
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: "grokSendRetry: detected retryable error",
      details: { sceneId, reason: outcome.reason || "", attempt },
    });
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `grokSendRetry: retry attempt=${attempt}/${GROK_SEND_RETRY_LIMIT}`,
      details: { sceneId, reason: outcome.reason || "" },
    });
    const route = await ensureGrokImagineAgentPage(
      client,
      sceneId,
      options.config || {},
    );
    if (!route?.ok) {
      await appendAppLog(null, {
        source: "main",
        kind: "error",
        text: `grokSendRetry: failed reason=${route?.error || "route-not-ready"}`,
        details: { sceneId, route },
      });
      return {
        ok: false,
        error: route?.error || "Grok Imagine Agent route lost during retry.",
        outcome,
      };
    }
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: "grokSendRetry: verifying prompt and attachment before retry",
      details: { sceneId },
    });
    const retryState = await evaluateOnCdpPage(
      client,
      `(${detectGrokGenerationProblemScript.toString()})()`,
    ).catch(() => outcome.problem || null);
    let preflight = await evaluateOnCdpPage(
      client,
      `(${getGrokSendPreflightScript.toString()})(${JSON.stringify(prompt || "")}, ${JSON.stringify({ requireAttachment: true })})`,
    ).catch((error) => ({ ok: false, error: error.message }));
    if (options.imagePath && !preflight?.attachmentReady) {
      const upload = await uploadFileViaCdp(
        client,
        options.imagePath,
        "grok",
      ).catch((error) => ({ ok: false, error: error.message }));
      await appendAppLog(null, {
        source: "main",
        kind: upload?.ok ? "ok" : "error",
        text: `grokSendRetry: reupload keyframe ${upload?.ok ? "ok" : upload?.error || "failed"}`,
        details: { sceneId, upload },
      });
      preflight = await evaluateOnCdpPage(
        client,
        `(${getGrokSendPreflightScript.toString()})(${JSON.stringify(prompt || "")}, ${JSON.stringify({ requireAttachment: true })})`,
      ).catch(() => preflight);
    }
    if (
      !retryState?.hasRetry &&
      !preflight?.promptReady &&
      !preflight?.messageBubbleExists
    ) {
      const domSet = await evaluateOnCdpPage(
        client,
        `(${setGrokComposerTextScript.toString()})(${JSON.stringify(prompt || "")})`,
      ).catch((error) => ({ ok: false, error: error.message }));
      await appendAppLog(null, {
        source: "main",
        kind: domSet?.ok ? "ok" : "error",
        text: `grokSendRetry: restored prompt ${domSet?.ok ? "ok" : domSet?.error || "failed"}`,
        details: { sceneId, domSet },
      });
    }
    await sleep(1200 * attempt);
    if (retryState?.hasRetry) {
      const clickedRetry = await clickGrokRetryButton(client, retryState).catch(
        (error) => ({ ok: false, error: error.message }),
      );
      await appendAppLog(null, {
        source: "main",
        kind: clickedRetry?.ok ? "running" : "error",
        text: `grokSend: retry clicked${clickedRetry?.ok ? "" : ` failed=${clickedRetry?.error || ""}`}`,
        details: { sceneId, attempt, clickedRetry },
      });
      if (!clickedRetry?.ok) {
        outcome = {
          ok: false,
          retryable: false,
          reason: clickedRetry?.error || "retry-click-failed",
          problem: retryState,
        };
        break;
      }
    } else {
      const ready = await waitForGrokSendPreflight(client, prompt, {
        sceneId,
        requireAttachment: true,
        timeoutMs: 15000,
      });
      if (!ready?.ok) {
        outcome = {
          ok: false,
          retryable: false,
          reason: ready?.error || "retry-preflight-failed",
          problem: ready?.state,
        };
        break;
      }
      const clicked = await clickGrokSendButtonOnce(client, sceneId);
      if (!clicked?.ok) {
        outcome = {
          ok: false,
          retryable: false,
          reason: clicked.error || "retry-send-click-failed",
          problem: clicked,
        };
        break;
      }
    }
    outcome = await waitForGrokSendOutcome(
      client,
      {},
      { sceneId, timeoutMs: 26000 },
    );
    if (outcome?.ok) {
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: "grokSendRetry: success, generation started",
        details: { sceneId, attempt, outcome },
      });
      return { ok: true, retryAttempt: attempt, outcome };
    }
  }
  await appendAppLog(null, {
    source: "main",
    kind: "error",
    text: `grokSendRetry: failed reason=${outcome?.reason || "grok_send_failed_external_error"}`,
    details: { sceneId, outcome },
  });
  return { ok: false, error: "grok_send_failed_external_error", outcome };
}

async function clearGrokCanvasSelection(page) {
  await page.Input.dispatchKeyEvent({
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  }).catch(() => null);
  await page.Input.dispatchKeyEvent({
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  }).catch(() => null);
  await sleep(250);
  await evaluateOnCdpPage(
    page,
    `(${clickGrokComposerAreaScript.toString()})()`,
  ).catch(() => null);
  await sleep(250);
}

function buildGrokSafeMotionPrompt(originalPrompt = "", retryCount = 1) {
  return [
    originalPrompt,
    "",
    `CONTENT POLICY SAFE RETRY ${retryCount}: Rewrite the action as non-graphic, PG-13 adventure suspense. Do not show injury, blood, gore, attack impact, harm to a child, or violent contact. Replace any chase/attack/break-in with a safe tense escape, cautious movement, or protective rescue moment. The creature/animal must keep distance and appear non-contact. Generate a cinematic video from the uploaded keyframe now. Do not ask questions.`,
  ].join("\n");
}

async function recoverGrokAfterContentPolicy(page, options = {}) {
  const sceneId =
    (typeof options !== "undefined" && options?.sceneId) ||
    (typeof context !== "undefined" && context?.sceneId) ||
    "";
  const safePrompt = buildGrokSafeMotionPrompt(
    options.motionPrompt || "",
    options.retryCount || 1,
  );
  if ((options.retryCount || 1) >= 2) {
    await recoverGrokCanvasAfterLimit(page, {
      ...options,
      motionPrompt: safePrompt,
    });
    return {
      ok: true,
      mode: "new-canvas-safe-retry",
      safePromptHead: safePrompt.slice(0, 240),
    };
  }
  await clearGrokCanvasChat(page, sceneId);
  const sent = await submitGrokVideoPrompt(page, safePrompt, {
    sceneId,
    imagePath: options.imagePath,
  });
  if (!sent?.ok)
    throw new Error(
      sent?.error || "Không gửi lại safe prompt sau content policy.",
    );
  const confirmed = await confirmGrokVideoGenerationIfAsked(page, sceneId);
  return {
    ok: true,
    mode: "same-canvas-safe-retry",
    sent,
    confirmed,
    safePromptHead: safePrompt.slice(0, 240),
  };
}

async function recoverGrokCanvasAfterLimit(page, options = {}) {
  const sceneId =
    (typeof options !== "undefined" && options?.sceneId) ||
    (typeof context !== "undefined" && context?.sceneId) ||
    "";
  const sceneDir = options.sceneDir;
  await ensureGrokEmptyCanvas(page, sceneId, true);
  const videos = await restoreExistingProjectVideosToGrokCanvas(
    page,
    sceneDir,
    sceneId,
  );
  const keyframes = await restoreProjectKeyframesToGrokCanvas(
    page,
    sceneDir,
    sceneId,
    true,
  );
  await clearGrokCanvasChat(page, sceneId);
  const uploadCurrent = await uploadFileViaCdp(page, options.imagePath, "grok");
  if (!uploadCurrent?.ok)
    throw new Error(
      uploadCurrent?.error ||
        "Không upload lại keyframe scene hiện tại sau limit.",
    );
  const beforeVideos = await evaluateOnCdpPage(
    page,
    `(${collectVideoUrlsScript.toString()})()`,
  ).catch(() => ({ urls: [] }));
  const sent = await submitGrokVideoPrompt(page, options.motionPrompt, {
    sceneId,
    imagePath: options.imagePath,
  });
  if (!sent?.ok)
    throw new Error(sent?.error || "Không gửi lại motion prompt sau limit.");
  const confirmed = await confirmGrokVideoGenerationIfAsked(page, sceneId);
  return {
    ok: true,
    videos,
    keyframes,
    uploadCurrent,
    beforeVideos,
    sent,
    confirmed,
  };
}

async function addMediaFileToGrokCanvas(client, filePath, mediaType = "image") {
  const uploadClick = await clickGrokUploadAndChooseFile(client, filePath);
  if (!uploadClick?.ok) return uploadClick;
  const accepted = await waitForGrokUploadedAsset(
    client,
    mediaType === "video" ? 60000 : 45000,
  );
  return accepted?.ok
    ? { ok: true, uploadClick, accepted }
    : {
        ok: false,
        error: accepted?.error || "Grok chưa nhận media.",
        uploadClick,
        accepted,
      };
}

async function labelGrokCanvas(page, sceneId = "", sceneDir = "") {
  const label = `SCENE ${String(sceneId).padStart(3, "0")} · ${path.basename(sceneDir || "") || "video"}`;
  const state = await evaluateOnCdpPage(
    page,
    `(${labelGrokCanvasScript.toString()})(${JSON.stringify(label)})`,
  ).catch((error) => ({ ok: false, error: error.message }));
  await appendAppLog(null, {
    source: "main",
    kind: state?.ok ? "ok" : "running",
    text: `Scene ${sceneId}: đặt tên Grok canvas: ${state?.ok ? label : state?.error || "skip"}`,
    details: state,
  });
  await sleep(500);
  return state;
}

async function clearGrokCanvasChat(page, sceneId = "") {
  const state = await evaluateOnCdpPage(
    page,
    `(${clearGrokCanvasChatScript.toString()})()`,
  ).catch((error) => ({ ok: false, error: error.message }));
  await appendAppLog(null, {
    source: "main",
    kind: state?.ok ? "ok" : "running",
    text: `Scene ${sceneId}: Grok clear chat panel: ${state?.ok ? state.mode : state?.error || "skip"}`,
    details: state,
  });
  await sleep(800);
  return state;
}

async function confirmGrokVideoGenerationIfAsked(page, sceneId = "") {
  await sleep(5000);
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const state = await evaluateOnCdpPage(
      page,
      `(${detectGrokConfirmationQuestionScript.toString()})()`,
    ).catch((error) => ({ shouldConfirm: false, error: error.message }));
    await appendAppLog(null, {
      source: "main",
      kind: state?.shouldConfirm ? "running" : "ok",
      text: `Scene ${sceneId}: Grok confirm scan ${attempt}: ${state?.reason || "not-needed"}`,
      details: state,
    });
    if (!state?.shouldConfirm) {
      await sleep(1800);
      continue;
    }
    const sent = await sendGrokConfirmationText(
      page,
      "Tạo video ngay bây giờ từ keyframe đã upload và motion prompt ở trên. Không viết lại prompt, không hỏi lại. Generate the video now.",
    );
    if (sent?.ok) return { ok: true, attempt, state, sent };
    await sleep(1500);
  }
  return {
    ok: false,
    skipped: true,
    error:
      "Không thấy câu hỏi xác nhận/echo prompt cần phản hồi hoặc chưa gửi được xác nhận.",
  };
}

async function sendGrokConfirmationText(page, text) {
  const focused = await evaluateOnCdpPage(
    page,
    `(${focusGrokComposerScript.toString()})()`,
  );
  if (!focused?.ok)
    return {
      ok: false,
      error: focused?.error || "Không focus được ô xác nhận Grok.",
    };
  let ready = null;
  for (let waitAttempt = 1; waitAttempt <= 20; waitAttempt += 1) {
    ready = await evaluateOnCdpPage(
      page,
      `(() => {
      const buttons = [...document.querySelectorAll('button, [role="button"]')].map((node) => {
        const rect = node.getBoundingClientRect?.();
        const label = String((node.textContent || '') + ' ' + (node.getAttribute?.('aria-label') || '') + ' ' + (node.title || '')).trim();
        const disabled = !!node.disabled || node.getAttribute?.('aria-disabled') === 'true' || node.dataset?.disabled === 'true';
        return rect ? { label, disabled, x: rect.x, y: rect.y, w: rect.width, h: rect.height, html: String(node.innerHTML || '').slice(0, 300) } : null;
      }).filter(Boolean).filter((b) => b.w >= 24 && b.h >= 24 && b.x > window.innerWidth * 0.72 && b.y > window.innerHeight * 0.68);
      const send = buttons.find((b) => !b.disabled && b.x > window.innerWidth * 0.78 && b.y > window.innerHeight * 0.76 && !/Image|Video|480p|720p|1080p|6s|10s|Agent|Original/i.test(b.label));
      return { ok: !!send, send, buttons };
    })()`,
    ).catch((error) => ({ ok: false, error: error.message }));
    if (ready?.ok) break;
    await sleep(750);
  }
  await appendAppLog(null, {
    source: "main",
    kind: ready?.ok ? "running" : "error",
    text: `Grok confirm: trạng thái nút send trước Enter ${ready?.ok ? "READY" : "NOT READY"}.`,
    details: { focused, ready },
  });
  let after = null;
  for (let i = 1; i <= 18; i += 1) {
    await page.Input.dispatchKeyEvent({
      type: "keyDown",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
      nativeVirtualKeyCode: 13,
    }).catch(() => null);
    await page.Input.dispatchKeyEvent({
      type: "keyUp",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
      nativeVirtualKeyCode: 13,
    }).catch(() => null);
    await sleep(900);
    after = await evaluateOnCdpPage(
      page,
      `(() => {
      const text = document.body?.innerText || '';
      return { url: location.href, generating: /Generating|Creating|Cancel|%/i.test(text), stillEcho: /DÒNG\s*7|DONG\s*7|Negative Prompt/i.test(text.slice(-2200)), tail: text.slice(-900) };
    })()`,
    ).catch((error) => ({ error: error.message }));
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Grok confirm Enter lần ${i}: ${after?.url || ""}`,
      details: after,
    });
    if (/\/imagine\/post\//i.test(after?.url || "") || after?.generating) {
      return {
        ok: true,
        mode: "repeat-enter-until-generating",
        focused,
        ready,
        after,
        attempts: i,
      };
    }
  }
  return { ok: true, mode: "repeat-enter-timeout", focused, ready, after };
}

async function recoverProviderFromCacheOrChallenge(
  client,
  provider,
  reason = "unknown",
) {
  const currentSceneId = globalThis.__vidoraLastProcessedSceneId || "unknown";
  const sendState = getChatGptSendState(currentSceneId);
  if (sendState === "PREPARING" || sendState === "READY" || sendState === "CLICKING") {
    await appendAppLog(currentSceneId, {
      source: "main",
      kind: "warning",
      text: `RECOVERY_BLOCKED_BEFORE_SEND: recoverProviderFromCacheOrChallenge blocked during sendState = ${sendState} (reason: ${reason}).`,
    }).catch(() => null);
    return { ok: true, skipped: true, reason: "RECOVERY_BLOCKED_BEFORE_SEND" };
  }
  if (provider !== "grok")
    return { ok: false, skipped: true, reason: "provider-not-grok" };
  const state = await evaluateOnCdpPage(
    client,
    `(${detectLoginScript.toString()})(${JSON.stringify(provider)})`,
  ).catch((error) => ({ loggedIn: false, reason: error.message }));
  if (!shouldRecoverFromCacheOrChallenge(state, provider))
    return { ok: false, skipped: true, reason: "no-cache-challenge", state };

  const key = `${provider}:${reason}`;
  const used = challengeRecoveryAttempts.get(key) || 0;
  if (used >= CHALLENGE_RECOVERY_LIMIT) {
    return {
      ok: false,
      error:
        "Đã thử clear cache/hard reload nhiều lần nhưng Grok vẫn đang ở Cloudflare challenge. Cần tick Verify you are human thủ công một lần trong Chrome.",
      state,
    };
  }
  challengeRecoveryAttempts.set(key, used + 1);

  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `Grok dính cache/Cloudflare challenge (${reason}), clear cache + hard reload lần ${used + 1}/${CHALLENGE_RECOVERY_LIMIT}.`,
    details: state,
  });
  await client.Network.clearBrowserCache().catch(() => null);
  await client.Network.clearBrowserCookies().catch(() => null);
  await client.Storage.clearDataForOrigin({
    origin: "https://grok.com",
    storageTypes:
      "appcache,cache_storage,service_workers,websql,indexeddb,local_storage",
  }).catch(() => null);
  await client.Page.navigate({ url: "about:blank" }).catch(() => null);
  await sleep(700);
  await client.Page.navigate({ url: PROVIDER_META.grok.url }).catch(() => null);
  await waitForCdpLoad(client).catch(() => null);
  await client.Page.reload({ ignoreCache: true }).catch(() => null);
  await sleep(2500);
  const after = await evaluateOnCdpPage(
    client,
    `(${detectLoginScript.toString()})(${JSON.stringify(provider)})`,
  ).catch((error) => ({ loggedIn: false, reason: error.message }));
  return {
    ok: !shouldRecoverFromCacheOrChallenge(after, provider),
    before: state,
    after,
    attempt: used + 1,
  };
}

async function recoverChatGptBlockingUi(client, context = {}) {
  const currentSceneId = context.sceneId || globalThis.__vidoraLastProcessedSceneId || "unknown";
  const sendState = getChatGptSendState(currentSceneId);
  if (sendState === "PREPARING" || sendState === "READY" || sendState === "CLICKING") {
    await appendAppLog(currentSceneId, {
      source: "main",
      kind: "warning",
      text: `RECOVERY_BLOCKED_BEFORE_SEND: recoverChatGptBlockingUi blocked during sendState = ${sendState} (stage: ${context.stage || "unknown"}).`,
    }).catch(() => null);
    return { ok: true, skipped: true, reason: "RECOVERY_BLOCKED_BEFORE_SEND", context };
  }

  // new-chat-mode-no-sidebar-touch:recoverChatGptBlockingUi
  if (globalThis.__vidoraChatGptNewChatMode) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: "chatgptUiRecovery: hard-skipped in New chat mode to avoid touching sidebar history",
      details: { context, reason: "new-chat-mode-no-sidebar-touch" },
    }).catch(() => null);
    return {
      ok: true,
      skipped: true,
      reason: "new-chat-mode-no-sidebar-touch",
      context,
    };
  }
  await closeUnexpectedProviderTabs(
    await CDP.List({ host: "127.0.0.1", port: CHROME_DEBUG_PORT }).catch(
      () => [],
    ),
    "chatgpt",
  ).catch(() => null);
  await recoverCdpPageIfCrashed(
    client,
    "chatgpt",
    context.stage || "chatgpt-ui-recovery",
  ).catch(() => null);
  const result = await evaluateOnCdpPage(
    client,
    `(${dismissChatGptBlockingUiScript.toString()})(${JSON.stringify(context || {})})`,
  ).catch((error) => ({ ok: false, error: error.message }));
  if (result?.imageViewerDetected) {
    await client.Input.dispatchKeyEvent({
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
    }).catch(() => null);
    await client.Input.dispatchKeyEvent({
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
    }).catch(() => null);
  }
  if (result?.actions?.length || result?.blockingDetected || result?.error) {
    await appendAppLog(null, {
      source: "main",
      kind: result?.actions?.length ? "running" : "idle",
      text: `chatgptUiRecovery: ${result?.actions?.length ? result.actions.join(", ") : result?.blockingDetected ? "blocking-ui-detected" : result?.error || "checked"}`,
      details: { context, result },
    });
  }
  await sleep(result?.actions?.length ? 900 : 250);
  return result;
}

async function recoverChatGptResponseChoiceChat(client, context = {}) {
  const state = await evaluateOnCdpPage(
    client,
    `(${detectChatGptResponseChoiceUiScript.toString()})()`,
  ).catch((error) => ({ ok: false, error: error.message }));
  if (!state?.responseChoiceUi && !state?.deletedConversationUi)
    return { ok: true, skipped: true, state };

  const imageState = await evaluateOnCdpPage(
    client,
    `(${readChatGptImageStateScript.toString()})()`,
  ).catch((error) => ({ ok: false, error: error.message }));
  const activeGeneration = isChatGptActivelyGenerating(imageState);
  const visibleImageCount = Array.isArray(imageState?.urls)
    ? imageState.urls.length
    : 0;
  if (activeGeneration) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Scene ${context.sceneId || ""}: ChatGPT van dang generate, bo qua recovery tao chat moi.`,
      details: {
        sceneId: context.sceneId || "",
        activeGeneration,
        visibleImageCount,
        responseChoiceUi: Boolean(state.responseChoiceUi),
        imageState: sanitizeChatGptImageSnapshot(imageState),
      },
    });
    return {
      ok: true,
      skipped: true,
      reason: "active-generation",
      state,
      imageState: sanitizeChatGptImageSnapshot(imageState),
    };
  }

  const targetTitle = String(context.targetTitle || "").trim();
  await appendAppLog(null, {
    source: "main",
    kind: state.deletedConversationUi ? "error" : "running",
    text: state.deletedConversationUi
      ? `Scene ${context.sceneId || ""}: ChatGPT dang o chat da bi xoa; khong tu mo chat moi neu chua vuot nguong loi request.`
      : `Scene ${context.sceneId || ""}: ChatGPT dang o man hinh 2 phan hoi; khong tu mo chat moi, tiep tuc tren conversation hien tai.`,
    details: {
      sceneId: context.sceneId || "",
      targetTitle: sanitizeChatTitleForLog(targetTitle),
      visibleImageCount,
      state,
    },
  });
  if (state.deletedConversationUi) {
    return {
      ok: false,
      skipped: true,
      reason: "deleted-conversation-no-auto-new-chat",
      state,
      imageState: sanitizeChatGptImageSnapshot(imageState),
    };
  }
  return {
    ok: true,
    skipped: true,
    reason: "response-choice-no-auto-new-chat",
    state,
    imageState: sanitizeChatGptImageSnapshot(imageState),
  };
}





























async function waitForCdpAssistantResponse(client, beforeCount) {
  let lastText = "";
  let stableTicks = 0;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 180000) {
    await sleep(2500);
    const snapshot = await evaluateOnCdpPage(
      client,
      `(${readLatestAssistantScript.toString()})()`,
    );
    const text = String(snapshot?.text || "").trim();
    const hasNewMessage =
      Number(snapshot?.count || 0) > Number(beforeCount || 0);
    if (hasNewMessage && text.length > 20) {
      if (text === lastText) {
        stableTicks += 1;
      } else {
        stableTicks = 0;
        lastText = text;
      }
      if (stableTicks >= 3 && !snapshot.generating) {
        await client.close();
        return text;
      }
    }
  }
  await client.close();
  if (lastText) return lastText;
  throw new Error("Hết thời gian chờ response từ Chrome CDP.");
}

async function waitForNewImageUrl(client, existingUrls = []) {
  const known = new Set(existingUrls);
  const startedAt = Date.now();
  while (Date.now() - startedAt < 300000) {
    await sleep(3000);
    const snapshot = await evaluateOnCdpPage(
      client,
      `(${collectGeneratedImageUrlsScript.toString()})()`,
    );
    const imageUrl = (snapshot?.urls || []).find((url) => !known.has(url));
    if (imageUrl) return imageUrl;
  }
  throw new Error(
    "Hết thời gian chờ ChatGPT tạo ảnh hoặc không detect được ảnh mới.",
  );
}


async function saveChatGPTGeneratedImageAsset(client, options = {}) {
  let imageAsset;
  try {
    imageAsset = await waitForLatestChatGPTGeneratedImage(client, options);
  } catch (error) {
    if (error && error.message === "BREAKOUT_RECURSIVE_RETRY") {
      const sceneId = (typeof options !== "undefined" && options?.sceneId) || "";
      await appendAppLog(sceneId, {
        source: "main",
        kind: "ok",
        text: `Scene ${sceneId}: Caught BREAKOUT_RECURSIVE_RETRY in saveChatGPTGeneratedImageAsset. Image successfully adopted.`,
      });
      return;
    }
    throw error;
  }
  
  const sceneId = (typeof options !== "undefined" && options?.sceneId) || "";
  await logMemoryMilestone(sceneId, "After extract").catch(() => null);

  if (isChatGptDotLoadingCanvasAsset(imageAsset)) {
    await appendAppLog(null, {
      source: "main",
      kind: "error",
      text: `Scene ${(typeof options !== "undefined" && options?.sceneId) || (typeof context !== "undefined" && context?.sceneId) || ""}: không lưu keyframe vì ảnh lấy được vẫn là canvas loading/chấm chấm.`,
      details: {
        method: imageAsset?.method,
        sourceKind: imageAsset?.sourceKind,
        width: imageAsset?.width,
        height: imageAsset?.height,
        byteLength: imageAsset?.byteLength,
      },
    }).catch(() => null);
    throw new Error(
      "ChatGPT image is still loading/dot canvas; wait for final generated image before saving.",
    );
  }
  const sourceBuffer = Buffer.from(imageAsset.base64 || "", "base64");
  const decoded = decodeImageBufferToPng(sourceBuffer, imageAsset.contentType);
  const outputPath = options.outputPath;
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const existingOutputStat = await fs.lstat(outputPath).catch(() => null);
  if (existingOutputStat?.isDirectory?.()) {
    const backupPath = `${outputPath}.dir_backup_${Date.now()}`;
    await fs.rename(outputPath, backupPath);
    await appendAppLog(null, {
      source: "main",
      kind: "warning",
      text: `Scene ${(typeof options !== "undefined" && options?.sceneId) || (typeof context !== "undefined" && context?.sceneId) || ""}: keyframe output path was a directory; moved it aside before saving PNG.`,
      details: { outputPath, backupPath },
    }).catch(() => null);
  }
  await fs.writeFile(outputPath, decoded.buffer);
  const validation = await validateSavedImageFile(options.outputPath);
  await appendAppLog(null, {
    source: "main",
    kind: "ok",
    text: `Scene ${(typeof options !== "undefined" && options?.sceneId) || (typeof context !== "undefined" && context?.sceneId) || ""}: saved ChatGPT keyframe from generated image asset.`,
    details: {
      outputPath,
      width: validation.width,
      height: validation.height,
      byteLength: validation.byteLength,
      contentType: imageAsset.contentType || "",
      method: imageAsset.method || "",
      sourceKind: imageAsset.sourceKind || "",
      rootIndex: imageAsset.rootIndex,
    },
  });
  return { ok: true, imagePath: outputPath, ...validation };
}

function isLikelyChatGptLoadingPlaceholderImage(asset = {}) {
  const method = String(asset.method || "").toLowerCase();
  const sourceKind = String(asset.sourceKind || "").toLowerCase();
  const width = Number(asset.width || 0);
  const height = Number(asset.height || 0);
  const byteLength = Number(asset.byteLength || 0);

  // ChatGPT loading/placeholder thường là canvas vuông 600x600, byte rất nhỏ,
  // nhìn như chấm chấm, không phải ảnh kết quả thật.
  if (
    method === "canvas" &&
    width <= 700 &&
    height <= 700 &&
    byteLength < 120000
  )
    return true;

  // Canvas thật có thể tồn tại, nhưng phải đủ lớn/dày dữ liệu.
  if (method === "canvas" && sourceKind === "canvas" && byteLength < 180000)
    return true;

  return false;
}

function isPreferredChatGptRealImageAsset(asset = {}) {
  const method = String(asset.method || "").toLowerCase();
  const sourceKind = String(asset.sourceKind || "").toLowerCase();
  const width = Number(asset.width || 0);
  const height = Number(asset.height || 0);
  const byteLength = Number(asset.byteLength || 0);

  if (isLikelyChatGptLoadingPlaceholderImage(asset)) return false;

  // Ưu tiên ảnh thật từ URL/backend.
  if (
    method === "img" &&
    (sourceKind.includes("remote") || sourceKind.includes("url")) &&
    width >= 512 &&
    height >= 512 &&
    byteLength >= 120000
  ) {
    return true;
  }

  // Canvas chỉ nhận khi đủ lớn và đủ byte.
  if (
    method === "canvas" &&
    width >= 768 &&
    height >= 768 &&
    byteLength >= 250000
  ) {
    return true;
  }

  return false;
}


function isFalseChatGptImageGeneratingState(state = {}) {
  return Boolean(
    state.generating &&
    !state.preparingImage &&
    !state.stopButtonVisible &&
    !state.stopButton &&
    !state.sendReady &&
    !state.composerBusy &&
    !String(state.sendText || "").trim(),
  );
}

async function refreshChatGptPageBeforeImageExtract(client, context = {}) {
  const sceneId = context.sceneId || "";
  await appendAppLog(null, {
    source: "main",
    kind: "warning",
    text: `Scene ${sceneId}: ChatGPT image wait looks stale; refreshing page to re-read existing output before retry.`,
    details: context,
  }).catch(() => null);

  await client.Page?.bringToFront?.().catch(() => null);
  const reloadResult = await requestReloadWithReason(client, "stale_image_wait", sceneId);
  if (!reloadResult) {
    return;
  }
  await waitForCdpLoad(client).catch(() => null);
  await sleep(7000);

  const state = await evaluateOnCdpPage(
    client,
    `(${readChatGptImageStateScript.toString()})()`,
  ).catch((error) => ({ ok: false, error: error.message }));
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `Scene ${sceneId}: ChatGPT refreshed; checking current conversation output again.`,
    details: { imageState: sanitizeChatGptImageSnapshot(state) },
  }).catch(() => null);

  return state;
}

/* VIDORA_CHATGPT_INPUT_GATE_REAL */








async function waitForChatGptImageGenerationDoneBeforeExtract(
  client,
  options = {},
) {
  const sceneId =
    (typeof options !== "undefined" && options?.sceneId) ||
    (typeof context !== "undefined" && context?.sceneId) ||
    "";
  const startedAt = Date.now();
  let lastBusyLogAt = 0;
  let firstIdleAt = 0;
  let retryableImageTextTicks = 0;
  let lastRetryableImageText = "";
  let refreshedForStaleOutput = false;

  while (Date.now() - startedAt < 900000) {
    const imageState = await evaluateOnCdpPage(
      client,
      `(${readChatGptImageStateScript.toString()})()`,
    ).catch((error) => ({ ok: false, generating: true, error: error.message }));

    const activeGeneration = await evaluateOnCdpPage(
      client,
      `(${detectChatGptActiveGenerationScriptStrict.toString()})()`,
    ).catch((error) => ({ ok: false, generating: true, error: error.message }));
    if (imageState?.stoppedCreatingImage) {
      await appendAppLog(null, {
        source: "main",
        kind: "warning",
        text: `Scene ${sceneId}: ChatGPT stopped creating image; retrying NV1 instead of waiting forever.`,
        details: {
          imageState: sanitizeChatGptImageSnapshot(imageState),
          activeGeneration,
        },
      }).catch(() => null);
      return {
        ok: false,
        retryReason: "chatgpt-stopped-creating-image",
        imageState: sanitizeChatGptImageSnapshot(imageState),
        activeGeneration,
      };
    }
    const latestAssistantText = String(
      imageState?.latestAssistantText || "",
    ).trim();
    const normalizedRetryText = normalizeChatGptRetryText(latestAssistantText);
    if (
      latestAssistantText &&
      isRetryableChatGptToolErrorText(latestAssistantText, "image") &&
      !(imageState?.urls || []).length
    ) {
      if (normalizedRetryText && normalizedRetryText === lastRetryableImageText)
        retryableImageTextTicks += 1;
      else {
        lastRetryableImageText = normalizedRetryText;
        retryableImageTextTicks = 1;
      }
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `Scene ${sceneId}: ChatGPT returned retryable image tool text; tick ${retryableImageTextTicks}/2 before NV1 retry.`,
        details: {
          reason: "chatgpt-image-tool-error-text-before-extract",
          latestAssistantText: latestAssistantText.slice(0, 600),
        },
      }).catch(() => null);
      if (retryableImageTextTicks >= 2) {
        return {
          ok: false,
          retryReason: "chatgpt-image-tool-error-text-before-extract",
          imageState: sanitizeChatGptImageSnapshot(imageState),
          activeGeneration,
        };
      }
    } else {
      lastRetryableImageText = "";
      retryableImageTextTicks = 0;
    }

    const busy = Boolean(
      imageState?.generating ||
      imageState?.preparingImage ||
      imageState?.stopButtonVisible ||
      imageState?.stopVisible ||
      imageState?.composerBusy ||
      imageState?.streamingIndicator,
    );

    if (!busy) {
      if (!firstIdleAt) {
        firstIdleAt = Date.now();
        // HOOK_INPUT_GATE_BEFORE_FINAL_SETTLE_REAL
        await vidoraChatGptInputGate(
          typeof client !== "undefined"
            ? client
            : typeof page !== "undefined"
              ? page
              : null,
          {
            sceneId:
              (typeof options !== "undefined" && options?.sceneId) ||
              (typeof context !== "undefined" && context?.sceneId) ||
              "",
            stage: "before-final-image-settle",
          },
        );

        await appendAppLog(null, {
          source: "main",
          kind: "running",
          text: `Scene ${(typeof options !== "undefined" && options?.sceneId) || (typeof context !== "undefined" && context?.sceneId) || ""}: ChatGPT stop button gone; waiting 4s for final image to settle before extract.`,
          details: {
            imageState: sanitizeChatGptImageSnapshot(imageState),
            activeGeneration,
          },
        }).catch(() => null);
      }

      if (Date.now() - firstIdleAt >= 4000) {
        return {
          ok: true,
          idleMs: Date.now() - firstIdleAt,
          waitedMs: Date.now() - startedAt,
          imageState: sanitizeChatGptImageSnapshot(imageState),
          activeGeneration,
        };
      }
    } else {
      firstIdleAt = 0;
      if (!refreshedForStaleOutput && Date.now() - startedAt >= 480000) {
        refreshedForStaleOutput = true;
        await refreshChatGptPageBeforeImageExtract(client, {
          sceneId,
          stage: "pre-extract-stale-refresh",
          waitedMs: Date.now() - startedAt,
          imageState: sanitizeChatGptImageSnapshot(imageState),
          activeGeneration,
        });
        firstIdleAt = 0;
        lastBusyLogAt = 0;
        continue;
      }
      if (Date.now() - lastBusyLogAt > 10000) {
        lastBusyLogAt = Date.now();
        await appendAppLog(null, {
          source: "main",
          kind: "running",
          text: `Scene ${sceneId}: ChatGPT còn dấu hiệu đang tạo ảnh; chưa extract keyframe.`,
          details: {
            imageState: sanitizeChatGptImageSnapshot(imageState),
            activeGeneration,
          },
        }).catch(() => null);
      }
    }

    await sleep(1500);
  }

  throw new Error(
    `Scene ${sceneId}: Hết thời gian chờ ChatGPT hoàn tất ảnh trước khi extract.`,
  );
}

async function waitForLatestChatGPTGeneratedImage(client, options = {}) {
  const sceneId =
    (typeof options !== "undefined" && options?.sceneId) ||
    (typeof context !== "undefined" && context?.sceneId) ||
    "";
  const known = new Set(options.existingUrls || []);
  const realStallMs = 300000;
  const minAssistantRootIndex = Number(options.minAssistantRootIndex || 0);
  let lastSnapshot = null;
  let loggedAfterResponse = false;

  let falseGeneratingTicks = 0;
  let lastExtract = null;
  let lastSignature = "";
  let stableTicks = 0;
  let lastDiagnostic = null;
  let lastReadiness = { state: "no_candidate_yet" };
  await captureAndLogChatGptDiagnostics(client, sceneId, options.beforeCount || 0, "image-extract-init").catch(() => null);

  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `chatgptImageExtract: waiting for latest assistant image for scene ${sceneId}`,
    details: { minAssistantRootIndex, existingUrlCount: known.size },
  });
  for (let attempt = 1; ; attempt += 1) {
    assertPipelineRunActive();
    const attemptStartedAt = Date.now();
    let sawGenerating = false;
    let readyTicks = 0;
    let lastLogAt = 0;
    let refreshedForVisibleOutput = false;
    let textOnlyAnswer = false;
    const resendImagePrompt = async (reason, snapshot) => {
      assertPipelineRunActive();
      const projectDir = options.originalOptions?.outputFolder || path.dirname(options.sceneDir);

      if (options.outputPath && (await pathExists(options.outputPath))) {
        const isValid = await validateSavedImageFile(options.outputPath).then(() => true).catch(() => false);
        if (isValid) {
          await appendAppLog(sceneId, {
            source: "main",
            kind: "ok",
            text: `Scene ${sceneId}: Keyframe image file already exists and is valid. Skipping adopt and breakout.`,
          });
          const breakoutError = new Error("BREAKOUT_RECURSIVE_RETRY");
          breakoutError.result = { imagePath: options.outputPath, motionPrompt: "" };
          throw breakoutError;
        }
      }
      
      const adoptResult = await adoptExistingSceneImage(client, minAssistantRootIndex, sceneId).catch(() => null);

      if (adoptResult?.ok && adoptResult.base64) {
        const sourceBuffer = Buffer.from(adoptResult.base64, "base64");
        const decoded = decodeImageBufferToPng(sourceBuffer, adoptResult.contentType);
        await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
        await fs.writeFile(options.outputPath, decoded.buffer);
        await validateSavedImageFile(options.outputPath);
        
        await persistDurableStage(projectDir, sceneId, "nv1_image_validated", {
          keyframePath: options.outputPath,
          chatGptConversationUrl: options.originalOptions?.chatUrl || "",
        }).catch(() => null);

        await appendAppLog(sceneId, {
          source: "main",
          kind: "ok",
          text: `Scene ${sceneId}: Adopted existing completed image from chat successfully before local retry resend. Skipping retry resend.`,
          details: adoptResult,
        });
        const breakoutError = new Error("BREAKOUT_RECURSIVE_RETRY");
        breakoutError.result = { imagePath: options.outputPath, motionPrompt: "" };
        throw breakoutError;
      }
      const retryStatusString = `${attempt}/3`;
      const currentAttemptIndex = attempt;

      // Hard enforcement: Break out immediately if local retries meet or exceed 3
      const localRetryMatch = String(retryStatusString || "").match(/(\d+)\/3/);
      const currentLocalRetryCount = localRetryMatch
        ? parseInt(localRetryMatch[1], 10)
        : 0;

      if (currentLocalRetryCount >= 3 || currentAttemptIndex >= 3) {
        await appendAppLog(
          sceneId,
          "warning",
          `Scene ${sceneId}: Local ChatGPT image retry threshold reached (${retryStatusString || currentAttemptIndex}/3). Auto new-chat rotation disabled; preserving current conversation for manual/outer recovery.`,
        ).catch(() => null);
        throw new Error(
          "chatgpt-image-retry-threshold-reached-no-auto-rotation",
        );
      }

      const safeSnapshot = sanitizeChatGptImageSnapshot(snapshot);
      await fs
        .writeFile(
          path.join(
            options.sceneDir,
            `scene_${String(sceneId).padStart(3, "0")}_chatgpt_image_retry_${attempt}_${reason}.json`,
          ),
          JSON.stringify(
            {
              reason,
              snapshot: safeSnapshot,
              attempt,
              elapsedMs: Date.now() - attemptStartedAt,
            },
            null,
            2,
          ),
          "utf8",
        )
        .catch(() => null);
      assertPipelineRunActive();
      await notifyRenderer('chatgpt-image-retry', `Scene ${sceneId}: ChatGPT image not ready (${reason}); retrying NV1 attempt ${attempt + 1}/3.`, { sceneId, attempt, reason });
      assertPipelineRunActive();
      const stopped = await evaluateOnCdpPage(client, `(${clickChatGptStopGeneratingScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
      await appendAppLog(null, {
        source: "main",
        kind: stopped?.ok ? "running" : "error",
        text: `Scene ${sceneId}: ChatGPT stop before image retry (${reason}): ${stopped?.ok ? stopped.mode : stopped?.error || "not-found"}`,
        details: stopped,
      });

      if (stopped?.error === "stop-button-not-found") {
        assertPipelineRunActive();
        await appendAppLog(null, {
          source: "main",
          kind: "warning",
          text: `Scene ${sceneId}: Stop button not found during image retry recovery. Forcing hard reload and resending NV1.`,
        });
        const reloadResult = await requestReloadWithReason(client, "image_retry_hard_reload", sceneId);
        if (reloadResult) {
          await waitForCdpLoad(client).catch(() => null);
          await sleep(4000);
        }
        assertPipelineRunActive();

        if (
          options.referenceImagePaths &&
          options.referenceImagePaths.length > 0
        ) {
          for (const refPath of options.referenceImagePaths) {
            assertPipelineRunActive();
            await uploadFileToChatGptDirectly(client, refPath, sceneId).catch(
              () => null,
            );
          }
        }

        const retryPrompt = `${options.prompt}\n\nRETRY ${attempt + 1}: Previous response did not produce a complete usable image asset. Generate exactly one image in this chat now. Do not answer with text only.`;
        await evaluateOnCdpPage(
          client,
          `(${prepareChatGptCreateImageScript.toString()})()`,
        ).catch(() => null);
        await sleep(800);
        assertPipelineRunActive();
        const resent = await sendPromptViaCdpInput(client, retryPrompt);
        if (!resent.ok)
          throw new Error(
            resent.error || "Không gửi lại được image prompt vào ChatGPT.",
          );
        await appendAppLog(null, {
          source: "main",
          kind: "running",
          text: `Scene ${sceneId}: resent image prompt continuous attempt ${attempt + 1} after hard reload bypass.`,
          details: { resent },
        });
        return;
      }

      await sleep(1200);
      assertPipelineRunActive();
      const retryPrompt = `${options.prompt}\n\nRETRY ${attempt + 1}: Previous response did not produce a complete usable image asset. Generate exactly one image in this chat now. Do not answer with text only.`;
      await evaluateOnCdpPage(
        client,
        `(${prepareChatGptCreateImageScript.toString()})()`,
      ).catch(() => null);
      await sleep(800);
      assertPipelineRunActive();
      const resent = await sendPromptViaCdpInput(client, retryPrompt);
      if (!resent.ok)
        throw new Error(
          resent.error ||
            "KhÃ´ng gá»­i láº¡i Ä‘Æ°á»£c image prompt vÃ o ChatGPT.",
        );
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `Scene ${sceneId}: resent image prompt continuous attempt ${attempt + 1}.`,
        details: { resent },
      });
    };

    while (Date.now() - attemptStartedAt < 900000) {
      const preExtractWait =
        await waitForChatGptImageGenerationDoneBeforeExtract(
          client,
          options,
        ).catch((error) => ({
          ok: false,
          retryReason: "pre-extract-wait-timeout",
          error: error.message,
        }));
      if (!preExtractWait?.ok) {
        await resendImagePrompt(
          preExtractWait?.retryReason || "pre-extract-wait-failed",
          preExtractWait?.imageState ||
            lastSnapshot || { error: preExtractWait?.error || "unknown" },
        );
        break;
      }
      if (!loggedAfterResponse) {
        loggedAfterResponse = true;
        await logMemoryMilestone(sceneId, "After response").catch(() => null);
      }
      await sleep(3000);
      await recoverCdpPageIfCrashed(
        client,
        "chatgpt",
        `image-wait-scene-${(typeof options !== "undefined" && options?.sceneId) || (typeof context !== "undefined" && context?.sceneId) || ""}`,
      ).catch(() => null);
      await recoverChatGptBlockingUi(client, {
        sceneId:
          (typeof options !== "undefined" && options?.sceneId) ||
          (typeof context !== "undefined" && context?.sceneId) ||
          "",
        stage: "image-wait-before-extract",
      }).catch(() => null);

      // HOOK_INPUT_GATE_BEFORE_IMAGE_EXTRACT_REAL
      await vidoraChatGptInputGate(
        typeof client !== "undefined"
          ? client
          : typeof page !== "undefined"
            ? page
            : null,
        {
          sceneId:
            (typeof options !== "undefined" && options?.sceneId) ||
            (typeof context !== "undefined" && context?.sceneId) ||
            "",
          stage: "before-image-extract-wait",
        },
      );

      // Ensure the image is fully loaded and hydrated using the scroll-and-verify loop
      const hydration = await evaluateOnCdpPage(
        client,
        `(${ensureChatGptImageLoadedAndHydratedScript.toString()})(${minAssistantRootIndex})`,
      ).catch((err) => ({ ok: false, error: err.message }));
      
      const hydrationMsg = hydration?.ok
        ? `ChatGPT image hydration success: tick=${hydration.tick || 0}, elapsed=${hydration.elapsedMs || 0}ms, mode=${hydration.mode || "unknown"}, placeholderDisappeared=${hydration.placeholderDisappeared}`
        : `ChatGPT image hydration failed: ${hydration?.error || "unknown"}`;

      await appendAppLog(sceneId, {
        source: "main",
        kind: hydration?.ok ? "ok" : "warning",
        text: `Scene ${sceneId}: ${hydrationMsg}`,
        details: hydration,
      }).catch(() => null);

      const extracted = await extractLatestChatGPTGeneratedImageBytes(client, {
        existingUrls: [...known],
        minAssistantRootIndex,
      }).catch((error) => ({
        ok: false,
        error: error.message,
        mode: "extract-error",
      }));
      lastExtract = extracted;
      if (extracted?.diagnostics) lastDiagnostic = extracted.diagnostics;

      const snapshot = await evaluateOnCdpPage(
        client,
        `(${readChatGptImageStateScript.toString()})()`,
      );
      lastSnapshot = snapshot;

      // false-generating-empty-chat-break
      if (isFalseChatGptImageGeneratingState(snapshot)) {
        falseGeneratingTicks =
          (typeof falseGeneratingTicks === "number"
            ? falseGeneratingTicks
            : 0) + 1;

        await appendAppLog(null, {
          source: "main",
          kind: "running",
          text: `Scene ${(typeof options !== "undefined" && options?.sceneId) || (typeof context !== "undefined" && context?.sceneId) || ""}: ChatGPT image generating looks stale/empty; tick ${falseGeneratingTicks}/3.`,
          details: vidoraCompactLogDetails({ imageState: snapshot }),
        }).catch(() => null);

        if (falseGeneratingTicks >= 3) {
          await appendAppLog(null, {
            source: "main",
            kind: "error",
            text: `Scene ${(typeof options !== "undefined" && options?.sceneId) || (typeof context !== "undefined" && context?.sceneId) || ""}: ChatGPT không thực sự tạo ảnh; thoát vòng chờ để retry gửi NV1.`,
            details: {
              imageState: snapshot,
              reason: "false-generating-empty-chat",
            },
          }).catch(() => null);

          throw new Error(
            "false-generating-empty-chat: ChatGPT page is idle/empty but detector says generating.",
          );
        }
      } else {
        falseGeneratingTicks = 0;
      }
      if (snapshot?.loggedOut)
        throw new Error(
          loginRequiredMessage(
            "chatgpt",
            snapshot.logoutReason ||
              "ChatGPT logged out while waiting for NV1 image",
          ),
        );
      const activeGeneration = isChatGptActivelyGenerating(snapshot);
      const hasActiveAssistantResponse = await evaluateOnCdpPage(
        client,
        `(() => {
          const assistants = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
          if (!assistants.length) return false;
          const latestAssistant = assistants[assistants.length - 1];
          const latestText = (latestAssistant.textContent || "").trim();
          if (latestText.length > 10) return true;
          for (const node of assistants) {
            if (node.querySelector('img, canvas, [aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"], .aspect-square, .aspect-video, [class*="aspect-"]')) {
              return true;
            }
          }
          return false;
        })()`
      ).catch(() => false);

      const hasNewAssistantAfterPrompt =
        Number(snapshot?.assistantCount || 0) > minAssistantRootIndex ||
        hasActiveAssistantResponse;
      const scopedSnapshot = hasNewAssistantAfterPrompt
        ? snapshot
        : { ...snapshot, urls: [] };
      const visibleCandidate =
        hasVisibleChatGptImageCandidate(extracted) ||
        (Array.isArray(scopedSnapshot?.urls) && scopedSnapshot.urls.length > 0);
      const networkExtract =
        !extracted?.ok && (!activeGeneration || visibleCandidate)
          ? await tryExtractChatGptNetworkImage(
              client,
              options.networkCapture,
            ).catch((error) => ({
              ok: false,
              mode: "network-error",
              error: error.message,
            }))
          : null;
      const screenshotExtract =
        !extracted?.ok &&
        !networkExtract?.ok &&
        extracted?.screenshotCandidate &&
        (!activeGeneration || visibleCandidate)
          ? await captureChatGptImageElementScreenshot(
              client,
              extracted.screenshotCandidate,
              {
                sceneId:
                  (typeof options !== "undefined" && options?.sceneId) ||
                  (typeof context !== "undefined" && context?.sceneId) ||
                  "",
              },
            ).catch((error) => ({
              ok: false,
              mode: "element-screenshot-error",
              error: error.message,
            }))
          : null;
      const chosen = extracted?.ok
        ? extracted
        : networkExtract?.ok
          ? networkExtract
          : screenshotExtract?.ok
            ? screenshotExtract
            : null;
      const readiness = classifyChatGptImageReadiness({
        chosen,
        extracted,
        snapshot: scopedSnapshot,
        elapsedMs: Date.now() - attemptStartedAt,
        stallMs: realStallMs,
      });
      lastReadiness = readiness;

      textOnlyAnswer =
        hasNewAssistantAfterPrompt &&
        String(snapshot?.latestAssistantText || "").length > 20 &&
        !/preparing image|creating image|generating image|đang tạo ảnh|thinking/i.test(
          String(snapshot?.latestAssistantText || ""),
        ) &&
        !looksLikeCollapsedUserPrompt(snapshot?.latestAssistantText, "image");

      await appendAppLog(sceneId, {
        source: "main",
        kind: "running",
        text: `[DETECTOR DIAGNOSTICS] Scene ${sceneId}: attempt=${attempt} elapsed=${Date.now() - attemptStartedAt}ms readiness=${readiness.state} activeGeneration=${activeGeneration} visibleCandidate=${visibleCandidate} textOnlyAnswer=${textOnlyAnswer}`,
        details: {
          hydration,
          extracted: {
            ok: extracted?.ok,
            error: extracted?.error,
            mode: extracted?.mode,
            candidates: extracted?.diagnostics?.imageCandidates?.length || 0,
            rejected: extracted?.diagnostics?.rejected?.length || 0,
            rejectedReasons: extracted?.diagnostics?.rejected?.map?.(r => r.reason) || [],
          },
          networkExtract: { ok: networkExtract?.ok, mode: networkExtract?.mode, error: networkExtract?.error },
          screenshotExtract: { ok: screenshotExtract?.ok, mode: screenshotExtract?.mode, error: screenshotExtract?.error },
          snapshot: {
            assistantCount: snapshot?.assistantCount,
            preparingImage: snapshot?.preparingImage,
            voiceReady: snapshot?.voiceReady,
            latestAssistantText: snapshot?.latestAssistantText ? snapshot.latestAssistantText.slice(0, 100) : "",
          }
        }
      }).catch(() => null);

      if (chosen?.ok) {
        const signature = chatGptImageCandidateSignature(chosen);
        if (signature && signature === lastSignature) stableTicks += 1;
        else {
          lastSignature = signature;
          stableTicks = 1;
        }
        await appendAppLog(null, {
          source: "main",
          kind: stableTicks >= 3 ? "ok" : "running",
          text: `chatgptImageExtract: found candidate type=${chosen.method || chosen.sourceKind || "image"} stable=${stableTicks}/2`,
          details: {
            method: chosen.method || "",
            sourceKind: chosen.sourceKind || "",
            width: chosen.width || 0,
            height: chosen.height || 0,
            byteLength: chosen.byteLength || 0,
            rootIndex: chosen.rootIndex,
            requestId: chosen.requestId || "",
            readinessState: readiness.state,
          },
        });
        if (stableTicks >= 3) {
          if (readiness.visibleCandidate) {
            await appendAppLog(null, {
              source: "main",
              kind: "ok",
              text: "chatgptImageExtract: visible image detected; suppressing thinking-stall",
              details: {
                sceneId:
                  (typeof options !== "undefined" && options?.sceneId) ||
                  (typeof context !== "undefined" && context?.sceneId) ||
                  "",
                readinessState: readiness.state,
                activeGeneration: readiness.activeGeneration,
              },
            });
          }
          await appendAppLog(null, {
            source: "main",
            kind: "ok",
            text: `chatgptImageExtract: saved image via method=${chosen.method || chosen.sourceKind || "unknown"} for scene ${(typeof options !== "undefined" && options?.sceneId) || (typeof context !== "undefined" && context?.sceneId) || ""}`,
            details: {
              width: chosen.width || 0,
              height: chosen.height || 0,
              byteLength: chosen.byteLength || 0,
              rootIndex: chosen.rootIndex,
            },
          });
          return chosen;
        }
        continue;
      }
      if (readiness.state === "image_visible_but_not_extractable") {
        sawGenerating = true;
        readyTicks = 0;
        if (
          !refreshedForVisibleOutput &&
          Date.now() - attemptStartedAt >= 150000
        ) {
          refreshedForVisibleOutput = true;
          await refreshChatGptPageBeforeImageExtract(client, {
            sceneId:
              (typeof options !== "undefined" && options?.sceneId) ||
              (typeof context !== "undefined" && context?.sceneId) ||
              "",
            stage: "visible-image-not-extractable-refresh",
            waitedMs: Date.now() - attemptStartedAt,
            readinessState: readiness.state,
            extractMode: extracted?.mode || "",
            extractError: extracted?.error || "",
            diagnostic: {
              ...(lastDiagnostic || {}),
              reasonSelected: readiness.state,
            },
          });
          lastLogAt = 0;
          continue;
        }
        if (Date.now() - lastLogAt > 10000) {
          lastLogAt = Date.now();
          await appendAppLog(null, {
            source: "main",
            kind: "running",
            text: "chatgptImageExtract: visible image detected; suppressing thinking-stall",
            details: {
              sceneId:
                (typeof options !== "undefined" && options?.sceneId) ||
                (typeof context !== "undefined" && context?.sceneId) ||
                "",
              readinessState: readiness.state,
              diagnostic: {
                ...(lastDiagnostic || {}),
                reasonSelected: readiness.state,
              },
              extractMode: extracted?.mode || "",
              extractError: extracted?.error || "",
              network: networkExtract,
              screenshot: screenshotExtract,
            },
          });
          await appendAppLog(null, {
            source: "main",
            kind: "error",
            text: "chatgptImageExtract: image visible but extraction failed",
            details: {
              sceneId:
                (typeof options !== "undefined" && options?.sceneId) ||
                (typeof context !== "undefined" && context?.sceneId) ||
                "",
              rejected: extracted?.diagnostics?.rejected?.slice?.(0, 8) || [],
              imageCandidates:
                extracted?.diagnostics?.imageCandidates?.slice?.(0, 8) || [],
              networkCandidates: options.networkCapture?.summary?.() || [],
            },
          });
        }
        continue;
      }
      if (readiness.state === "still_generating") {
        sawGenerating = true;
        readyTicks = 0;
        if (Date.now() - lastLogAt > 15000) {
          lastLogAt = Date.now();
          await appendAppLog(null, {
            source: "main",
            kind: "running",
            text: `Scene ${(typeof options !== "undefined" && options?.sceneId) || (typeof context !== "undefined" && context?.sceneId) || ""}: waiting for ChatGPT generated image asset (${snapshot?.preparingImage ? "preparing-image" : "thinking"}).`,
            details: {
              mode: snapshot?.assistantMode,
              urls: snapshot?.urls?.length || 0,
              assistantCount: snapshot?.assistantCount || 0,
              extractMode: extracted?.mode || "",
              extractError: extracted?.error || "",
              rejected: extracted?.diagnostics?.rejected?.slice?.(0, 4) || [],
              imageCandidates:
                extracted?.diagnostics?.imageCandidates?.slice?.(0, 4) || [],
              networkCandidates: options.networkCapture?.summary?.() || [],
              readinessState: readiness.state,
              elapsedMs: Date.now() - attemptStartedAt,
            },
          });
        }
        continue;
      }

      const composerLooksReady = snapshot?.voiceReady;
      textOnlyAnswer =
        Number(snapshot?.assistantCount || 0) > minAssistantRootIndex &&
        String(snapshot?.latestAssistantText || "").length > 20 &&
        !/preparing image|creating image|generating image|Ä‘ang táº¡o áº£nh|thinking/i.test(
          String(snapshot?.latestAssistantText || ""),
        ) &&
        !looksLikeCollapsedUserPrompt(snapshot?.latestAssistantText, "image");
      if (composerLooksReady) readyTicks += 1;
      if (Date.now() - lastLogAt > 15000) {
        lastLogAt = Date.now();
        await appendAppLog(null, {
          source: "main",
          kind: "running",
          text: `chatgptImageExtract: candidate rejected reason=${extracted?.mode || networkExtract?.mode || screenshotExtract?.mode || "not-ready"}`,
          details: {
            sceneId:
              (typeof options !== "undefined" && options?.sceneId) ||
              (typeof context !== "undefined" && context?.sceneId) ||
              "",
            diagnostic: {
              ...(lastDiagnostic || {}),
              reasonSelected: readiness.state,
            },
            network: networkExtract,
            screenshot: screenshotExtract,
            networkCandidates: options.networkCapture?.summary?.() || [],
            readinessState: readiness.state,
          },
        });
      }
      if (readiness.state === "real_stall") {
        await resendImagePrompt("real_stall", snapshot);
        break;
      }
      const activeAssetOrLoader = await evaluateOnCdpPage(
        client,
        `((minRoot) => {
          const assistants = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
          const scanMinIndex = Math.min(minRoot, Math.max(0, assistants.length - 1));
          const sceneAssistants = assistants.slice(scanMinIndex);
          if (!sceneAssistants.length) return false;
          
          for (const node of sceneAssistants) {
            const found = node.querySelector(
              'img, canvas, [aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"], .aspect-square, .aspect-video, [class*="aspect-"]'
            );
            if (found) return true;
          }
          
          const hasStop = !![...document.querySelectorAll('button, [role="button"]')].find(btn => {
            const style = window.getComputedStyle(btn);
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || 1) === 0) return false;
            return /stop|dừng/i.test(btn.textContent || btn.innerText || btn.getAttribute('aria-label') || '');
          });
          if (hasStop) return true;
          
          return false;
        })(${Number(minAssistantRootIndex || 0)})`
      ).catch(() => false);

      const hasNetworkActivity = Boolean(options.networkCapture?.summary?.()?.length > 0);
      const isGeneratingOrLoading = activeAssetOrLoader || hasNetworkActivity || hasActiveAssistantResponse;

      if (
        (sawGenerating && composerLooksReady && readyTicks >= 8 && !isGeneratingOrLoading) ||
        textOnlyAnswer
      ) {
        await resendImagePrompt(
          textOnlyAnswer
            ? "text-only-answer"
            : "no-usable-image-asset-after-generating",
          snapshot,
        );
        break;
      }
    }
  }
  await fs
    .writeFile(
      path.join(
        options.sceneDir,
        `scene_${String((typeof options !== "undefined" && options?.sceneId) || (typeof context !== "undefined" && context?.sceneId) || "").padStart(3, "0")}_chatgpt_image_wait_failed.json`,
      ),
      JSON.stringify(
        {
          lastSnapshot: sanitizeChatGptImageSnapshot(lastSnapshot),
          lastExtract,
          readiness: { ...lastReadiness, state: "timeout" },
          diagnostic: { ...(lastDiagnostic || {}), reasonSelected: "timeout" },
          networkCandidates: options.networkCapture?.summary?.() || [],
          existingUrlCount: known.size,
        },
        null,
        2,
      ),
      "utf8",
    )
    .catch(() => null);
  await appendAppLog(null, {
    source: "main",
    kind: "error",
    text: `chatgptImageExtract: diagnostic summary for scene ${(typeof options !== "undefined" && options?.sceneId) || (typeof context !== "undefined" && context?.sceneId) || ""}`,
    details: {
      readiness: { ...lastReadiness, state: "timeout" },
      diagnostic: { ...(lastDiagnostic || {}), reasonSelected: "timeout" },
      lastExtract,
      lastSnapshot: sanitizeChatGptImageSnapshot(lastSnapshot),
      networkCandidates: options.networkCapture?.summary?.() || [],
    },
  });
  throw new Error(
    "Timed out waiting for a complete ChatGPT generated image asset. Screenshot crop was not saved as keyframe.",
  );
}

async function extractLatestChatGPTGeneratedImageBytes(client, options = {}) {
  return evaluateOnCdpPage(
    client,
    `(${extractLatestChatGPTGeneratedImageBytesScript.toString()})(${JSON.stringify(options.existingUrls || [])}, ${JSON.stringify(Number(options.minAssistantRootIndex || 0))})`,
  );
}

function decodeImageBufferToPng(buffer, contentType = "") {
  if (!buffer || buffer.length < 4096)
    throw new Error("Generated image asset is too small.");
  const image = nativeImage.createFromBuffer(buffer);
  if (image.isEmpty())
    throw new Error(
      `Generated image asset could not be decoded (${contentType || "unknown content type"}).`,
    );
  const size = image.getSize();
  if (size.width < 256 || size.height < 256)
    throw new Error(
      `Generated image asset is too small (${size.width}x${size.height}).`,
    );
  const png = image.toPNG();
  if (!png || png.length < 4096) throw new Error("Decoded image PNG is empty.");
  return { buffer: png, width: size.width, height: size.height };
}

async function validateSavedImageFile(filePath) {
  const buffer = await fs.readFile(filePath);
  if (buffer.length < 4096)
    throw new Error("Saved keyframe image is too small.");
  const pngMagic =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const jpgMagic =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;
  const webpMagic =
    buffer.length >= 12 &&
    buffer.slice(0, 4).toString("ascii") === "RIFF" &&
    buffer.slice(8, 12).toString("ascii") === "WEBP";
  if (!pngMagic && !jpgMagic && !webpMagic)
    throw new Error("Saved keyframe is not a PNG/JPEG/WebP image.");
  const image = nativeImage.createFromBuffer(buffer);
  if (image.isEmpty())
    throw new Error("Saved keyframe image cannot be decoded.");
  const size = image.getSize();
  if (size.width < 256 || size.height < 256)
    throw new Error(
      `Saved keyframe image is too small (${size.width}x${size.height}).`,
    );
  return {
    ok: true,
    filePath,
    byteLength: buffer.length,
    width: size.width,
    height: size.height,
  };
}

async function selectChatGptConversationByTitle(client, title = "") {
  const wanted = String(title || "").trim();
  if (!wanted) return { ok: true, skipped: true };
  await client.Page.bringToFront().catch(() => null);
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const state = await evaluateOnCdpPage(
      client,
      `(${findChatGptConversationScript.toString()})(${JSON.stringify(wanted)})`,
    ).catch((error) => ({ ok: false, error: error.message }));
    if (state?.ok && state.box) {
      const x = state.box.x + state.box.width / 2;
      const y = state.box.y + state.box.height / 2;
      await client.Input.dispatchMouseEvent({
        type: "mouseMoved",
        x,
        y,
        button: "none",
      }).catch(() => null);
      await client.Input.dispatchMouseEvent({
        type: "mousePressed",
        x,
        y,
        button: "left",
        clickCount: 1,
      }).catch(() => null);
      await client.Input.dispatchMouseEvent({
        type: "mouseReleased",
        x,
        y,
        button: "left",
        clickCount: 1,
      }).catch(() => null);
      await waitForCdpLoad(client).catch(() => null);
      await sleep(1600);
      const locationState = await evaluateOnCdpPage(
        client,
        `({ href: location.href, path: location.pathname, title: document.title })`,
      ).catch((error) => ({ error: error.message }));
      if (String(locationState?.path || "").startsWith("/c/")) {
        updateChatGptConversationIdentity(locationState, wanted);
        return { ...state, location: locationState };
      }
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `ChatGPT context: đã click "${wanted}" nhưng URL chưa vào /c/... (path=${locationState?.path || ""}), thử lại.`,
        details: locationState,
      });
    }
    await sleep(600);
  }
  return {
    ok: false,
    error: `Không tìm thấy cuộc trò chuyện ChatGPT tên "${wanted}" trong sidebar.`,
  };
}

async function waitForChatGptRecentItem(
  page,
  conversationPath = "",
  sceneId = "",
) {
  const conversationId =
    String(conversationPath || "").match(/\/c\/([^/?#]+)/)?.[1] || "";
  const startedAt = Date.now();
  let last = null;
  while (Date.now() - startedAt < 30000) {
    last = await evaluateOnCdpPage(
      page,
      `(() => {
      try {
        const conversationId = ${JSON.stringify(conversationId)};
        const nodes = Array.from(document.querySelectorAll('nav a, aside a, [role="navigation"] a, a[href*="/c/"], nav [role="link"], aside [role="link"], nav li, aside li, nav div, aside div'));
        const candidates = nodes.map((node) => {
          const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
          const href = node.href || (node.getAttribute ? node.getAttribute('href') : '') || '';
          const text = String(node.innerText || node.textContent || '').trim();
          const cls = String(node.className || '');
          const current = node.getAttribute ? (node.getAttribute('aria-current') || node.getAttribute('aria-selected') || '') : '';
          return { href, rect, text, cls, current };
        }).filter((item) => item.text && item.rect && item.rect.width > 40 && item.rect.height > 12 && item.rect.x < 220 && item.rect.y > 250);
        const hrefItem = candidates.find((item) => item.href.indexOf('/c/' + conversationId) >= 0);
        const activeItem = candidates.find((item) => /page|true|active|selected/i.test(String(item.current) + ' ' + item.cls));
        const topItem = candidates.slice().sort((a, b) => a.rect.y - b.rect.y)[0];
        const item = hrefItem || activeItem || null;
        return { ok: Boolean(item), mode: hrefItem ? 'href' : activeItem ? 'active' : 'missing', text: item?.text || '', candidateCount: candidates.length, topText: topItem?.text || '', path: location.pathname };
      } catch (error) {
        return { ok: false, error: error && error.message ? error.message : String(error), path: location.pathname };
      }
    })()`,
    ).catch((error) => ({ ok: false, error: error.message }));
    if (last?.ok) return last;
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Scene ${sceneId}: chờ Recents render chat mới (${last?.mode || last?.error || "missing"}), top="${last?.topText || ""}" count=${last?.candidateCount || 0}`,
    });
    await sleep(1000);
  }
  return {
    ok: false,
    error: "Timeout waiting for current chat to appear in Recents.",
    last,
  };
}

async function checkChatGptCurrentConversationTitle(
  page,
  expectedTitle = "",
  options = {},
) {
  const wanted = String(expectedTitle || "").trim();
  if (!wanted) return { ok: false, error: "missing-expected-title" };
  const locationState = await getChatGptLocationState(page);
  const cached = chatGptConversationIdentityCache;
  if (
    !options.force &&
    locationState?.conversationId &&
    cached.conversationId === locationState.conversationId &&
    isSameChatTitle(cached.title, wanted)
  ) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: "chatTitleCheck: using cached conversation identity",
      details: {
        sceneId:
          (typeof options !== "undefined" && options?.sceneId) ||
          (typeof context !== "undefined" && context?.sceneId) ||
          "",
        reason: options.reason || "title-check",
        path: locationState.path || "",
        title: sanitizeChatTitleForLog(wanted),
      },
    });
    return {
      ok: true,
      cached: true,
      currentTitle: wanted,
      wanted,
      mode: "cache",
      path: locationState.path || "",
    };
  }
  if (
    !options.force &&
    cached.lastCheckAt &&
    Date.now() - cached.lastCheckAt < CHAT_TITLE_CHECK_MIN_INTERVAL_MS &&
    isSameChatTitle(cached.title, wanted)
  ) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `chatTitleCheck: skipped reason=rate-limit-${options.reason || "title-check"}`,
      details: {
        sceneId:
          (typeof options !== "undefined" && options?.sceneId) ||
          (typeof context !== "undefined" && context?.sceneId) ||
          "",
        path: locationState?.path || "",
        title: sanitizeChatTitleForLog(wanted),
        lastCheckAgoMs: Date.now() - cached.lastCheckAt,
      },
    });
    return {
      ok: false,
      skipped: true,
      rateLimited: true,
      error: "rate-limited-title-check",
      path: locationState?.path || "",
    };
  }
  if (options.force)
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `chatTitleCheck: forced reason=${options.reason || "title-check"}`,
      details: {
        sceneId:
          (typeof options !== "undefined" && options?.sceneId) ||
          (typeof context !== "undefined" && context?.sceneId) ||
          "",
        title: sanitizeChatTitleForLog(wanted),
      },
    });
  cached.lastCheckAt = Date.now();
  const state = await evaluateOnCdpPage(
    page,
    `(() => {
    try {
      const wanted = ${JSON.stringify(wanted)};
      const m = location.pathname.match(/\\/c\\/([^/?#]+)/);
      const id = m ? m[1] : '';
      const norm = (value) => String(value || '').trim().replace(/\s+/g, ' ');
      const nodes = Array.from(document.querySelectorAll('nav a, aside a, [role="navigation"] a, a[href*="/c/"], nav [role="link"], aside [role="link"], nav li, aside li, nav div, aside div'));
      const candidates = nodes.map((node) => {
        const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
        const href = node.href || (node.getAttribute ? node.getAttribute('href') : '') || '';
        const text = norm(node.innerText || node.textContent || '');
        const cls = String(node.className || '');
        const current = node.getAttribute ? (node.getAttribute('aria-current') || node.getAttribute('aria-selected') || '') : '';
        return { href, rect, text, cls, current };
      }).filter((item) => item.text && item.rect && item.rect.width > 40 && item.rect.height > 12 && item.rect.x < 240 && item.rect.y > 220);
      const hrefItem = candidates.find((item) => id && item.href.indexOf('/c/' + id) >= 0);
      const activeItem = candidates.find((item) => /page|true|active|selected/i.test(String(item.current) + ' ' + item.cls));
      const exactItem = candidates.find((item) => norm(item.text) === norm(wanted));
      const item = hrefItem || activeItem || exactItem || null;
      const currentTitle = norm(item && item.text ? item.text : document.title || '');
      const ok = norm(currentTitle) === norm(wanted) || Boolean(exactItem);
      return { ok, currentTitle, wanted: norm(wanted), mode: hrefItem ? 'href' : activeItem ? 'active' : exactItem ? 'exact' : 'title', documentTitle: document.title, candidateCount: candidates.length, path: location.pathname };
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : String(error), path: location.pathname };
    }
  })()`,
  ).catch((error) => ({ ok: false, error: error.message }));
  if (state?.ok) {
    updateChatGptConversationIdentity(state, wanted);
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: `chatTitleCheck: verified title=${sanitizeChatTitleForLog(wanted)}`,
      details: {
        sceneId:
          (typeof options !== "undefined" && options?.sceneId) ||
          (typeof context !== "undefined" && context?.sceneId) ||
          "",
        reason: options.reason || "title-check",
        path: state.path || "",
      },
    });
  } else if (!state?.skipped) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `chatTitleCheck: skipped reason=${state?.error || "title-mismatch"}`,
      details: {
        sceneId:
          (typeof options !== "undefined" && options?.sceneId) ||
          (typeof context !== "undefined" && context?.sceneId) ||
          "",
        reason: options.reason || "title-check",
        path: state?.path || "",
        currentTitle: sanitizeChatTitleForLog(state?.currentTitle || ""),
      },
    });
  }
  return state;
}

function getChatTitleStableKey(pathname = "", title = "") {
  const id =
    String(pathname || "").match(/\/c\/([^/?#]+)/)?.[1] ||
    String(pathname || "");
  return `${id}::${String(title || "")
    .trim()
    .toLowerCase()}`;
}

function markChatTitleStable(pathname = "", title = "", ok = false) {
  const key = getChatTitleStableKey(pathname, title);
  const next = ok ? (chatTitleStableChecks.get(key) || 0) + 1 : 0;
  chatTitleStableChecks.set(key, next);
  return next;
}

function isChatTitleStable(pathname = "", title = "") {
  return (
    (chatTitleStableChecks.get(getChatTitleStableKey(pathname, title)) || 0) >=
    1
  );
}

async function renameChatGptCurrentConversation(_event, title = "") {
  return { ok: true, skipped: true, reason: "rename-disabled" };
}

async function waitForChatGptImageOrRetry(
  client,
  existingUrls = [],
  prompt,
  sceneDir,
  sceneId,
) {
  const known = new Set(existingUrls);
  const maxAttempts = 3;
  const realStallMs = 300000;
  let lastSnapshot = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const attemptStartedAt = Date.now();
    let sawGenerating = false;
    let readyTicks = 0;
    let lastLogAt = 0;
    const resendImagePrompt = async (reason, snapshot) => {
      await fs
        .writeFile(
          path.join(
            sceneDir,
            `scene_${String(sceneId).padStart(3, "0")}_chatgpt_image_retry_${attempt}_${reason}.json`,
          ),
          JSON.stringify(
            {
              reason,
              snapshot,
              attempt,
              elapsedMs: Date.now() - attemptStartedAt,
            },
            null,
            2,
          ),
          "utf8",
        )
        .catch(() => null);
      await notifyRenderer(
        "chatgpt-image-retry",
        `Scene ${sceneId}: ChatGPT ${reason === "real_stall" ? "kẹt thật sự quá lâu" : "không trả ảnh"}, tool sẽ dừng lượt cũ và gửi lại NV1.`,
        { sceneId, attempt, reason },
      );
      if (attempt >= maxAttempts) {
        throw new Error(
          `ChatGPT không trả ảnh sau ${maxAttempts} lần gửi NV1 (${reason}).`,
        );
      }
      const reloadResult = await requestReloadWithReason(client, `f5_nv1_retry_${attempt}`, sceneId);
      if (reloadResult) {
        await waitForCdpLoad(client).catch(() => null);
        await sleep(1800);
      }
      const stopped = await evaluateOnCdpPage(
        client,
        `(${clickChatGptStopGeneratingScript.toString()})()`,
      ).catch((error) => ({ ok: false, error: error.message }));
      await appendAppLog(null, {
        source: "main",
        kind: stopped?.ok ? "running" : "error",
        text: `Scene ${sceneId}: ChatGPT F5 → stop trước retry NV1 (${reason}): ${stopped?.ok ? stopped.mode : stopped?.error || "not-found"}`,
        details: stopped,
      });
      await sleep(1200);
      const retryPrompt = `${prompt}\n\nLẦN GỬI LẠI ${attempt + 1}: Lần trước ChatGPT bị kẹt hoặc không trả ảnh. Bắt buộc tạo/render 1 ảnh ngay trong chat, không trả lời text.`;
      await evaluateOnCdpPage(
        client,
        `(${prepareChatGptCreateImageScript.toString()})()`,
      ).catch(() => null);
      await sleep(800);
      const resent = await sendPromptViaCdpInput(client, retryPrompt);
      if (!resent.ok)
        throw new Error(
          resent.error || "Không gửi lại được image prompt vào ChatGPT.",
        );
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `Scene ${sceneId}: đã gửi lại NV1 lần ${attempt + 1}/${maxAttempts} sau ${reason}.`,
        details: { resent },
      });
    };
    while (Date.now() - attemptStartedAt < 360000) {
      await sleep(3000);
      const snapshot = await evaluateOnCdpPage(
        client,
        `(${readChatGptImageStateScript.toString()})()`,
      );
      lastSnapshot = snapshot;
      if (snapshot?.loggedOut)
        throw new Error(
          loginRequiredMessage(
            "chatgpt",
            snapshot.logoutReason ||
              "ChatGPT logged out while waiting for NV1 image",
          ),
        );
      const imageUrl = (snapshot?.urls || []).find((url) => !known.has(url));
      const isCustomBoxRef = String(imageUrl || "").startsWith(
        "chatgpt-custom-box-y",
      );
      const composerLooksReady =
        snapshot?.voiceReady &&
        !snapshot?.stopButton &&
        !snapshot?.generating &&
        !snapshot?.preparingImage;
      if (composerLooksReady) readyTicks += 1;
      else readyTicks = 0;
      if (imageUrl) {
        if (
          !snapshot?.generating &&
          !snapshot?.preparingImage &&
          !isCustomBoxRef
        )
          readyTicks += 1;
        if (!isCustomBoxRef && (readyTicks >= 1 || snapshot?.voiceReady)) {
          await appendAppLog(null, {
            source: "main",
            kind: "ok",
            text: `Scene ${sceneId}: thấy ảnh mới từ ChatGPT, bắt đầu lưu ảnh.`,
            details: {
              imageUrl,
              readyTicks,
              voiceReady: snapshot?.voiceReady,
              stopButton: snapshot?.stopButton,
              generating: snapshot?.generating,
              preparingImage: snapshot?.preparingImage,
            },
          });
          return imageUrl;
        }
        if (Date.now() - lastLogAt > 8000) {
          lastLogAt = Date.now();
          await appendAppLog(null, {
            source: "main",
            kind: "running",
            text: `Scene ${sceneId}: đã thấy preview/URL ảnh, chờ generation dừng trước khi lưu.`,
            details: {
              readyTicks,
              voiceReady: snapshot?.voiceReady,
              stopButton: snapshot?.stopButton,
              generating: snapshot?.generating,
              preparingImage: snapshot?.preparingImage,
              urlCount: snapshot?.urls?.length || 0,
            },
          });
        }
      }
      if (snapshot?.generating || snapshot?.preparingImage) {
        sawGenerating = true;
        readyTicks = 0;
        if (Date.now() - lastLogAt > 15000) {
          lastLogAt = Date.now();
          await appendAppLog(null, {
            source: "main",
            kind: "running",
            text: `Scene ${sceneId}: đang chờ ChatGPT hoàn tất NV1/tạo ảnh (${snapshot?.preparingImage ? "preparing-image" : "thinking"}).`,
            details: {
              mode: snapshot?.assistantMode,
              urls: snapshot?.urls?.length || 0,
              assistantCount: snapshot?.assistantCount || 0,
              elapsedMs: Date.now() - attemptStartedAt,
            },
          });
        }
        if (
          !snapshot?.preparingImage &&
          Date.now() - attemptStartedAt > realStallMs
        ) {
          await resendImagePrompt("real_stall", snapshot);
          break;
        }
        continue;
      }
      const composerReadyForRetry = snapshot?.voiceReady;
      const textOnlyAnswer =
        Number(snapshot?.assistantCount || 0) > 0 &&
        String(snapshot?.latestAssistantText || "").length > 20 &&
        !/preparing image|creating image|generating image|đang tạo ảnh|thinking/i.test(
          String(snapshot?.latestAssistantText || ""),
        ) &&
        !looksLikeCollapsedUserPrompt(snapshot?.latestAssistantText, "image");
      if (
        textOnlyAnswer &&
        isChatGptPolicyRefusalText(snapshot?.latestAssistantText)
      ) {
        await notifyChatGptPolicyRefusal(
          sceneId,
          "NV1/image",
          snapshot?.latestAssistantText,
        );
      }

      if (textOnlyAnswer && isChatGptLimitText(snapshot?.latestAssistantText)) {
        await notifyRenderer(
          "chatgpt-limit-stop",
          `Scene ${sceneId}: ChatGPT báo limit/hạn mức. Bấm OK để tool dừng hẳn; đổi account hoặc chờ reset rồi bấm Start lại thủ công.`,
          { sceneId, text: snapshot?.latestAssistantText },
        );
        throw new Error(
          "ChatGPT bị limit/hạn mức. Tool đã dừng theo yêu cầu, không tự gửi lại.",
        );
      }
      if (composerReadyForRetry) readyTicks += 1;
      if (
        (sawGenerating && composerReadyForRetry && readyTicks >= 4) ||
        textOnlyAnswer
      ) {
        await resendImagePrompt(
          textOnlyAnswer
            ? "text-only-answer"
            : "idle-no-image-after-generating",
          snapshot,
        );
        break;
      }
    }
    if (attempt >= maxAttempts) break;
  }
  await fs
    .writeFile(
      path.join(
        sceneDir,
        `scene_${String(sceneId).padStart(3, "0")}_chatgpt_image_wait_failed.json`,
      ),
      JSON.stringify({ lastSnapshot, existingUrlCount: known.size }, null, 2),
      "utf8",
    )
    .catch(() => null);
  throw new Error(
    "Hết thời gian chờ ChatGPT tạo ảnh hoặc không detect được ảnh mới.",
  );
}


async function waitForNewVideoUrl(client, existingUrls = [], options = {}) {
  const known = new Set(existingUrls);
  const provider = options.provider || "grok";
  const sceneId =
    (typeof options !== "undefined" && options?.sceneId) ||
    (typeof context !== "undefined" && context?.sceneId) ||
    "";
  const startedAt = Date.now();
  let retryCount = 0;
  let notifiedLimit = false;
  let notifiedPolicy = false;
  while (Date.now() - startedAt < 600000) {
    await sleep(5000);
    if (provider === "grok") {
      const pageFailure = await evaluateOnCdpPage(
        client,
        `(${detectGrokPageFailureScript.toString()})()`,
      ).catch((error) => ({ ok: false, error: error.message }));
      if (pageFailure?.retryable) {
        await appendAppLog(null, {
          source: "main",
          kind: "error",
          text: `Scene ${sceneId}: Grok page/image failure detected: ${pageFailure.reason}`,
          details: pageFailure,
        });
        throw makeRetryableGrokGenerationError(
          pageFailure.reason || "grok-page-failure",
          pageFailure,
        );
      }
      const grokState = await evaluateOnCdpPage(
        client,
        `(${detectGrokGenerationProblemScript.toString()})()`,
      ).catch((error) => ({ ok: false, error: error.message }));
      if (grokState?.kind === "login-required")
        throw new Error(
          loginRequiredMessage(
            "grok",
            grokState.reason || "Grok logged out while generating video",
          ),
        );
      if (grokState?.kind === "send-failed")
        throw new Error("grok_send_failed_external_error");
      if (grokState?.kind === "unable-finish") {
        throw makeRetryableGrokGenerationError(
          "unable-to-finish-replying",
          grokState,
        );
      }
      if (grokState?.kind === "content-policy") {
        if (!notifiedPolicy) {
          notifiedPolicy = true;
          await notifyRenderer(
            "grok-content-policy",
            `Scene ${sceneId}: Grok chặn content policy. Tool sẽ tự sửa prompt an toàn hơn và gửi lại / đổi canvas mới nếu cần.`,
            grokState,
          );
        }
        if (options.sceneDir && options.imagePath && options.motionPrompt) {
          retryCount += 1;
          const recovered = await recoverGrokAfterContentPolicy(client, {
            ...options,
            retryCount,
          }).catch((error) => ({ ok: false, error: error.message }));
          await appendAppLog(null, {
            source: "main",
            kind: recovered?.ok ? "ok" : "error",
            text: `Scene ${sceneId}: recover content policy lần ${retryCount}/3: ${recovered?.ok ? "ok" : recovered?.error}`,
            details: recovered,
          });
          await sleep(10000);
          continue;
        }
        throw new Error(
          "Grok chặn content policy sau 3 lần tự sửa prompt/đổi canvas. Cần sửa scene/prompt thủ công.",
        );
      }
      if (grokState?.kind === "limit") {
        const tail = String(grokState.tailSnippet || "");
        if (
          /something went wrong|failed to generate|generation failed|couldn'?t generate|unable to generate|error generating|temporarily unavailable|temporarily disabled|not available right now/i.test(
            tail,
          ) &&
          !/quota|usage limit|rate limit|too many requests|daily limit|monthly limit|credits|insufficient/i.test(
            tail,
          )
        ) {
          throw makeRetryableGrokGenerationError(
            "grok-generation-failed",
            grokState,
          );
        }
        await notifyRenderer(
          "grok-limit-stop",
          `Scene ${sceneId}: Grok báo limit/lỗi tạo video. Bấm OK để tool dừng hẳn; đổi account/canvas hoặc xử lý trên Grok rồi bấm Start lại thủ công.`,
          grokState,
        );
        await appendAppLog(null, {
          source: "main",
          kind: "error",
          text: `Scene ${sceneId}: Grok limit/generation error detected; stopped without retry.`,
          details: grokState,
        });
        throw new Error(
          "Grok báo limit/lỗi tạo video. Tool đã dừng theo yêu cầu, không tự gửi lại.",
        );
      }
    }
    if (provider === "grok") {
      const generatingState = await evaluateOnCdpPage(
        client,
        `(${detectGrokGeneratingStateScript.toString()})({})`,
      ).catch((error) => ({ ok: false, error: error.message }));
      if (
        generatingState?.progressPercent != null ||
        generatingState?.mode === "stop-button"
      ) {
        await appendAppLog(null, {
          source: "main",
          kind: "running",
          text: `Scene ${sceneId}: Grok still generating; wait until progress/percent disappears before checking output.`,
          details: {
            mode: generatingState.mode || "",
            progressPercent: generatingState.progressPercent ?? null,
            stopText: generatingState.stopText || "",
          },
        });
        continue;
      }
    }
    const snapshot = await evaluateOnCdpPage(
      client,
      `(${collectVideoUrlsScript.toString()})()`,
    );
    const videoUrl = (snapshot?.urls || []).find((url) => !known.has(url));
    if (videoUrl) return videoUrl;
  }
  throw makeRetryableGrokGenerationError("no-new-video-after-wait", {
    provider,
    sceneId,
    waitedMs: Date.now() - startedAt,
  });
  throw new Error(
    "Hết thời gian chờ Grok tạo video hoặc không detect được video mới.",
  );
}

async function downloadBrowserAsset(client, url, outputPath) {
  if (!url) throw new Error("URL asset rỗng.");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  if (url.startsWith("data:")) {
    const match = url.match(/^data:[^;]+;base64,(.+)$/);
    if (!match) throw new Error("Data URL không hợp lệ.");
    await fs.writeFile(outputPath, Buffer.from(match[1], "base64"));
    return outputPath;
  }

  const result = await evaluateOnCdpPage(
    client,
    `(${downloadAssetInPageScript.toString()})(${JSON.stringify(url)})`,
  );
  if (!result?.ok) {
    throw new Error(
      result?.error || "Không tải được asset trong browser context.",
    );
  }
  await fs.writeFile(outputPath, Buffer.from(result.base64, "base64"));
  return outputPath;
}

async function captureLatestImageElement(client, outputPath, expectedRef = "") {
  throw new Error(
    "Screenshot crop keyframe saving is disabled; use generated image asset extraction.",
  );
}
/*
  const target = await evaluateOnCdpPage(client, `(${getLatestImageBoxScript.toString()})(${JSON.stringify(expectedRef)})`);
  if (!target?.ok) {
    throw new Error(target?.error || 'Không tìm thấy ảnh mới để chụp screenshot.');
  }
  const screenshot = await client.Page.captureScreenshot({
    format: 'png',
    clip: {
      x: Math.max(0, target.box.x),
      y: Math.max(0, target.box.y),
      width: Math.max(1, target.box.width),
      height: Math.max(1, target.box.height),
      scale: 1,
    },
    captureBeyondViewport: true,
  });
  await fs.writeFile(outputPath, Buffer.from(screenshot.data, 'base64'));
  return outputPath;
}

*/
async function checkAssetExists(_event, filePath) {
  return pathExists(filePath);
}

async function getAssetStat(_event, filePath) {
  return getFileStat(filePath);
}

async function imageFileToDataUrl(imagePath) {
  const buffer = await fs.readFile(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function waitForGrokUploadedAsset(client, timeoutMs = 45000) {
  const started = Date.now();
  let last = null;
  let attempt = 0;
  while (Date.now() - started < timeoutMs) {
    attempt += 1;
    last = await evaluateOnCdpPage(
      client,
      `(${detectUploadedAssetScript.toString()})()`,
    ).catch((error) => ({ ok: false, error: error.message }));
    if (last?.ok) return { ...last, attempt, waitedMs: Date.now() - started };
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Grok: chờ ảnh add vào canvas (${Math.round((Date.now() - started) / 1000)}s)...`,
      details: last,
    });
    await sleep(2500);
  }
  return {
    ok: false,
    error:
      last?.error ||
      `Hết ${Math.round(timeoutMs / 1000)}s vẫn chưa thấy ảnh trong Grok canvas.`,
    last,
  };
}

async function clickGrokUploadAndChooseFile(client, filePath) {
  await client.Page.setInterceptFileChooserDialog({ enabled: true }).catch(
    () => null,
  );
  let resolved = false;
  const chooserPromise = new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!resolved)
        resolve({ ok: false, error: "Timeout chờ Grok mở file chooser." });
    }, 8000);
    const handler = async (event) => {
      resolved = true;
      clearTimeout(timer);
      try {
        await client.DOM.setFileInputFiles({
          backendNodeId: event.backendNodeId,
          files: [filePath],
        });
        resolve({
          ok: true,
          mode: "fileChooserOpened",
          backendNodeId: event.backendNodeId,
          filePath,
        });
      } catch (error) {
        resolve({ ok: false, error: error.message, event });
      }
    };
    client.Page.fileChooserOpened(handler);
  });
  const uploadClick = await evaluateOnCdpPage(
    client,
    `(${clickGrokCanvasUploadImageScript.toString()})()`,
  ).catch((error) => ({ ok: false, error: error.message }));
  if (!uploadClick?.ok) {
    await client.Page.setInterceptFileChooserDialog({ enabled: false }).catch(
      () => null,
    );
    return {
      ok: false,
      error: uploadClick?.error || "Không click được nút Upload Image.",
      uploadClick,
    };
  }
  await sleep(500);
  const menuClick = await evaluateOnCdpPage(
    client,
    `(${clickGrokUploadImageMenuItemScript.toString()})()`,
  ).catch((error) => ({ ok: false, error: error.message }));
  await sleep(700);
  const directInput = await setFirstFileInput(client, filePath).catch(
    (error) => ({ ok: false, error: error.message }),
  );
  if (directInput?.ok) {
    await client.Page.setInterceptFileChooserDialog({ enabled: false }).catch(
      () => null,
    );
    return {
      ...directInput,
      mode: "direct-input-after-upload-menu",
      uploadClick,
      menuClick,
    };
  }
  const result = await chooserPromise;
  await client.Page.setInterceptFileChooserDialog({ enabled: false }).catch(
    () => null,
  );
  return { ...result, uploadClick, menuClick, directInput };
}

async function setFirstFileInput(client, filePath) {
  const handle = await client.DOM.getDocument();
  const selector =
    'input[type="file"], input[accept], input[accept*="image"], input[accept*="video"], input[accept*="png"], input[accept*="jpg"], input[accept*="jpeg"], input[accept*="mp4"], input[accept*="webm"]';
  const query = await client.DOM.querySelector({
    nodeId: handle.root.nodeId,
    selector,
  }).catch(() => ({ nodeId: 0 }));
  if (!query?.nodeId)
    return {
      ok: false,
      error: "Không tìm thấy input file sau khi bấm Upload Image.",
    };
  await client.DOM.setFileInputFiles({
    nodeId: query.nodeId,
    files: [filePath],
  });
  return { ok: true, nodeId: query.nodeId, filePath };
}

async function uploadFileViaCdp(client, filePath, provider = "grok") {
  if (provider === "grok") {
    const route = await ensureGrokImagineAgentPage(client, "", {});
    if (!route?.ok)
      return {
        ok: false,
        error: route?.error || "Grok Imagine is not ready before image upload.",
        route,
      };
    const guard = await assertGrokImagineAgentReady(client, "image-upload", "");
    if (!guard?.ok)
      return {
        ok: false,
        error: guard?.error || "Grok route guard blocked image upload.",
        guard,
      };
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: "Grok old workspace upload path blocked: use composer file input instead.",
    });
    await pasteImageViaClipboard(client, filePath, "workspace");
    let accepted = await waitForGrokUploadedAsset(client, 18000);
    if (!accepted?.ok) {
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: "Grok chưa nhận ảnh trong ô prompt, fallback click workspace rồi Ctrl+V.",
      });
      await pasteImageViaClipboard(client, filePath, "workspace");
      accepted = await waitForGrokUploadedAsset(client, 18000);
    }
    if (!accepted?.ok) {
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: "Grok chưa nhận Ctrl+V, thử nút Upload Image và tự chọn file qua CDP.",
      });
      const fileSet = await clickGrokUploadAndChooseFile(client, filePath);
      await appendAppLog(null, {
        source: "main",
        kind: fileSet?.ok ? "ok" : "error",
        text: `Grok Upload Image file chooser: ${fileSet?.ok ? "đã chọn file" : fileSet?.error || "failed"}`,
        details: fileSet,
      });
      if (fileSet?.ok) accepted = await waitForGrokUploadedAsset(client, 45000);
    }
    await appendAppLog(null, {
      source: "main",
      kind: accepted?.ok ? "ok" : "error",
      text: `Kết quả add ảnh vào Grok prompt: ${accepted?.ok ? "đã thấy ảnh, tiếp tục gửi NV2" : accepted?.error || "chưa thấy ảnh"}`,
      details: accepted,
    });
    return accepted?.ok
      ? { ok: true, uploaded: accepted, mode: "grok-composer-image-paste" }
      : {
          ok: false,
          error:
            accepted?.error ||
            "Grok chưa nhận ảnh trong ô prompt, không gửi NV2 để tránh tạo sai.",
        };
  }

  const handle = await client.DOM.getDocument();
  let nodeId = null;
  try {
    const selector =
      provider === "pixverse"
        ? 'input[type="file"], input[accept*="image"], input[accept*="png"], input[accept*="jpg"]'
        : 'input[type="file"]';
    const query = await client.DOM.querySelector({
      nodeId: handle.root.nodeId,
      selector,
    });
    nodeId = query.nodeId;
  } catch (_error) {
    nodeId = null;
  }

  const shouldOpenUploadMenu = !nodeId;
  if (shouldOpenUploadMenu) {
    const clicked = await evaluateOnCdpPage(
      client,
      `(${clickUploadButtonScript.toString()})(${JSON.stringify(provider)})`,
    );
    await sleep(1400);
    const refreshed = await client.DOM.getDocument();
    const selector =
      provider === "pixverse"
        ? 'input[type="file"], input[accept*="image"], input[accept*="png"], input[accept*="jpg"]'
        : 'input[type="file"]';
    const query = await client.DOM.querySelector({
      nodeId: refreshed.root.nodeId,
      selector,
    });
    nodeId = query.nodeId;
    if (!nodeId && !clicked?.ok)
      return {
        ok: false,
        error:
          clicked?.error ||
          `Không tìm thấy nút upload ảnh/file trong ${provider}.`,
      };
  }

  if (!nodeId)
    return {
      ok: false,
      error: "Không tìm thấy input[type=file] sau khi bấm upload.",
    };
  if (provider === "chatgpt") {
    await evaluateOnCdpPage(
      client,
      `(() => {
      const selectors = [
        'button[aria-label*="Xóa tệp"]',
        'button[aria-label*="Remove file"]',
        'button[aria-label*="Remove"]',
        'button[aria-label*="Cancel"]',
        '[class*="file-preview"] button',
        '[class*="attachment"] [class*="remove"]',
        '[class*="attachment"] button',
        '.file-preview button',
        'main form button[class*="close"]',
        'main form button[class*="remove"]',
        'main form [data-testid*="remove"]',
        'main form [class*="Attachment"] button'
      ];
      let clickedCount = 0;
      for (const selector of selectors) {
        const elms = document.querySelectorAll(selector);
        for (const el of elms) {
          el.click();
          clickedCount++;
        }
      }
      return { ok: true, clickedCount };
    })()`,
    ).catch(() => null);
    await sleep(400);
  }

  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `Upload ảnh vào ${provider}: setFileInputFiles ${filePath}`,
  });
  await client.DOM.setFileInputFiles({ nodeId, files: [filePath] });
  await sleep(provider === "pixverse" ? 4500 : 4500);
  let accepted = await evaluateOnCdpPage(
    client,
    `(${detectUploadedAssetScript.toString()})()`,
  ).catch((error) => ({ ok: false, error: error.message }));
  if (provider === "grok" && !accepted?.ok) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: "Grok chưa nhận ảnh qua input file, thử fallback Ctrl+V từ clipboard.",
    });
    await pasteImageViaClipboard(client, filePath);
    await sleep(2500);
    accepted = await evaluateOnCdpPage(
      client,
      `(${detectUploadedAssetScript.toString()})()`,
    ).catch((error) => ({ ok: false, error: error.message }));
  }
  await appendAppLog(null, {
    source: "main",
    kind: accepted?.ok ? "ok" : "error",
    text: `Kết quả upload ${provider}: ${accepted?.ok ? "đã nhận ảnh" : accepted?.error || "chưa nhận ảnh"}`,
    details: accepted,
  });
  if (provider === "grok" && !accepted?.ok) {
    return {
      ok: false,
      error: accepted?.error || "Grok chưa nhận ảnh upload.",
    };
  }
  return { ok: true, uploaded: accepted };
}

async function pasteImageViaClipboard(client, imagePath, target = "composer") {
  const image = nativeImage.createFromPath(imagePath);
  if (image.isEmpty())
    throw new Error(`Không đọc được ảnh để paste clipboard: ${imagePath}`);
  clipboard.writeImage(image);
  if (target === "workspace") {
    const focused = await evaluateOnCdpPage(
      client,
      `(${focusGrokWorkspaceScript.toString()})()`,
    ).catch((error) => ({ ok: false, error: error.message }));
    await appendAppLog(null, {
      source: "main",
      kind: focused?.ok ? "ok" : "running",
      text: `Grok workspace focus: ${focused?.ok ? focused.mode : focused?.error || "fallback"}`,
      details: focused,
    });
    if (focused?.point) {
      const { x, y } = focused.point;
      await client.Input.dispatchMouseEvent({
        type: "mouseMoved",
        x,
        y,
        button: "none",
      }).catch(() => null);
      await client.Input.dispatchMouseEvent({
        type: "mousePressed",
        x,
        y,
        button: "left",
        clickCount: 1,
      }).catch(() => null);
      await client.Input.dispatchMouseEvent({
        type: "mouseReleased",
        x,
        y,
        button: "left",
        clickCount: 1,
      }).catch(() => null);
    }
  } else {
    await evaluateOnCdpPage(
      client,
      `(${focusGrokComposerScript.toString()})()`,
    ).catch(() => null);
  }
  await sleep(300);
  await client.Input.dispatchKeyEvent({
    type: "keyDown",
    key: "Control",
    code: "ControlLeft",
    windowsVirtualKeyCode: 17,
    nativeVirtualKeyCode: 17,
    modifiers: 2,
  }).catch(() => null);
  await client.Input.dispatchKeyEvent({
    type: "keyDown",
    key: "v",
    code: "KeyV",
    windowsVirtualKeyCode: 86,
    nativeVirtualKeyCode: 86,
    modifiers: 2,
  }).catch(() => null);
  await client.Input.dispatchKeyEvent({
    type: "keyUp",
    key: "v",
    code: "KeyV",
    windowsVirtualKeyCode: 86,
    nativeVirtualKeyCode: 86,
    modifiers: 2,
  }).catch(() => null);
  await client.Input.dispatchKeyEvent({
    type: "keyUp",
    key: "Control",
    code: "ControlLeft",
    windowsVirtualKeyCode: 17,
    nativeVirtualKeyCode: 17,
    modifiers: 0,
  }).catch(() => null);
}

async function submitPixVersePrompt(client, prompt, config = {}) {
  await evaluateOnCdpPage(
    client,
    `(${preparePixVerseComposerScript.toString()})(${JSON.stringify(config)})`,
  ).catch(() => null);
  await sleep(500);
  const pasted = await evaluateOnCdpPage(
    client,
    `(${setPixVersePromptScript.toString()})(${JSON.stringify(prompt)})`,
  );
  if (!pasted?.ok)
    return {
      ok: false,
      error: pasted?.error || "Không paste được prompt vào PixVerse.",
    };
  await sleep(800);
  const clicked = await evaluateOnCdpPage(
    client,
    `(${clickPixVerseCreateScript.toString()})()`,
  );
  if (clicked?.ok && clicked.box) {
    const x = clicked.box.x + clicked.box.width / 2;
    const y = clicked.box.y + clicked.box.height / 2;
    await client.Input.dispatchMouseEvent({
      type: "mouseMoved",
      x,
      y,
      button: "none",
    }).catch(() => null);
    await client.Input.dispatchMouseEvent({
      type: "mousePressed",
      x,
      y,
      button: "left",
      clickCount: 1,
    }).catch(() => null);
    await client.Input.dispatchMouseEvent({
      type: "mouseReleased",
      x,
      y,
      button: "left",
      clickCount: 1,
    }).catch(() => null);
  }
  return clicked?.ok
    ? { ok: true, mode: "pixverse-create", selector: clicked.selector }
    : {
        ok: false,
        error: clicked?.error || "Không bấm được nút Create PixVerse.",
      };
}

async function submitGrokVideoPrompt(client, prompt, config = {}) {
  const sceneId = config.sceneId || "";
  const route = await ensureGrokImagineAgentPage(client, sceneId, config);
  if (!route?.ok)
    return {
      ok: false,
      error:
        route?.error || "Grok Imagine Agent is not ready before prompt paste.",
      route,
    };
  const guard = await assertGrokImagineAgentReady(
    client,
    "prompt-paste",
    sceneId,
  );
  if (!guard?.ok)
    return {
      ok: false,
      error: guard?.error || "Grok route guard blocked prompt paste.",
      guard,
    };
  const cleanup = await evaluateOnCdpPage(
    client,
    `(${dismissGrokConnectorsScript.toString()})()`,
  ).catch((error) => ({ ok: false, error: error.message }));
  await appendAppLog(null, {
    source: "main",
    kind: cleanup?.ok ? "ok" : "running",
    text: `Grok cleanup connectors: ${cleanup?.actions?.join(", ") || cleanup?.error || "checked"}`,
    details: cleanup,
  });
  const forcedMode = await evaluateOnCdpPage(
    client,
    `(${forceGrokVideoModeScript.toString()})()`,
  ).catch((error) => ({ ok: false, error: error.message }));
  await appendAppLog(null, {
    source: "main",
    kind: forcedMode?.ok ? "ok" : "running",
    text: `Grok video mode: ${forcedMode?.status || forcedMode?.error || "checked"}`,
    details: forcedMode,
  });
  await evaluateOnCdpPage(
    client,
    `(${dismissGrokConnectorsScript.toString()})()`,
  ).catch(() => null);
  const prepared = {
    ok: true,
    skipped: true,
    status: "force-config-after-upload",
  };
  await appendAppLog(null, {
    source: "main",
    kind: prepared?.ok ? "ok" : "running",
    text: `Grok config: ${prepared?.ok ? JSON.stringify(prepared.config || {}) : prepared?.error || "không đọc được"}`,
    details: prepared,
  });
  await sleep(500);
  const focused = await evaluateOnCdpPage(
    client,
    `(${focusGrokComposerScript.toString()})()`,
  );
  if (focused?.box) {
    const x = focused.box.x + (focused.box.width || focused.box.w || 0) / 2;
    const y = focused.box.y + (focused.box.height || focused.box.h || 0) / 2;
    await client.Input.dispatchMouseEvent({
      type: "mouseMoved",
      x,
      y,
      button: "none",
    }).catch(() => null);
    await client.Input.dispatchMouseEvent({
      type: "mousePressed",
      x,
      y,
      button: "left",
      clickCount: 1,
    }).catch(() => null);
    await client.Input.dispatchMouseEvent({
      type: "mouseReleased",
      x,
      y,
      button: "left",
      clickCount: 1,
    }).catch(() => null);
    await sleep(250);
  }
  if (!focused?.ok)
    return {
      ok: false,
      error: focused?.error || "Không focus được ô nhập Grok.",
    };
  await sleep(250);
  await client.Input.insertText({ text: `\n${prompt}` });
  await sleep(800);
  let verified = await evaluateOnCdpPage(
    client,
    `(${getActiveComposerTextScript.toString()})()`,
  ).catch(() => ({ text: "" }));
  if (
    !verified?.text ||
    !verified.text.includes(prompt.slice(0, Math.min(24, prompt.length)))
  ) {
    const domSet = await evaluateOnCdpPage(
      client,
      `(${setGrokComposerTextScript.toString()})(${JSON.stringify(prompt)})`,
    ).catch((error) => ({ ok: false, error: error.message }));
    await appendAppLog(null, {
      source: "main",
      kind: domSet?.ok ? "ok" : "running",
      text: `Fallback set composer Grok: ${domSet?.ok ? "ok" : domSet?.error || "fail"}`,
      details: domSet,
    });
    await sleep(500);
    verified = await evaluateOnCdpPage(
      client,
      `(${getActiveComposerTextScript.toString()})()`,
    ).catch(() => ({ text: "" }));
  }
  await appendAppLog(null, {
    source: "main",
    kind: verified?.text?.includes(prompt.slice(0, 24)) ? "ok" : "error",
    text: `Paste prompt Grok: verify ${verified?.text ? "có text" : "trống"}`,
    details: {
      selector: verified?.selector,
      expectedHead: prompt.slice(0, 180),
      actualHead: String(verified?.text || "").slice(0, 260),
    },
  });
  if (
    !verified?.text ||
    !verified.text.includes(prompt.slice(0, Math.min(24, prompt.length)))
  ) {
    return {
      ok: false,
      error: `Grok chưa nhận đúng motion prompt trong composer đang focus. Text hiện tại: ${String(verified?.text || "").slice(0, 160)}`,
    };
  }
  const preSubmitGuard = await assertGrokImagineAgentReady(
    client,
    "prompt-submit",
    sceneId,
  );
  if (!preSubmitGuard?.ok)
    return {
      ok: false,
      error: preSubmitGuard?.error || "Grok route guard blocked prompt submit.",
      preSubmitGuard,
    };
  const beforeSubmitState = await evaluateOnCdpPage(
    client,
    `(${captureGrokSubmitStateScript.toString()})()`,
  ).catch(() => null);
  const preflight = await waitForGrokSendPreflight(client, prompt, {
    sceneId,
    requireAttachment: true,
    timeoutMs: 42000,
  });
  if (!preflight?.ok)
    return {
      ok: false,
      error: preflight?.error || "Grok send preflight failed.",
      preflight,
    };
  const sendClick = await clickGrokSendButtonOnce(client, sceneId);
  if (!sendClick?.ok)
    return {
      ok: false,
      error: sendClick?.error || "Grok send button could not be clicked.",
      clicked: sendClick,
      preflight,
    };
  const sendOutcome = await waitForGrokSendOutcome(
    client,
    beforeSubmitState || {},
    { sceneId, timeoutMs: 26000 },
  );
  if (sendOutcome?.ok)
    return {
      ok: true,
      mode: "grok-generation-started",
      selector: sendClick.clicked?.selector || "",
      preflight: summarizeGrokSendState(preflight.state),
      outcome: sendOutcome,
    };
  const sendRetry = await retryGrokSendFailure(
    client,
    prompt,
    { sceneId, imagePath: config.imagePath, config },
    sendOutcome,
  );
  if (sendRetry?.ok)
    return {
      ok: true,
      mode: "grok-generation-started-after-retry",
      selector: sendClick.clicked?.selector || "",
      preflight: summarizeGrokSendState(preflight.state),
      retry: sendRetry,
    };
  return {
    ok: false,
    error:
      sendRetry?.error ||
      sendOutcome?.reason ||
      "grok_send_failed_external_error",
    mode: "grok_send_failed_external_error",
    preflight: summarizeGrokSendState(preflight.state),
    outcome: sendOutcome,
    retry: sendRetry,
  };
  const pressEnterToSubmit = async () => {
    await client.Input.dispatchKeyEvent({
      type: "keyDown",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
      nativeVirtualKeyCode: 13,
    }).catch(() => null);
    await client.Input.dispatchKeyEvent({
      type: "keyUp",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
      nativeVirtualKeyCode: 13,
    }).catch(() => null);
  };
  await pressEnterToSubmit();
  await sleep(1800);
  let started = await evaluateOnCdpPage(
    client,
    `(${detectGrokGeneratingStateScript.toString()})(${JSON.stringify(beforeSubmitState || {})})`,
  ).catch(() => null);
  if (started?.generating) {
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: `Grok đã bắt đầu chạy bằng Enter (${started.mode}).`,
      details: started,
    });
    return { ok: true, mode: "grok-started-enter", selector: "trusted-enter" };
  }
  if (focused?.box) {
    const x = focused.box.x + focused.box.w - 20;
    const y = focused.box.y + focused.box.h - 20;
    await client.Input.dispatchMouseEvent({
      type: "mouseMoved",
      x,
      y,
      button: "none",
    }).catch(() => null);
    await client.Input.dispatchMouseEvent({
      type: "mousePressed",
      x,
      y,
      button: "left",
      clickCount: 1,
    }).catch(() => null);
    await client.Input.dispatchMouseEvent({
      type: "mouseReleased",
      x,
      y,
      button: "left",
      clickCount: 1,
    }).catch(() => null);
    await sleep(2200);
    started = await evaluateOnCdpPage(
      client,
      `(${detectGrokGeneratingStateScript.toString()})(${JSON.stringify(beforeSubmitState || {})})`,
    ).catch(() => null);
    if (started?.generating) {
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: `Grok đã bắt đầu chạy bằng click góc phải ô prompt (${started.mode}).`,
        details: { started, point: { x, y }, focused },
      });
      return {
        ok: true,
        mode: "grok-started-composer-corner-click",
        selector: "composer-bottom-right-arrow",
      };
    }
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: "Grok click trực tiếp nút mũi tên theo tọa độ nhưng chưa thấy generating, thử selector tiếp.",
      details: { point: { x, y }, focused, started },
    });
  }
  let clicked = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    clicked = await evaluateOnCdpPage(
      client,
      `(${clickGrokGenerateScript.toString()})()`,
    ).catch((error) => ({ ok: false, error: error.message }));
    await appendAppLog(null, {
      source: "main",
      kind: clicked?.ok ? "running" : "error",
      text: `Grok send selector attempt ${attempt}: ${clicked?.ok ? `candidate=${clicked.selector || "unknown"}` : clicked?.error || "failed"}`,
      details: clicked,
    });
    if (clicked?.ok && clicked.box) {
      const x = clicked.box.x + clicked.box.width / 2;
      const y = clicked.box.y + clicked.box.height / 2;
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `Grok send mouse click attempt ${attempt} tại (${Math.round(x)}, ${Math.round(y)}).`,
        details: { box: clicked.box, selector: clicked.selector },
      });
      await client.Input.dispatchMouseEvent({
        type: "mouseMoved",
        x,
        y,
        button: "none",
      }).catch(() => null);
      await client.Input.dispatchMouseEvent({
        type: "mousePressed",
        x,
        y,
        button: "left",
        clickCount: 1,
      }).catch(() => null);
      await client.Input.dispatchMouseEvent({
        type: "mouseReleased",
        x,
        y,
        button: "left",
        clickCount: 1,
      }).catch(() => null);
    }
    await sleep(1200);
    await pressEnterToSubmit();
    await sleep(1800);
    const generating = await evaluateOnCdpPage(
      client,
      `(${detectGrokGeneratingStateScript.toString()})(${JSON.stringify(beforeSubmitState || {})})`,
    ).catch(() => null);
    if (generating?.generating) {
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: `Grok đã bắt đầu chạy (${generating.mode}).`,
        details: generating,
      });
      return {
        ok: true,
        mode: `grok-started-attempt-${attempt}`,
        selector: clicked?.selector,
      };
    }
    const afterClick = await evaluateOnCdpPage(
      client,
      `(${getComposerTextScript.toString()})()`,
    ).catch(() => ({ text: "" }));
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Grok click/Enter attempt ${attempt}: chưa thấy Thinking/Stop.`,
      details: {
        clicked,
        generating,
        composerHead: String(afterClick?.text || "").slice(0, 120),
      },
    });
  }
  return {
    ok: false,
    error:
      clicked?.error ||
      clicked?.selector ||
      "Prompt đã paste nhưng Grok chưa gửi sau 3 lần bấm send.",
  };
}

function sleep(ms) {
  const runId = getScopedPipelineRunId();
  if (!runId) return new Promise((resolve) => setTimeout(resolve, ms));
  assertPipelineRunActive(runId);
  return new Promise((resolve, reject) => {
    let timer = null;
    const onCancel = (error) => {
      if (timer) clearTimeout(timer);
      cleanup();
      reject(error);
    };
    const cleanup = registerPipelineWaiter(runId, onCancel);
    timer = setTimeout(() => {
      cleanup();
      try {
        assertPipelineRunActive(runId);
        resolve();
      } catch (error) {
        reject(error);
      }
    }, ms);
  });
}

function downloadAssetInPageScript(url) {
  return fetch(url, { credentials: "include" })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.blob();
    })
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = String(reader.result || "");
            const base64 = dataUrl.includes(",")
              ? dataUrl.split(",").pop()
              : "";
            resolve({
              ok: Boolean(base64),
              base64,
              type: blob.type,
              size: blob.size,
            });
          };
          reader.onerror = () =>
            reject(reader.error || new Error("FileReader failed"));
          reader.readAsDataURL(blob);
        }),
    )
    .catch((error) => ({ ok: false, error: error.message }));
}

function fillProviderLoginScript(provider, email, password) {
  const textOf = (node) =>
    `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`.trim();
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    const style = window.getComputedStyle?.(node);
    return (
      rect &&
      rect.width > 4 &&
      rect.height > 4 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      style?.visibility !== "hidden" &&
      style?.display !== "none"
    );
  };
  const setValue = (node, value) => {
    node.scrollIntoView({ block: "center", inline: "center" });
    node.focus?.();
    node.click?.();
    const proto = Object.getPrototypeOf(node);
    const descriptor =
      Object.getOwnPropertyDescriptor(proto, "value") ||
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    if (descriptor?.set) descriptor.set.call(node, value);
    else node.value = value;
    node.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: value,
      }),
    );
    node.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const clickButton = (pattern) => {
    const buttons = [
      ...document.querySelectorAll(
        'button, [role="button"], input[type="submit"], a',
      ),
    ]
      .filter(visible)
      .map((node) => ({
        node,
        text: textOf(node),
        rect: node.getBoundingClientRect?.(),
      }));
    const target =
      buttons.find((item) => pattern.test(item.text)) ||
      buttons.find((item) => item.node.type === "submit");
    if (!target) return "";
    target.node.scrollIntoView({ block: "center", inline: "center" });
    target.node.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    target.node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    target.node.click();
    target.node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    return target.text || "submit";
  };
  const body = document.body?.innerText || "";
  const hasAuthInput = [...document.querySelectorAll("input")]
    .filter(visible)
    .some((node) =>
      /email|username|password/i.test(
        `${node.type} ${node.name} ${node.id} ${node.autocomplete} ${node.placeholder} ${node.getAttribute?.("aria-label") || ""}`,
      ),
    );
  const loginButton = hasAuthInput
    ? ""
    : clickButton(/^(log in|sign in|đăng nhập|get started|continue)$/i);
  if (loginButton) {
    return { ok: true, mode: "clicked-login-entry", clicked: loginButton };
  }
  const emailInput = [...document.querySelectorAll("input")]
    .filter(visible)
    .find((node) =>
      /email|username/i.test(
        `${node.type} ${node.name} ${node.id} ${node.autocomplete} ${node.placeholder} ${node.getAttribute?.("aria-label") || ""}`,
      ),
    );
  if (
    emailInput &&
    !String(emailInput.value || "").includes(String(email || "").slice(0, 4))
  ) {
    setValue(emailInput, email);
    const clicked = clickButton(
      /continue|next|tiếp tục|submit|log in|sign in|đăng nhập/i,
    );
    return {
      ok: true,
      mode: "filled-email",
      submitted: Boolean(clicked),
      clicked,
    };
  }
  const passwordInput = [
    ...document.querySelectorAll(
      'input[type="password"], input[autocomplete="current-password"]',
    ),
  ].filter(visible)[0];
  if (passwordInput) {
    setValue(passwordInput, password);
    const clicked = clickButton(
      /continue|next|log in|sign in|đăng nhập|submit/i,
    );
    return {
      ok: true,
      mode: "filled-password",
      submitted: Boolean(clicked),
      clicked,
    };
  }
  if (
    /two-factor|2fa|verification code|verify your identity|captcha|cloudflare|passkey|authenticator/i.test(
      body,
    )
  ) {
    return {
      ok: false,
      mode: "needs-user-verification",
      needsUserAction: true,
    };
  }
  return {
    ok: false,
    mode: "login-form-not-found",
    url: location.href,
    provider,
  };
}

function detectVideoCapabilityScript(provider) {
  const bodyText = document.body?.innerText || "";
  if (
    /sign in|log in|sign up to keep chatting|đăng nhập/i.test(bodyText) &&
    !/SuperGrok|Imagine|Private|Sign Out|What do you want to know\?/i.test(
      bodyText,
    )
  ) {
    return {
      ok: false,
      error: `${provider === "pixverse" ? "PixVerse" : "Grok"} chưa đăng nhập hoặc session bị giới hạn: trang đang hiện Sign in/Sign up.`,
    };
  }
  const fileInput = document.querySelector('input[type="file"]');
  const actionText = [
    ...document.querySelectorAll('button, [role="button"], a, label'),
  ]
    .map(
      (el) =>
        `${el.textContent || ""} ${el.getAttribute("aria-label") || ""} ${el.title || ""}`,
    )
    .join(" | ");
  const featurePattern =
    provider === "pixverse"
      ? /Image to Video|Text to Video|Create|Generate|Upload|Start|PixVerse/i
      : /Imagine|Create images|image generation|attach|upload|plus|\+|create/i;
  const uploadPattern =
    provider === "pixverse"
      ? /upload|image|file|add|create|generate|start|\+/i
      : /attach|upload|image|file|plus|\+|add/i;
  const featureText =
    featurePattern.test(bodyText) || featurePattern.test(actionText);
  const hasUploadAction = uploadPattern.test(actionText) || Boolean(fileInput);
  const signedInShell =
    provider === "grok" &&
    /SuperGrok|Imagine|Private|Sign Out|What do you want to know\?|What would you like to create\?|Type to imagine/i.test(
      bodyText,
    );
  const blocked =
    /upgrade|subscribe|premium|limit reached|not available|not supported|join waitlist|quota|insufficient|credits/i.test(
      bodyText,
    );
  if (blocked && !signedInShell) {
    return {
      ok: false,
      error: `${provider === "pixverse" ? "PixVerse" : "Grok"} account đang bị giới hạn quota/plan hoặc feature tạo video chưa khả dụng. Hãy đổi account/plan rồi chạy lại.`,
    };
  }
  if (!featureText && !hasUploadAction) {
    return {
      ok: false,
      error: `Không thấy feature upload/tạo video trong ${provider === "pixverse" ? "PixVerse" : "Grok"}. Có thể account này chưa có quyền tạo video từ ảnh.`,
    };
  }
  const energyMatch =
    bodyText.match(
      /(?:⚡|energy|credit|credits|trial left|free trial left)[^0-9]{0,20}(\d{1,5})/i,
    ) ||
    bodyText.match(
      /(\d{1,5})\s*(?:⚡|energy|credits?|free trial left|trial left)/i,
    );
  const planMatch = bodyText.match(
    /\b(Basic|Pro\+?|Premium|Personal|Team|Enterprise)\b/i,
  );
  const hasPro =
    /\b(Pro\+?|Premium|Team|Enterprise)\b/i.test(bodyText) ||
    /PRO\+/i.test(actionText);
  const proModelsVisible =
    /Seedance|Happy Horse|Kling|Veo|Sora|Grok Imagine/i.test(bodyText);
  return {
    ok: true,
    hasUploadAction,
    featureText,
    fileInput: Boolean(fileInput),
    energy: energyMatch ? Number(energyMatch[1]) : null,
    plan: planMatch ? planMatch[1] : null,
    hasPro,
    proModelsVisible,
  };
}

function getPromptInputCandidates() {
  return [
    "#prompt-textarea",
    "textarea",
    'div[contenteditable="true"].ProseMirror',
    '.ProseMirror[contenteditable="true"]',
    '[data-testid="composer"] [contenteditable="true"]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
  ];
}

function clickChatGptStartNewChatScript() {
  const fold = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  const visible = (node) => {
    const rect = node?.getBoundingClientRect?.();
    const style = node ? window.getComputedStyle(node) : null;
    return (
      rect &&
      rect.width > 8 &&
      rect.height > 8 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth &&
      style?.display !== "none" &&
      style?.visibility !== "hidden" &&
      Number(style?.opacity ?? 1) > 0
    );
  };
  const items = [
    ...document.querySelectorAll('a, button, [role="button"], [role="link"]'),
  ]
    .filter(visible)
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const text = `${node.innerText || node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`;
      return { node, text, folded: fold(text), rect };
    });
  const target =
    items.find((item) =>
      /bat dau doan chat moi|tao doan chat moi|doan chat moi|new chat|start new chat/.test(
        item.folded,
      ),
    ) ||
    items.find(
      (item) =>
        /new|plus|\+/.test(item.folded) &&
        item.rect.left < window.innerWidth * 0.35 &&
        item.rect.top < window.innerHeight * 0.35,
    );
  if (!target)
    return {
      ok: false,
      error: "new-chat-button-not-found",
      candidates: items
        .slice(0, 12)
        .map((item) => ({
          text: item.text.slice(0, 80),
          box: {
            x: item.rect.x,
            y: item.rect.y,
            width: item.rect.width,
            height: item.rect.height,
          },
        })),
    };
  target.node.scrollIntoView?.({ block: "center", inline: "center" });
  const x = target.rect.x + target.rect.width / 2;
  const y = target.rect.y + target.rect.height / 2;
  target.node.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerType: "mouse",
      isPrimary: true,
      clientX: x,
      clientY: y,
    }),
  );
  target.node.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, clientX: x, clientY: y }),
  );
  target.node.click?.();
  target.node.dispatchEvent(
    new MouseEvent("mouseup", { bubbles: true, clientX: x, clientY: y }),
  );
  return {
    ok: true,
    text: target.text.slice(0, 100),
    box: {
      x: target.rect.x,
      y: target.rect.y,
      width: target.rect.width,
      height: target.rect.height,
    },
  };
}















function collectGeneratedImageUrlsScript() {
  const urls = [...document.images]
    .map((img) => img.currentSrc || img.src)
    .filter(Boolean)
    .filter((url) =>
      /blob:|data:image|oaiusercontent|oaidalleapiprodscus|chatgpt|openai|grok|xai/i.test(
        url,
      ),
    );
  return { urls: [...new Set(urls)] };
}

async function checkExistingCompletedImageScript() {
  const findAssistantMessageWithImage = () => {
    const assistants = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
    if (!assistants.length) return null;
    
    // Priority 1: Find the latest assistant message (from bottom to top) that has an active placeholder/progressbar
    for (let i = assistants.length - 1; i >= 0; i--) {
      const node = assistants[i];
      const hasActivePlaceholder = node.querySelector(
        '[aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"], .aspect-square:not(:has(img)):not(:has(canvas)), .aspect-video:not(:has(img)):not(:has(canvas))'
      );
      if (hasActivePlaceholder) return node;
    }
    
    // Priority 2: Find the latest assistant message (from bottom to top) that has a completed image or canvas
    for (let i = assistants.length - 1; i >= 0; i--) {
      const node = assistants[i];
      const hasCompletedAsset = node.querySelector('img, canvas');
      if (hasCompletedAsset) return node;
    }
    
    return null;
  };

  const assistantNode = findAssistantMessageWithImage();
  if (!assistantNode) return { ok: false, reason: "no-assistant-message-with-image" };

  const verifyImg = (img) => {
    if (!img) return null;
    const isComplete = img.complete && img.naturalWidth >= 256 && img.naturalHeight >= 256;
    if (isComplete) {
      return { ok: true, mode: "img", width: img.naturalWidth, height: img.naturalHeight };
    }
    return null;
  };

  const verifyCanvas = (canvas) => {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const style = window.getComputedStyle(canvas);
    const isVisible = rect && rect.width > 200 && rect.height > 200
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number(style.opacity || 1) > 0;
    if (isVisible && canvas.width >= 256 && canvas.height >= 256) {
      return { ok: true, mode: "canvas", width: canvas.width, height: canvas.height };
    }
    return null;
  };

  const hasPlaceholder = () => {
    const activeLoader = assistantNode.querySelector('[aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"], .aspect-square:not(:has(img)):not(:has(canvas)), .aspect-video:not(:has(img)):not(:has(canvas))');
    return Boolean(activeLoader);
  };

  if (hasPlaceholder()) {
    return { ok: false, reason: "active-placeholder-present" };
  }

  const imgCheck = verifyImg(assistantNode.querySelector('img'));
  if (imgCheck) {
    return { ok: true, ...imgCheck };
  }

  const canvasCheck = verifyCanvas(assistantNode.querySelector('canvas'));
  if (canvasCheck) {
    return { ok: true, ...canvasCheck };
  }

  return { ok: false, reason: "no-completed-image-or-canvas-found" };
}

async function ensureChatGptImageLoadedAndHydratedScript(beforeAssistantCount = 0) {
  const assistants = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
  
  const findAssistantMessageWithImage = () => {
    if (!assistants.length) return null;
    const scanMinIdx = Math.min(Number(beforeAssistantCount || 0), Math.max(0, assistants.length - 1));
    
    // Priority 1: Find the latest assistant message (from bottom to top) that has an active placeholder/progressbar
    for (let i = assistants.length - 1; i >= scanMinIdx; i--) {
      const node = assistants[i];
      const hasActivePlaceholder = node.querySelector(
        '[aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"], .aspect-square:not(:has(img)):not(:has(canvas)), .aspect-video:not(:has(img)):not(:has(canvas))'
      );
      if (hasActivePlaceholder) return node;
    }
    
    // Priority 2: Find the latest assistant message (from bottom to top) that has a completed img
    for (let i = assistants.length - 1; i >= scanMinIdx; i--) {
      const node = assistants[i];
      if (node.querySelector('img')) return node;
    }
    
    // Priority 3: Find the latest assistant message (from bottom to top) that has a completed canvas
    for (let i = assistants.length - 1; i >= scanMinIdx; i--) {
      const node = assistants[i];
      if (node.querySelector('canvas')) return node;
    }
    
    return null;
  };

  const assistantNode = findAssistantMessageWithImage();
  const totalAssistants = assistants.length;
  const assistantIndex = assistantNode ? assistants.indexOf(assistantNode) : -1;

  if (!assistantNode) return { ok: false, error: "no-assistant-message-found", assistantIndex, totalAssistants };

  const findTarget = () => {
    return assistantNode.querySelector(
      'img, canvas, [aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"], .aspect-square, .aspect-video, [class*="aspect-"]'
    ) || assistantNode;
  };

  const verifyImg = (img) => {
    if (!img) return null;
    const isComplete = img.complete && img.naturalWidth >= 256 && img.naturalHeight >= 256;
    if (isComplete) {
      return { ok: true, mode: "img", width: img.naturalWidth, height: img.naturalHeight, imgComplete: img.complete, imgNaturalWidth: img.naturalWidth, imgNaturalHeight: img.naturalHeight };
    }
    return null;
  };

  const verifyCanvas = (canvas) => {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const style = window.getComputedStyle(canvas);
    const isVisible = rect && rect.width > 200 && rect.height > 200
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number(style.opacity || 1) > 0;
    if (isVisible && canvas.width >= 256 && canvas.height >= 256) {
      return { ok: true, mode: "canvas", width: canvas.width, height: canvas.height };
    }
    return null;
  };

  const hasPlaceholder = () => {
    const activeLoader = assistantNode.querySelector('[aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"], .aspect-square:not(:has(img)):not(:has(canvas)), .aspect-video:not(:has(img)):not(:has(canvas))');
    return Boolean(activeLoader);
  };

  const tryClickScrollBtn = () => {
    try {
      const scrollBtn = Array.from(document.querySelectorAll('button')).find(btn => {
        const rect = btn.getBoundingClientRect();
        const isRound = rect.width > 20 && rect.height > 20 && Math.abs(rect.width - rect.height) < 15;
        if (!isRound) return false;
        const isBottom = rect.bottom > window.innerHeight * 0.55;
        if (!isBottom) return false;
        const label = `${btn.textContent || ""} ${btn.getAttribute("aria-label") || ""} ${btn.title || ""} ${btn.getAttribute("data-testid") || ""} ${btn.className || ""}`.toLowerCase();
        if (/send|submit|stop|cancel|voice|dictate|regenerate|retry|dừng|gửi|lại/i.test(label)) return false;
        return /scroll.*bottom|scroll.*down|cuon.*xuong|bottom-button|down-button|arrow-down|scroll-button/i.test(label)
          || (btn.querySelector('svg') && /scroll|bottom|down|arrow/i.test(label));
      });
      if (scrollBtn) scrollBtn.click();
    } catch (_e) {}
  };

  const startedAt = Date.now();
  const initialPlaceholder = hasPlaceholder();

  // Check if it is already loaded
  const imgAlready = verifyImg(assistantNode.querySelector('img'));
  if (imgAlready && !initialPlaceholder) {
    return { ok: true, already: true, tick: 0, elapsedMs: Date.now() - startedAt, ...imgAlready, placeholderDisappeared: true, assistantIndex, totalAssistants };
  }
  const canvasAlready = verifyCanvas(assistantNode.querySelector('canvas'));
  if (canvasAlready && !initialPlaceholder) {
    return { ok: true, already: true, tick: 0, elapsedMs: Date.now() - startedAt, ...canvasAlready, placeholderDisappeared: true, assistantIndex, totalAssistants };
  }

  // Let's run a loop to scroll-and-wait up to 15 times (15 seconds total)
  for (let tick = 1; tick <= 15; tick++) {
    const target = findTarget();
    let scrollBtnClicked = false;
    
    if (target) {
      const rect = target.getBoundingClientRect();
      const visibleInViewport = rect.top >= 0 && rect.bottom <= window.innerHeight;
      
      // B1 & B2: Scroll on tick === 1 (first time), or if it shifted out of the viewport,
      // or as a backup scroll re-align every 5 ticks.
      if (tick === 1 || !visibleInViewport || tick % 5 === 0) {
        target.scrollIntoView({ block: "center", inline: "nearest" });
      }
      
      // Only click scroll button if the target element cannot be scrolled fully in viewport,
      // or if it has been 3 seconds (tick >= 3) and the placeholder is still active
      if (!visibleInViewport || (tick >= 3 && hasPlaceholder())) {
        tryClickScrollBtn();
        scrollBtnClicked = true;
      }
    } else {
      tryClickScrollBtn();
      scrollBtnClicked = true;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    const imgCheck = verifyImg(assistantNode.querySelector('img'));
    if (imgCheck) {
      return {
        ok: true,
        already: false,
        tick,
        elapsedMs: Date.now() - startedAt,
        ...imgCheck,
        placeholderDisappeared: !hasPlaceholder(),
        assistantIndex,
        totalAssistants
      };
    }

    const canvasCheck = verifyCanvas(assistantNode.querySelector('canvas'));
    if (canvasCheck) {
      return {
        ok: true,
        already: false,
        tick,
        elapsedMs: Date.now() - startedAt,
        ...canvasCheck,
        placeholderDisappeared: !hasPlaceholder(),
        assistantIndex,
        totalAssistants
      };
    }
  }

  return { ok: false, error: "timeout-waiting-for-image-load-verification", elapsedMs: Date.now() - startedAt, assistantIndex, totalAssistants, hasPlaceholder: hasPlaceholder() };
}

async function adoptExistingSceneImage(client, beforeAssistantCount, sceneId) {
  const minRoot = Number(beforeAssistantCount || 0);

  // Scan assistant messages starting from beforeAssistantCount
  const adoptCheck = await evaluateOnCdpPage(
    client,
    `(${async function(minIdx) {
      const assistants = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
      // Filter assistants to only those belonging to the current scene, using scanMinIdx to handle count drops
      const scanMinIdx = Math.min(Number(minIdx || 0), Math.max(0, assistants.length - 1));
      const sceneAssistants = assistants.filter((_, idx) => idx >= scanMinIdx);
      
      const diagnostics = {
        totalAssistants: assistants.length,
        sceneAssistants: sceneAssistants.length,
        minIdx,
        scanMinIdx,
        selectedIdx: -1,
        hasPlaceholder: false,
        hasImg: false,
        hasCanvas: false,
        imgDetails: null,
        canvasDetails: null
      };

      if (!sceneAssistants.length) return { ok: false, reason: "no-assistant-messages-for-current-scene", diagnostics };
      
      const findTargetAssistant = () => {
        // Priority 1: Find the latest assistant message (from bottom to top) that has an active placeholder/progressbar
        for (let i = sceneAssistants.length - 1; i >= 0; i--) {
          const node = sceneAssistants[i];
          const hasActivePlaceholder = node.querySelector(
            '[aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"], .aspect-square:not(:has(img)):not(:has(canvas)), .aspect-video:not(:has(img)):not(:has(canvas))'
          );
          if (hasActivePlaceholder) {
            diagnostics.selectedIdx = assistants.indexOf(node);
            return node;
          }
        }
        
        // Priority 2: Find the latest assistant message (from bottom to top) that has a completed img
        for (let i = sceneAssistants.length - 1; i >= 0; i--) {
          const node = sceneAssistants[i];
          if (node.querySelector('img')) {
            diagnostics.selectedIdx = assistants.indexOf(node);
            return node;
          }
        }
        
        // Priority 3: Find the latest assistant message (from bottom to top) that has a completed canvas
        for (let i = sceneAssistants.length - 1; i >= 0; i--) {
          const node = sceneAssistants[i];
          if (node.querySelector('canvas')) {
            diagnostics.selectedIdx = assistants.indexOf(node);
            return node;
          }
        }
        
        return null;
      };

      const assistantNode = findTargetAssistant();
      if (!assistantNode) return { ok: false, reason: "no-assistant-node-with-target", diagnostics };

      const img = assistantNode.querySelector('img');
      const canvas = assistantNode.querySelector('canvas');
      const placeholder = assistantNode.querySelector(
        '[aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"], .aspect-square:not(:has(img)):not(:has(canvas)), .aspect-video:not(:has(img)):not(:has(canvas))'
      );

      diagnostics.hasPlaceholder = !!placeholder;
      diagnostics.hasImg = !!img;
      diagnostics.hasCanvas = !!canvas;

      if (img) {
        diagnostics.imgDetails = {
          complete: img.complete,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          src: img.src ? img.src.slice(0, 100) : null
        };
      }

      if (canvas) {
        diagnostics.canvasDetails = {
          width: canvas.width,
          height: canvas.height
        };
      }

      const verifyImg = (el) => {
        if (!el) return null;
        const isComplete = el.complete && el.naturalWidth >= 256 && el.naturalHeight >= 256;
        if (isComplete) return { ok: true, mode: "img", width: el.naturalWidth, height: el.naturalHeight };
        return null;
      };

      const verifyCanvas = (el) => {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const isVisible = rect && rect.width > 200 && rect.height > 200
          && style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number(style.opacity || 1) > 0;
        if (isVisible && el.width >= 256 && el.height >= 256) {
          return { ok: true, mode: "canvas", width: el.width, height: el.height };
        }
        return null;
      };

      if (placeholder) {
        return { ok: false, reason: "active-placeholder-present", diagnostics };
      }
      
      const check = verifyImg(img) || verifyCanvas(canvas);
      if (check) return { ok: true, ...check, diagnostics };
      return { ok: false, reason: "image-or-canvas-not-completed-yet", diagnostics };
    }.toString()})(${minIdx})`
  ).catch((err) => ({ ok: false, reason: "eval-error", error: err.message }));

  await appendAppLog(sceneId, {
    source: "main",
    kind: "running",
    text: `[ADOPT DIAGNOSTICS] Scene ${sceneId}: adoptCheck result: ok=${adoptCheck?.ok}, reason=${adoptCheck?.reason || ""}`,
    details: adoptCheck?.diagnostics || {}
  }).catch(() => null);

  if (!adoptCheck?.ok) return { ok: false, reason: adoptCheck?.reason };

  // Wait and hydrate
  const hydration = await evaluateOnCdpPage(
    client,
    `(${ensureChatGptImageLoadedAndHydratedScript.toString()})()`,
  ).catch((err) => ({ ok: false, error: err.message }));

  await appendAppLog(sceneId, {
    source: "main",
    kind: hydration?.ok ? "ok" : "warning",
    text: `[ADOPT DIAGNOSTICS] Scene ${sceneId}: hydration: ok=${hydration?.ok}, error=${hydration?.error || ""}`,
    details: hydration || {}
  }).catch(() => null);

  if (!hydration?.ok) return { ok: false, reason: `hydration-failed: ${hydration?.error}` };

  // Extract
  const extracted = await extractLatestChatGPTGeneratedImageBytes(client, {
    existingUrls: [],
    minAssistantRootIndex: minRoot,
  }).catch((err) => ({ ok: false, error: err.message }));

  await appendAppLog(sceneId, {
    source: "main",
    kind: extracted?.ok ? "ok" : "warning",
    text: `[ADOPT DIAGNOSTICS] Scene ${sceneId}: extraction: ok=${extracted?.ok}, error=${extracted?.error || ""}`,
    details: extracted?.diagnostics || {}
  }).catch(() => null);

  if (!extracted?.ok) return { ok: false, reason: `extraction-failed: ${extracted?.error}` };

  return { ok: true, base64: extracted.base64, contentType: extracted.contentType };
}




async function extractLatestChatGPTGeneratedImageBytesScript(
  existingUrls = [],
  minAssistantRootIndex = 0,
) {
  const known = new Set(Array.isArray(existingUrls) ? existingUrls : []);
  const minRoot = Number(minAssistantRootIndex || 0);
  const minNatural = 256;
  const minBox = 128;
  const sanitizeUrl = (value = "") => {
    const url = String(value || "");
    if (!url) return "";
    if (url.startsWith("data:")) return `data:${url.slice(5, 32)}...`;
    if (url.startsWith("blob:")) return "blob:...";
    try {
      const parsed = new URL(url, location.href);
      return `${parsed.protocol}//${parsed.host}${parsed.pathname.slice(0, 90)}`;
    } catch (_error) {
      return url.slice(0, 100);
    }
  };
  const rectInfo = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect
      ? {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          clientWidth: Math.round(node.clientWidth || rect.width || 0),
          clientHeight: Math.round(node.clientHeight || rect.height || 0),
        }
      : null;
  };
  const isVisible = (node, relaxed = false) => {
    const rect = node.getBoundingClientRect?.();
    if (
      !rect ||
      rect.width < (relaxed ? 48 : minBox) ||
      rect.height < (relaxed ? 48 : minBox)
    )
      return false;
    const style = window.getComputedStyle?.(node);
    if (
      style &&
      (style.visibility === "hidden" ||
        style.display === "none" ||
        Number(style.opacity || 1) === 0)
    )
      return false;
    if (node.closest?.("header, nav, aside")) return false;
    return true;
  };
  const nodeText = (node) =>
    `${node.alt || ""} ${node.title || ""} ${node.getAttribute?.("aria-label") || ""} ${node.getAttribute?.("data-testid") || ""} ${node.className || ""}`.trim();
  const hasSpinner = (node) =>
    /loading|spinner|progress|preparing|generating|creating image|đang tạo ảnh/i.test(
      `${nodeText(node)} ${node.innerText || ""}`,
    );
  const sourceFromSrcset = (srcset = "") =>
    String(srcset || "")
      .split(",")
      .map((part) => part.trim().split(/\s+/)[0])
      .filter(Boolean)
      .at(-1) || "";
  const rootsFrom = () => {
    const roleNodes = [
      ...document.querySelectorAll('[data-message-author-role="assistant"]'),
    ];
    const nodes = roleNodes.length
      ? roleNodes
      : [
          ...document.querySelectorAll(
            '[data-testid*="conversation-turn"], [data-message-id], article, .message, [class*="response"], [class*="markdown"]',
          ),
        ].filter((node) => {
          if (node.closest?.('[data-message-author-role="user"]')) return false;
          if (node.querySelector?.('[data-message-author-role="user"]'))
            return false;
          const text = (node.innerText || "").trim();
          return (
            text.length > 20 ||
            node.querySelector?.("img, picture source, canvas, a[href], button")
          );
        });
    const unique = [...new Set(nodes)].sort(
      (a, b) =>
        (a.getBoundingClientRect?.().y || 0) -
        (b.getBoundingClientRect?.().y || 0),
    );
    return unique.map((node, index) => ({
      node,
      index,
      mode: roleNodes.length ? "assistant-role" : "fallback-assistant-root",
    }));
  };
  const assistantRoots = rootsFrom();
  const scanMinRoot = Math.min(minRoot, Math.max(0, assistantRoots.length - 1));
  const selectedRoots = assistantRoots.filter((root) => root.index >= scanMinRoot);
  const waitingForNewAssistantRoot =
    minRoot > 0 && !selectedRoots.length && assistantRoots.length;
  const usingLatestRootFallback = false;
  const roots = selectedRoots.length
    ? selectedRoots
    : waitingForNewAssistantRoot
      ? []
      : [{ node: document.body, index: 0, mode: "document-fallback" }];
  const rejected = [];
  const candidates = [];
  const visibleButtons = [
    ...document.querySelectorAll('button, [role="button"]'),
  ].filter((node) => isVisible(node, true));
  const stopVisible = visibleButtons.some((node) =>
    /stop generating|stop responding|stop|cancel|dừng/i.test(
      `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""}`,
    ),
  );
  const composerBusy = [
    ...document.querySelectorAll(
      '#prompt-textarea, textarea, [contenteditable="true"], [role="textbox"], [data-testid="composer"]',
    ),
  ]
    .filter((node) => isVisible(node, true))
    .some(
      (node) =>
        node.disabled ||
        node.getAttribute("aria-disabled") === "true" ||
        node.getAttribute("aria-busy") === "true",
    );
  const streamingIndicator =
    stopVisible ||
    [
      ...document.querySelectorAll(
        '[aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"], [class*="result-streaming"]',
      ),
    ].some((node) => isVisible(node, true));
  const diagnostics = {
    assistantRootCount: assistantRoots.length,
    selectedRootCount: roots.length,
    minAssistantRootIndex: minRoot,
    usingLatestRootFallback,
    waitingForNewAssistantRoot,
    stopVisible,
    composerBusy,
    streamingIndicator,
    imgElementCount: 0,
    canvasElementCount: 0,
    backgroundImageCandidateCount: 0,
    imageLikeLinkCount: 0,
    roots: [],
    imageCandidates: [],
    rejected,
  };
  const addElementId = (node, type) => {
    const id = `vidora-img-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    node.setAttribute("data-vidora-image-extract-id", id);
    node.setAttribute("data-vidora-image-extract-type", type);
    return id;
  };
  const pushUrlCandidate = (node, root, type, src, extra = {}) => {
    const rect = rectInfo(node);
    const visible = isVisible(node, type === "download");
    const summary = {
      type,
      rootIndex: root.index,
      src: sanitizeUrl(src),
      currentSrc: sanitizeUrl(node.currentSrc || ""),
      complete: node.complete ?? null,
      naturalWidth: node.naturalWidth || 0,
      naturalHeight: node.naturalHeight || 0,
      box: rect,
      visible,
      loading: node.loading || "",
      text: nodeText(node).slice(0, 120),
      ...extra,
    };
    diagnostics.imageCandidates.push(summary);
    if (!src) return rejected.push({ ...summary, reason: "missing-src" });
    if (usingLatestRootFallback && known.has(src))
      return rejected.push({
        ...summary,
        reason: "known-existing-url-on-fallback-root",
      });
    if (!/^https?:|^blob:|^data:image\//i.test(src))
      return rejected.push({ ...summary, reason: "unsupported-src" });
    if (!visible) return rejected.push({ ...summary, reason: "not-visible" });
    if (hasSpinner(node))
      return rejected.push({ ...summary, reason: "loading-placeholder-text" });
    if (
      type === "img" &&
      (!node.complete ||
        node.naturalWidth < minNatural ||
        node.naturalHeight < minNatural)
    )
      return rejected.push({
        ...summary,
        reason: "img-not-complete-or-too-small",
      });
    candidates.push({
      node,
      rootIndex: root.index,
      rootMode: root.mode,
      type,
      method: type,
      sourceKind: src.startsWith("data:")
        ? "data-url"
        : src.startsWith("blob:")
          ? "blob-url"
          : "remote-url",
      src,
      width: node.naturalWidth || rect?.width || 0,
      height: node.naturalHeight || rect?.height || 0,
      area: (rect?.width || 1) * (rect?.height || 1),
      y: (rect?.y || 0) + window.scrollY,
      elementId: addElementId(node, type),
      summary,
    });
  };
  for (const root of roots) {
    const rootText = String(root.node.innerText || "").trim();
    diagnostics.roots.push({
      index: root.index,
      mode: root.mode,
      textLength: rootText.length,
      imgCount: root.node.querySelectorAll("img").length,
      canvasCount: root.node.querySelectorAll("canvas").length,
      sourceCount: root.node.querySelectorAll(
        "picture source, source[srcset], source[src]",
      ).length,
      downloadLikeCount: [
        ...root.node.querySelectorAll("a[href], button"),
      ].filter((node) =>
        /download|open|view|image|ảnh|share|copy/i.test(
          `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.getAttribute?.("href") || ""}`,
        ),
      ).length,
      box: rectInfo(root.node),
    });
    diagnostics.imgElementCount += root.node.querySelectorAll("img").length;
    diagnostics.canvasElementCount +=
      root.node.querySelectorAll("canvas").length;
    diagnostics.imageLikeLinkCount += [
      ...root.node.querySelectorAll("a[href], button"),
    ].filter((node) =>
      /download|open|view|image|ảnh|share|copy/i.test(
        `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.getAttribute?.("href") || ""}`,
      ),
    ).length;
    for (const img of root.node.querySelectorAll("img")) {
      pushUrlCandidate(
        img,
        root,
        "img",
        img.currentSrc ||
          img.src ||
          img.getAttribute("src") ||
          sourceFromSrcset(img.getAttribute("srcset")),
      );
    }
    for (const source of root.node.querySelectorAll(
      "picture source, source[srcset], source[src]",
    )) {
      const src =
        source.src ||
        source.getAttribute("src") ||
        sourceFromSrcset(source.getAttribute("srcset"));
      pushUrlCandidate(source.parentElement || source, root, "source", src, {
        sourceCount: 1,
      });
    }
    for (const canvas of root.node.querySelectorAll("canvas")) {
      const rect = rectInfo(canvas);
      const summary = {
        type: "canvas",
        rootIndex: root.index,
        width: canvas.width || 0,
        height: canvas.height || 0,
        box: rect,
        visible: isVisible(canvas),
        text: nodeText(canvas).slice(0, 120),
      };
      diagnostics.imageCandidates.push(summary);
      if (!isVisible(canvas)) {
        rejected.push({ ...summary, reason: "canvas-not-visible" });
        continue;
      }
      if (
        (canvas.width || 0) < minNatural ||
        (canvas.height || 0) < minNatural
      ) {
        rejected.push({ ...summary, reason: "canvas-too-small" });
        continue;
      }
      if (hasSpinner(canvas.parentElement || canvas)) {
        rejected.push({ ...summary, reason: "canvas-loading-placeholder" });
        continue;
      }
      candidates.push({
        node: canvas,
        rootIndex: root.index,
        rootMode: root.mode,
        type: "canvas",
        method: "canvas",
        sourceKind: "canvas",
        width: canvas.width,
        height: canvas.height,
        area: (rect?.width || 1) * (rect?.height || 1),
        y: (rect?.y || 0) + window.scrollY,
        elementId: addElementId(canvas, "canvas"),
        summary,
      });
    }
    for (const node of root.node.querySelectorAll(
      'div, button, a, span, [role="img"]',
    )) {
      const style = window.getComputedStyle?.(node);
      const bg = style?.backgroundImage || "";
      const match = bg.match(/url\(["']?([^"')]+)["']?\)/i);
      if (match) {
        diagnostics.backgroundImageCandidateCount += 1;
        pushUrlCandidate(node, root, "background", match[1], {
          backgroundImage: sanitizeUrl(match[1]),
        });
      }
    }
    for (const link of root.node.querySelectorAll("a[href]")) {
      const href = link.href || link.getAttribute("href") || "";
      const looksImage =
        /^https?:|^blob:|^data:image\//i.test(href) &&
        /image|download|open|view|asset|oaiusercontent|oaidalle|png|jpe?g|webp/i.test(
          href + " " + nodeText(link) + " " + (link.textContent || ""),
        );
      if (looksImage) pushUrlCandidate(link, root, "download", href);
    }
  }
  candidates.sort(
    (a, b) => b.rootIndex - a.rootIndex || b.y - a.y || b.area - a.area,
  );
  const readBlobBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = () =>
        reject(new Error("FileReader failed for generated image blob."));
      reader.readAsDataURL(blob);
    });
  for (const candidate of candidates) {
    try {
      if (candidate.type === "canvas") {
        const dataUrl = candidate.node.toDataURL("image/png");
        const base64 = String(dataUrl || "").split(",")[1] || "";
        if (base64.length < 4000) throw new Error("canvas-base64-too-small");
        return {
          ok: true,
          base64,
          contentType: "image/png",
          byteLength: Math.floor(base64.length * 0.75),
          width: candidate.width,
          height: candidate.height,
          rootIndex: candidate.rootIndex,
          rootMode: candidate.rootMode,
          sourceKind: candidate.sourceKind,
          method: "canvas",
          elementId: candidate.elementId,
          diagnostics,
        };
      }
      const response = await fetch(candidate.src, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`fetch-failed-${response.status}`);
      const contentType = response.headers.get("content-type") || "";
      if (!/^image\/(png|jpe?g|webp)/i.test(contentType))
        throw new Error(`not-image-content-type-${contentType}`);
      const blob = await response.blob();
      if (!blob || blob.size < 4096)
        throw new Error(`image-too-small-${blob?.size || 0}`);
      const bitmap = await createImageBitmap(blob).catch(() => null);
      if (!bitmap || bitmap.width < minNatural || bitmap.height < minNatural)
        throw new Error(
          `decode-or-dimension-failed-${bitmap?.width || 0}x${bitmap?.height || 0}`,
        );
      const base64 = await readBlobBase64(blob);
      if (!base64 || base64.length < 4000) throw new Error("base64-too-small");
      return {
        ok: true,
        base64,
        contentType,
        byteLength: blob.size,
        width: bitmap.width,
        height: bitmap.height,
        rootIndex: candidate.rootIndex,
        rootMode: candidate.rootMode,
        sourceKind: candidate.sourceKind,
        method: candidate.method,
        elementId: candidate.elementId,
        diagnostics,
      };
    } catch (error) {
      rejected.push({
        ...candidate.summary,
        reason: `fetch-or-decode-failed:${error.message}`,
      });
    }
  }
  const screenshotCandidate = candidates.find(
    (candidate) =>
      candidate.elementId &&
      candidate.width >= minNatural &&
      candidate.height >= minNatural,
  );
  return {
    ok: false,
    mode: candidates.length
      ? "candidate-fetch-failed"
      : "no-complete-generated-image",
    rootCount: assistantRoots.length,
    minAssistantRootIndex: minRoot,
    screenshotCandidate: screenshotCandidate
      ? {
          type: screenshotCandidate.type,
          elementId: screenshotCandidate.elementId,
          rootIndex: screenshotCandidate.rootIndex,
          width: screenshotCandidate.width,
          height: screenshotCandidate.height,
        }
      : null,
    diagnostics,
  };
}

function getChatGptImageCandidateBoxScript(elementId = "") {
  const selector = `[data-vidora-image-extract-id="${String(elementId).replace(/"/g, '\\"')}"]`;
  const node = document.querySelector(selector);
  if (!node) return { ok: false, error: "candidate-element-not-found" };
  const rect = node.getBoundingClientRect?.();
  if (!rect || rect.width < 128 || rect.height < 128)
    return { ok: false, error: "candidate-element-too-small" };
  const style = window.getComputedStyle?.(node);
  if (
    style &&
    (style.visibility === "hidden" ||
      style.display === "none" ||
      Number(style.opacity || 1) === 0)
  )
    return { ok: false, error: "candidate-element-hidden" };
  const text = `${node.innerText || ""} ${node.getAttribute?.("aria-label") || ""} ${node.className || ""}`;
  if (
    /loading|spinner|progress|preparing|generating|creating image|đang tạo ảnh/i.test(
      text,
    )
  )
    return { ok: false, error: "candidate-still-loading" };
  node.scrollIntoView({ block: "center", inline: "center" });
  const box = node.getBoundingClientRect();
  return {
    ok: true,
    elementId,
    type: node.getAttribute("data-vidora-image-extract-type") || node.tagName,
    box: {
      x: box.x + window.scrollX,
      y: box.y + window.scrollY,
      width: box.width,
      height: box.height,
    },
  };
}

function getLatestImageBoxScript(expectedRef = "") {
  const expectedY = String(expectedRef || "").startsWith("chatgpt-custom-box-y")
    ? Number(String(expectedRef).replace("chatgpt-custom-box-y", ""))
    : null;
  const isImageNode = (node) => {
    if (node.tagName === "IMG" || node.tagName === "CANVAS") return true;
    const text = node.innerText || "";
    if (
      /Generated image/i.test(text) &&
      (text.includes("Edit") || node.querySelector("button"))
    )
      return true;
    const style = window.getComputedStyle(node);
    if (
      style.backgroundImage &&
      style.backgroundImage !== "none" &&
      !style.backgroundImage.includes("gradient")
    )
      return true;
    return false;
  };

  const nodes = [...document.querySelectorAll("img, canvas, button, div")]
    .filter((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.width < 180 || rect.height < 120) return false;
      if (
        rect.width > window.innerWidth * 0.9 &&
        rect.height > window.innerHeight * 0.9
      )
        return false;
      if (node.closest("header, nav, aside")) return false;
      return isImageNode(node);
    })
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        node,
        src: node.currentSrc || node.src || "custom-box",
        area: rect.width * rect.height,
        box: {
          x: rect.x + window.scrollX,
          y: rect.y + window.scrollY,
          width: rect.width,
          height: rect.height,
        },
      };
    })
    // Ưu tiên đúng image box vừa detect; nếu không có thì lấy node thấp nhất (mới nhất)
    .sort((a, b) =>
      Number.isFinite(expectedY)
        ? Math.abs(a.box.y - expectedY) - Math.abs(b.box.y - expectedY)
        : b.box.y - a.box.y,
    );

  const best = nodes[0];
  if (!best)
    return {
      ok: false,
      error: "Không tìm thấy image element đủ lớn trong ChatGPT.",
    };
  best.node.scrollIntoView({ block: "center" });
  return { ok: true, src: best.src, expectedRef, box: best.box };
}

function collectVideoUrlsScript() {
  const urls = [
    ...[...document.querySelectorAll("video")].map(
      (video) => video.currentSrc || video.src,
    ),
    ...[...document.querySelectorAll("a[href]")]
      .map((link) => link.href)
      .filter((href) => /\.mp4|video|download/i.test(href)),
  ].filter(Boolean);
  return { urls: [...new Set(urls)] };
}

function detectGrokPageFailureScript() {
  const bodyText = document.body?.innerText || "";
  const tail = bodyText.slice(-4000);
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    const style = window.getComputedStyle?.(node);
    return (
      rect &&
      rect.width >= 24 &&
      rect.height >= 24 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      style?.display !== "none" &&
      style?.visibility !== "hidden" &&
      Number(style?.opacity ?? 1) > 0
    );
  };
  const media = [...document.querySelectorAll("img, video, canvas")]
    .filter(visible)
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        tag: node.tagName,
        width: rect.width,
        height: rect.height,
        src: node.currentSrc || node.src || "",
      };
    });
  const hasComposer = Boolean(
    [
      ...document.querySelectorAll(
        'textarea, [contenteditable="true"], [role="textbox"], input[type="file"]',
      ),
    ].find(visible),
  );
  const hasGrokShell =
    /SuperGrok|Imagine|Private|Grok can make mistakes|What would you like to create|Type to imagine|What do you want to know/i.test(
      bodyText,
    );
  const requestFailure =
    /ERR_|Aw, Snap|This site can'?t be reached|Page crashed|Out of Memory|request failed|network error|failed to fetch|timeout|timed out|could not load|failed to load|image failed|media failed/i.test(
      tail,
    );
  const generationFailure =
    /something went wrong|failed to generate|generation failed|couldn'?t generate|unable to generate|error generating|try again/i.test(
      tail,
    );
  const completeBlank =
    document.readyState === "complete" &&
    bodyText.trim().length < 24 &&
    media.length === 0;
  const blackOrEmptyApp =
    document.readyState === "complete" &&
    !hasGrokShell &&
    !hasComposer &&
    media.length === 0 &&
    bodyText.trim().length < 120;
  const badMedia = media.some(
    (item) =>
      /blob:|data:|http/i.test(item.src) &&
      (item.width < 32 || item.height < 32),
  );
  let reason = "";
  if (/^about:blank/i.test(location.href)) reason = "about-blank-page";
  else if (requestFailure) reason = "request-or-media-load-failed";
  else if (completeBlank) reason = "blank-page";
  else if (blackOrEmptyApp) reason = "black-or-empty-grok-page";
  else if (badMedia) reason = "invalid-media-render";
  else if (generationFailure) reason = "generation-failed-message";
  return {
    ok: true,
    retryable: Boolean(reason),
    reason,
    url: location.href,
    readyState: document.readyState,
    textLength: bodyText.length,
    hasGrokShell,
    hasComposer,
    mediaCount: media.length,
    media: media.slice(0, 8),
    tailSnippet: tail.slice(-700),
  };
}

function getGrokReadyStateScript() {
  const bodyText = document.body?.innerText || "";
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 8 && rect.height > 8;
  };
  const composer = [
    ...document.querySelectorAll(
      'textarea, [contenteditable="true"], [role="textbox"]',
    ),
  ].find(
    (node) =>
      visible(node) &&
      /imagine|what do you want|ask/i.test(
        `${node.getAttribute?.("placeholder") || ""} ${node.getAttribute?.("aria-label") || ""} ${node.textContent || ""}`,
      ),
  );
  const hasImagineHome =
    /Featured Templates|Discover|Type to imagine|Create Template/i.test(
      bodyText,
    );
  const hasSignedShell =
    /SuperGrok|Imagine|Private|Sign Out|What do you want to know\?/i.test(
      bodyText,
    );
  const loading =
    /loading|just a moment|please wait|checking/i.test(bodyText) ||
    [
      ...document.querySelectorAll(
        '[aria-busy="true"], .spinner, [class*="loading"], [class*="spinner"]',
      ),
    ].some(Boolean);
  return {
    ready: Boolean((composer || hasImagineHome || hasSignedShell) && !loading),
    hasComposer: Boolean(composer),
    hasImagineHome,
    hasSignedShell,
    loading,
    url: location.href,
    title: document.title,
    sampleText: bodyText.slice(0, 800),
  };
}

function getGrokRouteStateScript() {
  const path = location.pathname || "";
  const host = location.hostname || "";
  const isGrok = host === "grok.com";
  const isImagineAgent =
    path === "/imagine/agent" || path.startsWith("/imagine/agent/");
  const isAgentCanvas =
    path.startsWith("/imagine/agent/") &&
    path.length > "/imagine/agent/".length;
  const bodyText = document.body?.innerText || "";
  const title = document.title || "";
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return (
      rect &&
      rect.width > 8 &&
      rect.height > 8 &&
      rect.bottom > 0 &&
      rect.right > 0
    );
  };
  const textOf = (node) =>
    `${node.getAttribute?.("placeholder") || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""} ${node.textContent || ""}`
      .replace(/\s+/g, " ")
      .trim();
  const textboxes = [
    ...document.querySelectorAll(
      'textarea, [contenteditable="true"], [role="textbox"], input',
    ),
  ]
    .filter(visible)
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const label = textOf(node);
      const isComposerLabel =
        /what would|what do you want|type to imagine|imagine|describe|create|prompt|ask/i.test(
          label,
        );
      const isLikelyComposerBox =
        isAgentCanvas &&
        rect.left > window.innerWidth * 0.45 &&
        rect.top > window.innerHeight * 0.35 &&
        rect.width > 120;
      return { rect, isComposerLabel, isLikelyComposerBox };
    });
  const buttons = [
    ...document.querySelectorAll('button, [role="button"], label, a'),
  ]
    .filter(visible)
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const label = textOf(node);
      return {
        node,
        rect,
        label,
        disabled: Boolean(
          node.disabled || node.getAttribute?.("aria-disabled") === "true",
        ),
      };
    });
  const fileInputs = [...document.querySelectorAll('input[type="file"]')];
  const hasComposer = textboxes.some(
    (item) => item.isComposerLabel || item.isLikelyComposerBox,
  );
  const hasNormalChatComposer =
    !isImagineAgent &&
    /What do you want to know\?|Ask anything|Message Grok|What can I help/i.test(
      bodyText,
    );
  const hasEmptyCanvas = buttons.some((item) =>
    /(^|\s)Empty\s*Canvas(\s|$)/i.test(item.label),
  );
  const hasGallery =
    /Featured Templates|Discover|Upload Images|Create Worlds|Historical Stories|Empty Canvas|Type to imagine/i.test(
      bodyText,
    );
  const hasUploadTarget =
    fileInputs.length > 0 ||
    buttons.some(
      (item) =>
        /upload\s*image|add\s*image|image|photo|picture|attach|\+/i.test(
          item.label,
        ) && item.rect.left < window.innerWidth * 0.82,
    );
  const hasWorkspace = [
    ...document.querySelectorAll(
      'canvas, [class*="canvas" i], [class*="workspace" i], [class*="stage" i], main',
    ),
  ].some((node) => {
    const rect = node.getBoundingClientRect?.();
    return (
      rect &&
      rect.width > window.innerWidth * 0.3 &&
      rect.height > window.innerHeight * 0.3
    );
  });
  const hasSendButton = buttons.some((item) => {
    if (item.disabled) return false;
    if (
      item.rect.left < window.innerWidth * 0.6 ||
      item.rect.top < window.innerHeight * 0.45
    )
      return false;
    return /generate|create|send|submit|imagine|arrow-up/i.test(
      item.label + " " + (item.node.innerHTML || ""),
    );
  });
  const challenge =
    /cloudflare|performing security verification|verify you are human|checking if the site connection is secure|just a moment|Ray ID/i.test(
      `${bodyText} ${title}`,
    );
  const login =
    /(^|\n)\s*(Log in|Sign in|Sign up|Đăng nhập|Get started)\s*($|\n)|continue with google|sign up for free/i.test(
      bodyText,
    ) &&
    !/SuperGrok|Imagine|Private|What do you want to know\?|Type to imagine/i.test(
      bodyText,
    );
  const busy =
    /Generating|Creating|Thinking|Uploading|Đang tải|processing/i.test(
      bodyText,
    ) ||
    [
      ...document.querySelectorAll(
        '[aria-busy="true"], [class*="spinner" i], [class*="loading" i]',
      ),
    ].some(visible);
  let route = "unknown";
  if (!isGrok) route = "external";
  else if (challenge || login) route = "login_or_challenge";
  else if (
    !isImagineAgent &&
    path === "/imagine" &&
    (hasComposer || hasUploadTarget || hasGallery)
  )
    route = "imagine_agent_ready";
  else if (!isImagineAgent)
    route =
      hasNormalChatComposer || path === "/"
        ? "normal_chat"
        : "wrong_grok_route";
  else if (isAgentCanvas && (hasComposer || hasUploadTarget || hasWorkspace))
    route = "imagine_agent_ready";
  else if (
    !isAgentCanvas &&
    (hasComposer ||
      (hasUploadTarget && hasSendButton) ||
      (hasEmptyCanvas && hasWorkspace))
  )
    route = "imagine_agent_ready";
  else if (!isAgentCanvas && (hasEmptyCanvas || hasGallery || hasComposer))
    route = "imagine_agent_gallery";
  else route = "imagine_agent_loading";
  return {
    ok: true,
    route,
    url: location.href,
    safeUrl: `${location.origin}${path}`,
    path,
    isImagineAgent,
    isAgentCanvas,
    hasComposer,
    hasNormalChatComposer,
    hasEmptyCanvas,
    hasGallery,
    hasUploadTarget,
    hasWorkspace,
    hasSendButton,
    busy,
    challenge,
    login,
    counts: {
      textboxes: textboxes.length,
      fileInputs: fileInputs.length,
      buttons: buttons.length,
    },
  };
}

function detectGrokTemplateModalScript() {
  const bodyText = document.body?.innerText || "";
  const open =
    /Choose a template type to begin|Name your template|Template Name|Photo\s*→\s*Video|Photo\s*→\s*Style Edit|Photo\s*→\s*Edit\s*→\s*Video/i.test(
      bodyText,
    );
  return { open, sampleText: bodyText.slice(0, 1000), url: location.href };
}

function closeGrokTemplateModalScript() {
  const bodyText = document.body?.innerText || "";
  const state = {
    open: /Choose a template type to begin|Name your template|Template Name|Photo\s*→\s*Video|Photo\s*→\s*Style Edit|Photo\s*→\s*Edit\s*→\s*Video/i.test(
      bodyText,
    ),
    sampleText: bodyText.slice(0, 1000),
    url: location.href,
  };
  if (!state.open) return { ok: false, reason: "modal-not-open" };
  const textOf = (node) =>
    `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""} ${node.innerHTML || ""}`.trim();
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return (
      rect &&
      rect.width > 4 &&
      rect.height > 4 &&
      rect.bottom > 0 &&
      rect.right > 0
    );
  };
  const textNodes = [
    ...document.querySelectorAll(
      'div, section, article, main, [role="dialog"], [class]',
    ),
  ]
    .filter((node) => {
      if (!visible(node)) return false;
      const text = node.innerText || "";
      const hasTemplateChoice =
        /Choose a template type to begin/i.test(text) &&
        /Photo\s*→\s*Video/i.test(text);
      const hasNameTemplateStep =
        /Name your template|Template Name|Add a description/i.test(text);
      return hasTemplateChoice || hasNameTemplateStep;
    })
    .map((node) => ({
      node,
      rect: node.getBoundingClientRect(),
      text: node.innerText || "",
    }))
    .filter(
      (item) =>
        item.rect.width > 260 &&
        item.rect.width < window.innerWidth * 0.9 &&
        item.rect.height > 120 &&
        item.rect.height < window.innerHeight * 0.95,
    )
    .sort(
      (a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height,
    );
  const modal = textNodes[0];
  const buttons = [
    ...document.querySelectorAll(
      'button, [role="button"], [aria-label], svg, path',
    ),
  ]
    .map(
      (node) => node.closest?.('button, [role="button"], [aria-label]') || node,
    )
    .filter(
      (node, index, list) =>
        node && list.indexOf(node) === index && visible(node),
    )
    .map((node) => ({
      node,
      rect: node.getBoundingClientRect(),
      text: textOf(node),
    }));
  const candidates = buttons
    .filter((item) => {
      const inModalTopRight =
        modal &&
        item.rect.top >= modal.rect.top &&
        item.rect.top <= modal.rect.top + 70 &&
        item.rect.left >= modal.rect.right - 90 &&
        item.rect.left <= modal.rect.right + 10 &&
        item.rect.width <= 80 &&
        item.rect.height <= 80;
      const xLike =
        /^(×|x)$/i.test(item.text) || /close|dismiss|đóng/i.test(item.text);
      const iconOnly =
        inModalTopRight &&
        /svg|path|circle|lucide|icon/i.test(
          item.text || item.node.innerHTML || "",
        );
      return (
        (xLike && (!modal || inModalTopRight || item.rect.top < 180)) ||
        iconOnly ||
        inModalTopRight
      );
    })
    .sort((a, b) => b.rect.left - a.rect.left || a.rect.top - b.rect.top);
  const target = candidates[0];
  const syntheticBox = modal
    ? {
        x: Math.max(0, modal.rect.right - 30),
        y: Math.max(0, modal.rect.top + 8),
        width: 26,
        height: 26,
      }
    : null;
  if (!target && !syntheticBox)
    return {
      ok: false,
      error: "Không tìm thấy nút X hoặc khung bảng template Grok.",
      state,
      buttons: buttons
        .slice(0, 20)
        .map((item) => ({
          text: item.text.slice(0, 80),
          box: {
            x: item.rect.x,
            y: item.rect.y,
            width: item.rect.width,
            height: item.rect.height,
          },
        })),
    };
  if (target) {
    target.node.scrollIntoView?.({ block: "center", inline: "center" });
    target.node.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    target.node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    target.node.click?.();
    target.node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }
  const box = target
    ? {
        x: target.rect.x,
        y: target.rect.y,
        width: target.rect.width,
        height: target.rect.height,
      }
    : syntheticBox;
  return {
    ok: true,
    selector: target?.text?.slice(0, 80) || "modal-relative-synthetic-x",
    box,
    modal: modal
      ? {
          x: modal.rect.x,
          y: modal.rect.y,
          width: modal.rect.width,
          height: modal.rect.height,
        }
      : null,
    state,
  };
}

function getGrokTemplateViewportFallbackPointsScript() {
  const bodyText = document.body?.innerText || "";
  const open =
    /Choose a template type to begin|Photo\s*→\s*Video|Template Name/i.test(
      bodyText,
    );
  if (!open) return { ok: false, reason: "modal-not-open" };
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return (
      rect &&
      rect.width > 20 &&
      rect.height > 20 &&
      rect.bottom > 0 &&
      rect.right > 0
    );
  };
  const textOf = (node) =>
    `${node.innerText || node.textContent || ""}`.trim().replace(/\s+/g, " ");
  const modalCandidates = [
    ...document.querySelectorAll(
      'div, section, article, main, [role="dialog"], [class]',
    ),
  ]
    .filter(
      (node) =>
        visible(node) &&
        /Choose a template type to begin/i.test(textOf(node)) &&
        /Photo\s*→\s*Video/i.test(textOf(node)),
    )
    .map((node) => ({
      rect: node.getBoundingClientRect(),
      text: textOf(node).slice(0, 200),
    }))
    .filter(
      (item) =>
        item.rect.width > 400 &&
        item.rect.height > 260 &&
        item.rect.width < innerWidth * 0.95 &&
        item.rect.height < innerHeight * 0.95,
    )
    .sort(
      (a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height,
    );
  const modal = modalCandidates[0]?.rect;
  const points = modal
    ? [
        { name: "modal-x-hard", x: modal.right - 18, y: modal.top + 18 },
        { name: "modal-x-hard-2", x: modal.right - 26, y: modal.top + 26 },
        { name: "backdrop-top-left", x: 20, y: 20 },
        { name: "backdrop-bottom-left", x: 20, y: innerHeight - 20 },
      ]
    : [
        {
          name: "viewport-x-hard",
          x: innerWidth * 0.81,
          y: innerHeight * 0.14,
        },
        {
          name: "viewport-x-hard-2",
          x: innerWidth * 0.8,
          y: innerHeight * 0.15,
        },
        { name: "backdrop-top-left", x: 20, y: 20 },
        { name: "backdrop-bottom-left", x: 20, y: innerHeight - 20 },
      ];
  const hits = points.map((point) => {
    const hit = document.elementFromPoint(point.x, point.y);
    return {
      ...point,
      hitTag: hit?.tagName || "",
      hitText: textOf(hit || document.body).slice(0, 160),
    };
  });
  return {
    ok: true,
    viewport: { width: innerWidth, height: innerHeight },
    modal: modal
      ? { x: modal.x, y: modal.y, width: modal.width, height: modal.height }
      : null,
    points,
    hits,
    candidates: modalCandidates
      .slice(0, 8)
      .map((item) => ({
        box: {
          x: item.rect.x,
          y: item.rect.y,
          width: item.rect.width,
          height: item.rect.height,
        },
        text: item.text,
      })),
  };
}

function scanGrokTemplateModalScript() {
  const bodyText = document.body?.innerText || "";
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return (
      rect &&
      rect.width > 8 &&
      rect.height > 8 &&
      rect.bottom > 0 &&
      rect.right > 0
    );
  };
  const textOf = (node) =>
    `${node.innerText || node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`
      .trim()
      .replace(/\s+/g, " ");
  const interesting = [
    ...document.querySelectorAll(
      'button, [role="button"], div, section, article, [class], [aria-label]',
    ),
  ]
    .filter(visible)
    .map((node) => ({
      node,
      rect: node.getBoundingClientRect(),
      text: textOf(node),
      tag: node.tagName,
      role: node.getAttribute?.("role") || "",
      cls: String(node.className || "").slice(0, 100),
    }))
    .filter(
      (item) =>
        /Choose a template|Photo|Video|Style|Edit|Template|close|dismiss|×|x/i.test(
          item.text,
        ) || /dialog|modal|button/i.test(`${item.role} ${item.cls}`),
    )
    .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)
    .slice(0, 80)
    .map((item) => ({
      tag: item.tag,
      role: item.role,
      className: item.cls,
      text: item.text.slice(0, 220),
      box: {
        x: item.rect.x,
        y: item.rect.y,
        width: item.rect.width,
        height: item.rect.height,
      },
    }));
  return {
    ok: true,
    open: /Choose a template type to begin|Name your template|Template Name|Add a description/i.test(
      bodyText,
    ),
    url: location.href,
    viewport: { width: innerWidth, height: innerHeight },
    sampleText: bodyText.slice(0, 1200),
    interesting,
  };
}

function selectGrokPhotoVideoTemplateScript() {
  const bodyText = document.body?.innerText || "";
  const open =
    /Choose a template type to begin|Photo\s*→\s*Video|Name your template|Template Name/i.test(
      bodyText,
    );
  if (!open) return { ok: false, reason: "modal-not-open" };
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return (
      rect &&
      rect.width > 20 &&
      rect.height > 20 &&
      rect.bottom > 0 &&
      rect.right > 0
    );
  };
  const textOf = (node) =>
    `${node.innerText || node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`
      .trim()
      .replace(/\s+/g, " ");
  const all = [
    ...document.querySelectorAll(
      'button, [role="button"], div, section, article',
    ),
  ]
    .filter(visible)
    .map((node) => ({
      node,
      rect: node.getBoundingClientRect(),
      text: textOf(node),
      tag: node.tagName,
      role: node.getAttribute?.("role") || "",
      cls: String(node.className || "").slice(0, 100),
    }));
  const cards = all
    .filter(
      (item) =>
        /Photo\s*→\s*Video/i.test(item.text) &&
        /Animate a photo using a video prompt/i.test(item.text) &&
        !/Style|Edit → Video|different visual style/i.test(item.text),
    )
    .filter(
      (item) =>
        item.rect.width >= 160 &&
        item.rect.width <= 360 &&
        item.rect.height >= 70 &&
        item.rect.height <= 150,
    )
    .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  const card = cards[0];
  if (!card)
    return {
      ok: false,
      error: "Không tìm thấy container card Photo → Video.",
      candidates: all
        .filter((item) => /Photo|Video|Animate/i.test(item.text))
        .slice(0, 30)
        .map((item) => ({
          tag: item.tag,
          role: item.role,
          className: item.cls,
          text: item.text.slice(0, 180),
          box: {
            x: item.rect.x,
            y: item.rect.y,
            width: item.rect.width,
            height: item.rect.height,
          },
        })),
    };
  const clickPoints = [
    {
      name: "center",
      x: card.rect.x + card.rect.width / 2,
      y: card.rect.y + card.rect.height / 2,
    },
    { name: "title-left", x: card.rect.x + 56, y: card.rect.y + 26 },
    { name: "icon", x: card.rect.x + 22, y: card.rect.y + 26 },
  ];
  const hits = clickPoints.map((point) => {
    const hit = document.elementFromPoint(point.x, point.y);
    return {
      ...point,
      hitText: textOf(hit || document.body).slice(0, 160),
      hitTag: hit?.tagName || "",
    };
  });
  return {
    ok: true,
    selector: "Photo → Video container",
    box: {
      x: card.rect.x,
      y: card.rect.y,
      width: card.rect.width,
      height: card.rect.height,
    },
    clickPoints,
    hits,
    text: card.text.slice(0, 220),
    tag: card.tag,
    role: card.role,
    className: card.cls,
  };
}

function forceHideGrokTemplateModalScript() {
  const bodyText = document.body?.innerText || "";
  const open =
    /Choose a template type to begin|Name your template|Template Name|Photo\s*→\s*Video|Photo\s*→\s*Style Edit|Photo\s*→\s*Edit\s*→\s*Video/i.test(
      bodyText,
    );
  if (!open) return { ok: false, reason: "modal-not-open" };
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return (
      rect &&
      rect.width > 10 &&
      rect.height > 10 &&
      rect.bottom > 0 &&
      rect.right > 0
    );
  };
  const modalNodes = [
    ...document.querySelectorAll(
      'div, section, article, main, [role="dialog"], [class]',
    ),
  ]
    .filter((node) => {
      if (!visible(node)) return false;
      const text = node.innerText || "";
      const hasTemplateChoice =
        /Choose a template type to begin/i.test(text) &&
        /Photo\s*→\s*Video/i.test(text);
      const hasNameTemplateStep =
        /Name your template|Template Name|Add a description/i.test(text);
      return hasTemplateChoice || hasNameTemplateStep;
    })
    .map((node) => ({
      node,
      rect: node.getBoundingClientRect(),
      text: node.innerText || "",
    }))
    .filter((item) => item.rect.width > 260 && item.rect.height > 120)
    .sort(
      (a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height,
    );
  const modal = modalNodes[0];
  const hidden = [];
  if (modal?.node) {
    let node = modal.node;
    for (let depth = 0; node && depth < 4; depth += 1) {
      const rect = node.getBoundingClientRect?.();
      const text = node.innerText || "";
      if (
        rect &&
        /Choose a template type to begin|Name your template|Template Name|Add a description/i.test(
          text,
        ) &&
        rect.width < window.innerWidth * 0.98 &&
        rect.height < window.innerHeight * 0.98
      ) {
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("pointer-events", "none", "important");
        hidden.push({
          tag: node.tagName,
          className: String(node.className || "").slice(0, 120),
          box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        });
        break;
      }
      node = node.parentElement;
    }
  }
  [...document.querySelectorAll("div, [class]")].forEach((node) => {
    const rect = node.getBoundingClientRect?.();
    if (
      !rect ||
      rect.width < window.innerWidth * 0.5 ||
      rect.height < window.innerHeight * 0.5
    )
      return;
    const style = getComputedStyle(node);
    const looksBackdrop =
      Number(style.opacity || 1) > 0 &&
      (style.backdropFilter !== "none" ||
        /blur|overlay|modal|dialog|backdrop/i.test(
          String(node.className || ""),
        ));
    if (!looksBackdrop) return;
    node.style.setProperty("display", "none", "important");
    node.style.setProperty("visibility", "hidden", "important");
    node.style.setProperty("pointer-events", "none", "important");
    hidden.push({
      tag: node.tagName,
      className: String(node.className || "").slice(0, 120),
      backdrop: true,
      box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    });
  });
  document.body.style.pointerEvents = "auto";
  document.documentElement.style.pointerEvents = "auto";
  return {
    ok: hidden.length > 0,
    hidden,
    modal: modal
      ? {
          x: modal.rect.x,
          y: modal.rect.y,
          width: modal.rect.width,
          height: modal.rect.height,
        }
      : null,
  };
}

async function prepareGrokVideoComposerScript(config = {}) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const textOf = (node) =>
    `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`.trim();
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return (
      rect &&
      rect.width > 4 &&
      rect.height > 4 &&
      rect.bottom > 0 &&
      rect.right > 0
    );
  };
  const clickNode = (target) => {
    if (!target) return false;
    target.scrollIntoView({ block: "center", inline: "center" });
    target.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    target.click();
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    return true;
  };
  const findClickable = (pattern) => {
    const nodes = [
      ...document.querySelectorAll(
        'button, [role="button"], a, label, div, span',
      ),
    ].filter(visible);
    return (
      nodes
        .find((node) => pattern.test(textOf(node)))
        ?.closest?.('button, [role="button"], a, label') ||
      nodes.find((node) => pattern.test(textOf(node)))
    );
  };

  let path = location.pathname.toLowerCase();
  if (!path.includes("/imagine")) {
    const imagine = findClickable(/(^|\s)Imagine(\s|$)|Image/i);
    if (imagine) clickNode(imagine);
    await sleep(800);
    path = location.pathname.toLowerCase();
  }

  const composerBar = [...document.querySelectorAll('button, [role="button"]')]
    .map((node) => ({
      node,
      rect: node.getBoundingClientRect?.(),
      text: textOf(node),
    }))
    .filter(
      (item) =>
        item.rect &&
        item.rect.width > 18 &&
        item.rect.height > 18 &&
        item.rect.top > window.innerHeight * 0.72,
    )
    .sort((a, b) => a.rect.left - b.rect.left);
  const clickExact = (pattern) => {
    const target = composerBar.find(
      (item) =>
        pattern.test(item.text) && item.rect.left < window.innerWidth * 0.75,
    )?.node;
    return {
      clicked: clickNode(target),
      text: target ? textOf(target).slice(0, 120) : "",
      box: target
        ? (() => {
            const r = target.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height };
          })()
        : null,
    };
  };
  const imageResult = clickExact(/^\s*Image\s*$/i);
  await sleep(450);
  const videoResult = clickExact(/^\s*Video\s*$/i);
  await sleep(450);
  const ratioMenuResult = clickExact(
    /^\s*(Original|\d+\s*:\s*\d+|Widescreen|Wide|Square|Vertical)\s*$/i,
  );
  await sleep(300);
  const ratio169Node = [
    ...document.querySelectorAll(
      'button, [role="button"], [role="menuitem"], div, span',
    ),
  ]
    .filter(visible)
    .map((node) => ({
      node,
      text: textOf(node),
      rect: node.getBoundingClientRect?.(),
    }))
    .filter((item) => item.rect && item.rect.top > window.innerHeight * 0.35)
    .find((item) =>
      /^\s*(16\s*:\s*9|Widescreen|Wide)\s*$/i.test(item.text),
    )?.node;
  const clicked169 = clickNode(ratio169Node);
  await sleep(250);
  const wantedDuration = String(config?.duration || "10").startsWith("6")
    ? "6s"
    : "10s";
  const qualityResult = clickExact(/^\s*(480p|720p|1080p)\s*$/i);
  await sleep(250);
  const quality720Node = [
    ...document.querySelectorAll(
      'button, [role="button"], [role="menuitem"], div, span',
    ),
  ]
    .filter(visible)
    .map((node) => ({
      node,
      text: textOf(node),
      rect: node.getBoundingClientRect?.(),
    }))
    .filter((item) => item.rect && item.rect.top > window.innerHeight * 0.35)
    .find((item) => /^\s*720p\s*$/i.test(item.text))?.node;
  const clicked720 = clickNode(quality720Node);
  await sleep(250);
  const durationResult = clickExact(/^\s*(6s|10s)\s*$/i);
  await sleep(250);
  const durationNode = [
    ...document.querySelectorAll(
      'button, [role="button"], [role="menuitem"], div, span',
    ),
  ]
    .filter(visible)
    .map((node) => ({
      node,
      text: textOf(node),
      rect: node.getBoundingClientRect?.(),
    }))
    .filter((item) => item.rect && item.rect.top > window.innerHeight * 0.35)
    .find((item) =>
      new RegExp(`^\\s*${wantedDuration}\\s*$`, "i").test(item.text),
    )?.node;
  const clickedDuration = clickNode(durationNode);
  await sleep(250);
  const configLog = {
    wantedDuration,
    wantedResolution: config?.resolution || "720p",
    imageResult,
    videoResult,
    ratioMenuResult,
    clicked169,
    qualityResult,
    clicked720,
    durationResult,
    clickedDuration,
    ratio169Text: ratio169Node ? textOf(ratio169Node).slice(0, 120) : "",
    quality720Text: quality720Node ? textOf(quality720Node).slice(0, 120) : "",
    durationText: durationNode ? textOf(durationNode).slice(0, 120) : "",
    composerButtons: composerBar.map((item) => ({
      text: item.text.slice(0, 80),
      box: {
        x: item.rect.x,
        y: item.rect.y,
        w: item.rect.width,
        h: item.rect.height,
      },
    })),
    url: location.href,
    bodyTail: (document.body?.innerText || "").slice(-1500),
  };

  path = location.pathname.toLowerCase();
  const isAgentCanvas =
    path.includes("/imagine/agent/") && path.length > "/imagine/agent/".length;
  if (isAgentCanvas)
    return {
      ok: true,
      isAgentCanvas: true,
      status: "already-canvas-video-16x9",
      configLog,
      url: location.href,
    };

  const emptyCanvas = findClickable(
    /(^|\s)Empty\s*Canvas(\s|$)|Create\s*from\s*scratch|Blank\s*canvas/i,
  );
  if (!emptyCanvas) {
    const bodyText = document.body?.innerText || "";
    return {
      ok: true,
      isAgentCanvas: false,
      status: "imagine-chat-video-16x9-ready-no-empty-canvas",
      configLog,
      url: location.href,
      bodyHead: bodyText.slice(0, 1000),
      bodyTail: bodyText.slice(-1500),
    };
  }
  const clickedEmptyCanvas = clickNode(emptyCanvas);
  const started = Date.now();
  while (Date.now() - started < 8000) {
    await sleep(300);
    const nowPath = location.pathname.toLowerCase();
    if (
      nowPath.includes("/imagine/agent/") &&
      nowPath.length > "/imagine/agent/".length
    ) {
      const videoModeAgain = findClickable(/(^|\s)(Video|Motion)(\s|$)/i);
      const clickedVideoAgain = clickNode(videoModeAgain);
      const ratioAgain = findClickable(
        /\b(2:3|3:2|1:1|9:16|16:9)\b|Tall|Wide|Square|Vertical|Widescreen/i,
      );
      const clickedRatioAgain = clickNode(ratioAgain);
      await sleep(150);
      const ratio169Again = findClickable(/\b16\s*:\s*9\b|Widescreen/i);
      const clicked169Again = clickNode(ratio169Again);
      return {
        ok: true,
        isAgentCanvas: true,
        emptyCanvasClicked: clickedEmptyCanvas,
        status: "clicked-empty-canvas-video-16x9",
        configLog: {
          ...configLog,
          clickedVideoAgain,
          clickedRatioAgain,
          clicked169Again,
          videoAgainText: videoModeAgain
            ? textOf(videoModeAgain).slice(0, 120)
            : "",
          ratioAgainText: ratioAgain ? textOf(ratioAgain).slice(0, 120) : "",
          ratio169AgainText: ratio169Again
            ? textOf(ratio169Again).slice(0, 120)
            : "",
        },
        url: location.href,
      };
    }
  }
  const rect = emptyCanvas.getBoundingClientRect?.();
  return {
    ok: true,
    isAgentCanvas: false,
    emptyCanvasClicked: clickedEmptyCanvas,
    status: "clicked-but-no-navigation-use-imagine-chat",
    configLog,
    url: location.href,
    emptyCanvasBox: rect
      ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      : null,
  };
}

function preparePixVerseComposerScript(config = {}) {
  const textOf = (node) =>
    `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`.trim();
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 4 && rect.height > 4;
  };
  const clickByText = (pattern) => {
    const nodes = [
      ...document.querySelectorAll('button, [role="button"], label, div, span'),
    ].filter(visible);
    const target = nodes.find((node) => pattern.test(textOf(node)));
    if (target) {
      target.scrollIntoView({ block: "center", inline: "center" });
      target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      target.click();
      target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      return true;
    }
    return false;
  };
  clickByText(/Video/i);
  clickByText(/Image\s*(to|2)\s*Video|Image/i);
  if (config.resolution)
    clickByText(
      new RegExp(String(config.resolution).replace("P", "\\s*P"), "i"),
    );
  if (config.ratio)
    clickByText(
      new RegExp(String(config.ratio).replace(":", "\\s*[:：]\\s*"), "i"),
    );
  if (config.duration) clickByText(new RegExp(`${config.duration}\\s*s`, "i"));
  if (config.model)
    clickByText(
      new RegExp(
        String(config.model).replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"),
        "i",
      ),
    );
  const bodyText = document.body?.innerText || "";
  if (typeof config.previewMode === "boolean") {
    const previewOn = /Preview Mode\s*[^\n]{0,30}(on|✓|checked)/i.test(
      bodyText,
    );
    if (config.previewMode !== previewOn) clickByText(/Preview Mode/i);
  }
  if (typeof config.audio === "boolean") {
    const audioOn = /Audio\s*[^\n]{0,20}(on|✓|checked)/i.test(bodyText);
    if (config.audio !== audioOn) clickByText(/Audio/i);
  }
  clickByText(/Reference|Upload|Image|Add image|\+/i);
  return { ok: true };
}

function setPixVersePromptScript(prompt) {
  const selectors = [
    'textarea[placeholder*="Describe"]',
    "textarea",
    '[contenteditable="true"]',
    '[role="textbox"]',
    'div[class*="input"] textarea',
  ];
  const input = selectors
    .map((selector) => document.querySelector(selector))
    .find(Boolean);
  if (!input)
    return { ok: false, error: "Không tìm thấy ô Describe PixVerse." };
  input.scrollIntoView({ block: "center" });
  input.focus();
  input.click();
  if ("value" in input) {
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.value = prompt;
    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: prompt,
      }),
    );
    input.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("delete", false, null);
    document.execCommand("insertText", false, prompt);
    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: prompt,
      }),
    );
  }
  return { ok: true, selector: input.tagName };
}

function setGrokComposerTextScript(text) {
  const candidates = [
    ...document.querySelectorAll(
      'textarea, [contenteditable="true"], [role="textbox"], input',
    ),
  ];
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return (
      rect &&
      rect.width > 40 &&
      rect.height > 16 &&
      rect.left > window.innerWidth * 0.58 &&
      rect.top > window.innerHeight * 0.45
    );
  };
  const target = candidates
    .filter(visible)
    .sort(
      (a, b) =>
        b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom,
    )[0];
  if (!target) return { ok: false, error: "composer-not-found" };
  target.focus?.();
  target.click?.();
  if ("value" in target) {
    target.value = text;
    target.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text,
      }),
    );
    target.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    target.textContent = text;
    target.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text,
      }),
    );
  }
  return {
    ok: true,
    text: String(target.value || target.textContent || "").slice(0, 120),
  };
}

function focusGrokComposerScript() {
  const selectors = [
    'textarea[placeholder*="What do you want" i]',
    'textarea[placeholder*="Ask" i]',
    'textarea[placeholder*="imagine" i]',
    'textarea[placeholder*="Imagine" i]',
    'textarea[placeholder*="create" i]',
    '[contenteditable="true"]',
    '[role="textbox"]',
    "textarea",
  ];
  const bodyText = document.body?.innerText || "";
  const isImagineAgent = (location.pathname || "").startsWith("/imagine/agent");
  const candidates = selectors
    .flatMap((selector) => [...document.querySelectorAll(selector)])
    .filter((node) => {
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width <= 80 || rect.height <= 16) return false;
      if (rect.bottom < window.innerHeight * 0.35) return false;
      const allowedRightPanelComposer =
        isImagineAgent &&
        rect.left > window.innerWidth * 0.55 &&
        rect.right <= window.innerWidth + 12 &&
        rect.top > window.innerHeight * 0.45;
      if (
        rect.left < window.innerWidth * 0.18 ||
        (rect.right > window.innerWidth * 0.95 && !allowedRightPanelComposer)
      )
        return false;
      const text = (
        node.innerText ||
        node.textContent ||
        node.value ||
        ""
      ).trim();
      if (text.length > 30000) return false;
      const all = `${node.getAttribute?.("placeholder") || ""} ${node.getAttribute?.("aria-label") || ""} ${text}`;
      if (/connect|connector|gmail|google drive|notion|vercel/i.test(all))
        return false;
      return true;
    })
    .map((node) => ({
      node,
      rect: node.getBoundingClientRect(),
      label: `${node.getAttribute?.("placeholder") || ""} ${node.getAttribute?.("aria-label") || ""} ${node.textContent || ""}`,
    }))
    .sort((a, b) => {
      const aInput =
        /what do you want|message|ask|prompt|type|imagine|describe|create/i.test(
          a.label,
        )
          ? 1
          : 0;
      const bInput =
        /what do you want|message|ask|prompt|type|imagine|describe|create/i.test(
          b.label,
        )
          ? 1
          : 0;
      if (aInput !== bInput) return bInput - aInput;
      return b.rect.bottom - a.rect.bottom;
    });
  const input = candidates[0]?.node;
  if (!input)
    return {
      ok: false,
      error: "Không tìm thấy composer Grok để focus.",
      bodyHead: bodyText.slice(0, 800),
    };
  input.scrollIntoView({ block: "center", inline: "center" });
  input.focus();
  input.click();
  const rect = input.getBoundingClientRect();
  return {
    ok: true,
    box: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    label:
      `${input.getAttribute?.("placeholder") || ""} ${input.getAttribute?.("aria-label") || ""}`.trim(),
  };
}

function labelGrokCanvasScript(label) {
  const buttons = [
    ...document.querySelectorAll(
      'button, [role="button"], [contenteditable="true"], input',
    ),
  ]
    .map((node) => ({
      node,
      rect: node.getBoundingClientRect?.(),
      text: `${node.textContent || node.value || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`.trim(),
    }))
    .filter(
      (item) =>
        item.rect &&
        item.rect.width > 30 &&
        item.rect.height > 16 &&
        item.rect.left < window.innerWidth * 0.45 &&
        item.rect.top < 120,
    );
  const titleButton =
    buttons.find((item) => /Untitled|SCENE|scene/i.test(item.text)) ||
    buttons.find((item) => item.rect.left > 80 && item.rect.top < 120);
  if (!titleButton)
    return {
      ok: false,
      error: "Không tìm thấy title/dropdown canvas để rename.",
      candidates: buttons.map((b) => b.text).slice(0, 12),
    };
  titleButton.node.click();
  const input = [
    ...document.querySelectorAll('input, textarea, [contenteditable="true"]'),
  ]
    .map((node) => ({ node, rect: node.getBoundingClientRect?.() }))
    .filter(
      (item) =>
        item.rect &&
        item.rect.width > 60 &&
        item.rect.height > 18 &&
        item.rect.top < 180,
    )
    .sort((a, b) => b.rect.width - a.rect.width)[0]?.node;
  if (!input)
    return {
      ok: false,
      error: "Đã mở title nhưng không thấy ô rename.",
      clicked: titleButton.text,
    };
  input.focus();
  if ("value" in input) {
    input.value = label;
    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: label,
      }),
    );
    input.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("delete", false, null);
    document.execCommand("insertText", false, label);
  }
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
    }),
  );
  input.dispatchEvent(
    new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }),
  );
  return { ok: true, label, clicked: titleButton.text };
}

function clearGrokCanvasChatScript() {
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .map((node) => ({
      node,
      rect: node.getBoundingClientRect?.(),
      text: `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`.trim(),
    }))
    .filter(
      (item) =>
        item.rect &&
        item.rect.width > 10 &&
        item.rect.height > 10 &&
        item.rect.left > window.innerWidth * 0.72,
    );
  const newChat = buttons.find((item) => /^\s*New\s*Chat\s*$/i.test(item.text));
  if (!newChat)
    return {
      ok: false,
      error: "no-new-chat-button",
      buttons: buttons.map((b) => b.text).slice(0, 20),
    };
  newChat.node.click();
  return { ok: true, mode: "clicked-new-chat", text: newChat.text };
}

function clickGrokUploadImageMenuItemScript() {
  const items = [
    ...document.querySelectorAll(
      'button, [role="menuitem"], [role="button"], div, span',
    ),
  ]
    .map((node) => ({
      node,
      rect: node.getBoundingClientRect?.(),
      text: `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`.trim(),
    }))
    .filter(
      (item) =>
        item.rect &&
        item.rect.width > 40 &&
        item.rect.height > 16 &&
        item.rect.top > 80 &&
        item.rect.bottom < window.innerHeight - 40,
    );
  const uploadImage =
    items.find((item) => /^\s*Upload\s*Image\s*$/i.test(item.text)) ||
    items.find((item) => /Upload\s*Image/i.test(item.text));
  if (!uploadImage)
    return {
      ok: false,
      error: "Không thấy menu item Upload Image.",
      items: items
        .map((item) => ({
          text: item.text,
          box: {
            x: item.rect.x,
            y: item.rect.y,
            w: item.rect.width,
            h: item.rect.height,
          },
        }))
        .slice(0, 40),
    };
  uploadImage.node.dispatchEvent(
    new MouseEvent("pointerdown", {
      bubbles: true,
      clientX: uploadImage.rect.x + 8,
      clientY: uploadImage.rect.y + 8,
    }),
  );
  uploadImage.node.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      clientX: uploadImage.rect.x + 8,
      clientY: uploadImage.rect.y + 8,
    }),
  );
  uploadImage.node.click();
  uploadImage.node.dispatchEvent(
    new MouseEvent("mouseup", {
      bubbles: true,
      clientX: uploadImage.rect.x + 8,
      clientY: uploadImage.rect.y + 8,
    }),
  );
  return {
    ok: true,
    text: uploadImage.text,
    box: {
      x: uploadImage.rect.x,
      y: uploadImage.rect.y,
      width: uploadImage.rect.width,
      height: uploadImage.rect.height,
    },
  };
}

function clickGrokCanvasUploadImageScript() {
  const candidates = [
    ...document.querySelectorAll('button, [role="button"], label'),
  ]
    .map((node) => ({
      node,
      rect: node.getBoundingClientRect?.(),
      text: `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`.trim(),
      html: node.innerHTML || "",
    }))
    .filter(
      (item) =>
        item.rect &&
        item.rect.width >= 20 &&
        item.rect.height >= 20 &&
        item.rect.left < window.innerWidth * 0.72 &&
        item.rect.top > window.innerHeight * 0.55,
    );
  const upload =
    candidates.find((item) =>
      /Upload\s*Image|Add\s*Image|Image/i.test(item.text),
    ) ||
    candidates.find((item) =>
      /image|upload|plus|photo|picture/i.test(`${item.text} ${item.html}`),
    );
  if (!upload)
    return {
      ok: false,
      error: "Không tìm thấy nút Upload Image trong toolbar canvas.",
      candidates: candidates
        .map((c) => ({
          text: c.text,
          box: c.rect
            ? { x: c.rect.x, y: c.rect.y, w: c.rect.width, h: c.rect.height }
            : null,
        }))
        .slice(0, 20),
    };
  upload.node.scrollIntoView({ block: "center", inline: "center" });
  upload.node.click();
  const rect = upload.node.getBoundingClientRect();
  return {
    ok: true,
    text: upload.text,
    box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  };
}

function focusGrokWorkspaceScript() {
  const viewport = {
    width: window.innerWidth || 1200,
    height: window.innerHeight || 800,
  };
  const candidates = [
    ...document.querySelectorAll(
      'canvas, [class*="canvas" i], [class*="workspace" i], [class*="stage" i], main, body',
    ),
  ]
    .map((node) => ({ node, rect: node.getBoundingClientRect?.() }))
    .filter(
      (item) =>
        item.rect &&
        item.rect.width > viewport.width * 0.35 &&
        item.rect.height > viewport.height * 0.35,
    )
    .sort(
      (a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height,
    );
  const target = candidates[0]?.node || document.body;
  const rect = target.getBoundingClientRect?.() || {
    left: 0,
    top: 0,
    width: viewport.width * 0.7,
    height: viewport.height,
  };
  const x = Math.min(rect.left + rect.width * 0.5, viewport.width * 0.65);
  const y = Math.min(rect.top + rect.height * 0.5, viewport.height * 0.55);
  const el = document.elementFromPoint(x, y) || target;
  el.dispatchEvent(
    new MouseEvent("pointerdown", { bubbles: true, clientX: x, clientY: y }),
  );
  el.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, clientX: x, clientY: y }),
  );
  el.dispatchEvent(
    new MouseEvent("mouseup", { bubbles: true, clientX: x, clientY: y }),
  );
  el.dispatchEvent(
    new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }),
  );
  return {
    ok: true,
    mode: "workspace-click",
    point: { x, y },
    target: el.tagName,
    className: String(el.className || "").slice(0, 120),
  };
}

function setGrokVideoPromptScript(prompt) {
  const selectors = [
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="Describe"]',
    'textarea[placeholder*="create" i]',
    "textarea",
    "#prompt-textarea",
    '[contenteditable="true"]',
    '[role="textbox"]',
  ];
  const candidates = selectors
    .flatMap((selector) => [...document.querySelectorAll(selector)])
    .filter((node) => {
      const rect = node.getBoundingClientRect?.();
      return rect && rect.width > 80 && rect.height > 20;
    })
    .map((node) => ({
      node,
      rect: node.getBoundingClientRect(),
      label: `${node.getAttribute?.("placeholder") || ""} ${node.getAttribute?.("aria-label") || ""} ${node.textContent || ""}`,
    }))
    .sort((a, b) => {
      const aImagine = /imagine/i.test(a.label) ? 1 : 0;
      const bImagine = /imagine/i.test(b.label) ? 1 : 0;
      if (aImagine !== bImagine) return bImagine - aImagine;
      return b.rect.top - a.rect.top;
    });
  const input = candidates[0]?.node;
  if (!input)
    return { ok: false, error: "Không tìm thấy ô nhập prompt của Grok." };
  input.scrollIntoView({ block: "center" });
  input.focus();
  input.click();
  if ("value" in input) {
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.value = prompt;
    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: prompt,
      }),
    );
    input.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("delete", false, null);
    document.execCommand("insertText", false, prompt);
    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: prompt,
      }),
    );
  }
  return {
    ok: true,
    selector: input.tagName || input.getAttribute("role") || "textbox",
  };
}

function detectGrokConfirmationQuestionScript() {
  const text = document.body?.innerText || "";
  const tail = text.slice(-3000);
  const asked =
    /Bạn muốn tôi sử dụng prompt này để tạo video|Hãy xác nhận để tôi tiến hành generate|Would you like me to use this prompt|confirm.*generate|generate.*now/i.test(
      tail,
    );
  const echoedMotionPrompt =
    /DÒNG\s*1|DÒNG\s*2|DÒNG\s*7|Negative\s*Prompt|Technical\s*Specifications/i.test(
      tail,
    ) && /MOTION\s*PROMPT|VIDEO\s*10|keyframe|8K|NO\s*MUSIC/i.test(tail);
  const hasVideo = /\.mp4|video generated|download|play video|regenerate/i.test(
    tail,
  );
  return {
    shouldConfirm: (asked || echoedMotionPrompt) && !hasVideo,
    asked,
    echoedMotionPrompt,
    hasVideo,
    reason: asked
      ? "asked-confirmation"
      : echoedMotionPrompt
        ? "echoed-motion-prompt"
        : hasVideo
          ? "video-present"
          : "no-confirm-needed",
    tailSnippet: tail.slice(-360),
  };
}

function getGrokSendPreflightScript(expectedPrompt = "", options = {}) {
  const path = location.pathname || "";
  const isImagineAgent =
    location.hostname === "grok.com" &&
    (path === "/imagine/agent" || path.startsWith("/imagine/agent/"));
  const isAgentCanvas =
    path.startsWith("/imagine/agent/") &&
    path.length > "/imagine/agent/".length;
  const bodyText = document.body?.innerText || "";
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    if (
      !rect ||
      rect.width < 6 ||
      rect.height < 6 ||
      rect.bottom <= 0 ||
      rect.right <= 0
    )
      return false;
    const style = window.getComputedStyle?.(node);
    return !(
      style &&
      (style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity || 1) === 0)
    );
  };
  const boxOf = (node) => {
    const rect = node?.getBoundingClientRect?.();
    return rect
      ? {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
          bottom: rect.bottom,
          right: rect.right,
        }
      : null;
  };
  const textOf = (node) =>
    `${node?.value || ""} ${node?.innerText || node?.textContent || ""} ${node?.getAttribute?.("placeholder") || ""} ${node?.getAttribute?.("aria-label") || ""} ${node?.title || ""}`
      .replace(/\s+/g, " ")
      .trim();
  const normalize = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  const expected = normalize(expectedPrompt);
  const expectedHead = expected.slice(0, Math.min(36, expected.length));
  const selectors =
    'textarea, [contenteditable="true"], [role="textbox"], input';
  const composerItems = [...document.querySelectorAll(selectors)]
    .filter(visible)
    .map((node) => ({
      node,
      box: boxOf(node),
      text: normalize(node.value || node.innerText || node.textContent || ""),
      label: textOf(node),
    }))
    .filter(
      (item) =>
        item.box &&
        item.box.left > window.innerWidth * 0.52 &&
        item.box.top > window.innerHeight * 0.38 &&
        item.box.width > 80,
    )
    .sort((a, b) => b.box.bottom - a.box.bottom);
  const composer = composerItems[0] || null;
  const composerText = composer?.text || "";
  const promptReady = Boolean(
    expectedHead && composerText.includes(expectedHead),
  );
  const messageBubbleExists = Boolean(
    expectedHead && normalize(bodyText).includes(expectedHead),
  );
  const active = document.activeElement;
  const activeComposer = Boolean(
    composer?.node &&
    (active === composer.node ||
      composer.node.contains?.(active) ||
      active?.contains?.(composer.node)),
  );
  const media = [...document.querySelectorAll("img, canvas, video")]
    .filter(visible)
    .map((node) => ({
      tag: node.tagName,
      box: boxOf(node),
      src: node.currentSrc || node.src || "",
      className: String(node.className || "").slice(0, 80),
    }))
    .filter(
      (item) =>
        item.box &&
        item.box.top > 40 &&
        item.box.width >= 24 &&
        item.box.height >= 24 &&
        item.box.left < window.innerWidth * 0.88,
    );
  const fileInputs = [...document.querySelectorAll('input[type="file"]')].map(
    (input) => ({
      files: input.files?.length || 0,
      accept: input.accept || "",
    }),
  );
  const uploadTextReady =
    /image uploaded|upload complete|remove image|attached|anh|ảnh|video uploaded|remove video/i.test(
      bodyText,
    );
  const attachmentMedia = media.filter(
    (item) =>
      item.tag !== "CANVAS" && item.box.width >= 48 && item.box.height >= 48,
  );
  const attachmentReady =
    (isAgentCanvas && attachmentMedia.length > 0) ||
    fileInputs.some((input) => input.files > 0) ||
    uploadTextReady;
  const uploading =
    /Uploading|uploading|Dang tai|Đang tải|Äang táº£i|processing upload/i.test(
      bodyText,
    ) ||
    [
      ...document.querySelectorAll(
        '[aria-busy="true"], [class*="spinner" i], [class*="loading" i], [role="progressbar"]',
      ),
    ].some(visible);
  const uploadError =
    /upload failed|could not upload|khong upload|không upload|upload error/i.test(
      bodyText,
    );
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .filter(visible)
    .map((node) => ({
      node,
      box: boxOf(node),
      text: textOf(node),
      html: node.innerHTML || "",
      disabled: Boolean(
        node.disabled || node.getAttribute?.("aria-disabled") === "true",
      ),
    }));
  const button =
    buttons.find((item) => {
      if (item.disabled || !item.box) return false;
      const nearComposer = composer?.box
        ? item.box.top > composer.box.top - 90 &&
          item.box.top < composer.box.bottom + 90 &&
          item.box.left > composer.box.left - 40
        : item.box.left > window.innerWidth * 0.72 &&
          item.box.top > window.innerHeight * 0.68;
      if (!nearComposer) return false;
      if (
        /Agent\s*\(?Beta\)?|Create\s*Worlds|Historical\s*Stories|Short\s*Film|UGC\s*Product|^\s*(Image|Video|480p|720p|6s|10s)\s*$/i.test(
          item.text,
        )
      )
        return false;
      const hasSendIcon = /arrow-up|send-icon|paper-plane/i.test(item.html);
      return (
        /^(Generate|Create|Start|Send|Submit|gửi|Imagine)$/i.test(item.text) ||
        (item.text === "" && hasSendIcon)
      );
    }) ||
    buttons
      .filter(
        (item) =>
          !item.disabled &&
          item.box &&
          item.box.left > window.innerWidth * 0.84 &&
          item.box.top > window.innerHeight * 0.72 &&
          !/microphone|voice|audio|attach|add|upload|\+|new chat/i.test(
            item.text,
          ),
      )
      .sort((a, b) => b.box.left - a.box.left)[0];
  let covered = false;
  if (button?.box) {
    const cx = button.box.x + button.box.width / 2;
    const cy = button.box.y + button.box.height / 2;
    const top = document.elementFromPoint(cx, cy);
    const topButton = top?.closest?.('button, [role="button"]');
    covered = Boolean(
      top &&
      top !== button.node &&
      !button.node.contains(top) &&
      topButton !== button.node,
    );
  }
  const sendErrorVisible =
    /couldn['’]?t send message|could not send message|message failed to send/i.test(
      bodyText,
    );
  const retryAvailable = buttons.some((item) =>
    /(^|\s)(Retry|Try again|Thu lai|Thử lại|Gửi lại)(\s|$)/i.test(item.text),
  );
  const unableFinish =
    /Grok was unable to finish replying|unable to finish replying|couldn['’]?t finish/i.test(
      bodyText,
    );
  const rateLimit =
    /rate limit|too many requests|quota|usage limit|try again later|come back later/i.test(
      bodyText,
    );
  const safetyBlock =
    /content policy|blocked by content policy|triggered moderation|cannot generate/i.test(
      bodyText,
    );
  const loginOrChallenge =
    /cloudflare|verify you are human|security verification|just a moment|Log in|Sign in|Sign up|continue with google/i.test(
      bodyText,
    ) &&
    !/SuperGrok|Imagine|Type to imagine|Private|Grok can make mistakes/i.test(
      bodyText,
    );
  const normalChatTarget =
    !isImagineAgent &&
    /What do you want to know\?|Ask anything|Message Grok/i.test(bodyText);
  const pageBusy = /Generating|Creating|Thinking about your request/i.test(
    bodyText,
  );
  let route = "unknown";
  if (loginOrChallenge) route = "login_or_challenge";
  else if (normalChatTarget) route = "normal_chat";
  else if (
    isImagineAgent &&
    (isAgentCanvas || composer || attachmentReady || button)
  )
    route = "imagine_agent_ready";
  else if (isImagineAgent) route = "imagine_agent_loading";
  const failedReasons = [];
  if (route !== "imagine_agent_ready") failedReasons.push(`route-${route}`);
  if (!promptReady) failedReasons.push("prompt-not-ready");
  if (!attachmentReady && options.requireAttachment !== false)
    failedReasons.push("attachment-not-ready");
  if (uploading) failedReasons.push("uploading");
  if (uploadError) failedReasons.push("upload-error");
  if (!button) failedReasons.push("send-button-missing");
  if (button?.disabled) failedReasons.push("send-button-disabled");
  if (covered) failedReasons.push("send-button-covered");
  if (pageBusy) failedReasons.push("page-busy");
  if (sendErrorVisible) failedReasons.push("send-error-visible");
  if (loginOrChallenge) failedReasons.push("login-or-challenge");
  if (rateLimit) failedReasons.push("rate-limit");
  if (safetyBlock) failedReasons.push("safety-block");
  return {
    ok: true,
    route,
    url: location.href,
    safeUrl: `${location.origin}${path}`,
    isImagineAgent,
    isAgentCanvas,
    normalChatTarget,
    loginOrChallenge,
    promptReady,
    promptStable: false,
    activeComposer,
    composerFingerprint: `${composerText.length}:${composerText.slice(0, 48)}:${composerText.slice(-48)}`,
    composerBox: composer?.box || null,
    attachmentReady,
    uploadTextReady,
    uploading,
    uploadError,
    sendButtonEnabled: Boolean(button && !button.disabled && !covered),
    sendButtonBox: button?.box || null,
    sendButtonText: button?.text || "",
    sendButtonCovered: covered,
    pageBusy,
    blockingModal: false,
    sendErrorVisible,
    unableFinish,
    retryAvailable,
    rateLimit,
    safetyBlock,
    messageBubbleExists,
    blockingReason: failedReasons[0] || "",
    failedReasons,
    counts: {
      composer: composerItems.length,
      media: attachmentMedia.length,
      fileInputs: fileInputs.length,
      buttons: buttons.length,
    },
  };
}

function detectGrokUploadStateScript() {
  const bodyText = document.body?.innerText || "";
  const uploading = /Uploading|Đang tải|uploading/i.test(bodyText);
  const visibleUploading = [
    ...document.querySelectorAll("div, span, button"),
  ].some((node) => {
    const rect = node.getBoundingClientRect?.();
    if (
      !rect ||
      rect.width < 10 ||
      rect.height < 10 ||
      rect.bottom < 0 ||
      rect.right < 0
    )
      return false;
    return /Uploading|Đang tải|uploading/i.test(node.textContent || "");
  });
  return { ok: true, uploading: uploading || visibleUploading };
}

function clickGrokComposerAreaScript() {
  const candidates = [
    ...document.querySelectorAll(
      'textarea, [contenteditable="true"], [role="textbox"], input',
    ),
  ];
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return (
      rect &&
      rect.width > 30 &&
      rect.height > 20 &&
      rect.bottom > 0 &&
      rect.right > 0
    );
  };
  const target = candidates
    .filter(visible)
    .sort(
      (a, b) =>
        b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom,
    )[0];
  if (!target) return { ok: false, error: "composer-not-found" };
  target.scrollIntoView({ block: "center", inline: "center" });
  target.focus?.();
  target.click?.();
  return {
    ok: true,
    tag: target.tagName,
    text: String(target.textContent || target.value || "").slice(0, 80),
  };
}

function dismissGrokConnectorsScript() {
  const actions = [];
  const textOf = (node) =>
    `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`.trim();
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return (
      rect &&
      rect.width > 8 &&
      rect.height > 8 &&
      rect.bottom > 0 &&
      rect.right > 0
    );
  };
  for (const node of [
    ...document.querySelectorAll(
      '[role="dialog"], [data-radix-dialog-content]',
    ),
  ]) {
    if (/gmail|connector|connect/i.test(textOf(node))) {
      const close = [...node.querySelectorAll('button, [role="button"]')].find(
        (button) => /close|back|dismiss|×|←/i.test(textOf(button)),
      );
      if (close) {
        close.click();
        actions.push("close-connector-dialog");
      } else {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            bubbles: true,
          }),
        );
        actions.push("escape-connector-dialog");
      }
    }
  }
  const buttons = [
    ...document.querySelectorAll('button, [role="button"]'),
  ].filter(visible);
  const dismiss = buttons.find((button) => /^dismiss$/i.test(textOf(button)));
  if (dismiss) {
    dismiss.click();
    actions.push("dismiss-connectors-banner");
  }
  return {
    ok: true,
    actions,
    bodyHasConnectors: /Connectors are now available|New Connector|Gmail/i.test(
      document.body?.innerText || "",
    ),
  };
}

function forceGrokVideoModeScript() {
  const textOf = (node) =>
    `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`.trim();
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return (
      rect &&
      rect.width > 8 &&
      rect.height > 8 &&
      rect.bottom > 0 &&
      rect.right > 0
    );
  };
  const nodes = [
    ...document.querySelectorAll(
      'button, [role="tab"], [role="button"], label, div, span',
    ),
  ]
    .filter(visible)
    .filter(
      (node) =>
        !/connect|connector|gmail|google drive|notion|vercel/i.test(
          textOf(node),
        ),
    );
  const motionTab = nodes.find((node) => {
    const rect = node.getBoundingClientRect?.();
    const text = textOf(node);
    if (!rect || rect.top > window.innerHeight * 0.75) return false;
    return (
      /(^|\s)(Motion|Video)(\s|$)/i.test(text) && !/Image|Photo|Ảnh/i.test(text)
    );
  });
  if (!motionTab)
    return {
      ok: false,
      status: "video-mode-button-not-found",
      buttons: nodes.map(textOf).filter(Boolean).slice(0, 80),
    };
  motionTab.scrollIntoView({ block: "center", inline: "center" });
  motionTab.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
  motionTab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  motionTab.click();
  motionTab.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  return {
    ok: true,
    status: "clicked-video-motion-mode",
    text: textOf(motionTab),
  };
}

function captureGrokSubmitStateScript() {
  return {
    url: location.href,
    textLength: (document.body?.innerText || "").length,
    tail: (document.body?.innerText || "").slice(-1200),
  };
}

function detectGrokGeneratingStateScript(before = {}) {
  const bodyText = document.body?.innerText || "";
  const tail = bodyText.slice(-2500);
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .map((node) => {
      const rect = node.getBoundingClientRect?.();
      const text =
        `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`.trim();
      return { rect, text, html: node.innerHTML || "" };
    })
    .filter(
      (item) => item.rect && item.rect.width > 10 && item.rect.height > 10,
    );
  const stopButton = buttons.find((item) => {
    const nearComposer =
      item.rect.left > window.innerWidth * 0.72 &&
      item.rect.top > window.innerHeight * 0.68;
    const label = item.text || "";
    const html = item.html || "";
    const explicitStop = /(^|\s)(stop|cancel|abort)(\s|$)/i.test(label);
    const squareIconOnly =
      !/send|submit|generate|create|imagine|arrow-up|paper-plane/i.test(
        `${label} ${html}`,
      ) && /rect|square|stop/i.test(html);
    return nearComposer && (explicitStop || squareIconOnly);
  });
  const percentMatch = bodyText.match(/(?:Generating\s*)?(\d{1,3})\s*%/i);
  const hasProgressPercent = Boolean(
    percentMatch &&
    Number(percentMatch[1]) >= 0 &&
    Number(percentMatch[1]) <= 100,
  );
  const thinking =
    /Thinking|Thinking about your request|Đang suy nghĩ|Generating|Creating/i.test(
      tail,
    );
  return {
    ok: true,
    generating: Boolean(stopButton || hasProgressPercent || thinking),
    mode: stopButton
      ? "stop-button"
      : hasProgressPercent
        ? "progress-percent"
        : thinking
          ? "thinking-text"
          : "",
    stopText: stopButton?.text || "",
    progressPercent: hasProgressPercent ? Number(percentMatch[1]) : null,
    url: location.href,
    beforeUrl: before?.url || "",
    tailSnippet: tail.slice(-360),
  };
}

function detectGrokGenerationProblemScript() {
  const bodyText = document.body?.innerText || "";
  const tail = bodyText.slice(-5000);
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .map((node) => {
      const rect = node.getBoundingClientRect?.();
      const text =
        `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`.trim();
      return { rect, text };
    })
    .filter(
      (item) => item.rect && item.rect.width > 10 && item.rect.height > 10,
    );
  const retry = buttons.find((item) =>
    /(^|\s)(Retry|Try again|Thử lại|Gửi lại)(\s|$)/i.test(item.text),
  );
  const sendFailed =
    /couldn['’]?t send message|could not send message|message failed to send/i.test(
      tail,
    );
  const unable =
    /Grok was unable to finish replying|unable to finish replying|couldn'?t finish|Something went wrong|try again/i.test(
      tail,
    );
  const contentPolicy =
    /content policy|blocked by content policy|triggered moderation|cannot generate or retry|I cannot generate|adjust the prompt significantly|chặn.*content|vi phạm.*chính sách/i.test(
      tail,
    );
  const limit =
    /Video generation hiện đang gặp giới hạn|generation.*limit|rate limit|too many requests|limit được reset|quota|usage limit|come back later|try again later|temporarily unavailable|temporarily disabled|not available right now|something went wrong while generating|failed to generate|generation failed|couldn'?t generate|can'?t generate|unable to generate|error generating|please try again later|try again in|daily limit|monthly limit|usage cap|credits|insufficient/i.test(
      tail,
    );
  const loginRequired =
    /(^|\n)\s*(Log in|Sign in|Sign up|Đăng nhập|Get started)\s*($|\n)|continue with google|sign up for free/i.test(
      bodyText,
    ) &&
    !/SuperGrok|Imagine|Private|What do you want to know\?|Grok can make mistakes/i.test(
      bodyText,
    );
  return {
    ok: true,
    kind: loginRequired
      ? "login-required"
      : contentPolicy
        ? "content-policy"
        : limit
          ? "limit"
          : sendFailed
            ? "send-failed"
            : unable || retry
              ? "unable-finish"
              : "",
    reason: loginRequired ? "Grok page is showing login/sign-up controls." : "",
    sendFailed,
    unable,
    hasRetry: Boolean(retry),
    retryBox: retry?.rect
      ? {
          x: retry.rect.x,
          y: retry.rect.y,
          width: retry.rect.width,
          height: retry.rect.height,
        }
      : null,
    retryText: retry?.text || "",
    tailSnippet: tail.slice(-420),
  };
}

async function clickGrokRetryButton(client, state = null) {
  const current =
    state ||
    (await evaluateOnCdpPage(
      client,
      `(${detectGrokGenerationProblemScript.toString()})()`,
    ).catch(() => null));
  if (!current?.retryBox)
    return { ok: false, error: "Không thấy nút Retry Grok." };
  const x = current.retryBox.x + current.retryBox.width / 2;
  const y = current.retryBox.y + current.retryBox.height / 2;
  await client.Input.dispatchMouseEvent({
    type: "mouseMoved",
    x,
    y,
    button: "none",
  }).catch(() => null);
  await client.Input.dispatchMouseEvent({
    type: "mousePressed",
    x,
    y,
    button: "left",
    clickCount: 1,
  }).catch(() => null);
  await client.Input.dispatchMouseEvent({
    type: "mouseReleased",
    x,
    y,
    button: "left",
    clickCount: 1,
  }).catch(() => null);
  return {
    ok: true,
    mode: "clicked-retry",
    point: { x, y },
    retryText: current.retryText,
  };
}

function clickGrokGenerateScript() {
  const nodes = [...document.querySelectorAll('button, [role="button"]')];
  const input = document.activeElement;
  const button = nodes.find((item) => {
    if (item.disabled || item.getAttribute("aria-disabled") === "true")
      return false;
    const rect = item.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 20) return false;

    const inputRect = input?.getBoundingClientRect?.();
    const isNearInput =
      inputRect &&
      rect.top > inputRect.top - 80 &&
      rect.top < inputRect.bottom + 80 &&
      rect.left > inputRect.left - 40;
    const isComposerSubmit =
      rect.left > window.innerWidth * 0.72 &&
      rect.top > window.innerHeight * 0.72;
    if (!isNearInput && !isComposerSubmit) return false;

    const text =
      `${item.textContent || ""} ${item.getAttribute("aria-label") || ""} ${item.title || ""} ${item.dataset?.testid || ""}`.trim();
    if (
      /Agent\s*\(?Beta\)?|Create\s*Worlds|Historical\s*Stories|Short\s*Film|UGC\s*Product|^\s*(Image|Video|480p|720p|6s|10s)\s*$/i.test(
        text,
      )
    )
      return false;

    const html = item.innerHTML || "";
    const hasSendIcon = /arrow-up|send-icon|paper-plane/i.test(html);
    return (
      /^(Generate|Create|Start|Send|Submit|gửi|Imagine)$/i.test(text) ||
      (text === "" && hasSendIcon)
    );
  });
  if (!button) {
    const bottomRightSend = nodes
      .filter((item) => {
        if (item.disabled || item.getAttribute("aria-disabled") === "true")
          return false;
        const rect = item.getBoundingClientRect?.();
        if (!rect || rect.width < 24 || rect.height < 20) return false;
        const text =
          `${item.textContent || ""} ${item.getAttribute("aria-label") || ""} ${item.title || ""} ${item.dataset?.testid || ""}`.trim();
        if (/microphone|voice|audio|attach|add|upload|\+|new chat/i.test(text))
          return false;
        return (
          rect.left > window.innerWidth * 0.84 &&
          rect.top > window.innerHeight * 0.74
        );
      })
      .sort(
        (a, b) =>
          b.getBoundingClientRect().left - a.getBoundingClientRect().left,
      )[0];
    if (bottomRightSend) {
      bottomRightSend.scrollIntoView({ block: "center", inline: "center" });
      bottomRightSend.focus();
      const rect = bottomRightSend.getBoundingClientRect();
      return {
        ok: true,
        selector:
          bottomRightSend.textContent ||
          bottomRightSend.getAttribute("aria-label") ||
          "grok-bottom-right-send",
        box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    }
    if (input)
      return {
        ok: false,
        error: "send-button-missing-enter-fallback-disabled",
      };
    return {
      ok: false,
      error: "Không tìm thấy nút Generate/Create/Send Grok đang enabled.",
    };
  }
  button.scrollIntoView({ block: "center", inline: "center" });
  button.focus();
  const rect = button.getBoundingClientRect();
  return {
    ok: true,
    selector:
      button.textContent ||
      button.getAttribute("aria-label") ||
      "Grok generate",
    box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  };
}

function prepareChatGptCreateImageScript() {
  const textOf = (node) =>
    `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`.trim();
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 4 && rect.height > 4;
  };
  const clickNode = (node) => {
    node.scrollIntoView({ block: "center", inline: "center" });
    node.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    node.click();
    node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  };
  const plus = [...document.querySelectorAll('button, [role="button"]')]
    .filter(visible)
    .find(
      (node) =>
        /Add files and more|Attach|Add|\+/i.test(textOf(node)) ||
        (node.getBoundingClientRect().width <= 60 &&
          /svg|path/i.test(node.innerHTML || "")),
    );
  if (plus) clickNode(plus);
  const startedAt = Date.now();
  while (Date.now() - startedAt < 1500) {
    const createImage = [
      ...document.querySelectorAll(
        'button, [role="menuitem"], [role="option"], div, span',
      ),
    ]
      .filter(visible)
      .find((node) =>
        /Create image|Tạo ảnh|Generate image/i.test(textOf(node)),
      );
    if (createImage) {
      clickNode(createImage);
      return { ok: true, mode: "create-image-menu" };
    }
  }
  return {
    ok: Boolean(plus),
    mode: plus ? "plus-opened-no-create-image-item" : "no-plus-found",
  };
}

function clickPixVerseCreateScript() {
  const nodes = [...document.querySelectorAll('button, [role="button"]')];
  const createButton = nodes.find((button) => {
    if (button.disabled || button.getAttribute("aria-disabled") === "true")
      return false;
    const rect = button.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 24) return false;
    const text = `${button.textContent || ""} ${button.getAttribute("aria-label") || ""} ${button.title || ""}`;
    return /Create|Generate|Start/i.test(text);
  });
  if (!createButton)
    return {
      ok: false,
      error: "Không tìm thấy nút Create PixVerse đang enabled.",
    };
  createButton.scrollIntoView({ block: "center", inline: "center" });
  createButton.click();
  const rect = createButton.getBoundingClientRect();
  return {
    ok: true,
    selector:
      createButton.textContent ||
      createButton.getAttribute("aria-label") ||
      "Create",
    box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  };
}

function readLatestAssistantScript() {
  const bodyText = document.body?.innerText || "";
  const bodyTail = bodyText.slice(-4000);

  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    if (!rect || rect.width < 4 || rect.height < 4) return false;
    const style = window.getComputedStyle?.(node);
    return !(
      style &&
      (style.visibility === "hidden" ||
        style.display === "none" ||
        Number(style.opacity || 1) === 0)
    );
  };

  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .map((node) => {
      const rect = node.getBoundingClientRect?.();
      const text =
        `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`.trim();
      const html = String(node.innerHTML || "").slice(0, 1000);
      return { rect, text, html };
    })
    .filter((item) => item.rect && item.rect.width > 8 && item.rect.height > 8);

  const composerButtons = buttons.filter(
    (item) =>
      item.rect.top > window.innerHeight * 0.72 &&
      item.rect.left > window.innerWidth * 0.55,
  );
  const stopButton = composerButtons.some(
    (item) =>
      /stop|cancel|dừng/i.test(item.text) ||
      /<rect|data-icon=["']stop|stop-circle|square/i.test(item.html),
  );
  const voiceReady = composerButtons.some(
    (item) =>
      /voice|mic|microphone|record|dictate/i.test(item.text) ||
      /waveform|audio|voice|mic/i.test(item.html),
  );
  const sendReady =
    composerButtons.some(
      (item) =>
        !/stop|cancel|dung/i.test(item.text) &&
        /send|submit|gui|arrow-up|paper-plane|composer-submit/i.test(
          `${item.text} ${item.html}`,
        ),
    ) && !stopButton;

  const thinkingText =
    /Thinking about your request|Đang suy nghĩ|Generating|Creating/i.test(
      bodyTail,
    );
  const streamingIndicator =
    stopButton ||
    [
      ...document.querySelectorAll(
        '[aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"], [class*="result-streaming"]',
      ),
    ].some(visible);

  const selectors = [
    '[data-message-author-role="assistant"] .markdown',
    '[data-message-author-role="assistant"]',
    ".markdown",
    "article .markdown",
    'main [data-message-author-role="assistant"]',
    "article",
    ".message",
    '[class*="response"]',
  ];

  let text = "";
  let source = "empty";

  for (const selector of selectors) {
    const nodes = [...document.querySelectorAll(selector)]
      .filter(visible)
      .filter((node) => {
        if (node.closest?.('[data-message-author-role="user"]')) return false;
        if (node.querySelector?.('[data-message-author-role="user"]'))
          return false;

        const t = (node.innerText || "").trim();
        if (t.length <= 20) return false;
        if (
          /^NHIỆM\s*VỤ\s*1\s*:|^NHIỆM\s*VỤ\s*2\s*:|^---\s*SCENE|^Dựa trên ảnh keyframe|Show more/i.test(
            t,
          ) &&
          t.length < 300
        )
          return false;
        return true;
      });

    if (nodes.length > 0) {
      const lastNode = nodes.at(-1);
      const extractedText = (
        lastNode.innerText ||
        lastNode.textContent ||
        ""
      ).trim();
      if (extractedText.length > 20) {
        text = extractedText;
        source = selector;
        break;
      }
    }
  }

  if (!text) {
    const fallbackNodes = [
      ...document.querySelectorAll(
        '[data-message-author-role="assistant"], article',
      ),
    ]
      .filter(visible)
      .filter((node) => {
        if (node.closest?.('[data-message-author-role="user"]')) return false;
        const t = (node.innerText || "").trim();
        return t.length > 20;
      });
    if (fallbackNodes.length > 0) {
      text = fallbackNodes.at(-1).innerText.trim();
      source = "fallback-unfiltered";
    }
  }

  const generating = sendReady
    ? false
    : stopButton || (thinkingText && !voiceReady);

  return {
    count:
      document.querySelectorAll('[data-message-author-role="assistant"]')
        .length || 1,
    text,
    textLength: text.length,
    source,
    generating,
    generation: false,
    streamingIndicator,
    stopButton,
    sendReady,
    voiceReady,
    composerButtonCount: buttons.length,
    mode: source,
  };
}

function readAssistantAfterIndexScript(minCount = 0) {
  const startIndex = Math.max(0, Number(minCount || 0));
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    if (!rect || rect.width < 4 || rect.height < 4) return false;
    const style = window.getComputedStyle?.(node);
    return !(
      style &&
      (style.visibility === "hidden" ||
        style.display === "none" ||
        Number(style.opacity || 1) === 0)
    );
  };

  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .map((node) => {
      const rect = node.getBoundingClientRect?.();
      const text =
        `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`.trim();
      const html = String(node.innerHTML || "").slice(0, 1000);
      return { rect, text, html };
    })
    .filter((item) => item.rect && item.rect.width > 8 && item.rect.height > 8);
  const composerButtons = buttons.filter(
    (item) =>
      item.rect.top > window.innerHeight * 0.72 &&
      item.rect.left > window.innerWidth * 0.55,
  );
  const stopButton = composerButtons.some(
    (item) =>
      /stop|cancel|dá»«ng/i.test(item.text) ||
      /<rect|data-icon=["']stop|stop-circle|square/i.test(item.html),
  );
  const voiceReady = composerButtons.some(
    (item) =>
      /voice|mic|microphone|record|dictate/i.test(item.text) ||
      /waveform|audio|voice|mic/i.test(item.html),
  );
  const sendReady =
    composerButtons.some(
      (item) =>
        !/stop|cancel|dung/i.test(item.text) &&
        /send|submit|gui|arrow-up|paper-plane|composer-submit/i.test(
          `${item.text} ${item.html}`,
        ),
    ) && !stopButton;
  const bodyTail = String(document.body?.innerText || "").slice(-4000);
  const thinkingText =
    /Thinking about your request|Äang suy nghÄ©|Generating|Creating/i.test(
      bodyTail,
    );
  const streamingIndicator =
    stopButton ||
    [
      ...document.querySelectorAll(
        '[aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"], [class*="result-streaming"]',
      ),
    ].some(visible);
  const assistantNodes = [
    ...document.querySelectorAll('[data-message-author-role="assistant"]'),
  ].filter(visible);
  const newNodes = assistantNodes.slice(startIndex);
  const node = newNodes.at(-1) || null;
  const text = node
    ? String(node.innerText || node.textContent || "").trim()
    : "";
  const generating = sendReady
    ? false
    : stopButton || (thinkingText && !voiceReady);

  return {
    count: assistantNodes.length,
    minCount: startIndex,
    newCount: newNodes.length,
    index: node ? startIndex + newNodes.length - 1 : -1,
    text,
    textLength: text.length,
    source: "assistant-role-after-index",
    hasNewAssistant: newNodes.length > 0,
    generating,
    generation: false,
    streamingIndicator,
    stopButton,
    sendReady,
    voiceReady,
    composerButtonCount: buttons.length,
    mode: "assistant-role-after-index",
  };
}

function readAssistantMessageSnapshotScript() {
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    if (!rect || rect.width < 4 || rect.height < 4) return false;
    const style = window.getComputedStyle?.(node);
    return !(
      style &&
      (style.visibility === "hidden" ||
        style.display === "none" ||
        Number(style.opacity || 1) === 0)
    );
  };
  const hashText = (value = "") => {
    const text = String(value || "")
      .replace(/\s+/g, " ")
      .trim();
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  };
  const readStableId = (node) => {
    const candidates = [
      node.getAttribute?.("data-message-id"),
      node.getAttribute?.("data-testid"),
      node.id,
      node.closest?.("[data-message-id]")?.getAttribute?.("data-message-id"),
      node.closest?.("[data-testid]")?.getAttribute?.("data-testid"),
      node.closest?.("article")?.getAttribute?.("data-message-id"),
      node.closest?.("article")?.id,
    ];
    return String(candidates.find(Boolean) || "").trim();
  };
  const readAssistantText = (node) => {
    const contentSelectors = [
      '[data-message-author-role="assistant"] [data-message-id]',
      ".markdown",
      '[class*="markdown"]',
      '[data-testid*="markdown"]',
      '[class*="prose"]',
      'div[dir="auto"]',
      "p",
      "li",
      "pre",
      "code",
    ];
    const pieces = [];
    for (const selector of contentSelectors) {
      for (const child of [...(node.querySelectorAll?.(selector) || [])].filter(
        visible,
      )) {
        const text = String(child.innerText || child.textContent || "").trim();
        if (text && !pieces.includes(text)) pieces.push(text);
      }
      if (pieces.join("\n").trim().length > 20) break;
    }
    return (
      pieces.join("\n").trim() ||
      String(node.innerText || node.textContent || "").trim()
    );
  };
  const roleNodes = [...document.querySelectorAll("[data-message-author-role]")]
    .filter(visible)
    .map((node, turnIndex) => {
      const role = String(
        node.getAttribute?.("data-message-author-role") || "",
      ).trim();
      return { node, role, turnIndex };
    });
  const userMessages = roleNodes
    .filter((entry) => entry.role === "user")
    .map((entry, index) => {
      const text = String(
        entry.node.innerText || entry.node.textContent || "",
      ).trim();
      return {
        index,
        turnIndex: entry.turnIndex,
        id: readStableId(entry.node),
        text,
        textLength: text.length,
        hash: hashText(text),
      };
    });
  const messages = roleNodes
    .filter((entry) => entry.role === "assistant")
    .map((entry, index) => {
      const node = entry.node;
      const text = readAssistantText(node);
      return {
        index,
        turnIndex: entry.turnIndex,
        id: readStableId(node),
        text,
        textLength: text.length,
        hash: hashText(text),
      };
    });
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .map((node) => {
      const rect = node.getBoundingClientRect?.();
      const text =
        `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""} ${node.getAttribute?.("data-testid") || ""}`.trim();
      const html = String(node.innerHTML || "").slice(0, 1000);
      return { rect, text, html };
    })
    .filter((item) => item.rect && item.rect.width > 8 && item.rect.height > 8);
  const composerButtons = buttons.filter(
    (item) =>
      item.rect.top > window.innerHeight * 0.58 &&
      item.rect.left > window.innerWidth * 0.45,
  );
  const stopVisible = composerButtons.some(
    (item) =>
      /stop generating|stop responding|stop|cancel|dá»«ng/i.test(item.text) ||
      /<rect|data-icon=["']stop|stop-circle|square/i.test(item.html),
  );
  const sendReady =
    composerButtons.some(
      (item) =>
        !/stop generating|stop responding|stop|cancel|dung/i.test(item.text) &&
        /send|submit|gui|arrow-up|paper-plane|composer-submit/i.test(
          `${item.text} ${item.html}`,
        ),
    ) && !stopVisible;
  const streamingIndicator = [
    ...document.querySelectorAll(
      '[aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"], [class*="result-streaming"]',
    ),
  ].some(visible);
  const composerBusy = [
    ...document.querySelectorAll(
      'main form textarea, [contenteditable="true"], #prompt-textarea, [role="textbox"], [data-testid="composer"]',
    ),
  ]
    .filter(visible)
    .some((node) => {
      const form = node.closest?.("form");
      return (
        node.disabled ||
        node.getAttribute?.("aria-disabled") === "true" ||
        node.getAttribute?.("aria-busy") === "true" ||
        form?.getAttribute?.("aria-busy") === "true" ||
        form?.className?.toString?.().match?.(/busy|disabled|loading/i)
      );
    });
  const activeGenerationMarker = [
    ...document.querySelectorAll(
      '[data-testid*="composer"] [aria-busy="true"], main form [aria-busy="true"], [class*="streaming"], [data-is-streaming="true"]',
    ),
  ].some(visible);
  return {
    ok: true,
    url: location.href,
    count: messages.length,
    userCount: userMessages.length,
    maxTurnIndex: roleNodes.length ? roleNodes.at(-1).turnIndex : -1,
    ids: messages.map((message) => message.id).filter(Boolean),
    hashes: messages.map((message) => message.hash).filter(Boolean),
    userIds: userMessages.map((message) => message.id).filter(Boolean),
    userHashes: userMessages.map((message) => message.hash).filter(Boolean),
    userMessages,
    latestUserTurnIndex: userMessages.at(-1)?.turnIndex ?? -1,
    stopVisible,
    composerBusy,
    streamingIndicator,
    activeGenerationMarker,
    generationActive: Boolean(
      composerBusy || streamingIndicator || activeGenerationMarker,
    ),
    sendReady,
    messages,
  };
}

function findChatGptConversationScript(title = "") {
  const wanted = String(title || "")
    .trim()
    .toLowerCase();
  if (!wanted) return { ok: true, skipped: true };
  const normalize = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  const candidates = [
    ...document.querySelectorAll(
      'nav a, aside a, [role="navigation"] a, a[href*="/c/"], button',
    ),
  ]
    .map((node) => {
      const text = normalize(
        node.innerText ||
          node.textContent ||
          node.getAttribute("aria-label") ||
          node.title ||
          "",
      );
      const rect = node.getBoundingClientRect?.();
      return { node, text, rect };
    })
    .filter(
      (item) =>
        item.text && item.rect && item.rect.width > 20 && item.rect.height > 10,
    )
    .filter(
      (item) =>
        item.text === wanted ||
        item.text.includes(wanted) ||
        wanted.includes(item.text),
    );
  const best = candidates[0];
  if (!best)
    return {
      ok: false,
      error: `Không thấy chat "${title}"`,
      sample: [...document.querySelectorAll('nav a, aside a, a[href*="/c/"]')]
        .slice(0, 20)
        .map((node) => (node.innerText || node.textContent || "").trim())
        .filter(Boolean),
    };
  best.node.scrollIntoView({ block: "center" });
  const rect = best.node.getBoundingClientRect();
  return {
    ok: true,
    title: best.text,
    box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  };
}

async function runVeoUpScriptAsPromise(
  coords = {},
  projectPath = "",
  scenes = [],
  options = {},
) {
  const runId = String(options.runId || getScopedPipelineRunId() || "").trim();
  assertPipelineRunActive(runId);
  const result = await executeVeoUpAutomation({
    projectName: options.projectName || "project",
    outputFolder: projectPath,
    scenes,
    maximizeBeforeAutomation: true,
    autoStartVideoGeneration: Boolean(
      options.autoStartVideoGeneration || options.autoStartVeoUpGeneration,
    ),
    userDataDir: app.getPath("userData"),
    runId,
    isCancelled: () => isPipelineRunCancelled(runId),
    registerChildProcess: (child) => trackPipelineChildProcess(child, runId),
    ...coords,
  });
  assertPipelineRunActive(runId);

  if (!result || !result.ok) {
    const error = new Error(
      result?.error ||
        result?.status ||
        "VeoUp automation returned non-ok status",
    );
    error.status = result?.status || result?.error || "veoup-automation-failed";
    error.details = result || {};
    throw error;
  }
  return result;
}

async function runVeoUpAutomation(_event, payload = {}) {
  try {
    const runId = String(
      payload?.runId || getScopedPipelineRunId() || "",
    ).trim();
    if (runId) pipelineCancellation.activeRunIds.add(runId);
    assertPipelineRunActive(runId);
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: "VeoUp automation: starting after completed Vidora pipeline.",
      details: {
        outputFolder: payload?.outputFolder || "",
        projectName: payload?.projectName || "",
      },
    }).catch(() => null);

    const result = await executeVeoUpAutomation({
      ...payload,
      runId,
      isCancelled: () => isPipelineRunCancelled(runId),
      registerChildProcess: (child) => trackPipelineChildProcess(child, runId),
      userDataDir: app.getPath("userData"),
      maximizeBeforeAutomation: true,
    });
    assertPipelineRunActive(runId);

    if (!result || !result.ok) {
      throw new Error(result?.error || "VeoUp automation failed");
    }

    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: `VeoUp automation: loaded ${result.imageCount || 0} keyframes and ${result.promptLineCount || 0} prompts.`,
      details: result,
    }).catch(() => null);

    if (runId) pipelineCancellation.activeRunIds.delete(runId);
    return result;
  } catch (error) {
    if (isPipelineCancelledError(error)) {
      const runId = String(
        payload?.runId || getScopedPipelineRunId() || "",
      ).trim();
      if (runId) pipelineCancellation.activeRunIds.delete(runId);
      return {
        ok: false,
        cancelled: true,
        error: error.message,
        code: error.code,
      };
    }
    const runId = String(
      payload?.runId || getScopedPipelineRunId() || "",
    ).trim();
    if (runId) pipelineCancellation.activeRunIds.delete(runId);
    console.error("[VeoUp Automation Main] Exception occurred:", error);
    if (typeof appendAppLog === "function") {
      await appendAppLog(
        globalThis.__vidoraCurrentActiveSceneId || 0,
        "error",
        "VeoUp automation sequence encountered a runtime exception",
        {
          errorMessage: error?.message || String(error),
          errorStack: error?.stack || "",
        },
      ).catch(() => null);
    }
    throw error;
  }
}

async function exportProject(_event, payload) {
  const result = await dialog.showSaveDialog({
    title: "Export project JSON",
    defaultPath: `${sanitizeFileName(payload?.project?.name || "ai-scene-project")}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  const jsonPath = result.filePath;
  const csvPath = jsonPath.replace(/\.json$/i, ".csv");
  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  if (payload?.csv) {
    await fs.writeFile(csvPath, payload.csv, "utf8");
  }
  return { jsonPath, csvPath };
}



process.on("uncaughtException", (error) => {
  writeCrashLog("main:uncaughtException", error);
});

process.on("unhandledRejection", (reason) => {
  writeCrashLog(
    "main:unhandledRejection",
    reason instanceof Error ? reason : new Error(String(reason)),
  );
});

app.on("render-process-gone", (_event, webContents, details) => {
  writeCrashLog(
    "electron:render-process-gone",
    new Error(details?.reason || "render-process-gone"),
    {
      reason: details?.reason,
      exitCode: details?.exitCode,
      url: webContents?.getURL?.(),
    },
  );
});

app.on("child-process-gone", (_event, details) => {
  writeCrashLog(
    "electron:child-process-gone",
    new Error(details?.reason || "child-process-gone"),
    details || {},
  );
});

app.on("gpu-process-crashed", (_event, killed) => {
  writeCrashLog(
    "electron:gpu-process-crashed",
    new Error("gpu-process-crashed"),
    { killed },
  );
});


process.on("exit", (code) => {
  try {
    console.log("[VidoraProcessExit]", code);
  } catch (_) {}
});

process.on("beforeExit", (code) => {
  try {
    console.log("[VidoraProcessBeforeExit]", code);
  } catch (_) {}
});

app.on("before-quit", (event) => {
  vidoraTraceExit("app:before-quit", { exitCode: process.exitCode || 0 });
});

app.on("will-quit", (event) => {
  vidoraTraceExit("app:will-quit", { exitCode: process.exitCode || 0 });
});

app.on("quit", (_event, exitCode) => {
  vidoraTraceExit("app:quit", { exitCode });
});

app.on("window-all-closed", () => {
  vidoraTraceExit("app:window-all-closed", { note: "all windows closed" });
});

app.on("browser-window-created", (_event, win) => {
  try {
    win.on("closed", () =>
      vidoraTraceExit("browser-window:closed", {
        title: win.getTitle?.() || "",
      }),
    );
    win.webContents.on("render-process-gone", (_event2, details) => {
      vidoraTraceExit("webContents:render-process-gone", details || {});
    });
    win.webContents.on("unresponsive", () => {
      vidoraTraceExit("webContents:unresponsive", {
        title: win.getTitle?.() || "",
      });
    });
  } catch (_) {}
});

async function getVeoUpCoordinateConfigHandler() {
  return getVeoUpCoordinateConfig(app.getPath("userData"));
}

async function startVeoUpCoordinateSetupHandler(_event, payload = {}) {
  return startCoordinateSetup({
    ...payload,
    userDataDir: app.getPath("userData"),
  });
}

async function captureVeoUpCoordinateHandler(_event, pointType) {
  return captureVeoUpCoordinate(pointType, app.getPath("userData"));
}

async function saveVeoUpCoordinateConfigHandler(_event, config) {
  return saveVeoUpCoordinateConfig(app.getPath("userData"), config);
}

async function deleteVeoUpCoordinateConfigHandler(_event, payload = {}) {
  return deleteVeoUpCoordinateConfig({
    ...payload,
    userDataDir: app.getPath("userData"),
  });
}

async function cancelVeoUpCoordinateSetupHandler() {
  return cancelCoordinateSetup();
}

async function scanProjectAndRunVeoUpHandler(_event, payload = {}) {
  const projectDir = payload.projectDir;
  if (!projectDir) {
    return { ok: false, error: "Chưa chọn folder project." };
  }

  const check = await checkIfAllScenesComplete(projectDir);
  if (!check.complete) {
    await appendAppLog(null, {
      source: "main",
      kind: "warn",
      text: "Không tìm thấy bất kỳ scene nào có đủ cặp ảnh + prompt để nạp.",
    });
    return {
      ok: false,
      error: "Không tìm thấy bất kỳ scene nào có đủ cặp ảnh + prompt để nạp.",
    };
  }

  try {
    await buildVeoUpPromptsReadyFile({
      projectDir,
      sceneDirs: check.sceneDirs,
      expectedSceneCount: check.sceneDirs.length,
    });

    const scenes = [];
    for (const dir of check.sceneDirs) {
      const id = parseInt(path.basename(dir).match(/\d+/)[0], 10);
      const keyframePath = await findSceneKeyframePathSafe(dir, id);
      scenes.push({
        id,
        imagePath: keyframePath,
        keyframeOutputPath: keyframePath,
        motionPromptPath: path.join(dir, "motion_prompt.txt"),
      });
    }

    const config = await getVeoUpCoordinateConfig(
      app.getPath("userData"),
    ).catch(() => ({}));
    const res = await runVeoUpScriptAsPromise(config, projectDir, scenes, {
      projectName: payload.projectName || path.basename(projectDir),
      autoStartVideoGeneration: true,
    });

    return {
      ok: true,
      imageCount: scenes.length,
      promptLineCount: scenes.length,
      ...res,
    };
  } catch (err) {
    console.error("[scanProjectAndRunVeoUpHandler] Failed:", err);
    return { ok: false, error: err.message || String(err) };
  }
}

app.whenReady().then(() => {
  ipcMain.handle(
    "veoup:get-coordinate-config",
    safeIpcHandler(getVeoUpCoordinateConfigHandler),
  );
  ipcMain.handle(
    "veoup:start-coordinate-setup",
    safeIpcHandler(startVeoUpCoordinateSetupHandler),
  );
  ipcMain.handle(
    "veoup:capture-coordinate",
    safeIpcHandler(captureVeoUpCoordinateHandler),
  );
  ipcMain.handle(
    "veoup:delete-coordinate-config",
    safeIpcHandler(deleteVeoUpCoordinateConfigHandler),
  );
  ipcMain.handle(
    "veoup:save-coordinate-config",
    safeIpcHandler(saveVeoUpCoordinateConfigHandler),
  );
  ipcMain.handle(
    "veoup:cancel-coordinate-setup",
    safeIpcHandler(cancelVeoUpCoordinateSetupHandler),
  );
  ipcMain.handle(
    "veoup:scan-project-and-run",
    safeIpcHandler(scanProjectAndRunVeoUpHandler),
  );

  ipcMain.handle("app:append-log", appendAppLog);
  ipcMain.handle("app:get-log-path", getAppLogPath);
  ipcMain.handle("prompt:open-hard-file", openHardPromptFile);
  ipcMain.handle("prompt:get-hard-file", getHardPromptFileInfo);
  ipcMain.handle("prompt:choose-hard-file", chooseHardPromptFile);
  ipcMain.handle("router:open-grok-folder", openGrokRouterFolder);
  ipcMain.handle("router:get-status", getGrokRouterStatus);
  ipcMain.handle("router:list-accounts-safe", listGrokAccountsSafe);
  ipcMain.handle("router:select-account", selectGrokAccount);
  ipcMain.handle("router:set-enabled", setAccountRouterEnabled);
  ipcMain.handle("router:resume-checkpoint", resumeFromRouterCheckpoint);
  ipcMain.handle("accounts:list-safe", listWebAccountsSafe);
  ipcMain.handle("accounts:save", saveWebAccount);
  ipcMain.handle("accounts:delete", deleteWebAccount);
  ipcMain.handle("view:get-pipeline-log-visible", getPipelineLogVisibility);
  ipcMain.handle("browser:open-login", openWebLogin);
  ipcMain.handle("browser:check-login", checkWebLogin);
  ipcMain.handle("browser:send-prompt", sendPromptViaWeb);
  ipcMain.handle("pipeline:run-scene", safeIpcHandler(runScenePipeline));
  ipcMain.handle('pipeline:stop', safeIpcHandler(stopPipeline));
  ipcMain.handle("output:choose-folder", chooseOutputFolder);
  ipcMain.handle("project:choose-root-folder", chooseProjectRootFolder);
  ipcMain.handle("folder:choose", chooseFolder);
  ipcMain.handle("folder:scan", scanFolder);
  ipcMain.handle("video:extract-last-frame", extractLastFrame);
  ipcMain.handle(
    "video:extract-last-frame-to-path",
    safeIpcHandler(extractLastFrameToPathHandler),
  );
  ipcMain.handle("video:merge", mergeVideos);
  ipcMain.handle("video:export-final", exportFinalVideo);
  ipcMain.handle("image:copy-to-clipboard", copyImageToClipboard);
  ipcMain.handle("asset:exists", checkAssetExists);
  ipcMain.handle("asset:stat", getAssetStat);
  ipcMain.handle("frame:get-previous", getPreviousFrame);
  ipcMain.handle("ai:split-prompt", splitPromptWithAI);
  ipcMain.handle("ai:generate-scene-prompts", generateScenePrompts);
  ipcMain.handle(
    "chatgpt:rename-current-chat",
    renameChatGptCurrentConversation,
  );
  ipcMain.handle("project:export", exportProject);
  ipcMain.handle("project:new-session", newProjectSession);
  ipcMain.handle("project:save-session-file", saveProjectSessionFile);
  ipcMain.handle("project:overwrite-session-file", overwriteProjectSessionFile);
  ipcMain.handle("project:create-session-file", createProjectSessionFile);
  ipcMain.handle("project:open-session-file", openProjectSessionFile);
  ipcMain.handle("project:ensure-scene-folders", ensureProjectSceneFolders);
  ipcMain.handle(
    "project:import-character-presets",
    safeIpcHandler(importCharacterPresetsHandler),
  );
  ipcMain.handle("veoup:run-automation", safeIpcHandler(runVeoUpAutomation));

  ensureAndMigratePrompts().catch((error) => {
    appendAppLog(null, {
      source: "main",
      kind: "error",
      text: `promptFile: startup migration and validation failed`,
      details: { error: error.message },
    }).catch(() => null);
  });

  app.on("web-contents-created", (event, contents) => {
    appendAppLog(null, {
      source: "main",
      kind: "info",
      text: `[ELECTRON EVENT] WebContents created, id=${contents.id}, url=${contents.getURL()}`,
    }).catch(() => null);

    const originalReload = contents.reload;
    contents.reload = function () {
      const stack = new Error().stack || "";
      const timestamp = new Date().toISOString();
      const currentSceneId = globalThis.__vidoraLastProcessedSceneId || "unknown";
      const sendState = getChatGptSendState(currentSceneId);

      const blockedReason = isReloadBlocked(currentSceneId);
      if (blockedReason) {
        appendAppLog(currentSceneId, {
          source: "main",
          kind: "warning",
          text: `CHATGPT_RELOAD_BLOCKED: webContents.reload() canceled. ${blockedReason}`,
          details: { stack }
        }).catch(() => null);
        return;
      }

      appendAppLog(currentSceneId, {
        source: "main",
        kind: "warning",
        text: `CHATGPT_RELOAD_REQUESTED`,
        details: {
          timestamp,
          sceneId: currentSceneId,
          stage: sendState,
          reason: `webContents.reload() called for WebContents id=${contents.id}`,
          caller: "Electron webContents",
          stack
        },
      }).catch(() => null);

      if (sendState === "PREPARING" || sendState === "READY" || sendState === "CLICKING") {
        appendAppLog(currentSceneId, {
          source: "main",
          kind: "error",
          text: `RELOAD_BEFORE_SEND: webContents.reload() requested before SEND_CLICK_BEGIN! State = ${sendState}`,
          details: { stack },
        }).catch(() => null);
      }

      return originalReload.apply(this, arguments);
    };

    const originalReloadIgnoringCache = contents.reloadIgnoringCache;
    contents.reloadIgnoringCache = function () {
      const stack = new Error().stack || "";
      const timestamp = new Date().toISOString();
      const currentSceneId = globalThis.__vidoraLastProcessedSceneId || "unknown";
      const sendState = getChatGptSendState(currentSceneId);

      const blockedReason = isReloadBlocked(currentSceneId);
      if (blockedReason) {
        appendAppLog(currentSceneId, {
          source: "main",
          kind: "warning",
          text: `CHATGPT_RELOAD_BLOCKED: webContents.reloadIgnoringCache() canceled. ${blockedReason}`,
          details: { stack }
        }).catch(() => null);
        return;
      }

      appendAppLog(currentSceneId, {
        source: "main",
        kind: "warning",
        text: `CHATGPT_RELOAD_REQUESTED`,
        details: {
          timestamp,
          sceneId: currentSceneId,
          stage: sendState,
          reason: `webContents.reloadIgnoringCache() called for WebContents id=${contents.id}`,
          caller: "Electron webContents",
          stack
        },
      }).catch(() => null);

      if (sendState === "PREPARING" || sendState === "READY" || sendState === "CLICKING") {
        appendAppLog(currentSceneId, {
          source: "main",
          kind: "error",
          text: `RELOAD_BEFORE_SEND: webContents.reloadIgnoringCache() requested before SEND_CLICK_BEGIN! State = ${sendState}`,
          details: { stack },
        }).catch(() => null);
      }

      return originalReloadIgnoringCache.apply(this, arguments);
    };

    contents.on("render-process-gone", (e, details) => {
      appendAppLog(null, {
        source: "main",
        kind: "error",
        text: `CHATGPT_RENDERER_CRASH: WebContents id=${contents.id} render-process-gone: reason=${details?.reason || "unknown"}, exitCode=${details?.exitCode || 0}`,
        details: { details, isOom: details?.reason === "oom" || details?.reason === "out-of-memory" },
      }).catch(() => null);
    });

    contents.on("unresponsive", () => {
      appendAppLog(null, {
        source: "main",
        kind: "error",
        text: `[ELECTRON EVENT] WebContents id=${contents.id} unresponsive`,
      }).catch(() => null);
    });

    contents.on("crashed", (e, killed) => {
      appendAppLog(null, {
        source: "main",
        kind: "error",
        text: `CHATGPT_RENDERER_CRASH: WebContents id=${contents.id} crashed (killed=${killed})`,
      }).catch(() => null);
    });

    contents.on("did-fail-load", (e, errorCode, errorDescription, validatedURL, isMainFrame) => {
      appendAppLog(null, {
        source: "main",
        kind: "error",
        text: `CHATGPT_RENDERER_CRASH: WebContents id=${contents.id} did-fail-load: errorCode=${errorCode}, desc=${errorDescription}, url=${validatedURL}, mainFrame=${isMainFrame}`,
      }).catch(() => null);
    });

    contents.on("did-start-loading", () => {
      appendAppLog(null, {
        source: "main",
        kind: "info",
        text: `[ELECTRON EVENT] WebContents id=${contents.id} did-start-loading`,
      }).catch(() => null);
    });

    contents.on("did-stop-loading", () => {
      appendAppLog(null, {
        source: "main",
        kind: "info",
        text: `[ELECTRON EVENT] WebContents id=${contents.id} did-stop-loading`,
      }).catch(() => null);
    });
  });

  buildAppMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  writeCrashLog("electron:window-all-closed", new Error("All windows closed"), {
    note: "App kept alive for crash debugging.",
  });
  if (process.platform !== "darwin") {
    // Trong lúc debug pipeline, không quit im lặng. Người dùng có thể Ctrl+C ở terminal.
    return;
  }
});

app.on("before-quit", () => {
  closeChromeDebug().catch(() => null);
});

process.on("exit", () => {
  if (chromeProcess?.pid) {
    try {
      process.kill(chromeProcess.pid);
    } catch (_error) {}
  }
});
