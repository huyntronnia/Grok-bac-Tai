function detectLoginScript() {
  const bodyText = document.body?.innerText || "";
  const buttonsText = [
    ...document.querySelectorAll('button, a, [role="button"]'),
  ]
    .map((element) =>
      `${element.textContent || ""} ${element.getAttribute("aria-label") || ""}`.trim(),
    )
    .join(" | ");
  const composerSelectors = [
    "textarea",
    'div[contenteditable="true"]',
    '[contenteditable="true"].ProseMirror',
    '[data-testid="composer"]',
    '[data-testid="composer"] [contenteditable="true"]',
    '[role="textbox"]',
    "#prompt-textarea",
  ];
  const composer = composerSelectors
    .map((selector) => document.querySelector(selector))
    .find(Boolean);
  const hasLoginUi =
    /(^|\|)\s*(log in|sign in|đăng nhập|sign up for free|sign up)\s*(\||$)/i.test(
      buttonsText,
    ) ||
    /(^|\n)\s*(Log in|Sign up for free|Sign up)\s*($|\n)/i.test(bodyText) ||
    /Get responses tailored to you|Log in to get|saved chats|upload files/i.test(
      bodyText,
    );
  const hasAppShell =
    !hasLoginUi &&
    (/Projects|GPTs|Company knowledge|Invite team members|Đoạn chat mới|Tìm kiếm đoạn chat|Thư viện|Dự án|Bạn đang làm về cái gì|Hỏi bất kỳ điều gì/i.test(
      bodyText,
    ) ||
      /CUSTOMVOICE|Business|Team|Workspace|Tài khoản|Cài đặt|Nâng cấp gói|Đăng xuất/i.test(
        bodyText,
      ) ||
      /Share\s*\||Chia sẻ|Tạo ảnh|Tra cứu thông tin/i.test(buttonsText));
  return {
    provider: "chatgpt",
    loggedIn: hasAppShell && !hasLoginUi,
    hasComposer: Boolean(composer),
    hasAppShell,
    looksLoggedOut: hasLoginUi,
    cloudflareChallenge: false,
    reason: hasLoginUi
      ? "Trang ChatGPT đang hiện Sign in/Sign up hoặc yêu cầu đăng nhập."
      : "",
    hasSignedInAccount: hasAppShell,
    composerTag: composer?.tagName || null,
    composerClass: composer?.className || null,
    url: location.href,
    title: document.title,
    sampleText: bodyText.slice(0, 1200),
  };
}

function getChatGptLocationStateScript() {
  try {
    const path = String(location.pathname || "");
    const segments = path.split("/").filter(Boolean);
    const conversationId =
      segments[0] === "c" ? String(segments[1] || "") : "";
    return {
      ok: true,
      origin: location.origin,
      path,
      conversationId,
      title: document.title || "",
    };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? error.message : String(error),
    };
  }
}

function detectBrowserCrashPageScript() {
  const text = String(document.body?.innerText || "")
    .replace(/\s+/g, " ")
    .trim();
  const title = document.title || "";
  const url = location.href || "";
  const crashed =
    /Aw, Snap|Something went wrong while displaying this webpage|Out of Memory|Page crashed|Error code:\s*Out of Memory/i.test(
      `${title}\n${text}`,
    ) || /^chrome-error:\/\//i.test(url);
  return {
    ok: true,
    crashed,
    reason: crashed
      ? /Out of Memory/i.test(text)
        ? "out-of-memory"
        : /^chrome-error:/i.test(url)
          ? "chrome-error-page"
          : "aw-snap"
      : "",
    title,
    url,
    textHead: text.slice(0, 260),
  };
}

