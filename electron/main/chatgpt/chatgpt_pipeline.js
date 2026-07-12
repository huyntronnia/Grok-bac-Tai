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
  clickSendButtonViaCdp,
  sendNv2PromptViaDeepCdpInput,
  vidoraChatGptInputGate,
  vidoraReadChatGptComposerStateReal,
  vidoraClickChatGptRealSendButton,
} = require("./chatgpt_send");
const {
  uploadFilesToChatGptSequentially,
  uploadFileToChatGptDirectly,
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
} = require("./chatgpt_recovery");
const {
  isChatGptPolicyRefusalText,
  isRetryableChatGptToolErrorText,
  normalizeChatGptRetryText,
} = require("../recovery");

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

const motionPromptSendLocks = new Map();

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
  const runId = String(options.runId || options.originalOptions?.runId || "").trim();
  const projectDir = options.originalOptions?.outputFolder || path.dirname(sceneDir);

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
    await setChatGptTaskState(sceneDir, "NV1", "WAIT", { sceneId });
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
  snapshot.promptHash = hashChatGptSnapshotText(imagePrompt);
  snapshot.draftId = `draft-scene-${sceneId}-${Date.now()}`;
  snapshot.createdAt = new Date().toISOString();
  await writeSceneSnapshot(sceneDir, snapshot);

  if (!getChatGptContextFresh()) {
    await appendAppLog(sceneId, {
      source: "main",
      kind: "info",
      text: 'Established ChatGPT context detected; preprompt files are not re-uploaded.',
    }).catch(() => null);
  }

  let pageState = await getConversationState(page);
  
  await checkProactiveMemoryGuard(sceneId, pageState);

  const isDraftMatches = !getChatGptContextFresh() && verifyDraftOwnership(snapshot, pageState) && pageState.composerReady;
  
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
    const adoptResult = !getChatGptContextFresh()
      ? await adoptExistingSceneImage(page, Number(options.beforeAssistantCount || 0), sceneId).catch(() => null)
      : null;
    if (adoptResult?.ok && adoptResult.base64) {
      const sourceBuffer = Buffer.from(adoptResult.base64, "base64");
      const decoded = decodeImageBufferToPng(sourceBuffer, adoptResult.contentType);
      await fs.mkdir(path.dirname(imagePath), { recursive: true });
      await fs.writeFile(imagePath, decoded.buffer);
      await validateSavedImageFile(imagePath);
      
      snapshot.pipelineStage = "IMAGE_EXTRACTED";
      snapshot.imageValidated = true;
      await writeSceneSnapshot(sceneDir, snapshot);
      await setChatGptTaskState(sceneDir, "NV1", "VALIDATE", { sceneId });
      await setChatGptTaskState(sceneDir, "NV1", "SAVE", { sceneId, imagePath });
      await setChatGptTaskState(sceneDir, "NV1", "COMPLETE", { sceneId, imagePath });
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
        })()
      `).catch(() => null);
      await sleep(400);
      assertPipelineRunActive(runId);

      const finalPrompt = [
        "Create exactly one image from the prompt below. Do not answer with long text. If possible, render or generate the image directly.",
        imagePrompt,
      ].filter(Boolean).join("\n\n");

      await evaluateOnCdpPage(
        page,
        `(${prepareChatGptCreateImageScript.toString()})()`
      ).catch(() => null);
      await sleep(800);
      assertPipelineRunActive(runId);

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

      assertPipelineRunActive(runId);
      const sentImage = await sendPromptViaCdpInput(page, finalPrompt);
      if (!sentImage?.ok) {
        throw new Error(sentImage?.error || "IMAGE_STAGE NV1 send failed.");
      }

      if (!snapshot.hydration) snapshot.hydration = {};
      snapshot.hydration.promptUploadDone = true;
      snapshot.pipelineStage = "NV1_SENT";
      await writeSceneSnapshot(sceneDir, snapshot);

      const isKeyframeMotionPromptOnly = Boolean(
        options.keyframeMotionPromptOnly ||
        options.originalOptions?.keyframeMotionPromptOnly
      );

      if (isKeyframeMotionPromptOnly) {
        await appendAppLog(sceneId, {
          source: "main",
          kind: "running",
          text: `Scene ${sceneId}: NV1 sent. Sleeping 45 seconds before refresh (keyframe-prompt workflow).`,
        });
        await sleep(45000);
        
        await appendAppLog(sceneId, {
          source: "main",
          kind: "running",
          text: `Scene ${sceneId}: Refreshing page after 45s sleep.`,
        });
        await requestReloadWithReason(page, "keyframe_motion_only_nv1_refresh", sceneId);
        await waitForCdpLoad(page).catch(() => null);
        await sleep(4000);
      }
    }
  }

  const imageNetworkCapture = startChatGptImageNetworkCapture(page, { sceneId });
  try {
    snapshot.pipelineStage = "WAIT_IMAGE";
    await setChatGptTaskState(sceneDir, "NV1", "WAIT", { sceneId });
    await writeSceneSnapshot(sceneDir, snapshot);
    
    assertPipelineRunActive(runId);
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

  await page.close();
  return { imagePath, motionPrompt: "" };
}

async function generateMotionPromptWithChatGPT({
  imagePath,
  prompt,
  sceneDir,
  sceneId,
  sceneText = "",
  chatContextTitle = "",
  chatGptStability = {},
  keyframeMotionPromptOnly = false,
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
      keyframeMotionPromptOnly,
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
    keyframeMotionPromptOnly = false,
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

    const before = {
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

    const nv2PromptAlreadySent =
      pageState.latestUserMessageHash === instructionHash ||
      (Array.isArray(before.userHashes) && before.userHashes.includes(instructionHash)) ||
      (Array.isArray(before.hashes) && before.hashes.includes(instructionHash));

    // If we are resuming from NV2_SENT, first prove the current chat actually has this NV2 prompt.
    if (snapshot.pipelineStage === "NV2_SENT" && nv2PromptAlreadySent) {
      await appendAppLog(sceneId, {
        source: "main",
        kind: "running",
        text: `Scene ${sceneId}: Resuming NV2 from stage NV2_SENT.`
      });
    } else {
      if (snapshot.pipelineStage === "NV2_SENT" && !nv2PromptAlreadySent) {
        await appendAppLog(sceneId, {
          source: "main",
          kind: "warning",
          text: `Scene ${sceneId}: Stale NV2_SENT snapshot ignored; current chat has no matching NV2 prompt. Uploading keyframe and sending NV2 now.`,
          details: {
            latestUserMessageHash: pageState.latestUserMessageHash || "",
            instructionHash,
            beforeUserHashCount: before.userHashes.length,
          },
        }).catch(() => null);
        if (!snapshot.hydration) snapshot.hydration = {};
        snapshot.hydration.sceneUploadDone = false;
        snapshot.hydration.promptUploadDone = false;
      }
      snapshot.pipelineStage = "NV2_DRAFT_READY";
      await setChatGptTaskState(sceneDir, "NV2", "SEND", { sceneId });
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

    await logChatGptStage(page, CHATGPT_STAGES.WAITING_RESPONSE, {
      sceneId,
      stage: "motion_prompt",
      attempt: 1,
    }).catch(() => null);
    await setChatGptTaskState(sceneDir, "NV2", "WAIT", { sceneId });

    const result = await waitForChatGptResponse(page, before, {
      sceneId,
      promptText: instruction,
      promptHash: instructionHash,
      targetTitle: chatContextTitle,
      stage: "motion-prompt-response",
      chatGptStability,
      refreshAfterMs: undefined,
      refreshReason: undefined,
    });
    if (!result?.ok) {
      throw new Error(result?.error || "IMAGE_STAGE NV2 response waiting failed.");
    }

    const stableText = String(result.text || "").trim();
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
    value.length > 15
  ) {
    return { ok: true };
  }

  return {
    ok: false,
    error: value.length <= 15 ? "too-short" : "still-generating-or-streaming",
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
const IMAGE_WAIT_STABLE_TICKS_REQUIRED = 3;
const IMAGE_WAIT_READY_TICKS_REQUIRED = 8;
const IMAGE_WAIT_ATTEMPT_TIMEOUT_MS = 300000;
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
async function maybeRefreshChatGptImageWaitPage(ctx, client, sceneId, options = {}) {
  const force = Boolean(options.force);
  if (!force && Date.now() < ctx.nextRefreshAt) return false;

  ctx.refreshCount += 1;
  const elapsedMs = Date.now() - ctx.startedAt;
  const reason = String(options.reason || "periodic-nv1-image-wait-refresh");

  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: force
      ? `Scene ${sceneId}: Force refreshing ChatGPT while waiting for NV1 image. Reason: ${reason}.`
      : `Scene ${sceneId}: Periodic ChatGPT refresh after 60s while waiting for NV1 image.`,
    details: { elapsedMs, refreshCount: ctx.refreshCount, reason, ...(options.details || {}) },
  }).catch(() => null);

  await refreshChatGptPageBeforeImageExtract(client, {
    sceneId,
    stage: `${reason}-${ctx.refreshCount}`,
    waitedMs: elapsedMs,
    refreshCount: ctx.refreshCount,
  }).catch(() => null);

  await waitForCdpLoad(client).catch(() => null);
  await sleep(4000);

  if (force) {
    ctx.nextRefreshAt = Date.now() + IMAGE_WAIT_REFRESH_INTERVAL_MS;
  } else {
    ctx.nextRefreshAt += IMAGE_WAIT_REFRESH_INTERVAL_MS;
  }
  return true;
}

/**
 * Runtime monitor snapshot, normalized into the shape the rest of the wait
 * loop expects (previously inlined per-tick in the while loop).
 */
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
async function pollChatGptDom(client, minAssistantRootIndex) {
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
    })()`,
  ).catch(() => false);

  const hasImageTurn = await evaluateOnCdpPage(
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
    })(${Number(minAssistantRootIndex || 0)})`,
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
async function maybeHydrateChatGptImage(ctx, client, minAssistantRootIndex, sceneId, domSignals) {
  if (!domSignals?.hasImageTurn) return null;

  const hydration = await evaluateOnCdpPage(
    client,
    `(${ensureChatGptImageLoadedAndHydratedScript.toString()})(${minAssistantRootIndex})`,
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
async function scanChatGptImageCandidates(client, options, minAssistantRootIndex, ctx, signals) {
  const { scopedSnapshot, activeGeneration, sceneId } = signals;

  const extracted = await extractLatestChatGPTGeneratedImageBytes(client, {
    existingUrls: [...ctx.knownUrls],
    minAssistantRootIndex,
  }).catch((error) => {
    if (isPipelineCancelledError(error)) throw error;
    return { ok: false, error: error.message, mode: "extract-error" };
  });

  const visibleCandidate =
    hasVisibleChatGptImageCandidate(extracted) ||
    (Array.isArray(scopedSnapshot?.urls) && scopedSnapshot.urls.length > 0);

  const networkExtract =
    !extracted?.ok && (!activeGeneration || visibleCandidate)
      ? await tryExtractChatGptNetworkImage(client, options.networkCapture).catch((error) => ({
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
  const minAssistantRootIndex = Number(options.minAssistantRootIndex || 0);

  const ctx = new ImageWaitContext(Date.now());
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
      text: `chatgptImageExtract: waiting for latest assistant image for scene ${sceneId}`,
      details: { minAssistantRootIndex, existingUrlCount: ctx.knownUrls.size },
    });

    for (let attempt = 1; attempt <= 1; attempt += 1) {
    assertPipelineRunActive(runId);
    const attemptStartedAt = Date.now();
    let sawGenerating = false;
    let readyTicks = 0;
    let lastLogAt = 0;
    let refreshedForVisibleOutput = false;
    let textOnlyAnswer = false;
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
      assertPipelineRunActive(runId);
      assertPipelineRunActive();
      await notifyRenderer('chatgpt-image-retry', `Scene ${sceneId}: ChatGPT image not ready (${reason}); retrying NV1 attempt ${attempt + 1}/3.`, { sceneId, attempt, reason });
      assertPipelineRunActive(runId);
      assertPipelineRunActive();
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

        if (
          options.referenceImagePaths &&
          options.referenceImagePaths.length > 0
        ) {
          for (const refPath of options.referenceImagePaths) {
            assertPipelineRunActive(runId);
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
        assertPipelineRunActive(runId);
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
      assertPipelineRunActive(runId);
      const retryPrompt = `${options.prompt}\n\nRETRY ${attempt + 1}: Previous response did not produce a complete usable image asset. Generate exactly one image in this chat now. Do not answer with text only.`;
      await evaluateOnCdpPage(
        client,
        `(${prepareChatGptCreateImageScript.toString()})()`,
      ).catch(() => null);
      await sleep(800);
      assertPipelineRunActive(runId);
      const resent = await sendPromptViaCdpInput(client, retryPrompt);
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
      hasWaitedOnce = false;
    };

    while (Date.now() - attemptStartedAt < IMAGE_WAIT_ATTEMPT_TIMEOUT_MS) {
      assertPipelineRunActive(runId);

      // ---- 1. periodic refresh (fixed schedule; never resets waiting state) ----
      await maybeRefreshChatGptImageWaitPage(ctx, client, sceneId);

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
      const domSignals = await pollChatGptDom(client, minAssistantRootIndex);
      const snapshot = pollChatGptRuntime();
      ctx.lastSnapshot = snapshot;

      // ---- 3. hydrate only when an image turn exists, then extract ----
      const hydration = await maybeHydrateChatGptImage(ctx, client, minAssistantRootIndex, sceneId, domSignals);

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
      const hasNewAssistantAfterPrompt =
        Number(snapshot?.assistantCount || 0) > minAssistantRootIndex ||
        domSignals.hasActiveAssistantResponse;
      const scopedSnapshot = hasNewAssistantAfterPrompt
        ? snapshot
        : { ...snapshot, urls: [] };

      // ---- 4. scan candidates (DOM -> network -> screenshot) ----
      const {
        extracted,
        networkExtract,
        screenshotExtract,
        chosen: rawChosen,
        visibleCandidate,
      } = await scanChatGptImageCandidates(client, options, minAssistantRootIndex, ctx, {
        scopedSnapshot,
        activeGeneration,
        sceneId,
      });
      lastExtract = extracted;
      if (extracted?.diagnostics) lastDiagnostic = extracted.diagnostics;

      const chosen = await validateChatGptImageCandidate(rawChosen, sceneId, ctx, client);

      const readiness = classifyChatGptImageReadiness({
        chosen,
        extracted,
        snapshot: scopedSnapshot,
        elapsedMs: Date.now() - attemptStartedAt,
        stallMs: IMAGE_WAIT_REAL_STALL_MS,
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

      // ---- 5. progress detection (resets ctx.lastProgressAt on any change) ----
      detectImageWaitProgress(ctx, {
        assistantCount: snapshot?.assistantCount || 0,
        latestAssistantText: snapshot?.latestAssistantText || "",
        candidateSignature: chosen?.ok ? chatGptImageCandidateSignature(chosen) : "",
        urls: scopedSnapshot?.urls || [],
        runtimeState: snapshot?.runtimeState || "",
      });

      // ---- 6. candidate stability (never reused across a different candidate) ----
      const stableTicks = updateCandidateStability(ctx, chosen);

      if (chosen?.ok) {
        await appendAppLog(null, {
          source: "main",
          kind: stableTicks >= IMAGE_WAIT_STABLE_TICKS_REQUIRED ? "ok" : "running",
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
        if (stableTicks >= IMAGE_WAIT_STABLE_TICKS_REQUIRED) {
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
            sceneId,
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
    const assistantRoleNodes = [
      ...document.querySelectorAll('[data-message-author-role="assistant"]'),
    ];
    const rootSelector = [
      ".agent-turn",
      '[data-testid*="conversation-turn"]',
      "[data-message-id]",
      "article",
      ".message",
    ].join(", ");
    const imageTurnMarkerSelector = [
      ".agent-turn",
      ".group\\/imagegen-image",
      'img[alt^="Generated image"]',
      'button[aria-label="Edit image"]',
      '[data-testid="image-gen-overlay-actions"]',
      '[data-testid*="image"]',
      '[class*="image-turn"]',
      '[class*="media"]',
      '[class*="asset"]',
    ].join(", ");
    const hasImageTurnMarker = (node) =>
      Boolean(
        node.matches?.(imageTurnMarkerSelector) ||
          node.querySelector?.(
            '.group\\/imagegen-image, img[alt^="Generated image"], button[aria-label="Edit image"], [data-testid="image-gen-overlay-actions"]',
          ),
      );
    const imageTurnNodes = [
      ...document.querySelectorAll(imageTurnMarkerSelector),
    ].map((node) => node.closest?.(rootSelector) || node).filter((node) => {
      if (node.closest?.('[data-message-author-role="user"]')) return false;
      if (node.querySelector?.('[data-message-author-role="user"]'))
        return false;
      if (!node.querySelector?.('img, picture source, canvas, a[href], button')) return false;
      return (
        hasImageTurnMarker(node) ||
        isVisible(node, true) ||
        Boolean(node.querySelector?.('img, canvas'))
      );
    });
    const fallbackNodes = [
      ...document.querySelectorAll(
        rootSelector,
      ),
    ].filter((node) => {
      if (node.closest?.('[data-message-author-role="user"]')) return false;
      if (node.querySelector?.('[data-message-author-role="user"]'))
        return false;
      const text = (node.innerText || "").trim();
      return (
        text.length > 20 ||
        hasImageTurnMarker(node) ||
        node.querySelector?.("img, picture source, canvas, a[href], button")
      );
    });
    const toRoots = (nodes, mode) =>
      nodes.map((node) => ({ node, mode }));
    const dedupeRoots = (items) => {
      const seen = new Set();
      return items
        .filter((item) => {
          if (!item?.node || seen.has(item.node)) return false;
          seen.add(item.node);
          return true;
        })
        .sort(
          (a, b) =>
            (a.node.getBoundingClientRect?.().y || 0) -
            (b.node.getBoundingClientRect?.().y || 0),
        )
        .map((item, index) => ({ ...item, index }));
    };
    const assistantRoleRoots = dedupeRoots(toRoots(assistantRoleNodes, "assistant-role"));
    const responseRoots = dedupeRoots([
      ...toRoots(assistantRoleNodes, "assistant-role"),
      ...toRoots(imageTurnNodes, "image-turn-root"),
      ...toRoots(fallbackNodes, "fallback-assistant-root"),
    ]);
    return {
      assistantRoleRoots,
      responseRoots,
      rootDebug: {
        roleNodeCount: assistantRoleNodes.length,
        fallbackNodeCount: fallbackNodes.length,
        imageTurnNodeCount: imageTurnNodes.length,
        agentTurnNodeCount: [...document.querySelectorAll(".agent-turn")].length,
        generatedImageNodeCount: [
          ...document.querySelectorAll(
            '.group\\/imagegen-image, img[alt^="Generated image"]',
          ),
        ].length,
      },
    };
  };
  const { assistantRoleRoots, responseRoots, rootDebug } = rootsFrom();
  const baselineLooksStale =
    minRoot > 0 &&
    responseRoots.length > 0 &&
    minRoot >= responseRoots.length &&
    minRoot > assistantRoleRoots.length;
  const scanMinRoot = baselineLooksStale
    ? 0
    : Math.min(minRoot, Math.max(0, responseRoots.length - 1));
  const selectedRoots = responseRoots.filter(
    (root) =>
      root.index >= scanMinRoot ||
      root.mode === "image-turn-root",
  );
  const waitingForNewAssistantRoot =
    !baselineLooksStale &&
    minRoot > 0 &&
    !selectedRoots.length &&
    assistantRoleRoots.length;
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
    assistantRootCount: assistantRoleRoots.length,
    responseRootCount: responseRoots.length,
    selectedRootCount: roots.length,
    roleNodeCount: rootDebug.roleNodeCount,
    fallbackNodeCount: rootDebug.fallbackNodeCount,
    uniqueRootCount: responseRoots.length,
    agentTurnNodeCount: rootDebug.agentTurnNodeCount,
    imageTurnNodeCount: rootDebug.imageTurnNodeCount,
    generatedImageNodeCount: rootDebug.generatedImageNodeCount,
    minAssistantRootIndex: minRoot,
    effectiveMinAssistantRootIndex: scanMinRoot,
    staleMinAssistantRootIndex: baselineLooksStale,
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
    rootCount: responseRoots.length,
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


async function waitForChatGptResponse(page, before, options = {}) {
  const {
    sceneId,
    promptText: instruction,
  } = options;
  const runId = String(options.runId || options.originalOptions?.runId || "").trim();

  const startedAt = Date.now();
  let latest = '';
  let lastBadMotionText = '';
  let badMotionTextTicks = 0;
  let lastStableHash = "";
  let previousPollHash = "";
  let lastTextChangeAt = Date.now();
  let stableResponseTicks = 0;
  const NV2_RESPONSE_TIMEOUT_MS = 300000;
  const NV2_STABLE_RESPONSE_TICKS = 3;
  const NV2_TEXT_STABLE_MS = 4000;

  await chatGptRuntimeMonitor.startMonitoring(page).catch(() => null);

  try {
    while (Date.now() - startedAt < NV2_RESPONSE_TIMEOUT_MS) {
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
      const completed = extractCompletedNv2ResponseFromSnapshot(completedSnapshot, before);
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
          elapsedMs: Date.now() - startedAt,
          timeoutMs: NV2_RESPONSE_TIMEOUT_MS,
          latestTextChanged: hasChangedLatestText,
          freshAssistant,
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
        !hardGenerating &&
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
          elapsedMs: Date.now() - startedAt,
        },
      }).catch(() => null);

      await sleep(1500);
    }

    throw new Error(`Timeout waiting for NV2 response after ${Math.round(NV2_RESPONSE_TIMEOUT_MS / 1000)}s without resend.`);
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
  } = {},
) {
  await captureAndLogChatGptDiagnostics(client, sceneId, beforeCount, `hydration-request-${request}-init`).catch(() => null);

  const baselineText = String(beforeText || "").trim();
  const startedAt = Date.now();
  let refreshedAfterIdle = false;
  while (Date.now() - startedAt < timeoutMs) {
    assertPipelineRunActive();
    await sleep(2500);
    const snapshot = await evaluateOnCdpPage(
      client,
      `(${readLatestAssistantScript.toString()})()`,
    ).catch(() => ({}));
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
        chars: text.length,
      },
    }).catch(() => null);
    if ((hasNewMessage || hasChangedLatestText) && ready && !snapshot?.generating) {
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
        text: `ChatGPT hydration request ${request} has no response after ${Math.round(idleReloadMs / 1000)}s and no loading state. Refreshing page once before continuing wait.`,
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
  if (getChatGptContextFresh()) {
    snapshot.hydration = {};
    snapshot.pipelineStage = "";
    snapshot.imageValidated = false;
    await writeSceneSnapshot(sceneDir, snapshot);
    await appendAppLog(sceneId, {
      source: "main",
      kind: "running",
      text: `Scene ${sceneId}: Resetting scene snapshot hydration state for fresh ChatGPT context.`,
    }).catch(() => null);
  }

  if (!snapshot.hydration) {
    snapshot.hydration = {};
  }
  snapshot.hydration.request1Done = false;
  snapshot.hydration.request2Done = false;
  snapshot.hydration.characterUploadDone = !!snapshot.hydration.characterUploadDone;
  snapshot.hydration.sceneUploadDone = !!snapshot.hydration.sceneUploadDone;
  snapshot.hydration.lastFrameUploadDone = !!snapshot.hydration.lastFrameUploadDone;
  snapshot.hydration.promptUploadDone = !!snapshot.hydration.promptUploadDone;

  const page = await getCdpPage("chatgpt", true, { bringToFront: true });
  const initialAssistantCount = await evaluateOnCdpPage(
    page,
    `(${countChatGptAssistantRootsScript.toString()})()`,
  ).catch(() => ({ count: 0 }));
  if (Number(initialAssistantCount?.count || 0) > 0) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `ChatGPT hydrate skipped: current chat already has assistant messages.`,
      details: { sceneId, assistantCount: initialAssistantCount?.count || 0 },
    }).catch(() => null);
    setChatGptContextFresh(false);
    globalThis.__vidoraChatGptNewChatMode = false;
    return;
  }

  {
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
    await setChatGptTaskState(sceneDir, "REQUEST1", "WAIT", { sceneId });
    const request1Text = await waitForChatGptHydrationResponse(page, beforePreprompt?.count || 0, {
      sceneId,
      request: 1,
      beforeText: beforePrepromptLatest?.text || "",
      timeoutMs: 300000,
      idleReloadMs: 120000,
      requireReady: true,
    });
    await setChatGptTaskState(sceneDir, "REQUEST1", "VALIDATE", {
      sceneId,
      chars: String(request1Text || "").length,
    });

    snapshot.hydration.request1Done = true;
    snapshot.pipelineStage = "HYDRATION_2";
    await writeSceneSnapshot(sceneDir, snapshot);
    await setChatGptTaskState(sceneDir, "REQUEST1", "COMPLETE", { sceneId });
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
    setActiveConversationUrl(promotedUrl);
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

  {
    await setChatGptTaskState(sceneDir, "REQUEST2", "SEND", { sceneId });
    const recentKeyframes = projectDir
      ? await collectRecentProjectKeyframes(projectDir, 5, sceneId)
      : [];
    const beforeScenes = await evaluateOnCdpPage(
      page,
      `(${countChatGptAssistantRootsScript.toString()})()`,
    ).catch(() => ({ count: 0 }));
    const beforeScenesLatest = await evaluateOnCdpPage(
      page,
      `(${readLatestAssistantScript.toString()})()`,
    ).catch(() => ({}));
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
          batchUpload: true,
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
      "Request 2: read and remember the attached keyframes from up to 5 previous project scenes. Use them as visual continuity context for upcoming requests. Reply only when ready.",
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
    await setChatGptTaskState(sceneDir, "REQUEST2", "WAIT", {
      sceneId,
      attachments: recentKeyframes.length,
    });
    const request2Text = await waitForChatGptHydrationResponse(page, beforeScenes?.count || 0, {
      sceneId,
      request: 2,
      beforeText: beforeScenesLatest?.text || "",
      timeoutMs: 600000,
      idleReloadMs: 240000,
      requireReady: true,
    });
    await setChatGptTaskState(sceneDir, "REQUEST2", "VALIDATE", {
      sceneId,
      chars: String(request2Text || "").length,
    });

    snapshot.hydration.request2Done = true;
    snapshot.pipelineStage = "NV1_DRAFT_READY";
    await writeSceneSnapshot(sceneDir, snapshot);
    await setChatGptTaskState(sceneDir, "REQUEST2", "COMPLETE", { sceneId });
  }

  setChatGptContextFresh(false);
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
    ? await collectRecentProjectKeyframes(projectDir, 5)
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
