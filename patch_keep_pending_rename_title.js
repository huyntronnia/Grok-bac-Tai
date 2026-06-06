const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_keep_pending_rename_title`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

// Khi effectivePendingChatRenameTitle có giá trị, lưu global để các nhánh sau không bị rỗng.
if (!s.includes('globalThis.__vidoraPendingChatRenameTitleSafe')) {
  s = s.replace(
    /text:\s*`ChatGPT new-chat mode: safe rename enabled\. targetRename="\$\{effectivePendingChatRenameTitle\}"`,\s*\}\);/,
    `text: \`ChatGPT new-chat mode: safe rename enabled. targetRename="\${effectivePendingChatRenameTitle}"\`,
    });
    globalThis.__vidoraPendingChatRenameTitleSafe = String(effectivePendingChatRenameTitle || globalThis.__vidoraPendingChatRenameTitleSafe || '').trim();`
  );
}

// Nếu chỗ sau log targetRename="" dùng pending title rỗng, fallback về global title.
s = s.replaceAll(
  'targetRename="${pendingChatRenameTitle || \'\'}"',
  'targetRename="${pendingChatRenameTitle || globalThis.__vidoraPendingChatRenameTitleSafe || \'\'}"'
);

s = s.replaceAll(
  'targetRename="${effectivePendingChatRenameTitle || \'\'}"',
  'targetRename="${effectivePendingChatRenameTitle || globalThis.__vidoraPendingChatRenameTitleSafe || \'\'}"'
);

s = s.replaceAll(
  'pendingChatRenameTitle || \'\'',
  'pendingChatRenameTitle || globalThis.__vidoraPendingChatRenameTitleSafe || \'\''
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: keep pending rename title safe');
console.log('Backup:', backup);
