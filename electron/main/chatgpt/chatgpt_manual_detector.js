"use strict";

const fs = require("fs/promises");
const path = require("path");
const { evaluateOnCdpPage, getConversationState } = require("./chatgpt_core");
const {
  countChatGptImageAgentTurnsScript,
} = require("./chatgpt_dom");
const { isChatGptActivelyGenerating } = require("../state");
const { validateMotionPromptTextContent } = require("../pipeline/asset_validation");
const {
  extractLatestChatGPTGeneratedImageBytes,
  saveChatGPTGeneratedImageAsset,
  validateSavedImageFile,
  captureChatGptImageElementScreenshot,
} = require("./chatgpt_pipeline");
const chatGptRuntimeMonitor = require("./chatgpt_runtime_monitor");
const { sleep } = require("../utils");

function isManualModeActive(options = {}) {
  return Boolean(
    options?.manualChatGPT ||
    options?.pipelineMode === "manualChatGPT" ||
    globalThis.__vidoraManualChatGPTMode
  );
}

function assertManualModeActionBlocked(actionName) {
  if (isManualModeActive()) {
    const errorMsg = `[ManualChatGPT Guard] Action '${actionName}' is strictly prohibited in manual capture mode.`;
    console.warn(errorMsg);
    throw new Error(errorMsg);
  }
}

async function captureBaselineSnapshot(page) {
  if (!page) {
    return {
      ok: false,
      timestamp: new Date().toISOString(),
      conversationId: "",
      userCount: 0,
      assistantCount: 0,
      imageCount: 0,
      existingUrls: [],
    };
  }

  const conversationState = await getConversationState(page).catch(() => null);
  const imageCount = await evaluateOnCdpPage(
    page,
    `(${countChatGptImageAgentTurnsScript.toString()})()`,
  ).catch(() => 0);

  const existingUrls = await evaluateOnCdpPage(
    page,
    `(() => {
      const urls = [];
      const imgs = document.querySelectorAll('.agent-turn img, [data-message-author-role="assistant"] img');
      imgs.forEach((img) => {
        const src = img.currentSrc || img.src || '';
        if (src && !src.startsWith('data:')) urls.push(src);
      });
      return urls;
    })()`,
  ).catch(() => []);

  return {
    ok: true,
    timestamp: new Date().toISOString(),
    conversationId: conversationState?.conversationId || "",
    userCount: Number(conversationState?.userTurnCount || conversationState?.userCount || 0),
    assistantCount: Number(conversationState?.assistantTurnCount || conversationState?.assistantCount || 0),
    imageCount: Number(imageCount || 0),
    existingUrls: Array.isArray(existingUrls) ? existingUrls : [],
  };
}

async function waitForStreamingLifecycle(page, options = {}) {
  const {
    timeoutMs = 60000,
    pollIntervalMs = 800,
    debounceMs = 1800,
  } = options;

  if (!page) return { ok: false, error: "no-page" };

  const start = Date.now();
  let seenGenerating = false;

  while (Date.now() - start < timeoutMs) {
    const state = await getConversationState(page).catch(() => null);
    const generating = Boolean(
      isChatGptActivelyGenerating(state) ||
      state?.composerBusy ||
      state?.stopButtonVisible ||
      chatGptRuntimeMonitor?.state === "GENERATING"
    );

    if (generating) {
      seenGenerating = true;
    } else if (seenGenerating) {
      // Transition GENERATING -> IDLE detected, debounce to let DOM settle
      await sleep(debounceMs);
      return { ok: true, settled: true, waitDurationMs: Date.now() - start };
    }

    await sleep(pollIntervalMs);
  }

  return { ok: false, timedOut: true, seenGenerating };
}

