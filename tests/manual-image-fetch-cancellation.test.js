"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const path = require("path");
const { createHarness } = require("./helpers/manual-workflow-fixture");
const { withManualDeadline } = require("../electron/main/chatgpt/manual_operation_deadline");

async function promptly(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), 500)),
  ]);
}

(async () => {
  await assert.rejects(
    withManualDeadline(() => new Promise(() => {}), { timeoutMs: 20, label: "stalled-image" }),
    (error) => error.code === "MANUAL_OPERATION_TIMEOUT",
  );
  const h = await createHarness({ ids: [1] });
  try {
    const attempt = await h.arm("NV1", 1);
    const assistant = h.respond(attempt);
    delete assistant.imageBuffer;
    assistant.images = [{ src: "https://example.invalid/image.png", width: 512, height: 512 }];
    let extracting;
    const started = new Promise((resolve) => { extracting = resolve; });
    h.runtime.extractOwnedImage = () => {
      extracting();
      return new Promise(() => {});
    };
    const capture = h.capture(attempt);
    await promptly(started, "image extraction start");
    const cancellation = await promptly(h.api.cancelManualStage({ projectPath: h.root }), "manual cancellation");
    assert.equal(cancellation.ok, true);
    const result = await promptly(capture, "aborted capture");
    assert.equal(result.code, "ATTEMPT_CANCELLED");
    assert.equal(await fs.stat(path.join(h.root, "scene_001", "scene_001_keyframe.png")).then(() => true, () => false), false);
    console.log("Manual cancellation releases a stalled image extraction without saving it");
  } finally {
    await h.cleanup();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
