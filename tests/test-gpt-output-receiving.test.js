"use strict";

const assert = require("assert");
const { createHarness } = require("./helpers/manual-workflow-fixture");

(async () => {
  const harness = await createHarness({ ids: [1] });
  try {
    // Each capture is tied to an armed user turn; the fixture supplies only the
    // observation data that a user-created ChatGPT turn would expose.
    await harness.hydrate();
    const keyframe = await harness.complete("NV1");
    assert(keyframe.observation.observedOutputs.some((output) => output.kind === "image"), "observation must report the scanned GPT image");
    assert(keyframe.observation.savedOutputs.some((output) => output.fileName === "scene_001_keyframe.png"), "observation must report the saved keyframe filename");
    const completed = await harness.complete("NV2");

    assert.strictEqual(completed.autoVeoUp.ok, true);
    assert.strictEqual(harness.automationCalls.length, 1);
    assert.strictEqual(harness.submitCalls[0].allowPartial, false);
    assert.strictEqual(harness.submitCalls[0].trigger, "manual-auto-complete");

    const view = await harness.api.getManualViewModel({ projectPath: harness.root });
    assert.strictEqual(view.state, "VEOUP_COMPLETE");
    assert.strictEqual(view.audit.complete, true);
    console.log("Manual GPT output capture and automatic strict VeoUp test passed");
  } finally {
    await harness.cleanup();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
