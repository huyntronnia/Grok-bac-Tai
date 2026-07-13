const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pipeline = fs.readFileSync(
  path.join(root, 'electron/main/chatgpt/chatgpt_pipeline.js'),
  'utf8',
);

const start = pipeline.indexOf('async function hydrateFreshChatGptContextAfterRotation(');
assert(start >= 0, 'hydrateFreshChatGptContextAfterRotation missing');
const end = pipeline.indexOf('\nfunction clearAllChatGptPipelineLocks', start);
assert(end > start, 'hydrateFreshChatGptContextAfterRotation block end missing');
const block = pipeline.slice(start, end);

assert(
  block.includes('collectRecentProjectKeyframes(projectDir, 5, sceneId)'),
  'Request 2 must collect only 5 recent keyframes'
);
assert(
  block.includes('uploadFilesToChatGptSequentially') &&
    block.includes('request: 2'),
  'Request 2 must still upload recent keyframes'
);
assert(
  block.includes('chatgpt-hydration-keyframes-upload-failed'),
  'Request 2 upload verification must remain'
);
assert(
  block.includes('const sentScenes = await sendPromptViaCdpInput('),
  'Request 2 must still use sendPromptViaCdpInput'
);
assert(
  block.includes('Request 2: read and remember the attached keyframes from up to 5 previous project scenes.'),
  'Request 2 prompt must describe 5 previous scenes'
);
assert(
  block.includes('chatgpt-hydration-keyframes-message-failed'),
  'Request 2 send acknowledgement gate must remain'
);
assert(
  /await waitForChatGptHydrationResponse\(\s*page,\s*beforeScenes\?\.count \|\| 0,\s*{[\s\S]*?request: 2,/.test(block),
  'Request 2 must wait for assistant completion'
);

const request2SendIndex = block.indexOf('const sentScenes = await sendPromptViaCdpInput');
const request2AckIndex = block.indexOf('if (!sentScenes?.ok)', request2SendIndex);
const request2WaitIndex = block.indexOf('const request2Text = await waitForChatGptHydrationResponse', request2AckIndex);
const freshFalseIndex = block.indexOf('setChatGptContextFresh(false);', request2WaitIndex);
const newChatFalseIndex = block.indexOf('globalThis.__vidoraChatGptNewChatMode = false;', freshFalseIndex);
assert(request2SendIndex >= 0 && request2AckIndex > request2SendIndex, 'Request 2 must check send acknowledgement after send');
assert(request2WaitIndex > request2AckIndex, 'Request 2 must wait after send acknowledgement');
assert(freshFalseIndex > request2WaitIndex, 'Pipeline must mark context fresh false after Request 2 completion');
assert(newChatFalseIndex > freshFalseIndex, 'Pipeline must leave new-chat hydration mode after Request 2 completion');

assert(
  /await waitForChatGptHydrationResponse\(\s*page,\s*beforePreprompt\?\.count \|\| 0,\s*{[\s\S]*?request: 1,/.test(block),
  'Request 1 must still wait for assistant completion'
);

console.log('chatgpt hydration request 2 tests passed');