function dismissChatGptBlockingUiScript(context = {}) {
  const actions = [];
  const textOf = (node) =>
    `${node?.innerText || node?.textContent || ""} ${node?.getAttribute?.("aria-label") || ""} ${node?.title || ""}`
      .replace(/\s+/g, " ")
      .trim();
  const fold = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  const isUnsafeDismissTarget = (item) => {
    const text = fold(item?.text || "");
    const href = fold(
      item?.node?.href || item?.node?.getAttribute?.("href") || "",
    );
    return (
      Boolean(
        item?.node?.closest?.(
          'nav, aside, [role="navigation"], a[href*="/c/"], a[href*="/g/"]',
        ),
      ) ||
      text.length > 140 ||
      /skip to content|prompt file review|create exactly|prompt below|do not answer|nhiem vu|scene|dua tren anh|keyframe|motion prompt|tao anh|xoa tep|delete file|remove file|remove attachment|chia se|share|linkedin|facebook|twitter|x\.com|xem them|show more|learn more|tim hieu|download|tai xuong|copy link|sao chep|open image|open in/i.test(
        `${text} ${href}`,
      )
    );
  };
  const isExactDismissText = (text) =>
    /^(close|dismiss|skip|not now|maybe later|got it|ok|okay|continue generating|x|×|dong|bo qua|de sau)$/.test(
      fold(text),
    );
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
  const clickNode = (node, label) => {
    if (!node || !visible(node)) return false;
    const clickLabel = label || textOf(node).slice(0, 80) || "clicked";
    if (
      /^(dismiss|codex-popup|action-required|image-viewer-close)/i.test(
        clickLabel,
      ) &&
      isUnsafeDismissTarget({ node, text: textOf(node) })
    ) {
      actions.push(
        `skip-unsafe:${textOf(node).slice(0, 80) || node.tagName || "unknown"}`,
      );
      return false;
    }
    node.scrollIntoView?.({ block: "center", inline: "center" });
    const rect = node.getBoundingClientRect?.();
    const x = rect ? rect.x + rect.width / 2 : 0;
    const y = rect ? rect.y + rect.height / 2 : 0;
    node.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerType: "mouse",
        isPrimary: true,
        clientX: x,
        clientY: y,
      }),
    );
    node.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, clientX: x, clientY: y }),
    );
    node.click?.();
    node.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, clientX: x, clientY: y }),
    );
    actions.push(clickLabel);
    return true;
  };
  const buttons = [
    ...document.querySelectorAll(
      'button, [role="button"], a, [tabindex], input[type="button"], input[type="submit"]',
    ),
  ]
    .filter(visible)
    .map((node) => ({
      node,
      text: textOf(node),
      rect: node.getBoundingClientRect(),
      disabled: Boolean(
        node.disabled || node.getAttribute?.("aria-disabled") === "true",
      ),
    }));
  const composer = [
    ...document.querySelectorAll(
      '#prompt-textarea, textarea, [contenteditable="true"], [role="textbox"], [data-testid="composer"]',
    ),
  ].find(visible);
  const imageViewerDetected =
    !composer &&
    [...document.querySelectorAll("img, canvas, picture")].some((node) => {
      const rect = node.getBoundingClientRect?.();
      return (
        rect &&
        rect.width > window.innerWidth * 0.55 &&
        rect.height > window.innerHeight * 0.45 &&
        visible(node)
      );
    });
  if (imageViewerDetected) {
    const close =
      buttons.find(
        (item) =>
          !item.disabled &&
          item.rect.left < 120 &&
          item.rect.top < 150 &&
          /^(close|x|×|đóng)?$/i.test(item.text.trim()),
      ) ||
      buttons.find(
        (item) => !item.disabled && item.rect.left < 120 && item.rect.top < 150,
      ) ||
      buttons.find(
        (item) =>
          !item.disabled &&
          /close|x|×|đóng/i.test(item.text) &&
          item.rect.top < 180,
      );
    if (close)
      clickNode(
        close.node,
        `image-viewer-close:${close.text.slice(0, 40) || "top-left"}`,
      );
  }
  const blockingRoots = [
    ...document.querySelectorAll(
      '[role="dialog"], [aria-modal="true"], [data-radix-dialog-content], [data-headlessui-state], .modal, .popover, .toast, .banner, [class*="modal" i], [class*="popover" i], [class*="overlay" i], [class*="toast" i], [class*="banner" i]',
    ),
  ]
    .filter(visible)
    .map((node) => ({
      node,
      text: textOf(node),
      rect: node.getBoundingClientRect(),
    }))
    .filter(
      (item) =>
        /codex|khám phá codex|explore codex|action required|choose|response|banner|download app|tải ứng dụng|learn more|tìm hiểu thêm|overlay|try again|continue|confirm|upgrade|memory|canvas/i.test(
          item.text,
        ) ||
        item.rect.width > window.innerWidth * 0.42 ||
        item.rect.height > window.innerHeight * 0.18,
    );

  const codexRoot = blockingRoots.find((item) =>
    /codex|khám phá codex|download app|tải ứng dụng/i.test(item.text),
  );
  if (codexRoot) {
    const close =
      buttons.find(
        (item) =>
          !item.disabled &&
          /^(close|dismiss|not now|skip|x|×|đóng|bỏ qua|để sau)$/i.test(
            item.text,
          ),
      ) ||
      buttons.find(
        (item) =>
          !item.disabled &&
          item.rect.left >= codexRoot.rect.right - 90 &&
          item.rect.top >= codexRoot.rect.top &&
          item.rect.top <= codexRoot.rect.top + 90 &&
          !/download|tải|learn|tìm hiểu|open|cloud|install|windows|business|contact|liên hệ/i.test(
            item.text,
          ) &&
          (item.text.length <= 2 ||
            /close|x|×/i.test(`${item.text} ${item.node.innerHTML || ""}`)),
      );
    if (close) clickNode(close.node, `codex-popup:${close.text.slice(0, 60)}`);
  }

  const dismissPattern =
    /^(close|dismiss|skip|not now|maybe later|got it|ok|okay|continue generating|x|×|đóng|bỏ qua|để sau)$/i;
  const dismissButton =
    buttons.find((item) => !item.disabled && dismissPattern.test(item.text)) ||
    buttons.find(
      (item) =>
        !item.disabled &&
        item.text.length <= 80 &&
        /close|dismiss|skip|not now|maybe later|got it|x|×/i.test(item.text) &&
        !/codex|download|tải|learn|tìm hiểu|open|cloud|install|windows|business|contact|liên hệ/i.test(
          item.text,
        ) &&
        item.rect.top < window.innerHeight * 0.78,
    );
  if (dismissButton)
    clickNode(dismissButton.node, `dismiss:${dismissButton.text.slice(0, 60)}`);

  const choiceRoot = blockingRoots.find((item) =>
    /choose|which response|select a response|2 results|hai kết quả|response 1|option 1/i.test(
      item.text,
    ),
  );
  if (choiceRoot) {
    const choice =
      buttons.find(
        (item) =>
          !item.disabled &&
          /response 1|option 1|choose this|use this|select|continue|a$/i.test(
            item.text,
          ) &&
          item.rect.top >= choiceRoot.rect.top,
      ) ||
      buttons.find(
        (item) =>
          !item.disabled &&
          item.rect.top >= choiceRoot.rect.top &&
          item.rect.left >= choiceRoot.rect.left &&
          item.rect.right <= choiceRoot.rect.right,
      );
    if (choice)
      clickNode(choice.node, `choose-result:${choice.text.slice(0, 60)}`);
  }

  // Never click generic Review/Continue/Action Required controls here.
  // Those controls can belong to sidebar items, GPTs or another conversation.

  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
    }),
  );
  document.dispatchEvent(
    new KeyboardEvent("keyup", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
    }),
  );

  // Safe Scroll Recovery
  try {
    // 1. Scroll latest assistant message / placeholder into view if needed
    const assistants = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
    if (assistants.length > 0) {
      const lastAssistant = assistants[assistants.length - 1];
      const target = lastAssistant.querySelector('img, canvas, [aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [class*="loading"], .aspect-square, .aspect-video, [class*="placeholder"]') || lastAssistant;
      const rect = target.getBoundingClientRect();
      const inViewport = rect.top >= 0 && rect.bottom <= window.innerHeight;
      if (!inViewport) {
        target.scrollIntoView({ block: "center", inline: "nearest" });
        actions.push("scroll-latest-assistant-into-view");
      }
    } else {
      // Fallback scroll body if no assistant message is present yet
      const isAtBottom = (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 300;
      if (!isAtBottom) {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
      }
    }

    // 2. Safely find and click scroll-to-bottom button
    const lastClick = window._lastScrollClick || 0;
    if (Date.now() - lastClick > 5000) {
      const scrollBtn = Array.from(document.querySelectorAll('button')).find(btn => {
        const rect = btn.getBoundingClientRect();
        // Nút tròn nổi nổi góc dưới
        const isRound = rect.width > 20 && rect.height > 20 && Math.abs(rect.width - rect.height) < 15;
        if (!isRound) return false;
        
        // Vị trí nằm ở góc dưới
        const isBottom = rect.bottom > window.innerHeight * 0.55;
        if (!isBottom) return false;

        // Verify strictly using aria-label, testid, title, className to prevent clicking wrong buttons
        const label = `${btn.textContent || ""} ${btn.getAttribute("aria-label") || ""} ${btn.title || ""} ${btn.getAttribute("data-testid") || ""} ${btn.className || ""}`.toLowerCase();
        
        // Tránh bấm nhầm các nút thao tác chính
        if (/send|submit|stop|cancel|voice|dictate|regenerate|retry|dừng|gửi|lại/i.test(label)) return false;
        
        // Khớp từ khóa cuộn xuống
        return /scroll.*bottom|scroll.*down|cuon.*xuong|bottom-button|down-button|arrow-down|scroll-button/i.test(label)
          || (btn.querySelector('svg') && /scroll|bottom|down|arrow/i.test(label));
      });

      if (scrollBtn) {
        scrollBtn.click();
        window._lastScrollClick = Date.now();
        actions.push("click-verified-scroll-to-bottom-button");
      }
    }
  } catch (err) {
    // Silent fail
  }
  const disabledSend = buttons.find(
    (item) =>
      /send|submit|composer-submit|arrow-up/i.test(
        `${item.text} ${item.node.innerHTML || ""}`,
      ) && item.disabled,
  );
  return {
    ok: true,
    actions,
    context,
    imageViewerDetected,
    blockingDetected:
      imageViewerDetected || blockingRoots.length > 0 || Boolean(disabledSend),
    disabledSend: disabledSend
      ? {
          text: disabledSend.text,
          box: {
            x: disabledSend.rect.x,
            y: disabledSend.rect.y,
            width: disabledSend.rect.width,
            height: disabledSend.rect.height,
          },
        }
      : null,
    roots: blockingRoots
      .slice(0, 5)
      .map((item) => ({
        text: item.text.slice(0, 180),
        box: {
          x: item.rect.x,
          y: item.rect.y,
          width: item.rect.width,
          height: item.rect.height,
        },
      })),
  };
}

function detectChatGptResponseChoiceUiScript() {
  const bodyText = String(document.body?.innerText || "")
    .replace(/\s+/g, " ")
    .trim();
  const folded = bodyText
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .filter(visible)
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const text = String(
        `${node.innerText || node.textContent || ""} ${node.getAttribute?.("aria-label") || ""}`,
      )
        .replace(/\s+/g, " ")
        .trim();
      const foldedText = text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return {
        text,
        foldedText,
        box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    });
  const composer = [
    ...document.querySelectorAll(
      '#prompt-textarea, textarea, [data-testid="composer"] [contenteditable="true"], div[contenteditable="true"], [role="textbox"]',
    ),
  ].find((node) => {
    const rect = node.getBoundingClientRect?.();
    return (
      rect &&
      rect.width > 80 &&
      rect.height > 16 &&
      rect.bottom > window.innerHeight * 0.55 &&
      visible(node)
    );
  });
  const responseChoiceText =
    /ban dang cho phan hoi ve mot phien ban moi cua chatgpt|ban thich (?:phan hoi|hinh anh) nao hon|which (?:response|image)|choose.*(?:response|image)|select.*(?:response|image)/i.test(
      folded,
    );
  const comparisonLabels =
    /(?:response|phan hoi|image|hinh anh)\s*1.{0,800}(?:response|phan hoi|image|hinh anh)\s*2/i.test(
      folded,
    );
  const responseChoiceButtons = buttons.filter((item) =>
    /toi thich (?:phan hoi|hinh anh) nay hon|(?:hinh anh|image)\s*[12]\s*(?:tot hon|is better)|i prefer this (?:response|image)|choose this (?:response|image)|use this (?:response|image)|select (?:response|image)/i.test(
      item.foldedText,
    ),
  );
  const responseChoiceUi = Boolean(
    responseChoiceText ||
    responseChoiceButtons.length >= 1 ||
    (comparisonLabels && !composer),
  );
  const deletedConversationUi =
    /cuoc tro chuyen da bi xoa|conversation (has been )?deleted|chat (has been )?deleted|this conversation has been deleted/i.test(
      folded,
    );
  return {
    ok: true,
    responseChoiceUi,
    deletedConversationUi,
    hasComposer: Boolean(composer),
    path: location.pathname || "",
    title: document.title || "",
    matchedText: responseChoiceText,
    comparisonLabels,
    choiceButtonCount: responseChoiceButtons.length,
    buttons: responseChoiceButtons.slice(0, 4),
    tail: bodyText.slice(-500),
  };
}

/**
 * @deprecated Use chatgpt_runtime_monitor instead.
 */
