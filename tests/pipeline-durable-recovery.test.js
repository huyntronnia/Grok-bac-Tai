const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'electron/renderer.js'), 'utf8');

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert(start >= 0 && end > start, `${startMarker} block not found`);
  return source.slice(start, end);
}

const stages = [
  'prepare_scene',
  'nv1_prepare',
  'nv1_sent',
  'nv1_waiting_image',
  'nv1_image_validated',
  'nv2_prepare',
  'nv2_sent',
  'nv2_waiting_response',
  'nv2_saved',
  'veoup_prepare',
  'veoup_image_loaded',
  'veoup_prompt_loaded',
  'veoup_generate_started',
  'veoup_waiting_output',
  'video_validated',
  'complete',
];
for (const stage of stages) {
  assert(main.includes(`'${stage}'`), `durable stage missing: ${stage}`);
}

assert(main.includes('const DURABLE_PIPELINE_BACKOFF_MS = [5000, 10000, 15000, 30000];'), 'capped backoff sequence missing');
assert(main.includes('function getDurablePipelineBackoffMs'), 'backoff helper missing');
assert(main.includes('return DURABLE_PIPELINE_BACKOFF_MS[index];'), 'backoff helper must cap at 30s');
assert(main.includes('async function readPipelineSceneState'), 'pipeline_state read helper missing');
assert(main.includes('async function persistDurableStage'), 'durable stage persistence helper missing');
assert(main.includes('timestamps: {'), 'stage timestamps must be persisted');
assert(main.includes('lastProgressAt'), 'last progress timestamp missing');

const locked = sliceBetween(main, 'async function runScenePipelineLocked(_event, options) {', 'async function runScenePipelineLockedInternal');
assert(locked.includes('while (true)'), 'run-scene must keep retrying until success or Stop');
assert(locked.includes('assertDurableSceneSuccess(result)'), 'success must be gated on complete artifacts');
assert(locked.includes('await sleep(retryDelayMs);'), 'retry sleep must use cancellable sleep');
assert(locked.includes('assertPipelineRunActive(runId);'), 'retry loop must check cancellation');
assert(locked.includes('Scene ${sceneId} [${currentStage}]: no progress; retry ${retryCount}'), 'retry progress log missing');
assert(locked.includes('persistDurableStage(projectDir, sceneId, currentStage'), 'retry state must be persisted');
assert(locked.indexOf('assertDurableSceneSuccess(result)') < locked.indexOf('Scene ${sceneId} completed successfully'), 'success log must happen only after completion gate');

const internal = sliceBetween(main, 'async function runScenePipelineLockedInternal(_event, options) {', 'async function openFreshChatGptRootPage');
for (const stage of ['prepare_scene', 'nv1_image_validated', 'nv2_saved', 'veoup_prepare', 'veoup_waiting_output', 'video_validated']) {
  assert(internal.includes(`persistDurableStage(projectDir, sceneId, '${stage}'`), `internal stage write missing: ${stage}`);
}
assert(internal.includes('if (!imagePath && !options.forceRegenerateImage && await pathExists(expectedImagePath))'), 'valid cached keyframe must skip NV1');
assert(internal.includes('if (!motionPrompt?.trim() && !options.forceRegenerateMotionPrompt && await pathExists(existingMotionPromptPath))'), 'valid cached motion prompt must skip NV2');
assert(internal.includes('existing video validated; skipping'), 'valid cached video must skip VeoUp regeneration');
assert(internal.includes('validateLocalVideoFile(existingVideoPath'), 'cached video must validate local MP4');

assert(main.includes('if (!result?.ok || result.videoValidated !== true || !result.videoPath)'), 'scene success must require validated video');
assert(main.includes('if (result?.ok === false)') && main.includes("'VeoUp automation returned non-ok status'"), 'VeoUp ok:false must propagate');
assert(main.includes('function sleep(ms)') && main.includes('registerPipelineWaiter(runId, onCancel)'), 'sleep must be Stop-cancellable');

assert(main.includes('await mergePipelineSceneStateIntoProjectPayload(parsed, projectFolder);'), 'project open must merge pipeline_state before renderer sees scenes');
assert(renderer.includes('pipelineStateMerged') || main.includes('pipelineSceneStateMerged: true'), 'pipeline_state merge marker missing');

console.log('pipeline durable recovery tests passed');
