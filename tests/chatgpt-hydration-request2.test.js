const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');

const start = main.indexOf('async function hydrateFreshChatGptContextAfterRotation(options = {}, sceneId = 0)');
assert(start >= 0, 'hydrateFreshChatGptContextAfterRotation missing');
const end = main.indexOf('function updateChatGptConversationIdentity', start);
assert(end > start, 'hydrateFreshChatGptContextAfterRotation block end missing');
const block = main.slice(start, end);

assert(
  block.includes('uploadFilesToChatGptSequentially(page, recentKeyframes, sceneId, { rotationHydration: true, request: 2'),
  'Request 2 must still upload recent keyframes'
);
assert(
  block.includes("if (!uploadKeyframes?.ok) throw new Error(`chatgpt-hydration-keyframes-upload-failed: ${uploadKeyframes?.error || 'unknown'}`);"),
  'Request 2 upload verification must remain'
);
assert(
  block.includes("const sentScenes = await sendPromptViaCdpInput(page, 'Request 2: read and remember the attached keyframes"),
  'Request 2 must still use sendPromptViaCdpInput'
);
assert(
  block.includes("if (!sentScenes?.ok) throw new Error(`chatgpt-hydration-keyframes-message-failed: ${sentScenes?.error || 'unknown'}`);"),
  'Request 2 send acknowledgement gate must remain'
);
assert(
  block.includes('ChatGPT hydrate request 2 sent; skipping assistant completion wait because keyframes are context-only.'),
  'Request 2 must explicitly skip assistant completion wait'
);
assert(
  !block.includes('waitForChatGptHydrationResponse(page, beforeScenes?.count || 0, { sceneId, request: 2 })'),
  'Request 2 must not wait for full assistant completion'
);

const request2SendIndex = block.indexOf('const sentScenes = await sendPromptViaCdpInput');
const request2AckIndex = block.indexOf('if (!sentScenes?.ok)', request2SendIndex);
const freshFalseIndex = block.indexOf('isChatGptContextFresh = false;', request2AckIndex);
const newChatFalseIndex = block.indexOf('globalThis.__vidoraChatGptNewChatMode = false;', freshFalseIndex);
assert(request2SendIndex >= 0 && request2AckIndex > request2SendIndex, 'Request 2 must check send acknowledgement after send');
assert(freshFalseIndex > request2AckIndex, 'Pipeline must mark context fresh false immediately after Request 2 send acknowledgement');
assert(newChatFalseIndex > freshFalseIndex, 'Pipeline must leave new-chat hydration mode after Request 2 send acknowledgement');
assert(
  block.slice(request2AckIndex, freshFalseIndex).includes('waitForChatGptHydrationResponse') === false,
  'No assistant completion wait may occur between Request 2 acknowledgement and NV1-ready state'
);

assert(
  block.includes('await waitForChatGptHydrationResponse(page, beforePreprompt?.count || 0, { sceneId, request: 1 });'),
  'Request 1 must still wait for assistant completion'
);

const runSceneStart = main.indexOf('async function runScenePipelineLocked');
assert(runSceneStart >= 0, 'runScenePipelineLocked missing');
const runSceneBlock = main.slice(runSceneStart, main.indexOf('async function runScenePipelineLockedInternal', runSceneStart));
assert(
  runSceneBlock.includes('await hydrateFreshChatGptContextAfterRotation(options, sceneId);') &&
    runSceneBlock.includes('const result = await runScenePipelineLockedInternal(_event, options);'),
  'Pipeline must proceed to NV1/NV2 scene pipeline after hydration returns'
);

console.log('chatgpt hydration request 2 tests passed');
