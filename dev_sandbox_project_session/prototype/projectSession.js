const SUPPORTED_SCHEMA_VERSION = 1;
const TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'appVersion',
  'savedAt',
  'project',
  'inputs',
  'config',
  'router',
  'runtime',
  'assets',
  'previewTimeline',
  'extensions'
]);

const SECRET_KEY_RE = /(api[_-]?key|authorization|bearer|cookie|password|passwd|secret|session[_-]?token|refresh[_-]?token|access[_-]?token|rawbrowserstorage|localstorage|indexeddb)/i;
const SECRET_VALUE_RE = /(Bearer\s+[A-Za-z0-9._~+/=-]{8,}|sk-[A-Za-z0-9]{12,}|xox[baprs]-[A-Za-z0-9-]{8,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|api[_-]?key\s*[:=]|cookie\s*[:=]|password\s*[:=])/i;
const FULL_PRIVATE_EMAIL_RE = /\b[A-Z0-9._%+-]+@(gmail|yahoo|outlook|hotmail|icloud|proton|aol|live)\.[A-Z]{2,}\b/i;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asObject(value) {
  return isObject(value) ? value : {};
}

function safeString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function redactedLabel(value) {
  if (typeof value !== 'string') return value ?? null;
  return FULL_PRIVATE_EMAIL_RE.test(value) ? '[redacted-email]' : value;
}

function collectUnknownTopLevel(payload) {
  const extensions = asObject(payload.extensions);
  const unknownTopLevel = {};
  for (const key of Object.keys(payload || {})) {
    if (!TOP_LEVEL_KEYS.has(key)) unknownTopLevel[key] = clone(payload[key]);
  }
  return Object.keys(unknownTopLevel).length
    ? { ...extensions, unknownTopLevel }
    : extensions;
}

function stripSecretFields(value) {
  if (Array.isArray(value)) return value.map(stripSecretFields).filter((item) => item !== undefined);
  if (!isObject(value)) return value;

  const cleaned = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEY_RE.test(key)) continue;
    const cleanedValue = stripSecretFields(item);
    if (cleanedValue !== undefined) cleaned[key] = cleanedValue;
  }
  return cleaned;
}

function sanitizeScene(scene, index) {
  const source = asObject(scene);
  return stripSecretFields({
    sceneId: safeString(source.sceneId || source.id, `scene-${String(index + 1).padStart(3, '0')}`),
    sceneIndex: safeNumber(source.sceneIndex, index),
    rawSceneText: safeString(source.rawSceneText || source.original),
    imagePrompt: safeString(source.imagePrompt),
    motionPrompt: safeString(source.motionPrompt),
    imagePath: source.imagePath || null,
    videoPath: source.videoPath || null,
    status: safeString(source.status, 'draft'),
    progressStep: safeString(source.progressStep),
    reviewType: safeString(source.reviewType),
    errorClassification: source.errorClassification || null,
    promptVersion: safeString(source.promptVersion, 'v1'),
    updatedAt: safeString(source.updatedAt, nowIso())
  });
}

function sanitizeRouter(router) {
  const source = stripSecretFields(asObject(router));
  const labels = asObject(source.selectedLabels);
  return {
    accountRouterEnabled: Boolean(source.accountRouterEnabled),
    selectedGrokAccountId: source.selectedGrokAccountId ? String(source.selectedGrokAccountId) : null,
    routingPolicy: safeString(source.routingPolicy, 'manual'),
    selectedLabels: {
      provider: redactedLabel(labels.provider || ''),
      model: redactedLabel(labels.model || ''),
      account: redactedLabel(labels.account || '')
    },
    status: stripSecretFields(asObject(source.status))
  };
}

