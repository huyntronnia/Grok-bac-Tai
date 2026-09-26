const { appendAppLog } = require("../logging");
const { sleep } = require("../utils");
const { assertAutomaticChatGptMutationAllowed } = require("../state/workflow_mode");
const {
  verifyDraftOwnership,
  hashChatGptSnapshotText,
  normalizeChatGptSnapshotText,
} = require("../state");
const {
  evaluateOnCdpPage: evaluateAutomaticPage,
  getConversationState,
} = require("./chatgpt_core");
const {
  getConversationStateWithExpectedAttachments,
} = require("./chatgpt_upload");
const {
  focusPromptInputScript,
  setPromptInputValueScript,
  deepFocusNv2ComposerScript,
  clearNv2ComposerScript,
  dispatchNv2ComposerInputEventsScript,
  forceSubmitChatGptComposerScript,
  inspectAndClickChatGptSendButton,
  inspectAndClickChatGptSendButtonSafely,
  readLatestAssistantScript,
  detectChatGptActiveGenerationScriptStrict,
  getComposerTextScript,
  inspectNv2ComposerSubmitStateScript,
  readChatGptImageStateScript,
} = require("./chatgpt_dom");

let setChatGptSendState = () => null;
let assertPipelineRunActive = () => null;

function initChatGptSend(runtime = {}) {
  if (typeof runtime.setChatGptSendState === "function") {
    setChatGptSendState = runtime.setChatGptSendState;
  }
  if (typeof runtime.assertPipelineRunActive === "function") {
    assertPipelineRunActive = runtime.assertPipelineRunActive;
  }
}

function composerPromptAlreadyExact(composerText = "", prompt = "") {
  const expected = normalizeChatGptSnapshotText(prompt);
  return Boolean(
    expected && normalizeChatGptSnapshotText(composerText) === expected,
  );
}

function isLikelyChatGptSendButtonText(text) {
  const raw = String(text || "")
    .trim()
    .toLowerCase();
  const t = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

  if (!t) return false;

  // Cấm click nhầm các nút tool/mode.
  if (
    t.includes("viet hoac") ||
    t.includes("hinh sua") ||
    t.includes("chinh sua") ||
    t.includes("tao anh") ||
    t.includes("tra cuu") ||
    t.includes("voice") ||
    t.includes("micro")
  ) {
    return false;
  }

  return (
    t.includes("send") ||
    t.includes("gui") ||
    t.includes("submit") ||
    t.includes("arrow-up") ||
    t.includes("send-button") ||
    t.includes("composer-submit")
  );
}

async function clickSendButtonViaCdp(page) {
  assertAutomaticChatGptMutationAllowed("click-send-button");
  return evaluateOnCdpPage(
    page,
    `(() => {
      const sendBtn = document.querySelector('[data-testid="send-button"], [data-testid*="submit"], main form button[type="submit"]');
      if (sendBtn && !sendBtn.disabled) {
        sendBtn.click();
        return { ok: true, clicked: true };
      }
      return { ok: false, error: "Send button not clickable or disabled" };
    })()`
  ).catch((error) => ({ ok: false, error: error.message }));
}

async function forceClickChatGptComposerSubmit(client) {
  assertAutomaticChatGptMutationAllowed("force-composer-submit");
  return evaluateOnCdpPage(
    client,
    `
    (() => {
      const composer =
        document.querySelector('#prompt-textarea') ||
        document.querySelector('textarea') ||
        document.querySelector('[contenteditable="true"]');

      const root = composer?.closest('form') || composer?.closest('[role="main"]') || document;

      const buttons = Array.from(root.querySelectorAll('button'));
      const candidates = buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        const text = String(button.innerText || button.textContent || '').trim();
        const aria = String(button.getAttribute('aria-label') || button.title || '').trim();
        const html = String(button.outerHTML || '').slice(0, 500);
        return { button, rect, text, aria, html };
      }).filter(({ rect, text, aria, html }) => {
        if (!rect || rect.width < 12 || rect.height < 12) return false;
        const t = (text + ' ' + aria + ' ' + html).toLowerCase();
        if (t.includes('viết hoặc') || t.includes('chỉnh sửa') || t.includes('hỉnh sửa') || t.includes('tạo ảnh') || t.includes('tra cứu')) return false;
        if (t.includes('send') || t.includes('gửi') || t.includes('submit') || t.includes('arrow-up') || t.includes('data-testid="send-button"') || t.includes('composer-submit')) return true;
        return false;
      });

      const picked = candidates[candidates.length - 1];
      if (!picked) {
        return { ok: false, error: 'no-real-submit-button', buttonCount: buttons.length };
      }

      picked.button.click();
      return {
        ok: true,
        selector: 'force-submit-button',
        text: picked.text,
        aria: picked.aria,
        box: { x: picked.rect.x, y: picked.rect.y, w: picked.rect.width, h: picked.rect.height }
      };
    })()
  `,
  );
}

const CHATGPT_SHORT_PROMPT_SETTLE_MS = 1500;

async function waitForHeavyChatGptPromptDomCooldown(prompt = "", context = {}) {
  const length = String(prompt || "").length;
  const settleMs = length > 5000 ? 4000 : CHATGPT_SHORT_PROMPT_SETTLE_MS;
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text:
      length > 5000
        ? `ChatGPT Cooldown: waiting 4s for heavy prompt to settle (${length} chars).`
        : `ChatGPT Cooldown: waiting ${settleMs}ms for control prompt to settle.`,
  });
  await sleep(settleMs);
  return { ok: true, skipped: false, length, settleMs };
}

async function waitForChatGptReadyForNewPrompt(
  client,
  prompt,
  context = {},
  timeoutMs = 120000,
) {
  const expectedPromptHash = hashChatGptSnapshotText(prompt);
  const startedAt = Date.now();
  let lastState = null;
  let lastGeneration = null;
  while (Date.now() - startedAt < timeoutMs) {
    assertPipelineRunActive();
    lastState = await getConversationState(client);
    if (
      expectedPromptHash &&
      lastState?.latestUserMessageHash === expectedPromptHash
    ) {
      return {
        ok: true,
        alreadySent: true,
        expectedPromptHash,
        state: lastState,
      };
    }
    lastGeneration = await evaluateOnCdpPage(
      client,
      `(${detectChatGptActiveGenerationScriptStrict.toString()})()`,
    ).catch((error) => ({ generating: true, error: error.message }));
    if (
      !lastState?.stopButtonVisible &&
      !lastState?.streaming &&
      !lastGeneration?.generating
    ) {
      return {
        ok: true,
        alreadySent: false,
        expectedPromptHash,
        state: lastState,
        generation: lastGeneration,
      };
    }
    await sleep(1000);
  }
  return {
    ok: false,
    error: "previous-chatgpt-response-still-streaming",
    context,
    state: lastState,
    generation: lastGeneration,
  };
}

