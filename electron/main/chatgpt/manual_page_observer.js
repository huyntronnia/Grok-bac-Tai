"use strict";

const crypto = require("crypto");

// Attach to an existing browser and tab only. This adapter has no navigation,
// input, login, recovery, upload, or new-tab methods.
function createManualPageObserver({ endpoint, connect } = {}) {
  let browser = null;
  const pageIds = new WeakMap();
  return {
    async getPage() {
      if (!browser?.isConnected()) {
        const connectBrowser = connect || ((url) => require("playwright").chromium.connectOverCDP(url));
        browser = await connectBrowser(endpoint);
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
