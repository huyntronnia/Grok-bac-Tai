const path = require("path");
const { migrateProjectWorkflowMode } = require("../state/workflow_mode");

const PROJECT_ASSET_STORAGE_MODE = "external-relative-v1";

const SCENE_PATH_KEYS = [
  "keyframePath",
  "imagePath",
  "videoPath",
  "lastFramePath",
  "sourceVideoPath",
  "sourceDownloadPath",
  "keyframeOutputPath",
  "motionPromptPath",
  "motionPromptOutputPath",
];

const TIMELINE_PATH_KEYS = [
  "path",
  "outputPath",
  "videoPath",
  "keyframePath",
  "imagePath",
];

function cloneJsonValue(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function cloneProjectPayloadForSave(value) {
  return JSON.parse(JSON.stringify(value || {}, (key, child) => {
    if (key === "embeddedAssets" || key === "imageDataUrl" || key === "videoDataUrl") {
      return undefined;
    }
    if (typeof child === "string" && /^data:(?:image|video)\//i.test(child.trim())) {
      return undefined;
    }
    return child;
  }));
}

function isNonFileReference(value = "") {
  const text = String(value || "").trim();
  return /^(?:data:|https?:|blob:|file:)/i.test(text);
}

function isPathInsideRoot(filePath = "", rootPath = "") {
  if (!filePath || !rootPath) return false;
  const relative = path.relative(path.resolve(rootPath), path.resolve(filePath));
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

function normalizeRelativePath(value = "") {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "");
}

function toStoredAssetPath(value = "", projectRoot = "") {
  const text = String(value || "").trim();
  if (!text || isNonFileReference(text)) return text;
  if (!path.isAbsolute(text)) {
    const normalized = normalizeRelativePath(text);
    if (normalized === ".." || normalized.startsWith("../")) return "";
    return normalized;
  }
  if (!projectRoot || !isPathInsideRoot(text, projectRoot)) return text;
  return normalizeRelativePath(path.relative(projectRoot, text));
}

function fromStoredAssetPath(
  value = "",
  projectRoot = "",
  { sceneId = 0, preferSceneFolder = false } = {},
) {
  const text = String(value || "").trim();
  if (!text || isNonFileReference(text) || path.isAbsolute(text)) return text;
  const normalized = normalizeRelativePath(text);
  if (normalized === ".." || normalized.startsWith("../")) return "";
  const hasFolder = normalized.includes("/");
  const sceneToken = `scene_${String(sceneId || 0).padStart(3, "0")}`;
  const relativePath = preferSceneFolder && sceneId && !hasFolder
    ? path.join(sceneToken, normalized)
    : normalized;
  const resolved = path.resolve(projectRoot, relativePath);
  return isPathInsideRoot(resolved, projectRoot) ? resolved : "";
}

function mapPathArray(values, mapper) {
  return Array.isArray(values)
    ? values.map((value) => mapper(value)).filter(Boolean)
    : [];
}

function transformTimelinePaths(items, mapper) {
  if (!Array.isArray(items)) return items;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    for (const key of TIMELINE_PATH_KEYS) {
      if (item[key]) item[key] = mapper(item[key]);
    }
  }
  return items;
}

function transformScenePaths(scene, sceneIndex, mapperForScene) {
  if (!scene || typeof scene !== "object") return scene;
  const numericId = Number(scene.id || scene.sceneId || sceneIndex + 1) || sceneIndex + 1;
  for (const key of SCENE_PATH_KEYS) {
    if (!scene[key]) continue;
    scene[key] = mapperForScene(scene[key], {
      sceneId: numericId,
      preferSceneFolder: key === "motionPromptPath" || key === "motionPromptOutputPath",
    });
  }
  scene.continuityReferencePaths = mapPathArray(
    scene.continuityReferencePaths,
    (value) => mapperForScene(value, { sceneId: numericId }),
  );
  if (scene.generatedContinuityReferences?.paths) {
    scene.generatedContinuityReferences.paths = mapPathArray(
      scene.generatedContinuityReferences.paths,
      (value) => mapperForScene(value, { sceneId: numericId }),
    );
  }
  if (scene.pipeline && typeof scene.pipeline === "object") {
    for (const key of SCENE_PATH_KEYS) {
      if (!scene.pipeline[key]) continue;
      scene.pipeline[key] = mapperForScene(scene.pipeline[key], {
        sceneId: numericId,
        preferSceneFolder: key === "motionPromptPath" || key === "motionPromptOutputPath",
      });
    }
    scene.pipeline.continuityReferencePaths = mapPathArray(
      scene.pipeline.continuityReferencePaths,
      (value) => mapperForScene(value, { sceneId: numericId }),
    );
  }
  delete scene.imageDataUrl;
  return scene;
}

