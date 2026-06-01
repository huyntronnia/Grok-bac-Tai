const { execFileSync, spawn } = require('child_process');
const { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, Menu, shell, safeStorage } = require('electron');
const CDP = require('chrome-remote-interface');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

// Some Windows GPU/driver combinations render a blank Electron window while
// repeatedly logging "GPU process exited unexpectedly: exit_code=34".
// Disable Chromium GPU acceleration before app readiness so the renderer uses
// the software path instead of failing the whole visible surface.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer', 'false');

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v']);
const webWindows = new Map();
const PROVIDER_META = {
  chatgpt: { url: 'https://chatgpt.com/', title: 'ChatGPT', partition: 'chatgpt-web-session' },
  grok: { url: 'https://grok.com/', title: 'Grok', partition: 'grok-web-session' },
  pixverse: { url: 'https://app.pixverse.ai/', title: 'PixVerse', partition: 'pixverse-web-session' },
};
const WEB_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DEFAULT_CHROME_DEBUG_PORT = Number(process.env.VIDORA_CHROME_DEBUG_PORT || 9223);
let chromeDebugPort = DEFAULT_CHROME_DEBUG_PORT;
const CHROME_USER_DATA_DIR = path.join(app.getPath('userData'), 'chrome-cdp-profile');
let chromeUserDataDir = CHROME_USER_DATA_DIR;
const CHALLENGE_RECOVERY_LIMIT = 2;
const challengeRecoveryAttempts = new Map();
let chromeProcess = null;
let showPipelineLog = false;
const chatTitleStableChecks = new Map();
const APP_LOG_FILE = path.join(app.getPath('userData'), 'ai-video-pipeline.log');
const GROK_ROUTER_CHECKPOINT_FILE = path.join(app.getPath('userData'), 'grok-router-checkpoint.json');
const WEB_ACCOUNT_STORE_FILE = path.join(app.getPath('userData'), 'web-provider-accounts.secure.json');
const HARD_PROMPT_FILE_NAME = '2 NHIá»†M Vá»¤ Báº°NG PROMPT.txt';
const HARD_PROMPT_FILE = app.isPackaged
  ? path.join(process.resourcesPath, HARD_PROMPT_FILE_NAME)
  : path.resolve(__dirname, '..', HARD_PROMPT_FILE_NAME);
const GROK_ROUTER_ALLOWED_STATES = new Set(['available', 'active', 'cooldown', 'limited', 'login_required', 'invalid', 'disabled_by_user']);
const HARD_PROMPT_FILE_FALLBACK_NAMES = [
  '2 NHIỆM VỤ BẰNG PROMPT.txt',
  HARD_PROMPT_FILE_NAME,
];

const GROKPROJ_SCHEMA_VERSION = 1;
const SECRET_KEY_PATTERN = /(api[_-]?key|cookie|password|passwd|secret|session[_-]?token|refresh[_-]?token|bearer|authorization|localStorage|sessionStorage|browserStorage|rawBrowserStorage)/i;
const SECRET_VALUE_PATTERN = /(bearer\s+[a-z0-9._~+/=-]{8,}|sk-[a-z0-9_-]{12,}|xox[baprs]-[a-z0-9-]{8,}|(?:api[_-]?key|cookie|password|passwd|session[_-]?token|refresh[_-]?token)\s*[:=])/i;

function loginRequiredMessage(provider, detail = '') {
  const normalized = normalizeWebProvider(provider);
  const title = PROVIDER_META[normalized]?.title || normalized;
  return `LOGIN_REQUIRED:${normalized}: ${title} chÆ°a Ä‘Äƒng nháº­p hoáº·c session Ä‘Ã£ háº¿t háº¡n. HÃ£y Ä‘Äƒng nháº­p láº¡i trong tab ${title}${detail ? `. Chi tiáº¿t: ${detail}` : ''}`;
}
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function ensureProjectFilePath(filePath) {
  if (!filePath || path.extname(filePath).toLowerCase() !== '.vdra') {
    throw new Error('Project file must use the .vdra extension.');
  }
  return filePath;
}

function hasFullPrivateEmail(value) {
  const match = String(value || '').match(EMAIL_PATTERN);
  if (!match) return false;
  return !/^\*+@/.test(match[0]) && !/\*{2,}/.test(match[0]);
}

function sanitizeProjectValue(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizeProjectValue(item));
  if (value && typeof value === 'object') {
    const clean = {};
    for (const [key, child] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key)) continue;
      clean[key] = sanitizeProjectValue(child);
    }
    return clean;
  }
  if (typeof value === 'string') return value.replace(EMAIL_PATTERN, (email) => (/^\*+@|\*{2,}/.test(email) ? email : maskRouterText(email)));
  return value;
}

function assertNoProjectSecrets(value, keyPath = []) {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoProjectSecrets(item, keyPath.concat(String(index))));
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key)) throw new Error(`Project payload contains disallowed secret field: ${keyPath.concat(key).join('.')}`);
      assertNoProjectSecrets(child, keyPath.concat(key));
    }
    return;
  }
  if (typeof value === 'string') {
    if (SECRET_VALUE_PATTERN.test(value)) throw new Error(`Project payload contains secret-like value at: ${keyPath.join('.') || 'root'}`);
    if (hasFullPrivateEmail(value)) throw new Error('Project payload contains a full private email address.');
  }
}

function assertObjectField(payload, key) {
  if (!payload[key] || typeof payload[key] !== 'object' || Array.isArray(payload[key])) {
    throw new Error(`Invalid .grokproj: ${key} is required.`);
  }
}

function validateProjectPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid .grokproj: root payload must be an object.');
  if (typeof payload.schemaVersion !== 'number') throw new Error('Invalid .grokproj: schemaVersion is required.');
  if (payload.schemaVersion > GROKPROJ_SCHEMA_VERSION) throw new Error(`Unsupported future .grokproj schemaVersion ${payload.schemaVersion}. App supports ${GROKPROJ_SCHEMA_VERSION}.`);
  if (payload.schemaVersion !== GROKPROJ_SCHEMA_VERSION) throw new Error(`Unsupported .grokproj schemaVersion ${payload.schemaVersion}. App supports ${GROKPROJ_SCHEMA_VERSION}.`);
  if (!payload.project || typeof payload.project !== 'object') throw new Error('Invalid .grokproj: project is required.');
  if (!Array.isArray(payload.project.scenes)) throw new Error('Invalid .grokproj: project.scenes[] is required.');
  ['inputs', 'config', 'router', 'assets'].forEach((key) => assertObjectField(payload, key));
  if (!Array.isArray(payload.previewTimeline)) throw new Error('Invalid .grokproj: previewTimeline[] is required.');
  if (!payload.runtime || typeof payload.runtime !== 'object') throw new Error('Invalid .grokproj: runtime is required.');
  assertNoProjectSecrets(payload);
  return payload;
}

async function newProjectSession(event, options = {}) {
  if (options?.hasUnsavedChanges) {
    const messageOptions = {
      type: 'question',
      title: 'Unsaved Project',
      message: 'Current project has unsaved changes.',
      detail: `Save before ${options.actionLabel || 'continuing'}?`,
      buttons: ['Save', 'Discard', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
    };
    const window = event?.sender ? BrowserWindow.fromWebContents(event.sender) : null;
    const result = window ? await dialog.showMessageBox(window, messageOptions) : await dialog.showMessageBox(messageOptions);
    return { ok: true, action: ['save', 'discard', 'cancel'][result.response] || 'cancel' };
  }
  return { ok: true, schemaVersion: GROKPROJ_SCHEMA_VERSION, createdAt: new Date().toISOString() };
}

async function saveProjectSessionFile(_event, payload = {}) {
  const embeddedPayload = await embedProjectAssets(payload);
  const safePayload = validateProjectPayload(sanitizeProjectValue(embeddedPayload));
  const safeName = sanitizeFileName(safePayload.project?.name || 'vidora-project');
  const result = await dialog.showSaveDialog({
    title: 'Save Vidora Project',
    defaultPath: `${safeName}.vdra`,
    filters: [{ name: 'Vidora Project', extensions: ['vdra'] }],
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  const filePath = ensureProjectFilePath(result.filePath.toLowerCase().endsWith('.vdra') ? result.filePath : `${result.filePath}.vdra`);
  const projectFolder = path.join(path.dirname(filePath), sanitizeFileName(path.basename(filePath, path.extname(filePath)) || safeName));
  safePayload.runtime = { ...(safePayload.runtime || {}), outputFolder: projectFolder };
  const finalPayload = validateProjectPayload(sanitizeProjectValue(safePayload));
  await fs.mkdir(projectFolder, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(finalPayload, null, 2), 'utf8');
  return { ok: true, filePath, projectFolder, payload: finalPayload };
}

async function overwriteProjectSessionFile(_event, { filePath = '', payload = {} } = {}) {
  if (!filePath) return { ok: false, error: 'Missing project file path.' };
  const embeddedPayload = await embedProjectAssets(payload);
  const safePayload = validateProjectPayload(sanitizeProjectValue(embeddedPayload));
  const targetPath = ensureProjectFilePath(filePath.toLowerCase().endsWith('.vdra') ? filePath : `${filePath}.vdra`);
  const projectFolder = path.join(path.dirname(targetPath), sanitizeFileName(path.basename(targetPath, path.extname(targetPath)) || safePayload.project?.name || 'vidora-project'));
  safePayload.runtime = { ...(safePayload.runtime || {}), outputFolder: projectFolder };
  const finalPayload = validateProjectPayload(sanitizeProjectValue(safePayload));
  await fs.mkdir(projectFolder, { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(finalPayload, null, 2), 'utf8');
  return { ok: true, filePath: targetPath, projectFolder, payload: finalPayload };
}

async function createProjectSessionFile(_event, { folderPath = '', projectName = '', payload = {} } = {}) {
  if (!folderPath) return { ok: false, error: 'Missing output folder.' };
  const safePayload = sanitizeProjectValue(payload);
  const safeName = sanitizeFileName(projectName || safePayload.project?.name || 'ai-scene-project');
  const projectFolder = path.join(folderPath, safeName);
  safePayload.runtime = { ...(safePayload.runtime || {}), outputFolder: projectFolder };
  const validPayload = validateProjectPayload(safePayload);
  const filePath = ensureProjectFilePath(path.join(folderPath, `${safeName}.vdra`));
  await fs.mkdir(projectFolder, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(validPayload, null, 2), 'utf8');
  return { ok: true, filePath, projectFolder, payload: validPayload };
}

async function openProjectSessionFile() {
  const result = await dialog.showOpenDialog({ title: 'Open Vidora Project', properties: ['openFile'], filters: [{ name: 'Vidora Project', extensions: ['vdra'] }, { name: 'Legacy Grok Project', extensions: ['grokproj'] }] });
  if (result.canceled || !result.filePaths?.[0]) return { ok: false, canceled: true };
  const filePath = result.filePaths[0];
  let parsed;
  try { parsed = JSON.parse(await fs.readFile(filePath, 'utf8')); } catch (_error) { throw new Error('Invalid .vdra: file is not valid JSON.'); }
  const projectFolderName = sanitizeFileName(path.basename(filePath, path.extname(filePath)) || parsed?.project?.name || 'ai-scene-project');
  const projectFolder = path.join(path.dirname(filePath), projectFolderName);
  parsed.runtime = { ...(parsed.runtime || {}), outputFolder: projectFolder };
  await fs.mkdir(projectFolder, { recursive: true });
  await restoreEmbeddedProjectAssets(parsed, projectFolder);
  const payload = validateProjectPayload(sanitizeProjectValue(parsed));
  payload.runtime = { ...payload.runtime, outputFolder: projectFolder, autoRun: false, waitingForUserStart: true, active: false };
  return { ok: true, filePath, projectFolder, payload };
}

async function embedProjectAssets(payload = {}) {
  const cloned = JSON.parse(JSON.stringify(payload || {}));
  const scenes = Array.isArray(cloned.project?.scenes) ? cloned.project.scenes : [];
  cloned.embeddedAssets = { version: 1, encoding: 'base64', scenes: [] };
  for (const scene of scenes) {
    const sceneId = scene.sceneId || scene.id;
    const record = { sceneId, files: {} };
    for (const [kind, key] of [['image', 'imagePath'], ['video', 'videoPath']]) {
      const filePath = scene[key];
      if (!filePath || !(await pathExists(filePath))) continue;
      const buffer = await fs.readFile(filePath);
      record.files[kind] = {
        fileName: path.basename(filePath),
        relativePath: `scene_${String(sceneId).padStart(3, '0')}/${path.basename(filePath)}`,
        mimeType: kind === 'video' ? 'video/mp4' : `image/${path.extname(filePath).slice(1).toLowerCase() || 'png'}`,
        sizeBytes: buffer.length,
        data: buffer.toString('base64'),
      };
    }
    if (Object.keys(record.files).length) cloned.embeddedAssets.scenes.push(record);
  }
  return cloned;
}

async function restoreEmbeddedProjectAssets(payload = {}, projectFolder = '') {
  const records = Array.isArray(payload.embeddedAssets?.scenes) ? payload.embeddedAssets.scenes : [];
  if (!records.length || !projectFolder) return;
  const scenes = Array.isArray(payload.project?.scenes) ? payload.project.scenes : [];
  for (const record of records) {
    const scene = scenes.find((item) => String(item.id) === String(record.sceneId) || String(item.sceneId) === String(record.sceneId));
    if (!scene) continue;
    const sceneDir = path.join(projectFolder, `scene_${String(record.sceneId).padStart(3, '0')}`);
    await fs.mkdir(sceneDir, { recursive: true });
    for (const [kind, file] of Object.entries(record.files || {})) {
      if (!file?.data || !file?.fileName) continue;
      const targetPath = path.join(sceneDir, sanitizeFileName(file.fileName));
      if (!(await pathExists(targetPath))) await fs.writeFile(targetPath, Buffer.from(file.data, 'base64'));
      if (kind === 'image') scene.imagePath = targetPath;
      if (kind === 'video') scene.videoPath = targetPath;
    }
  }
}

async function ensureProjectSceneFolders(_event, { outputFolder = '', scenes = [] } = {}) {
  if (!outputFolder) return { ok: false, error: 'Missing output folder.' };
  await fs.mkdir(outputFolder, { recursive: true });
  const records = [];
  for (const scene of Array.isArray(scenes) ? scenes : []) {
    const sceneId = scene?.id || scene?.sceneId || records.length + 1;
    const sceneDir = path.join(outputFolder, `scene_${String(sceneId).padStart(3, '0')}`);
    await fs.mkdir(sceneDir, { recursive: true });
    if (scene?.original || scene?.rawSceneText) await fs.writeFile(path.join(sceneDir, 'scene.txt'), scene.original || scene.rawSceneText || '', 'utf8');
    if (scene?.imagePrompt) await fs.writeFile(path.join(sceneDir, 'image_prompt.txt'), scene.imagePrompt, 'utf8');
    if (scene?.motionPrompt) await fs.writeFile(path.join(sceneDir, 'motion_prompt.txt'), scene.motionPrompt, 'utf8');
    const keyframePath = path.join(sceneDir, `scene_${String(sceneId).padStart(3, '0')}_keyframe.png`);
    const videoPath = path.join(sceneDir, `scene_${String(sceneId).padStart(3, '0')}_video.mp4`);
    const files = await fs.readdir(sceneDir).catch(() => []);
    const fallbackImage = files.find((file) => /\.(png|jpe?g|webp)$/i.test(file));
    const fallbackVideo = files.find((file) => /\.(mp4|webm|mov)$/i.test(file));
    const foundKeyframePath = await pathExists(keyframePath) ? keyframePath : fallbackImage ? path.join(sceneDir, fallbackImage) : keyframePath;
    const foundVideoPath = await pathExists(videoPath) ? videoPath : fallbackVideo ? path.join(sceneDir, fallbackVideo) : videoPath;
    records.push({
      sceneId,
      sceneDir,
      keyframePath: foundKeyframePath,
      keyframeExists: await pathExists(foundKeyframePath),
      videoPath: foundVideoPath,
      videoExists: await pathExists(foundVideoPath),
    });
  }
  return { ok: true, outputFolder, records };
}

const grokRouterState = {
  accountRouterEnabled: false,
  routingPolicy: 'round_robin',
  paused: false,
  pauseReason: '',
  lastErrorClassification: '',
  lastSafeMessage: '',
  selectedAccountId: 'grok-default-profile',
  accounts: [
    { accountId: 'grok-default-profile', label: 'Grok default profile', maskedEmail: 'gr***@masked.local', state: 'active', profileRef: 'grok-web-session', canvasRef: '' },
  ],
  checkpoint: null,
};

function maskRouterText(value = '') {
  const text = String(value || '');
  return text
    .replace(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi, '***@$1')
    .replace(/(bearer\s+)[a-z0-9._-]+/gi, '$1[redacted]')
    .replace(/(password|cookie|session[_-]?token|refresh[_-]?token|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]');
}

function normalizeCredentialProvider(provider) {
  return provider === 'grok' ? 'grok' : 'chatgpt';
}

function maskEmail(email = '') {
  const value = String(email || '').trim();
  const [name, domain] = value.split('@');
  if (!name || !domain) return value ? '***' : '';
  return `${name.slice(0, 2)}***@${domain}`;
}

function ensureCredentialEncryptionAvailable() {
  if (!safeStorage?.isEncryptionAvailable?.()) {
    throw new Error('MÃ¡y nÃ y chÆ°a cÃ³ Electron safeStorage kháº£ dá»¥ng; khÃ´ng lÆ°u account náº¿u khÃ´ng mÃ£ hÃ³a Ä‘Æ°á»£c.');
  }
}

async function readWebAccountStore({ includeSecrets = false } = {}) {
  if (!(await pathExists(WEB_ACCOUNT_STORE_FILE))) return { version: 1, accounts: [] };
  ensureCredentialEncryptionAvailable();
  const raw = JSON.parse(await fs.readFile(WEB_ACCOUNT_STORE_FILE, 'utf8'));
  const encrypted = Buffer.from(String(raw.data || ''), 'base64');
  const payload = JSON.parse(safeStorage.decryptString(encrypted) || '{}');
  const accounts = Array.isArray(payload.accounts) ? payload.accounts : [];
  return {
    version: 1,
    accounts: accounts.map((account) => includeSecrets ? account : {
      id: account.id,
      provider: normalizeCredentialProvider(account.provider),
      label: account.label || '',
      email: account.email || '',
      state: account.state || 'available',
      selected: Boolean(account.selected),
      lastUsedAt: account.lastUsedAt || '',
      updatedAt: account.updatedAt || '',
    }),
  };
}

async function writeWebAccountStore(store = {}) {
  ensureCredentialEncryptionAvailable();
  const payload = {
    version: 1,
    accounts: Array.isArray(store.accounts) ? store.accounts : [],
  };
  const encrypted = safeStorage.encryptString(JSON.stringify(payload));
  await fs.mkdir(path.dirname(WEB_ACCOUNT_STORE_FILE), { recursive: true });
  await fs.writeFile(WEB_ACCOUNT_STORE_FILE, JSON.stringify({ version: 1, encrypted: true, data: encrypted.toString('base64') }, null, 2), 'utf8');
}

function safeWebAccount(account = {}) {
  return {
    id: account.id,
    provider: normalizeCredentialProvider(account.provider),
    label: maskRouterText(account.label || account.email || ''),
    maskedEmail: maskEmail(account.email || ''),
    state: account.state || 'available',
    selected: Boolean(account.selected),
    lastUsedAt: account.lastUsedAt || '',
    updatedAt: account.updatedAt || '',
  };
}

async function listWebAccountsSafe(_event, provider = '') {
  const normalized = provider ? normalizeCredentialProvider(provider) : '';
  const store = await readWebAccountStore();
  const accounts = store.accounts
    .filter((account) => !normalized || normalizeCredentialProvider(account.provider) === normalized)
    .map(safeWebAccount);
  return { ok: true, encryptionAvailable: Boolean(safeStorage?.isEncryptionAvailable?.()), accounts };
}

async function saveWebAccount(_event, input = {}) {
  const provider = normalizeCredentialProvider(input.provider);
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');
  const label = String(input.label || '').trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Email account khÃ´ng há»£p lá»‡.' };
  if (!password) return { ok: false, error: 'Password khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.' };
  const store = await readWebAccountStore({ includeSecrets: true });
  const existing = store.accounts.find((account) => normalizeCredentialProvider(account.provider) === provider && String(account.email || '').toLowerCase() === email);
  const now = new Date().toISOString();
  if (existing) {
    existing.label = label || existing.label || email;
    existing.password = password;
    existing.state = 'available';
    existing.updatedAt = now;
  } else {
    store.accounts.push({
      id: crypto.randomUUID(),
      provider,
      label: label || email,
      email,
      password,
      state: 'available',
      selected: !store.accounts.some((account) => normalizeCredentialProvider(account.provider) === provider && account.selected),
      createdAt: now,
      updatedAt: now,
      lastUsedAt: '',
    });
  }
  await writeWebAccountStore(store);
  await appendAppLog(null, { source: 'main', kind: 'ok', text: `ÄÃ£ lÆ°u account ${provider}: ${maskEmail(email)} (encrypted safeStorage).` });
  return listWebAccountsSafe(null, provider);
}

async function deleteWebAccount(_event, accountId = '') {
  const id = String(accountId || '').trim();
  const store = await readWebAccountStore({ includeSecrets: true });
  const removed = store.accounts.find((account) => account.id === id);
  store.accounts = store.accounts.filter((account) => account.id !== id);
  if (removed?.selected) {
    const next = store.accounts.find((account) => normalizeCredentialProvider(account.provider) === normalizeCredentialProvider(removed.provider) && !['limited', 'login_required', 'disabled'].includes(account.state));
    if (next) next.selected = true;
  }
  await writeWebAccountStore(store);
  return listWebAccountsSafe(null, removed?.provider || '');
}

async function markWebAccountState(provider = '', accountId = '', state = 'available') {
  const normalized = normalizeCredentialProvider(provider);
  const store = await readWebAccountStore({ includeSecrets: true });
  const account = store.accounts.find((item) => item.id === accountId && normalizeCredentialProvider(item.provider) === normalized)
    || store.accounts.find((item) => item.selected && normalizeCredentialProvider(item.provider) === normalized);
  if (!account) return null;
  account.state = state;
  account.updatedAt = new Date().toISOString();
  await writeWebAccountStore(store);
  return account;
}

async function pickWebAccount(provider = '', { rotate = false } = {}) {
  const normalized = normalizeCredentialProvider(provider);
  const store = await readWebAccountStore({ includeSecrets: true });
  const providerAccounts = store.accounts.filter((account) => normalizeCredentialProvider(account.provider) === normalized);
  if (!providerAccounts.length) return { account: null, store };
  const usable = providerAccounts.filter((account) => !['limited', 'login_required', 'disabled'].includes(account.state));
  if (!usable.length) return { account: null, store };
  let account = usable.find((item) => item.selected) || usable[0];
  if (rotate && usable.length > 1) {
    const currentIndex = usable.findIndex((item) => item.id === account.id);
    account = usable[(currentIndex + 1) % usable.length];
  }
  providerAccounts.forEach((item) => {
    item.selected = item.id === account.id;
    if (item.selected && item.state !== 'limited') item.state = 'active';
    else if (item.state === 'active') item.state = 'available';
  });
  account.lastUsedAt = new Date().toISOString();
  await writeWebAccountStore(store);
  return { account, store };
}

function getSafeGrokAccounts() {
  return grokRouterState.accounts.map((account) => ({
    accountId: account.accountId,
    label: maskRouterText(account.label || account.accountId),
    maskedEmail: maskRouterText(account.maskedEmail || '***@masked.local'),
    state: GROK_ROUTER_ALLOWED_STATES.has(account.state) ? account.state : 'invalid',
    selected: account.accountId === grokRouterState.selectedAccountId,
  }));
}

function getGrokRouterStatus() {
  const active = getSafeGrokAccounts().find((account) => account.selected) || null;
  return {
    accountRouterEnabled: Boolean(grokRouterState.accountRouterEnabled),
    routingPolicy: grokRouterState.routingPolicy,
    paused: Boolean(grokRouterState.paused),
    pauseReason: grokRouterState.pauseReason,
    lastErrorClassification: grokRouterState.lastErrorClassification,
    lastSafeMessage: grokRouterState.lastSafeMessage,
    selectedAccountId: grokRouterState.selectedAccountId,
    activeAccount: active,
    checkpointStatus: grokRouterState.checkpoint?.currentStatus || 'none',
    checkpointUpdatedAt: grokRouterState.checkpoint?.updatedAt || '',
  };
}

function setGrokAccountState(accountId, state) {
  if (!GROK_ROUTER_ALLOWED_STATES.has(state)) return false;
  const account = grokRouterState.accounts.find((item) => item.accountId === accountId);
  if (!account) return false;
  account.state = state;
  return true;
}

async function selectGrokAccount(_event, accountId) {
  const id = String(accountId || '').trim();
  const account = grokRouterState.accounts.find((item) => item.accountId === id);
  if (!account) return { ok: false, error: 'Unknown sanitized Grok account.' };
  if (['limited', 'login_required', 'invalid', 'disabled_by_user'].includes(account.state)) {
    return { ok: false, error: `Account is not available: ${account.state}` };
  }
  grokRouterState.accounts.forEach((item) => {
    if (item.state === 'active') item.state = 'available';
  });
  account.state = 'active';
  grokRouterState.selectedAccountId = id;
  grokRouterState.paused = false;
  grokRouterState.pauseReason = '';
  grokRouterState.lastSafeMessage = 'Grok router account selected safely.';
  return { ok: true, status: getGrokRouterStatus(), accounts: getSafeGrokAccounts() };
}

async function setAccountRouterEnabled(_event, enabled) {
  grokRouterState.accountRouterEnabled = Boolean(enabled);
  if (!grokRouterState.accountRouterEnabled) {
    grokRouterState.paused = false;
    grokRouterState.pauseReason = '';
    grokRouterState.lastSafeMessage = 'Router disabled; single-account Grok pipeline is active.';
  }
  return getGrokRouterStatus();
}

function classifyGrokRouterError(error) {
  const text = `${error?.message || error || ''}\n${error?.stack || ''}`;
  if (/canvas limit|limit trong canvas|Ä‘á»•i canvas|new canvas|empty canvas/i.test(text)) return 'canvas_limit';
  if (/quota|plan|account.*limit|feature táº¡o video chÆ°a kháº£ dá»¥ng|Ä‘á»•i account/i.test(text)) return 'account_limit';
  if (/chÆ°a Ä‘Äƒng nháº­p|sign in|login|Ä‘Äƒng nháº­p/i.test(text)) return 'login_required';
  if (/network|timeout|fetch|net::|econn|timed out|háº¿t thá»i gian/i.test(text)) return 'network_error';
  return 'unknown_error';
}

async function writeGrokRouterCheckpoint(sceneDir, fields = {}) {
  const checkpoint = {
    projectName: maskRouterText(fields.projectName || 'project'),
    sceneId: fields.sceneId ?? '',
    sceneIndex: fields.sceneIndex ?? fields.sceneId ?? '',
    imageRef: fields.imageRef || '',
    motionPromptRef: fields.motionPromptRef || '',
    provider: normalizeVideoProvider(fields.provider || 'grok'),
    accountId: fields.accountId || grokRouterState.selectedAccountId,
    profileRef: fields.profileRef || 'grok-web-session',
    canvasRef: fields.canvasRef || '',
    currentStatus: fields.currentStatus || 'checkpointed',
    lastErrorClassification: fields.lastErrorClassification || '',
    createdAt: fields.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  grokRouterState.checkpoint = checkpoint;
  await fs.writeFile(GROK_ROUTER_CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2), 'utf8').catch(() => null);
  if (sceneDir) await fs.writeFile(path.join(sceneDir, 'grok_router_checkpoint.json'), JSON.stringify(checkpoint, null, 2), 'utf8').catch(() => null);
  return checkpoint;
}

async function pauseGrokRouterForError(sceneDir, classification, safeMessage, checkpointFields = {}) {
  grokRouterState.paused = true;
  grokRouterState.pauseReason = classification;
  grokRouterState.lastErrorClassification = classification;
  grokRouterState.lastSafeMessage = safeMessage;
  if (classification === 'account_limit') setGrokAccountState(grokRouterState.selectedAccountId, 'limited');
  if (classification === 'login_required') setGrokAccountState(grokRouterState.selectedAccountId, 'login_required');
  await writeGrokRouterCheckpoint(sceneDir, { ...checkpointFields, currentStatus: 'paused', lastErrorClassification: classification });
  await notifyRenderer('grok-router-paused', safeMessage, getGrokRouterStatus());
}

async function resumeFromRouterCheckpoint() {
  if (!grokRouterState.checkpoint && await pathExists(GROK_ROUTER_CHECKPOINT_FILE)) {
    const raw = await fs.readFile(GROK_ROUTER_CHECKPOINT_FILE, 'utf8').catch(() => '');
    grokRouterState.checkpoint = raw ? JSON.parse(raw) : null;
  }
  if (!grokRouterState.checkpoint) return { ok: false, error: 'No safe Grok router checkpoint is available.' };
  grokRouterState.paused = false;
  grokRouterState.pauseReason = '';
  grokRouterState.lastSafeMessage = 'Checkpoint is ready; start the pipeline again to resume safely.';
  return { ok: true, status: getGrokRouterStatus(), checkpoint: grokRouterState.checkpoint };
}

async function appendAppLog(_event, entry = {}) {
  const record = {
    ts: new Date().toISOString(),
    source: entry.source || 'renderer',
    kind: entry.kind || 'info',
    text: entry.text || '',
    details: entry.details || null,
  };
  const line = JSON.stringify(record);
  const terminalLine = `[VidoraLog][${record.source}][${record.kind}] ${record.text}${record.details ? ` ${JSON.stringify(record.details).slice(0, 2000)}` : ''}`;
  if (record.kind === 'error') console.error(terminalLine);
  else console.log(terminalLine);
  await fs.mkdir(path.dirname(APP_LOG_FILE), { recursive: true }).catch(() => null);
  await fs.appendFile(APP_LOG_FILE, `${line}\n`, 'utf8').catch(() => null);
  return { ok: true, path: APP_LOG_FILE };
}

async function notifyRenderer(type, message, details = null) {
  await appendAppLog(null, { source: 'main', kind: 'notice', text: message, details: { type, details } });
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send('pipeline:notice', { type, message, details, ts: new Date().toISOString() });
  });
}

async function getAppLogPath() {
  await appendAppLog(null, { source: 'main', kind: 'info', text: 'Log path requested' });
  return APP_LOG_FILE;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function resolveHardPromptFile() {
  const roots = [
    app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..'),
    path.resolve(__dirname, '..'),
    process.cwd(),
  ].filter(Boolean);
  const uniqueRoots = [...new Set(roots)];
  const candidates = uniqueRoots.flatMap((root) => HARD_PROMPT_FILE_FALLBACK_NAMES.map((name) => path.join(root, name)));
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  for (const root of uniqueRoots) {
    let entries = [];
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch (_error) {
      continue;
    }
    const found = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .find((name) => /^2\s+.+PROMPT\.txt$/i.test(name) || /NHI.+PROMPT\.txt$/i.test(name));
    if (found) return path.join(root, found);
  }
  throw new Error(`Không tìm thấy file prompt cứng. Đã thử: ${candidates.join('; ')}`);
}

function findTask2Index(content) {
  const direct = content.search(/NHIỆM\s*VỤ\s*2\s*:/i);
  if (direct >= 0) return direct;
  return content.search(/NHI[\s\S]{0,16}M\s*V[\s\S]{0,12}\s*2\s*:/i);
}

async function openHardPromptFile() {
  const promptFile = await resolveHardPromptFile();
  const error = await shell.openPath(promptFile);
  if (error) throw new Error(error);
  return { ok: true, filePath: promptFile };
}

async function loadHardPromptTasks() {
  const promptFile = await resolveHardPromptFile();
  const content = await fs.readFile(promptFile, 'utf8');
  const task2Index = content.search(/NHIá»†M\s*Vá»¤\s*2\s*:/i);
  const normalizedTask2Index = task2Index >= 0 ? task2Index : findTask2Index(content);
  if (normalizedTask2Index < 0) return { task1: content.trim(), task2: content.trim() };
  const task1 = content.slice(0, normalizedTask2Index).trim();
  const task2 = content.slice(normalizedTask2Index).trim();
  return { task1, task2 };
}

function buildTaskPrompt({ task = '', script = '', sceneText = '', sceneId = '' } = {}) {
  return [
    task,
    '--- Ká»ŠCH Báº¢N Tá»”NG / Bá»I Cáº¢NH ---',
    script || '(KhÃ´ng cÃ³ ká»‹ch báº£n tá»•ng riÃªng)',
    `--- SCENE ${sceneId || ''} HIá»†N Táº I ---`,
    sceneText || '',
  ].filter(Boolean).join('\n\n');
}

async function openGrokRouterFolder() {
  const routerPath = path.join(__dirname, '..', 'dev_sandbox_grok_account_router');
  await fs.mkdir(routerPath, { recursive: true });
  await shell.openPath(routerPath);
  return { ok: true, path: routerPath };
}

async function listGrokAccountsSafe() {
  return getSafeGrokAccounts();
}

app.setName('Vidora');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: 'Vidora',
    icon: path.join(__dirname, 'vidora-icon.svg'),
    backgroundColor: '#090b16',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function broadcastPipelineLogVisibility() {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send('view:pipeline-log-visible', showPipelineLog);
  });
}

function sendProjectMenuCommand(command) {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows().find((item) => !item.isDestroyed());
  if (!win || win.isDestroyed()) return;
  win.webContents.send('project:menu-command', command);
}

function buildAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendProjectMenuCommand('new'),
        },
        {
          label: 'Open Project...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendProjectMenuCommand('open'),
        },
        {
          label: 'Save Project',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendProjectMenuCommand('save'),
        },
        {
          label: 'Settings...',
          accelerator: 'CmdOrCtrl+,',
          click: () => sendProjectMenuCommand('settings'),
        },
        { type: 'separator' },
        { role: 'quit', label: 'Quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Reload' },
        { role: 'forceReload', label: 'Force Reload' },
        { role: 'toggleDevTools', label: 'Toggle Developer Tools' },
        { type: 'separator' },
        {
          label: 'Hiá»‡n log workflow',
          type: 'checkbox',
          checked: showPipelineLog,
          click: (item) => {
            showPipelineLog = Boolean(item.checked);
            broadcastPipelineLogVisibility();
          },
        },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Actual Size' },
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Toggle Full Screen' },
      ],
    },
    { role: 'windowMenu', label: 'Window' },
    { role: 'help', label: 'Help' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function getPipelineLogVisibility() {
  return showPipelineLog;
}

async function openWebLogin(_event, provider) {
  const normalizedProvider = normalizeWebProvider(provider);
  const targetUrl = PROVIDER_META[normalizedProvider]?.url || PROVIDER_META.chatgpt.url;
  const page = await getCdpPage(normalizedProvider, true);
  await recoverProviderFromCacheOrChallenge(page, normalizedProvider, 'open-login').catch(() => null);
  await page.Page.bringToFront().catch(() => null);
  await page.close().catch(() => null);
  return { ok: true, url: targetUrl, profilePath: chromeUserDataDir, port: chromeDebugPort };
}

function normalizeWebProvider(provider) {
  return ['grok', 'pixverse', 'chatgpt'].includes(provider) ? provider : 'chatgpt';
}

async function closeChromeDebug() {
  for (const win of webWindows.values()) {
    try { if (!win.isDestroyed()) win.close(); } catch (_error) { }
  }
  webWindows.clear();
  try {
    const host = getChromeCdpHost();
    const tabs = await readJson(`${host}/json/list`);
    await Promise.all((tabs || []).map((tab) => tab.id ? readJson(`${host}/json/close/${tab.id}`).catch(() => null) : null));
  } catch (_error) { }
  if (chromeProcess?.pid) {
    try { process.kill(chromeProcess.pid); } catch (_error) { }
  }
  chromeProcess = null;
}

function getChromeCdpHost(port = chromeDebugPort) {
  return `http://127.0.0.1:${port}`;
}

async function ensureChromeDebug(openUrl) {
  if (await isChromeDebugReady()) {
    return true;
  }

  {
    const chromePath = findChromeExecutable();
    const attempts = Array.from({ length: 4 }, (_item, index) => {
      const port = DEFAULT_CHROME_DEBUG_PORT + index;
      return {
        port,
        userDataDir: index === 0 ? CHROME_USER_DATA_DIR : path.join(app.getPath('userData'), `chrome-cdp-profile-${port}`),
      };
    });

    for (const attempt of attempts) {
      chromeDebugPort = attempt.port;
      chromeUserDataDir = attempt.userDataDir;
      if (await isChromeDebugReady(attempt.port)) return true;
      if (await startChromeDebug(chromePath, attempt, openUrl)) return true;
    }

    throw new Error(`Khong mo duoc Chrome debug o cac port ${attempts.map((item) => item.port).join(', ')}. Hay dong Chrome debug cu hoac restart may.`);
  }

}

async function startChromeDebug(chromePath, { port, userDataDir }, openUrl) {
  await fs.mkdir(userDataDir, { recursive: true });
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-popup-blocking',
    openUrl || 'about:blank',
  ];
  chromeProcess = spawn(chromePath, args, { detached: true, stdio: 'ignore', windowsHide: false });
  chromeProcess.unref();

  const startedAt = Date.now();
  while (Date.now() - startedAt < 8000) {
    if (await isChromeDebugReady(port)) return true;
    await sleep(500);
  }

  if (chromeProcess?.pid) {
    try { process.kill(chromeProcess.pid); } catch (_error) { }
  }
  chromeProcess = null;
  return false;
}

