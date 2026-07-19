const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');

const main = read('electron/main.js');
const chatgptPipeline = read('electron/main/chatgpt/chatgpt_pipeline.js');
const pipelineRunner = read('electron/main/pipeline/pipeline_runner.js');
const chatgptRuntime = `${main}\n${chatgptPipeline}\n${pipelineRunner}`;
const renderer = read('electron/renderer.js');

assert(main.includes('function buildImageStagePrompt('), 'IMAGE_STAGE prompt builder missing');
assert(main.includes('function buildMotionStagePrompt('), 'MOTION_STAGE prompt builder missing');
assert(!main.includes('function assertImageStagePrompt('), 'IMAGE_STAGE content guard must be removed');
assert(!main.includes('function assertMotionStagePrompt('), 'MOTION_STAGE content guard must be removed');
assert(main.includes("'--- IMAGE_STAGE / NV1_TAO_ANH ---'"), 'IMAGE_STAGE must include NV1 marker');
assert(main.includes("'--- MOTION_STAGE / NV2_MOTION_PROMPT ---'"), 'MOTION_STAGE must include NV2 marker');
assert(!main.includes('image-stage-prompt-contains-nv2-marker'), 'IMAGE_STAGE must not reject by prompt content');
assert(!main.includes('image-stage-prompt-contains-motion-or-video-instructions'), 'IMAGE_STAGE must allow NV1 file wording');
assert(!main.includes('motion-stage-prompt-contains-nv1-marker'), 'MOTION_STAGE must not reject by prompt content');
assert(!main.includes('buildTaskPrompt({ task: hardTasks.task1, script: scriptText'), 'NV1 builder must not include full batch scriptText');
assert(!main.includes('buildTaskPrompt({ task: hardTasks.task2, script: scriptText'), 'NV2 builder must not include full batch scriptText');
assert(main.includes('const finalImagePrompt = task1ImagePrompt;'), 'IMAGE_STAGE must use isolated NV1 prompt');

const nv1SendIndex = chatgptRuntime.indexOf('sendPromptWithSameChatRefreshRecovery(page, finalNv1Prompt');
const nv2SendIndex = chatgptRuntime.indexOf('sendNv2PromptViaDeepCdpInput(page, instruction');
assert(nv1SendIndex > 0 && nv2SendIndex > nv1SendIndex, 'NV2 must be a separate composer submission after NV1');
assert(main.includes('missing validated image before MOTION_STAGE'), 'MOTION_STAGE must require an existing image path');
assert(main.includes('validateContinuityReferenceImage(imagePath)'), 'MOTION_STAGE must validate image before NV2');
assert(!main.includes('assertMotionStagePrompt(prompt);'), 'NV2 prompt must not be boundary-checked by content');
assert(main.includes('Scene ${sceneId}: Sending local keyframe + Motion Prompt to VeoUp.'), 'VeoUp handoff must happen after image and motion prompt');