async function tailScanFallback(page, stage = "NV1") {
  if (!page) return { ok: false, error: "no-page" };

  if (stage === "NV1") {
    // Scan backwards from bottom of the page for latest completed image/canvas
    const fallbackImage = await evaluateOnCdpPage(
      page,
      `(async () => {
        try {
          const candidates = [
            ...document.querySelectorAll('.agent-turn .group\\\\/imagegen-image img'),
            ...document.querySelectorAll('.agent-turn img'),
            ...document.querySelectorAll('[data-message-author-role="assistant"] img'),
            ...document.querySelectorAll('.agent-turn canvas'),
          ].filter((el) => {
            if (!el) return false;
            if (el.tagName === 'IMG') {
              return el.complete && (el.naturalWidth >= 256 || el.clientWidth >= 256);
            }
            if (el.tagName === 'CANVAS') {
              return (el.width >= 256 || el.clientWidth >= 256);
            }
            return false;
          });

          if (!candidates.length) return { ok: false, error: 'no-tail-candidates' };
          const el = candidates[candidates.length - 1];

          if (el.tagName === 'CANVAS') {
            const dataUrl = el.toDataURL('image/png');
            const base64 = dataUrl.replace(/^data:image\\/[a-z]+;base64,/, '');
            return { ok: true, base64, contentType: 'image/png', method: 'tail-canvas' };
          }

          const src = el.currentSrc || el.src || el.getAttribute('src');
          if (!src) return { ok: false, error: 'img-no-src' };
          if (src.startsWith('data:image/')) {
            return { ok: true, base64: src.replace(/^data:image\\/[a-z]+;base64,/, ''), contentType: 'image/png', method: 'tail-data-url' };
          }

          const resp = await fetch(src, { credentials: 'include', cache: 'no-store' });
          if (!resp.ok) return { ok: false, error: 'tail-fetch-' + resp.status };
          const blob = await resp.blob();
          const reader = new FileReader();
          const base64 = await new Promise((res, rej) => {
            reader.onloadend = () => res(String(reader.result || '').replace(/^data:image\\/[a-z]+;base64,/, ''));
            reader.onerror = rej;
            reader.readAsDataURL(blob);
          });
          return { ok: true, base64, contentType: blob.type || 'image/png', method: 'tail-fetch' };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      })()`,
    ).catch((err) => ({ ok: false, error: err.message }));

    return fallbackImage;
  }

  // NV2 text fallback: tail assistant element
  const tailText = await evaluateOnCdpPage(
    page,
    `(() => {
      const turns = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
      if (!turns.length) return "";
      const last = turns[turns.length - 1];
      return String(last.innerText || last.textContent || "").trim();
    })()`,
  ).catch(() => "");

  if (tailText) {
    const valid = validateMotionPromptTextContent(tailText);
    return { ok: valid.ok, text: tailText, reason: valid.reason, method: "tail-text" };
  }

  return { ok: false, error: "no-tail-assistant-text" };
}

async function extractAndSaveManualKeyframe(page, targetPath, options = {}) {
  const { sceneId = "", baseline = null } = options;
  if (!page) throw new Error("extractAndSaveManualKeyframe: missing CDP page");
  if (!targetPath) throw new Error("extractAndSaveManualKeyframe: missing targetPath");

  const existingUrls = baseline?.existingUrls || [];

  // Attempt 1: Standard pipeline image extraction
  let extracted = await extractLatestChatGPTGeneratedImageBytes(page, {
    existingUrls,
  }).catch(() => null);

  // Attempt 2: Screenshot candidate fallback
  if ((!extracted || !extracted.ok || !extracted.base64) && extracted?.screenshotCandidate) {
    const shot = await captureChatGptImageElementScreenshot(page, extracted.screenshotCandidate, { sceneId }).catch(() => null);
    if (shot?.ok && shot.base64) {
      extracted = shot;
    }
  }

  // Attempt 3: Tail-scan fallback
  if (!extracted || !extracted.ok || !extracted.base64) {
    const tailResult = await tailScanFallback(page, "NV1");
    if (tailResult?.ok && tailResult.base64) {
      extracted = tailResult;
    }
  }

  if (!extracted || !extracted.ok || !extracted.base64) {
    throw new Error(extracted?.error || "Không thể trích xuất ảnh Keyframe từ ChatGPT");
  }

  const saved = await saveChatGPTGeneratedImageAsset(extracted.base64, targetPath);
  if (!saved?.ok && !saved?.path) {
    throw new Error("Lỗi khi lưu tệp ảnh keyframe: " + (saved?.error || "unknown"));
  }

  const validated = await validateSavedImageFile(targetPath);
  if (!validated.ok) {
    throw new Error("Xác thực tệp ảnh keyframe thất bại: " + (validated.reason || "invalid image"));
  }

  return {
    ok: true,
    path: targetPath,
    bytes: validated.bytes || extracted.byteLength || 0,
    width: extracted.width || 0,
    height: extracted.height || 0,
    method: extracted.method || "auto",
  };
}

async function extractAndSaveManualMotionPrompt(page, targetPath, options = {}) {
  const { baseline = null } = options;
  if (!page) throw new Error("extractAndSaveManualMotionPrompt: missing CDP page");
  if (!targetPath) throw new Error("extractAndSaveManualMotionPrompt: missing targetPath");

  let text = await evaluateOnCdpPage(
    page,
    `(() => {
      const turns = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
      if (!turns.length) return "";
      const last = turns[turns.length - 1];
      return String(last.innerText || last.textContent || "").trim();
    })()`,
  ).catch(() => "");

  if (!text) {
    const tailResult = await tailScanFallback(page, "NV2");
    if (tailResult?.ok && tailResult.text) {
      text = tailResult.text;
    }
  }

  if (!text) {
    throw new Error("Không tìm thấy nội dung phản hồi văn bản từ ChatGPT cho Motion Prompt NV2");
  }

  const validation = validateMotionPromptTextContent(text);
  if (!validation.ok) {
    throw new Error(`Nội dung phản hồi không hợp lệ cho motion prompt: ${validation.reason}`);
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, text, "utf8");

  return {
    ok: true,
    path: targetPath,
    text,
    length: text.length,
  };
}

module.exports = {
  isManualModeActive,
  assertManualModeActionBlocked,
  captureBaselineSnapshot,
  waitForStreamingLifecycle,
  tailScanFallback,
  extractAndSaveManualKeyframe,
  extractAndSaveManualMotionPrompt,
};
