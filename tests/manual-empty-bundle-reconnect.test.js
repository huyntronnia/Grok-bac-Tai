"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { createManualWorkflowUI } = require("../electron/manual_workflow_ui");
const { createManualChatGptController } = require("../electron/main/chatgpt/manual_chatgpt_controller");
const { sanitizeIpcValue } = require("../electron/main/logging/logging");

function uiView(preparedBundle = null) {
  return {
    ok: true,
    revision: 174,
    state: "SCENE_NV1_READY",
    currentSceneId: 17,
    viewedSceneId: 17,
    nextStage: "NV1",
    preparedBundle,
    activeAttempt: null,
    overrideHold: false,
    audit: { readyCount: 16, expectedCount: 80, complete: false, scenes: [] },
  };
}

(async () => {
  const button = () => ({
    dataset: {},
    classList: { add() {}, remove() {} },
    setAttribute() {},
    removeAttribute() {},
    addEventListener(_type, handler) { this.handler = handler; },
    click() { return this.handler(); },
  });
  const captureButton = button();
  const copyButton = button();
  const armButton = button();
  const cancelButton = button();
  const resumeButton = button();
  const promptPreview = { value: "" };
  const actionState = { dataset: {} };
  const actionMessage = { textContent: "" };
  const elements = {
    "#manual-capture-btn": captureButton,
    "#manual-copy-btn": copyButton,
    "#manual-arm-btn": armButton,
    "#manual-cancel-btn": cancelButton,
    "#manual-resume-btn": resumeButton,
    "#manual-prompt-preview": promptPreview,
    "#manual-action-state": actionState,
    "#manual-action-message": actionMessage,
  };
  const document = { querySelector: (selector) => elements[selector] || null };
  let resumeCalls = 0;
  let resumeHasBundle = true;
  let copySucceeds = true;
  const prompt = "Tạo ảnh theo file sau: scene_017_nv1_request.txt";
  const bundle = { sceneId: 17, stage: "NV1", clipboardText: prompt, payloadFingerprint: "fingerprint", attachments: [] };
  const ui = createManualWorkflowUI({
    api: {
      setWorkflowMode: async () => ({ ok: true }),
      initializeManualWorkflow: async () => uiView(),
      resumeManualWorkflow: async () => {
        resumeCalls += 1;
        return sanitizeIpcValue({ ok: true, bundle: resumeHasBundle ? bundle : null, viewModel: uiView(resumeHasBundle ? bundle : null) });
      },
      copyManualText: async () => copySucceeds ? { ok: true } : { ok: false, error: "clipboard-busy" },
      armManualStage: async () => ({
        ok: true,
        attempt: { attemptId: "attempt-17", sceneId: 17, stage: "NV1", bundle },
        viewModel: { ...uiView(bundle), activeAttempt: { attemptId: "attempt-17", sceneId: 17, stage: "NV1", bundle } },
      }),
      cancelManualStage: async () => ({ ok: true, viewModel: { ...uiView(), state: "CANCELLED" } }),
    },
    document,
    getProjectPath: () => "test-project",
  });
  const started = await ui.start();
  assert.strictEqual(started.ok, true, JSON.stringify(started));
  assert.strictEqual(resumeCalls, 1, "empty initial bundle must not stop the resume call");
  assert.strictEqual(promptPreview.value, prompt);
  assert.strictEqual(copyButton.disabled, false, "a shared IPC bundle must enable Copy prompt");
  assert.strictEqual(armButton.disabled, false, "a shared IPC bundle must enable Arm");
  assert.strictEqual(captureButton.disabled, true, "an unowned response must not be capturable");
  await copyButton.click();
  assert.strictEqual(actionState.dataset.state, "success");
  assert.match(actionMessage.textContent, /đã được copy/i);
  copySucceeds = false;
  await armButton.click();
  assert.strictEqual(actionState.dataset.state, "error", "an Arm action must report failed clipboard copy");
  assert.match(actionMessage.textContent, /Đã bật theo dõi nhưng không copy được prompt/);
  assert.strictEqual(armButton.disabled, true, "Arm must be unavailable while an attempt is active");
  copySucceeds = true;
  await copyButton.click();
  assert.strictEqual(actionState.dataset.state, "success", "Copy must remain available to recover a failed Arm copy");
  await cancelButton.click();
  assert.strictEqual(resumeCalls, 1, "Cancel must leave observation stopped until explicit reconnect");
  assert.strictEqual(copyButton.disabled, true);
  assert.strictEqual(armButton.disabled, true);
  ui.render({ ...uiView(), revision: 173 });
  assert.strictEqual(promptPreview.value, "", "an older workflow event must not restore a cancelled prompt");
  assert.strictEqual(copyButton.disabled, true);
  assert.strictEqual(actionState.dataset.state, "success");
  resumeHasBundle = false;
  await resumeButton.click();
  assert.strictEqual(actionState.dataset.state, "error", "reconnect must not claim success with no prepared bundle");
  assert.strictEqual(copyButton.disabled, true);
  assert.strictEqual(armButton.disabled, true);
  resumeHasBundle = true;
  await resumeButton.click();
  assert.strictEqual(actionState.dataset.state, "success");
  assert.strictEqual(copyButton.disabled, false);
  assert.strictEqual(armButton.disabled, false);

  const cyclic = { name: "cycle" };
  cyclic.self = cyclic;
  assert.strictEqual(sanitizeIpcValue(cyclic).self, "[circular]", "a real cycle must still be bounded");

  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-manual-reconnect-"));
  try {
    const sceneDir = path.join(projectPath, "scene_017");
    await fs.mkdir(sceneDir);
    const requestPath = path.join(sceneDir, "scene_017_nv1_request.txt");
    await fs.writeFile(requestPath, "Saved scene 17 image request", "utf8");
    const controller = createManualChatGptController();
    await controller.initialize({
      projectPath,
      expectedSceneIds: [17],
      scenes: [{ id: 17, original: "Scene 17 text" }],
    });
    await controller.cancel({ projectPath });
    const recovered = await controller.resume({ projectPath });
    assert.strictEqual(recovered.ok, true);
    assert.strictEqual(recovered.viewModel?.state, "SCENE_NV1_READY");
    assert.strictEqual(recovered.viewModel?.preparedBundle?.sceneId, 17);
    assert.strictEqual(recovered.viewModel?.preparedBundle?.stage, "NV1");
    assert.strictEqual(recovered.viewModel?.preparedBundle?.clipboardText, prompt);
    assert.strictEqual(await fs.readFile(requestPath, "utf8"), "Saved scene 17 image request");
  } finally {
    await fs.rm(projectPath, { recursive: true, force: true });
  }
  console.log("Manual empty-bundle UI and cancelled Scene 17 reconnect test passed");
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
