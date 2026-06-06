const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_skip_recovery_new_chat_safe`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// 1) Gắn flag global khi đang chạy New chat mode.
replaceRegex(
  /(const useFreshNewChat\s*=\s*!String\(chatContextTitle \|\| ''\)\.trim\(\)\s*&&\s*String\(pendingChatRenameTitle \|\| ''\)\.trim\(\);\s*)/,
  `$1
  globalThis.__vidoraChatGptNewChatMode = Boolean(useFreshNewChat);
`,
  'set global new-chat mode flag'
);

// 2) Tắt flag khi thoát generateImageAndMotionWithChatGPT, bằng finally.
// Nếu đã có return object cuối hàm, mình không đụng sâu; flag sẽ được set lại mỗi scene.
// Đây là an toàn hơn sửa cấu trúc try/finally toàn hàm.

// 3) Chặn recovery đụng sidebar khi New chat mode.
// Tìm phần trong recoverChatGptBlockingUi sau khi có context.
replaceRegex(
  /(async function recoverChatGptBlockingUi\s*\(client,\s*context\s*=\s*\)\s*\{)/,
  `$1
  if (globalThis.__vidoraChatGptNewChatMode) {
    await appendAppLog(null, {
      source: 'main',
      kind: 'running',
      text: 'chatgptUiRecovery: skipped in New chat mode to avoid touching sidebar history',
      details: { context }
    }).catch(() => null);
    return { ok: true, skipped: true, reason: 'new-chat-mode-no-sidebar-touch', context };
  }
`,
  'skip recoverChatGptBlockingUi in new-chat mode'
);

// 4) Nếu tên hàm là recoverChatGptUi thay vì recoverChatGptBlockingUi thì cũng chặn.
replaceRegex(
  /(async function recoverChatGptUi\s*\(client,\s*context\s*=\s*\)\s*\{)/,
  `$1
  if (globalThis.__vidoraChatGptNewChatMode) {
    await appendAppLog(null, {
      source: 'main',
      kind: 'running',
      text: 'chatgptUiRecovery: skipped in New chat mode to avoid touching sidebar history',
      details: { context }
    }).catch(() => null);
    return { ok: true, skipped: true, reason: 'new-chat-mode-no-sidebar-touch', context };
  }
`,
  'skip recoverChatGptUi in new-chat mode'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: safe skip sidebar recovery in New chat mode');
console.log('Backup:', backup);
