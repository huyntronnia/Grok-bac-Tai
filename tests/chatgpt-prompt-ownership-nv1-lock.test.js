const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) =>
  fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");

const send = read("electron/main/chatgpt/chatgpt_send.js");
const pipeline = read("electron/main/chatgpt/chatgpt_pipeline.js");
const dom = read("electron/main/chatgpt/chatgpt_dom.js");
const main = read("electron/main.js");

assert(
  send.includes("async function waitForChatGptReadyForNewPrompt("),
  "the send ladder must wait for the previous response before inserting a new prompt",
);
assert(
  send.includes("state?.latestUserMessageHash === expectedPromptHash"),
  "send acknowledgement must be based on exact latest-user-message ownership",
);
assert(
  !send.includes("(composerCleared || assistantAdvanced) && stateAdvanced"),
  "composer/assistant/runtime state alone must not acknowledge a prompt",
);

assert(
  pipeline.includes("chatgpt-hydration-request-2-user-message-not-confirmed"),
  "request 2 must be verified before its response polling starts",
);
assert(
  pipeline.includes("expectedPrompt: request2Prompt"),
  "request 2 response polling must remain scoped to its own user message",
);
assert(
  pipeline.includes('throw new Error("nv1-user-message-ownership-lost-during-image-wait")'),
  "NV1 image polling must stop if another user message takes ownership",
);
assert(
  pipeline.includes("chatgpt-conversation-changed-during-nv1"),
  "NV1 image polling must remain locked to its originating conversation",
);
assert(
  pipeline.includes("const IMAGE_WAIT_STABLE_TICKS_REQUIRED = 2;"),
  "an image logged as stable 2/2 must be saved on the second stable observation",
);
assert(
  pipeline.includes("waiting for the NV1-owned .agent-turn image card before scanning images"),
  "old image cards must not be scanned before the NV1-owned .agent-turn exists",
);
assert(
  pipeline.includes("function buildNv1SingleRetryPrompt(") &&
    pipeline.includes("resumeExpectedUserPromptHash") &&
    pipeline.includes("resumeExpectedUserPromptHash === retryNv1PromptHash"),
  "a restarted scene must resume an owned RETRY 1 image request instead of requiring only the original NV1 hash",
);
assert(
  /writeSceneSnapshot\(options\.sceneDir,\s*\{[\s\S]*?sentPromptHash:\s*activeExpectedUserPromptHash/.test(pipeline),
  "the RETRY 1 ownership hash must be persisted for later resume",
);

const refreshBlock = pipeline.slice(
  pipeline.indexOf("async function maybeRefreshChatGptImageWaitPage("),
  pipeline.indexOf("function pollChatGptRuntime("),
);
assert(
  refreshBlock.includes("reloadCurrentChatAndVerify") &&
    refreshBlock.includes("expectedUserPromptHash") &&
    refreshBlock.includes("ctx.refreshCount >= 1") &&
    refreshBlock.includes("nv1-user-message-ownership-lost-after-stale-wrapper-refresh"),
  "stale-wrapper refresh must be one-shot and preserve conversation plus NV1 ownership",
);
assert(
  pipeline.includes('reason: "nv1-stale-gray-wrapper-after-stop"') &&
    pipeline.includes("!staleWrapper.stopVisible") &&
    pipeline.includes("staleWrapperAgeMs >= 15000"),
  "NV1 may refresh only after the stop control disappears and the wrapper remains stale",
);

const hydrationWaitBlock = pipeline.slice(
  pipeline.indexOf("async function waitForChatGptHydrationResponse("),
  pipeline.indexOf("async function hydrateFreshChatGptContextAfterRotation("),
);
assert(
  !hydrationWaitBlock.includes("requestReloadWithReason"),
  "hydration response polling must not reload or navigate the active chat",
);

const titleCheckBlock = main.slice(
  main.indexOf("async function maybeSelectChatGptConversationByTitle("),
  main.indexOf("async function notifyRenderer("),
);
assert(
  !/\bselectChatGptConversationByTitle\s*\(\s*page/.test(titleCheckBlock),
  "pipeline title checks must never click a ChatGPT sidebar conversation",
);
assert(
  titleCheckBlock.includes('error: "chatgpt-conversation-changed"'),
  "a changed conversation must fail closed instead of navigating back by title",
);

assert(
  !dom.includes("const actionRequired ="),
  "UI recovery must not click generic Review/Continue/Action Required controls",
);
assert(
  dom.includes("const readUserText = (node) =>") &&
    dom.includes('[data-testid*="attachment"]'),
  "user-message ownership must hash prompt text without attachment labels",
);
assert(
  dom.includes('a[href*="/c/"]') && dom.includes("prompt file review"),
  "UI recovery must reject sidebar/navigation targets",
);

console.log("ChatGPT prompt ownership and NV1 conversation-lock tests passed");