function detectChatGptActiveGenerationScript() {
  const bodyTail = String(document.body?.innerText || "").slice(-5000);
  const stoppedText =
    /stopped creating image|image generation stopped|creation stopped|stopped generating/i.test(
      bodyTail,
    );
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
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .filter(visible)
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const text =
        `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`.trim();
      const html = String(node.innerHTML || "").slice(0, 800);
      return { rect, text, html };
    });
  const stopButton = buttons.find((item) => {
    const nearComposer =
      item.rect.top > window.innerHeight * 0.58 &&
      item.rect.left > window.innerWidth * 0.45;
    return (
      nearComposer &&
      (/stop|cancel|dừng/i.test(item.text) ||
        /rect|square|stop-circle|data-icon=["']stop/i.test(item.html))
    );
  });
  const busyNode = [
    ...document.querySelectorAll(
      '[aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"], [class*="result-streaming"], [class*="spinner" i], [class*="loading" i]',
    ),
  ].some(visible);
  const thinkingText =
    !stoppedText &&
    /\bThinking\b|Thinking about your request|Đang suy nghĩ|Generating|Creating|Preparing/i.test(
      bodyTail,
    );
  return {
    ok: true,
    generating: stoppedText
      ? false
      : Boolean(stopButton || busyNode || thinkingText),
    mode: stoppedText
      ? "stopped-text"
      : stopButton
        ? "stop-button"
        : busyNode
          ? "busy-node"
          : thinkingText
            ? "thinking-text"
            : "",
    stopText: stopButton?.text || "",
    tailSnippet: bodyTail.slice(-240),
  };
}

/**
 * @deprecated Use chatgpt_runtime_monitor instead.
 */
function detectChatGptActiveGenerationScriptStrict() {
  const bodyTail = String(document.body?.innerText || "").slice(-5000);
  const stoppedText =
    /stopped creating image|image generation stopped|creation stopped|stopped generating/i.test(
      bodyTail,
    );
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
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .filter(visible)
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const text =
        `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`.trim();
      const html = String(node.innerHTML || "").slice(0, 1000);
      return { rect, text, html };
    });
  const nearComposer = (item) =>
    item.rect.top > window.innerHeight * 0.58 &&
    item.rect.left > window.innerWidth * 0.45;
  const stopButton = buttons.find(
    (item) =>
      nearComposer(item) &&
      (/stop|cancel|dung|dung tra loi/i.test(item.text) ||
        /rect|square|stop-circle|data-icon=["']stop/i.test(item.html)),
  );
  const sendButton = buttons.find(
    (item) =>
      nearComposer(item) &&
      !/stop|cancel|dung/i.test(item.text) &&
      /send|submit|gui|arrow-up|paper-plane|composer-submit|data-testid=["']send/i.test(
        `${item.text} ${item.html}`,
      ),
  );
  const busyNode = [
    ...document.querySelectorAll(
      '[aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"], [class*="result-streaming"], [class*="spinner" i], [class*="loading" i]',
    ),
  ].some(visible);
  const thinkingText =
    !stoppedText &&
    /\bThinking\b|Thinking about your request|Generating|Creating|Preparing/i.test(
      bodyTail,
    );
  const sendReady = Boolean(sendButton && !stopButton);
  return {
    ok: true,
    generating: stoppedText
      ? false
      : sendReady
        ? false
        : Boolean(stopButton || busyNode || thinkingText),
    doneByComposer: sendReady,
    sendReady,
    mode: stoppedText
      ? "stopped-text"
      : stopButton
        ? "stop-button"
        : sendReady
          ? "send-ready"
          : busyNode
            ? "busy-node"
            : thinkingText
              ? "thinking-text"
              : "",
    stopText: stopButton?.text || "",
    sendText: sendButton?.text || "",
    tailSnippet: bodyTail.slice(-240),
  };
}

function getComposerTextScript() {
  const selectors = [
    "#prompt-textarea",
    "textarea",
    'div[contenteditable="true"].ProseMirror',
    '.ProseMirror[contenteditable="true"]',
    '[data-testid="composer"] [contenteditable="true"]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
  ];
  const rightPanelCandidates = selectors
    .flatMap((selector) =>
      [...document.querySelectorAll(selector)].map((node) => ({
        node,
        selector,
      })),
    )
    .filter(({ node }) => {
      const rect = node.getBoundingClientRect?.();
      return (
        rect &&
        rect.width > 80 &&
        rect.height > 16 &&
        rect.left > window.innerWidth * 0.62 &&
        rect.bottom > window.innerHeight * 0.55
      );
    })
    .sort(
      (a, b) =>
        b.node.getBoundingClientRect().bottom -
        a.node.getBoundingClientRect().bottom,
    );
  const active = document.activeElement;
  const activeText = active
    ? (active.value || active.innerText || active.textContent || "").trim()
    : "";
  const activeCandidate =
    active &&
    selectors.some(
      (selector) => active.matches?.(selector) || active.closest?.(selector),
    ) &&
    activeText
      ? {
          node: active.matches?.(selectors.join(","))
            ? active
            : active.closest(selectors.join(",")),
          selector: "activeElement",
        }
      : null;
  const fallbackCandidates = selectors
    .flatMap((selector) =>
      [...document.querySelectorAll(selector)].map((node) => ({
        node,
        selector,
      })),
    )
    .filter(({ node }) => {
      const rect = node.getBoundingClientRect?.();
      const text = (
        node.value ||
        node.innerText ||
        node.textContent ||
        ""
      ).trim();
      return (
        rect &&
        rect.width > 80 &&
        rect.height > 10 &&
        rect.bottom > 0 &&
        text.length > 0 &&
        text.length < 30000
      );
    })
    .sort(
      (a, b) =>
        b.node.getBoundingClientRect().bottom -
        a.node.getBoundingClientRect().bottom,
    );
  const item =
    rightPanelCandidates[0] || activeCandidate || fallbackCandidates[0];
  if (item) {
    const input = item.node;
    return {
      ok: true,
      selector: item.selector,
      text: input.value || input.innerText || input.textContent || "",
    };
  }
  return { ok: false, text: "" };
}

function getActiveComposerTextScript() {
  const selectors =
    '#prompt-textarea, textarea, div[contenteditable="true"].ProseMirror, .ProseMirror[contenteditable="true"], [data-testid="composer"] [contenteditable="true"], div[contenteditable="true"], [role="textbox"]';
  const active = document.activeElement;
  const node = active?.matches?.(selectors)
    ? active
    : active?.closest?.(selectors);
  if (!node) return { ok: false, text: "", selector: "activeElement-none" };
  const text = node.value || node.innerText || node.textContent || "";
  const rect = node.getBoundingClientRect?.();
  return {
    ok: true,
    selector: "activeElement",
    text,
    box: rect
      ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      : null,
  };
}

function inspectNv2ComposerSubmitStateScript(prompt, beforeCount = 0) {
  const wanted = String(prompt || "");
  const normalize = (value = "") =>
    String(value || "")
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
  const composerSelectors = [
    "#prompt-textarea",
    'textarea[data-testid*="composer"]',
    '[data-testid="composer"] textarea',
    '[data-testid="composer"] [contenteditable="true"]',
    "main form textarea",
    'main form [contenteditable="true"]',
    "textarea",
    '[contenteditable="true"]',
  ];
  const seenComposerNodes = new Set();
  const activeElement = document.activeElement;
  const composers = composerSelectors
    .flatMap((selector) =>
      [...document.querySelectorAll(selector)].map((node) => ({
        node,
        selector,
      })),
    )
    .filter(({ node }) => {
      if (!node || seenComposerNodes.has(node) || !visible(node)) return false;
      seenComposerNodes.add(node);
      const rect = node.getBoundingClientRect();
      return rect.width > 80 && rect.height > 12 && node.getAttribute?.("aria-hidden") !== "true";
    })
    .map((candidate) => {
      const { node } = candidate;
      const rect = node.getBoundingClientRect();
      let score = rect.bottom + Math.min(rect.width, 1200) / 20;
      if (node === activeElement || node.contains?.(activeElement)) score += 10000;
      if (node.id === "prompt-textarea") score += 5000;
      if (node.closest?.('[data-testid="composer"]')) score += 3000;
      if (node.closest?.("form")) score += 1500;
      if (node.closest?.("main")) score += 500;
      return { ...candidate, score };
    })
    .sort((left, right) => right.score - left.score);
  const composer = composers[0] || null;
  const node = composer?.node || null;
  const activeNode = document.activeElement;
  const activeComposer = Boolean(
    node &&
    (activeNode === node ||
      node.contains(activeNode) ||
      activeNode?.contains?.(node)),
  );
  const text = node
    ? String(node.value || node.innerText || node.textContent || "")
    : "";
  const fullPromptLoaded =
    normalize(text).length >= Math.max(1, normalize(wanted).length - 2) &&
    normalize(text).includes(
      normalize(wanted).slice(0, Math.min(200, normalize(wanted).length)),
    );
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .filter(visible)
    .map((button) => {
      const rect = button.getBoundingClientRect();
      const textValue =
        `${button.textContent || ""} ${button.getAttribute?.("aria-label") || ""} ${button.title || ""}`.trim();
      const html = String(button.innerHTML || "").slice(0, 1000);
      return {
        node: button,
        rect,
        text: textValue,
        html,
        disabled: Boolean(
          button.disabled || button.getAttribute("aria-disabled") === "true",
        ),
      };
    });
  const nearComposer = (item) =>
    item.rect.top > window.innerHeight * 0.55 &&
    item.rect.left > window.innerWidth * 0.45;
  const stopButton = buttons.find((item) => {
    if (!nearComposer(item)) return false;
    const text = normalize(item.text);
    return (
      /^(stop generating|stop responding|stop|cancel|dừng|dung)$/i.test(text) ||
      /data-testid=["']stop|data-icon=["']stop|stop-circle/i.test(item.html)
    );
  });
  const sendButton = buttons.find(
    (item) =>
      nearComposer(item) &&
      !item.disabled &&
      !/stop|cancel|dừng|dung/i.test(item.text) &&
      /send|submit|gửi|gui|arrow-up|paper-plane|composer-submit|data-testid=["']send/i.test(
        `${item.text} ${item.html}`,
      ),
  );
  const busyNode = [
    ...document.querySelectorAll(
      '[aria-busy="true"], [role="progressbar"], [data-testid*="loading"], [data-testid*="spinner"], [class*="result-streaming"], [class*="spinner" i], [class*="loading" i]',
    ),
  ].some(visible);
  const assistantNodes = [
    ...document.querySelectorAll('[data-message-author-role="assistant"]'),
  ].filter(visible);
  const assistantAdvanced = assistantNodes.length > Number(beforeCount || 0);
  const assistantText = String(
    assistantNodes.at(-1)?.innerText ||
      assistantNodes.at(-1)?.textContent ||
      "",
  ).trim();
  const bodyTail = String(document.body?.innerText || "").slice(-5000);
  const stoppedActivity =
    /stopped thinking|stopped creating image|image generation stopped|creation stopped|stopped generating/i.test(
      document.body?.innerText || "",
    );
  const thinkingText =
    !stoppedActivity &&
    /\bThinking\b|Thinking about your request|Generating|Creating|Preparing|Đang suy nghĩ/i.test(
      bodyTail,
    );
  const generating = Boolean(
    ((stopButton || busyNode || thinkingText) && !sendButton) ||
    (assistantAdvanced && !sendButton),
  );
  return {
    ok: Boolean(node),
    selector: composer?.selector || "",
    activeComposer,
    composerText: text,
    textLength: text.length,
    promptLength: wanted.length,
    fullPromptLoaded,
    composerEmpty: normalize(text).length === 0,
    sendReady: Boolean(sendButton),
    sendButton: sendButton
      ? {
          x: sendButton.rect.x,
          y: sendButton.rect.y,
          width: sendButton.rect.width,
          height: sendButton.rect.height,
          text: sendButton.text,
        }
      : null,
    stopButton: Boolean(stopButton),
    busyNode,
    thinkingText,
    assistantAdvanced,
    assistantCount: assistantNodes.length,
    assistantTextLength: assistantText.length,
    newAssistantOutput: assistantAdvanced && assistantText.length > 0,
    newAssistantPlaceholder: assistantAdvanced,
    generationAcknowledged: generating,
    mode: stopButton
      ? "stop-button"
      : busyNode
        ? "busy-node"
        : thinkingText
          ? "thinking-text"
          : assistantAdvanced
            ? "assistant-root"
            : sendButton
              ? "send-ready"
              : "",
  };
}

// countChatGptAssistantRootsScript replaced by dynamic wrapper

/**
 * @deprecated Use chatgpt_runtime_monitor instead.
 */
// getConversationStateScript replaced by dynamic wrapper
function clickChatGptStopGeneratingScript() {
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .map((node) => {
      const rect = node.getBoundingClientRect?.();
      const text =
        `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""}`.trim();
      return {
        node,
        rect,
        text,
        html: String(node.innerHTML || "").slice(0, 500),
      };
    })
    .filter((item) => item.rect && item.rect.width > 8 && item.rect.height > 8);
  const stop =
    buttons.find((item) => {
      const nearComposer =
        item.rect.left > window.innerWidth * 0.65 &&
        item.rect.top > window.innerHeight * 0.65;
      return (
        nearComposer &&
        (/stop|cancel|dừng/i.test(item.text) ||
          /rect|square|stop/i.test(item.html))
      );
    }) || buttons.find((item) => /stop generating|stop|dừng/i.test(item.text));
  if (!stop)
    return {
      ok: false,
      error: "stop-button-not-found",
      buttonCount: buttons.length,
    };
  stop.node.scrollIntoView({ block: "center", inline: "center" });
  stop.node.dispatchEvent(
    new MouseEvent("pointerdown", {
      bubbles: true,
      clientX: stop.rect.x + stop.rect.width / 2,
      clientY: stop.rect.y + stop.rect.height / 2,
    }),
  );
  stop.node.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      clientX: stop.rect.x + stop.rect.width / 2,
      clientY: stop.rect.y + stop.rect.height / 2,
    }),
  );
  stop.node.click();
  stop.node.dispatchEvent(
    new MouseEvent("mouseup", {
      bubbles: true,
      clientX: stop.rect.x + stop.rect.width / 2,
      clientY: stop.rect.y + stop.rect.height / 2,
    }),
  );
  return {
    ok: true,
    mode: "clicked-stop",
    text: stop.text,
    box: {
      x: stop.rect.x,
      y: stop.rect.y,
      width: stop.rect.width,
      height: stop.rect.height,
    },
  };
}

