"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { createManualProjectAuditor } = require("../electron/main/chatgpt/manual_project_audit");
const { validPng, MOTION } = require("./helpers/manual-workflow-fixture");

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-audit-cache-"));
  const ids = Array.from({ length: 80 }, (_, index) => index + 1);
  const image = validPng();
  try {
    for (const id of ids) {
      const token = `scene_${String(id).padStart(3, "0")}`;
      const dir = path.join(root, token);
      await fs.mkdir(dir);
      await fs.writeFile(path.join(dir, `${token}_keyframe.png`), image);
      await fs.writeFile(path.join(dir, "motion_prompt.txt"), MOTION);
    }
    const audit = createManualProjectAuditor();
    const originalReadFile = fs.readFile;
    let reads = 0;
    fs.readFile = async (...args) => { reads += 1; return originalReadFile(...args); };
    try {
      assert.equal((await audit(root, ids)).readyCount, 80);
      const coldReads = reads;
      reads = 0;
      assert.equal((await audit(root, ids)).readyCount, 80);
      assert.equal(reads, 0, "unchanged assets should be checked by metadata without decoding again");
      assert(coldReads >= 80);
      await fs.rm(path.join(root, "scene_080", "motion_prompt.txt"));
      assert.equal((await audit(root, ids)).readyCount, 79, "a removed asset must invalidate cached readiness");
      reads = 0;
      assert.equal((await audit(root, ids, { forceFull: true })).readyCount, 79);
      assert(reads >= 80, "the batch gate must re-read every existing source");
    } finally {
      fs.readFile = originalReadFile;
    }
    console.log("Manual audit caches unchanged assets and fully rechecks the batch gate");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
