"use strict";
const assert = require("assert");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { createHarness, validPng, MOTION } = require("./manual-workflow-fixture");
const { auditManualProject } = require("../../electron/main/chatgpt/manual_project_audit");
const { buildManualStageBundle, collectRecentKeyframes, validateReadyResponse } = require("../../electron/main/chatgpt/manual_stage_bundle");

async function runWith(fn, options) {
  const h = await createHarness(options);
  try { await fn(h); } finally { await h.cleanup(); }
}
const scenarios = {
  async ownership() {
    await runWith(async (h) => {
      h.browser.messages.push({ id: "old-user", role: "user", text: "old prompt" }, { id: "old-assistant", role: "assistant", text: "Ready", imageBuffer: validPng() });
      const attempt = await h.arm("NV1");
      assert.equal((await h.capture(attempt)).code, "UNPROVEN");
      h.browser.messages.push({ id: "unrelated-user", role: "user", text: "wrong scene" }, { id: "unrelated-assistant", role: "assistant", imageBuffer: validPng() });
      assert.equal((await h.capture(attempt)).code, "UNPROVEN");
      const owned = h.respond(attempt);
      h.browser.messages.push({ id: "later-user", role: "user", text: "unrelated" }, { id: "later-assistant", role: "assistant", imageBuffer: Buffer.from("bad") });
      assert.equal((await h.capture(attempt)).code, "UNPROVEN", "a later unrelated user turn must invalidate latest-prompt ownership");
      h.browser.messages.splice(-2);
      const captured = await h.capture(attempt);
      assert(captured.ok, JSON.stringify(captured));
      assert.equal(captured.attempt.capturedAssistantTurnId, owned.id);
      assert.deepEqual(await fs.readFile(captured.attempt.artifactPath), validPng());
      const nv2 = await h.arm("NV2");
      h.respond(nv2);
      const baseline = new Set(nv2.baselineTurnIds);
      h.browser.messages = h.browser.messages.filter((message) => !baseline.has(message.id));
      assert((await h.capture(nv2)).ok, "a virtualized old baseline must not hide the current owned NV2 user and response");
    });
  },
  async isolation() {
    await runWith(async (h) => {
      const attempt = await h.arm("NV1");
      h.respond(attempt);
      for (const overrides of [{ attemptId: "other" }, { sceneId: 2 }, { stage: "NV2" }]) {
        assert.equal((await h.capture(attempt, overrides)).code, "ATTEMPT_MISMATCH");
      }
      h.browser.conversationId = "other-conversation";
      h.browser.messages = [{ id: "other-user", role: "user", text: "Unrelated conversation" }];
      assert.equal((await h.capture(attempt)).code, "CONVERSATION_MISMATCH");
      const resume = await h.restart();
      assert.equal(resume.activeAttempt?.attemptId, attempt.attemptId,
        "switching to an unrelated conversation must keep the original attempt recoverable");
      assert.equal((await h.api.getManualViewModel({ projectPath: h.root })).nextStage, "NV1");
    });
    await runWith(async (h) => {
      h.browser.conversationId = ""; h.browser.pathname = "/";
      const attempt = await h.arm("NV1");
      h.respond(attempt); h.browser.conversationId = "new-conversation"; h.browser.pathname = "/c/new-conversation";
      assert((await h.capture(attempt)).ok, "first owned turn promotes root on the same browser target");
    });
  },
  async receipts() {
    await runWith(async (h) => {
      const attempt = await h.arm("NV1");
      const again = await h.api.armManualStage({ projectPath: h.root });
      assert.equal(again.attempt.attemptId, attempt.attemptId);
      assert.deepEqual(again.attempt.baselineTurnIds, attempt.baselineTurnIds);
      await h.api.selectManualScene({ projectPath: h.root, sceneId: 2 });
      assert.equal((await h.restart()).activeAttempt.attemptId, attempt.attemptId);
      await fs.appendFile(attempt.bundle.attachmentPaths[0], "\nchanged");
      h.respond(attempt);
      assert.equal((await h.capture(attempt)).code, "BUNDLE_CHANGED");
      await h.api.cancelManualStage({ projectPath: h.root });
      const redo = await h.api.redoManualStage({ projectPath: h.root, sceneId: 1, stage: "NV1" });
      assert(redo.ok);
      const next = (await h.api.armManualStage({ projectPath: h.root })).attempt;
      assert.notEqual(next.attemptId, attempt.attemptId);
      h.respond(next);
      assert((await h.capture(next)).ok);
      assert.equal((await h.api.prepareManualStage({ projectPath: h.root, sceneId: 1, stage: "NV1" })).code, "STAGE_COMPLETE_USE_REDO");
      const restored = await h.restart();
      assert.equal(restored.audit.scenes[0].keyframe.valid, true);
    });
  },
  async override() {
    await runWith(async (h) => {
      const attempt = await h.arm("NV1");
      h.browser.messages.push({ id: "unowned", role: "assistant", text: "Generated keyframe", imageBuffer: validPng() });
      assert.equal((await h.capture(attempt)).code, "UNPROVEN");
      assert.equal((await h.api.confirmManualOverride({ projectPath: h.root, token: "forged" })).code, "OVERRIDE_TOKEN_INVALID");
      let preview = await h.api.previewManualOverride({ projectPath: h.root });
      assert.equal(preview.stage, "NV1");
      h.browser.messages[0].text = "Generated keyframe changed";
      assert.equal((await h.api.confirmManualOverride({ projectPath: h.root, token: preview.token })).code, "OVERRIDE_CANDIDATE_CHANGED");
      preview = await h.api.previewManualOverride({ projectPath: h.root });
      const confirmed = await h.api.confirmManualOverride({ projectPath: h.root, token: preview.token });
      assert(confirmed.ok);
      assert.equal(confirmed.viewModel.state, "BLOCKED");
      assert.equal(confirmed.viewModel.overrideHold, true);
      assert.equal((await h.api.prepareManualStage({ projectPath: h.root, sceneId: 1, stage: "NV2" })).code, "OVERRIDE_CONTINUE_REQUIRED");
      assert.equal((await h.api.submitManualVeoUp({ projectPath: h.root })).code, "WORKFLOW_HELD");
      assert.equal((await h.restart()).overrideHold, true);
      const continued = await h.api.continueManualWorkflow({ projectPath: h.root });
      assert(continued.ok);
      assert.equal(continued.preparedBundle?.stage, "NV2", "continuing after an override must prepare the next stage immediately");
      assert.equal((await h.api.getManualViewModel({ projectPath: h.root })).nextStage, "NV2");
      const journal = JSON.parse(await fs.readFile(path.join(h.root, ".vidora", "manual_workflow_journal.json")));
      assert(journal.some((entry) => entry.kind === "manual_override"));
      assert.equal(h.automationCalls.length, 0);
    });
  },
  async audit() {
    await runWith(async (h) => {
      await h.writeScene(1);
      let audit = await auditManualProject(h.root, [1, 2]);
      assert.equal(audit.readyCount, 1);
      assert.equal((await h.api.submitManualVeoUp({ projectPath: h.root, expectedSceneIds: [1] })).code, "PROJECT_INCOMPLETE");
      await h.writeScene(2);
      assert.equal((await h.api.getManualViewModel({ projectPath: h.root })).audit.complete, true);
      const keyframe = path.join(h.root, "scene_002", "scene_002_keyframe.png");
      const corrupt = validPng(); corrupt[100] ^= 1;
      await fs.writeFile(keyframe, corrupt);
      audit = await auditManualProject(h.root, [1, 2]);
      assert.equal(audit.scenes[1].keyframe.valid, false, "real PNG CRC/deflate validation rejects corrupt content");
      await h.writeScene(2);
      await fs.writeFile(path.join(h.root, "scene_002", "motion_prompt.txt"), "Ready");
      assert.equal((await auditManualProject(h.root, [1, 2])).scenes[1].motionPrompt.valid, false);
      await h.writeScene(2);
      h.setPreSubmitHook(async () => fs.rm(path.join(h.root, "scene_002", "motion_prompt.txt")));
      const result = await h.api.submitManualVeoUp({ projectPath: h.root });
      assert.equal(result.ok, false);
      assert.equal(h.automationCalls.length, 0, "deletion between READY and external submission must block");
      await assert.rejects(() => auditManualProject(h.root, [1, 1]), /duplicate/);
      await assert.rejects(() => auditManualProject(h.root, [0]), /invalid/);
    });
  },
  async crash() {
    await runWith(async (h) => {
      const attempt = await h.arm("NV1");
      const checkpointPath = path.join(h.root, ".vidora", "manual_workflow.json");
      const artifactPath = path.join(h.root, "scene_001", "scene_001_keyframe.png");
      const image = validPng();
      const checkpoint = JSON.parse(await fs.readFile(checkpointPath));
      checkpoint.attempts[0].pendingArtifact = { path: artifactPath, hash: crypto.createHash("sha256").update(image).digest("hex"), assistantId: "owned-crash" };
      await fs.writeFile(checkpointPath, JSON.stringify(checkpoint));
      await fs.writeFile(artifactPath, image);
      const resumed = await h.restart();
      assert.equal(resumed.activeAttempt, null);
      assert.equal(resumed.nextStage, "NV2");
      assert.equal((await h.capture(attempt)).code, "NO_ACTIVE_ATTEMPT");
      const after = JSON.parse(await fs.readFile(checkpointPath));
      assert.equal(after.attempts.length, 1);
      assert.equal(after.attempts[0].capturedAssistantTurnId, "owned-crash");
    });
    await runWith(async (h) => {
      await h.hydrate();
      const attempt = await h.arm("NV1");
      h.respond(attempt);
      let release;
      let started;
      const waiting = new Promise((resolve) => { started = resolve; });
      h.runtime.readConversationSnapshot = async () => { started(); await new Promise((resolve) => { release = resolve; }); return { ...h.browser, pageId: h.page.pageId }; };
      await h.restart();
      const capture = h.capture(attempt);
      await waiting;
      const cancel = h.api.cancelManualStage({ projectPath: h.root });
      release();
      assert.equal((await capture).code, "ATTEMPT_CANCELLED");
      await cancel;
      assert.equal((await auditManualProject(h.root, [1,2])).readyCount, 0);
    });
  },
  async bundles() {
      await runWith(async (h) => {
      await fs.mkdir(path.join(h.root, "preprompt"), { recursive: true });
      await fs.writeFile(path.join(h.root, "preprompt", "rules.txt"), "Continuity rules");
      for (const id of [1,3,5,7,9,11,13,15,17,19,21,23,31]) await h.writeScene(id);
      const files = await collectRecentKeyframes(h.root, 30);
      assert.equal(files.length, 10);
      assert.match(files[0], /scene_023/);
      assert.match(files[9], /scene_005/);
      const nv1 = await buildManualStageBundle({ projectPath: h.root, sceneId: 1, stage: "NV1", scene: h.scenes[0] });
      assert.equal(nv1.clipboardText, "Tạo ảnh theo file sau: scene_001_nv1_request.txt");
      const content = await fs.readFile(nv1.attachmentPaths[0], "utf8");
      assert(content.includes(h.scenes[0].nv1) && content.includes(h.scenes[0].original));
      assert(!content.includes(h.scenes[0].nv2));
      assert(validateReadyResponse("Ready"));
      assert(!validateReadyResponse("I cannot assist due to policy"));
    });
  },
};
async function runScenario(name) {
  await scenarios[name]();
  console.log(`Manual ${name} behavioral scenario passed`);
}
module.exports = { runScenario };
