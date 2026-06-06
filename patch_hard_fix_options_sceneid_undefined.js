const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_hard_fix_options_sceneid_undefined`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

const safeSceneId = "((typeof sceneId !== 'undefined' && sceneId) || (typeof options !== 'undefined' && options?.sceneId) || (typeof context !== 'undefined' && context?.sceneId) || '')";

// Fix object context sceneId còn dùng options trực tiếp.
s = s.replaceAll("sceneId: options?.sceneId || ''", `sceneId: ${safeSceneId}`);
s = s.replaceAll("sceneId: options.sceneId || ''", `sceneId: ${safeSceneId}`);

// Fix template / string / function call còn dùng options.sceneId trực tiếp.
s = s.replaceAll("options.sceneId || ''", safeSceneId);
s = s.replaceAll("options?.sceneId || ''", safeSceneId);

// Fix những chỗ dùng sceneId trần trong object context.
s = s.replaceAll(
  "sceneId,\n        stage:",
  `sceneId: ${safeSceneId},\n        stage:`
);

s = s.replaceAll(
  "sceneId,\n    stage:",
  `sceneId: ${safeSceneId},\n    stage:`
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: hard fixed sceneId/options undefined');
console.log('Backup:', backup);