assert(main.includes('function resolveProjectPrepromptFolder('), 'preprompt folder resolver missing');
assert(main.includes("path.join(projectRoot, 'preprompt')"), 'preprompt directory resolution missing');
assert(main.includes('async function collectPrepromptRequestFiles('), 'preprompt request file collector missing');
assert(chatgptRuntime.includes('ChatGPT hydrate request 1: uploading ${prepromptFiles.length} preprompt file(s).'), 'request 1 must upload preprompt files');
assert(chatgptRuntime.includes('Request 1: read and remember all attached preprompt files. Reply only when ready.'), 'request 1 prompt missing');
assert(/await waitForChatGptHydrationResponse\(\s*page,\s*beforePreprompt\?\.count \|\| 0,\s*{[\s\S]*?request: 1,/.test(chatgptRuntime), 'request 1 must wait for ChatGPT response');
assert(chatgptRuntime.includes('ChatGPT hydrate request 2: uploading ${recentKeyframes.length} recent keyframe(s).'), 'request 2 must upload recent keyframes');
assert(chatgptRuntime.includes('const CHATGPT_HYDRATION_KEYFRAME_LIMIT = 10;'), 'request 2 must use a centralized 10-keyframe limit');
assert(chatgptRuntime.includes('Request 2: read and remember the attached keyframes from up to ${CHATGPT_HYDRATION_KEYFRAME_LIMIT} previous project scenes.'), 'request 2 prompt must use the configured keyframe limit');
assert(/await waitForChatGptHydrationResponse\(\s*page,\s*beforeScenes\?\.count \|\| 0,\s*{[\s\S]*?request: 2,/.test(chatgptRuntime), 'request 2 must wait for ChatGPT response');
assert(renderer.includes('recentScenes: buildRecentScenesForHydration(scene.id, 20)'), 'renderer must send max 20 recent scenes');
assert(chatgptRuntime.includes('const CHAT_ROTATION_ENABLED = false;'), 'automatic ChatGPT rotation must be disabled');
assert(/CHAT_ROTATION_ENABLED\s*&&\s*sessionSceneCounter\s*>=/.test(chatgptRuntime), 'scene-count rotation branch must be gated by CHAT_ROTATION_ENABLED');
assert(chatgptRuntime.includes('Memory refresh counter: ${sessionSceneCounter}/${CHAT_MEMORY_REFRESH_EVERY_SCENES}'), 'same-conversation memory refresh counter log missing');
assert(main.includes('Scene ${sceneId}: Sending NV1.'), 'NV1 send log must use requested text');
assert(main.includes('isChatGptContextFresh = false;'), 'fresh context flag must flip after send/upload success');
assert(main.indexOf('await waitForChatGptHydrationResponse(page, beforeScenes?.count || 0, { sceneId, request: 2 });') < main.indexOf('isChatGptContextFresh = false;'), 'fresh flag must flip after request 2 acknowledgement');
assert(main.includes('Established ChatGPT context detected; preprompt files are not re-uploaded.'), 'non-fresh context must not re-upload preprompt files');

assert(main.includes('retrying NV1 attempt ${attempt + 1}/3'), 'text-only retry log must be bounded');
assert(!main.includes('retrying NV1 continuously'), 'unbounded retry wording must be gone');
assert(!main.includes('const maxAttempts = Number.POSITIVE_INFINITY'), 'unbounded image retry ceiling must be gone');
assert(main.includes("assertPipelineRunActive();\n      await notifyRenderer('chatgpt-image-retry'"), 'image retry notification must be cancellation-guarded');
assert(/assertPipelineRunActive\(\);\s*const stopped = await evaluateOnCdpPage\(client/.test(main), 'image retry stop-button probe must be cancellation-guarded');
assert(/assertPipelineRunActive\([^)]*\);\s*await forceCleanChatGptNewChatRotation\(\);\s*assertPipelineRunActive\([^)]*\);/.test(main), 'chat rotation must be cancellation-guarded');

assert(renderer.includes("videoProvider: 'veoup'"), 'renderer must keep active provider as VeoUp');
assert(!renderer.includes('videoProvider: videoPlatform.value'), 'renderer must not send Grok/PixVerse provider');
assert(!main.includes("return generateVideoWithGenericProvider({ provider: 'grok'"), 'main must not fall back to Grok generation');

// reload blocking & Golden Rule assertions
assert(main.includes('function isReloadBlocked('), 'isReloadBlocked function must be defined');
assert(main.includes('async function requestReloadWithReason('), 'requestReloadWithReason function must be defined');
assert(main.includes('CHATGPT_RELOAD_BLOCKED: Reload requested via CDP was canceled.'), 'CDP reload hook must handle blocked reloads');
assert(main.includes('CHATGPT_RELOAD_BLOCKED: webContents.reload() canceled.'), 'webContents reload hook must handle blocked reloads');
assert(main.includes('CHATGPT_RELOAD_BLOCKED: webContents.reloadIgnoringCache() canceled.'), 'webContents reloadIgnoringCache hook must handle blocked reloads');
assert(main.includes('Recovery Level 7: Refresh requested, but Golden Rule blocks it because valid composer draft is present. Clicking Send instead.'), 'Level 7 must respect Golden Rule draft check');
assert(main.includes('Recovery Level 8: Rotation requested, but Golden Rule blocks it because valid composer draft is present. Clicking Send instead.'), 'Level 8 must respect Golden Rule draft check');
assert(main.includes('Recovery Level 9: Hydration requested, but Golden Rule blocks it because valid composer draft is present. Clicking Send instead.'), 'Level 9 must respect Golden Rule draft check');

// memory guard assertions
assert(main.includes('memoryGB > 1.6'), 'Proactive Memory warning threshold must be 1.6GB');
assert(main.includes('memoryGB > 1.8'), 'Proactive Memory critical threshold must be 1.8GB');
assert(main.includes('memoryGB > 1.95'), 'Proactive Memory rotation threshold must be 1.95GB');

console.log('chatgpt stage isolation tests passed');
