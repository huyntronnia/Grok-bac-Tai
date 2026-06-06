const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_gate_hook_and_mojibake_send`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

// 1) Thay function detector đầu file bằng bản không phụ thuộc dấu tiếng Việt.
const fnName = 'function isLikelyChatGptSendButtonText';
const fnStart = s.indexOf(fnName);
if (fnStart < 0) {
  console.error('FAIL: không tìm thấy isLikelyChatGptSendButtonText');
  process.exit(1);
}

let braceStart = s.indexOf('{', fnStart);
let depth = 0;
let fnEnd = -1;
for (let i = braceStart; i < s.length; i++) {
  if (s[i] === '{') depth++;
  if (s[i] === '}') depth--;
  if (depth === 0) {
    fnEnd = i + 1;
    break;
  }
}

if (fnEnd < 0) {
  console.error('FAIL: không tìm thấy điểm kết thúc function detector');
  process.exit(1);
}

const cleanFn = `function isLikelyChatGptSendButtonText(text) {
  const raw = String(text || '').trim().toLowerCase();
  const t = raw
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/đ/g, 'd');

  if (!t) return false;

  // Cấm click nhầm các nút tool/mode.
  if (
    t.includes('viet hoac') ||
    t.includes('hinh sua') ||
    t.includes('chinh sua') ||
    t.includes('tao anh') ||
    t.includes('tra cuu') ||
    t.includes('voice') ||
    t.includes('micro')
  ) {
    return false;
  }

  return (
    t.includes('send') ||
    t.includes('gui') ||
    t.includes('submit') ||
    t.includes('arrow-up') ||
    t.includes('send-button') ||
    t.includes('composer-submit')
  );
}`;

s = s.slice(0, fnStart) + cleanFn + s.slice(fnEnd);

// 2) Gắn INPUT GATE sau log sentImage hiện tại.
// Source thực tế là: ChatGPT send image prompt ${sentImage?.ok ? 'ok' : ...}
// không phải string cố định "ChatGPT send image prompt ok".
if (!s.includes('HOOK_INPUT_GATE_AFTER_NV1_SENTIMAGE_REAL')) {
  const needle = "ChatGPT send image prompt ${sentImage?.ok";
  const idx = s.indexOf(needle);

  if (idx < 0) {
    console.error('FAIL: không tìm thấy log sentImage ChatGPT send image prompt ${sentImage?.ok');
    process.exit(1);
  }

  const appendStart = s.lastIndexOf('await appendAppLog', idx);
  const appendEndToken = '}).catch(() => null);';
  const appendEnd = s.indexOf(appendEndToken, idx);

  if (appendStart < 0 || appendEnd < 0) {
    console.error('FAIL: không tìm được appendAppLog sentImage block');
    process.exit(1);
  }

  const insertAt = appendEnd + appendEndToken.length;

  const hook = `

// HOOK_INPUT_GATE_AFTER_NV1_SENTIMAGE_REAL
  await vidoraChatGptInputGate(client, {
    sceneId,
    stage: 'after-nv1-sentImage-log',
  });
`;

  s = s.slice(0, insertAt) + hook + s.slice(insertAt);
  console.log('OK: inserted HOOK_INPUT_GATE_AFTER_NV1_SENTIMAGE_REAL');
} else {
  console.log('SKIP: HOOK_INPUT_GATE_AFTER_NV1_SENTIMAGE_REAL exists');
}

// 3) Nếu send result là nhầm nút mode thì dừng ngay sau sentImage log.
if (!s.includes('GUARD_WRONG_SEND_LABEL_AFTER_SENTIMAGE_REAL')) {
  const hookNeedle = 'HOOK_INPUT_GATE_AFTER_NV1_SENTIMAGE_REAL';
  const hookIdx = s.indexOf(hookNeedle);
  const hookEnd = s.indexOf('});', hookIdx);
  const insertAt = s.indexOf('\n', hookEnd) + 1;

  const guard = `
  // GUARD_WRONG_SEND_LABEL_AFTER_SENTIMAGE_REAL
  {
    const sendLabel = String(sentImage?.send || sentImage?.selector || '').toLowerCase()
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .replace(/đ/g, 'd');

    if (
      sendLabel.includes('viet hoac') ||
      sendLabel.includes('hinh sua') ||
      sendLabel.includes('chinh sua') ||
      sendLabel.includes('tao anh') ||
      sendLabel.includes('tra cuu')
    ) {
      await appendAppLog(null, {
        source: 'main',
        kind: 'error',
        text: \`Scene \${sceneId}: CLICK NHẦM nút tool/mode "\${sentImage?.send || sentImage?.selector}", không phải nút gửi. Dừng.\`,
        details: { sentImage },
      }).catch(() => null);

      throw new Error('clicked-wrong-chatgpt-tool-button-not-send');
    }
  }
`;

  s = s.slice(0, insertAt) + guard + s.slice(insertAt);
  console.log('OK: inserted wrong send label guard');
} else {
  console.log('SKIP: wrong send label guard exists');
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: fixed detector + attached NV1 input gate to sentImage log');
console.log('Backup:', backup);
