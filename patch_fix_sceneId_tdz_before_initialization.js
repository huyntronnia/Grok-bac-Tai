const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_sceneId_tdz_before_initialization`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

// Không được dùng typeof sceneId vì nếu trong scope có let/const sceneId khai báo phía dưới,
// JS sẽ ném "Cannot access 'sceneId' before initialization".
const safeNoSceneId = "((typeof options !== 'undefined' && options?.sceneId) || (typeof context !== 'undefined' && context?.sceneId) || '')";

// Replace các safe expression cũ còn đụng sceneId.
s = s.replaceAll(
  "((typeof sceneId !== 'undefined' && sceneId) || (typeof options !== 'undefined' && options?.sceneId) || (typeof context !== 'undefined' && context?.sceneId) || '')",
  safeNoSceneId
);

s = s.replaceAll(
  "(typeof sceneId !== 'undefined' ? sceneId : ((typeof options !== 'undefined' && options?.sceneId) || (typeof context !== 'undefined' && context?.sceneId) || ''))",
  safeNoSceneId
);

s = s.replaceAll(
  "typeof sceneId !== 'undefined' ? sceneId : ''",
  safeNoSceneId
);

s = s.replaceAll(
  "typeof sceneId !== 'undefined' ? sceneId : ((typeof options !== 'undefined' && options?.sceneId) || (typeof context !== 'undefined' && context?.sceneId) || '')",
  safeNoSceneId
);

// Nếu còn hook context có sceneId trần trong stage image/extract thì đổi nốt.
s = s.replaceAll(
  "sceneId,\n        stage: 'after-nv1-sentImage-log'",
  `sceneId: ${safeNoSceneId},\n        stage: 'after-nv1-sentImage-log'`
);

s = s.replaceAll(
  "sceneId,\n    stage: 'after-nv1-sentImage-log'",
  `sceneId: ${safeNoSceneId},\n    stage: 'after-nv1-sentImage-log'`
);

s = s.replaceAll(
  "sceneId,\n        stage: 'after-nv1-send-before-rename'",
  `sceneId: ${safeNoSceneId},\n        stage: 'after-nv1-send-before-rename'`
);

s = s.replaceAll(
  "sceneId,\n    stage: 'after-nv1-send-before-rename'",
  `sceneId: ${safeNoSceneId},\n    stage: 'after-nv1-send-before-rename'`
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: removed typeof sceneId to avoid TDZ before initialization');
console.log('Backup:', backup);
