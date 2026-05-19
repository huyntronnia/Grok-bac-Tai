import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildPortablePackagePlan,
  buildSavePayload,
  createNewProjectSession,
  getNextResumeAction,
  hasUnsavedChanges,
  markDirty,
  markSaved,
  openProjectFile,
  openPortablePackagePlan,
  reconcileAssetPaths,
  restoreRuntimeState,
  sanitizeProjectPayload,
  scanProjectForSecrets,
  validateProjectFile
} from '../prototype/projectSession.js';

const fixturePath = path.join('tests', 'sample.grokproj');
const fixtureText = fs.readFileSync(fixturePath, 'utf8');
const sample = JSON.parse(fixtureText);

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertNoSecrets(value, message = 'payload has no secrets') {
  const result = scanProjectForSecrets(value);
  assert.equal(result.ok, true, `${message}: ${JSON.stringify(result.findings)}`);
}

assert.doesNotThrow(() => JSON.parse(fixtureText), 'sample.grokproj is valid JSON');
assert.equal(sample.schemaVersion, 1, 'sample has schemaVersion');
assert.ok(Array.isArray(sample.project.scenes), 'sample has project.scenes array');
assert.ok(sample.project.scenes.length >= 3, 'sample has at least 3 scenes');
assert.ok(sample.runtime && typeof sample.runtime === 'object', 'sample has runtime');
assert.ok(sample.previewTimeline.length >= 3, 'sample has final preview timeline');
assert.equal(sample.router.selectedGrokAccountId, 'grok-account-1', 'sample has Grok router metadata');
assertNoSecrets(sample, 'sample fixture');
assert.equal(validateProjectFile(sample).ok, true, 'validator accepts sample');

const missingSchema = deepClone(sample);
delete missingSchema.schemaVersion;
assert.equal(validateProjectFile(missingSchema).ok, false, 'validator rejects missing schemaVersion');
assert.match(validateProjectFile(missingSchema).errors.join('\n'), /schemaVersion/i);

const badScenes = deepClone(sample);
badScenes.project.scenes = {};
assert.equal(validateProjectFile(badScenes).ok, false, 'validator rejects non-array project.scenes');
assert.match(validateProjectFile(badScenes).errors.join('\n'), /project\.scenes/i);

const futureVersion = deepClone(sample);
futureVersion.schemaVersion = 999;
assert.equal(validateProjectFile(futureVersion).ok, false, 'validator rejects unsupported future schema version');
assert.match(validateProjectFile(futureVersion).errors.join('\n'), /Unsupported future schemaVersion 999/i);

const secretPayload = deepClone(sample);
secretPayload.router.cookie = 'session=not-a-real-cookie';
secretPayload.config.apiKey = 'sk-notARealSecretButPattern123';
secretPayload.router.selectedLabels.account = 'person@gmail.com';
const secretValidation = validateProjectFile(secretPayload);
assert.equal(secretValidation.ok, false, 'validator rejects secret-like values');
assert.ok(secretValidation.secretFindings.length >= 2, 'secret scanner reports findings');
const sanitizedSecret = sanitizeProjectPayload(secretPayload);
assertNoSecrets(sanitizedSecret, 'sanitized payload strips secret-like values');
assert.equal(sanitizedSecret.router.selectedLabels.account, '[redacted-email]', 'sanitizer redacts full private email labels');
assert.equal(Object.hasOwn(sanitizedSecret.config, 'apiKey'), false, 'sanitizer strips api key field');

const opened = openProjectFile({
  filePath: 'safe-project.grokproj',
  fileText: fixtureText,
  assetExistsFn: () => true
});
assert.equal(opened.ok, true, 'open project succeeds');
assert.equal(opened.state.runtime.autoRun, false, 'open project does not auto-run');
assert.equal(opened.state.runtime.waitingForUserStart, true, 'open project waits for user Start');
assert.equal(opened.state.status, 'waiting-for-user-start', 'open state marked waiting for Start');

const missingAssets = reconcileAssetPaths(sample, (assetPath) => !assetPath.includes('scene-002'));
assert.ok(missingAssets.warnings.length > 0, 'missing assets return warnings');
assert.ok(missingAssets.warnings.every((warning) => warning.type === 'missing_asset'), 'missing asset warnings are typed');

