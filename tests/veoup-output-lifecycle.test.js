const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const main = read('electron/main.js');
const pipeline = read('electron/main/pipeline/pipeline_runner.js');
const ipc = read('electron/main/ipc/ipc_handlers.js');
const renderer = read('electron/renderer.js');
const veoup = read('electron/veoupAutomation.js');
const allCode = main + '\n' + pipeline + '\n' + ipc;

assert(allCode.includes('function getSceneMediaPaths('), 'main must centralize deterministic scene media paths');
assert(allCode.includes('`${sceneToken}_video.mp4`'), 'scene video must finalize to scene_###_video.mp4');
assert(allCode.includes('TEMP_VIDEO_EXTENSIONS'), 'temporary download extensions must be rejected');
assert(allCode.includes('function isTemporaryDownloadPath('), 'temporary download path guard missing');
assert(allCode.includes('async function waitForStableFileSize('), 'stable-size wait missing');
assert(allCode.includes('async function validateLocalVideoFile('), 'local video validation helper missing');
assert(allCode.includes('validateGeneratedVideoFile(filePath)'), 'local validation must use duration/size probe');
assert(allCode.includes('unsupported-video-extension'), 'local validation must reject unsupported video extensions');
assert(allCode.includes('temporary-video-download'), 'local validation must reject partial download paths');
assert(allCode.includes('finalizeValidatedSceneVideo'), 'validated finalization helper missing');
assert(allCode.includes('await fs.copyFile(sourcePath, candidatePath)'), 'source video must be copied to owned candidate before finalization');
assert(allCode.includes('await fs.rename(candidatePath, finalPath)'), 'candidate video must be renamed into deterministic final path');
assert(allCode.includes('videoValidated: true'), 'main must return videoValidated true only after validation');
assert(allCode.includes('lastFrameValidation:') && allCode.includes('last-frame-disabled'), 'main must explicitly skip last-frame extraction');
assert(allCode.includes('ok: true'), 'backend success payload must include ok true');
assert(allCode.includes('ok: Boolean(result.ok)'), 'IPC sanitizer must preserve top-level ok');
assert(allCode.includes('sceneId: result.sceneId || null'), 'IPC sanitizer must preserve top-level sceneId');
assert(allCode.includes('videoValidated: Boolean(result.videoValidated)'), 'IPC sanitizer must preserve top-level videoValidated');
assert(allCode.includes('lastFramePath: safeText(result.lastFramePath'), 'IPC sanitizer must preserve top-level lastFramePath');
assert(allCode.includes('completionStatus: safeText(result.completionStatus'), 'IPC sanitizer must preserve top-level completionStatus');
assert(allCode.includes('sourceVideoPath'), 'backend success payload must include sourceVideoPath');
assert(allCode.includes('await writePipelineSceneState(projectDir, sceneId'), 'backend must persist scene state before returning success');
assert(allCode.includes("completionStatus: 'complete'"), 'backend must persist completion status');
assert(allCode.includes('assertVeoUpResultAssociation(result, { runId, sceneId })'), 'VeoUp result must be tied to runId/sceneId when present');
assert(allCode.includes('veoup-video-missing-after-submission'), 'VeoUp submission without exact local video must fail safely');
assert(!allCode.includes("status: result?.status || 'veoup-sent-await-video-validation'"), 'VeoUp submission status must not masquerade as completion');
assert(allCode.includes('status: "video-validated"') || allCode.includes("status: 'video-validated'"), 'VeoUp completion status must require validated video');
assert(allCode.includes('existing-video-validated'), 'existing deterministic video must be revalidated before reuse');
assert(allCode.includes('sourceVideoPath: existingVideoPath'), 'cached success must include sourceVideoPath');
assert(allCode.includes("Scene ${sceneId}: đã có motion_prompt.txt, bỏ qua ChatGPT NV2 và gửi keyframe + Motion Prompt sang VeoUp."), 'cached motion prompt log must mention VeoUp');
assert(!allCode.includes('gửi thẳng Grok'), 'misleading Grok handoff log must be removed');

const mergeStart = main.indexOf('async function mergeVideos(');
const mergeEnd = main.indexOf('async function exportFinalVideo', mergeStart);
assert(mergeStart >= 0 && mergeEnd > mergeStart, 'mergeVideos block missing');
const mergeBlock = main.slice(mergeStart, mergeEnd);
assert(!mergeBlock.includes('runVeoUpScriptAsPromise'), 'final merge must not launch global VeoUp automation');
assert(mergeBlock.includes('per-scene VeoUp pipeline already produced validated videos'), 'final merge must log that per-scene VeoUp is already complete');

assert(renderer.includes('function sceneHasVideoOutput(scene) {'), 'renderer video completion helper missing');
assert(renderer.includes('function sceneHasRequiredOutputForCurrentMode(scene)'), 'renderer required output helper missing');
assert(renderer.includes('hasValidSceneOutputPath(scene.videoPath)'), 'renderer must require valid videoPath');
assert(renderer.includes('scene.videoFileExists === true'), 'renderer must require existing video file');
assert(!renderer.includes('hasValidSceneOutputPath(scene.lastFramePath)'), 'renderer must not require lastFramePath');
assert(renderer.includes('result?.videoValidated === true'), 'pipeline result gate must require videoValidated');
assert(renderer.includes('String(resultVideoPath).includes(sceneFolderToken)'), 'renderer must reject result video outside scene folder');
assert(renderer.includes('currentScene.sourceVideoPath = result.sourceVideoPath || result.sourceDownloadPath'), 'renderer must persist sourceVideoPath from backend result');
assert(renderer.includes('window.videoPlannerAPI.assetStat(currentScene.videoPath)'), 'renderer must stat local video path after hydration');
assert(renderer.indexOf('currentScene.videoPath = result.videoPath;') < renderer.indexOf('const hasVideoOutput = Boolean('), 'renderer must hydrate scene from backend result before completion gate');
assert(renderer.includes("currentScene.status = 'video_done';"), 'validated backend result must mark scene video_done so next scene can start');
assert(renderer.includes('currentScene.videoValidated = Boolean(result.videoValidated && currentScene.videoPath)'), 'renderer must persist validated state after deterministic video path');
assert(!renderer.includes("throw new Error('previous-scene-last-frame-missing-after-extract')"), 'previous-scene gate must not require extracted last frame file');
assert(renderer.includes('prevScene.videoValidated = false'), 'rollback/missing cleanup must clear validation flag');
assert(renderer.includes("scene.status !== 'done' && !sceneHasVideoOutput(scene)"), 'resume guard must not trust video_done without validated assets');
assert(renderer.includes('sceneHasVideoOutput(scene)'), 'batch/complete logic must use strict video completion helper');
assert(allCode.includes('startNextSceneChatGptPrefetch(options, sceneId)'), 'main must start ChatGPT prefetch while VeoUp renders');
assert(renderer.includes('nextScenePrefetch'), 'renderer must pass next scene data for ChatGPT prefetch');
assert(
  renderer.includes('const nextSceneForPrefetch = project.scenes.find((item) => Number(item?.id || 0) === Number(scene.id || 0) + 1) || null;'),
  'renderer must prefetch the next project scene by scene id, even when the current runnable batch ends'
);
assert(
  !renderer.includes('const nextSceneForPrefetch = scenesToRun[i + 1] || null;'),
  'renderer must not limit next-scene prefetch to the current runnable batch'
);

assert(!veoup.includes('sourceDownloadPath = Get-ChildItem'), 'VeoUp automation must not guess newest download from Downloads');

console.log('veoup output lifecycle tests passed');
