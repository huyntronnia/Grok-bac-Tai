"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const sendSource = fs.readFileSync(
  path.join(__dirname, "../electron/main/chatgpt/chatgpt_send.js"),
  "utf8",
);
const domSource = fs.readFileSync(
  path.join(__dirname, "../electron/main/chatgpt/chatgpt_dom.js"),
  "utf8",
);
const recoverySource = fs.readFileSync(
  path.join(__dirname, "../electron/main/chatgpt/chatgpt_recovery.js"),
  "utf8",
);
const pipelineSource = fs.readFileSync(
  path.join(__dirname, "../electron/main/chatgpt/chatgpt_pipeline.js"),
  "utf8",
);
const {
  composerPromptAlreadyExact,
} = require("../electron/main/chatgpt/chatgpt_send");

assert.strictEqual(
  composerPromptAlreadyExact("PROMPT\u200b  NV2", "PROMPT NV2"),
  true,
  "an exact normalized NV2 draft must be preserved instead of cleared and reinserted",
);
assert.strictEqual(
  composerPromptAlreadyExact("PROMPT NV2 old", "PROMPT NV2"),
  false,
  "a stale or extended draft must still be replaced",
);

assert.match(
  sendSource,
  /liveComposerState = await evaluateOnCdpPage/,
  "the final NV1/NV2 gate must re-read the live focused composer",
);
assert.match(
  sendSource,
  /pageState\.composerText = composerText/,
  "the live composer text must replace stale snapshot text before ownership verification",
);
assert.match(
  sendSource,
  /ChatGPT payload gate timed out before Send/,
  "payload gate failures must be visible in the exported pipeline log",
);
assert.match(
  sendSource,
  /setChatGptSendState\(context\.sceneId \|\| "unknown", "FAILED"\)/,
  "a failed gate must release PREPARING before recovery",
);

const nv2Begin = sendSource.indexOf("[MILESTONE] PROMPT_INSERT_BEGIN", sendSource.indexOf("sendNv2PromptViaDeepCdpInput"));
const nv2Finished = sendSource.indexOf("[MILESTONE] PROMPT_INSERT_FINISHED", nv2Begin);
const nv2Click = sendSource.indexOf("[MILESTONE] SEND_CLICK_BEGIN", nv2Finished);
assert(nv2Begin > 0 && nv2Finished > nv2Begin && nv2Click > nv2Finished);
assert.match(
  sendSource,
  /composerPromptAlreadyExact\(existingDraftState\?\.composerText, prompt\)/,
  "NV2 send must preserve an already exact live draft",
);
assert.match(
  sendSource,
  /skipped clear\/reinsert/,
  "the no-rewrite path must be visible in diagnostics",
);

assert.match(domSource, /composerText: text/);
assert.match(domSource, /seenComposerNodes = new Set\(\)/);
assert.match(domSource, /node === activeElement.*score \+= 10000/);

assert.match(recoverySource, /policy\.allowFailedDraftRefresh && sendState === "FAILED"/);
assert.match(
  pipelineSource,
  /"nv2-send-recovery",\s*\{ allowFailedDraftRefresh: true \}/,
  "NV2 failed-draft recovery must be allowed to refresh the same chat",
);
assert.match(
  pipelineSource,
  /`\$\{options\.stage \|\| "prompt"\}-send-recovery`,\s*\{ allowFailedDraftRefresh: true \}/,
  "the shared NV1 send recovery must also release a failed draft",
);

console.log("ChatGPT live composer payload gate + failed-send recovery tests passed");
