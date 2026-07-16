const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const html = read('electron/index.html');
const css = read('electron/style.css');
const renderer = read('electron/renderer.js');
const preload = read('electron/preload.js');
const ipc = read('electron/main/ipc/ipc_handlers.js');
const main = read('electron/main.js');

assert(!/grok|pixverse/i.test(html), 'Grok/PixVerse UI text or controls remain');
assert(!/grok|pixverse/i.test(css), 'Grok/PixVerse-only CSS remains');

for (const symbol of [
  'videoPlatformSelect',
  'continuityGrokToggle',
  'grokResultRetryLimitInput',
  'pixverseConfig',
  'pixverseCapability',
  'getGrokRecoverySettings',
  'applyGrokRecoverySettings',
  'estimatePixVerseEnergy',
  'isPixVerseProConfig',
  'suggestPixVerseConfig',
  'updatePixVerseConfigAdvice',
  'getGrokRouterSettings',
  'renderGrokRouterStatus',
  'refreshGrokRouterStatus',
]) {
  assert(!renderer.includes(symbol), `Removed renderer symbol remains: ${symbol}`);
}

const scrubStart = renderer.indexOf('function scrubLegacyProjectFields(');
const scrubEnd = renderer.indexOf('\nfunction getProjectSessionPayload', scrubStart);
assert(scrubStart >= 0 && scrubEnd > scrubStart, 'legacy scrub boundary missing');
const rendererWithoutMigration = renderer.slice(0, scrubStart) + renderer.slice(scrubEnd);
assert(!/grok|pixverse/i.test(rendererWithoutMigration), 'runtime renderer still contains Grok/PixVerse behavior outside migration scrub');

for (const channel of [
  'router:open-grok-folder',
  'router:get-status',
  'router:list-accounts-safe',
  'router:select-account',
  'router:set-enabled',
  'router:resume-checkpoint',
]) {
  assert(!preload.includes(channel), `preload still exposes ${channel}`);
  assert(!ipc.includes(channel), `IPC handler still registers ${channel}`);
}

for (const symbol of [
  'openGrokRouterFolder',
  'getGrokRouterStatus',
  'listGrokAccountsSafe',
  'selectGrokAccount',
  'setAccountRouterEnabled',
  'resumeFromRouterCheckpoint',
]) {
  assert(!preload.includes(symbol), `preload bridge still exposes ${symbol}`);
  assert(!ipc.includes(symbol), `IPC runtime still consumes ${symbol}`);
}

for (const channel of [
  'accounts:list-safe',
  'accounts:save',
  'accounts:delete',
  'chatgpt:clear-cache',
  'chatgpt:open-fresh-chat',
]) {
  assert(ipc.includes(channel), `required IPC channel removed: ${channel}`);
}

const runtimeStart = main.indexOf('runtimeIpcHandlers: {');
const runtimeEnd = main.indexOf('app.on("web-contents-created"', runtimeStart);
assert(runtimeStart >= 0 && runtimeEnd > runtimeStart, 'runtimeIpcHandlers block missing');
const runtimeIpcBlock = main.slice(runtimeStart, runtimeEnd);
assert(!/GrokRouter|GrokAccount|resumeFromRouterCheckpoint/.test(runtimeIpcBlock), 'main still injects router dependencies into IPC');

console.log('Phase 2 UI/renderer/IPC cleanup tests passed');
