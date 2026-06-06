const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_hard_stop_sidebar_recovery_new_chat`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

const marker = 'new-chat-mode-no-sidebar-touch:recoverChatGptBlockingUi';

if (s.includes(marker)) {
  console.log('SKIP: hard stop already installed');
} else {
  const from = `async function recoverChatGptBlockingUi(client, context = {}) {`;
  const to = `async function recoverChatGptBlockingUi(client, context = {}) {
  // ${marker}
  if (globalThis.__vidoraChatGptNewChatMode) {
    await appendAppLog(null, {
      source: 'main',
      kind: 'running',
      text: 'chatgptUiRecovery: hard-skipped in New chat mode to avoid touching sidebar history',
      details: { context, reason: 'new-chat-mode-no-sidebar-touch' },
    }).catch(() => null);
    return { ok: true, skipped: true, reason: 'new-chat-mode-no-sidebar-touch', context };
  }`;

  if (!s.includes(from)) {
    console.log('FAIL: Không tìm thấy function recoverChatGptBlockingUi đúng dạng.');
    console.log('Chạy Select-String ở cuối và gửi lại output.');
  } else {
    s = s.replace(from, to);
    fs.writeFileSync(p, s, 'utf8');
    console.log('OK: installed hard stop inside recoverChatGptBlockingUi');
    console.log('Backup:', backup);
  }
}

