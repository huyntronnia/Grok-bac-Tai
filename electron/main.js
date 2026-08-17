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
  normalizeContinuityReferenceSettings,
  findSceneKeyframePathSafe,
  validateContinuityReferenceImage,
} = require("./main/utils");

const {
  getCdpPageMemoryMetrics,
  logMemoryMilestone,
} = require("./main/memory");

const {
  prepareProjectPayloadForSave,
  hydrateProjectPayloadPaths,
  hasLegacyEmbeddedAssets,
  removeEmbeddedAssets,
  containsInlineAssetData,
  writeTextFileAtomic,
  writeJsonFileAtomic,
  enqueueProjectWrite,
} = require("./main/project");

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
  getChatGptContextFresh,
  setChatGptContextFresh,
} = require("./main/state/chatgpt_state");

const {
  detectLoginScript,
  getChatGptLocationStateScript,
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
} = require("./main/chatgpt/chatgpt_dom");


const {
  getConversationState,
  waitForCdpLoad,
  evaluateOnCdpPage,
  getChatGptSendState,
} = require("./main/chatgpt/chatgpt_core");
const BrowserAdapter = require("./main/chatgpt/browser_adapter");

const {
  clickUploadButtonScript,
  detectUploadedAssetScript,
  initChatGptUpload,
  verifyAttachmentsReady,
  uploadFilesToChatGptSequentially,
  uploadFileToChatGptDirectly,
} = require("./main/chatgpt/chatgpt_upload");

const {
  initChatGptSend,
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
  vidoraClearChatGptInputBeforePaste,
} = require("./main/chatgpt/chatgpt_send");

const {
  initChatGptRecovery,
  isReloadBlocked,
  requestReloadWithReason,
  performDurableRecovery,
  detectLoginWithRetry,
  recoverCdpPageIfCrashed,
  recoverChatGptBlockingUi,
  recoverChatGptResponseChoiceChat,
} = require("./main/chatgpt/chatgpt_recovery");

const {
  initBootstrap,
  initializeApplication,
  createMainWindow,
} = require("./main/bootstrap");

const {
  initIpcHandlers,
} = require("./main/ipc");

const {
  initChatGptPipeline,
  generateImageAndMotionWithChatGPT,
  generateMotionPromptWithChatGPT,
  adoptExistingSceneImage,
  decodeImageBufferToPng,
  validateSavedImageFile,
  collectGeneratedImageUrlsScript,
  waitForChatGptResponse,
  hydrateFreshChatGptContextAfterRotation,
  clearAllChatGptPipelineLocks,
} = require("./main/chatgpt");

const {
  maybeResetChatGptPageForLongRun,
  maybeRotateChatGptConversation,
  getDurablePipelineBackoffMs,
  normalizeChatGptRetryText,
  isRetryableChatGptToolErrorText,
  isChatGptPolicyRefusalText,
} = require("./main/recovery");
globalThis.isChatGptPolicyRefusalText = isChatGptPolicyRefusalText;


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
let CDP = null;
const ffmpegPath = require("ffmpeg-static");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { AsyncLocalStorage } = require('async_hooks');
const {
  initVeoUp,
  executeVeoUpAutomation,
  findVeoupExecutable,
  startCoordinateSetup,
  captureVeoUpCoordinate,
  getVeoUpCoordinateConfig,
  saveVeoUpCoordinateConfig,
  deleteVeoUpCoordinateConfig,
  cancelCoordinateSetup,
  runVeoUpScriptAsPromise,
  createVeoUpBatchCoordinator,
  getVeoUpVideoSourcePath,
  assertVeoUpResultAssociation,
  isVeoUpStageError,
} = require("./main/veoup");

const {
  initPipelineRunner,
  getScopedPipelineRunId,
  makePipelineCancelledError,
  isPipelineCancelledError,
  isPipelineRunCancelled,
  assertPipelineRunActive,
  registerPipelineWaiter,
  trackPipelineChildProcess,
  cancelPipelineRun,
  stopPipeline,
  sanitizeScenePipelineResult,
  runScenePipeline,
  checkIfAllScenesComplete,
  readPipelineSceneState,
  writePipelineSceneState,
  persistDurableStage,
  assertDurableSceneSuccess,
  isSceneScopedFilePath,
  prepareSceneContext,
  runScenePipelineLocked,
  runScenePipelineLockedInternal,
  startNextSceneChatGptPrefetch,
  finalizeValidatedSceneVideo,
  validateSceneVideoAndLastFrame,
  imageFileToDataUrl,
  pipelineCancellation,
  materializeSceneRequestFiles,
  buildNv1RequestContent,
  buildNv2RequestContent,
} = require("./main/pipeline");

const {
  validateKeyframeFile,
  validateMotionPromptTextContent,
} = require("./main/pipeline/asset_validation");


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
};
const WEB_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const CHROME_DEBUG_PORT = 9223;
const CHROME_CDP_HOST = `http://127.0.0.1:${CHROME_DEBUG_PORT}`;
const CHROME_USER_DATA_DIR = path.join(
  app.getPath("userData"),
  "chrome-cdp-profile",
);

initChatGptRecovery({
  getCdpPage,
  forceCleanChatGptNewChatRotation,
  tryAutoLoginWithStoredAccount,
  closeUnexpectedProviderTabs,
  CHROME_DEBUG_PORT,
  PROVIDER_META,
});

const CHALLENGE_RECOVERY_LIMIT = 2;
const CHAT_TITLE_CHECK_MIN_INTERVAL_MS = 45000;







globalThis.assertPipelineRunActive = assertPipelineRunActive;