const unknownPayload = deepClone(sample);
unknownPayload.futureCompatibleData = { note: 'preserve as inert data' };
const unknownMigrated = sanitizeProjectPayload(unknownPayload);
assert.deepEqual(unknownMigrated.extensions.unknownTopLevel.futureCompatibleData, { note: 'preserve as inert data' }, 'unknown compatible fields are preserved safely in extensions');

const dirtyState = markDirty({ project: { name: 'Dirty Project' } });
assert.equal(hasUnsavedChanges(dirtyState), true, 'markDirty sets unsaved changes');
assert.equal(hasUnsavedChanges(markSaved(dirtyState)), false, 'markSaved clears unsaved changes');
const newProjectNeedsConfirm = createNewProjectSession({ currentState: dirtyState });
assert.equal(newProjectNeedsConfirm.action, 'confirm-discard-or-save', 'New Project asks to save unsaved changes first');
const newProjectConfirmed = createNewProjectSession({
  currentState: {
    ...dirtyState,
    globalSettings: { theme: 'global' },
    secureCredentialRefs: { ninerouter: 'secure-ref-only' },
    activeBatchIds: ['scene-001'],
    pipelineLogs: ['old log']
  },
  confirmed: true
});
assert.equal(newProjectConfirmed.action, 'created', 'confirmed New Project creates reset state');
assert.deepEqual(newProjectConfirmed.state.activeBatchIds, [], 'New Project clears active batch');
assert.deepEqual(newProjectConfirmed.state.pipelineLogs, [], 'New Project clears pipeline logs');
assert.deepEqual(newProjectConfirmed.state.previewTimeline, [], 'New Project clears preview timeline');
assert.deepEqual(newProjectConfirmed.state.globalSettings, { theme: 'global' }, 'New Project preserves explicit global settings');
assert.deepEqual(newProjectConfirmed.state.secureCredentialRefs, { ninerouter: 'secure-ref-only' }, 'New Project preserves secure credential references');

const saveState = {
  appVersion: 'test-version',
  project: sample.project,
  inputs: sample.inputs,
  config: sample.config,
  router: {
    ...sample.router,
    cookie: 'session=not-real',
    selectedLabels: { ...sample.router.selectedLabels, account: 'person@gmail.com' }
  },
  runtime: sample.runtime,
  assets: sample.assets,
  previewTimeline: sample.previewTimeline
};
const saved = buildSavePayload(saveState);
assert.equal(saved.ok, true, 'Save Project builds payload');
assert.ok(saved.payload.inputs.storyPrompt, 'Save Project includes prompts');
assert.equal(saved.payload.config.videoProvider, 'grok', 'Save Project includes config');
assert.equal(saved.payload.project.scenes.length, 3, 'Save Project includes scenes');
assert.equal(saved.payload.assets.videos.length, 3, 'Save Project includes assets');
assert.equal(saved.payload.runtime.currentSceneId, 'scene-003', 'Save Project includes runtime');
assert.equal(saved.payload.router.selectedGrokAccountId, 'grok-account-1', 'Save Project includes router id metadata');
assert.equal(saved.payload.router.routingPolicy, 'manual', 'Save Project includes router policy metadata');
assert.equal(saved.payload.router.selectedLabels.account, '[redacted-email]', 'Save Project strips full private email account labels');
assert.equal(Object.hasOwn(saved.payload.router, 'cookie'), false, 'Save Project does not include account secrets');
assertNoSecrets(saved.payload, 'saved payload');

const restored = restoreRuntimeState(sample);
assert.equal(restored.ok, true, 'Restore succeeds');
assert.equal(restored.state.runtime.currentBatchIndex, 0, 'Restore recovers current batch');
assert.equal(restored.state.runtime.currentSceneId, 'scene-003', 'Restore recovers current scene');
assert.equal(restored.state.runtime.paused, true, 'Restore recovers paused state');
assert.equal(restored.state.router.selectedGrokAccountId, 'grok-account-1', 'Restore keeps router id metadata');
assert.equal(restored.state.router.routingPolicy, 'manual', 'Restore keeps router policy metadata');
assert.equal(Object.hasOwn(restored.state.router, 'cookie'), false, 'Restore never includes router secrets');

const badExtension = openProjectFile({ filePath: 'project.json', fileText: fixtureText });
assert.equal(badExtension.ok, false, 'Open validates .grokproj extension');

