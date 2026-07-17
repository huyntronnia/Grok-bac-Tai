"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const pipeline = fs.readFileSync(
  path.join(root, "electron/main/chatgpt/chatgpt_pipeline.js"),
  "utf8",
);
const dom = fs.readFileSync(
  path.join(root, "electron/main/chatgpt/chatgpt_dom.js"),
  "utf8",
);
const runner = fs.readFileSync(
  path.join(root, "electron/main/pipeline/pipeline_runner.js"),
  "utf8",
);
const domModule = require("../electron/main/chatgpt/chatgpt_dom");

function sliceBetween(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert(from >= 0, `missing start marker: ${start}`);
  assert(to > from, `missing end marker: ${end}`);
  return source.slice(from, to);
}

const poll = sliceBetween(
  pipeline,
  "async function pollChatGptDom",
  "async function maybeHydrateChatGptImage",
);
const imageTurnScope = sliceBetween(
  pipeline,
  "function inspectNv1ImageTurnScopeScript",
  "async function resolveNv1ImageTurnScope",
);
const completed = sliceBetween(
  pipeline,
  "async function checkExistingCompletedImageScript",
  "async function ensureChatGptImageLoadedAndHydratedScript",
);
const hydrate = sliceBetween(
  pipeline,
  "async function ensureChatGptImageLoadedAndHydratedScript",
  "async function adoptExistingSceneImage",
);
const adopt = sliceBetween(
  pipeline,
  "async function adoptExistingSceneImage",
  "async function extractLatestChatGPTGeneratedImageBytesScript",
);
const extract = sliceBetween(
  pipeline,
  "async function extractLatestChatGPTGeneratedImageBytesScript",
  "function getChatGptImageCandidateBoxScript",
);

for (const [name, source] of Object.entries({
  poll,
  completed,
  hydrate,
  adopt,
  extract,
})) {
  assert(source.includes(".agent-turn"), `${name} must use .agent-turn`);
  assert(
    /\.group\\{2,4}\/imagegen-image/.test(source),
    `${name} must scope to the imagegen card`,
  );
  assert(
    !source.includes('[data-message-author-role="assistant"]'),
    `${name} must not scan logical assistant roots for NV1 images`,
  );
}