async function isChromeDebugReady(port = chromeDebugPort) {
  try {
    const response = await fetch(`${getChromeCdpHost(port)}/json/version`);
    return response.ok;
  } catch (_error) {
    return false;
  }
}

async function openCdpTab(url) {
  const response = await fetch(`${getChromeCdpHost()}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!response.ok) {
    throw new Error(`KhÃ´ng má»Ÿ Ä‘Æ°á»£c tab Chrome CDP: ${response.status}`);
  }
  return response.json();
}

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      require('fs').accessSync(candidate);
      return candidate;
    } catch (_error) {
      // try next candidate
    }
  }

  try {
    return execFileSync('where', ['chrome'], { encoding: 'utf8' }).split(/\r?\n/).find(Boolean);
  } catch (_error) {
    throw new Error('KhÃ´ng tÃ¬m tháº¥y Chrome/Edge. HÃ£y cÃ i Chrome hoáº·c set biáº¿n mÃ´i trÆ°á»ng CHROME_PATH.');
  }
}
async function chooseFolder() {
  const result = await dialog.showOpenDialog({
    title: 'Chá»n folder chá»©a video Ä‘Ã£ táº¡o',
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

async function scanFolder(_event, folderPath) {
  if (!folderPath) {
    return [];
  }

  const videos = [];
  const collectFromDir = async (dir, sceneHint = null) => {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const match = entry.name.match(/^scene[_-]?(\d+)/i);
        await collectFromDir(fullPath, match ? Number(match[1]) : sceneHint);
        continue;
      }
      if (!entry.isFile() || !VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      if (/^(master|final)_?video|^master_video$/i.test(path.basename(entry.name, path.extname(entry.name)))) continue;
      const stat = await fs.stat(fullPath);
      const sceneNumber = getSceneNumber(entry.name) ?? sceneHint;
      const keyframePath = sceneNumber
        ? path.join(path.dirname(fullPath), `scene_${String(sceneNumber).padStart(3, '0')}_keyframe.png`)
        : '';
      videos.push({
        name: entry.name,
        path: fullPath,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        sceneNumber,
        keyframePath: keyframePath && await pathExists(keyframePath) ? keyframePath : '',
      });
    }
  };

  await collectFromDir(folderPath);
  return videos.sort((a, b) => {
    const sceneA = a.sceneNumber ?? Number.MAX_SAFE_INTEGER;
    const sceneB = b.sceneNumber ?? Number.MAX_SAFE_INTEGER;
    if (sceneA !== sceneB) return sceneA - sceneB;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

function getSceneNumber(fileName) {
  const match = path.basename(fileName, path.extname(fileName)).match(/^\D*0*(\d+)/);
  return match ? Number(match[1]) : null;
}

async function extractLastFrame(_event, videoPath) {
  return extractLastFrameFromVideo(videoPath);
}

async function extractLastFrameFromVideo(videoPath) {
  if (!videoPath) {
    throw new Error('Thiáº¿u Ä‘Æ°á»ng dáº«n video.');
  }

  const folder = path.dirname(videoPath);
  const baseName = path.basename(videoPath, path.extname(videoPath));
  const framesFolder = path.join(folder, '_last_frames');
  const outputPath = path.join(framesFolder, `${baseName}_last_frame.png`);

  await fs.mkdir(framesFolder, { recursive: true });
  await runFfmpeg([
    '-y',
    '-i', videoPath,
    '-vf', 'reverse',
    '-frames:v', '1',
    '-q:v', '2',
    outputPath,
  ]);

  return outputPath;
}

async function copyImageToClipboard(_event, imagePath) {
  if (!imagePath) {
    throw new Error('Thiáº¿u Ä‘Æ°á»ng dáº«n áº£nh.');
  }

  const image = nativeImage.createFromPath(imagePath);
  if (image.isEmpty()) {
    throw new Error('KhÃ´ng Ä‘á»c Ä‘Æ°á»£c áº£nh frame cuá»‘i.');
  }

  clipboard.writeImage(image);
  return true;
}

async function getPreviousFrame(_event, folderPath, currentSceneIndex) {
  const previousSceneIndex = Number(currentSceneIndex) - 1;
  if (!folderPath || previousSceneIndex < 1) {
    return null;
  }

  const videos = await scanFolder(null, folderPath);
  const previousVideo = videos.find((video) => video.sceneNumber === previousSceneIndex);
  if (!previousVideo) {
    return null;
  }

  const framePath = await extractLastFrameFromVideo(previousVideo.path);
  return {
    framePath,
    previousSceneIndex,
    videoName: previousVideo.name,
  };
}

async function mergeVideos(_event, folderPath) {
  if (!folderPath) {
    throw new Error('ChÆ°a chá»n folder video.');
  }

  const videos = (await scanFolder(null, folderPath))
    .filter((video) => video.sceneNumber !== null)
    .sort((a, b) => a.sceneNumber - b.sceneNumber);

  if (videos.length === 0) {
    throw new Error(`Folder chÆ°a cÃ³ video scene Ä‘á»ƒ merge hoáº·c tool chÆ°a scan tháº¥y video trong: ${folderPath}`);
  }

  const outputPath = path.join(folderPath, 'master_video.mp4');
  await mergeVideoFiles(videos, outputPath);

  return {
    outputPath,
    count: videos.length,
    videos,
  };
}

async function exportFinalVideo(_event, folderPath) {
  if (!folderPath) {
    throw new Error('ChÆ°a chá»n folder video.');
  }

  const videos = (await scanFolder(null, folderPath))
    .filter((video) => video.sceneNumber !== null)
    .sort((a, b) => a.sceneNumber - b.sceneNumber);

  if (videos.length === 0) {
    throw new Error('Folder chÆ°a cÃ³ video Ä‘á»ƒ xuáº¥t.');
  }

  const result = await dialog.showSaveDialog({
    title: 'Xuáº¥t video tá»•ng',
    defaultPath: path.join(folderPath, 'final_video.mp4'),
    filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  await mergeVideoFiles(videos, result.filePath);
  return {
    outputPath: result.filePath,
    count: videos.length,
  };
}

async function mergeVideoFiles(videos, outputPath) {
  const listPath = path.join(path.dirname(outputPath), '_concat_list.txt');
  const listContent = videos
    .map((video) => `file '${video.path.replaceAll("'", "'\\''")}'`)
    .join('\n');

  await fs.writeFile(listPath, listContent, 'utf8');
  await runFfmpeg([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    outputPath,
  ]);
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const bundledPath = app.isPackaged ? path.join(process.resourcesPath, 'ffmpeg.exe') : '';
    const binaryPath = bundledPath || ffmpegPath || 'ffmpeg';
    const child = spawn(binaryPath, args, { windowsHide: true });
    let stderr = '';

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      reject(new Error(`KhÃ´ng cháº¡y Ä‘Æ°á»£c FFmpeg (${binaryPath}). ${error.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`FFmpeg lá»—i code ${code}: ${stderr.slice(-1200)}`));
    });
  });
}

async function splitPromptWithAI(_event, options) {
  const {
    provider,
    apiKey,
    model,
    basePrompt,
    totalSegments,
    segmentSeconds,
    style,
    notes,
  } = options || {};

  if (!apiKey || !apiKey.trim()) {
    throw new Error('ChÆ°a nháº­p API key.');
  }
  if (!basePrompt || !basePrompt.trim()) {
    throw new Error('ChÆ°a nháº­p prompt tá»•ng.');
  }

  const systemPrompt = `Báº¡n lÃ  biÃªn ká»‹ch/Ä‘áº¡o diá»…n video AI. Nhiá»‡m vá»¥: tÃ¡ch prompt tá»•ng thÃ nh cÃ¡c scene ná»‘i tiáº¿p nhau, má»—i scene cÃ³ ná»™i dung riÃªng cá»¥ thá»ƒ, khÃ´ng láº·p Ã½. Tráº£ vá» JSON há»£p lá»‡ duy nháº¥t, khÃ´ng markdown, khÃ´ng giáº£i thÃ­ch.`;
  const userPrompt = `Prompt tá»•ng: ${basePrompt}\nSá»‘ scene cáº§n táº¡o: ${totalSegments}\nThá»i lÆ°á»£ng má»—i scene tá»‘i Ä‘a: ${segmentSeconds}s\nPhong cÃ¡ch: ${style || 'cinematic realistic'}\nGhi chÃº: ${notes || 'khÃ´ng cÃ³'}\n\nYÃªu cáº§u JSON:\n{\n  "beats": [\n    {\n      "title": "má»¥c tiÃªu cáº£nh cá»¥ thá»ƒ",\n      "setting": "bá»‘i cáº£nh riÃªng, thá»i Ä‘iá»ƒm/Ä‘á»‹a Ä‘iá»ƒm cá»¥ thá»ƒ",\n      "subject": "chá»§ thá»ƒ á»Ÿ tráº¡ng thÃ¡i riÃªng cá»§a scene",\n      "action": "hÃ nh Ä‘á»™ng báº¯t buá»™c, cá»¥ thá»ƒ, khÃ¡c scene trÆ°á»›c",\n      "evolution": "Ã½ nghÄ©a tiáº¿n triá»ƒn/nhÃ¢n quáº£ cá»§a scene nÃ y",\n      "camera": "gÃ³c mÃ¡y/chuyá»ƒn Ä‘á»™ng camera riÃªng",\n      "endFrame": "mÃ´ táº£ frame cuá»‘i sáº¡ch Ä‘á»ƒ ná»‘i scene sau, kÃ¨m tráº¡ng thÃ¡i Ã¡nh sÃ¡ng/exposure á»•n Ä‘á»‹nh"\n    }\n  ]\n}\n\nQuy táº¯c báº¯t buá»™c:\n- beats.length Ä‘Ãºng báº±ng ${totalSegments}.\n- Tá»« scene 2 trá»Ÿ Ä‘i pháº£i phÃ¡t triá»ƒn tá»« scene trÆ°á»›c nhÆ°ng khÃ´ng láº·p cÃ¹ng mÃ´ táº£.\n- Má»—i scene pháº£i cÃ³ bá»‘i cáº£nh, hÃ nh Ä‘á»™ng, chá»§ thá»ƒ vÃ  frame cuá»‘i khÃ¡c nhau.\n- Pháº£i giá»¯ continuity Ã¡nh sÃ¡ng giá»¯a frame cuá»‘i scene trÆ°á»›c vÃ  frame Ä‘áº§u scene sau: khÃ´ng tÄƒng sÃ¡ng Ä‘á»™t ngá»™t, khÃ´ng auto-exposure, khÃ´ng Ä‘á»•i white balance/gamma/contrast á»Ÿ Ä‘iá»ƒm ná»‘i.\n- Náº¿u cáº§n Ä‘á»•i Ã¡nh sÃ¡ng vÃ¬ ná»™i dung scene, mÃ´ táº£ Ä‘á»•i ráº¥t cháº­m sau 1 giÃ¢y hold Ä‘áº§u, khÃ´ng Ä‘á»•i ngay táº¡i frame ná»‘i.\n- Æ¯u tiÃªn tiáº¿ng Viá»‡t, giÃ u hÃ¬nh áº£nh, dÃ¹ng Ä‘Æ°á»£c ngay cho AI video.`;

  const text = await callAIProvider({ provider, apiKey, model, systemPrompt, userPrompt });
  const parsed = parseJsonFromModel(text);
  if (!Array.isArray(parsed.beats) || parsed.beats.length === 0) {
    throw new Error('Model khÃ´ng tráº£ vá» beats há»£p lá»‡.');
  }

  return parsed.beats.slice(0, Number(totalSegments)).map((beat, index) => ({
    title: String(beat.title || `Scene ${index + 1}`),
    setting: String(beat.setting || ''),
    subject: String(beat.subject || ''),
    action: String(beat.action || ''),
    evolution: String(beat.evolution || ''),
    camera: String(beat.camera || 'cinematic smooth camera'),
    endFrame: String(beat.endFrame || 'frame cuá»‘i sáº¡ch, rÃµ chá»§ thá»ƒ Ä‘á»ƒ ná»‘i scene sau'),
  }));
}

async function callAIProvider({ provider, apiKey, model, systemPrompt, userPrompt }) {
  if (provider === 'gemini') {
    const geminiModel = model || 'gemini-1.5-flash';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
      }),
    });
    const data = await readJsonResponse(response);
    return data.candidates?.[0]?.content?.parts?.map((part) => part.text).join('\n') || '';
  }

  if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-haiku-latest',
        max_tokens: 4096,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    const data = await readJsonResponse(response);
    return data.content?.map((part) => part.text || '').join('\n') || '';
  }

  const baseUrl = provider === 'openrouter'
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : provider === 'ninerouter'
      ? 'http://localhost:20128/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(provider === 'openrouter' ? { 'HTTP-Referer': 'http://localhost', 'X-Title': 'AI Video Prompt Planner' } : {}),
    },
    body: JSON.stringify({
      model: model || (provider === 'openrouter' ? 'openai/gpt-4o-mini' : provider === 'ninerouter' ? 'cx/gpt-5.5' : 'gpt-4o-mini'),
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  const data = await readJsonResponse(response);
  return data.choices?.[0]?.message?.content || '';
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`API lá»—i ${response.status}: ${text.slice(0, 600)}`);
  }
  return JSON.parse(text);
}

function parseJsonFromModel(text) {
  const trimmed = String(text || '').trim();
  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Model khÃ´ng tráº£ vá» JSON.');
    }
    return JSON.parse(match[0]);
  }
}

async function generateScenePrompts(_event, options) {
  const {
    provider,
    apiKey,
    model,
    projectName,
    story,
    scene,
    durationSec,
    imageRules,
    motionRules,
    storyRules,
  } = options || {};

  if (!scene?.original) {
    throw new Error('Thiáº¿u scene hiá»‡n táº¡i.');
  }

  const localFallback = !apiKey || !apiKey.trim();
  if (localFallback) {
    return buildLocalScenePrompts({ projectName, story, scene, durationSec, imageRules, motionRules, storyRules });
  }

  const systemPrompt = 'Báº¡n lÃ  dashboard backend cho workflow sáº£n xuáº¥t video AI. Tráº£ vá» JSON há»£p lá»‡ duy nháº¥t, khÃ´ng markdown, gá»“m imagePrompt vÃ  motionPrompt. TuÃ¢n thá»§ nghiÃªm file quy trÃ¬nh, prompt máº«u táº¡o áº£nh keyframe vÃ  prompt máº«u motion 7 dÃ²ng.';
  const userPrompt = [
    `Project: ${projectName || 'Untitled'}`,
    `Global story context + character bible + continuity: ${story || ''}`,
    scene.previous ? `Previous scene: ${scene.previous}` : 'Previous scene: none',
    `Current scene ${scene.id}: ${scene.original}`,
    scene.next ? `Next scene: ${scene.next}` : 'Next scene: none',
    `Duration: ${durationSec || 10}s`,
    `Story rules:\n${storyRules || ''}`,
    `Image keyframe rules:\n${imageRules || ''}`,
    `Motion prompt rules:\n${motionRules || ''}`,
    'YÃªu cáº§u output JSON:',
    '{ "imagePrompt": "prompt áº£nh keyframe Ä‘áº§u scene", "motionPrompt": "prompt video 7 dÃ²ng" }',
    'imagePrompt pháº£i dá»±ng hiá»‡n trÆ°á»ng Ä‘áº§u scene, 16:9, 8K live action, continuity 1-1, spatial lock.',
    'SAFETY Báº®T BUá»˜C: náº¿u story cÃ³ nhÃ¢n váº­t tráº» em/cÃ´ bÃ©/cáº­u bÃ©/teen thÃ¬ hÃ£y chuyá»ƒn thÃ nh ngÆ°á»i trÆ°á»Ÿng thÃ nh 25+ tuá»•i; tuyá»‡t Ä‘á»‘i khÃ´ng mÃ´ táº£ tráº» em, há»c sinh, vá»‹ thÃ nh niÃªn, teen, child, minor.',
    'motionPrompt pháº£i Ä‘Ãºng format 7 dÃ²ng, chá»‰ mÃ´ táº£ tá»« keyframe, cÃ³ Ã¢m thanh diegetic, khÃ´ng nháº¡c, hÃ nh Ä‘á»™ng hoÃ n táº¥t 100%.',
  ].join('\n\n');

  const text = await callAIProvider({ provider, apiKey, model, systemPrompt, userPrompt });
  const parsed = parseJsonFromModel(text);
  return {
    imagePrompt: String(parsed.imagePrompt || '').trim(),
    motionPrompt: String(parsed.motionPrompt || '').trim(),
  };
}

function buildLocalScenePrompts({ projectName, story, scene, durationSec, imageRules, motionRules, storyRules }) {
  const imagePrompt = [
    `IMAGE PROMPT â€” SCENE ${scene.id} â€” KEYFRAME Äáº¦U Cáº¢NH`,
    `Project: ${projectName || 'Untitled'}`,
    `Global story context: ${story || ''}`,
    scene.previous ? `Scene trÆ°á»›c Ä‘á»ƒ giá»¯ continuity: ${scene.previous}` : 'Scene trÆ°á»›c: khÃ´ng cÃ³, Ä‘Ã¢y lÃ  cáº£nh má»Ÿ Ä‘áº§u.',
    `Scene hiá»‡n táº¡i: ${scene.original}`,
    scene.next ? `Scene sau Ä‘á»ƒ Ä‘á»‹nh hÆ°á»›ng ná»‘i máº¡ch: ${scene.next}` : 'Scene sau: khÃ´ng cÃ³ hoáº·c chÆ°a cáº§n.',
    storyRules || '',
    imageRules || '',
    'SAFETY Báº®T BUá»˜C: táº¥t cáº£ nhÃ¢n váº­t pháº£i lÃ  ngÆ°á»i trÆ°á»Ÿng thÃ nh 25+ tuá»•i. Náº¿u scene gá»‘c nÃ³i cÃ´ bÃ©/cáº­u bÃ©/tráº» em/teen/há»c sinh/minor thÃ¬ chuyá»ƒn thÃ nh ngÆ°á»i trÆ°á»Ÿng thÃ nh 25+ tuá»•i, khÃ´ng dÃ¹ng tá»« tráº» em/teen/minor trong prompt áº£nh.',
    'OUTPUT: 1 áº£nh duy nháº¥t 16:9, 8K ultra-realistic live action. Dá»±ng hiá»‡n trÆ°á»ng á»Ÿ khoáº£nh kháº¯c chuáº©n bá»‹ diá»…n hÃ nh Ä‘á»™ng Ä‘áº§u tiÃªn, wide/master shot, rÃµ vá»‹ trÃ­ nhÃ¢n váº­t, Ä‘áº¡o cá»¥, hÆ°á»›ng chuyá»ƒn Ä‘á»™ng, Ã¡nh sÃ¡ng máº¡nh trong tráº»o, khÃ´ng text/logo/watermark.',
  ].filter(Boolean).join('\n\n');

  const motionPrompt = [
    `MOTION PROMPT â€” SCENE ${scene.id} â€” VIDEO ${durationSec || 10} GIÃ‚Y`,
    `Scene hiá»‡n táº¡i: ${scene.original}`,
    motionRules || '',
    'DÃ’NG 1: Tá»”NG QUÃT KHUNG HÃŒNH: liá»‡t kÃª chÃ­nh xÃ¡c nhÃ¢n váº­t/Ä‘áº¡o cá»¥/bá»‘i cáº£nh trong keyframe, chá»‰ mÃ´ táº£ táº¡o hÃ¬nh, khÃ´ng ghi tÃªn riÃªng.',
    'DÃ’NG 2: Ná»˜I DUNG VIDEO CHUYá»‚N Äá»˜NG: báº¯t Ä‘áº§u tá»« Ä‘Ãºng keyframe, mÃ´ táº£ 1 Ã½ chÃ­nh vÃ  tá»‘i Ä‘a 1-2 chuyá»ƒn Ä‘á»™ng chÃ­nh theo chuá»—i nhÃ¢n quáº£, hÃ nh Ä‘á»™ng hoÃ n táº¥t 100%, chuyá»ƒn Ä‘á»™ng máº¡nh rÃµ náº¿u lÃ  cáº£nh ká»‹ch tÃ­nh.',
    'DÃ’NG 3: CHUYá»‚N Äá»˜NG PHá»¤: mÃ´ táº£ mÃ´i trÆ°á»ng, Ä‘áº¡o cá»¥, pháº£n á»©ng phá»¥ Ä‘ang cÃ³ trong khung hÃ¬nh vÃ  khÃ´ng láº¡c bá»‘i cáº£nh.',
    'DÃ’NG 4: Ã‚M THANH: chá»‰ foley + Ã¢m thanh mÃ´i trÆ°á»ng + tiáº¿ng nhÃ¢n váº­t/Ä‘á»™ng váº­t náº¿u cÃ³, khÃ´ng nháº¡c ná»n; Má»ŒI Ã‚M THANH Ná»€N á»ž Bá»I Cáº¢NH VIDEO VÃ€ Má»ŒI Váº¬T THá»‚ Ä‘ang chuyá»ƒn Ä‘á»™ng TRONG VIDEO Báº¯t buá»™c Táº O Ã‚M THANH VIDEO PHáº¢I TO VÃ€ RÃ• RÃ€NG NHÆ¯ ÄANG Báº¬T FULL 100% VOLUME LOA.',
    'DÃ’NG 5: VIDEO Táº O RA ÄÃƒ Äáº T ÄÆ¯á»¢C Táº¤T Cáº¢ CÃC YÃŠU Cáº¦U, diá»…n xuáº¥t Ä‘Ãºng prompt, má»i chuyá»ƒn Ä‘á»™ng mÆ°á»£t nhÆ° phim live action, khÃ´ng chi tiáº¿t giáº£ táº¡o, tuÃ¢n theo váº­t lÃ½ Ä‘á»i thá»±c, khÃ´ng sÃ¡ng táº¡o thÃªm ngoÃ i prompt.',
    'DÃ’NG 6: Technical Specifications: 8K ultra-realistic, extreme sharp details, real-world gravity, authentic cloth and fur simulation, consistent powerful natural daylight, high dynamic range (HDR), hyper-smooth 240 FPS motion, organic motion blur only where physically correct. Live action cinematic quality, razor-sharp, true-to-life textures.',
    'DÃ’NG 7: Negative Prompt: low quality, blurry, out of focus, temporal artifacts, noisy, grainy, inconsistent face, inconsistent clothing, foot skating, sliding, teleporting props, disappearing objects, readable text, subtitles, watermark, logo, cartoon, anime, CGI skin, random stopping, sudden jump cuts, night time, sunset, low light, NO background music, NO cinematic music, NO soundtrack, NO added music, NO score, NO dramatic music, NO film music, NO MUSIC, dialogue, NO SLOW MOTION.',
  ].filter(Boolean).join('\n\n');

  return { imagePrompt, motionPrompt };
}

async function chooseOutputFolder() {
  const result = await dialog.showOpenDialog({
    title: 'Chá»n folder lÆ°u káº¿t quáº£ prompt web',
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
}

async function chooseProjectRootFolder() {
  const result = await dialog.showOpenDialog({
    title: 'Chá»n vá»‹ trÃ­ lÆ°u project Vidora',
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
}

async function checkWebLogin(_event, provider, options = {}) {
  const normalizedProvider = normalizeWebProvider(provider);
  const autoOpenSaved = Boolean(options?.autoOpenSaved && normalizedProvider === 'grok');
  let page;
  try {
    page = await getCdpPage(normalizedProvider, autoOpenSaved, { bringToFront: Boolean(options?.bringToFront), recover: autoOpenSaved });
  } catch (error) {
    const state = {
      loggedIn: false,
      reason: 'no-existing-provider-tab',
      detail: error.message,
      autoOpenSaved,
      cdp: true,
      port: chromeDebugPort,
      profilePath: chromeUserDataDir,
    };
    await appendAppLog(null, {
      source: 'main',
      kind: autoOpenSaved ? 'error' : 'running',
      text: autoOpenSaved
        ? `Login check ${normalizedProvider}: khÃ´ng má»Ÿ Ä‘Æ°á»£c saved profile tab`
        : `Login check ${normalizedProvider}: no existing tab; skipped opening a new tab`,
      details: state,
    });
    return state;
  }
  let state = { loggedIn: false };
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    state = await evaluateOnCdpPage(page, `(${detectLoginScript.toString()})(${JSON.stringify(normalizedProvider)})`).catch((error) => ({ loggedIn: false, reason: error.message }));
    if (state.loggedIn) break;
    await sleep(1500);
  }

  if (!state.loggedIn && shouldRecoverFromCacheOrChallenge(state, normalizedProvider)) {
    const recovery = await recoverProviderFromCacheOrChallenge(page, normalizedProvider, 'check-login');
    state = await evaluateOnCdpPage(page, `(${detectLoginScript.toString()})(${JSON.stringify(normalizedProvider)})`).catch((error) => ({ loggedIn: false, reason: error.message }));
    state.cacheRecovery = recovery;
  }
  if (!state.loggedIn && ['chatgpt', 'grok'].includes(normalizedProvider)) {
    const autoLogin = await tryAutoLoginWithStoredAccount(page, normalizedProvider, { reason: 'check-login' }).catch((error) => ({ ok: false, error: error.message }));
    state.autoLogin = autoLogin;
    if (autoLogin?.ok) {
      state = await evaluateOnCdpPage(page, `(${detectLoginScript.toString()})(${JSON.stringify(normalizedProvider)})`).catch((error) => ({ loggedIn: false, reason: error.message }));
      state.autoLogin = autoLogin;
    } else if (autoLogin?.noStoredAccount) {
      state.noStoredAccount = true;
    }
  }
  await appendAppLog(null, { source: 'main', kind: state.loggedIn ? 'ok' : 'error', text: `Login check ${normalizedProvider}: ${state.loggedIn ? 'logged in' : 'not logged in'} (${state.reason || state.title || state.url || ''})`, details: state });
  const capability = ['grok', 'pixverse'].includes(normalizedProvider)
    ? await evaluateOnCdpPage(page, `(${detectVideoCapabilityScript.toString()})(${JSON.stringify(normalizedProvider)})`).catch((error) => ({ ok: false, error: error.message }))
    : null;
  if (!state.loggedIn && autoOpenSaved && state.reason !== 'no-existing-provider-tab') {
    await page.Page.bringToFront().catch(() => null);
  }
  await page.close().catch(() => null);
  return { ...state, capability, autoOpenSaved, cdp: true, port: chromeDebugPort, profilePath: chromeUserDataDir };
}

async function clearProviderSession(page, provider) {
  const normalized = normalizeCredentialProvider(provider);
  const origin = new URL(PROVIDER_META[normalized].url).origin;
  await page.Storage?.clearDataForOrigin?.({ origin, storageTypes: 'cookies,local_storage,session_storage,indexeddb,cache_storage' }).catch(() => null);
  await page.Network?.clearBrowserCache?.().catch(() => null);
  return { ok: true, origin };
}

async function tryAutoLoginWithStoredAccount(page, provider, { rotate = false, reason = '', sceneId = '' } = {}) {
  const normalized = normalizeCredentialProvider(provider);
  const { account } = await pickWebAccount(normalized, { rotate });
  if (!account) return { ok: false, noStoredAccount: true, provider: normalized };
  if (rotate) await clearProviderSession(page, normalized).catch(() => null);
  const meta = PROVIDER_META[normalized];
  await page.Page.bringToFront().catch(() => null);
  await page.Page.navigate({ url: meta.url }).catch(() => null);
  await waitForCdpLoad(page).catch(() => null);
  await sleep(1200);
  let lastFill = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const state = await evaluateOnCdpPage(page, `(${detectLoginScript.toString()})(${JSON.stringify(normalized)})`).catch((error) => ({ loggedIn: false, reason: error.message }));
    if (state?.loggedIn) {
      await markWebAccountState(normalized, account.id, 'active');
      return { ok: true, provider: normalized, accountId: account.id, maskedEmail: maskEmail(account.email), attempt, reason };
    }
    lastFill = await evaluateOnCdpPage(page, `(${fillProviderLoginScript.toString()})(${JSON.stringify(normalized)}, ${JSON.stringify(account.email)}, ${JSON.stringify(account.password)})`).catch((error) => ({ ok: false, error: error.message }));
    await appendAppLog(null, {
      source: 'main',
      kind: lastFill?.ok ? 'running' : 'error',
      text: `Auto-login ${normalized} ${maskEmail(account.email)} attempt ${attempt}/5: ${lastFill?.mode || lastFill?.error || 'waiting'}`,
      details: { provider: normalized, accountId: account.id, maskedEmail: maskEmail(account.email), mode: lastFill?.mode || '', clicked: lastFill?.clicked || '', needsUserAction: lastFill?.needsUserAction || false, sceneId },
    });
    await sleep(lastFill?.submitted || lastFill?.clicked ? 3200 : 1800);
  }
  const finalState = await evaluateOnCdpPage(page, `(${detectLoginScript.toString()})(${JSON.stringify(normalized)})`).catch((error) => ({ loggedIn: false, reason: error.message }));
  if (finalState?.loggedIn) {
    await markWebAccountState(normalized, account.id, 'active');
    return { ok: true, provider: normalized, accountId: account.id, maskedEmail: maskEmail(account.email), reason };
  }
  await markWebAccountState(normalized, account.id, 'login_required');
  return { ok: false, provider: normalized, accountId: account.id, maskedEmail: maskEmail(account.email), requiresUserAction: true, lastFill, finalReason: finalState.reason || finalState.url || '' };
}

async function rollProviderAccount(page, provider, sceneId = '', reason = 'limit') {
  const normalized = normalizeCredentialProvider(provider);
  await markWebAccountState(normalized, '', reason === 'login' ? 'login_required' : 'limited').catch(() => null);
  const result = await tryAutoLoginWithStoredAccount(page, normalized, { rotate: true, reason, sceneId }).catch((error) => ({ ok: false, error: error.message }));
  await notifyRenderer('provider-account-roll', result?.ok
    ? `Scene ${sceneId}: ${PROVIDER_META[normalized].title} bá»‹ ${reason}, Ä‘Ã£ roll sang account ${result.maskedEmail}.`
    : `Scene ${sceneId}: ${PROVIDER_META[normalized].title} bá»‹ ${reason} nhÆ°ng chÆ°a roll Ä‘Æ°á»£c account.`, result);
  if (result?.ok) return result;
  if (result?.noStoredAccount) throw new Error(`CREDENTIAL_REQUIRED:${normalized}: ChÆ°a cÃ³ account ${PROVIDER_META[normalized].title} Ä‘á»ƒ tá»± login/roll.`);
  return result;
}

async function sendPromptViaWeb(_event, options) {
  const {
    provider,
    prompt,
    outputFolder,
    projectName = 'project',
    sceneId = 'scene',
    promptKind = 'prompt',
  } = options || {};

  if (!prompt?.trim()) {
    throw new Error('Prompt rá»—ng, khÃ´ng thá»ƒ gá»­i.');
  }
  if (!outputFolder) {
    throw new Error('ChÆ°a chá»n folder lÆ°u káº¿t quáº£.');
  }

  const normalizedProvider = normalizeWebProvider(provider);
  const page = await getCdpPage(normalizedProvider, true);
  const loginState = await evaluateOnCdpPage(page, `(${detectLoginScript.toString()})(${JSON.stringify(normalizedProvider)})`);
  if (!loginState.loggedIn) {
    throw new Error(loginRequiredMessage(normalizedProvider, loginState.reason || loginState.url || ''));
  }

  const beforeCount = await evaluateOnCdpPage(page, `(${countAssistantMessagesScript.toString()})()`);
  const sent = await sendPromptViaCdpInput(page, prompt);
  if (!sent.ok) {
    throw new Error(sent.error || 'KhÃ´ng tÃ¬m tháº¥y Ã´ nháº­p hoáº·c nÃºt Send trong Chrome.');
  }

  const responseText = await waitForCdpAssistantResponse(page, beforeCount);
  await fs.mkdir(outputFolder, { recursive: true });
  const baseName = sanitizeFileName(`${projectName}_scene-${sceneId}_${promptKind}_${normalizedProvider}`);
  const promptPath = path.join(outputFolder, `${baseName}_prompt.txt`);
  const responsePath = path.join(outputFolder, `${baseName}_response.txt`);
  await fs.writeFile(promptPath, prompt, 'utf8');
  await fs.writeFile(responsePath, responseText, 'utf8');
  return { responseText, promptPath, responsePath, cdp: true };
}

async function runScenePipeline(_event, options) {
  const {
    projectName = 'project',
    outputFolder,
    sceneId,
    imagePrompt,
    imageProvider = { method: 'web' },
    chatContextTitle = '',
    pendingChatRenameTitle = '',
    scriptText = '',
    sceneText = '',
  } = options || {};
  let motionPrompt = options.motionPrompt || '';

  if (!outputFolder) throw new Error('ChÆ°a chá»n folder output.');
  if (!sceneText?.trim() && !imagePrompt?.trim()) throw new Error('Thiáº¿u scene Ä‘á»ƒ táº¡o áº£nh.');

  const projectDir = outputFolder;
  const sceneDir = path.join(projectDir, `scene_${String(sceneId).padStart(3, '0')}`);
  await fs.mkdir(sceneDir, { recursive: true });
  const hardTasks = await loadHardPromptTasks();
  const task1ImagePrompt = buildTaskPrompt({ task: hardTasks.task1, script: scriptText, sceneText, sceneId });
  const task2VideoPrompt = buildTaskPrompt({ task: hardTasks.task2, script: scriptText, sceneText, sceneId });
  const finalImagePrompt = task1ImagePrompt || imagePrompt;
  await fs.writeFile(path.join(sceneDir, 'image_prompt.txt'), finalImagePrompt, 'utf8');
  const existingMotionPromptPath = path.join(sceneDir, 'motion_prompt.txt');
  if (!motionPrompt?.trim() && !options.forceRegenerateMotionPrompt && await pathExists(existingMotionPromptPath)) {
    motionPrompt = await fs.readFile(existingMotionPromptPath, 'utf8').then((value) => value.trim()).catch(() => '');
    if (motionPrompt) {
      await appendAppLog(null, { source: 'main', kind: 'ok', text: `Scene ${sceneId}: Ä‘Ã£ cÃ³ motion_prompt.txt, bá» qua ChatGPT NV2 vÃ  gá»­i tháº³ng Grok.` });
    }
  }
  if (motionPrompt) await fs.writeFile(existingMotionPromptPath, motionPrompt, 'utf8');

  const videoProvider = normalizeVideoProvider(options.videoProvider);
  const videoAccount = options.videoAccount || '';
  const requestedRouterEnabled = Boolean(options.accountRouterEnabled);
  const routerActive = requestedRouterEnabled && videoProvider === 'grok';
  const routingPolicy = routerActive ? 'round_robin' : (options.routingPolicy || 'manual');
  const videoConfig = options.videoConfig || {};
  grokRouterState.routingPolicy = 'round_robin';
  if (requestedRouterEnabled !== grokRouterState.accountRouterEnabled) {
    await setAccountRouterEnabled(null, requestedRouterEnabled);
  }
  if (routerActive && videoAccount) await selectGrokAccount(null, videoAccount).catch(() => null);
  await appendAppLog(null, {
    source: 'main',
    kind: 'info',
    text: `Scene ${sceneId}: video router ${videoProvider}/${videoAccount || 'default'} (${routingPolicy})`,
    details: { videoProvider, videoAccount: maskRouterText(videoAccount), routingPolicy, accountRouterEnabled: routerActive, routerSandbox: 'dev_sandbox_grok_account_router' },
  });
  let imagePath = options.imagePath || '';
  if (imagePath && !(await pathExists(imagePath))) imagePath = '';
  const expectedImagePath = path.join(sceneDir, `scene_${String(sceneId).padStart(3, '0')}_keyframe.png`);
  if (!imagePath && !options.forceRegenerateImage && await pathExists(expectedImagePath)) {
    imagePath = expectedImagePath;
  }

  if (!imagePath) {
    console.log(`[PIPELINE][Scene ${sceneId}] START NV1 ChatGPT image`);
    await appendAppLog(null, { source: 'main', kind: 'running', text: `PIPELINE Scene ${sceneId}: gá»­i scene + NV1 cho ChatGPT Ä‘á»ƒ táº¡o áº£nh.` });
    const recentKeyframes = [];
    for (let previousId = Number(sceneId) - 1; previousId >= 1 && recentKeyframes.length < 3; previousId -= 1) {
      const previousPath = path.join(projectDir, `scene_${String(previousId).padStart(3, '0')}`, `scene_${String(previousId).padStart(3, '0')}_keyframe.png`);
      if (await pathExists(previousPath)) recentKeyframes.push(previousPath);
    }
    if (recentKeyframes.length) {
      await appendAppLog(null, { source: 'main', kind: 'running', text: `PIPELINE Scene ${sceneId}: gá»­i kÃ¨m ${recentKeyframes.length} áº£nh key gáº§n nháº¥t cho ChatGPT Ä‘á»“ng bá»™.`, details: { recentKeyframes: recentKeyframes.map((item) => path.basename(item)) } });
    }
    const chatGptResult = imageProvider?.method === 'api'
      ? await generateImageWithImageApi({ imagePrompt: finalImagePrompt, sceneDir, sceneId, config: imageProvider })
      : await generateImageAndMotionWithChatGPT({ imagePrompt: finalImagePrompt, sceneDir, sceneId, chatContextTitle, pendingChatRenameTitle: '', referenceImagePaths: recentKeyframes });
    imagePath = chatGptResult.imagePath;
    console.log(`[PIPELINE][Scene ${sceneId}] SAVED image: ${imagePath}`);
    await appendAppLog(null, { source: 'main', kind: 'ok', text: `PIPELINE Scene ${sceneId}: Ä‘Ã£ lÆ°u áº£nh keyframe: ${path.basename(imagePath || '')}` });
    if (chatGptResult.motionPrompt) {
      motionPrompt = chatGptResult.motionPrompt;
    }
    if (motionPrompt) {
      await fs.writeFile(path.join(sceneDir, 'motion_prompt.txt'), motionPrompt, 'utf8');
    }
  }

  if (!motionPrompt?.trim() && !options.forceRegenerateMotionPrompt && await pathExists(existingMotionPromptPath)) {
    motionPrompt = await fs.readFile(existingMotionPromptPath, 'utf8').then((value) => value.trim()).catch(() => '');
    if (motionPrompt) await appendAppLog(null, { source: 'main', kind: 'ok', text: `Scene ${sceneId}: dÃ¹ng motion_prompt.txt cÃ³ sáºµn, khÃ´ng gá»­i ChatGPT NV2.` });
  }

  if (!motionPrompt?.trim()) {
    console.log(`[PIPELINE][Scene ${sceneId}] START NV2 ChatGPT motion prompt`);
    await appendAppLog(null, { source: 'main', kind: 'running', text: `PIPELINE Scene ${sceneId}: gá»­i áº£nh keyframe + NV2 cho ChatGPT Ä‘á»ƒ láº¥y motion prompt.` });
    motionPrompt = await generateMotionPromptWithChatGPT({ imagePath, prompt: task2VideoPrompt, sceneDir, sceneId, chatContextTitle: '' });
    await fs.writeFile(path.join(sceneDir, 'motion_prompt.txt'), motionPrompt, 'utf8');
    console.log(`[PIPELINE][Scene ${sceneId}] SAVED motion prompt: ${path.join(sceneDir, 'motion_prompt.txt')}`);
    await appendAppLog(null, { source: 'main', kind: 'ok', text: `PIPELINE Scene ${sceneId}: Ä‘Ã£ lÆ°u motion_prompt.txt.` });
  }
  await fs.writeFile(path.join(sceneDir, 'motion_prompt.txt'), motionPrompt, 'utf8');

  const checkpointFields = {
    projectName,
    sceneId,
    sceneIndex: sceneId,
    imageRef: path.basename(imagePath),
    motionPromptRef: 'motion_prompt.txt',
    provider: videoProvider,
    accountId: grokRouterState.selectedAccountId,
    profileRef: 'grok-web-session',
    currentStatus: 'before_generation',
  };
  if (routerActive) await writeGrokRouterCheckpoint(sceneDir, checkpointFields);

  const existingVideoPath = path.join(sceneDir, `scene_${String(sceneId).padStart(3, '0')}_video.mp4`);
  if (!options.forceRegenerateVideo && await pathExists(existingVideoPath)) {
    await appendAppLog(null, { source: 'main', kind: 'ok', text: `Scene ${sceneId}: Ä‘Ã£ cÃ³ video sáºµn, bá» qua táº¡o láº¡i Grok.`, details: { existingVideoPath } });
    return {
      sceneDir,
      phase: 'video',
      imagePath,
      imageDataUrl: imagePath ? await imageFileToDataUrl(imagePath).catch(() => '') : '',
      videoPath: existingVideoPath,
      videoProvider,
      videoStatus: 'existing-video-skip-regenerate',
      motionPrompt,
    };
  }

  let videoResult = null;
  let videoError = '';
  try {
    videoResult = await generateVideoWithProvider({ provider: videoProvider, imagePath, motionPrompt, sceneDir, sceneId, videoConfig });
    if (routerActive) await writeGrokRouterCheckpoint(sceneDir, { ...checkpointFields, currentStatus: 'completed' });
  } catch (error) {
    videoError = maskRouterText(error.stack || error.message || String(error));
    await fs.writeFile(path.join(sceneDir, 'grok_video_error.txt'), videoError, 'utf8');
    if (routerActive) {
      const classification = classifyGrokRouterError(error);
      const safeMessage = classification === 'account_limit'
        ? `Scene ${sceneId}: Grok account reached a quota/plan limit. Generation is paused; select another authorized account or resolve quota before resume.`
        : classification === 'login_required'
          ? `Scene ${sceneId}: Grok login is required. Generation is paused until the selected account is reconnected.`
          : classification === 'canvas_limit'
            ? `Scene ${sceneId}: Grok canvas limit was detected. Same account is preserved; retry/resume can recreate canvas context.`
            : classification === 'network_error'
              ? `Scene ${sceneId}: Network/timeout issue detected. Generation is paused with checkpoint preserved.`
              : `Scene ${sceneId}: Unknown Grok router error. Generation is paused with checkpoint preserved.`;
      await pauseGrokRouterForError(sceneDir, classification, safeMessage, checkpointFields);
    }
    await appendAppLog(null, { source: 'main', kind: 'error', text: `Scene ${sceneId}: lá»—i táº¡o video ${videoProvider}: ${maskRouterText(error.message || error)}`, details: { imagePath: path.basename(imagePath), routerClassification: routerActive ? grokRouterState.lastErrorClassification : '', motionPromptRef: 'motion_prompt.txt' } });
  }

  return {
    sceneDir,
    phase: 'video',
    imagePath,
    imageDataUrl: imagePath ? await imageFileToDataUrl(imagePath).catch(() => '') : '',
    imagePromptUsed: finalImagePrompt,
    videoPath: videoResult?.videoPath || '',
    videoProvider,
    videoStatus: videoResult?.status || (videoError ? `error: ${maskRouterText(videoError.split('\n')[0])}` : 'pending-selector-or-manual-download'),
    videoError: maskRouterText(videoError),
    router: routerActive ? getGrokRouterStatus() : null,
  };
}

async function generateImageWithImageApi({ imagePrompt, sceneDir, sceneId, config = {} }) {
  const endpoint = String(config.endpoint || 'http://localhost:20128/v1/images/generations').trim();
  const apiKey = String(config.apiKey || '').trim();
  const model = String(config.model || 'cx/gpt-5.5-image').trim();
  const size = String(config.size || '1024x1024').trim();
  if (!apiKey) throw new Error('ChÆ°a nháº­p API key cho 9Router Image API trong Settings.');
  const imagePath = path.join(sceneDir, `scene_${String(sceneId).padStart(3, '0')}_keyframe.png`);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.replace(/^Bearer\s+/i, '')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, prompt: imagePrompt, size, response_format: 'b64_json' }),
  });
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`9Router Image API lá»—i HTTP ${response.status}: ${maskRouterText(detail).slice(0, 400)}`);
  }
  if (/image\/|application\/octet-stream/i.test(contentType)) {
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(imagePath, buffer);
    return { imagePath, motionPrompt: '' };
  }
  const json = await response.json();
  const b64 = json?.data?.[0]?.b64_json || json?.b64_json || '';
  if (!b64) throw new Error('9Router Image API khÃ´ng tráº£ vá» b64_json.');
  await fs.writeFile(imagePath, Buffer.from(b64, 'base64'));
  await fs.writeFile(path.join(sceneDir, 'image_api_response.json'), JSON.stringify({ model, size, endpoint, created: json.created || null }, null, 2), 'utf8');
  return { imagePath, motionPrompt: '' };
}