/**
 * @deprecated Use chatgpt_runtime_monitor instead.
 */
// readChatGptImageStateScript replaced by dynamic wrapper
function clickUploadButtonScript() {
  const input = document.querySelector('input[type="file"]');
  if (input) return { ok: true, mode: "existing-input" };
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 4 && rect.height > 4;
  };
  const textOf = (node) =>
    `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.title || ""} ${node.innerHTML || ""}`;
  const buttons = [
    ...document.querySelectorAll('button, [role="button"], label, div, span'),
  ].filter(visible);
  const bottomButtons = buttons
    .map((button) => ({
      button,
      rect: button.getBoundingClientRect(),
      text: textOf(button),
    }))
    .filter((item) => item.rect.top > window.innerHeight * 0.55);
  const uploadButton =
    bottomButtons.find(
      (item) =>
        /^\s*\+\s*$/.test(item.text) ||
        /Add|Attach|Upload|paperclip/i.test(item.text) ||
        (item.rect.width <= 64 && /svg|path/i.test(item.button.innerHTML || "")),
    )?.button ||
    buttons.find((button) =>
      /upload|attach|image|ảnh|file|paperclip|plus|add/i.test(textOf(button)),
    );
  if (!uploadButton)
    return { ok: false, error: "Không thấy nút upload/attach của ChatGPT." };
  uploadButton.scrollIntoView({ block: "center", inline: "center" });
  uploadButton.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
  uploadButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  uploadButton.click();
  uploadButton.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  return { ok: true, mode: "clicked-upload" };
}

function detectUploadedAssetScript() {
  const bodyText = document.body?.innerText || "";
  const images = [...document.querySelectorAll("img, canvas, video")]
    .map((node) => {
      const rect = node.getBoundingClientRect?.();
      return {
        tag: node.tagName,
        width: rect?.width || 0,
        height: rect?.height || 0,
        top: rect?.top || 0,
        left: rect?.left || 0,
        src: node.currentSrc || node.src || "",
      };
    })
    .filter((item) => item.width >= 24 && item.height >= 24 && item.top > 40);
  const fileInputs = [...document.querySelectorAll('input[type="file"]')].map(
    (input) => ({
      files: input.files?.length || 0,
      accept: input.accept || "",
    }),
  );
  const hasFileName =
    /\.(png|jpe?g|webp|gif|mp4|webm|mov)\b|image uploaded|video uploaded|upload complete|remove image|remove video|attached file|attachment|đã tải lên|tệp đã tải/i.test(
      bodyText,
    );
  const canvasImages = images.filter(
    (item) => item.left < window.innerWidth * 0.78 || item.tag === "CANVAS",
  );
  const previewImages = canvasImages.filter(
    (item) => item.tag !== "CANVAS" && item.width >= 48 && item.height >= 48,
  );
  const hasPreview =
    previewImages.length > 0 || (hasFileName && canvasImages.length > 0);
  const hasInputFile = fileInputs.some((input) => input.files > 0);
  if (hasPreview || hasInputFile || hasFileName)
    return {
      ok: true,
      hasPreview,
      hasInputFile,
      hasFileName,
      images,
      canvasImages,
      previewImages,
      fileInputs,
    };
  return {
    ok: false,
    error: "Chưa thấy ảnh được upload vào composer ChatGPT.",
    images,
    fileInputs,
    sampleText: bodyText.slice(-1000),
  };
}



