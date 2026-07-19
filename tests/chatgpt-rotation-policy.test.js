const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');
const chatgptPipeline = fs.readFileSync(path.join(root, 'electron/main/chatgpt/chatgpt_pipeline.js'), 'utf8');
const chatgptRecovery = fs.readFileSync(path.join(root, 'electron/main/chatgpt/chatgpt_recovery.js'), 'utf8');
const chatgptRuntime = `${main}\n${chatgptPipeline}\n${chatgptRecovery}`;
const renderer = fs.readFileSync(path.join(root, 'electron/renderer.js'), 'utf8');

function extractFunction(name) {
  const start = main.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} source not found`);
  const endFunction = main.indexOf('\n}\n\nfunction ', start);
  const endAsync = main.indexOf('\n}\n\nasync function ', start);
  const candidates = [endFunction, endAsync].filter((value) => value > start);
  assert(candidates.length, `${name} source end not found`);
  return main.slice(start, Math.min(...candidates) + 3);
}

function extractAsyncFunction(name) {
  return extractAsyncFunctionFrom(main, name);
}

function extractAsyncFunctionFrom(source, name, endMarker = '\n}\n\nasync function ') {
  const start = source.indexOf(`async function ${name}(`);
  assert(start >= 0, `${name} source not found`);
  const end = source.indexOf(endMarker, start + 1);
  assert(end > start, `${name} source end not found`);
  return source.slice(start, end);
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${extractFunction('isChatGptRequestRotationEligible')}
this.isChatGptRequestRotationEligible = isChatGptRequestRotationEligible;`, sandbox);

assert.strictEqual(sandbox.isChatGptRequestRotationEligible(new Error('send prompt failed after retries'), 'nv1_sent'), true, 'send failures can rotate');
assert.strictEqual(sandbox.isChatGptRequestRotationEligible(new Error('ChatGPT rate-limit 429 too many requests'), 'nv2_waiting_response'), true, 'rate-limit can rotate');
assert.strictEqual(sandbox.isChatGptRequestRotationEligible(new Error('nv2-response-missing-after-passive-wait-and-refresh'), 'nv2_waiting_response'), true, 'missing response after retries can rotate');
assert.strictEqual(sandbox.isChatGptRequestRotationEligible(new Error('conversation lost before NV2'), 'nv2_prepare'), true, 'unusable conversation can rotate');

assert.strictEqual(sandbox.isChatGptRequestRotationEligible(new Error('veoup-launcher-not-found'), 'veoup_prepare'), false, 'VeoUp errors must not rotate ChatGPT');
assert.strictEqual(sandbox.isChatGptRequestRotationEligible(new Error('ENOENT local file missing'), 'nv1_prepare'), false, 'local file errors must not rotate ChatGPT');
assert.strictEqual(sandbox.isChatGptRequestRotationEligible(new Error('Execution context was destroyed'), 'nv1_waiting_image'), false, 'stale DOM errors must not rotate ChatGPT');
assert.strictEqual(sandbox.isChatGptRequestRotationEligible(new Error('nv2-existing-response-still-generating'), 'nv2_waiting_response'), false, 'waiting generation must not rotate ChatGPT');
assert.strictEqual(sandbox.isChatGptRequestRotationEligible(new Error('ChatGPT conversation changed during NV2 refresh'), 'nv2_waiting_response'), false, 'URL changes must not rotate ChatGPT');
assert.strictEqual(sandbox.isChatGptRequestRotationEligible(new Error('ChatGPT is busy/streaming; duplicate motion prompt send blocked.'), 'nv2_prepare'), false, 'busy/streaming must not rotate ChatGPT');
assert.strictEqual(sandbox.isChatGptRequestRotationEligible(new Error('chatgpt-image-retry-threshold-reached-no-auto-rotation'), 'nv1_waiting_image'), false, 'image retry threshold must not rotate ChatGPT');