function sanitizeRuntime(runtime) {
  const source = stripSecretFields(asObject(runtime));
  return {
    currentStage: safeString(source.currentStage, 'idle'),
    currentBatchIndex: safeNumber(source.currentBatchIndex, 0),
    currentSceneId: source.currentSceneId || null,
    activeBatchIds: Array.isArray(source.activeBatchIds) ? source.activeBatchIds.map((id) => String(id)) : [],
    paused: Boolean(source.paused),
    lastCheckpointRef: source.lastCheckpointRef || null,
    lastAction: source.lastAction || null,
    resumeMode: safeString(source.resumeMode, 'manual-start'),
    lastErrorClassification: source.lastErrorClassification || null,
    activePreviewTimeline: Array.isArray(source.activePreviewTimeline) ? source.activePreviewTimeline.map(stripSecretFields) : [],
    autoRun: false,
    waitingForUserStart: true
  };
}

const KEYFRAME_STATUSES = new Set(['image_pending', 'image_generating', 'keyframe_pending', 'keyframe_generating']);
const IMAGE_READY_STATUSES = new Set(['image_done', 'image_generated', 'motion_prompt_pending', 'motion_prompt_generated', 'video_pending', 'video_generating']);
const VIDEO_READY_STATUSES = new Set(['video_done', 'video_generated', 'video_ready']);

function sceneRef(scene, index = 0) {
  return String(scene?.sceneId || scene?.id || `scene-${String(index + 1).padStart(3, '0')}`);
}

function isVideoComplete(scene = {}) {
  return Boolean(scene.videoPath) || VIDEO_READY_STATUSES.has(scene.status);
}

function hasKeyframe(scene = {}) {
  return Boolean(scene.imagePath || scene.imageDataUrl) || IMAGE_READY_STATUSES.has(scene.status) || isVideoComplete(scene);
}

function orderActiveScenes(project = {}, runtime = {}) {
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const activeIds = Array.isArray(runtime.activeBatchIds) ? runtime.activeBatchIds.map(String) : [];
  const activeScenes = activeIds.length
    ? activeIds.map((id) => scenes.find((scene, index) => String(scene.id) === id || sceneRef(scene, index) === id)).filter(Boolean)
    : scenes;
  const currentId = runtime.currentSceneId != null ? String(runtime.currentSceneId) : '';
  if (!currentId) return activeScenes;
  const currentIndex = activeScenes.findIndex((scene, index) => String(scene.id) === currentId || sceneRef(scene, index) === currentId);
  return currentIndex > 0 ? activeScenes.slice(currentIndex).concat(activeScenes.slice(0, currentIndex)) : activeScenes;
}

function getNextResumeAction(projectState = {}) {
  const project = asObject(projectState.project);
  const runtime = asObject(projectState.runtime);
  const scenes = orderActiveScenes(project, runtime);
  for (const scene of scenes) {
    if (isVideoComplete(scene)) continue;
    if (!hasKeyframe(scene) || KEYFRAME_STATUSES.has(scene.status)) {
      return { action: 'generate_keyframe', currentStage: 'generating_keyframe', sceneId: sceneRef(scene, scene.sceneIndex), status: scene.status };
    }
    if (!scene.motionPrompt) {
      return { action: 'generate_motion_prompt', currentStage: 'generating_motion_prompt', sceneId: sceneRef(scene, scene.sceneIndex), status: scene.status };
    }
    return { action: 'generate_video', currentStage: 'generating_video', sceneId: sceneRef(scene, scene.sceneIndex), status: scene.status };
  }
  return { action: 'batch_complete', currentStage: 'batch_complete', sceneId: null, status: 'complete' };
}

function sanitizeProjectPayload(payload) {
  const source = asObject(payload);
  const project = asObject(source.project);
  const scenes = Array.isArray(project.scenes) ? project.scenes.map(sanitizeScene) : [];

  return {
    schemaVersion: source.schemaVersion,
    appVersion: safeString(source.appVersion, 'sandbox-phase1'),
    savedAt: safeString(source.savedAt, nowIso()),
    project: {
      id: safeString(project.id, `project-${Date.now()}`),
      name: safeString(project.name, 'Untitled Project'),
      description: safeString(project.description),
      createdAt: safeString(project.createdAt, nowIso()),
      updatedAt: safeString(project.updatedAt, nowIso()),
      scenes
    },
    inputs: stripSecretFields(asObject(source.inputs)),
    config: stripSecretFields(asObject(source.config)),
    router: sanitizeRouter(source.router),
    runtime: sanitizeRuntime(source.runtime),
    assets: stripSecretFields({
      images: Array.isArray(source.assets?.images) ? source.assets.images : [],
      videos: Array.isArray(source.assets?.videos) ? source.assets.videos : [],
      finalOutputs: Array.isArray(source.assets?.finalOutputs) ? source.assets.finalOutputs : []
    }),
    previewTimeline: Array.isArray(source.previewTimeline) ? source.previewTimeline.map(stripSecretFields) : [],
    extensions: stripSecretFields(collectUnknownTopLevel(source))
  };
}

