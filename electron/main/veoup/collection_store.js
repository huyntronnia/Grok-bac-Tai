"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const {
  copyFileAtomic,
  linkOrCopyFileAtomic,
  writeTextFileAtomic,
  writeJsonFileAtomic,
  enqueueProjectWrite,
} = require("../project");
const {
  validateKeyframeFile,
  validateMotionPromptTextContent,
} = require("../pipeline/asset_validation");

const VEOUP_COLLECTION_VERSION = 1;
const VEOUP_PROMPTS_READY_FILENAME = "veoup_prompts_ready.txt";

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

function collectionPaths(projectDir, sceneId = 0) {
  const resolvedProjectDir = path.resolve(String(projectDir || ""));
  const token = sceneId ? sceneToken(sceneId) : "";
  return {
    projectDir: resolvedProjectDir,
    stateFile: path.join(resolvedProjectDir, "pipeline_state.json"),
    keyframesDir: path.join(resolvedProjectDir, "keyframes"),
    motionPromptsDir: path.join(resolvedProjectDir, "motion_prompts"),
    keyframePath: token
      ? path.join(resolvedProjectDir, "keyframes", `${token}_keyframe.png`)
      : "",
    motionPromptPath: token
      ? path.join(resolvedProjectDir, "motion_prompts", `${token}_motion_prompt.txt`)
      : "",
    promptsReadyPath: path.join(resolvedProjectDir, VEOUP_PROMPTS_READY_FILENAME),
    batchSelectionDir: path.join(resolvedProjectDir, "keyframes", "_batch_ready"),
  };
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

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const input = fs.createReadStream(filePath);
    input.on("error", reject);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("end", () => resolve(hash.digest("hex")));
  });
}