function transformProjectPaths(payload, projectRoot, direction) {
  if (!payload || typeof payload !== "object" || !projectRoot) return payload;
  const mapper = direction === "load"
    ? (value, options = {}) => fromStoredAssetPath(value, projectRoot, options)
    : (value) => toStoredAssetPath(value, projectRoot);

  const scenes = Array.isArray(payload.project?.scenes)
    ? payload.project.scenes
    : [];
  scenes.forEach((scene, index) =>
    transformScenePaths(scene, index, (value, options) => mapper(value, options)),
  );

  if (payload.project?.finalVideoPath) {
    payload.project.finalVideoPath = mapper(payload.project.finalVideoPath);
  }
  transformTimelinePaths(payload.project?.finalTimeline, mapper);
  transformTimelinePaths(payload.previewTimeline, mapper);
  transformTimelinePaths(payload.runtime?.activePreviewTimeline, mapper);

  for (const groupName of ["images", "videos", "finalOutputs"]) {
    const group = payload.assets?.[groupName];
    if (!Array.isArray(group)) continue;
    for (const item of group) {
      if (!item || typeof item !== "object") continue;
      for (const key of TIMELINE_PATH_KEYS) {
        if (item[key]) item[key] = mapper(item[key]);
      }
    }
  }
  return payload;
}

function hasLegacyEmbeddedAssets(payload = {}) {
  return Boolean(
    Array.isArray(payload?.embeddedAssets?.scenes) &&
    payload.embeddedAssets.scenes.length,
  );
}

function removeEmbeddedAssets(payload = {}) {
  if (payload && typeof payload === "object") delete payload.embeddedAssets;
  return payload;
}

function prepareProjectPayloadForSave(payload = {}, projectRoot = "") {
  const cloned = cloneProjectPayloadForSave(payload);
  migrateProjectWorkflowMode(cloned);
  removeEmbeddedAssets(cloned);
  if (!cloned.assets || typeof cloned.assets !== "object" || Array.isArray(cloned.assets)) {
    cloned.assets = {};
  }
  cloned.assets.storageMode = PROJECT_ASSET_STORAGE_MODE;
  cloned.assets.root = ".";
  cloned.assets.embedded = false;
  transformProjectPaths(cloned, projectRoot, "save");
  return cloned;
}

function hydrateProjectPayloadPaths(payload = {}, projectRoot = "") {
  migrateProjectWorkflowMode(payload);
  return transformProjectPaths(payload, projectRoot, "load");
}

function containsInlineAssetData(value, keyPath = []) {
  if (Array.isArray(value)) {
    return value.some((item, index) =>
      containsInlineAssetData(item, keyPath.concat(String(index))),
    );
  }
  if (!value || typeof value !== "object") {
    return typeof value === "string" && /^data:(?:image|video)\//i.test(value);
  }
  for (const [key, child] of Object.entries(value)) {
    if (keyPath[0] === "embeddedAssets" && key === "data" && child) return true;
    if (containsInlineAssetData(child, keyPath.concat(key))) return true;
  }
  return false;
}

module.exports = {
  PROJECT_ASSET_STORAGE_MODE,
  cloneJsonValue,
  cloneProjectPayloadForSave,
  isPathInsideRoot,
  toStoredAssetPath,
  fromStoredAssetPath,
  hasLegacyEmbeddedAssets,
  removeEmbeddedAssets,
  prepareProjectPayloadForSave,
  hydrateProjectPayloadPaths,
  containsInlineAssetData,
};
