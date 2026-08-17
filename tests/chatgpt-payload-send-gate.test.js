"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { hashChatGptSnapshotText } = require("../electron/main/state");
const { verifyComposerPayloadReady } = require("../electron/main/chatgpt/chatgpt_send");

const prompt = "Tạo ảnh theo file sau: scene_001_nv1_request.txt";
const file = "C:/project/scene_001/scene_001_nv1_request.txt";
const promptHash = hashChatGptSnapshotText(prompt);

const readyState = {
  ok: true,
  composerPromptHash: promptHash,
  composerReady: true,
  composerState: "READY_TO_SEND",
  attachmentCount: 1,
  attachmentsCompleted: 1,
  attachmentNames: ["scene_001_nv1_request(6).txt 34 KB"],
};
assert.strictEqual(verifyComposerPayloadReady(prompt, [file], readyState).ok, true);

const missingFile = verifyComposerPayloadReady(prompt, [file], {
  ...readyState,
  composerState: "PROMPT_READY",
  attachmentCount: 0,
  attachmentsCompleted: 0,
  attachmentNames: [],
});
assert.strictEqual(missingFile.ok, false);
assert.strictEqual(missingFile.error, "chatgpt-payload-send-not-ready");

const wrongPrompt = verifyComposerPayloadReady(`${prompt} changed`, [file], readyState);
assert.strictEqual(wrongPrompt.ok, false);
assert.strictEqual(wrongPrompt.error, "chatgpt-payload-prompt-mismatch");

const uploading = verifyComposerPayloadReady(prompt, [file], {
  ...readyState,
  composerState: "ATTACHING_FILES",
  attachmentsCompleted: 0,
});
assert.strictEqual(uploading.ok, false);
assert.strictEqual(uploading.error, "chatgpt-payload-send-not-ready");

const source = fs.readFileSync(
  path.join(__dirname, "../electron/main/chatgpt/chatgpt_send.js"),
  "utf8",
);
assert.match(source, /waitForComposerPayloadReady\(/);
assert.match(source, /getConversationStateWithExpectedAttachments\(/);
assert.doesNotMatch(source, /chatgpt-payload-attachment-mismatch/);
assert.match(source, /!ladderResult\?\.ok && !\(options\.expectedFilePaths \|\| \[\]\)\.length/);

console.log("ChatGPT atomic payload send gate tests passed");
