"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const rendererSource = fs.readFileSync(
  path.join(root, "electron/renderer.js"),
  "utf8",
);

(async () => {
  // 1. Verify 5-minute TTL check was removed from sceneHasRequiredOutputForCurrentMode
  assert(
    !rendererSource.includes("Date.now() - checkedAt <= SCENE_ASSET_AUDIT_TTL_MS"),
    "renderer.js must not expire asset stat checks using SCENE_ASSET_AUDIT_TTL_MS",
  );
  assert(
    !rendererSource.includes("Date.now() - checkedAt <= SCENE_OUTPUT_STAT_TTL_MS"),
    "renderer.js must not expire output stat checks using SCENE_OUTPUT_STAT_TTL_MS",
  );

  // 2. Verify forceResumeFirstIncompleteSceneIfNeeded checks currentIds.includes(id) and uses getNextBatchForSegment(id)
  assert(
    rendererSource.includes("currentIds.includes(id)"),
    "forceResumeFirstIncompleteSceneIfNeeded must check if activeBatchIds already includes id",
  );
  assert(
    rendererSource.includes("const nextBatch = getNextBatchForSegment(id);"),
    "forceResumeFirstIncompleteSceneIfNeeded must compute nextBatch using getNextBatchForSegment(id)",
  );

  console.log("Renderer output audit TTL & batch resumption tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
