const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_force_hook_input_gate_nv1`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function insertAfterAppendLogContaining(needle, insertCode, tag) {
  if (s.includes(tag)) {
    console.log(`SKIP: ${tag}`);
    return;
  }

  const idx = s.indexOf(needle);
  if (idx < 0) {
    console.log(`FAIL: needle not found: ${needle}`);
    process.exitCode = 1;
    return;
  }

  const endNeedle = '}).catch(() => null);';
  const end = s.indexOf(endNeedle, idx);
  if (end < 0) {
    console.log(`FAIL: append log end not found for: ${needle}`);
    process.exitCode = 1;
    return;
  }

  const insertAt = end + endNeedle.length;
  s = s.slice(0, insertAt) + '\n\n' + insertCode + '\n' + s.slice(insertAt);
  console.log(`OK: ${tag}`);
}

function insertBeforeAppendLogContaining(needle, insertCode, tag) {
  if (s.includes(tag)) {
    console.log(`SKIP: ${tag}`);
    return;
  }

  const idx = s.indexOf(needle);
  if (idx < 0) {
    console.log(`FAIL: needle not found: ${needle}`);
    process.exitCode = 1;
    return;
  }

  const start = s.lastIndexOf('await appendAppLog', idx);
  if (start < 0) {
    console.log(`FAIL: append log start not found for: ${needle}`);
    process.exitCode = 1;
    return;
  }

  s = s.slice(0, start) + insertCode + '\n\n' + s.slice(start);
  console.log(`OK: ${tag}`);
}

// 1) Sau khi tool tưởng đã gửi NV1: check input ngay.
// Nếu còn chữ trong composer => chưa gửi, retry nút gửi thật, hoặc dừng.
insertAfterAppendLogContaining(
  'ChatGPT send image prompt ok',
  `// HOOK_INPUT_GATE_AFTER_NV1_SEND_REAL
  await vidoraChatGptInputGate(client, {
    sceneId,
    stage: 'after-nv1-send-image-prompt-ok',
  });`,
  'HOOK_INPUT_GATE_AFTER_NV1_SEND_REAL'
);

// 2) Trước khi bắt đầu chờ/extract ảnh: check input lần nữa.
// Nếu input còn prompt => tuyệt đối không được chờ ảnh.
insertAfterAppendLogContaining(
  'chatgptImageExtract: waiting for latest assistant image',
  `// HOOK_INPUT_GATE_BEFORE_IMAGE_EXTRACT_REAL
  await vidoraChatGptInputGate(client, {
    sceneId,
    stage: 'before-image-extract-wait',
  });`,
  'HOOK_INPUT_GATE_BEFORE_IMAGE_EXTRACT_REAL'
);

// 3) Trước log “stop button gone; waiting 4s…”: check input.
// Đây là chỗ hiện đang chạy sai dù prompt vẫn còn trong khung input.
insertBeforeAppendLogContaining(
  'ChatGPT stop button gone; waiting 4s for final image to settle before extract',
  `// HOOK_INPUT_GATE_BEFORE_FINAL_SETTLE_REAL
      await vidoraChatGptInputGate(client, {
        sceneId: options?.sceneId || '',
        stage: 'before-final-image-settle',
      });`,
  'HOOK_INPUT_GATE_BEFORE_FINAL_SETTLE_REAL'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: forced NV1 input gate hooks installed');
console.log('Backup:', backup);
