"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const runner = read("electron/main/pipeline/pipeline_runner.js");
const renderer = read("electron/renderer.js");
const memory = read("electron/main/memory/memory.js");
const logging = read("electron/main/logging/logging.js");
const main = read("electron/main.js");
const recovery = read("electron/main/chatgpt/chatgpt_recovery.js");
const chatgptPipeline = read("electron/main/chatgpt/chatgpt_pipeline.js");
const runtimeMonitor = read("electron/main/chatgpt/chatgpt_runtime_monitor.js");
const browserAdapter = read("electron/main/chatgpt/browser_adapter.js");

// OOM regression: binary image data stays on disk and never crosses the
// pipeline IPC response or project persistence boundary.
const sanitizerStart = runner.indexOf("function sanitizeScenePipelineResult(");
const sanitizerEnd = runner.indexOf("\nasync function runScenePipeline(", sanitizerStart);
assert(sanitizerStart >= 0 && sanitizerEnd > sanitizerStart, "pipeline result sanitizer missing");
const sanitizer = runner.slice(sanitizerStart, sanitizerEnd);
assert(!sanitizer.includes("imageDataUrl"), "pipeline IPC result must not include imageDataUrl");
assert(!runner.includes("imageDataUrl:"), "pipeline result construction must not create inline image data");
assert(!renderer.includes("result.imageDataUrl"), "renderer must not retain pipeline base64 image data");
assert(renderer.includes("function sceneWithoutInlineImageData("), "scene persistence scrubber missing");
assert(renderer.includes("imageDataUrl: _discardedImageDataUrl"), "scene persistence must discard legacy inline image data");
assert(renderer.includes("const { scenes: _discardedProjectScenes, ...projectMetadata }"), "session save must avoid cloning heavy project scenes into metadata");
assert(renderer.includes("pipeline: compactScenePipelineResult(scene.pipeline)"), "renderer must retain only compact pipeline metadata");

// Electron returns ProcessMemoryInfo in KiB under private/residentSet.
assert(memory.includes("Number(processInfo.private || 0) * 1024"), "memory milestone must convert private KiB to bytes");
assert(memory.includes("Number(processInfo.residentSet || 0) * 1024"), "memory milestone must convert residentSet KiB to bytes");
assert(!memory.includes("processInfo.privateBytes"), "obsolete Electron privateBytes field must not be used");
assert(!memory.includes("processInfo.residentSetBytes"), "obsolete Electron residentSetBytes field must not be used");
assert(logging.includes("Number(processInfo.private || 0) * 1024"), "crash log must use the real Electron memory field");
assert(main.includes("Number(processInfo.private || 0) * 1024"), "proactive guard must use the real Electron memory field");
assert(memory.includes('send("Memory.getDOMCounters")'), "external ChatGPT DOM memory counters must be collected");
assert(memory.includes("await playwrightSession.detach()"), "temporary memory CDP sessions must be detached");

// Long runs refresh the current conversation, preserving the explicit no-auto-
// rotation policy while releasing browser document resources periodically.
assert(runner.includes("const CHAT_ROTATION_ENABLED = false;"), "automatic chat rotation must remain disabled");
assert(runner.includes("const CHAT_MEMORY_REFRESH_EVERY_SCENES = 5;"), "periodic same-chat refresh interval missing");
assert(runner.includes("async function refreshCurrentChatForLongRunMemory("), "same-chat refresh helper missing");
assert(runner.includes("after?.conversationId !== before.conversationId"), "same-chat refresh must verify conversation identity");
assert(runner.includes("await page.close().catch(() => null)"), "temporary ChatGPT adapters must be closed");
assert(browserAdapter.includes("await this.disconnect();\n        throw error;"), "failed CDP connects must clean up the browser adapter");
assert(browserAdapter.includes("globalThis.activeCdpClient === this"), "closed adapters must not remain globally retained");
assert(runtimeMonitor.includes("this.playwrightPage.off(event, handler)"), "Playwright monitor listeners must be removed");

const nv1Start = chatgptPipeline.indexOf("async function generateImageAndMotionWithChatGPT(");
const nv1End = chatgptPipeline.indexOf("\nasync function generateMotionPromptWithChatGPT(", nv1Start);
assert(nv1Start >= 0 && nv1End > nv1Start, "NV1 function missing");
const nv1Flow = chatgptPipeline.slice(nv1Start, nv1End);
assert(/finally\s*\{[\s\S]*?await page\.close\(\)\.catch/.test(nv1Flow), "NV1 must close its adapter on every exit path");

// Grey-wrapper regression: WAIT_ACCEPT alone may be bypassed only for the
// explicit stale NV1 wrapper recovery. Active actions and send states still win.
const reloadBlockStart = recovery.indexOf("function isReloadBlocked(");
const reloadBlockEnd = recovery.indexOf("\nasync function requestReloadWithReason(", reloadBlockStart);
assert(reloadBlockStart >= 0 && reloadBlockEnd > reloadBlockStart, "reload guard missing");
const reloadBlockSource = recovery.slice(reloadBlockStart, reloadBlockEnd);

let sendState = "SENT";
const sandbox = {
  getChatGptSendState: () => sendState,
};
vm.createContext(sandbox);
vm.runInContext(`${reloadBlockSource}\nthis.isReloadBlocked = isReloadBlocked;`, sandbox);

sandbox.__vidoraLastComposerState = "WAIT_ACCEPT";
assert.match(sandbox.isReloadBlocked(3), /WAIT_ACCEPT/, "normal WAIT_ACCEPT reload must remain blocked");
assert.strictEqual(
  sandbox.isReloadBlocked(3, { allowStaleNv1WrapperRefresh: true }),
  null,
  "stale NV1 wrapper must be allowed to refresh at WAIT_ACCEPT",
);

sandbox.__vidoraActiveActionLock = "upload";
assert.match(
  sandbox.isReloadBlocked(3, { allowStaleNv1WrapperRefresh: true }),
  /Active Action Lock/,
  "stale-wrapper policy must not bypass an active action lock",
);
delete sandbox.__vidoraActiveActionLock;

sendState = "SENDING";
assert.match(
  sandbox.isReloadBlocked(3, { allowStaleNv1WrapperRefresh: true }),
  /ChatGptSendState is SENDING/,
  "stale-wrapper policy must not bypass an active send",
);

assert(
  chatgptPipeline.includes("{ allowStaleNv1WrapperRefresh: true }"),
  "stale wrapper recovery must opt into the narrow reload policy",
);
assert(
  main.includes("__vidoraReloadPolicy = {}") && main.includes("isReloadBlocked(\n        currentSceneId,\n        __vidoraReloadPolicy"),
  "low-level Playwright reload guard must enforce the same policy",
);

console.log("long-run OOM and grey-wrapper regression tests passed");
