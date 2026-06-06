const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_context_not_defined`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

// Fix mọi chỗ dùng context?. khi biến context có thể chưa tồn tại.
s = s.replaceAll(
  "(context?.sceneId || options?.sceneId || '')",
  "((typeof context !== 'undefined' && context?.sceneId) || (typeof options !== 'undefined' && options?.sceneId) || '')"
);

s = s.replaceAll(
  "context?.sceneId || options?.sceneId || ''",
  "((typeof context !== 'undefined' && context?.sceneId) || (typeof options !== 'undefined' && options?.sceneId) || '')"
);

s = s.replaceAll(
  "context?.sceneId || sceneId || ''",
  "((typeof context !== 'undefined' && context?.sceneId) || (typeof sceneId !== 'undefined' ? sceneId : '') || '')"
);

// Fix riêng block clear input trước focus nếu đang có sceneId/context/options không an toàn.
s = s.replaceAll(
  "sceneId: typeof sceneId !== 'undefined' ? sceneId : ((typeof context !== 'undefined' && context?.sceneId) || (typeof options !== 'undefined' && options?.sceneId) || ''),",
  "sceneId: (typeof sceneId !== 'undefined' ? sceneId : ((typeof context !== 'undefined' && context?.sceneId) || (typeof options !== 'undefined' && options?.sceneId) || '')),"
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: fixed context is not defined');
console.log('Backup:', backup);
