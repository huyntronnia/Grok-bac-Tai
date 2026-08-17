const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const {
  reconcileVeoUpCollection,
} = require("./collection_store");

function sceneToken(sceneId) {
  return `scene_${String(sceneId).padStart(3, "0")}`;
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

  const reconciliation = await reconcileVeoUpCollection({
    projectDir,
    expectedSceneIds,
    scenes,
  });
  const entries = reconciliation.entries || [];
  const missing = reconciliation.missing || [];
  const allowPartial = options.allowPartial === true;
  const complete = entries.length === expectedSceneIds.length && missing.length === 0;
  const ok = expectedSceneIds.length > 0 &&
    entries.length > 0 &&
    (allowPartial || complete) &&
    duplicates.length === 0;
  const partial = ok && !complete;
  return {
    ok,
    status: ok ? (partial ? "validated_partial" : "validated") : "validation_failed",
    error: ok ? "" : "veoup-batch-manifest-incomplete",
    projectDir,
    expectedSceneIds,
    expectedSceneCount: expectedSceneIds.length,
    readySceneCount: entries.length,
    partial,
    skippedSceneIds: missing.map((item) => item.sceneId),
    repairedSceneIds: reconciliation.repairedSceneIds || [],
    entries,
    missing,
    duplicates: [...new Set(duplicates)].sort((a, b) => a - b),
  };
}

function createVeoUpBatchFingerprint(manifest = {}, options = {}) {
  const stable = {
    version: 2,
    projectDir: path.resolve(String(manifest.projectDir || "")),
    entries: (manifest.entries || []).map((entry) => ({
      sceneId: entry.sceneId,
      keyframeHash: entry.keyframeHash || "",
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
