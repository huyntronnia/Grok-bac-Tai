"use strict";

const assert = require("assert");
const { createManualWorkflowUI } = require("../electron/manual_workflow_ui");

function element() {
  return {
    dataset: {},
    hidden: false,
    disabled: false,
    value: "",
    textContent: "",
    children: [],
    classList: { add() {}, remove() {} },
    setAttribute() {},
    removeAttribute() {},
    addEventListener(type, handler) { this.listeners ||= {}; this.listeners[type] = handler; },
    click() { return this.listeners?.click?.(); },
    change() { return this.listeners?.change?.(); },
    replaceChildren() { this.children = []; },
    appendChild(child) { this.children.push(child); },
  };
}

(async () => {
  const ids = [
    "manual-scene-select", "manual-redo-stage-select", "manual-redo-btn",
    "manual-recovery-details", "manual-capture-btn", "manual-prompt-label",
    "manual-action-state", "manual-action-message", "manual-prompt-preview",
    "manual-arm-btn", "manual-copy-btn", "manual-continue-btn",
    "manual-cancel-btn", "manual-override-preview-btn", "manual-retry-veoup-btn",
  ];
  const nodes = Object.fromEntries(ids.map((id) => [id, element()]));
  const document = {
    querySelector: (selector) => nodes[selector.slice(1)] || null,
    createElement: () => element(),
  };
  const bundle = {
    sceneId: 17, stage: "NV2", clipboardText: "Prompt Scene 17 NV2",
    payloadFingerprint: "fingerprint", attachments: [],
  };
  const scene = {
    sceneId: 17, stage: "NV2", sceneDir: "scene_017",
    keyframe: { exists: true, valid: true, path: "keyframe.png" },
    motionPrompt: { exists: true, valid: true, path: "motion_prompt.txt" },
  };
  const view = {
    ok: true, revision: 1, state: "SCENE_NV2_READY", currentSceneId: 17,
    viewedSceneId: 17, nextStage: "NV2", preparedBundle: bundle,
    activeAttempt: null, overrideHold: false, canRetryVeoUp: false,
    audit: { readyCount: 0, expectedCount: 80, complete: false, scenes: [scene] },
  };
  let observationHandler;
  let redoPayload;
  let resumeCalls = 0;
  let cancelCalls = 0;
  const ui = createManualWorkflowUI({
    api: {
      setWorkflowMode: async () => ({ ok: true }),
      initializeManualWorkflow: async () => view,
      resumeManualWorkflow: async () => { resumeCalls += 1; return { ok: true, viewModel: view }; },
      cancelManualStage: async () => {
        cancelCalls += 1;
        return { ok: true, viewModel: { ...view, state: "CANCELLED", preparedBundle: null, rearmRequired: true } };
      },
      redoManualStage: async (payload) => {
        redoPayload = payload;
        return { ok: true, viewModel: { ...view, revision: 2 } };
      },
      onManualWorkflowObservation: (handler) => { observationHandler = handler; },
    },
    document,
    getProjectPath: () => "test-project",
  });

  assert.strictEqual((await ui.start()).ok, true);
  assert.strictEqual(nodes["manual-recovery-details"].hidden, false);
  assert.strictEqual(nodes["manual-redo-stage-select"].value, "NV2");
  assert.strictEqual(nodes["manual-redo-btn"].disabled, false);
  assert.match(nodes["manual-prompt-label"].textContent, /Scene 17 · NV2/);
  assert.strictEqual(nodes["manual-capture-btn"].disabled, true);

  observationHandler({
    projectPath: "test-project",
    observation: { available: true, capturablePreparedResponse: { sceneId: 17, stage: "NV2" } },
  });
  assert.strictEqual(nodes["manual-capture-btn"].disabled, false,
    "live observation should enable saving an owned prepared response");

  nodes["manual-redo-stage-select"].value = "NV1";
  nodes["manual-redo-stage-select"].change();
  await nodes["manual-redo-btn"].click();
  assert.deepStrictEqual(redoPayload, { projectPath: "test-project", sceneId: 17, stage: "NV1" });
  assert.strictEqual(nodes["manual-action-state"].dataset.state, "success");
  await nodes["manual-cancel-btn"].click();
  assert.strictEqual(cancelCalls, 1);
  assert.strictEqual(resumeCalls, 1, "Cancel must not restart the watcher through Resume");
  console.log("Manual UI live capture and Redo controls test passed");
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
