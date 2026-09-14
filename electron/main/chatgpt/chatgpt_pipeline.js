"use strict";

const { nativeImage, app } = require("electron");

function isPipelineCancelledError(error) {
  return error && (error.message === "PIPELINE_CANCELLED" || error.code === "PIPELINE_CANCELLED");
}
const fs = require("fs/promises");
const path = require("path");
const chatGptRuntimeMonitor = require("./chatgpt_runtime_monitor");
const ChatGptPipelineAdapter = require("./chatgpt_pipeline_adapter");
const { appendAppLog, vidoraCompactLogDetails, maskRouterText } = require("../logging");
const { pathExists, sanitizeFileName } = require("../utils");
const { logMemoryMilestone } = require("../memory");
const {
  buildRequestControlPrompt,
  createComposerPayload,
} = require("../pipeline/scene_request_files");
const {
  validateKeyframeFile,
  validateMotionPromptTextContent,
} = require("../pipeline/asset_validation");
const {
  hashChatGptSnapshotText,
  writeSceneSnapshot,
  readSceneSnapshot,
  isChatGptActivelyGenerating,
  sanitizeChatGptImageSnapshot,
  looksLikeCollapsedUserPrompt,
  verifyDraftOwnership,
  isChatGptDotLoadingCanvasAsset,
  isChatGptLimitText,
  isSameChatTitle,
  extractCompletedNv2ResponseFromSnapshot,
  buildNv2OwnedPromptBaseline,
} = require("../state");
const {
  getChatGptContextFresh,
  setChatGptContextFresh,
} = require("../state/chatgpt_state");
const {
  detectLoginScript,
  readChatGptImageStateScript,
  countChatGptAssistantRootsScript,
  prepareChatGptCreateImageScript,
  readAssistantMessageSnapshotScript,
  readLatestAssistantScript,
  detectChatGptActiveGenerationScriptStrict,
  clickChatGptStopGeneratingScript,
} = require("./chatgpt_dom");
const {
  evaluateOnCdpPage,
  waitForCdpLoad,
  getConversationState,
} = require("./chatgpt_core");
const {
  sendPromptViaCdpInput,
  sendNv2PromptViaDeepCdpInput,
  vidoraChatGptInputGate,
  vidoraReadChatGptComposerStateReal,
  vidoraClickChatGptRealSendButton,
} = require("./chatgpt_send");
const {
  uploadFilesToChatGptSequentially,
} = require("./chatgpt_upload");
const {
  CHATGPT_STAGES,
  buildChatGptStageLog,
} = require("../../chatgptStability");
const {
  requestReloadWithReason,
  recoverCdpPageIfCrashed,
  recoverChatGptBlockingUi,
  recoverChatGptResponseChoiceChat,
  isReloadBlocked,
  isTransientCdpNavigationError,
} = require("./chatgpt_recovery");
const {
  isChatGptPolicyRefusalText,
  isRetryableChatGptToolErrorText,
  normalizeChatGptRetryText,
} = require("../recovery");

const CHATGPT_HYDRATION_KEYFRAME_LIMIT = 10;

// --- Injected dependencies (set via initChatGptPipeline) ---
let getCdpPage;
let tryAutoLoginWithStoredAccount;
let invalidateChatGptConversationIdentity;
let loginRequiredMessage;
let checkProactiveMemoryGuard;
let maybeSelectChatGptConversationByTitle;
let getChatGptLocationState;
let logChatGptStage;
let updateChatGptConversationIdentity;
let chatGptConversationIdentityCache;
let renameChatGptCurrentConversation;
let collectPrepromptRequestFiles;
let collectRecentProjectKeyframes;
let writePipelineSceneState;
let chatGptConversationHealth;
let setActiveConversationUrl;
let captureAndLogChatGptDiagnostics;
let notifyRenderer;
let notifyChatGptPolicyRefusal;
let uploadFileViaCdp;
let persistDurableStage;

