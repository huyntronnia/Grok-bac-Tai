const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_no_sidebar_touch_new_chat`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// 1) Thêm helper: khi New chat, thu sidebar lại để tránh click nhầm history item.
if (!s.includes('async function hideChatGptSidebarForNewChat')) {
  const helper = `
async function hideChatGptSidebarForNewChat(page, sceneId = '') {
  const result = await evaluateOnCdpPage(page, \`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
      const sidebarToggle = buttons.find((el) => {
        const text = String(el.innerText || el.textContent || '').trim().toLowerCase();
        const aria = String(el.getAttribute('aria-label') || '').trim().toLowerCase();
        return aria.includes('đóng thanh bên')
          || aria.includes('close sidebar')
          || aria.includes('ẩn thanh bên')
          || aria.includes('hide sidebar');
      });

      if (sidebarToggle) {
        sidebarToggle.click();
        return { ok: true, mode: 'clicked-toggle', text: sidebarToggle.innerText || '', aria: sidebarToggle.getAttribute('aria-label') || '' };
      }

      document.documentElement.classList.add('vidora-new-chat-mode');
      const style = document.getElementById('vidora-hide-sidebar-style') || document.createElement('style');
      style.id = 'vidora-hide-sidebar-style';
      style.textContent = \`
        nav[aria-label*="Lịch sử"],
        nav[aria-label*="History"],
        aside,
        [data-testid*="sidebar"],
        [class*="sidebar"] {
          pointer-events: none !important;
        }
      \`;
      document.head.appendChild(style);
      return { ok: true, mode: 'css-pointer-events-none' };
    })()
  \`).catch((error) => ({ ok: false, error: error.message }));

  await appendAppLog(null, {
    source: 'main',
    kind: result?.ok ? 'ok' : 'error',
    text: \`ChatGPT new-chat mode: sidebar history touch disabled \${result?.ok ? result.mode : result?.error || 'failed'}\`,
    details: { sceneId, result },
  }).catch(() => null);

  return result;
}

`;
  replaceRegex(
    /async function openFreshChatGptRootPage/,
    `${helper}async function openFreshChatGptRootPage`,
    'insert hideChatGptSidebarForNewChat helper'
  );
} else {
  console.log('SKIP: hideChatGptSidebarForNewChat already exists');
}

// 2) Sau khi đã navigate về root/new chat, gọi helper khóa sidebar.
if (!s.includes('await hideChatGptSidebarForNewChat(page, String(reason));')) {
  replaceRegex(
    /(await sleep\(2500\);\s*)/,
    `$1
  await hideChatGptSidebarForNewChat(page, String(reason));
  await sleep(500);
`,
    'disable sidebar touch after ChatGPT root navigation'
  );
} else {
  console.log('SKIP: sidebar disable already called');
}

// 3) Trong new-chat mode, bỏ qua UI recovery trước focus/send/extract vì recovery đang đụng sidebar history.
// Patch này thay các call recoverChatGptUi(page, ...) bằng điều kiện: new mode thì skip.
replaceRegex(
  /await recoverChatGptUi\(page,\s*\{ stage: 'before-focus' \}\);/g,
  `if (!useFreshNewChat) {
    await recoverChatGptUi(page, { stage: 'before-focus' });
  }`,
  'skip before-focus UI recovery in new-chat mode'
);

replaceRegex(
  /await recoverChatGptUi\(page,\s*\{ stage: 'before-send-click', attempt \}\);/g,
  `if (!useFreshNewChat) {
      await recoverChatGptUi(page, { stage: 'before-send-click', attempt });
    }`,
  'skip before-send-click UI recovery in new-chat mode'
);

replaceRegex(
  /await recoverChatGptUi\(page,\s*\{ sceneId,\s*stage: 'image-wait-before-extract' \}\);/g,
  `if (!useFreshNewChat) {
      await recoverChatGptUi(page, { sceneId, stage: 'image-wait-before-extract' });
    }`,
  'skip image-wait UI recovery in new-chat mode'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: patched no sidebar touch for New chat mode');
console.log('Backup:', backup);
