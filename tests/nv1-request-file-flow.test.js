"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pipeline = fs.readFileSync(
  path.join(root, "electron/main/chatgpt/chatgpt_pipeline.js"),
  "utf8",
);
const runner = fs.readFileSync(
  path.join(root, "electron/main/pipeline/pipeline_runner.js"),
  "utf8",
);

const start = pipeline.indexOf("async function generateImageAndMotionWithChatGPT(");
const end = pipeline.indexOf("async function generateMotionPromptWithChatGPT(", start);
assert(start >= 0 && end > start);
const flow = pipeline.slice(start, end);

assert(flow.includes('controlPrompt: requestArtifact.controlPrompt'));
assert(flow.includes('expectedFilePaths: [requestArtifact.filePath]'));
assert(flow.includes('const finalNv1Prompt = nv1Payload.controlPrompt;'));
assert(flow.includes('const filesToUpload = nv1Payload.expectedFilePaths;'));
assert(flow.includes('request: "nv1-request-file"'));
assert(flow.includes('expectedFilePaths: nv1Payload.expectedFilePaths'));
assert(flow.includes('payloadFingerprint: nv1Payload.payloadFingerprint'));
assert(flow.includes('referenceImagePaths: []'));
assert(!flow.includes('const filesToUpload = []'));
assert(!flow.includes('"Create exactly one image from the prompt below'));

const recoveryStart = pipeline.indexOf("async function sendPromptWithSameChatRefreshRecovery(");
const recoveryEnd = pipeline.indexOf("const motionPromptSendLocks", recoveryStart);
const recovery = pipeline.slice(recoveryStart, recoveryEnd);
assert(recovery.includes("prepareAttachments"));
assert(recovery.includes("reloadCurrentChatAndVerify"));
assert(recovery.includes("retryPrepared"));
assert(recovery.includes("expectedFilePaths"));

const retryStart = pipeline.indexOf("function buildNv1SingleRetryPrompt(");
const retryEnd = pipeline.indexOf("async function reloadCurrentChatAndVerify", retryStart);
const retry = pipeline.slice(retryStart, retryEnd);
assert(retry.includes("buildRequestControlPrompt"));
assert(retry.includes("retry: 1"));
assert(!retry.includes("Previous response did not produce"));

assert(runner.includes('imagePrompt: "",'));
assert(runner.includes('requestArtifact: requestFiles.nv1'));
assert(runner.includes('requestArtifact: requestFiles.nv2'));

console.log("NV1 versioned request-file initial/retry/recovery tests passed");
