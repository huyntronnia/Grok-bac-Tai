const { app } = require("electron");
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
  pathExists,
  getFileStat,
  getFfmpegBinaryPath,
  ensureProjectFilePath,
  hasFullPrivateEmail,
  getUserPromptDir,
  getHardPromptConfigPath,
  HARD_PROMPT_FILENAME,
};
