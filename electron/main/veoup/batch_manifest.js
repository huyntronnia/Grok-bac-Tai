const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

function sceneToken(sceneId) {
  return `scene_${String(sceneId).padStart(3, "0")}`;
}

async function fileStat(filePath = "") {
  if (!filePath) return null;
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.size > 0 ? stat : null;
  } catch (_error) {
    return null;
  }
}

function isPathInsideRoot(filePath = "", rootPath = "") {
  if (!filePath || !rootPath) return false;
  const relative = path.relative(path.resolve(rootPath), path.resolve(filePath));
  return relative === "" || (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function resolveSceneCandidate(value, projectDir, sceneId) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (path.isAbsolute(text)) return path.resolve(text);
  const normalized = text.replace(/\\/g, "/");
  if (normalized.includes("/")) return path.resolve(projectDir, normalized);
  return path.resolve(projectDir, sceneToken(sceneId), normalized);
}

function normalizePrompt(text = "") {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSavedPromptPlaceholder(value = "") {
  return /^\[saved:\s*motion_prompt\.txt\]$/i.test(String(value || "").trim());
}

function normalizeExpectedSceneIds({ expectedSceneIds, expectedSceneCount, scenes }) {
  if (Array.isArray(expectedSceneIds) && expectedSceneIds.length) {
    return expectedSceneIds.map(Number).filter((id) => Number.isInteger(id) && id > 0);
  }
  if (Array.isArray(scenes) && scenes.length) {
    return scenes
      .map((scene, index) => Number(scene?.id || scene?.sceneId || index + 1))
      .filter((id) => Number.isInteger(id) && id > 0);
  }
  const count = Number(expectedSceneCount || 0);
  return Number.isInteger(count) && count > 0
    ? Array.from({ length: count }, (_, index) => index + 1)
    : [];
}

async function scanSceneIds(projectDir) {
  const entries = await fs.readdir(projectDir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory() && /^scene_\d+$/i.test(entry.name))
    .map((entry) => Number(entry.name.match(/\d+/)?.[0] || 0))
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((a, b) => a - b);
}

async function findKeyframe(projectDir, sceneId, scene = {}) {
  const token = sceneToken(sceneId);
  const sceneDir = path.join(projectDir, token);
  const candidates = [
    scene.keyframeOutputPath,
    scene.imagePath,
    path.join(projectDir, "keyframes", `${token}_keyframe.png`),
    path.join(sceneDir, `${token}_keyframe.png`),
    path.join(sceneDir, "scene_keyframe.png"),
    path.join(sceneDir, "keyframe.png"),
  ]
    .map((candidate) => resolveSceneCandidate(candidate, projectDir, sceneId))
    .filter(Boolean);

  for (const candidate of [...new Set(candidates)]) {
    if (!isPathInsideRoot(candidate, projectDir)) continue;
    if (!/\.png$/i.test(candidate)) continue;
    const stat = await fileStat(candidate);
    if (stat) return { path: candidate, stat };
  }
  return null;
}

async function findMotionPrompt(projectDir, sceneId, scene = {}) {
  const sceneDir = path.join(projectDir, sceneToken(sceneId));
  const candidates = [
    scene.motionPromptOutputPath,
    scene.motionPromptPath,
    path.join(sceneDir, "motion_prompt.txt"),
  ]
    .map((candidate) => resolveSceneCandidate(candidate, projectDir, sceneId))
    .filter(Boolean);

  for (const candidate of [...new Set(candidates)]) {
    if (!isPathInsideRoot(candidate, projectDir)) continue;
    const stat = await fileStat(candidate);
    if (!stat) continue;
    const text = normalizePrompt(await fs.readFile(candidate, "utf8").catch(() => ""));
    if (text) return { path: candidate, text, stat };
  }

  const inlineText = isSavedPromptPlaceholder(scene.motionPrompt)
    ? ""
    : normalizePrompt(scene.motionPrompt || "");
  return inlineText ? { path: "", text: inlineText, stat: null } : null;
}

function hashText(value = "") {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

async function buildVeoUpBatchManifest(options = {}) {
  const requestedProjectDir = String(
    options.projectDir || options.outputFolder || "",
  ).trim();
  const projectDir = requestedProjectDir ? path.resolve(requestedProjectDir) : "";
  const projectStat = await fs.stat(projectDir).catch(() => null);
  if (!projectStat?.isDirectory()) {
    return {
      ok: false,
      status: "validation_failed",
      error: "veoup-project-directory-missing",
      projectDir,
      expectedSceneCount: 0,
      readySceneCount: 0,
      entries: [],
      missing: [],
      duplicates: [],
    };
  }

  const scenes = Array.isArray(options.scenes) ? options.scenes : [];
  const sceneMap = new Map();
  const duplicates = [];
  scenes.forEach((scene, index) => {
    const sceneId = Number(scene?.id || scene?.sceneId || index + 1);
    if (!Number.isInteger(sceneId) || sceneId <= 0) return;
    if (sceneMap.has(sceneId)) duplicates.push(sceneId);
    else sceneMap.set(sceneId, scene);
  });

  let expectedSceneIds = normalizeExpectedSceneIds({
    expectedSceneIds: options.expectedSceneIds,
    expectedSceneCount: options.expectedSceneCount,
    scenes,
  });
  if (!expectedSceneIds.length) expectedSceneIds = await scanSceneIds(projectDir);
  const expectedDuplicates = expectedSceneIds.filter(
    (id, index) => expectedSceneIds.indexOf(id) !== index,
  );
  duplicates.push(...expectedDuplicates);
  expectedSceneIds = [...new Set(expectedSceneIds)].sort((a, b) => a - b);

  const entries = [];
  const missing = [];
  for (const sceneId of expectedSceneIds) {
    const scene = sceneMap.get(sceneId) || {};
    const [keyframe, prompt] = await Promise.all([
      findKeyframe(projectDir, sceneId, scene),
      findMotionPrompt(projectDir, sceneId, scene),
    ]);
    if (!keyframe || !prompt) {
      missing.push({
        sceneId,
        missingKeyframe: !keyframe,
        missingMotionPrompt: !prompt,
      });
      continue;
    }
    entries.push({
      sceneId,
      keyframePath: keyframe.path,
      keyframeSize: Number(keyframe.stat.size || 0),
      keyframeMtimeMs: Number(keyframe.stat.mtimeMs || 0),
      motionPromptPath: prompt.path,
      motionPrompt: prompt.text,
      motionPromptHash: hashText(prompt.text),
    });
  }

  const ok = expectedSceneIds.length > 0 &&
    entries.length === expectedSceneIds.length &&
    missing.length === 0 &&
    duplicates.length === 0;
  return {
    ok,
    status: ok ? "validated" : "validation_failed",
    error: ok ? "" : "veoup-batch-manifest-incomplete",
    projectDir,
    expectedSceneIds,
    expectedSceneCount: expectedSceneIds.length,
    readySceneCount: entries.length,
    entries,
    missing,
    duplicates: [...new Set(duplicates)].sort((a, b) => a - b),
  };
}

function createVeoUpBatchFingerprint(manifest = {}, options = {}) {
  const stable = {
    version: 1,
    projectDir: path.resolve(String(manifest.projectDir || "")),
    entries: (manifest.entries || []).map((entry) => ({
      sceneId: entry.sceneId,
      keyframeSize: entry.keyframeSize,
      keyframeMtimeMs: Math.round(Number(entry.keyframeMtimeMs || 0)),
      motionPromptHash: entry.motionPromptHash,
    })),
    previewStartButtonOnly: Boolean(options.previewStartButtonOnly),
    autoStartVideoGeneration: options.autoStartVideoGeneration !== false,
  };
  return `sha256:${hashText(JSON.stringify(stable))}`;
}

function manifestToAutomationScenes(manifest = {}) {
  return (manifest.entries || []).map((entry) => ({
    id: entry.sceneId,
    sceneId: entry.sceneId,
    imagePath: entry.keyframePath,
    keyframeOutputPath: entry.keyframePath,
    motionPromptPath: entry.motionPromptPath,
    motionPrompt: entry.motionPrompt,
  }));
}

module.exports = {
  sceneToken,
  normalizePrompt,
  buildVeoUpBatchManifest,
  createVeoUpBatchFingerprint,
  manifestToAutomationScenes,
};
