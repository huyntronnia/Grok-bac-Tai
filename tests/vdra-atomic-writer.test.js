"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const {
  writeJsonFileAtomic,
  enqueueProjectWrite,
  getProjectWriteQueueSize,
} = require("../electron/main/project/project_store");

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-vdra-writer-"));
  const target = path.join(root, "project.vdra");
  await writeJsonFileAtomic(target, { revision: -1 });

  let active = 0;
  let maxActive = 0;
  const writes = Array.from({ length: 20 }, (_, revision) =>
    enqueueProjectWrite(target, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, revision % 3));
      await writeJsonFileAtomic(target, { revision });
      active -= 1;
    }),
  );
  await Promise.all(writes);
  assert.strictEqual(maxActive, 1, "project writes must be serialized per target path");
  assert.strictEqual(getProjectWriteQueueSize(), 0, "writer queue must clean up after completion");
  assert.deepStrictEqual(JSON.parse(await fs.readFile(target, "utf8")), { revision: 19 });

  await assert.rejects(
    enqueueProjectWrite(target, async () => {
      throw new Error("simulated-before-write-failure");
    }),
    /simulated-before-write-failure/,
  );
  assert.deepStrictEqual(
    JSON.parse(await fs.readFile(target, "utf8")),
    { revision: 19 },
    "failed replacement must preserve the previous valid project",
  );

  const leftovers = (await fs.readdir(root)).filter((name) => name.includes(".tmp-") || name.includes(".backup-"));
  assert.deepStrictEqual(leftovers, [], "atomic writer must clean temporary files");
  await fs.rm(root, { recursive: true, force: true });
  console.log(".vdra atomic writer tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
