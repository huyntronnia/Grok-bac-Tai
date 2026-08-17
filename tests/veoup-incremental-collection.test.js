"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const {
  collectionPaths,
  inspectKeyframeFile,
  stageSceneForVeoUp,
  invalidateSceneVeoUpCollection,
  reconcileVeoUpCollection,
  prepareVeoUpBatchSelectionFolder,
} = require("../electron/main/veoup/collection_store");

const VALID_PNG = Buffer.concat([
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
  Buffer.alloc(5000),
]);

const motionPrompt = (label) =>
  `${label}: slow camera tracking with controlled parallax, natural subject movement, stable framing, consistent lighting, and a clean final settle.`;

async function createScene(root, sceneId, prompt = motionPrompt(`motion ${sceneId}`)) {
  const token = `scene_${String(sceneId).padStart(3, "0")}`;
  const sceneDir = path.join(root, token);
  const keyframePath = path.join(sceneDir, `${token}_keyframe.png`);
  const motionPromptPath = path.join(sceneDir, "motion_prompt.txt");
  await fs.mkdir(sceneDir, { recursive: true });
  await fs.writeFile(keyframePath, VALID_PNG);
  await fs.writeFile(motionPromptPath, prompt, "utf8");
  return { sceneId, sceneDir, keyframePath, motionPromptPath, prompt };
}

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-veoup-collection-"));
  const first = await createScene(root, 1, motionPrompt("motion one with detail"));
  const second = await createScene(root, 2, motionPrompt("motion two"));

  const inspection = await inspectKeyframeFile(first.keyframePath, { includeHash: true });
  assert.strictEqual(inspection.ok, true);
  assert.strictEqual(inspection.format, "png");
  assert.match(inspection.hash, /^[a-f0-9]{64}$/);

  await Promise.all([
    stageSceneForVeoUp({ projectDir: root, sceneId: 2, keyframePath: second.keyframePath, motionPromptPath: second.motionPromptPath }),
    stageSceneForVeoUp({ projectDir: root, sceneId: 1, keyframePath: first.keyframePath, motionPromptPath: first.motionPromptPath }),
  ]);

  const paths = collectionPaths(root);
  assert.strictEqual(await fs.readFile(paths.promptsReadyPath, "utf8"), `${first.prompt}\n${second.prompt}`);
  const state = JSON.parse(await fs.readFile(paths.stateFile, "utf8"));
  assert.strictEqual(state[1].readyForVeoUp, true);
  assert.strictEqual(state[2].readyForVeoUp, true);
  assert.match(state[1].veoUpKeyframeHash, /^[a-f0-9]{64}$/);

  const revisedFirstPrompt = motionPrompt("motion one revised");
  await fs.writeFile(first.motionPromptPath, revisedFirstPrompt, "utf8");
  await stageSceneForVeoUp({
    projectDir: root,
    sceneId: 1,
    keyframePath: first.keyframePath,
    motionPromptPath: first.motionPromptPath,
  });
  assert.strictEqual(await fs.readFile(paths.promptsReadyPath, "utf8"), `${revisedFirstPrompt}\n${second.prompt}`);

  await invalidateSceneVeoUpCollection({ projectDir: root, sceneId: 1, reason: "test-regeneration" });
  assert.strictEqual(await fs.readFile(paths.promptsReadyPath, "utf8"), second.prompt);

  const reconciled = await reconcileVeoUpCollection({ projectDir: root, expectedSceneIds: [1, 2] });
  assert.strictEqual(reconciled.entries.length, 2);
  assert.deepStrictEqual(reconciled.missing, []);
  assert(reconciled.repairedSceneIds.includes(1));
  assert.strictEqual(await fs.readFile(paths.promptsReadyPath, "utf8"), `${revisedFirstPrompt}\n${second.prompt}`);

  await fs.mkdir(paths.batchSelectionDir, { recursive: true });
  await fs.writeFile(path.join(paths.batchSelectionDir, "stale.png"), VALID_PNG);
  const selection = await prepareVeoUpBatchSelectionFolder(root, reconciled.entries);
  assert.strictEqual(selection.keyframes.length, 2);
  assert.deepStrictEqual((await fs.readdir(paths.batchSelectionDir)).sort(), [
    "scene_001_keyframe.png",
    "scene_002_keyframe.png",
  ]);

  const bulkSelection = await prepareVeoUpBatchSelectionFolder(
    root,
    Array.from({ length: 75 }, (_, index) => ({
      sceneId: index + 1,
      keyframePath: collectionPaths(root, 1).keyframePath,
    })),
  );
  assert.strictEqual(bulkSelection.keyframes.length, 75);
  const bulkFiles = await fs.readdir(paths.batchSelectionDir);
  assert.strictEqual(bulkFiles.length, 75);
  assert(bulkFiles.includes("scene_001_keyframe.png"));
  assert(bulkFiles.includes("scene_075_keyframe.png"));

  const broken = await createScene(root, 3, motionPrompt("motion three"));
  await fs.writeFile(broken.keyframePath, Buffer.from([1, 2, 3]));
  await assert.rejects(
    stageSceneForVeoUp({ projectDir: root, sceneId: 3, keyframePath: broken.keyframePath, motionPromptPath: broken.motionPromptPath }),
    /invalid keyframe/i,
  );

  const concurrentScenes = [];
  for (let sceneId = 4; sceneId <= 30; sceneId += 1) {
    concurrentScenes.push(await createScene(root, sceneId));
  }
  await Promise.all(concurrentScenes.map((scene) => stageSceneForVeoUp({
    projectDir: root,
    sceneId: scene.sceneId,
    keyframePath: scene.keyframePath,
    motionPromptPath: scene.motionPromptPath,
  })));
  const concurrentState = JSON.parse(await fs.readFile(paths.stateFile, "utf8"));
  for (let sceneId = 1; sceneId <= 30; sceneId += 1) {
    if (sceneId === 3) continue;
    assert.strictEqual(concurrentState[sceneId].readyForVeoUp, true, `scene ${sceneId} state was lost`);
  }

  await reconcileVeoUpCollection({ projectDir: root, expectedSceneIds: [1, 2] });
  const narrowedState = JSON.parse(await fs.readFile(paths.stateFile, "utf8"));
  assert.strictEqual(narrowedState[4].readyForVeoUp, false, "stale project scene must not remain batch-ready");
  assert.strictEqual(await fs.readFile(paths.promptsReadyPath, "utf8"), `${revisedFirstPrompt}\n${second.prompt}`);

  await fs.rm(root, { recursive: true, force: true });
  console.log("VeoUp incremental collection tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