async function generateImageAndMotionWithChatGPT({ imagePrompt, sceneDir, sceneId, chatContextTitle = '', pendingChatRenameTitle = '', referenceImagePaths = [] }) {
  const page = await getCdpPage('chatgpt', true);
  const loginState = await evaluateOnCdpPage(page, `(${detectLoginScript.toString()})('chatgpt')`);
  if (!loginState.loggedIn) {
    const autoLogin = await tryAutoLoginWithStoredAccount(page, 'chatgpt', { reason: 'image-pipeline', sceneId }).catch((error) => ({ ok: false, error: error.message }));
    const retryLoginState = autoLogin?.ok
      ? await evaluateOnCdpPage(page, `(${detectLoginScript.toString()})('chatgpt')`).catch(() => ({ loggedIn: false }))
      : { loggedIn: false };
    if (!retryLoginState.loggedIn) {
      await page.close();
      if (autoLogin?.noStoredAccount) throw new Error(`CREDENTIAL_REQUIRED:chatgpt: ChÆ°a cÃ³ account ChatGPT Ä‘á»ƒ tá»± login.`);
      throw new Error(loginRequiredMessage('chatgpt', loginState.reason || loginState.url || autoLogin?.finalReason || ''));
    }
  }
  if (chatContextTitle?.trim()) {
    const selectedChat = await selectChatGptConversationByTitle(page, chatContextTitle.trim());
    await appendAppLog(null, { source: 'main', kind: selectedChat?.ok ? 'ok' : 'error', text: `PIPELINE Scene ${sceneId}: ${selectedChat?.ok ? `Ä‘Ã£ má»Ÿ Ä‘oáº¡n chat \"${chatContextTitle}\"` : selectedChat?.error || 'khÃ´ng tÃ¬m tháº¥y Ä‘oáº¡n chat theo tÃªn'}`, details: selectedChat });
    if (!selectedChat?.ok) throw new Error(selectedChat?.error || `KhÃ´ng tÃ¬m tháº¥y Ä‘oáº¡n chat ChatGPT: ${chatContextTitle}`);
  } else {
    await appendAppLog(null, { source: 'main', kind: 'running', text: `PIPELINE Scene ${sceneId}: khÃ´ng cÃ³ tÃªn Ä‘oáº¡n chat, dÃ¹ng ChatGPT tab hiá»‡n táº¡i.` });
  }

  const imageInstruction = [
    'Táº¡o 1 áº£nh duy nháº¥t theo prompt dÆ°á»›i Ä‘Ã¢y. KhÃ´ng tráº£ lá»i báº±ng text dÃ i. Náº¿u cÃ³ thá»ƒ, hÃ£y render/generate image trá»±c tiáº¿p.',
    imagePrompt,
  ].join('\n\n');
  const beforeImages = await evaluateOnCdpPage(page, `(${collectGeneratedImageUrlsScript.toString()})()`);
  const refsToUpload = (referenceImagePaths || []).slice(0, 3);
  const restoredFrames = { ok: true, count: 0, uploaded: [], errors: [] };
  if (refsToUpload.length) {
    await evaluateOnCdpPage(page, `(${prepareChatGptCreateImageScript.toString()})()`).catch(() => null);
    await sleep(800);
    for (const refPath of refsToUpload) {
      const uploaded = await uploadFileViaCdp(page, refPath, 'chatgpt').catch((error) => ({ ok: false, error: error.message }));
      if (uploaded?.ok) {
        restoredFrames.count += 1;
        restoredFrames.uploaded.push(path.basename(refPath));
      } else {
        restoredFrames.errors.push({ file: path.basename(refPath), error: uploaded?.error || 'upload-failed' });
      }
      await sleep(900);
    }
  } else {
    restoredFrames.skipped = true;
    restoredFrames.reason = 'KhÃ´ng cÃ³ keyframe cÅ© Ä‘á»ƒ gá»­i kÃ¨m NV1';
  }
  await appendAppLog(null, { source: 'main', kind: restoredFrames.count ? 'ok' : 'running', text: `PIPELINE Scene ${sceneId}: gá»­i kÃ¨m áº£nh key gáº§n nháº¥t vÃ o ChatGPT: ${restoredFrames.count}/${refsToUpload.length}.`, details: restoredFrames });
  await evaluateOnCdpPage(page, `(${prepareChatGptCreateImageScript.toString()})()`).catch(() => null);
  await sleep(800);
  const sentImage = await sendPromptViaCdpInput(page, imageInstruction);
  await appendAppLog(null, { source: 'main', kind: sentImage?.ok ? 'ok' : 'error', text: `Scene ${sceneId}: ChatGPT send image prompt ${sentImage?.ok ? 'ok' : sentImage?.error || 'failed'}`, details: sentImage });
  if (!sentImage.ok) throw new Error(sentImage.error || 'KhÃ´ng gá»­i Ä‘Æ°á»£c image prompt vÃ o ChatGPT.');
  const imagePath = path.join(sceneDir, `scene_${String(sceneId).padStart(3, '0')}_keyframe.png`);
  const imageUrl = await waitForChatGptImageOrRetry(page, beforeImages?.urls || [], imageInstruction, sceneDir, sceneId);

  try {
    if (!imageUrl) {
      throw new Error('ChatGPT chÆ°a tráº£ URL áº£nh tháº­t; khÃ´ng crop placeholder/canvas.');
    }
    if (String(imageUrl).startsWith('chatgpt-custom-box-y')) {
      await captureLatestImageElement(page, imagePath, imageUrl);
    } else {
      await downloadBrowserAsset(page, imageUrl, imagePath);
    }
  } catch (error) {
    await fs.writeFile(path.join(sceneDir, 'image_url_download_error.txt'), error.stack || error.message, 'utf8');
    throw new Error(`ÄÃ£ tháº¥y áº£nh ChatGPT nhÆ°ng táº£i file lá»—i: ${error.message}`);
  }

  let generatedMotionPrompt = '';

  await page.close();
  return { imagePath, motionPrompt: generatedMotionPrompt };
}

async function generateMotionPromptWithChatGPT({ imagePath, prompt, sceneDir, sceneId, chatContextTitle = '' }) {
  const page = await getCdpPage('chatgpt', false, { bringToFront: true });
  const loginState = await evaluateOnCdpPage(page, `(${detectLoginScript.toString()})('chatgpt')`);
  if (!loginState.loggedIn) {
    const autoLogin = await tryAutoLoginWithStoredAccount(page, 'chatgpt', { reason: 'motion-prompt', sceneId }).catch((error) => ({ ok: false, error: error.message }));
    const retryLoginState = autoLogin?.ok
      ? await evaluateOnCdpPage(page, `(${detectLoginScript.toString()})('chatgpt')`).catch(() => ({ loggedIn: false }))
      : { loggedIn: false };
    if (!retryLoginState.loggedIn) {
      if (autoLogin?.noStoredAccount) throw new Error(`CREDENTIAL_REQUIRED:chatgpt: ChÆ°a cÃ³ account ChatGPT Ä‘á»ƒ tá»± login.`);
      throw new Error(loginRequiredMessage('chatgpt', loginState.reason || loginState.url || autoLogin?.finalReason || ''));
    }
  }
  if (chatContextTitle?.trim()) {
    await selectChatGptConversationByTitle(page, chatContextTitle.trim()).catch(async (error) => {
      await appendAppLog(null, { source: 'main', kind: 'error', text: `ChatGPT khÃ´ng chá»n Ä‘Æ°á»£c cuá»™c trÃ² chuyá»‡n "${chatContextTitle}": ${error.message}` });
    });
  }
  const idleBeforeNv2 = await waitForChatGptIdle(page, 8000).catch((error) => ({ ok: false, error: error.message }));
  if (!idleBeforeNv2?.ok) {
    const stoppedBeforeNv2 = await stopChatGptAndWaitForIdle(page, 30000).catch((error) => ({ ok: false, error: error.message }));
    await appendAppLog(null, { source: 'main', kind: stoppedBeforeNv2?.ok ? 'ok' : 'error', text: `Scene ${sceneId}: ChatGPT settle before NV2: ${stoppedBeforeNv2?.ok ? stoppedBeforeNv2.mode || 'idle' : stoppedBeforeNv2?.error || 'busy'}`, details: { idleBeforeNv2, stoppedBeforeNv2 } });
    if (!stoppedBeforeNv2?.ok) throw new Error(`ChatGPT is still busy before NV2 (${stoppedBeforeNv2?.error || idleBeforeNv2?.error || 'busy'}).`);
  }
  const before = await evaluateOnCdpPage(page, `(${readLatestAssistantScript.toString()})()`).catch(() => ({ count: 0, text: '' }));
  const uploadedForNv2 = await uploadFileViaCdp(page, imagePath, 'chatgpt');
  if (!uploadedForNv2?.ok) throw new Error(uploadedForNv2?.error || 'KhÃ´ng upload Ä‘Æ°á»£c áº£nh keyframe vÃ o ChatGPT trÆ°á»›c khi gá»­i NV2.');
  await appendAppLog(null, { source: 'main', kind: 'ok', text: `Scene ${sceneId}: ChatGPT Ä‘Ã£ nháº­n áº£nh keyframe trÆ°á»›c NV2.`, details: uploadedForNv2 });
  await sleep(1200);
  const instruction = [
    'Dá»±a trÃªn áº£nh keyframe vá»«a Ä‘Æ°á»£c upload, hÃ£y thá»±c hiá»‡n NHIá»†M Vá»¤ 2 Ä‘á»ƒ táº¡o MOTION PROMPT cho video.',
    'Chá»‰ tráº£ vá» prompt motion cuá»‘i cÃ¹ng, khÃ´ng giáº£i thÃ­ch, khÃ´ng markdown thá»«a.',
    prompt,
  ].join('\n\n');
  const sent = await sendPromptViaCdpInput(page, instruction);
  if (!sent.ok) throw new Error(sent.error || 'KhÃ´ng gá»­i Ä‘Æ°á»£c Nhiá»‡m vá»¥ 2 vÃ o ChatGPT.');
  const startedAt = Date.now();
  let latest = '';
  let lastState = null;
  let recoveredOnce = 0;
  const retryMotionPrompt = async (reason, state) => {
    if (recoveredOnce >= 3) return false;
    recoveredOnce += 1;
    await fs.writeFile(path.join(sceneDir, `scene_${String(sceneId).padStart(3, '0')}_chatgpt_motion_recovery_${recoveredOnce}_${reason}.json`), JSON.stringify({ reason, state, elapsedMs: Date.now() - startedAt }, null, 2), 'utf8').catch(() => null);
    await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: NV2 bá»‹ káº¹t (${reason}), retry ${recoveredOnce}/3: F5 â†’ Stop â†’ F5 â†’ upload láº¡i áº£nh â†’ gá»­i láº¡i NV2.` });
    await page.Page.reload({ ignoreCache: true }).catch(() => null);
    await waitForCdpLoad(page).catch(() => null);
    await sleep(1800);
    const stopped = await stopChatGptAndWaitForIdle(page, 45000).catch((error) => ({ ok: false, error: error.message }));
    await appendAppLog(null, { source: 'main', kind: stopped?.ok ? 'ok' : 'error', text: `Scene ${sceneId}: NV2 recovery Stop: ${stopped?.ok ? stopped.mode || 'ok' : stopped?.error || 'khÃ´ng tháº¥y Stop'}`, details: stopped });
    if (!stopped?.ok) throw new Error(`ChatGPT vẫn đang tạo/chưa dừng được NV2 (${stopped?.error || 'stop failed'}), không gửi lại để tránh spam composer.`);
    await sleep(800);
    await page.Page.reload({ ignoreCache: true }).catch(() => null);
    await waitForCdpLoad(page).catch(() => null);
    await sleep(2200);
    const uploadAgain = await uploadFileViaCdp(page, imagePath, 'chatgpt').catch((error) => ({ ok: false, error: error.message }));
    await appendAppLog(null, { source: 'main', kind: uploadAgain?.ok ? 'ok' : 'error', text: `Scene ${sceneId}: NV2 recovery upload láº¡i keyframe: ${uploadAgain?.ok ? 'ChatGPT Ä‘Ã£ nháº­n áº£nh' : uploadAgain?.error || 'failed'}`, details: uploadAgain });
    if (!uploadAgain?.ok) throw new Error(uploadAgain?.error || 'KhÃ´ng upload láº¡i Ä‘Æ°á»£c keyframe trÆ°á»›c khi retry NV2.');
    await sleep(1500);
    const beforeRetry = await evaluateOnCdpPage(page, `(${readLatestAssistantScript.toString()})()`).catch(() => ({ count: 0, text: '' }));
    const resent = await sendPromptViaCdpInput(page, instruction, { chatGptIdleTimeoutMs: 45000 });
    if (!resent?.ok) throw new Error(resent?.error || 'KhÃ´ng gá»­i láº¡i Nhiá»‡m vá»¥ 2 sau recovery.');
    await appendAppLog(null, { source: 'main', kind: 'ok', text: `Scene ${sceneId}: Ä‘Ã£ gá»­i láº¡i NV2 sau recovery ${recoveredOnce}/3.`, details: { resent, beforeRetry } });
    return true;
  };

  while (Date.now() - startedAt < 360000) {
    await sleep(3000);
    const state = await evaluateOnCdpPage(page, `(${readLatestAssistantScript.toString()})()`).catch(() => null);
    lastState = state;
    if (!state?.text) {
      await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: Ä‘ang chá» ChatGPT tráº£ NV2, chÆ°a tháº¥y assistant response má»›i.`, details: state });
      if (Date.now() - startedAt > 25000 && await retryMotionPrompt('no-assistant-after-send', state)) continue;
      continue;
    }
    latest = state.text.trim();
    const freshAssistant = state.count > (before?.count || 0) || latest !== before?.text;
    const quality = validateMotionPromptResponse(latest, { beforeText: before?.text || '', instruction, taskPrompt: prompt });
    const composerIdle = !state.stopButton && !state.generating;
    const composerDone = composerIdle && (state.voiceReady || quality.ok);
    if (freshAssistant && composerDone && quality.ok) break;
    if (freshAssistant && composerIdle && !quality.ok && Date.now() - startedAt > 25000 && await retryMotionPrompt(quality.error || 'bad-response-idle', state)) continue;
    if (!freshAssistant && composerIdle && Date.now() - startedAt > 25000 && await retryMotionPrompt('stuck-after-user-message', state)) continue;
    await appendAppLog(null, {
      source: 'main',
      kind: 'running',
      text: `Scene ${sceneId}: chá» ChatGPT hoÃ n táº¥t NV2 (${state.generating ? 'thinking' : quality.error || 'response-chÆ°a-Ä‘á»§'}).`,
      details: { ...state, quality, textHead: latest.slice(0, 500) },
    });
  }
  const finalQuality = validateMotionPromptResponse(latest, { beforeText: before?.text || '', instruction, taskPrompt: prompt });
  if (!latest || latest === before?.text || !finalQuality.ok) {
    await fs.writeFile(path.join(sceneDir, 'motion_prompt_wait_failed.json'), JSON.stringify({ latest, before, lastState, finalQuality }, null, 2), 'utf8').catch(() => null);
    throw new Error(`ChatGPT chÆ°a tráº£ motion prompt NV2 Ä‘á»§ ná»™i dung: ${finalQuality.error || 'empty/old-response'}.`);
  }
  await fs.writeFile(path.join(sceneDir, 'motion_prompt_from_chatgpt.txt'), latest, 'utf8');
  await page.close().catch(() => null);
  return latest;
}

function validateMotionPromptResponse(text = '', { beforeText = '', instruction = '', taskPrompt = '' } = {}) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return { ok: false, error: 'empty-response' };
  if (value === String(beforeText || '').replace(/\s+/g, ' ').trim()) return { ok: false, error: 'same-as-before' };
  const lower = value.toLowerCase();
  const instructionHead = String(instruction || '').replace(/\s+/g, ' ').trim().slice(0, 120).toLowerCase();
  const taskHead = String(taskPrompt || '').replace(/\s+/g, ' ').trim().slice(0, 120).toLowerCase();
  if (instructionHead && lower.startsWith(instructionHead.slice(0, 80))) return { ok: false, error: 'echoed-user-instruction' };
  if (taskHead && lower.startsWith(taskHead.slice(0, 80))) return { ok: false, error: 'echoed-task-prompt' };
  if (/^thought\s+for\s+\d+/i.test(value) || /^edit$/i.test(value) || /\bThought\s+for\s+\d+[^\n]*(\n|\s)*Edit\b/i.test(String(text || ''))) return { ok: false, error: 'thinking-summary-not-final' };
  if (/nhiá»‡m\s*vá»¥\s*2\s*:|show more|Ä‘oáº¡n Ä‘áº§u scene|vá»«a táº¡o/i.test(value) && value.length < 900) return { ok: false, error: 'looks-like-collapsed-user-prompt' };
  if (value.length < 180) return { ok: false, error: 'too-short' };
  const motionSignals = [
    /camera|shot|lens|dolly|pan|tilt|zoom|tracking|close[-\s]?up|wide shot/i,
    /motion|movement|move|chuyá»ƒn Ä‘á»™ng|mÃ¡y quay|gÃ³c quay|khung hÃ¬nh/i,
    /second|seconds|giÃ¢y|10s|10 giÃ¢y/i,
    /light|lighting|cinematic|atmosphere|render|focus|depth/i,
  ];
  const score = motionSignals.reduce((total, pattern) => total + (pattern.test(value) ? 1 : 0), 0);
  if (score < 2) return { ok: false, error: 'missing-motion-prompt-signals', score };
  return { ok: true, score, length: value.length };
}

function normalizeVideoProvider(provider) {
  return provider === 'pixverse' ? 'pixverse' : 'grok';
}

async function generateVideoWithProvider({ provider, imagePath, motionPrompt, sceneDir, sceneId, videoConfig = {} }) {
  if (provider === 'pixverse') {
    return generateVideoWithGenericProvider({ provider: 'pixverse', imagePath, motionPrompt, sceneDir, sceneId, config: videoConfig.pixverse || {} });
  }
  return generateVideoWithGenericProvider({ provider: 'grok', imagePath, motionPrompt, sceneDir, sceneId, config: videoConfig.grok || {} });
}