assert(!main.includes('sessionSceneCounter >= 5'), 'periodic scene-count rotation must be disabled');
assert(!main.includes('sessionSceneCounter === 0 ||'), 'scene counter zero must not force new chat');
assert(!main.includes('window.location.href = "https://chatgpt.com/"'), 'memory GC must not navigate ChatGPT to root');
assert(main.includes('ChatGPT memory GC refresh disabled'), 'memory GC disable log missing');
assert(main.includes('Rotating ChatGPT only after repeated valid request failures.'), 'rotation pre-log missing');
assert(main.includes('hydrateFreshChatGptContextAfterRotation(options, sceneId)'), 'fresh chat must be hydrated after recovery rotation');
assert(chatgptRuntime.includes('const CHATGPT_HYDRATION_KEYFRAME_LIMIT = 10;'), 'rotation hydration must share the 10-keyframe limit');
assert(/collectRecentProjectKeyframes\(\s*projectDir,\s*CHATGPT_HYDRATION_KEYFRAME_LIMIT,?\s*\)/.test(chatgptRuntime), 'rotation hydration must collect up to 10 recent keyframes');
assert(main.includes('ChatGPT rotation hydrate request 1: uploading selected scene txt file.'), 'rotation request 1 selected scene file upload log missing');
assert(main.includes('sourceSceneFilePath && await pathExists(sourceSceneFilePath)'), 'rotation request 1 must prefer the original selected scene txt path');
assert(main.includes('sourceSceneFileName || \'scene.txt\''), 'rotation request 1 must preserve selected scene file name for fallback copy');
assert(main.includes('ChatGPT rotation hydrate request 2: uploading ${keyframes.length} recent keyframes.'), 'rotation request 2 keyframe upload log missing');
assert(main.includes('ChatGPT rotation hydrate request 3: continuing active scene request in the new chat.'), 'rotation request 3 active-scene retry log missing');
assert(main.includes('Auto new-chat rotation disabled; preserving current conversation'), 'image retry threshold must preserve current conversation');
assert(renderer.includes('sourceSceneFileName: newProjectSceneFileOriginalName || \'scene.txt\''), 'new project must store selected scene file name');
assert(renderer.includes('sourceSceneFilePath: newProjectSceneFilePath || \'\''), 'new project must store selected scene file path when available');
assert(renderer.includes('sourceSceneText: project?.sourceSceneText || scriptInput?.value?.trim() || \'\''), 'pipeline payload must pass selected scene text fallback');

const responseChoiceRecovery = extractAsyncFunctionFrom(
  chatgptRecovery,
  'recoverChatGptResponseChoiceChat',
  '\nasync function forceCleanChatGptNewChatRotation',
);
assert(!responseChoiceRecovery.includes('clickChatGptStartNewChatScript'), 'response-choice recovery must not click New Chat directly');
assert(!responseChoiceRecovery.includes("Page.navigate({ url: 'https://chatgpt.com/'"), 'response-choice recovery must not navigate to root directly');
assert(responseChoiceRecovery.includes('response-choice-no-auto-new-chat'), 'response-choice recovery must skip direct new-chat rotation');

const imageFlow = extractAsyncFunctionFrom(
  chatgptPipeline,
  'generateImageAndMotionWithChatGPT',
  '\nasync function generateMotionPromptWithChatGPT',
);
assert(!imageFlow.includes('openFreshChatGptRootPage'), 'image/NV1 flow must not directly open a new ChatGPT chat');
const directNewChatHelper = extractAsyncFunction('openFreshChatGptRootPage');
assert(directNewChatHelper.includes('direct-chatgpt-new-chat-without-hydration-disabled'), 'direct New Chat helper must be hard disabled');
assert(!directNewChatHelper.includes("Page.navigate({ url: 'https://chatgpt.com/'"), 'direct New Chat helper must not navigate to root');
assert(main.includes('forceRegenerateImage: true'), 'rotation request 3 must restart image generation from NV1');
assert(main.includes('forceRegenerateMotionPrompt: true'), 'rotation request 3 must regenerate motion after new image');

console.log('chatgpt rotation policy tests passed');
