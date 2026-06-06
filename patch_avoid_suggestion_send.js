const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_avoid_suggestion_send`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// Chặn các chip gợi ý như "Viết hoặc chỉnh sửa", "Tạo ảnh", "Tra cứu thông tin"
// bị nhận nhầm là nút gửi.
const guard = `
function isChatGptSuggestionButtonText(text = '') {
  const t = String(text || '').trim().toLowerCase();
  return (
    t.includes('viết hoặc') ||
    t.includes('hỉnh sửa') ||
    t.includes('chỉnh sửa') ||
    t.includes('tạo ảnh') ||
    t.includes('tra cứu') ||
    t.includes('write or') ||
    t.includes('create image') ||
    t.includes('search')
  );
}
`;

if (!s.includes('function isChatGptSuggestionButtonText')) {
  replaceRegex(
    /const CHATGPT_UI_RECOVERY_SEND_RETRY_LIMIT/,
    `${guard}
const CHATGPT_UI_RECOVERY_SEND_RETRY_LIMIT`,
    'insert suggestion button text guard'
  );
} else {
  console.log('SKIP: suggestion guard already exists');
}

// Nếu click send script có filter text/aria, thêm điều kiện loại suggestion.
// Bắt các nơi return selector/text từ button click, thêm guard trước khi click.
replaceRegex(
  /(const text\s*=\s*String\(button\.innerText \|\| button\.textContent \|\| ''\)\.trim\(\);)/g,
  `$1
      if (typeof isChatGptSuggestionButtonText === 'function' && isChatGptSuggestionButtonText(text)) return false;`,
  'avoid suggestion buttons after text extraction'
);

replaceRegex(
  /(const label\s*=\s*String\(button\.getAttribute\('aria-label'\) \|\| button\.title \|\| ''\)\.trim\(\);)/g,
  `$1
      if (typeof isChatGptSuggestionButtonText === 'function' && isChatGptSuggestionButtonText(label)) return false;`,
  'avoid suggestion buttons after label extraction'
);

// Thêm fallback mạnh: nếu sau khi "send" mà mode trả về text suggestion, thử bấm nút submit/mũi tên thật.
if (!s.includes('forceClickChatGptComposerSubmit')) {
  const helper = `
async function forceClickChatGptComposerSubmit(client) {
  return evaluateOnCdpPage(client, \`
    (() => {
      const composer =
        document.querySelector('#prompt-textarea') ||
        document.querySelector('textarea') ||
        document.querySelector('[contenteditable="true"]');

      const root = composer?.closest('form') || composer?.closest('[role="main"]') || document;

      const buttons = Array.from(root.querySelectorAll('button'));
      const candidates = buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        const text = String(button.innerText || button.textContent || '').trim();
        const aria = String(button.getAttribute('aria-label') || button.title || '').trim();
        const html = String(button.outerHTML || '').slice(0, 500);
        return { button, rect, text, aria, html };
      }).filter(({ rect, text, aria, html }) => {
        if (!rect || rect.width < 12 || rect.height < 12) return false;
        const t = (text + ' ' + aria + ' ' + html).toLowerCase();
        if (t.includes('viết hoặc') || t.includes('chỉnh sửa') || t.includes('hỉnh sửa') || t.includes('tạo ảnh') || t.includes('tra cứu')) return false;
        if (t.includes('send') || t.includes('gửi') || t.includes('submit') || t.includes('arrow-up') || t.includes('data-testid="send-button"') || t.includes('composer-submit')) return true;
        return false;
      });

      const picked = candidates[candidates.length - 1];
      if (!picked) {
        return { ok: false, error: 'no-real-submit-button', buttonCount: buttons.length };
      }

      picked.button.click();
      return {
        ok: true,
        selector: 'force-submit-button',
        text: picked.text,
        aria: picked.aria,
        box: { x: picked.rect.x, y: picked.rect.y, w: picked.rect.width, h: picked.rect.height }
      };
    })()
  \`);
}
`;
  replaceRegex(
    /async function sendPromptViaCdpInput/,
    `${helper}
async function sendPromptViaCdpInput`,
    'insert forceClickChatGptComposerSubmit helper'
  );
} else {
  console.log('SKIP: force submit helper already exists');
}

// Sau click send, nếu click.selector/text là suggestion, gọi force submit.
replaceRegex(
  /(const click\s*=\s*await evaluateOnCdpPage\(client,\s*`\(\$\{clickSendButtonScript\.toString\(\)\}\)\(\)`\)[\s\S]*?;)/,
  `$1
    if (click && /viết hoặc|hỉnh sửa|chỉnh sửa|tạo ảnh|tra cứu/i.test(String(click.send || click.selector || click.text || click.aria || ''))) {
      const forcedClick = await forceClickChatGptComposerSubmit(client).catch((error) => ({ ok: false, error: error.message }));
      await appendAppLog(null, {
        source: 'main',
        kind: forcedClick?.ok ? 'ok' : 'error',
        text: \`ChatGPT send corrected: ignored suggestion button and forced real submit: \${forcedClick?.ok ? 'ok' : forcedClick?.error}\`,
        details: { originalClick: click, forcedClick }
      }).catch(() => null);
      if (forcedClick?.ok) {
        click.ok = true;
        click.selector = forcedClick.selector || 'force-submit-button';
        click.send = forcedClick.aria || forcedClick.text || 'force-submit-button';
      }
    }`,
  'force real submit if suggestion button clicked'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: patched avoid suggestion send button');
console.log('Backup:', backup);