async function waitForGrokImagineReady(page, sceneId = '') {
  const startedAt = Date.now();
  let lastState = null;
  while (Date.now() - startedAt < 20000) {
    lastState = await evaluateOnCdpPage(page, `(${getGrokReadyStateScript.toString()})()`).catch((error) => ({ ready: false, error: error.message }));
    if (lastState?.ready) {
      await appendAppLog(null, { source: 'main', kind: 'ok', text: `Scene ${sceneId}: Grok Imagine Ä‘Ã£ load xong, báº¯t Ä‘áº§u kiá»ƒm tra/upload.`, details: lastState });
      return lastState;
    }
    await sleep(1000);
  }
  await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: Grok load cháº­m, váº«n tiáº¿p tá»¥c sau timeout 20s.`, details: lastState });
  return lastState;
}

async function closeGrokTemplateModal(page, sceneId = '') {
  await page.Page.bringToFront().catch(() => null);
  await sleep(300);
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const scan = await evaluateOnCdpPage(page, `(${scanGrokTemplateModalScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
    if (scan?.open) {
      await appendAppLog(null, {
        source: 'main',
        kind: 'running',
        text: `Scene ${sceneId}: phÃ¡t hiá»‡n báº£ng template Grok, Æ°u tiÃªn báº¥m X/áº©n báº£ng thay vÃ¬ chá»n template.`,
        details: { scan },
      });
    }

    await page.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }).catch(() => null);
    await page.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }).catch(() => null);
    await sleep(250);
    const state = await evaluateOnCdpPage(page, `(${closeGrokTemplateModalScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
    if (state?.ok && state?.box) {
      const x = state.box.x + state.box.width / 2;
      const y = state.box.y + state.box.height / 2;
      await page.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y, button: 'none' }).catch(() => null);
      await page.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 }).catch(() => null);
      await page.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }).catch(() => null);
      await sleep(700);
    }
    const after = await evaluateOnCdpPage(page, `(${detectGrokTemplateModalScript.toString()})()`).catch(() => ({ open: false }));
    if (!after?.open) {
      if (state?.ok) await appendAppLog(null, { source: 'main', kind: 'ok', text: `Scene ${sceneId}: Ä‘Ã£ táº¯t báº£ng template Grok báº±ng nÃºt X.`, details: state });
      return { ok: true, closed: Boolean(state?.ok), state };
    }
    const viewportFallback = await evaluateOnCdpPage(page, `(${getGrokTemplateViewportFallbackPointsScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
    if (viewportFallback?.ok) {
      for (const point of viewportFallback.points || []) {
        await page.Input.dispatchMouseEvent({ type: 'mouseMoved', x: point.x, y: point.y, button: 'none' }).catch(() => null);
        await page.Input.dispatchMouseEvent({ type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 }).catch(() => null);
        await page.Input.dispatchMouseEvent({ type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 }).catch(() => null);
        await sleep(900);
        const afterFallback = await evaluateOnCdpPage(page, `(${detectGrokTemplateModalScript.toString()})()`).catch(() => ({ open: false }));
        await appendAppLog(null, {
          source: 'main',
          kind: afterFallback?.open ? 'running' : 'ok',
          text: `Scene ${sceneId}: Grok fallback click ${point.name} táº¡i (${Math.round(point.x)}, ${Math.round(point.y)}) -> ${afterFallback?.open ? 'popup váº«n cÃ²n' : 'popup Ä‘Ã£ Ä‘á»•i/táº¯t'}`,
          details: { viewportFallback, point, afterFallback },
        });
        if (!afterFallback?.open) return { ok: true, fallbackPoint: point };
      }
    }
    await sleep(500);
  }
  const forceHidden = await evaluateOnCdpPage(page, `(${forceHideGrokTemplateModalScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
  await sleep(500);
  const finalState = await evaluateOnCdpPage(page, `(${detectGrokTemplateModalScript.toString()})()`).catch(() => ({ open: true }));
  await appendAppLog(null, {
    source: 'main',
    kind: forceHidden?.ok && !finalState?.open ? 'ok' : 'running',
    text: forceHidden?.ok && !finalState?.open
      ? `Scene ${sceneId}: Ä‘Ã£ áº©n cÆ°á»¡ng bá»©c báº£ng template Grok Ä‘á»ƒ tiáº¿p tá»¥c upload.`
      : `Scene ${sceneId}: báº£ng template Grok váº«n cÃ²n; Ä‘Ã£ thá»­ chá»n Photo â†’ Video, báº¥m X vÃ  áº©n cÆ°á»¡ng bá»©c.`,
    details: { forceHidden, finalState },
  });
  return { ok: !finalState?.open || Boolean(forceHidden?.ok), state: finalState, forceHidden };
}

async function detectLoginWithRetry(page, provider, sceneId = '') {
  let lastState = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await waitForCdpLoad(page).catch(() => null);
    lastState = await evaluateOnCdpPage(page, `(${detectLoginScript.toString()})(${JSON.stringify(provider)})`).catch((error) => ({ loggedIn: false, reason: error.message }));
    await appendAppLog(null, {
      source: 'main',
      kind: lastState?.loggedIn ? 'ok' : 'running',
      text: `Scene ${sceneId}: check login ${PROVIDER_META[provider]?.title || provider} láº§n ${attempt}/3: ${lastState?.loggedIn ? 'Ä‘Ã£ login' : 'chÆ°a sáºµn sÃ ng'}`,
      details: lastState,
    });
    if (lastState?.loggedIn) return lastState;
    if (shouldRecoverFromCacheOrChallenge(lastState, provider)) {
      const recovery = await recoverProviderFromCacheOrChallenge(page, provider, `scene-${sceneId || 'unknown'}-login-attempt-${attempt}`).catch((error) => ({ ok: false, error: error.message }));
      lastState = { ...lastState, cacheRecovery: recovery };
      if (recovery?.ok) continue;
    }
    if (['chatgpt', 'grok'].includes(provider)) {
      const autoLogin = await tryAutoLoginWithStoredAccount(page, provider, { reason: `scene-login-attempt-${attempt}`, sceneId }).catch((error) => ({ ok: false, error: error.message }));
      lastState = { ...lastState, autoLogin };
      if (autoLogin?.ok) {
        lastState = await evaluateOnCdpPage(page, `(${detectLoginScript.toString()})(${JSON.stringify(provider)})`).catch((error) => ({ loggedIn: false, reason: error.message, autoLogin }));
        if (lastState?.loggedIn) return lastState;
      }
      if (autoLogin?.noStoredAccount) break;
    }
    await sleep(attempt === 1 ? 2500 : 4000);
  }
  return lastState;
}

async function generateVideoWithGenericProvider({ provider, imagePath, motionPrompt, sceneDir, sceneId, config = {} }) {
  const page = await getCdpPage(provider, true);
  const loginState = await detectLoginWithRetry(page, provider, sceneId);
  const title = PROVIDER_META[provider]?.title || provider;
  if (!loginState.loggedIn) {
    await page.close();
    if (loginState?.autoLogin?.noStoredAccount) throw new Error(`CREDENTIAL_REQUIRED:${provider}: ChÆ°a cÃ³ account ${title} Ä‘á»ƒ tá»± login.`);
    throw new Error(loginRequiredMessage(provider, loginState.reason || loginState.url || ''));
  }

  if (provider === 'grok') {
    await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: Grok chuáº©n bá»‹ vÃ o Imagine/Image trÆ°á»›c khi upload áº£nh.` });
    await page.Page.navigate({ url: 'https://grok.com/imagine' }).catch(() => null);
    await waitForCdpLoad(page).catch(() => null);
    await sleep(1600);
    const templateState = await evaluateOnCdpPage(page, `({ url: location.href, path: location.pathname })`).catch(() => null);
    if (/\/imagine\/templates\//i.test(String(templateState?.path || templateState?.url || ''))) {
      await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: Ä‘ang á»Ÿ Grok template URL, Ã©p quay láº¡i /imagine Ä‘á»ƒ trÃ¡nh upload vÃ o popup template.`, details: templateState });
      await page.Page.navigate({ url: 'https://grok.com/imagine' }).catch(() => null);
      await waitForCdpLoad(page).catch(() => null);
      await sleep(1200);
    }
    await closeGrokTemplateModal(page, sceneId).catch((error) => appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: thá»­ táº¯t template modal lá»—i nháº¹: ${error.message}` }));
  }

  const capability = await evaluateOnCdpPage(page, `(${detectVideoCapabilityScript.toString()})(${JSON.stringify(provider)})`);
  if (!capability?.ok) {
    await page.close();
    throw new Error(capability?.error || `${title} account nÃ y chÆ°a cÃ³ feature táº¡o video/upload áº£nh. HÃ£y Ä‘á»•i account/plan rá»“i cháº¡y láº¡i.`);
  }

  if (provider === 'pixverse') {
    await evaluateOnCdpPage(page, `(${preparePixVerseComposerScript.toString()})(${JSON.stringify(config)})`);
    await sleep(800);
  } else if (provider === 'grok') {
    const prepared = await evaluateOnCdpPage(page, `(${prepareGrokVideoComposerScript.toString()})(${JSON.stringify(config || {})})`).catch((error) => ({ ok: false, error: error.message }));
    await appendAppLog(null, { source: 'main', kind: prepared?.ok ? 'ok' : 'error', text: `Scene ${sceneId}: Grok Image mode/canvas prepare: ${prepared?.status || prepared?.error || 'checked'}`, details: prepared });
    if (!prepared?.ok) throw new Error(prepared?.error || prepared?.status || 'KhÃ´ng vÃ o Ä‘Æ°á»£c Grok Image/Empty Canvas.');
    const afterPrepareState = await evaluateOnCdpPage(page, `({ url: location.href, path: location.pathname })`).catch(() => null);
    if (/\/imagine\/templates\//i.test(String(afterPrepareState?.path || afterPrepareState?.url || ''))) {
      await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: Grok prepare má»Ÿ nháº§m template, quay láº¡i /imagine trÆ°á»›c khi paste áº£nh.`, details: afterPrepareState });
      await page.Page.navigate({ url: 'https://grok.com/imagine' }).catch(() => null);
      await waitForCdpLoad(page).catch(() => null);
      await sleep(1200);
    }
    await closeGrokTemplateModal(page, sceneId).catch(() => null);
    await sleep(800);
  }

  await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: báº¯t Ä‘áº§u upload áº£nh vÃ o ${title}.`, details: { imagePath } });
  const uploadResult = await uploadFileViaCdp(page, imagePath, provider);
  if (!uploadResult.ok) {
    throw new Error(uploadResult.error || `KhÃ´ng upload Ä‘Æ°á»£c áº£nh vÃ o ${title}.`);
  }

  await appendAppLog(null, { source: 'main', kind: 'ok', text: `Scene ${sceneId}: ${title} Ä‘Ã£ nháº­n áº£nh upload.`, details: uploadResult });
  if (provider === 'grok') {
    const settled = await waitForGrokUploadSettled(page, sceneId);
    await appendAppLog(null, { source: 'main', kind: settled?.ok ? 'ok' : 'running', text: `Scene ${sceneId}: Grok upload áº£nh trá»±c tiáº¿p ${settled?.ok ? 'Ä‘Ã£ xong' : 'chÆ°a xÃ¡c nháº­n xong'}`, details: settled });
  }

  const beforeVideos = await evaluateOnCdpPage(page, `(${collectVideoUrlsScript.toString()})()`);
  await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: báº¯t Ä‘áº§u paste prompt vÃ o ${title}.` });
  const sent = provider === 'pixverse'
    ? await submitPixVersePrompt(page, motionPrompt, config)
    : provider === 'grok'
      ? await submitGrokVideoPrompt(page, motionPrompt, config)
      : await sendPromptViaCdpInput(page, motionPrompt);
  if (!sent.ok) throw new Error(sent.error || `KhÃ´ng gá»­i Ä‘Æ°á»£c motion prompt vÃ o ${title}.`);
  await appendAppLog(null, { source: 'main', kind: 'ok', text: `Scene ${sceneId}: Ä‘Ã£ gá»­i prompt vÃ o ${title}.`, details: sent });
  if (provider === 'grok') {
    const confirmed = await confirmGrokVideoGenerationIfAsked(page, sceneId);
    if (confirmed?.ok) {
      await appendAppLog(null, { source: 'main', kind: 'ok', text: `Scene ${sceneId}: Grok há»i xÃ¡c nháº­n, Ä‘Ã£ gá»­i lá»‡nh táº¡o video.`, details: confirmed });
    }
  }

  const videoUrl = await waitForNewVideoUrl(page, beforeVideos?.urls || [], { provider, sceneId, sceneDir, imagePath, motionPrompt }).catch(() => '');
  if (!videoUrl) {
    await page.close();
    return { status: `${provider}-sent-await-manual-download` };
  }

  const videoPath = path.join(sceneDir, `scene_${String(sceneId).padStart(3, '0')}_video.mp4`);
  const downloaded = await downloadBrowserAsset(page, videoUrl, videoPath).then(
    () => ({ ok: true }),
    (error) => ({ ok: false, error: error.message }),
  );
  if (!downloaded.ok) {
    await appendAppLog(null, {
      source: 'main',
      kind: 'running',
      text: `Scene ${sceneId}: ${title} Ä‘Ã£ táº¡o video nhÆ°ng chÆ°a táº£i tá»± Ä‘á»™ng Ä‘Æ°á»£c, cáº§n táº£i thá»§ cÃ´ng tá»« tab Grok.`,
      details: { videoUrl, videoPath, error: downloaded.error },
    });
    await page.close();
    return { status: `${provider}-generated-manual-download`, videoUrl, error: downloaded.error };
  }
  await page.close();
  return { status: 'video-downloaded', videoPath };
}

async function getCdpPage(provider, createIfMissing = true, options = {}) {
  await ensureChromeDebug();
  const shouldBringToFront = options.bringToFront !== false;
  const shouldRecover = options.recover !== false;
  const meta = PROVIDER_META[provider] || PROVIDER_META.chatgpt;
  const hostname = new URL(meta.url).hostname;
  const targets = await CDP.List({ host: '127.0.0.1', port: chromeDebugPort });
  const providerTargets = targets
    .filter((target) => target.type === 'page')
    .filter((target) => target.url?.includes(hostname));

  let target = null;
  for (const candidate of providerTargets) {
    const probe = await CDP({ target: candidate, host: '127.0.0.1', port: chromeDebugPort }).catch(() => null);
    if (!probe) continue;
    await probe.Runtime.enable().catch(() => null);
    const state = await evaluateOnCdpPage(probe, `(${detectLoginScript.toString()})(${JSON.stringify(provider)})`).catch(() => null);
    await probe.close().catch(() => null);
    if (state?.loggedIn || state?.hasComposer || state?.hasAppShell) {
      target = candidate;
      break;
    }
  }

  target = target || providerTargets.find((candidate) => !candidate.url?.startsWith('about:blank'));
  target = target || (createIfMissing ? await openCdpTab(meta.url) : null);
  if (!target) {
    throw new Error(`KhÃ´ng tÃ¬m tháº¥y tab ${meta.title}.`);
  }

  const client = await CDP({ target, host: '127.0.0.1', port: chromeDebugPort });
  await client.Page.enable();
  await client.Runtime.enable();
  await client.DOM.enable();
  await client.Network.enable().catch(() => null);
  if (shouldBringToFront) await client.Page.bringToFront().catch(() => null);
  await waitForCdpLoad(client);
  if (shouldRecover) await recoverProviderFromCacheOrChallenge(client, provider, 'get-page').catch(() => null);
  return client;
}

async function waitForCdpLoad(client) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    const readyState = await evaluateOnCdpPage(client, 'document.readyState').catch(() => 'loading');
    if (readyState === 'complete' || readyState === 'interactive') return;
    await sleep(500);
  }
}

async function evaluateOnCdpPage(client, expression) {
  const result = await client.Runtime.evaluate({
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    const details = result.exceptionDetails;
    const exception = details.exception || {};
    const description = exception.description || exception.value || exception.className || details.text || 'CDP evaluate lá»—i.';
    const location = `${details.url || ''}:${details.lineNumber ?? ''}:${details.columnNumber ?? ''}`;
    throw new Error(`${details.text || 'CDP evaluate lá»—i'}: ${description}${location !== '::' ? ` @ ${location}` : ''}`);
  }
  return result.result?.value;
}

function shouldRecoverFromCacheOrChallenge(state, provider) {
  if (provider !== 'grok') return false;
  const haystack = `${state?.reason || ''}\n${state?.title || ''}\n${state?.url || ''}\n${state?.sampleText || ''}`;
  return /cloudflare|security verification|verify you are human|just a moment|checking if the site connection|challenge|ray id|grok\.com\s+performing security/i.test(haystack);
}

async function ensureGrokEmptyCanvas(page, sceneId = '', forceNew = false) {
  await page.Page.bringToFront().catch(() => null);
  const current = await evaluateOnCdpPage(page, `({ path: location.pathname.toLowerCase(), url: location.href })`).catch(() => ({ path: '' }));
  if (current?.path?.includes('/imagine/agent/') && current.path.length > '/imagine/agent/'.length) {
    await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: Ä‘ang á»Ÿ canvas Grok cÅ©, tool sáº½ thoÃ¡t ra vÃ  táº¡o Empty Canvas má»›i.`, details: current });
  }
  await page.Page.navigate({ url: 'https://grok.com/imagine/agent' }).catch(() => null);
  await waitForCdpLoad(page).catch(() => null);
  await sleep(1800);
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const state = await evaluateOnCdpPage(page, `(${prepareGrokVideoComposerScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
    await appendAppLog(null, { source: 'main', kind: state?.ok ? 'ok' : 'running', text: `Scene ${sceneId}: Empty Canvas attempt ${attempt}: ${state?.status || state?.error || ''}`, details: state });
    if (state?.ok && state?.isAgentCanvas) return { ...state, forceNew };
    if (state?.emptyCanvasBox) {
      const x = state.emptyCanvasBox.x + state.emptyCanvasBox.width / 2;
      const y = state.emptyCanvasBox.y + state.emptyCanvasBox.height / 2;
      await page.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y, button: 'none' }).catch(() => null);
      await page.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 }).catch(() => null);
      await page.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }).catch(() => null);
      await waitForCdpLoad(page).catch(() => null);
    }
    await sleep(1200);
  }
  const finalState = await evaluateOnCdpPage(page, `({ url: location.href, text: document.body?.innerText?.slice(0, 1000) || '' })`).catch((error) => ({ error: error.message }));
  return { ok: false, error: 'KhÃ´ng vÃ o Ä‘Æ°á»£c Grok Empty Canvas; Ä‘ang á»Ÿ dashboard/template nÃªn khÃ´ng gá»­i prompt Ä‘á»ƒ trÃ¡nh báº¥m Create Worlds.', finalState };
}

async function collectExistingProjectVideos(sceneDir, currentSceneId = 0) {
  const projectDir = path.dirname(sceneDir);
  const entries = await fs.readdir(projectDir, { withFileTypes: true }).catch(() => []);
  const videos = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^scene_(\d+)/i);
    if (!match) continue;
    const sceneNo = Number(match[1]);
    if (!sceneNo || sceneNo >= Number(currentSceneId || 0)) continue;
    const dir = path.join(projectDir, entry.name);
    const files = await fs.readdir(dir).catch(() => []);
    for (const file of files) {
      if (!/\.(mp4|webm|mov)$/i.test(file)) continue;
      if (!/video|generated|grok|pixverse/i.test(file)) continue;
      videos.push({ sceneNo, path: path.join(dir, file), file });
    }
  }
  return videos.sort((a, b) => a.sceneNo - b.sceneNo || a.file.localeCompare(b.file));
}

async function restoreExistingProjectVideosToGrokCanvas(page, sceneDir, sceneId = 0) {
  const videos = await collectExistingProjectVideos(sceneDir, sceneId);
  const restored = [];
  for (const item of videos) {
    const result = await addMediaFileToGrokCanvas(page, item.path, 'video').catch((error) => ({ ok: false, error: error.message }));
    restored.push({ ...item, result });
    await sleep(1200);
  }
  return { ok: true, count: restored.filter((item) => item.result?.ok).length, total: videos.length, restored };
}

async function collectProjectKeyframes(sceneDir, currentSceneId = 0, includeCurrent = false) {
  const projectDir = path.dirname(sceneDir);
  const entries = await fs.readdir(projectDir, { withFileTypes: true }).catch(() => []);
  const frames = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^scene_(\d+)/i);
    if (!match) continue;
    const sceneNo = Number(match[1]);
    if (!sceneNo || sceneNo > Number(currentSceneId || 0) || (!includeCurrent && sceneNo === Number(currentSceneId || 0))) continue;
    const keyframe = path.join(projectDir, entry.name, `scene_${String(sceneNo).padStart(3, '0')}_keyframe.png`);
    if (await pathExists(keyframe)) frames.push({ sceneNo, path: keyframe, file: path.basename(keyframe) });
  }
  return frames.sort((a, b) => a.sceneNo - b.sceneNo);
}

async function restoreProjectKeyframesToGrokCanvas(page, sceneDir, sceneId = 0, includeCurrent = false) {
  const frames = await collectProjectKeyframes(sceneDir, sceneId, includeCurrent);
  const restored = [];
  for (const item of frames) {
    const result = await addMediaFileToGrokCanvas(page, item.path, 'image').catch((error) => ({ ok: false, error: error.message }));
    restored.push({ ...item, result });
    await sleep(900);
  }
  return { ok: true, count: restored.filter((item) => item.result?.ok).length, total: frames.length, restored };
}

async function restoreProjectKeyframesToChatGPT(page, sceneDir, sceneId = 0) {
  const frames = await collectProjectKeyframes(sceneDir, sceneId, false);
  const restored = [];
  for (const item of frames) {
    const result = await uploadFileViaCdp(page, item.path, 'chatgpt').catch((error) => ({ ok: false, error: error.message }));
    restored.push({ ...item, result });
    await sleep(1000);
  }
  return { ok: true, count: restored.filter((item) => item.result?.ok).length, total: frames.length, restored };
}

async function waitForGrokUploadSettled(page, sceneId = '') {
  const started = Date.now();
  while (Date.now() - started < 90000) {
    const state = await evaluateOnCdpPage(page, `(${detectGrokUploadStateScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
    if (state?.ok && !state.uploading) return { ok: true, sceneId, state };
    await sleep(1500);
  }
  return { ok: false, sceneId, error: 'timeout-waiting-upload-settled' };
}

async function clearGrokCanvasSelection(page) {
  await page.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }).catch(() => null);
  await page.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }).catch(() => null);
  await sleep(250);
  await evaluateOnCdpPage(page, `(${clickGrokComposerAreaScript.toString()})()`).catch(() => null);
  await sleep(250);
}

function buildGrokSafeMotionPrompt(originalPrompt = '', retryCount = 1) {
  return [
    originalPrompt,
    '',
    `CONTENT POLICY SAFE RETRY ${retryCount}: Rewrite the action as non-graphic, PG-13 adventure suspense. Do not show injury, blood, gore, attack impact, harm to a child, or violent contact. Replace any chase/attack/break-in with a safe tense escape, cautious movement, or protective rescue moment. The creature/animal must keep distance and appear non-contact. Generate a cinematic video from the uploaded keyframe now. Do not ask questions.`,
  ].join('\n');
}

async function recoverGrokAfterContentPolicy(page, options = {}) {
  const sceneId = options.sceneId || '';
  const safePrompt = buildGrokSafeMotionPrompt(options.motionPrompt || '', options.retryCount || 1);
  if ((options.retryCount || 1) >= 2) {
    await recoverGrokCanvasAfterLimit(page, { ...options, motionPrompt: safePrompt });
    return { ok: true, mode: 'new-canvas-safe-retry', safePromptHead: safePrompt.slice(0, 240) };
  }
  await clearGrokCanvasChat(page, sceneId);
  const sent = await submitGrokVideoPrompt(page, safePrompt, {});
  if (!sent?.ok) throw new Error(sent?.error || 'KhÃ´ng gá»­i láº¡i safe prompt sau content policy.');
  const confirmed = await confirmGrokVideoGenerationIfAsked(page, sceneId);
  return { ok: true, mode: 'same-canvas-safe-retry', sent, confirmed, safePromptHead: safePrompt.slice(0, 240) };
}

async function recoverGrokCanvasAfterLimit(page, options = {}) {
  const sceneId = options.sceneId || '';
  const sceneDir = options.sceneDir;
  await ensureGrokEmptyCanvas(page, sceneId, true);
  const videos = await restoreExistingProjectVideosToGrokCanvas(page, sceneDir, sceneId);
  const keyframes = await restoreProjectKeyframesToGrokCanvas(page, sceneDir, sceneId, true);
  await clearGrokCanvasChat(page, sceneId);
  const uploadCurrent = await uploadFileViaCdp(page, options.imagePath, 'grok');
  if (!uploadCurrent?.ok) throw new Error(uploadCurrent?.error || 'KhÃ´ng upload láº¡i keyframe scene hiá»‡n táº¡i sau limit.');
  const beforeVideos = await evaluateOnCdpPage(page, `(${collectVideoUrlsScript.toString()})()`).catch(() => ({ urls: [] }));
  const sent = await submitGrokVideoPrompt(page, options.motionPrompt, {});
  if (!sent?.ok) throw new Error(sent?.error || 'KhÃ´ng gá»­i láº¡i motion prompt sau limit.');
  const confirmed = await confirmGrokVideoGenerationIfAsked(page, sceneId);
  return { ok: true, videos, keyframes, uploadCurrent, beforeVideos, sent, confirmed };
}

async function addMediaFileToGrokCanvas(client, filePath, mediaType = 'image') {
  const uploadClick = await clickGrokUploadAndChooseFile(client, filePath);
  if (!uploadClick?.ok) return uploadClick;
  const accepted = await waitForGrokUploadedAsset(client, mediaType === 'video' ? 60000 : 45000);
  return accepted?.ok ? { ok: true, uploadClick, accepted } : { ok: false, error: accepted?.error || 'Grok chÆ°a nháº­n media.', uploadClick, accepted };
}

async function labelGrokCanvas(page, sceneId = '', sceneDir = '') {
  const label = `SCENE ${String(sceneId).padStart(3, '0')} Â· ${path.basename(sceneDir || '') || 'video'}`;
  const state = await evaluateOnCdpPage(page, `(${labelGrokCanvasScript.toString()})(${JSON.stringify(label)})`).catch((error) => ({ ok: false, error: error.message }));
  await appendAppLog(null, { source: 'main', kind: state?.ok ? 'ok' : 'running', text: `Scene ${sceneId}: Ä‘áº·t tÃªn Grok canvas: ${state?.ok ? label : state?.error || 'skip'}`, details: state });
  await sleep(500);
  return state;
}

async function clearGrokCanvasChat(page, sceneId = '') {
  const state = await evaluateOnCdpPage(page, `(${clearGrokCanvasChatScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
  await appendAppLog(null, { source: 'main', kind: state?.ok ? 'ok' : 'running', text: `Scene ${sceneId}: Grok clear chat panel: ${state?.ok ? state.mode : state?.error || 'skip'}`, details: state });
  await sleep(800);
  return state;
}

async function confirmGrokVideoGenerationIfAsked(page, sceneId = '') {
  await sleep(5000);
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const state = await evaluateOnCdpPage(page, `(${detectGrokConfirmationQuestionScript.toString()})()`).catch((error) => ({ shouldConfirm: false, error: error.message }));
    await appendAppLog(null, { source: 'main', kind: state?.shouldConfirm ? 'running' : 'ok', text: `Scene ${sceneId}: Grok confirm scan ${attempt}: ${state?.reason || 'not-needed'}`, details: state });
    if (!state?.shouldConfirm) {
      await sleep(1800);
      continue;
    }
    const sent = await sendGrokConfirmationText(page, 'Táº¡o video ngay bÃ¢y giá» tá»« keyframe Ä‘Ã£ upload vÃ  motion prompt á»Ÿ trÃªn. KhÃ´ng viáº¿t láº¡i prompt, khÃ´ng há»i láº¡i. Generate the video now.');
    if (sent?.ok) return { ok: true, attempt, state, sent };
    await sleep(1500);
  }
  return { ok: false, skipped: true, error: 'KhÃ´ng tháº¥y cÃ¢u há»i xÃ¡c nháº­n/echo prompt cáº§n pháº£n há»“i hoáº·c chÆ°a gá»­i Ä‘Æ°á»£c xÃ¡c nháº­n.' };
}

async function sendGrokConfirmationText(page, text) {
  const focused = await evaluateOnCdpPage(page, `(${focusGrokComposerScript.toString()})()`);
  if (!focused?.ok) return { ok: false, error: focused?.error || 'KhÃ´ng focus Ä‘Æ°á»£c Ã´ xÃ¡c nháº­n Grok.' };
  let ready = null;
  for (let waitAttempt = 1; waitAttempt <= 20; waitAttempt += 1) {
    ready = await evaluateOnCdpPage(page, `(() => {
      const buttons = [...document.querySelectorAll('button, [role="button"]')].map((node) => {
        const rect = node.getBoundingClientRect?.();
        const label = String((node.textContent || '') + ' ' + (node.getAttribute?.('aria-label') || '') + ' ' + (node.title || '')).trim();
        const disabled = !!node.disabled || node.getAttribute?.('aria-disabled') === 'true' || node.dataset?.disabled === 'true';
        return rect ? { label, disabled, x: rect.x, y: rect.y, w: rect.width, h: rect.height, html: String(node.innerHTML || '').slice(0, 300) } : null;
      }).filter(Boolean).filter((b) => b.w >= 24 && b.h >= 24 && b.x > window.innerWidth * 0.72 && b.y > window.innerHeight * 0.68);
      const send = buttons.find((b) => !b.disabled && b.x > window.innerWidth * 0.78 && b.y > window.innerHeight * 0.76 && !/Image|Video|480p|720p|1080p|6s|10s|Agent|Original/i.test(b.label));
      return { ok: !!send, send, buttons };
    })()`).catch((error) => ({ ok: false, error: error.message }));
    if (ready?.ok) break;
    await sleep(750);
  }
  await appendAppLog(null, { source: 'main', kind: ready?.ok ? 'running' : 'error', text: `Grok confirm: tráº¡ng thÃ¡i nÃºt send trÆ°á»›c Enter ${ready?.ok ? 'READY' : 'NOT READY'}.`, details: { focused, ready } });
  let after = null;
  for (let i = 1; i <= 18; i += 1) {
    await page.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }).catch(() => null);
    await page.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }).catch(() => null);
    await sleep(900);
    after = await evaluateOnCdpPage(page, `(() => {
      const text = document.body?.innerText || '';
      return { url: location.href, generating: /Generating|Creating|Cancel|%/i.test(text), stillEcho: /DÃ’NG\s*7|DONG\s*7|Negative Prompt/i.test(text.slice(-2200)), tail: text.slice(-900) };
    })()`).catch((error) => ({ error: error.message }));
    await appendAppLog(null, { source: 'main', kind: 'running', text: `Grok confirm Enter láº§n ${i}: ${after?.url || ''}`, details: after });
    if (/\/imagine\/post\//i.test(after?.url || '') || after?.generating) {
      return { ok: true, mode: 'repeat-enter-until-generating', focused, ready, after, attempts: i };
    }
  }
  return { ok: true, mode: 'repeat-enter-timeout', focused, ready, after };
}

async function recoverProviderFromCacheOrChallenge(client, provider, reason = 'unknown') {
  if (provider !== 'grok') return { ok: false, skipped: true, reason: 'provider-not-grok' };
  const state = await evaluateOnCdpPage(client, `(${detectLoginScript.toString()})(${JSON.stringify(provider)})`).catch((error) => ({ loggedIn: false, reason: error.message }));
  if (!shouldRecoverFromCacheOrChallenge(state, provider)) return { ok: false, skipped: true, reason: 'no-cache-challenge', state };

  const key = `${provider}:${reason}`;
  const used = challengeRecoveryAttempts.get(key) || 0;
  if (used >= CHALLENGE_RECOVERY_LIMIT) {
    return { ok: false, error: 'ÄÃ£ thá»­ clear cache/hard reload nhiá»u láº§n nhÆ°ng Grok váº«n Ä‘ang á»Ÿ Cloudflare challenge. Cáº§n tick Verify you are human thá»§ cÃ´ng má»™t láº§n trong Chrome.', state };
  }
  challengeRecoveryAttempts.set(key, used + 1);

  await appendAppLog(null, { source: 'main', kind: 'running', text: `Grok dÃ­nh cache/Cloudflare challenge (${reason}), clear cache + hard reload láº§n ${used + 1}/${CHALLENGE_RECOVERY_LIMIT}.`, details: state });
  await client.Network.clearBrowserCache().catch(() => null);
  await client.Network.clearBrowserCookies().catch(() => null);
  await client.Storage.clearDataForOrigin({ origin: 'https://grok.com', storageTypes: 'appcache,cache_storage,service_workers,websql,indexeddb,local_storage' }).catch(() => null);
  await client.Page.navigate({ url: 'about:blank' }).catch(() => null);
  await sleep(700);
  await client.Page.navigate({ url: PROVIDER_META.grok.url }).catch(() => null);
  await waitForCdpLoad(client).catch(() => null);
  await client.Page.reload({ ignoreCache: true }).catch(() => null);
  await sleep(2500);
  const after = await evaluateOnCdpPage(client, `(${detectLoginScript.toString()})(${JSON.stringify(provider)})`).catch((error) => ({ loggedIn: false, reason: error.message }));
  return { ok: !shouldRecoverFromCacheOrChallenge(after, provider), before: state, after, attempt: used + 1 };
}

async function getChatGptBusyState(client) {
  const urlState = await evaluateOnCdpPage(client, `({ href: location.href, host: location.host })`).catch(() => ({}));
  if (!/chatgpt\.com$/i.test(String(urlState?.host || ''))) return { isChatGpt: false, busy: false };
  const imageState = await evaluateOnCdpPage(client, `(${readChatGptImageStateScript.toString()})()`).catch(() => null);
  const latestState = await evaluateOnCdpPage(client, `(${readLatestAssistantScript.toString()})()`).catch(() => null);
  const busy = Boolean(
    imageState?.stopButton
    || imageState?.generating
    || imageState?.preparingImage
    || latestState?.stopButton
    || latestState?.generating
  );
  return { isChatGpt: true, busy, imageState, latestState };
}

async function waitForChatGptIdle(client, timeoutMs = 30000) {
  const startedAt = Date.now();
  let lastState = null;
  let idleTicks = 0;
  while (Date.now() - startedAt < timeoutMs) {
    lastState = await getChatGptBusyState(client);
    if (!lastState.isChatGpt || !lastState.busy) {
      idleTicks += 1;
      if (idleTicks >= 2) return { ok: true, state: lastState };
    } else {
      idleTicks = 0;
    }
    await sleep(1200);
  }
  return { ok: false, error: 'ChatGPT is still generating; refusing to paste/send another prompt.', state: lastState };
}

async function stopChatGptAndWaitForIdle(client, timeoutMs = 45000) {
  const before = await getChatGptBusyState(client);
  if (!before.isChatGpt || !before.busy) return { ok: true, mode: 'already-idle', before };
  const stopped = await evaluateOnCdpPage(client, `(${clickChatGptStopGeneratingScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
  if (!stopped?.ok) return { ok: false, error: stopped?.error || 'stop-button-not-found', before, stopped };
  const idle = await waitForChatGptIdle(client, timeoutMs);
  return { ok: Boolean(idle?.ok), mode: 'clicked-stop-and-waited', before, stopped, idle, error: idle?.error || '' };
}

async function sendPromptViaCdpInput(client, prompt, options = {}) {
  await client.Page.bringToFront().catch(() => null);
  await sleep(500);
  const idle = await waitForChatGptIdle(client, options.chatGptIdleTimeoutMs ?? 3000);
  if (!idle?.ok) {
    return { ok: false, error: idle.error || 'ChatGPT is busy; prompt was not pasted to avoid duplicate sends.', busyState: idle.state };
  }
  const focused = await evaluateOnCdpPage(client, `(${focusPromptInputScript.toString()})()`);
  if (!focused?.ok) {
    return { ok: false, error: focused?.error || 'KhÃ´ng focus Ä‘Æ°á»£c Ã´ nháº­p prompt.' };
  }

  await evaluateOnCdpPage(client, `(${setPromptInputValueScript.toString()})(${JSON.stringify(prompt)})`).catch(() => null);
  await sleep(1000);
  let afterInsert = await evaluateOnCdpPage(client, `(${getComposerTextScript.toString()})()`);
  const promptHead = String(prompt || '').slice(0, 80);
  const composerLooksAppended = afterInsert?.text && promptHead && afterInsert.text.length > prompt.length + 200 && afterInsert.text.includes(promptHead);
  if (!afterInsert?.text || afterInsert.text.length < Math.min(20, prompt.length) || composerLooksAppended) {
    await client.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17 }).catch(() => null);
    await client.Input.dispatchKeyEvent({ type: 'keyDown', key: 'A', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 }).catch(() => null);
    await client.Input.dispatchKeyEvent({ type: 'keyUp', key: 'A', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 }).catch(() => null);
    await client.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17 }).catch(() => null);
    await client.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }).catch(() => null);
    await client.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }).catch(() => null);
    await client.Input.insertText({ text: prompt });
    await sleep(800);
    afterInsert = await evaluateOnCdpPage(client, `(${getComposerTextScript.toString()})()`);
  }
  const stillLooksAppended = afterInsert?.text && promptHead && afterInsert.text.length > prompt.length + 200 && afterInsert.text.includes(promptHead);
  if (!afterInsert?.text || afterInsert.text.length < Math.min(20, prompt.length) || stillLooksAppended) {
    return { ok: false, error: `ÄÃ£ focus nhÆ°ng prompt khÃ´ng xuáº¥t hiá»‡n trong composer. Selector: ${focused.selector || 'unknown'}` };
  }

  let lastClick = null;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    lastClick = await evaluateOnCdpPage(client, `(${clickSendButtonScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
    if (lastClick?.ok) break;
    await sleep(2000);
  }
  if (!lastClick?.ok) {
    await client.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }).catch(() => null);
    await client.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }).catch(() => null);
    await sleep(1500);
  }
  const afterSend = await evaluateOnCdpPage(client, `(${getComposerTextScript.toString()})()`).catch(() => ({ text: '' }));
  if (!afterSend?.text || afterSend.text.length < 5) {
    return { ok: true, mode: lastClick?.ok ? 'cdp-insertText+send-retry' : 'cdp-insertText+enter-fallback', selector: focused.selector, send: lastClick?.selector || lastClick?.mode || lastClick?.error };
  }
  return { ok: false, error: `Prompt Ä‘Ã£ paste nhÆ°ng chÆ°a gá»­i Ä‘Æ°á»£c sau khi chá» nÃºt Send. NÃºt send: ${lastClick?.error || lastClick?.selector || 'unknown'}` };
}

async function waitForCdpAssistantResponse(client, beforeCount) {
  let lastText = '';
  let stableTicks = 0;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 180000) {
    await sleep(2500);
    const snapshot = await evaluateOnCdpPage(client, `(${readLatestAssistantScript.toString()})()`);
    const text = String(snapshot?.text || '').trim();
    const hasNewMessage = Number(snapshot?.count || 0) > Number(beforeCount || 0);
    if (hasNewMessage && text.length > 20) {
      if (text === lastText) {
        stableTicks += 1;
      } else {
        stableTicks = 0;
        lastText = text;
      }
      if (stableTicks >= 2 && !snapshot.generating) {
        await client.close();
        return text;
      }
    }
  }
  await client.close();
  if (lastText) return lastText;
  throw new Error('Háº¿t thá»i gian chá» response tá»« Chrome CDP.');
}

async function waitForNewImageUrl(client, existingUrls = []) {
  const known = new Set(existingUrls);
  const startedAt = Date.now();
  while (Date.now() - startedAt < 300000) {
    await sleep(3000);
    const snapshot = await evaluateOnCdpPage(client, `(${collectGeneratedImageUrlsScript.toString()})()`);
    const imageUrl = (snapshot?.urls || []).find((url) => !known.has(url));
    if (imageUrl) return imageUrl;
  }
  throw new Error('Háº¿t thá»i gian chá» ChatGPT táº¡o áº£nh hoáº·c khÃ´ng detect Ä‘Æ°á»£c áº£nh má»›i.');
}

async function selectChatGptConversationByTitle(client, title = '') {
  const wanted = String(title || '').trim();
  if (!wanted) return { ok: true, skipped: true };
  await client.Page.bringToFront().catch(() => null);
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const state = await evaluateOnCdpPage(client, `(${findChatGptConversationScript.toString()})(${JSON.stringify(wanted)})`).catch((error) => ({ ok: false, error: error.message }));
    if (state?.ok && state.box) {
      const x = state.box.x + state.box.width / 2;
      const y = state.box.y + state.box.height / 2;
      await client.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y, button: 'none' }).catch(() => null);
      await client.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 }).catch(() => null);
      await client.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }).catch(() => null);
      await waitForCdpLoad(client).catch(() => null);
      await sleep(1600);
      const locationState = await evaluateOnCdpPage(client, `({ href: location.href, path: location.pathname, title: document.title })`).catch((error) => ({ error: error.message }));
      if (String(locationState?.path || '').startsWith('/c/')) return { ...state, location: locationState };
      await appendAppLog(null, { source: 'main', kind: 'running', text: `ChatGPT context: Ä‘Ã£ click "${wanted}" nhÆ°ng URL chÆ°a vÃ o /c/... (path=${locationState?.path || ''}), thá»­ láº¡i.`, details: locationState });
    }
    await sleep(600);
  }
  return { ok: false, error: `KhÃ´ng tÃ¬m tháº¥y cuá»™c trÃ² chuyá»‡n ChatGPT tÃªn "${wanted}" trong sidebar.` };
}

async function waitForChatGptRecentItem(page, conversationPath = '', sceneId = '') {
  const conversationId = String(conversationPath || '').match(/\/c\/([^/?#]+)/)?.[1] || '';
  const startedAt = Date.now();
  let last = null;
  while (Date.now() - startedAt < 30000) {
    last = await evaluateOnCdpPage(page, `(() => {
      try {
        const conversationId = ${JSON.stringify(conversationId)};
        const nodes = Array.from(document.querySelectorAll('nav a, aside a, [role="navigation"] a, a[href*="/c/"], nav [role="link"], aside [role="link"], nav li, aside li, nav div, aside div'));
        const candidates = nodes.map((node) => {
          const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
          const href = node.href || (node.getAttribute ? node.getAttribute('href') : '') || '';
          const text = String(node.innerText || node.textContent || '').trim();
          const cls = String(node.className || '');
          const current = node.getAttribute ? (node.getAttribute('aria-current') || node.getAttribute('aria-selected') || '') : '';
          return { href, rect, text, cls, current };
        }).filter((item) => item.text && item.rect && item.rect.width > 40 && item.rect.height > 12 && item.rect.x < 220 && item.rect.y > 250);
        const hrefItem = candidates.find((item) => item.href.indexOf('/c/' + conversationId) >= 0);
        const activeItem = candidates.find((item) => /page|true|active|selected/i.test(String(item.current) + ' ' + item.cls));
        const topItem = candidates.slice().sort((a, b) => a.rect.y - b.rect.y)[0];
        const item = hrefItem || activeItem || null;
        return { ok: Boolean(item), mode: hrefItem ? 'href' : activeItem ? 'active' : 'missing', text: item?.text || '', candidateCount: candidates.length, topText: topItem?.text || '', path: location.pathname };
      } catch (error) {
        return { ok: false, error: error && error.message ? error.message : String(error), path: location.pathname };
      }
    })()`).catch((error) => ({ ok: false, error: error.message }));
    if (last?.ok) return last;
    await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: chá» Recents render chat má»›i (${last?.mode || last?.error || 'missing'}), top="${last?.topText || ''}" count=${last?.candidateCount || 0}` });
    await sleep(1000);
  }
  return { ok: false, error: 'Timeout waiting for current chat to appear in Recents.', last };
}

async function checkChatGptCurrentConversationTitle(page, expectedTitle = '') {
  const wanted = String(expectedTitle || '').trim();
  if (!wanted) return { ok: false, error: 'missing-expected-title' };
  const state = await evaluateOnCdpPage(page, `(() => {
    try {
      const wanted = ${JSON.stringify(wanted)};
      const m = location.pathname.match(/\/c\/([^/?#]+)/);
      const id = m ? m[1] : '';
      const norm = (value) => String(value || '').trim().replace(/\s+/g, ' ');
      const nodes = Array.from(document.querySelectorAll('nav a, aside a, [role="navigation"] a, a[href*="/c/"], nav [role="link"], aside [role="link"], nav li, aside li, nav div, aside div'));
      const candidates = nodes.map((node) => {
        const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
        const href = node.href || (node.getAttribute ? node.getAttribute('href') : '') || '';
        const text = norm(node.innerText || node.textContent || '');
        const cls = String(node.className || '');
        const current = node.getAttribute ? (node.getAttribute('aria-current') || node.getAttribute('aria-selected') || '') : '';
        return { href, rect, text, cls, current };
      }).filter((item) => item.text && item.rect && item.rect.width > 40 && item.rect.height > 12 && item.rect.x < 240 && item.rect.y > 220);
      const hrefItem = candidates.find((item) => id && item.href.indexOf('/c/' + id) >= 0);
      const activeItem = candidates.find((item) => /page|true|active|selected/i.test(String(item.current) + ' ' + item.cls));
      const exactItem = candidates.find((item) => norm(item.text) === norm(wanted));
      const item = hrefItem || activeItem || exactItem || null;
      const currentTitle = norm(item && item.text ? item.text : document.title || '');
      const ok = norm(currentTitle) === norm(wanted) || Boolean(exactItem);
      return { ok, currentTitle, wanted: norm(wanted), mode: hrefItem ? 'href' : activeItem ? 'active' : exactItem ? 'exact' : 'title', documentTitle: document.title, candidateCount: candidates.length, path: location.pathname };
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : String(error), path: location.pathname };
    }
  })()`).catch((error) => ({ ok: false, error: error.message }));
  return state;
}