async function runChatGptRobustSendLadder(
  client,
  prompt,
  { focused, beforeCount, strictAssistantStart, context },
) {
  assertAutomaticChatGptMutationAllowed("robust-send-ladder");
  const sceneId = context?.sceneId || "unknown";
  const readyForPrompt = await waitForChatGptReadyForNewPrompt(
    client,
    prompt,
    context,
  );
  if (!readyForPrompt?.ok) return readyForPrompt;
  if (readyForPrompt.alreadySent) {
    return {
      ok: true,
      status: "already-sent-by-user-message-ownership",
      send: "already-sent-by-user-message-ownership",
      acknowledged: readyForPrompt,
    };
  }
  setChatGptSendState(sceneId, "PREPARING");
  await appendAppLog(sceneId, {
    source: "main",
    kind: "running",
    text: `[MILESTONE] PROMPT_INSERT_BEGIN for scene ${sceneId}`,
  }).catch(() => null);

  // 1. Focus composer
  await evaluateOnCdpPage(
    client,
    `(${focusPromptInputScript.toString()})()\n`,
  ).catch(() => null);
  await sleep(200);

  // 2. Clear existing text/content
  await evaluateOnCdpPage(
    client,
    `(() => {
    const input = document.querySelector('#prompt-textarea') || document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
    if (input) {
      if ('value' in input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        input.textContent = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  })()`,
  ).catch(() => null);

  // 3. Enforce native text dispatches via the CDP Input domain.
  assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
  await client.Input.insertText({ text: prompt }).catch(() => null);
  await sleep(400);

  // 4. Specifically trigger keydown, input, and change events immediately after insertion
  await evaluateOnCdpPage(
    client,
    `(() => {
    const input = document.querySelector('#prompt-textarea') || document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
    if (input) {
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Process', code: 'KeyA' }));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  })()`,
  ).catch(() => null);
  await sleep(300);

  // 5. Fallback verification: if still empty, use setPromptInputValueScript and fire events
  let comp = await evaluateOnCdpPage(
    client,
    `(${getComposerTextScript.toString()})()`,
  ).catch(() => ({ text: "" }));
  if (!comp?.text || comp.text.length < Math.min(20, prompt.length)) {
    await evaluateOnCdpPage(
      client,
      `(${setPromptInputValueScript.toString()})(${JSON.stringify(prompt)})`,
    ).catch(() => null);
    await sleep(300);
    await evaluateOnCdpPage(
      client,
      `(() => {
      const input = document.querySelector('#prompt-textarea') || document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
      if (input) {
        input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Process', code: 'KeyA' }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`,
    ).catch(() => null);
    await sleep(300);
  }

  comp = await evaluateOnCdpPage(
    client,
    `(${getComposerTextScript.toString()})()`,
  ).catch(() => ({ text: "" }));
  const composerPromptHash = hashChatGptSnapshotText(comp?.text || "");
  const expectedPromptHash = hashChatGptSnapshotText(prompt);
  if (!expectedPromptHash || composerPromptHash !== expectedPromptHash) {
    return {
      ok: false,
      error: "chatgpt-composer-prompt-ownership-mismatch",
      expectedPromptHash,
      composerPromptHash,
      composerLength: String(comp?.text || "").trim().length,
    };
  }

  const shouldWaitForComposerReady = Boolean(
    context.expectedFilePaths.length > 0 || context.waitForSendButtonReady,
  );
  if (shouldWaitForComposerReady) {
    const payloadReady = await waitForComposerPayloadReady(
      client,
      prompt,
      context.expectedFilePaths,
      context,
    );
    if (!payloadReady?.ok) return payloadReady;
  }

  setChatGptSendState(sceneId, "READY");
  await appendAppLog(sceneId, {
    source: "main",
    kind: "running",
    text: `[MILESTONE] PROMPT_INSERT_FINISHED for scene ${sceneId}`,
  }).catch(() => null);

  // 6. The hydration path has already polled the enabled Send button. Other
  // prompt paths keep their existing DOM cooldown before the click.
  if (!context.clickImmediatelyWhenReady) {
    await appendAppLog(sceneId, {
      source: "main",
      kind: "running",
      text: `[MILESTONE] WAIT_SEND_READY_BEGIN for scene ${sceneId}`,
    }).catch(() => null);
    await waitForHeavyChatGptPromptDomCooldown(prompt, context);
  } else {
    await appendAppLog(sceneId, {
      source: "main",
      kind: "running",
      text: `ChatGPT hydration Send is enabled; clicking immediately.`,
      details: {
        stage: context.stage || "",
        timeoutMs: Number(context.sendReadyTimeoutMs || 0),
      },
    }).catch(() => null);
  }

  const monitor = require("./chatgpt_runtime_monitor");

  setChatGptSendState(sceneId, "CLICKING");
  await appendAppLog(sceneId, {
    source: "main",
    kind: "running",
    text: `[MILESTONE] SEND_CLICK_BEGIN for scene ${sceneId}`,
  }).catch(() => null);

  // 7. First click cycle:
  // Programmatically evaluate the state of the send button.
  const preClickSnap = monitor.captureSnapshot();
  const preClickState = preClickSnap.state;
  const preClickComposerLength = (preClickSnap.metrics?.dom?.composerText || "").length;

  const clickInspectScript = `(${inspectAndClickChatGptSendButtonSafely.toString()})()`;
  let clickedResult = await evaluateOnCdpPage(client, clickInspectScript).catch(
    (err) => ({ ok: false, error: err.message }),
  );

  const sendBtnStatus = clickedResult?.ok ? clickedResult.status : "error/not-found";
  const sendBtnEnabled = sendBtnStatus === "clicked" || sendBtnStatus === "already-sent-safely";

  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `runChatGptRobustSendLadder (First Click): Send button enabled? ${sendBtnEnabled} (status: ${sendBtnStatus}). Runtime state: ${preClickState}. Composer length: ${preClickComposerLength}`,
    details: clickedResult,
  });

  if (clickedResult?.ok) {
    if (
      clickedResult.status === "already-sent-safely" ||
      clickedResult.isStop
    ) {
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `runChatGptRobustSendLadder: previous Stop button detected before click; current prompt is not acknowledged.`,
      });
      return {
        ok: false,
        error: "previous-chatgpt-response-still-streaming",
        status: clickedResult.status,
      };
    }

    if (clickedResult.status === "clicked" && clickedResult.rect) {
      // Pair immediately with native absolute mouse click
      const x = clickedResult.rect.x + clickedResult.rect.width / 2;
      const y = clickedResult.rect.y + clickedResult.rect.height / 2;
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `runChatGptRobustSendLadder: Dispatching native click at (${x}, ${y})`,
      });
      assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
      await client.Input.dispatchMouseEvent({
        type: "mousePressed",
        x,
        y,
        button: "left",
        clickCount: 1,
      }).catch(() => null);
      assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
      await client.Input.dispatchMouseEvent({
        type: "mouseReleased",
        x,
        y,
        button: "left",
        clickCount: 1,
      }).catch(() => null);
    }
  }

  // Mandatory 1.5-second pacing delay
  await sleep(1500);

  // Post-click check
  const postClickSnap = monitor.captureSnapshot();
  const postClickState = postClickSnap.state;
  let afterClick = await evaluateOnCdpPage(
    client,
    `(${getComposerTextScript.toString()})()`
  ).catch(() => ({ text: "" }));
  let composerTextLength = String(afterClick?.text || "").trim().length;

  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `runChatGptRobustSendLadder (First Click Post-check): Runtime state: ${postClickState}. Composer length: ${composerTextLength}`,
  });

  if (composerTextLength === 0 || clickedResult?.isStopActiveNow) {
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: `runChatGptRobustSendLadder: Composer is empty or Stop button appeared. Prompt sent successfully.`,
    });
    const ack = await waitForPromptSendAcknowledged(
      client,
      prompt,
      beforeCount || 0,
      10000,
    );
    return {
      ok: ack.ok,
      send: clickedResult?.selector || "submit-button",
      acknowledged: ack,
    };
  }

  // Fallback / retry click (only if composer still has text)
  if (composerTextLength > 0 && !clickedResult?.isStopActiveNow) {
    const preRetrySnap = monitor.captureSnapshot();
    const preRetryState = preRetrySnap.state;
    const preRetryComposerLength = (preRetrySnap.metrics?.dom?.composerText || "").length;

    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `runChatGptRobustSendLadder: composer still has text (${composerTextLength} chars); retrying single click.`,
    });

    // Evaluate the state again before clicking
    clickedResult = await evaluateOnCdpPage(client, clickInspectScript).catch(
      (err) => ({ ok: false, error: err.message }),
    );

    const retryBtnStatus = clickedResult?.ok ? clickedResult.status : "error/not-found";
    const retryBtnEnabled = retryBtnStatus === "clicked" || retryBtnStatus === "already-sent-safely";

    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `runChatGptRobustSendLadder (Retry Click): Send button enabled? ${retryBtnEnabled} (status: ${retryBtnStatus}). Runtime state: ${preRetryState}. Composer length: ${preRetryComposerLength}`,
      details: clickedResult,
    });

    if (clickedResult?.ok) {
      if (
        clickedResult.status === "already-sent-safely" ||
        clickedResult.isStop
      ) {
        await appendAppLog(null, {
          source: "main",
          kind: "running",
          text: `runChatGptRobustSendLadder: retry detected Stop button (already sent safely); skipping click.`,
        });
        return {
          ok: false,
          error: "previous-chatgpt-response-still-streaming",
          status: clickedResult.status,
        };
      }

      if (clickedResult.status === "clicked" && clickedResult.rect) {
        // Pair immediately with native absolute mouse click
        const x = clickedResult.rect.x + clickedResult.rect.width / 2;
        const y = clickedResult.rect.y + clickedResult.rect.height / 2;
        await appendAppLog(null, {
          source: "main",
          kind: "running",
          text: `runChatGptRobustSendLadder: Dispatching retry native click at (${x}, ${y})`,
        });
        assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
        await client.Input.dispatchMouseEvent({
          type: "mousePressed",
          x,
          y,
          button: "left",
          clickCount: 1,
        }).catch(() => null);
        assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
        await client.Input.dispatchMouseEvent({
          type: "mouseReleased",
          x,
          y,
          button: "left",
          clickCount: 1,
        }).catch(() => null);
      }
    }

    // Mandatory 1.5-second pacing delay
    await sleep(1500);

    // Final check
    const postRetrySnap = monitor.captureSnapshot();
    const postRetryState = postRetrySnap.state;
    afterClick = await evaluateOnCdpPage(
      client,
      `(${getComposerTextScript.toString()})()`
    ).catch(() => ({ text: "" }));
    composerTextLength = String(afterClick?.text || "").trim().length;

    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `runChatGptRobustSendLadder (Retry Click Post-check): Runtime state: ${postRetryState}. Composer length: ${composerTextLength}`,
    });

    if (composerTextLength === 0) {
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: `runChatGptRobustSendLadder: composer is empty after retry click, prompt sent successfully.`,
      });
      const ack = await waitForPromptSendAcknowledged(
        client,
        prompt,
        beforeCount || 0,
        10000,
      );
      return {
        ok: ack.ok,
        send: clickedResult?.selector || "submit-button",
        acknowledged: ack,
      };
    }
  }

  const ack = await waitForPromptSendAcknowledged(
    client,
    prompt,
    beforeCount || 0,
    10000,
  );
  return {
    ok: ack?.ok || false,
    send: clickedResult?.selector || "submit-button",
    acknowledged: ack,
  };
}

