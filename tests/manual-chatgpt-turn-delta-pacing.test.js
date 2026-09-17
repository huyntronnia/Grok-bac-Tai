"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  startManualStage,
  captureManualStage,
  validateManualOwnership,
} = require("../electron/main/chatgpt/manual_chatgpt_controller");

async function runTests() {
  console.log("Starting Manual ChatGPT Turn Delta & Pacing Tests...");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vidora-turn-delta-"));

  try {
    const VALID_PNG = Buffer.alloc(5000);
    VALID_PNG.write("89504e470d0a1a0a", 0, "hex");

    // Test 1: validateManualOwnership with force bypass
    const baseline1 = {
      sceneId: "scene_001",
      stage: "NV1",
      conversationId: "conv_1",
      assistantCount: 5,
      userCount: 5,
      turns: [{ id: "turn:0", role: "user", text: "prompt 1" }],
    };

    const mockPageStale = {
      clientType: "playwright",
      evaluate: async () => ({
        conversationId: "conv_1",
        assistantCount: 5,
        userCount: 5,
        composerBusy: false,
        stopButtonVisible: false,
      }),
    };

    const resStale = await validateManualOwnership(mockPageStale, baseline1, "scene_001", "NV1", {});
    assert.strictEqual(resStale.ok, false, "Should reject when assistant count has not increased");

    const resForced = await validateManualOwnership(mockPageStale, baseline1, "scene_001", "NV1", { force: true });
    assert.strictEqual(resForced.ok, true, "Should allow bypass when options.force is true");

    // Test 2: Multi-turn refinement support (user prompts > 1 before assistant responds)
    const baselineRefine = {
      sceneId: "scene_001",
      stage: "NV1",
      conversationId: "conv_1",
      assistantCount: 2,
      userCount: 2,
      turns: [
        { id: "u1", role: "user", text: "prompt 1" },
        { id: "a1", role: "assistant", text: "image 1" },
      ],
    };

    const mockPageRefined = {
      clientType: "playwright",
      evaluate: async (script) => {
        const str = String(script);
        if (str.includes("node.getAttribute('data-message-author-role')")) {
          return [
            { id: "u1", role: "user", text: "prompt 1" },
            { id: "a1", role: "assistant", text: "image 1" },
            { id: "u2", role: "user", text: "prompt 2 refinement" },
            { id: "u3", role: "user", text: "prompt 3 refinement" },
            { id: "a2", role: "assistant", text: "image 2 final" },
          ];
        }
        return {
          conversationId: "conv_1",
          assistantCount: 3,
          assistantTurnCount: 3,
          userCount: 4,
          userTurnCount: 4,
          composerBusy: false,
          stopButtonVisible: false,
        };
      },
    };

    const resRefine = await validateManualOwnership(mockPageRefined, baselineRefine, "scene_001", "NV1", {});
    assert.strictEqual(resRefine.ok, true, "Should accept when user made refinements and assistant generated final response");

    // Test 3: NV1 to NV2 automatic baseline transition
    const mockFullPage = {
      clientType: "playwright",
      evaluate: async (fnOrScript) => {
        const str = String(fnOrScript);
        if (str.includes("extractLatestChatGPTGeneratedImageBytesScript") || str.includes("imagegen-image")) {
          return {
            ok: true,
            base64: VALID_PNG.toString("base64"),
            contentType: "image/png",
            width: 1024,
            height: 1024,
            byteLength: VALID_PNG.length,
          };
        }
        return {
          conversationId: "conv_1",
          userCount: 2,
          userTurnCount: 2,
          assistantCount: 2,
          assistantTurnCount: 2,
          composerBusy: false,
          stopButtonVisible: false,
        };
      },
    };

    const mockRuntime = {
      getCdpPage: async () => mockFullPage,
    };

    await startManualStage(tmpDir, "scene_001", "NV1", mockRuntime);
    const capRes = await captureManualStage(tmpDir, "scene_001", "NV1", mockRuntime, { force: true });
    assert.strictEqual(capRes.ok, true, "NV1 capture should succeed");

    // Inspect scene_snapshot.json to verify baseline transitioned to NV2
    const snapPath = path.join(tmpDir, "scene_001", "scene_snapshot.json");
    const snap = JSON.parse(fs.readFileSync(snapPath, "utf8"));
    assert.strictEqual(snap.manualChatGpt.currentStage, "NV2", "currentStage should be NV2 after NV1 completes");
    assert.strictEqual(snap.manualChatGpt.baseline.stage, "NV2", "baseline stage should transition to NV2");
    assert.strictEqual(snap.manualChatGpt.stages.NV1.completed, true, "NV1 should be marked completed");
    assert.strictEqual(snap.manualChatGpt.stages.NV2.completed, false, "NV2 should be marked not completed yet");

    console.log("All Manual ChatGPT Turn Delta & Pacing Tests passed successfully!");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err.stack || err);
  process.exit(1);
});