function buildRuntimeResumeFixture(scene3Patch, runtimePatch = {}) {
  const payload = deepClone(sample);
  payload.project.scenes[0] = {
    ...payload.project.scenes[0],
    status: 'video_generated',
    imagePath: 'assets/images/scene-001.png',
    videoPath: 'assets/videos/scene-001.mp4'
  };
  payload.project.scenes[1] = {
    ...payload.project.scenes[1],
    status: 'video_generated',
    imagePath: 'assets/images/scene-002.png',
    videoPath: 'assets/videos/scene-002.mp4'
  };
  payload.project.scenes[2] = {
    ...payload.project.scenes[2],
    imagePath: null,
    videoPath: null,
    motionPrompt: '',
    ...scene3Patch
  };
  payload.runtime = {
    ...payload.runtime,
    currentStage: 'generating_keyframe',
    currentBatchIndex: 2,
    currentSceneId: 'scene-003',
    activeBatchIds: ['scene-001', 'scene-002', 'scene-003'],
    paused: true,
    autoRun: false,
    waitingForUserStart: true,
    lastCheckpointRef: 'checkpoint-scene-003',
    lastAction: 'generate_keyframe',
    resumeMode: 'manual-start',
    ...runtimePatch
  };
  return payload;
}

const midKeyframePayload = buildRuntimeResumeFixture({ status: 'keyframe_generating' });
const midKeyframeSaved = buildSavePayload({
  project: midKeyframePayload.project,
  inputs: midKeyframePayload.inputs,
  config: midKeyframePayload.config,
  router: midKeyframePayload.router,
  runtime: midKeyframePayload.runtime,
  assets: midKeyframePayload.assets,
  previewTimeline: midKeyframePayload.previewTimeline
});
assert.equal(midKeyframeSaved.ok, true, 'mid-keyframe Save Project builds payload');
assert.deepEqual(midKeyframeSaved.payload.runtime.activeBatchIds, ['scene-001', 'scene-002', 'scene-003'], 'Save Project persists full active batch');
assert.equal(midKeyframeSaved.payload.runtime.currentSceneId, 'scene-003', 'Save Project persists current scene 3');
assert.equal(midKeyframeSaved.payload.runtime.currentStage, 'generating_keyframe', 'Save Project persists keyframe stage');
const midKeyframeOpened = openProjectFile({
  filePath: 'mid-keyframe.grokproj',
  fileText: JSON.stringify(midKeyframeSaved.payload),
  assetExistsFn: () => true
});
assert.equal(midKeyframeOpened.ok, true, 'mid-keyframe project opens');
assert.equal(midKeyframeOpened.state.runtime.autoRun, false, 'mid-keyframe open does not auto-run');
assert.equal(midKeyframeOpened.state.runtime.waitingForUserStart, true, 'mid-keyframe open waits for Start');
assert.equal(midKeyframeOpened.state.runtime.currentSceneId, 'scene-003', 'Restore keeps current scene 3');
assert.equal(midKeyframeOpened.state.runtime.currentStage, 'generating_keyframe', 'Restore keeps keyframe stage');
assert.deepEqual(midKeyframeOpened.state.activeBatchIds, ['scene-001', 'scene-002', 'scene-003'], 'Restore keeps scene 3 in active batch');
const midKeyframeDecision = getNextResumeAction(midKeyframeOpened.state);
assert.equal(midKeyframeDecision.action, 'generate_keyframe', 'Resume continues keyframe generation');
assert.notEqual(midKeyframeDecision.action, 'generate_video', 'Resume does not jump to video route for missing keyframe');

const imageReadyPayload = buildRuntimeResumeFixture(
  {
    status: 'image_generated',
    imagePath: 'assets/images/scene-003.png',
    motionPrompt: 'Scene 3 motion prompt',
    videoPath: null
  },
  { currentStage: 'generating_video', lastAction: 'generate_video' }
);
const imageReadyOpened = openProjectFile({
  filePath: 'image-ready.grokproj',
  fileText: JSON.stringify(buildSavePayload(imageReadyPayload).payload),
  assetExistsFn: () => true
});
const imageReadyDecision = getNextResumeAction(imageReadyOpened.state);
assert.equal(imageReadyDecision.action, 'generate_video', 'image-generated scene without video resumes video generation');
assert.equal(imageReadyDecision.sceneId, 'scene-003', 'video resume targets scene 3');