async function forceSubmitChatGptComposerWithCdp(
  client,
  prompt,
  beforeCount = 0,
  context = {},
) {
  assertAutomaticChatGptMutationAllowed("force-submit-composer");
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const state = await evaluateOnCdpPage(
      client,
      `(${getComposerTextScript.toString()})()`,
    ).catch(() => ({ text: "" }));
    const remainingChars = String(state?.text || "").trim().length;
    if (remainingChars < 5) {
      const ownership = await getConversationState(client);
      if (
        ownership?.latestUserMessageHash === hashChatGptSnapshotText(prompt)
      ) {
        return {
          ok: true,
          mode: "already-sent-by-user-message-ownership",
          attempt,
        };
      }
      await evaluateOnCdpPage(
        client,
        `(${focusPromptInputScript.toString()})()`,
      ).catch(() => null);
      await evaluateOnCdpPage(
        client,
        `(${setPromptInputValueScript.toString()})(${JSON.stringify(prompt)})`,
      ).catch(() => null);
      await sleep(500);
      continue;
    }
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `forceSubmitChatGptComposer: composer still has ${remainingChars} chars; hard-submit attempt ${attempt}/3.`,
      details: { stage: context?.stage || "", remainingChars },
    }).catch(() => null);

    const forced = await evaluateOnCdpPage(
      client,
      `(${forceSubmitChatGptComposerScript.toString()})()`,
    ).catch((error) => ({ ok: false, error: error.message }));
    await sleep(700);
    if (!forced?.ok) {
      assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
      await client.Input.dispatchKeyEvent({
        type: "keyDown",
        key: "Enter",
        code: "Enter",
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
      }).catch(() => null);
      assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
      await client.Input.dispatchKeyEvent({
        type: "keyUp",
        key: "Enter",
        code: "Enter",
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
      }).catch(() => null);
      await sleep(700);
    }

    const ack = await waitForPromptSendAcknowledged(
      client,
      prompt,
      beforeCount || 0,
      8000,
    );
    if (ack?.ok)
      return {
        ok: true,
        mode: forced?.mode || "cdp-enter",
        attempt,
        forced,
        acknowledged: ack,
      };

    await evaluateOnCdpPage(
      client,
      `(${focusPromptInputScript.toString()})()`,
    ).catch(() => null);
    await evaluateOnCdpPage(
      client,
      `(${setPromptInputValueScript.toString()})(${JSON.stringify(prompt)})`,
    ).catch(() => null);
    await sleep(500);
  }
  const finalState = await evaluateOnCdpPage(
    client,
    `(${getComposerTextScript.toString()})()`,
  ).catch(() => ({ text: "" }));
  return {
    ok: false,
    error: "force-submit-failed",
    remainingChars: String(finalState?.text || "").trim().length,
  };
}

