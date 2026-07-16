const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const main = read('electron/main.js');
const pipeline = read('electron/main/pipeline/pipeline_runner.js');
const recovery = read('electron/main/chatgpt/chatgpt_recovery.js');
const stability = read('electron/chatgptStability.js');
const renderer = read('electron/renderer.js');
const html = read('electron/index.html');

function sliceFunction(source, signature, nextSignature) {
  const start = source.indexOf(signature);
  const end = source.indexOf(nextSignature, start);
  assert(start >= 0 && end > start, `Cannot extract ${signature}`);
  return source.slice(start, end);
}

assert(pipeline.includes('const CHAT_ROTATION_ENABLED = false;'));
assert(/CHAT_ROTATION_ENABLED\s*&&\s*\n\s*consecutiveFailures\s*>=\s*2/.test(pipeline));

const mainRotation = sliceFunction(
  main,
  'async function forceCleanChatGptNewChatRotation()',
  'async function collectRecentProjectKeyframes',
);
const recoveryRotation = sliceFunction(
  recovery,
  'async function forceCleanChatGptNewChatRotation()',
  'module.exports =',
);
for (const block of [mainRotation, recoveryRotation]) {
  const disabled = block.indexOf('reason: "chat-rotation-disabled"');
  const legacy = block.indexOf('CHATGPT_ROTATION_REQUESTED');
  assert(disabled >= 0 && legacy > disabled, 'rotation helper must return before legacy implementation');
}

assert(stability.includes('newChatEveryNScenes: 0'));
assert(!stability.includes("attempt === 7) return 'new-chat'"));
assert(/function shouldRotateConversation\(_state = \{\}\)[\s\S]*?return \{ rotate: false, reason: '' \}/.test(stability));
assert(!html.includes('chatgpt-rotate-scenes-input'));
assert(!renderer.includes('chatGptRotateScenesInput'));
assert(!renderer.includes('rotateEveryScenes:'));
assert(renderer.includes('autoRotateConversation: false'));

const clearCache = sliceFunction(
  main,
  'async function clearChatGptCacheHandler()',
  'async function openFreshChatGptHandler()',
);
const openFresh = sliceFunction(
  main,
  'async function openFreshChatGptHandler()',
  'function normalizeWebProvider',
);
assert(clearCache.includes('getManualChatGptActionBlockReason()'));
assert(clearCache.includes('Network.clearBrowserCache'));
assert(clearCache.includes('clearAllChatGptPipelineLocks()'));
assert(clearCache.includes('cookiesPreserved: true'));
assert(!clearCache.includes('clearStorageData'));
assert(openFresh.includes('getManualChatGptActionBlockReason()'));
assert(openFresh.includes('chatgpt-still-on-existing-conversation'));
assert(openFresh.includes('invalidateChatGptConversationIdentity("manual-new-chat")'));
assert(openFresh.includes('clearAllChatGptPipelineLocks()'));
assert(!openFresh.includes('forceCleanChatGptNewChatRotation'));

console.log('Phase 1 complete policy tests passed');
