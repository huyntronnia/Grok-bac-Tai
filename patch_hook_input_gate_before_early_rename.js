const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_hook_input_gate_before_early_rename`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

if (s.includes('HOOK_INPUT_GATE_AFTER_NV1_SEND_BEFORE_RENAME_REAL')) {
  console.log('SKIP: hook already exists');
  process.exit(0);
}

const needle = 'earlyRenameTitle';
const idx = s.indexOf(needle);

if (idx < 0) {
  console.error('FAIL: không tìm thấy earlyRenameTitle');
  process.exit(1);
}

// Tìm đầu statement/log gần earlyRenameTitle để chèn trước đó
let insertAt = s.lastIndexOf('await appendAppLog', idx);
if (insertAt < 0) {
  insertAt = s.lastIndexOf('const earlyRenameTitle', idx);
}
if (insertAt < 0) {
  insertAt = s.lastIndexOf('let earlyRenameTitle', idx);
}
if (insertAt < 0) {
  console.error('FAIL: không tìm được vị trí chèn trước earlyRenameTitle');
  process.exit(1);
}

const hook = `
// HOOK_INPUT_GATE_AFTER_NV1_SEND_BEFORE_RENAME_REAL
  await vidoraChatGptInputGate(client, {
    sceneId,
    stage: 'after-nv1-send-before-rename',
  });

`;

s = s.slice(0, insertAt) + hook + s.slice(insertAt);

fs.writeFileSync(p, s, 'utf8');

console.log('OK: inserted input gate before earlyRenameTitle');
console.log('Backup:', backup);
