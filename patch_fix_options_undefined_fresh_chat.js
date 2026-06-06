const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_options_undefined_fresh_chat`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// Sửa mọi block projectFreshChatKey đang dùng options?. khi options không tồn tại trong scope.
replaceRegex(
  /const projectFreshChatKey = String\(\s*options\?\.projectName\s*\|\|\s*options\?\.projectTitle\s*\|\|\s*options\?\.project\?\.name\s*\|\|\s*pendingChatRenameTitle\s*\|\|\s*'default-project'\s*\)\.trim\(\);/g,
  `const projectFreshChatKey = String(
    (
      typeof options !== 'undefined' &&
      options &&
      (
        options.projectName ||
        options.projectTitle ||
        options.project?.name
      )
    ) ||
    (
      typeof projectName !== 'undefined'
        ? projectName
        : ''
    ) ||
    pendingChatRenameTitle ||
    'default-project'
  ).trim();`,
  'fix options undefined in projectFreshChatKey'
);

// Fallback cho dạng nhiều dòng đã bị patch trước đó.
replaceRegex(
  /const projectFreshChatKey = String\(\s*options\?\.projectName\s*\|\|\s*options\?\.projectTitle\s*\|\|\s*options\?\.project\?\.name\s*\|\|([\s\S]*?)\)\.trim\(\);/g,
  `const projectFreshChatKey = String(
    (
      typeof options !== 'undefined' &&
      options &&
      (
        options.projectName ||
        options.projectTitle ||
        options.project?.name
      )
    ) ||
    (
      typeof projectName !== 'undefined'
        ? projectName
        : ''
    ) ||$1
  ).trim();`,
  'fallback fix multiline options undefined'
);

// Chống hỏi lại chọn chat mỗi batch nếu đã từng chọn New trong project/session.
// Nếu pendingChatRenameTitle vẫn còn, main sẽ reuse chat hiện tại sau scene đầu.
if (!s.includes('fresh-chat-safe-key-no-options-undefined')) {
  s = s.replace(
    `const previousFreshChatKey = globalThis.__vidoraFreshChatCreatedForProject || '';`,
    `// fresh-chat-safe-key-no-options-undefined
  const previousFreshChatKey = globalThis.__vidoraFreshChatCreatedForProject || '';`
  );
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: fixed options undefined in ChatGPT fresh-chat reuse logic');
console.log('Backup:', backup);
