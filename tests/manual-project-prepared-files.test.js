"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { ensureManualProjectRequestFiles } = require("../electron/main/chatgpt/manual_stage_bundle");
const { createManualChatGptController } = require("../electron/main/chatgpt/manual_chatgpt_controller");

(async () => {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-manual-prepared-files-"));
  const scenes = Array.from({ length: 80 }, (_, index) => ({
    id: index + 1,
    original: `Scene ${index + 1}: a distinct shot`,
  }));
  const ensure = () => ensureManualProjectRequestFiles({
    projectPath, scenes, nv1: "Create one keyframe image", nv2: "Write one motion prompt",
  });
  try {
    const created = await ensure();
    assert.equal(created.sceneCount, 80);
    for (const id of [1, 40, 80]) {
      const token = `scene_${String(id).padStart(3, "0")}`;
      const sceneDir = path.join(projectPath, token);
      assert.match(await fs.readFile(path.join(sceneDir, "scene.txt"), "utf8"), new RegExp(`Scene ${id}:`));
      assert.match(await fs.readFile(path.join(sceneDir, `${token}_nv1_request.txt`), "utf8"), /Create one keyframe image/);
      assert.match(await fs.readFile(path.join(sceneDir, `${token}_nv2_request.txt`), "utf8"), /Write one motion prompt/);
      assert.equal(await fs.stat(path.join(sceneDir, "motion_prompt.txt")).then(() => true, () => false), false);
    }
    const customPath = path.join(projectPath, "scene_040", "scene_040_nv1_request.txt");
    await fs.writeFile(customPath, "User edited NV1 request", "utf8");
    await ensure();
    assert.equal(await fs.readFile(customPath, "utf8"), "User edited NV1 request",
      "reopening manual mode must preserve an edited request file");

    const controller = createManualChatGptController({ ensureProjectFiles: ensure });
    try {
      const initialized = await controller.initialize({ projectPath, expectedSceneIds: scenes.map((scene) => scene.id), scenes });
      assert.equal(initialized.ok, true);
      assert.equal(initialized.audit.expectedCount, 80);
      assert.equal((await fs.readdir(projectPath)).filter((name) => /^scene_\d+$/.test(name)).length, 80);
    } finally { controller.dispose(); }
    console.log("Manual project creates and preserves all 80 scene request files");
  } finally {
    await fs.rm(projectPath, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
