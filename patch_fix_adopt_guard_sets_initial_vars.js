const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_adopt_guard_sets_initial_vars`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

const oldBlock = `      if (activeGeneration) activeGeneration.generating = false;
      if (imageState) imageState.generating = false;`;

const newBlock = `      // Chặn đúng biến mà if adopt phía dưới đang dùng.
      try { if (initialActiveGeneration) initialActiveGeneration.generating = false; } catch {}
      try { if (initialImageState) initialImageState.generating = false; } catch {}
      try { if (activeGeneration) activeGeneration.generating = false; } catch {}
      try { if (imageState) imageState.generating = false; } catch {}`;

if (!s.includes(oldBlock)) {
  console.error('FAIL: không tìm thấy block set activeGeneration/imageState cũ');
  process.exit(1);
}

s = s.replace(oldBlock, newBlock);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: adopt guard now clears initialActiveGeneration/initialImageState too');
console.log('Backup:', backup);
