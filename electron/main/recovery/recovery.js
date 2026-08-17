const { appendAppLog } = require("../logging");

let chatGptSceneOrdinal = 0;
const DURABLE_PIPELINE_BACKOFF_MS = [10000, 30000, 60000, 120000];

async function maybeResetChatGptPageForLongRun(client, rotateEveryScenes = 20) {
  chatGptSceneOrdinal += 1;
  if (
    chatGptSceneOrdinal > 0 &&
    chatGptSceneOrdinal % rotateEveryScenes === 0
  ) {
    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `ChatGPT memory GC refresh disabled: scene ordinal ${chatGptSceneOrdinal}; keeping current conversation.`,
    }).catch(() => null);
  }
}

async function maybeRotateChatGptConversation(client, options = {}) {
  const rotateEvery = Number(options.chatGptStability?.rotateEveryScenes || 20);
  await maybeResetChatGptPageForLongRun(client, rotateEvery);
}

function getDurablePipelineBackoffMs(retryCount = 1) {
  const index = Math.max(
    0,
    Math.min(
      DURABLE_PIPELINE_BACKOFF_MS.length - 1,
      Number(retryCount || 1) - 1,
    ),
  );
  return DURABLE_PIPELINE_BACKOFF_MS[index];
}

function normalizeChatGptRetryText(text = "") {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function isRetryableChatGptToolErrorText(text = "", stage = "") {
  const normalized = normalizeChatGptRetryText(text);
  const raw = String(text || "").toLowerCase();
  if (!normalized && !raw) return false;
  const imageToolFailed =
    /khong the tao anh/.test(normalized) ||
    /cong cu tao anh.*(gap loi|loi)/.test(normalized) ||
    /hay gui lai yeu cau.*tao lai anh/.test(normalized) ||
    /(image|generation).*tool.*(error|failed)/i.test(raw) ||
    /(cannot|can't|couldn'?t|unable to).{0,80}(create|generate).{0,80}image/i.test(
      raw,
    );
  const motionRefusal =
    /khong the tao motion prompt/.test(normalized) ||
    /khong the tao.*motion prompt/.test(normalized) ||
    /anh hien tai khong co/.test(normalized) ||
    /keyframe.*(does not|doesn't|missing|khong co)/i.test(raw);
  if (stage === "image") return imageToolFailed;
  if (stage === "motion") return motionRefusal || imageToolFailed;
  return imageToolFailed || motionRefusal;
}

function isChatGptPolicyRefusalText(text = "") {
  const t = String(text || "").toLowerCase();
  return (
    t.includes("vi phạm các quy định") ||
    t.includes("quy định của chúng tôi về bạo lực") ||
    t.includes("có thể vi phạm") ||
    t.includes("i can’t help create") ||
    t.includes("i can’t assist with") ||
    (t.includes("policy") && t.includes("violence"))
  );
}

module.exports = {
  maybeResetChatGptPageForLongRun,
  maybeRotateChatGptConversation,
  getDurablePipelineBackoffMs,
  normalizeChatGptRetryText,
  isRetryableChatGptToolErrorText,
  isChatGptPolicyRefusalText,
};
