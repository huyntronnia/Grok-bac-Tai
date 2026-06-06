const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_input_gate_client_not_defined`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

const safeTarget = `(typeof client !== 'undefined' ? client : (typeof page !== 'undefined' ? page : null))`;

// Fix các hook input gate / clear input do patch thêm.
s = s.replaceAll(
  'await vidoraChatGptInputGate(client, {',
  `await vidoraChatGptInputGate(${safeTarget}, {`
);

s = s.replaceAll(
  'await vidoraClearChatGptInputBeforePaste(client, {',
  `await vidoraClearChatGptInputBeforePaste(${safeTarget}, {`
);

s = s.replaceAll(
  'await vidoraReadChatGptComposerStateReal(client,',
  `await vidoraReadChatGptComposerStateReal(${safeTarget},`
);

s = s.replaceAll(
  'await vidoraClickChatGptRealSendButton(client,',
  `await vidoraClickChatGptRealSendButton(${safeTarget},`
);

// Thêm guard vào helper để báo lỗi rõ nếu target null.
s = s.replace(
  /async function vidoraReadChatGptComposerStateReal\(client, context = \{\}\) \{\s*return await evaluateOnCdpPage\(client,/,
  `async function vidoraReadChatGptComposerStateReal(client, context = {}) {
  if (!client) return { ok: false, error: 'chatgpt-input-gate-no-cdp-target', context };
  return await evaluateOnCdpPage(client,`
);

s = s.replace(
  /async function vidoraClickChatGptRealSendButton\(client, state\) \{\s*const rect = state\?\.sendButton\?\.rect;/,
  `async function vidoraClickChatGptRealSendButton(client, state) {
  if (!client) return { ok: false, error: 'chatgpt-input-gate-no-cdp-target', state };
  const rect = state?.sendButton?.rect;`
);

s = s.replace(
  /async function vidoraClearChatGptInputBeforePaste\(client, context = \{\}\) \{\s*const state = await vidoraReadChatGptComposerStateReal\(client, context\);/,
  `async function vidoraClearChatGptInputBeforePaste(client, context = {}) {
  if (!client) return { ok: false, error: 'chatgpt-input-gate-no-cdp-target', context };
  const state = await vidoraReadChatGptComposerStateReal(client, context);`
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: fixed input gate client/page target');
console.log('Backup:', backup);
