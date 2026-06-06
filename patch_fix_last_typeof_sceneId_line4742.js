const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_last_typeof_sceneId_line4742`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

const bad = "sceneId: (typeof sceneId !== 'undefined' ? sceneId : ((typeof context !== 'undefined' && context?.sceneId) || (typeof options !== 'undefined' && options?.sceneId) || '')),";
const good = "sceneId: ((typeof context !== 'undefined' && context?.sceneId) || (typeof options !== 'undefined' && options?.sceneId) || ''),";

const count = s.split(bad).length - 1;

if (count <= 0) {
  console.log('WARN: không tìm thấy exact bad string. Sẽ replace regex fallback.');

  s = s.replace(
    /sceneId:\s*\(typeof sceneId !== 'undefined' \? sceneId : \(\(typeof context !== 'undefined' && context\?\.sceneId\) \|\| \(typeof options !== 'undefined' && options\?\.sceneId\) \|\| ''\)\),/g,
    good
  );
} else {
  s = s.replaceAll(bad, good);
  console.log(`OK: replaced exact bad sceneId count=${count}`);
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: fixed last typeof sceneId');
console.log('Backup:', backup);