function hashText(value = "") {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

async function inspectKeyframeFile(filePath = "", { includeHash = false } = {}) {
  const resolvedPath = String(filePath || "").trim();
  if (!resolvedPath) return { ok: false, error: "missing-keyframe-path" };
  const validation = await validateKeyframeFile(resolvedPath);
  if (!validation.ok) {
    return {
      ...validation,
      path: resolvedPath,
    };
  }
  const stat = await fsp.stat(resolvedPath);
  return {
    ...validation,
    path: path.resolve(resolvedPath),
    mtimeMs: stat.mtimeMs,
    hash: includeHash ? await hashFile(resolvedPath) : "",
  };
}

async function readPipelineState(projectDir = "") {
  const { stateFile } = collectionPaths(projectDir);
  try {
    const raw = await fsp.readFile(stateFile, "utf8");
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

async function writePipelineStateUnlocked(projectDir, state) {
  const { stateFile } = collectionPaths(projectDir);
  await writeJsonFileAtomic(stateFile, state, 2);
  return stateFile;
}

async function rebuildVeoUpPromptsReadyUnlocked(projectDir, state = {}) {
  const { promptsReadyPath } = collectionPaths(projectDir);
  const readySceneIds = Object.keys(state)
    .map(Number)
    .filter((sceneId) => Number.isInteger(sceneId) && sceneId > 0 && state[sceneId]?.readyForVeoUp === true)
    .sort((a, b) => a - b);
  const lines = [];
  const sceneIds = [];
  for (const sceneId of readySceneIds) {
    const fallbackPath = collectionPaths(projectDir, sceneId).motionPromptPath;
    const promptPath = String(state[sceneId]?.veoUpMotionPromptPath || fallbackPath);
    if (!isPathInsideRoot(promptPath, projectDir)) continue;
    const text = normalizePrompt(
      state[sceneId]?.veoUpMotionPrompt ||
      await fsp.readFile(promptPath, "utf8").catch(() => ""),
    );
    if (!validateMotionPromptTextContent(text).ok) continue;
    lines.push(text);
    sceneIds.push(sceneId);
  }
  const promptText = lines.join("\n");
  await writeTextFileAtomic(promptsReadyPath, promptText);
  return {
    promptFilePath: promptsReadyPath,
    promptText,
    promptLineCount: lines.length,
    sceneIds,
  };
}

async function rebuildVeoUpPromptsReady(projectDir = "") {
  const { stateFile } = collectionPaths(projectDir);
  return enqueueProjectWrite(stateFile, async () => {
    const state = await readPipelineState(projectDir);
    return rebuildVeoUpPromptsReadyUnlocked(projectDir, state);
  });
}

async function resolvePromptText(motionPrompt = "", motionPromptPath = "") {
  const inline = normalizePrompt(motionPrompt);
  if (validateMotionPromptTextContent(inline).ok) return inline;
  const fromFile = normalizePrompt(
    await fsp.readFile(motionPromptPath, "utf8").catch(() => ""),
  );
  return validateMotionPromptTextContent(fromFile).ok ? fromFile : "";
}

async function stageSceneUnlocked({
  projectDir,
  sceneId,
  imagePath,
  keyframePath,
  motionPrompt,
  motionPromptPath,
  state,
}) {
  const id = Number(sceneId || 0);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid VeoUp collection scene ID.");
  const paths = collectionPaths(projectDir, id);
  const requestedSourceKeyframePath = String(keyframePath || imagePath || "").trim();
  if (!requestedSourceKeyframePath) throw new Error(`Scene ${id}: missing keyframe path for VeoUp collection.`);
  const sourceKeyframePath = path.resolve(requestedSourceKeyframePath);
  if (!isPathInsideRoot(sourceKeyframePath, projectDir)) {
    throw new Error(`Scene ${id}: keyframe is outside the project directory.`);
  }
  const sourceInspection = await inspectKeyframeFile(sourceKeyframePath, { includeHash: true });
  if (!sourceInspection.ok) {
    throw new Error(`Scene ${id}: invalid keyframe for VeoUp collection (${sourceInspection.error}).`);
  }
  const promptText = await resolvePromptText(motionPrompt, motionPromptPath);
  if (!promptText) throw new Error(`Scene ${id}: empty motion prompt for VeoUp collection.`);

  await copyFileAtomic(sourceKeyframePath, paths.keyframePath);
  await writeTextFileAtomic(paths.motionPromptPath, promptText);
  const stagedInspection = await inspectKeyframeFile(paths.keyframePath);
  if (!stagedInspection.ok) {
    throw new Error(`Scene ${id}: staged keyframe validation failed (${stagedInspection.error}).`);
  }

  const now = new Date().toISOString();
  const nextState = state || await readPipelineState(projectDir);
  nextState[id] = {
    ...(nextState[id] || {}),
    readyForVeoUp: true,
    veoUpReadyAt: now,
    veoUpCollectionVersion: VEOUP_COLLECTION_VERSION,
    veoUpKeyframePath: paths.keyframePath,
    veoUpMotionPromptPath: paths.motionPromptPath,
    veoUpKeyframeSize: stagedInspection.size,
    veoUpKeyframeHash: sourceInspection.hash,
    veoUpMotionPrompt: promptText,
    veoUpMotionPromptHash: hashText(promptText),
    veoUpCollectionError: "",
    updatedAt: now,
  };

  return {
    state: nextState,
    entry: {
      sceneId: id,
      keyframePath: paths.keyframePath,
      keyframeSize: stagedInspection.size,
      keyframeMtimeMs: stagedInspection.mtimeMs,
      keyframeHash: sourceInspection.hash,
      motionPromptPath: paths.motionPromptPath,
      motionPrompt: promptText,
      motionPromptHash: hashText(promptText),
      readyForVeoUp: true,
    },
  };
}

async function stageSceneForVeoUp(options = {}) {
  const projectDir = path.resolve(String(options.projectDir || ""));
  const { stateFile } = collectionPaths(projectDir);
  return enqueueProjectWrite(stateFile, async () => {
    const state = await readPipelineState(projectDir);
    const staged = await stageSceneUnlocked({ ...options, projectDir, state });
    await writePipelineStateUnlocked(projectDir, staged.state);
    const aggregate = await rebuildVeoUpPromptsReadyUnlocked(projectDir, staged.state);
    return { ...staged.entry, ...aggregate };
  });
}

async function invalidateSceneVeoUpCollection({ projectDir, sceneId, reason = "regeneration-requested" } = {}) {
  const id = Number(sceneId || 0);
  if (!projectDir || !Number.isInteger(id) || id <= 0) return { ok: false, error: "invalid-scene" };
  const { stateFile } = collectionPaths(projectDir);
  return enqueueProjectWrite(stateFile, async () => {
    const state = await readPipelineState(projectDir);
    const now = new Date().toISOString();
    state[id] = {
      ...(state[id] || {}),
      readyForVeoUp: false,
      veoUpCollectionError: String(reason || "invalidated"),
      veoUpInvalidatedAt: now,
      updatedAt: now,
    };
    await writePipelineStateUnlocked(projectDir, state);
    await rebuildVeoUpPromptsReadyUnlocked(projectDir, state);
    return { ok: true, sceneId: id, reason };
  });
}

function resolveSceneCandidate(value, projectDir, sceneId) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (path.isAbsolute(text)) return path.resolve(text);
  const normalized = text.replace(/\\/g, "/");
  if (normalized.includes("/")) return path.resolve(projectDir, normalized);
  return path.resolve(projectDir, sceneToken(sceneId), normalized);
}

async function findSceneSourceAssets(projectDir, sceneId, scene = {}) {
  if (scene.manualAuditSource === true) {
    const keyframePath = path.resolve(scene.imagePath);
    const motionPromptPath = path.resolve(scene.motionPromptPath);
    const keyframeInspection = await inspectKeyframeFile(keyframePath, { includeHash: true });
    const motionPrompt = normalizePrompt(await fsp.readFile(motionPromptPath, "utf8").catch(() => ""));
    return {
      keyframePath: keyframeInspection.ok ? keyframePath : "",
      keyframeInspection,
      motionPromptPath,
      motionPrompt: validateMotionPromptTextContent(motionPrompt).ok ? motionPrompt : "",
    };
  }
  const paths = collectionPaths(projectDir, sceneId);
  const sceneDir = path.join(projectDir, sceneToken(sceneId));
  const keyframeCandidates = [
    scene.keyframeOutputPath,
    scene.imagePath,
    scene.keyframePath,
    path.join(sceneDir, `${sceneToken(sceneId)}_keyframe.png`),
    path.join(sceneDir, "scene_keyframe.png"),
    path.join(sceneDir, "keyframe.png"),
    paths.keyframePath,
  ]
    .map((candidate) => resolveSceneCandidate(candidate, projectDir, sceneId))
    .filter((candidate) => candidate && isPathInsideRoot(candidate, projectDir));
  let keyframePath = "";
  let keyframeInspection = null;
  for (const candidate of [...new Set(keyframeCandidates)]) {
    const inspection = await inspectKeyframeFile(candidate);
    if (inspection.ok) {
      keyframePath = candidate;
      keyframeInspection = inspection;
      break;
    }
  }

  const promptCandidates = [
    scene.motionPromptOutputPath,
    scene.motionPromptPath,
    path.join(sceneDir, "motion_prompt.txt"),
    paths.motionPromptPath,
  ]
    .map((candidate) => resolveSceneCandidate(candidate, projectDir, sceneId))
    .filter((candidate) => candidate && isPathInsideRoot(candidate, projectDir));
  let motionPromptPath = "";
  let motionPrompt = "";
  for (const candidate of [...new Set(promptCandidates)]) {
    const text = normalizePrompt(await fsp.readFile(candidate, "utf8").catch(() => ""));
    if (validateMotionPromptTextContent(text).ok) {
      motionPromptPath = candidate;
      motionPrompt = text;
      break;
    }
  }
  if (!motionPrompt && !/^\[saved:\s*motion_prompt\.txt\]$/i.test(String(scene.motionPrompt || "").trim())) {
    const inlinePrompt = normalizePrompt(scene.motionPrompt || "");
    motionPrompt = validateMotionPromptTextContent(inlinePrompt).ok
      ? inlinePrompt
      : "";
  }

  return { keyframePath, keyframeInspection, motionPromptPath, motionPrompt };
}

async function reconcileVeoUpCollection(options = {}) {
  const projectDir = path.resolve(String(options.projectDir || options.outputFolder || ""));
  const expectedSceneIds = [...new Set((options.expectedSceneIds || [])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0))]
    .sort((a, b) => a - b);
  const sceneMap = new Map((options.scenes || []).map((scene, index) => [
    Number(scene?.id || scene?.sceneId || index + 1),
    scene,
  ]));
  const { stateFile } = collectionPaths(projectDir);
  return enqueueProjectWrite(stateFile, async () => {
    const state = await readPipelineState(projectDir);
    const expectedSceneIdSet = new Set(expectedSceneIds);
    for (const stateSceneId of Object.keys(state).map(Number)) {
      if (!Number.isInteger(stateSceneId) || expectedSceneIdSet.has(stateSceneId)) continue;
      if (state[stateSceneId]?.readyForVeoUp !== true) continue;
      state[stateSceneId] = {
        ...state[stateSceneId],
        readyForVeoUp: false,
        veoUpCollectionError: "not-in-current-project-scan",
        updatedAt: new Date().toISOString(),
      };
    }
    const entries = [];
    const missing = [];
    const repairedSceneIds = [];
    for (const sceneId of expectedSceneIds) {
      const assets = await findSceneSourceAssets(projectDir, sceneId, sceneMap.get(sceneId) || {});
      if (!assets.keyframePath || !assets.motionPrompt) {
        const now = new Date().toISOString();
        state[sceneId] = {
          ...(state[sceneId] || {}),
          readyForVeoUp: false,
          veoUpCollectionError: !assets.keyframePath && !assets.motionPrompt
            ? "missing-keyframe-and-motion-prompt"
            : !assets.keyframePath
              ? "missing-keyframe"
              : "missing-motion-prompt",
          updatedAt: now,
        };
        missing.push({
          sceneId,
          missingKeyframe: !assets.keyframePath,
          missingMotionPrompt: !assets.motionPrompt,
        });
        continue;
      }

      const canonical = collectionPaths(projectDir, sceneId);
      const canonicalInspection = await inspectKeyframeFile(canonical.keyframePath);
      const canonicalPrompt = normalizePrompt(
        await fsp.readFile(canonical.motionPromptPath, "utf8").catch(() => ""),
      );
      const stateEntry = state[sceneId] || {};
      const sourceKeyframeIsCanonical = path.resolve(assets.keyframePath) === path.resolve(canonical.keyframePath);
      const sourceKeyframeIsNewer = !sourceKeyframeIsCanonical &&
        Number(assets.keyframeInspection?.mtimeMs || 0) > Number(canonicalInspection.mtimeMs || 0) + 1;
      const manualSourceMatches = sceneMap.get(sceneId)?.manualAuditSource !== true ||
        (canonicalInspection.ok && await hashFile(canonical.keyframePath) === await hashFile(assets.keyframePath));
      const canonicalMatchesState = manualSourceMatches && canonicalInspection.ok &&
        canonicalPrompt &&
        canonicalPrompt === assets.motionPrompt &&
        !sourceKeyframeIsNewer &&
        stateEntry.readyForVeoUp === true &&
        Number(stateEntry.veoUpCollectionVersion || 0) === VEOUP_COLLECTION_VERSION &&
        (!stateEntry.veoUpKeyframeSize || Number(stateEntry.veoUpKeyframeSize) === canonicalInspection.size) &&
        (!stateEntry.veoUpMotionPromptHash || stateEntry.veoUpMotionPromptHash === hashText(canonicalPrompt));

      let staged;
      if (canonicalMatchesState) {
        staged = {
          state,
          entry: {
            sceneId,
            keyframePath: canonical.keyframePath,
            keyframeSize: canonicalInspection.size,
            keyframeMtimeMs: canonicalInspection.mtimeMs,
            keyframeHash: stateEntry.veoUpKeyframeHash || "",
            motionPromptPath: canonical.motionPromptPath,
            motionPrompt: canonicalPrompt,
            motionPromptHash: hashText(canonicalPrompt),
            readyForVeoUp: true,
          },
        };
      } else {
        staged = await stageSceneUnlocked({
          projectDir,
          sceneId,
          keyframePath: assets.keyframePath,
          motionPrompt: assets.motionPrompt,
          motionPromptPath: assets.motionPromptPath,
          state,
        });
        repairedSceneIds.push(sceneId);
      }
      entries.push(staged.entry);
    }

    await writePipelineStateUnlocked(projectDir, state);
    const aggregate = await rebuildVeoUpPromptsReadyUnlocked(projectDir, state);
    return {
      ok: true,
      projectDir,
      expectedSceneIds,
      entries,
      missing,
      repairedSceneIds,
      aggregate,
    };
  });
}

async function prepareVeoUpBatchSelectionFolder(projectDir = "", entries = []) {
  const paths = collectionPaths(projectDir);
  const expectedNames = new Set(entries.map((entry) => `${sceneToken(entry.sceneId)}_keyframe.png`));
  await fsp.mkdir(paths.batchSelectionDir, { recursive: true });
  const existing = await fsp.readdir(paths.batchSelectionDir, { withFileTypes: true }).catch(() => []);
  for (const item of existing) {
    if (!item.isFile() || expectedNames.has(item.name)) continue;
    await fsp.rm(path.join(paths.batchSelectionDir, item.name), { force: true });
  }
  for (const entry of entries) {
    const fileName = `${sceneToken(entry.sceneId)}_keyframe.png`;
    const targetPath = path.join(paths.batchSelectionDir, fileName);
    await linkOrCopyFileAtomic(entry.keyframePath || entry.path, targetPath);
  }
  const files = (await fsp.readdir(paths.batchSelectionDir, { withFileTypes: true }))
    .filter((item) => item.isFile() && expectedNames.has(item.name))
    .map((item) => item.name)
    .sort();
  if (files.length !== expectedNames.size) {
    throw new Error(`VeoUp batch selection folder mismatch: ${files.length}/${expectedNames.size}.`);
  }
  return {
    keyframesDir: paths.batchSelectionDir,
    keyframes: entries.map((entry) => ({
      ...entry,
      path: path.join(paths.batchSelectionDir, `${sceneToken(entry.sceneId)}_keyframe.png`),
      file: `${sceneToken(entry.sceneId)}_keyframe.png`,
    })),
  };
}

module.exports = {
  VEOUP_COLLECTION_VERSION,
  VEOUP_PROMPTS_READY_FILENAME,
  sceneToken,
  normalizePrompt,
  collectionPaths,
  hashText,
  hashFile,
  inspectKeyframeFile,
  readPipelineState,
  rebuildVeoUpPromptsReady,
  stageSceneForVeoUp,
  invalidateSceneVeoUpCollection,
  reconcileVeoUpCollection,
  prepareVeoUpBatchSelectionFolder,
};
