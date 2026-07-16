"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "electron/main/chatgpt/chatgpt_pipeline.js"),
  "utf8",
);
const domSource = fs.readFileSync(
  path.join(root, "electron/main/chatgpt/chatgpt_dom.js"),
  "utf8",
);

assert(source.includes("const NV2_STABLE_RESPONSE_TICKS = 3;"));
assert(source.includes("const NV2_TEXT_STABLE_MS = 4000;"));
assert(source.includes("value.length >= 120"));
assert(source.includes('completed?.ok &&'));
assert(source.includes("!hardGenerating"));
assert(source.includes("!softBusy"));
assert(domSource.includes("hash: snap.latestAssistantHash"));
assert(source.includes("allowInPlaceMutation: promptOwned"));
assert(source.includes("nv2-user-message-ownership-lost-during-response-wait"));
assert(source.includes("stableResponseTicks >= NV2_STABLE_RESPONSE_TICKS"));
assert(source.includes("textStableMs >= NV2_TEXT_STABLE_MS"));
assert(source.includes('responsePhase < 2'));
assert(source.includes('"nv2-response-timeout"'));
assert(source.includes("nv2-user-message-ownership-lost-after-refresh"));
assert(!/Page\.navigate/.test(source.slice(source.indexOf("async function generateMotionPromptWithChatGPTOnce"), source.indexOf("function validateMotionPromptResponse"))));

console.log("chatgpt NV2 stable response tests passed");
