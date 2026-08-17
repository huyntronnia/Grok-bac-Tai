const { appendAppLog } = require("../logging");
const { sleep } = require("../utils");
const {
  getConversationState,
  waitForCdpLoad,
  evaluateOnCdpPage,
  getChatGptSendState,
} = require("./chatgpt_core");
const {
  detectLoginScript,
  detectBrowserCrashPageScript,
  dismissChatGptBlockingUiScript,
  detectChatGptResponseChoiceUiScript,
  readChatGptImageStateScript,
  clickChatGptStartNewChatScript,
} = require("./chatgpt_dom");
const { verifyAttachmentsReady } = require("./chatgpt_upload");
const {
  clickSendButtonViaCdp,
} = require("./chatgpt_send");
const {
  hashChatGptSnapshotText,
  writeSceneSnapshot,
  isChatGptActivelyGenerating,
  sanitizeChatGptImageSnapshot,
} = require("../state");
const {
  setChatGptContextFresh,
} = require("../state/chatgpt_state");
let CDP = null;

// Injected dependencies
let getCdpPage = () => null;
let tryAutoLoginWithStoredAccount = () => null;
let closeUnexpectedProviderTabs = () => null;
let invalidateChatGptConversationIdentity = () => null;
let resetSessionSceneCounter = () => null;
let assertPipelineRunActive = () => null;
let CHROME_DEBUG_PORT = 9223;
let PROVIDER_META = {};

function initChatGptRecovery(runtime = {}) {
  if (typeof runtime.getCdpPage === "function") {
    getCdpPage = runtime.getCdpPage;
  }
  if (typeof runtime.tryAutoLoginWithStoredAccount === "function") {
    tryAutoLoginWithStoredAccount = runtime.tryAutoLoginWithStoredAccount;
  }
  if (typeof runtime.closeUnexpectedProviderTabs === "function") {
    closeUnexpectedProviderTabs = runtime.closeUnexpectedProviderTabs;
  }
  if (typeof runtime.invalidateChatGptConversationIdentity === "function") {
    invalidateChatGptConversationIdentity = runtime.invalidateChatGptConversationIdentity;
  }
  if (typeof runtime.resetSessionSceneCounter === "function") {
    resetSessionSceneCounter = runtime.resetSessionSceneCounter;
  }
  if (typeof runtime.assertPipelineRunActive === "function") {
    assertPipelineRunActive = runtime.assertPipelineRunActive;
  }
  if (runtime.CHROME_DEBUG_PORT !== undefined) {
    CHROME_DEBUG_PORT = runtime.CHROME_DEBUG_PORT;
  }
  if (runtime.PROVIDER_META !== undefined) {
    PROVIDER_META = runtime.PROVIDER_META;
  }
}

function isReloadBlocked(sceneId = "unknown", policy = {}) {
  if (globalThis.__vidoraActiveActionLock) {
    return `Blocked reload: Active Action Lock [${globalThis.__vidoraActiveActionLock}] is held.`;
  }
  if (globalThis.__vidoraPendingAction) {
    return `Blocked reload: Pending Action [${globalThis.__vidoraPendingAction}] is active.`;
  }
  const composerState = globalThis.__vidoraLastComposerState || "EMPTY";
  const sendState = getChatGptSendState(sceneId);
  const allowWaitAccept = Boolean(
    policy.allowWaitAcceptAtSafeBoundary ||
    policy.allowStaleNv1WrapperRefresh,
  );
  const allowFailedDraftRefresh = Boolean(
    policy.allowFailedDraftRefresh && sendState === "FAILED",
  );
  if (
    composerState === "ATTACHING_FILES" ||
    (composerState === "READY_TO_SEND" && !allowFailedDraftRefresh) ||
    (composerState === "WAIT_ACCEPT" && !allowWaitAccept)
  ) {
    return `Blocked reload: Composer is in safe state [${composerState}].`;
  }
  if (sendState === "PREPARING" || sendState === "READY" || sendState === "CLICKING" || sendState === "SENDING" || sendState === "ATTACHING") {
    return `Blocked reload: ChatGptSendState is ${sendState}.`;
  }
  return null;
}