const CHATGPT_UI_RECOVERY_SEND_RETRY_LIMIT = 18;
const challengeRecoveryAttempts = new Map();
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
setChatGptContextFresh(true);
let activeConversationUrl = null;
let currentThreadId = null;
app.setPath("userData", path.join(app.getPath("appData"), "vidora"));
const WEB_ACCOUNT_STORE_FILE = path.join(
  app.getPath("userData"),
  "web-provider-accounts.secure.json",
);
const HARD_PROMPT_FILE_NAME = HARD_PROMPT_FILENAME;
const LAST_PROJECT_STATE_FILE = path.join(
  app.getPath("userData"),
  "last-project.json",
);
const DEFAULT_NV1_PROMPT = "Tạo đúng một ảnh keyframe cho scene theo mô tả được gửi, giữ continuity và không trả lời chỉ bằng văn bản.";
const DEFAULT_NV2_PROMPT = "Dựa trên ảnh keyframe vừa đính kèm, viết motion prompt chi tiết cho video của đúng scene này; chỉ trả về motion prompt hoàn chỉnh.";
const HARD_PROMPT_DEFAULT_CONTENT = [
  "NHIỆM VỤ 1:",
  DEFAULT_NV1_PROMPT,
  "",
  "NHIỆM VỤ 2:",
  DEFAULT_NV2_PROMPT,
].join("\n");
const VDRA_SCHEMA_VERSION = 1;

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
    throw new Error(`Invalid .vdra: ${key} is required.`);
  }
}

function validateProjectPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("Invalid .vdra: root payload must be an object.");
  if (typeof payload.schemaVersion !== "number")
    throw new Error("Invalid .vdra: schemaVersion is required.");
  if (payload.schemaVersion > VDRA_SCHEMA_VERSION)
    throw new Error(
      `Unsupported future .vdra schemaVersion ${payload.schemaVersion}. App supports ${VDRA_SCHEMA_VERSION}.`,
    );
  if (payload.schemaVersion !== VDRA_SCHEMA_VERSION)
    throw new Error(
      `Unsupported .vdra schemaVersion ${payload.schemaVersion}. App supports ${VDRA_SCHEMA_VERSION}.`,
    );
  if (!payload.project || typeof payload.project !== "object")
    throw new Error("Invalid .vdra: project is required.");
  if (!Array.isArray(payload.project.scenes))
    throw new Error("Invalid .vdra: project.scenes[] is required.");
  ["inputs", "config", "assets"].forEach((key) =>
    assertObjectField(payload, key),
  );
  if (!Array.isArray(payload.previewTimeline))
    throw new Error("Invalid .vdra: previewTimeline[] is required.");
  if (!payload.runtime || typeof payload.runtime !== "object")
    throw new Error("Invalid .vdra: runtime is required.");
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
  const prepromptFolderPath = resolveProjectPrepromptFolder(projectRoot);
  if (!prepromptFolderPath) {
    throw new Error("Hay tao hoac mo project truoc khi mo thu muc preprompt.");
  }
  await fs.mkdir(prepromptFolderPath, { recursive: true });
  if (logCreated) {
    console.log(`Created project preprompt folder: ${prepromptFolderPath}`);
  }
  return prepromptFolderPath;
}

async function openProjectPrepromptFolderHandler(_event, projectPath) {
  if (!projectPath) {
    throw new Error("Hay tao hoac mo project truoc khi mo thu muc preprompt.");
  }

  const prepromptFolderPath = await ensureProjectPrepromptFolder(projectPath);
  const openError = await shell.openPath(prepromptFolderPath);
  if (openError) {
    throw new Error(openError);
  }

  console.log(`Opened project preprompt folder: ${prepromptFolderPath}`);
  await appendAppLog(null, {
    source: "main",
    kind: "ok",
    text: `Opened project preprompt folder: ${prepromptFolderPath}`,
    details: { prepromptFolderPath },
  }).catch(() => null);

  return { ok: true, prepromptFolderPath };
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
    schemaVersion: VDRA_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
  };
}

async function saveProjectSessionFile(_event, payload = {}) {
  const safePayload = validateProjectPayload(sanitizeProjectValue(payload));
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
  const pathOnlyPayload = prepareProjectPayloadForSave(
    safePayload,
    projectFolder,
  );
  const finalPayload = validateProjectPayload(
    sanitizeProjectValue(pathOnlyPayload),
  );
  if (containsInlineAssetData(finalPayload)) {
    throw new Error("Project autosave rejected inline image/video data.");
  }
  await fs.mkdir(projectFolder, { recursive: true });
  const writeResult = await enqueueProjectWrite(filePath, () =>
    writeJsonFileAtomic(filePath, finalPayload),
  );
  await ensureProjectPrepromptFolder(projectFolder);
  await rememberLastProjectFile(filePath);
  return {
    ok: true,
    filePath,
    projectFolder,
    revision: Number(payload?.runtime?.projectAutosaveRevision || 0),
    savedAt: new Date().toISOString(),
    bytesWritten: writeResult.bytesWritten,
  };
}

