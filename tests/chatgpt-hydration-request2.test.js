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
  pipeline.includes('const CHATGPT_HYDRATION_KEYFRAME_LIMIT = 10;'),
  'Request 2 keyframe limit must be centralized at 10'
);
assert(
  /collectRecentProjectKeyframes\(\s*projectDir,\s*CHATGPT_HYDRATION_KEYFRAME_LIMIT,\s*sceneId,?\s*\)/.test(block),
  'Request 2 must collect up to 10 recent keyframes before the current scene'
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
  block.includes('const sentScenes = await sendPromptWithSameChatRefreshRecovery('),
  'Request 2 must use same-chat send recovery'
);
assert(
  block.includes('Request 2: read and remember the attached keyframes from up to ${CHATGPT_HYDRATION_KEYFRAME_LIMIT} previous project scenes.'),
  'Request 2 prompt must use the centralized 10-keyframe limit'
);
assert(
  block.includes('chatgpt-hydration-keyframes-message-failed'),
  'Request 2 send acknowledgement gate must remain'
);
assert(
  /await waitForChatGptHydrationResponse\(\s*page,\s*snapshot\.hydration\.request2BeforeCount,\s*{[\s\S]*?request: 2,/.test(block),
  'Request 2 must wait for assistant completion'
);

const request2SendIndex = block.indexOf('const sentScenes = await sendPromptWithSameChatRefreshRecovery');
const request2AckIndex = block.indexOf('if (!sentScenes?.ok)', request2SendIndex);
const request2WaitIndex = block.indexOf('const request2Text = await waitForChatGptHydrationResponse', request2AckIndex);
const freshFalseIndex = block.indexOf('setChatGptContextFresh(false);', request2WaitIndex);
const newChatFalseIndex = block.indexOf('globalThis.__vidoraChatGptNewChatMode = false;', freshFalseIndex);
assert(request2SendIndex >= 0 && request2AckIndex > request2SendIndex, 'Request 2 must check send acknowledgement after send');
assert(request2WaitIndex > request2AckIndex, 'Request 2 must wait after send acknowledgement');
assert(freshFalseIndex > request2WaitIndex, 'Pipeline must mark context fresh false after Request 2 completion');
assert(newChatFalseIndex > freshFalseIndex, 'Pipeline must leave new-chat hydration mode after Request 2 completion');

assert(
  /await waitForChatGptHydrationResponse\(\s*page,\s*snapshot\.hydration\.request1BeforeCount,\s*{[\s\S]*?request: 1,/.test(block),
  'Request 1 must still wait for assistant completion'
);

assert(block.includes('initialConversationState?.conversationLength'), 'new chat must use total user + assistant message count');
assert(block.includes('request1Sent && request1Owned'), 'Request 1 sent checkpoint must resume waiting without duplicate upload');
assert(block.includes('request2Sent && request2Owned'), 'Request 2 sent checkpoint must resume waiting without duplicate upload');

console.log('chatgpt hydration request 2 tests passed');
