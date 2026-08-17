"use strict";

const fs = require("fs/promises");
const { nativeImage } = require("electron");

const KEYFRAME_MIN_BYTES = 4096;
const KEYFRAME_MIN_DIMENSION = 256;
const MOTION_PROMPT_MIN_LENGTH = 120;

function normalizeComparableText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function detectSupportedImageFormat(buffer) {
  const png =
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (png) return "png";
  const jpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;
  if (jpeg) return "jpeg";
  const webp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return webp ? "webp" : "";
}

async function validateKeyframeFile(filePath = "") {
  const resolvedPath = String(filePath || "").trim();
  if (!resolvedPath) return { ok: false, error: "missing-file", filePath };

  const stat = await fs.stat(resolvedPath).catch(() => null);
  if (!stat?.isFile?.()) {
    return { ok: false, error: "missing-file", filePath: resolvedPath };
  }
  if (stat.size < KEYFRAME_MIN_BYTES) {
    return {
      ok: false,
      error: "file-too-small",
      filePath: resolvedPath,
      size: stat.size,
      byteLength: stat.size,
    };
  }

  const buffer = await fs.readFile(resolvedPath).catch(() => null);
  if (!buffer) {
    return {
      ok: false,
      error: "file-unreadable",
      filePath: resolvedPath,
      size: stat.size,
      byteLength: stat.size,
    };
  }
  const format = detectSupportedImageFormat(buffer);
  if (!format) {
    return {
      ok: false,
      error: "image-header-invalid",
      filePath: resolvedPath,
      size: buffer.length,
      byteLength: buffer.length,
    };
  }

  if (!nativeImage?.createFromBuffer) {
    return {
      ok: true,
      filePath: resolvedPath,
      size: buffer.length,
      byteLength: buffer.length,
      format,
    };
  }

  const image = nativeImage.createFromBuffer(buffer);
  if (!image || image.isEmpty()) {
    if (!image) {
      return {
        ok: true,
        filePath: resolvedPath,
        size: buffer.length,
        byteLength: buffer.length,
        format,
      };
    }
    return {
      ok: false,
      error: "image-decode-failed",
      filePath: resolvedPath,
      size: buffer.length,
      byteLength: buffer.length,
      format,
    };
  }
  const dimensions = image.getSize();
  if (
    dimensions.width < KEYFRAME_MIN_DIMENSION ||
    dimensions.height < KEYFRAME_MIN_DIMENSION
  ) {
    return {
      ok: false,
      error: "image-dimensions-too-small",
      filePath: resolvedPath,
      size: buffer.length,
      byteLength: buffer.length,
      width: dimensions.width,
      height: dimensions.height,
      format,
    };
  }

  return {
    ok: true,
    filePath: resolvedPath,
    size: buffer.length,
    byteLength: buffer.length,
    width: dimensions.width,
    height: dimensions.height,
    format,
  };
}

function validateMotionPromptTextContent(
  text = "",
  { beforeText = "", instruction = "", taskPrompt = "" } = {},
) {
  const value = String(text || "").trim();
  if (!value) return { ok: false, error: "empty-response" };
  if (normalizeComparableText(value) === normalizeComparableText(beforeText)) {
    return { ok: false, error: "same-as-before" };
  }

  const lower = value.toLowerCase();
  const instructionHead = normalizeComparableText(instruction)
    .slice(0, 120)
    .toLowerCase();
  const taskHead = normalizeComparableText(taskPrompt)
    .slice(0, 120)
    .toLowerCase();
  if (instructionHead && lower.startsWith(instructionHead.slice(0, 80))) {
    return { ok: false, error: "echoed-user-instruction" };
  }
  if (taskHead && lower.startsWith(taskHead.slice(0, 80))) {
    return { ok: false, error: "echoed-task-prompt" };
  }
  if (
    /^thought\s+for\s+\d+/i.test(value) ||
    /^edit$/i.test(value) ||
    /\bThought\s+for\s+\d+[^\n]*(\n|\s)*Edit\b/i.test(value)
  ) {
    return { ok: false, error: "thinking-summary-not-final" };
  }
  if (
    /nhiệm\s*vụ\s*2\s*:|show more|đoạn đầu scene|vừa tạo/i.test(value) &&
    value.length < 900
  ) {
    return { ok: false, error: "looks-like-collapsed-user-prompt" };
  }
  if (
    /(?:đang|dang)\s+(?:phân\s*tích|phan\s*tich|xử\s*lý|xu\s*ly)|\b(?:analyzing|processing|loading|thinking)\b/i.test(
      value,
    ) &&
    value.length < 500
  ) {
    return { ok: false, error: "loading-status-not-final" };
  }
  if (value.length < MOTION_PROMPT_MIN_LENGTH) {
    return { ok: false, error: "too-short" };
  }
  return { ok: true, text: value };
}

module.exports = {
  KEYFRAME_MIN_BYTES,
  KEYFRAME_MIN_DIMENSION,
  MOTION_PROMPT_MIN_LENGTH,
  detectSupportedImageFormat,
  validateKeyframeFile,
  validateMotionPromptTextContent,
};