async function sendPromptViaCdpInput(client, prompt, options = {}) {
  assertAutomaticChatGptMutationAllowed("send-prompt-via-cdp");
  await client.Page?.bringToFront?.().catch(() => null);
  await sleep(500);

  await vidoraClearChatGptInputBeforePaste(
    typeof client !== "undefined"
      ? client
      : typeof page !== "undefined"
        ? page
        : null,
    {
      stage: "before-focus-prompt",
      sceneId:
        (typeof context !== "undefined" && context?.sceneId) ||
        (typeof options !== "undefined" && options?.sceneId) ||
        "",
    },
  ).catch(() => null);

  let focused = await evaluateOnCdpPage(
    client,
    `(${focusPromptInputScript.toString()})()`,
  ).catch((error) => ({ ok: false, error: error.message }));
  if (!focused?.ok) {
    return {
      ok: false,
      error: focused?.error || "Không focus được ô nhập prompt.",
    };
  }

  const ladderResult = await runChatGptRobustSendLadder(client, prompt, {
    focused,
    beforeCount: options.beforeCount || 0,
    strictAssistantStart: false,
    context: {
      stage: options.stage || "send-prompt",
      sceneId: options.sceneId || "",
      expectedFilePaths: options.expectedFilePaths || [],
      payloadFingerprint: options.payloadFingerprint || "",
      waitForSendButtonReady: Boolean(options.waitForSendButtonReady),
      sendReadyTimeoutMs: Number(options.sendReadyTimeoutMs || 0),
      sendReadyRetryTimeoutMs: Number(options.sendReadyRetryTimeoutMs || 0),
      sendReadyStableTicks: Number(options.sendReadyStableTicks || 0),
      clickImmediatelyWhenReady: Boolean(options.clickImmediatelyWhenReady),
    },
  });

  let finalResult = ladderResult;
  if (!ladderResult?.ok && !(options.expectedFilePaths || []).length) {
    const forced = await forceSubmitChatGptComposerWithCdp(
      client,
      prompt,
      options.beforeCount || 0,
      { stage: options.stage || "send-prompt", sceneId: options.sceneId || "" },
    );
    finalResult = forced?.ok
      ? {
          ok: true,
          send: forced.mode || "force-submit",
          acknowledged: forced.acknowledged || forced,
        }
      : { ...ladderResult, forceSubmit: forced };
  }

  // Force CDP viewport redraw to break background hibernation
  await evaluateOnCdpPage(
    client,
    `(() => {
    window.scrollTo(0, 1);
    window.scrollTo(0, 0);
    const body = document.body;
    if (body) {
      const originalDisplay = body.style.display;
      body.style.display = 'none';
      body.offsetHeight; // Triggers reflow
      body.style.display = originalDisplay;
    }
  })()`,
  ).catch(() => null);

  if (!finalResult?.ok) {
    await appendAppLog(null, {
      source: "main",
      kind: "error",
      text: "sendPromptViaCdpInput: Send failed. Skipping Post-Send Padding.",
      details: finalResult,
    }).catch(() => null);
    return finalResult;
  }

  // Post-Send Padding: inject 8000ms delay to let ChatGPT clear internal parsing and layout
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: "Post-Send Padding: sleeping 8000ms after prompt submission...",
  }).catch(() => null);
  await sleep(8000);

  const sceneId = options.sceneId || "";
  if (finalResult?.ok && sceneId) {
    setChatGptSendState(sceneId, "SENT");
    await appendAppLog(sceneId, {
      source: "main",
      kind: "ok",
      text: `[MILESTONE] SEND_CLICK_FINISHED for scene ${sceneId}`,
    }).catch(() => null);
  }

  return finalResult;
}

async function waitForChatGptComposerIdle(
  client,
  context = {},
  timeoutMs = 120000,
) {
  const startedAt = Date.now();
  let lastState = null;
  let lastLogAt = 0;
  while (Date.now() - startedAt < timeoutMs) {
    lastState = await evaluateOnCdpPage(
      client,
      `(${readLatestAssistantScript.toString()})()`,
    ).catch((error) => ({ generating: false, error: error.message }));
    if (!lastState?.generating) return lastState;
    if (Date.now() - lastLogAt > 15000) {
      lastLogAt = Date.now();
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `motionPromptSend: waiting for ChatGPT composer idle for scene ${context.sceneId || ""}`,
        details: {
          stage: context.stage || "",
          attemptId: context.attemptId || "",
          mode: lastState?.mode || "",
          count: lastState?.count || 0,
        },
      });
    }
    await sleep(1500);
  }
  throw new Error(
    `ChatGPT composer is still busy; cannot send ${context.stage || "prompt"} for scene ${context.sceneId || ""}.`,
  );
}

async function waitForPromptSendAcknowledged(
  client,
  prompt,
  beforeCount = 0,
  timeoutMs = 15000,
) {
  const startedAt = Date.now();
  const monitor = require("./chatgpt_runtime_monitor");
  const expectedPromptHash = hashChatGptSnapshotText(prompt);
  
  if (!monitor.page) {
    await monitor.startMonitoring(client).catch(() => null);
  }

  let lastSnap = null;
  while (Date.now() - startedAt < timeoutMs) {
    await sleep(700);
    lastSnap = monitor.captureSnapshot();
    const dom = lastSnap.metrics.dom;
    const state = await getConversationState(client);
    const promptOwned =
      Boolean(expectedPromptHash) &&
      state?.latestUserMessageHash === expectedPromptHash;
    const composerCleared = (dom.composerText || "").trim().length < 5;
    const assistantAdvanced = dom.assistantMessageCount > (beforeCount || 0);

    if (promptOwned) {
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: `Prompt send verified by user-message ownership (Composer empty: ${composerCleared}, Advanced: ${assistantAdvanced}, State: ${lastSnap.state})`,
      }).catch(() => null);

      return {
        ok: true,
        promptOwned,
        expectedPromptHash,
        composerCleared,
        assistantAdvanced,
        generating: Boolean(state?.streaming || state?.stopButtonVisible),
      };
    }
  }
  
  return {
    ok: false,
    error: "Prompt send was not acknowledged by ChatGPT.",
    expectedPromptHash,
    latestUserMessageHash:
      lastSnap?.metrics?.dom?.latestUserMessageHash || "",
    lastComposer: {
      textLength: (lastSnap?.metrics?.dom?.composerText || "").length,
    },
    state: lastSnap?.state || "UNKNOWN",
  };
}

async function sendPromptViaCdpInputSingle(client, prompt, context = {}) {
  assertAutomaticChatGptMutationAllowed("send-prompt-via-cdp-single");
  await client.Page.bringToFront().catch(() => null);
  await sleep(500);

  const busyState = await evaluateOnCdpPage(
    client,
    `(${readLatestAssistantScript.toString()})()`,
  ).catch(() => ({ generating: false, count: context.beforeCount || 0 }));
  if (busyState?.generating) {
    return {
      ok: false,
      error: "ChatGPT is busy/streaming; duplicate motion prompt send blocked.",
      state: { count: busyState?.count || 0, mode: busyState?.mode || "" },
    };
  }

  let focused = await evaluateOnCdpPage(
    client,
    `(${focusPromptInputScript.toString()})()`,
  ).catch((error) => ({ ok: false, error: error.message }));
  if (!focused?.ok) {
    return {
      ok: false,
      error: focused?.error || "Không focus được ô nhập prompt.",
    };
  }

  const ladderResult = await runChatGptRobustSendLadder(client, prompt, {
    focused,
    beforeCount: context.beforeCount || 0,
    strictAssistantStart: true,
    context,
  });

  // Force CDP viewport redraw to break background hibernation
  await evaluateOnCdpPage(
    client,
    `(() => {
    window.scrollTo(0, 1);
    window.scrollTo(0, 0);
    const body = document.body;
    if (body) {
      const originalDisplay = body.style.display;
      body.style.display = 'none';
      body.offsetHeight; // Triggers reflow
      body.style.display = originalDisplay;
    }
  })()`,
  ).catch(() => null);

  // Post-Send Padding: inject 8000ms delay to let ChatGPT clear internal parsing and layout
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: "Post-Send Padding: sleeping 8000ms after prompt submission...",
  }).catch(() => null);
  await sleep(8000);

  return {
    ok: ladderResult.ok,
    mode: ladderResult.send,
    selector: focused.selector,
    send: ladderResult.send,
    acknowledged: ladderResult.acknowledged,
    recoveryAttempts: 0,
  };
}

