const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_skip_adopt_for_new_chat`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// Lỗi hiện tại:
// Sau khi chọn New, page ở https://chatgpt.com/ nhưng detectChatGptActiveGenerationScriptStrict
// vẫn báo generating=true vì bắt nhầm chữ "Thinking" / trạng thái UI.
// Vì vậy code nhảy vào nhánh adopt-active-generation và không gửi prompt mới.
// Fix: chỉ cho adopt active generation khi KHÔNG phải New-chat mode.
replaceRegex(
  /if\s*\(initialActiveGeneration\?\.generating\s*\|\|\s*isChatGptActivelyGenerating\(initialImageState\)\)\s*\{/,
  `if (!useFreshNewChat && (initialActiveGeneration?.generating || isChatGptActivelyGenerating(initialImageState))) {`,
  'disable adopt active generation for new-chat mode'
);

// Thêm log ngay sau initialImageState để dễ debug lần sau.
if (!s.includes('ChatGPT new-chat mode: skip adopt-active-generation check')) {
  replaceRegex(
    /(const initialImageState\s*=\s*await evaluateOnCdpPage\(page,\s*`\(\$\{readChatGptImageStateScript\.toString\(\)\}\)\(\)`\)\.catch\(\(error\) => \(\{ ok: false, generating: false, error: error\.message \}\)\);)/,
    `$1
  if (useFreshNewChat) {
    await appendAppLog(null, {
      source: 'main',
      kind: 'running',
      text: 'ChatGPT new-chat mode: skip adopt-active-generation check; will send prompt into root/new chat.',
      details: {
        activeGeneration: initialActiveGeneration,
        imageState: sanitizeChatGptImageSnapshot(initialImageState),
      },
    });
  }`,
    'add new-chat skip-adopt log'
  );
} else {
  console.log('SKIP: skip-adopt log already exists');
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: patched electron/main.js');
console.log('Backup:', backup);
