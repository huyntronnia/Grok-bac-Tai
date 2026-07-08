const { app, nativeImage } = require("electron");
const ffmpegPath = require("ffmpeg-static");
const fs = require("fs/promises");
const path = require("path");
const { EMAIL_PATTERN } = require("../logging");

const HARD_PROMPT_FILENAME = "2 NHIỆM VỤ BẰNG PROMPT.txt";

function sanitizeFileName(value) {
  return (
    String(value)
      .replace(/[<>:"/\\|?*]+/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "ai-scene-project"
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeVideoProvider(provider) {
  if (provider === "grok") return "grok";
  if (provider === "pixverse") return "pixverse";
  return 'veoup';
}

function normalizeContinuityReferenceSettings(settings = {}) {
  const maxKeyFrames = Math.max(
    0,
    Math.min(3, Number(settings.maxKeyFrames ?? 3) || 3),
  );
  return {
    enabled: settings.enabled !== false,
    includeLastFrame: settings.includeLastFrame !== false,
    maxKeyFrames,
    sendToChatGPT: settings.sendToChatGPT !== false,
    sendToGrok: settings.sendToGrok === true,
  };
}

async function findSceneKeyframePathSafe(sceneDir, sceneId) {
  const candidates = [
    path.join(
      sceneDir,
      `scene_${String(sceneId).padStart(3, "0")}_keyframe.png`,
    ),
    path.join(sceneDir, "scene_keyframe.png"),
    path.join(sceneDir, "keyframe.png"),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch (_error) {}
  }

  return "";
}

async function validateContinuityReferenceImage(filePath = "") {
  if (!filePath || !(await pathExists(filePath)))
    return { ok: false, error: "missing-file", filePath };
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat || stat.size < 2048)
    return {
      ok: false,
      error: "file-too-small",
      filePath,
      size: stat?.size || 0,
    };
  const image = nativeImage.createFromPath(filePath);
  if (image.isEmpty())
    return {
      ok: false,
      error: "image-decode-failed",
      filePath,
      size: stat.size,
    };
  const size = image.getSize();
  if (size.width < 64 || size.height < 64)
    return {
      ok: false,
      error: "image-dimensions-too-small",
      filePath,
      size: stat.size,
      width: size.width,
      height: size.height,
    };
  return {
    ok: true,
    filePath,
    size: stat.size,
    width: size.width,
    height: size.height,
  };
}

async function pathExists(filePath) {
  if (!filePath) return false;
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function getFileStat(filePath) {
  if (!filePath) return { exists: false, size: 0, mtimeMs: 0 };
  try {
    const stat = await fs.stat(filePath);
    return {
      exists: Boolean(stat?.isFile?.()),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
    };
  } catch (_error) {
    return { exists: false, size: 0, mtimeMs: 0 };
  }
}

function getFfmpegBinaryPath() {
  const bundledPath = app.isPackaged
    ? path.join(process.resourcesPath, "ffmpeg.exe")
    : "";
  return bundledPath || ffmpegPath || "ffmpeg";
}

function ensureProjectFilePath(filePath) {
  if (!filePath || path.extname(filePath).toLowerCase() !== ".vdra") {
    throw new Error("Project file must use the .vdra extension.");
  }
  return filePath;
}

function hasFullPrivateEmail(value) {
  const match = String(value || "").match(EMAIL_PATTERN);
  if (!match) return false;
  return !/^\*+@/.test(match[0]) && !/\*{2,}/.test(match[0]);
}

function getUserPromptDir() {
  return path.join(app.getPath("userData"), "prompts");
}

function getHardPromptConfigPath() {
  return path.join(app.getPath("userData"), "hard-prompt-config.json");
}

module.exports = {
  sanitizeFileName,
  sleep,
  normalizeVideoProvider,
  normalizeContinuityReferenceSettings,
  findSceneKeyframePathSafe,
  validateContinuityReferenceImage,
  pathExists,
  getFileStat,
  getFfmpegBinaryPath,
  ensureProjectFilePath,
  hasFullPrivateEmail,
  getUserPromptDir,
  getHardPromptConfigPath,
  HARD_PROMPT_FILENAME,
};