async function focusNv2ComposerWithCdp(client, prompt, context = {}) {
  assertAutomaticChatGptMutationAllowed("nv2-composer-input");
  await client.Page.bringToFront().catch(() => null);
  await sleep(300);
  const focused = await evaluateOnCdpPage(
    client,
    `(${deepFocusNv2ComposerScript.toString()})()`,
  ).catch((error) => ({ ok: false, error: error.message }));
  if (!focused?.ok) return focused;
  const centerX = focused.box ? focused.box.x + focused.box.width / 2 : 0;
  const centerY = focused.box ? focused.box.y + focused.box.height / 2 : 0;
  if (centerX && centerY) {
    assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
    await client.Input.dispatchMouseEvent({
      type: "mouseMoved",
      x: centerX,
      y: centerY,
      button: "none",
    }).catch(() => null);
    assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
    await client.Input.dispatchMouseEvent({
      type: "mousePressed",
      x: centerX,
      y: centerY,
      button: "left",
      clickCount: 1,
    }).catch(() => null);
    assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
    await client.Input.dispatchMouseEvent({
      type: "mouseReleased",
      x: centerX,
      y: centerY,
      button: "left",
      clickCount: 1,
    }).catch(() => null);
  }
  const documentRoot = await client.DOM.getDocument({
    depth: -1,
    pierce: true,
  }).catch(() => null);
  if (documentRoot?.root?.nodeId) {
    let query = await client.DOM.querySelector({
      nodeId: documentRoot.root.nodeId,
      selector: "main form textarea",
    }).catch(() => null);
    if (!query?.nodeId)
      query = await client.DOM.querySelector({
        nodeId: documentRoot.root.nodeId,
        selector: '[contenteditable="true"]',
      }).catch(() => null);
    if (query?.nodeId)
      await client.DOM.focus({ nodeId: query.nodeId }).catch(() => null);
  }
  await evaluateOnCdpPage(
    client,
    `(${deepFocusNv2ComposerScript.toString()})()`,
  ).catch(() => null);
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: "NV2 composer deeply focused",
    details: { sceneId: context.sceneId || "", selector: focused.selector },
  }).catch(() => null);
  return focused;
}

async function waitForNv2GenerationStartGuard(
  client,
  prompt,
  beforeCount = 0,
  context = {},
) {
  const startedAt = Date.now();
  let lastState = null;
  while (Date.now() - startedAt < 15000) {
    assertPipelineRunActive();
    await sleep(3000);
    lastState = await evaluateOnCdpPage(
      client,
      `(${inspectNv2ComposerSubmitStateScript.toString()})(${JSON.stringify(prompt)}, ${Number(beforeCount || 0)})`,
    ).catch((error) => ({ ok: false, error: error.message }));
    if (lastState?.generationAcknowledged) {
      return { ok: true, state: lastState, waitedMs: Date.now() - startedAt };
    }
  }
  return {
    ok: false,
    error: "nv2-generation-not-started-after-passive-guard",
    state: lastState,
    waitedMs: Date.now() - startedAt,
  };
}

async function sendNv2PromptViaDeepCdpInput(client, prompt, context = {}) {
  assertAutomaticChatGptMutationAllowed("send-nv2-prompt");
  const beforeCount = Number(context.beforeCount || 0) || 0;
  const sceneId = context.sceneId || "unknown";
  const failNv2Send = async (error, details = {}) => {
    setChatGptSendState(sceneId, "FAILED");
    await appendAppLog(sceneId, {
      source: "main",
      kind: "warning",
      text: `[MILESTONE] SEND_ABORTED for scene ${sceneId}: ${error}`,
      details,
    }).catch(() => null);
    return { ok: false, error, ...details };
  };

  setChatGptSendState(sceneId, "PREPARING");
  await appendAppLog(sceneId, {
    source: "main",
    kind: "running",
    text: `[MILESTONE] PROMPT_INSERT_BEGIN for scene ${sceneId}`,
    details: { stage: context.stage || "motion_prompt" },
  }).catch(() => null);
  await client.Page.bringToFront().catch(() => null);
  await sleep(300);
  const busyState = await evaluateOnCdpPage(
    client,
    `(${inspectNv2ComposerSubmitStateScript.toString()})('', ${beforeCount})`,
  ).catch(() => ({ generationAcknowledged: false }));
  if (busyState?.generationAcknowledged && !busyState?.sendReady) {
    return failNv2Send(
      "ChatGPT is busy/streaming; duplicate motion prompt send blocked.",
      { state: busyState },
    );
  }

  const focused = await focusNv2ComposerWithCdp(client, prompt, context);
  if (!focused?.ok) {
    return failNv2Send(
      focused?.error || "Không focus được ô nhập NV2.",
      { focused },
    );
  }

  const existingDraftState = await evaluateOnCdpPage(
    client,
    `(${inspectNv2ComposerSubmitStateScript.toString()})(${JSON.stringify(prompt)}, ${beforeCount})`,
  ).catch(() => null);
  const reuseExactDraft = Boolean(
    existingDraftState?.activeComposer &&
      composerPromptAlreadyExact(existingDraftState?.composerText, prompt),
  );
  let loaded = reuseExactDraft ? existingDraftState : null;
  if (reuseExactDraft) {
    await appendAppLog(sceneId, {
      source: "main",
      kind: "ok",
      text: `Scene ${sceneId}: exact NV2 composer draft preserved; skipped clear/reinsert.`,
      details: { stage: context.stage || "motion_prompt" },
    }).catch(() => null);
  } else {
    await evaluateOnCdpPage(
      client,
      `(${clearNv2ComposerScript.toString()})()`,
    ).catch(() => null);
    await sleep(150);
    await focusNv2ComposerWithCdp(client, prompt, context);
    assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
    const insertResult = await client.Input.insertText({ text: prompt })
      .then(() => ({ ok: true }))
      .catch((error) => ({ ok: false, error: error.message }));
    if (!insertResult.ok) {
      return failNv2Send("nv2-control-prompt-insert-failed", {
        insertError: insertResult.error || "unknown",
      });
    }
    await evaluateOnCdpPage(
      client,
      `(${dispatchNv2ComposerInputEventsScript.toString()})(${JSON.stringify(prompt)})`,
    ).catch(() => null);
  }
  const started = Date.now();
  while (Date.now() - started < 8000) {
    loaded = await evaluateOnCdpPage(
      client,
      `(${inspectNv2ComposerSubmitStateScript.toString()})(${JSON.stringify(prompt)}, ${beforeCount})`,
    ).catch((e) => ({ ok: false, error: e.message }));

    if (
      loaded?.activeComposer &&
      loaded?.fullPromptLoaded &&
      loaded?.sendReady
    ) {
      break;
    }
    await sleep(200);
  }

  if (
    !loaded?.activeComposer ||
    !loaded?.fullPromptLoaded ||
    !loaded?.sendReady
  ) {
    await appendAppLog(null, {
      source: "main",
      kind: "warning",
      text: "NV2 composer not ready",
      details: loaded,
    }).catch(() => null);

    return failNv2Send("nv2-composer-not-ready-for-submit", {
      state: loaded,
    });
  }

  if (Array.isArray(context.expectedFilePaths) && context.expectedFilePaths.length > 0) {
    const payloadReady = await waitForComposerPayloadReady(
      client,
      prompt,
      context.expectedFilePaths,
      context,
    );
    if (!payloadReady?.ok) return payloadReady;
  }

  await sleep(CHATGPT_SHORT_PROMPT_SETTLE_MS);

  setChatGptSendState(sceneId, "READY");
  await appendAppLog(sceneId, {
    source: "main",
    kind: "ok",
    text: `[MILESTONE] PROMPT_INSERT_FINISHED for scene ${sceneId}`,
  }).catch(() => null);

  await focusNv2ComposerWithCdp(client, prompt, context);
  setChatGptSendState(sceneId, "CLICKING");
  await appendAppLog(sceneId, {
    source: "main",
    kind: "running",
    text: `[MILESTONE] SEND_CLICK_BEGIN for scene ${sceneId}`,
  }).catch(() => null);
  assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
  await client.Input.dispatchKeyEvent({
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  });
  assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
  await client.Input.dispatchKeyEvent({
    type: "char",
    key: "Enter",
    text: "\r",
    unmodifiedText: "\r",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  }).catch(() => null);
  assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
  await client.Input.dispatchKeyEvent({
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  });
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: "NV2 Enter submission dispatched",
    details: { sceneId: context.sceneId || "" },
  }).catch(() => null);
  await sleep(300);

  let state = await evaluateOnCdpPage(
    client,
    `(${inspectNv2ComposerSubmitStateScript.toString()})(${JSON.stringify(prompt)}, ${beforeCount})`,
  ).catch((error) => ({ ok: false, error: error.message }));
  if (
    !state?.generationAcknowledged &&
    state?.sendReady &&
    state?.fullPromptLoaded &&
    state?.sendButton
  ) {
    if (Array.isArray(context.expectedFilePaths) && context.expectedFilePaths.length > 0) {
      const payloadReady = await waitForComposerPayloadReady(
        client,
        prompt,
        context.expectedFilePaths,
        context,
      );
      if (!payloadReady?.ok) return payloadReady;
    }
    const x = state.sendButton.x + state.sendButton.width / 2;
    const y = state.sendButton.y + state.sendButton.height / 2;
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: "Guarded physical Send click",
      details: { sceneId: context.sceneId || "", x, y },
    }).catch(() => null);
    assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
    await client.Input.dispatchMouseEvent({
      type: "mouseMoved",
      x,
      y,
      button: "none",
    }).catch(() => null);
    assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
    await client.Input.dispatchMouseEvent({
      type: "mousePressed",
      x,
      y,
      button: "left",
      clickCount: 1,
    }).catch(() => null);
    await sleep(90);
    assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
    await client.Input.dispatchMouseEvent({
      type: "mouseReleased",
      x,
      y,
      button: "left",
      clickCount: 1,
    }).catch(() => null);
    await sleep(300);
    state = await evaluateOnCdpPage(
      client,
      `(${inspectNv2ComposerSubmitStateScript.toString()})(${JSON.stringify(prompt)}, ${beforeCount})`,
    ).catch((error) => ({ ok: false, error: error.message }));
  }

  if (!state?.generationAcknowledged) {
    const guarded = await waitForNv2GenerationStartGuard(
      client,
      prompt,
      beforeCount,
      context,
    );
    if (!guarded?.ok) {
      return failNv2Send(guarded?.error || "nv2-generation-not-started", {
        state: guarded?.state || null,
        waitedMs: guarded?.waitedMs || 0,
      });
    }
    state = guarded.state;
  }

  if (context.sceneId) {
    setChatGptSendState(context.sceneId, "SENT");
  }
  await appendAppLog(sceneId, {
    source: "main",
    kind: "ok",
    text: `[MILESTONE] SEND_CLICK_FINISHED for scene ${sceneId}`,
  }).catch(() => null);
  return {
    ok: true,
    mode: state?.mode || "generation-acknowledged",
    selector: focused.selector,
    send: "enter-first-guarded-send-fallback",
    acknowledged: { ok: true, state },
    recoveryAttempts: 0,
  };
}

