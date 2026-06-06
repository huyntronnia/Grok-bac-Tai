const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_relax_input_gate_final_settle`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

const oldBlock = `  // Input trống nhưng chưa có assistant message => chưa chắc đã gửi, dừng.
  if (!state.composerHasText && state.assistantRootCount === 0) {
    await appendAppLog(null, {
      source: 'main',
      kind: 'error',
      text: 'ChatGPT INPUT GATE FAIL: input trống nhưng chưa có assistant message mới; không được chờ ảnh/NV2.',
      details: { context, state },
    }).catch(() => null);

    throw new Error('chatgpt-input-empty-but-no-assistant-message');
  }`;

const newBlock = `  // Input trống nhưng chưa có assistant message:
  // - Sau khi đã vào /c/... và đang ở bước final settle/extract thì đây là case hợp lệ:
  //   ChatGPT tạo ảnh dạng image-card không có assistant text rõ ràng.
  // - Chỉ chặn sớm ở root "/" hoặc trước khi có hội thoại thật.
  if (!state.composerHasText && state.assistantRootCount === 0) {
    const path = String(state.path || '');
    const stage = String(context?.stage || '');

    if (
      path.includes('/c/') &&
      !state.stopVisible &&
      (
        stage.includes('before-final-image-settle') ||
        stage.includes('before-image-extract-wait') ||
        stage.includes('after-nv1-sentImage-log')
      )
    ) {
      await appendAppLog(null, {
        source: 'main',
        kind: 'ok',
        text: 'ChatGPT INPUT GATE: input trống + URL /c/...; cho phép tiếp tục extract ảnh dù assistantRootCount=0.',
        details: { context, state },
      }).catch(() => null);

      return { ok: true, mode: 'empty-input-conversation-url-allow-extract', state };
    }

    await appendAppLog(null, {
      source: 'main',
      kind: 'error',
      text: 'ChatGPT INPUT GATE FAIL: input trống nhưng chưa có assistant message mới; không được chờ ảnh/NV2.',
      details: { context, state },
    }).catch(() => null);

    throw new Error('chatgpt-input-empty-but-no-assistant-message');
  }`;

if (!s.includes(oldBlock)) {
  console.error('FAIL: không tìm thấy block input-empty-but-no-assistant-message cũ để thay.');
  process.exit(1);
}

s = s.replace(oldBlock, newBlock);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: relaxed input gate for final image extract when URL is /c/...');
console.log('Backup:', backup);