function initChatGptPipeline(runtime) {
  getCdpPage = runtime.getCdpPage;
  tryAutoLoginWithStoredAccount = runtime.tryAutoLoginWithStoredAccount;
  invalidateChatGptConversationIdentity = runtime.invalidateChatGptConversationIdentity;
  loginRequiredMessage = runtime.loginRequiredMessage;
  checkProactiveMemoryGuard = runtime.checkProactiveMemoryGuard;
  maybeSelectChatGptConversationByTitle = runtime.maybeSelectChatGptConversationByTitle;
  getChatGptLocationState = runtime.getChatGptLocationState;
  logChatGptStage = runtime.logChatGptStage;
  updateChatGptConversationIdentity = runtime.updateChatGptConversationIdentity;
  chatGptConversationIdentityCache = runtime.chatGptConversationIdentityCache;
  renameChatGptCurrentConversation = runtime.renameChatGptCurrentConversation;
  collectPrepromptRequestFiles = runtime.collectPrepromptRequestFiles;
  collectRecentProjectKeyframes = runtime.collectRecentProjectKeyframes;
  writePipelineSceneState = runtime.writePipelineSceneState;
  chatGptConversationHealth = runtime.chatGptConversationHealth;
  setActiveConversationUrl = runtime.setActiveConversationUrl;
  captureAndLogChatGptDiagnostics = runtime.captureAndLogChatGptDiagnostics;
  notifyRenderer = runtime.notifyRenderer;
  notifyChatGptPolicyRefusal = runtime.notifyChatGptPolicyRefusal;
  uploadFileViaCdp = runtime.uploadFileViaCdp;
  persistDurableStage = runtime.persistDurableStage;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setChatGptTaskState(sceneDir, task, state, details = {}) {
  if (!sceneDir || !task || !state) return;
  const snapshot = await readSceneSnapshot(sceneDir).catch(() => ({}));
  snapshot.taskStates = {
    ...(snapshot.taskStates || {}),
    [task]: {
      state,
      updatedAt: new Date().toISOString(),
      ...(details && typeof details === "object" ? details : {}),
    },
  };
  await writeSceneSnapshot(sceneDir, snapshot).catch(() => null);
}

function validateReadyResponse(text = "") {
  const normalized = String(text || "").trim().toLowerCase();
  if (!normalized) return false;
  if (isChatGptPolicyRefusalText(normalized) || isChatGptLimitText(normalized)) return false;
  return /\b(ready|done|ok|okay|acknowledged|remembered|loaded|understood)\b|sẵn sàng|san sang|đã nhớ|da nho|xong/.test(normalized);
}

function conversationIdFromLocation(location = {}) {
  return String(
    location?.conversationId ||
      String(location?.path || location?.safeUrl || location?.url || "").match(
        /\/c\/([^/?#]+)/,
      )?.[1] ||
      "",
  ).trim();
}

function buildNv1SingleRetryPrompt(requestArtifact = {}) {
  return buildRequestControlPrompt({
    stage: "NV1",
    filePath: requestArtifact.filePath,
    contentSha256: requestArtifact.contentSha256,
    retry: 1,
  });
}

async function reloadCurrentChatAndVerify(
  page,
  expectedConversationId = "",
  sceneId = "",
  reason = "same-chat-recovery",
  reloadPolicy = {},
) {
  const before = await getChatGptLocationState(page).catch(() => ({}));
  const beforeId = conversationIdFromLocation(before);
  const lockedId = String(expectedConversationId || beforeId || "").trim();
  if (expectedConversationId && beforeId !== expectedConversationId) {
    throw new Error(`chatgpt-conversation-changed-before-refresh:${expectedConversationId}:${beforeId || "none"}`);
  }
  const reloaded = await requestReloadWithReason(
    page,
    reason,
    sceneId,
    reloadPolicy,
  );
  if (!reloaded) throw new Error(`chatgpt-same-chat-refresh-failed:${reason}`);
  await waitForCdpLoad(page).catch(() => null);
  await sleep(4000);
  const after = await getChatGptLocationState(page).catch(() => ({}));
  const afterId = conversationIdFromLocation(after);
  if (lockedId && afterId !== lockedId) {
    throw new Error(`chatgpt-conversation-changed-after-refresh:${lockedId}:${afterId || "none"}`);
  }
  return { ok: true, conversationId: lockedId || afterId };
}

async function sendPromptWithSameChatRefreshRecovery(page, prompt, options = {}) {
  const expectedHash = hashChatGptSnapshotText(prompt);
  const expectedFilePaths = Array.isArray(options.expectedFilePaths)
    ? options.expectedFilePaths.filter(Boolean)
    : [];
  const location = await getChatGptLocationState(page).catch(() => ({}));
  const expectedConversationId = String(options.expectedConversationId || conversationIdFromLocation(location)).trim();
  const prepareAttachments = async (request) => {
    if (!expectedFilePaths.length) return { ok: true, skipped: true };
    return uploadFilesToChatGptSequentially(
      page,
      expectedFilePaths,
      options.sceneId,
      { request },
    );
  };
  const shouldPrepareInitialAttachments = Boolean(
    expectedFilePaths.length && !options.attachmentsAlreadyPrepared,
  );
  const firstPrepared = shouldPrepareInitialAttachments
    ? await prepareAttachments(`${options.stage || "prompt"}-initial`)
    : { ok: true, skipped: true, reason: "attachments-already-prepared" };
  if (!firstPrepared?.ok) {
    return { ok: false, error: firstPrepared?.error || "chatgpt-payload-attachment-prepare-failed" };
  }
  const first = await sendPromptViaCdpInput(page, prompt, {
    ...options,
    expectedFilePaths,
  });
  let state = await getConversationState(page).catch(() => ({}));
  if (state?.latestUserMessageHash === expectedHash) {
    return { ...(first || {}), ok: true, recovered: !first?.ok, owned: true };
  }
  if (first?.ok) return { ok: false, error: "prompt-send-ack-without-user-message-ownership" };
  await reloadCurrentChatAndVerify(
    page,
    expectedConversationId,
    options.sceneId,
    `${options.stage || "prompt"}-send-recovery`,
    { allowFailedDraftRefresh: true },
  );
  state = await getConversationState(page).catch(() => ({}));
  if (state?.latestUserMessageHash === expectedHash) {
    return { ok: true, recovered: true, owned: true, mode: "owned-after-refresh" };
  }
  const retryPrepared = await prepareAttachments(`${options.stage || "prompt"}-recovery`);
  if (!retryPrepared?.ok) {
    return { ok: false, error: retryPrepared?.error || "chatgpt-payload-recovery-attachment-prepare-failed" };
  }
  const retry = await sendPromptViaCdpInput(page, prompt, {
    ...options,
    expectedFilePaths,
    recoveryAttempt: 1,
  });
  state = await getConversationState(page).catch(() => ({}));
  if (!retry?.ok || state?.latestUserMessageHash !== expectedHash) {
    return { ok: false, error: retry?.error || "prompt-send-retry-user-message-ownership-not-confirmed" };
  }
  return { ...retry, ok: true, recovered: true, owned: true };
}

const motionPromptSendLocks = new Map();

async function generateImageAndMotionWithChatGPT({
  imagePrompt,
  requestArtifact,
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
  const runId = String(options.runId || options.originalOptions?.runId || "").trim();
  const projectDir = options.originalOptions?.outputFolder || path.dirname(sceneDir);
  if (!requestArtifact?.filePath || !requestArtifact?.controlPrompt) {
    throw new Error(`Scene ${sceneId}: missing NV1 request artifact.`);
  }
  const nv1Payload = await createComposerPayload({
    stage: "NV1",
    sceneId,
    controlPrompt: requestArtifact.controlPrompt,
    expectedFilePaths: [requestArtifact.filePath],
  });
  if (nv1Payload.localFileSha256s[0] !== requestArtifact.contentSha256) {
    throw new Error(`Scene ${sceneId}: scene-request-file-hash-mismatch`);
  }
  const finalNv1Prompt = nv1Payload.controlPrompt;
  const expectedNv1PromptHash = hashChatGptSnapshotText(finalNv1Prompt);

  assertPipelineRunActive(runId);
  let snapshot = await readSceneSnapshot(sceneDir);

  if (getChatGptContextFresh()) {
    snapshot.pipelineStage = "";
    snapshot.hydration = {};
    snapshot.imageValidated = false;
    await writeSceneSnapshot(sceneDir, snapshot);
    await appendAppLog(sceneId, {
      source: "main",
      kind: "running",
      text: `Scene ${sceneId}: Fresh ChatGPT context detected. Cleared scene generation state before sending.`,
    }).catch(() => null);
  }
  
  if (snapshot.imageValidated || (await pathExists(imagePath))) {
    const existingImageValidation = await validateKeyframeFile(imagePath);
    if (existingImageValidation.ok) {
      snapshot.pipelineStage = "IMAGE_EXTRACTED";
      snapshot.imageValidated = true;
      await writeSceneSnapshot(sceneDir, snapshot);
      return { imagePath, motionPrompt: "" };
    }
    snapshot.imageValidated = false;
    snapshot.pipelineStage = "NV1_DRAFT_READY";
    snapshot.cachedImageRejectedAt = new Date().toISOString();
    snapshot.cachedImageRejectedReason = existingImageValidation.error;
    await writeSceneSnapshot(sceneDir, snapshot);
    await appendAppLog(sceneId, {
      source: "main",
      kind: "warning",
      text: `Scene ${sceneId}: cached keyframe failed the NV1 quality gate; regenerating it.`,
      details: existingImageValidation,
    }).catch(() => null);
  }

  const page = await getCdpPage("chatgpt", true);
  try {
  const nv1ConversationLocation = await getChatGptLocationState(page).catch(
    () => ({}),
  );
  const currentConversationId =
    nv1ConversationLocation?.conversationId ||
    String(
      nv1ConversationLocation?.path || nv1ConversationLocation?.url || "",
    ).match(/\/c\/([^/?#]+)/)?.[1] ||
    "";
  let expectedConversationId = String(
    snapshot.chatGptConversationId || currentConversationId || "",
  ).trim();
  if (
    snapshot.chatGptConversationId &&
    currentConversationId !== snapshot.chatGptConversationId
  ) {
    const isManualMode = Boolean(
      options.manualChatGPT ||
      options.pipelineMode === 'manualChatGPT' ||
      globalThis.__vidoraManualChatGPTMode
    );
    if (isManualMode || currentConversationId) {
      snapshot.chatGptConversationId = currentConversationId || snapshot.chatGptConversationId;
      expectedConversationId = snapshot.chatGptConversationId;
    } else {
      throw new Error(
        `chatgpt-conversation-changed-before-nv1:${snapshot.chatGptConversationId}:${currentConversationId || "none"}`,
      );
    }
  }

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
    const resumeState = await getConversationState(page);
    const retryNv1PromptHash = hashChatGptSnapshotText(
      buildNv1SingleRetryPrompt(requestArtifact),
    );
    const resumeExpectedUserPromptHash =
      resumeState?.latestUserMessageHash === expectedNv1PromptHash
        ? expectedNv1PromptHash
        : resumeState?.latestUserMessageHash === retryNv1PromptHash
          ? retryNv1PromptHash
          : "";
    if (!resumeExpectedUserPromptHash) {
      throw new Error("nv1-resume-user-message-ownership-not-confirmed");
    }
    snapshot.sentPromptHash = resumeExpectedUserPromptHash;
    await writeSceneSnapshot(sceneDir, snapshot);
    await setChatGptTaskState(sceneDir, "NV1", "WAIT", { sceneId });
    await appendAppLog(sceneId, {
      source: "main",
      kind: "running",
      text: `Scene ${sceneId}: Resuming NV1 image waiting from stage ${snapshot.pipelineStage}.`,
      details: {
        resumedFromSingleRetry:
          resumeExpectedUserPromptHash === retryNv1PromptHash,
      },
    });
    const imageNetworkCapture = startChatGptImageNetworkCapture(page, { sceneId });
    try {
      await saveChatGPTGeneratedImageAsset(page, {
        existingUrls: [],
        minImageAgentTurnIndex: Number(options.beforeImageAgentTurnCount || 0),
        prompt: finalNv1Prompt,
        sceneDir,
        sceneId,
        outputPath: imagePath,
        referenceImagePaths: [],
        networkCapture: imageNetworkCapture,
        originalOptions: options,
        expectedConversationId,
        expectedUserPromptHash: resumeExpectedUserPromptHash,
        requestArtifact,
        payload: nv1Payload,
      });
      snapshot.pipelineStage = "IMAGE_EXTRACTED";
      snapshot.imageValidated = true;
      await writeSceneSnapshot(sceneDir, snapshot);
      await setChatGptTaskState(sceneDir, "NV1", "VALIDATE", { sceneId });
      await setChatGptTaskState(sceneDir, "NV1", "SAVE", { sceneId, imagePath });
      await setChatGptTaskState(sceneDir, "NV1", "COMPLETE", { sceneId, imagePath });
    } finally {
      imageNetworkCapture.stop();
    }
    await page.close();
    return { imagePath, motionPrompt: "" };
  }

  snapshot.pipelineStage = "NV1_DRAFT_READY";
  await setChatGptTaskState(sceneDir, "NV1", "SEND", { sceneId });
  snapshot.promptHash = expectedNv1PromptHash;
  snapshot.controlPromptHash = expectedNv1PromptHash;
  snapshot.payloadFingerprint = nv1Payload.payloadFingerprint;
  snapshot.expectedAttachmentNames = nv1Payload.expectedAttachmentNames;
  snapshot.localFileSha256s = nv1Payload.localFileSha256s;
  snapshot.attachmentCount = nv1Payload.expectedFilePaths.length;
  snapshot.draftId = `draft-scene-${sceneId}-${Date.now()}`;
  snapshot.createdAt = new Date().toISOString();
  await writeSceneSnapshot(sceneDir, snapshot);

  if (!getChatGptContextFresh()) {
    await appendAppLog(sceneId, {
      source: "main",
      kind: "info",
      text: "Established ChatGPT context detected; scene request attachment will still be verified before Send.",
    }).catch(() => null);
  }

  let pageState = await getConversationState(page);
  
  await checkProactiveMemoryGuard(sceneId, pageState);

  const isDraftMatches = !getChatGptContextFresh() && verifyDraftOwnership(
    snapshot,
    pageState,
    nv1Payload.expectedFilePaths,
  ) && pageState.composerReady;
  
  if (isDraftMatches) {
    await appendAppLog(sceneId, {
      source: "main",
      kind: "ok",
      text: `Scene ${sceneId}: Valid unsent NV1 draft recovered in composer. Skipping upload & pasting; clicking Send.`
    });
    const recoveredSend = await sendPromptWithSameChatRefreshRecovery(page, finalNv1Prompt, {
      beforeCount: Number(options.beforeAssistantCount || 0),
      sceneId,
      stage: "nv1-recovered-draft",
      expectedFilePaths: nv1Payload.expectedFilePaths,
      payloadFingerprint: nv1Payload.payloadFingerprint,
    });
    if (!recoveredSend?.ok) {
      throw new Error(
        `Failed to send recovered NV1 draft: ${recoveredSend?.error || "unknown"}`,
      );
    }
    snapshot.pipelineStage = "NV1_SENT";
    await writeSceneSnapshot(sceneDir, snapshot);
  } else {
    const userPromptMatches =
      pageState?.latestUserMessageHash === expectedNv1PromptHash;

    if (userPromptMatches) {
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: `Scene ${sceneId}: Prompt already sent. Proceeding to wait for image.`,
      });
      snapshot.pipelineStage = "WAIT_IMAGE";
      snapshot.sentPromptHash = expectedNv1PromptHash;
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
        })()
      `).catch(() => null);
      await sleep(400);
      assertPipelineRunActive(runId);

      await evaluateOnCdpPage(
        page,
        `(${prepareChatGptCreateImageScript.toString()})()`
      ).catch(() => null);
      await sleep(800);
      assertPipelineRunActive(runId);

      const filesToUpload = nv1Payload.expectedFilePaths;
      const uploadRes = await uploadFilesToChatGptSequentially(page, filesToUpload, sceneId, {
        request: "nv1-request-file",
      });
      if (!uploadRes.ok) {
        throw new Error(`ChatGPT sequential upload failed: ${uploadRes.error}`);
      }
      if (!snapshot.hydration) snapshot.hydration = {};
      snapshot.hydration.prepromptUploadDone = true;
      snapshot.attachmentsVerifiedAt = new Date().toISOString();
      await writeSceneSnapshot(sceneDir, snapshot);
      await persistDurableStage?.(projectDir, sceneId, "nv1_attachments_ready", {
        nv1RequestPath: requestArtifact.filePath,
        nv1RequestSha256: requestArtifact.contentSha256,
        nv1ControlPromptHash: nv1Payload.controlPromptHash,
        nv1PayloadFingerprint: nv1Payload.payloadFingerprint,
        expectedAttachmentNames: nv1Payload.expectedAttachmentNames,
        attachmentsVerifiedAt: snapshot.attachmentsVerifiedAt,
      });

      pageState = await getConversationState(page);
      snapshot.attachmentHashes = pageState.attachmentHashes || [];
      await writeSceneSnapshot(sceneDir, snapshot);

      await appendAppLog(sceneId, {
        source: "main",
        kind: "running",
        text: `Scene ${sceneId}: Sending NV1 control prompt with verified request file.`,
      }).catch(() => null);

      assertPipelineRunActive(runId);
      const sentImage = await sendPromptWithSameChatRefreshRecovery(page, finalNv1Prompt, {
        beforeCount: Number(options.beforeAssistantCount || 0),
        sceneId,
        stage: "nv1-image",
        expectedFilePaths: nv1Payload.expectedFilePaths,
        payloadFingerprint: nv1Payload.payloadFingerprint,
      });
      if (!sentImage?.ok) {
        throw new Error(sentImage?.error || "IMAGE_STAGE NV1 send failed.");
      }
      const sentImageState = await getConversationState(page);
      if (
        sentImageState?.latestUserMessageHash !==
        expectedNv1PromptHash
      ) {
        throw new Error("nv1-user-message-ownership-not-confirmed");
      }

      if (!snapshot.hydration) snapshot.hydration = {};
      snapshot.hydration.promptUploadDone = true;
      snapshot.sentPromptHash = expectedNv1PromptHash;
      snapshot.sentPayloadFingerprint = nv1Payload.payloadFingerprint;
      snapshot.pipelineStage = "NV1_SENT";
      await writeSceneSnapshot(sceneDir, snapshot);
      await persistDurableStage?.(projectDir, sceneId, "nv1_sent", {
        nv1RequestPath: requestArtifact.filePath,
        nv1RequestSha256: requestArtifact.contentSha256,
        nv1ControlPromptHash: expectedNv1PromptHash,
        nv1PayloadFingerprint: nv1Payload.payloadFingerprint,
        expectedAttachmentNames: nv1Payload.expectedAttachmentNames,
        sentPayloadFingerprint: nv1Payload.payloadFingerprint,
      });

      const isKeyframeMotionPromptOnly = Boolean(
        options.keyframeMotionPromptOnly ||
        options.originalOptions?.keyframeMotionPromptOnly
      );

      if (isKeyframeMotionPromptOnly) {
        await appendAppLog(sceneId, {
          source: "main",
          kind: "running",
          text: `Scene ${sceneId}: NV1 sent and owned by the current chat. Waiting live for the image without reload.`,
        });
      }
    }
  }

  const ownedNv1State = await getConversationState(page);
  if (ownedNv1State?.latestUserMessageHash !== expectedNv1PromptHash) {
    throw new Error("nv1-user-message-ownership-lost-before-image-wait");
  }
  const ownedNv1Location = await getChatGptLocationState(page).catch(() => ({}));
  const ownedConversationId =
    ownedNv1Location?.conversationId ||
    String(ownedNv1Location?.path || ownedNv1Location?.url || "").match(
      /\/c\/([^/?#]+)/,
    )?.[1] ||
    "";
  if (
    expectedConversationId &&
    ownedConversationId !== expectedConversationId
  ) {
    throw new Error(
      `chatgpt-conversation-changed-after-nv1-send:${expectedConversationId}:${ownedConversationId || "none"}`,
    );
  }
  expectedConversationId = expectedConversationId || ownedConversationId;
  snapshot.sentPromptHash = expectedNv1PromptHash;
  snapshot.sentPayloadFingerprint = nv1Payload.payloadFingerprint;
  snapshot.chatGptConversationId = expectedConversationId;
  await writeSceneSnapshot(sceneDir, snapshot);
  await persistDurableStage?.(projectDir, sceneId, "nv1_sent", {
    nv1RequestPath: requestArtifact.filePath,
    nv1RequestSha256: requestArtifact.contentSha256,
    nv1ControlPromptHash: expectedNv1PromptHash,
    nv1PayloadFingerprint: nv1Payload.payloadFingerprint,
    expectedAttachmentNames: nv1Payload.expectedAttachmentNames,
    sentPayloadFingerprint: nv1Payload.payloadFingerprint,
    chatGptConversationId: expectedConversationId,
  });

  const imageNetworkCapture = startChatGptImageNetworkCapture(page, { sceneId });
  try {
    snapshot.pipelineStage = "WAIT_IMAGE";
    await setChatGptTaskState(sceneDir, "NV1", "WAIT", { sceneId });
    await writeSceneSnapshot(sceneDir, snapshot);
    
    assertPipelineRunActive(runId);
    await saveChatGPTGeneratedImageAsset(page, {
      existingUrls: [],
      minImageAgentTurnIndex: Number(options.beforeImageAgentTurnCount || 0),
      prompt: finalNv1Prompt,
      sceneDir,
      sceneId,
      outputPath: imagePath,
      referenceImagePaths: [],
      networkCapture: imageNetworkCapture,
      originalOptions: options,
      expectedConversationId,
      expectedUserPromptHash: expectedNv1PromptHash,
      requestArtifact,
      payload: nv1Payload,
    });
    
    snapshot.pipelineStage = "IMAGE_EXTRACTED";
    snapshot.imageValidated = true;
    await writeSceneSnapshot(sceneDir, snapshot);
    await setChatGptTaskState(sceneDir, "NV1", "VALIDATE", { sceneId });
    await setChatGptTaskState(sceneDir, "NV1", "SAVE", {
      sceneId,
      imagePath,
    });
    await setChatGptTaskState(sceneDir, "NV1", "COMPLETE", {
      sceneId,
      imagePath,
    });
  } finally {
    imageNetworkCapture.stop();
  }

  return { imagePath, motionPrompt: "" };
  } finally {
    await page.close().catch(() => null);
  }
}

async function generateMotionPromptWithChatGPT({
  imagePath,
  prompt,
  requestArtifact,
  sceneDir,
  sceneId,
  sceneText = "",
  chatContextTitle = "",
  chatGptStability = {},
  keyframeMotionPromptOnly = false,
  runId = "",
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
      requestArtifact,
      sceneDir,
      sceneId,
      sceneText,
      chatContextTitle,
      chatGptStability,
      keyframeMotionPromptOnly,
      runId,
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
    requestArtifact,
    sceneDir,
    sceneId,
    sceneText = "",
    chatContextTitle = "",
    chatGptStability = {},
    keyframeMotionPromptOnly = false,
    runId = "",
  },
  lockInfo = {},
) {
  let page;
  try {
    let snapshot = await readSceneSnapshot(sceneDir);
    const projectDir = path.dirname(sceneDir);
    const motionPromptFile = path.join(sceneDir, "motion_prompt.txt");

    if (snapshot.motionValidated || (await pathExists(motionPromptFile))) {
      const cachedMotionPrompt = await fs
        .readFile(motionPromptFile, "utf8")
        .catch(() => "");
      const cachedMotionValidation = validateMotionPromptTextContent(
        cachedMotionPrompt,
      );
      if (cachedMotionValidation.ok) {
        snapshot.pipelineStage = "WAIT_VIDEO";
        snapshot.motionValidated = true;
        await writeSceneSnapshot(sceneDir, snapshot);
        return cachedMotionValidation.text;
      }
      snapshot.motionValidated = false;
      snapshot.cachedMotionRejectedAt = new Date().toISOString();
      snapshot.cachedMotionRejectedReason = cachedMotionValidation.error;
      await writeSceneSnapshot(sceneDir, snapshot);
      await appendAppLog(sceneId, {
        source: "main",
        kind: "warning",
        text: `Scene ${sceneId}: cached motion_prompt.txt failed the NV2 quality gate; waiting for a new owned response.`,
        details: cachedMotionValidation,
      }).catch(() => null);
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

    const currentChatStateForPipeline = await getChatGptLocationState(page).catch(() => ({}));
    let exactConversationUrl = currentChatStateForPipeline?.safeUrl || currentChatStateForPipeline?.url || "";
    const currentConversationId = conversationIdFromLocation(currentChatStateForPipeline);
    const expectedConversationId = String(snapshot.chatGptConversationId || currentConversationId || "").trim();
    if (!expectedConversationId) {
      throw new Error("nv2-conversation-ownership-unavailable-before-send");
    }
    if (snapshot.chatGptConversationId && currentConversationId !== snapshot.chatGptConversationId) {
      const isManualMode = Boolean(
        options.manualChatGPT ||
        options.pipelineMode === 'manualChatGPT' ||
        globalThis.__vidoraManualChatGPTMode
      );
      if (isManualMode || currentConversationId) {
        snapshot.chatGptConversationId = currentConversationId || snapshot.chatGptConversationId;
      } else {
        throw new Error(
          `chatgpt-conversation-changed-before-nv2:${snapshot.chatGptConversationId}:${currentConversationId || "none"}`,
        );
      }
    }

    if (!requestArtifact?.filePath || !requestArtifact?.controlPrompt) {
      throw new Error(`Scene ${sceneId}: missing NV2 request artifact.`);
    }
    const nv2Payload = await createComposerPayload({
      stage: "NV2",
      sceneId,
      controlPrompt: requestArtifact.controlPrompt,
      expectedFilePaths: [imagePath, requestArtifact.filePath],
    });
    if (nv2Payload.localFileSha256s[1] !== requestArtifact.contentSha256) {
      throw new Error(`Scene ${sceneId}: scene-request-file-hash-mismatch`);
    }
    const instruction = nv2Payload.controlPrompt;
    const instructionHash = hashChatGptSnapshotText(instruction);

    const beforeSnapshot = await evaluateOnCdpPage(
      page,
      `(${readAssistantMessageSnapshotScript.toString()})()`,
    ).catch((error) => ({ ok: false, error: error.message, ids: [], hashes: [], messages: [] }));
    const beforeRootCount = await evaluateOnCdpPage(
      page,
      `(${countChatGptAssistantRootsScript.toString()})()`,
    ).catch((error) => ({ ok: false, error: error.message, count: null }));
    const beforeCountFromSnapshot = Number(beforeSnapshot?.count);
    const beforeCountFromRoots = Number(beforeRootCount?.count);
    const beforeCount = Number.isFinite(beforeCountFromSnapshot)
      ? beforeCountFromSnapshot
      : Number.isFinite(beforeCountFromRoots)
        ? beforeCountFromRoots
        : 0;

    let before = {
      count: beforeCount,
      userCount: beforeSnapshot?.userCount || 0,
      maxTurnIndex: Number.isFinite(Number(beforeSnapshot?.maxTurnIndex)) ? Number(beforeSnapshot.maxTurnIndex) : -1,
      text: beforeSnapshot?.messages?.at?.(-1)?.text || "",
      ids: beforeSnapshot?.ids || [],
      hashes: beforeSnapshot?.hashes || [],
      userIds: beforeSnapshot?.userIds || [],
      userHashes: beforeSnapshot?.userHashes || [],
      url: exactConversationUrl,
    };
    await appendAppLog(sceneId, {
      source: "main",
      kind: "running",
      text: `Scene ${sceneId}: NV2 before snapshot captured (assistant=${before.count}, textLength=${String(before.text || "").length}).`,
      details: {
        beforeCount: before.count,
        snapshotCount: Number.isFinite(beforeCountFromSnapshot) ? beforeCountFromSnapshot : null,
        rootCount: Number.isFinite(beforeCountFromRoots) ? beforeCountFromRoots : null,
        snapshotError: beforeSnapshot?.error || null,
        rootCountError: beforeRootCount?.error || null,
        userCount: before.userCount,
        assistantHashCount: before.hashes.length,
        userHashCount: before.userHashes.length,
      },
    }).catch(() => null);

    let pageState = await getConversationState(page);
    await checkProactiveMemoryGuard(sceneId, pageState);

    const currentPayloadMatchesSnapshot = [
      snapshot.sentPayloadFingerprint,
      snapshot.payloadFingerprint,
    ].includes(nv2Payload.payloadFingerprint);
    const nv2PreviouslyProvenSent = Boolean(
      currentPayloadMatchesSnapshot &&
        (snapshot.pipelineStage === "NV2_SENT" ||
          snapshot.sentPromptHash === instructionHash ||
          snapshot.nv2SentAt),
    );
    const liveOwnedPromptBaseline =
      pageState.latestUserMessageHash === instructionHash
        ? buildNv2OwnedPromptBaseline(
            beforeSnapshot,
            instructionHash,
            before,
          )
        : null;
    const nv2PromptAlreadySent =
      currentPayloadMatchesSnapshot && Boolean(liveOwnedPromptBaseline);
    if (liveOwnedPromptBaseline) {
      before = liveOwnedPromptBaseline;
      snapshot.nv2Baseline = liveOwnedPromptBaseline;
      snapshot.nv2UserTurnIndex = liveOwnedPromptBaseline.nv2UserTurnIndex;
    }
    if (snapshot.manualNv2RetryRequested === true) {
      snapshot.manualNv2RetryRequested = false;
      snapshot.manualNv2RetryRunId = "";
      snapshot.manualNv2RetryConsumedAt = new Date().toISOString();
      snapshot.manualNv2RetryConsumedReason =
        "legacy-retry-request-suppressed-by-no-resend-policy";
      await writeSceneSnapshot(sceneDir, snapshot);
      await appendAppLog(sceneId, {
        source: "main",
        kind: "warning",
        text: `Scene ${sceneId}: suppressed a legacy NV2 retry request; recovery will only resume the already-sent owned turn.`,
      }).catch(() => null);
    }

    if (
      snapshot.nv2ResponseWaitExhausted === true &&
      snapshot.nv2TimeoutPromptHash === instructionHash
    ) {
      throw new Error("nv2-response-timeout-no-resend");
    }

    // If we are resuming from NV2_SENT, first prove the current chat actually has this NV2 prompt.
    if (snapshot.pipelineStage === "NV2_SENT" && nv2PromptAlreadySent) {
      await appendAppLog(sceneId, {
        source: "main",
        kind: "running",
        text: `Scene ${sceneId}: Resuming NV2 from stage NV2_SENT.`
      });
    } else {
      if (nv2PreviouslyProvenSent && !nv2PromptAlreadySent) {
        await appendAppLog(sceneId, {
          source: "main",
          kind: "warning",
          text: `Scene ${sceneId}: NV2_SENT ownership cannot be proven in the current chat; failing closed without upload or resend.`,
          details: {
            latestUserMessageHash: pageState.latestUserMessageHash || "",
            instructionHash,
            beforeUserHashCount: before.userHashes.length,
          },
        }).catch(() => null);
        throw new Error("nv2-sent-prompt-ownership-unavailable-no-resend");
      }
      snapshot.pipelineStage = "NV2_DRAFT_READY";
      await setChatGptTaskState(sceneDir, "NV2", "SEND", { sceneId });
      snapshot.promptHash = instructionHash;
      snapshot.controlPromptHash = instructionHash;
      snapshot.payloadFingerprint = nv2Payload.payloadFingerprint;
      snapshot.expectedAttachmentNames = nv2Payload.expectedAttachmentNames;
      snapshot.localFileSha256s = nv2Payload.localFileSha256s;
      snapshot.attachmentCount = nv2Payload.expectedFilePaths.length;
      snapshot.draftId = `draft-scene-${sceneId}-nv2-${Date.now()}`;
      snapshot.createdAt = new Date().toISOString();
      await writeSceneSnapshot(sceneDir, snapshot);

      const isDraftMatches =
        verifyDraftOwnership(snapshot, pageState, nv2Payload.expectedFilePaths) &&
        pageState.composerReady;
      if (isDraftMatches) {
        await appendAppLog(sceneId, {
          source: "main",
          kind: "ok",
          text: `Scene ${sceneId}: Valid unsent NV2 draft recovered in composer. Skipping upload & pasting; clicking Send.`
        });
        const recovered = await sendNv2PromptViaDeepCdpInput(page, instruction, {
          sceneId,
          stage: "motion_prompt_recovered_draft",
          attemptId: lockInfo.attemptId,
          beforeCount: before.count,
          expectedFilePaths: nv2Payload.expectedFilePaths,
          payloadFingerprint: nv2Payload.payloadFingerprint,
        });
        if (!recovered.ok) {
          throw new Error(`Failed to send recovered NV2 draft: ${recovered.error}`);
        }
        const recoveredOwnedState = await getConversationState(page).catch(
          () => ({}),
        );
        if (recoveredOwnedState?.latestUserMessageHash !== instructionHash) {
          throw new Error(
            "nv2-recovered-draft-user-message-ownership-not-confirmed",
          );
        }
        const recoveredOwnedSnapshot = await evaluateOnCdpPage(
          page,
          `(${readAssistantMessageSnapshotScript.toString()})()`,
        ).catch(() => ({}));
        const recoveredOwnedBaseline = buildNv2OwnedPromptBaseline(
          recoveredOwnedSnapshot,
          instructionHash,
          before,
        );
        if (!recoveredOwnedBaseline) {
          throw new Error("nv2-recovered-draft-owned-baseline-unavailable");
        }
        before = recoveredOwnedBaseline;
        snapshot.pipelineStage = "NV2_SENT";
        snapshot.nv2Baseline = recoveredOwnedBaseline;
        snapshot.nv2UserTurnIndex = recoveredOwnedBaseline.nv2UserTurnIndex;
        snapshot.sentPromptHash = instructionHash;
        snapshot.sentPayloadFingerprint = nv2Payload.payloadFingerprint;
        snapshot.nv2ResponseWaitExhausted = false;
        snapshot.nv2TimeoutPromptHash = "";
        await writeSceneSnapshot(sceneDir, snapshot);
      } else {
        const userPromptMatches =
          currentPayloadMatchesSnapshot &&
          Boolean(liveOwnedPromptBaseline);
        if (userPromptMatches) {
          await appendAppLog(null, {
            source: "main",
            kind: "ok",
            text: `Scene ${sceneId}: NV2 Prompt already sent. Proceeding to wait for response.`,
          });
          snapshot.pipelineStage = "NV2_SENT";
          snapshot.sentPromptHash = instructionHash;
          snapshot.sentPayloadFingerprint = nv2Payload.payloadFingerprint;
          await writeSceneSnapshot(sceneDir, snapshot);
        } else {
          await appendAppLog(null, {
            source: "main",
            kind: "running",
            text: `Scene ${sceneId}: Uploading current scene keyframe before NV2.`,
            details: { image: path.basename(imagePath || "") },
          });
          let nv2ImageUpload = await uploadFilesToChatGptSequentially(
            page,
            nv2Payload.expectedFilePaths,
            sceneId,
            {
              trailingUploadLog: `Scene ${sceneId}: Uploading current scene keyframe for NV2...`,
              request: "nv2-keyframe-and-request-file",
            },
          );
          if (!nv2ImageUpload?.ok) {
            await appendAppLog(sceneId, {
              source: "main",
              kind: "warning",
              text: `Scene ${sceneId}: Initial NV2 keyframe upload failed (${nv2ImageUpload?.error}); reloading conversation page for DOM refresh...`,
              details: { error: nv2ImageUpload?.error },
            }).catch(() => null);
            await reloadCurrentChatAndVerify(
              page,
              expectedConversationId,
              sceneId,
              "nv2-initial-upload-recovery",
              { allowFailedDraftRefresh: true },
            ).catch(() => null);
            await clearUnexpectedAttachments(page, []).catch(() => null);
            await sleep(1500);
            nv2ImageUpload = await uploadFilesToChatGptSequentially(
              page,
              nv2Payload.expectedFilePaths,
              sceneId,
              {
                trailingUploadLog: `Scene ${sceneId}: Retrying keyframe upload after page reload...`,
                request: "nv2-keyframe-and-request-file-retry",
              },
            );
          }
          if (!nv2ImageUpload?.ok) {
            throw new Error(`Scene ${sceneId}: ChatGPT NV2 keyframe upload failed: ${nv2ImageUpload?.error || "unknown"}`);
          }
          if (!snapshot.hydration) snapshot.hydration = {};
          snapshot.hydration.sceneUploadDone = true;
          snapshot.attachmentsVerifiedAt = new Date().toISOString();
          await writeSceneSnapshot(sceneDir, snapshot);
          await persistDurableStage?.(projectDir, sceneId, "nv2_attachments_ready", {
            keyframePath: imagePath,
            nv2RequestPath: requestArtifact.filePath,
            nv2RequestSha256: requestArtifact.contentSha256,
            nv2ControlPromptHash: nv2Payload.controlPromptHash,
            nv2PayloadFingerprint: nv2Payload.payloadFingerprint,
            expectedAttachmentNames: nv2Payload.expectedAttachmentNames,
            attachmentsVerifiedAt: snapshot.attachmentsVerifiedAt,
          });

          pageState = await getConversationState(page);
          snapshot.attachmentHashes = pageState.attachmentHashes || [];
          await writeSceneSnapshot(sceneDir, snapshot);

          const sent = await sendNv2PromptViaDeepCdpInput(page, instruction, {
            sceneId,
            stage: "motion_prompt",
            attemptId: lockInfo.attemptId,
            beforeCount: before.count,
            expectedFilePaths: nv2Payload.expectedFilePaths,
            payloadFingerprint: nv2Payload.payloadFingerprint,
          });
          if (!sent.ok) {
            const afterFirstSend = await getConversationState(page).catch(() => ({}));
            if (afterFirstSend?.latestUserMessageHash !== instructionHash) {
              await reloadCurrentChatAndVerify(
                page,
                expectedConversationId,
                sceneId,
                "nv2-send-recovery",
                { allowFailedDraftRefresh: true },
              );
              const retryUpload = await uploadFilesToChatGptSequentially(
                page,
                nv2Payload.expectedFilePaths,
                sceneId,
                { request: "nv2-keyframe-and-request-file-recovery" },
              );
              if (!retryUpload?.ok) {
                throw new Error(`Scene ${sceneId}: NV2 recovery keyframe upload failed: ${retryUpload?.error || "unknown"}`);
              }
              const retrySent = await sendNv2PromptViaDeepCdpInput(page, instruction, {
                sceneId,
                stage: "motion_prompt_recovery",
                attemptId: lockInfo.attemptId,
                beforeCount: before.count,
                expectedFilePaths: nv2Payload.expectedFilePaths,
                payloadFingerprint: nv2Payload.payloadFingerprint,
              });
              const afterRetrySend = await getConversationState(page).catch(() => ({}));
              if (!retrySent?.ok || afterRetrySend?.latestUserMessageHash !== instructionHash) {
                throw new Error(retrySent?.error || "Không gửi được Nhiệm vụ 2 vào ChatGPT sau một lần phục hồi.");
              }
            }
          }
          const ownedNv2State = await getConversationState(page).catch(() => ({}));
          if (ownedNv2State?.latestUserMessageHash !== instructionHash) {
            throw new Error("nv2-user-message-not-confirmed-after-send");
          }
          const ownedNv2Snapshot = await evaluateOnCdpPage(
            page,
            `(${readAssistantMessageSnapshotScript.toString()})()`,
          ).catch(() => ({}));
          const ownedNv2Baseline = buildNv2OwnedPromptBaseline(
            ownedNv2Snapshot,
            instructionHash,
            before,
          );
          if (!ownedNv2Baseline) {
            throw new Error("nv2-sent-owned-baseline-unavailable");
          }
          before = ownedNv2Baseline;

          if (!snapshot.hydration) snapshot.hydration = {};
          snapshot.hydration.promptUploadDone = true;
          snapshot.pipelineStage = "NV2_SENT";
          snapshot.nv2Baseline = before;
          snapshot.nv2UserTurnIndex = before.nv2UserTurnIndex ?? null;
          snapshot.nv2SentAt = new Date().toISOString();
          snapshot.sentPromptHash = instructionHash;
          snapshot.sentPayloadFingerprint = nv2Payload.payloadFingerprint;
          snapshot.nv2AttemptId = lockInfo.attemptId || "";
          snapshot.nv2ResponseWaitExhausted = false;
          snapshot.nv2TimeoutPromptHash = "";
          await writeSceneSnapshot(sceneDir, snapshot);
          await persistDurableStage?.(projectDir, sceneId, "nv2_sent", {
            keyframePath: imagePath,
            nv2RequestPath: requestArtifact.filePath,
            nv2RequestSha256: requestArtifact.contentSha256,
            nv2ControlPromptHash: instructionHash,
            nv2PayloadFingerprint: nv2Payload.payloadFingerprint,
            expectedAttachmentNames: nv2Payload.expectedAttachmentNames,
            sentPayloadFingerprint: nv2Payload.payloadFingerprint,
          });

          if (keyframeMotionPromptOnly) {
            await appendAppLog(sceneId, {
              source: "main",
              kind: "running",
              text: `Scene ${sceneId}: NV2 sent. Waiting for stable response without timed refresh.`,
            });
          }
        }
      }
    }

    await persistDurableStage?.(projectDir, sceneId, "nv2_sent", {
      keyframePath: imagePath,
      nv2RequestPath: requestArtifact.filePath,
      nv2RequestSha256: requestArtifact.contentSha256,
      nv2ControlPromptHash: instructionHash,
      nv2PayloadFingerprint: nv2Payload.payloadFingerprint,
      expectedAttachmentNames: nv2Payload.expectedAttachmentNames,
      sentPayloadFingerprint: nv2Payload.payloadFingerprint,
    });

    await logChatGptStage(page, CHATGPT_STAGES.WAITING_RESPONSE, {
      sceneId,
      stage: "motion_prompt",
      attempt: 1,
    }).catch(() => null);
    await setChatGptTaskState(sceneDir, "NV2", "WAIT", { sceneId });

    let result;
    try {
      result = await waitForChatGptResponse(page, before, {
        sceneId,
        promptText: instruction,
        promptHash: instructionHash,
        targetTitle: chatContextTitle,
        stage: "motion-prompt-response",
        chatGptStability,
        refreshAfterMs: undefined,
        refreshReason: undefined,
        expectedConversationId,
        runId,
      });
    } catch (responseError) {
      const responseErrorText = String(
        responseError?.message || responseError || "",
      );
      const timeoutExhausted =
        /Timeout waiting for NV2 response after two/i.test(responseErrorText);
      const ownershipFailed =
        /nv2-user-message-ownership|nv2-conversation-ownership|chatgpt-conversation-changed-during-nv2/i.test(
          responseErrorText,
        );
      if (timeoutExhausted || ownershipFailed) {
        snapshot.pipelineStage = "NV2_SENT";
        snapshot.sentPromptHash = instructionHash;
        snapshot.sentPayloadFingerprint = nv2Payload.payloadFingerprint;
        snapshot.nv2ResponseWaitExhausted = timeoutExhausted;
        snapshot.nv2TimeoutPromptHash = timeoutExhausted
          ? instructionHash
          : snapshot.nv2TimeoutPromptHash || "";
        snapshot.nv2NoResendFailureAt = new Date().toISOString();
        snapshot.nv2NoResendFailureReason = responseErrorText;
        await writeSceneSnapshot(sceneDir, snapshot);
        await persistDurableStage?.(projectDir, sceneId, "nv2_sent", {
          keyframePath: imagePath,
          motionPromptPath: motionPromptFile,
          nv2ControlPromptHash: instructionHash,
          nv2PayloadFingerprint: nv2Payload.payloadFingerprint,
          sentPayloadFingerprint: nv2Payload.payloadFingerprint,
          nv2NoResend: true,
          nv2ResponseWaitExhausted: timeoutExhausted,
          lastError: responseErrorText,
        });
        throw new Error(
          timeoutExhausted
            ? "nv2-response-timeout-no-resend"
            : `nv2-owned-response-wait-failed-no-resend:${responseErrorText}`,
        );
      }
      throw responseError;
    }
    if (!result?.ok) {
      throw new Error(result?.error || "IMAGE_STAGE NV2 response waiting failed.");
    }

    const stableText = String(result.text || "").trim();
    const finalNv2State = await getConversationState(page).catch(() => ({}));
    const finalNv2Location = await getChatGptLocationState(page).catch(
      () => ({}),
    );
    const finalOwnership = validateNv2ResponseOwnership({
      expectedPromptHash: instructionHash,
      latestUserHash: finalNv2State?.latestUserMessageHash || "",
      expectedConversationId,
      currentConversationId:
        conversationIdFromLocation(finalNv2Location) ||
        finalNv2State?.currentChatId ||
        "",
    });
    if (!finalOwnership.ok) {
      throw new Error(
        `nv2-final-save-ownership-failed-no-resend:${finalOwnership.error}`,
      );
    }
    const finalTextQuality = validateMotionPromptTextContent(stableText, {
      beforeText: before?.text || "",
      instruction,
    });
    if (!finalTextQuality.ok) {
      throw new Error(
        `nv2-final-save-quality-failed-no-resend:${finalTextQuality.error}`,
      );
    }
    await setChatGptTaskState(sceneDir, "NV2", "VALIDATE", {
      sceneId,
      chars: stableText.length,
    });
    await fs.writeFile(motionPromptFile, stableText, "utf8");
    await fs.writeFile(path.join(sceneDir, "motion_prompt_from_chatgpt.txt"), stableText, "utf8").catch(() => null);
    await setChatGptTaskState(sceneDir, "NV2", "SAVE", {
      sceneId,
      motionPromptFile,
    });

    snapshot.pipelineStage = "WAIT_VIDEO";
    snapshot.motionValidated = true;
    snapshot.nv2ResponseWaitExhausted = false;
    snapshot.nv2TimeoutPromptHash = "";
    snapshot.nv2NoResendFailureReason = "";
    await writeSceneSnapshot(sceneDir, snapshot);
    await setChatGptTaskState(sceneDir, "NV2", "COMPLETE", {
      sceneId,
      motionPromptFile,
    });

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
  const contentQuality = validateMotionPromptTextContent(text, {
    beforeText,
    instruction,
    taskPrompt,
  });
  if (!contentQuality.ok) return contentQuality;

  const generation = state ? state.generation : false;
  const streamingIndicator = state ? state.streamingIndicator : false;
  if (generation === false && streamingIndicator === false) {
    return { ok: true };
  }

  return {
    ok: false,
    error: "still-generating-or-streaming",
  };
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

function normalizeNv1NetworkAssetUrl(value = "") {
  const url = String(value || "").trim();
  if (!/^https?:/i.test(url)) return "";
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch (_error) {
    return url;
  }
}

function networkCandidateMatchesOwnedNv1Card(item = {}, ownedCardScope = {}) {
  if (
    ownedCardScope.ownershipConfirmed !== true ||
    ownedCardScope.cardReady !== true ||
    !Number.isInteger(Number(ownedCardScope.ownedRootIndex)) ||
    Number(ownedCardScope.ownedRootIndex) < 0
  ) {
    return false;
  }
  const candidateUrl = normalizeNv1NetworkAssetUrl(item.url);
  if (!candidateUrl) return false;
  const ownedUrls = new Set(
    (ownedCardScope.ownedImageUrls || [])
      .map(normalizeNv1NetworkAssetUrl)
      .filter(Boolean),
  );
  return ownedUrls.has(candidateUrl);
}

async function tryExtractChatGptNetworkImage(
  client,
  capture,
  ownedCardScope = {},
) {
  if (!capture?.candidates)
    return { ok: false, mode: "network-capture-unavailable" };
  const candidates = capture
    .candidates()
    .filter(
      (item) =>
        item.finished &&
        /^image\/(png|jpe?g|webp)/i.test(item.mimeType || "") &&
        networkCandidateMatchesOwnedNv1Card(item, ownedCardScope),
    );
  if (!candidates.length) {
    return {
      ok: false,
      mode: "no-network-image-owned-by-current-card",
      ownedRootIndex: Number(ownedCardScope.ownedRootIndex ?? -1),
      ownedUrlCount: (ownedCardScope.ownedImageUrls || []).length,
    };
  }
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
      if (decoded.width < 512 || decoded.height < 512 || buffer.length < 120000) {
        rejected.push({
          requestId: item.requestId,
          reason: "network-image-not-final-enough",
          width: decoded.width,
          height: decoded.height,
          byteLength: buffer.length,
        });
        continue;
      }
      return {
        ok: true,
        base64,
        contentType: item.mimeType || "image/png",
        byteLength: buffer.length,
        width: decoded.width,
        height: decoded.height,
        method: "network",
        sourceKind: "cdp-network-response",
        rootIndex: Number(ownedCardScope.ownedRootIndex),
        networkOwnershipConfirmed: true,
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

  if (
    (method === "network" || sourceKind.includes("network")) &&
    width >= 512 &&
    height >= 512 &&
    byteLength >= 120000
  ) {
    return true;
  }

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

const CHATGPT_GRAY_PLACEHOLDER_TIMEOUT_MS = 30000;

async function waitForChatGptImageGenerationDoneBeforeExtract(
  client,
  options = {},
) {
  const sceneId =
    (typeof options !== "undefined" && options?.sceneId) ||
    (typeof context !== "undefined" && context?.sceneId) ||
    "";
  const runId = String(options.runId || options.originalOptions?.runId || "").trim();

  const ChatGptPipelineAdapter = require("./chatgpt_pipeline_adapter");
  const chatGptRuntimeMonitor = require("./chatgpt_runtime_monitor");
  const adapter = new ChatGptPipelineAdapter(chatGptRuntimeMonitor);

  try {
    // 5-second short timeout to prevent blocking wait loop if monitor stalls
    const result = await adapter.waitForImageReady(5000, 2000);
    const snapshot = chatGptRuntimeMonitor.captureSnapshot();
    return {
      ok: true,
      imageState: snapshot,
    };
  } catch (error) {
    if (isPipelineCancelledError(error)) throw error;
    
    const snapshot = chatGptRuntimeMonitor.captureSnapshot();
    
    if (snapshot.metrics.dom.stoppedTextDetected) {
      return {
        ok: false,
        retryReason: "chatgpt-stopped-creating-image",
        imageState: snapshot,
      };
    }
    if (snapshot.metrics.dom.policyRefusalDetected) {
      return {
        ok: false,
        retryReason: "chatgpt-policy-refusal",
        imageState: snapshot,
      };
    }
    
    // Fallback/Bypass: Return ok: true on timeout so the pipeline can proceed to scan/poll DOM
    return {
      ok: true,
      imageState: snapshot,
      bypassed: true,
      error: error.message,
    };
  }
}

// ============================================================================
// waitForLatestChatGPTGeneratedImage — architecture
// ----------------------------------------------------------------------------
// The wait loop is split into named phases, each a standalone helper:
//   ImageWaitContext            - mutable state carried across loop ticks
//   detectImageWaitProgress     - progress detection (resets lastProgressAt)
//   maybeRefreshChatGptImageWaitPage - periodic refresh (fixed schedule)
//   pollChatGptRuntime          - runtime monitor snapshot
//   pollChatGptDom              - direct DOM polling (active response / image turn)
//   maybeHydrateChatGptImage    - hydration, gated on an image turn existing
//   scanChatGptImageCandidates  - DOM / network / screenshot extraction
//   validateChatGptImageCandidate - rejects dot-loading placeholder canvases
//   updateCandidateStability    - stableTicks, scoped to a single candidate
//   shouldRetryChatGptImageWait - retry gate (timeout + stall + not generating)
// The orchestrating function, waitForLatestChatGPTGeneratedImage, wires these
// together but keeps its external signature, return value, and thrown errors
// unchanged.
// ============================================================================

const IMAGE_WAIT_REFRESH_INTERVAL_MS = 60000;
const IMAGE_WAIT_GRAY_CANVAS_REFRESH_MS = 60000;
const IMAGE_WAIT_STABLE_TICKS_REQUIRED = 2;
const IMAGE_WAIT_TEXT_ONLY_STABLE_TICKS_REQUIRED = 2;
const IMAGE_WAIT_READY_TICKS_REQUIRED = 8;
const IMAGE_WAIT_INITIAL_TIMEOUT_MS = 480000;
const IMAGE_WAIT_AFTER_REFRESH_TIMEOUT_MS = 300000;
const IMAGE_WAIT_AFTER_RESEND_TIMEOUT_MS = 480000;
const IMAGE_WAIT_REAL_STALL_MS = 300000;
// Threshold used by the retry gate for both "global timeout exceeded" and
// "no progress for a long timeout" (see shouldRetryChatGptImageWait). Chosen
// to match the old readyTicks >= 8 heuristic (~8 ticks at the loop's typical
// cadence) without changing observed retry timing.
const IMAGE_WAIT_LONG_NO_PROGRESS_MS = 120000;

/**
 * Mutable state for a single waitForLatestChatGPTGeneratedImage() call.
 * Carried across every tick of the inner while-loop (but NOT reset by a
 * periodic refresh - see maybeRefreshChatGptImageWaitPage).
 */
class ImageWaitContext {
  constructor(startedAt) {
    this.startedAt = startedAt;
    this.lastProgressAt = startedAt;
    this.nextRefreshAt = startedAt + IMAGE_WAIT_REFRESH_INTERVAL_MS;
    this.refreshCount = 0;
    this.stableTicks = 0;
    this.lastSignature = "";
    this.knownUrls = new Set();
    this.lastSnapshot = null;
    this.lastHydrationAt = 0;
    this.grayCanvasFirstSeenAt = 0;
    this.grayCanvasRefreshCount = 0;
    this.staleWrapperFirstSeenAt = 0;
    this.staleWrapperRefreshCount = 0;
    this.expectedConversationId = "";
    this.expectedUserPromptHash = "";
    this.justReloaded = false;
    this.imageTurnScopeRebased = false;
    this.ownedRebasedImageVisible = false;
    this.lastImageTurnScopeSignature = "";
    this.ownedTextSignature = "";
    this.ownedTextStableTicks = 0;
    // Internal fingerprint cache used by detectImageWaitProgress to tell
    // "changed" from "same" between ticks. Not part of the public shape.
    this._progressFingerprint = "";
  }
}

/**
 * Progress detection.
 * Progress is anything observably new: assistant message count, latest
 * assistant text, the current image-candidate signature, captured image
 * urls, or runtime monitor state. Any progress resets ctx.lastProgressAt.
 * Returns true if progress was detected on this tick.
 */
function detectImageWaitProgress(ctx, signals) {
  const {
    assistantCount = 0,
    latestAssistantText = "",
    candidateSignature = "",
    urls = [],
    runtimeState = "",
  } = signals || {};

  const fingerprint = JSON.stringify([
    assistantCount,
    latestAssistantText,
    candidateSignature,
    [...urls].sort(),
    runtimeState,
  ]);

  const progressed = fingerprint !== ctx._progressFingerprint;
  if (progressed) {
    ctx.lastProgressAt = Date.now();
    ctx._progressFingerprint = fingerprint;
  }
  return progressed;
}

/**
 * Periodic refresh.
 * Fires on a fixed schedule (every REFRESH_INTERVAL_MS of wall-clock time
 * since the wait started): ctx.nextRefreshAt += REFRESH_INTERVAL_MS, never
 * Date.now() + REFRESH_INTERVAL_MS, so refreshes don't drift or bunch up.
 * A refresh never resets waiting state - it doesn't touch lastProgressAt,
 * stableTicks, lastSignature, or any other progress/stability bookkeeping.
 */
async function maybeRefreshChatGptImageWaitPage(
  ctx,
  client,
  sceneId,
  options = {},
) {
  if (!options.force) return false;
  if (ctx.refreshCount >= 1) return false;

  const expectedConversationId = String(
    options.expectedConversationId || ctx.expectedConversationId || "",
  ).trim();
  const expectedUserPromptHash = String(
    options.expectedUserPromptHash || ctx.expectedUserPromptHash || "",
  ).trim();

  await appendAppLog(sceneId, {
    source: "main",
    kind: "warning",
    text: `Scene ${sceneId}: completed image wrapper is stale after generation stopped; refreshing the same ChatGPT conversation once.`,
    details: {
      reason: options.reason || "stale-image-wrapper",
      refreshCount: ctx.refreshCount,
      ...(options.details || {}),
    },
  }).catch(() => null);

  await reloadCurrentChatAndVerify(
    client,
    expectedConversationId,
    sceneId,
    options.reason || "stale-image-wrapper",
    { allowStaleNv1WrapperRefresh: true },
  );
  const ownership = await getConversationState(client).catch(() => ({}));
  if (
    expectedUserPromptHash &&
    ownership?.latestUserMessageHash !== expectedUserPromptHash
  ) {
    throw new Error("nv1-user-message-ownership-lost-after-stale-wrapper-refresh");
  }

  ctx.refreshCount += 1;
  ctx.justReloaded = true;
  ctx.stableTicks = 0;
  ctx.lastSignature = "";
  ctx._progressFingerprint = "";
  return true;
}

async function pollChatGptStaleImageWrapper(client) {
  return evaluateOnCdpPage(
    client,
    `(() => {
      const visible = (node) => {
        if (!node?.getBoundingClientRect) return false;
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 &&
          style.display !== 'none' && style.visibility !== 'hidden' &&
          Number(style.opacity || 1) > 0;
      };
      const stopVisible = [...document.querySelectorAll('button, [role="button"]')]
        .filter(visible)
        .some((node) => /stop generating|stop responding|stop|cancel|dừng|hủy/i.test(
          (node.textContent || '') + ' ' + (node.getAttribute('aria-label') || ''),
        ));
      const turns = [...document.querySelectorAll('.agent-turn')];
      const latestTurns = turns.slice(-2);
      const squareNodes = latestTurns.flatMap((turn) => [
        ...turn.querySelectorAll(
          'canvas, [class*="aspect-square"], [class*="imagegen"], [class*="placeholder"], [aria-busy="true"], [role="progressbar"]',
        ),
      ]).filter((node) => {
        if (!visible(node)) return false;
        const rect = node.getBoundingClientRect();
        const ratio = rect.width / Math.max(1, rect.height);
        return rect.width >= 220 && rect.height >= 220 && ratio >= 0.65 && ratio <= 1.55;
      });
      return {
        stopVisible,
        wrapperVisible: squareNodes.length > 0,
        wrapperCount: squareNodes.length,
        agentTurnCount: turns.length,
      };
    })()`,
  ).catch(() => ({
    stopVisible: false,
    wrapperVisible: false,
    wrapperCount: 0,
    agentTurnCount: 0,
  }));
}


function pollChatGptRuntime() {
  const monitorSnap = chatGptRuntimeMonitor.captureSnapshot();
  return {
    assistantCount: monitorSnap.metrics.dom.assistantMessageCount,
    preparingImage:
      monitorSnap.state === "IMAGE_PLACEHOLDER" || monitorSnap.state === "NETWORK_IMAGE",
    voiceReady: monitorSnap.metrics.dom.composerReady,
    latestAssistantText: monitorSnap.metrics.dom.latestAssistantText,
    loggedOut: monitorSnap.metrics.dom.loggedOut,
    urls: monitorSnap.metrics.network.dalleUrlsCaptured.map((u) => u.url),
    runtimeState: monitorSnap.state,
  };
}

/**
 * Direct DOM polling: is there an active assistant response, and is there
 * an "image turn" (an assistant node containing an image/canvas/loading
 * placeholder, or a visible stop-generating button)? maybeHydrateChatGptImage
 * only hydrates when hasImageTurn is true.
 */
function inspectNv1ImageTurnScopeScript(
  configuredMinImageAgentTurnIndex = 0,
  ownershipConfirmed = false,
) {
  const configuredMin = Math.max(
    0,
    Number(configuredMinImageAgentTurnIndex || 0),
  );
  const imageTurns = Array.from(document.querySelectorAll(".agent-turn")).filter(
    (turn) => turn.querySelector?.(".group\\/imagegen-image"),
  );
  const userNodes = Array.from(
    document.querySelectorAll(
      '[data-message-author-role="user"], [data-testid*="user-message"]',
    ),
  );
  const latestUserNode = userNodes.at(-1) || null;
  const followsLatestUser = (node) => {
    if (!latestUserNode || !node || latestUserNode === node) return false;
    try {
      return Boolean(
        latestUserNode.compareDocumentPosition(node) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      );
    } catch (_error) {
      return false;
    }
  };
  const turnsAfterLatestUser = latestUserNode
    ? imageTurns.filter(followsLatestUser)
    : [];
  const assistantNodes = Array.from(
    document.querySelectorAll(
      '[data-message-author-role="assistant"], [data-testid*="assistant-message"]',
    ),
  ).filter((node, index, nodes) => nodes.indexOf(node) === index);
  const assistantsAfterLatestUser = latestUserNode
    ? assistantNodes.filter(followsLatestUser)
    : [];
  const latestOwnedAssistant = assistantsAfterLatestUser.at(-1) || null;
  const ownedAssistantText = String(
    latestOwnedAssistant?.innerText || latestOwnedAssistant?.textContent || "",
  ).trim();
  const latestOwnedTurn = turnsAfterLatestUser.at(-1) || null;
  const latestOwnedCard = latestOwnedTurn?.querySelector?.(
    ".group\\/imagegen-image",
  );
  const ownedImageAgentTurnIndexes = turnsAfterLatestUser
    .map((turn) => imageTurns.indexOf(turn))
    .filter((index) => index >= 0);
  const latestOwnedImageAgentTurnIndex =
    ownedImageAgentTurnIndexes.at(-1) ?? -1;
  const sourceFromSrcset = (srcset = "") =>
    String(srcset || "")
      .split(",")
      .map((part) => part.trim().split(/\s+/)[0])
      .filter(Boolean)
      .at(-1) || "";
  const ownedImageUrls = Array.from(
    latestOwnedCard?.querySelectorAll?.(
      "img, picture source, source[srcset], source[src], a[href]",
    ) || [],
  )
    .map(
      (node) =>
        node.currentSrc ||
        node.src ||
        node.href ||
        node.getAttribute?.("src") ||
        sourceFromSrcset(node.getAttribute?.("srcset")) ||
        node.getAttribute?.("href") ||
        "",
    )
    .filter((value) => /^https?:/i.test(value));
  const completeImage = latestOwnedCard?.querySelector?.("img");
  const completeCanvas = latestOwnedCard?.querySelector?.("canvas");
  const imageReady = Boolean(
    completeImage?.complete &&
      completeImage.naturalWidth >= 256 &&
      completeImage.naturalHeight >= 256,
  );
  const canvasReady = Boolean(
    completeCanvas &&
      completeCanvas.width >= 256 &&
      completeCanvas.height >= 256,
  );
  const placeholderVisible = Boolean(
    latestOwnedCard?.querySelector?.(
      '[aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"], [class*="placeholder"], [class*="loading"], [class*="spinner"]',
    ),
  );
  const stopVisible = Array.from(
    document.querySelectorAll('button, [role="button"]'),
  ).some((button) => {
    const rect = button.getBoundingClientRect?.();
    if (!rect || rect.width <= 4 || rect.height <= 4) return false;
    const style = window.getComputedStyle?.(button);
    if (
      style &&
      (style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity || 1) === 0)
    )
      return false;
    const label = `${button.textContent || button.innerText || ""} ${button.getAttribute?.("aria-label") || ""}`.trim();
    return /\b(stop generating|stop responding|stop|cancel)\b|dừng/i.test(label);
  });
  const baselineOutOfRange = configuredMin > imageTurns.length;
  const firstOwnedIndex = turnsAfterLatestUser.length
    ? imageTurns.indexOf(turnsAfterLatestUser[0])
    : -1;
  const canRebase = Boolean(
    baselineOutOfRange &&
      ownershipConfirmed &&
      firstOwnedIndex >= 0 &&
      (imageReady || canvasReady) &&
      !placeholderVisible &&
      !stopVisible,
  );

  return {
    configuredMinImageAgentTurnIndex: configuredMin,
    effectiveMinImageAgentTurnIndex: canRebase
      ? firstOwnedIndex
      : configuredMin,
    totalImageAgentTurns: imageTurns.length,
    turnsAfterLatestUser: turnsAfterLatestUser.length,
    firstOwnedImageAgentTurnIndex: firstOwnedIndex,
    latestOwnedImageAgentTurnIndex,
    ownedImageAgentTurnIndexes,
    ownedImageUrls: [...new Set(ownedImageUrls)],
    latestUserNodeFound: Boolean(latestUserNode),
    assistantsAfterLatestUser: assistantsAfterLatestUser.length,
    ownedAssistantText: ownedAssistantText.slice(0, 4000),
    ownedAssistantTextLength: ownedAssistantText.length,
    ownedAssistantComplete: Boolean(
      ownedAssistantText.length > 20 && !placeholderVisible && !stopVisible
    ),
    ownershipConfirmed: Boolean(ownershipConfirmed),
    baselineOutOfRange,
    imageReady,
    canvasReady,
    placeholderVisible,
    stopVisible,
    rebased: canRebase,
    reason: canRebase
      ? "owned-image-turn-dom-rebased-after-virtualization"
      : baselineOutOfRange
        ? "baseline-out-of-range-waiting-for-owned-complete-image"
        : "baseline-valid",
  };
}

async function resolveNv1ImageTurnScope(
  client,
  configuredMinImageAgentTurnIndex,
  ownershipConfirmed,
) {
  return evaluateOnCdpPage(
    client,
    `(${inspectNv1ImageTurnScopeScript.toString()})(${JSON.stringify(Number(configuredMinImageAgentTurnIndex || 0))}, ${JSON.stringify(Boolean(ownershipConfirmed))})`,
  ).catch(() => ({
    configuredMinImageAgentTurnIndex: Number(
      configuredMinImageAgentTurnIndex || 0,
    ),
    effectiveMinImageAgentTurnIndex: Number(
      configuredMinImageAgentTurnIndex || 0,
    ),
    rebased: false,
    reason: "image-turn-scope-inspection-failed",
  }));
}

async function pollChatGptDom(client, minImageAgentTurnIndex) {
  const hasActiveAssistantResponse = await evaluateOnCdpPage(
    client,
    `((minRoot) => {
      const imageTurns = Array.from(document.querySelectorAll('.agent-turn'))
        .filter((turn) => turn.querySelector('.group\\\\/imagegen-image'));
      return imageTurns.length > minRoot;
    })(${Number(minImageAgentTurnIndex || 0)})`,
  ).catch(() => false);

  const hasImageTurn = await evaluateOnCdpPage(
    client,
    `((minRoot) => {
      const imageTurns = Array.from(document.querySelectorAll('.agent-turn'))
        .filter((turn) => turn.querySelector('.group\\\\/imagegen-image'))
        .slice(minRoot);
      if (imageTurns.some((turn) => turn.querySelector(
        '.group\\\\/imagegen-image img, .group\\\\/imagegen-image canvas, .group\\\\/imagegen-image [aria-busy="true"], .group\\\\/imagegen-image [role="progressbar"], .group\\\\/imagegen-image [data-testid*="loading"], .group\\\\/imagegen-image [data-testid*="spinner"]'
      ))) return true;

      const hasStop = !![...document.querySelectorAll('button, [role="button"]')].find(btn => {
        const style = window.getComputedStyle(btn);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || 1) === 0) return false;
        return /stop|dừng/i.test(btn.textContent || btn.innerText || btn.getAttribute('aria-label') || '');
      });
      if (hasStop) return true;

      return false;
    })(${Number(minImageAgentTurnIndex || 0)})`,
  ).catch(() => false);

  return { hasActiveAssistantResponse, hasImageTurn };
}

/**
 * Hydration.
 * Flow: poll DOM -> detect image turn -> hydrate only when an image turn
 * exists -> (caller) extract. Hydration is a real scroll-and-verify pass
 * against the live DOM, so it is deliberately NOT run every loop tick -
 * only once pollChatGptDom() has found an image turn worth hydrating.
 */
async function maybeHydrateChatGptImage(ctx, client, minImageAgentTurnIndex, sceneId, domSignals) {
  if (!domSignals?.hasImageTurn) return null;

  const hydration = await evaluateOnCdpPage(
    client,
    `(${ensureChatGptImageLoadedAndHydratedScript.toString()})(${minImageAgentTurnIndex})`,
  ).catch((err) => {
    if (isPipelineCancelledError(err)) throw err;
    return { ok: false, error: err.message };
  });

  ctx.lastHydrationAt = Date.now();

  const hydrationMsg = hydration?.ok
    ? `ChatGPT image hydration success: tick=${hydration.tick || 0}, elapsed=${hydration.elapsedMs || 0}ms, mode=${hydration.mode || "unknown"}, placeholderDisappeared=${hydration.placeholderDisappeared}`
    : `ChatGPT image hydration failed: ${hydration?.error || "unknown"}`;

  await appendAppLog(sceneId, {
    source: "main",
    kind: hydration?.ok ? "ok" : "warning",
    text: `Scene ${sceneId}: ${hydrationMsg}`,
    details: hydration,
  }).catch(() => null);

  return hydration;
}

/**
 * Candidate scanning: DOM extraction, then (if it failed) network capture,
 * then (if that failed too) an element screenshot. Returns every attempt
 * plus the first one that succeeded ("chosen").
 */
async function scanChatGptImageCandidates(client, options, minImageAgentTurnIndex, ctx, signals) {
  const {
    scopedSnapshot,
    activeGeneration,
    sceneId,
    ownershipConfirmed,
    imageTurnScope,
  } = signals;

  const extracted = await extractLatestChatGPTGeneratedImageBytes(client, {
    existingUrls: [...ctx.knownUrls],
    minImageAgentTurnIndex,
  }).catch((error) => {
    if (isPipelineCancelledError(error)) throw error;
    return { ok: false, error: error.message, mode: "extract-error" };
  });

  const visibleCandidate =
    hasVisibleChatGptImageCandidate(extracted) ||
    (Array.isArray(scopedSnapshot?.urls) && scopedSnapshot.urls.length > 0);

  const networkExtract =
    !extracted?.ok && (!activeGeneration || visibleCandidate)
      ? await tryExtractChatGptNetworkImage(client, options.networkCapture, {
          ownershipConfirmed,
          cardReady: Boolean(
            Number(imageTurnScope?.turnsAfterLatestUser || 0) > 0 &&
              (imageTurnScope?.imageReady || imageTurnScope?.canvasReady) &&
              !imageTurnScope?.placeholderVisible &&
              !imageTurnScope?.stopVisible,
          ),
          ownedRootIndex: Number(
            imageTurnScope?.latestOwnedImageAgentTurnIndex ?? -1,
          ),
          ownedImageUrls: imageTurnScope?.ownedImageUrls || [],
        }).catch((error) => ({
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
      ? await captureChatGptImageElementScreenshot(client, extracted.screenshotCandidate, {
          sceneId: sceneId || "",
        }).catch((error) => ({
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

  return { extracted, networkExtract, screenshotExtract, chosen, visibleCandidate };
}

/** Rejects candidates that are still the dot-loading placeholder canvas. */
async function validateChatGptImageCandidate(chosen, sceneId, ctx, client) {
  if (!chosen?.ok) return chosen;
  if (isChatGptDotLoadingCanvasAsset(chosen)) {
    const now = Date.now();
    if (!ctx.grayCanvasFirstSeenAt) {
      ctx.grayCanvasFirstSeenAt = now;
    }
    const grayCanvasAgeMs = now - ctx.grayCanvasFirstSeenAt;
    await appendAppLog(sceneId, {
      source: "main",
      kind: "running",
      text: `chatgptImageExtract: extracted candidate is still a dot-loading canvas (${chosen.width}x${chosen.height}, ${chosen.byteLength} bytes). Continuing wait...`,
      details: {
        grayCanvasAgeMs,
        grayCanvasRefreshAfterMs: IMAGE_WAIT_GRAY_CANVAS_REFRESH_MS,
        grayCanvasRefreshCount: ctx.grayCanvasRefreshCount,
      },
    });
    if (grayCanvasAgeMs >= IMAGE_WAIT_GRAY_CANVAS_REFRESH_MS) {
      ctx.grayCanvasRefreshCount += 1;
      ctx.grayCanvasFirstSeenAt = now;
      await maybeRefreshChatGptImageWaitPage(ctx, client, sceneId, {
        force: true,
        reason: "gray_canvas_stuck_refresh",
        details: {
          grayCanvasAgeMs,
          grayCanvasRefreshAfterMs: IMAGE_WAIT_GRAY_CANVAS_REFRESH_MS,
          grayCanvasRefreshCount: ctx.grayCanvasRefreshCount,
          width: chosen.width || 0,
          height: chosen.height || 0,
          byteLength: chosen.byteLength || 0,
        },
      });
    }
    return null;
  }
  ctx.grayCanvasFirstSeenAt = 0;
  return chosen;
}

function isNv1ImageCandidateSaveEligible({
  chosen,
  activeGeneration = false,
  ownershipConfirmed = false,
  imageTurnScope = {},
} = {}) {
  const chosenRootIndex = Number(chosen?.rootIndex);
  const ownedIndexes = (imageTurnScope?.ownedImageAgentTurnIndexes || [])
    .map(Number)
    .filter((index) => Number.isInteger(index) && index >= 0);
  return Boolean(
    chosen?.ok &&
      ownershipConfirmed === true &&
      activeGeneration === false &&
      Number(imageTurnScope?.turnsAfterLatestUser || 0) > 0 &&
      (imageTurnScope?.imageReady || imageTurnScope?.canvasReady) &&
      imageTurnScope?.placeholderVisible !== true &&
      imageTurnScope?.stopVisible !== true &&
      Number.isInteger(chosenRootIndex) &&
      ownedIndexes.includes(chosenRootIndex),
  );
}

/**
 * Candidate stability.
 * stableTicks is scoped to a single candidate signature: if the signature
 * changes, stableTicks resets to 1 (never carried over from a different
 * candidate); if there is no candidate at all, stableTicks drops to 0.
 */
function updateCandidateStability(ctx, chosen) {
  if (!chosen?.ok) {
    ctx.stableTicks = 0;
    return ctx.stableTicks;
  }
  const signature = chatGptImageCandidateSignature(chosen);
  if (signature && signature === ctx.lastSignature) {
    ctx.stableTicks += 1;
  } else {
    ctx.lastSignature = signature;
    ctx.stableTicks = 1;
  }
  return ctx.stableTicks;
}

/**
 * Retry gate.
 * A retry (resending the image prompt) along the "no usable asset" path is
 * only justified when ALL of the following hold:
 *   - the global attempt timeout has been exceeded
 *   - there has been no observable progress for a long timeout
 *   - the runtime is not currently generating anything
 *   - there is no placeholder/loader visible in the DOM
 * (the separate "real_stall" and "text-only-answer" paths bypass this gate
 * intentionally, since they detect distinct, unambiguous failure modes.)
 */
function shouldRetryChatGptImageWait(ctx, signals) {
  const {
    attemptStartedAt,
    attemptTimeoutMs,
    longNoProgressMs,
    isGeneratingOrLoading,
    hasPlaceholder,
  } = signals;

  const timeoutExceeded = Date.now() - attemptStartedAt >= attemptTimeoutMs;
  const noProgressForLong = Date.now() - ctx.lastProgressAt >= longNoProgressMs;

  return timeoutExceeded && noProgressForLong && !isGeneratingOrLoading && !hasPlaceholder;
}

async function waitForLatestChatGPTGeneratedImage(client, options = {}) {
  const sceneId =
    (typeof options !== "undefined" && options?.sceneId) ||
    (typeof context !== "undefined" && context?.sceneId) ||
    "";
  const runId = String(options.originalOptions?.runId || "").trim();
  const minImageAgentTurnIndex = Number(
    options.minImageAgentTurnIndex ?? options.beforeImageAgentTurnCount ?? 0,
  );
  const expectedConversationId = String(
    options.expectedConversationId || "",
  ).trim();
  let activeExpectedUserPromptHash = String(
    options.expectedUserPromptHash || "",
  ).trim();

  const ctx = new ImageWaitContext(Date.now());
  ctx.expectedConversationId = expectedConversationId;
  ctx.expectedUserPromptHash = activeExpectedUserPromptHash;
  for (const url of options.existingUrls || []) ctx.knownUrls.add(url);

  let loggedAfterResponse = false;
  let falseGeneratingTicks = 0;
  let lastExtract = null;
  let lastDiagnostic = null;
  let lastReadiness = { state: "no_candidate_yet" };
  let hasWaitedOnce = false;

  await captureAndLogChatGptDiagnostics(client, sceneId, options.beforeCount || 0, "image-extract-init").catch(() => null);

  await chatGptRuntimeMonitor.startMonitoring(client);

  try {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `chatgptImageExtract: waiting for latest .agent-turn image card for scene ${sceneId}`,
      details: { minImageAgentTurnIndex, existingUrlCount: ctx.knownUrls.size },
    });

    const singleRetryPrompt = buildNv1SingleRetryPrompt(options.requestArtifact);
    const singleRetryPromptHash = hashChatGptSnapshotText(singleRetryPrompt);
    const singleRetryPayload = await createComposerPayload({
      stage: "NV1",
      sceneId,
      controlPrompt: singleRetryPrompt,
      expectedFilePaths: [options.requestArtifact.filePath],
    });
    let singleNv1RetrySent =
      activeExpectedUserPromptHash === singleRetryPromptHash;
    const sendSingleNv1Retry = async (retryReason) => {
      if (singleNv1RetrySent) return false;
      assertPipelineRunActive(runId);
      const resent = await sendPromptWithSameChatRefreshRecovery(
        client,
        singleRetryPrompt,
        {
          sceneId,
          stage: `nv1-single-resend-${retryReason}`,
          expectedConversationId,
          expectedFilePaths: singleRetryPayload.expectedFilePaths,
          payloadFingerprint: singleRetryPayload.payloadFingerprint,
        },
      );
      if (!resent?.ok) {
        throw new Error(resent?.error || "nv1-single-resend-failed");
      }
      activeExpectedUserPromptHash = singleRetryPromptHash;
      ctx.expectedUserPromptHash = activeExpectedUserPromptHash;
      ctx.imageTurnScopeRebased = false;
      ctx.ownedRebasedImageVisible = false;
      ctx.lastImageTurnScopeSignature = "";
      ctx.ownedTextSignature = "";
      ctx.ownedTextStableTicks = 0;
      const ownership = await getConversationState(client).catch(() => ({}));
      if (ownership?.latestUserMessageHash !== activeExpectedUserPromptHash) {
        throw new Error("nv1-resend-user-message-ownership-not-confirmed");
      }
      await writeSceneSnapshot(options.sceneDir, {
        pipelineStage: "WAIT_IMAGE",
        sentPromptHash: activeExpectedUserPromptHash,
        sentPayloadFingerprint: singleRetryPayload.payloadFingerprint,
        expectedAttachmentNames: singleRetryPayload.expectedAttachmentNames,
      });
      singleNv1RetrySent = true;
      hasWaitedOnce = false;
      await appendAppLog(sceneId, {
        source: "main",
        kind: "warning",
        text: retryReason === "owned-text-only-answer"
          ? `Scene ${sceneId}: ChatGPT returned a completed response without an owned image card; sent the one allowed NV1 retry in the same conversation.`
          : `Scene ${sceneId}: NV1 still has no owned image card; sent the one allowed retry in the same conversation.`,
        details: { retryReason, expectedConversationId },
      }).catch(() => null);
      return true;
    };

    for (let attempt = 1; attempt <= 3; attempt += 1) {
    assertPipelineRunActive(runId);
    const attemptStartedAt = Date.now();
    const phaseTimeoutMs = attempt === 1
      ? IMAGE_WAIT_INITIAL_TIMEOUT_MS
      : attempt === 2
        ? IMAGE_WAIT_AFTER_REFRESH_TIMEOUT_MS
        : IMAGE_WAIT_AFTER_RESEND_TIMEOUT_MS;
    let sawGenerating = false;
    let readyTicks = 0;
    let lastLogAt = 0;
    let refreshedForVisibleOutput = false;
    let textOnlyAnswer = false;
    let fastSingleRetrySent = false;
    ctx.imageTurnScopeRebased = false;
    ctx.ownedRebasedImageVisible = false;
    const resendImagePrompt = async (reason, snapshot) => {
      assertPipelineRunActive(runId);
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
      
      const adoptResult = await adoptExistingSceneImage(
        client,
        minImageAgentTurnIndex,
        sceneId,
      ).catch(() => null);

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
      assertPipelineRunActive(runId);
      assertPipelineRunActive();
      await notifyRenderer('chatgpt-image-retry', `Scene ${sceneId}: ChatGPT image not ready (${reason}); retrying NV1 attempt ${attempt + 1}/3.`, { sceneId, attempt, reason });
      assertPipelineRunActive(runId);
      assertPipelineRunActive();
      const retryPrompt = buildRequestControlPrompt({
        stage: "NV1",
        filePath: options.requestArtifact.filePath,
        contentSha256: options.requestArtifact.contentSha256,
        retry: attempt + 1,
      });
      const retryPayload = await createComposerPayload({
        stage: "NV1",
        sceneId,
        controlPrompt: retryPrompt,
        expectedFilePaths: [options.requestArtifact.filePath],
      });
      const stopped = await evaluateOnCdpPage(client, `(${clickChatGptStopGeneratingScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
      await appendAppLog(null, {
        source: "main",
        kind: stopped?.ok ? "running" : "error",
        text: `Scene ${sceneId}: ChatGPT stop before image retry (${reason}): ${stopped?.ok ? stopped.mode : stopped?.error || "not-found"}`,
        details: stopped,
      });

      if (stopped?.error === "stop-button-not-found") {
        assertPipelineRunActive(runId);
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
        assertPipelineRunActive(runId);

        await evaluateOnCdpPage(
          client,
          `(${prepareChatGptCreateImageScript.toString()})()`,
        ).catch(() => null);
        await sleep(800);
        assertPipelineRunActive(runId);
        const resent = await sendPromptWithSameChatRefreshRecovery(client, retryPrompt, {
          sceneId,
          stage: `nv1-continuous-retry-${attempt + 1}`,
          expectedConversationId,
          expectedFilePaths: retryPayload.expectedFilePaths,
          payloadFingerprint: retryPayload.payloadFingerprint,
        });
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
        activeExpectedUserPromptHash = hashChatGptSnapshotText(retryPrompt);
        ctx.expectedUserPromptHash = activeExpectedUserPromptHash;
        return;
      }

      await sleep(1200);
      assertPipelineRunActive(runId);
      await evaluateOnCdpPage(
        client,
        `(${prepareChatGptCreateImageScript.toString()})()`,
      ).catch(() => null);
      await sleep(800);
      assertPipelineRunActive(runId);
      const resent = await sendPromptWithSameChatRefreshRecovery(client, retryPrompt, {
        sceneId,
        stage: `nv1-continuous-retry-${attempt + 1}`,
        expectedConversationId,
        expectedFilePaths: retryPayload.expectedFilePaths,
        payloadFingerprint: retryPayload.payloadFingerprint,
      });
      if (!resent.ok)
        throw new Error(
          resent.error ||
            "KhÃ´ng gá»­i láº¡i Ä‘Æ°á»£c image prompt vÃ o ChatGPT.",
        );
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `Scene ${sceneId}: resent image prompt continuous attempt ${attempt + 1}.`,
        details: { resent },
      });
      activeExpectedUserPromptHash = hashChatGptSnapshotText(retryPrompt);
      ctx.expectedUserPromptHash = activeExpectedUserPromptHash;
      hasWaitedOnce = false;
    };

    while (Date.now() - attemptStartedAt < phaseTimeoutMs) {
      assertPipelineRunActive(runId);
      if (expectedConversationId) {
        const currentUrlRead = await evaluateOnCdpPage(
          client,
          "location.href",
        ).then((url) => ({ ok: true, url })).catch((error) => ({
          ok: false,
          error: String(error?.message || error || ""),
        }));
        if (
          !currentUrlRead.ok &&
          isTransientCdpNavigationError(currentUrlRead.error)
        ) {
          await appendAppLog(sceneId, {
            source: "main",
            kind: "running",
            text: `Scene ${sceneId}: ChatGPT navigation is settling; preserving the locked conversation before the next NV1 ownership check.`,
            details: { error: currentUrlRead.error },
          }).catch(() => null);
          await waitForCdpLoad(client).catch(() => null);
          await sleep(500);
          continue;
        }
        const currentUrl = currentUrlRead.ok ? currentUrlRead.url : "";
        const currentConversationId =
          String(currentUrl || "").match(/\/c\/([^/?#]+)/)?.[1] || "";
        if (currentConversationId !== expectedConversationId) {
          throw new Error(
            `chatgpt-conversation-changed-during-nv1:${expectedConversationId}:${currentConversationId || "none"}`,
          );
        }
      }
      let ownershipConfirmed = false;
      if (activeExpectedUserPromptHash) {
        const ownershipState = await getConversationState(client);
        if (
          ownershipState?.ok === false &&
          isTransientCdpNavigationError(ownershipState?.error)
        ) {
          await appendAppLog(sceneId, {
            source: "main",
            kind: "running",
            text: `Scene ${sceneId}: NV1 ownership read was interrupted by transient navigation; waiting without reload or resend.`,
            details: { error: ownershipState?.error || "" },
          }).catch(() => null);
          await waitForCdpLoad(client).catch(() => null);
          await sleep(500);
          continue;
        }
        if (
          ownershipState?.latestUserMessageHash !== activeExpectedUserPromptHash
        ) {
          throw new Error("nv1-user-message-ownership-lost-during-image-wait");
        }
        ownershipConfirmed = true;
      }

      // ---- 1. periodic refresh (fixed schedule; never resets waiting state) ----
      await maybeRefreshChatGptImageWaitPage(ctx, client, sceneId);
      if (ctx.justReloaded) {
        ctx.justReloaded = false;
        hasWaitedOnce = false;
      }

      let preExtractWait = { ok: true };
      if (!hasWaitedOnce) {
        preExtractWait =
          await waitForChatGptImageGenerationDoneBeforeExtract(
            client,
            options,
          ).catch((error) => {
            if (isPipelineCancelledError(error)) throw error;
            return {
              ok: false,
              retryReason: "pre-extract-wait-timeout",
              error: error.message,
            };
          });
        if (preExtractWait?.ok) {
          hasWaitedOnce = true;
        }
      } else {
        await sleep(2000);
      }
      if (!preExtractWait?.ok) {
        await appendAppLog(null, {
          source: "main",
          kind: "warning",
          text: `Scene ${sceneId}: NV1 pre-extract wait did not finish; continuing wait without resend.`,
          details: {
            reason: preExtractWait?.retryReason || "pre-extract-wait-failed",
            error: preExtractWait?.error || "",
          },
        }).catch(() => null);
        await sleep(2500);
        continue;
      }
      if (!loggedAfterResponse) {
        loggedAfterResponse = true;
        await logMemoryMilestone(sceneId, "After response").catch(() => null);
      }
      assertPipelineRunActive(runId);
      await sleep(3000);
      assertPipelineRunActive(runId);
      await recoverCdpPageIfCrashed(client, "chatgpt", `image-wait-scene-${sceneId}`).catch(() => null);
      await recoverChatGptBlockingUi(client, {
        sceneId,
        stage: "image-wait-before-extract",
      }).catch(() => null);

      // HOOK_INPUT_GATE_BEFORE_IMAGE_EXTRACT_REAL
      await vidoraChatGptInputGate(
        typeof client !== "undefined"
          ? client
          : typeof page !== "undefined"
            ? page
            : null,
        { sceneId, stage: "before-image-extract-wait" },
      );

      // ---- 2. poll runtime + poll DOM ----
      assertPipelineRunActive(runId);
      const imageTurnScope = await resolveNv1ImageTurnScope(
        client,
        minImageAgentTurnIndex,
        ownershipConfirmed,
      );
      const effectiveMinImageAgentTurnIndex = Number(
        imageTurnScope?.effectiveMinImageAgentTurnIndex ??
          minImageAgentTurnIndex,
      );
      if (imageTurnScope?.rebased) {
        ctx.imageTurnScopeRebased = true;
        const scopeSignature = JSON.stringify([
          imageTurnScope.configuredMinImageAgentTurnIndex,
          imageTurnScope.effectiveMinImageAgentTurnIndex,
          imageTurnScope.totalImageAgentTurns,
          imageTurnScope.firstOwnedImageAgentTurnIndex,
        ]);
        if (scopeSignature !== ctx.lastImageTurnScopeSignature) {
          ctx.lastImageTurnScopeSignature = scopeSignature;
          await appendAppLog(sceneId, {
            source: "main",
            kind: "ok",
            text: `Scene ${sceneId}: rebased the NV1 image-turn scope after ChatGPT DOM virtualization; the latest complete image remains owned by the current prompt.`,
            details: imageTurnScope,
          }).catch(() => null);
        }
      }
      const domSignals = await pollChatGptDom(
        client,
        effectiveMinImageAgentTurnIndex,
      );
      const snapshot = pollChatGptRuntime();
      ctx.lastSnapshot = snapshot;

      // ---- 3. hydrate only when an image turn exists, then extract ----
      const hydration = await maybeHydrateChatGptImage(
        ctx,
        client,
        effectiveMinImageAgentTurnIndex,
        sceneId,
        domSignals,
      );

      // false-generating-empty-chat-break
      if (isFalseChatGptImageGeneratingState(snapshot)) {
        falseGeneratingTicks =
          (typeof falseGeneratingTicks === "number"
            ? falseGeneratingTicks
            : 0) + 1;

        await appendAppLog(null, {
          source: "main",
          kind: "running",
          text: `Scene ${sceneId}: ChatGPT image generating looks stale/empty; tick ${falseGeneratingTicks}/3.`,
          details: vidoraCompactLogDetails({ imageState: snapshot }),
        }).catch(() => null);

        if (falseGeneratingTicks >= 3) {
          await appendAppLog(null, {
            source: "main",
            kind: "error",
            text: `Scene ${sceneId}: ChatGPT image state stale; continuing wait without NV1 resend.`,
            details: {
              imageState: snapshot,
              reason: "false-generating-empty-chat",
            },
          }).catch(() => null);
          await sleep(2500);
          continue;
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
      const hasNewImageAgentTurn =
        domSignals.hasImageTurn || domSignals.hasActiveAssistantResponse;
      const scopedSnapshot = hasNewImageAgentTurn
        ? snapshot
        : { ...snapshot, urls: [] };

      if (!hasNewImageAgentTurn) {
        const ownedAssistantText = String(
          imageTurnScope?.ownedAssistantText || "",
        ).trim();
        const ownedTextOnlyCandidate = Boolean(
          ownershipConfirmed &&
            imageTurnScope?.ownedAssistantComplete &&
            Number(imageTurnScope?.turnsAfterLatestUser || 0) === 0 &&
            ownedAssistantText.length > 20 &&
            !/preparing image|creating image|generating image|đang tạo ảnh|thinking/i.test(
              ownedAssistantText,
            ) &&
            !looksLikeCollapsedUserPrompt(ownedAssistantText, "image"),
        );
        if (ownedTextOnlyCandidate) {
          const ownedTextSignature = hashChatGptSnapshotText(
            ownedAssistantText,
          );
          if (ownedTextSignature === ctx.ownedTextSignature) {
            ctx.ownedTextStableTicks += 1;
          } else {
            ctx.ownedTextSignature = ownedTextSignature;
            ctx.ownedTextStableTicks = 1;
          }
        } else {
          ctx.ownedTextSignature = "";
          ctx.ownedTextStableTicks = 0;
        }

        if (
          ownedTextOnlyCandidate &&
          ctx.ownedTextStableTicks >=
            IMAGE_WAIT_TEXT_ONLY_STABLE_TICKS_REQUIRED
        ) {
          if (isChatGptPolicyRefusalText(ownedAssistantText)) {
            await notifyChatGptPolicyRefusal(
              sceneId,
              "NV1/image",
              ownedAssistantText,
            );
          }
          if (isChatGptLimitText(ownedAssistantText)) {
            await notifyRenderer(
              "chatgpt-limit-stop",
              `Scene ${sceneId}: ChatGPT báo limit/hạn mức. Bấm OK để tool dừng hẳn; đổi account hoặc chờ reset rồi bấm Start lại thủ công.`,
              { sceneId, text: ownedAssistantText },
            );
            throw new Error(
              "ChatGPT bị limit/hạn mức. Tool đã dừng theo yêu cầu, không tự gửi lại.",
            );
          }
          const resent = await sendSingleNv1Retry("owned-text-only-answer");
          if (!resent) {
            throw new Error("chatgpt-image-text-only-after-single-retry");
          }
          fastSingleRetrySent = true;
          attempt = 2;
          break;
        }

        const staleWrapper = await pollChatGptStaleImageWrapper(client);
        const wrapperRecoveryEligible =
          !staleWrapper.stopVisible &&
          (staleWrapper.wrapperVisible ||
            Date.now() - attemptStartedAt >= 45000);
        if (wrapperRecoveryEligible) {
          if (!ctx.staleWrapperFirstSeenAt) {
            ctx.staleWrapperFirstSeenAt = Date.now();
          }
          const staleWrapperAgeMs = Date.now() - ctx.staleWrapperFirstSeenAt;
          if (
            staleWrapperAgeMs >= 15000 &&
            ctx.staleWrapperRefreshCount < 1
          ) {
            ctx.staleWrapperRefreshCount += 1;
            const refreshed = await maybeRefreshChatGptImageWaitPage(
              ctx,
              client,
              sceneId,
              {
                force: true,
                reason: "nv1-stale-gray-wrapper-after-stop",
                expectedConversationId,
                expectedUserPromptHash: activeExpectedUserPromptHash,
                details: {
                  staleWrapperAgeMs,
                  wrapperVisible: staleWrapper.wrapperVisible,
                  wrapperCount: staleWrapper.wrapperCount,
                  agentTurnCount: staleWrapper.agentTurnCount,
                  stopVisible: staleWrapper.stopVisible,
                },
              },
            );
            if (refreshed) {
              hasWaitedOnce = false;
              ctx.justReloaded = false;
              await appendAppLog(sceneId, {
                source: "main",
                kind: "running",
                text: `Scene ${sceneId}: same-chat refresh finished; rescanning the owned NV1 image without resend.`,
              }).catch(() => null);
              continue;
            }
          }
        } else {
          ctx.staleWrapperFirstSeenAt = 0;
        }
        await appendAppLog(sceneId, {
          source: "main",
          kind: "running",
          text: `Scene ${sceneId}: waiting for the NV1-owned .agent-turn image card before scanning images.`,
          details: {
            minImageAgentTurnIndex,
            effectiveMinImageAgentTurnIndex,
            imageTurnScope,
            assistantCount: Number(snapshot?.assistantCount || 0),
            ownedTextOnlyCandidate,
            ownedTextStableTicks: ctx.ownedTextStableTicks,
          },
        }).catch(() => null);
        await sleep(1500);
        continue;
      }

      // ---- 4. scan candidates (DOM -> network -> screenshot) ----
      const {
        extracted,
        networkExtract,
        screenshotExtract,
        chosen: rawChosen,
        visibleCandidate,
      } = await scanChatGptImageCandidates(client, options, effectiveMinImageAgentTurnIndex, ctx, {
        scopedSnapshot,
        activeGeneration,
        sceneId,
        ownershipConfirmed,
        imageTurnScope,
      });
      if (imageTurnScope?.rebased && visibleCandidate) {
        ctx.ownedRebasedImageVisible = true;
      }
      lastExtract = extracted;
      if (extracted?.diagnostics) lastDiagnostic = extracted.diagnostics;

      const chosen = await validateChatGptImageCandidate(rawChosen, sceneId, ctx, client);
      const saveEligibleChosen = isNv1ImageCandidateSaveEligible({
        chosen,
        activeGeneration,
        ownershipConfirmed,
        imageTurnScope,
      })
        ? chosen
        : null;

      const readiness = classifyChatGptImageReadiness({
        chosen,
        extracted,
        snapshot: scopedSnapshot,
        elapsedMs: Date.now() - attemptStartedAt,
        stallMs: IMAGE_WAIT_REAL_STALL_MS,
      });
      lastReadiness = readiness;

      textOnlyAnswer =
        hasNewImageAgentTurn &&
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

      // ---- 5. progress detection (resets ctx.lastProgressAt on any change) ----
      detectImageWaitProgress(ctx, {
        assistantCount: snapshot?.assistantCount || 0,
        latestAssistantText: snapshot?.latestAssistantText || "",
        candidateSignature: chosen?.ok ? chatGptImageCandidateSignature(chosen) : "",
        urls: scopedSnapshot?.urls || [],
        runtimeState: snapshot?.runtimeState || "",
      });

      // ---- 6. candidate stability (never reused across a different candidate) ----
      const stableTicks = updateCandidateStability(ctx, saveEligibleChosen);

      if (chosen?.ok) {
        await appendAppLog(null, {
          source: "main",
          kind: stableTicks >= IMAGE_WAIT_STABLE_TICKS_REQUIRED ? "ok" : "running",
          text: `chatgptImageExtract: found candidate type=${chosen.method || chosen.sourceKind || "image"} stable=${stableTicks}/${IMAGE_WAIT_STABLE_TICKS_REQUIRED}`,
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
        if (
          saveEligibleChosen?.ok &&
          stableTicks >= IMAGE_WAIT_STABLE_TICKS_REQUIRED
        ) {
          if (readiness.visibleCandidate) {
            await appendAppLog(null, {
              source: "main",
              kind: "ok",
              text: "chatgptImageExtract: visible image detected; suppressing thinking-stall",
              details: {
                sceneId,
                readinessState: readiness.state,
                activeGeneration: readiness.activeGeneration,
              },
            });
          }
          await appendAppLog(null, {
            source: "main",
            kind: "ok",
            text: `chatgptImageExtract: saved image via method=${chosen.method || chosen.sourceKind || "unknown"} for scene ${sceneId}`,
            details: {
              width: chosen.width || 0,
              height: chosen.height || 0,
              byteLength: chosen.byteLength || 0,
              rootIndex: chosen.rootIndex,
            },
          });
          return chosen;
        }
        await appendAppLog(sceneId, {
          source: "main",
          kind: "running",
          text: `Scene ${sceneId}: image bytes are visible but the complete NV1 ownership/save gate is not ready yet.`,
          details: {
            ownershipConfirmed,
            activeGeneration,
            chosenRootIndex: chosen.rootIndex,
            ownedImageAgentTurnIndexes:
              imageTurnScope?.ownedImageAgentTurnIndexes || [],
            turnsAfterLatestUser:
              Number(imageTurnScope?.turnsAfterLatestUser || 0),
            imageReady: Boolean(imageTurnScope?.imageReady),
            canvasReady: Boolean(imageTurnScope?.canvasReady),
            placeholderVisible: Boolean(imageTurnScope?.placeholderVisible),
            stopVisible: Boolean(imageTurnScope?.stopVisible),
          },
        }).catch(() => null);
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
          await appendAppLog(null, {
            source: "main",
            kind: "warning",
            text: `Scene ${sceneId}: image is visible but not extractable yet; preserving the current live conversation without reloading.`,
            details: {
              waitedMs: Date.now() - attemptStartedAt,
              readinessState: readiness.state,
              extractMode: extracted?.mode || "",
              extractError: extracted?.error || "",
            },
          }).catch(() => null);
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
              sceneId,
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
              sceneId,
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
            text: `Scene ${sceneId}: waiting for ChatGPT generated image asset (${snapshot?.preparingImage ? "preparing-image" : "thinking"}).`,
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
        hasNewImageAgentTurn &&
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
            sceneId,
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
        await appendAppLog(null, {
          source: "main",
          kind: "warning",
          text: `Scene ${sceneId}: NV1 real stall detected; continuing wait without resend.`,
          details: { readinessState: readiness.state },
        }).catch(() => null);
        await sleep(2500);
        continue;
      }

      // ---- 7. retry gate ----
      const hasNetworkActivity = Boolean(options.networkCapture?.summary?.()?.length > 0);
      const isGeneratingOrLoading =
        domSignals.hasImageTurn || hasNetworkActivity || domSignals.hasActiveAssistantResponse;

      const retryDue = shouldRetryChatGptImageWait(ctx, {
        attemptStartedAt,
        attemptTimeoutMs: IMAGE_WAIT_LONG_NO_PROGRESS_MS,
        longNoProgressMs: IMAGE_WAIT_LONG_NO_PROGRESS_MS,
        isGeneratingOrLoading,
        hasPlaceholder: domSignals.hasImageTurn,
      });

      if (
        (sawGenerating &&
          composerLooksReady &&
          readyTicks >= IMAGE_WAIT_READY_TICKS_REQUIRED &&
          !isGeneratingOrLoading &&
          retryDue) ||
        textOnlyAnswer
      ) {
        await appendAppLog(null, {
          source: "main",
          kind: "warning",
          text: `Scene ${sceneId}: NV1 output not usable yet; continuing wait without resend.`,
          details: {
            textOnlyAnswer,
            retryDue,
            readyTicks,
          },
        }).catch(() => null);
        await sleep(2500);
        continue;
      }
    }

    if (fastSingleRetrySent) {
      continue;
    }

    if (ctx.imageTurnScopeRebased && ctx.ownedRebasedImageVisible) {
      await appendAppLog(sceneId, {
        source: "main",
        kind: "warning",
        text: `Scene ${sceneId}: an NV1-owned image is visible after DOM rebase; continuing extraction without reload or duplicate NV1 resend.`,
        details: {
          configuredMinImageAgentTurnIndex: minImageAgentTurnIndex,
          readinessState: lastReadiness?.state || "",
        },
      }).catch(() => null);
      attempt -= 1;
      continue;
    }

    if (attempt === 1) {
      await appendAppLog(sceneId, {
        source: "main",
        kind: "warning",
        text: `Scene ${sceneId}: NV1 chưa có ảnh sau 8 phút; F5 đúng chat hiện tại rồi chờ thêm 5 phút.`,
      }).catch(() => null);
      await reloadCurrentChatAndVerify(client, expectedConversationId, sceneId, "nv1-image-timeout");
      const ownership = await getConversationState(client).catch(() => ({}));
      if (activeExpectedUserPromptHash && ownership?.latestUserMessageHash !== activeExpectedUserPromptHash) {
        throw new Error("nv1-user-message-ownership-lost-after-refresh");
      }
      hasWaitedOnce = false;
      continue;
    }

    if (attempt === 2) {
      const resent = await sendSingleNv1Retry("image-wait-timeout");
      if (!resent) {
        await appendAppLog(sceneId, {
          source: "main",
          kind: "warning",
          text: `Scene ${sceneId}: the single NV1 retry was already sent; entering the final wait without another resend.`,
        }).catch(() => null);
      }
      continue;
    }
    }
  } finally {
    await chatGptRuntimeMonitor.stopMonitoring();
  }

  // NOTE: unreachable under normal control flow - the outer `for` loop above
  // has no exit condition of its own and only ends via `return chosen;` or a
  // thrown error (propagated out through the `finally` above). Preserved
  // verbatim from the pre-refactor implementation so behavior is unchanged.
  await fs
    .writeFile(
      path.join(
        options.sceneDir,
        `scene_${String((typeof options !== "undefined" && options?.sceneId) || (typeof context !== "undefined" && context?.sceneId) || "").padStart(3, "0")}_chatgpt_image_wait_failed.json`,
      ),
      JSON.stringify(
        {
          lastSnapshot: sanitizeChatGptImageSnapshot(ctx.lastSnapshot),
          lastExtract,
          readiness: { ...lastReadiness, state: "timeout" },
          diagnostic: { ...(lastDiagnostic || {}), reasonSelected: "timeout" },
          networkCandidates: options.networkCapture?.summary?.() || [],
          existingUrlCount: ctx.knownUrls.size,
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
      lastSnapshot: sanitizeChatGptImageSnapshot(ctx.lastSnapshot),
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
    `(${extractLatestChatGPTGeneratedImageBytesScript.toString()})(${JSON.stringify(options.existingUrls || [])}, ${JSON.stringify(Number(options.minImageAgentTurnIndex || 0))})`,
  );
}

function decodeImageBufferToPng(buffer, contentType = "") {
  if (!buffer || buffer.length < 4096)
    throw new Error("Generated image asset is too small.");
  const electron = require("electron");
  const nativeImageObj = (electron && typeof electron === "object" && electron.nativeImage) ? electron.nativeImage : (typeof nativeImage !== "undefined" && nativeImage?.createFromBuffer ? nativeImage : globalThis.nativeImage);
  if (!nativeImageObj?.createFromBuffer) {
    return { buffer, width: 1024, height: 1024 };
  }
  const image = nativeImageObj.createFromBuffer(buffer);
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
  const validation = await validateKeyframeFile(filePath);
  if (!validation.ok) {
    throw new Error(`Saved keyframe validation failed: ${validation.error}`);
  }
  return validation;
}

function collectGeneratedImageUrlsScript() {
  const urls = [
    ...document.querySelectorAll(
      '.agent-turn .group\\/imagegen-image img',
    ),
  ]
    .map((img) => img.currentSrc || img.src)
    .filter(Boolean)
    .filter((url) =>
      /blob:|data:image|oaiusercontent|oaidalleapiprodscus|chatgpt|openai/i.test(
        url,
      ),
    );
  return { urls: [...new Set(urls)] };
}

async function checkExistingCompletedImageScript() {
  const imageTurns = Array.from(document.querySelectorAll(".agent-turn")).filter(
    (turn) => turn.querySelector(".group\\/imagegen-image"),
  );
  const imageTurn = imageTurns.at(-1);
  if (!imageTurn)
    return { ok: false, reason: "no-agent-turn-image-card" };
  const imageCard = imageTurn.querySelector(".group\\/imagegen-image");

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
    const activeLoader = imageCard.querySelector('[aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"]');
    return Boolean(activeLoader);
  };

  if (hasPlaceholder()) {
    return { ok: false, reason: "active-placeholder-present" };
  }

  const imgCheck = verifyImg(
    imageCard.querySelector('img'),
  );
  if (imgCheck) {
    return { ok: true, ...imgCheck };
  }

  const canvasCheck = verifyCanvas(imageCard.querySelector("canvas"));
  if (canvasCheck) {
    return { ok: true, ...canvasCheck };
  }

  return { ok: false, reason: "no-completed-generated-image-in-agent-turn" };
}

async function ensureChatGptImageLoadedAndHydratedScript(
  beforeImageAgentTurnCount = 0,
) {
  const imageTurns = Array.from(document.querySelectorAll(".agent-turn")).filter(
    (turn) => turn.querySelector(".group\\/imagegen-image"),
  );
  const sceneImageTurns = imageTurns.slice(
    Math.min(Number(beforeImageAgentTurnCount || 0), imageTurns.length),
  );
  const imageTurn = sceneImageTurns.at(-1);
  const imageAgentTurnIndex = imageTurn ? imageTurns.indexOf(imageTurn) : -1;
  const totalImageAgentTurns = imageTurns.length;

  if (!imageTurn)
    return {
      ok: false,
      error: "no-new-agent-turn-image-card",
      imageAgentTurnIndex,
      totalImageAgentTurns,
    };
  const imageCard = imageTurn.querySelector(".group\\/imagegen-image");

  const findTarget = () => {
    return imageCard.querySelector(
      'img, canvas, [aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"]'
    ) || imageCard;
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
    const activeLoader = imageCard.querySelector('[aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"]');
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
  const imgAlready = verifyImg(
    imageCard.querySelector('img'),
  );
  if (imgAlready && !initialPlaceholder) {
    return { ok: true, already: true, tick: 0, elapsedMs: Date.now() - startedAt, ...imgAlready, placeholderDisappeared: true, imageAgentTurnIndex, totalImageAgentTurns };
  }
  const canvasAlready = verifyCanvas(imageCard.querySelector('canvas'));
  if (canvasAlready && !initialPlaceholder) {
    return { ok: true, already: true, tick: 0, elapsedMs: Date.now() - startedAt, ...canvasAlready, placeholderDisappeared: true, imageAgentTurnIndex, totalImageAgentTurns };
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

    const imgCheck = verifyImg(
      imageCard.querySelector('img'),
    );
    if (imgCheck) {
      return {
        ok: true,
        already: false,
        tick,
        elapsedMs: Date.now() - startedAt,
        ...imgCheck,
        placeholderDisappeared: !hasPlaceholder(),
        imageAgentTurnIndex,
        totalImageAgentTurns
      };
    }

    const canvasCheck = verifyCanvas(imageCard.querySelector('canvas'));
    if (canvasCheck) {
      return {
        ok: true,
        already: false,
        tick,
        elapsedMs: Date.now() - startedAt,
        ...canvasCheck,
        placeholderDisappeared: !hasPlaceholder(),
        imageAgentTurnIndex,
        totalImageAgentTurns
      };
    }
  }

  return { ok: false, error: "timeout-waiting-for-image-load-verification", elapsedMs: Date.now() - startedAt, imageAgentTurnIndex, totalImageAgentTurns, hasPlaceholder: hasPlaceholder() };
}

async function adoptExistingSceneImage(
  client,
  beforeImageAgentTurnCount,
  sceneId,
) {
  const minRoot = Number(beforeImageAgentTurnCount || 0);

  // Scan only image-generation cards rendered in new `.agent-turn` roots.
  const adoptCheck = await evaluateOnCdpPage(
    client,
    `(${async function(minIdx) {
      const imageTurns = Array.from(document.querySelectorAll('.agent-turn'))
        .filter((turn) => turn.querySelector('.group\\/imagegen-image'));
      const scanMinIdx = Math.min(Number(minIdx || 0), imageTurns.length);
      const sceneImageTurns = imageTurns.slice(scanMinIdx);
      const diagnostics = {
        totalImageAgentTurns: imageTurns.length,
        sceneImageAgentTurns: sceneImageTurns.length,
        minIdx,
        scanMinIdx,
        selectedIdx: -1,
        hasPlaceholder: false,
        hasImg: false,
        hasCanvas: false,
        imgDetails: null,
        canvasDetails: null
      };

      if (!sceneImageTurns.length)
        return { ok: false, reason: "no-new-agent-turn-image-card", diagnostics };

      const imageTurn = sceneImageTurns.at(-1);
      diagnostics.selectedIdx = imageTurns.indexOf(imageTurn);
      const imageCard = imageTurn.querySelector('.group\\/imagegen-image');
      const img = imageCard.querySelector('img');
      const canvas = imageCard.querySelector('canvas');
      const placeholder = imageCard.querySelector(
        '[aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"]'
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
      return { ok: false, reason: "agent-turn-image-not-completed-yet", diagnostics };
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
    `(${ensureChatGptImageLoadedAndHydratedScript.toString()})(${minRoot})`,
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
    minImageAgentTurnIndex: minRoot,
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
  minImageAgentTurnIndex = 0,
) {
  const known = new Set(Array.isArray(existingUrls) ? existingUrls : []);
  const minRoot = Number(minImageAgentTurnIndex || 0);
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
    const allAgentTurns = [...document.querySelectorAll(".agent-turn")];
    const imageTurnNodes = allAgentTurns.filter((turn) =>
      turn.querySelector?.(".group\\/imagegen-image"),
    );
    const responseRoots = imageTurnNodes.map((node, index) => ({
      node,
      index,
      mode: "agent-turn-imagegen",
    }));
    return {
      responseRoots,
      rootDebug: {
        roleNodeCount: 0,
        fallbackNodeCount: 0,
        imageTurnNodeCount: imageTurnNodes.length,
        agentTurnNodeCount: allAgentTurns.length,
        generatedImageNodeCount: [
          ...document.querySelectorAll(
            '.agent-turn .group\\/imagegen-image img',
          ),
        ].length,
      },
    };
  };
  const { responseRoots, rootDebug } = rootsFrom();
  const selectedRoots = responseRoots.slice(
    Math.min(minRoot, responseRoots.length),
  );
  let waitingForNewImageAgentTurn = responseRoots.length <= minRoot;
  let scanMinRoot = minRoot;
  let usingLatestRootFallback = false;
  let roots = selectedRoots;
  if (waitingForNewImageAgentTurn && responseRoots.length > 0 && minRoot > 0) {
    const latestTurn = responseRoots.at(-1);
    if (latestTurn) {
      usingLatestRootFallback = true;
      waitingForNewImageAgentTurn = false;
      roots = [latestTurn];
      scanMinRoot = responseRoots.length - 1;
    }
  }
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
    assistantRootCount: 0,
    responseRootCount: responseRoots.length,
    selectedRootCount: roots.length,
    roleNodeCount: rootDebug.roleNodeCount,
    fallbackNodeCount: rootDebug.fallbackNodeCount,
    uniqueRootCount: responseRoots.length,
    agentTurnNodeCount: rootDebug.agentTurnNodeCount,
    imageTurnNodeCount: rootDebug.imageTurnNodeCount,
    generatedImageNodeCount: rootDebug.generatedImageNodeCount,
    minImageAgentTurnIndex: minRoot,
    effectiveMinImageAgentTurnIndex: scanMinRoot,
    usingLatestRootFallback,
    waitingForNewImageAgentTurn,
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
    const imageCard = root.node.querySelector(".group\\/imagegen-image");
    if (!imageCard) continue;
    const generatedImages = imageCard.querySelectorAll(
      'img',
    );
    const rootText = String(root.node.innerText || "").trim();
    diagnostics.roots.push({
      index: root.index,
      mode: root.mode,
      textLength: rootText.length,
      imgCount: generatedImages.length,
      canvasCount: imageCard.querySelectorAll("canvas").length,
      sourceCount: imageCard.querySelectorAll(
        "picture source, source[srcset], source[src]",
      ).length,
      downloadLikeCount: [
        ...imageCard.querySelectorAll("a[href], button"),
      ].filter((node) =>
        /download|open|view|image|ảnh|share|copy/i.test(
          `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.getAttribute?.("href") || ""}`,
        ),
      ).length,
      box: rectInfo(root.node),
    });
    diagnostics.imgElementCount += generatedImages.length;
    diagnostics.canvasElementCount +=
      imageCard.querySelectorAll("canvas").length;
    diagnostics.imageLikeLinkCount += [
      ...imageCard.querySelectorAll("a[href], button"),
    ].filter((node) =>
      /download|open|view|image|ảnh|share|copy/i.test(
        `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.getAttribute?.("href") || ""}`,
      ),
    ).length;
    for (const img of generatedImages) {
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
    for (const source of imageCard.querySelectorAll(
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
    for (const canvas of imageCard.querySelectorAll("canvas")) {
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
    for (const node of imageCard.querySelectorAll(
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
    for (const link of imageCard.querySelectorAll("a[href]")) {
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
    rootCount: responseRoots.length,
    minImageAgentTurnIndex: minRoot,
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
    if (node.tagName === "CANVAS") return true;
    return node.tagName === "IMG";
  };

  const nodes = [
    ...document.querySelectorAll(
      '.agent-turn .group\\/imagegen-image img, .agent-turn .group\\/imagegen-image canvas',
    ),
  ]
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

async function waitForChatGptImageOrRetry(
  client,
  existingUrls = [],
  prompt,
  sceneDir,
  sceneId,
) {
  throw new Error("legacy-nv1-text-retry-disabled-use-file-payload");
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
      const retryPrompt = String(prompt || "").trim();
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


function validateNv2ResponseOwnership({
  expectedPromptHash = "",
  latestUserHash = "",
  expectedConversationId = "",
  currentConversationId = "",
  snapshotError = "",
  expectedUserCount = 0,
  currentUserCount = 0,
  userHashes = [],
  ownershipMissingSince = 0,
  now = Date.now(),
  graceMs = 30000,
} = {}) {
  const errorText = String(snapshotError || "");
  if (errorText && isTransientCdpNavigationError(errorText)) {
    return { ok: false, transient: true, error: "nv2-navigation-settling" };
  }
  const expectedConversation = String(expectedConversationId || "").trim();
  const currentConversation = String(currentConversationId || "").trim();
  if (expectedConversation && !currentConversation) {
    return {
      ok: false,
      error: "nv2-conversation-ownership-unavailable-during-response-wait",
    };
  }
  if (
    expectedConversation &&
    currentConversation !== expectedConversation
  ) {
    return {
      ok: false,
      error: `chatgpt-conversation-changed-during-nv2-response-wait:${expectedConversation}:${currentConversation || "none"}`,
    };
  }
  const expectedHash = String(expectedPromptHash || "");
  const liveHash = String(latestUserHash || "");
  if (!expectedHash) {
    return {
      ok: false,
      error: "nv2-user-message-ownership-unavailable-during-response-wait",
    };
  }
  if (liveHash === expectedHash) {
    return { ok: true };
  }

  const expectedCount = Math.max(0, Number(expectedUserCount || 0));
  const liveCount = Math.max(0, Number(currentUserCount || 0));
  const normalizedUserHashes = (Array.isArray(userHashes) ? userHashes : [])
    .map((hash) => String(hash || ""))
    .filter(Boolean);
  const expectedHashStillMounted = normalizedUserHashes.includes(expectedHash);

  // If the owned prompt is still mounted but another prompt is now latest,
  // ownership was genuinely superseded. This is not DOM virtualization.
  if (expectedHashStillMounted && liveHash && liveHash !== expectedHash) {
    return {
      ok: false,
      error: "nv2-user-message-ownership-lost-during-response-wait",
    };
  }

  // ChatGPT can temporarily unmount the newest user/assistant pair while an
  // attachment response changes from a loading card to the final text turn.
  // Only treat a demonstrable user-count regression as transient. Completion
  // remains blocked until the exact latest-user hash is mounted again.
  const userDomRegressed = expectedCount > 0 && liveCount < expectedCount;
  if (userDomRegressed) {
    const startedAt = Number(ownershipMissingSince || 0) || Number(now || Date.now());
    const elapsedMs = Math.max(0, Number(now || Date.now()) - startedAt);
    if (elapsedMs <= Math.max(0, Number(graceMs || 0))) {
      return {
        ok: false,
        transient: true,
        error: "nv2-user-message-ownership-virtualized-during-response-wait",
        ownershipMissingSince: startedAt,
        elapsedMs,
        expectedUserCount: expectedCount,
        currentUserCount: liveCount,
      };
    }
    return {
      ok: false,
      error: "nv2-user-message-ownership-unavailable-after-virtualization-grace",
    };
  }

  return {
    ok: false,
    error: liveHash
      ? "nv2-user-message-ownership-lost-during-response-wait"
      : "nv2-user-message-ownership-unavailable-during-response-wait",
  };
}

async function waitForChatGptResponse(page, before, options = {}) {
  const {
    sceneId,
    promptText: instruction,
  } = options;
  const runId = String(options.runId || options.originalOptions?.runId || "").trim();

  let phaseStartedAt = Date.now();
  let latest = '';
  let lastBadMotionText = '';
  let badMotionTextTicks = 0;
  let lastStableHash = "";
  let previousPollHash = "";
  let lastTextChangeAt = Date.now();
  let stableResponseTicks = 0;
  let ownershipMissingSince = 0;
  const NV2_RESPONSE_TIMEOUT_MS = 300000;
  const NV2_STABLE_RESPONSE_TICKS = 3;
  const NV2_TEXT_STABLE_MS = 4000;
  const NV2_OWNERSHIP_VIRTUALIZATION_GRACE_MS = 30000;

  await chatGptRuntimeMonitor.startMonitoring(page).catch(() => null);

  try {
    for (let responsePhase = 0; responsePhase < 2; responsePhase += 1) {
    phaseStartedAt = Date.now();
    while (Date.now() - phaseStartedAt < NV2_RESPONSE_TIMEOUT_MS) {
      assertPipelineRunActive(runId);

      const snapshot = await evaluateOnCdpPage(
        page,
        `(${readLatestAssistantScript.toString()})()`,
      ).catch((error) => ({ error: error.message }));
      const messageSnapshot = await evaluateOnCdpPage(
        page,
        `(${readAssistantMessageSnapshotScript.toString()})()`,
      ).catch((error) => ({ ok: false, error: error.message, messages: [] }));
      const monitorSnapshot = chatGptRuntimeMonitor.captureSnapshot?.() || {};
      const monitorDom = monitorSnapshot.metrics?.dom || {};
      const monitorNetwork = monitorSnapshot.metrics?.network || {};
      const currentText = String(snapshot?.text || "").trim();
      const currentTextLength = currentText.length;
      const currentHash = String(snapshot?.hash || "");
      const domAssistantCount = Number(snapshot?.count || 0);
      const monitorAssistantCount = Number(monitorDom.assistantMessageCount || 0);
      const assistantCount = Math.max(domAssistantCount, monitorAssistantCount);
      const latestUserHash = String(
        messageSnapshot?.latestUserMessageHash ||
          messageSnapshot?.userHashes?.at?.(-1) ||
          "",
      );
      const currentConversationId = String(
        messageSnapshot?.currentChatId ||
          conversationIdFromLocation(messageSnapshot) ||
          "",
      ).trim();
      const ownershipValidation = validateNv2ResponseOwnership({
        expectedPromptHash: options.promptHash,
        latestUserHash,
        expectedConversationId: options.expectedConversationId,
        currentConversationId,
        snapshotError: messageSnapshot?.error || snapshot?.error || "",
        expectedUserCount: Number(before?.userCount || 0),
        currentUserCount: Number(messageSnapshot?.userCount || 0),
        userHashes: messageSnapshot?.userHashes || [],
        ownershipMissingSince,
        graceMs: NV2_OWNERSHIP_VIRTUALIZATION_GRACE_MS,
      });
      if (ownershipValidation.transient) {
        ownershipMissingSince = Number(
          ownershipValidation.ownershipMissingSince || Date.now(),
        );
        lastStableHash = "";
        previousPollHash = "";
        lastTextChangeAt = Date.now();
        stableResponseTicks = 0;
        await appendAppLog(sceneId, {
          source: "main",
          kind: "running",
          text: `Scene ${sceneId}: NV2 user turn temporarily virtualized; waiting for exact prompt ownership to return without resend.`,
          details: {
            error: ownershipValidation.error,
            elapsedMs: ownershipValidation.elapsedMs,
            graceMs: NV2_OWNERSHIP_VIRTUALIZATION_GRACE_MS,
            expectedUserCount: ownershipValidation.expectedUserCount,
            currentUserCount: ownershipValidation.currentUserCount,
          },
        }).catch(() => null);
        await sleep(750);
        continue;
      }
      if (!ownershipValidation.ok) {
        throw new Error(ownershipValidation.error);
      }
      ownershipMissingSince = 0;
      const promptOwned = true;
      const hardGenerating = Boolean(
        snapshot?.stopButton ||
        snapshot?.streamingIndicator ||
        messageSnapshot?.stopVisible ||
        messageSnapshot?.stopButtonVisible ||
        messageSnapshot?.streamingIndicator ||
        monitorSnapshot.state === "STREAMING_TEXT"
      );
      const softBusy = Boolean(
        snapshot?.composerBusy ||
        snapshot?.activeGenerationMarker ||
        messageSnapshot?.composerBusy ||
        messageSnapshot?.activeGenerationMarker ||
        monitorSnapshot.state === "HYDRATING" ||
        monitorSnapshot.state === "WAITING_SEND" ||
        monitorSnapshot.state === "UPLOADING" ||
        monitorDom.generationActive
      );
      const hasNewMessage =
        assistantCount > Number(before?.count || 0);
      const hasChangedLatestText =
        Boolean(currentHash) && currentHash !== previousPollHash;
      previousPollHash = currentHash;
      const freshAssistant = hasNewMessage ||
        (Boolean(currentText) && currentText !== String(before?.text || "").trim());
      const resolvedState = {
        generation: hardGenerating,
        streamingIndicator: Boolean(
          snapshot?.streamingIndicator ||
          messageSnapshot?.streamingIndicator ||
          monitorSnapshot.state === "STREAMING_TEXT"
        ),
      };
      const completedSnapshot = {
        ...messageSnapshot,
        count: Math.max(Number(messageSnapshot?.count || 0), assistantCount),
        composerBusy: false,
        streamingIndicator: hardGenerating,
        activeGenerationMarker: hardGenerating,
        generationActive: hardGenerating,
      };
      const completed = extractCompletedNv2ResponseFromSnapshot(
        completedSnapshot,
        before,
        { allowInPlaceMutation: promptOwned },
      );
      const completedText = String(completed?.text || "").trim();
      const completedHash = completedText ? hashChatGptSnapshotText(completedText) : "";
      const observedText = completedText || currentText;
      const observedHash = completedHash || currentHash;
      const observedTextLength = observedText.length;
      if (observedHash && observedHash !== lastStableHash) {
        lastStableHash = observedHash;
        lastTextChangeAt = Date.now();
        stableResponseTicks = observedTextLength > 15 ? 1 : 0;
      } else if (observedHash && observedTextLength > 15) {
        stableResponseTicks += 1;
      } else {
        stableResponseTicks = 0;
      }
      const textStableMs = Date.now() - lastTextChangeAt;

      await appendAppLog(sceneId, {
        source: 'main',
        kind: 'running',
        text: `ChatGPT NV2: waiting for response (assistant=${assistantCount}/${before?.count || 0}, textLength=${currentTextLength}, hash=${currentHash || "none"}, generating=${hardGenerating}, stable=${stableResponseTicks}/${NV2_STABLE_RESPONSE_TICKS})`,
        details: {
          elapsedMs: Date.now() - phaseStartedAt,
          timeoutMs: NV2_RESPONSE_TIMEOUT_MS,
          latestTextChanged: hasChangedLatestText,
          freshAssistant,
          promptOwned,
          latestUserHash,
          assistantCount,
          domAssistantCount,
          monitorAssistantCount,
          textLength: currentTextLength,
          hash: currentHash,
          completedOk: Boolean(completed?.ok),
          completedError: completed?.error || null,
          completedTextLength: completedText.length,
          completedHash,
          generating: hardGenerating,
          hardGenerating,
          softBusy,
          stableResponseTicks,
          stableResponseTarget: NV2_STABLE_RESPONSE_TICKS,
          textStableMs,
          textStableTargetMs: NV2_TEXT_STABLE_MS,
          stopButton: Boolean(snapshot?.stopButton),
          composerBusy: Boolean(snapshot?.composerBusy),
          generationSignals:
            snapshot?.generationSignals ||
            messageSnapshot?.generationSignals ||
            monitorDom.generationSignals ||
            null,
          runtimeState: monitorSnapshot.state || "",
          runtimeIntent: monitorSnapshot.intent || "",
          loggedOut: Boolean(monitorDom.loggedOut),
          activeMediaRequests: Number(monitorNetwork.activeMediaRequests || 0),
          source: snapshot?.source || snapshot?.mode || "readLatestAssistantScript",
          snapshotError: snapshot?.error || null,
        },
      }).catch(() => null);

      if (!observedText) {
        await sleep(1500);
        continue;
      }

      latest = observedText;

      if (isChatGptPolicyRefusalText(latest)) {
        await notifyChatGptPolicyRefusal(sceneId, 'NV2/motion-prompt', latest);
      }

      const quality = validateMotionPromptResponse(latest, {
        beforeText: before?.text || '',
        instruction,
        taskPrompt: '',
        state: resolvedState,
      });

      const retryableBadMotionText =
        freshAssistant && !quality.ok && isRetryableChatGptToolErrorText(latest, 'motion');
      const normalizedBadMotionText = normalizeChatGptRetryText(latest);
      if (freshAssistant && !quality.ok && (retryableBadMotionText || quality.error === 'too-short')) {
        if (normalizedBadMotionText && normalizedBadMotionText === lastBadMotionText) {
          badMotionTextTicks += 1;
        } else {
          lastBadMotionText = normalizedBadMotionText;
          badMotionTextTicks = 1;
        }
      } else if (quality.ok) {
        lastBadMotionText = '';
        badMotionTextTicks = 0;
      }

      if (
        completed?.ok &&
        quality.ok &&
        promptOwned &&
        !hardGenerating &&
        !softBusy &&
        stableResponseTicks >= NV2_STABLE_RESPONSE_TICKS &&
        textStableMs >= NV2_TEXT_STABLE_MS
      ) {
        return { ok: true, text: latest };
      }

      await appendAppLog(null, {
        source: 'main',
        kind: 'running',
        text: `Scene ${sceneId}: NV2 response not valid yet; continuing without upload or resend.`,
        details: {
          error: completed?.error || quality.error || (hardGenerating ? "still-generating" : "waiting-for-stable-response"),
          quality,
          completedState: completed?.state || null,
          generating: hardGenerating,
          hardGenerating,
          softBusy,
          stableResponseTicks,
          stableResponseTarget: NV2_STABLE_RESPONSE_TICKS,
          textStableMs,
          textStableTargetMs: NV2_TEXT_STABLE_MS,
          badMotionTextTicks,
          retryableBadMotionText,
          elapsedMs: Date.now() - phaseStartedAt,
        },
      }).catch(() => null);

      await sleep(1500);
    }

    if (responsePhase === 0) {
      await appendAppLog(sceneId, {
        source: "main",
        kind: "warning",
        text: `Scene ${sceneId}: NV2 timed out; refreshing the same chat once and continuing to wait without resending.`,
      }).catch(() => null);
      await reloadCurrentChatAndVerify(
        page,
        options.expectedConversationId,
        sceneId,
        "nv2-response-timeout",
      );
      const ownership = await getConversationState(page).catch(() => ({}));
      if (options.promptHash && ownership?.latestUserMessageHash !== options.promptHash) {
        throw new Error("nv2-user-message-ownership-lost-after-refresh");
      }
      lastStableHash = "";
      previousPollHash = "";
      lastTextChangeAt = Date.now();
      stableResponseTicks = 0;
    }

    }

    throw new Error(`Timeout waiting for NV2 response after two ${Math.round(NV2_RESPONSE_TIMEOUT_MS / 1000)}s same-chat phases without resend.`);
  } finally {
    await chatGptRuntimeMonitor.stopMonitoring().catch(() => null);
  }
}

async function maybeRenameChatGptCurrentConversationUntilTitle(page, title = '', options = {}) {
  const wanted = String(title || '').trim();
  if (!wanted) return { ok: false, error: 'missing-title' };
  const locationState = await getChatGptLocationState(page);
  const cached = chatGptConversationIdentityCache;
  if (!options.force && locationState?.conversationId && cached.conversationId && locationState.conversationId !== cached.conversationId) {
    await invalidateChatGptConversationIdentity('chatgpt-url-changed');
  }
  if (!options.force && locationState?.conversationId && cached.conversationId === locationState.conversationId && isSameChatTitle(cached.title, wanted)) {
    await appendAppLog(null, {
      source: 'main',
      kind: 'running',
      text: 'chatTitleCheck: using cached conversation identity',
      details: { sceneId: ((typeof options !== 'undefined' && options?.sceneId) || (typeof context !== 'undefined' && context?.sceneId) || ''), reason: options.reason || 'rename-skip', path: locationState.path || '', title: sanitizeChatTitleForLog(wanted) },
    });
    return { ok: true, skipped: true, cached: true, title: wanted, path: locationState.path };
  }
  const CHAT_TITLE_CHECK_MIN_INTERVAL_MS = 45000;
  if (!options.force && cached.lastCheckAt && Date.now() - cached.lastCheckAt < CHAT_TITLE_CHECK_MIN_INTERVAL_MS && locationState?.conversationId === cached.conversationId && isSameChatTitle(cached.title, wanted)) {
    await appendAppLog(null, {
      source: 'main',
      kind: 'running',
      text: `chatTitleCheck: skipped reason=rate-limit-${options.reason || 'rename'}`,
      details: { sceneId: ((typeof options !== 'undefined' && options?.sceneId) || (typeof context !== 'undefined' && context?.sceneId) || ''), path: locationState?.path || '', title: sanitizeChatTitleForLog(wanted), lastCheckAgoMs: Date.now() - cached.lastCheckAt },
    });
    return { ok: true, skipped: true, rateLimited: true, title: wanted, path: locationState?.path || '' };
  }
  if (options.force) await appendAppLog(null, { source: 'main', kind: 'running', text: `chatTitleCheck: forced reason=${options.reason || 'rename'}`, details: { sceneId: ((typeof options !== 'undefined' && options?.sceneId) || (typeof context !== 'undefined' && context?.sceneId) || ''), title: sanitizeChatTitleForLog(wanted) } });
  cached.lastCheckAt = Date.now();
  const result = await renameChatGptCurrentConversationUntilTitle(page, wanted, options);
  if (result?.ok) {
    const verifiedLocation = await getChatGptLocationState(page);
    updateChatGptConversationIdentity(verifiedLocation, wanted);
    await appendAppLog(null, { source: 'main', kind: 'ok', text: `chatTitleCheck: verified title=${sanitizeChatTitleForLog(wanted)}`, details: { sceneId: ((typeof options !== 'undefined' && options?.sceneId) || (typeof context !== 'undefined' && context?.sceneId) || ''), reason: options.reason || 'rename', path: verifiedLocation?.path || '' } });
  }
  return result;
}

async function renameChatGptCurrentConversationUntilTitle(page, title = '', { sceneId = '', timeoutMs = 60000, waitForRecent = true, maxAttempts = 2, stableTarget = 2 } = {}) {
  const wanted = String(title || '').trim();
  if (!wanted) return { ok: false, error: 'missing-title' };
  const currentPath = await evaluateOnCdpPage(page, `location.pathname`).catch(() => '');
  if (!String(currentPath || '').startsWith('/c/')) return { ok: false, error: 'not-in-conversation', path: currentPath };
  if (isChatTitleStable(currentPath, wanted)) {
    await appendAppLog(null, { source: 'main', kind: 'running', text: 'chatTitleCheck: using cached conversation identity', details: { sceneId, reason: 'stable-title-cache', path: currentPath, title: sanitizeChatTitleForLog(wanted) } });
    return { ok: true, skipped: true, stableChecks: 1, title: wanted, path: currentPath };
  }
  if (waitForRecent) {
    const recentsReady = await waitForChatGptRecentItem(page, currentPath, sceneId);
    await appendAppLog(null, { source: 'main', kind: recentsReady?.ok ? 'running' : 'error', text: `Scene ${sceneId}: Recents ready before rename: ${recentsReady?.ok ? recentsReady.text || recentsReady.mode : recentsReady?.error || 'not-ready'}`, details: recentsReady });
    if (!recentsReady?.ok) return { ok: false, error: recentsReady?.error || 'recents-not-ready', recentsReady };
  }
  const renameDeadline = Date.now() + timeoutMs;
  let renameAttempt = 0;
  let renameResult = null;
  while (Date.now() < renameDeadline) {
    const titleState = await checkChatGptCurrentConversationTitle(page, wanted, { sceneId, force: true, reason: 'rename-workflow' }).catch((error) => ({ ok: false, error: error.message }));
    if (titleState?.ok) {
      const stableChecks = markChatTitleStable(titleState.path || currentPath, wanted, true);
      if (stableChecks >= 1) return { ok: true, alreadyNamed: true, title: wanted, attempts: renameAttempt, stableChecks, titleState };
      await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: ChatGPT title đúng ${stableChecks}/3, check thêm để ổn định rồi dừng.`, details: titleState });
      await sleep(700);
      continue;
    }
    markChatTitleStable(titleState?.path || currentPath, wanted, false);
    renameAttempt += 1;
    await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: ChatGPT rename attempt ${renameAttempt}/${maxAttempts}, current="${titleState?.currentTitle || ''}" target="${wanted}"`, details: titleState });
    renameResult = await renameChatGptCurrentConversation(null, wanted).catch((error) => ({ ok: false, error: error.message }));
    await appendAppLog(null, { source: 'main', kind: renameResult?.ok ? 'running' : 'error', text: `Scene ${sceneId}: ChatGPT rename attempt ${renameAttempt} ${renameResult?.ok ? 'sent' : renameResult?.error || 'failed'}`, details: renameResult });
    await sleep(2500);
    const verifyState = await checkChatGptCurrentConversationTitle(page, wanted, { sceneId, force: true, reason: 'rename-verify' }).catch((error) => ({ ok: false, error: error.message }));
    if (verifyState?.ok) {
      const stableChecks = markChatTitleStable(verifyState.path || currentPath, wanted, true);
      if (stableChecks >= 1) return { ok: true, title: wanted, attempts: renameAttempt, stableChecks, verifyState };
      await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: rename đã khớp ${stableChecks}/3, verify thêm trước khi dừng.`, details: verifyState });
      await sleep(700);
      continue;
    }
    markChatTitleStable(verifyState?.path || currentPath, wanted, false);
    if (renameAttempt >= maxAttempts) break;
    await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: rename chưa khớp, retry tiếp. current="${verifyState?.currentTitle || ''}"`, details: verifyState });
    await sleep(1000);
  }
  return { ok: false, error: renameResult?.error || 'rename-max-attempts-or-timeout', title: wanted, attempts: renameAttempt, maxAttempts, lastResult: renameResult };
}

async function waitForChatGptRecentItem(page, conversationPath = "", sceneId = "") {
  const conversationId = String(conversationPath || "").match(/\/c\/([^/?#]+)/)?.[1] || "";
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
    })()`
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

async function checkChatGptCurrentConversationTitle(page, expectedTitle = "", options = {}) {
  const wanted = String(expectedTitle || "").trim();
  if (!wanted) return { ok: false, error: "missing-expected-title" };
  const locationState = await getChatGptLocationState(page);
  const cached = chatGptConversationIdentityCache;
  if (!options.force && locationState?.conversationId && cached.conversationId === locationState.conversationId && isSameChatTitle(cached.title, wanted)) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: "chatTitleCheck: using cached conversation identity",
      details: { sceneId: (typeof options !== "undefined" && options?.sceneId) || (typeof context !== "undefined" && context?.sceneId) || "", reason: options.reason || "title-check", path: locationState.path || "", title: sanitizeChatTitleForLog(wanted) },
    });
    return { ok: true, cached: true, currentTitle: wanted, wanted, mode: "cache", path: locationState.path || "" };
  }
  const CHAT_TITLE_CHECK_MIN_INTERVAL_MS = 45000;
  if (!options.force && cached.lastCheckAt && Date.now() - cached.lastCheckAt < CHAT_TITLE_CHECK_MIN_INTERVAL_MS && isSameChatTitle(cached.title, wanted)) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `chatTitleCheck: skipped reason=rate-limit-${options.reason || "title-check"}`,
      details: { sceneId: (typeof options !== "undefined" && options?.sceneId) || (typeof context !== "undefined" && context?.sceneId) || "", path: locationState?.path || "", title: sanitizeChatTitleForLog(wanted), lastCheckAgoMs: Date.now() - cached.lastCheckAt },
    });
    return { ok: false, skipped: true, rateLimited: true, error: "rate-limited-title-check", path: locationState?.path || "" };
  }
  if (options.force) await appendAppLog(null, { source: "main", kind: "running", text: `chatTitleCheck: forced reason=${options.reason || "title-check"}`, details: { sceneId: (typeof options !== "undefined" && options?.sceneId) || (typeof context !== "undefined" && context?.sceneId) || "", title: sanitizeChatTitleForLog(wanted) } });
  cached.lastCheckAt = Date.now();
  const state = await evaluateOnCdpPage(
    page,
    `(() => {
    try {
      const wanted = ${JSON.stringify(wanted)};
      const m = location.pathname.match(/\\/c\\/([^/?#]+)/);
      const id = m ? m[1] : '';
      const norm = (value) => String(value || '').trim().replace(/\\s+/g, ' ');
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
  })()`
  ).catch((error) => ({ ok: false, error: error.message }));
  if (state?.ok) {
    updateChatGptConversationIdentity(state, wanted);
    await appendAppLog(null, { source: "main", kind: "ok", text: `chatTitleCheck: verified title=${sanitizeChatTitleForLog(wanted)}`, details: { sceneId: (typeof options !== "undefined" && options?.sceneId) || (typeof context !== "undefined" && context?.sceneId) || "", reason: options.reason || "title-check", path: state.path || "" } });
  } else if (!state?.skipped) {
    await appendAppLog(null, { source: "main", kind: "running", text: `chatTitleCheck: skipped reason=${state?.error || "title-mismatch"}`, details: { sceneId: (typeof options !== "undefined" && options?.sceneId) || (typeof context !== "undefined" && context?.sceneId) || "", reason: options.reason || "title-check", path: state?.path || "", currentTitle: sanitizeChatTitleForLog(state?.currentTitle || "") } });
  }
  return state;
}