function scanProjectForSecrets(payload) {
  const findings = [];
  function visit(value, path) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (isObject(value)) {
      for (const [key, item] of Object.entries(value)) {
        const nextPath = path ? `${path}.${key}` : key;
        if (SECRET_KEY_RE.test(key)) findings.push({ path: nextPath, reason: 'secret-like key' });
        visit(item, nextPath);
      }
      return;
    }
    if (typeof value === 'string') {
      if (SECRET_VALUE_RE.test(value)) findings.push({ path, reason: 'secret-like value' });
      if (FULL_PRIVATE_EMAIL_RE.test(value)) findings.push({ path, reason: 'full private email' });
    }
  }
  visit(payload, '');
  return { ok: findings.length === 0, findings };
}

function validateProjectFile(payload) {
  const errors = [];
  if (!isObject(payload)) errors.push('Project file must be a JSON object.');
  if (isObject(payload) && !Object.hasOwn(payload, 'schemaVersion')) errors.push('Project file is missing required schemaVersion.');
  if (isObject(payload) && typeof payload.schemaVersion !== 'number') errors.push('schemaVersion must be a number.');
  if (isObject(payload) && typeof payload.schemaVersion === 'number' && payload.schemaVersion > SUPPORTED_SCHEMA_VERSION) {
    errors.push(`Unsupported future schemaVersion ${payload.schemaVersion}; supported version is ${SUPPORTED_SCHEMA_VERSION}.`);
  }
  if (!Array.isArray(payload?.project?.scenes)) errors.push('project.scenes must be an array.');
  if (!isObject(payload?.runtime)) errors.push('runtime must exist and be an object.');

  const secrets = scanProjectForSecrets(payload);
  if (!secrets.ok) errors.push(`Project contains secret-like data at: ${secrets.findings.map((f) => f.path).join(', ')}`);
  return { ok: errors.length === 0, errors, secretFindings: secrets.findings };
}

function migrateProjectFile(payload) {
  const validation = validateProjectFile(payload);
  if (!validation.ok) return { ok: false, errors: validation.errors };
  if (payload.schemaVersion === SUPPORTED_SCHEMA_VERSION) return { ok: true, payload: sanitizeProjectPayload(payload), warnings: [] };
  return { ok: false, errors: [`No migration path for schemaVersion ${payload.schemaVersion}.`] };
}

function createNewProjectSession(options = {}) {
  const existingState = asObject(options.currentState);
  if (hasUnsavedChanges(existingState) && !options.confirmed) {
    return { action: 'confirm-discard-or-save', reason: 'unsaved-changes', state: existingState };
  }

  const globalSettings = clone(existingState.globalSettings || options.globalSettings || {});
  return {
    action: 'created',
    state: {
      dirty: false,
      savedAt: null,
      globalSettings,
      secureCredentialRefs: clone(existingState.secureCredentialRefs || {}),
      project: {
        id: `project-${Date.now()}`,
        name: 'Untitled Project',
        description: '',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        scenes: []
      },
      inputs: {},
      config: {},
      router: { accountRouterEnabled: false, selectedGrokAccountId: null, routingPolicy: 'manual', selectedLabels: {}, status: {} },
      runtime: { currentStage: 'idle', currentBatchIndex: 0, currentSceneId: null, activeBatchIds: [], paused: false, lastCheckpointRef: null, lastAction: null, resumeMode: 'manual-start', lastErrorClassification: null, activePreviewTimeline: [], autoRun: false, waitingForUserStart: true },
      assets: { images: [], videos: [], finalOutputs: [] },
      previewTimeline: [],
      activeBatchIds: [],
      pipelineLogs: []
    }
  };
}