function focusPromptInputScript() {
  const selectors = [
    "#prompt-textarea",
    "textarea",
    'div[contenteditable="true"].ProseMirror',
    '.ProseMirror[contenteditable="true"]',
    '[data-testid="composer"] [contenteditable="true"]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
  ];
  for (const selector of selectors) {
    const input = document.querySelector(selector);
    if (!input) continue;
    input.scrollIntoView({ block: "center" });
    input.focus();
    input.click();
    const selection = window.getSelection();
    if (input.isContentEditable && selection) {
      const range = document.createRange();
      range.selectNodeContents(input);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return {
      ok: true,
      selector,
      tag: input.tagName,
      className: input.className || "",
    };
  }
  return { ok: false, error: "Không tìm thấy composer ChatGPT." };
}

function setPromptInputValueScript(prompt) {
  const selectors = [
    "#prompt-textarea",
    "textarea",
    'div[contenteditable="true"].ProseMirror',
    '.ProseMirror[contenteditable="true"]',
    '[data-testid="composer"] [contenteditable="true"]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
  ];
  const input = selectors
    .map((selector) => document.querySelector(selector))
    .find(Boolean);
  if (!input)
    return { ok: false, error: "Không tìm thấy composer để set prompt." };
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
  return { ok: true };
}

function deepFocusNv2ComposerScript() {
  const selectors = [
    "#prompt-textarea",
    'textarea[data-testid*="composer"]',
    '[data-testid="composer"] textarea',
    '[data-testid="composer"] [contenteditable="true"]',
    "main form textarea",
    'main form [contenteditable="true"]',
    "textarea",
    '[contenteditable="true"]',
  ];
  const visible = (node) => {
    const rect = node?.getBoundingClientRect?.();
    const style = node ? window.getComputedStyle(node) : null;
    return (
      rect &&
      rect.width > 8 &&
      rect.height > 8 &&
      style?.display !== "none" &&
      style?.visibility !== "hidden"
    );
  };
  const seen = new Set();
  const item = selectors
    .flatMap((selector) =>
      [...document.querySelectorAll(selector)].map((node) => ({
        node,
        selector,
      })),
    )
    .filter(({ node }) => {
      if (!node || seen.has(node) || !visible(node)) return false;
      seen.add(node);
      const rect = node.getBoundingClientRect();
      return rect.width > 80 && rect.height > 12 && node.getAttribute?.("aria-hidden") !== "true";
    })
    .map((candidate) => {
      const { node } = candidate;
      const rect = node.getBoundingClientRect();
      let score = rect.bottom + Math.min(rect.width, 1200) / 20;
      if (node.id === "prompt-textarea") score += 5000;
      if (node.closest?.('[data-testid="composer"]')) score += 3000;
      if (node.closest?.("form")) score += 1500;
      if (node.closest?.("main")) score += 500;
      return { ...candidate, score };
    })
    .sort((left, right) => right.score - left.score)[0];
  if (!item) return { ok: false, error: "nv2-composer-not-found" };
  const { node, selector } = item;
  node.scrollIntoView({ block: "center", inline: "nearest" });
  node.click();
  node.focus();
  if (node.isContentEditable) {
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  } else if (typeof node.setSelectionRange === "function") {
    const length = String(node.value || "").length;
    node.setSelectionRange(length, length);
  }
  const rect = node.getBoundingClientRect();
  return {
    ok: true,
    selector,
    box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  };
}

function clearNv2ComposerScript() {
  const selectors =
    '#prompt-textarea, textarea[data-testid*="composer"], [data-testid="composer"] textarea, [data-testid="composer"] [contenteditable="true"], main form textarea, main form [contenteditable="true"], textarea, [contenteditable="true"]';
  const active = document.activeElement;
  const activeComposer = active?.matches?.(selectors)
    ? active
    : active?.closest?.(selectors);
  const node = activeComposer || document.querySelector("#prompt-textarea") ||
    document.querySelector('[data-testid="composer"] [contenteditable="true"]') ||
    document.querySelector("main form textarea") ||
    document.querySelector('main form [contenteditable="true"]');
  if (!node) return { ok: false, error: "nv2-composer-not-found" };
  if ("value" in node) node.value = "";
  else node.textContent = "";
  node.dispatchEvent(
    new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "deleteContentBackward",
      data: null,
    }),
  );
  node.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "deleteContentBackward",
      data: null,
    }),
  );
  node.dispatchEvent(new Event("change", { bubbles: true }));
  return { ok: true };
}

function dispatchNv2ComposerInputEventsScript(prompt) {
  const selectors =
    '#prompt-textarea, textarea[data-testid*="composer"], [data-testid="composer"] textarea, [data-testid="composer"] [contenteditable="true"], main form textarea, main form [contenteditable="true"], textarea, [contenteditable="true"]';
  const active = document.activeElement;
  const activeComposer = active?.matches?.(selectors)
    ? active
    : active?.closest?.(selectors);
  const node = activeComposer || document.querySelector("#prompt-textarea") ||
    document.querySelector('[data-testid="composer"] [contenteditable="true"]') ||
    document.querySelector("main form textarea") ||
    document.querySelector('main form [contenteditable="true"]');
  if (!node) return { ok: false, error: "nv2-composer-not-found" };
  node.focus();
  node.dispatchEvent(
    new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: String(prompt || ""),
    }),
  );
  node.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: String(prompt || ""),
    }),
  );
  node.dispatchEvent(new Event("change", { bubbles: true }));
  return {
    ok: true,
    active:
      document.activeElement === node || node.contains(document.activeElement),
  };
}

function forceSubmitChatGptComposerScript() {
  const norm = (v) => String(v || "").trim();
  const composer =
    document.querySelector("#prompt-textarea") ||
    document.querySelector("textarea") ||
    document.querySelector('[contenteditable="true"]');
  if (!composer) return { ok: false, error: "composer-not-found" };

  const visible = (node) => {
    const rect = node?.getBoundingClientRect?.();
    return (
      rect &&
      rect.width > 8 &&
      rect.height > 8 &&
      rect.bottom > 0 &&
      rect.right > 0
    );
  };
  const isSendButton = (button) => {
    const label = [
      button.getAttribute("aria-label"),
      button.getAttribute("data-testid"),
      button.id,
      button.innerText,
      button.textContent,
      button.outerHTML,
    ]
      .map(norm)
      .join(" ")
      .toLowerCase();
    if (
      /stop|cancel|voice|micro|tool|search|image|canvas|attach|upload|file/.test(
        label,
      )
    )
      return false;
    return /send|submit|composer-submit|send-button|gửi/.test(label);
  };

  const form = composer.closest("form");
  const scopedButtons = [...(form || document).querySelectorAll("button")];
  const sendButton =
    document.querySelector(
      'button[data-testid="send-button"]:not([disabled]), button[data-testid="composer-submit-button"]:not([disabled]), button[aria-label="Send prompt"]:not([disabled]), button[aria-label="Send message"]:not([disabled])',
    ) ||
    scopedButtons
      .filter(
        (button) =>
          visible(button) &&
          !button.disabled &&
          button.getAttribute("aria-disabled") !== "true" &&
          isSendButton(button),
      )
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return br.y - ar.y || br.x - ar.x;
      })[0];

  if (sendButton) {
    sendButton.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
      }),
    );
    sendButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    sendButton.click();
    sendButton.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    return {
      ok: true,
      mode: "button",
      label: norm(
        sendButton.getAttribute("aria-label") ||
          sendButton.getAttribute("data-testid") ||
          sendButton.textContent,
      ),
    };
  }

  if (form && typeof form.requestSubmit === "function") {
    form.requestSubmit();
    return { ok: true, mode: "form-requestSubmit" };
  }

  composer.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
    }),
  );
  composer.dispatchEvent(
    new KeyboardEvent("keyup", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
    }),
  );
  return { ok: true, mode: "enter-dispatch" };
}

