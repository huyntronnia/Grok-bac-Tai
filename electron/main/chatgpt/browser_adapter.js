"use strict";

const { appendAppLog } = require("../logging");

class BrowserAdapter {
  constructor(provider, clientType = "playwright", cdpClient = null) {
    this.provider = provider;
    this.clientType = clientType; // "cdp" hoặc "playwright"
    this.client = cdpClient;      // CDP client nếu ở chế độ cdp
    this.browser = null;          // Playwright Browser instance
    this.page = null;             // Playwright Page instance
    
    // Khai báo Page tương thích ngược
    this.Page = {
      reload: async (opts = {}) => {
        if (this.clientType === "playwright" && this.page) {
          return this.page.reload({ waitUntil: "domcontentloaded", ...opts });
        } else if (this.client && this.client.Page) {
          return this.client.Page.reload(opts);
        }
      },
      frameNavigated: (callback) => {
        if (this.clientType === "playwright" && this.page) {
          this.page.on("framenavigated", (frame) => {
            callback({ frame });
          });
        } else if (this.client && this.client.Page) {
          this.client.Page.frameNavigated(callback);
        }
      },
      bringToFront: async () => {
        if (this.clientType === "playwright" && this.page) {
          return this.page.bringToFront();
        } else if (this.client && this.client.Page) {
          return this.client.Page.bringToFront();
        }
      }
    };

    // Khai báo Inspector tương thích ngược
    this.Inspector = {
      targetCrashed: (callback) => {
        if (this.clientType === "playwright" && this.page) {
          this.page.on("crash", callback);
        } else if (this.client && this.client.Inspector) {
          this.client.Inspector.targetCrashed(callback);
        }
      }
    };

    // Khai báo Input tương thích ngược
    this.Input = {
      dispatchMouseEvent: async (options = {}) => {
        if (this.clientType === "playwright" && this.page) {
          const { type, x, y, button = "left" } = options;
          if (typeof x === "number" && typeof y === "number") {
            await this.page.mouse.move(x, y);
          }
          if (type === "mousePressed") {
            await this.page.mouse.down({ button });
          } else if (type === "mouseReleased") {
            await this.page.mouse.up({ button });
          }
        } else if (this.client && this.client.Input) {
          return this.client.Input.dispatchMouseEvent(options);
        }
      },
      dispatchKeyEvent: async (options = {}) => {
        if (this.clientType === "playwright" && this.page) {
          const { type, key, code } = options;
          const k = key || code;
          if (k) {
            if (type === "rawKeyDown" || type === "keyDown") {
              await this.page.keyboard.down(k);
            } else if (type === "keyUp") {
              await this.page.keyboard.up(k);
            }
          }
        } else if (this.client && this.client.Input) {
          return this.client.Input.dispatchKeyEvent(options);
        }
      },
      insertText: async (options = {}) => {
        if (this.clientType === "playwright" && this.page) {
          await this.page.keyboard.insertText(options.text || "");
        } else if (this.client && this.client.Input) {
          return this.client.Input.insertText(options);
        }
      }
    };

    // Khai báo DOM tương thích ngược
    this.DOM = {
      getDocument: async (options = {}) => {
        if (this.clientType === "playwright" && this.page) {
          return { root: { nodeId: 1 } };
        } else if (this.client && this.client.DOM) {
          return this.client.DOM.getDocument(options);
        }
      },
      querySelector: async (options = {}) => {
        if (this.clientType === "playwright" && this.page) {
          const { selector } = options;
          const exists = await this.page.evaluate((sel) => {
            return !!document.querySelector(sel);
          }, selector).catch(() => false);
          return exists ? { nodeId: 2 } : { nodeId: 0 };
        } else if (this.client && this.client.DOM) {
          return this.client.DOM.querySelector(options);
        }
      },
      focus: async (options = {}) => {
        if (this.clientType === "playwright" && this.page) {
          await this.page.focus('main form textarea, [contenteditable="true"]').catch(() => null);
        } else if (this.client && this.client.DOM) {
          return this.client.DOM.focus(options);
        }
      }
    };
  }

  on(event, callback) {
    if (this.clientType === "playwright") {
      if (event === "disconnect") {
        if (this.browser) this.browser.on("disconnected", callback);
      }
    } else {
      if (this.client) this.client.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.clientType === "playwright") {
      if (event === "disconnect") {
        if (this.browser) this.browser.off("disconnected", callback);
      }
    } else {
      if (this.client) this.client.off(event, callback);
    }
  }

  // Kết nối đến trình duyệt
  async connect(cdpEndpoint, target) {
    if (this.clientType === "playwright") {
      const { chromium } = require("playwright-core");
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `BrowserAdapter: Connecting to CDP endpoint: ${cdpEndpoint}`,
      }).catch(() => null);

      try {
        this.browser = await chromium.connectOverCDP(cdpEndpoint);
        const contexts = this.browser.contexts();
        if (!contexts.length) {
          throw new Error("No contexts available on remote browser");
        }
        const context = contexts[0];

        // Tìm page phù hợp dựa trên url target
        const hostname = new URL(target.url).hostname;
        const pages = context.pages();
        this.page = pages.find((p) => p.url() && p.url().includes(hostname));

        if (!this.page) {
          // Tạo page mới nếu không tìm thấy
          this.page = await context.newPage();
          await this.page.goto(target.url);
        }

        await appendAppLog(null, {
          source: "main",
          kind: "ok",
          text: `BrowserAdapter: Playwright connected successfully to tab: ${this.page.url()}`,
        }).catch(() => null);
      } catch (error) {
        await this.disconnect();
        throw error;
      }
    } else {
      // Chế độ cdp cũ
      this.client = target.client;
    }
  }

  // Thực thi JS an toàn trên trang
  async evaluate(expression, arg) {
    if (this.clientType === "playwright") {
      return this.page.evaluate(expression, arg);
    } else {
      // Đối với cdp, logic evaluate được bọc trong evaluateOnCdpPage
      throw new Error("For CDP, use evaluateOnCdpPage directly");
    }
  }

  // Upload tệp tin lên phần tử file chooser
  async setInputFiles(selector, filePaths) {
    if (this.clientType === "playwright") {
      await this.page.setInputFiles(selector, filePaths);
    } else {
      throw new Error("For CDP, use DOM domain setFileInputFiles");
    }
  }

  // Đóng/Ngắt kết nối an toàn
  async disconnect() {
    try {
      if (this.clientType === "playwright") {
        if (this.browser) {
          // Gọi close() trên CDP-connected browser sẽ đóng kết nối WebSocket mà không tắt Chrome
          await this.browser.close().catch(() => null);
          this.browser = null;
          this.page = null;
        }
      } else {
        if (this.client) {
          await this.client.close().catch(() => null);
          this.client = null;
        }
      }
    } finally {
      if (globalThis.activeCdpClient === this) {
        globalThis.activeCdpClient = null;
      }
    }
  }

  async close() {
    return this.disconnect();
  }
}

module.exports = BrowserAdapter;
