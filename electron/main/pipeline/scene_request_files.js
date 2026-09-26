"use strict";

const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const { writeTextFileAtomic } = require("../project");

const CONTROL_PROMPT_PREFIXES = Object.freeze({
  NV1: "Tạo ảnh theo file sau:",
  NV2: "Tạo prompt motion theo file sau:",
});

function normalizeSceneId(sceneId) {
  const numeric = Number(sceneId);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new Error(`Invalid scene id: ${sceneId}`);
  }
  return numeric;
}

function getSceneToken(sceneId) {
  return `scene_${String(normalizeSceneId(sceneId)).padStart(3, "0")}`;
}

function normalizeRequestText(value = "") {
  return String(value || "").replace(/\r\n?/g, "\n").trim();
}

function sha256Text(value = "") {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function hashComposerText(value = "") {
  const text = String(value || "")
    .normalize("NFC")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function getSceneRequestPaths(sceneDir, sceneId) {
  const resolvedSceneDir = path.resolve(String(sceneDir || ""));
  if (!String(sceneDir || "").trim()) {
    throw new Error("Missing scene directory for request files.");
  }
  const sceneToken = getSceneToken(sceneId);
  return {
    sceneToken,
    nv1FilePath: path.join(resolvedSceneDir, `${sceneToken}_nv1_request.txt`),
    nv2FilePath: path.join(resolvedSceneDir, `${sceneToken}_nv2_request.txt`),
  };
}

function buildNv1RequestContent({ nv1 = "", sceneText = "", sceneId } = {}) {
  const task = normalizeRequestText(nv1);
  const scene = normalizeRequestText(sceneText);
  if (!task) throw new Error(`Scene ${sceneId}: NV1_TAO_ANH.txt is empty.`);
  if (!scene) throw new Error(`Scene ${sceneId}: scene text is empty for NV1.`);
  return [
    "Tạo đúng một ảnh theo toàn bộ yêu cầu trong tệp này. Không trả lời dài bằng văn bản; hãy trực tiếp tạo ảnh.",
    "--- IMAGE_STAGE / NV1_TAO_ANH ---",
    task,
    "--- KỊCH BẢN CẦN TẠO: ---",
    scene,
  ].join("\n\n");
}

function buildNv2RequestContent({ nv2 = "", sceneText = "", sceneId } = {}) {
  const task = normalizeRequestText(nv2);
  const scene = normalizeRequestText(sceneText);
  if (!task) throw new Error(`Scene ${sceneId}: NV2_MOTION_PROMPT.txt is empty.`);
  if (!scene) throw new Error(`Scene ${sceneId}: scene text is empty for NV2.`);
  return [
    "--- MOTION_STAGE / NV2_MOTION_PROMPT ---",
    task,
    "--- KỊCH BẢN CẦN TẠO: ---",
    scene,
  ].join("\n\n");
}

function buildRequestControlPrompt({ stage = "", filePath = "", contentSha256 = "", retry = 0 } = {}) {
  const normalizedStage = String(stage || "").trim().toUpperCase();
  const fileName = path.basename(String(filePath || "").trim());
  const digest = String(contentSha256 || "").trim().toLowerCase();
  const prefix = CONTROL_PROMPT_PREFIXES[normalizedStage];
  if (!prefix) throw new Error(`Invalid request stage for control prompt: ${stage}`);
  if (!fileName) throw new Error("Missing request filename for control prompt.");
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error("Invalid request content SHA-256 for control prompt.");
  }
  const pieces = [`${prefix} ${fileName}`];
  const retryNumber = Number(retry || 0);
  if (Number.isInteger(retryNumber) && retryNumber > 0) {
    pieces.push(`retry=${retryNumber}`);
  }
  return pieces.join(" | ");
}

function buildPayloadFingerprint({ stage = "", sceneId, controlPrompt = "", files = [] } = {}) {
  const normalizedStage = String(stage || "").trim().toUpperCase();
  if (!normalizedStage) throw new Error("Missing payload stage.");
  const normalizedSceneId = normalizeSceneId(sceneId);
  const normalizedFiles = (Array.isArray(files) ? files : []).map((file) => ({
    name: path.basename(String(file?.filePath || file?.name || "")).toLowerCase(),
    sha256: String(file?.sha256 || "").trim().toLowerCase(),
  }));
  if (!normalizedFiles.length || normalizedFiles.some((file) => !file.name || !/^[a-f0-9]{64}$/.test(file.sha256))) {
    throw new Error("Payload fingerprint requires named files with SHA-256 hashes.");
  }
  return sha256Text(JSON.stringify({
    stage: normalizedStage,
    sceneId: normalizedSceneId,
    controlPrompt: normalizeRequestText(controlPrompt),
    files: normalizedFiles,
  }));
}

async function sha256File(filePath) {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function createComposerPayload({ stage, sceneId, controlPrompt, expectedFilePaths = [] } = {}) {
  const filePaths = (Array.isArray(expectedFilePaths) ? expectedFilePaths : [])
    .map((filePath) => path.resolve(String(filePath || "")))
    .filter(Boolean);
  if (!filePaths.length) throw new Error(`Scene ${sceneId}: ${stage} payload has no attachments.`);
  const files = [];
  for (const filePath of filePaths) {
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat?.isFile?.() || stat.size <= 0) {
      throw new Error(`Scene ${sceneId}: payload attachment is missing or empty: ${filePath}`);
    }
    files.push({ filePath, sha256: await sha256File(filePath), size: stat.size });
  }
  return {
    stage: String(stage || "").trim().toUpperCase(),
    sceneId: normalizeSceneId(sceneId),
    controlPrompt: normalizeRequestText(controlPrompt),
    controlPromptHash: hashComposerText(controlPrompt),
    expectedFilePaths: filePaths,
    expectedAttachmentNames: filePaths.map((filePath) => path.basename(filePath)),
    localFileSha256s: files.map((file) => file.sha256),
    payloadFingerprint: buildPayloadFingerprint({ stage, sceneId, controlPrompt, files }),
  };
}

async function materializeSceneRequestFiles({ sceneDir, sceneId, nv1, nv2, sceneText, preserveExisting = false } = {}) {
  const paths = getSceneRequestPaths(sceneDir, sceneId);
  const nv1Content = buildNv1RequestContent({ nv1, sceneText, sceneId });
  const nv2Content = buildNv2RequestContent({ nv2, sceneText, sceneId });
  if (preserveExisting) {
    for (const [filePath, content] of [
      [paths.nv1FilePath, nv1Content],
      [paths.nv2FilePath, nv2Content],
    ]) {
      await fs.writeFile(filePath, content, { encoding: "utf8", flag: "wx" })
        .catch((error) => { if (error?.code !== "EEXIST") throw error; });
    }
  } else {
    await writeTextFileAtomic(paths.nv1FilePath, nv1Content);
    await writeTextFileAtomic(paths.nv2FilePath, nv2Content);
  }
  const nv1Sha256 = preserveExisting ? await sha256File(paths.nv1FilePath) : sha256Text(nv1Content);
  const nv2Sha256 = preserveExisting ? await sha256File(paths.nv2FilePath) : sha256Text(nv2Content);

  const nv1ControlPrompt = buildRequestControlPrompt({
    stage: "NV1",
    filePath: paths.nv1FilePath,
    contentSha256: nv1Sha256,
  });
  const nv2ControlPrompt = buildRequestControlPrompt({
    stage: "NV2",
    filePath: paths.nv2FilePath,
    contentSha256: nv2Sha256,
  });

  return {
    sceneId: normalizeSceneId(sceneId),
    sceneToken: paths.sceneToken,
    nv1: {
      filePath: paths.nv1FilePath,
      fileName: path.basename(paths.nv1FilePath),
      contentSha256: nv1Sha256,
      controlPrompt: nv1ControlPrompt,
      controlPromptHash: hashComposerText(nv1ControlPrompt),
      payloadFingerprint: buildPayloadFingerprint({
        stage: "NV1",
        sceneId,
        controlPrompt: nv1ControlPrompt,
        files: [{ filePath: paths.nv1FilePath, sha256: nv1Sha256 }],
      }),
    },
    nv2: {
      filePath: paths.nv2FilePath,
      fileName: path.basename(paths.nv2FilePath),
      contentSha256: nv2Sha256,
      controlPrompt: nv2ControlPrompt,
      controlPromptHash: hashComposerText(nv2ControlPrompt),
      payloadFingerprint: buildPayloadFingerprint({
        stage: "NV2",
        sceneId,
        controlPrompt: nv2ControlPrompt,
        files: [{ filePath: paths.nv2FilePath, sha256: nv2Sha256 }],
      }),
    },
  };
}

module.exports = {
  CONTROL_PROMPT_PREFIXES,
  getSceneToken,
  getSceneRequestPaths,
  normalizeRequestText,
  sha256Text,
  sha256File,
  hashComposerText,
  buildNv1RequestContent,
  buildNv2RequestContent,
  buildRequestControlPrompt,
  buildPayloadFingerprint,
  createComposerPayload,
  materializeSceneRequestFiles,
};
