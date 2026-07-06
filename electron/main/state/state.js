const fs = require("fs/promises");
const path = require("path");
const { pathExists } = require("../utils");

function getPipelineStateFile(projectDir = "") {
  return projectDir ? path.join(projectDir, "pipeline_state.json") : "";
}

function hashChatGptSnapshotText(value = "") {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function normalizeChatTitleValue(title = "") {
  return String(title || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeChatGptPromptCompareText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getChatGptConversationIdFromPath(pathname = "") {
  return String(pathname || "").match(/\/c\/([^/?#]+)/)?.[1] || "";
}

function isSameChatTitle(left = "", right = "") {
  return normalizeChatTitleValue(left) === normalizeChatTitleValue(right);
}

function verifyDraftOwnership(snapshot, pageState, expectedFilePaths = []) {
  if (!snapshot || !pageState) return false;
  if (!snapshot.draftId) return false;
  if (snapshot.promptHash !== pageState.composerPromptHash) return false;
  
  const expectedCount = expectedFilePaths.length || snapshot.attachmentCount || 0;
  if (pageState.attachmentCount !== expectedCount) return false;
  
  if (expectedFilePaths.length > 0) {
    const expectedNames = expectedFilePaths.map(f => path.basename(f).toLowerCase());
    const actualNames = (pageState.attachmentNames || []).map(n => n.toLowerCase());
    for (const name of expectedNames) {
      const found = actualNames.some(act => act.includes(name) || name.includes(act));
      if (!found) return false;
    }
  } else if (snapshot.attachmentNames && snapshot.attachmentNames.length > 0) {
    const expectedNames = snapshot.attachmentNames.map(n => n.toLowerCase());
    const actualNames = (pageState.attachmentNames || []).map(n => n.toLowerCase());
    for (const name of expectedNames) {
      const found = actualNames.some(act => act.includes(name) || name.includes(act));
      if (!found) return false;
    }
  }

  if (snapshot.attachmentHashes && pageState.attachmentHashes) {
    if (snapshot.attachmentHashes.length !== pageState.attachmentHashes.length) return false;
    for (let i = 0; i < snapshot.attachmentHashes.length; i++) {
      if (snapshot.attachmentHashes[i] !== pageState.attachmentHashes[i]) return false;
    }
  }

  if (pageState.composerState === "ATTACHING_FILES") return false;
  return true;
}

async function writeSceneSnapshot(sceneDir, data = {}) {
  if (!sceneDir) return;
  try {
    const snapshotFile = path.join(sceneDir, "scene_snapshot.json");
    let existing = {};
    if (await pathExists(snapshotFile)) {
      try {
        const raw = await fs.readFile(snapshotFile, "utf8");
        if (raw) existing = JSON.parse(raw);
      } catch (_) {}
    }
    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString()
    };
    await fs.mkdir(sceneDir, { recursive: true });
    await fs.writeFile(snapshotFile, JSON.stringify(updated, null, 2), "utf8");
  } catch (err) {
    console.error("[writeSceneSnapshot] failed:", err);
  }
}

async function readSceneSnapshot(sceneDir) {
  if (!sceneDir) return {};
  const snapshotFile = path.join(sceneDir, "scene_snapshot.json");
  if (!(await pathExists(snapshotFile))) return {};
  try {
    const raw = await fs.readFile(snapshotFile, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

async function writeActionJournal(sceneDir, action) {
  if (!sceneDir) return;
  const journalPath = path.join(sceneDir, "action_journal.json");
  let journal = [];
  try {
    if (await pathExists(journalPath)) {
      const raw = await fs.readFile(journalPath, "utf8");
      journal = raw ? JSON.parse(raw) : [];
    }
  } catch (_e) {}
  journal.push({
    timestamp: new Date().toISOString(),
    action,
  });
  await fs.writeFile(journalPath, JSON.stringify(journal, null, 2), "utf8").catch(() => null);
}

async function readActionJournal(sceneDir) {
  if (!sceneDir) return [];
  const journalPath = path.join(sceneDir, "action_journal.json");
  try {
    if (await pathExists(journalPath)) {
      const raw = await fs.readFile(journalPath, "utf8");
      return raw ? JSON.parse(raw) : [];
    }
  } catch (_e) {}
  return [];
}

function isChatGptActivelyGenerating(snapshot = {}) {
  if (snapshot?.sendReady && !snapshot?.stopButtonVisible) return false;
  return Boolean(
    snapshot?.stopButtonVisible ||
    snapshot?.composerBusy ||
    snapshot?.streamingIndicator ||
    snapshot?.preparingImage,
  );
}

function sanitizeChatGptImageSnapshot(snapshot = {}) {
  if (!snapshot || typeof snapshot !== "object") return snapshot;
  const clean = { ...snapshot };
  if (Array.isArray(clean.urls))
    clean.urls = clean.urls.map((url) => {
      const value = String(url || "");
      if (value.startsWith("data:")) return "data:image/*";
      if (value.startsWith("blob:")) return "blob:*";
      try {
        const parsed = new URL(value);
        return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
      } catch (_error) {
        return value.slice(0, 80);
      }
    });
  if (clean.buttonText)
    clean.buttonText = String(clean.buttonText).slice(0, 500);
  if (clean.latestAssistantText)
    clean.latestAssistantText = String(clean.latestAssistantText).slice(0, 700);
  return clean;
}

function isNv2SnapshotGenerationActive(snapshot = {}) {
  const messages = Array.isArray(snapshot?.messages) ? snapshot.messages : [];
  const hasAssistantText = messages.some(
    (message) => String(message?.text || "").trim().length > 0,
  );
  if (
    snapshot?.composerBusy ||
    snapshot?.streamingIndicator ||
    snapshot?.activeGenerationMarker
  )
    return true;
  return Boolean(snapshot?.generationActive && !hasAssistantText);
}

function extractCompletedNv2ResponseFromSnapshot(snapshot = {}, baseline = {}) {
  if (isNv2SnapshotGenerationActive(snapshot)) {
    return { ok: false, error: "nv2-response-still-generating", snapshot };
  }
  return selectNewAssistantMessageAfterBaseline(snapshot, baseline);
}

function selectLatestCompletedAssistantMessage(snapshot = {}) {
  if (isNv2SnapshotGenerationActive(snapshot)) {
    return { ok: false, error: "nv2-response-still-generating", snapshot };
  }
  const messages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
  const candidate = messages
    .filter((message) => String(message?.text || "").trim())
    .at(-1);
  const text = String(candidate?.text || "").trim();
  if (!candidate || !text)
    return { ok: false, error: "no-assistant-response", snapshot };
  return {
    ok: true,
    text,
    state: {
      count: snapshot.count || messages.length,
      index: candidate.index,
      text,
      textLength: text.length,
      source: "assistant-role-existing-completed",
      hasNewAssistant: true,
      existingCompletedResponse: true,
    },
    candidate,
    snapshot,
  };
}

function selectNewAssistantMessageAfterBaseline(snapshot = {}, baseline = {}) {
  const messages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
  const baselineIds = new Set((baseline.ids || []).filter(Boolean));
  const baselineHashes = new Set((baseline.hashes || []).filter(Boolean));
  const baselineCount = Number(baseline.count || 0) || 0;
  const requiredUserTurnIndex = Number(baseline.nv2UserTurnIndex);
  const requiredBaselineTurnIndex = Number(baseline.maxTurnIndex);
  const hasRequiredUserTurnIndex = Number.isFinite(requiredUserTurnIndex);
  const hasRequiredBaselineTurnIndex =
    Number.isFinite(requiredBaselineTurnIndex) &&
    requiredBaselineTurnIndex >= 0;
  const afterCurrentNv2User = (message) => {
    if (!hasRequiredUserTurnIndex && !hasRequiredBaselineTurnIndex) return true;
    const turnIndex = Number(message?.turnIndex);
    if (!Number.isFinite(turnIndex)) return false;
    if (hasRequiredUserTurnIndex) return turnIndex > requiredUserTurnIndex;
    if (hasRequiredBaselineTurnIndex)
      return turnIndex > requiredBaselineTurnIndex;
    return true;
  };
  const eligibleMessages = messages.filter(
    (message) =>
      String(message?.text || "").trim() && afterCurrentNv2User(message),
  );
  const withNewId = eligibleMessages.filter(
    (message) => message.id && !baselineIds.has(message.id),
  );
  const idCandidate = withNewId.at(-1);
  const countCandidate =
    messages.length > baselineCount ? eligibleMessages.at(-1) : null;
  const hashCandidate = eligibleMessages
    .filter((message) => message.hash && !baselineHashes.has(message.hash))
    .at(-1);
  const candidate = idCandidate || countCandidate || hashCandidate || null;
  const text = String(candidate?.text || "").trim();
  if (!candidate || !text)
    return { ok: false, error: "no-new-assistant", snapshot };
  const state = {
    count: snapshot.count || messages.length,
    minCount: baselineCount,
    newCount: Math.max(0, (snapshot.count || messages.length) - baselineCount),
    index: candidate.index,
    text,
    textLength: text.length,
    source:
      candidate.id && !baselineIds.has(candidate.id)
        ? "assistant-role-new-id"
        : hashCandidate === candidate
          ? "assistant-role-new-hash"
          : "assistant-role-count-advance",
    hasNewAssistant: true,
  };
  return { ok: true, text, state, candidate, snapshot };
}

function looksLikeCollapsedUserPrompt(text = "", kind = "") {
  const value = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return false;
  if (
    /show more|show less/i.test(value) &&
    /---\s*scene|scene\s*\d+\s*hiện tại|nhiệm\s*vụ\s*[12]/i.test(value)
  )
    return true;
  if (
    kind === "image" &&
    /---\s*scene\s*\d+\s*hiện tại|nhiệm\s*vụ\s*1|tạo\s*1\s*ảnh|tạo ảnh/i.test(
      value,
    ) &&
    !/generated image|here is|ảnh đã được tạo/i.test(value)
  )
    return true;
  if (
    kind === "motion" &&
    /nhiệm\s*vụ\s*2|dựa trên ảnh keyframe|motion prompt/i.test(value) &&
    /show more|show less|đoạn đầu scene/i.test(value)
  )
    return true;
  return false;
}

function isChatGptLimitText(text = "") {
  return /limit|usage cap|rate limit|too many requests|try again later|come back later|you'?ve reached|quota|giới hạn|hạn mức|quá nhiều yêu cầu/i.test(
    String(text || ""),
  );
}

function isChatGptDotLoadingCanvasAsset(asset = {}) {
  const method = String(asset.method || "").toLowerCase();
  const sourceKind = String(asset.sourceKind || "").toLowerCase();
  const width = Number(asset.width || 0);
  const height = Number(asset.height || 0);
  const byteLength = Number(asset.byteLength || 0);
  return (
    method === "canvas" &&
    sourceKind === "canvas" &&
    width <= 700 &&
    height <= 700 &&
    byteLength < 150000
  );
}

module.exports = {
  getPipelineStateFile,
  hashChatGptSnapshotText,
  normalizeChatTitleValue,
  normalizeChatGptPromptCompareText,
  getChatGptConversationIdFromPath,
  isSameChatTitle,
  verifyDraftOwnership,
  writeSceneSnapshot,
  readSceneSnapshot,
  writeActionJournal,
  readActionJournal,
  isChatGptActivelyGenerating,
  sanitizeChatGptImageSnapshot,
  isNv2SnapshotGenerationActive,
  extractCompletedNv2ResponseFromSnapshot,
  selectLatestCompletedAssistantMessage,
  selectNewAssistantMessageAfterBaseline,
  looksLikeCollapsedUserPrompt,
  isChatGptLimitText,
  isChatGptDotLoadingCanvasAsset,
};
