const { validateManualKeyframe } = require("./manual_image_validation");
"use strict";

const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const {
  getSceneRequestPaths,
  buildNv1RequestContent,
  buildNv2RequestContent,
  buildRequestControlPrompt,
  createComposerPayload,
  sha256File,
} = require("../pipeline/scene_request_files");
const { writeTextFileAtomic } = require("../project");
const { validateKeyframeFile } = require("../pipeline/asset_validation");

const CHATGPT_HYDRATION_KEYFRAME_LIMIT = 10;
const REQUEST_1_PROMPT =
  "Request 1: read and remember all attached preprompt files. Reply only when ready.";
const REQUEST_2_PROMPT =
  `Request 2: read and remember the attached keyframes from up to ${CHATGPT_HYDRATION_KEYFRAME_LIMIT} previous project scenes. Use them as visual continuity context for upcoming requests. Reply only when ready.`;
// Request 1/2 remain exported only for legacy-project compatibility.  The
// production manual workflow deliberately exposes and builds NV1/NV2 only.
const MANUAL_STAGES = Object.freeze(["NV1", "NV2"]);

function validateReadyResponse(text = "") {
  const normalized = String(text || "").trim().toLowerCase();
  if (!normalized) return false;
  if (/policy|cannot assist|can't assist|rate.?limit|too many requests|429/.test(normalized)) {
    return false;
  }
  return /\b(ready|done|ok|okay|acknowledged|remembered|loaded|understood)\b|sẵn sàng|san sang|đã nhớ|da nho|xong/.test(normalized);
}

async function collectPrepromptFiles(projectPath) {
  const folder = path.join(path.resolve(projectPath), "preprompt");
  const entries = await fs.readdir(folder, { withFileTypes: true }).catch((error) => {
    if (error?.code === "ENOENT") return [];
    throw error;
  });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(folder, entry.name))
    .sort((left, right) => path.basename(left).localeCompare(path.basename(right), undefined, { numeric: true }));
}

async function collectRecentKeyframes(projectPath, sceneId, limit = CHATGPT_HYDRATION_KEYFRAME_LIMIT) {
  const entries = await fs.readdir(projectPath, { withFileTypes: true }).catch(() => []);
  const current = Number(sceneId);
  const found = [];
  for (const entry of entries) {
    const match = entry.isDirectory() && entry.name.match(/^scene_(\d+)$/i);
    if (!match) continue;
    const candidateId = Number(match[1]);
    if (!Number.isInteger(candidateId) || candidateId >= current) continue;
    const filePath = path.join(projectPath, entry.name, `${entry.name}_keyframe.png`);
    const validation = await validateManualKeyframe(filePath).catch(() => ({ ok: false }));
    if (validation.ok) found.push({ sceneId: candidateId, filePath });
  }
  return found
    .sort((left, right) => right.sceneId - left.sceneId)
    .slice(0, limit)
    .map((item) => item.filePath);
}

async function describeAttachments(filePaths) {
  const files = [];
  for (const filePath of filePaths) {
    const resolved = path.resolve(String(filePath || ""));
    const stat = await fs.stat(resolved).catch(() => null);
    if (!stat?.isFile?.() || stat.size <= 0) {
      throw new Error(`manual-bundle-attachment-missing:${resolved}`);
    }
    files.push({
      path: resolved,
      name: path.basename(resolved),
      size: stat.size,
      sha256: await sha256File(resolved),
    });
  }
  return files;
}

async function verifyBundleFiles(bundle) {
  for (const attachment of bundle.attachments || []) {
    const hash = await sha256File(attachment.path).catch(() => "");
    if (hash !== attachment.sha256) return false;
  }
  return true;
}

function fingerprintBundle({ stage, sceneId, clipboardText, attachments }) {
  return crypto.createHash("sha256").update(JSON.stringify({
    stage,
    sceneId,
    clipboardText,
    attachments: attachments.map(({ name, sha256 }) => ({ name, sha256 })),
  }), "utf8").digest("hex");
}

// A manual stage is intentionally self-contained.  In particular, preparing
// NV1 must not fail because an NV2 template is unavailable (and vice versa).
// Existing per-scene request files are durable project artifacts, so prefer
// them during recovery instead of regenerating or overwriting them.
async function resolveManualStageRequest({ sceneDir, sceneId, stage, scene = {} } = {}) {
  const normalizedStage = String(stage || "").trim().toUpperCase();
  const paths = getSceneRequestPaths(sceneDir, sceneId);
  const filePath = normalizedStage === "NV1" ? paths.nv1FilePath : paths.nv2FilePath;
  const existing = await fs.readFile(filePath, "utf8").catch((error) => {
    if (error?.code === "ENOENT") return "";
    throw error;
  });
  if (!existing.trim()) {
    const sceneText = scene.original || scene.text || scene.sceneText || scene.prompt;
    const content = normalizedStage === "NV1"
      ? buildNv1RequestContent({
        nv1: scene.nv1 || scene.imagePrompt || scene.task1,
        sceneText,
        sceneId,
      })
      : buildNv2RequestContent({
        nv2: scene.nv2 || scene.motionPromptInstruction || scene.task2,
        sceneText,
        sceneId,
      });
    await writeTextFileAtomic(filePath, content);
  }
  const contentSha256 = await sha256File(filePath);
  return {
    filePath,
    contentSha256,
    controlPrompt: buildRequestControlPrompt({
      stage: normalizedStage,
      filePath,
      contentSha256,
    }),
  };
}

