"use strict";

const assert = require("assert");
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const os = require("os");

const {
  startManualStage,
  captureManualStage,
  detectChatGPTProgress,
  extractManualChatGptImage,
  readLatestAssistantTurnText,
  validateManualOwnership,
  getManualSceneAudit,
} = require("../electron/main/chatgpt/manual_chatgpt_controller");

// Valid PNG buffer >= 4096 bytes with PNG magic header for testing
const VALID_KEYFRAME_BUFFER = Buffer.alloc(5120);
VALID_KEYFRAME_BUFFER.write("89504e470d0a1a0a", 0, "hex");

async function runOutputReceivingTests() {
  console.log("==================================================");
  console.log("BẮT ĐẦU KIỂM THỬ LOGIC NHẬN OUTPUT TỪ CHATGPT");
  console.log("==================================================");

  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "gpt-output-test-"));
  const sceneId = "scene_001";
  const sceneDir = path.join(tmpDir, sceneId);
  await fsPromises.mkdir(sceneDir, { recursive: true });

  try {
    // ----------------------------------------------------
    // TEST 1: Nhận Text Output REQUEST_1 và REQUEST_2
    // ----------------------------------------------------
    console.log("\n--- TEST 1: Nhận Text Output REQUEST_1 và REQUEST_2 ---");

    const mockRequestPage = {
      clientType: "playwright",
      evaluate: async (script) => {
        const str = String(script);
        if (str.includes("data-message-author-role") && str.includes("assistant")) {
          return "Tôi đã hiểu toàn bộ tài liệu hướng dẫn và sẵn sàng.";
        }
        return {
          conversationId: "conv_test_req",
          assistantCount: 1,
          assistantTurnCount: 1,
          userCount: 1,
          userTurnCount: 1,
          composerBusy: false,
          stopButtonVisible: false,
        };
      },
    };

    const mockRequestRuntime = {
      getCdpPage: async () => mockRequestPage,
    };

    // 1.1 Start REQUEST_1 & Capture
    await startManualStage(tmpDir, sceneId, "REQUEST_1", mockRequestRuntime);
    const req1Res = await captureManualStage(tmpDir, sceneId, "REQUEST_1", mockRequestRuntime, { force: true });
    assert.strictEqual(req1Res.ok, true, "REQUEST_1 capture phải thành công");
    assert.strictEqual(req1Res.filePath, "request_1_response.txt");

    const req1Content = await fsPromises.readFile(path.join(sceneDir, "request_1_response.txt"), "utf8");
    assert.strictEqual(req1Content, "Tôi đã hiểu toàn bộ tài liệu hướng dẫn và sẵn sàng.");
    console.log("✓ Nhận & lưu output REQUEST_1 thành công:", req1Content);

    // 1.2 Start REQUEST_2 & Capture
    await startManualStage(tmpDir, sceneId, "REQUEST_2", mockRequestRuntime);
    const req2Res = await captureManualStage(tmpDir, sceneId, "REQUEST_2", mockRequestRuntime, { force: true });
    assert.strictEqual(req2Res.ok, true, "REQUEST_2 capture phải thành công");
    assert.strictEqual(req2Res.filePath, "request_2_response.txt");

    const req2Content = await fsPromises.readFile(path.join(sceneDir, "request_2_response.txt"), "utf8");
    assert.strictEqual(req2Content, "Tôi đã hiểu toàn bộ tài liệu hướng dẫn và sẵn sàng.");
    console.log("✓ Nhận & lưu output REQUEST_2 thành công:", req2Content);

    // ----------------------------------------------------
    // TEST 2: Nhận Image Output NV1 qua Pipeline Chuẩn
    // ----------------------------------------------------
    console.log("\n--- TEST 2: Nhận Image Output NV1 qua Pipeline Chuẩn ---");

    const mockNv1StandardPage = {
      clientType: "playwright",
      evaluate: async (fnOrScript) => {
        const str = String(fnOrScript);
        if (str.includes("extractLatestChatGPTGeneratedImageBytesScript") || str.includes("imagegen-image")) {
          return {
            ok: true,
            base64: VALID_KEYFRAME_BUFFER.toString("base64"),
            contentType: "image/png",
            width: 1024,
            height: 1024,
            byteLength: VALID_KEYFRAME_BUFFER.length,
            method: "standard-pipeline",
          };
        }
        return {
          conversationId: "conv_nv1",
          userCount: 2,
          userTurnCount: 2,
          assistantCount: 2,
          assistantTurnCount: 2,
          composerBusy: false,
          stopButtonVisible: false,
        };
      },
    };

    const mockNv1StandardRuntime = {
      getCdpPage: async () => mockNv1StandardPage,
    };

    await startManualStage(tmpDir, sceneId, "NV1", mockNv1StandardRuntime);
    const nv1CapRes = await captureManualStage(tmpDir, sceneId, "NV1", mockNv1StandardRuntime, { force: true });
    assert.strictEqual(nv1CapRes.ok, true, "NV1 standard capture phải thành công");
    assert.strictEqual(nv1CapRes.filePath, "scene_001_keyframe.png");

    const savedKeyframePath = path.join(sceneDir, "scene_001_keyframe.png");
    assert.strictEqual(fs.existsSync(savedKeyframePath), true, "File ảnh keyframe phải tồn tại trên đĩa");
    const savedStat = await fsPromises.stat(savedKeyframePath);
    assert(savedStat.size >= 4096, "Dung lượng ảnh keyframe phải >= 4096 bytes");
    console.log(`✓ Nhận & giải mã ảnh keyframe NV1 thành công: ${savedStat.size} bytes`);

    // ----------------------------------------------------
    // TEST 3: Nhận Image Output NV1 qua DOM Canvas Fallback (khi pipeline chuẩn trượt)
    // ----------------------------------------------------
    console.log("\n--- TEST 3: Nhận Image Output NV1 qua Fallback DOM Canvas ---");

    const mockNv1CanvasFallbackPage = {
      clientType: "playwright",
      evaluate: async (fnOrScript) => {
        const str = String(fnOrScript);
        // Giả lập pipeline chuẩn không tìm thấy ảnh
        if (str.includes("extractLatestChatGPTGeneratedImageBytesScript")) {
          return { ok: false, error: "not-found-in-pipeline" };
        }
        // Fallback trực tiếp DOM tìm thấy canvas đã vẽ xong
        if (str.includes("group\\\\/imagegen-image canvas") || str.includes("toDataURL('image/png')")) {
          return {
            ok: true,
            base64: VALID_KEYFRAME_BUFFER.toString("base64"),
            contentType: "image/png",
            width: 1024,
            height: 1024,
            method: "canvas",
          };
        }
        return {
          conversationId: "conv_nv1",
          userCount: 2,
          userTurnCount: 2,
          assistantCount: 2,
          assistantTurnCount: 2,
          composerBusy: false,
          stopButtonVisible: false,
        };
      },
    };

    const canvasExtracted = await extractManualChatGptImage(mockNv1CanvasFallbackPage, { sceneId: "scene_001" });
    assert.strictEqual(canvasExtracted.ok, true, "Fallback DOM Canvas phải trích xuất được ảnh");
    assert.strictEqual(canvasExtracted.method, "canvas");
    console.log("✓ Fallback trích xuất ảnh từ canvas hoàn tất:", canvasExtracted.method);

    // ----------------------------------------------------
    // TEST 4: Nhận Image Output NV1 qua Data URL Fallback
    // ----------------------------------------------------
    console.log("\n--- TEST 4: Nhận Image Output NV1 qua Fallback Data URL ---");

    const mockNv1DataUrlPage = {
      clientType: "playwright",
      evaluate: async (fnOrScript) => {
        const str = String(fnOrScript);
        if (str.includes("extractLatestChatGPTGeneratedImageBytesScript")) {
          return { ok: false, error: "not-found-in-pipeline" };
        }
        if (str.includes("src.startsWith('data:image/')")) {
          return {
            ok: true,
            base64: VALID_KEYFRAME_BUFFER.toString("base64"),
            contentType: "image/png",
            width: 1024,
            height: 1024,
            method: "data-url",
          };
        }
        return {
          conversationId: "conv_nv1",
          userCount: 2,
          userTurnCount: 2,
          assistantCount: 2,
          assistantTurnCount: 2,
        };
      },
    };

    const dataUrlExtracted = await extractManualChatGptImage(mockNv1DataUrlPage, { sceneId: "scene_001" });
    assert.strictEqual(dataUrlExtracted.ok, true, "Fallback Data URL phải trích xuất được ảnh");
    assert.strictEqual(dataUrlExtracted.method, "data-url");
    console.log("✓ Fallback trích xuất ảnh từ data:image URL hoàn tất:", dataUrlExtracted.method);

    // ----------------------------------------------------
    // TEST 5: Từ Chối Ảnh Lỗi (Quá nhỏ, Placeholder canvas)
    // ----------------------------------------------------
    console.log("\n--- TEST 5: Kiểm Tra Cơ Chế Từ Chối Ảnh Không Hợp Lệ ---");

    // 5.1 Ảnh quá nhỏ (< 4096 bytes)
    const tinyBuffer = Buffer.alloc(100);
    const mockTinyPage = {
      clientType: "playwright",
      evaluate: async (fnOrScript) => {
        const str = String(fnOrScript);
        if (str.includes("extractLatestChatGPTGeneratedImageBytesScript") || str.includes("imagegen-image")) {
          return {
            ok: true,
            base64: tinyBuffer.toString("base64"),
            contentType: "image/png",
            width: 100,
            height: 100,
            byteLength: tinyBuffer.length,
          };
        }
        return { conversationId: "conv_tiny", assistantCount: 3, userCount: 3 };
      },
    };

    const mockTinyRuntime = { getCdpPage: async () => mockTinyPage };
    const tinyRes = await captureManualStage(tmpDir, sceneId, "NV1", mockTinyRuntime, { force: true });
    assert.strictEqual(tinyRes.ok, false, "Ảnh quá nhỏ phải bị từ chối");
    assert(tinyRes.reason.includes("Lỗi giải mã ảnh PNG") || tinyRes.reason.includes("too small"), "Thông báo lỗi phải rõ ràng");
    console.log("✓ Từ chối thành công ảnh kích thước nhỏ:", tinyRes.reason);

    // ----------------------------------------------------
    // TEST 6: Nhận Motion Prompt Output NV2
    // ----------------------------------------------------
    console.log("\n--- TEST 6: Nhận & Xác Thực Motion Prompt NV2 ---");

    const validMotionText = "Góc quay camera panning chậm từ trái sang phải theo từng bước chân của nhân vật chính đang tiến vào khu rừng rậm rạp. Ánh sáng hoàng hôn le lói xuyên qua các tán cây cổ thụ tạo nên những vệt sáng huyền ảo và đổ bóng dài trên mặt đất ẩm ướt.";
    const mockNv2Page = {
      clientType: "playwright",
      evaluate: async (script) => {
        const str = String(script);
        if (str.includes("data-message-author-role") && str.includes("assistant")) {
          return validMotionText;
        }
        return {
          conversationId: "conv_nv2",
          assistantCount: 3,
          assistantTurnCount: 3,
          userCount: 3,
          userTurnCount: 3,
          composerBusy: false,
          stopButtonVisible: false,
        };
      },
    };

    const mockNv2Runtime = { getCdpPage: async () => mockNv2Page };

    // Bắt NV2
    const nv2CapRes = await captureManualStage(tmpDir, sceneId, "NV2", mockNv2Runtime, { force: true });
    assert.strictEqual(nv2CapRes.ok, true, "NV2 capture phải thành công");
    assert.strictEqual(nv2CapRes.filePath, "motion_prompt.txt");

    const savedMotionPath = path.join(sceneDir, "motion_prompt.txt");
    assert.strictEqual(fs.existsSync(savedMotionPath), true, "File motion prompt phải tồn tại");
    const savedMotionText = await fsPromises.readFile(savedMotionPath, "utf8");
    assert.strictEqual(savedMotionText, validMotionText);
    console.log("✓ Nhận & lưu Motion Prompt NV2 thành công:", savedMotionText);

    // 6.2 Từ chối khi văn bản motion rỗng
    const mockEmptyNv2Page = {
      clientType: "playwright",
      evaluate: async (script) => {
        const str = String(script);
        if (str.includes("data-message-author-role") && str.includes("assistant")) {
          return "   ";
        }
        return { conversationId: "conv_nv2", assistantCount: 4, assistantTurnCount: 4, userCount: 4 };
      },
    };
    const emptyNv2Res = await captureManualStage(tmpDir, sceneId, "NV2", { getCdpPage: async () => mockEmptyNv2Page }, { force: true });
    assert.strictEqual(emptyNv2Res.ok, false, "Motion prompt rỗng phải bị từ chối");
    console.log("✓ Từ chối thành công motion prompt rỗng:", emptyNv2Res.reason);

    // ----------------------------------------------------
    // TEST 7: Kiểm Tra Phát Hiện Tiến Trình (detectChatGPTProgress)
    // ----------------------------------------------------
    console.log("\n--- TEST 7: Kiểm Tra Hàm Phát Hiện Tiến Trình (detectChatGPTProgress) ---");

    // 7.1 Trường hợp ChatGPT đang gõ/tạo
    const mockGeneratingPage = {
      clientType: "playwright",
      evaluate: async (script) => {
        const str = String(script);
        if (str.includes("completedVisibleImage")) {
          return { generating: true, completedVisibleImage: false };
        }
        if (str.includes("extract-conversation-snapshot")) {
          return { generating: true, isComplete: false };
        }
        if (str.includes("conversationFingerprint")) {
          return {
            conversationId: "conv_1",
            composerBusy: true,
            stopButtonVisible: true,
          };
        }
        return {
          conversationId: "conv_1",
          composerBusy: true,
          stopButtonVisible: true,
        };
      },
    };

    const genProgress = await detectChatGPTProgress({ getCdpPage: async () => mockGeneratingPage });
    assert.strictEqual(genProgress.ok, true);
    assert.strictEqual(genProgress.isGenerating, true, "Phải nhận diện được trạng thái đang sinh");
    console.log("✓ Nhận diện chính xác trạng thái đang sinh (isGenerating = true)");

    // 7.2 Trường hợp ảnh hoàn tất
    const mockReadyImagePage = {
      clientType: "playwright",
      evaluate: async (script) => {
        const str = String(script);
        if (str.includes("completedVisibleImage")) {
          return { generating: false, completedVisibleImage: true, urls: ["https://example.com/img.png"] };
        }
        if (str.includes("extract-conversation-snapshot")) {
          return { generating: false, isComplete: true, text: "Here is the image" };
        }
        if (str.includes("conversationFingerprint")) {
          return {
            conversationId: "conv_1",
            composerBusy: false,
            stopButtonVisible: false,
          };
        }
        return {
          conversationId: "conv_1",
          composerBusy: false,
          stopButtonVisible: false,
        };
      },
    };

    const imgProgress = await detectChatGPTProgress({ getCdpPage: async () => mockReadyImagePage });
    assert.strictEqual(imgProgress.ok, true);
    assert.strictEqual(imgProgress.isGenerating, false);
    assert.strictEqual(imgProgress.hasImage, true, "Phải nhận diện được có ảnh sẵn sàng");
    console.log("✓ Nhận diện chính xác có ảnh sẵn sàng (hasImage = true, isGenerating = false)");

    // 7.3 Trường hợp text hoàn tất
    const mockReadyTextPage = {
      clientType: "playwright",
      evaluate: async (script) => {
        const str = String(script);
        if (str.includes("completedVisibleImage")) {
          return { generating: false, completedVisibleImage: false, urls: [] };
        }
        if (str.includes("extract-conversation-snapshot")) {
          return { generating: false, isComplete: true, text: validMotionText, textLength: validMotionText.length };
        }
        if (str.includes("conversationFingerprint")) {
          return {
            conversationId: "conv_1",
            composerBusy: false,
            stopButtonVisible: false,
          };
        }
        return {
          conversationId: "conv_1",
          composerBusy: false,
          stopButtonVisible: false,
        };
      },
    };

    const textProgress = await detectChatGPTProgress({ getCdpPage: async () => mockReadyTextPage });
    assert.strictEqual(textProgress.ok, true);
    assert.strictEqual(textProgress.isGenerating, false);
    assert(textProgress.textLength > 35, "Độ dài text phản hồi phải > 35 ký tự");
    console.log(`✓ Nhận diện chính xác text hoàn tất: ${textProgress.textLength} ký tự`);

    // ----------------------------------------------------
    // TEST 8: Kiểm Tra Đầy Đủ Scene Audit Sau Khi Nhận Đủ Output
    // ----------------------------------------------------
    console.log("\n--- TEST 8: Kiểm Tra Scene Audit Toàn Diện ---");

    const finalAudit = await getManualSceneAudit(tmpDir, sceneId);
    assert.strictEqual(finalAudit.ok, true);
    assert.strictEqual(finalAudit.keyframe.valid, true, "Keyframe phải hợp lệ trong audit");
    assert.strictEqual(finalAudit.motionPrompt.valid, true, "Motion prompt phải hợp lệ trong audit");
    assert.strictEqual(finalAudit.isSceneComplete, true, "Scene phải hoàn tất 100% khi đủ cả 2 output");
    console.log("✓ Scene Audit xác nhận hoàn tất đầy đủ: isSceneComplete = true");

    // ----------------------------------------------------
    // TEST 9: Mô Phỏng Chu Trình Watcher Tự Động Nhận Output (Scene 002)
    // ----------------------------------------------------
    console.log("\n--- TEST 9: Mô Phỏng Chu Trình Watcher Tự Động Nhận Output (Scene 002) ---");
    const scene2Id = "scene_002";
    const scene2Dir = path.join(tmpDir, scene2Id);
    await fsPromises.mkdir(scene2Dir, { recursive: true });

    let currentGptState = {
      isGenerating: true,
      hasImage: false,
      textLength: 0,
      assistantText: "",
    };

    const watcherMockPage = {
      clientType: "playwright",
      evaluate: async (fnOrScript) => {
        const str = String(fnOrScript);
        if (str.includes("completedVisibleImage")) {
          return { generating: currentGptState.isGenerating, completedVisibleImage: currentGptState.hasImage, urls: currentGptState.hasImage ? ["https://example.com/s2.png"] : [] };
        }
        if (str.includes("extract-conversation-snapshot")) {
          return { generating: currentGptState.isGenerating, isComplete: !currentGptState.isGenerating, text: currentGptState.assistantText, textLength: currentGptState.textLength };
        }
        if (str.includes("extractLatestChatGPTGeneratedImageBytesScript") || str.includes("imagegen-image")) {
          return {
            ok: true,
            base64: VALID_KEYFRAME_BUFFER.toString("base64"),
            contentType: "image/png",
            width: 1024,
            height: 1024,
            byteLength: VALID_KEYFRAME_BUFFER.length,
          };
        }
        if (str.includes("data-message-author-role") && str.includes("assistant")) {
          return currentGptState.assistantText;
        }
        if (str.includes("conversationFingerprint")) {
          return {
            conversationId: "conv_s2",
            userCount: 2,
            userTurnCount: 2,
            assistantCount: currentGptState.isGenerating ? 1 : 2,
            assistantTurnCount: currentGptState.isGenerating ? 1 : 2,
            composerBusy: currentGptState.isGenerating,
            stopButtonVisible: currentGptState.isGenerating,
          };
        }
        return {
          conversationId: "conv_s2",
          userCount: 2,
          userTurnCount: 2,
          assistantCount: currentGptState.isGenerating ? 1 : 2,
          assistantTurnCount: currentGptState.isGenerating ? 1 : 2,
          composerBusy: currentGptState.isGenerating,
          stopButtonVisible: currentGptState.isGenerating,
        };
      },
    };

    const watcherRuntime = { getCdpPage: async () => watcherMockPage };

    // Bắt đầu stage NV1 cho Scene 2
    await startManualStage(tmpDir, scene2Id, "NV1", watcherRuntime);

    // Watcher tick 1: GPT đang tạo -> Không kích hoạt lưu
    let progressTick1 = await detectChatGPTProgress(watcherRuntime);
    let auditTick1 = await getManualSceneAudit(tmpDir, scene2Id);
    assert.strictEqual(progressTick1.isGenerating, true);
    assert.strictEqual(!auditTick1.keyframe.valid && !progressTick1.isGenerating && progressTick1.hasImage, false, "Watcher không được lưu khi đang tạo");
    console.log("✓ Watcher Tick 1: Bỏ qua khi ChatGPT đang tạo");

    // Watcher tick 2: GPT tạo xong ảnh NV1 -> Kích hoạt lưu NV1
    currentGptState.isGenerating = false;
    currentGptState.hasImage = true;
    let progressTick2 = await detectChatGPTProgress(watcherRuntime);
    let auditTick2 = await getManualSceneAudit(tmpDir, scene2Id);
    assert.strictEqual(progressTick2.isGenerating, false);
    assert.strictEqual(progressTick2.hasImage, true);
    assert.strictEqual(!auditTick2.keyframe.valid, true);

    const watcherNv1Cap = await captureManualStage(tmpDir, scene2Id, "NV1", watcherRuntime, { force: true });
    assert.strictEqual(watcherNv1Cap.ok, true);
    console.log("✓ Watcher Tick 2: Tự động lưu keyframe NV1 thành công");

    // Watcher tick 3: GPT tạo xong motion prompt NV2 -> Kích hoạt lưu NV2
    currentGptState.isGenerating = false;
    currentGptState.hasImage = false;
    currentGptState.textLength = validMotionText.length;
    currentGptState.assistantText = validMotionText;

    let progressTick3 = await detectChatGPTProgress(watcherRuntime);
    let auditTick3 = await getManualSceneAudit(tmpDir, scene2Id);
    assert.strictEqual(auditTick3.keyframe.valid, true);
    assert.strictEqual(!auditTick3.motionPrompt.valid, true);
    assert(progressTick3.textLength > 35);

    const watcherNv2Cap = await captureManualStage(tmpDir, scene2Id, "NV2", watcherRuntime, { force: true });
    assert.strictEqual(watcherNv2Cap.ok, true);
    console.log("✓ Watcher Tick 3: Tự động lưu motion prompt NV2 thành công");

    // Kiểm tra sau chu trình watcher: Scene 2 đã hoàn tất 100%
    const scene2Audit = await getManualSceneAudit(tmpDir, scene2Id);
    assert.strictEqual(scene2Audit.isSceneComplete, true);
    console.log("✓ Watcher hoàn tất trọn vẹn chu trình cho Scene 002 (Keyframe + Motion Prompt)");

    console.log("\n==================================================");
    console.log("TẤT CẢ CÁC BÀI TEST NHẬN OUTPUT TỪ GPT ĐÃ PASS!");
    console.log("==================================================");
  } finally {
    await fsPromises.rm(tmpDir, { recursive: true, force: true }).catch(() => null);
  }
}

runOutputReceivingTests().catch((err) => {
  console.error("Test thất bại:", err.stack || err);
  process.exit(1);
});
