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

assert(flow.includes('controlPrompt: requestArtifact.controlPrompt'));
assert(flow.includes('expectedFilePaths: [imagePath, requestArtifact.filePath]'));
assert(flow.includes('const instruction = nv2Payload.controlPrompt;'));
assert(!flow.includes('const instruction = String(prompt'));

const upload = flow.indexOf("nv2Payload.expectedFilePaths");
const send = flow.indexOf("sendNv2PromptViaDeepCdpInput(page, instruction");
assert(upload >= 0 && send > upload, "keyframe plus NV2 request file must be prepared before Send");
assert(flow.includes('request: "nv2-keyframe-and-request-file"'));
assert(flow.includes('request: "nv2-keyframe-and-request-file-recovery"'));
assert(flow.includes("expectedFilePaths: nv2Payload.expectedFilePaths"));
assert(flow.includes("payloadFingerprint: nv2Payload.payloadFingerprint"));

assert(flow.includes("pageState.latestUserMessageHash === instructionHash"));
assert(!flow.includes("before.hashes.includes(instructionHash)"));
assert(flow.includes("NV2 Prompt already sent. Proceeding to wait for response."));
assert(flow.includes("afterRetrySend?.latestUserMessageHash !== instructionHash"));
assert(flow.includes("waitForChatGptResponse(page, before"));
assert(flow.includes("motion_prompt.txt"));
assert(!flow.includes("Page.navigate"));
assert(!flow.includes("maybeSelectChatGptConversationByTitle("));

console.log("NV2 keyframe plus versioned request-file flow tests passed");
