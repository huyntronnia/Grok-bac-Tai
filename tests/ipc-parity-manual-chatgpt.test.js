const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const preload = fs.readFileSync(path.join(root, 'electron/preload.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');
const ipcHandlers = fs.readFileSync(path.join(root, 'electron/main/ipc/ipc_handlers.js'), 'utf8');
const handlerSource = `${main}\n${ipcHandlers}`;

const invokes = [...preload.matchAll(/ipcRenderer\.invoke\(\s*['"]([^'"]+)/g)]
  .map((match) => match[1])
  .sort();
const handles = [...handlerSource.matchAll(/ipcMain\.handle\(\s*['"]([^'"]+)/g)]
  .map((match) => match[1])
  .sort();

const missing = invokes.filter((channel) => !handles.includes(channel));
assert.deepStrictEqual(missing, [], `Missing ipcMain.handle channels: ${missing.join(', ')}`);

assert(invokes.includes('chatgpt:clear-cache'), 'manual clear-cache invoke missing');
assert(invokes.includes('chatgpt:open-fresh-chat'), 'manual open-fresh-chat invoke missing');
assert(handles.includes('chatgpt:clear-cache'), 'manual clear-cache handler missing');
assert(handles.includes('chatgpt:open-fresh-chat'), 'manual open-fresh-chat handler missing');

assert(main.includes('async function clearChatGptCacheHandler('), 'clearChatGptCacheHandler missing');
assert(main.includes('async function openFreshChatGptHandler('), 'openFreshChatGptHandler missing');
assert(main.includes('clearChatGptCacheHandler,'), 'clearChatGptCacheHandler must be injected into runtimeIpcHandlers');
assert(main.includes('openFreshChatGptHandler,'), 'openFreshChatGptHandler must be injected into runtimeIpcHandlers');

assert(
  ipcHandlers.includes('"chatgpt:clear-cache"') &&
    ipcHandlers.includes('safeIpcHandler(clearChatGptCacheHandler)'),
  'clear-cache handler must use safeIpcHandler(clearChatGptCacheHandler)',
);
assert(
  ipcHandlers.includes('"chatgpt:open-fresh-chat"') &&
    ipcHandlers.includes('safeIpcHandler(openFreshChatGptHandler)'),
  'open-fresh-chat handler must use safeIpcHandler(openFreshChatGptHandler)',
);

const clearStart = main.indexOf('async function clearChatGptCacheHandler(');
const clearEnd = main.indexOf('\nasync function openFreshChatGptHandler(', clearStart);
const clearBlock = main.slice(clearStart, clearEnd);
assert(clearBlock.includes('assertManualChatGptActionAllowed("chatgpt-clear-cache")'), 'clear-cache must block active pipeline/send');
assert(clearBlock.includes('clearBrowserCache'), 'clear-cache must clear browser cache');
assert(!clearBlock.includes('clearStorageData'), 'clear-cache must not clear cookies/storage data');
assert(!clearBlock.includes('localStorage.clear'), 'clear-cache must not clear ChatGPT localStorage');

const openStart = main.indexOf('async function openFreshChatGptHandler(');
const openEnd = main.indexOf('\nasync function assertChatGptNotExistingConversation', openStart);
const openBlock = main.slice(openStart, openEnd);
assert(openBlock.includes('assertManualChatGptActionAllowed("chatgpt-open-fresh-chat")'), 'open fresh chat must block active pipeline/send');
assert(!openBlock.includes('forceCleanChatGptNewChatRotation'), 'manual open fresh chat must not use auto-rotation helper');

console.log('ipc parity and manual ChatGPT IPC tests passed');
