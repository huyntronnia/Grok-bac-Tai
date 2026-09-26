const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const preload = fs.readFileSync(path.join(root, 'electron/preload.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');
const ipcHandlers = fs.readFileSync(path.join(root, 'electron/main/ipc/ipc_handlers.js'), 'utf8');
const manualWorkflowIpc = fs.readFileSync(path.join(root, 'electron/main/ipc/manual_workflow_ipc.js'), 'utf8');
const handlerSource = `${main}\n${ipcHandlers}`;

const invokes = [...preload.matchAll(/ipcRenderer\.invoke\(\s*['"]([^'"]+)/g)]
  .map((match) => match[1])
  .sort();
const directHandles = [...handlerSource.matchAll(/ipcMain\.handle\(\s*['"]([^'"]+)/g)]
  .map((match) => match[1]);
const registeredManualHandles = [...manualWorkflowIpc.matchAll(/^\s*\w+:\s*"([^"]+)"/gm)]
  .map((match) => match[1]);
const handles = [...new Set([...directHandles, ...registeredManualHandles])].sort();

const missing = invokes.filter((channel) => !handles.includes(channel));
assert.deepStrictEqual(missing, [], `Missing ipcMain.handle channels: ${missing.join(', ')}`);
assert(ipcHandlers.includes('registerManualWorkflowIpc({'), 'manual workflow IPC must be registered in production');

assert(invokes.includes('chatgpt:clear-cache'), 'manual clear-cache invoke missing');
assert(!invokes.includes('chatgpt:open-fresh-chat'), 'manual workflow must not expose a Vidora new-chat action');
assert(handles.includes('chatgpt:clear-cache'), 'manual clear-cache handler missing');

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
    ipcHandlers.includes('assertAutomaticChatGptMutationAllowed("fresh-chat-ipc")'),
  'legacy open-fresh-chat IPC must be blocked by the canonical manual guard',
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
assert(openBlock.includes('assertAutomaticChatGptMutationAllowed("open-fresh-chat")'), 'legacy open fresh chat must be blocked by the canonical manual guard');
assert(!openBlock.includes('forceCleanChatGptNewChatRotation'), 'manual open fresh chat must not use auto-rotation helper');

console.log('ipc parity and manual ChatGPT IPC tests passed');
