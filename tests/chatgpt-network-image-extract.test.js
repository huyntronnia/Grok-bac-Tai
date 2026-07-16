"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "electron/main/chatgpt/chatgpt_pipeline.js"),
  "utf8",
);

assert(source.includes('reason: "network-image-not-final-enough"'));
assert(/decoded\.width < 512[\s\S]*?decoded\.height < 512[\s\S]*?buffer\.length < 120000/.test(source));
assert(/method === "network" \|\| sourceKind\.includes\("network"\)/.test(source));
assert(/width >= 512[\s\S]*?height >= 512[\s\S]*?byteLength >= 120000/.test(source));
assert(source.includes("minImageAgentTurnIndex"), "image extraction must remain scoped to the active image .agent-turn");
assert(!source.includes('mode: "document-media-fallback"'), "unscoped document fallback must stay disabled");

console.log("chatgpt network image extraction tests passed");
