(() => {
    if (typeof window.__extractConversationSnapshot !== 'function') {
      window.__extractConversationSnapshot = function extractConversationSnapshot(options = {}) {
  const light = Boolean(options && options.light);

  const visible = (node) => {
    const rect = node?.getBoundingClientRect?.();
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
    if (light) return "";
    const text = String(value || "").replace(/\s+/g, " ").trim();
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  };

  const readStableId = (node) => {
    if (light) return "";
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
      for (const child of [...(node.querySelectorAll?.(selector) || [])].filter(visible)) {
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

  // --- Element queries ---
  const bodyText = document.body?.innerText || "";
  const bodyTail = bodyText.slice(-4000);
  const url = window.location.href;

  const composer = document.querySelector("#prompt-textarea, textarea, [contenteditable='true']");
  const composerText = composer ? (composer.value || composer.textContent || '').trim() : '';
  const composerPromptHash = hashText(composerText);
  const composerHasPrompt = composerText.length > 0;

  const attachments = Array.from(document.querySelectorAll("main form [data-testid*='attachment'], main form [class*='attachment'], main form [class*='file-preview'], main form [data-testid*='file-preview']")).filter(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.tagName !== 'INPUT';
  });
  const progressBars = Array.from(document.querySelectorAll("[role='progressbar'], [class*='progress']"));

  const attachmentNames = light ? [] : attachments.map(el => (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim());
  const attachmentHashes = light ? [] : attachments.map(el => {
    const text = el.innerText || el.textContent || el.getAttribute('aria-label') || '';
    const img = el.querySelector('img');
    const imgSrc = img ? (img.currentSrc || img.src || '') : '';
    return hashText(text + ':' + imgSrc);
  });
  const attachmentCount = attachments.length;

  const isUploadingFiles = attachments.some(el => {
    return !!el.querySelector('[role="progressbar"], [class*="progress"], [class*="uploading"], [class*="loading"], [class*="spinner"]');
  });

  // Unified Single DOM Traversal for User/Assistant Turns
  const assistantsAndArticles = Array.from(document.querySelectorAll("[data-message-author-role='assistant'], [data-message-author-role='user'], article, .message")).filter(visible);
  const userNodes = [];
  const assistantNodes = [];
  
  for (const el of assistantsAndArticles) {
    const isUser = el.getAttribute?.('data-message-author-role') === 'user' ||
                   el.classList?.contains?.('user') ||
                   el.querySelector?.('[data-message-author-role="user"]');
    if (isUser) {
      userNodes.push(el);
    } else {
      assistantNodes.push(el);
    }
  }

  const latestAssistant = assistantNodes.at(-1);
  const latestAssistantText = latestAssistant ? (latestAssistant.innerText || "").trim() : "";
  const latestAssistantHash = hashText(latestAssistantText);

  const latestUser = userNodes.at(-1);
  const latestUserText = latestUser ? latestUser.innerText.trim() : '';
  const latestUserMessageHash = hashText(latestUserText);

  const userMessages = [];
  if (!light) {
    userNodes.forEach((node, index) => {
      const text = String(node.innerText || node.textContent || "").trim();
      userMessages.push({
        index,
        turnIndex: index * 2,
        id: readStableId(node),
        text,
        textLength: text.length,
        hash: hashText(text),
      });
    });
  }

  const assistantMessages = [];
  if (!light) {
    assistantNodes.forEach((node, index) => {
      const text = readAssistantText(node);
      assistantMessages.push({
        index,
        turnIndex: index * 2 + 1,
        id: readStableId(node),
        text,
        textLength: text.length,
        hash: hashText(text),
      });
    });
  }

  // Buttons extraction
  const buttons = Array.from(document.querySelectorAll('button, [role="button"], label'))
    .map((node) => {
      const rect = node.getBoundingClientRect?.();
      const text = `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""} ${node.getAttribute?.("data-testid") || ""}`.trim();
      const html = String(node.innerHTML || "").slice(0, 500);
      const disabled = node.disabled || node.getAttribute('aria-disabled') === 'true';
      return { rect, text, html, disabled, node };
    })
    .filter((item) => item.rect && item.rect.width > 4 && item.rect.height > 4);

  const nearComposerButton = (item) =>
    item.rect.left > window.innerWidth * 0.45 &&
    item.rect.top > window.innerHeight * 0.58;

  const stopButton = buttons.find((item) => {
    if (!nearComposerButton(item)) return false;
    const text = String(item.text || "").trim();
    const html = String(item.html || "");
    return (
      /^(stop generating|stop responding|stop|cancel|dừng)$/i.test(text) ||
      /data-testid=["']stop|data-icon=["']stop|stop-circle/i.test(html)
    );
  });
  const stopButtonVisible = !!stopButton;

  const sendBtn = buttons.find(
    (item) =>
      nearComposerButton(item) &&
      !/stop generating|stop responding|stop|cancel|dừng/i.test(item.text) &&
      /send|submit|gửi|arrow-up|paper-plane|composer-submit/i.test(
        `${item.text} ${item.html}`,
      ),
  );
  const sendButtonVisible = !!(sendBtn && !sendBtn.disabled);

  const streaming = stopButtonVisible || [
    ...document.querySelectorAll(
      '[aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"], [class*="result-streaming"]',
    ),
  ].filter(visible).length > 0;

  const placeholderVisible = [
    ...document.querySelectorAll("[class*='placeholder'], [class*='loading-image'], .aspect-square div div")
  ].some(node => node.getBoundingClientRect().width > 10) ||
  Array.from(document.querySelectorAll("canvas")).some(c => c.className.includes("dot") || c.className.includes("loading") || c.closest("[class*='loading']") || c.closest("[class*='preparing']"));

  const progressVisible = placeholderVisible || streaming;

  // Skip deep image counts / canvas scans in light mode
  const images = (!light && latestAssistant) ? Array.from(latestAssistant.querySelectorAll("img, canvas")) : [];
  const completeImages = images.filter(img => img.tagName === "CANVAS" || img.complete);
  const imageElementCount = images.length;
  const imageCompleteCount = completeImages.length;

  const latestAssistantHasImage = images.some(node => node.tagName === "IMG");
  const latestAssistantHasCanvas = images.some(node => node.tagName === "CANVAS");
  const latestAssistantHasText = latestAssistantText.length > 10;

  const stoppedTextDetected = /stopped creating image|image generation stopped|creation stopped|stopped generating/i.test(bodyTail);
  const policyRefusalDetected = /policy|refusal|violate|tiêu chuẩn cộng đồng|chính sách/i.test(bodyTail);
  const loggedOut = /Sign in|Log in|Đăng nhập|Sign up|Đăng ký/i.test(document.title || "") || !!document.querySelector('input[type="password"]');
  const disconnected = /disconnected|reconnect|mất kết nối/i.test(bodyTail);

  const voiceReady = buttons.some(
    (item) =>
      /voice|mic|microphone|record|dictate/i.test(item.text) ||
      /waveform|audio|voice|mic/i.test(item.html),
  );

  const composerReady = Boolean(composer);
  const composerReadyForSend = composerHasPrompt && sendButtonVisible;

  let currentChatId = "";
  if (!light) {
    const match = url.match(/\/c\/([a-f0-9-]+)/i) || url.match(/\/chats\/([a-f0-9-]+)/i);
    if (match) currentChatId = match[1];
  }

  const domNodeCount = light ? 0 : document.getElementsByTagName('*').length;
  const canvasCount = light ? 0 : document.querySelectorAll('canvas').length;

  let composerState = "EMPTY";
  const hasFiles = attachmentCount > 0;
  const hasText = composerHasPrompt;
  if (streaming) {
    if (placeholderVisible) {
      composerState = "WAIT_ACCEPT";
    } else {
      composerState = "WAIT_RESPONSE";
    }
  } else if (isUploadingFiles) {
    composerState = "ATTACHING_FILES";
  } else if (hasFiles && !hasText) {
    composerState = "FILES_READY";
  } else if (hasText && !hasFiles) {
    composerState = "PROMPT_READY";
  } else if (hasFiles && hasText) {
    if (sendButtonVisible) {
      composerState = "READY_TO_SEND";
    } else {
      composerState = "PROMPT_READY";
    }
  } else {
    composerState = "EMPTY";
  }

  const rawUserCount = userNodes.length;
  const rawAssistantCount = assistantNodes.length;
  let waitingForAssistantMessage = false;
  if (rawUserCount > 0) {
    waitingForAssistantMessage = rawAssistantCount < rawUserCount;
  } else {
    const allArticles = [...document.querySelectorAll('article, .message')];
    if (allArticles.length > 0) {
      const lastArticle = allArticles.at(-1);
      const isUser = lastArticle.querySelector?.('[data-message-author-role="user"]') ||
                     lastArticle.className.includes("user") ||
                     /NHIỆM\s*VỤ/i.test(lastArticle.innerText || "");
      waitingForAssistantMessage = !!isUser;
    }
  }

  const activeGenerationMarker = [
    ...document.querySelectorAll(
      '[data-testid*="composer"] [aria-busy="true"], main form [aria-busy="true"], [class*="streaming"], [data-is-streaming="true"]',
    ),
  ].some(visible);

  const rendererOOM = /Aw, Snap|Something went wrong|Out of Memory|Page crashed|Error code:\s*Out of Memory/i.test((document.title || "") + "\n" + bodyText) || /^chrome-error:\/\//i.test(url);

  const attachmentsData = attachments.map(el => {
    const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim();
    const img = el.querySelector('img');
    const imgSrc = img ? (img.currentSrc || img.src || '') : '';
    return { text, imgSrc };
  });

  const toolBlocks = Array.from(document.querySelectorAll("[data-message-author-role='assistant'] [class*='tool'], [data-message-author-role='assistant'] [class*='dalle'], .dalle-tool, [data-testid*='dalle']"));
  const hasDalleTool = toolBlocks.some(block => /dall-e|dalle|image/i.test(block.innerText || block.textContent || block.className || ""));
  const isDalleActive = hasDalleTool && (streaming || progressBars.length > 0 || stopButtonVisible);

  const hasSearchBadge = Boolean(document.querySelector("[class*='search'], [class*='web-search'], .search-badge"));
  const isReasoning = /\bThinking\b|Đang suy nghĩ/i.test(bodyTail);
  const isPythonActive = Boolean(document.querySelector("[class*='code-interpreter'], [class*='python']"));
  const isCanvasActive = Boolean(document.querySelector("[class*='canvas'], #canvas-panel"));

  return {
    ok: true,
    url,
    composerReady,
    composerReadyForSend,
    composerBusy: Boolean(progressBars.length > 0 || stopButtonVisible || isUploadingFiles),
    hasUploadedFiles: hasFiles,
    attachmentsCount: attachmentCount,
    attachmentsCompleted: attachmentCount - progressBars.length,
    progressBarsCount: progressBars.length,
    composerText,
    composerPromptHash,
    composerState,
    assistantMessageCount: assistantNodes.length,
    latestAssistantTextLength: latestAssistantText.length,
    latestAssistantText,
    latestAssistantHash,
    latestUserText,
    latestUserMessageHash,
    userMessages,
    assistantMessages,
    attachmentNames,
    attachmentHashes,
    attachments: attachmentsData,
    textStreamingActive: streaming,
    streaming,
    stopVisible: stopButtonVisible,
    stopButtonVisible,
    sendButtonVisible,
    placeholderVisible,
    progressVisible,
    assistantGenerating: streaming,
    latestAssistantHasImage,
    latestAssistantHasCanvas,
    latestAssistantHasText,
    imageElementCount,
    imageCompleteCount,
    stoppedTextDetected,
    policyRefusalDetected,
    loggedOut,
    disconnected,
    currentChatId,
    domNodeCount,
    canvasCount,
    waitingForAssistantMessage,
    voiceReady,
    activeGenerationMarker,
    buttonsCount: buttons.length,
    rendererOOM,
    dalleActive: isDalleActive,
    searchBadgeVisible: hasSearchBadge,
    reasoningActive: isReasoning,
    pythonCodeInterpreterActive: isPythonActive,
    canvasActive: isCanvasActive,
    timestamp: Date.now(),
  };
};
    }
    const snap = window.__extractConversationSnapshot();
    
  const text = snap.latestAssistantText;
  return {
    count: snap.assistantMessageCount,
    text,
    textLength: text.length,
    source: text ? "extract-conversation-snapshot" : "empty",
    generating: snap.sendButtonVisible ? false : (snap.stopButtonVisible || (snap.streaming && !snap.voiceReady)),
    generation: false,
    streamingIndicator: snap.streaming,
    stopButton: snap.stopButtonVisible,
    sendReady: snap.sendButtonVisible,
    voiceReady: snap.voiceReady,
    composerButtonCount: snap.buttonsCount,
    mode: text ? "extract-conversation-snapshot" : "empty",
  };

  })()