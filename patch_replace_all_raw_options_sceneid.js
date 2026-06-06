const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_replace_all_raw_options_sceneid`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

const safeSceneId = "((typeof sceneId !== 'undefined' && sceneId) || (typeof options !== 'undefined' && options?.sceneId) || (typeof context !== 'undefined' && context?.sceneId) || '')";

// Chỉ thay raw options.sceneId, không đụng options?.sceneId trong safe expression.
const beforeCount = (s.match(/options\.sceneId/g) || []).length;
s = s.replaceAll("options.sceneId", safeSceneId);
const afterCount = (s.match(/options\.sceneId/g) || []).length;

fs.writeFileSync(p, s, 'utf8');

console.log(`DONE: replaced raw options.sceneId count=${beforeCount}, remaining=${afterCount}`);
console.log('Backup:', backup);
