const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_force_hook_after_nv1_send_v2`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

if (s.includes('HOOK_INPUT_GATE_AFTER_NV1_SEND_REAL')) {
  console.log('SKIP: HOOK_INPUT_GATE_AFTER_NV1_SEND_REAL already exists');
  process.exit(0);
}

const needle = 'ChatGPT send image prompt ok';
const idx = s.indexOf(needle);

if (idx < 0) {
  console.error('FAIL: không tìm thấy text ChatGPT send image prompt ok');
  process.exit(1);
}

// Tìm đoạn appendAppLog chứa needle.
const appendStart = s.lastIndexOf('await appendAppLog', idx);
if (appendStart < 0) {
  console.error('FAIL: không tìm thấy await appendAppLog trước ChatGPT send image prompt ok');
  process.exit(1);
}

const appendEndToken = '}).catch(() => null);';
const appendEnd = s.indexOf(appendEndToken, idx);
if (appendEnd < 0) {
  console.error('FAIL: không tìm thấy end appendAppLog sau ChatGPT send image prompt ok');
  process.exit(1);
}

const insertAt = appendEnd + appendEndToken.length;

const hook = `

// HOOK_INPUT_GATE_AFTER_NV1_SEND_REAL
  await vidoraChatGptInputGate(client, {
    sceneId,
    stage: 'after-nv1-send-image-prompt-ok',
  });
`;

s = s.slice(0, insertAt) + hook + s.slice(insertAt);

fs.writeFileSync(p, s, 'utf8');

console.log('OK: inserted HOOK_INPUT_GATE_AFTER_NV1_SEND_REAL after ChatGPT send image prompt ok');
console.log('Backup:', backup);
