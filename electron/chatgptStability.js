const CHATGPT_STAGES = Object.freeze({
  IDLE: 'idle',
  PREPARING_COMPOSER: 'preparing-composer',
  UPLOADING_IMAGE: 'uploading-image',
  IMAGE_ATTACHED: 'image-attached',
  PROMPT_PASTED: 'prompt-pasted',
  WAITING_SEND_READY: 'waiting-send-ready',
  SENT: 'sent',
  WAITING_RESPONSE: 'waiting-response',
  EXTRACTING_OUTPUT: 'extracting-output',
  SAVED: 'saved',
  RECOVERING: 'recovering',
  FAILED: 'failed',
});

const CHATGPT_ERROR_REASONS = Object.freeze({
  COMPOSER_BUSY: 'composer-busy',
  COMPOSER_NOT_FOUND: 'composer-not-found',
  PROMPT_PASTED_BUT_SEND_NOT_READY: 'prompt-pasted-but-send-not-ready',
  SEND_BUTTON_WRONG_TARGET: 'send-button-wrong-target',
  SEND_BUTTON_SHARE_IMAGE: 'send-button-share-image',
  IMAGE_UPLOAD_TIMEOUT: 'image-upload-timeout',
  IMAGE_PREVIEW_NOT_DETECTED: 'image-preview-not-detected',
  RESPONSE_TIMEOUT: 'chatgpt-response-timeout',
  OUTPUT_CHOICE_REQUIRED: 'chatgpt-output-choice-required',
  TOO_LONG_CONVERSATION: 'chatgpt-too-long-conversation',
  MEMORY_CACHE_HEAVY: 'chatgpt-memory-cache-heavy',
  TAB_CRASHED: 'chatgpt-tab-crashed',
  LOGGED_OUT: 'chatgpt-logged-out',
  CLOUDFLARE_OR_PERMISSION_BLOCK: 'cloudflare-or-permission-block',
  NETWORK_STALL: 'network-stall',
  UNSAFE_SIDEBAR_MODAL: 'unsafe-sidebar-modal',
  UNKNOWN_UI_STATE: 'unknown-ui-state',
});

const CHATGPT_STABILITY_DEFAULTS = Object.freeze({
  promptSendMaxRecoveries: 3,
  sendReadyTimeoutMs: 30000,
  autoSelectChoice: true,
  defaultChoiceIndex: 0,
  newChatEveryNScenes: 3,
  maxConversationAgeMs: 20 * 60 * 1000,
  maxAssistantMessagesPerChat: 12,
  softReloadAfterFailures: 2,
  newTabAfterFailures: 3,
  browserRestartAfterFailures: 5,
  maxAutoResumePerProject: 3,
  maxRetryPerScene: 2,
});

const REJECTED_SEND_LABEL_PATTERNS = [
  /chia\s*se\s*hinh\s*anh\s*nay/i,
  /share\s*this\s*image/i,
  /download/i,
  /copy/i,
  /regenerate/i,
  /like/i,
  /dislike/i,
  /read\s*aloud/i,
  /^more$/i,
  /voice|microphone|record|dictate/i,
  /attach|upload|add files/i,
];

function normalizeUiText(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ä‘/g, 'd')
    .replace(/\s+/g, ' ');
}