function buildSavePayload(currentState) {
  const state = asObject(currentState);
  const payload = sanitizeProjectPayload({
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    appVersion: state.appVersion || 'sandbox-phase1',
    savedAt: nowIso(),
    project: state.project,
    inputs: state.inputs,
    config: state.config,
    router: state.router,
    runtime: state.runtime,
    assets: state.assets,
    previewTimeline: state.previewTimeline || state.project?.finalTimeline,
    extensions: state.extensions
  });
  const secrets = scanProjectForSecrets(payload);
  if (!secrets.ok) return { ok: false, errors: ['Save payload still contains secret-like data.'], secretFindings: secrets.findings };
  return { ok: true, payload };
}

function reconcileAssetPaths(payload, assetExistsFn = () => true) {
  const warnings = [];
  const safe = sanitizeProjectPayload(payload);
  const paths = [];
  safe.project.scenes.forEach((scene) => {
    if (scene.imagePath) paths.push({ kind: 'image', sceneId: scene.sceneId, path: scene.imagePath });
    if (scene.videoPath) paths.push({ kind: 'video', sceneId: scene.sceneId, path: scene.videoPath });
  });
  for (const group of ['images', 'videos', 'finalOutputs']) {
    for (const asset of safe.assets[group] || []) {
      if (asset?.path) paths.push({ kind: group, sceneId: asset.sceneId || null, path: asset.path });
    }
  }
  for (const item of paths) {
    if (!assetExistsFn(item.path, item)) warnings.push({ type: 'missing_asset', ...item });
  }
  return { payload: safe, warnings };
}

function restoreRuntimeState(payload) {
  const migrated = migrateProjectFile(payload);
  if (!migrated.ok) return migrated;
  const safe = migrated.payload;
  return {
    ok: true,
    state: {
      loaded: true,
      dirty: false,
      project: safe.project,
      inputs: safe.inputs,
      config: safe.config,
      router: safe.router,
      runtime: { ...safe.runtime, autoRun: false, waitingForUserStart: true },
      assets: safe.assets,
      previewTimeline: safe.previewTimeline,
      extensions: safe.extensions,
      activeBatchIds: safe.runtime.activeBatchIds || [],
      pipelineLogs: [],
      status: 'waiting-for-user-start'
    }
  };
}

function openProjectFile({ filePath, fileText, assetExistsFn = () => true }) {
  if (!String(filePath || '').toLowerCase().endsWith('.grokproj')) {
    return { ok: false, errors: ['Project file extension must be .grokproj.'] };
  }
  let parsed;
  try {
    parsed = JSON.parse(String(fileText));
  } catch (error) {
    return { ok: false, errors: [`Invalid JSON: ${error.message}`] };
  }
  const migrated = migrateProjectFile(parsed);
  if (!migrated.ok) return migrated;
  const reconciled = reconcileAssetPaths(migrated.payload, assetExistsFn);
  const restored = restoreRuntimeState(reconciled.payload);
  if (!restored.ok) return restored;
  return { ok: true, state: restored.state, warnings: reconciled.warnings };
}

function markDirty(state) {
  return { ...asObject(state), dirty: true };
}

function markSaved(state) {
  return { ...asObject(state), dirty: false, savedAt: nowIso() };
}

function hasUnsavedChanges(state) {
  return Boolean(asObject(state).dirty);
}

export {
  SUPPORTED_SCHEMA_VERSION,
  buildSavePayload,
  createNewProjectSession,
  getNextResumeAction,
  hasUnsavedChanges,
  markDirty,
  markSaved,
  migrateProjectFile,
  openProjectFile,
  reconcileAssetPaths,
  restoreRuntimeState,
  sanitizeProjectPayload,
  scanProjectForSecrets,
  validateProjectFile
};
