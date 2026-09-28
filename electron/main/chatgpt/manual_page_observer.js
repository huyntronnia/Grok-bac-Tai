"use strict";

const crypto = require("crypto");

// Attach to an existing browser and tab only. This adapter has no navigation,
// input, login, recovery, upload, or new-tab methods.
async function listChromeTargets(endpoint) {
  const response = await fetch(`${endpoint}/json/list`, { signal: AbortSignal.timeout(2500) });
  if (!response.ok) throw new Error(`Chrome Manual không trả lời: HTTP ${response.status}`);
  return response.json();
}

function createManualPageObserver({ endpoint, connect, listTargets = listChromeTargets } = {}) {
  let browser = null;
  let connectedEndpoint = "";
  const pageIds = new WeakMap();
  return {
    async getPage() {
      const currentEndpoint = typeof endpoint === "function" ? await endpoint() : endpoint;
      if (!currentEndpoint) throw new Error("Bấm Mở Chrome Manual trước khi theo dõi ChatGPT.");
      // Leave the browser alone while a person completes ChatGPT's security
      // challenge. Connecting Playwright before the page loads can interfere
      // with challenge checks, and there is no conversation to observe yet.
      const targets = await listTargets(currentEndpoint);
      if (!Array.isArray(targets)) throw new Error("Chrome Manual không trả về danh sách tab hợp lệ.");
      const chatgptTargets = targets.filter((target) => {
        try { return target.type === "page" && ["chatgpt.com", "chat.openai.com"].includes(new URL(target.url).hostname); }
        catch (_) { return false; }
      });
      if (chatgptTargets.length === 1 && /just a moment|checking your browser|attention required/i.test(chatgptTargets[0].title || "")) {
        // For connectOverCDP, browser.close() disconnects this client without
        // closing the customer's Chrome window or its existing tabs.
        await browser?.close?.().catch(() => null);
        browser = null;
        connectedEndpoint = "";
        const error = new Error("ChatGPT đang yêu cầu xác minh trong Chrome Manual. Hãy hoàn tất trên Chrome; Vidora sẽ tự theo dõi khi ChatGPT tải xong.");
        error.code = "CHATGPT_VERIFICATION_REQUIRED";
        throw error;
      }
      if (!chatgptTargets.length) throw new Error("Mở một tab ChatGPT trong Chrome Manual để Vidora theo dõi.");
      if (!browser?.isConnected() || connectedEndpoint !== currentEndpoint) {
        const connectBrowser = connect || ((url) => require("playwright").chromium.connectOverCDP(url));
        browser = await connectBrowser(currentEndpoint);
        connectedEndpoint = currentEndpoint;
      }
      const pages = browser.contexts().flatMap((context) => context.pages()).filter((page) => {
        try { return !page.isClosed() && ["chatgpt.com", "chat.openai.com"].includes(new URL(page.url()).hostname); }
        catch (_) { return false; }
      });
      const visible = [];
      const focused = [];
      for (const page of pages) {
        const state = await page.evaluate(() => ({
          visible: document.visibilityState !== "hidden",
          focused: document.hasFocus(),
        })).catch(() => ({ visible: false, focused: false }));
        if (state.visible) visible.push(page);
        if (state.focused) focused.push(page);
      }
      // Selecting the focused tab is a read-only reflection of the user's
      // choice. We never activate, navigate or rotate a ChatGPT tab.
      const page = focused.length === 1
        ? focused[0]
        : visible.length === 1
          ? visible[0]
          : pages.length === 1
            ? pages[0]
            : null;
      if (!page) throw new Error(`Open exactly one ChatGPT tab in Chrome Manual (found ${pages.length}).`);
      if (!pageIds.has(page)) {
        let id = "";
        if (page.context?.().newCDPSession) {
          const session = await page.context().newCDPSession(page);
          try { id = (await session.send("Target.getTargetInfo")).targetInfo.targetId; }
          finally { await session.detach(); }
        }
        pageIds.set(page, id || crypto.randomUUID());
      }
      return {
        clientType: "playwright",
        pageId: pageIds.get(page),
        page,
        evaluate: (expression) => page.evaluate(expression),
      };
    },
  };
}

module.exports = { createManualPageObserver };