function getChatTitleStableKey(pathname = '', title = '') {
  const id = String(pathname || '').match(/\/c\/([^/?#]+)/)?.[1] || String(pathname || '');
  return `${id}::${String(title || '').trim().toLowerCase()}`;
}

function markChatTitleStable(pathname = '', title = '', ok = false) {
  const key = getChatTitleStableKey(pathname, title);
  const next = ok ? (chatTitleStableChecks.get(key) || 0) + 1 : 0;
  chatTitleStableChecks.set(key, next);
  return next;
}

function isChatTitleStable(pathname = '', title = '') {
  return (chatTitleStableChecks.get(getChatTitleStableKey(pathname, title)) || 0) >= 3;
}

async function renameChatGptCurrentConversationUntilTitle(page, title = '', { sceneId = '', timeoutMs = 60000, waitForRecent = true, maxAttempts = 2, stableTarget = 2 } = {}) {
  const wanted = String(title || '').trim();
  if (!wanted) return { ok: false, error: 'missing-title' };
  const currentPath = await evaluateOnCdpPage(page, `location.pathname`).catch(() => '');
  if (!String(currentPath || '').startsWith('/c/')) return { ok: false, error: 'not-in-conversation', path: currentPath };
  if (isChatTitleStable(currentPath, wanted)) return { ok: true, skipped: true, stableChecks: stableTarget, title: wanted, path: currentPath };
  if (waitForRecent) {
    const recentsReady = await waitForChatGptRecentItem(page, currentPath, sceneId);
    await appendAppLog(null, { source: 'main', kind: recentsReady?.ok ? 'running' : 'error', text: `Scene ${sceneId}: Recents ready before rename: ${recentsReady?.ok ? recentsReady.text || recentsReady.mode : recentsReady?.error || 'not-ready'}`, details: recentsReady });
    if (!recentsReady?.ok) return { ok: false, error: recentsReady?.error || 'recents-not-ready', recentsReady };
  }
  const renameDeadline = Date.now() + timeoutMs;
  let renameAttempt = 0;
  let renameResult = null;
  while (Date.now() < renameDeadline && renameAttempt < maxAttempts) {
    const titleState = await checkChatGptCurrentConversationTitle(page, wanted).catch((error) => ({ ok: false, error: error.message }));
    if (titleState?.ok) {
      const stableChecks = markChatTitleStable(titleState.path || currentPath, wanted, true);
      if (stableChecks >= stableTarget) return { ok: true, alreadyNamed: true, title: wanted, attempts: renameAttempt, stableChecks, titleState };
      await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: ChatGPT title Ä‘Ãºng ${stableChecks}/${stableTarget}, check thÃªm tá»‘i Ä‘a ${stableTarget} láº§n rá»“i dá»«ng.`, details: titleState });
      await sleep(500);
      continue;
    }
    markChatTitleStable(titleState?.path || currentPath, wanted, false);
    renameAttempt += 1;
    await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: ChatGPT rename attempt ${renameAttempt}/${maxAttempts}, current="${titleState?.currentTitle || ''}" target="${wanted}"`, details: titleState });
    renameResult = await renameChatGptCurrentConversation(null, wanted).catch((error) => ({ ok: false, error: error.message }));
    await appendAppLog(null, { source: 'main', kind: renameResult?.ok ? 'running' : 'error', text: `Scene ${sceneId}: ChatGPT rename attempt ${renameAttempt}/${maxAttempts} ${renameResult?.ok ? 'sent' : renameResult?.error || 'failed'}`, details: renameResult });
    await sleep(1800);
    const verifyState = await checkChatGptCurrentConversationTitle(page, wanted).catch((error) => ({ ok: false, error: error.message }));
    if (verifyState?.ok) {
      const stableChecks = markChatTitleStable(verifyState.path || currentPath, wanted, true);
      if (stableChecks >= stableTarget) return { ok: true, title: wanted, attempts: renameAttempt, stableChecks, verifyState };
      await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: rename Ä‘Ã£ khá»›p ${stableChecks}/${stableTarget}, verify thÃªm ngáº¯n rá»“i dá»«ng.`, details: verifyState });
      await sleep(500);
      continue;
    }
    markChatTitleStable(verifyState?.path || currentPath, wanted, false);
    if (renameAttempt >= maxAttempts) break;
    await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: rename chÆ°a khá»›p, retry tiáº¿p. current="${verifyState?.currentTitle || ''}"`, details: verifyState });
    await sleep(1000);
  }
  return { ok: false, error: renameResult?.error || 'rename-max-attempts-or-timeout', title: wanted, attempts: renameAttempt, maxAttempts, lastResult: renameResult };
}

async function renameChatGptCurrentConversation(_event, title = '') {
  const wanted = String(title || '').trim();
  if (!wanted) return { ok: false, error: 'Missing title.' };
  const page = await getCdpPage('chatgpt', false, { bringToFront: true });
  const currentLocation = await evaluateOnCdpPage(page, `({ href: location.href, path: location.pathname, title: document.title })`).catch((error) => ({ error: error.message }));
  await appendAppLog(null, { source: 'main', kind: 'running', text: `ChatGPT rename start: target="${wanted}" path=${currentLocation?.path || ''}`, details: currentLocation });
  if (!String(currentLocation?.path || '').startsWith('/c/')) {
    await appendAppLog(null, { source: 'main', kind: 'running', text: 'ChatGPT rename: chÆ°a á»Ÿ conversation /c/..., má»Ÿ trang chat má»›i trÆ°á»›c.', details: currentLocation });
    await page.Page.navigate({ url: 'https://chatgpt.com/' }).catch((error) => appendAppLog(null, { source: 'main', kind: 'error', text: `ChatGPT navigate root failed: ${error.message}` }));
    await waitForCdpLoad(page).catch(() => null);
    await sleep(1800);
    const afterNavigate = await evaluateOnCdpPage(page, `({ href: location.href, path: location.pathname, title: document.title })`).catch((error) => ({ error: error.message }));
    await appendAppLog(null, { source: 'main', kind: 'ok', text: `ChatGPT rename: Ä‘Ã£ má»Ÿ trang chat root, chá» prompt Ä‘áº§u tiÃªn táº¡o conversation. path=${afterNavigate?.path || ''}`, details: afterNavigate });
    return { ok: true, title: wanted, skippedRename: true, reason: 'new-chat-will-auto-title-after-first-message', location: afterNavigate };
  }
  var stateExpression = `(function(){var m=location.pathname.match(/\\/c\\/([^/?#]+)/);var id=m?m[1]:'';if(!id)return{ok:false,error:'missing-conversation-id'};var nodes=Array.prototype.slice.call(document.querySelectorAll('nav a, aside a, [role="navigation"] a, a[href*="/c/"], nav [role="link"], aside [role="link"], nav li, aside li, nav div, aside div'));var items=[];for(var i=0;i<nodes.length;i++){var n=nodes[i];var r=n.getBoundingClientRect?n.getBoundingClientRect():null;var h=n.href||(n.getAttribute?n.getAttribute('href'):'')||'';var t=String(n.innerText||n.textContent||'').trim();var c=String(n.className||'');var cur=n.getAttribute?(n.getAttribute('aria-current')||n.getAttribute('aria-selected')||''):'';if(t&&r&&r.width>40&&r.height>12&&r.x<220&&r.y>250)items.push({node:n,href:h,rect:r,text:t,cls:c,current:cur});}var a=null;for(var j=0;j<items.length;j++){if(items[j].href.indexOf('/c/'+id)>=0){a=items[j];break;}}if(!a){for(var k=0;k<items.length;k++){if(/page|true|active|selected/i.test(String(items[k].current)+' '+items[k].cls)){a=items[k];break;}}}if(!a){items.sort(function(x,y){return x.rect.y-y.rect.y;});a=items[0];}if(!a)return{ok:false,error:'no-recent-item',count:items.length};a.node.scrollIntoView({block:'center'});var row=a.node.closest('li, div[data-testid], div')||a.node;var rr=(row.getBoundingClientRect&&row.getBoundingClientRect())||a.rect;var box={x:Math.max(rr.x+40,Math.min(154,rr.right-18)),y:rr.y+rr.height/2};return{ok:true,text:a.text,box:box,activeBox:{x:rr.x,y:rr.y,w:rr.width,h:rr.height},mode:a.href.indexOf('/c/'+id)>=0?'href':'fallback',candidateCount:items.length};})()`;
  var state = await evaluateOnCdpPage(page, stateExpression).catch((error) => ({ ok: false, error: error.message, expressionHead: stateExpression.slice(0, 240) }));
  if (!state?.ok) return state;
  await appendAppLog(null, { source: 'main', kind: 'running', text: `ChatGPT rename: selected recent item "${state.text}" mode=${state.mode || ''}`, details: state });
  var openMenuExpression = `(function(){var id=(location.pathname.match(/\\/c\\/([^/?#]+)/)||[])[1]||'';var nodes=Array.prototype.slice.call(document.querySelectorAll('nav a, aside a, [role="navigation"] a, a[href*="/c/"], nav [role="link"], aside [role="link"], nav li, aside li, nav div, aside div'));var items=[];for(var i=0;i<nodes.length;i++){var n=nodes[i];var r=n.getBoundingClientRect?n.getBoundingClientRect():null;var h=n.href||(n.getAttribute?n.getAttribute('href'):'')||'';var t=String(n.innerText||n.textContent||'').trim();if(t&&r&&r.width>40&&r.height>12&&r.x<240&&r.y>230)items.push({node:n,href:h,text:t,rect:r});}var active=null;for(var j=0;j<items.length;j++){if(items[j].href.indexOf('/c/'+id)>=0){active=items[j];break;}}if(!active){for(var k=0;k<items.length;k++){if(items[k].text===${JSON.stringify(state.text)}){active=items[k];break;}}}if(!active)return{ok:false,error:'no-active-row-for-menu',id:id,count:items.length,first:items.slice(0,8).map(function(it){return{text:it.text,href:it.href,box:{x:it.rect.x,y:it.rect.y,w:it.rect.width,h:it.rect.height}};})};active.node.scrollIntoView({block:'center'});var row=active.node.closest('li, [data-testid], div')||active.node;var rr=(row.getBoundingClientRect&&row.getBoundingClientRect())||active.rect;var cx=Math.min(rr.right-12,156);var cy=rr.y+rr.height/2;var evs=['pointerover','mouseover','mouseenter','pointermove','mousemove'];for(var e=0;e<evs.length;e++){row.dispatchEvent(new MouseEvent(evs[e],{bubbles:true,clientX:cx,clientY:cy}));active.node.dispatchEvent(new MouseEvent(evs[e],{bubbles:true,clientX:cx,clientY:cy}));}var buttons=Array.prototype.slice.call(row.querySelectorAll('button,[role="button"]'));var btns=[];for(var b=0;b<buttons.length;b++){var br=buttons[b].getBoundingClientRect?buttons[b].getBoundingClientRect():null;var bt=String(buttons[b].innerText||buttons[b].textContent||'').trim();var ba=String(buttons[b].getAttribute?buttons[b].getAttribute('aria-label')||'':'');if(br&&br.width>4&&br.height>4)btns.push({node:buttons[b],text:bt,aria:ba,rect:br});}var menuButton=null;for(var q=0;q<btns.length;q++){if(/more|options|menu|conversation options|â‹¯|â€¦/i.test(btns[q].text+' '+btns[q].aria)){menuButton=btns[q];break;}}if(!menuButton&&btns.length){btns.sort(function(a,b){return b.rect.x-a.rect.x;});menuButton=btns[0];}if(menuButton){menuButton.node.click();return{ok:true,mode:'button-click',activeText:active.text,rowBox:{x:rr.x,y:rr.y,w:rr.width,h:rr.height},clicked:{text:menuButton.text,aria:menuButton.aria,box:{x:menuButton.rect.x,y:menuButton.rect.y,w:menuButton.rect.width,h:menuButton.rect.height}},buttons:btns.slice(0,8).map(function(it){return{text:it.text,aria:it.aria,box:{x:it.rect.x,y:it.rect.y,w:it.rect.width,h:it.rect.height}};})};}var target=document.elementFromPoint(cx,cy);if(target){target.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:cx,clientY:cy}));return{ok:true,mode:'elementFromPoint-click',activeText:active.text,rowBox:{x:rr.x,y:rr.y,w:rr.width,h:rr.height},target:String(target.tagName||'')+' '+String(target.getAttribute?target.getAttribute('aria-label')||'':'')+' '+String(target.textContent||'').trim().slice(0,80),buttons:[]};}return{ok:false,error:'row-has-no-menu-button-and-no-target',row:{text:active.text,box:{x:rr.x,y:rr.y,w:rr.width,h:rr.height}},buttons:[]};})()`;
  var openedMenu = await evaluateOnCdpPage(page, openMenuExpression).catch((error) => ({ ok: false, error: error.message, expressionHead: openMenuExpression.slice(0, 240) }));
  await appendAppLog(null, { source: 'main', kind: openedMenu?.ok ? 'running' : 'error', text: `ChatGPT rename open menu: ${openedMenu?.ok ? openedMenu.mode || 'clicked menu button' : openedMenu?.error || 'failed'}`, details: openedMenu });
  if (!openedMenu?.ok) return { ok: false, error: openedMenu?.error || 'KhÃ´ng má»Ÿ Ä‘Æ°á»£c menu chat.', details: openedMenu, selectedItem: state };
  await sleep(1800);
  var renameMenuExpression = `(function(){var nodes=Array.prototype.slice.call(document.querySelectorAll('[role="menuitem"], [cmdk-item], button, div'));var items=[];for(var i=0;i<nodes.length;i++){var n=nodes[i];var r=n.getBoundingClientRect?n.getBoundingClientRect():null;var t=String(n.innerText||n.textContent||'').trim();if(t&&r&&r.width>20&&r.height>10)items.push({node:n,text:t,rect:r});}var rename=null;for(var j=0;j<items.length;j++){if(/^rename$/i.test(items[j].text)||/^Ä‘á»•i tÃªn$/i.test(items[j].text)){rename=items[j];break;}}if(!rename){for(var k=0;k<items.length;k++){if(/(^|\\n)rename(\\n|$)|(^|\\n)Ä‘á»•i tÃªn(\\n|$)/i.test(items[k].text)){var kids=Array.prototype.slice.call(items[k].node.querySelectorAll('[role="menuitem"],button,div'));for(var q=0;q<kids.length;q++){var kr=kids[q].getBoundingClientRect?kids[q].getBoundingClientRect():null;var kt=String(kids[q].innerText||kids[q].textContent||'').trim();if(kr&&(/^rename$/i.test(kt)||/^Ä‘á»•i tÃªn$/i.test(kt))){rename={node:kids[q],text:kt,rect:kr};break;}}if(rename)break;}}}if(!rename)return{ok:false,error:'no-exact-rename-menuitem',items:items.slice(0,20).map(function(it){return{text:it.text,box:{x:it.rect.x,y:it.rect.y,w:it.rect.width,h:it.rect.height}};})};rename.node.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,clientX:rename.rect.x+rename.rect.width/2,clientY:rename.rect.y+rename.rect.height/2}));rename.node.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:rename.rect.x+rename.rect.width/2,clientY:rename.rect.y+rename.rect.height/2}));rename.node.click();rename.node.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,clientX:rename.rect.x+rename.rect.width/2,clientY:rename.rect.y+rename.rect.height/2}));return{ok:true,text:rename.text,mode:'exact-menuitem-click',box:{x:rename.rect.x,y:rename.rect.y,w:rename.rect.width,h:rename.rect.height}};})()`;
  var menu = await evaluateOnCdpPage(page, renameMenuExpression).catch((error) => ({ ok: false, error: error.message, expressionHead: renameMenuExpression.slice(0, 240) }));
  if (!menu?.ok) {
    await appendAppLog(null, { source: 'main', kind: 'error', text: `ChatGPT rename menu DOM failed: ${menu?.error || 'unknown'}, bá» qua Ä‘á»ƒ trÃ¡nh nháº­p tÃªn project vÃ o Ã´ prompt.`, details: menu });
    return { ok: false, error: menu?.error || 'KhÃ´ng tháº¥y menu Rename.', details: menu, selectedItem: state };
  }
  await appendAppLog(null, { source: 'main', kind: 'running', text: `ChatGPT rename: Ä‘Ã£ click Ä‘Ãºng Rename, chá» input title="${wanted}"`, details: menu });
  await sleep(1200);
  const focusState = await evaluateOnCdpPage(page, `(() => {
    const el = document.activeElement;
    const text = String(el?.innerText || el?.value || el?.textContent || '').slice(0, 120);
    const id = String(el?.id || '');
    const tag = String(el?.tagName || '');
    const aria = String(el?.getAttribute?.('aria-label') || '');
    const placeholder = String(el?.getAttribute?.('placeholder') || '');
    const modalText = String(document.querySelector('[role="dialog"], [data-radix-dialog-content]')?.innerText || '').slice(0, 300);
    const isComposer = id === 'prompt-textarea' || /message|prompt|ask anything/i.test(aria + ' ' + placeholder);
    const isRename = !isComposer && (/rename|Ä‘á»•i tÃªn|name/i.test(aria + ' ' + placeholder + ' ' + modalText) || tag === 'INPUT' || tag === 'TEXTAREA');
    return { tag, id, aria, placeholder, text, modalText, isComposer, isRename };
  })()`).catch((error) => ({ error: error.message }));
  await appendAppLog(null, { source: 'main', kind: focusState?.isRename ? 'running' : 'error', text: `ChatGPT rename focus before typing: ${focusState?.tag || ''}#${focusState?.id || ''}`, details: focusState });
  if (!focusState?.isRename) return { ok: false, error: 'Rename input khÃ´ng má»Ÿ; khÃ´ng nháº­p title Ä‘á»ƒ trÃ¡nh vÃ o composer.', focusState, selectedItem: state, menu };
  await page.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17 }).catch(() => null);
  await page.Input.dispatchKeyEvent({ type: 'keyDown', key: 'A', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 }).catch(() => null);
  await page.Input.dispatchKeyEvent({ type: 'keyUp', key: 'A', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 }).catch(() => null);
  await page.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17 }).catch(() => null);
  await page.Input.insertText({ text: wanted }).catch(() => null);
  await page.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }).catch(() => null);
  await page.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }).catch(() => null);
  await sleep(1800);
  const verifyTitle = await evaluateOnCdpPage(page, `({ title: document.title, text: document.body.innerText.slice(0, 2000) })`).catch((error) => ({ error: error.message }));
  const expectedTitle = wanted;
  const verified = String(verifyTitle?.title || '').includes(expectedTitle) || String(verifyTitle?.text || '').includes(expectedTitle);
  return { ok: verified, title: wanted, previousTitle: state.text, verified, verifyTitle };
}

