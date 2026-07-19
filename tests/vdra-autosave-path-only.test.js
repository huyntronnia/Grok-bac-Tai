"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  PROJECT_ASSET_STORAGE_MODE,
  prepareProjectPayloadForSave,
  hydrateProjectPayloadPaths,
  containsInlineAssetData,
} = require("../electron/main/project/project_manifest");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "vidora-vdra-manifest-"));
const scenes = Array.from({ length: 300 }, (_, index) => {
  const sceneId = index + 1;
  const token = `scene_${String(sceneId).padStart(3, "0")}`;
  return {
    id: sceneId,
    sceneId,
    original: `Scene ${sceneId}`,
    imagePath: path.join(root, token, `${token}_keyframe.png`),
    videoPath: path.join(root, token, `${token}_video.mp4`),
    motionPromptPath: path.join(root, token, "motion_prompt.txt"),
    imageDataUrl: "data:image/png;base64,SHOULD_NOT_SURVIVE",
  };
});

const payload = {
  schemaVersion: 1,
  project: { name: "scale-300", scenes },
  inputs: {},
  config: {},
  runtime: {
    outputFolder: root,
    transientPreview: "data:video/mp4;base64,INLINE_VIDEO_MUST_NOT_SURVIVE",
  },
  assets: {
    images: scenes.map((scene) => ({ sceneId: scene.id, path: scene.imagePath })),
    transientThumbnail: "data:image/png;base64,INLINE_IMAGE_MUST_NOT_SURVIVE",
  },
  previewTimeline: [],
  embeddedAssets: {
    version: 1,
    encoding: "base64",
    scenes: [{ sceneId: 1, files: { video: { data: "AAAA".repeat(1000) } } }],
  },
};

const prepared = prepareProjectPayloadForSave(payload, root);
assert.strictEqual(prepared.assets.storageMode, PROJECT_ASSET_STORAGE_MODE);
assert.strictEqual(prepared.assets.embedded, false);
assert.strictEqual(Object.hasOwn(prepared, "embeddedAssets"), false);
assert.strictEqual(containsInlineAssetData(prepared), false);
assert.strictEqual(Object.hasOwn(prepared.project.scenes[0], "imageDataUrl"), false);
assert.strictEqual(path.isAbsolute(prepared.project.scenes[0].imagePath), false);
assert(prepared.project.scenes[0].imagePath.startsWith("scene_001/"));

const serialized = JSON.stringify(prepared);
assert(serialized.length < 500_000, `300-scene metadata unexpectedly large: ${serialized.length}`);
assert(!serialized.includes("SHOULD_NOT_SURVIVE"));
assert(!serialized.includes("INLINE_VIDEO_MUST_NOT_SURVIVE"));
assert(!serialized.includes("INLINE_IMAGE_MUST_NOT_SURVIVE"));
assert(!serialized.includes("AAAA"));

hydrateProjectPayloadPaths(prepared, root);
assert.strictEqual(prepared.project.scenes[0].imagePath, scenes[0].imagePath);
assert.strictEqual(prepared.project.scenes[299].videoPath, scenes[299].videoPath);

const mainSource = fs.readFileSync(path.join(__dirname, "../electron/main.js"), "utf8");
const saveStart = mainSource.indexOf("async function saveProjectSessionFile");
const saveEnd = mainSource.indexOf("async function rememberLastProjectFile", saveStart);
const saveBlock = mainSource.slice(saveStart, saveEnd);
assert(!saveBlock.includes("embedProjectAssets"), "save path must not embed project assets");
assert(!saveBlock.includes("payload: finalPayload"), "save receipt must not return the full payload");
assert(!saveBlock.includes("payload: validPayload"), "create receipt must not return the full payload");
assert(saveBlock.includes("prepareProjectPayloadForSave"), "save path must build a path-only manifest");
assert(saveBlock.includes("writeJsonFileAtomic"), "save path must use atomic JSON writes");

fs.rmSync(root, { recursive: true, force: true });
console.log(".vdra path-only autosave tests passed");
