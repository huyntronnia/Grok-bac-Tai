"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const rendererSource = fs.readFileSync(path.join(root, "electron", "renderer.js"), "utf8");
const runnerSource = fs.readFileSync(path.join(root, "electron", "main", "pipeline", "pipeline_runner.js"), "utf8");
const bootstrapSource = fs.readFileSync(path.join(root, "electron", "main", "bootstrap", "bootstrap.js"), "utf8");
const pipelineSource = fs.readFileSync(path.join(root, "electron", "main", "chatgpt", "chatgpt_pipeline.js"), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} source not found`);
  const bodyStart = source.indexOf("{", start);
  assert(bodyStart > start, `${name} source body not found`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index++) {
    if (source[index] === "{") depth++;
    if (source[index] === "}") depth--;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} source end not found`);
}

// 1. Test isRetryableChatGptWorkflowError
const isRetryableChatGptWorkflowErrorFn = extractFunction(rendererSource, "isRetryableChatGptWorkflowError");
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${isRetryableChatGptWorkflowErrorFn}; this.check = isRetryableChatGptWorkflowError;`, sandbox);

const retryableErrors = [
  "chatgpt-upload-did-not-create-visible-attachment",
  "chatgpt-attachment-settle-timeout",
  "chatgpt-upload-readiness-timeout",
  "chatgpt-payload-prompt-mismatch",
  "chatgpt-payload-fingerprint-mismatch",
  "chatgpt-same-chat-refresh-failed",
  "prompt-send-ack-without-user-message-ownership",
  "prompt-send-retry-user-message-ownership-not-confirmed",
  "chatgpt-payload-attachment-prepare-failed",
  "chatgpt-payload-recovery-attachment-prepare-failed",
  "ChatGPT sequential upload failed: chatgpt-upload-did-not-create-visible-attachment",
  "ChatGPT NV2 keyframe upload failed: chatgpt-attachment-settle-timeout",
  "NV2 recovery keyframe upload failed: chatgpt-upload-readiness-timeout",
  "long-run-memory-refresh-missing-conversation-id",
  "long-run-memory-refresh-blocked",
  "Prompt send rejected: test error",
  "chatgpt-stuck-turn-detected",
];

for (const err of retryableErrors) {
  assert.strictEqual(
    sandbox.check(err),
    true,
    `Error "${err}" must be recognized as retryable by isRetryableChatGptWorkflowError`,
  );
}

// 2. Test sceneHasRequiredOutputForCurrentMode with TTL > 5 min
const sceneHasRequiredOutputFn = extractFunction(rendererSource, "sceneHasRequiredOutputForCurrentMode");
const hasValidSceneOutputPathFn = extractFunction(rendererSource, "hasValidSceneOutputPath");
const sandbox2 = {
  isKeyframeMotionPromptOnlyModeEnabled: () => true,
  SCENE_ASSET_AUDIT_TTL_MS: 5 * 60 * 1000,
  SCENE_OUTPUT_STAT_TTL_MS: 5 * 60 * 1000,
};
vm.createContext(sandbox2);
vm.runInContext(`
${hasValidSceneOutputPathFn}
${sceneHasRequiredOutputFn}
this.checkOutput = sceneHasRequiredOutputForCurrentMode;
`, sandbox2);

const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
const oldCompletedScene = {
  id: 1,
  imagePath: "D:/project/scene_001/keyframe.png",
  motionPromptPath: "D:/project/scene_001/motion_prompt.txt",
  keyframeFileExists: true,
  keyframeFileValid: true,
  motionPromptFileExists: true,
  motionPromptFileValid: true,
  completionStatus: "keyframe_motion_complete",
  assetStatCheckedAtMs: thirtyMinutesAgo,
};

assert.strictEqual(
  sandbox2.checkOutput(oldCompletedScene),
  true,
  "Completed scene in current session must not expire after 30 minutes",
);

const oldIncompleteScene = {
  id: 2,
  imagePath: "D:/project/scene_002/keyframe.png",
  motionPromptPath: "D:/project/scene_002/motion_prompt.txt",
  keyframeFileExists: false,
  keyframeFileValid: false,
  motionPromptFileExists: false,
  motionPromptFileValid: false,
  assetStatCheckedAtMs: thirtyMinutesAgo,
};
assert.strictEqual(
  sandbox2.checkOutput(oldIncompleteScene),
  false,
  "Incomplete scene with expired TTL must return false",
);

// 3. Test BrowserWindow backgroundThrottling
assert(
  bootstrapSource.includes("backgroundThrottling: false"),
  "BrowserWindow must be configured with backgroundThrottling: false",
);

// 4. Test pipeline_runner.js memory refresh URL pattern and safe try/catch
assert(
  runnerSource.includes("(?:c|chats)"),
  "pipeline_runner.js must support both /c/ and /chats/ URL formats",
);
assert(
  runnerSource.includes("ChatGPT long-run memory maintenance encountered an issue but was safely skipped"),
  "pipeline_runner.js periodic memory refresh must be protected with safe try/catch",
);

// 5. Test chatgpt_pipeline.js DOM virtualization fallback
assert(
  pipelineSource.includes("usingLatestRootFallback = true"),
  "chatgpt_pipeline.js must activate usingLatestRootFallback when DOM virtualization reduces turn count",
);

console.log("All long-run stability regression tests passed successfully!");
