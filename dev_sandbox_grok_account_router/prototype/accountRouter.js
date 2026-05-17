// Phase 1 sandbox prototype only. Do not use real Grok credentials here.

export const ACCOUNT_STATES = Object.freeze({
  AVAILABLE: 'available',
  ACTIVE: 'active',
  COOLDOWN: 'cooldown',
  LIMITED: 'limited',
  LOGIN_REQUIRED: 'login_required',
  INVALID: 'invalid',
  DISABLED_BY_USER: 'disabled_by_user',
});

export const ERROR_TYPES = Object.freeze({
  CANVAS_LIMIT: 'canvas_limit',
  ACCOUNT_LIMIT: 'account_limit',
  NETWORK_ERROR: 'network_error',
  LOGIN_REQUIRED: 'login_required',
  UNKNOWN_ERROR: 'unknown_error',
});

export const ROUTING_STRATEGIES = Object.freeze({
  ROUND_ROBIN: 'round_robin',
  PRIORITY: 'priority',
  LEAST_RECENTLY_USED: 'least_recently_used',
  QUOTA_AWARE: 'quota_aware',
  FALLBACK_GROUP: 'fallback_group',
});

const NON_SELECTABLE_STATES = new Set([
  ACCOUNT_STATES.LIMITED,
  ACCOUNT_STATES.LOGIN_REQUIRED,
  ACCOUNT_STATES.INVALID,
  ACCOUNT_STATES.DISABLED_BY_USER,
]);

const VALID_TRANSITIONS = {
  available: new Set(['active', 'cooldown', 'limited', 'login_required', 'invalid', 'disabled_by_user']),
  active: new Set(['available', 'cooldown', 'limited', 'login_required', 'invalid', 'disabled_by_user']),
  cooldown: new Set(['available', 'login_required', 'invalid', 'disabled_by_user']),
  limited: new Set(['cooldown', 'available', 'disabled_by_user']),
  login_required: new Set(['available', 'invalid', 'disabled_by_user']),
  invalid: new Set(['disabled_by_user']),
  disabled_by_user: new Set(['available']),
};

const nowIso = () => new Date().toISOString();
const safeAccountLabel = (account) => account?.maskedEmail || 'masked-account';

const FULL_EMAIL_PATTERN = /\b[A-Z0-9._%+-]{2,}@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

export function containsFullPrivateEmail(text) {
  return FULL_EMAIL_PATTERN.test(String(text || ''));
}

export function assertNoSecretLikeContent(value, label = 'value') {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (containsPlainSecret(text)) throw new Error(`Refusing ${label} with secret-like plaintext.`);
  if (containsFullPrivateEmail(text)) throw new Error(`Refusing ${label} with full private email.`);
}

export function createAccount(input) {
  assertNoSecretLikeContent(input, 'account metadata');
  if (input.email || input.password || input.cookies || input.sessionToken || input.refreshToken || input.apiKey) {
    throw new Error('Account metadata must not include raw credential fields.');
  }
  return {
    accountId: input.accountId,
    displayName: input.displayName || 'Grok Account',
    maskedEmail: input.maskedEmail || 'm***@example.test',
    status: input.status || ACCOUNT_STATES.AVAILABLE,
    priority: Number.isFinite(input.priority) ? input.priority : 100,
    lastUsedAt: input.lastUsedAt || null,
    cooldownUntil: input.cooldownUntil || null,
    encryptedSecretRef: input.encryptedSecretRef || null,
    canvasRef: input.canvasRef || null,
    profileRef: input.profileRef || null,
  };
}

export function isSelectableAccount(account, at = new Date()) {
  if (!account || NON_SELECTABLE_STATES.has(account.status)) return false;
  if (account.status === ACCOUNT_STATES.COOLDOWN) {
    return Boolean(account.cooldownUntil && new Date(account.cooldownUntil) <= at);
  }
  return account.status === ACCOUNT_STATES.AVAILABLE || account.status === ACCOUNT_STATES.ACTIVE;
}

