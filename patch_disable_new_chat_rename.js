const fs = require('fs');

const mainPath = 'electron/main.js';
const rendererPath = 'electron/renderer.js';

let main = fs.readFileSync(mainPath, 'utf8');
let renderer = fs.readFileSync(rendererPath, 'utf8');

const mainBackup = `${mainPath}.bak_disable_new_chat_rename`;
const rendererBackup = `${rendererPath}.bak_disable_new_chat_rename`;

if (!fs.existsSync(mainBackup)) fs.copyFileSync(mainPath, mainBackup);
if (!fs.existsSync(rendererBackup)) fs.copyFileSync(rendererPath, rendererBackup);

function replaceRegexInMain(rx, to, label) {
  const before = main;
  main = main.replace(rx, to);
  console.log(before === main ? `SKIP main: ${label}` : `OK main: ${label}`);
}

function replaceRegexInRenderer(rx, to, label) {
  const before = renderer;
  renderer = renderer.replace(rx, to);
  console.log(before === renderer ? `SKIP renderer: ${label}` : `OK renderer: ${label}`);
}

// 1) Sau khi xác định useFreshNewChat, tắt pending rename.
// Mục tiêu: New chat chỉ gửi prompt, KHÔNG rename sidebar item nào.
// Vì ChatGPT sidebar có thể active item cũ, rename theo title sẽ đổi nhầm chat cũ.
replaceRegexInMain(
  /(const useFreshNewChat\s*=\s*!String\(chatContextTitle \|\| ''\)\.trim\(\)\s*&&\s*String\(pendingChatRenameTitle \|\| ''\)\.trim\(\);\s*)/,
  `$1
  if (useFreshNewChat) {
    await appendAppLog(null, {
      source: 'main',
      kind: 'running',
      text: \`ChatGPT new-chat mode: auto rename disabled for safety. targetRename="\${effectivePendingChatRenameTitle}"\`,
    });
    effectivePendingChatRenameTitle = '';
    pendingChatRenameTitle = '';
  }
`,
  'disable auto rename when New chat mode'
);

// 2) Nếu vẫn còn earlyRenameTitle được set từ effectivePendingChatRenameTitle, ép nó rỗng trong new mode.
replaceRegexInMain(
  /(const earlyRenameTitle\s*=\s*effectivePendingChatRenameTitle\s*;)/,
  `const earlyRenameTitle = useFreshNewChat ? '' : effectivePendingChatRenameTitle;`,
  'disable earlyRenameTitle in new chat mode'
);

// 3) Nếu có bất kỳ block rename nào còn dùng pendingChatRenameTitle trực tiếp,
// đổi điều kiện thành chỉ chạy khi không phải useFreshNewChat.
replaceRegexInMain(
  /if\s*\(pendingChatRenameTitle\?\.trim\(\)\)\s*\{/g,
  `if (!useFreshNewChat && pendingChatRenameTitle?.trim()) {`,
  'guard pendingChatRenameTitle rename blocks'
);

// 4) Update text UI để không hứa rename khi New.
replaceRegexInRenderer(
  /Option 1:[^`'\n]*Tool sẽ mở chat mới, gửi prompt, rồi rename thành "\$\{targetTitle\}" sau khi ChatGPT tạo \/c\/\.\.\./g,
  `Option 1: bỏ tìm chat cũ. Tool sẽ mở chat mới và gửi prompt. Tạm tắt auto rename để tránh đổi nhầm chat cũ.`,
  'update option new status text'
);

replaceRegexInRenderer(
  /Tool sẽ mở chat mới, gửi prompt, rồi rename thành/g,
  `Tool sẽ mở chat mới và gửi prompt. Auto rename đang tắt để tránh đổi nhầm chat cũ.`,
  'update any remaining new rename wording'
);

fs.writeFileSync(mainPath, main, 'utf8');
fs.writeFileSync(rendererPath, renderer, 'utf8');

console.log('DONE: disabled auto rename for New chat mode');
console.log('Backups:');
console.log(mainBackup);
console.log(rendererBackup);