function isRejectedSendLabel(label = '') {
  const normalized = normalizeUiText(label);
  return REJECTED_SEND_LABEL_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isLikelyComposerSendLabel(label = '') {
  const normalized = normalizeUiText(label);
  if (!normalized || isRejectedSendLabel(normalized)) return false;
  return /(^|\s)(send|gui|submit)(\s|$)/i.test(normalized)
    || /composer-submit|send-button|arrow-up|paper-plane/i.test(normalized);
}

function classifyChatGptError(error, context = {}) {
  const message = String(
    error?.message ||
    error?.error ||
    error ||
    ''
  );

  // Exact USER specified checks
  if (/composer.*busy|still busy/i.test(message)) return 'composer-busy';
  if (/Prompt đã paste|pasted.*not.*send|chưa gửi được/i.test(message)) return 'prompt-pasted-but-send-not-ready';
  if (/Chia sẻ hình ảnh này|Share this image/i.test(message)) return 'send-button-share-image';
  if (/send.*button|nút send/i.test(message)) return 'send-button-wrong-target';
  if (/logged out|login|đăng nhập/i.test(message)) return 'chatgpt-logged-out';
  if (/aw-snap|crashed|tab crashed/i.test(message)) return 'chatgpt-tab-crashed';
  if (/timeout|timed out/i.test(message)) return 'chatgpt-response-timeout';
  if (/preview|attachment|upload/i.test(message)) return 'image-upload-timeout';

  // Compatibility checks to support all test suites
  const text = normalizeUiText(message);
  if (/share.*image|chia se hinh anh/.test(text)) return CHATGPT_ERROR_REASONS.SEND_BUTTON_SHARE_IMAGE;
  if (/wrong.*send|wrong.*target|tool.*button|send-button-wrong/.test(text)) return CHATGPT_ERROR_REASONS.SEND_BUTTON_WRONG_TARGET;
  if (/pasted.*not.*sent|prompt.*not.*acknowledged|send.*not.*ready|input.*still.*has.*text|prompt-pasted/.test(text)) return CHATGPT_ERROR_REASONS.PROMPT_PASTED_BUT_SEND_NOT_READY;
  if (/upload.*timeout|upload.*failed|khong upload/.test(text)) return CHATGPT_ERROR_REASONS.IMAGE_UPLOAD_TIMEOUT;
  if (/composer.*not.*found|prompt.*input.*not.*found|khong focus/.test(text)) return CHATGPT_ERROR_REASONS.COMPOSER_NOT_FOUND;
  if (/image.*preview.*missing|attachment.*not.*ready|image-preview/.test(text)) return CHATGPT_ERROR_REASONS.IMAGE_PREVIEW_NOT_DETECTED;
  if (/choice|required|which.*one|choose|select|pick|variant/.test(text)) return CHATGPT_ERROR_REASONS.OUTPUT_CHOICE_REQUIRED;
  if (/object reference chain|execution context|target closed|context.*destroyed/.test(text)) return CHATGPT_ERROR_REASONS.TAB_CRASHED;
  if (/cloudflare|verify|permission|security/.test(text)) return CHATGPT_ERROR_REASONS.CLOUDFLARE_OR_PERMISSION_BLOCK;
  if (/network|stall/.test(text)) return CHATGPT_ERROR_REASONS.NETWORK_STALL;
  if (/sidebar|modal|dialog|overlay/.test(text)) return CHATGPT_ERROR_REASONS.UNSAFE_SIDEBAR_MODAL;
  if (/too long|conversation.*heavy|dom.*heavy|memory|cache/.test(text)) return CHATGPT_ERROR_REASONS.MEMORY_CACHE_HEAVY;

  return CHATGPT_ERROR_REASONS.UNKNOWN_UI_STATE;
}

function classifyChatGptState(state = {}) {
  const reason = state.reason || classifyChatGptError(state.error || state.blockingReason || '');
  if (state.loggedOut || reason === CHATGPT_ERROR_REASONS.LOGGED_OUT) return { ok: false, reason: CHATGPT_ERROR_REASONS.LOGGED_OUT };
  if (state.choiceRequired) return { ok: false, reason: CHATGPT_ERROR_REASONS.OUTPUT_CHOICE_REQUIRED };
  if (!state.composerFound) return { ok: false, reason: CHATGPT_ERROR_REASONS.COMPOSER_NOT_FOUND };
  if (state.stopVisible || state.composerBusy || state.generating) return { ok: false, reason: CHATGPT_ERROR_REASONS.COMPOSER_BUSY };
  if (state.requiresImagePreview && !state.hasImagePreview) return { ok: false, reason: CHATGPT_ERROR_REASONS.IMAGE_PREVIEW_NOT_DETECTED };
  if (state.rejectedSendLabel) return { ok: false, reason: CHATGPT_ERROR_REASONS.SEND_BUTTON_SHARE_IMAGE };
  if (state.composerTextLength > 0 && !state.sendReady) return { ok: false, reason: CHATGPT_ERROR_REASONS.PROMPT_PASTED_BUT_SEND_NOT_READY };
  if (!state.sendReady) return { ok: false, reason: CHATGPT_ERROR_REASONS.UNKNOWN_UI_STATE };
  return { ok: true, reason: '', stage: CHATGPT_STAGES.WAITING_SEND_READY };
}

function buildChatGptStageLog({ sceneId = '', stage = CHATGPT_STAGES.IDLE, attempt = 0, state = {}, recoveryAction = '' } = {}) {
  return {
    sceneId,
    stage,
    attempt,
    url: state.url || '',
    title: state.title || '',
    composerFound: Boolean(state.composerFound),
    composerTextLength: Number(state.composerTextLength || 0),
    composerBusy: Boolean(state.composerBusy || state.stopVisible || state.generating),
    stopVisible: Boolean(state.stopVisible),
    sendReady: Boolean(state.sendReady),
    sendButtonLabel: state.sendButton?.label || state.sendButtonLabel || state.rejectedSendLabel || '',
    hasImagePreview: Boolean(state.hasImagePreview),
    latestAssistantTextLength: Number(state.latestAssistantTextLength || String(state.latestAssistantText || '').length || 0),
    recoveryAction,
  };
}

function getRecoveryDecision(reason, attempt = 0) {
  const isPromptSendIssue = reason === CHATGPT_ERROR_REASONS.PROMPT_PASTED_BUT_SEND_NOT_READY ||
                            reason === CHATGPT_ERROR_REASONS.SEND_BUTTON_SHARE_IMAGE ||
                            reason === CHATGPT_ERROR_REASONS.SEND_BUTTON_WRONG_TARGET ||
                            String(reason).includes('prompt-pasted') ||
                            String(reason).includes('share-image');
  
  if (isPromptSendIssue) {
    if (attempt <= 2) return 'wait';
    if (attempt === 3) return 'escape-overlays';
    if (attempt === 4) return 'clear-composer';
    if (attempt === 5) return 'keyboard-submit';
    if (attempt === 6) return 'soft-reload';
    if (attempt === 7) return 'new-chat';
    if (attempt === 8) return 'browser-restart';
    return 'fail';
  } else {
    if (attempt <= 3) return 'wait';
    if (attempt === 4) return 'escape-overlays';
    if (attempt === 5) return 'clear-composer';
    if (attempt === 6) return 'soft-reload';
    if (attempt === 7) return 'new-chat';
    if (attempt === 8) return 'browser-restart';
    return 'fail';
  }
}

function shouldRotateConversation({ sceneOrdinal = 0, conversationStartedAt = 0, assistantMessageCount = 0, domNodeCount = 0, repeatedComposerBusy = 0, repeatedWrongTarget = 0, rotateEveryScenes = 3 } = {}) {
  const now = Date.now();
  if (sceneOrdinal > 0 && sceneOrdinal % rotateEveryScenes === 0) return { rotate: true, reason: 'scene-interval' };
  if (conversationStartedAt && now - Number(conversationStartedAt) > CHATGPT_STABILITY_DEFAULTS.maxConversationAgeMs) return { rotate: true, reason: 'conversation-age' };
  if (assistantMessageCount >= CHATGPT_STABILITY_DEFAULTS.maxAssistantMessagesPerChat) return { rotate: true, reason: 'assistant-message-count' };
  if (domNodeCount >= 9000) return { rotate: true, reason: 'dom-heavy' };
  if (repeatedComposerBusy >= 2) return { rotate: true, reason: 'repeated-composer-busy' };
  if (repeatedWrongTarget >= 2) return { rotate: true, reason: 'repeated-wrong-target' };
  return { rotate: false, reason: '' };
}

module.exports = {
  CHATGPT_STAGES,
  CHATGPT_ERROR_REASONS,
  CHATGPT_STABILITY_DEFAULTS,
  normalizeUiText,
  isRejectedSendLabel,
  isLikelyComposerSendLabel,
  classifyChatGptError,
  classifyChatGptState,
  buildChatGptStageLog,
  getRecoveryDecision,
  shouldRotateConversation,
};
