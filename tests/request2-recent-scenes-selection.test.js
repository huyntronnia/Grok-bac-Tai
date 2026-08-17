"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const fsSync = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const mainSource = fsSync.readFileSync(path.join(root, "electron/main.js"), "utf8");
const start = mainSource.indexOf("async function collectRecentProjectKeyframes(");
const end = mainSource.indexOf("\nfunction captureChatGptDiagnosticSnapshotScript", start);
assert(start >= 0 && end > start, "collectRecentProjectKeyframes source missing");

const sandbox = { fs, path };
vm.createContext(sandbox);
vm.runInContext(
  `${mainSource.slice(start, end)}\nthis.collectRecentProjectKeyframes = collectRecentProjectKeyframes;`,
  sandbox,
);

async function addKeyframe(projectDir, sceneId) {
  const token = `scene_${String(sceneId).padStart(3, "0")}`;
  const sceneDir = path.join(projectDir, token);
  await fs.mkdir(sceneDir, { recursive: true });
  await fs.writeFile(path.join(sceneDir, `${token}_keyframe.png`), `png-${sceneId}`);
}

function sceneIds(paths) {
  return Array.from(
    paths,
    (filePath) => Number(path.basename(filePath).match(/scene_(\d+)/i)[1]),
  );
}

(async () => {
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-request2-scenes-"));
  try {
    for (let sceneId = 1; sceneId <= 20; sceneId += 1) {
      await addKeyframe(projectDir, sceneId);
    }

    assert.deepStrictEqual(
      sceneIds(await sandbox.collectRecentProjectKeyframes(projectDir, 10, 18)),
      [17, 16, 15, 14, 13, 12, 11, 10, 9, 8],
      "Scene 18 must use the ten immediately preceding scenes",
    );
    assert.deepStrictEqual(
      sceneIds(await sandbox.collectRecentProjectKeyframes(projectDir, 10, 6)),
      [5, 4, 3, 2, 1],
      "Scene 6 must only use preceding scenes that exist",
    );
    assert.deepStrictEqual(
      sceneIds(await sandbox.collectRecentProjectKeyframes(projectDir, 10, 1)),
      [],
      "Scene 1 must not use its current or future keyframes",
    );

    const sparseDir = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-request2-sparse-"));
    try {
      for (const sceneId of [3, 9, 12, 15, 17, 18, 20]) {
        await addKeyframe(sparseDir, sceneId);
      }
      assert.deepStrictEqual(
        sceneIds(await sandbox.collectRecentProjectKeyframes(sparseDir, 10, 18)),
        [17, 15, 12, 9, 3],
        "Sparse projects must remain ordered by descending scene ID",
      );
    } finally {
      await fs.rm(sparseDir, { recursive: true, force: true });
    }
  } finally {
    await fs.rm(projectDir, { recursive: true, force: true });
  }

  console.log("Request 2 recent-scene selection tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
