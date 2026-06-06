const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_bypass_recovery_calls_new_chat`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceAll(from, to, label) {
  const count = s.split(from).length - 1;
  if (count <= 0) {
    console.log(`SKIP: ${label}`);
    return;
  }
  s = s.split(from).join(to);
  console.log(`OK: ${label} (${count})`);
}

// Bypass direct recovery calls when running New chat mode.
// This is intentionally broad because recovery is what touches sidebar history like "Bàn xoay PCB".
replaceAll(
  `await recoverChatGptBlockingUi(client, { stage: 'before-focus' }).catch(() => null);`,
  `if (!globalThis.__vidoraChatGptNewChatMode) {
    await recoverChatGptBlockingUi(client, { stage: 'before-focus' }).catch(() => null);
  } else {
    await appendAppLog(null, {
      source: 'main',
      kind: 'running',
      text: 'chatgptUiRecovery: skipped before-focus in New chat mode',
      details: { stage: 'before-focus' }
    }).catch(() => null);
  }`,
  'bypass before-focus recovery'
);

replaceAll(
  `await recoverChatGptBlockingUi(client, { stage: 'before-send-click', attempt }).catch(() => null);`,
  `if (!globalThis.__vidoraChatGptNewChatMode) {
      await recoverChatGptBlockingUi(client, { stage: 'before-send-click', attempt }).catch(() => null);
    } else {
      await appendAppLog(null, {
        source: 'main',
        kind: 'running',
        text: 'chatgptUiRecovery: skipped before-send-click in New chat mode',
        details: { stage: 'before-send-click', attempt }
      }).catch(() => null);
    }`,
  'bypass before-send-click recovery'
);

replaceAll(
  `await recoverChatGptBlockingUi(page, { sceneId, stage: 'image-wait-before-extract' }).catch(() => null);`,
  `if (!globalThis.__vidoraChatGptNewChatMode) {
      await recoverChatGptBlockingUi(page, { sceneId, stage: 'image-wait-before-extract' }).catch(() => null);
    } else {
      await appendAppLog(null, {
        source: 'main',
        kind: 'running',
        text: 'chatgptUiRecovery: skipped image-wait-before-extract in New chat mode',
        details: { sceneId, stage: 'image-wait-before-extract' }
      }).catch(() => null);
    }`,
  'bypass image-wait-before-extract recovery'
);

// Also set the global flag near useFreshNewChat if not already there.
if (!s.includes('globalThis.__vidoraChatGptNewChatMode = Boolean(useFreshNewChat);')) {
  s = s.replace(
    /const useFreshNewChat\s*=\s*!String\(chatContextTitle \|\| ''\)\.trim\(\)\s*&&\s*String\(pendingChatRenameTitle \|\| ''\)\.trim\(\);/,
    `const useFreshNewChat = !String(chatContextTitle || '').trim() && String(pendingChatRenameTitle || '').trim();
  globalThis.__vidoraChatGptNewChatMode = Boolean(useFreshNewChat);`
  );
  console.log('OK: set New chat global flag');
} else {
  console.log('SKIP: New chat global flag already exists');
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: bypassed ChatGPT recovery calls in New chat mode');
console.log('Backup:', backup);
