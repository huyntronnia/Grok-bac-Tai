"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const {
  normalizeSceneToken,
  resolveSceneDir,
  startManualStage,
  captureManualStage,
  getManualSceneAudit,
  detectChatGPTProgress,
  getManualStatus,
  cancelManualStage,
} = require("../electron/main/chatgpt/manual_chatgpt_controller");
const { readSceneSnapshot } = require("../electron/main/state/state");

// Valid PNG buffer >= 4096 bytes with PNG magic header for testing
const VALID_KEYFRAME_BUFFER = Buffer.alloc(5000);
VALID_KEYFRAME_BUFFER.write("89504e470d0a1a0a", 0, "hex");

async function runTests() {
  console.log("Starting Manual ChatGPT Comprehensive Workflow Tests...");

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "manual-chatgpt-wf-test-"));
  const sceneId = "scene_001";
  const sceneDir = path.join(tmpDir, sceneId);
  await fs.mkdir(sceneDir, { recursive: true });

  try {
    // Test 1: normalizeSceneToken
    assert.strictEqual(normalizeSceneToken(1), "scene_001");
    assert.strictEqual(normalizeSceneToken("2"), "scene_002");
    assert.strictEqual(normalizeSceneToken("scene_003"), "scene_003");
    assert.strictEqual(normalizeSceneToken(25), "scene_025");
    console.log("✓ normalizeSceneToken passed");

    // Test 2: resolveSceneDir
    assert.strictEqual(resolveSceneDir(tmpDir, "scene_001"), path.join(tmpDir, "scene_001"));
    assert.strictEqual(resolveSceneDir(path.join(tmpDir, "scene_001"), "scene_001"), path.join(tmpDir, "scene_001"));
    console.log("✓ resolveSceneDir passed");

    // Test 3: getManualSceneAudit on empty scene folder
    const emptyAudit = await getManualSceneAudit(tmpDir, "1");
    assert.strictEqual(emptyAudit.ok, true);
    assert.strictEqual(emptyAudit.sceneId, "scene_001");
    assert.strictEqual(emptyAudit.keyframe.exists, false);
    assert.strictEqual(emptyAudit.motionPrompt.exists, false);
    assert.strictEqual(emptyAudit.isSceneComplete, false);
    console.log("✓ getManualSceneAudit (empty state) passed");

    // Test 4: startManualStage for NV1
    const startRes = await startManualStage(tmpDir, 1, "NV1");
    assert.strictEqual(startRes.ok, true);
    assert.strictEqual(startRes.stage, "NV1");
    assert.strictEqual(startRes.sceneToken, "scene_001");
    assert(startRes.baseline);

    const snapshot = await readSceneSnapshot(sceneDir);
    assert(snapshot.manualChatGpt);
    assert.strictEqual(snapshot.manualChatGpt.currentStage, "NV1");
    console.log("✓ startManualStage NV1 passed");

    // Test 5: Save valid keyframe and motion prompt to disk, verify getManualSceneAudit
    const keyframePath = path.join(sceneDir, "scene_001_keyframe.png");
    await fs.writeFile(keyframePath, VALID_KEYFRAME_BUFFER);

    const motionContent = [
      "MOTION PROMPT — SCENE 1 — VIDEO 5 GIÂY TỪ KEYFRAME",
      "DÒNG 1: TỔNG QUÁT KHUNG HÌNH: Nhân vật nam đứng trước hiên nhà gỗ dưới ánh nắng ban trưa.",
      "DÒNG 2: NỘI DUNG VIDEO CHUYỂN ĐỘNG: Nhân vật bước chậm về phía trước, đưa tay mở cánh cửa gỗ.",
      "DÒNG 3: CHUYỂN ĐỘNG PHỤ: Cành lá đu đưa nhẹ theo gió tự nhiên.",
      "DÒNG 4: ÂM THANH: Tiếng gió rì rào và tiếng bước chân trên thềm gỗ to rõ ràng.",
      "DÒNG 5: VIDEO TẠO RA ĐÃ ĐẠT ĐƯỢC TẤT CẢ CÁC YÊU CẦU, chuyển động chân thực mượt mà.",
      "DÒNG 6: Technical Specifications: 8K ultra-realistic, authentic physics, high dynamic range.",
      "DÒNG 7: Negative Prompt: low quality, blurry, cartoon, subtitles, NO MUSIC.",
    ].join("\n");

    const motionPath = path.join(sceneDir, "motion_prompt.txt");
    await fs.writeFile(motionPath, motionContent, "utf8");

    const fullAudit = await getManualSceneAudit(tmpDir, 1);
    assert.strictEqual(fullAudit.ok, true);
    assert.strictEqual(fullAudit.keyframe.exists, true);
    assert.strictEqual(fullAudit.keyframe.valid, true);
    assert(fullAudit.keyframe.size > 0);
    assert.strictEqual(fullAudit.motionPrompt.exists, true);
    assert.strictEqual(fullAudit.motionPrompt.valid, true);
    assert(fullAudit.motionPrompt.length > 0);
    assert.strictEqual(fullAudit.isSceneComplete, true);
    console.log("✓ getManualSceneAudit (completed state) passed");

    // Test 6: captureManualStage for NV2 with mocked runtime
    const mockRuntime = {
      getCdpPage: async () => ({
        clientType: "playwright",
        evaluate: async (fnOrScript) => {
          if (typeof fnOrScript === "string" && fnOrScript.includes("data-message-author-role")) {
            return motionContent;
          }
          return {
            conversationId: "conv_123",
            userCount: 2,
            userTurnCount: 2,
            assistantCount: 2,
            assistantTurnCount: 2,
            composerBusy: false,
            stopButtonVisible: false,
          };
        },
      }),
    };
    const capNV2Res = await captureManualStage(tmpDir, "scene_001", "NV2", mockRuntime, {
      force: true,
      skipBaselineCheck: true,
    });
    assert.strictEqual(capNV2Res.ok, true);
    assert.strictEqual(capNV2Res.stage, "NV2");
    assert.strictEqual(capNV2Res.filePath, "motion_prompt.txt");

    const updatedSnapshot = await readSceneSnapshot(sceneDir);
    assert.strictEqual(updatedSnapshot.manualChatGpt.stages.NV2.completed, true);
    // Test 7: detectChatGPTProgress with mock page
    const mockProgressRuntime = {
      getCdpPage: async () => ({
        clientType: "playwright",
        evaluate: async (fnOrScript) => {
          const str = String(fnOrScript);
          if (str.includes("readChatGptImageStateScript") || str.includes("imagegen-image")) {
            return {
              generating: false,
              completedVisibleImage: true,
              urls: ["https://chatgpt.com/image.png"],
              visibleImageBoxCount: 1,
              latestAssistantText: "Sample assistant response",
            };
          }
          if (str.includes("readLatestAssistantScript")) {
            return {
              count: 2,
              text: "Sample motion prompt assistant text",
              textLength: 35,
              generating: false,
            };
          }
          return {
            conversationId: "conv_123",
            userCount: 2,
            userTurnCount: 2,
            assistantCount: 2,
            assistantTurnCount: 2,
            composerBusy: false,
            stopButtonVisible: false,
          };
        },
      }),
    };

    const progress = await detectChatGPTProgress(mockProgressRuntime);
    assert.strictEqual(progress.ok, true);
    assert.strictEqual(progress.hasImage, true);
    assert.strictEqual(progress.isGenerating, false);
    assert(progress.textLength > 0);
    console.log("✓ detectChatGPTProgress passed");

    // Test 8: captureManualStage for NV1 with mock page
    const mockNv1Runtime = {
      getCdpPage: async () => ({
        clientType: "playwright",
        evaluate: async (fnOrScript) => {
          const str = String(fnOrScript);
          if (str.includes("extractLatestChatGPTGeneratedImageBytesScript") || str.includes("group\\\\/imagegen-image")) {
            return {
              ok: true,
              base64: VALID_KEYFRAME_BUFFER.toString("base64"),
              contentType: "image/png",
              width: 1024,
              height: 1024,
              byteLength: VALID_KEYFRAME_BUFFER.length,
            };
          }
          return {
            conversationId: "conv_123",
            userCount: 2,
            userTurnCount: 2,
            assistantCount: 2,
            assistantTurnCount: 2,
            composerBusy: false,
            stopButtonVisible: false,
          };
        },
      }),
    };

    const capNV1Res = await captureManualStage(tmpDir, "scene_001", "NV1", mockNv1Runtime, {
      force: true,
      skipBaselineCheck: true,
    });
    if (!capNV1Res.ok) console.log("capNV1Res failed:", capNV1Res);
    assert.strictEqual(capNV1Res.ok, true);
    assert.strictEqual(capNV1Res.stage, "NV1");
    assert.strictEqual(capNV1Res.filePath, "scene_001_keyframe.png");
    console.log("✓ captureManualStage NV1 passed");

    // Test 9: Guard Isolation - Auto-send & Click blocked in manual mode
    const {
      sendPromptViaCdpInput,
      sendNv2PromptViaDeepCdpInput,
      clickSendButtonViaCdp,
    } = require("../electron/main/chatgpt/chatgpt_send");

    globalThis.__vidoraManualChatGPTMode = true;
    try {
      await assert.rejects(
        async () => {
          await sendPromptViaCdpInput({}, "test", { manualChatGPT: true });
        },
        /manual mode does not send prompts/,
      );
      await assert.rejects(
        async () => {
          await sendNv2PromptViaDeepCdpInput({}, "test", { manualChatGPT: true });
        },
        /manual mode does not send prompts/,
      );
      await assert.rejects(
        async () => {
          await clickSendButtonViaCdp({});
        },
        /manual mode does not click send button/,
      );
      console.log("✓ Guard isolation assertions passed (all auto-actions rejected)");
    } finally {
      globalThis.__vidoraManualChatGPTMode = false;
    }

    // Test 10: chatgpt_manual_detector baseline & tailScanFallback
    const {
      captureBaselineSnapshot,
      tailScanFallback,
      waitForStreamingLifecycle,
    } = require("../electron/main/chatgpt/chatgpt_manual_detector");

    const mockDetectorPage = {
      Runtime: {
        evaluate: async ({ expression }) => {
          const str = String(expression || "");
          if (str.includes("last.innerText || last.textContent")) {
            return { result: { value: motionContent } };
          }
          return {
            result: {
              value: {
                conversationId: "conv_detector_123",
                userCount: 3,
                assistantCount: 3,
                userTurnCount: 3,
                assistantTurnCount: 3,
              },
            },
          };
        },
      },
    };

    const baseline = await captureBaselineSnapshot(mockDetectorPage);
    assert.strictEqual(baseline.ok, true);
    assert.strictEqual(baseline.conversationId, "conv_detector_123");
    assert.strictEqual(baseline.assistantCount, 3);
    console.log("✓ captureBaselineSnapshot passed");

    const tailTextResult = await tailScanFallback(mockDetectorPage, "NV2");
    assert.strictEqual(tailTextResult.ok, true);
    assert.strictEqual(tailTextResult.method, "tail-text");
    console.log("✓ tailScanFallback NV2 passed");

    // Test 11: VeoUp batch compatibility verification
    const { stageSceneForVeoUp } = require("../electron/main/veoup/collection_store");
    const veoUpStageRes = await stageSceneForVeoUp({
      projectDir: tmpDir,
      sceneId: 1,
      keyframePath,
      motionPrompt: motionContent,
      motionPromptPath: motionPath,
    });
    assert(veoUpStageRes.keyframePath, "VeoUp batch keyframe path must exist");
    assert(veoUpStageRes.motionPromptPath, "VeoUp batch motion prompt path must exist");
    console.log("✓ VeoUp batch compatibility passed");

    console.log("\nALL MANUAL CHATGPT WORKFLOW TESTS PASSED SUCCESSFULLY!");
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => null);
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err.stack || err);
  process.exit(1);
});
