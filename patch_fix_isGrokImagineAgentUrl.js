const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_isGrokImagineAgentUrl`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// Sửa hàm đang gây loop.
// Trước đó nó bị patch thành return false, làm !isGrokImagineAgentUrl(...) luôn true,
// nên tool cứ navigate lại /imagine dù đã ở /imagine.
replaceRegex(
  /function isGrokImagineAgentUrl\s*\(value = ''\)\s*\{[\s\S]*?\n\}/,
  `function isGrokImagineAgentUrl(value = '') {
  const text = String(value || '');
  try {
    const url = new URL(text, 'https://grok.com');
    return url.hostname === 'grok.com' && (
      url.pathname === '/imagine' ||
      url.pathname.startsWith('/imagine/')
    );
  } catch (_error) {
    return text.includes('grok.com/imagine') || text.startsWith('/imagine');
  }
}`,
  'fix isGrokImagineAgentUrl to accept normal /imagine'
);

// Thêm guard trực tiếp ở block lastState nếu còn nguyên.
replaceRegex(
  /if\s*\(!isGrokImagineAgentUrl\(lastState\?\.url \|\| lastState\?\.safeUrl \|\| ''\)\)\s*\{/,
  `if (
    lastState?.route !== 'imagine_agent_ready' &&
    lastState?.route !== 'imagine_normal_ready' &&
    !isGrokImagineAgentUrl(lastState?.url || lastState?.safeUrl || '')
  ) {`,
  'guard lastState route before navigate'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: fixed Grok /imagine ready loop root cause');
console.log('Backup:', backup);
