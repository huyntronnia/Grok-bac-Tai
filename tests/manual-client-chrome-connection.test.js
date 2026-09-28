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
  const connections = [];
  const page = {
    url: () => "https://chatgpt.com/c/customer-chat",
    isClosed: () => false,
    evaluate: async () => ({ visible: true, focused: true }),
    context: () => ({ newCDPSession: async () => ({ send: async () => ({ targetInfo: { targetId: "tab-1" } }), detach: async () => {} }) }),
  };
  const observer = createManualPageObserver({
    endpoint: () => endpoint,
    connect: async (value) => {
      connections.push(value);
      return { isConnected: () => true, contexts: () => [{ pages: () => [page] }] };
    },
  });
  await assert.rejects(observer.getPage(), /Mở Chrome Manual/);
  endpoint = good.endpoint;
  assert.equal((await observer.getPage()).pageId, "tab-1");
  endpoint = "http://127.0.0.1:49174";
  await observer.getPage();
  assert.deepEqual(connections, [good.endpoint, endpoint], "observer must follow Chrome's actual debug port");

  const main = fs.readFileSync(path.join(__dirname, "../electron/main.js"), "utf8");
  assert(main.includes('"--remote-debugging-port=0"'), "Chrome Manual must request a free local debug port");
  console.log("Manual Chrome discovery and profile-bound dynamic CDP connection passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