export function transitionAccount(account, nextStatus, details = {}) {
  const currentStatus = account.status || ACCOUNT_STATES.AVAILABLE;
  const validNext = VALID_TRANSITIONS[currentStatus];
  if (!validNext || !validNext.has(nextStatus)) {
    return {
      account,
      changed: false,
      log: `Ignored invalid account state transition for ${safeAccountLabel(account)}: ${currentStatus} -> ${nextStatus}`,
    };
  }

  const updated = { ...account, status: nextStatus, updatedAt: details.at || nowIso() };
  if (nextStatus === ACCOUNT_STATES.ACTIVE) updated.lastUsedAt = updated.updatedAt;
  if (details.cooldownUntil) updated.cooldownUntil = details.cooldownUntil;
  if (nextStatus !== ACCOUNT_STATES.COOLDOWN && details.clearCooldown !== false) updated.cooldownUntil = null;
  return {
    account: updated,
    changed: true,
    log: `Account state changed for ${safeAccountLabel(account)}: ${currentStatus} -> ${nextStatus}`,
  };
}

export const markActive = (account, details) => transitionAccount(account, ACCOUNT_STATES.ACTIVE, details);
export const markAvailable = (account, details) => transitionAccount(account, ACCOUNT_STATES.AVAILABLE, details);
export const markLimited = (account, details) => transitionAccount(account, ACCOUNT_STATES.LIMITED, details);
export const markCooldown = (account, details = {}) => transitionAccount(account, ACCOUNT_STATES.COOLDOWN, details);
export const markLoginRequired = (account, details) => transitionAccount(account, ACCOUNT_STATES.LOGIN_REQUIRED, details);
export const markInvalid = (account, details) => transitionAccount(account, ACCOUNT_STATES.INVALID, details);
export const disableByUser = (account, details) => transitionAccount(account, ACCOUNT_STATES.DISABLED_BY_USER, details);

export function pickNextAccount(accounts, currentAccountId, routing = {}) {
  const strategy = routing.strategy || ROUTING_STRATEGIES.ROUND_ROBIN;
  if (strategy !== ROUTING_STRATEGIES.ROUND_ROBIN) {
    // Extension point for future policies: priority, least_recently_used, quota_aware, fallback_group.
    return { account: null, reason: `Routing strategy ${strategy} is reserved for future prototype work.` };
  }

  const selectable = accounts.filter((account) => isSelectableAccount(account));
  if (!selectable.length) return { account: null, reason: 'No selectable Grok accounts are available.' };
  const currentIndex = selectable.findIndex((account) => account.accountId === currentAccountId);
  return {
    account: selectable[currentIndex === -1 ? 0 : (currentIndex + 1) % selectable.length],
    reason: 'Selected by round_robin policy.',
  };
}

export function classifyGenerationError(errorLike) {
  const text = String(errorLike?.code || errorLike?.message || errorLike || '').toLowerCase();
  if (text.includes('canvas') && (text.includes('limit') || text.includes('quota'))) return ERROR_TYPES.CANVAS_LIMIT;
  if ((text.includes('account') || text.includes('quota') || text.includes('daily')) && text.includes('limit')) return ERROR_TYPES.ACCOUNT_LIMIT;
  if (text.includes('login') || text.includes('auth') || text.includes('session expired')) return ERROR_TYPES.LOGIN_REQUIRED;
  if (text.includes('network') || text.includes('timeout') || text.includes('connection')) return ERROR_TYPES.NETWORK_ERROR;
  return ERROR_TYPES.UNKNOWN_ERROR;
}

export function createCheckpoint(input = {}) {
  assertNoSecretLikeContent(input, 'checkpoint input');
  const timestamp = nowIso();
  return {
    schemaVersion: 1,
    checkpointId: input.checkpointId || `chk_${Date.now()}`,
    project: { id: input.projectId || 'project_sample', name: input.projectName || 'Sample project' },
    scene: { id: input.sceneId || 'scene_sample', index: Number.isFinite(input.sceneIndex) ? input.sceneIndex : 0 },
    imageRef: input.imageRef || 'keyframe://sample-only',
    motionPrompt: input.motionPrompt || 'Sample motion prompt without secrets.',
    provider: input.provider || 'grok',
    accountId: input.accountId || null,
    canvasRef: input.canvasRef || null,
    sessionProfileRef: input.sessionProfileRef || null,
    status: input.status || 'created',
    lastErrorClassification: input.lastErrorClassification || null,
    createdAt: input.createdAt || timestamp,
    updatedAt: input.updatedAt || timestamp,
  };
}

