const { validateManualKeyframe } = require("./manual_image_validation");
"use strict";

const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const {
  validateKeyframeFile,
  validateMotionPromptTextContent,
} = require("../pipeline/asset_validation");

function normalizeExpectedSceneIds(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("manual-audit-expected-scenes-required");
  }
  const ids = values.map(Number);
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error("manual-audit-invalid-scene-id");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("manual-audit-duplicate-scene-id");
  }
  return ids;
}

function sceneToken(sceneId) {
  return `scene_${String(sceneId).padStart(3, "0")}`;
}

async function hashFile(filePath) {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function inspectMotionPrompt(filePath) {
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat?.isFile?.()) {
    return { exists: false, valid: false, path: filePath, hash: "", error: "missing-file" };
  }
  const text = await fs.readFile(filePath, "utf8").catch(() => "");
  const validation = validateMotionPromptTextContent(text);
  return {
    exists: true,
    valid: validation.ok === true,
    path: filePath,
    hash: await hashFile(filePath).catch(() => ""),
    size: stat.size,
    length: text.length,
    error: validation.ok ? "" : validation.error || "invalid-motion-prompt",
  };
}

async function inspectKeyframe(filePath) {
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat?.isFile?.()) {
    return { exists: false, valid: false, path: filePath, hash: "", error: "missing-file" };
  }
  const validation = await validateManualKeyframe(filePath);
  return {
    exists: true,
    valid: validation.ok === true,
    path: filePath,
    hash: await hashFile(filePath).catch(() => ""),
    size: Number(validation.byteLength || stat.size || 0),
    width: Number(validation.width || 0),
    height: Number(validation.height || 0),
    error: validation.ok ? "" : validation.error || "invalid-keyframe",
  };
}

async function auditManualProject(projectPath, expectedSceneIds, options = {}) {
  const projectDir = path.resolve(String(projectPath || ""));
  if (!String(projectPath || "").trim()) throw new Error("manual-audit-project-path-required");
  const ids = normalizeExpectedSceneIds(expectedSceneIds);
  const sourceMap = options.sourceMap && typeof options.sourceMap === "object"
    ? options.sourceMap
    : {};
  const scenes = [];

  for (const sceneId of ids) {
    const token = sceneToken(sceneId);
    const sceneDir = path.join(projectDir, token);
    const mapped = sourceMap[sceneId] || sourceMap[token] || {};
    const keyframePath = path.resolve(String(
      mapped.keyframePath || path.join(sceneDir, `${token}_keyframe.png`),
    ));
    const motionPromptPath = path.resolve(String(
      mapped.motionPromptPath || path.join(sceneDir, "motion_prompt.txt"),
    ));
    const [keyframe, motionPrompt] = await Promise.all([
      inspectKeyframe(keyframePath),
      inspectMotionPrompt(motionPromptPath),
    ]);
    if (mapped.invalidatedKeyframe) {
      keyframe.valid = false;
      keyframe.error = "redo-required";
    }
    if (mapped.invalidatedMotion) {
      motionPrompt.valid = false;
      motionPrompt.error = "keyframe-redone-motion-required";
    }
    const readyForVeoUp = keyframe.valid && motionPrompt.valid;
    let stage = "NV1";
    if (keyframe.valid && !motionPrompt.valid) stage = "NV2";
    if (readyForVeoUp) stage = "COMPLETE";
    scenes.push({
      sceneId,
      sceneToken: token,
      sceneDir,
      keyframe,
      motionPrompt,
      stage,
      readyForVeoUp,
    });
  }

  const readyCount = scenes.filter((scene) => scene.readyForVeoUp).length;
  const firstIncomplete = scenes.find((scene) => !scene.readyForVeoUp) || null;
  return {
    ok: true,
    projectPath: projectDir,
    expectedSceneIds: ids,
    expectedCount: ids.length,
    readyCount,
    complete: readyCount === ids.length,
    firstIncompleteSceneId: firstIncomplete?.sceneId || null,
    scenes,
    auditedAt: new Date().toISOString(),
  };
}

module.exports = {
  normalizeExpectedSceneIds,
  auditManualProject,
};