const batchCompletePayload = buildRuntimeResumeFixture(
  {
    status: 'video_generated',
    imagePath: 'assets/images/scene-003.png',
    motionPrompt: 'Scene 3 motion prompt',
    videoPath: 'assets/videos/scene-003.mp4'
  },
  { currentStage: 'generating_video', lastAction: 'generate_video' }
);
const batchCompleteOpened = openProjectFile({
  filePath: 'batch-complete.grokproj',
  fileText: JSON.stringify(buildSavePayload(batchCompletePayload).payload),
  assetExistsFn: () => true
});
const batchCompleteDecision = getNextResumeAction(batchCompleteOpened.state);
assert.equal(batchCompleteDecision.action, 'batch_complete', 'all video-generated scenes report batch complete safely');

const portableMissingPayload = deepClone(sample);
portableMissingPayload.project.scenes.forEach((scene, index) => {
  scene.status = index < 2 ? 'video_generated' : 'image_generated';
  scene.imagePath = `missing-machine/assets/scene-${String(index + 1).padStart(3, '0')}.png`;
  scene.videoPath = index < 2 ? `missing-machine/assets/scene-${String(index + 1).padStart(3, '0')}.mp4` : null;
  scene.rawSceneText = scene.rawSceneText || `Portable scene ${index + 1}`;
  scene.imagePrompt = scene.imagePrompt || `Image prompt ${index + 1}`;
  scene.motionPrompt = scene.motionPrompt || `Motion prompt ${index + 1}`;
});
portableMissingPayload.previewTimeline = portableMissingPayload.project.scenes.slice(0, 2).map((scene) => ({
  sceneId: scene.sceneId,
  videoPath: scene.videoPath,
  keyframePath: scene.imagePath,
  durationSeconds: 6,
  name: `scene_${scene.sceneId}`
}));
const portableReconciled = reconcileAssetPaths(portableMissingPayload, () => false);
assert.ok(portableReconciled.warnings.length > 0, 'missing portable assets return warnings');
assert.equal(portableReconciled.payload.project.scenes.length, 3, 'missing assets do not remove scenes');
portableReconciled.payload.project.scenes.forEach((scene, index) => {
  assert.ok(scene.rawSceneText, `scene ${index + 1} raw text preserved`);
  assert.ok(scene.imagePrompt, `scene ${index + 1} image prompt preserved`);
  assert.ok(scene.motionPrompt, `scene ${index + 1} motion prompt preserved`);
  assert.equal(scene.status, portableMissingPayload.project.scenes[index].status, `scene ${index + 1} status preserved`);
});
assert.equal(portableReconciled.payload.project.scenes[0].imageMissing, true, 'missing image marked on scene');
assert.equal(portableReconciled.payload.project.scenes[0].videoMissing, true, 'missing video marked on scene');

const missingAssetSavePayload = deepClone(portableMissingPayload);
missingAssetSavePayload.project.scenes[2].motionPrompt = 'Generated motion prompt survives missing media';
missingAssetSavePayload.project.scenes[2].status = 'image_generated';
missingAssetSavePayload.project.scenes[2].imagePath = 'missing-machine/assets/scene-003.png';
missingAssetSavePayload.project.scenes[2].videoPath = null;
const missingAssetSaved = buildSavePayload(missingAssetSavePayload);
assert.equal(missingAssetSaved.ok, true, 'Save payload builds when media files are absent');
assert.equal(missingAssetSaved.payload.project.scenes[2].motionPrompt, 'Generated motion prompt survives missing media', 'Save preserves generated motion prompt without asset file');
assert.equal(missingAssetSaved.payload.project.scenes[2].status, 'image_generated', 'Save preserves scene status without asset file');
assertNoSecrets(missingAssetSaved.payload, 'portable missing asset save payload');

const newMachineOpened = openProjectFile({
  filePath: 'portable-new-machine.grokproj',
  fileText: JSON.stringify(portableMissingPayload),
  assetExistsFn: () => false
});
assert.equal(newMachineOpened.ok, true, 'portable project opens on new machine');
assert.equal(newMachineOpened.state.project.scenes.length, portableMissingPayload.project.scenes.length, 'new machine restore keeps visible scene list');
assert.equal(newMachineOpened.state.runtime.currentSceneId, portableMissingPayload.runtime.currentSceneId, 'new machine restore keeps current scene');
assert.equal(newMachineOpened.state.runtime.currentStage, portableMissingPayload.runtime.currentStage, 'new machine restore keeps current stage');
assert.equal(newMachineOpened.state.runtime.autoRun, false, 'new machine restore does not auto-run');
assert.ok(newMachineOpened.warnings.length > 0, 'new machine restore reports missing asset warnings');
assert.ok(newMachineOpened.state.project.scenes.every((scene) => scene.imagePrompt && scene.motionPrompt), 'new machine restore keeps prompts visible');

