const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_projectName_undefined_fresh_chat`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceAll(from, to, label) {
  const count = s.split(from).length - 1;
  if (!count) {
    console.log(`SKIP: ${label}`);
    return;
  }
  s = s.split(from).join(to);
  console.log(`OK: ${label} (${count})`);
}

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// Fix lỗi ReferenceError: projectName is not defined
replaceAll(
  `const projectFreshChatKey = String(projectName || pendingChatRenameTitle || 'default-project').trim();`,
  `const projectFreshChatKey = String(
    options?.projectName ||
    options?.projectTitle ||
    options?.project?.name ||
    pendingChatRenameTitle ||
    'default-project'
  ).trim();`,
  'replace unsafe projectName in fresh chat key'
);

// Nếu còn projectName trần trong block fresh chat, đổi nốt.
replaceRegex(
  /const projectFreshChatKey = String\(\s*projectName\s*\|\|([\s\S]*?)\)\.trim\(\);/g,
  `const projectFreshChatKey = String(
    options?.projectName ||
    options?.projectTitle ||
    options?.project?.name ||$1
  ).trim();`,
  'fallback replace unsafe projectName fresh chat key'
);

// Thêm log rõ nếu đang reuse chat hiện tại cho scene sau.
if (!s.includes('fresh-chat-key-safe-options')) {
  s = s.replace(
    `const previousFreshChatKey = globalThis.__vidoraFreshChatCreatedForProject || '';`,
    `// fresh-chat-key-safe-options
  const previousFreshChatKey = globalThis.__vidoraFreshChatCreatedForProject || '';`
  );
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: fixed projectName undefined in ChatGPT fresh-chat logic');
console.log('Backup:', backup);