function verifyComposerPayloadReady(prompt = "", expectedFilePaths = [], pageState = {}) {
  const expectedPromptHash = hashChatGptSnapshotText(prompt);
  const expectedPromptText = normalizeChatGptSnapshotText(prompt);
  const composerPromptText = normalizeChatGptSnapshotText(
    pageState?.composerText || "",
  );
  const promptMatchesText = Boolean(
    expectedPromptText && composerPromptText === expectedPromptText,
  );
  const promptMatchesHash = Boolean(
    expectedPromptHash && pageState?.composerPromptHash === expectedPromptHash,
  );
  if (!expectedPromptHash || (!promptMatchesText && !promptMatchesHash)) {
    return {
      ok: false,
      error: "chatgpt-payload-prompt-mismatch",
      expectedPromptHash,
      composerPromptHash: pageState?.composerPromptHash || "",
      expectedPromptLength: expectedPromptText.length,
      composerPromptLength: composerPromptText.length,
    };
  }
  if (!pageState?.composerReady || pageState?.composerState !== "READY_TO_SEND") {
    return {
      ok: false,
      error: "chatgpt-payload-send-not-ready",
      composerReady: Boolean(pageState?.composerReady),
      composerState: pageState?.composerState || "",
    };
  }
  return {
    ok: true,
    expectedPromptHash,
    promptEvidence: promptMatchesText
      ? "normalized-current-composer-text"
      : "normalized-current-composer-hash",
    state: pageState,
  };
}

