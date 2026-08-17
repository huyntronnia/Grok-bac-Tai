"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const runner = read("electron/main/pipeline/pipeline_runner.js");
const pipeline = read("electron/main/chatgpt/chatgpt_pipeline.js");
const upload = read("electron/main/chatgpt/chatgpt_upload.js");
const send = read("electron/main/chatgpt/chatgpt_send.js");
const recovery = read("electron/main/recovery/recovery.js");

const imageStart = pipeline.indexOf("async function generateImageAndMotionWithChatGPT(");
const imageEnd = pipeline.indexOf("\nasync function generateMotionPromptWithChatGPT", imageStart);
const imageFlow = pipeline.slice(imageStart, imageEnd);
assert(!runner.includes("Try adopting existing scene image from chat history before starting NV1 requests"));
assert(!imageFlow.includes("await adoptExistingSceneImage("));

const nv2Start = pipeline.indexOf("async function generateMotionPromptWithChatGPTOnce(");
const nv2End = pipeline.indexOf("\nasync function saveChatGPTGeneratedImageAsset", nv2Start);
const nv2Flow = pipeline.slice(nv2Start, nv2End);
assert(!nv2Flow.includes("before.userHashes.includes(instructionHash)"));
assert(nv2Flow.includes("currentPayloadMatchesSnapshot && Boolean(liveOwnedPromptBaseline)"));
assert(nv2Flow.includes("nv2-recovered-draft-user-message-ownership-not-confirmed"));
assert(nv2Flow.includes("nv2-recovered-draft-owned-baseline-unavailable"));

assert(runner.includes("readChatGptConversationStateForInit"));
assert(runner.includes("conversationLength === 0"));
assert(runner.includes("pendingHydrationMatchesConversation"));
assert(!runner.includes("assistantCountForChatInit"));

const hydrationStart = pipeline.indexOf("async function hydrateFreshChatGptContextAfterRotation(");
const hydrationEnd = pipeline.indexOf("\nfunction clearAllChatGptPipelineLocks", hydrationStart);
const hydration = pipeline.slice(hydrationStart, hydrationEnd);
for (const field of [
  "conversationId",
  "startedAt",
  "request1Sent",
  "request1PromptHash",
  "request1BeforeCount",
  "request1BeforeText",
  "request1Done",
  "request1CompletedAt",
  "request2Sent",
  "request2PromptHash",
  "request2BeforeCount",
  "request2BeforeText",
  "request2SceneIds",
  "request2Done",
  "request2CompletedAt",
]) {
  assert(hydration.includes(field), `hydration checkpoint field missing: ${field}`);
}
assert(hydration.includes("initialConversationState?.conversationLength"));
assert(hydration.includes("request1Sent && request1Owned"));
assert(hydration.includes("request2Sent && request2Owned"));
assert(hydration.includes("HYDRATION_REQUEST2_SELECTION"));

for (const option of [
  "attachmentsAlreadyPrepared: true",
  "waitForSendButtonReady: true",
  "sendReadyTimeoutMs: 15000",
  "sendReadyRetryTimeoutMs: 15000",
  "sendReadyStableTicks: 1",
  "clickImmediatelyWhenReady: true",
]) {
  assert.strictEqual(
    (hydration.match(new RegExp(option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length,
    2,
    `Request 1 and Request 2 must both use hydration Send readiness option: ${option}`,
  );
}

const sameChatSendStart = pipeline.indexOf(
  "async function sendPromptWithSameChatRefreshRecovery(",
);
const sameChatSendEnd = pipeline.indexOf(
  "\nconst motionPromptSendLocks",
  sameChatSendStart,
);
const sameChatSend = pipeline.slice(sameChatSendStart, sameChatSendEnd);
assert(
  sameChatSend.includes("!options.attachmentsAlreadyPrepared"),
  "hydration Send must not upload an already prepared attachment set twice",
);
assert(
  sameChatSend.includes('`${options.stage || "prompt"}-recovery`'),
  "a real post-refresh recovery must still prepare attachments again",
);

const recentCallPattern = /collectRecentProjectKeyframes\(\s*projectDir,\s*CHATGPT_HYDRATION_KEYFRAME_LIMIT,\s*sceneId,?\s*\)/g;
assert((pipeline.match(recentCallPattern) || []).length >= 2, "every Request 2 call site must pass sceneId");

assert(upload.includes("await sleep(500);"));
assert(upload.includes("await sleep(800);"));
assert(upload.includes("await sleep(1000);"));
assert(upload.includes("options.interFileDelayMs || 1500"));
assert(upload.includes("options.postAttachmentSettleMs || 5000"));
assert(send.includes("const CHATGPT_SHORT_PROMPT_SETTLE_MS = 1500;"));
assert(send.includes("await sleep(CHATGPT_SHORT_PROMPT_SETTLE_MS);"));
assert(send.includes("waitForSendButtonReady: Boolean(options.waitForSendButtonReady)"));
assert(send.includes("sendReadyTimeoutMs: Number(options.sendReadyTimeoutMs || 0)"));
assert(send.includes("sendReadyRetryTimeoutMs: Number(options.sendReadyRetryTimeoutMs || 0)"));
assert(send.includes("sendReadyStableTicks: Number(options.sendReadyStableTicks || 0)"));
assert(send.includes("clickImmediatelyWhenReady: Boolean(options.clickImmediatelyWhenReady)"));
assert(send.includes("context.expectedFilePaths.length > 0 || context.waitForSendButtonReady"));
assert(send.includes("context.sendReadyTimeoutMs || 12000"));
assert(send.includes("const totalTimeoutMs = initialTimeoutMs + additionalTimeoutMs;"));
assert(send.includes("elapsedMs >= initialTimeoutMs"));
assert(send.includes("context.sendReadyStableTicks || 2"));
assert(send.includes("if (!context.clickImmediatelyWhenReady)"));
assert(recovery.includes("const DURABLE_PIPELINE_BACKOFF_MS = [10000, 30000, 60000, 120000];"));

console.log("ChatGPT scene ownership, hydration, and pacing tests passed");
