"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  isTransientCdpNavigationError,
  isCdpCrashError,
} = require("../electron/main/chatgpt/chatgpt_recovery");

const root = path.resolve(__dirname, "..");
const read = (file) =>
  fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");

const recovery = read("electron/main/chatgpt/chatgpt_recovery.js");
const pipeline = read("electron/main/chatgpt/chatgpt_pipeline.js");

const navigationError =
  "page.evaluate: Execution context was destroyed, most likely because of a navigation";
assert.strictEqual(isTransientCdpNavigationError(navigationError), true);
assert.strictEqual(
  isCdpCrashError(navigationError),
  false,
  "a normal navigation must never be classified as a renderer crash",
);
assert.strictEqual(isTransientCdpNavigationError("Cannot find context with specified id"), true);
assert.strictEqual(isCdpCrashError("Target page, context or browser has been closed"), true);
assert.strictEqual(isCdpCrashError("Error code: Out of Memory"), true);

const recoverBlock = recovery.slice(
  recovery.indexOf("async function recoverCdpPageIfCrashed("),
  recovery.indexOf("async function recoverChatGptBlockingUi("),
);
assert(
  recoverBlock.indexOf("if (state?.transientNavigation)") <
    recoverBlock.indexOf("client.Page.navigate"),
  "transient navigation must return before any provider-root navigation",
);
assert(
  recoverBlock.includes('reason: "TRANSIENT_CDP_NAVIGATION"'),
  "transient navigation recovery must expose a deterministic skip reason",
);

const waitBlock = pipeline.slice(
  pipeline.indexOf("async function waitForLatestChatGPTGeneratedImage("),
  pipeline.indexOf("async function extractLatestChatGPTGeneratedImageBytes("),
);
assert(
  waitBlock.includes("IMAGE_WAIT_TEXT_ONLY_STABLE_TICKS_REQUIRED") &&
    waitBlock.includes("ownedAssistantComplete") &&
    waitBlock.includes('sendSingleNv1Retry("owned-text-only-answer")'),
  "owned text-only answers must trigger the bounded same-chat NV1 retry",
);
assert(
  waitBlock.indexOf('sendSingleNv1Retry("owned-text-only-answer")') <
    waitBlock.indexOf("const staleWrapper = await pollChatGptStaleImageWrapper"),
  "text-only output must be handled before the no-image early-continue path",
);
assert(
  waitBlock.includes("if (singleNv1RetrySent) return false") &&
    waitBlock.includes("chatgpt-image-text-only-after-single-retry"),
  "text-only recovery must never resend NV1 more than once",
);
assert(
  waitBlock.includes("isTransientCdpNavigationError(currentUrlRead.error)") &&
    waitBlock.includes("isTransientCdpNavigationError(ownershipState?.error)"),
  "conversation URL and ownership reads must tolerate transient navigation",
);

console.log("ChatGPT transient-navigation and owned text-only recovery tests passed");
