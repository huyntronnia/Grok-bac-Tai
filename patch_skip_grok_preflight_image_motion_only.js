const fs = require('fs');

const p = 'electron/renderer.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_skip_grok_preflight_image_motion_only`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

if (!s.includes('function isImageMotionOnlyModeEnabled')) {
  console.log('FAIL: Chưa thấy helper isImageMotionOnlyModeEnabled. Hãy chạy patch mode ảnh+motion trước.');
  process.exit(1);
}

if (s.includes('Image + motion only: skip Grok preflight/login')) {
  console.log('SKIP: already patched');
  process.exit(0);
}

function findLineStart(src, idx) {
  const n = src.lastIndexOf('\n', idx);
  return n < 0 ? 0 : n + 1;
}

const step3Idx = s.indexOf('Bước 3/5: mở và kiểm tra Grok');
if (step3Idx < 0) {
  console.log('FAIL: Không tìm thấy text bước Grok preflight.');
  console.log('Chạy Select-String cuối rồi gửi output.');
  process.exit(1);
}

const step4Idx = s.indexOf('Bước 4/5:', step3Idx);
if (step4Idx < 0) {
  console.log('FAIL: Không tìm thấy Bước 4/5 sau bước Grok.');
  process.exit(1);
}

const blockStart = findLineStart(s, step3Idx);
const blockEnd = findLineStart(s, step4Idx);

const oldBlock = s.slice(blockStart, blockEnd);

const newBlock = `
  if (isImageMotionOnlyModeEnabled()) {
    safeAddPipelineLog?.(
      'renderer',
      'running',
      'Image + motion only: skip Grok preflight/login, không mở Grok vì không tạo video.'
    );
    setStatus('Bỏ qua bước Grok vì đang bật chế độ chỉ tạo ảnh + motion prompt.', 'ok');
  } else {
${oldBlock.split('\n').map(line => line ? '    ' + line : line).join('\n')}
  }

`;

s = s.slice(0, blockStart) + newBlock + s.slice(blockEnd);

fs.writeFileSync(p, s, 'utf8');

console.log('OK: Grok preflight will be skipped in image+motion-only mode');
console.log('Backup:', backup);