function inspectAndClickChatGptSendButton() {
  const selectors = [
    'button[data-testid="send-button"]',
    'button[data-testid="composer-submit-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label="Send message"]',
    'button[aria-label*="Send"]',
    'button[type="submit"]',
    '[data-testid="composer"] button',
    "form button",
  ];
  let button = null;
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 10 && r.height > 10) {
        button = el;
        break;
      }
    }
  }

  if (!button) {
    return { ok: false, error: "no-button-found" };
  }

  // Extract real-time state attributes
  const ariaLabel = (button.getAttribute("aria-label") || "")
    .toLowerCase()
    .trim();
  const innerText = (button.innerText || button.textContent || "")
    .toLowerCase()
    .trim();
  const title = (button.getAttribute("title") || "").toLowerCase().trim();

  // Extract SVG paths / content
  const svgs = Array.from(button.querySelectorAll("svg"));
  let hasSquareIcon = false;
  let hasUpwardArrow = false;

  for (const svg of svgs) {
    const svgHtml = (svg.innerHTML || "").toLowerCase();

    // Check if SVG has rect, square, stop-circle or classes
    if (
      svgHtml.includes("rect") ||
      svgHtml.includes("square") ||
      svg.querySelector("rect")
    ) {
      hasSquareIcon = true;
    }

    const paths = Array.from(svg.querySelectorAll("path"));
    for (const p of paths) {
      const d = p.getAttribute("d") || "";
      const cls = (p.getAttribute("class") || "").toLowerCase();
      const id = (p.getAttribute("id") || "").toLowerCase();

      // Stop/square indicators in path
      if (
        cls.includes("square") ||
        cls.includes("stop") ||
        id.includes("square") ||
        id.includes("stop")
      ) {
        hasSquareIcon = true;
      }

      // Upward-pointing arrow in path
      if (cls.includes("arrow") || cls.includes("up") || cls.includes("send")) {
        hasUpwardArrow = true;
      }
    }
  }

  // Combine all strings for checking
  const combinedText = [ariaLabel, innerText, title].join(" ");

  // 1. Check for Stop / Cancel / Dừng / Dừng suy nghĩ / Dừng trả lời
  const isStopText = /stop|cancel|dừng|abort/i.test(combinedText);
  const isStop = isStopText || hasSquareIcon;

  if (isStop) {
    return { ok: true, status: "already-sent-safely", isStop: true };
  }

  // 2. Check for Send / Submit / Gửi
  const isSendText = /gửi|send|submit/i.test(combinedText);
  const isSendTestId =
    button.getAttribute("data-testid") === "send-button" ||
    button.getAttribute("data-testid") === "composer-submit-button";

  // Allow if it strictly represents a Send action (label contains "Gửi", "Send", or SVG path has upward arrow, or is a send test-id)
  const isSend =
    isSendText ||
    isSendTestId ||
    hasUpwardArrow ||
    (svgs.length > 0 && !hasSquareIcon);

  if (!isSend) {
    return {
      ok: false,
      error: "button-is-not-send-action",
      label: ariaLabel,
      innerText,
    };
  }

  if (button.disabled || button.getAttribute("aria-disabled") === "true") {
    return { ok: false, error: "button-disabled", label: ariaLabel };
  }

  // Execute DOM .click() directly on the button node inside the page
  button.click();
  const rect = button.getBoundingClientRect();
  return {
    ok: true,
    status: "clicked",
    selector:
      button.getAttribute("data-testid") ||
      button.getAttribute("aria-label") ||
      "submit-button",
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  };
}

async function inspectAndClickChatGptSendButtonSafely() {
  const norm = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  const visible = (node) => {
    const rect = node?.getBoundingClientRect?.();
    return (
      rect &&
      rect.width > 10 &&
      rect.height > 10 &&
      rect.bottom > 0 &&
      rect.right > 0
    );
  };
  const labelOf = (button) =>
    [
      button.getAttribute("aria-label"),
      button.getAttribute("data-testid"),
      button.getAttribute("title"),
      button.getAttribute("type"),
      button.id,
      button.innerText,
      button.textContent,
      button.outerHTML,
    ]
      .map(norm)
      .join(" ");
  const isStopButton = (button) => {
    const label = labelOf(button);
    if (
      /tool|tools|search|image|canvas|attach|upload|file|voice|micro|record|dictate|plus|paperclip|add files|deep research|web/.test(
        label,
      )
    )
      return false;
    const hasSquareIcon = Array.from(button.querySelectorAll("svg")).some(
      (svg) => {
        const html = norm(svg.innerHTML);
        return (
          html.includes("rect") ||
          html.includes("square") ||
          svg.querySelector("rect")
        );
      },
    );
    return /stop|cancel|abort|dung|composer.*stop/.test(label) || hasSquareIcon;
  };
  const isRejectedToolButton = (button) => {
    const label = labelOf(button);
    return /tool|tools|search|image|canvas|attach|upload|file|voice|micro|record|dictate|plus|paperclip|add files|deep research|web/.test(
      label,
    );
  };
  const isStrictSendButton = (button) => {
    if (!visible(button)) return false;
    if (isStopButton(button) || isRejectedToolButton(button)) return false;
    const label = labelOf(button);
    return (
      button.getAttribute("data-testid") === "send-button" ||
      button.getAttribute("data-testid") === "composer-submit-button" ||
      /(^|\s)(send|gui|submit)(\s|$)/.test(label) ||
      /composer-submit|send-button|send prompt|send message|arrow-up|paper-plane/.test(
        label,
      )
    );
  };

  const composer =
    document.querySelector("#prompt-textarea") ||
    document.querySelector("textarea") ||
    document.querySelector('[contenteditable="true"]');
  const root =
    composer?.closest("form") ||
    composer?.closest('[data-testid="composer"]') ||
    composer?.closest('[role="main"]') ||
    document;
  const buttons = Array.from(root.querySelectorAll("button"));
  const stopButton = buttons.find(
    (button) => visible(button) && isStopButton(button),
  );
  if (stopButton) {
    return {
      ok: true,
      status: "already-sent-safely",
      isStop: true,
      selector:
        stopButton.getAttribute("data-testid") ||
        stopButton.getAttribute("aria-label") ||
        "stop-button",
    };
  }

  const button =
    document.querySelector(
      'button[data-testid="send-button"], button[data-testid="composer-submit-button"], button[aria-label="Send prompt"], button[aria-label="Send message"]',
    ) ||
    buttons.filter(isStrictSendButton).sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return br.y - ar.y || br.x - ar.x;
    })[0];

  if (!button)
    return {
      ok: false,
      error: "no-send-button-found",
      buttonCount: buttons.length,
    };

  const extractNodeInfo = (node) => {
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    return {
      outerHTML: node.outerHTML.slice(0, 300),
      ariaLabel: node.getAttribute("aria-label") || "",
      dataTestId: node.getAttribute("data-testid") || "",
      textContent: (node.textContent || "").trim().slice(0, 100),
      disabled: node.disabled || node.getAttribute("aria-disabled") === "true",
      pointerEvents: style.pointerEvents,
      opacity: style.opacity,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      isStop: isStopButton(node),
    };
  };

  const getActiveButtonType = () => {
    const currentButtons = Array.from(root.querySelectorAll("button"));
    const currentStop = currentButtons.find(b => visible(b) && isStopButton(b));
    if (currentStop) return "stop";
    const currentSend = document.querySelector(
      'button[data-testid="send-button"], button[data-testid="composer-submit-button"], button[aria-label="Send prompt"], button[aria-label="Send message"]'
    ) || currentButtons.filter(isStrictSendButton)[0];
    if (currentSend) return "send";
    return "unknown";
  };

  const beforeClick = extractNodeInfo(button);
  const timeline = {};

  // T0
  button.click();
  const t0 = Date.now();

  const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // T0+20ms
  await sleepMs(20);
  timeline.t20 = getActiveButtonType();

  // T0+50ms
  await sleepMs(30);
  timeline.t50 = getActiveButtonType();

  // T0+100ms
  await sleepMs(50);
  timeline.t100 = getActiveButtonType();

  // T0+150ms
  await sleepMs(50);
  const typeAt150 = getActiveButtonType();
  timeline.t150 = typeAt150;

  let dispatchedFallback = false;
  if (typeAt150 === "send") {
    button.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
      }),
    );
    button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    dispatchedFallback = true;
  }

  // T0+170ms
  await sleepMs(20);
  timeline.t170 = getActiveButtonType();

  // T0+250ms
  await sleepMs(80);
  timeline.t250 = getActiveButtonType();

  const isStopActiveNow =
    timeline.t20 === "stop" ||
    timeline.t50 === "stop" ||
    timeline.t100 === "stop" ||
    timeline.t150 === "stop" ||
    timeline.t170 === "stop" ||
    timeline.t250 === "stop";

  return {
    ok: true,
    status: "clicked",
    selector: button.getAttribute("data-testid") || button.getAttribute("aria-label") || "submit-button",
    isStopActiveNow,
    dispatchedFallback,
    timeline: {
      beforeClick,
      ...timeline,
    }
  };
}

function clickSendButtonScript() {
  const candidates = [
    ...document.querySelectorAll(
      'button[data-testid="send-button"], button[data-testid="composer-submit-button"], button[aria-label="Send prompt"], button[aria-label="Send message"], button[aria-label*="Send"], button[type="submit"]',
    ),
    ...document.querySelectorAll(
      'form button, [data-testid="composer"] button, button',
    ),
  ];
  const unique = [...new Set(candidates)];
  const sendButton = unique.find((button) => {
    if (button.disabled || button.getAttribute("aria-disabled") === "true")
      return false;
    const rect = button.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return false;
    const nearComposer =
      rect.top > window.innerHeight * 0.55 &&
      rect.left > window.innerWidth * 0.45;
    if (!nearComposer) return false;
    const label = `${button.getAttribute("aria-label") || ""} ${button.textContent || ""} ${button.dataset?.testid || ""} ${button.innerHTML || ""}`;
    if (
      /voice|mic|microphone|dictate|audio|record|waveform|stop|cancel|square/i.test(
        label,
      )
    )
      return false;
    const explicitSend =
      /send|submit|gửi|arrow-up|composer-submit|send-button|up/i.test(label);
    const hasUpArrowIcon =
      /M(?:2|8|12)[^<]{0,80}(?:L|V|H)[^<]{0,80}(?:up|arrow)|rotate\(-?90|arrow-up/i.test(
        label,
      );
    return explicitSend || hasUpArrowIcon;
  });
  if (!sendButton) {
    const disabledCandidates = unique
      .map((button) => {
        const rect = button.getBoundingClientRect?.();
        const label = `${button.getAttribute?.("aria-label") || ""} ${button.textContent || ""} ${button.dataset?.testid || ""} ${button.innerHTML || ""}`;
        return rect
          ? {
              label: label.replace(/\s+/g, " ").slice(0, 180),
              disabled: Boolean(
                button.disabled ||
                button.getAttribute?.("aria-disabled") === "true",
              ),
              box: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              },
            }
          : null;
      })
      .filter(Boolean)
      .filter((item) =>
        /send|submit|gửi|arrow-up|composer-submit|send-button|up/i.test(
          item.label,
        ),
      )
      .slice(0, 8);
    return {
      ok: false,
      error: "Không tìm thấy nút send đang enabled.",
      disabledCandidates,
    };
  }
  sendButton.scrollIntoView({ block: "center", inline: "center" });
  sendButton.focus();
  sendButton.click();
  const rect = sendButton.getBoundingClientRect();
  return {
    ok: true,
    selector:
      sendButton.getAttribute("data-testid") ||
      sendButton.getAttribute("aria-label") ||
      sendButton.textContent ||
      "button",
    box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  };
}