const missingPreviewPayload = deepClone(sample);
missingPreviewPayload.previewTimeline = [
  { sceneId: 'scene-001', videoPath: 'missing-machine/final/scene-001.mp4', keyframePath: 'missing-machine/final/scene-001.png', durationSeconds: 6, name: 'scene_001' }
];
const missingPreviewOpened = openProjectFile({
  filePath: 'missing-preview.grokproj',
  fileText: JSON.stringify(missingPreviewPayload),
  assetExistsFn: () => false
});
assert.equal(missingPreviewOpened.ok, true, 'project with missing preview opens');
assert.equal(missingPreviewOpened.state.previewTimeline.length, 1, 'missing preview keeps timeline metadata');
assert.equal(missingPreviewOpened.state.previewTimeline[0].previewMissing, true, 'missing preview is marked');
assert.ok(missingPreviewOpened.warnings.some((warning) => warning.kind === 'preview_video'), 'missing preview warning returned');

const packageSource = deepClone(sample);
packageSource.project.scenes[0].imagePath = 'C:/project/assets/scene-001.png';
packageSource.project.scenes[0].videoPath = 'C:/project/assets/scene-001.mp4';
packageSource.project.scenes[1].imagePath = 'C:/project/assets/missing-scene-002.png';
packageSource.project.scenes[1].motionPrompt = 'Generated motion prompt remains portable';
packageSource.previewTimeline = [
  { sceneId: 'scene-001', videoPath: 'C:/project/assets/scene-001.mp4', keyframePath: 'C:/project/assets/scene-001.png', durationSeconds: 6, name: 'scene_001' }
];
const packagePlan = buildPortablePackagePlan(packageSource, (assetPath) => !assetPath.includes('missing'));
assert.ok(packagePlan.packageEntries.includes('manifest.json'), 'package plan includes manifest entry');
assert.ok(packagePlan.packageEntries.includes('project.grokproj'), 'package plan includes project entry');
assert.ok(packagePlan.packageEntries.includes('checksums.json'), 'package plan includes checksums entry');
assert.ok(packagePlan.packageEntries.some((entry) => entry.startsWith('assets/')), 'package plan includes asset entries');
assert.equal(packagePlan.manifest.projectName, sample.project.name, 'package manifest includes project name');
assert.equal(packagePlan.manifest.schemaVersion, 1, 'package manifest includes schema version');
assert.ok(packagePlan.manifest.assetCount >= 2, 'package manifest counts copied assets');
assert.ok(packagePlan.manifest.warnings.some((warning) => warning.type === 'missing_asset'), 'package manifest includes asset warnings');
assert.match(packagePlan.project.project.scenes[0].imagePath, /^assets\/images\//, 'export rewrites image path to package-relative path');
assert.match(packagePlan.project.project.scenes[0].videoPath, /^assets\/videos\//, 'export rewrites video path to package-relative path');
assert.equal(packagePlan.project.project.scenes[1].motionPrompt, 'Generated motion prompt remains portable', 'export preserves motion prompt with missing asset');
assertNoSecrets(packagePlan.project, 'portable package project payload');
assertNoSecrets(packagePlan.manifest, 'portable package manifest');
assertNoSecrets(packagePlan.checksums, 'portable package checksums');

const openedPackage = openPortablePackagePlan({
  manifest: packagePlan.manifest,
  project: packagePlan.project,
  entries: [
    { name: 'manifest.json', json: packagePlan.manifest },
    { name: 'project.grokproj', json: packagePlan.project },
    ...packagePlan.assets.map((asset) => ({ name: asset.packagePath }))
  ]
}, '/tmp/restored-package');
assert.equal(openedPackage.ok, true, 'open portable package succeeds');
assert.equal(openedPackage.state.project.scenes.length, packagePlan.project.project.scenes.length, 'open package restores all scenes');
assert.ok(openedPackage.state.project.scenes[0].motionPrompt, 'open package restores motion prompt');
assert.match(openedPackage.state.project.scenes[0].imagePath, /^\/tmp\/restored-package\/assets\/images\//, 'open package rewrites image path to extracted path');
assert.match(openedPackage.state.project.scenes[0].videoPath, /^\/tmp\/restored-package\/assets\/videos\//, 'open package rewrites video path to extracted path');
assert.equal(openedPackage.state.runtime.autoRun, false, 'open package does not auto-run');

const traversalPackage = openPortablePackagePlan({
  manifest: packagePlan.manifest,
  project: packagePlan.project,
  entries: [{ name: '../evil.exe' }, { name: 'project.grokproj', json: packagePlan.project }]
});
assert.equal(traversalPackage.ok, false, 'open package rejects path traversal entries');

const encodedTraversalPackage = openPortablePackagePlan({
  manifest: packagePlan.manifest,
  project: packagePlan.project,
  entries: [{ name: 'assets/%2e%2e/evil.png' }, { name: 'project.grokproj', json: packagePlan.project }]
});
assert.equal(encodedTraversalPackage.ok, false, 'open package rejects encoded traversal entries');

const doubleEncodedTraversalPackage = openPortablePackagePlan({
  manifest: packagePlan.manifest,
  project: packagePlan.project,
  entries: [{ name: 'assets/%252e%252e/evil.png' }, { name: 'project.grokproj', json: packagePlan.project }]
});
assert.equal(doubleEncodedTraversalPackage.ok, false, 'open package rejects double-encoded traversal entries');

const absolutePathPackage = openPortablePackagePlan({
  manifest: packagePlan.manifest,
  project: packagePlan.project,
  entries: [{ name: 'C:\\temp\\evil.png' }, { name: 'project.grokproj', json: packagePlan.project }]
});
assert.equal(absolutePathPackage.ok, false, 'open package rejects absolute path entries');

const duplicateEntryPackage = openPortablePackagePlan({
  manifest: packagePlan.manifest,
  project: packagePlan.project,
  entries: [
    { name: 'project.grokproj', json: packagePlan.project },
    { name: 'assets/videos/scene-001.mp4' },
    { name: 'assets/videos/scene-001.mp4' }
  ]
});
assert.equal(duplicateEntryPackage.ok, false, 'open package rejects duplicate entries');

const executablePackage = openPortablePackagePlan({
  manifest: packagePlan.manifest,
  project: packagePlan.project,
  entries: [
    { name: 'project.grokproj', json: packagePlan.project },
    { name: 'assets/videos/scene-001.mp4' },
    { name: 'assets/videos/run-me.exe' },
    { name: 'assets/videos/installer.msi' },
    { name: 'assets/videos/screensaver.scr' }
  ]
});
assert.equal(executablePackage.ok, true, 'open package ignores executable entries without crashing');
assert.ok(executablePackage.warnings.some((warning) => warning.type === 'skipped_executable'), 'open package warns for executable entries');

const checksumPath = packagePlan.assets[0].packagePath;
const checksumMismatchPackage = openPortablePackagePlan({
  manifest: packagePlan.manifest,
  project: packagePlan.project,
  checksums: { [checksumPath]: 'expected-sha256' },
  entries: [
    { name: 'project.grokproj', json: packagePlan.project },
    { name: checksumPath, sha256: 'different-sha256' }
  ]
});
assert.equal(checksumMismatchPackage.ok, true, 'open package handles checksum mismatch without crashing');
assert.ok(checksumMismatchPackage.warnings.some((warning) => warning.type === 'checksum_mismatch'), 'open package warns on checksum mismatch');
assert.ok(checksumMismatchPackage.warnings.some((warning) => warning.type === 'missing_asset'), 'checksum mismatch skips asset and keeps project data');

const untrustedWarningPackage = openPortablePackagePlan({
  manifest: {
    ...packagePlan.manifest,
    warnings: [{ type: 'missing_asset', path: 'C:/Users/person@gmail.com/asset.png', cookie: 'session=not-real' }]
  },
  project: packagePlan.project,
  entries: [
    { name: 'project.grokproj', json: packagePlan.project },
    ...packagePlan.assets.map((asset) => ({ name: asset.packagePath }))
  ]
});
assert.equal(untrustedWarningPackage.ok, true, 'open package sanitizes untrusted manifest warnings');
assertNoSecrets(untrustedWarningPackage.warnings, 'portable package warning output');

const corruptAssetPackage = openPortablePackagePlan({
  manifest: packagePlan.manifest,
  project: packagePlan.project,
  entries: [{ name: 'project.grokproj', json: packagePlan.project }]
});
assert.equal(corruptAssetPackage.ok, true, 'open package handles missing package assets as warnings');
assert.ok(corruptAssetPackage.warnings.length > 0, 'open package reports missing package assets');

console.log('projectSession.test.mjs: all tests passed');
