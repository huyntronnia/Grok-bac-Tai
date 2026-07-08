const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'electron/renderer.js'), 'utf8');

const runSceneStart = renderer.indexOf('const result = await window.videoPlannerAPI.runScenePipeline({');
assert(runSceneStart >= 0, 'renderer runScenePipeline call missing');
const runSceneBlockEnd = renderer.indexOf('} catch (error) {', runSceneStart);
assert(runSceneBlockEnd > runSceneStart, 'renderer runScenePipeline result block missing');
const runSceneBlock = renderer.slice(runSceneStart, runSceneBlockEnd);

assert(main.includes('return sanitizeIpcValue(await handler(...args));'), 'IPC safe handler must return handler payload');
assert(main.includes('const promise = pipelineRunScope.run({ runId }, () => runScenePipelineLocked(_event, options)).then(sanitizeScenePipelineResult);'), 'pipeline:run-scene must sanitize full top-level result');
assert(main.includes('ok: Boolean(result.ok)'), 'cached IPC payload must preserve top-level ok');
assert(main.includes('videoValidated: Boolean(result.videoValidated)'), 'cached IPC payload must preserve top-level videoValidated');
assert(main.includes('lastFramePath: safeText(result.lastFramePath'), 'cached IPC payload must preserve top-level lastFramePath');
assert(main.includes('sourceVideoPath: safeText(result.sourceVideoPath'), 'cached IPC payload must preserve top-level sourceVideoPath');
assert(main.includes('completionStatus: safeText(result.completionStatus'), 'cached IPC payload must preserve top-level completionStatus');

assert(runSceneBlock.includes("safeAddPipelineLog('renderer', 'running', 'Renderer run-scene raw result'"), 'temporary raw result log missing');
assert(runSceneBlock.includes("safeAddPipelineLog('renderer', 'running', 'Renderer hydrated scene state'"), 'temporary hydrated scene log missing');
assert(runSceneBlock.includes("safeAddPipelineLog('renderer', 'running', 'Renderer completion gate state'"), 'temporary completion gate log missing');

assert(runSceneBlock.includes('const resultSceneId = Number(result?.sceneId || scene.id || 0);'), 'renderer must key hydration by returned sceneId');
assert(runSceneBlock.includes('const sceneIndexFromProject = project.scenes.findIndex'), 'renderer must find real scene entry in active project scenes');
assert(runSceneBlock.includes('const currentScene = sceneIndexFromProject >= 0 ? project.scenes[sceneIndexFromProject] : scene;'), 'renderer must hydrate real project scene entry');
assert(runSceneBlock.includes('if (sceneIndexFromProject >= 0) scenesToRun[i] = currentScene;'), 'renderer must replace loop entry with real project scene');
assert(runSceneBlock.includes('currentScene.videoPath = result.videoPath;'), 'renderer must copy returned videoPath');
assert(runSceneBlock.includes('currentScene.videoValidated = true;'), 'renderer must copy returned videoValidated');
assert(runSceneBlock.includes("currentScene.lastFramePath = result.lastFramePath || '';"), 'renderer must copy returned lastFramePath when present');
assert(runSceneBlock.includes('currentScene.sourceVideoPath = result.sourceVideoPath || result.sourceDownloadPath'), 'renderer must copy returned sourceVideoPath');
assert(runSceneBlock.includes("currentScene.status = 'video_done';"), 'renderer must mark cached success video_done');
assert(runSceneBlock.includes("currentScene.completionStatus = 'complete';"), 'renderer must mark cached success complete');

const hydrateIndex = runSceneBlock.indexOf('currentScene.videoPath = result.videoPath;');
const gateIndex = runSceneBlock.indexOf('const hasVideoOutput = Boolean(');
assert(hydrateIndex >= 0 && gateIndex > hydrateIndex, 'completion gate must run after result hydration, not stale scene');
assert(runSceneBlock.includes('result?.ok === true'), 'completion gate must use returned result ok');
assert(runSceneBlock.includes('currentScene.videoValidated === true'), 'completion gate must use hydrated scene validation');
assert(runSceneBlock.includes('resultVideoExists'), 'completion gate must verify video exists');
assert(runSceneBlock.includes('currentScene.videoFileExists = resultVideoExists'), 'completion gate must persist fresh video file stat');
assert(runSceneBlock.includes('currentScene.outputStatCheckedAtMs = currentScene.videoFileCheckedAtMs'), 'completion gate must persist fresh output timestamp');
assert(runSceneBlock.includes('currentScene.status = currentScene.reviewType === \'video\' ? \'video_done\' : \'image_done\';'), 'post-gate success must update hydrated scene, not stale scene');
assert(runSceneBlock.includes('const completedAfterScene = getCompletedScenesCount();'), 'renderer must count completed scenes after each validated video');
assert(runSceneBlock.includes('if (completedAfterScene >= targetSceneCount)'), 'renderer must only merge after target scene count is reached');
assert(runSceneBlock.includes('Scene ${currentScene.id} complete; continuing to next scene before final merge.'), 'renderer must continue to next ChatGPT scene before final merge');

assert(main.includes('await mergePipelineSceneStateIntoProjectPayload(parsed, projectFolder);'), 'open .vdra must merge pipeline_state before renderer sees payload');
assert(main.includes('async function mergePipelineSceneStateIntoProjectPayload'), 'pipeline_state merge helper missing');
assert(main.includes("payload.runtime = { ...(payload.runtime || {}), pipelineSceneStateMerged: true };"), 'pipeline_state merge marker missing');
assert(renderer.includes('scene.videoFileExists = true;'), 'repairFromDisk must persist video file existence');
assert(renderer.includes('scene.outputStatCheckedAtMs = Date.now();'), 'repairFromDisk must persist fresh output stat timestamp');
assert(renderer.includes("scene.status = 'video_done';"), 'resume guard repair must recognize existing recent video');
assert(renderer.includes("scene.progressStep = 'merge';"), 'validated cached scene must advance past video step');

console.log('renderer scene-state sync tests passed');
