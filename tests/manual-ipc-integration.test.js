"use strict";
const assert = require("assert");
const fs = require("fs/promises");
const path = require("path");
const { createHarness, validPng, MOTION } = require("./helpers/manual-workflow-fixture");

(async () => {
  const h = await createHarness();
  try {
    assert.equal((await h.api.getWorkflowMode()).workflowMode, "manual_keyframe_motion");
    assert.equal((await h.api.setWorkflowMode("automatic")).ok, false);
    // Every stage survives a restart while waiting and after successful capture.
    for (const [stage, sceneId] of [["NV1",1],["NV2",1],["NV1",2],["NV2",2]]) {
      const ready = await h.prepare(stage, sceneId);
      const resumed = await h.restart();
      assert.equal(resumed.preparedBundle.payloadFingerprint, ready.bundle.payloadFingerprint);
      const armed = await h.api.armManualStage({ projectPath: h.root });
      const attempt = armed.attempt;
      await h.api.copyManualText(attempt.bundle.clipboardText);
      await h.api.copyManualText(attempt.bundle.clipboardText);
      assert.equal((await h.api.armManualStage({ projectPath: h.root })).attempt.attemptId, attempt.attemptId);
      const viewed = await h.api.selectManualScene({ projectPath: h.root, sceneId: sceneId === 1 ? 2 : 1 });
      assert.equal(viewed.activeAttempt.attemptId, attempt.attemptId);
      assert.equal((await h.restart()).activeAttempt.attemptId, attempt.attemptId);
      assert.equal((await h.capture(attempt, { options: { force: true } })).code, "NORMAL_CAPTURE_BYPASS_FORBIDDEN");
      assert.equal((await h.capture(attempt)).code, "UNPROVEN");
      const owned = h.respond(attempt);
      h.browser.generating = true;
      assert.equal((await h.capture(attempt)).code, "STILL_GENERATING");
      h.browser.generating = false;
      const result = await h.capture(attempt);
      assert(result.ok, JSON.stringify(result));
      assert.equal(result.attempt.capturedAssistantTurnId, owned.id);
      const restored = await h.restart();
      assert.equal(restored.activeAttempt, null);
      assert.equal((await h.capture(attempt)).code, "NO_ACTIVE_ATTEMPT");
    }
    let view = await h.api.getManualViewModel({ projectPath: h.root });
    assert.equal(view.audit.readyCount, 2);
    const submitted = await h.api.submitManualVeoUp({ projectPath: h.root, expectedSceneIds: [1], allowPartial: true });
    assert(submitted.ok, JSON.stringify(submitted));
    assert.equal(h.automationCalls.length, 1);
    assert.equal(h.submitCalls[0].allowPartial, false);
    assert.deepEqual(h.submitCalls[0].expectedSceneIds, [1, 2]);
    await h.restart();
    assert((await h.api.submitManualVeoUp({ projectPath: h.root })).ok);
    assert.equal(h.automationCalls.length, 1, "coordinator deduplicates across controller restarts");
    await fs.rm(path.join(h.root, "scene_002", "motion_prompt.txt"));
    view = await h.api.getManualViewModel({ projectPath: h.root });
    assert.equal(view.audit.readyCount, 1);
    assert.equal((await h.api.submitManualVeoUp({ projectPath: h.root, allowPartial: true })).code, "PROJECT_INCOMPLETE");
    assert.equal(h.automationCalls.length, 1, "staged copies must not restore missing audited sources");
    await fs.writeFile(path.join(h.root, "scene_002", "motion_prompt.txt"), MOTION);
    const redo = await h.api.redoManualStage({ projectPath: h.root, sceneId: 1, stage: "NV1" });
    assert(redo.ok, JSON.stringify(redo));
    assert.equal(redo.viewModel.audit.readyCount, 1);
    assert.equal(redo.viewModel.audit.scenes[0].motionPrompt.valid, false);
    const newAttempt = (await h.api.armManualStage({ projectPath: h.root })).attempt;
    h.respond(newAttempt);
    assert((await h.capture(newAttempt)).ok);
    assert.equal((await h.api.getManualViewModel({ projectPath: h.root })).audit.readyCount, 1);
    const journal = JSON.parse(await fs.readFile(path.join(h.root, ".vidora", "manual_workflow_journal.json")));
    assert(journal.some((event) => event.kind === "stage_redo_requested"));
    const checkpoint = JSON.parse(await fs.readFile(path.join(h.root, ".vidora", "manual_workflow.json")));
    assert.equal(checkpoint.attempts.length, 5);
    assert(!JSON.stringify(checkpoint).includes(validPng().toString("base64")));
    console.log("Manual IPC/preload two-scene, restart, strict coordinator and redo integration passed");
  } finally { await h.cleanup(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