async function waitForChatGptImageOrRetry(client, existingUrls = [], prompt, sceneDir, sceneId) {
  const known = new Set(existingUrls);
  const maxAttempts = 3;
  const thinkingStallMs = 240000;
  const preparingImageStallMs = 900000;
  let lastSnapshot = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const attemptStartedAt = Date.now();
    let sawGenerating = false;
    let readyTicks = 0;
    let lastLogAt = 0;
    const resendImagePrompt = async (reason, snapshot) => {
      await fs.writeFile(
        path.join(sceneDir, `scene_${String(sceneId).padStart(3, '0')}_chatgpt_image_retry_${attempt}_${reason}.json`),
        JSON.stringify({ reason, snapshot, attempt, elapsedMs: Date.now() - attemptStartedAt }, null, 2),
        'utf8',
      ).catch(() => null);
      await notifyRenderer('chatgpt-image-retry', `Scene ${sceneId}: ChatGPT ${reason === 'thinking-stall' ? 'káº¹t Thinking quÃ¡ lÃ¢u' : 'khÃ´ng tráº£ áº£nh'}, tool sáº½ dá»«ng lÆ°á»£t cÅ© vÃ  gá»­i láº¡i NV1.`, { sceneId, attempt, reason });
      if (attempt >= maxAttempts) {
        throw new Error(`ChatGPT khÃ´ng tráº£ áº£nh sau ${maxAttempts} láº§n gá»­i NV1 (${reason}).`);
      }
      await client.Page.reload({ ignoreCache: true }).catch(() => null);
      await waitForCdpLoad(client).catch(() => null);
      await sleep(1800);
      const stopped = await stopChatGptAndWaitForIdle(client, 45000).catch((error) => ({ ok: false, error: error.message }));
      await appendAppLog(null, { source: 'main', kind: stopped?.ok ? 'running' : 'error', text: `Scene ${sceneId}: ChatGPT F5 â†’ stop trÆ°á»›c retry NV1 (${reason}): ${stopped?.ok ? stopped.mode : stopped?.error || 'not-found'}`, details: stopped });
      if (!stopped?.ok) throw new Error(`ChatGPT vẫn đang tạo/chưa dừng được NV1 (${stopped?.error || 'stop failed'}), không gửi lại để tránh spam composer.`);
      await sleep(1200);
      const retryPrompt = `${prompt}\n\nLáº¦N Gá»¬I Láº I ${attempt + 1}: Láº§n trÆ°á»›c ChatGPT bá»‹ káº¹t hoáº·c khÃ´ng tráº£ áº£nh. Báº¯t buá»™c táº¡o/render 1 áº£nh ngay trong chat, khÃ´ng tráº£ lá»i text.`;
      await evaluateOnCdpPage(client, `(${prepareChatGptCreateImageScript.toString()})()`).catch(() => null);
      await sleep(800);
      const resent = await sendPromptViaCdpInput(client, retryPrompt, { chatGptIdleTimeoutMs: 45000 });
      if (!resent.ok) throw new Error(resent.error || 'KhÃ´ng gá»­i láº¡i Ä‘Æ°á»£c image prompt vÃ o ChatGPT.');
      await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: Ä‘Ã£ gá»­i láº¡i NV1 láº§n ${attempt + 1}/${maxAttempts} sau ${reason}.`, details: { resent } });
    };
    while (Date.now() - attemptStartedAt < 360000) {
      await sleep(3000);
      const snapshot = await evaluateOnCdpPage(client, `(${readChatGptImageStateScript.toString()})()`);
      lastSnapshot = snapshot;
      if (snapshot?.loggedOut) throw new Error(loginRequiredMessage('chatgpt', snapshot.logoutReason || 'ChatGPT logged out while waiting for NV1 image'));
      let imageUrl = (snapshot?.urls || []).find((url) => !known.has(url));
      if (!imageUrl && snapshot?.voiceReady && !snapshot?.stopButton && !snapshot?.generating && !snapshot?.preparingImage && snapshot?.visibleImageBoxes?.length) {
        imageUrl = `chatgpt-custom-box-y${snapshot.visibleImageBoxes[0].y}`;
      }
      const isCustomBoxRef = String(imageUrl || '').startsWith('chatgpt-custom-box-y');
      const composerLooksReady = snapshot?.voiceReady && !snapshot?.stopButton && !snapshot?.generating && !snapshot?.preparingImage;
      if (composerLooksReady) readyTicks += 1;
      else readyTicks = 0;
      if (imageUrl) {
        await appendAppLog(null, { source: 'main', kind: 'ok', text: `Scene ${sceneId}: thÃ¡ÂºÂ¥y Ã¡ÂºÂ£nh mÃ¡Â»â€ºi tÃ¡Â»Â« ChatGPT, lÆ°u ngay thay vÃ¬ retry NV1.`, details: { imageUrl, readyTicks, voiceReady: snapshot?.voiceReady, stopButton: snapshot?.stopButton, generating: snapshot?.generating, preparingImage: snapshot?.preparingImage } });
        return imageUrl;
        if (false && (readyTicks >= 1 || snapshot?.voiceReady)) {
          await appendAppLog(null, { source: 'main', kind: 'ok', text: `Scene ${sceneId}: tháº¥y áº£nh má»›i tá»« ChatGPT, báº¯t Ä‘áº§u lÆ°u áº£nh.`, details: { imageUrl, readyTicks, voiceReady: snapshot?.voiceReady, stopButton: snapshot?.stopButton, generating: snapshot?.generating, preparingImage: snapshot?.preparingImage } });
          return imageUrl;
        }
        if (Date.now() - lastLogAt > 8000) {
          lastLogAt = Date.now();
          await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: Ä‘Ã£ tháº¥y preview/URL áº£nh, chá» generation dá»«ng trÆ°á»›c khi lÆ°u.`, details: { readyTicks, voiceReady: snapshot?.voiceReady, stopButton: snapshot?.stopButton, generating: snapshot?.generating, preparingImage: snapshot?.preparingImage, urlCount: snapshot?.urls?.length || 0 } });
        }
      }
      if (snapshot?.generating || snapshot?.preparingImage) {
        sawGenerating = true;
        readyTicks = 0;
        if (Date.now() - lastLogAt > 15000) {
          lastLogAt = Date.now();
          await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: Ä‘ang chá» ChatGPT hoÃ n táº¥t NV1/táº¡o áº£nh (${snapshot?.preparingImage ? 'preparing-image' : 'thinking'}).`, details: { mode: snapshot?.assistantMode, urls: snapshot?.urls?.length || 0, assistantCount: snapshot?.assistantCount || 0, elapsedMs: Date.now() - attemptStartedAt } });
        }
        const stallLimitMs = snapshot?.preparingImage ? preparingImageStallMs : thinkingStallMs;
        if (Date.now() - attemptStartedAt > stallLimitMs) {
          await resendImagePrompt(snapshot?.preparingImage ? 'preparing-image-stall' : 'thinking-stall', snapshot);
          break;
        }
        continue;
      }
      const composerReadyForRetry = snapshot?.voiceReady;
      const textOnlyAnswer = Number(snapshot?.assistantCount || 0) > 0
        && String(snapshot?.latestAssistantText || '').length > 20
        && !/preparing image|creating image|generating image|Ä‘ang táº¡o áº£nh|thinking/i.test(String(snapshot?.latestAssistantText || ''))
        && !looksLikeCollapsedUserPrompt(snapshot?.latestAssistantText, 'image');
      if (textOnlyAnswer && isChatGptLimitText(snapshot?.latestAssistantText)) {
        await notifyRenderer('chatgpt-limit-stop', `Scene ${sceneId}: ChatGPT bÃ¡o limit/háº¡n má»©c. Báº¥m OK Ä‘á»ƒ tool dá»«ng háº³n; Ä‘á»•i account hoáº·c chá» reset rá»“i báº¥m Start láº¡i thá»§ cÃ´ng.`, { sceneId, text: snapshot?.latestAssistantText });
        throw new Error('ChatGPT bá»‹ limit/háº¡n má»©c. Tool Ä‘Ã£ dá»«ng theo yÃªu cáº§u, khÃ´ng tá»± gá»­i láº¡i.');
      }
      if (composerReadyForRetry) readyTicks += 1;
      if (((sawGenerating && composerReadyForRetry && readyTicks >= 4) || textOnlyAnswer)) {
        await resendImagePrompt(textOnlyAnswer ? 'text-only-answer' : 'idle-no-image-after-generating', snapshot);
        break;
      }
    }
    if (attempt >= maxAttempts) break;
  }
  await fs.writeFile(path.join(sceneDir, `scene_${String(sceneId).padStart(3, '0')}_chatgpt_image_wait_failed.json`), JSON.stringify({ lastSnapshot, existingUrlCount: known.size }, null, 2), 'utf8').catch(() => null);
  throw new Error('Háº¿t thá»i gian chá» ChatGPT táº¡o áº£nh hoáº·c khÃ´ng detect Ä‘Æ°á»£c áº£nh má»›i.');
}

function looksLikeCollapsedUserPrompt(text = '', kind = '') {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return false;
  if (/show more|show less/i.test(value) && /---\s*scene|scene\s*\d+\s*hiá»‡n táº¡i|nhiá»‡m\s*vá»¥\s*[12]/i.test(value)) return true;
  if (kind === 'image' && /---\s*scene\s*\d+\s*hiá»‡n táº¡i|nhiá»‡m\s*vá»¥\s*1|táº¡o\s*1\s*áº£nh|táº¡o áº£nh/i.test(value) && !/generated image|here is|áº£nh Ä‘Ã£ Ä‘Æ°á»£c táº¡o/i.test(value)) return true;
  if (kind === 'motion' && /nhiá»‡m\s*vá»¥\s*2|dá»±a trÃªn áº£nh keyframe|motion prompt/i.test(value) && /show more|show less|Ä‘oáº¡n Ä‘áº§u scene/i.test(value)) return true;
  return false;
}

function isChatGptLimitText(text = '') {
  return /limit|usage cap|rate limit|too many requests|try again later|come back later|you'?ve reached|quota|giá»›i háº¡n|háº¡n má»©c|quÃ¡ nhiá»u yÃªu cáº§u/i.test(String(text || ''));
}

async function waitForNewVideoUrl(client, existingUrls = [], options = {}) {
  const known = new Set(existingUrls);
  const provider = options.provider || 'grok';
  const sceneId = options.sceneId || '';
  const startedAt = Date.now();
  let retryCount = 0;
  let notifiedLimit = false;
  let notifiedPolicy = false;
  while (Date.now() - startedAt < 600000) {
    await sleep(5000);
    if (provider === 'grok') {
      const grokState = await evaluateOnCdpPage(client, `(${detectGrokGenerationProblemScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
      if (grokState?.kind === 'login-required') throw new Error(loginRequiredMessage('grok', grokState.reason || 'Grok logged out while generating video'));
      if (grokState?.kind === 'unable-finish' && retryCount < 3) {
        retryCount += 1;
        await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: Grok unable to finish replying, tá»± báº¥m Retry láº§n ${retryCount}/3.`, details: grokState });
        await clickGrokRetryButton(client, grokState).catch(() => null);
        await sleep(8000);
        continue;
      }
      if (grokState?.kind === 'content-policy') {
        if (!notifiedPolicy) {
          notifiedPolicy = true;
          await notifyRenderer('grok-content-policy', `Scene ${sceneId}: Grok cháº·n content policy. Tool sáº½ tá»± sá»­a prompt an toÃ n hÆ¡n vÃ  gá»­i láº¡i / Ä‘á»•i canvas má»›i náº¿u cáº§n.`, grokState);
        }
        if (retryCount < 3 && options.sceneDir && options.imagePath && options.motionPrompt) {
          retryCount += 1;
          const recovered = await recoverGrokAfterContentPolicy(client, { ...options, retryCount }).catch((error) => ({ ok: false, error: error.message }));
          await appendAppLog(null, { source: 'main', kind: recovered?.ok ? 'ok' : 'error', text: `Scene ${sceneId}: recover content policy láº§n ${retryCount}/3: ${recovered?.ok ? 'ok' : recovered?.error}`, details: recovered });
          await sleep(10000);
          continue;
        }
        throw new Error('Grok cháº·n content policy sau 3 láº§n tá»± sá»­a prompt/Ä‘á»•i canvas. Cáº§n sá»­a scene/prompt thá»§ cÃ´ng.');
      }
      if (grokState?.kind === 'limit') {
        await notifyRenderer('grok-limit-stop', `Scene ${sceneId}: Grok bÃ¡o limit/lá»—i táº¡o video. Báº¥m OK Ä‘á»ƒ tool dá»«ng háº³n; Ä‘á»•i account/canvas hoáº·c xá»­ lÃ½ trÃªn Grok rá»“i báº¥m Start láº¡i thá»§ cÃ´ng.`, grokState);
        await appendAppLog(null, { source: 'main', kind: 'error', text: `Scene ${sceneId}: Grok limit/generation error detected; stopped without retry.`, details: grokState });
        throw new Error('Grok bÃ¡o limit/lá»—i táº¡o video. Tool Ä‘Ã£ dá»«ng theo yÃªu cáº§u, khÃ´ng tá»± gá»­i láº¡i.');
      }
    }
    const snapshot = await evaluateOnCdpPage(client, `(${collectVideoUrlsScript.toString()})()`);
    const videoUrl = (snapshot?.urls || []).find((url) => !known.has(url));
    if (videoUrl) return videoUrl;
  }
  throw new Error('Háº¿t thá»i gian chá» Grok táº¡o video hoáº·c khÃ´ng detect Ä‘Æ°á»£c video má»›i.');
}

async function downloadBrowserAsset(client, url, outputPath) {
  if (!url) throw new Error('URL asset rá»—ng.');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  if (url.startsWith('data:')) {
    const match = url.match(/^data:[^;]+;base64,(.+)$/);
    if (!match) throw new Error('Data URL khÃ´ng há»£p lá»‡.');
    await fs.writeFile(outputPath, Buffer.from(match[1], 'base64'));
    return outputPath;
  }

  const result = await evaluateOnCdpPage(client, `(${downloadAssetInPageScript.toString()})(${JSON.stringify(url)})`);
  if (!result?.ok) {
    throw new Error(result?.error || 'KhÃ´ng táº£i Ä‘Æ°á»£c asset trong browser context.');
  }
  await fs.writeFile(outputPath, Buffer.from(result.base64, 'base64'));
  return outputPath;
}

async function captureLatestImageElement(client, outputPath, expectedRef = '') {
  const target = await evaluateOnCdpPage(client, `(${getLatestImageBoxScript.toString()})(${JSON.stringify(expectedRef)})`);
  if (!target?.ok) {
    throw new Error(target?.error || 'KhÃ´ng tÃ¬m tháº¥y áº£nh má»›i Ä‘á»ƒ chá»¥p screenshot.');
  }
  const screenshot = await client.Page.captureScreenshot({
    format: 'png',
    clip: {
      x: Math.max(0, target.box.x),
      y: Math.max(0, target.box.y),
      width: Math.max(1, target.box.width),
      height: Math.max(1, target.box.height),
      scale: 1,
    },
    captureBeyondViewport: true,
  });
  await fs.writeFile(outputPath, Buffer.from(screenshot.data, 'base64'));
  return outputPath;
}

async function pathExists(filePath) {
  if (!filePath) return false;
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function checkAssetExists(_event, filePath) {
  return pathExists(filePath);
}

async function imageFileToDataUrl(imagePath) {
  const buffer = await fs.readFile(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function waitForGrokUploadedAsset(client, timeoutMs = 45000) {
  const started = Date.now();
  let last = null;
  let attempt = 0;
  while (Date.now() - started < timeoutMs) {
    attempt += 1;
    last = await evaluateOnCdpPage(client, `(${detectUploadedAssetScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
    if (last?.ok) return { ...last, attempt, waitedMs: Date.now() - started };
    await appendAppLog(null, { source: 'main', kind: 'running', text: `Grok: chá» áº£nh add vÃ o canvas (${Math.round((Date.now() - started) / 1000)}s)...`, details: last });
    await sleep(2500);
  }
  return { ok: false, error: last?.error || `Háº¿t ${Math.round(timeoutMs / 1000)}s váº«n chÆ°a tháº¥y áº£nh trong Grok canvas.`, last };
}

async function clickGrokUploadAndChooseFile(client, filePath) {
  await client.Page.setInterceptFileChooserDialog({ enabled: true }).catch(() => null);
  let resolved = false;
  const chooserPromise = new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!resolved) resolve({ ok: false, error: 'Timeout chá» Grok má»Ÿ file chooser.' });
    }, 8000);
    const handler = async (event) => {
      resolved = true;
      clearTimeout(timer);
      try {
        await client.DOM.setFileInputFiles({ backendNodeId: event.backendNodeId, files: [filePath] });
        resolve({ ok: true, mode: 'fileChooserOpened', backendNodeId: event.backendNodeId, filePath });
      } catch (error) {
        resolve({ ok: false, error: error.message, event });
      }
    };
    client.Page.fileChooserOpened(handler);
  });
  const uploadClick = await evaluateOnCdpPage(client, `(${clickGrokCanvasUploadImageScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
  if (!uploadClick?.ok) {
    await client.Page.setInterceptFileChooserDialog({ enabled: false }).catch(() => null);
    return { ok: false, error: uploadClick?.error || 'KhÃ´ng click Ä‘Æ°á»£c nÃºt Upload Image.', uploadClick };
  }
  await sleep(500);
  const menuClick = await evaluateOnCdpPage(client, `(${clickGrokUploadImageMenuItemScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
  await sleep(700);
  const directInput = await setFirstFileInput(client, filePath).catch((error) => ({ ok: false, error: error.message }));
  if (directInput?.ok) {
    await client.Page.setInterceptFileChooserDialog({ enabled: false }).catch(() => null);
    return { ...directInput, mode: 'direct-input-after-upload-menu', uploadClick, menuClick };
  }
  const result = await chooserPromise;
  await client.Page.setInterceptFileChooserDialog({ enabled: false }).catch(() => null);
  return { ...result, uploadClick, menuClick, directInput };
}

async function setFirstFileInput(client, filePath) {
  const handle = await client.DOM.getDocument();
  const selector = 'input[type="file"], input[accept], input[accept*="image"], input[accept*="video"], input[accept*="png"], input[accept*="jpg"], input[accept*="jpeg"], input[accept*="mp4"], input[accept*="webm"]';
  const query = await client.DOM.querySelector({ nodeId: handle.root.nodeId, selector }).catch(() => ({ nodeId: 0 }));
  if (!query?.nodeId) return { ok: false, error: 'KhÃ´ng tÃ¬m tháº¥y input file sau khi báº¥m Upload Image.' };
  await client.DOM.setFileInputFiles({ nodeId: query.nodeId, files: [filePath] });
  return { ok: true, nodeId: query.nodeId, filePath };
}

async function uploadFileViaCdp(client, filePath, provider = 'grok') {
  if (provider === 'grok') {
    await appendAppLog(null, { source: 'main', kind: 'running', text: 'Grok: click Ã´ nháº­p prompt Image rá»“i Ctrl+V áº£nh trá»±c tiáº¿p vÃ o composer.' });
    await pasteImageViaClipboard(client, filePath, 'composer');
    let accepted = await waitForGrokUploadedAsset(client, 22000);
    if (!accepted?.ok) {
      await appendAppLog(null, { source: 'main', kind: 'running', text: 'Grok chÆ°a nháº­n áº£nh trong Ã´ prompt, fallback click workspace rá»“i Ctrl+V.' });
      await pasteImageViaClipboard(client, filePath, 'workspace');
      accepted = await waitForGrokUploadedAsset(client, 18000);
    }
    if (!accepted?.ok) {
      await appendAppLog(null, { source: 'main', kind: 'running', text: 'Grok chÆ°a nháº­n Ctrl+V, thá»­ nÃºt Upload Image vÃ  tá»± chá»n file qua CDP.' });
      const fileSet = await clickGrokUploadAndChooseFile(client, filePath);
      await appendAppLog(null, { source: 'main', kind: fileSet?.ok ? 'ok' : 'error', text: `Grok Upload Image file chooser: ${fileSet?.ok ? 'Ä‘Ã£ chá»n file' : fileSet?.error || 'failed'}`, details: fileSet });
      if (fileSet?.ok) accepted = await waitForGrokUploadedAsset(client, 45000);
    }
    await appendAppLog(null, { source: 'main', kind: accepted?.ok ? 'ok' : 'error', text: `Káº¿t quáº£ add áº£nh vÃ o Grok prompt: ${accepted?.ok ? 'Ä‘Ã£ tháº¥y áº£nh, tiáº¿p tá»¥c gá»­i NV2' : accepted?.error || 'chÆ°a tháº¥y áº£nh'}`, details: accepted });
    return accepted?.ok ? { ok: true, uploaded: accepted, mode: 'grok-composer-image-paste' } : { ok: false, error: accepted?.error || 'Grok chÆ°a nháº­n áº£nh trong Ã´ prompt, khÃ´ng gá»­i NV2 Ä‘á»ƒ trÃ¡nh táº¡o sai.' };
  }

  const handle = await client.DOM.getDocument();
  let nodeId = null;
  try {
    const selector = provider === 'pixverse'
      ? 'input[type="file"], input[accept*="image"], input[accept*="png"], input[accept*="jpg"]'
      : 'input[type="file"]';
    const query = await client.DOM.querySelector({ nodeId: handle.root.nodeId, selector });
    nodeId = query.nodeId;
  } catch (_error) {
    nodeId = null;
  }

  const shouldOpenUploadMenu = !nodeId;
  if (shouldOpenUploadMenu) {
    const clicked = await evaluateOnCdpPage(client, `(${clickUploadButtonScript.toString()})(${JSON.stringify(provider)})`);
    await sleep(1400);
    const refreshed = await client.DOM.getDocument();
    const selector = provider === 'pixverse'
      ? 'input[type="file"], input[accept*="image"], input[accept*="png"], input[accept*="jpg"]'
      : 'input[type="file"]';
    const query = await client.DOM.querySelector({ nodeId: refreshed.root.nodeId, selector });
    nodeId = query.nodeId;
    if (!nodeId && !clicked?.ok) return { ok: false, error: clicked?.error || `KhÃ´ng tÃ¬m tháº¥y nÃºt upload áº£nh/file trong ${provider}.` };
  }

  if (!nodeId) return { ok: false, error: 'KhÃ´ng tÃ¬m tháº¥y input[type=file] sau khi báº¥m upload.' };
  await appendAppLog(null, { source: 'main', kind: 'running', text: `Upload áº£nh vÃ o ${provider}: setFileInputFiles ${filePath}` });
  await client.DOM.setFileInputFiles({ nodeId, files: [filePath] });
  await sleep(provider === 'pixverse' ? 4500 : 4500);
  let accepted = await evaluateOnCdpPage(client, `(${detectUploadedAssetScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
  if (provider === 'grok' && !accepted?.ok) {
    await appendAppLog(null, { source: 'main', kind: 'running', text: 'Grok chÆ°a nháº­n áº£nh qua input file, thá»­ fallback Ctrl+V tá»« clipboard.' });
    await pasteImageViaClipboard(client, filePath);
    await sleep(2500);
    accepted = await evaluateOnCdpPage(client, `(${detectUploadedAssetScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
  }
  await appendAppLog(null, { source: 'main', kind: accepted?.ok ? 'ok' : 'error', text: `Káº¿t quáº£ upload ${provider}: ${accepted?.ok ? 'Ä‘Ã£ nháº­n áº£nh' : accepted?.error || 'chÆ°a nháº­n áº£nh'}`, details: accepted });
  if (provider === 'grok' && !accepted?.ok) {
    return { ok: false, error: accepted?.error || 'Grok chÆ°a nháº­n áº£nh upload.' };
  }
  return { ok: true, uploaded: accepted };
}

async function pasteImageViaClipboard(client, imagePath, target = 'composer') {
  const image = nativeImage.createFromPath(imagePath);
  if (image.isEmpty()) throw new Error(`KhÃ´ng Ä‘á»c Ä‘Æ°á»£c áº£nh Ä‘á»ƒ paste clipboard: ${imagePath}`);
  clipboard.writeImage(image);
  if (target === 'workspace') {
    const focused = await evaluateOnCdpPage(client, `(${focusGrokWorkspaceScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
    await appendAppLog(null, { source: 'main', kind: focused?.ok ? 'ok' : 'running', text: `Grok workspace focus: ${focused?.ok ? focused.mode : focused?.error || 'fallback'}`, details: focused });
    if (focused?.point) {
      const { x, y } = focused.point;
      await client.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y, button: 'none' }).catch(() => null);
      await client.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 }).catch(() => null);
      await client.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }).catch(() => null);
    }
  } else {
    await evaluateOnCdpPage(client, `(${focusGrokComposerScript.toString()})()`).catch(() => null);
  }
  await sleep(300);
  await client.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17, nativeVirtualKeyCode: 17, modifiers: 2 }).catch(() => null);
  await client.Input.dispatchKeyEvent({ type: 'keyDown', key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86, nativeVirtualKeyCode: 86, modifiers: 2 }).catch(() => null);
  await client.Input.dispatchKeyEvent({ type: 'keyUp', key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86, nativeVirtualKeyCode: 86, modifiers: 2 }).catch(() => null);
  await client.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17, nativeVirtualKeyCode: 17, modifiers: 0 }).catch(() => null);
}

async function submitPixVersePrompt(client, prompt, config = {}) {
  await evaluateOnCdpPage(client, `(${preparePixVerseComposerScript.toString()})(${JSON.stringify(config)})`).catch(() => null);
  await sleep(500);
  const pasted = await evaluateOnCdpPage(client, `(${setPixVersePromptScript.toString()})(${JSON.stringify(prompt)})`);
  if (!pasted?.ok) return { ok: false, error: pasted?.error || 'KhÃ´ng paste Ä‘Æ°á»£c prompt vÃ o PixVerse.' };
  await sleep(800);
  const clicked = await evaluateOnCdpPage(client, `(${clickPixVerseCreateScript.toString()})()`);
  if (clicked?.ok && clicked.box) {
    const x = clicked.box.x + clicked.box.width / 2;
    const y = clicked.box.y + clicked.box.height / 2;
    await client.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y, button: 'none' }).catch(() => null);
    await client.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 }).catch(() => null);
    await client.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }).catch(() => null);
  }
  return clicked?.ok ? { ok: true, mode: 'pixverse-create', selector: clicked.selector } : { ok: false, error: clicked?.error || 'KhÃ´ng báº¥m Ä‘Æ°á»£c nÃºt Create PixVerse.' };
}

async function submitGrokVideoPrompt(client, prompt, config = {}) {
  const cleanup = await evaluateOnCdpPage(client, `(${dismissGrokConnectorsScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
  await appendAppLog(null, { source: 'main', kind: cleanup?.ok ? 'ok' : 'running', text: `Grok cleanup connectors: ${cleanup?.actions?.join(', ') || cleanup?.error || 'checked'}`, details: cleanup });
  const forcedMode = await evaluateOnCdpPage(client, `(${forceGrokVideoModeScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
  await appendAppLog(null, { source: 'main', kind: forcedMode?.ok ? 'ok' : 'running', text: `Grok video mode: ${forcedMode?.status || forcedMode?.error || 'checked'}`, details: forcedMode });
  await evaluateOnCdpPage(client, `(${dismissGrokConnectorsScript.toString()})()`).catch(() => null);
  const prepared = { ok: true, skipped: true, status: 'already-prepared-before-upload' };
  await appendAppLog(null, { source: 'main', kind: prepared?.ok ? 'ok' : 'running', text: `Grok config: ${prepared?.ok ? JSON.stringify(prepared.config || {}) : prepared?.error || 'khÃ´ng Ä‘á»c Ä‘Æ°á»£c'}`, details: prepared });
  await sleep(500);
  const focused = await evaluateOnCdpPage(client, `(${focusGrokComposerScript.toString()})()`);
  if (!focused?.ok) return { ok: false, error: focused?.error || 'KhÃ´ng focus Ä‘Æ°á»£c Ã´ nháº­p Grok.' };
  await sleep(250);
  await client.Input.insertText({ text: `\n${prompt}` });
  await sleep(800);
  let verified = await evaluateOnCdpPage(client, `(${getActiveComposerTextScript.toString()})()`).catch(() => ({ text: '' }));
  if (!verified?.text || !verified.text.includes(prompt.slice(0, Math.min(24, prompt.length)))) {
    const domSet = await evaluateOnCdpPage(client, `(${setGrokComposerTextScript.toString()})(${JSON.stringify(prompt)})`).catch((error) => ({ ok: false, error: error.message }));
    await appendAppLog(null, { source: 'main', kind: domSet?.ok ? 'ok' : 'running', text: `Fallback set composer Grok: ${domSet?.ok ? 'ok' : domSet?.error || 'fail'}`, details: domSet });
    await sleep(500);
    verified = await evaluateOnCdpPage(client, `(${getActiveComposerTextScript.toString()})()`).catch(() => ({ text: '' }));
  }
  await appendAppLog(null, { source: 'main', kind: verified?.text?.includes(prompt.slice(0, 24)) ? 'ok' : 'error', text: `Paste prompt Grok: verify ${verified?.text ? 'cÃ³ text' : 'trá»‘ng'}`, details: { selector: verified?.selector, expectedHead: prompt.slice(0, 180), actualHead: String(verified?.text || '').slice(0, 260) } });
  if (!verified?.text || !verified.text.includes(prompt.slice(0, Math.min(24, prompt.length)))) {
    return { ok: false, error: `Grok chÆ°a nháº­n Ä‘Ãºng motion prompt trong composer Ä‘ang focus. Text hiá»‡n táº¡i: ${String(verified?.text || '').slice(0, 160)}` };
  }
  const beforeSubmitState = await evaluateOnCdpPage(client, `(${captureGrokSubmitStateScript.toString()})()`).catch(() => null);
  const pressEnterToSubmit = async () => {
    await client.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }).catch(() => null);
    await client.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }).catch(() => null);
  };
  await pressEnterToSubmit();
  await sleep(1800);
  let started = await evaluateOnCdpPage(client, `(${detectGrokGeneratingStateScript.toString()})(${JSON.stringify(beforeSubmitState || {})})`).catch(() => null);
  if (started?.generating) {
    await appendAppLog(null, { source: 'main', kind: 'ok', text: `Grok Ä‘Ã£ báº¯t Ä‘áº§u cháº¡y báº±ng Enter (${started.mode}).`, details: started });
    return { ok: true, mode: 'grok-started-enter', selector: 'trusted-enter' };
  }
  if (focused?.box) {
    const x = focused.box.x + focused.box.w - 20;
    const y = focused.box.y + focused.box.h - 20;
    await client.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y, button: 'none' }).catch(() => null);
    await client.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 }).catch(() => null);
    await client.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }).catch(() => null);
    await sleep(2200);
    started = await evaluateOnCdpPage(client, `(${detectGrokGeneratingStateScript.toString()})(${JSON.stringify(beforeSubmitState || {})})`).catch(() => null);
    if (started?.generating) {
      await appendAppLog(null, { source: 'main', kind: 'ok', text: `Grok Ä‘Ã£ báº¯t Ä‘áº§u cháº¡y báº±ng click gÃ³c pháº£i Ã´ prompt (${started.mode}).`, details: { started, point: { x, y }, focused } });
      return { ok: true, mode: 'grok-started-composer-corner-click', selector: 'composer-bottom-right-arrow' };
    }
    await appendAppLog(null, { source: 'main', kind: 'running', text: 'Grok click trá»±c tiáº¿p nÃºt mÅ©i tÃªn theo tá»a Ä‘á»™ nhÆ°ng chÆ°a tháº¥y generating, thá»­ selector tiáº¿p.', details: { point: { x, y }, focused, started } });
  }
  const directSend = await evaluateOnCdpPage(client, `(${clickGrokBottomRightSendScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
  await appendAppLog(null, { source: 'main', kind: directSend?.ok ? 'running' : 'error', text: `Grok direct send hit-test: ${directSend?.ok ? directSend.mode || directSend.selector || 'clicked' : directSend?.error || 'failed'}`, details: directSend });
  if (directSend?.ok && directSend.box) {
    const x = directSend.box.x + directSend.box.width / 2;
    const y = directSend.box.y + directSend.box.height / 2;
    await client.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y, button: 'none' }).catch(() => null);
    await client.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 }).catch(() => null);
    await client.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }).catch(() => null);
    await sleep(2200);
    started = await evaluateOnCdpPage(client, `(${detectGrokGeneratingStateScript.toString()})(${JSON.stringify(beforeSubmitState || {})})`).catch(() => null);
    if (started?.generating) {
      await appendAppLog(null, { source: 'main', kind: 'ok', text: `Grok started by direct send (${started.mode}).`, details: { started, directSend } });
      return { ok: true, mode: 'grok-started-direct-send', selector: directSend.selector || directSend.mode };
    }
  }
  let clicked = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    clicked = await evaluateOnCdpPage(client, `(${clickGrokGenerateScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
    await appendAppLog(null, { source: 'main', kind: clicked?.ok ? 'running' : 'error', text: `Grok send selector attempt ${attempt}: ${clicked?.ok ? `candidate=${clicked.selector || 'unknown'}` : clicked?.error || 'failed'}`, details: clicked });
    if (clicked?.ok && clicked.box) {
      const x = clicked.box.x + clicked.box.width / 2;
      const y = clicked.box.y + clicked.box.height / 2;
      await appendAppLog(null, { source: 'main', kind: 'running', text: `Grok send mouse click attempt ${attempt} táº¡i (${Math.round(x)}, ${Math.round(y)}).`, details: { box: clicked.box, selector: clicked.selector } });
      await client.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y, button: 'none' }).catch(() => null);
      await client.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 }).catch(() => null);
      await client.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }).catch(() => null);
    }
    await sleep(1200);
    await pressEnterToSubmit();
    await sleep(1800);
    const generating = await evaluateOnCdpPage(client, `(${detectGrokGeneratingStateScript.toString()})(${JSON.stringify(beforeSubmitState || {})})`).catch(() => null);
    if (generating?.generating) {
      await appendAppLog(null, { source: 'main', kind: 'ok', text: `Grok Ä‘Ã£ báº¯t Ä‘áº§u cháº¡y (${generating.mode}).`, details: generating });
      return { ok: true, mode: `grok-started-attempt-${attempt}`, selector: clicked?.selector };
    }
    const afterClick = await evaluateOnCdpPage(client, `(${getComposerTextScript.toString()})()`).catch(() => ({ text: '' }));
    await appendAppLog(null, { source: 'main', kind: 'running', text: `Grok click/Enter attempt ${attempt}: chÆ°a tháº¥y Thinking/Stop.`, details: { clicked, generating, composerHead: String(afterClick?.text || '').slice(0, 120) } });
  }
  return { ok: false, error: clicked?.error || clicked?.selector || 'Prompt Ä‘Ã£ paste nhÆ°ng Grok chÆ°a gá»­i sau 3 láº§n báº¥m send.' };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function downloadAssetInPageScript(url) {
  return fetch(url, { credentials: 'include' })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.blob();
    })
    .then((blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = String(reader.result || '');
        const base64 = dataUrl.includes(',') ? dataUrl.split(',').pop() : '';
        resolve({ ok: Boolean(base64), base64, type: blob.type, size: blob.size });
      };
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    }))
    .catch((error) => ({ ok: false, error: error.message }));
}

function fillProviderLoginScript(provider, email, password) {
  const textOf = (node) => `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim();
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    const style = window.getComputedStyle?.(node);
    return rect && rect.width > 4 && rect.height > 4 && rect.bottom > 0 && rect.right > 0 && style?.visibility !== 'hidden' && style?.display !== 'none';
  };
  const setValue = (node, value) => {
    node.scrollIntoView({ block: 'center', inline: 'center' });
    node.focus?.();
    node.click?.();
    const proto = Object.getPrototypeOf(node);
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (descriptor?.set) descriptor.set.call(node, value);
    else node.value = value;
    node.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const clickButton = (pattern) => {
    const buttons = [...document.querySelectorAll('button, [role="button"], input[type="submit"], a')]
      .filter(visible)
      .map((node) => ({ node, text: textOf(node), rect: node.getBoundingClientRect?.() }));
    const target = buttons.find((item) => pattern.test(item.text)) || buttons.find((item) => item.node.type === 'submit');
    if (!target) return '';
    target.node.scrollIntoView({ block: 'center', inline: 'center' });
    target.node.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    target.node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    target.node.click();
    target.node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return target.text || 'submit';
  };
  const body = document.body?.innerText || '';
  const hasAuthInput = [...document.querySelectorAll('input')]
    .filter(visible)
    .some((node) => /email|username|password/i.test(`${node.type} ${node.name} ${node.id} ${node.autocomplete} ${node.placeholder} ${node.getAttribute?.('aria-label') || ''}`));
  const loginButton = hasAuthInput ? '' : clickButton(/^(log in|sign in|Ä‘Äƒng nháº­p|get started|continue)$/i);
  if (loginButton) {
    return { ok: true, mode: 'clicked-login-entry', clicked: loginButton };
  }
  const emailInput = [...document.querySelectorAll('input')]
    .filter(visible)
    .find((node) => /email|username/i.test(`${node.type} ${node.name} ${node.id} ${node.autocomplete} ${node.placeholder} ${node.getAttribute?.('aria-label') || ''}`));
  if (emailInput && !String(emailInput.value || '').includes(String(email || '').slice(0, 4))) {
    setValue(emailInput, email);
    const clicked = clickButton(/continue|next|tiáº¿p tá»¥c|submit|log in|sign in|Ä‘Äƒng nháº­p/i);
    return { ok: true, mode: 'filled-email', submitted: Boolean(clicked), clicked };
  }
  const passwordInput = [...document.querySelectorAll('input[type="password"], input[autocomplete="current-password"]')].filter(visible)[0];
  if (passwordInput) {
    setValue(passwordInput, password);
    const clicked = clickButton(/continue|next|log in|sign in|Ä‘Äƒng nháº­p|submit/i);
    return { ok: true, mode: 'filled-password', submitted: Boolean(clicked), clicked };
  }
  if (/two-factor|2fa|verification code|verify your identity|captcha|cloudflare|passkey|authenticator/i.test(body)) {
    return { ok: false, mode: 'needs-user-verification', needsUserAction: true };
  }
  return { ok: false, mode: 'login-form-not-found', url: location.href, provider };
}

function detectLoginScript(provider) {
  const bodyText = document.body?.innerText || '';
  const buttonsText = [...document.querySelectorAll('button, a, [role="button"]')]
    .map((el) => `${el.textContent || ''} ${el.getAttribute('aria-label') || ''}`.trim())
    .join(' | ');
  const foldText = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
  const foldedBody = foldText(bodyText);
  const foldedButtons = foldText(buttonsText);
  const composerSelectors = [
    'textarea',
    'div[contenteditable="true"]',
    '[contenteditable="true"]',
    '[contenteditable="true"].ProseMirror',
    '.ProseMirror[contenteditable="true"]',
    '.ProseMirror',
    '[data-testid="composer"]',
    '[data-testid="composer"] [contenteditable="true"]',
    '[data-testid="composer-text-input"]',
    '[data-testid="composer-text-input"] [contenteditable="true"]',
    '[role="textbox"]',
    '#prompt-textarea',
    '[aria-label*="Message"]',
    '[aria-label*="Ask"]',
    '[aria-label*="Há»i"]',
    '[placeholder*="Ask"]',
    '[placeholder*="Há»i"]',
  ];
  const composer = composerSelectors.map((selector) => document.querySelector(selector)).find(Boolean);
  const chatGptVietnameseReady = provider === 'chatgpt' && (
    /doan chat moi|tim kiem doan chat|thu vien|du an|khi ban san sang|hoi bat ky dieu gi|tao anh|viet hoac hinh sua|tra cuu thong tin/.test(foldedBody)
    || /tao anh|viet hoac hinh sua|tra cuu thong tin|new chat|search chats|library/.test(foldedButtons)
  );
  const hasAppShell = provider === 'grok'
    ? /Grok|Imagine|DeepSearch|Think|What do you want to know|Ask anything/i.test(bodyText)
    : provider === 'pixverse'
      ? /PixVerse|Create|Generate|Image to Video|Text to Video|My Videos|Workspace/i.test(bodyText)
      : /New chat|Search chats|Library|Recents|Whatâ€™s on the agenda|Ask anything|Projects|Äoáº¡n chat má»›i|TÃ¬m kiáº¿m Ä‘oáº¡n chat|ThÆ° viá»‡n|Dá»± Ã¡n|Báº¡n Ä‘ang lÃ m vá» cÃ¡i gÃ¬|Há»i báº¥t ká»³ Ä‘iá»u gÃ¬/i.test(bodyText);
  const hasExplicitLoginButton = provider === 'grok'
    ? /(^|\|)\s*(sign in|log in|Ä‘Äƒng nháº­p|sign up|Ä‘Äƒng kÃ½)\s*(\||$)/i.test(buttonsText)
    || /(^|\n)\s*(Sign in|Sign up)\s*($|\n)/i.test(bodyText)
    || /Sign up to keep chatting/i.test(bodyText)
    : /(^|\|)\s*(log in|sign in|Ä‘Äƒng nháº­p)\s*(\||$)/i.test(buttonsText);
  const loggedOutWords = provider === 'grok'
    ? /sign in|log in|Ä‘Äƒng nháº­p|continue with|sign up to keep chatting/i
    : provider === 'pixverse'
      ? /sign in|log in|sign up|continue with|Ä‘Äƒng nháº­p/i
      : /log in|sign up|sign in|Ä‘Äƒng nháº­p|get started/i;
  const hasChatGptLoginUi = provider === 'chatgpt' && (
    /(^|\|)\s*(log in|sign in|Ä‘Äƒng nháº­p|sign up for free|sign up)\s*(\||$)/i.test(buttonsText)
    || /(^|\n)\s*(Log in|Sign up for free|Sign up)\s*($|\n)/i.test(bodyText)
    || /Get responses tailored to you|Log in to get|saved chats|upload files/i.test(bodyText)
  );
  const chatgptLoggedInShell = provider === 'chatgpt' && !hasChatGptLoginUi && (
    /Projects|GPTs|Company knowledge|Invite team members|Äoáº¡n chat má»›i|TÃ¬m kiáº¿m Ä‘oáº¡n chat|ThÆ° viá»‡n|Dá»± Ã¡n|Báº¡n Ä‘ang lÃ m vá» cÃ¡i gÃ¬|Há»i báº¥t ká»³ Ä‘iá»u gÃ¬/i.test(bodyText)
    || /CUSTOMVOICE|Business|Team|Workspace|TÃ i khoáº£n|CÃ i Ä‘áº·t|NÃ¢ng cáº¥p gÃ³i|ÄÄƒng xuáº¥t/i.test(bodyText)
    || /Share\s*\||Chia sáº»|Táº¡o áº£nh|Tra cá»©u thÃ´ng tin/i.test(buttonsText)
  );
  const chatgptReadyComposer = provider === 'chatgpt'
    && !hasChatGptLoginUi
    && Boolean(composer)
    && /chatgpt\.com$/i.test(location.hostname);
  const chatgptLoggedInReady = chatgptLoggedInShell || chatGptVietnameseReady || chatgptReadyComposer;
  const grokLoggedInShell = provider === 'grok' && (
    /SuperGrok|Imagine|Private|What do you want to know\?|Ask anything|Sign Out|Settings|Connectors|Tasks|Files/i.test(bodyText)
    || Boolean(composer)
  );
  const hasSignedInAccount = provider === 'grok'
    ? grokLoggedInShell || /@[\w.-]+|Projects|History|Private|SuperGrok|Charlotte Garcia|New Project|Sign Out/i.test(bodyText)
    : chatgptLoggedInReady;
  const looksLoggedOut = provider === 'chatgpt'
    ? hasChatGptLoginUi
    : provider === 'grok'
      ? hasExplicitLoginButton || /continue with google|continue with apple|sign in to grok|sign up to grok/i.test(bodyText)
      : hasExplicitLoginButton || (loggedOutWords.test(bodyText) && !composer && !hasSignedInAccount);
  const cloudflareChallenge = provider === 'grok' && /cloudflare|performing security verification|verify you are human|checking if the site connection is secure|just a moment|Ray ID/i.test(`${bodyText} ${document.title}`);
  return {
    provider,
    loggedIn: cloudflareChallenge ? false : provider === 'chatgpt'
      ? chatgptLoggedInReady && !looksLoggedOut
      : provider === 'grok'
        ? !looksLoggedOut && (grokLoggedInShell || hasSignedInAccount)
        : Boolean(composer || hasAppShell || hasSignedInAccount) && !looksLoggedOut,
    hasComposer: Boolean(composer),
    hasAppShell,
    looksLoggedOut,
    cloudflareChallenge,
    reason: cloudflareChallenge ? 'Grok Ä‘ang hiá»‡n Cloudflare security verification / cache challenge.' : looksLoggedOut ? 'Trang Ä‘ang hiá»‡n Sign in/Sign up hoáº·c yÃªu cáº§u Ä‘Äƒng nháº­p.' : '',
    hasSignedInAccount,
    composerTag: composer?.tagName || null,
    composerClass: composer?.className || null,
    url: location.href,
    title: document.title,
    sampleText: bodyText.slice(0, 1200),
  };
}

function detectVideoCapabilityScript(provider) {
  const bodyText = document.body?.innerText || '';
  if (/sign in|log in|sign up to keep chatting|Ä‘Äƒng nháº­p/i.test(bodyText) && !/SuperGrok|Imagine|Private|Sign Out|What do you want to know\?/i.test(bodyText)) {
    return { ok: false, error: `${provider === 'pixverse' ? 'PixVerse' : 'Grok'} chÆ°a Ä‘Äƒng nháº­p hoáº·c session bá»‹ giá»›i háº¡n: trang Ä‘ang hiá»‡n Sign in/Sign up.` };
  }
  const fileInput = document.querySelector('input[type="file"]');
  const actionText = [...document.querySelectorAll('button, [role="button"], a, label')]
    .map((el) => `${el.textContent || ''} ${el.getAttribute('aria-label') || ''} ${el.title || ''}`)
    .join(' | ');
  const featurePattern = provider === 'pixverse'
    ? /Image to Video|Text to Video|Create|Generate|Upload|Start|PixVerse/i
    : /Imagine|Create images|image generation|attach|upload|plus|\+|create/i;
  const uploadPattern = provider === 'pixverse'
    ? /upload|image|file|add|create|generate|start|\+/i
    : /attach|upload|image|file|plus|\+|add/i;
  const featureText = featurePattern.test(bodyText) || featurePattern.test(actionText);
  const hasUploadAction = uploadPattern.test(actionText) || Boolean(fileInput);
  const signedInShell = provider === 'grok' && /SuperGrok|Imagine|Private|Sign Out|What do you want to know\?|What would you like to create\?|Type to imagine/i.test(bodyText);
  const blocked = /upgrade|subscribe|premium|limit reached|not available|not supported|join waitlist|quota|insufficient|credits/i.test(bodyText);
  if (blocked && !signedInShell) {
    return { ok: false, error: `${provider === 'pixverse' ? 'PixVerse' : 'Grok'} account Ä‘ang bá»‹ giá»›i háº¡n quota/plan hoáº·c feature táº¡o video chÆ°a kháº£ dá»¥ng. HÃ£y Ä‘á»•i account/plan rá»“i cháº¡y láº¡i.` };
  }
  if (!featureText && !hasUploadAction) {
    return { ok: false, error: `KhÃ´ng tháº¥y feature upload/táº¡o video trong ${provider === 'pixverse' ? 'PixVerse' : 'Grok'}. CÃ³ thá»ƒ account nÃ y chÆ°a cÃ³ quyá»n táº¡o video tá»« áº£nh.` };
  }
  const energyMatch = bodyText.match(/(?:âš¡|energy|credit|credits|trial left|free trial left)[^0-9]{0,20}(\d{1,5})/i)
    || bodyText.match(/(\d{1,5})\s*(?:âš¡|energy|credits?|free trial left|trial left)/i);
  const planMatch = bodyText.match(/\b(Basic|Pro\+?|Premium|Personal|Team|Enterprise)\b/i);
  const hasPro = /\b(Pro\+?|Premium|Team|Enterprise)\b/i.test(bodyText) || /PRO\+/i.test(actionText);
  const proModelsVisible = /Seedance|Happy Horse|Kling|Veo|Sora|Grok Imagine/i.test(bodyText);
  return {
    ok: true,
    hasUploadAction,
    featureText,
    fileInput: Boolean(fileInput),
    energy: energyMatch ? Number(energyMatch[1]) : null,
    plan: planMatch ? planMatch[1] : null,
    hasPro,
    proModelsVisible,
  };
}

function countAssistantMessagesScript() {
  return [...document.querySelectorAll('[data-message-author-role="assistant"], article, .message, [class*="response"], [class*="markdown"]')]
    .filter((node) => (node.innerText || '').trim().length > 20).length;
}

function getPromptInputCandidates() {
  return [
    '#prompt-textarea',
    'textarea',
    'div[contenteditable="true"].ProseMirror',
    '.ProseMirror[contenteditable="true"]',
    '[data-testid="composer"] [contenteditable="true"]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
  ];
}

function focusPromptInputScript() {
  const selectors = [
    '#prompt-textarea',
    'textarea',
    'div[contenteditable="true"].ProseMirror',
    '.ProseMirror[contenteditable="true"]',
    '[data-testid="composer"] [contenteditable="true"]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
  ];
  for (const selector of selectors) {
    const input = document.querySelector(selector);
    if (!input) continue;
    input.scrollIntoView({ block: 'center' });
    input.focus();
    input.click();
    const selection = window.getSelection();
    if (input.isContentEditable && selection) {
      const range = document.createRange();
      range.selectNodeContents(input);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return { ok: true, selector, tag: input.tagName, className: input.className || '' };
  }
  return { ok: false, error: 'KhÃ´ng tÃ¬m tháº¥y composer ChatGPT/Grok.' };
}

function getComposerTextScript() {
  const selectors = [
    '#prompt-textarea',
    'textarea',
    'div[contenteditable="true"].ProseMirror',
    '.ProseMirror[contenteditable="true"]',
    '[data-testid="composer"] [contenteditable="true"]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
  ];
  const rightPanelCandidates = selectors
    .flatMap((selector) => [...document.querySelectorAll(selector)].map((node) => ({ node, selector })))
    .filter(({ node }) => {
      const rect = node.getBoundingClientRect?.();
      return rect && rect.width > 80 && rect.height > 16 && rect.left > window.innerWidth * 0.62 && rect.bottom > window.innerHeight * 0.55;
    })
    .sort((a, b) => b.node.getBoundingClientRect().bottom - a.node.getBoundingClientRect().bottom);
  const active = document.activeElement;
  const activeText = active ? (active.value || active.innerText || active.textContent || '').trim() : '';
  const activeCandidate = active && selectors.some((selector) => active.matches?.(selector) || active.closest?.(selector)) && activeText
    ? { node: active.matches?.(selectors.join(',')) ? active : active.closest(selectors.join(',')), selector: 'activeElement' }
    : null;
  const fallbackCandidates = selectors
    .flatMap((selector) => [...document.querySelectorAll(selector)].map((node) => ({ node, selector })))
    .filter(({ node }) => {
      const rect = node.getBoundingClientRect?.();
      const text = (node.value || node.innerText || node.textContent || '').trim();
      return rect && rect.width > 80 && rect.height > 10 && rect.bottom > 0 && text.length > 0 && text.length < 30000;
    })
    .sort((a, b) => b.node.getBoundingClientRect().bottom - a.node.getBoundingClientRect().bottom);
  const item = rightPanelCandidates[0] || activeCandidate || fallbackCandidates[0];
  if (item) {
    const input = item.node;
    return { ok: true, selector: item.selector, text: input.value || input.innerText || input.textContent || '' };
  }
  return { ok: false, text: '' };
}

function getActiveComposerTextScript() {
  const selectors = '#prompt-textarea, textarea, div[contenteditable="true"].ProseMirror, .ProseMirror[contenteditable="true"], [data-testid="composer"] [contenteditable="true"], div[contenteditable="true"], [role="textbox"]';
  const active = document.activeElement;
  const node = active?.matches?.(selectors) ? active : active?.closest?.(selectors);
  if (!node) return { ok: false, text: '', selector: 'activeElement-none' };
  const text = node.value || node.innerText || node.textContent || '';
  const rect = node.getBoundingClientRect?.();
  return { ok: true, selector: 'activeElement', text, box: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null };
}

function setPromptInputValueScript(prompt) {
  const selectors = [
    '#prompt-textarea',
    'textarea',
    'div[contenteditable="true"].ProseMirror',
    '.ProseMirror[contenteditable="true"]',
    '[data-testid="composer"] [contenteditable="true"]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
  ];
  const input = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
  if (!input) return { ok: false, error: 'KhÃ´ng tÃ¬m tháº¥y composer Ä‘á»ƒ set prompt.' };
  input.scrollIntoView({ block: 'center' });
  input.focus();
  input.click();
  if ('value' in input) {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.value = prompt;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, prompt);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
  }
  return { ok: true };
}

function clickSendButtonScript() {
  const candidates = [
    ...document.querySelectorAll('button[data-testid="send-button"], button[data-testid="composer-submit-button"], button[aria-label="Send prompt"], button[aria-label="Send message"], button[aria-label*="Send"], button[type="submit"]'),
    ...document.querySelectorAll('form button, [data-testid="composer"] button, button'),
  ];
  const unique = [...new Set(candidates)];
  const sendButton = unique.find((button) => {
    if (button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
    const rect = button.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return false;
    const nearComposer = rect.top > window.innerHeight * 0.55 && rect.left > window.innerWidth * 0.45;
    if (!nearComposer) return false;
    const label = `${button.getAttribute('aria-label') || ''} ${button.textContent || ''} ${button.dataset?.testid || ''} ${button.innerHTML || ''}`;
    if (/voice|mic|microphone|dictate|audio|record|waveform|stop|cancel|square/i.test(label)) return false;
    const explicitSend = /send|submit|gá»­i|arrow-up|composer-submit|send-button|up/i.test(label);
    const hasUpArrowIcon = /M(?:2|8|12)[^<]{0,80}(?:L|V|H)[^<]{0,80}(?:up|arrow)|rotate\(-?90|arrow-up/i.test(label);
    return explicitSend || hasUpArrowIcon;
  });
  if (!sendButton) return { ok: false, error: 'KhÃ´ng tÃ¬m tháº¥y nÃºt send Ä‘ang enabled.' };
  sendButton.scrollIntoView({ block: 'center', inline: 'center' });
  sendButton.focus();
  sendButton.click();
  const rect = sendButton.getBoundingClientRect();
  return {
    ok: true,
    selector: sendButton.getAttribute('data-testid') || sendButton.getAttribute('aria-label') || sendButton.textContent || 'button',
    box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  };
}

function sendPromptScript(prompt) {
  const selectors = [
    'textarea',
    '#prompt-textarea',
    'div[contenteditable="true"].ProseMirror',
    '.ProseMirror[contenteditable="true"]',
    '[data-testid="composer"] [contenteditable="true"]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
  ];
  const input = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
  if (!input) return { ok: false, error: 'KhÃ´ng tÃ¬m tháº¥y Ã´ nháº­p prompt Ask anything / composer.' };

  input.scrollIntoView({ block: 'center' });
  input.focus();
  if (input.tagName === 'TEXTAREA') {
    input.value = prompt;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, prompt);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
  }

  const buttons = [...document.querySelectorAll('button')];
  const sendButton = document.querySelector('button[data-testid="send-button"], button[data-testid="composer-submit-button"], button[aria-label="Send prompt"], button[aria-label="Send message"]')
    || buttons.find((button) => {
      const label = `${button.getAttribute('aria-label') || ''} ${button.textContent || ''} ${button.dataset?.testid || ''} ${button.innerHTML || ''}`;
      return /send|submit|gá»­i|arrow-up|composer-submit|send-button/i.test(label) && !button.disabled;
    })
    || buttons.reverse().find((button) => !button.disabled && button.closest('form'));

  setTimeout(() => {
    const retryButton = document.querySelector('button[data-testid="send-button"], button[data-testid="composer-submit-button"], button[aria-label="Send prompt"], button[aria-label="Send message"]');
    if (retryButton && !retryButton.disabled) retryButton.click();
  }, 250);

  if (sendButton && !sendButton.disabled) {
    sendButton.click();
    return { ok: true, mode: 'button', selector: sendButton.getAttribute('data-testid') || sendButton.getAttribute('aria-label') || sendButton.textContent || 'button' };
  }

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
  return { ok: true, mode: 'enter' };
}

function collectGeneratedImageUrlsScript() {
  const urls = [...document.images]
    .map((img) => img.currentSrc || img.src)
    .filter(Boolean)
    .filter((url) => /blob:|data:image|oaiusercontent|oaidalleapiprodscus|chatgpt|openai|grok|xai/i.test(url));
  return { urls: [...new Set(urls)] };
}

function getLatestImageBoxScript(expectedRef = '') {
  const expectedY = String(expectedRef || '').startsWith('chatgpt-custom-box-y')
    ? Number(String(expectedRef).replace('chatgpt-custom-box-y', ''))
    : null;
  const isImageNode = (node) => {
    if (node.tagName === 'IMG' || node.tagName === 'CANVAS') return true;
    const text = node.innerText || '';
    if (/Generated image/i.test(text) && (text.includes('Edit') || node.querySelector('button'))) return true;
    const style = window.getComputedStyle(node);
    if (style.backgroundImage && style.backgroundImage !== 'none' && !style.backgroundImage.includes('gradient')) return true;
    return false;
  };

  const nodes = [...document.querySelectorAll('img, canvas, button, div')]
    .filter((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.width < 180 || rect.height < 120) return false;
      if (rect.width > window.innerWidth * 0.9 && rect.height > window.innerHeight * 0.9) return false;
      if (node.closest('header, nav, aside')) return false;
      return isImageNode(node);
    })
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        node,
        src: node.currentSrc || node.src || 'custom-box',
        area: rect.width * rect.height,
        box: { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height },
      };
    })
    // Æ¯u tiÃªn Ä‘Ãºng image box vá»«a detect; náº¿u khÃ´ng cÃ³ thÃ¬ láº¥y node tháº¥p nháº¥t (má»›i nháº¥t)
    .sort((a, b) => Number.isFinite(expectedY) ? Math.abs(a.box.y - expectedY) - Math.abs(b.box.y - expectedY) : b.box.y - a.box.y);

  const best = nodes[0];
  if (!best) return { ok: false, error: 'KhÃ´ng tÃ¬m tháº¥y image element Ä‘á»§ lá»›n trong ChatGPT.' };
  best.node.scrollIntoView({ block: 'center' });
  return { ok: true, src: best.src, expectedRef, box: best.box };
}

function collectVideoUrlsScript() {
  const urls = [
    ...[...document.querySelectorAll('video')].map((video) => video.currentSrc || video.src),
    ...[...document.querySelectorAll('a[href]')].map((link) => link.href).filter((href) => /\.mp4|video|download/i.test(href)),
  ].filter(Boolean);
  return { urls: [...new Set(urls)] };
}

function clickUploadButtonScript(provider = 'grok') {
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 4 && rect.height > 4;
  };
  const textOf = (node) => `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''} ${node.innerHTML || ''}`;
  if (provider !== 'grok') {
    const input = document.querySelector('input[type="file"]');
    if (input) return { ok: true, mode: 'existing-input' };
  }
  const buttons = [...document.querySelectorAll('button, [role="button"], label, div, span')].filter(visible);
  let uploadButton = null;
  if (provider === 'pixverse') {
    uploadButton = buttons.find((button) => /image|upload|reference|áº£nh|file|\+/i.test(textOf(button)));
  } else {
    const bottomButtons = buttons
      .map((button) => ({ button, rect: button.getBoundingClientRect(), text: textOf(button) }))
      .filter((item) => item.rect.top > window.innerHeight * 0.55);
    uploadButton = bottomButtons.find((item) => /^\s*\+\s*$/.test(item.text) || /Add|Attach|Upload|paperclip/i.test(item.text) || (item.rect.width <= 64 && /svg|path/i.test(item.button.innerHTML || '')))?.button
      || buttons.find((button) => /upload|attach|image|áº£nh|file|paperclip|plus|add/i.test(textOf(button)));
  }
  if (!uploadButton) return { ok: false, error: 'KhÃ´ng tháº¥y nÃºt upload/attach/image.' };
  uploadButton.scrollIntoView({ block: 'center', inline: 'center' });
  uploadButton.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  uploadButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  uploadButton.click();
  uploadButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  return { ok: true, mode: 'clicked-upload' };
}

function getGrokReadyStateScript() {
  const bodyText = document.body?.innerText || '';
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 8 && rect.height > 8;
  };
  const composer = [...document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]')]
    .find((node) => visible(node) && /imagine|what do you want|ask/i.test(`${node.getAttribute?.('placeholder') || ''} ${node.getAttribute?.('aria-label') || ''} ${node.textContent || ''}`));
  const hasImagineHome = /Featured Templates|Discover|Type to imagine|Create Template/i.test(bodyText);
  const hasSignedShell = /SuperGrok|Imagine|Private|Sign Out|What do you want to know\?/i.test(bodyText);
  const loading = /loading|just a moment|please wait|checking/i.test(bodyText) || [...document.querySelectorAll('[aria-busy="true"], .spinner, [class*="loading"], [class*="spinner"]')].some(Boolean);
  return {
    ready: Boolean((composer || hasImagineHome || hasSignedShell) && !loading),
    hasComposer: Boolean(composer),
    hasImagineHome,
    hasSignedShell,
    loading,
    url: location.href,
    title: document.title,
    sampleText: bodyText.slice(0, 800),
  };
}

function detectGrokTemplateModalScript() {
  const bodyText = document.body?.innerText || '';
  const open = /Choose a template type to begin|Name your template|Template Name|Photo\s*â†’\s*Video|Photo\s*â†’\s*Style Edit|Photo\s*â†’\s*Edit\s*â†’\s*Video/i.test(bodyText);
  return { open, sampleText: bodyText.slice(0, 1000), url: location.href };
}

function closeGrokTemplateModalScript() {
  const bodyText = document.body?.innerText || '';
  const state = {
    open: /Choose a template type to begin|Name your template|Template Name|Photo\s*â†’\s*Video|Photo\s*â†’\s*Style Edit|Photo\s*â†’\s*Edit\s*â†’\s*Video/i.test(bodyText),
    sampleText: bodyText.slice(0, 1000),
    url: location.href,
  };
  if (!state.open) return { ok: false, reason: 'modal-not-open' };
  const textOf = (node) => `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''} ${node.innerHTML || ''}`.trim();
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 4 && rect.height > 4 && rect.bottom > 0 && rect.right > 0;
  };
  const textNodes = [...document.querySelectorAll('div, section, article, main, [role="dialog"], [class]')]
    .filter((node) => {
      if (!visible(node)) return false;
      const text = node.innerText || '';
      const hasTemplateChoice = /Choose a template type to begin/i.test(text) && /Photo\s*â†’\s*Video/i.test(text);
      const hasNameTemplateStep = /Name your template|Template Name|Add a description/i.test(text);
      return hasTemplateChoice || hasNameTemplateStep;
    })
    .map((node) => ({ node, rect: node.getBoundingClientRect(), text: node.innerText || '' }))
    .filter((item) => item.rect.width > 260 && item.rect.width < window.innerWidth * 0.9 && item.rect.height > 120 && item.rect.height < window.innerHeight * 0.95)
    .sort((a, b) => (a.rect.width * a.rect.height) - (b.rect.width * b.rect.height));
  const modal = textNodes[0];
  const buttons = [...document.querySelectorAll('button, [role="button"], [aria-label], svg, path')]
    .map((node) => node.closest?.('button, [role="button"], [aria-label]') || node)
    .filter((node, index, list) => node && list.indexOf(node) === index && visible(node))
    .map((node) => ({ node, rect: node.getBoundingClientRect(), text: textOf(node) }));
  const candidates = buttons.filter((item) => {
    const inModalTopRight = modal
      && item.rect.top >= modal.rect.top
      && item.rect.top <= modal.rect.top + 70
      && item.rect.left >= modal.rect.right - 90
      && item.rect.left <= modal.rect.right + 10
      && item.rect.width <= 80
      && item.rect.height <= 80;
    const xLike = /^(Ã—|x)$/i.test(item.text) || /close|dismiss|Ä‘Ã³ng/i.test(item.text);
    const iconOnly = inModalTopRight && /svg|path|circle|lucide|icon/i.test(item.text || item.node.innerHTML || '');
    return (xLike && (!modal || inModalTopRight || item.rect.top < 180)) || iconOnly || inModalTopRight;
  }).sort((a, b) => (b.rect.left - a.rect.left) || (a.rect.top - b.rect.top));
  const target = candidates[0];
  const syntheticBox = modal ? {
    x: Math.max(0, modal.rect.right - 30),
    y: Math.max(0, modal.rect.top + 8),
    width: 26,
    height: 26,
  } : null;
  if (!target && !syntheticBox) return { ok: false, error: 'KhÃ´ng tÃ¬m tháº¥y nÃºt X hoáº·c khung báº£ng template Grok.', state, buttons: buttons.slice(0, 20).map((item) => ({ text: item.text.slice(0, 80), box: { x: item.rect.x, y: item.rect.y, width: item.rect.width, height: item.rect.height } })) };
  if (target) {
    target.node.scrollIntoView?.({ block: 'center', inline: 'center' });
    target.node.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    target.node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    target.node.click?.();
    target.node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }
  const box = target ? { x: target.rect.x, y: target.rect.y, width: target.rect.width, height: target.rect.height } : syntheticBox;
  return { ok: true, selector: target?.text?.slice(0, 80) || 'modal-relative-synthetic-x', box, modal: modal ? { x: modal.rect.x, y: modal.rect.y, width: modal.rect.width, height: modal.rect.height } : null, state };
}

function getGrokTemplateViewportFallbackPointsScript() {
  const bodyText = document.body?.innerText || '';
  const open = /Choose a template type to begin|Photo\s*â†’\s*Video|Template Name/i.test(bodyText);
  if (!open) return { ok: false, reason: 'modal-not-open' };
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 20 && rect.height > 20 && rect.bottom > 0 && rect.right > 0;
  };
  const textOf = (node) => `${node.innerText || node.textContent || ''}`.trim().replace(/\s+/g, ' ');
  const modalCandidates = [...document.querySelectorAll('div, section, article, main, [role="dialog"], [class]')]
    .filter((node) => visible(node) && /Choose a template type to begin/i.test(textOf(node)) && /Photo\s*â†’\s*Video/i.test(textOf(node)))
    .map((node) => ({ rect: node.getBoundingClientRect(), text: textOf(node).slice(0, 200) }))
    .filter((item) => item.rect.width > 400 && item.rect.height > 260 && item.rect.width < innerWidth * 0.95 && item.rect.height < innerHeight * 0.95)
    .sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height));
  const modal = modalCandidates[0]?.rect;
  const points = modal ? [
    { name: 'modal-x-hard', x: modal.right - 18, y: modal.top + 18 },
    { name: 'modal-x-hard-2', x: modal.right - 26, y: modal.top + 26 },
    { name: 'backdrop-top-left', x: 20, y: 20 },
    { name: 'backdrop-bottom-left', x: 20, y: innerHeight - 20 },
  ] : [
    { name: 'viewport-x-hard', x: innerWidth * 0.81, y: innerHeight * 0.14 },
    { name: 'viewport-x-hard-2', x: innerWidth * 0.80, y: innerHeight * 0.15 },
    { name: 'backdrop-top-left', x: 20, y: 20 },
    { name: 'backdrop-bottom-left', x: 20, y: innerHeight - 20 },
  ];
  const hits = points.map((point) => {
    const hit = document.elementFromPoint(point.x, point.y);
    return { ...point, hitTag: hit?.tagName || '', hitText: textOf(hit || document.body).slice(0, 160) };
  });
  return { ok: true, viewport: { width: innerWidth, height: innerHeight }, modal: modal ? { x: modal.x, y: modal.y, width: modal.width, height: modal.height } : null, points, hits, candidates: modalCandidates.slice(0, 8).map((item) => ({ box: { x: item.rect.x, y: item.rect.y, width: item.rect.width, height: item.rect.height }, text: item.text })) };
}