function sendPromptScript(prompt) {
  const selectors = [
    "textarea",
    "#prompt-textarea",
    'div[contenteditable="true"].ProseMirror',
    '.ProseMirror[contenteditable="true"]',
    '[data-testid="composer"] [contenteditable="true"]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
  ];
  const input = selectors
    .map((selector) => document.querySelector(selector))
    .find(Boolean);
  if (!input)
    return {
      ok: false,
      error: "Không tìm thấy ô nhập prompt Ask anything / composer.",
    };

  input.scrollIntoView({ block: "center" });
  input.focus();
  if (input.tagName === "TEXTAREA") {
    input.value = prompt;
    input.dispatchEvent(new Event("input", { bubbles: true }));
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

  const buttons = [...document.querySelectorAll("button")];
  const sendButton =
    document.querySelector(
      'button[data-testid="send-button"], button[data-testid="composer-submit-button"], button[aria-label="Send prompt"], button[aria-label="Send message"]',
    ) ||
    buttons.find((button) => {
      const label = `${button.getAttribute("aria-label") || ""} ${button.textContent || ""} ${button.dataset?.testid || ""} ${button.innerHTML || ""}`;
      return (
        /send|submit|gửi|arrow-up|composer-submit|send-button/i.test(label) &&
        !button.disabled
      );
    }) ||
    buttons
      .reverse()
      .find((button) => !button.disabled && button.closest("form"));

  setTimeout(() => {
    const retryButton = document.querySelector(
      'button[data-testid="send-button"], button[data-testid="composer-submit-button"], button[aria-label="Send prompt"], button[aria-label="Send message"]',
    );
    if (retryButton && !retryButton.disabled) retryButton.click();
  }, 250);

  if (sendButton && !sendButton.disabled) {
    sendButton.click();
    return {
      ok: true,
      mode: "button",
      selector:
        sendButton.getAttribute("data-testid") ||
        sendButton.getAttribute("aria-label") ||
        sendButton.textContent ||
        "button",
    };
  }

  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
    }),
  );
  return { ok: true, mode: "enter" };
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

/**
 * @deprecated Use chatgpt_runtime_monitor instead.
 */
// readAssistantMessageSnapshotScript replaced by dynamic wrapper
// readLatestAssistantScript replaced by dynamic wrapper