async function ensureManualProjectRequestFiles({ projectPath, scenes = [], nv1 = "", nv2 = "" } = {}) {
  if (!String(projectPath || "").trim()) throw new Error("manual-project-path-required");
  const projectDir = path.resolve(projectPath);
  const seen = new Set();
  for (const scene of scenes) {
    const sceneId = Number(scene?.id || scene?.sceneId);
    if (!Number.isInteger(sceneId) || sceneId <= 0 || seen.has(sceneId)) {
      throw new Error(`manual-project-invalid-scene-id:${sceneId}`);
    }
    seen.add(sceneId);
    const sceneToken = `scene_${String(sceneId).padStart(3, "0")}`;
    const sceneDir = path.join(projectDir, sceneToken);
    const sceneText = scene.original || scene.rawSceneText || scene.text || scene.sceneText || scene.prompt || "";
    await fs.mkdir(sceneDir, { recursive: true });
    if (String(sceneText).trim()) {
      await fs.writeFile(path.join(sceneDir, "scene.txt"), sceneText, { encoding: "utf8", flag: "wx" })
        .catch((error) => { if (error?.code !== "EEXIST") throw error; });
    }
    const requestScene = { ...scene, sceneText, nv1: nv1 || scene.nv1 || scene.imagePrompt || scene.task1,
      nv2: nv2 || scene.nv2 || scene.motionPromptInstruction || scene.task2 };
    await resolveManualStageRequest({ sceneDir, sceneId, stage: "NV1", scene: requestScene });
    await resolveManualStageRequest({ sceneDir, sceneId, stage: "NV2", scene: requestScene });
  }
  return { ok: true, sceneCount: seen.size };
}

async function buildManualStageBundle({
  projectPath,
  sceneId,
  stage,
  scene = {},
  keyframePath: mappedKeyframePath,
} = {}) {
  const normalizedStage = String(stage || "").trim().toUpperCase();
  if (!MANUAL_STAGES.includes(normalizedStage)) {
    throw new Error(`manual-bundle-invalid-stage:${stage}`);
  }
  const numericSceneId = Number(sceneId || scene.id || scene.sceneId || 0);
  if (!Number.isInteger(numericSceneId) || numericSceneId <= 0) {
    throw new Error("manual-bundle-invalid-scene-id");
  }
  const projectDir = path.resolve(String(projectPath || ""));
  const sceneToken = `scene_${String(numericSceneId).padStart(3, "0")}`;
  const sceneDir = path.join(projectDir, sceneToken);
  await fs.mkdir(sceneDir, { recursive: true });

  let clipboardText = "";
  let attachmentPaths = [];
  let contentSha256 = "";
  const request = await resolveManualStageRequest({
    sceneDir,
    sceneId: numericSceneId,
    stage: normalizedStage,
    scene,
  });
  clipboardText = request.controlPrompt;
  contentSha256 = request.contentSha256;
  attachmentPaths = [request.filePath];
  if (normalizedStage === "NV2") {
    const keyframePath = mappedKeyframePath || path.join(sceneDir, `${sceneToken}_keyframe.png`);
    const validation = await validateManualKeyframe(keyframePath);
    if (!validation.ok) throw new Error(`manual-bundle-nv2-keyframe-${validation.error}`);
    attachmentPaths.push(keyframePath);
  }
  await createComposerPayload({
    stage: normalizedStage,
    sceneId: numericSceneId,
    controlPrompt: clipboardText,
    expectedFilePaths: attachmentPaths,
  });

  const attachments = await describeAttachments(attachmentPaths);
  const payloadFingerprint = fingerprintBundle({
    stage: normalizedStage,
    sceneId: numericSceneId,
    clipboardText,
    attachments,
  });
  return Object.freeze({
    stage: normalizedStage,
    sceneId: numericSceneId,
    clipboardText,
    attachmentPaths: attachments.map((item) => item.path),
    attachmentNames: attachments.map((item) => item.name),
    attachments,
    contentSha256,
    payloadFingerprint,
    instructions: "Tự đính kèm đúng các tệp đã liệt kê, dán prompt và bấm Send trên ChatGPT. Vidora tự theo dõi, xác thực và lưu phản hồi của đúng scene/stage; nút lưu là phương án dự phòng.",
  });
}

module.exports = {
  CHATGPT_HYDRATION_KEYFRAME_LIMIT,
  REQUEST_1_PROMPT,
  REQUEST_2_PROMPT,
  MANUAL_STAGES,
  validateReadyResponse,
  collectPrepromptFiles,
  collectRecentKeyframes,
  buildManualStageBundle,
  ensureManualProjectRequestFiles,
  verifyBundleFiles,
};
