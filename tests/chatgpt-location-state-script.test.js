"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const {
  getChatGptLocationStateScript,
} = require("../electron/main/chatgpt/chatgpt_dom");

const root = path.resolve(__dirname, "..");
const mainSource = fs.readFileSync(path.join(root, "electron/main.js"), "utf8");
const locationHelperSource = mainSource.slice(
  mainSource.indexOf("async function getChatGptLocationState("),
  mainSource.indexOf("async function invalidateChatGptConversationIdentity("),
);
assert(
  locationHelperSource.includes("getChatGptLocationStateScript.toString()"),
  "the runtime location helper must execute the same tested browser script",
);
assert(
  !locationHelperSource.includes("path.match("),
  "the runtime helper must not reintroduce a regex inside a template string",
);

const expression = `(${getChatGptLocationStateScript.toString()})()`;
const state = vm.runInNewContext(expression, {
  location: {
    origin: "https://chatgpt.com",
    pathname: "/c/6a7b-owned-conversation",
  },
  document: {
    title: "Vidora project chat",
  },
});

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(state)),
  {
    ok: true,
    origin: "https://chatgpt.com",
    path: "/c/6a7b-owned-conversation",
    conversationId: "6a7b-owned-conversation",
    title: "Vidora project chat",
  },
  "the exact browser-injected script must execute and recover the /c/ conversation id",
);

const rootState = vm.runInNewContext(expression, {
  location: {
    origin: "https://chatgpt.com",
    pathname: "/",
  },
  document: {
    title: "ChatGPT",
  },
});
assert.strictEqual(rootState.ok, true);
assert.strictEqual(rootState.conversationId, "");

console.log("ChatGPT location-state browser script tests passed");
