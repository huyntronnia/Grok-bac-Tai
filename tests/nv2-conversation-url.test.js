"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "electron/main/chatgpt/chatgpt_pipeline.js"),
  "utf8",
);
const start = source.indexOf("async function generateMotionPromptWithChatGPTOnce(");
const end = source.indexOf("function validateMotionPromptResponse", start);
assert(start >= 0 && end > start);
const flow = source.slice(start, end);

assert(flow.includes("snapshot.chatGptConversationId"));
assert(flow.includes("chatgpt-conversation-changed-before-nv2"));
assert(flow.includes("reloadCurrentChatAndVerify(page, expectedConversationId"));
assert(flow.includes('"nv2-send-recovery"'));
assert(flow.includes("expectedConversationId,"));
assert(!flow.includes("maybeSelectChatGptConversationByTitle("));
assert(!flow.includes("Page.navigate"));
assert(!flow.includes("forceCleanChatGptNewChatRotation"));

console.log("NV2 same-conversation tests passed");