async function waitForComposerPayloadReady(
  client,
  prompt,
  expectedFilePaths = [],
  context = {},
) {
  const initialTimeoutMs = Math.max(
    1000,
    Number(context.sendReadyTimeoutMs || 12000),
  );
  const additionalTimeoutMs = Math.max(
    0,
    Number(context.sendReadyRetryTimeoutMs || 0),
  );
  const totalTimeoutMs = initialTimeoutMs + additionalTimeoutMs;
  const requiredStableTicks = Math.max(
    1,
    Number(context.sendReadyStableTicks || 2),
  );
  const startedAt = Date.now();
  let stableTicks = 0;
  let lastResult = null;
  let additionalWindowLogged = false;
  while (Date.now() - startedAt < totalTimeoutMs) {
    const elapsedMs = Date.now() - startedAt;
    if (
      additionalTimeoutMs > 0 &&
      !additionalWindowLogged &&
      elapsedMs >= initialTimeoutMs
    ) {
      additionalWindowLogged = true;
      await appendAppLog(context.sceneId || null, {
        source: "main",
        kind: "running",
        text: `ChatGPT Send is not ready after the first wait window; waiting one more window.`,
        details: {
          stage: context.stage || "",
          initialTimeoutMs,
          additionalTimeoutMs,
          totalTimeoutMs,
        },
      }).catch(() => null);
    }
    const pageState = await getConversationStateWithExpectedAttachments(
      client,
      expectedFilePaths,
    );
    // Use the same live composer that was focused and populated immediately
    // before this gate. The generic conversation snapshot can still select a
    // stale React textarea after ChatGPT rerenders attachment cards.
    const liveComposerState = await evaluateOnCdpPage(
      client,
      `(${inspectNv2ComposerSubmitStateScript.toString()})(${JSON.stringify(prompt)}, ${Number(context.beforeCount || 0)})`,
    ).catch((error) => ({ ok: false, error: error.message }));
    if (liveComposerState?.ok) {
      const composerText = String(liveComposerState.composerText || "");
      pageState.composerText = composerText;
      pageState.composerPromptHash = hashChatGptSnapshotText(composerText);
      pageState.composerHasPrompt =
        normalizeChatGptSnapshotText(composerText).length > 0;
      pageState.sendButtonVisible = Boolean(liveComposerState.sendReady);
      pageState.composerReady = Boolean(
        liveComposerState.activeComposer && liveComposerState.sendReady,
      );
      if (pageState.attachmentUploadInProgress) {
        pageState.composerState = "ATTACHING_FILES";
      } else if (pageState.attachmentCount > 0 && pageState.composerHasPrompt) {
        pageState.composerState = liveComposerState.sendReady
          ? "READY_TO_SEND"
          : "PROMPT_READY";
      }
      pageState.liveComposerEvidence = {
        selector: liveComposerState.selector || "",
        activeComposer: Boolean(liveComposerState.activeComposer),
        textLength: Number(liveComposerState.textLength || 0),
        promptLength: Number(liveComposerState.promptLength || 0),
        fullPromptLoaded: Boolean(liveComposerState.fullPromptLoaded),
        sendReady: Boolean(liveComposerState.sendReady),
      };
    }
    lastResult = verifyComposerPayloadReady(prompt, expectedFilePaths, pageState);
    if (lastResult.ok) {
      stableTicks += 1;
      if (stableTicks >= requiredStableTicks) {
        setChatGptSendState(context.sceneId || "unknown", "READY");
        return {
          ...lastResult,
          stableTicks,
          requiredStableTicks,
          payloadFingerprint: context.payloadFingerprint || "",
        };
      }
    } else {
      stableTicks = 0;
    }
    await sleep(300);
  }
  setChatGptSendState(context.sceneId || "unknown", "FAILED");
  await appendAppLog(context.sceneId || null, {
    source: "main",
    kind: "warning",
    text: `ChatGPT payload gate timed out before Send for scene ${context.sceneId || "unknown"}.`,
    details: {
      error: lastResult?.error || "chatgpt-payload-gate-timeout",
      expectedPromptHash: lastResult?.expectedPromptHash || "",
      composerPromptHash: lastResult?.composerPromptHash || "",
      expectedPromptLength: Number(lastResult?.expectedPromptLength || 0),
      composerPromptLength: Number(lastResult?.composerPromptLength || 0),
      attachmentError: lastResult?.attachmentError || "",
      composerReady: Boolean(lastResult?.composerReady),
      composerState: lastResult?.composerState || "",
      initialTimeoutMs,
      additionalTimeoutMs,
      totalTimeoutMs,
    },
  }).catch(() => null);
  return {
    ok: false,
    error: lastResult?.error || "chatgpt-payload-gate-timeout",
    gate: lastResult,
    payloadFingerprint: context.payloadFingerprint || "",
  };
}

async function vidoraReadChatGptComposerStateReal(client, context = {}) {
  if (!client)
    return { ok: false, error: "chatgpt-input-gate-no-cdp-target", context };
  return await evaluateOnCdpPage(
    client,
    `(() => {
    const norm = (v) => String(v || '').trim();

    const composer =
      document.querySelector('#prompt-textarea') ||
      document.querySelector('textarea') ||
      document.querySelector('[contenteditable="true"]');

    const composerText = norm(
      composer?.value ||
      composer?.innerText ||
      composer?.textContent ||
      ''
    );

    const buttons = [...document.querySelectorAll('button')].map((button) => {
      const r = button.getBoundingClientRect();
      const label = [
        button.getAttribute('aria-label'),
        button.getAttribute('data-testid'),
        button.id,
        button.innerText,
        button.textContent
      ].map(norm).filter(Boolean).join(' | ');

      return {
        label,
        id: button.id || '',
        testid: button.getAttribute('data-testid') || '',
        aria: button.getAttribute('aria-label') || '',
        disabled: Boolean(button.disabled || button.getAttribute('aria-disabled') === 'true'),
        visible: r.width > 8 && r.height > 8,
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      };
    });

    const stopButton = buttons.find((b) => {
      const t = b.label.toLowerCase();
      return b.visible && (t.includes('stop') || t.includes('dừng'));
    });

    const sendCandidates = buttons.filter((b) => {
      const t = b.label.toLowerCase();

      if (!b.visible || b.disabled) return false;

      // CẤM click nhầm mấy nút mode/tool.
      if (
        t.includes('viết hoặc') ||
        t.includes('hỉnh sửa') ||
        t.includes('chỉnh sửa') ||
        t.includes('tạo ảnh') ||
        t.includes('tra cứu') ||
        t.includes('voice') ||
        t.includes('micro')
      ) return false;

      return (
        b.id === 'composer-submit-button' ||
        b.testid === 'send-button' ||
        t.includes('send-button') ||
        t.includes('composer-submit') ||
        t.includes('gửi lời nhắc') ||
        t === 'send' ||
        t === 'gửi'
      );
    });

    const sendButton = sendCandidates
      .sort((a, b) => (b.rect.y - a.rect.y) || (b.rect.x - a.rect.x))[0] || null;

    const assistantRoots = [
      ...document.querySelectorAll('[data-message-author-role="assistant"]'),
      ...document.querySelectorAll('article')
    ].filter((el) => {
      const r = el.getBoundingClientRect();
      const txt = norm(el.innerText || el.textContent);
      return r.width > 50 && r.height > 20 && txt.length > 0;
    });

    return {
      ok: true,
      url: location.href,
      path: location.pathname,
      title: document.title,
      composerFound: Boolean(composer),
      composerTextLength: composerText.length,
      composerTextHead: composerText.slice(0, 900),
      composerHasText: composerText.length > 5,
      composerHasPrompt: /SCENE\s*0?\d+|NHIỆM VỤ|TẠO ẢNH|Create exactly one image|Dựa trên ảnh keyframe|MOTION PROMPT|NỘI DUNG CHUYỂN ĐỘNG/i.test(composerText),
      stopVisible: Boolean(stopButton),
      sendReady: Boolean(sendButton),
      sendButton,
      sendCandidates: sendCandidates.slice(-10),
      assistantRootCount: assistantRoots.length,
      latestAssistantText: assistantRoots.length ? norm(assistantRoots[assistantRoots.length - 1].innerText || assistantRoots[assistantRoots.length - 1].textContent).slice(0, 900) : '',
      buttonTail: buttons.slice(-18),
    };
  })()`,
  ).catch((error) => ({
    ok: false,
    error: error.message,
    context,
  }));
}

async function vidoraClickChatGptRealSendButton(client, state) {
  assertAutomaticChatGptMutationAllowed("real-send-button");
  if (!client)
    return { ok: false, error: "chatgpt-input-gate-no-cdp-target", state };
  const rect = state?.sendButton?.rect;
  if (!rect) return { ok: false, error: "send-button-not-found", state };

  const x = Math.round(rect.x + rect.w / 2);
  const y = Math.round(rect.y + rect.h / 2);

  assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
  await client.Input.dispatchMouseEvent({
    type: "mouseMoved",
    x,
    y,
    button: "none",
  }).catch(() => null);
  await sleep(120);
  assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
  await client.Input.dispatchMouseEvent({
    type: "mousePressed",
    x,
    y,
    button: "left",
    clickCount: 1,
  }).catch(() => null);
  await sleep(90);
  assertAutomaticChatGptMutationAllowed("automatic-input-boundary");
  await client.Input.dispatchMouseEvent({
    type: "mouseReleased",
    x,
    y,
    button: "left",
    clickCount: 1,
  }).catch(() => null);

  return { ok: true, x, y, sendButton: state.sendButton };
}