async function requestReloadWithReason(
  page,
  reason,
  sceneId = "unknown",
  policy = {},
) {
  await appendAppLog(sceneId, {
    source: "main",
    kind: "warning",
    text: `Scene ${sceneId}: Requesting page reload. Reason: ${reason}`
  }).catch(() => null);

  const blockedReason = isReloadBlocked(sceneId, policy);
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
    await page.Page.reload({
      ignoreCache: true,
      __vidoraReloadPolicy: policy,
    }).catch(() => null);
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

    await appendAppLog(sceneId, {
      source: "main",
      kind: "warning",
      text: "Recovery Level 8: automatic chat rotation disabled; waiting for manual recovery."
    });
    return { action: "wait", pageState };
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

function isTransientCdpNavigationError(error) {
  return /execution context.*destroyed|cannot find context|most likely because of (?:a )?navigation|frame was detached|navigat(?:ed|ing|ion).*context/i.test(
    String(error?.message || error || ""),
  );
}

function isCdpCrashError(error) {
  if (isTransientCdpNavigationError(error)) return false;
  return /crash|crashed|Aw, Snap|Out of Memory|target.*closed|inspected target.*closed|webcontents was destroyed|session closed/i.test(
    String(error?.message || error || ""),
  );
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
    if (provider === "chatgpt") {
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
    transientNavigation: isTransientCdpNavigationError(error),
    error: error.message,
  }));

  const currentSceneId = globalThis.__vidoraLastProcessedSceneId || "unknown";
  const sendState = getChatGptSendState(currentSceneId);

  if (state?.transientNavigation) {
    await appendAppLog(currentSceneId, {
      source: "main",
      kind: "running",
      text: `${PROVIDER_META[provider]?.title || provider}: transient navigation interrupted a CDP read during ${reason}; preserving the current conversation and waiting for the page to settle.`,
      details: { provider, reason, state },
    }).catch(() => null);
    await waitForCdpLoad(client).catch(() => null);
    await sleep(350);
    const afterNavigation = await evaluateOnCdpPage(
      client,
      `(${detectBrowserCrashPageScript.toString()})()`,
    ).catch((error) => ({
      ok: false,
      crashed: isCdpCrashError(error),
      transientNavigation: isTransientCdpNavigationError(error),
      error: error.message,
    }));
    if (!afterNavigation?.crashed) {
      return {
        ok: true,
        skipped: true,
        reason: "TRANSIENT_CDP_NAVIGATION",
        state,
        after: afterNavigation,
      };
    }
    state.crashed = true;
    state.transientNavigation = false;
    state.reason = afterNavigation.reason || state.reason;
    state.error = afterNavigation.error || state.error;
  }

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
    transientNavigation: isTransientCdpNavigationError(error),
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
  if (client && client.clientType === "playwright") {
    try {
      const contexts = client.browser.contexts();
      if (contexts.length > 0) {
        const pages = contexts[0].pages();
        const providerHost = new URL((PROVIDER_META[provider] || PROVIDER_META.chatgpt).url).hostname;
        for (const p of pages) {
          const urlStr = p.url() || "";
          if (p !== client.page && urlStr && !urlStr.includes(providerHost) && /(linkedin\.com|facebook\.com|twitter\.com|x\.com|\/share\b|\/sharing\b)/i.test(urlStr)) {
            await p.close().catch(() => null);
          }
        }
      }
    } catch (err) {
      // Bỏ qua lỗi
    }
  } else {
    if (!CDP) CDP = require("chrome-remote-interface");
    await closeUnexpectedProviderTabs(
      await CDP.List({ host: "127.0.0.1", port: CHROME_DEBUG_PORT }).catch(
        () => [],
      ),
      "chatgpt",
    ).catch(() => null);
  }
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
      targetTitle: String(targetTitle || "").replace(/\s+/g, " ").trim().slice(0, 120), // Local helper replication
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
  resetSessionSceneCounter(); // zero out the sessionSceneCounter
  setChatGptContextFresh(true);
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: "Forcing clean ChatGPT New Chat rotation: purging cached conversation anchors...",
  }).catch(() => null);

  // Purge memory references
  await invalidateChatGptConversationIdentity("rotation-forced");
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

module.exports = {
  forceCleanChatGptNewChatRotation,
  isChatGptRequestRotationEligible,
  initChatGptRecovery,
  isTransientCdpNavigationError,
  isCdpCrashError,
  isReloadBlocked,
  requestReloadWithReason,
  performDurableRecovery,
  detectLoginWithRetry,
  recoverCdpPageIfCrashed,
  recoverChatGptBlockingUi,
  recoverChatGptResponseChoiceChat,
};