export function checkpointContainsSecret(checkpoint) {
  const text = JSON.stringify(checkpoint);
  return containsPlainSecret(text) || containsFullPrivateEmail(text);
}

export function saveMockCheckpoint(store, checkpoint) {
  if (checkpointContainsSecret(checkpoint)) throw new Error('Refusing to save checkpoint with secret-like plaintext or full private email.');
  const saved = { ...checkpoint, updatedAt: nowIso() };
  store.checkpoints.set(saved.checkpointId, saved);
  return saved;
}

export const loadMockCheckpoint = (store, id) => store.checkpoints.get(id) || null;

export function resumeFromCheckpoint(checkpoint, accounts = []) {
  if (!checkpoint) return { action: 'pause', reason: 'No checkpoint to resume.' };
  const account = accounts.find((candidate) => candidate.accountId === checkpoint.accountId);
  if (!account || !isSelectableAccount(account)) {
    return { action: 'pause', reason: 'Checkpoint account is not currently usable.', accountId: checkpoint.accountId, checkpoint };
  }
  return {
    action: 'resume_scene',
    accountId: checkpoint.accountId,
    sceneId: checkpoint.scene.id,
    imageRef: checkpoint.imageRef,
    motionPrompt: checkpoint.motionPrompt,
    checkpoint,
  };
}

export function containsPlainSecret(text) {
  return /(password\s*[:=]|bearer\s+[a-z0-9._-]+|refresh[_-]?token\s*[:=]|session[_-]?token\s*[:=]|cookie\s*[:=]|api[_-]?key\s*[:=]|sk-[a-z0-9]{12,})/i.test(text);
}

export function createMockEncryptedStorage() {
  const secrets = new Map();
  return {
    // Sandbox-only obfuscation. Production must use OS credential storage, Electron safeStorage, or approved keytar.
    saveSecret(ref, fakePayload) {
      assertNoSecretLikeContent(fakePayload, 'sandbox mock storage payload');
      const encoded = Buffer.from(JSON.stringify(fakePayload), 'utf8').toString('base64');
      secrets.set(ref, `mock-encrypted:${encoded}`);
      return ref;
    },
    loadSecret(ref) {
      const encoded = secrets.get(ref);
      if (!encoded) return null;
      return JSON.parse(Buffer.from(encoded.replace('mock-encrypted:', ''), 'base64').toString('utf8'));
    },
    dumpRefs() {
      return Array.from(secrets.keys());
    },
  };
}

export function handleGenerationError({ accounts, activeAccountId, error, checkpoint, routing, store }) {
  const classification = classifyGenerationError(error);
  const nextCheckpoint = saveMockCheckpoint(store, {
    ...checkpoint,
    accountId: activeAccountId,
    status: classification === ERROR_TYPES.CANVAS_LIMIT ? 'canvas_switch_needed' : 'paused_or_switching',
    lastErrorClassification: classification,
  });
  const currentIndex = accounts.findIndex((account) => account.accountId === activeAccountId);
  const currentAccount = accounts[currentIndex];

  if (classification === ERROR_TYPES.CANVAS_LIMIT) {
    return { action: 'switch_canvas', accounts, checkpoint: nextCheckpoint, activeAccountId, canvasRef: `canvas_${Date.now()}` };
  }

  if (classification === ERROR_TYPES.ACCOUNT_LIMIT && currentAccount) {
    const updatedAccounts = accounts.slice();
    updatedAccounts[currentIndex] = markLimited(currentAccount).account;
    const next = pickNextAccount(updatedAccounts, activeAccountId, routing);
    if (!next.account) return { action: 'pause', accounts: updatedAccounts, checkpoint: nextCheckpoint, reason: next.reason };
    return {
      action: 'switch_account',
      accounts: updatedAccounts.map((account) => account.accountId === next.account.accountId ? markActive(account).account : account),
      checkpoint: { ...nextCheckpoint, accountId: next.account.accountId },
      activeAccountId: next.account.accountId,
    };
  }

  if (classification === ERROR_TYPES.LOGIN_REQUIRED && currentAccount) {
    const updatedAccounts = accounts.slice();
    updatedAccounts[currentIndex] = markLoginRequired(currentAccount).account;
    return { action: 'pause_for_login', accounts: updatedAccounts, checkpoint: nextCheckpoint };
  }

  return { action: 'pause', accounts, checkpoint: nextCheckpoint, reason: classification };
}