async function vidoraChatGptInputGate(client, context = {}) {
  assertAutomaticChatGptMutationAllowed("chatgpt-input-gate");
  return { ok: true, mode: "bypassed" };
  let state = await vidoraReadChatGptComposerStateReal(
    typeof client !== "undefined"
      ? client
      : typeof page !== "undefined"
        ? page
        : null,
    context,
  );

  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: "ChatGPT INPUT GATE: check khung input trước khi chuyển bước.",
    details: { context, state },
  }).catch(() => null);

  if (!state?.ok) {
    throw new Error(
      `chatgpt-input-gate-read-failed: ${state?.error || "unknown"}`,
    );
  }

  // Đang có nút Stop => đã gửi thật và ChatGPT đang chạy.
  if (state.stopVisible) {
    return { ok: true, mode: "stop-visible-running", state };
  }

  // Input trống + có assistant message => có thể chuyển bước.
  if (!state.composerHasText && state.assistantRootCount > 0) {
    return { ok: true, mode: "input-empty-assistant-exists", state };
  }

  // Input trống nhưng chưa có assistant message:
  // - Sau khi đã vào /c/... và đang ở bước final settle/extract thì đây là case hợp lệ:
  //   ChatGPT tạo ảnh dạng image-card không có assistant text rõ ràng.
  // - Chỉ chặn sớm ở root "/" hoặc trước khi có hội thoại thật.
  if (!state.composerHasText && state.assistantRootCount === 0) {
    const path = String(state.path || "");
    const stage = String(context?.stage || "");

    if (
      path.includes("/c/") &&
      !state.stopVisible &&
      (stage.includes("before-final-image-settle") ||
        stage.includes("before-image-extract-wait") ||
        stage.includes("after-nv1-sentImage-log"))
    ) {
      await appendAppLog(null, {
        source: "main",
        kind: "ok",
        text: "ChatGPT INPUT GATE: input trống + URL /c/...; cho phép tiếp tục extract ảnh dù assistantRootCount=0.",
        details: { context, state },
      }).catch(() => null);

      return {
        ok: true,
        mode: "empty-input-conversation-url-allow-extract",
        state,
      };
    }

    await appendAppLog(null, {
      source: "main",
      kind: "error",
      text: "ChatGPT INPUT GATE FAIL: input trống nhưng chưa có assistant message mới; không được chờ ảnh/NV2.",
      details: { context, state },
    }).catch(() => null);

    throw new Error("chatgpt-input-empty-but-no-assistant-message");
  }

  // Còn chữ trong input => chưa gửi hoặc gửi lỗi. Retry send thật.
  if (state.composerHasText) {
    await appendAppLog(null, {
      source: "main",
      kind: "error",
      text: "ChatGPT INPUT GATE: input còn nội dung => prompt chưa gửi hoặc gửi lỗi. Retry nút gửi thật.",
      details: { context, state },
    }).catch(() => null);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      state = await vidoraReadChatGptComposerStateReal(
        typeof client !== "undefined"
          ? client
          : typeof page !== "undefined"
            ? page
            : null,
        { ...context, attempt },
      );
      const click = await vidoraClickChatGptRealSendButton(
        typeof client !== "undefined"
          ? client
          : typeof page !== "undefined"
            ? page
            : null,
        state,
      );

      await sleep(1800);

      const after = await vidoraReadChatGptComposerStateReal(
        typeof client !== "undefined"
          ? client
          : typeof page !== "undefined"
            ? page
            : null,
        { ...context, attempt, afterClick: true },
      );

      await appendAppLog(null, {
        source: "main",
        kind: !after.composerHasText || after.stopVisible ? "ok" : "error",
        text:
          !after.composerHasText || after.stopVisible
            ? `ChatGPT INPUT GATE: retry ${attempt} gửi được; input đã trống hoặc ChatGPT đang chạy.`
            : `ChatGPT INPUT GATE: retry ${attempt} vẫn chưa gửi; input còn nội dung.`,
        details: { context, attempt, click, after },
      }).catch(() => null);

      if (after.stopVisible) {
        return { ok: true, mode: "running-after-retry", attempt, after };
      }

      if (!after.composerHasText && after.assistantRootCount > 0) {
        return { ok: true, mode: "input-empty-after-retry", attempt, after };
      }

      if (!after.composerHasText && after.assistantRootCount === 0) {
        await sleep(2500);
        const later = await vidoraReadChatGptComposerStateReal(
          typeof client !== "undefined"
            ? client
            : typeof page !== "undefined"
              ? page
              : null,
          { ...context, attempt, later: true },
        );
        if (later.stopVisible || later.assistantRootCount > 0) {
          return { ok: true, mode: "later-after-retry", attempt, later };
        }
      }
    }

    const finalState = await vidoraReadChatGptComposerStateReal(
      typeof client !== "undefined"
        ? client
        : typeof page !== "undefined"
          ? page
          : null,
      { ...context, final: true },
    );

    await appendAppLog(null, {
      source: "main",
      kind: "error",
      text: "ChatGPT INPUT GATE FAIL: input vẫn còn nội dung sau 3 lần retry. Dừng để tránh chạy sai.",
      details: { context, finalState },
    }).catch(() => null);

    throw new Error("chatgpt-input-still-has-text-after-retries");
  }

  return { ok: true, mode: "safe-fallback", state };
}

async function vidoraClearChatGptInputBeforePaste(client, context = {}) {
  assertAutomaticChatGptMutationAllowed("clear-composer-before-paste");
  const state = await vidoraReadChatGptComposerStateReal(
    typeof client !== "undefined"
      ? client
      : typeof page !== "undefined"
        ? page
        : null,
    context,
  );
  if (!state?.ok || !state.composerHasText)
    return { ok: true, skipped: true, state };

  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: "ChatGPT INPUT GATE: trước khi paste prompt mới, input đang có nội dung cũ; xóa sạch.",
    details: { context, state },
  }).catch(() => null);

  const cleared = await evaluateOnCdpPage(
    client,
    `(() => {
    const composer =
      document.querySelector('#prompt-textarea') ||
      document.querySelector('textarea') ||
      document.querySelector('[contenteditable="true"]');

    if (!composer) return { ok: false, error: 'composer-not-found' };

    composer.focus();

    if ('value' in composer) {
      composer.value = '';
      composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
      composer.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      composer.textContent = '';
      composer.innerHTML = '';
      composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    }

    const after = String(composer.value || composer.innerText || composer.textContent || '').trim();

    return {
      ok: after.length === 0,
      afterLength: after.length,
      afterHead: after.slice(0, 300),
    };
  })()`,
  ).catch((error) => ({ ok: false, error: error.message }));

  await appendAppLog(null, {
    source: "main",
    kind: cleared?.ok ? "ok" : "error",
    text: cleared?.ok
      ? "ChatGPT INPUT GATE: đã xóa sạch input cũ."
      : "ChatGPT INPUT GATE: xóa input cũ thất bại.",
    details: { context, cleared },
  }).catch(() => null);

  return cleared;
}

module.exports = {
  initChatGptSend,
  composerPromptAlreadyExact,
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
  verifyComposerPayloadReady,
  waitForComposerPayloadReady,
  vidoraReadChatGptComposerStateReal,
  vidoraClickChatGptRealSendButton,
  vidoraChatGptInputGate,
  vidoraClearChatGptInputBeforePaste
};

function evaluateOnCdpPage(...args) {
  assertAutomaticChatGptMutationAllowed("automatic-dom-boundary");
  return evaluateAutomaticPage(...args);
}
