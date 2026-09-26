"use strict";
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const vm = require("vm");
const assert = require("assert");
const { createManualChatGptController } = require("../../electron/main/chatgpt/manual_chatgpt_controller");
const { buildManualStageBundle } = require("../../electron/main/chatgpt/manual_stage_bundle");
const { registerManualWorkflowIpc } = require("../../electron/main/ipc/manual_workflow_ipc");
const { readManualConversationSnapshot } = require("../../electron/main/chatgpt/manual_cdp_snapshot");
const { createVeoUpBatchCoordinator } = require("../../electron/main/veoup/batch_coordinator");
const { setWorkflowMode } = require("../../electron/main/state/workflow_mode");
const MOTION = "A slow cinematic tracking movement follows the subject with stable framing, layered parallax, natural secondary motion, consistent lighting, precise timing, and a clean final settle for continuity into the next scene.";
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0); }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, crc]);
}
function validPng() {
  const width = 256, height = 256, header = Buffer.alloc(13), raw = Buffer.alloc((width * 3 + 1) * height);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const noise = crypto.createHash("sha256").update("manual-fixture").digest();
  for (let row = 0; row < height; row++) {
    const start = row * (width * 3 + 1);
    for (let column = 1; column <= width * 3; column++) raw[start + column] = (column * row + noise[column % noise.length]) % 256;
  }
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
async function bridgeFor(controller, extras = {}) {
  const handlers = new Map(), listeners = new Map(), copies = [];
  registerManualWorkflowIpc({
    ipcMain: { handle: (name, handler) => { assert(!handlers.has(name)); handlers.set(name, handler); } },
    safeIpcHandler: (handler) => async (...args) => { try { return await handler(...args); } catch (error) { return { ok: false, error: error.message, code: error.code }; } },
    controller, copyText: async (text) => { copies.push(text); return { ok: true }; }, openFolder: async () => ({ ok: true }),
  });
  let api;
  vm.runInNewContext(await fs.readFile(path.join(__dirname, "../../electron/preload.js"), "utf8"), {
    require: (name) => {
      assert.equal(name, "electron");
      return { contextBridge: { exposeInMainWorld: (_name, value) => { api = value; } }, ipcRenderer: {
        invoke: (name, ...args) => { const fn = handlers.get(name) || extras[name]; if (!fn) throw new Error(`Missing IPC ${name}`); return fn(null, ...args); },
        on: (name, fn) => listeners.set(name, fn), removeListener: (name) => listeners.delete(name), send: () => {},
      } };
    },
  });
  return { api, handlers, copies, listeners };
}
async function createHarness({ ids = [1, 2], useCoordinator = true } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-manual-contract-"));
  const scenes = ids.map((id) => ({ id, original: `Scene ${id}: an adult walks across a sunlit courtyard.`, nv1: "Create one production keyframe.", nv2: "Write one detailed motion prompt." }));
  const browser = { conversationId: "conversation-1", pathname: "/c/conversation-1", messages: [], generating: false };
  const automationCalls = [], submitCalls = [];
  let preSubmitHook = null;
  const page = { clientType: "playwright", pageId: "page-1", evaluate: async () => browser };
  const coordinator = createVeoUpBatchCoordinator({ executeAutomation: async (payload) => { automationCalls.push(payload); return { ok: true, status: "submitted", imageCount: ids.length }; } });
  const runtime = {
    loadProject: async () => ({ scenes }),
    readConversationSnapshot: () => readManualConversationSnapshot(page),
    buildStageBundle: (input) => buildManualStageBundle(input),
    submitVeoUp: async (payload) => {
      submitCalls.push(payload);
      if (preSubmitHook) await preSubmitHook(payload);
      if (useCoordinator) return coordinator.requestBatch(payload);
      const gate = await payload.preSubmitAudit();
      return gate.ok ? { ok: true, batchId: "test-batch" } : gate;
    },
  };
  let controller = createManualChatGptController(runtime);
  let bridge = await bridgeFor(controller);
  setWorkflowMode();
  const initialized = await bridge.api.initializeManualWorkflow({ projectPath: root, expectedSceneIds: [ids[0]], scenes: [] });
  assert(initialized.ok);
  const harness = {
    root, scenes, browser, page, automationCalls, submitCalls, runtime,
    get controller() { return controller; }, get api() { return bridge.api; }, get bridge() { return bridge; },
    setPreSubmitHook(fn) { preSubmitHook = fn; },
    async restart() { controller.dispose(); controller = createManualChatGptController(runtime); bridge = await bridgeFor(controller); return bridge.api.resumeManualWorkflow({ projectPath: root }); },
    async prepare(stage, sceneId = ids[0]) { const result = await bridge.api.prepareManualStage({ projectPath: root, sceneId, stage }); assert(result.ok, JSON.stringify(result)); return result; },
    async arm(stage, sceneId = ids[0]) { await harness.prepare(stage, sceneId); const result = await bridge.api.armManualStage({ projectPath: root }); assert(result.ok, JSON.stringify(result)); return result.attempt; },
    respond(attempt, text = MOTION) {
      browser.messages.push({ id: crypto.randomUUID(), role: "user", text: attempt.bundle.clipboardText, attachmentNames: [...attempt.bundle.attachmentNames] });
      const assistant = { id: crypto.randomUUID(), role: "assistant", text, settled: true };
      if (attempt.stage === "NV1") assistant.imageBuffer = validPng();
      browser.messages.push(assistant);
      return assistant;
    },
    async capture(attempt, overrides = {}) { return bridge.api.captureManualStage({ projectPath: root, attemptId: attempt.attemptId, sceneId: attempt.sceneId, stage: attempt.stage, ...overrides }); },
    async complete(stage, sceneId = ids[0], restart = false) {
      const attempt = await harness.arm(stage, sceneId);
      if (restart) { const resumed = await harness.restart(); assert.equal(resumed.activeAttempt.attemptId, attempt.attemptId); }
      harness.respond(attempt);
      const result = await harness.capture(attempt);
      assert(result.ok, JSON.stringify(result));
      if (restart) { const resumed = await harness.restart(); assert.equal(resumed.activeAttempt, null); assert(!(await harness.capture(attempt)).ok); }
      return result;
    },
    async hydrate() {},
    async writeScene(id) {
      const dir = path.join(root, `scene_${String(id).padStart(3, "0")}`);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, `${path.basename(dir)}_keyframe.png`), validPng());
      await fs.writeFile(path.join(dir, "motion_prompt.txt"), MOTION);
    },
    async cleanup() { controller.dispose(); await fs.rm(root, { recursive: true, force: true }); },
  };
  return harness;
}
module.exports = { createHarness, bridgeFor, validPng, MOTION, crc32, chunk };