const chatTitleStableChecks = new Map();

function getChatTitleStableKey(pathname = "", title = "") {
  const id = String(pathname || "").match(/\/c\/([^/?#]+)/)?.[1] || String(pathname || "");
  return `${id}::${String(title || "").trim().toLowerCase()}`;
}

function markChatTitleStable(pathname = "", title = "", ok = false) {
  const key = getChatTitleStableKey(pathname, title);
  const next = ok ? (chatTitleStableChecks.get(key) || 0) + 1 : 0;
  chatTitleStableChecks.set(key, next);
  return next;
}

function isChatTitleStable(pathname = "", title = "") {
  return (chatTitleStableChecks.get(getChatTitleStableKey(pathname, title)) || 0) >= 1;
}

function sanitizeChatTitleForLog(title = "") {
  return maskRouterText(String(title || "").replace(/\s+/g, " ").trim()).slice(0, 120);
}

module.exports = {
  initChatGptPipeline,
  generateImageAndMotionWithChatGPT,
  generateMotionPromptWithChatGPT,
  generateMotionPromptWithChatGPTOnce,
  validateMotionPromptResponse,
  sanitizeAssetUrlForLog,
  startChatGptImageNetworkCapture,
  tryExtractChatGptNetworkImage,
  networkCandidateMatchesOwnedNv1Card,
  chatGptImageCandidateSignature,
  countVisibleChatGptImageCandidates,
  hasVisibleChatGptImageCandidate,
  classifyChatGptImageReadiness,
  captureChatGptImageElementScreenshot,
  saveChatGPTGeneratedImageAsset,
  isLikelyChatGptLoadingPlaceholderImage,
  isPreferredChatGptRealImageAsset,
  isFalseChatGptImageGeneratingState,
  refreshChatGptPageBeforeImageExtract,
  waitForChatGptImageGenerationDoneBeforeExtract,
  waitForLatestChatGPTGeneratedImage,
  isNv1ImageCandidateSaveEligible,
  extractLatestChatGPTGeneratedImageBytes,
  decodeImageBufferToPng,
  validateSavedImageFile,
  collectGeneratedImageUrlsScript,
  checkExistingCompletedImageScript,
  ensureChatGptImageLoadedAndHydratedScript,
  adoptExistingSceneImage,
  extractLatestChatGPTGeneratedImageBytesScript,
  getChatGptImageCandidateBoxScript,
  getLatestImageBoxScript,
  waitForChatGptImageOrRetry,
  waitForChatGptResponse,
  validateNv2ResponseOwnership,
  maybeRenameChatGptCurrentConversationUntilTitle,
  renameChatGptCurrentConversationUntilTitle,
  waitForChatGptRecentItem,
  checkChatGptCurrentConversationTitle,
  getChatTitleStableKey,
  markChatTitleStable,
  isChatTitleStable,
  sanitizeChatTitleForLog,
};

function isValidChatGptConversationUrl(url = "") {
  return /^https:\/\/chatgpt\.com\/c\/[^/?#]+/i.test(String(url || "").trim());
}

async function waitForChatGptHydrationResponse(
  client,
  beforeCount = 0,
  {
    sceneId = 0,
    request = 0,
    beforeText = "",
    timeoutMs = 180000,
    idleReloadMs = 120000,
    requireReady = true,
    expectedPrompt = "",
  } = {},
) {
  await captureAndLogChatGptDiagnostics(client, sceneId, beforeCount, `hydration-request-${request}-init`).catch(() => null);

  const baselineText = String(beforeText || "").trim();
  const expectedPromptHash = hashChatGptSnapshotText(expectedPrompt);
  const startedAt = Date.now();
  let refreshedAfterIdle = false;
  while (Date.now() - startedAt < timeoutMs) {
    assertPipelineRunActive();
    await sleep(2500);
    const snapshot = await evaluateOnCdpPage(
      client,
      `(${readLatestAssistantScript.toString()})()`,
    ).catch(() => ({}));
    const conversationState = await getConversationState(client);
    const requestOwned =
      Boolean(expectedPromptHash) &&
      conversationState?.latestUserMessageHash === expectedPromptHash;
    const text = String(snapshot?.text || "").trim();
    const hasNewMessage =
      Number(snapshot?.count || 0) > Number(beforeCount || 0);
    const hasChangedLatestText =
      Boolean(baselineText) && Boolean(text) && text !== baselineText;
    const ready = !requireReady || validateReadyResponse(text);

    await appendAppLog(sceneId, {
      source: "main",
      kind: "running",
      text: `ChatGPT hydration request ${request}: waiting for response (assistant count: ${snapshot?.count || 0}/${beforeCount}, generating: ${snapshot?.generating || false})`,
      details: {
        elapsedMs: Date.now() - startedAt,
        timeoutMs,
        latestTextChanged: hasChangedLatestText,
        ready,
        requestOwned,
        chars: text.length,
      },
    }).catch(() => null);
    if (
      requestOwned &&
      (hasNewMessage || hasChangedLatestText) &&
      ready &&
      !snapshot?.generating
    ) {
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: `ChatGPT hydration request ${request} acknowledged.`,
        details: {
          sceneId,
          chars: text.length,
          beforeCount,
          latestCount: snapshot?.count || 0,
          latestTextChanged: hasChangedLatestText,
          ready,
          requestOwned,
        },
      }).catch(() => null);
      return text;
    }
    if (
      !refreshedAfterIdle &&
      Date.now() - startedAt > idleReloadMs &&
      !snapshot?.generating &&
      !hasNewMessage
    ) {
      refreshedAfterIdle = true;
      await appendAppLog(null, {
        source: "main",
        kind: "warning",
        text: `ChatGPT hydration request ${request} has no owned response after ${Math.round(idleReloadMs / 1000)}s. Keeping the current page unchanged while continuing to wait.`,
        details: { sceneId, beforeCount, latestCount: snapshot?.count || 0 },
      }).catch(() => null);
    }
  }
  await captureAndLogChatGptDiagnostics(client, sceneId, beforeCount, `hydration-request-${request}-timeout-pre`).catch(() => null);
  throw new Error(`chatgpt-hydration-request-${request}-response-timeout`);
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
  const request1Prompt =
    "Request 1: read and remember all attached preprompt files. Reply only when ready.";
  const request2Prompt =
    `Request 2: read and remember the attached keyframes from up to ${CHATGPT_HYDRATION_KEYFRAME_LIMIT} previous project scenes. Use them as visual continuity context for upcoming requests. Reply only when ready.`;
  const request1PromptHash = hashChatGptSnapshotText(request1Prompt);
  const request2PromptHash = hashChatGptSnapshotText(request2Prompt);

  const page = await getCdpPage("chatgpt", true, { bringToFront: true });
  try {
    const readConversationIdentity = async () => {
      const state = await getConversationState(page).catch(() => null);
      const location = await getChatGptLocationState(page).catch(() => ({}));
      return {
        state,
        conversationId: String(
          state?.currentChatId || conversationIdFromLocation(location) || "",
        ).trim(),
        url: String(location?.safeUrl || location?.url || "").trim(),
      };
    };

    const initialIdentity = await readConversationIdentity();
    const initialConversationState = initialIdentity.state;
    const initialConversationLength = Number(
      initialConversationState?.conversationLength,
    );
    if (
      !initialConversationState?.ok ||
      !Number.isFinite(initialConversationLength)
    ) {
      throw new Error("chatgpt-hydration-conversation-state-unavailable");
    }

    if (initialConversationLength === 0) {
      snapshot.hydration = {
        conversationId: initialIdentity.conversationId,
        startedAt: new Date().toISOString(),
        request1Sent: false,
        request1PromptHash,
        request1Done: false,
        request2Sent: false,
        request2PromptHash,
        request2Done: false,
      };
      snapshot.pipelineStage = "HYDRATION_1";
      snapshot.imageValidated = false;
      await writeSceneSnapshot(sceneDir, snapshot);
      await appendAppLog(sceneId, {
        source: "main",
        kind: "running",
        text: `Scene ${sceneId}: CHAT_INIT conversationLength=0; starting mandatory Request 1/2 hydration.`,
        details: { sceneId, conversationLength: 0 },
      }).catch(() => null);
    } else {
      snapshot.hydration = snapshot.hydration || {};
      const currentPromptOwned = Boolean(
        initialConversationState?.latestUserMessageHash &&
          [request1PromptHash, request2PromptHash].includes(
            initialConversationState.latestUserMessageHash,
          ),
      );
      const sameConversation = Boolean(
        initialIdentity.conversationId &&
          ((snapshot.hydration.conversationId &&
            snapshot.hydration.conversationId ===
              initialIdentity.conversationId) ||
            (!snapshot.hydration.conversationId && currentPromptOwned)),
      );
      const hydrationPending = Boolean(
        snapshot.hydration.startedAt &&
          (!snapshot.hydration.request1Done || !snapshot.hydration.request2Done),
      );
      if (!hydrationPending || !sameConversation) {
        await appendAppLog(sceneId, {
          source: "main",
          kind: "running",
          text: `ChatGPT hydration skipped: non-empty chat has no matching incomplete hydration checkpoint.`,
          details: {
            sceneId,
            conversationLength: initialConversationLength,
            liveConversationId: initialIdentity.conversationId,
            checkpointConversationId:
              snapshot.hydration.conversationId || "",
          },
        }).catch(() => null);
        setChatGptContextFresh(false);
        globalThis.__vidoraChatGptNewChatMode = false;
        return;
      }
      if (!snapshot.hydration.conversationId) {
        snapshot.hydration.conversationId = initialIdentity.conversationId;
        await writeSceneSnapshot(sceneDir, snapshot);
      }
      await appendAppLog(sceneId, {
        source: "main",
        kind: "running",
        text: `Scene ${sceneId}: resuming mandatory hydration in the owned conversation.`,
        details: {
          conversationId: initialIdentity.conversationId,
          request1Sent: Boolean(snapshot.hydration.request1Sent),
          request1Done: Boolean(snapshot.hydration.request1Done),
          request2Sent: Boolean(snapshot.hydration.request2Sent),
          request2Done: Boolean(snapshot.hydration.request2Done),
        },
      }).catch(() => null);
    }

    if (!snapshot.hydration.request1Done) {
      let liveIdentity = await readConversationIdentity();
      let request1Owned = Boolean(
        snapshot.hydration.request1PromptHash === request1PromptHash &&
          liveIdentity.state?.latestUserMessageHash === request1PromptHash &&
          (!snapshot.hydration.conversationId ||
            snapshot.hydration.conversationId === liveIdentity.conversationId),
      );

      if (
        request1Owned &&
        !snapshot.hydration.request1Sent &&
        Number.isFinite(Number(snapshot.hydration.request1BeforeCount))
      ) {
        snapshot.hydration.conversationId = liveIdentity.conversationId;
        snapshot.hydration.request1Sent = true;
        snapshot.hydration.request1SentAt = new Date().toISOString();
        snapshot.pipelineStage = "HYDRATION_1_WAIT";
        await writeSceneSnapshot(sceneDir, snapshot);
      }

      if (!(snapshot.hydration.request1Sent && request1Owned)) {
        snapshot.hydration.request1Sent = false;
        await setChatGptTaskState(sceneDir, "REQUEST1", "SEND", { sceneId });
        const prepromptFiles = projectDir
          ? await collectPrepromptRequestFiles({ outputFolder: projectDir })
          : [];
        const beforePreprompt = await evaluateOnCdpPage(
          page,
          `(${countChatGptAssistantRootsScript.toString()})()`,
        ).catch(() => ({ count: 0 }));
        const beforePrepromptLatest = await evaluateOnCdpPage(
          page,
          `(${readLatestAssistantScript.toString()})()`,
        ).catch(() => ({}));

        if (prepromptFiles.length) {
          await appendAppLog(sceneId, {
            source: "main",
            kind: "running",
            text: `HYDRATION_REQUEST1_UPLOAD_BEGIN: uploading ${prepromptFiles.length} preprompt file(s).`,
            details: {
              sceneId,
              files: prepromptFiles.map((file) => path.basename(file)),
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
          if (!uploadPreprompt?.ok) {
            throw new Error(
              `chatgpt-hydration-preprompt-upload-failed: ${uploadPreprompt?.error || "unknown"}`,
            );
          }
        } else {
          await appendAppLog(sceneId, {
            source: "main",
            kind: "warning",
            text: `ChatGPT hydrate request 1: preprompt folder has no files; Request 1 will still be sent.`,
            details: { sceneId, projectDir },
          }).catch(() => null);
        }

        snapshot.hydration.request1BeforeCount = Number(
          beforePreprompt?.count || 0,
        );
        snapshot.hydration.request1BeforeText = String(
          beforePrepromptLatest?.text || "",
        );
        snapshot.hydration.request1PromptHash = request1PromptHash;
        snapshot.pipelineStage = "HYDRATION_1_SEND";
        await writeSceneSnapshot(sceneDir, snapshot);
        const sentPreprompt = await sendPromptWithSameChatRefreshRecovery(
          page,
          request1Prompt,
          {
            beforeCount: snapshot.hydration.request1BeforeCount,
            sceneId,
            stage: "hydrate-request-1",
            expectedFilePaths: prepromptFiles,
            attachmentsAlreadyPrepared: true,
            waitForSendButtonReady: true,
            sendReadyTimeoutMs: 15000,
            sendReadyRetryTimeoutMs: 15000,
            sendReadyStableTicks: 1,
            clickImmediatelyWhenReady: true,
          },
        );
        if (!sentPreprompt?.ok) {
          throw new Error(
            `chatgpt-hydration-preprompt-message-failed: ${sentPreprompt?.error || "unknown"}`,
          );
        }

        const promotionDeadline = Date.now() + 15000;
        do {
          liveIdentity = await readConversationIdentity();
          request1Owned =
            liveIdentity.state?.latestUserMessageHash === request1PromptHash;
          if (request1Owned && liveIdentity.conversationId) break;
          await sleep(500);
        } while (Date.now() < promotionDeadline);
        if (!request1Owned) {
          throw new Error(
            "chatgpt-hydration-request-1-user-message-not-confirmed",
          );
        }
        if (!liveIdentity.conversationId) {
          throw new Error(
            "chatgpt-hydration-conversation-id-unavailable-after-request-1",
          );
        }

        snapshot.hydration.conversationId = liveIdentity.conversationId;
        snapshot.hydration.request1Sent = true;
        snapshot.hydration.request1PromptHash = request1PromptHash;
        snapshot.hydration.request1SentAt = new Date().toISOString();
        snapshot.pipelineStage = "HYDRATION_1_WAIT";
        await writeSceneSnapshot(sceneDir, snapshot);
        await appendAppLog(sceneId, {
          source: "main",
          kind: "ok",
          text: `HYDRATION_REQUEST1_SENT_OWNED`,
          details: {
            sceneId,
            conversationId: liveIdentity.conversationId,
          },
        }).catch(() => null);

        if (liveIdentity.url && isValidChatGptConversationUrl(liveIdentity.url)) {
          setActiveConversationUrl(liveIdentity.url);
          await writePipelineSceneState(projectDir, sceneId, {
            chatUrl: liveIdentity.url,
            chatGptConversationUrl: liveIdentity.url,
            conversationIndex:
              chatGptConversationHealth.conversationIndex || 0,
          }).catch(() => null);
        }
      } else {
        await appendAppLog(sceneId, {
          source: "main",
          kind: "running",
          text: `Scene ${sceneId}: Request 1 is already sent and owned; resuming response wait without re-upload.`,
          details: { conversationId: liveIdentity.conversationId },
        }).catch(() => null);
      }

      await setChatGptTaskState(sceneDir, "REQUEST1", "WAIT", { sceneId });
      const request1Text = await waitForChatGptHydrationResponse(
        page,
        snapshot.hydration.request1BeforeCount,
        {
          sceneId,
          request: 1,
          beforeText: snapshot.hydration.request1BeforeText || "",
          timeoutMs: 300000,
          idleReloadMs: 120000,
          requireReady: true,
          expectedPrompt: request1Prompt,
        },
      );
      await setChatGptTaskState(sceneDir, "REQUEST1", "VALIDATE", {
        sceneId,
        chars: String(request1Text || "").length,
      });
      snapshot.hydration.request1Done = true;
      snapshot.hydration.request1CompletedAt = new Date().toISOString();
      snapshot.pipelineStage = "HYDRATION_2";
      await writeSceneSnapshot(sceneDir, snapshot);
      await setChatGptTaskState(sceneDir, "REQUEST1", "COMPLETE", { sceneId });
      await appendAppLog(sceneId, {
        source: "main",
        kind: "ok",
        text: `HYDRATION_REQUEST1_COMPLETE`,
        details: { sceneId },
      }).catch(() => null);
    }

    if (!snapshot.hydration.request2Done) {
      let liveIdentity = await readConversationIdentity();
      if (
        snapshot.hydration.conversationId &&
        liveIdentity.conversationId !== snapshot.hydration.conversationId
      ) {
        throw new Error(
          `chatgpt-hydration-conversation-changed-before-request-2:${snapshot.hydration.conversationId}:${liveIdentity.conversationId || "none"}`,
        );
      }
      let request2Owned = Boolean(
        snapshot.hydration.request2PromptHash === request2PromptHash &&
          liveIdentity.state?.latestUserMessageHash === request2PromptHash,
      );

      if (
        request2Owned &&
        !snapshot.hydration.request2Sent &&
        Number.isFinite(Number(snapshot.hydration.request2BeforeCount))
      ) {
        snapshot.hydration.request2Sent = true;
        snapshot.hydration.request2SentAt = new Date().toISOString();
        snapshot.pipelineStage = "HYDRATION_2_WAIT";
        await writeSceneSnapshot(sceneDir, snapshot);
      }

      if (!(snapshot.hydration.request2Sent && request2Owned)) {
        snapshot.hydration.request2Sent = false;
        await setChatGptTaskState(sceneDir, "REQUEST2", "SEND", { sceneId });
        const recentKeyframes = projectDir
          ? await collectRecentProjectKeyframes(
              projectDir,
              CHATGPT_HYDRATION_KEYFRAME_LIMIT,
              sceneId,
            )
          : [];
        const request2SceneIds = recentKeyframes
          .map((file) =>
            Number(path.basename(file).match(/scene_(\d+)_keyframe/i)?.[1] || 0),
          )
          .filter((id) => id > 0);
        const beforeScenes = await evaluateOnCdpPage(
          page,
          `(${countChatGptAssistantRootsScript.toString()})()`,
        ).catch(() => ({ count: 0 }));
        const beforeScenesLatest = await evaluateOnCdpPage(
          page,
          `(${readLatestAssistantScript.toString()})()`,
        ).catch(() => ({}));

        snapshot.hydration.request2SceneIds = request2SceneIds;
        snapshot.hydration.request2BeforeCount = Number(
          beforeScenes?.count || 0,
        );
        snapshot.hydration.request2BeforeText = String(
          beforeScenesLatest?.text || "",
        );
        snapshot.hydration.request2PromptHash = request2PromptHash;
        snapshot.pipelineStage = "HYDRATION_2_SEND";
        await writeSceneSnapshot(sceneDir, snapshot);
        await appendAppLog(sceneId, {
          source: "main",
          kind: "running",
          text: `HYDRATION_REQUEST2_SELECTION sceneIds=[${request2SceneIds.join(",")}]`,
          details: {
            sceneId,
            sceneIds: request2SceneIds,
            keyframes: recentKeyframes.map((file) => path.basename(file)),
          },
        }).catch(() => null);

        if (recentKeyframes.length) {
          await appendAppLog(sceneId, {
            source: "main",
            kind: "running",
            text: `HYDRATION_REQUEST2_UPLOAD_BEGIN: uploading ${recentKeyframes.length} recent keyframe(s).`,
            details: { sceneId, sceneIds: request2SceneIds },
          }).catch(() => null);
          const uploadKeyframes = await uploadFilesToChatGptSequentially(
            page,
            recentKeyframes,
            sceneId,
            {
              rotationHydration: true,
              request: 2,
              batchUpload: true,
              trailingUploadLog: `Scene ${sceneId}: Uploading recent keyframes for ChatGPT hydration...`,
            },
          );
          if (!uploadKeyframes?.ok) {
            throw new Error(
              `chatgpt-hydration-keyframes-upload-failed: ${uploadKeyframes?.error || "unknown"}`,
            );
          }
        } else {
          await appendAppLog(sceneId, {
            source: "main",
            kind: "warning",
            text: `ChatGPT hydrate request 2: no previous keyframes available; Request 2 will still be sent.`,
            details: { sceneId },
          }).catch(() => null);
        }

        const sentScenes = await sendPromptWithSameChatRefreshRecovery(
          page,
          request2Prompt,
          {
            beforeCount: snapshot.hydration.request2BeforeCount,
            sceneId,
            stage: "hydrate-request-2",
            expectedFilePaths: recentKeyframes,
            attachmentsAlreadyPrepared: true,
            waitForSendButtonReady: true,
            sendReadyTimeoutMs: 15000,
            sendReadyRetryTimeoutMs: 15000,
            sendReadyStableTicks: 1,
            clickImmediatelyWhenReady: true,
          },
        );
        if (!sentScenes?.ok) {
          throw new Error(
            `chatgpt-hydration-keyframes-message-failed: ${sentScenes?.error || "unknown"}`,
          );
        }
        liveIdentity = await readConversationIdentity();
        request2Owned =
          liveIdentity.state?.latestUserMessageHash === request2PromptHash &&
          liveIdentity.conversationId === snapshot.hydration.conversationId;
        if (!request2Owned) {
          throw new Error(
            "chatgpt-hydration-request-2-user-message-not-confirmed",
          );
        }

        snapshot.hydration.request2Sent = true;
        snapshot.hydration.request2PromptHash = request2PromptHash;
        snapshot.hydration.request2SentAt = new Date().toISOString();
        snapshot.pipelineStage = "HYDRATION_2_WAIT";
        await writeSceneSnapshot(sceneDir, snapshot);
        await appendAppLog(sceneId, {
          source: "main",
          kind: "ok",
          text: `HYDRATION_REQUEST2_SENT_OWNED`,
          details: {
            sceneId,
            conversationId: liveIdentity.conversationId,
            sceneIds: snapshot.hydration.request2SceneIds,
          },
        }).catch(() => null);
      } else {
        await appendAppLog(sceneId, {
          source: "main",
          kind: "running",
          text: `Scene ${sceneId}: Request 2 is already sent and owned; resuming response wait without re-upload.`,
          details: {
            conversationId: liveIdentity.conversationId,
            sceneIds: snapshot.hydration.request2SceneIds || [],
          },
        }).catch(() => null);
      }

      await setChatGptTaskState(sceneDir, "REQUEST2", "WAIT", {
        sceneId,
        attachments: (snapshot.hydration.request2SceneIds || []).length,
      });
      const request2Text = await waitForChatGptHydrationResponse(
        page,
        snapshot.hydration.request2BeforeCount,
        {
          sceneId,
          request: 2,
          beforeText: snapshot.hydration.request2BeforeText || "",
          timeoutMs: 600000,
          idleReloadMs: 240000,
          requireReady: true,
          expectedPrompt: request2Prompt,
        },
      );
      await setChatGptTaskState(sceneDir, "REQUEST2", "VALIDATE", {
        sceneId,
        chars: String(request2Text || "").length,
      });
      snapshot.hydration.request2Done = true;
      snapshot.hydration.request2CompletedAt = new Date().toISOString();
      snapshot.pipelineStage = "NV1_DRAFT_READY";
      await writeSceneSnapshot(sceneDir, snapshot);
      await setChatGptTaskState(sceneDir, "REQUEST2", "COMPLETE", { sceneId });
      await appendAppLog(sceneId, {
        source: "main",
        kind: "ok",
        text: `HYDRATION_REQUEST2_COMPLETE`,
        details: { sceneId },
      }).catch(() => null);
    }

    if (!snapshot.hydration.request1Done || !snapshot.hydration.request2Done) {
      throw new Error("chatgpt-mandatory-hydration-incomplete-before-nv1");
    }
    setChatGptContextFresh(false);
    globalThis.__vidoraChatGptNewChatMode = false;
    return;
  } finally {
    await page.close().catch(() => null);
  }
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
        { sceneId, stage: "rotation-hydration-script", expectedFilePaths: [scriptPath] },
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
      { sceneId, stage: "rotation-hydration-scene", expectedFilePaths: scriptFiles },
    );
    if (!sentScript?.ok)
      throw new Error(
        `chatgpt-rotation-script-message-failed: ${sentScript?.error || "unknown"}`,
      );
    await sleep(1500);
  }
  const keyframes = projectDir
    ? await collectRecentProjectKeyframes(
        projectDir,
        CHATGPT_HYDRATION_KEYFRAME_LIMIT,
        sceneId,
      )
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
      { sceneId, stage: "rotation-hydration-keyframes", expectedFilePaths: keyframes },
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
  setChatGptContextFresh(false);
  globalThis.__vidoraChatGptNewChatMode = false;
}

function clearAllChatGptPipelineLocks() {
  motionPromptSendLocks.clear();
}

module.exports = {
  clearAllChatGptPipelineLocks,
  initChatGptPipeline,
  generateImageAndMotionWithChatGPT,
  generateMotionPromptWithChatGPT,
  generateMotionPromptWithChatGPTOnce,
  validateMotionPromptResponse,
  sanitizeAssetUrlForLog,
  startChatGptImageNetworkCapture,
  tryExtractChatGptNetworkImage,
  networkCandidateMatchesOwnedNv1Card,
  chatGptImageCandidateSignature,
  countVisibleChatGptImageCandidates,
  hasVisibleChatGptImageCandidate,
  classifyChatGptImageReadiness,
  captureChatGptImageElementScreenshot,
  saveChatGPTGeneratedImageAsset,
  isLikelyChatGptLoadingPlaceholderImage,
  isPreferredChatGptRealImageAsset,
  isFalseChatGptImageGeneratingState,
  refreshChatGptPageBeforeImageExtract,
  waitForChatGptImageGenerationDoneBeforeExtract,
  waitForLatestChatGPTGeneratedImage,
  isNv1ImageCandidateSaveEligible,
  extractLatestChatGPTGeneratedImageBytes,
  decodeImageBufferToPng,
  validateSavedImageFile,
  collectGeneratedImageUrlsScript,
  checkExistingCompletedImageScript,
  ensureChatGptImageLoadedAndHydratedScript,
  adoptExistingSceneImage,
  extractLatestChatGPTGeneratedImageBytesScript,
  getChatGptImageCandidateBoxScript,
  getLatestImageBoxScript,
  waitForChatGptImageOrRetry,
  waitForChatGptResponse,
  validateNv2ResponseOwnership,
  maybeRenameChatGptCurrentConversationUntilTitle,
  renameChatGptCurrentConversationUntilTitle,
  waitForChatGptRecentItem,
  checkChatGptCurrentConversationTitle,
  getChatTitleStableKey,
  markChatTitleStable,
  isChatTitleStable,
  sanitizeChatTitleForLog,
  hydrateFreshChatGptContextAfterRotation,
};
