"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const {
  buildVeoUpBatchManifest,
  createVeoUpBatchFingerprint,
  manifestToAutomationScenes,
} = require("../electron/main/veoup/batch_manifest");

const VALID_PNG = Buffer.concat([
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
  Buffer.alloc(5000),
]);

const motionPrompt = (sceneId, suffix = "") =>
  `Scene ${sceneId}: slow camera tracking with controlled parallax, natural subject movement, stable framing, consistent lighting, and a clean final settle. ${suffix}`.trim();

async function createScene(root, sceneId, prompt = motionPrompt(sceneId)) {
  const token = `scene_${String(sceneId).padStart(3, "0")}`;
  const sceneDir = path.join(root, token);
  await fs.mkdir(sceneDir, { recursive: true });
  await fs.writeFile(path.join(sceneDir, `${token}_keyframe.png`), VALID_PNG);
  await fs.writeFile(path.join(sceneDir, "motion_prompt.txt"), prompt, "utf8");
}

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-veoup-manifest-"));
  for (let sceneId = 1; sceneId <= 3; sceneId += 1) await createScene(root, sceneId);

  const manifest = await buildVeoUpBatchManifest({ projectDir: root, expectedSceneCount: 3 });
  assert.strictEqual(manifest.ok, true);
  assert.strictEqual(manifest.expectedSceneCount, 3);
  assert.deepStrictEqual(manifest.entries.map((entry) => entry.sceneId), [1, 2, 3]);
  assert.strictEqual(manifestToAutomationScenes(manifest).length, 3);
  const fingerprint = createVeoUpBatchFingerprint(manifest, { autoStartVideoGeneration: true });
  assert.match(fingerprint, /^sha256:[a-f0-9]{64}$/);

  await fs.rm(path.join(root, "scene_002", "motion_prompt.txt"));
  await fs.rm(path.join(root, "motion_prompts", "scene_002_motion_prompt.txt"));
  const missing = await buildVeoUpBatchManifest({ projectDir: root, expectedSceneCount: 3 });
  assert.strictEqual(missing.ok, false);
  assert.deepStrictEqual(missing.missing, [{ sceneId: 2, missingKeyframe: false, missingMotionPrompt: true }]);

  const partial = await buildVeoUpBatchManifest({
    projectDir: root,
    expectedSceneCount: 3,
    allowPartial: true,
  });
  assert.strictEqual(partial.ok, true);
  assert.strictEqual(partial.partial, true);
  assert.deepStrictEqual(partial.skippedSceneIds, [2]);
  assert.deepStrictEqual(partial.entries.map((entry) => entry.sceneId), [1, 3]);

  await fs.writeFile(path.join(root, "scene_002", "motion_prompt.txt"), motionPrompt(2, "restored"), "utf8");
  const duplicate = await buildVeoUpBatchManifest({
    projectDir: root,
    expectedSceneIds: [1, 2, 3],
    scenes: [{ id: 1 }, { id: 1 }, { id: 2 }, { id: 3 }],
  });
  assert.strictEqual(duplicate.ok, false);
  assert.deepStrictEqual(duplicate.duplicates, [1]);

  for (let sceneId = 4; sceneId <= 300; sceneId += 1) await createScene(root, sceneId);
  const scaleManifest = await buildVeoUpBatchManifest({ projectDir: root, expectedSceneCount: 300 });
  assert.strictEqual(scaleManifest.ok, true);
  assert.strictEqual(scaleManifest.entries.length, 300);
  assert.strictEqual(scaleManifest.entries[299].sceneId, 300);

  await fs.rm(root, { recursive: true, force: true });
  console.log("VeoUp strict batch manifest tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