function extractConversationSnapshot(options = {}) {
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
    const text = String(value || "")
      .normalize("NFC")
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
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
  const readUserText = (node) => {
    const contentSelectors = [
      ".whitespace-pre-wrap",
      '[data-testid*="user-message"]',
      "[data-message-content]",
      'div[dir="auto"]',
      "p",
    ];
    for (const selector of contentSelectors) {
      const pieces = [...(node.querySelectorAll?.(selector) || [])]
        .filter(visible)
        .filter(
          (child) =>
            !child.closest?.(
              '[data-testid*="attachment"], [class*="attachment"], [class*="file-preview"], button, nav, aside',
            ),
        )
        .map((child) => String(child.innerText || child.textContent || "").trim())
        .filter(Boolean)
        .sort((left, right) => right.length - left.length);
      if (pieces.length) return pieces[0];
    }
    return String(node.innerText || node.textContent || "").trim();
  };

  // --- Element queries ---
  const bodyText = document.body?.innerText || "";
  const bodyTail = bodyText.slice(-4000);
  const url = window.location.href;

  // ChatGPT can keep stale/hidden textarea or contenteditable nodes mounted.
  // Always choose the live visible composer instead of the first DOM match.
  const composerSelectors = [
    "#prompt-textarea",
    'textarea[data-testid*="composer"]',
    '[data-testid="composer"] textarea',
    '[data-testid="composer"] [contenteditable="true"]',
    'main form textarea',
    'main form [contenteditable="true"]',
    "textarea",
    '[contenteditable="true"]',
  ];
  const seenComposerNodes = new Set();
  const activeElement = document.activeElement;
  const composerCandidates = composerSelectors
    .flatMap((selector) =>
      [...document.querySelectorAll(selector)].map((node) => ({ node, selector })),
    )
    .filter(({ node }) => {
      if (!node || seenComposerNodes.has(node)) return false;
      seenComposerNodes.add(node);
      const rect = node.getBoundingClientRect?.();
      return Boolean(
        visible(node) &&
          rect &&
          rect.width > 80 &&
          rect.height > 12 &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          node.getAttribute?.("aria-hidden") !== "true",
      );
    })
    .map((candidate) => {
      const { node } = candidate;
      const rect = node.getBoundingClientRect();
      let score = rect.bottom + Math.min(rect.width, 1200) / 20;
      if (node === activeElement || node.contains?.(activeElement)) score += 10000;
      if (node.id === "prompt-textarea") score += 5000;
      if (node.closest?.('[data-testid="composer"]')) score += 3000;
      if (node.closest?.("form")) score += 1500;
      if (node.closest?.("main")) score += 500;
      return { ...candidate, score };
    })
    .sort((left, right) => right.score - left.score);
  const composer = composerCandidates[0]?.node || null;
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
  const latestUserText = latestUser ? readUserText(latestUser) : '';
  const latestUserMessageHash = hashText(latestUserText);

  const userMessages = [];
  if (!light) {
    userNodes.forEach((node, index) => {
      const text = readUserText(node);
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

  // ChatGPT now renders generated media in a sibling `.agent-turn`, not
  // inside `[data-message-author-role="assistant"]`. This exact image-card
  // query is intentionally cheap enough to run in light monitor snapshots.
  const imageAgentTurns = [...document.querySelectorAll(".agent-turn")].filter(
    (turn) => turn.querySelector?.(".group\\/imagegen-image"),
  );
  const latestImageAgentTurn = imageAgentTurns.at(-1);
  const images = latestImageAgentTurn
    ? Array.from(
        latestImageAgentTurn.querySelectorAll(
          '.group\\/imagegen-image img, .group\\/imagegen-image canvas',
        ),
      )
    : [];
  const completeImages = images.filter(img => img.tagName === "CANVAS" || img.complete);
  const imageElementCount = images.length;
  const imageCompleteCount = completeImages.length;

  const latestAssistantHasImage = images.some(node => node.tagName === "IMG");
  const latestAssistantHasCanvas = images.some(node => node.tagName === "CANVAS");
  const latestAssistantHasText = latestAssistantText.length > 10;

  const stoppedTextDetected = /stopped creating image|image generation stopped|creation stopped|stopped generating/i.test(bodyTail);
  const policyRefusalDetected = !latestAssistantHasImage && (
    /\b(content policy|policy violation|violate our content)\b/i.test(latestAssistantText) ||
    (/\b(vi phạm chính sách nội dung|tiêu chuẩn cộng đồng)\b/i.test(latestAssistantText) && !latestAssistantText.includes("quyền riêng tư"))
  );
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
    imageAgentTurnCount: imageAgentTurns.length,
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
}

function createOptimizedWrapper(bodyCode) {
  const fn = function() {};
  fn.toString = () => `function() {
    if (typeof window.__extractConversationSnapshot !== 'function') {
      window.__extractConversationSnapshot = ${extractConversationSnapshot.toString()};
    }
    const snap = window.__extractConversationSnapshot();
    ${bodyCode}
  }`;
  return fn;
}

const countAssistantMessagesScript = createOptimizedWrapper(`
  return snap.assistantMessageCount;
`);

const countChatGptAssistantRootsScript = createOptimizedWrapper(`
  return { count: snap.assistantMessageCount, mode: "unified-assistant-roots" };
`);

// Image generation is rendered outside the logical assistant message in the
// current ChatGPT DOM. Keep this counter separate from assistant text roots so
// NV1 can scope itself to image cards created after the scene prompt.
function countChatGptImageAgentTurnsScript() {
  const turns = [...document.querySelectorAll(".agent-turn")].filter((turn) =>
    turn.querySelector?.(".group\\/imagegen-image"),
  );
  return {
    count: turns.length,
    totalAgentTurns: document.querySelectorAll(".agent-turn").length,
    mode: "agent-turn-imagegen-roots",
  };
}

const getConversationStateScript = createOptimizedWrapper(`
  const conversationFingerprint = snap.currentChatId + ":" + snap.latestAssistantHash + ":" + snap.latestUserMessageHash + ":" + (snap.userMessages.length + snap.assistantMessages.length);
  let hash = 2166136261;
  for (let index = 0; index < conversationFingerprint.length; index += 1) {
    hash ^= conversationFingerprint.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const fingerprintHash = (hash >>> 0).toString(16);

  return {
    ok: snap.ok,
    composerState: snap.composerState,
    latestAssistantHash: snap.latestAssistantHash,
    conversationLength: snap.userMessages.length + snap.assistantMessages.length,
    conversationFingerprint: fingerprintHash,
    composerHasPrompt: snap.composerText.length > 0,
    composerText: snap.composerText,
    composerPromptHash: snap.composerPromptHash,
    attachmentCount: snap.attachmentsCount,
    attachmentNames: snap.attachmentNames,
    attachmentHashes: snap.attachmentHashes,
    attachmentsCompleted: snap.attachmentsCompleted,
    progressBarsCount: snap.progressBarsCount,
    attachmentUploadInProgress: snap.composerState === "ATTACHING_FILES",
    composerBusy: snap.composerBusy,
    composerReady: snap.composerReady && snap.sendButtonVisible,
    sendButtonVisible: snap.sendButtonVisible,
    stopButtonVisible: snap.stopButtonVisible,
    streaming: snap.streaming,
    placeholderVisible: snap.placeholderVisible,
    progressVisible: snap.progressVisible,
    assistantGenerating: snap.streaming,
    latestAssistantHasImage: snap.latestAssistantHasImage,
    latestAssistantHasCanvas: snap.latestAssistantHasCanvas,
    latestAssistantHasText: snap.latestAssistantHasText,
    latestUserMessageHash: snap.latestUserMessageHash,
    rendererAlive: !snap.rendererOOM,
    rendererOOM: snap.rendererOOM,
    loggedOut: snap.loggedOut,
    disconnected: snap.disconnected,
    pageReloaded: false,
    conversationAvailable: snap.url.includes('/c/') || snap.url.includes('/chats/'),
    currentChatId: snap.currentChatId,
    domNodeCount: snap.domNodeCount,
    canvasCount: snap.canvasCount,
    attachmentPreviewCount: snap.attachmentsCount,
  };
`);

const readAssistantMessageSnapshotScript = createOptimizedWrapper(`
  return {
    ok: snap.ok,
    url: snap.url,
    count: snap.assistantMessageCount,
    userCount: snap.userMessages.length,
    maxTurnIndex: snap.userMessages.length + snap.assistantMessageCount > 0 ? snap.userMessages.length + snap.assistantMessageCount - 1 : -1,
    ids: snap.assistantMessages.map(m => m.id).filter(Boolean),
    hashes: snap.assistantMessages.map(m => m.hash).filter(Boolean),
    userIds: snap.userMessages.map(m => m.id).filter(Boolean),
    userHashes: snap.userMessages.map(m => m.hash).filter(Boolean),
    latestUserMessageHash: snap.latestUserMessageHash,
    userMessages: snap.userMessages,
    latestUserTurnIndex: snap.userMessages.at(-1)?.turnIndex ?? -1,
    stopVisible: snap.stopVisible,
    composerBusy: snap.composerBusy,
    streamingIndicator: snap.streaming,
    activeGenerationMarker: snap.activeGenerationMarker,
    generationActive: Boolean(snap.composerBusy || snap.streaming || snap.activeGenerationMarker),
    messages: snap.assistantMessages,
  };
`);

const readLatestAssistantScript = createOptimizedWrapper(`
  const text = snap.latestAssistantText;
  return {
    count: snap.assistantMessageCount,
    text,
    hash: snap.latestAssistantHash,
    textLength: text.length,
    source: text ? "extract-conversation-snapshot" : "empty",
    generating: snap.sendButtonVisible ? false : (snap.stopButtonVisible || (snap.streaming && !snap.voiceReady)),
    generation: false,
    streamingIndicator: snap.streaming,
    stopButton: snap.stopButtonVisible,
    composerBusy: snap.composerBusy,
    activeGenerationMarker: snap.activeGenerationMarker,
    sendReady: snap.sendButtonVisible,
    voiceReady: snap.voiceReady,
    composerButtonCount: snap.buttonsCount,
    mode: text ? "extract-conversation-snapshot" : "empty",
  };
`);

const readChatGptImageStateScript = createOptimizedWrapper(`
  const stoppedCreatingImage = /stopped creating image|image generation stopped|creation stopped|stopped generating/i.test(snap.latestAssistantText);
  const preparingImage = !stoppedCreatingImage && /preparing image|creating image|generating image|đang tạo ảnh|đang chuẩn bị ảnh|hoàn thiện.*nét cuối|polishing.*touches/i.test(snap.latestAssistantText);
  const waitingForAssistantMessage = snap.waitingForAssistantMessage;
  const thinking = !stoppedCreatingImage && /Thinking|Thinking about your request|Đang suy nghĩ|Generating|Creating/i.test(snap.latestAssistantText || snap.bodyTail);

  const mediaRoots = [...document.querySelectorAll('.agent-turn')].filter(
    (node) => node.querySelector?.('.group\\\\/imagegen-image'),
  );
  const mediaRoot = mediaRoots.at(-1);
  const urls = [];
  if (mediaRoot) {
    const foundUrls = [...mediaRoot.querySelectorAll('.group\\\\/imagegen-image img, .group\\\\/imagegen-image picture source')]
      .filter((node) => {
        const label = \`\${node.alt || ""} \${node.getAttribute?.("aria-label") || ""} \${node.className || ""}\`;
        if (/avatar|profile|logo|icon|emoji/i.test(label)) return false;
        if (node.tagName === "IMG") {
          if (!node.complete || !node.naturalWidth || node.naturalWidth < 120) return false;
        } else {
          const rect = node.getBoundingClientRect?.();
          if (!rect || rect.width < 120 || rect.height < 80) return false;
        }
        return true;
      })
      .map(
        (node) =>
          node.currentSrc ||
          node.src ||
          node.getAttribute("srcset") ||
          node.getAttribute("src") ||
          "",
      )
      .filter((url) => /^https?:|^blob:|^data:image\\//i.test(url));
    urls.push(...foundUrls);
  }

  const completedVisibleImage = urls.length > 0 && !snap.composerBusy && !thinking;

  const generating = waitingForAssistantMessage
    ? true
    : stoppedCreatingImage || completedVisibleImage
      ? false
      : snap.sendButtonVisible
        ? false
        : snap.stopButtonVisible ||
          snap.streaming ||
          snap.composerBusy ||
          (preparingImage && !completedVisibleImage) ||
          (thinking && !completedVisibleImage);

  return {
    generating,
    waitingForAssistantMessage,
    stopButton: snap.stopButtonVisible,
    preparingImage: stoppedCreatingImage ? false : preparingImage,
    stoppedCreatingImage,
    stopButtonVisible: snap.stopButtonVisible,
    sendReady: snap.sendButtonVisible && !snap.stopButtonVisible,
    sendText: snap.sendButtonVisible ? "send" : "",
    composerBusy: snap.composerBusy,
    streamingIndicator: snap.streaming,
    matchedStreamingIndicators: [],
    loggedOut: snap.loggedOut,
    logoutReason: snap.loggedOut ? "ChatGPT page is showing sign-in/sign-up while waiting for image." : "",
    voiceReady: snap.voiceReady,
    composerButtonCount: snap.buttonsCount,
    buttonText: "",
    urls,
    visibleImageBoxCount: urls.length,
    completedVisibleImage,
    assistantCount: snap.assistantMessageCount,
    imageAgentTurnCount: mediaRoots.length,
    latestAssistantText: snap.latestAssistantText,
    assistantMode: mediaRoots.length > 0 ? "agent-turn-imagegen" : "no-image-agent-turn",
  };
`);

module.exports = {
  clickChatGptStartNewChatScript,
  sendPromptScript,
  clickSendButtonScript,
  inspectAndClickChatGptSendButtonSafely,
  inspectAndClickChatGptSendButton,
  forceSubmitChatGptComposerScript,
  dispatchNv2ComposerInputEventsScript,
  clearNv2ComposerScript,
  deepFocusNv2ComposerScript,
  setPromptInputValueScript,
  focusPromptInputScript,
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
  countChatGptImageAgentTurnsScript,
  getConversationStateScript,
  clickChatGptStopGeneratingScript,
  readChatGptImageStateScript,
  detectUploadedAssetScript,
  clickUploadButtonScript,
  prepareChatGptCreateImageScript,
  readAssistantMessageSnapshotScript,
  readLatestAssistantScript,
  extractConversationSnapshot,
};