function scanGrokTemplateModalScript() {
  const bodyText = document.body?.innerText || '';
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 8 && rect.height > 8 && rect.bottom > 0 && rect.right > 0;
  };
  const textOf = (node) => `${node.innerText || node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim().replace(/\s+/g, ' ');
  const interesting = [...document.querySelectorAll('button, [role="button"], div, section, article, [class], [aria-label]')]
    .filter(visible)
    .map((node) => ({ node, rect: node.getBoundingClientRect(), text: textOf(node), tag: node.tagName, role: node.getAttribute?.('role') || '', cls: String(node.className || '').slice(0, 100) }))
    .filter((item) => /Choose a template|Photo|Video|Style|Edit|Template|close|dismiss|Ã—|x/i.test(item.text) || /dialog|modal|button/i.test(`${item.role} ${item.cls}`))
    .sort((a, b) => (a.rect.y - b.rect.y) || (a.rect.x - b.rect.x))
    .slice(0, 80)
    .map((item) => ({ tag: item.tag, role: item.role, className: item.cls, text: item.text.slice(0, 220), box: { x: item.rect.x, y: item.rect.y, width: item.rect.width, height: item.rect.height } }));
  return { ok: true, open: /Choose a template type to begin|Name your template|Template Name|Add a description/i.test(bodyText), url: location.href, viewport: { width: innerWidth, height: innerHeight }, sampleText: bodyText.slice(0, 1200), interesting };
}

function selectGrokPhotoVideoTemplateScript() {
  const bodyText = document.body?.innerText || '';
  const open = /Choose a template type to begin|Photo\s*â†’\s*Video|Name your template|Template Name/i.test(bodyText);
  if (!open) return { ok: false, reason: 'modal-not-open' };
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 20 && rect.height > 20 && rect.bottom > 0 && rect.right > 0;
  };
  const textOf = (node) => `${node.innerText || node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim().replace(/\s+/g, ' ');
  const all = [...document.querySelectorAll('button, [role="button"], div, section, article')]
    .filter(visible)
    .map((node) => ({ node, rect: node.getBoundingClientRect(), text: textOf(node), tag: node.tagName, role: node.getAttribute?.('role') || '', cls: String(node.className || '').slice(0, 100) }));
  const cards = all
    .filter((item) => /Photo\s*â†’\s*Video/i.test(item.text) && /Animate a photo using a video prompt/i.test(item.text) && !/Style|Edit â†’ Video|different visual style/i.test(item.text))
    .filter((item) => item.rect.width >= 160 && item.rect.width <= 360 && item.rect.height >= 70 && item.rect.height <= 150)
    .sort((a, b) => (a.rect.y - b.rect.y) || (a.rect.x - b.rect.x));
  const card = cards[0];
  if (!card) return { ok: false, error: 'KhÃ´ng tÃ¬m tháº¥y container card Photo â†’ Video.', candidates: all.filter((item) => /Photo|Video|Animate/i.test(item.text)).slice(0, 30).map((item) => ({ tag: item.tag, role: item.role, className: item.cls, text: item.text.slice(0, 180), box: { x: item.rect.x, y: item.rect.y, width: item.rect.width, height: item.rect.height } })) };
  const clickPoints = [
    { name: 'center', x: card.rect.x + card.rect.width / 2, y: card.rect.y + card.rect.height / 2 },
    { name: 'title-left', x: card.rect.x + 56, y: card.rect.y + 26 },
    { name: 'icon', x: card.rect.x + 22, y: card.rect.y + 26 },
  ];
  const hits = clickPoints.map((point) => {
    const hit = document.elementFromPoint(point.x, point.y);
    return { ...point, hitText: textOf(hit || document.body).slice(0, 160), hitTag: hit?.tagName || '' };
  });
  return { ok: true, selector: 'Photo â†’ Video container', box: { x: card.rect.x, y: card.rect.y, width: card.rect.width, height: card.rect.height }, clickPoints, hits, text: card.text.slice(0, 220), tag: card.tag, role: card.role, className: card.cls };
}

function forceHideGrokTemplateModalScript() {
  const bodyText = document.body?.innerText || '';
  const open = /Choose a template type to begin|Name your template|Template Name|Photo\s*â†’\s*Video|Photo\s*â†’\s*Style Edit|Photo\s*â†’\s*Edit\s*â†’\s*Video/i.test(bodyText);
  if (!open) return { ok: false, reason: 'modal-not-open' };
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 10 && rect.height > 10 && rect.bottom > 0 && rect.right > 0;
  };
  const modalNodes = [...document.querySelectorAll('div, section, article, main, [role="dialog"], [class]')]
    .filter((node) => {
      if (!visible(node)) return false;
      const text = node.innerText || '';
      const hasTemplateChoice = /Choose a template type to begin/i.test(text) && /Photo\s*â†’\s*Video/i.test(text);
      const hasNameTemplateStep = /Name your template|Template Name|Add a description/i.test(text);
      return hasTemplateChoice || hasNameTemplateStep;
    })
    .map((node) => ({ node, rect: node.getBoundingClientRect(), text: node.innerText || '' }))
    .filter((item) => item.rect.width > 260 && item.rect.height > 120)
    .sort((a, b) => (a.rect.width * a.rect.height) - (b.rect.width * b.rect.height));
  const modal = modalNodes[0];
  const hidden = [];
  if (modal?.node) {
    let node = modal.node;
    for (let depth = 0; node && depth < 4; depth += 1) {
      const rect = node.getBoundingClientRect?.();
      const text = node.innerText || '';
      if (rect && /Choose a template type to begin|Name your template|Template Name|Add a description/i.test(text) && rect.width < window.innerWidth * 0.98 && rect.height < window.innerHeight * 0.98) {
        node.style.setProperty('display', 'none', 'important');
        node.style.setProperty('visibility', 'hidden', 'important');
        node.style.setProperty('pointer-events', 'none', 'important');
        hidden.push({ tag: node.tagName, className: String(node.className || '').slice(0, 120), box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } });
        break;
      }
      node = node.parentElement;
    }
  }
  [...document.querySelectorAll('div, [class]')].forEach((node) => {
    const rect = node.getBoundingClientRect?.();
    if (!rect || rect.width < window.innerWidth * 0.5 || rect.height < window.innerHeight * 0.5) return;
    const style = getComputedStyle(node);
    const looksBackdrop = Number(style.opacity || 1) > 0 && (style.backdropFilter !== 'none' || /blur|overlay|modal|dialog|backdrop/i.test(String(node.className || '')));
    if (!looksBackdrop) return;
    node.style.setProperty('display', 'none', 'important');
    node.style.setProperty('visibility', 'hidden', 'important');
    node.style.setProperty('pointer-events', 'none', 'important');
    hidden.push({ tag: node.tagName, className: String(node.className || '').slice(0, 120), backdrop: true, box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } });
  });
  document.body.style.pointerEvents = 'auto';
  document.documentElement.style.pointerEvents = 'auto';
  return { ok: hidden.length > 0, hidden, modal: modal ? { x: modal.rect.x, y: modal.rect.y, width: modal.rect.width, height: modal.rect.height } : null };
}

async function prepareGrokVideoComposerScript(config = {}) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const textOf = (node) => `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim();
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 4 && rect.height > 4 && rect.bottom > 0 && rect.right > 0;
  };
  const clickNode = (target) => {
    if (!target) return false;
    target.scrollIntoView({ block: 'center', inline: 'center' });
    target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    target.click();
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return true;
  };
  const findClickable = (pattern) => {
    const nodes = [...document.querySelectorAll('button, [role="button"], a, label, div, span')].filter(visible);
    return nodes.find((node) => pattern.test(textOf(node)))?.closest?.('button, [role="button"], a, label') || nodes.find((node) => pattern.test(textOf(node)));
  };

  let path = location.pathname.toLowerCase();
  if (!path.includes('/imagine')) {
    const imagine = findClickable(/(^|\s)Imagine(\s|$)|Image/i);
    if (imagine) clickNode(imagine);
    await sleep(800);
    path = location.pathname.toLowerCase();
  }

  const composerBar = [...document.querySelectorAll('button, [role="button"]')]
    .map((node) => ({ node, rect: node.getBoundingClientRect?.(), text: textOf(node) }))
    .filter((item) => item.rect && item.rect.width > 18 && item.rect.height > 18 && item.rect.top > window.innerHeight * 0.72)
    .sort((a, b) => a.rect.left - b.rect.left);
  const clickExact = (pattern) => {
    const target = composerBar.find((item) => pattern.test(item.text) && item.rect.left < window.innerWidth * 0.75)?.node;
    return { clicked: clickNode(target), text: target ? textOf(target).slice(0, 120) : '', box: target ? (() => { const r = target.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })() : null };
  };
  const imageResult = clickExact(/^\s*Image\s*$/i);
  await sleep(450);
  const videoResult = clickExact(/^\s*Video\s*$/i);
  await sleep(450);
  const ratioMenuResult = clickExact(/^\s*(Original|\d+\s*:\s*\d+|Widescreen|Wide|Square|Vertical)\s*$/i);
  await sleep(300);
  const ratio169Node = [...document.querySelectorAll('button, [role="button"], [role="menuitem"], div, span')]
    .filter(visible)
    .map((node) => ({ node, text: textOf(node), rect: node.getBoundingClientRect?.() }))
    .filter((item) => item.rect && item.rect.top > window.innerHeight * 0.35)
    .find((item) => /^\s*(16\s*:\s*9|Widescreen|Wide)\s*$/i.test(item.text))?.node;
  const clicked169 = clickNode(ratio169Node);
  await sleep(250);
  const wantedDuration = String(config?.duration || '10').startsWith('6') ? '6s' : '10s';
  const qualityResult = clickExact(/^\s*(480p|720p|1080p)\s*$/i);
  await sleep(250);
  const quality720Node = [...document.querySelectorAll('button, [role="button"], [role="menuitem"], div, span')]
    .filter(visible)
    .map((node) => ({ node, text: textOf(node), rect: node.getBoundingClientRect?.() }))
    .filter((item) => item.rect && item.rect.top > window.innerHeight * 0.35)
    .find((item) => /^\s*720p\s*$/i.test(item.text))?.node;
  const clicked720 = clickNode(quality720Node);
  await sleep(250);
  const durationResult = clickExact(/^\s*(6s|10s)\s*$/i);
  await sleep(250);
  const durationNode = [...document.querySelectorAll('button, [role="button"], [role="menuitem"], div, span')]
    .filter(visible)
    .map((node) => ({ node, text: textOf(node), rect: node.getBoundingClientRect?.() }))
    .filter((item) => item.rect && item.rect.top > window.innerHeight * 0.35)
    .find((item) => new RegExp(`^\\s*${wantedDuration}\\s*$`, 'i').test(item.text))?.node;
  const clickedDuration = clickNode(durationNode);
  await sleep(250);
  const configLog = {
    wantedDuration,
    wantedResolution: config?.resolution || '720p',
    imageResult,
    videoResult,
    ratioMenuResult,
    clicked169,
    qualityResult,
    clicked720,
    durationResult,
    clickedDuration,
    ratio169Text: ratio169Node ? textOf(ratio169Node).slice(0, 120) : '',
    quality720Text: quality720Node ? textOf(quality720Node).slice(0, 120) : '',
    durationText: durationNode ? textOf(durationNode).slice(0, 120) : '',
    composerButtons: composerBar.map((item) => ({ text: item.text.slice(0, 80), box: { x: item.rect.x, y: item.rect.y, w: item.rect.width, h: item.rect.height } })),
    url: location.href,
    bodyTail: (document.body?.innerText || '').slice(-1500),
  };

  path = location.pathname.toLowerCase();
  const isAgentCanvas = path.includes('/imagine/agent/') && path.length > '/imagine/agent/'.length;
  if (isAgentCanvas) return { ok: true, isAgentCanvas: true, status: 'already-canvas-video-16x9', configLog, url: location.href };

  const emptyCanvas = findClickable(/(^|\s)Empty\s*Canvas(\s|$)|Create\s*from\s*scratch|Blank\s*canvas/i);
  if (!emptyCanvas) {
    const bodyText = document.body?.innerText || '';
    return { ok: true, isAgentCanvas: false, status: 'imagine-chat-video-16x9-ready-no-empty-canvas', configLog, url: location.href, bodyHead: bodyText.slice(0, 1000), bodyTail: bodyText.slice(-1500) };
  }
  const clickedEmptyCanvas = clickNode(emptyCanvas);
  const started = Date.now();
  while (Date.now() - started < 8000) {
    await sleep(300);
    const nowPath = location.pathname.toLowerCase();
    if (nowPath.includes('/imagine/agent/') && nowPath.length > '/imagine/agent/'.length) {
      const videoModeAgain = findClickable(/(^|\s)(Video|Motion)(\s|$)/i);
      const clickedVideoAgain = clickNode(videoModeAgain);
      const ratioAgain = findClickable(/\b(2:3|3:2|1:1|9:16|16:9)\b|Tall|Wide|Square|Vertical|Widescreen/i);
      const clickedRatioAgain = clickNode(ratioAgain);
      await sleep(150);
      const ratio169Again = findClickable(/\b16\s*:\s*9\b|Widescreen/i);
      const clicked169Again = clickNode(ratio169Again);
      return { ok: true, isAgentCanvas: true, emptyCanvasClicked: clickedEmptyCanvas, status: 'clicked-empty-canvas-video-16x9', configLog: { ...configLog, clickedVideoAgain, clickedRatioAgain, clicked169Again, videoAgainText: videoModeAgain ? textOf(videoModeAgain).slice(0, 120) : '', ratioAgainText: ratioAgain ? textOf(ratioAgain).slice(0, 120) : '', ratio169AgainText: ratio169Again ? textOf(ratio169Again).slice(0, 120) : '' }, url: location.href };
    }
  }
  const rect = emptyCanvas.getBoundingClientRect?.();
  return { ok: true, isAgentCanvas: false, emptyCanvasClicked: clickedEmptyCanvas, status: 'clicked-but-no-navigation-use-imagine-chat', configLog, url: location.href, emptyCanvasBox: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null };
}

function preparePixVerseComposerScript(config = {}) {
  const textOf = (node) => `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim();
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 4 && rect.height > 4;
  };
  const clickByText = (pattern) => {
    const nodes = [...document.querySelectorAll('button, [role="button"], label, div, span')].filter(visible);
    const target = nodes.find((node) => pattern.test(textOf(node)));
    if (target) {
      target.scrollIntoView({ block: 'center', inline: 'center' });
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      target.click();
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      return true;
    }
    return false;
  };
  clickByText(/Video/i);
  clickByText(/Image\s*(to|2)\s*Video|Image/i);
  if (config.resolution) clickByText(new RegExp(String(config.resolution).replace('P', '\\s*P'), 'i'));
  if (config.ratio) clickByText(new RegExp(String(config.ratio).replace(':', '\\s*[:ï¼š]\\s*'), 'i'));
  if (config.duration) clickByText(new RegExp(`${config.duration}\\s*s`, 'i'));
  if (config.model) clickByText(new RegExp(String(config.model).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'));
  const bodyText = document.body?.innerText || '';
  if (typeof config.previewMode === 'boolean') {
    const previewOn = /Preview Mode\s*[^\n]{0,30}(on|âœ“|checked)/i.test(bodyText);
    if (config.previewMode !== previewOn) clickByText(/Preview Mode/i);
  }
  if (typeof config.audio === 'boolean') {
    const audioOn = /Audio\s*[^\n]{0,20}(on|âœ“|checked)/i.test(bodyText);
    if (config.audio !== audioOn) clickByText(/Audio/i);
  }
  clickByText(/Reference|Upload|Image|Add image|\+/i);
  return { ok: true };
}

function setPixVersePromptScript(prompt) {
  const selectors = [
    'textarea[placeholder*="Describe"]',
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'div[class*="input"] textarea',
  ];
  const input = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
  if (!input) return { ok: false, error: 'KhÃ´ng tÃ¬m tháº¥y Ã´ Describe PixVerse.' };
  input.scrollIntoView({ block: 'center' });
  input.focus();
  input.click();
  if ('value' in input) {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.value = prompt;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, prompt);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
  }
  return { ok: true, selector: input.tagName };
}

function setGrokComposerTextScript(text) {
  const candidates = [...document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"], input')];
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 40 && rect.height > 16 && rect.left > window.innerWidth * 0.58 && rect.top > window.innerHeight * 0.45;
  };
  const target = candidates.filter(visible).sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
  if (!target) return { ok: false, error: 'composer-not-found' };
  target.focus?.();
  target.click?.();
  if ('value' in target) {
    target.value = text;
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    target.textContent = text;
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  }
  return { ok: true, text: String(target.value || target.textContent || '').slice(0, 120) };
}

function focusGrokComposerScript() {
  const selectors = [
    'textarea[placeholder*="What do you want" i]',
    'textarea[placeholder*="Ask" i]',
    'textarea[placeholder*="imagine" i]',
    'textarea[placeholder*="Imagine" i]',
    'textarea[placeholder*="create" i]',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'textarea',
  ];
  const bodyText = document.body?.innerText || '';
  const candidates = selectors
    .flatMap((selector) => [...document.querySelectorAll(selector)])
    .filter((node) => {
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width <= 80 || rect.height <= 16) return false;
      if (rect.bottom < window.innerHeight * 0.35) return false;
      if (rect.left < window.innerWidth * 0.18 || rect.right > window.innerWidth * 0.95) return false;
      const text = (node.innerText || node.textContent || node.value || '').trim();
      if (text.length > 30000) return false;
      const all = `${node.getAttribute?.('placeholder') || ''} ${node.getAttribute?.('aria-label') || ''} ${text}`;
      if (/connect|connector|gmail|google drive|notion|vercel/i.test(all)) return false;
      return true;
    })
    .map((node) => ({ node, rect: node.getBoundingClientRect(), label: `${node.getAttribute?.('placeholder') || ''} ${node.getAttribute?.('aria-label') || ''} ${node.textContent || ''}` }))
    .sort((a, b) => {
      const aInput = /what do you want|message|ask|prompt|type|imagine|describe|create/i.test(a.label) ? 1 : 0;
      const bInput = /what do you want|message|ask|prompt|type|imagine|describe|create/i.test(b.label) ? 1 : 0;
      if (aInput !== bInput) return bInput - aInput;
      return b.rect.bottom - a.rect.bottom;
    });
  const input = candidates[0]?.node;
  if (!input) return { ok: false, error: 'KhÃ´ng tÃ¬m tháº¥y composer Grok Ä‘á»ƒ focus.', bodyHead: bodyText.slice(0, 800) };
  input.scrollIntoView({ block: 'center', inline: 'center' });
  input.focus();
  input.click();
  const rect = input.getBoundingClientRect();
  return { ok: true, box: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }, label: `${input.getAttribute?.('placeholder') || ''} ${input.getAttribute?.('aria-label') || ''}`.trim() };
}

function labelGrokCanvasScript(label) {
  const buttons = [...document.querySelectorAll('button, [role="button"], [contenteditable="true"], input')]
    .map((node) => ({ node, rect: node.getBoundingClientRect?.(), text: `${node.textContent || node.value || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim() }))
    .filter((item) => item.rect && item.rect.width > 30 && item.rect.height > 16 && item.rect.left < window.innerWidth * 0.45 && item.rect.top < 120);
  const titleButton = buttons.find((item) => /Untitled|SCENE|scene/i.test(item.text)) || buttons.find((item) => item.rect.left > 80 && item.rect.top < 120);
  if (!titleButton) return { ok: false, error: 'KhÃ´ng tÃ¬m tháº¥y title/dropdown canvas Ä‘á»ƒ rename.', candidates: buttons.map((b) => b.text).slice(0, 12) };
  titleButton.node.click();
  const input = [...document.querySelectorAll('input, textarea, [contenteditable="true"]')]
    .map((node) => ({ node, rect: node.getBoundingClientRect?.() }))
    .filter((item) => item.rect && item.rect.width > 60 && item.rect.height > 18 && item.rect.top < 180)
    .sort((a, b) => b.rect.width - a.rect.width)[0]?.node;
  if (!input) return { ok: false, error: 'ÄÃ£ má»Ÿ title nhÆ°ng khÃ´ng tháº¥y Ã´ rename.', clicked: titleButton.text };
  input.focus();
  if ('value' in input) {
    input.value = label;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: label }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, label);
  }
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
  return { ok: true, label, clicked: titleButton.text };
}

function clearGrokCanvasChatScript() {
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .map((node) => ({ node, rect: node.getBoundingClientRect?.(), text: `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim() }))
    .filter((item) => item.rect && item.rect.width > 10 && item.rect.height > 10 && item.rect.left > window.innerWidth * 0.72);
  const newChat = buttons.find((item) => /^\s*New\s*Chat\s*$/i.test(item.text));
  if (!newChat) return { ok: false, error: 'no-new-chat-button', buttons: buttons.map((b) => b.text).slice(0, 20) };
  newChat.node.click();
  return { ok: true, mode: 'clicked-new-chat', text: newChat.text };
}

function clickGrokUploadImageMenuItemScript() {
  const items = [...document.querySelectorAll('button, [role="menuitem"], [role="button"], div, span')]
    .map((node) => ({
      node,
      rect: node.getBoundingClientRect?.(),
      text: `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim(),
    }))
    .filter((item) => item.rect && item.rect.width > 40 && item.rect.height > 16 && item.rect.top > 80 && item.rect.bottom < window.innerHeight - 40);
  const uploadImage = items.find((item) => /^\s*Upload\s*Image\s*$/i.test(item.text))
    || items.find((item) => /Upload\s*Image/i.test(item.text));
  if (!uploadImage) return { ok: false, error: 'KhÃ´ng tháº¥y menu item Upload Image.', items: items.map((item) => ({ text: item.text, box: { x: item.rect.x, y: item.rect.y, w: item.rect.width, h: item.rect.height } })).slice(0, 40) };
  uploadImage.node.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: uploadImage.rect.x + 8, clientY: uploadImage.rect.y + 8 }));
  uploadImage.node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: uploadImage.rect.x + 8, clientY: uploadImage.rect.y + 8 }));
  uploadImage.node.click();
  uploadImage.node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: uploadImage.rect.x + 8, clientY: uploadImage.rect.y + 8 }));
  return { ok: true, text: uploadImage.text, box: { x: uploadImage.rect.x, y: uploadImage.rect.y, width: uploadImage.rect.width, height: uploadImage.rect.height } };
}

function clickGrokCanvasUploadImageScript() {
  const candidates = [...document.querySelectorAll('button, [role="button"], label')]
    .map((node) => ({
      node,
      rect: node.getBoundingClientRect?.(),
      text: `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim(),
      html: node.innerHTML || '',
    }))
    .filter((item) => item.rect && item.rect.width >= 20 && item.rect.height >= 20 && item.rect.left < window.innerWidth * 0.72 && item.rect.top > window.innerHeight * 0.55);
  const upload = candidates.find((item) => /Upload\s*Image|Add\s*Image|Image/i.test(item.text))
    || candidates.find((item) => /image|upload|plus|photo|picture/i.test(`${item.text} ${item.html}`));
  if (!upload) return { ok: false, error: 'KhÃ´ng tÃ¬m tháº¥y nÃºt Upload Image trong toolbar canvas.', candidates: candidates.map((c) => ({ text: c.text, box: c.rect ? { x: c.rect.x, y: c.rect.y, w: c.rect.width, h: c.rect.height } : null })).slice(0, 20) };
  upload.node.scrollIntoView({ block: 'center', inline: 'center' });
  upload.node.click();
  const rect = upload.node.getBoundingClientRect();
  return { ok: true, text: upload.text, box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
}

function focusGrokWorkspaceScript() {
  const viewport = { width: window.innerWidth || 1200, height: window.innerHeight || 800 };
  const candidates = [...document.querySelectorAll('canvas, [class*="canvas" i], [class*="workspace" i], [class*="stage" i], main, body')]
    .map((node) => ({ node, rect: node.getBoundingClientRect?.() }))
    .filter((item) => item.rect && item.rect.width > viewport.width * 0.35 && item.rect.height > viewport.height * 0.35)
    .sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height));
  const target = candidates[0]?.node || document.body;
  const rect = target.getBoundingClientRect?.() || { left: 0, top: 0, width: viewport.width * 0.7, height: viewport.height };
  const x = Math.min(rect.left + rect.width * 0.5, viewport.width * 0.65);
  const y = Math.min(rect.top + rect.height * 0.5, viewport.height * 0.55);
  const el = document.elementFromPoint(x, y) || target;
  el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
  return { ok: true, mode: 'workspace-click', point: { x, y }, target: el.tagName, className: String(el.className || '').slice(0, 120) };
}