for (const source of [completed, hydrate, adopt, extract]) {
  assert(
    /imageCard\.querySelector(?:All)?\(['"]img['"]\)|imagegen-image img/.test(source),
    "completed NV1 image detection must accept localized image alt text inside the owned image card",
  );
  assert(
    !source.includes('img[alt^="Generated image"]'),
    "NV1 image detection must not depend on English alt text",
  );
}

assert(dom.includes("function countChatGptImageAgentTurnsScript"));
assert(dom.includes('imageAgentTurns = [...document.querySelectorAll(".agent-turn")]'));
assert(dom.includes("imageAgentTurnCount: imageAgentTurns.length"));
assert(runner.includes("beforeImageAgentTurnCount"));
assert(runner.includes("countChatGptImageAgentTurnsScript"));
assert(
  pipeline.includes("effectiveMinImageAgentTurnIndex") &&
    pipeline.includes("owned-image-turn-dom-rebased-after-virtualization"),
  "NV1 must rebase a stale absolute image-turn baseline after DOM virtualization",
);
assert(
  pipeline.includes("an NV1-owned image is visible after DOM rebase; continuing extraction without reload or duplicate NV1 resend"),
  "an owned visible image after rebase must suppress duplicate NV1 resend",
);

function runImageTurnScope({
  baseline = 24,
  ownershipConfirmed = true,
  imageAfterLatestUser = true,
  assistantAfterLatestUser = false,
  assistantText = "",
  placeholder = false,
  stopVisible = false,
} = {}) {
  const image = {
    complete: true,
    naturalWidth: 1024,
    naturalHeight: 1024,
  };
  const card = {
    querySelector(selector) {
      if (selector === "img") return image;
      if (selector === "canvas") return null;
      if (selector.includes("aria-busy")) return placeholder ? {} : null;
      return null;
    },
  };
  const imageTurn = {
    querySelector(selector) {
      return selector.includes("imagegen-image") ? card : null;
    },
  };
  const assistant = {
    innerText: assistantText,
    textContent: assistantText,
  };
  const latestUser = {
    compareDocumentPosition(node) {
      if (node === assistant) return assistantAfterLatestUser ? 4 : 2;
      return imageAfterLatestUser ? 4 : 2;
    },
  };
  const stopButton = {
    textContent: "Stop generating",
    innerText: "",
    getAttribute: () => "",
    getBoundingClientRect: () => ({ width: 32, height: 32 }),
  };
  const sandbox = {
    Node: { DOCUMENT_POSITION_FOLLOWING: 4 },
    window: {
      getComputedStyle: () => ({
        display: "block",
        visibility: "visible",
        opacity: "1",
      }),
    },
    document: {
      querySelectorAll(selector) {
        if (selector === ".agent-turn") return [imageTurn];
        if (selector.includes('data-message-author-role="user"')) return [latestUser];
        if (selector.includes('data-message-author-role="assistant"')) {
          return assistantAfterLatestUser ? [assistant] : [];
        }
        if (selector === 'button, [role="button"]') {
          return stopVisible ? [stopButton] : [];
        }
        return [];
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(
    `${imageTurnScope}\nthis.result = inspectNv1ImageTurnScopeScript(${baseline}, ${ownershipConfirmed});`,
    sandbox,
  );
  return JSON.parse(JSON.stringify(sandbox.result));
}

const rebasedScope = runImageTurnScope();
assert.strictEqual(rebasedScope.baselineOutOfRange, true);
assert.strictEqual(rebasedScope.totalImageAgentTurns, 1);
assert.strictEqual(rebasedScope.configuredMinImageAgentTurnIndex, 24);
assert.strictEqual(rebasedScope.effectiveMinImageAgentTurnIndex, 0);
assert.strictEqual(rebasedScope.rebased, true);

assert.strictEqual(
  runImageTurnScope({ ownershipConfirmed: false }).rebased,
  false,
  "DOM shrink must never bypass current NV1 prompt ownership",
);
assert.strictEqual(
  runImageTurnScope({ imageAfterLatestUser: false }).rebased,
  false,
  "an old image card before the latest user prompt must not be adopted",
);
assert.strictEqual(
  runImageTurnScope({ stopVisible: true }).rebased,
  false,
  "DOM rebase must wait until generation has stopped",
);
assert.strictEqual(
  runImageTurnScope({ baseline: 1 }).rebased,
  false,
  "a normal baseline equal to the current count must keep waiting for a new image turn",
);

const ownedTextOnlyScope = runImageTurnScope({
  baseline: 1,
  imageAfterLatestUser: false,
  assistantAfterLatestUser: true,
  assistantText:
    "Visible participants and moving elements: one orange tabby cat crossing the scene.",
});
assert.strictEqual(ownedTextOnlyScope.turnsAfterLatestUser, 0);
assert.strictEqual(ownedTextOnlyScope.assistantsAfterLatestUser, 1);
assert.strictEqual(ownedTextOnlyScope.ownedAssistantComplete, true);
assert.match(ownedTextOnlyScope.ownedAssistantText, /Visible participants/);
assert.strictEqual(
  runImageTurnScope({
    baseline: 1,
    imageAfterLatestUser: false,
    assistantAfterLatestUser: true,
    assistantText: "A completed text-only answer that is long enough to inspect.",
    stopVisible: true,
  }).ownedAssistantComplete,
  false,
  "text-only detection must wait until generation has stopped",
);

// Prove the serialized selector reaches querySelector with one literal CSS
// escape before `/`; source-only assertions would miss a double-parse bug.
let receivedImageCardSelector = "";
const originalDocument = global.document;
global.document = {
  querySelectorAll(selector) {
    if (selector !== ".agent-turn") return [];
    return [
      {
        querySelector(received) {
          receivedImageCardSelector = received;
          return {};
        },
      },
    ];
  },
};
try {
  const counted = domModule.countChatGptImageAgentTurnsScript();
  assert.strictEqual(counted.count, 1);
  assert.strictEqual(
    receivedImageCardSelector,
    ".group\\/imagegen-image",
    "the live CSS selector must preserve its slash escape",
  );
} finally {
  global.document = originalDocument;
}

assert(
  domModule.readChatGptImageStateScript
    .toString()
    .includes(String.raw`.group\\/imagegen-image`),
  "the injected image-state script must preserve two source backslashes for the second JS parse",
);

// NV2 remains a text response and must keep its logical assistant snapshot path.
assert(dom.includes('const readLatestAssistantScript = createOptimizedWrapper'));
assert(dom.includes("latestAssistantText"));

console.log("ChatGPT .agent-turn image-root tests passed");
