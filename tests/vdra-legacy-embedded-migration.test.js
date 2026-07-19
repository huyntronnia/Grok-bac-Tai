"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const {
  hasLegacyEmbeddedAssets,
  removeEmbeddedAssets,
  prepareProjectPayloadForSave,
} = require("../electron/main/project/project_manifest");

const legacy = {
  schemaVersion: 1,
  project: { scenes: [{ id: 1, imagePath: "legacy.png", videoPath: "legacy.mp4" }] },
  inputs: {},
  config: {},
  runtime: {},
  assets: {},
  previewTimeline: [],
  embeddedAssets: {
    version: 1,
    encoding: "base64",
    scenes: [{ sceneId: 1, files: { image: { fileName: "legacy.png", data: "aGVsbG8=" } } }],
  },
};

assert.strictEqual(hasLegacyEmbeddedAssets(legacy), true);
removeEmbeddedAssets(legacy);
assert.strictEqual(hasLegacyEmbeddedAssets(legacy), false);
const migrated = prepareProjectPayloadForSave(legacy, process.cwd());
assert.strictEqual(Object.hasOwn(migrated, "embeddedAssets"), false);
assert.strictEqual(migrated.assets.embedded, false);

const mainSource = fs.readFileSync(path.join(__dirname, "../electron/main.js"), "utf8");
const loadStart = mainSource.indexOf("async function loadProjectSessionFile");
const loadEnd = mainSource.indexOf("async function openProjectSessionFile", loadStart);
const loadBlock = mainSource.slice(loadStart, loadEnd);
assert(loadBlock.includes("restoreEmbeddedProjectAssets(parsed, projectFolder)"));
assert(loadBlock.includes("removeEmbeddedAssets(parsed)"));
assert(
  loadBlock.indexOf("restoreEmbeddedProjectAssets(parsed, projectFolder)") <
    loadBlock.indexOf("removeEmbeddedAssets(parsed)"),
  "legacy assets must be restored before embedded data is dropped",
);
assert(loadBlock.includes("hydrateProjectPayloadPaths(parsed, projectFolder)"));

console.log(".vdra legacy embedded migration tests passed");
