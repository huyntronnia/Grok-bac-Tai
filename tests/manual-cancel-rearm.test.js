"use strict";

const assert = require("assert");
const crypto = require("crypto");
const { createHarness, validPng, MOTION } = require("./helpers/manual-workflow-fixture");

(async () => {
  const harness = await createHarness({ ids: [1], useCoordinator: false });
  try {
    const first = await harness.arm("NV1");
    const oldUser = { id: crypto.randomUUID(), role: "user", text: first.bundle.clipboardText };
    harness.browser.messages.push(oldUser);
    harness.browser.generating = true;

    const cancelled = await harness.api.cancelManualStage({ projectPath: harness.root });
    assert(cancelled.ok);
    assert.equal(cancelled.viewModel.state, "CANCELLED");
    assert.equal(cancelled.viewModel.rearmRequired, true);

    const resumed = await harness.api.resumeManualWorkflow({ projectPath: harness.root });
    assert.equal(resumed.viewModel.activeAttempt, null);
    assert.equal(resumed.viewModel.rearmRequired, true);
    assert.equal(resumed.viewModel.preparedBundle.stage, "NV1");
    harness.runtime.watchIntervalMs = 10;
    await harness.restart();
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal((await harness.controller.getViewModel({ projectPath: harness.root })).activeAttempt, null,
      "the watcher must not auto-arm a cancelled stage after reconnect");
    harness.runtime.watchIntervalMs = 0;
    await harness.restart();
    const adopted = await harness.api.captureManualStage({ projectPath: harness.root, adoptPrepared: true });
    assert.equal(adopted.code, "REARM_REQUIRED");
    const stillGenerating = await harness.api.armManualStage({ projectPath: harness.root });
    assert.equal(stillGenerating.code, "STILL_GENERATING");

    harness.browser.generating = false;
    harness.browser.messages.push({ id: crypto.randomUUID(), role: "assistant", text: "old image", imageBuffer: validPng(), settled: true });
    const rearmed = await harness.api.armManualStage({ projectPath: harness.root });
    assert(rearmed.ok, JSON.stringify(rearmed));
    assert.equal(rearmed.attempt.requireFreshUserTurn, true);
    const stale = await harness.capture(rearmed.attempt);
    assert.equal(stale.ok, false);
    assert.equal(stale.error, "manual-new-user-turn-required-after-cancel");

    harness.respond(rearmed.attempt);
    const fresh = await harness.capture(rearmed.attempt);
    assert(fresh.ok, JSON.stringify(fresh));
    assert.equal(fresh.attempt.status, "CAPTURED");

    const nv2 = await harness.arm("NV2");
    harness.browser.messages.push({ id: crypto.randomUUID(), role: "user", text: nv2.bundle.clipboardText });
    harness.browser.generating = true;
    await harness.api.cancelManualStage({ projectPath: harness.root });
    await harness.api.resumeManualWorkflow({ projectPath: harness.root });
    harness.browser.generating = false;
    harness.browser.messages.push({ id: crypto.randomUUID(), role: "assistant", text: MOTION, settled: true });
    const nv2Rearmed = await harness.api.armManualStage({ projectPath: harness.root });
    assert(nv2Rearmed.ok, JSON.stringify(nv2Rearmed));
    const oldMotion = await harness.capture(nv2Rearmed.attempt);
    assert.equal(oldMotion.error, "manual-new-user-turn-required-after-cancel");
    harness.respond(nv2Rearmed.attempt, `${MOTION} The camera settles on a new final frame.`);
    const newMotion = await harness.capture(nv2Rearmed.attempt);
    assert(newMotion.ok, JSON.stringify(newMotion));
    assert.equal(newMotion.attempt.status, "CAPTURED");
    console.log("Manual cancel requires a fresh user turn before capture");
  } finally {
    await harness.cleanup();
  }
})().catch((error) => { console.error(error?.stack || error); process.exitCode = 1; });
