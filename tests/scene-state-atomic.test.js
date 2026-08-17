"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const {
  readActionJournal,
  readSceneSnapshot,
  writeActionJournal,
  writeSceneSnapshot,
} = require("../electron/main/state");

(async () => {
  const sceneDir = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-scene-state-"));
  try {
    await Promise.all(
      Array.from({ length: 20 }, (_value, index) =>
        writeSceneSnapshot(sceneDir, {
          sequence: index + 1,
          payloadFingerprint: `fingerprint-${index + 1}`,
        }),
      ),
    );
    const snapshot = await readSceneSnapshot(sceneDir);
    assert.strictEqual(snapshot.sequence, 20);
    assert.strictEqual(snapshot.payloadFingerprint, "fingerprint-20");
    assert.ok(snapshot.updatedAt);

    await Promise.all(
      Array.from({ length: 20 }, (_value, index) =>
        writeActionJournal(sceneDir, { type: "checkpoint", sequence: index + 1 }),
      ),
    );
    const journal = await readActionJournal(sceneDir);
    assert.strictEqual(journal.length, 20);
    assert.deepStrictEqual(
      journal.map((entry) => entry.action.sequence),
      Array.from({ length: 20 }, (_value, index) => index + 1),
    );

    JSON.parse(await fs.readFile(path.join(sceneDir, "scene_snapshot.json"), "utf8"));
    JSON.parse(await fs.readFile(path.join(sceneDir, "action_journal.json"), "utf8"));
  } finally {
    await fs.rm(sceneDir, { recursive: true, force: true });
  }

  console.log("atomic scene snapshot and action journal tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