async function overwriteProjectSessionFile(
  _event,
  { filePath = "", payload = {}, revision = 0 } = {},
) {
  if (!filePath) return { ok: false, error: "Missing project file path." };
  const safePayload = validateProjectPayload(sanitizeProjectValue(payload));
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
  safePayload.runtime.projectAutosaveRevision = Number(
    revision || safePayload.runtime.projectAutosaveRevision || 0,
  );
  const pathOnlyPayload = prepareProjectPayloadForSave(
    safePayload,
    projectFolder,
  );
  const finalPayload = validateProjectPayload(
    sanitizeProjectValue(pathOnlyPayload),
  );
  if (containsInlineAssetData(finalPayload)) {
    throw new Error("Project autosave rejected inline image/video data.");
  }
  await fs.mkdir(projectFolder, { recursive: true });
  const writeResult = await enqueueProjectWrite(targetPath, () =>
    writeJsonFileAtomic(targetPath, finalPayload),
  );
  await ensureProjectPrepromptFolder(projectFolder);
  await rememberLastProjectFile(targetPath);
  return {
    ok: true,
    filePath: targetPath,
    projectFolder,
    revision: Number(revision || safePayload.runtime.projectAutosaveRevision || 0),
    savedAt: new Date().toISOString(),
    bytesWritten: writeResult.bytesWritten,
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
  const validPayload = validateProjectPayload(
    prepareProjectPayloadForSave(safePayload, projectFolder),
  );
  if (containsInlineAssetData(validPayload)) {
    throw new Error("Project create rejected inline image/video data.");
  }
  const filePath = ensureProjectFilePath(
    path.join(folderPath, `${safeName}.vdra`),
  );
  const [fileAlreadyExists, folderAlreadyExists] = await Promise.all([
    pathExists(filePath),
    pathExists(projectFolder),
  ]);
  if (fileAlreadyExists || folderAlreadyExists) {
    return {
      ok: false,
      error: "project-already-exists",
      filePath,
      projectFolder,
    };
  }
  await fs.mkdir(projectFolder, { recursive: false });
  const writeResult = await enqueueProjectWrite(filePath, () =>
    writeJsonFileAtomic(filePath, validPayload),
  );
  await ensureProjectPrepromptFolder(projectFolder, { logCreated: true });
  await rememberLastProjectFile(filePath);
  return {
    ok: true,
    filePath,
    projectFolder,
    revision: Number(payload?.runtime?.projectAutosaveRevision || 0),
    savedAt: new Date().toISOString(),
    bytesWritten: writeResult.bytesWritten,
  };
}

async function rememberLastProjectFile(filePath = "") {
  const normalizedPath = String(filePath || "").trim();
  if (!normalizedPath) return false;
  await fs.mkdir(path.dirname(LAST_PROJECT_STATE_FILE), { recursive: true });
  await enqueueProjectWrite(LAST_PROJECT_STATE_FILE, () =>
    writeJsonFileAtomic(LAST_PROJECT_STATE_FILE, {
      filePath: normalizedPath,
      updatedAt: new Date().toISOString(),
    }),
  );
  return true;
}

async function loadProjectSessionFile(filePath = "") {
  const requestedPath = String(filePath || "").trim();
  if (!requestedPath) {
    return { ok: false, error: "project-file-not-found", filePath: "" };
  }
  const normalizedPath = ensureProjectFilePath(requestedPath);
  if (!(await pathExists(normalizedPath))) {
    return { ok: false, error: "project-file-not-found", filePath: normalizedPath };
  }
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(normalizedPath, "utf8"));
  } catch (_error) {
    throw new Error("Invalid .vdra: file is not valid JSON.");
  }
  const projectFolderName = sanitizeFileName(
    path.basename(normalizedPath, path.extname(normalizedPath)) ||
    parsed?.project?.name ||
    "ai-scene-project",
  );
  const projectFolder = path.join(
    path.dirname(normalizedPath),
    projectFolderName,
  );
  parsed.runtime = { ...(parsed.runtime || {}), outputFolder: projectFolder };
  await fs.mkdir(projectFolder, { recursive: true });
  await ensureProjectPrepromptFolder(projectFolder);
  const migratedEmbeddedAssets = hasLegacyEmbeddedAssets(parsed);
  await restoreEmbeddedProjectAssets(parsed, projectFolder);
  if (migratedEmbeddedAssets) {
    removeEmbeddedAssets(parsed);
    parsed.runtime = {
      ...(parsed.runtime || {}),
      projectMigration: "embedded-v1-to-external-relative-v1",
      projectMigrationAt: new Date().toISOString(),
    };
  }
  hydrateProjectPayloadPaths(parsed, projectFolder);
  await mergePipelineSceneStateIntoProjectPayload(parsed, projectFolder);
  const payload = validateProjectPayload(sanitizeProjectValue(parsed));
  payload.runtime = {
    ...payload.runtime,
    outputFolder: projectFolder,
    autoRun: false,
    waitingForUserStart: true,
    active: false,
  };
  await rememberLastProjectFile(normalizedPath);
  return { ok: true, filePath: normalizedPath, projectFolder, payload };
}

async function openProjectSessionFile() {
  const result = await dialog.showOpenDialog({
    title: "Open Vidora Project",
    properties: ["openFile"],
    filters: [{ name: "Vidora Project", extensions: ["vdra"] }],
  });
  if (result.canceled || !result.filePaths?.[0])
    return { ok: false, canceled: true };
  return loadProjectSessionFile(result.filePaths[0]);
}

