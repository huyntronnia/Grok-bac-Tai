"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { findChromeExecutable, readProfileDebugEndpoint } = require("../electron/main/chatgpt/manual_chrome_connection");
const { createManualPageObserver } = require("../electron/main/chatgpt/manual_page_observer");

(async () => {
  const customRoot = path.join("D:\\", "Customer Apps");
  const edge = path.join(customRoot, "Microsoft", "Edge", "Application", "msedge.exe");
  assert.equal(findChromeExecutable({
    env: { PROGRAMFILES: customRoot },
    existsSync: (candidate) => candidate === edge,
    run: () => { throw new Error("not needed"); },
  }), edge, "Chrome discovery must use the customer machine's Program Files path");

  const portFile = "49173\n/devtools/browser/customer-session\n";
  const readFile = async () => portFile;
  const good = await readProfileDebugEndpoint("unused", {
    readFile,
    request: async (url) => {
      assert.equal(url, "http://127.0.0.1:49173/json/version");
      return { ok: true, json: async () => ({ webSocketDebuggerUrl: "ws://127.0.0.1:49173/devtools/browser/customer-session" }) };
    },
  });
  assert.deepEqual(good, { endpoint: "http://127.0.0.1:49173", port: 49173 });
  assert.equal(await readProfileDebugEndpoint("unused", {
    readFile,
    request: async () => ({ ok: true, json: async () => ({ webSocketDebuggerUrl: "ws://127.0.0.1:49173/devtools/browser/other-process" }) }),
  }), null, "an unrelated process on the same port must not be accepted");

  let endpoint = "";
  let targetTitle = "Just a moment...";
  const connections = [];
  let disconnections = 0;
  const page = {
    url: () => "https://chatgpt.com/c/customer-chat",
    isClosed: () => false,
    evaluate: async () => ({ visible: true, focused: true }),
    context: () => ({ newCDPSession: async () => ({ send: async () => ({ targetInfo: { targetId: "tab-1" } }), detach: async () => {} }) }),
  };
  const observer = createManualPageObserver({
    endpoint: async () => endpoint,
    listTargets: async () => [{ type: "page", url: "https://chatgpt.com/", title: targetTitle }],
    connect: async (value) => {
      connections.push(value);
      return {
        isConnected: () => true,
        close: async () => { disconnections += 1; },
        contexts: () => [{ pages: () => [page] }],
      };
    },
  });
  await assert.rejects(observer.getPage(), /Mở Chrome Manual/);
  endpoint = good.endpoint;
  await assert.rejects(observer.getPage(), (error) => error.code === "CHATGPT_VERIFICATION_REQUIRED");
  assert.equal(connections.length, 0, "Vidora must not attach Playwright while the user solves Cloudflare verification");
  targetTitle = "ChatGPT";
  assert.equal((await observer.getPage()).pageId, "tab-1");
  targetTitle = "Just a moment...";
  await assert.rejects(observer.getPage(), (error) => error.code === "CHATGPT_VERIFICATION_REQUIRED");
  assert.equal(disconnections, 1, "Vidora must release CDP while the human solves a later challenge");
  targetTitle = "ChatGPT";
  await observer.getPage();
  endpoint = "http://127.0.0.1:49174";
  await observer.getPage();
  assert.deepEqual(connections, [good.endpoint, good.endpoint, endpoint],
    "observer must reconnect after verification and follow Chrome's actual debug port");

  const main = fs.readFileSync(path.join(__dirname, "../electron/main.js"), "utf8");
  assert(main.includes("const MANUAL_CHROME_DEBUG_PORT = 9224"), "Chrome Manual must use its original nonzero debug port");
  assert(!main.includes('"--remote-debugging-port=0"'), "Chrome Manual must not enable Chrome's automation-controlled mode");
  assert(main.includes("endpoint: MANUAL_CHROME_CDP_HOST"),
    "the observer must reconnect to the original Manual Chrome endpoint after Vidora restarts");
  console.log("Manual Chrome original-port launch and challenge handoff tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
