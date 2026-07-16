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

const upload = flow.indexOf("Uploading current scene keyframe before NV2.");
const send = flow.indexOf("sendNv2PromptViaDeepCdpInput(page, instruction");
assert(upload >= 0 && send > upload, "generated keyframe must be uploaded before NV2");
assert(flow.includes("pageState.latestUserMessageHash === instructionHash"));
assert(flow.includes("NV2 Prompt already sent. Proceeding to wait for response."));
assert(flow.includes("afterRetrySend?.latestUserMessageHash !== instructionHash"));
assert(flow.includes("NV2 recovery keyframe upload failed"));
assert(flow.includes("waitForChatGptResponse(page, before"));
assert(flow.includes("motion_prompt.txt"));
assert(!flow.includes("Page.navigate"));
assert(!flow.includes("maybeSelectChatGptConversationByTitle("));

console.log("NV2 keyframe and text-only flow tests passed");
