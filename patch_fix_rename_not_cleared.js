const fs = require('fs');

const mainPath = 'electron/main.js';
const rendererPath = 'electron/renderer.js';

let main = fs.readFileSync(mainPath, 'utf8');
let renderer = fs.readFileSync(rendererPath, 'utf8');

fs.copyFileSync(mainPath, `${mainPath}.bak_fix_rename_not_cleared`);
fs.copyFileSync(rendererPath, `${rendererPath}.bak_fix_rename_not_cleared`);

// MAIN: đổi log cũ
main = main.replace(
  /text:\s*`ChatGPT new-chat mode: auto rename disabled for safety\. targetRename="\$\{effectivePendingChatRenameTitle\}"`,/g,
  "text: `ChatGPT new-chat mode: safe rename enabled. targetRename=\"${effectivePendingChatRenameTitle}\"`,"
);

// MAIN: không được xóa title rename nữa
main = main.replace(
  /(\s*)effectivePendingChatRenameTitle\s*=\s*'';\s*/g,
  `$1// keep effectivePendingChatRenameTitle for safe rename later\n`
);

// RENDERER: đổi status option 1
renderer = renderer.replace(
  /setStatus\(`Option 1: bỏ tìm chat cũ\. Tool sẽ mở chat mới và gửi prompt\. Tạm tắt auto rename để tránh đổi nhầm chat cũ\.`, 'running'\);/g,
  "setStatus(`Option 1: bỏ tìm chat cũ. Tool sẽ mở chat mới, gửi prompt, rồi rename an toàn đúng chat hiện tại.`, 'running');"
);

fs.writeFileSync(mainPath, main, 'utf8');
fs.writeFileSync(rendererPath, renderer, 'utf8');

const all = main + '\n' + renderer;

if (all.includes('auto rename disabled for safety') || all.includes('Tạm tắt auto rename')) {
  console.error('FAIL: vẫn còn text tắt rename trong source');
  process.exit(1);
}

console.log('OK: fixed rename disabled log + stopped clearing rename title');
