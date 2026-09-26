"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "electron/main.js"), "utf8");
const pipeline = fs.readFileSync(
  path.join(root, "electron/main/chatgpt/chatgpt_pipeline.js"),
  "utf8",
);

assert(main.includes("function resolveProjectPrepromptFolder("));
assert(main.includes("return path.join(projectRoot, 'preprompt');"));
assert(main.includes("async function collectPrepromptRequestFiles("));
assert(main.includes(".sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))"));
assert(pipeline.includes("collectPrepromptRequestFiles({ outputFolder: projectDir })"));
assert.strictEqual(require("../electron/main/chatgpt/manual_stage_bundle").REQUEST_1_PROMPT, "Request 1: read and remember all attached preprompt files. Reply only when ready.");

for (const file of [
  "electron/main.js",
  "electron/renderer.js",
  "electron/preload.js",
  "electron/index.html",
  "electron/main/chatgpt/chatgpt_pipeline.js",
]) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  assert(!/character/i.test(source), `${file} still contains removed legacy naming`);
}

console.log("preprompt file tests passed");
