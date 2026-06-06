const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_disable_adopt_active_generation_on_root`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

if (s.includes('VIDORA_DISABLE_ADOPT_ACTIVE_GENERATION_ON_ROOT')) {
  console.log('SKIP: patch exists');
  process.exit(0);
}

// Tìm đoạn log adopt active generation.
const needle = "ChatGPT dang generate; adopt active generation instead of opening root/new chat.";
const idx = s.indexOf(needle);

if (idx < 0) {
  console.error('FAIL: không tìm thấy adopt active generation log string');
  process.exit(1);
}

// Tìm if gần nhất trước log này.
const ifIdx = s.lastIndexOf('if (', idx);
if (ifIdx < 0) {
  console.error('FAIL: không tìm thấy if trước adopt log');
  process.exit(1);
}

// Chèn guard ngay trước if adopt.
const guard = `
// VIDORA_DISABLE_ADOPT_ACTIVE_GENERATION_ON_ROOT
  {
    const adoptPathCheck = await evaluateOnCdpPage(page, \`(() => ({
      href: location.href,
      path: location.pathname,
      title: document.title,
      hasConversationUrl: location.pathname.includes('/c/'),
      hasStopButton: !![...document.querySelectorAll('button,[role="button"]')]
        .find(b => /dừng|stop/i.test(String(b.innerText || b.textContent || b.getAttribute('aria-label') || ''))),
      hasGeneratedImageCard: !![...document.querySelectorAll('img, canvas, [style*="background-image"]')]
        .find(el => {
          const r = el.getBoundingClientRect();
          return r.width > 220 && r.height > 140 && r.top > 80 && r.bottom < innerHeight + 300;
        }),
      composerText: String(
        document.querySelector('#prompt-textarea, textarea, [contenteditable="true"]')?.innerText ||
        document.querySelector('#prompt-textarea, textarea, [contenteditable="true"]')?.value ||
        ''
      ).trim().slice(0, 200),
    }))()\`).catch((error) => ({ ok: false, error: error.message }));

    const rootNoRealGeneration =
      adoptPathCheck &&
      adoptPathCheck.path === '/' &&
      !adoptPathCheck.hasConversationUrl &&
      !adoptPathCheck.hasStopButton &&
      !adoptPathCheck.hasGeneratedImageCard;

    if (rootNoRealGeneration) {
      await appendAppLog(null, {
        source: 'main',
        kind: 'running',
        text: 'ChatGPT adopt active generation bị chặn: đang ở root/home, không phải đoạn chat đang tạo ảnh.',
        details: { adoptPathCheck },
      }).catch(() => null);

      if (activeGeneration) activeGeneration.generating = false;
      if (imageState) imageState.generating = false;
    }
  }

`;

s = s.slice(0, ifIdx) + guard + s.slice(ifIdx);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: disabled adopt active generation on ChatGPT root/home');
console.log('Backup:', backup);