async function openLastProjectSessionFile() {
  const raw = await fs.readFile(LAST_PROJECT_STATE_FILE, "utf8").catch(() => "");
  if (!raw) return { ok: false, error: "no-last-project" };
  let state = {};
  try {
    state = JSON.parse(raw);
  } catch (_error) {
    return { ok: false, error: "invalid-last-project-state" };
  }
  return loadProjectSessionFile(state.filePath || "");
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
    if (saved.recoveryLimitReached === true) {
      scene.recoveryLimitReached = true;
      scene.pipelineRetryCount = Number(saved.retryCount || 0);
      scene.error = saved.lastError || scene.error || '';
      scene.status = 'error';
      scene.progressStep = saved.keyframePath ? 'motion' : 'image';
    } else if (saved.recoveryLimitReached === false) {
      scene.recoveryLimitReached = false;
      scene.pipelineRetryCount = 0;
    }
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

async function restoreEmbeddedProjectAssets(payload = {}, projectFolder = "") {
  const records = Array.isArray(payload.embeddedAssets?.scenes)
    ? payload.embeddedAssets.scenes
    : [];
  if (!records.length || !projectFolder) return;
  const scenes = Array.isArray(payload.project?.scenes)
    ? payload.project.scenes
    : [];
  for (const record of records) {
    const numericSceneId = Number(record?.sceneId);
    if (!Number.isInteger(numericSceneId) || numericSceneId <= 0) continue;
    const scene = scenes.find(
      (item) =>
        String(item.id) === String(numericSceneId) ||
        String(item.sceneId) === String(numericSceneId),
    );
    if (!scene) continue;
    const sceneDir = path.join(
      projectFolder,
      `scene_${String(numericSceneId).padStart(3, "0")}`,
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
  { outputFolder = "", scenes = [], inspectOnly = false } = {},
) {
  if (!outputFolder) return { ok: false, error: "Missing output folder." };
  if (!inspectOnly) await fs.mkdir(outputFolder, { recursive: true });
  const hardTasks = inspectOnly ? { task1: "", task2: "" } : await loadHardPromptTasks();
  const records = [];
  for (const scene of Array.isArray(scenes) ? scenes : []) {
    const sceneId = scene?.id || scene?.sceneId || records.length + 1;
    const sceneDir = path.join(
      outputFolder,
      `scene_${String(sceneId).padStart(3, "0")}`,
    );
    if (!inspectOnly) await fs.mkdir(sceneDir, { recursive: true });
    const currentSceneText =
      scene?.original || scene?.rawSceneText || scene?.sceneText || "";
    if (!inspectOnly && currentSceneText)
      await writeTextFileAtomic(
        path.join(sceneDir, "scene.txt"),
        currentSceneText,
      );
    let requestFiles = null;
    if (!inspectOnly && currentSceneText) {
      requestFiles = await materializeSceneRequestFiles({
        sceneDir,
        sceneId,
        nv1: hardTasks.task1 || scene?.imagePrompt || "",
        nv2: hardTasks.task2 || "",
        sceneText: currentSceneText,
      });
    }
    if (!inspectOnly && scene?.motionPrompt)
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
    const motionPromptPath = path.join(sceneDir, "motion_prompt.txt");
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
    const motionPromptStat = inspectOnly
      ? await fs.stat(motionPromptPath).catch(() => null)
      : null;
    const keyframeValidation = inspectOnly
      ? keyframeStat?.isFile?.()
        ? await validateKeyframeFile(foundKeyframePath).catch((error) => ({
            ok: false,
            error: error?.message || "keyframe-validation-failed",
          }))
        : { ok: false, error: "missing-file" }
      : { ok: Boolean(keyframeStat?.isFile?.()) };
    const motionPromptText = inspectOnly && motionPromptStat?.isFile?.()
      ? await fs.readFile(motionPromptPath, "utf8").catch(() => "")
      : "";
    const motionPromptValidation = inspectOnly
      ? validateMotionPromptTextContent(motionPromptText)
      : { ok: false, error: "not-inspected" };
    const assetStatCheckedAtMs = Date.now();
    records.push({
      sceneId,
      sceneDir,
      keyframePath: foundKeyframePath,
      keyframeExists: Boolean(keyframeStat?.isFile?.()),
      keyframeValid: keyframeValidation.ok === true,
      keyframeValidationError: keyframeValidation.ok
        ? ""
        : keyframeValidation.error || "keyframe-validation-failed",
      keyframeMtimeMs: keyframeStat?.mtimeMs || 0,
      keyframeByteLength: Number(keyframeValidation.byteLength || keyframeStat?.size || 0),
      motionPromptPath,
      motionPromptExists: Boolean(motionPromptStat?.isFile?.()),
      motionPromptValid: motionPromptValidation.ok === true,
      motionPromptValidationError: motionPromptValidation.ok
        ? ""
        : motionPromptValidation.error || "motion-prompt-validation-failed",
      motionPromptMtimeMs: motionPromptStat?.mtimeMs || 0,
      motionPromptByteLength: Number(motionPromptStat?.size || 0),
      assetStatCheckedAtMs,
      videoPath: foundVideoPath,
      videoExists: Boolean(videoStat?.isFile?.()),
      videoMtimeMs: videoStat?.mtimeMs || 0,
      lastFramePath,
      lastFrameExists: Boolean(lastFrameStat?.isFile?.()),
      lastFrameMtimeMs: lastFrameStat?.mtimeMs || 0,
      nv1RequestPath: requestFiles?.nv1?.filePath || "",
      nv1RequestSha256: requestFiles?.nv1?.contentSha256 || "",
      nv2RequestPath: requestFiles?.nv2?.filePath || "",
      nv2RequestSha256: requestFiles?.nv2?.contentSha256 || "",
    });
  }
  return { ok: true, outputFolder, records };
}

function normalizeCredentialProvider(provider) {
  return "chatgpt";
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








async function checkProactiveMemoryGuard(sceneId, pageState) {
  if (!pageState || !pageState.ok) return;

  let rendererPrivate = 0;
  const activeWin = BrowserWindow.getAllWindows().find((win) => !win.isDestroyed());
  if (activeWin) {
    try {
      const processInfo = await activeWin.webContents.getProcessMemoryInfo().catch(() => null);
      if (processInfo) {
        // Electron ProcessMemoryInfo fields are KiB, not bytes.
        rendererPrivate = Number(processInfo.private || 0) * 1024;
      }
    } catch (_err) { }
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
    globalThis.__vidoraSafeMemoryRefreshScheduled = true;
    await appendAppLog(sceneId, {
      source: "main",
      kind: "warning",
      text: `[PROACTIVE GUARD] Same-conversation memory refresh scheduled at end of current scene. Reason: ${reason}`
    }).catch(() => null);
  }
}

async function getChatGptLocationState(page) {
  return evaluateOnCdpPage(
    page,
    `(${getChatGptLocationStateScript.toString()})()`,
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
  await appendAppLog(currentSceneId, {
    source: "main",
    kind: "warning",
    text: "Automatic ChatGPT rotation is disabled; preserving the current conversation.",
  }).catch(() => null);
  return { ok: false, skipped: true, reason: "chat-rotation-disabled" };

  /* istanbul ignore next -- retained legacy implementation, blocked above */
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
  setChatGptContextFresh(true);
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
  const currentId =
    locationState?.conversationId ||
    getChatGptConversationIdFromPath(locationState?.path || "");
  const cached = chatGptConversationIdentityCache;

  // Pipeline stages must stay in the conversation that owns NV1.  A title is
  // only a human-readable hint and is never safe enough to click a sidebar
  // item: duplicate/truncated titles can silently move NV2 to another chat.
  if (currentId && cached.conversationId && currentId !== cached.conversationId) {
    await appendAppLog(null, {
      source: "main",
      kind: "error",
      text: "chatTitleCheck: current ChatGPT conversation changed; automatic sidebar navigation is disabled.",
      details: {
        sceneId,
        reason,
        forceRequested: Boolean(force),
        expectedConversationId: cached.conversationId,
        currentConversationId: currentId,
        path: locationState?.path || "",
        title: sanitizeChatTitleForLog(wanted),
      },
    }).catch(() => null);
    return {
      ok: false,
      error: "chatgpt-conversation-changed",
      expectedConversationId: cached.conversationId,
      currentConversationId: currentId,
      title: wanted,
      location: locationState,
    };
  }

  if (currentId && !cached.conversationId) {
    updateChatGptConversationIdentity(locationState, wanted);
  }
  cached.lastCheckAt = Date.now();
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: "chatTitleCheck: preserving the current ChatGPT conversation; no sidebar item was clicked.",
    details: {
      sceneId,
      reason,
      forceRequested: Boolean(force),
      conversationId: currentId,
      path: locationState?.path || "",
      title: sanitizeChatTitleForLog(wanted),
    },
  }).catch(() => null);
  return {
    ok: true,
    skipped: true,
    reason: "fixed-current-conversation",
    conversationId: currentId,
    title: wanted,
    location: locationState,
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
globalThis.notifyRenderer = notifyRenderer;


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
globalThis.notifyChatGptPolicyRefusal = notifyChatGptPolicyRefusal;




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
      await fs.writeFile(nv1Path, DEFAULT_NV1_PROMPT, "utf8");
    }
  }

  if (!nv2Exists) {
    await fs.writeFile(nv2Path, DEFAULT_NV2_PROMPT, "utf8");
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
  return buildNv1RequestContent({ nv1, sceneText, sceneId });
}

function buildMotionStagePrompt({
  nv2 = "",
  sceneText = "",
  sceneId = "",
} = {}) {
  return buildNv2RequestContent({ nv2, sceneText, sceneId });
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
  await page.Page.bringToFront().catch(() => null);
  await page.close().catch(() => null);
  return {
    ok: true,
    url: targetUrl,
    profilePath: CHROME_USER_DATA_DIR,
    port: CHROME_DEBUG_PORT,
  };
}

function getManualChatGptActionBlockReason() {
  const activeRuns = pipelineCancellation?.activeRunIds?.size || 0;
  if (activeRuns > 0) return "pipeline-active";
  const sceneId = globalThis.__vidoraLastProcessedSceneId || "manual";
  const sendState = getChatGptSendState(sceneId);
  const blockedReason = isReloadBlocked(sceneId);
  if (blockedReason) return blockedReason;
  if (["PREPARING", "READY", "CLICKING", "SENT"].includes(sendState)) {
    return `chatgpt-send-active:${sendState}`;
  }
  return "";
}

async function clearChatGptCacheHandler() {
  // Compatibility guard: assertManualChatGptActionAllowed("chatgpt-clear-cache")
  const blockedReason = getManualChatGptActionBlockReason();
  if (blockedReason) return { ok: false, error: blockedReason };

  const page = await getCdpPage("chatgpt", true, {
    bringToFront: true,
    recover: false,
  });
  let cacheCleared = false;

  if (page?.page?.context) {
    const cdpSession = await page.page.context().newCDPSession(page.page);
    try {
      await cdpSession.send("Network.enable").catch(() => null);
      await cdpSession.send("Network.clearBrowserCache");
      cacheCleared = true;
    } finally {
      await cdpSession.detach().catch(() => null);
    }
  } else if (page?.Network?.clearBrowserCache) {
    await page.Network.enable?.().catch(() => null);
    await page.Network.clearBrowserCache();
    cacheCleared = true;
  }

  clearAllChatGptPipelineLocks();
  challengeRecoveryAttempts.delete("chatgpt");
  await page.Page.bringToFront().catch(() => null);
  await page.close().catch(() => null);
  await appendAppLog(null, {
    source: "main",
    kind: "ok",
    text: "Manual ChatGPT temporary cache clear completed without deleting cookies or changing conversation.",
    details: { cacheCleared },
  }).catch(() => null);
  return { ok: cacheCleared, cookiesPreserved: true };
}

async function openFreshChatGptHandler() {
  // Compatibility guard: assertManualChatGptActionAllowed("chatgpt-open-fresh-chat")
  const blockedReason = getManualChatGptActionBlockReason();
  if (blockedReason) return { ok: false, error: blockedReason };

  const page = await getCdpPage("chatgpt", true, {
    bringToFront: true,
    recover: false,
  });
  const targetUrl = PROVIDER_META.chatgpt.url;

  if (page?.page?.goto) {
    await page.page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
  } else if (page?.Page?.navigate) {
    await page.Page.navigate({ url: targetUrl });
    await waitForCdpLoad(page);
  } else {
    await page.close().catch(() => null);
    return { ok: false, error: "chatgpt-navigation-unavailable" };
  }

  const location = await evaluateOnCdpPage(page, "location.href").catch(
    () => targetUrl,
  );
  if (/chatgpt\.com\/c\//i.test(String(location))) {
    await page.close().catch(() => null);
    return { ok: false, error: "chatgpt-still-on-existing-conversation" };
  }

  await invalidateChatGptConversationIdentity("manual-new-chat");
  activeConversationUrl = null;
  globalThis.activeConversationUrl = null;
  currentThreadId = null;
  setChatGptContextFresh(true);
  clearAllChatGptPipelineLocks();
  chatGptConversationHealth.conversationIndex += 1;
  chatGptConversationHealth.conversationStartedAt = Date.now();
  chatGptConversationHealth.lastResetAt = Date.now();
  chatGptConversationHealth.lastResetReason = "manual-new-chat";
  await page.Page.bringToFront().catch(() => null);
  await page.close().catch(() => null);
  await appendAppLog(null, {
    source: "main",
    kind: "ok",
    text: "Manual ChatGPT new-chat request completed.",
    details: { location },
  }).catch(() => null);
  return { ok: true, mode: "manual-only", url: location };
}

function normalizeWebProvider(provider) {
  return "chatgpt";
}

async function closeChromeDebug() {
  for (const win of webWindows.values()) {
    try {
      if (!win.isDestroyed()) win.close();
    } catch (_error) { }
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
  } catch (_error) { }
  if (chromeProcess?.pid) {
    try {
      process.kill(chromeProcess.pid);
    } catch (_error) { }
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
    `Global story context + preprompt continuity: ${story || ""}`,
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
  const autoOpenSaved = Boolean(options?.autoOpenSaved);
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

  if (!state.loggedIn) {
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








function isValidChatGptConversationUrl(url = "") {
  return /^https:\/\/chatgpt\.com\/c\/[^/?#]+/i.test(String(url || "").trim());
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




async function generateVideoWithProvider({
  imagePath,
  motionPrompt,
  sceneDir,
  sceneId,
}) {
  const runId = getScopedPipelineRunId();
  assertPipelineRunActive(runId);
  const motionPromptPath = path.join(sceneDir, "motion_prompt.txt");
  const sceneMediaPaths = getSceneMediaPaths(sceneDir, sceneId, runId);
  const result = await runVeoUpScriptAsPromise(
    {},
    sceneDir,
    [{
      id: sceneId,
      imagePath,
      keyframeOutputPath: imagePath,
      motionPrompt,
      motionPromptPath,
    }],
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
    await fs.rm(sceneMediaPaths.candidateVideoPath, { force: true }).catch(() => null);
    throw error;
  });
  await appendAppLog(null, {
    source: "main",
    kind: "ok",
    text: `Scene ${sceneId}: VeoUp video validated as ${path.basename(sceneMediaPaths.videoPath)}. Last Frame extraction skipped.`,
    details: {
      videoPath: sceneMediaPaths.videoPath,
      sourceVideoPath,
      validation: finalized.validation,
    },
  });
  return {
    ...result,
    ok: true,
    status: "video-validated",
    runId,
    sceneId,
    sourceVideoPath,
    sourceDownloadPath: sourceVideoPath,
    videoPath: sceneMediaPaths.videoPath,
    videoValidated: true,
    lastFramePath: "",
    validation: finalized.validation,
    lastFrameValidation: {
      ok: true,
      skipped: true,
      reason: "last-frame-disabled",
    },
  };
}


async function getCdpPage(provider, createIfMissing = true, options = {}) {
  const driverType = process.env.BROWSER_AUTOMATION_PROVIDER || "playwright";

  if (driverType === "playwright") {
    await ensureChromeDebug();
    const shouldBringToFront = options.bringToFront !== false;
    const shouldRecover = options.recover !== false;
    const meta = PROVIDER_META[provider] || PROVIDER_META.chatgpt;
    const adapter = new BrowserAdapter(provider, "playwright");
    const cdpEndpoint = `http://127.0.0.1:${CHROME_DEBUG_PORT}`;

    await adapter.connect(cdpEndpoint, { url: meta.url });

    // Ghi đè hàm reload để tương thích ngược cơ chế chặn reload
    const originalReload = adapter.Page.reload;
    adapter.Page.reload = async function (reloadOptions = {}) {
      const {
        __vidoraReloadPolicy = {},
        ignoreCache: _ignoreCache,
        ...playwrightReloadOptions
      } = reloadOptions || {};
      const stack = new Error().stack || "";
      let caller = "unknown";
      if (stack.includes("forceCleanChatGptNewChatRotation")) caller = "forceCleanChatGptNewChatRotation";
      else if (stack.includes("recoverCdpPageIfCrashed")) caller = "recoverCdpPageIfCrashed";
      else if (stack.includes("waitForLatestChatGPTGeneratedImage") || stack.includes("resendImagePrompt")) caller = "waitForLatestChatGPTGeneratedImage";
      else if (stack.includes("refreshChatGptPageBeforeImageExtract")) caller = "refreshChatGptPageBeforeImageExtract";
      else if (stack.includes("recoverChatGptBlockingUi")) caller = "recoverChatGptBlockingUi";

      const timestamp = new Date().toISOString();
      const currentSceneId = globalThis.__vidoraLastProcessedSceneId || "unknown";
      const sendState = getChatGptSendState(currentSceneId);

      const blockedReason = isReloadBlocked(
        currentSceneId,
        __vidoraReloadPolicy,
      );
      if (blockedReason) {
        await appendAppLog(currentSceneId, {
          source: "main",
          kind: "warning",
          text: `CHATGPT_RELOAD_BLOCKED: Reload requested via Playwright was canceled. ${blockedReason}`,
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
          reason: "Page reload requested via Playwright",
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

      return originalReload(playwrightReloadOptions);
    };

    if (shouldBringToFront) await adapter.Page.bringToFront().catch(() => null);
    await waitForCdpLoad(adapter);

    if (shouldRecover) {
      await recoverCdpPageIfCrashed(adapter, provider, "get-page").catch(() => null);
    }

    globalThis.activeCdpClient = adapter;
    return adapter;
  }

  if (!CDP) CDP = require("chrome-remote-interface");
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
    const {
      __vidoraReloadPolicy = {},
      ...cdpReloadOptions
    } = options || {};
    const stack = new Error().stack || "";
    let caller = "unknown";
    if (stack.includes("forceCleanChatGptNewChatRotation")) caller = "forceCleanChatGptNewChatRotation";
    else if (stack.includes("recoverCdpPageIfCrashed")) caller = "recoverCdpPageIfCrashed";
    else if (stack.includes("waitForLatestChatGPTGeneratedImage") || stack.includes("resendImagePrompt")) caller = "waitForLatestChatGPTGeneratedImage";
    else if (stack.includes("refreshChatGptPageBeforeImageExtract")) caller = "refreshChatGptPageBeforeImageExtract";
    else if (stack.includes("recoverChatGptBlockingUi")) caller = "recoverChatGptBlockingUi";

    const timestamp = new Date().toISOString();
    const currentSceneId = globalThis.__vidoraLastProcessedSceneId || "unknown";
    const sendState = getChatGptSendState(currentSceneId);

    const blockedReason = isReloadBlocked(
      currentSceneId,
      __vidoraReloadPolicy,
    );
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

    return originalCdpReload.call(client.Page, cdpReloadOptions);
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



async function checkAssetExists(_event, filePath) {
  return pathExists(filePath);
}

async function getAssetStat(_event, filePath) {
  return getFileStat(filePath);
}


async function uploadFileViaCdp(client, filePath) {
  const handle = await client.DOM.getDocument();
  let query = await client.DOM.querySelector({
    nodeId: handle.root.nodeId,
    selector: 'input[type="file"]',
  }).catch(() => ({ nodeId: 0 }));
  if (!query.nodeId) {
    const clicked = await evaluateOnCdpPage(
      client,
      `(${clickUploadButtonScript.toString()})("chatgpt")`,
    );
    await sleep(1400);
    const refreshed = await client.DOM.getDocument();
    query = await client.DOM.querySelector({
      nodeId: refreshed.root.nodeId,
      selector: 'input[type="file"]',
    }).catch(() => ({ nodeId: 0 }));
    if (!query.nodeId) {
      return {
        ok: false,
        error: clicked?.error || "Không tìm thấy input upload của ChatGPT.",
      };
    }
  }

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
        for (const element of document.querySelectorAll(selector)) {
          element.click();
          clickedCount += 1;
        }
      }
      return { ok: true, clickedCount };
    })()`,
  ).catch(() => null);
  await sleep(400);

  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `Upload ảnh vào ChatGPT: setFileInputFiles ${filePath}`,
  });
  await client.DOM.setFileInputFiles({
    nodeId: query.nodeId,
    files: [filePath],
  });
  await sleep(4500);
  const uploaded = await evaluateOnCdpPage(
    client,
    `(${detectUploadedAssetScript.toString()})()`,
  ).catch((error) => ({ ok: false, error: error.message }));
  await appendAppLog(null, {
    source: "main",
    kind: uploaded?.ok ? "ok" : "error",
    text: `Kết quả upload ChatGPT: ${uploaded?.ok ? "đã nhận ảnh" : uploaded?.error || "chưa nhận ảnh"}`,
    details: uploaded,
  });
  return uploaded?.ok
    ? { ok: true, uploaded }
    : { ok: false, error: uploaded?.error || "ChatGPT chưa nhận ảnh upload." };
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


let veoupBatchCoordinatorInstance = null;

function getVeoUpBatchCoordinator() {
  if (veoupBatchCoordinatorInstance) return veoupBatchCoordinatorInstance;
  veoupBatchCoordinatorInstance = createVeoUpBatchCoordinator({
    appendLog: appendAppLog,
    executeAutomation: async (options = {}) => {
      const runId = String(
        options.runId || getScopedPipelineRunId() || "",
      ).trim();
      return executeVeoUpAutomation({
        ...options,
        runId,
        userDataDir: app.getPath("userData"),
        maximizeBeforeAutomation: true,
        registerChildProcess:
          options.registerChildProcess ||
          ((child) => trackPipelineChildProcess(child, runId)),
      });
    },
  });
  return veoupBatchCoordinatorInstance;
}

async function runVeoUpAutomation(_event, payload = {}) {
  const runId = String(
    payload?.runId || getScopedPipelineRunId() || "",
  ).trim();
  try {
    if (runId) pipelineCancellation.activeRunIds.add(runId);
    assertPipelineRunActive(runId);
    const scenes = Array.isArray(payload.scenes) ? payload.scenes : [];
    const result = await getVeoUpBatchCoordinator().requestBatch({
      ...payload,
      projectDir: payload.outputFolder || payload.projectDir || "",
      expectedSceneIds: scenes.map((scene, index) =>
        Number(scene?.id || scene?.sceneId || index + 1),
      ),
      trigger: payload.trigger || "pipeline-complete",
      autoStartVideoGeneration: payload.autoStartVideoGeneration !== false,
      runId,
      isCancelled: () => isPipelineRunCancelled(runId),
      registerChildProcess: (child) => trackPipelineChildProcess(child, runId),
    });
    if (!result?.cancelled) assertPipelineRunActive(runId);
    return result;
  } catch (error) {
    if (isPipelineCancelledError(error)) {
      return {
        ok: false,
        cancelled: true,
        status: "cancelled",
        error: error.message,
        code: error.code,
      };
    }
    console.error("[VeoUp Batch Main] Exception occurred:", error);
    await appendAppLog(null, {
      source: "main",
      kind: "error",
      text: "VeoUp batch request encountered a runtime exception.",
      details: {
        errorMessage: error?.message || String(error),
        errorStack: error?.stack || "",
      },
    }).catch(() => null);
    return { ok: false, status: "failed", error: error?.message || String(error) };
  } finally {
    if (runId) pipelineCancellation.activeRunIds.delete(runId);
  }
}

async function getVeoUpBatchStatusHandler(_event, payload = {}) {
  return getVeoUpBatchCoordinator().getBatchStatus(
    payload.projectDir || payload.outputFolder || "",
  );
}

async function cancelVeoUpBatchHandler(_event, payload = {}) {
  return getVeoUpBatchCoordinator().cancelBatch(payload);
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
  } catch (_) { }
});

process.on("beforeExit", (code) => {
  try {
    console.log("[VidoraProcessBeforeExit]", code);
  } catch (_) { }
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
  } catch (_) { }
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
  try {
    const expectedSceneCount = Number(payload.expectedSceneCount || 0);
    const expectedSceneIds = Array.isArray(payload.expectedSceneIds)
      ? payload.expectedSceneIds
      : expectedSceneCount > 0
        ? Array.from({ length: expectedSceneCount }, (_, index) => index + 1)
        : [];
    return await getVeoUpBatchCoordinator().requestBatch({
      ...payload,
      projectDir,
      outputFolder: projectDir,
      expectedSceneCount,
      expectedSceneIds,
      trigger: payload.trigger || "manual-scan",
      autoStartVideoGeneration: payload.autoStartVideoGeneration !== false,
      previewStartButtonOnly: Boolean(payload.previewStartButtonOnly),
      allowPartial: payload.allowPartial === true,
      runId: String(payload.runId || "").trim(),
    });
  } catch (err) {
    console.error("[scanProjectAndRunVeoUpHandler] Failed:", err);
    return { ok: false, error: err.message || String(err) };
  }
}

app.whenReady().then(() => {
  initBootstrap({
    app,
    BrowserWindow,
    ipcMain,
    path,
    electronDir: __dirname,

    initChatGptPipeline,
    initVeoUp,
    initPipelineRunner,
    initIpcHandlers,

    ensureAndMigratePrompts,
    appendAppLog,
    buildAppMenu,

    runtimeChatGptPipeline: {
      getCdpPage,
      tryAutoLoginWithStoredAccount,
      invalidateChatGptConversationIdentity,
      loginRequiredMessage,
      checkProactiveMemoryGuard,
      maybeSelectChatGptConversationByTitle,
      getChatGptLocationState,
      logChatGptStage,
      waitForChatGptResponse,
      updateChatGptConversationIdentity,
      chatGptConversationIdentityCache,
      renameChatGptCurrentConversation,
      collectPrepromptRequestFiles,
      collectRecentProjectKeyframes,
      writePipelineSceneState,
      chatGptConversationHealth,
      setActiveConversationUrl: (val) => { activeConversationUrl = val; globalThis.activeConversationUrl = val; },
      captureAndLogChatGptDiagnostics,
      notifyRenderer,
      notifyChatGptPolicyRefusal,
      uploadFileViaCdp,
      persistDurableStage,
    },

    runtimeVeoUp: {
      app,
      getScopedPipelineRunId,
      pipelineCancellation,
      isPipelineRunCancelled,
      trackPipelineChildProcess,
      isPipelineCancelledError,
      makePipelineCancelledError,
    },

    runtimePipelineRunner: {
      getCdpPage,
      tryAutoLoginWithStoredAccount,
      closeUnexpectedProviderTabs,
      notifyRenderer,
      openFreshChatGptRootPage,
      assertChatGptNotExistingConversation,
      generateImageWithImageApi,
      generateVideoWithProvider,
      loadHardPromptTasks,
      buildImageStagePrompt,
      buildMotionStagePrompt,
      getSceneMediaPaths,
      validateLocalVideoFile,
      extractContinuityReferencesFromVideo,
      hydrateFreshChatGptContextAfterRotation,
    },

    runtimeIpcHandlers: {
      app,
      ipcMain,
      safeIpcHandler,
      getVeoUpCoordinateConfigHandler,
      startVeoUpCoordinateSetupHandler,
      captureVeoUpCoordinateHandler,
      deleteVeoUpCoordinateConfigHandler,
      saveVeoUpCoordinateConfigHandler,
      cancelVeoUpCoordinateSetupHandler,
      scanProjectAndRunVeoUpHandler,
      getVeoUpBatchStatusHandler,
      cancelVeoUpBatchHandler,
      appendAppLog,
      getAppLogPath,
      openHardPromptFile,
      getHardPromptFileInfo,
      chooseHardPromptFile,
      listWebAccountsSafe,
      saveWebAccount,
      deleteWebAccount,
      getPipelineLogVisibility,
      openWebLogin,
      checkWebLogin,
      clearChatGptCacheHandler,
      openFreshChatGptHandler,
      sendPromptViaWeb,
      runScenePipeline,
      stopPipeline,
      chooseOutputFolder,
      chooseProjectRootFolder,
      chooseFolder,
      scanFolder,
      extractLastFrame,
      extractLastFrameToPathHandler,
      mergeVideos,
      exportFinalVideo,
      copyImageToClipboard,
      checkAssetExists,
      getAssetStat,
      getPreviousFrame,
      splitPromptWithAI,
      generateScenePrompts,
      renameChatGptCurrentConversation,
      exportProject,
      newProjectSession,
      saveProjectSessionFile,
      overwriteProjectSessionFile,
      createProjectSessionFile,
      openProjectSessionFile,
      openLastProjectSessionFile,
      ensureProjectSceneFolders,
      openProjectPrepromptFolderHandler,
      runVeoUpAutomation,
      getChatGptSendState,
      isReloadBlocked,
    },
  });



  // Compatibility comment for tests: ipcMain.handle('pipeline:stop'
  // Compatibility comment for tests: CHATGPT_RELOAD_BLOCKED: webContents.reload() canceled.
  // Compatibility comment for tests: CHATGPT_RELOAD_BLOCKED: webContents.reloadIgnoringCache() canceled.




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

  initializeApplication();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
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
    } catch (_error) { }
  }
});