function detectUploadedAssetScript() {
  const bodyText = document.body?.innerText || '';
  const images = [...document.querySelectorAll('img, canvas, video')]
    .map((node) => {
      const rect = node.getBoundingClientRect?.();
      return { tag: node.tagName, width: rect?.width || 0, height: rect?.height || 0, top: rect?.top || 0, left: rect?.left || 0, src: node.currentSrc || node.src || '' };
    })
    .filter((item) => item.width >= 24 && item.height >= 24 && item.top > 40);
  const fileInputs = [...document.querySelectorAll('input[type="file"]')].map((input) => ({ files: input.files?.length || 0, accept: input.accept || '' }));
  const hasFileName = /\.(png|jpe?g|webp|gif|mp4|webm|mov)\b|image uploaded|video uploaded|upload complete|remove image|remove video|attached file|attachment|Ä‘Ã£ táº£i lÃªn|tá»‡p Ä‘Ã£ táº£i/i.test(bodyText);
  const canvasImages = images.filter((item) => item.left < window.innerWidth * 0.78 || item.tag === 'CANVAS');
  const hasPreview = canvasImages.length > 0;
  const hasInputFile = fileInputs.some((input) => input.files > 0);
  if (hasPreview || hasInputFile || hasFileName) return { ok: true, hasPreview, hasInputFile, hasFileName, images, canvasImages, fileInputs };
  return { ok: false, error: 'ChÆ°a tháº¥y áº£nh/file Ä‘Æ°á»£c attach thÃ nh preview hoáº·c file chip sau upload.', images, fileInputs, sampleText: bodyText.slice(-1000) };
}

function setGrokVideoPromptScript(prompt) {
  const selectors = [
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="Describe"]',
    'textarea[placeholder*="create" i]',
    'textarea',
    '#prompt-textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
  ];
  const candidates = selectors
    .flatMap((selector) => [...document.querySelectorAll(selector)])
    .filter((node) => {
      const rect = node.getBoundingClientRect?.();
      return rect && rect.width > 80 && rect.height > 20;
    })
    .map((node) => ({ node, rect: node.getBoundingClientRect(), label: `${node.getAttribute?.('placeholder') || ''} ${node.getAttribute?.('aria-label') || ''} ${node.textContent || ''}` }))
    .sort((a, b) => {
      const aImagine = /imagine/i.test(a.label) ? 1 : 0;
      const bImagine = /imagine/i.test(b.label) ? 1 : 0;
      if (aImagine !== bImagine) return bImagine - aImagine;
      return b.rect.top - a.rect.top;
    });
  const input = candidates[0]?.node;
  if (!input) return { ok: false, error: 'KhÃ´ng tÃ¬m tháº¥y Ã´ nháº­p prompt cá»§a Grok.' };
  input.scrollIntoView({ block: 'center' });
  input.focus();
  input.click();
  if ('value' in input) {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.value = prompt;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, prompt);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
  }
  return { ok: true, selector: input.tagName || input.getAttribute('role') || 'textbox' };
}

function detectGrokConfirmationQuestionScript() {
  const text = document.body?.innerText || '';
  const tail = text.slice(-3000);
  const asked = /Báº¡n muá»‘n tÃ´i sá»­ dá»¥ng prompt nÃ y Ä‘á»ƒ táº¡o video|HÃ£y xÃ¡c nháº­n Ä‘á»ƒ tÃ´i tiáº¿n hÃ nh generate|Would you like me to use this prompt|confirm.*generate|generate.*now/i.test(tail);
  const echoedMotionPrompt = /DÃ’NG\s*1|DÃ’NG\s*2|DÃ’NG\s*7|Negative\s*Prompt|Technical\s*Specifications/i.test(tail)
    && /MOTION\s*PROMPT|VIDEO\s*10|keyframe|8K|NO\s*MUSIC/i.test(tail);
  const hasVideo = /\.mp4|video generated|download|play video|regenerate/i.test(tail);
  return {
    shouldConfirm: (asked || echoedMotionPrompt) && !hasVideo,
    asked,
    echoedMotionPrompt,
    hasVideo,
    reason: asked ? 'asked-confirmation' : echoedMotionPrompt ? 'echoed-motion-prompt' : hasVideo ? 'video-present' : 'no-confirm-needed',
    tail,
  };
}

function detectGrokUploadStateScript() {
  const bodyText = document.body?.innerText || '';
  const uploading = /Uploading|Äang táº£i|uploading/i.test(bodyText);
  const visibleUploading = [...document.querySelectorAll('div, span, button')]
    .some((node) => {
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width < 10 || rect.height < 10 || rect.bottom < 0 || rect.right < 0) return false;
      return /Uploading|Äang táº£i|uploading/i.test(node.textContent || '');
    });
  return { ok: true, uploading: uploading || visibleUploading };
}

function clickGrokComposerAreaScript() {
  const candidates = [...document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"], input')];
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 30 && rect.height > 20 && rect.bottom > 0 && rect.right > 0;
  };
  const target = candidates.filter(visible).sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
  if (!target) return { ok: false, error: 'composer-not-found' };
  target.scrollIntoView({ block: 'center', inline: 'center' });
  target.focus?.();
  target.click?.();
  return { ok: true, tag: target.tagName, text: String(target.textContent || target.value || '').slice(0, 80) };
}

function dismissGrokConnectorsScript() {
  const actions = [];
  const textOf = (node) => `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim();
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 8 && rect.height > 8 && rect.bottom > 0 && rect.right > 0;
  };
  for (const node of [...document.querySelectorAll('[role="dialog"], [data-radix-dialog-content]')]) {
    if (/gmail|connector|connect/i.test(textOf(node))) {
      const close = [...node.querySelectorAll('button, [role="button"]')].find((button) => /close|back|dismiss|Ã—|â†/i.test(textOf(button)));
      if (close) {
        close.click();
        actions.push('close-connector-dialog');
      } else {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
        actions.push('escape-connector-dialog');
      }
    }
  }
  const buttons = [...document.querySelectorAll('button, [role="button"]')].filter(visible);
  const dismiss = buttons.find((button) => /^dismiss$/i.test(textOf(button)));
  if (dismiss) {
    dismiss.click();
    actions.push('dismiss-connectors-banner');
  }
  return { ok: true, actions, bodyHasConnectors: /Connectors are now available|New Connector|Gmail/i.test(document.body?.innerText || '') };
}

function forceGrokVideoModeScript() {
  const textOf = (node) => `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim();
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 8 && rect.height > 8 && rect.bottom > 0 && rect.right > 0;
  };
  const nodes = [...document.querySelectorAll('button, [role="tab"], [role="button"], label, div, span')]
    .filter(visible)
    .filter((node) => !/connect|connector|gmail|google drive|notion|vercel/i.test(textOf(node)));
  const motionTab = nodes.find((node) => {
    const rect = node.getBoundingClientRect?.();
    const text = textOf(node);
    if (!rect || rect.top > window.innerHeight * 0.75) return false;
    return /(^|\s)(Motion|Video)(\s|$)/i.test(text) && !/Image|Photo|áº¢nh/i.test(text);
  });
  if (!motionTab) return { ok: false, status: 'video-mode-button-not-found', buttons: nodes.map(textOf).filter(Boolean).slice(0, 80) };
  motionTab.scrollIntoView({ block: 'center', inline: 'center' });
  motionTab.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  motionTab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  motionTab.click();
  motionTab.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  return { ok: true, status: 'clicked-video-motion-mode', text: textOf(motionTab) };
}

function captureGrokSubmitStateScript() {
  return {
    url: location.href,
    textLength: (document.body?.innerText || '').length,
    tail: (document.body?.innerText || '').slice(-1200),
  };
}

function detectGrokGeneratingStateScript(before = {}) {
  const bodyText = document.body?.innerText || '';
  const tail = bodyText.slice(-2500);
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .map((node) => {
      const rect = node.getBoundingClientRect?.();
      const text = `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim();
      return { node, rect, text, html: node.innerHTML || '' };
    })
    .filter((item) => item.rect && item.rect.width > 10 && item.rect.height > 10);
  const stopButton = buttons.find((item) => {
    const nearComposer = item.rect.left > window.innerWidth * 0.72 && item.rect.top > window.innerHeight * 0.68;
    return nearComposer && (/stop|cancel|square/i.test(item.text) || /rect|square|stop/i.test(item.html));
  });
  const percentMatch = bodyText.match(/(?:Generating\s*)?(\d{1,3})\s*%/i);
  const hasProgressPercent = Boolean(percentMatch && Number(percentMatch[1]) >= 0 && Number(percentMatch[1]) <= 100);
  const thinking = /Thinking|Thinking about your request|Äang suy nghÄ©|Generating|Creating/i.test(tail);
  return {
    ok: true,
    generating: Boolean(stopButton || hasProgressPercent || thinking),
    mode: stopButton ? 'stop-button' : hasProgressPercent ? 'progress-percent' : thinking ? 'thinking-text' : '',
    stopText: stopButton?.text || '',
    progressPercent: hasProgressPercent ? Number(percentMatch[1]) : null,
    url: location.href,
    beforeUrl: before?.url || '',
    tail,
  };
}

function detectGrokGenerationProblemScript() {
  const bodyText = document.body?.innerText || '';
  const tail = bodyText.slice(-5000);
  const pathname = location.pathname || '';
  const shellText = [...document.querySelectorAll('nav, aside, header, [role="navigation"], [data-testid*="sidebar" i]')]
    .map((node) => node.innerText || node.textContent || '')
    .join('\n');
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .map((node) => {
      const rect = node.getBoundingClientRect?.();
      const text = `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim();
      return { node, rect, text };
    })
    .filter((item) => item.rect && item.rect.width > 10 && item.rect.height > 10);
  const retry = buttons.find((item) => /(^|\s)(Retry|Try again|Thá»­ láº¡i|Gá»­i láº¡i)(\s|$)/i.test(item.text));
  const unable = /Grok was unable to finish replying|unable to finish replying|couldn'?t finish|Something went wrong|try again/i.test(tail);
  const contentPolicy = /content policy|blocked by content policy|triggered moderation|cannot generate or retry|I cannot generate|adjust the prompt significantly|cháº·n.*content|vi pháº¡m.*chÃ­nh sÃ¡ch/i.test(tail);
  const limit = /Video generation hiá»‡n Ä‘ang gáº·p giá»›i háº¡n|generation.*limit|rate limit|too many requests|limit Ä‘Æ°á»£c reset|quota|usage limit|come back later|try again later|temporarily unavailable|temporarily disabled|not available right now|something went wrong while generating|failed to generate|generation failed|couldn'?t generate|can'?t generate|unable to generate|error generating|please try again later|try again in|daily limit|monthly limit|usage cap|credits|insufficient/i.test(tail);
  const hasSignedInShell = /SuperGrok|Imagine|Private|Projects|History|New Chat|Search|What do you want to know\?|What would you like to create\?|Type to imagine|Grok can make mistakes/i.test(`${bodyText}\n${shellText}`);
  const hasComposer = Boolean(document.querySelector('textarea, div[contenteditable="true"], [contenteditable="true"].ProseMirror, .ProseMirror[contenteditable="true"], [role="textbox"], input[type="file"]'));
  const visibleAuthButtons = buttons.some((item) => /^(Log in|Sign in|Sign up|Ðang nh?p|Get started)$/i.test(item.text));
  const authRoute = /\/sign[-_]?in|\/login|\/oauth|\/auth/i.test(pathname);
  const authCopyWithoutShell = /continue with google|sign up for free|sign up to keep chatting/i.test(bodyText) && !hasSignedInShell && !hasComposer;
  const loginRequired = (authRoute || visibleAuthButtons || authCopyWithoutShell) && !hasSignedInShell && !hasComposer;
  return {
    ok: true,
    kind: loginRequired ? 'login-required' : contentPolicy ? 'content-policy' : limit ? 'limit' : unable || retry ? 'unable-finish' : '',
    reason: loginRequired ? 'Grok page is showing login/sign-up controls.' : '',
    hasRetry: Boolean(retry),
    retryBox: retry?.rect ? { x: retry.rect.x, y: retry.rect.y, width: retry.rect.width, height: retry.rect.height } : null,
    retryText: retry?.text || '',
    tail,
  };
}

async function clickGrokRetryButton(client, state = null) {
  const current = state || await evaluateOnCdpPage(client, `(${detectGrokGenerationProblemScript.toString()})()`).catch(() => null);
  if (!current?.retryBox) return { ok: false, error: 'KhÃ´ng tháº¥y nÃºt Retry Grok.' };
  const x = current.retryBox.x + current.retryBox.width / 2;
  const y = current.retryBox.y + current.retryBox.height / 2;
  await client.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y, button: 'none' }).catch(() => null);
  await client.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 }).catch(() => null);
  await client.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }).catch(() => null);
  return { ok: true, mode: 'clicked-retry', point: { x, y }, retryText: current.retryText };
}

function clickGrokBottomRightSendScript() {
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width >= 18 && rect.height >= 18 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
  };
  const textOf = (node) => `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''} ${node.dataset?.testid || ''}`.trim();
  const active = document.activeElement;
  const roots = [];
  let node = active;
  for (let depth = 0; node && depth < 12; depth += 1, node = node.parentElement) {
    const rect = node.getBoundingClientRect?.();
    if (rect && rect.width > 420 && rect.height > 70 && rect.height < window.innerHeight * 0.55 && rect.bottom > window.innerHeight * 0.52) roots.push(node);
  }
  roots.push(...[...document.querySelectorAll('form, [role="dialog"], [class]')].filter((item) => {
    const rect = item.getBoundingClientRect?.();
    const text = item.innerText || item.textContent || '';
    return rect && rect.width > 420 && rect.height > 70 && rect.height < window.innerHeight * 0.55 && rect.bottom > window.innerHeight * 0.52 && /Agent|Image|Video|Negative Prompt|D[OÃ’Ò]NG|Technical Specifications|NO MUSIC/i.test(text);
  }));
  const root = [...new Set(roots)].sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return (ar.width * ar.height) - (br.width * br.height);
  })[0];
  const rootRect = root?.getBoundingClientRect?.();
  const scope = root || document;
  const buttons = [...scope.querySelectorAll('button, [role="button"]')]
    .map((button) => ({ button, rect: button.getBoundingClientRect?.(), label: textOf(button), html: button.innerHTML || '' }))
    .filter((item) => {
      if (!item.rect || item.rect.width < 20 || item.rect.height < 20) return false;
      if (item.button.disabled || item.button.getAttribute('aria-disabled') === 'true') return false;
      const inBottomRight = rootRect
        ? item.rect.left >= rootRect.right - 110 && item.rect.top >= rootRect.bottom - 100 && item.rect.right <= rootRect.right + 8 && item.rect.bottom <= rootRect.bottom + 8
        : item.rect.left >= window.innerWidth * 0.72 && item.rect.top >= window.innerHeight * 0.62;
      if (!inBottomRight) return false;
      const label = `${item.label} ${item.html}`;
      if (/mic|microphone|voice|audio|record|attach|upload|plus|image|video\s*$|agent|quality|480p|720p|6s|10s/i.test(label) && !/send|submit|arrow-up|lucide-send|paper/i.test(label)) return false;
      return true;
    })
    .sort((a, b) => (b.rect.right - a.rect.right) || (b.rect.bottom - a.rect.bottom));
  const byButton = buttons[0];
  const candidates = [];
  if (byButton) candidates.push({ el: byButton.button, rect: byButton.rect, label: byButton.label || 'bottom-right-button', mode: 'button-query' });
  const hitPoints = rootRect
    ? [[rootRect.right - 24, rootRect.bottom - 28], [rootRect.right - 42, rootRect.bottom - 32], [rootRect.right - 64, rootRect.bottom - 42]]
    : [[window.innerWidth - 48, window.innerHeight - 70], [window.innerWidth - 72, window.innerHeight - 90]];
  for (const [x, y] of hitPoints) {
    let el = document.elementFromPoint(x, y);
    for (let depth = 0; el && depth < 5; depth += 1, el = el.parentElement) {
      if (visible(el) && el.matches?.('button, [role="button"]')) {
        const rect = el.getBoundingClientRect();
        candidates.push({ el, rect, label: textOf(el) || 'elementFromPoint', mode: 'elementFromPoint' });
        break;
      }
    }
  }
  const picked = candidates.find((item) => item.el && !item.el.disabled && item.el.getAttribute?.('aria-disabled') !== 'true');
  if (!picked) return { ok: false, error: 'no-bottom-right-send', rootBox: rootRect ? { x: rootRect.x, y: rootRect.y, width: rootRect.width, height: rootRect.height } : null, buttons: buttons.map((item) => ({ label: item.label, box: { x: item.rect.x, y: item.rect.y, w: item.rect.width, h: item.rect.height } })).slice(0, 12) };
  picked.el.scrollIntoView({ block: 'center', inline: 'center' });
  const cx = picked.rect.x + picked.rect.width / 2;
  const cy = picked.rect.y + picked.rect.height / 2;
  picked.el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', isPrimary: true, clientX: cx, clientY: cy }));
  picked.el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy }));
  picked.el.click();
  picked.el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx, clientY: cy }));
  return { ok: true, mode: picked.mode, selector: picked.label, box: { x: picked.rect.x, y: picked.rect.y, width: picked.rect.width, height: picked.rect.height }, rootBox: rootRect ? { x: rootRect.x, y: rootRect.y, width: rootRect.width, height: rootRect.height } : null };
}

function clickGrokGenerateScript() {
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width >= 8 && rect.height >= 8 && rect.bottom > 0 && rect.right > 0;
  };
  const textOf = (node) => `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''} ${node.dataset?.testid || ''}`.trim();
  const active = document.activeElement;
  const roots = [];
  let node = active;
  for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
    const rect = node.getBoundingClientRect?.();
    if (rect && rect.width > 360 && rect.height > 90 && rect.height < 260 && rect.bottom > window.innerHeight * 0.55) roots.push(node);
  }
  roots.push(...[...document.querySelectorAll('form, [role="dialog"], [class]')].filter((item) => {
    const rect = item.getBoundingClientRect?.();
    const text = item.innerText || '';
    return rect && rect.width > 360 && rect.height > 90 && rect.height < 260 && rect.bottom > window.innerHeight * 0.55 && /Agent|Image|Video|Original|Negative Prompt|DÃ’NG|DONG|NO soundtrack/i.test(text);
  }));
  const root = [...new Set(roots)].sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return (ar.width * ar.height) - (br.width * br.height);
  })[0];
  const rootRect = root?.getBoundingClientRect?.();
  const scope = root || document;
  const buttons = [...scope.querySelectorAll('button, [role="button"]')]
    .map((button) => ({ button, rect: button.getBoundingClientRect?.(), label: textOf(button), html: button.innerHTML || '' }))
    .filter((item) => {
      if (!item.rect || item.rect.width < 20 || item.rect.height < 20) return false;
      if (item.button.disabled || item.button.getAttribute('aria-disabled') === 'true') return false;
      if (rootRect) {
        if (item.rect.left < rootRect.left || item.rect.right > rootRect.right + 3 || item.rect.top < rootRect.top || item.rect.bottom > rootRect.bottom + 3) return false;
        if (item.rect.left < rootRect.right - 95) return false;
        if (item.rect.top < rootRect.bottom - 85) return false;
      } else {
        if (item.rect.left < window.innerWidth * 0.78 || item.rect.top < window.innerHeight * 0.68) return false;
      }
      const compactRightArrow = item.rect.width <= 58 && item.rect.height <= 58 && (!rootRect || (item.rect.left > rootRect.right - 80 && item.rect.top > rootRect.bottom - 80));
      if (/microphone|voice|audio|attach|upload|new chat/i.test(item.label) && !compactRightArrow) return false;
      if (/^\s*(Agent\s*\(?Beta\)?|Original|Image|Video|Speed|Quality|2:3|16:9|480p|720p|6s|10s)\s*$/i.test(item.label)) return false;
      return true;
    })
    .sort((a, b) => (b.rect.right - a.rect.right) || (b.rect.bottom - a.rect.bottom));
  const sendButton = buttons[0];
  const debugButtons = [...scope.querySelectorAll('button, [role="button"]')]
    .map((button) => {
      const rect = button.getBoundingClientRect?.();
      return rect ? { label: textOf(button).slice(0, 120), box: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }, disabled: button.disabled || button.getAttribute('aria-disabled') === 'true' } : null;
    })
    .filter(Boolean)
    .filter((item) => !rootRect || (item.box.x >= rootRect.left - 2 && item.box.y >= rootRect.top - 2 && item.box.x <= rootRect.right + 2 && item.box.y <= rootRect.bottom + 2));
  if (!sendButton) return { ok: false, error: 'KhÃ´ng tÃ¬m tháº¥y nÃºt mÅ©i tÃªn Send trong composer Grok.', rootBox: rootRect ? { x: rootRect.x, y: rootRect.y, width: rootRect.width, height: rootRect.height } : null, buttons: debugButtons };
  sendButton.button.scrollIntoView({ block: 'center', inline: 'center' });
  sendButton.button.focus();
  sendButton.button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', isPrimary: true }));
  sendButton.button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  sendButton.button.click();
  sendButton.button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  const rect = sendButton.rect;
  return { ok: true, selector: sendButton.label || 'grok-composer-rightmost-send', box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, rootBox: rootRect ? { x: rootRect.x, y: rootRect.y, width: rootRect.width, height: rootRect.height } : null, buttons: debugButtons };
}

function prepareChatGptCreateImageScript() {
  const textOf = (node) => `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim();
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 4 && rect.height > 4;
  };
  const clickNode = (node) => {
    node.scrollIntoView({ block: 'center', inline: 'center' });
    node.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    node.click();
    node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  };
  const plus = [...document.querySelectorAll('button, [role="button"]')]
    .filter(visible)
    .find((node) => /Add files and more|Attach|Add|\+/i.test(textOf(node)) || (node.getBoundingClientRect().width <= 60 && /svg|path/i.test(node.innerHTML || '')));
  if (plus) clickNode(plus);
  const startedAt = Date.now();
  while (Date.now() - startedAt < 1500) {
    const createImage = [...document.querySelectorAll('button, [role="menuitem"], [role="option"], div, span')]
      .filter(visible)
      .find((node) => /Create image|Táº¡o áº£nh|Generate image/i.test(textOf(node)));
    if (createImage) {
      clickNode(createImage);
      return { ok: true, mode: 'create-image-menu' };
    }
  }
  return { ok: Boolean(plus), mode: plus ? 'plus-opened-no-create-image-item' : 'no-plus-found' };
}

function clickPixVerseCreateScript() {
  const nodes = [...document.querySelectorAll('button, [role="button"]')];
  const createButton = nodes.find((button) => {
    if (button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
    const rect = button.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 24) return false;
    const text = `${button.textContent || ''} ${button.getAttribute('aria-label') || ''} ${button.title || ''}`;
    return /Create|Generate|Start/i.test(text);
  });
  if (!createButton) return { ok: false, error: 'KhÃ´ng tÃ¬m tháº¥y nÃºt Create PixVerse Ä‘ang enabled.' };
  createButton.scrollIntoView({ block: 'center', inline: 'center' });
  createButton.click();
  const rect = createButton.getBoundingClientRect();
  return { ok: true, selector: createButton.textContent || createButton.getAttribute('aria-label') || 'Create', box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
}

function readLatestAssistantScript() {
  const bodyTail = String(document.body?.innerText || '').slice(-4000);
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .map((node) => {
      const rect = node.getBoundingClientRect?.();
      const text = `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim();
      const html = String(node.innerHTML || '').slice(0, 1000);
      return { node, rect, text, html };
    })
    .filter((item) => item.rect && item.rect.width > 8 && item.rect.height > 8);
  const composerButtons = buttons.filter((item) => item.rect.top > window.innerHeight * 0.72 && item.rect.left > window.innerWidth * 0.55);
  const stopButton = composerButtons.some((item) => /stop|cancel|dá»«ng/i.test(item.text) || /<rect|data-icon=["']stop|stop-circle|square/i.test(item.html));
  const voiceReady = composerButtons.some((item) => /voice|mic|microphone|record|dictate/i.test(item.text) || /waveform|audio|voice|mic/i.test(item.html));
  const thinkingText = /Thinking about your request|Äang suy nghÄ©|Generating|Creating/i.test(bodyTail);
  const roleNodes = [...document.querySelectorAll('[data-message-author-role="assistant"]')]
    .filter((node) => (node.innerText || '').trim().length > 20);
  const fallbackNodes = [...document.querySelectorAll('article, .message, [class*="response"], [class*="markdown"]')]
    .filter((node) => {
      if (node.closest?.('[data-message-author-role="user"]')) return false;
      if (node.querySelector?.('[data-message-author-role="user"]')) return false;
      const text = (node.innerText || '').trim();
      if (text.length <= 20) return false;
      if (/^NHIá»†M\s*Vá»¤\s*2\s*:|^Dá»±a trÃªn áº£nh keyframe|Show more/i.test(text)) return false;
      return true;
    });
  const nodes = roleNodes.length ? roleNodes : fallbackNodes;
  const last = nodes.at(-1);
  return {
    count: nodes.length,
    text: last ? last.innerText.trim() : '',
    generating: stopButton || (thinkingText && !voiceReady),
    stopButton,
    voiceReady,
    composerButtonCount: composerButtons.length,
    mode: roleNodes.length ? 'assistant-role' : 'fallback-non-user',
  };
}

function clickChatGptStopGeneratingScript() {
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .map((node) => {
      const rect = node.getBoundingClientRect?.();
      const text = `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim();
      return { node, rect, text, html: String(node.innerHTML || '').slice(0, 500) };
    })
    .filter((item) => item.rect && item.rect.width > 8 && item.rect.height > 8);
  const stop = buttons.find((item) => {
    const nearComposer = item.rect.left > window.innerWidth * 0.65 && item.rect.top > window.innerHeight * 0.65;
    return nearComposer && (/stop|cancel|dá»«ng/i.test(item.text) || /rect|square|stop/i.test(item.html));
  }) || buttons.find((item) => /stop generating|stop|dá»«ng/i.test(item.text));
  if (!stop) return { ok: false, error: 'stop-button-not-found', buttonCount: buttons.length };
  stop.node.scrollIntoView({ block: 'center', inline: 'center' });
  stop.node.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: stop.rect.x + stop.rect.width / 2, clientY: stop.rect.y + stop.rect.height / 2 }));
  stop.node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: stop.rect.x + stop.rect.width / 2, clientY: stop.rect.y + stop.rect.height / 2 }));
  stop.node.click();
  stop.node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: stop.rect.x + stop.rect.width / 2, clientY: stop.rect.y + stop.rect.height / 2 }));
  return { ok: true, mode: 'clicked-stop', text: stop.text, box: { x: stop.rect.x, y: stop.rect.y, width: stop.rect.width, height: stop.rect.height } };
}

function findChatGptConversationScript(title = '') {
  const wanted = String(title || '').trim().toLowerCase();
  if (!wanted) return { ok: true, skipped: true };
  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const candidates = [...document.querySelectorAll('nav a, aside a, [role="navigation"] a, a[href*="/c/"], button')]
    .map((node) => {
      const text = normalize(node.innerText || node.textContent || node.getAttribute('aria-label') || node.title || '');
      const rect = node.getBoundingClientRect?.();
      return { node, text, rect };
    })
    .filter((item) => item.text && item.rect && item.rect.width > 20 && item.rect.height > 10)
    .filter((item) => item.text === wanted || item.text.includes(wanted) || wanted.includes(item.text));
  const best = candidates[0];
  if (!best) return { ok: false, error: `KhÃ´ng tháº¥y chat "${title}"`, sample: [...document.querySelectorAll('nav a, aside a, a[href*="/c/"]')].slice(0, 20).map((node) => (node.innerText || node.textContent || '').trim()).filter(Boolean) };
  best.node.scrollIntoView({ block: 'center' });
  const rect = best.node.getBoundingClientRect();
  return { ok: true, title: best.text, box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
}

function readChatGptImageStateScript() {
  const bodyText = document.body?.innerText || '';
  const bodyTail = bodyText.slice(-4000);
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .map((button) => {
      const rect = button.getBoundingClientRect?.();
      const text = `${button.textContent || ''} ${button.getAttribute?.('aria-label') || ''} ${button.title || ''}`.trim();
      const html = String(button.innerHTML || '').slice(0, 1000);
      return { button, rect, text, html };
    })
    .filter((item) => item.rect && item.rect.width > 8 && item.rect.height > 8);
  const composerButtons = buttons.filter((item) => item.rect.top > window.innerHeight * 0.72 && item.rect.left > window.innerWidth * 0.55);
  const buttonText = buttons.map((item) => item.text).filter(Boolean).join(' | ');
  const stopButton = composerButtons.some((item) => /stop|cancel|dá»«ng/i.test(item.text) || /<rect|data-icon=["']stop|stop-circle|square/i.test(item.html));
  const voiceReady = composerButtons.some((item) => /voice|mic|microphone|record|dictate/i.test(item.text) || /waveform|audio|voice|mic/i.test(item.html));
  const thinkingText = /Thinking about your request|Äang suy nghÄ©|Generating|Creating/i.test(bodyTail);
  const generating = stopButton || (thinkingText && !voiceReady);
  const preparingImage = /preparing image|creating image|generating image|Ä‘ang táº¡o áº£nh|Ä‘ang chuáº©n bá»‹ áº£nh|defining scene for image generation|This prepares the scene for the cat'?s intervention/i.test(bodyText);
  const loggedOut = /(^|\n)\s*(sign in|log in|Ä‘Äƒng nháº­p|sign up)\s*($|\n)|sign up to keep chatting|continue with google/i.test(bodyText)
    && !/ChatGPT can make mistakes|Share|Ask anything/i.test(bodyText.slice(-3000));
  const mediaRoots = [...document.querySelectorAll('[data-message-author-role="assistant"], article, .message, [class*="response"]')]
    .filter((node) => node.querySelector?.('img, picture source, canvas') || /Generated image/i.test(node.innerText || ''));
  const mediaRoot = mediaRoots.at(-1) || document;
  const urls = [...mediaRoot.querySelectorAll('img, picture source')]
    .filter((node) => {
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width < 180 || rect.height < 120) return false;
      const label = `${node.alt || ''} ${node.getAttribute?.('aria-label') || ''} ${node.className || ''}`;
      return !/avatar|profile|logo|icon|emoji/i.test(label);
    })
    .map((node) => node.currentSrc || node.src || node.getAttribute('srcset') || node.getAttribute('src') || '')
    .filter((url) => /^https?:|^blob:|^data:image\//i.test(url));

  const loadingMediaText = /defining scene for image generation|preparing image|creating image|generating image|Ä‘ang táº¡o áº£nh|Ä‘ang chuáº©n bá»‹ áº£nh/i.test(bodyText);
  const renderedImageHint = /Generated image|Edit image|Download|Táº£i xuá»‘ng|Open image|Image created|áº¢nh Ä‘Ã£ Ä‘Æ°á»£c táº¡o/i.test(bodyText);
  const visibleImageBoxes = [...mediaRoot.querySelectorAll('img, canvas, button, div')]
    .map((node) => {
      const rect = node.getBoundingClientRect?.();
      const style = window.getComputedStyle?.(node);
      const text = node.innerText || '';
      const label = `${node.alt || ''} ${node.getAttribute?.('aria-label') || ''} ${node.className || ''}`;
      const isMedia = node.tagName === 'IMG'
        || node.tagName === 'CANVAS'
        || (/Edit|Generated image/i.test(text) && node.querySelector?.('button'))
        || (style?.backgroundImage && style.backgroundImage !== 'none' && !style.backgroundImage.includes('gradient'));
      return rect && isMedia && rect.width >= 180 && rect.height >= 120 && !/avatar|profile|logo|icon|emoji/i.test(label)
        ? { y: Math.round(rect.y + window.scrollY), w: Math.round(rect.width), h: Math.round(rect.height), tag: node.tagName }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.y - a.y);
  if (!urls.length && visibleImageBoxes.length && !loadingMediaText && renderedImageHint) urls.push(`chatgpt-custom-box-y${visibleImageBoxes[0].y}`);
  if (!urls.length && visibleImageBoxes.length && renderedImageHint) urls.push(`chatgpt-custom-box-y${visibleImageBoxes[0].y}`);

  const roleAssistantNodes = [...document.querySelectorAll('[data-message-author-role="assistant"]')]
    .filter((node) => (node.innerText || '').trim().length > 20);
  const fallbackAssistantNodes = [...document.querySelectorAll('article, .message, [class*="response"], [class*="markdown"]')]
    .filter((node) => {
      if (node.closest?.('[data-message-author-role="user"]')) return false;
      if (node.querySelector?.('[data-message-author-role="user"]')) return false;
      const text = (node.innerText || '').trim();
      if (text.length <= 20) return false;
      if (/^NHIá»†M\s*Vá»¤\s*1\s*:|^NHIá»†M\s*Vá»¤\s*2\s*:|^---\s*SCENE|^Dá»±a trÃªn áº£nh keyframe|Show more|Show less/i.test(text)) return false;
      return true;
    });
  const assistantNodes = roleAssistantNodes.length ? roleAssistantNodes : fallbackAssistantNodes;
  const latestAssistantText = assistantNodes.at(-1)?.innerText?.trim() || '';
  const renderedImageReady = Boolean(urls.length || (visibleImageBoxes.length && renderedImageHint));
  const effectiveGenerating = renderedImageReady && !stopButton ? false : generating;
  const effectivePreparingImage = renderedImageReady
    ? false
    : /defining scene for image generation|preparing image|creating image|generating image/i.test(bodyTail);
  return {
    generating: effectiveGenerating,
    stopButton,
    preparingImage: effectivePreparingImage,
    loggedOut,
    logoutReason: loggedOut ? 'ChatGPT page is showing sign-in/sign-up while waiting for image.' : '',
    voiceReady,
    composerButtonCount: composerButtons.length,
    buttonText,
    urls,
    visibleImageBoxes,
    assistantCount: assistantNodes.length,
    latestAssistantText,
    assistantMode: roleAssistantNodes.length ? 'assistant-role' : 'fallback-non-user',
  };
}

async function exportProject(_event, payload) {
  const result = await dialog.showSaveDialog({
    title: 'Export project JSON',
    defaultPath: `${sanitizeFileName(payload?.project?.name || 'ai-scene-project')}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  const jsonPath = result.filePath;
  const csvPath = jsonPath.replace(/\.json$/i, '.csv');
  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  if (payload?.csv) {
    await fs.writeFile(csvPath, payload.csv, 'utf8');
  }
  return { jsonPath, csvPath };
}

function sanitizeFileName(value) {
  return String(value).replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, '-').slice(0, 80) || 'ai-scene-project';
}

app.whenReady().then(() => {
  ipcMain.handle('app:append-log', appendAppLog);
  ipcMain.handle('app:get-log-path', getAppLogPath);
  ipcMain.handle('prompt:open-hard-file', openHardPromptFile);
  ipcMain.handle('router:open-grok-folder', openGrokRouterFolder);
  ipcMain.handle('router:get-status', getGrokRouterStatus);
  ipcMain.handle('router:list-accounts-safe', listGrokAccountsSafe);
  ipcMain.handle('router:select-account', selectGrokAccount);
  ipcMain.handle('router:set-enabled', setAccountRouterEnabled);
  ipcMain.handle('router:resume-checkpoint', resumeFromRouterCheckpoint);
  ipcMain.handle('accounts:list-safe', listWebAccountsSafe);
  ipcMain.handle('accounts:save', saveWebAccount);
  ipcMain.handle('accounts:delete', deleteWebAccount);
  ipcMain.handle('view:get-pipeline-log-visible', getPipelineLogVisibility);
  ipcMain.handle('browser:open-login', openWebLogin);
  ipcMain.handle('browser:check-login', checkWebLogin);
  ipcMain.handle('browser:send-prompt', sendPromptViaWeb);
  ipcMain.handle('pipeline:run-scene', runScenePipeline);
  ipcMain.handle('output:choose-folder', chooseOutputFolder);
  ipcMain.handle('project:choose-root-folder', chooseProjectRootFolder);
  ipcMain.handle('folder:choose', chooseFolder);
  ipcMain.handle('folder:scan', scanFolder);
  ipcMain.handle('video:extract-last-frame', extractLastFrame);
  ipcMain.handle('video:merge', mergeVideos);
  ipcMain.handle('video:export-final', exportFinalVideo);
  ipcMain.handle('image:copy-to-clipboard', copyImageToClipboard);
  ipcMain.handle('asset:exists', checkAssetExists);
  ipcMain.handle('frame:get-previous', getPreviousFrame);
  ipcMain.handle('ai:split-prompt', splitPromptWithAI);
  ipcMain.handle('ai:generate-scene-prompts', generateScenePrompts);
  ipcMain.handle('chatgpt:rename-current-chat', renameChatGptCurrentConversation);
  ipcMain.handle('project:export', exportProject);
  ipcMain.handle('project:new-session', newProjectSession);
  ipcMain.handle('project:save-session-file', saveProjectSessionFile);
  ipcMain.handle('project:overwrite-session-file', overwriteProjectSessionFile);
  ipcMain.handle('project:create-session-file', createProjectSessionFile);
  ipcMain.handle('project:open-session-file', openProjectSessionFile);
  ipcMain.handle('project:ensure-scene-folders', ensureProjectSceneFolders);

  buildAppMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  closeChromeDebug().catch(() => null);
});

process.on('exit', () => {
  if (chromeProcess?.pid) {
    try { process.kill(chromeProcess.pid); } catch (_error) { }
  }
});
