const fs = require('fs');

const p = 'electron/renderer.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_hard_skip_grok_when_motion_only`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function fail(msg) {
  console.log('FAIL:', msg);
  fs.writeFileSync(p, s, 'utf8');
  process.exit(1);
}

if (!s.includes('function isImageMotionOnlyModeEnabled')) {
  fail('Chưa có isImageMotionOnlyModeEnabled. Chạy lại patch image+motion-only trước.');
}

if (!s.includes('hard-skip-grok-preflight-image-motion-only')) {
  const step3Text = 'Bước 3/5: mở và kiểm tra Grok';
  const step4Text = 'Bước 4/5: tạo batch prompt kế tiếp';

  const step3Idx = s.indexOf(step3Text);
  const step4Idx = s.indexOf(step4Text, step3Idx);

  if (step3Idx < 0 || step4Idx < 0) {
    console.log('Không tìm thấy block Bước 3/5 -> Bước 4/5.');
    console.log('Chạy lệnh Select-String ở cuối rồi gửi output.');
    process.exit(1);
  }

  const blockStart = s.lastIndexOf('\n', step3Idx);
  const blockEnd = s.lastIndexOf('\n', step4Idx);

  if (blockStart < 0 || blockEnd < 0 || blockEnd <= blockStart) {
    fail('Không xác định được range block Grok preflight.');
  }

  const oldBlock = s.slice(blockStart + 1, blockEnd + 1);

  const wrappedBlock = `
  // hard-skip-grok-preflight-image-motion-only
  if (isImageMotionOnlyModeEnabled()) {
    if (typeof safeAddPipelineLog === 'function') {
      safeAddPipelineLog(
        'renderer',
        'running',
        'Image + motion only: bỏ qua Grok login/preflight, không mở Grok vì không tạo video.'
      );
    } else if (Array.isArray(pipelineLogs)) {
      pipelineLogs.unshift({
        time: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
        source: 'renderer',
        kind: 'running',
        text: 'Image + motion only: bỏ qua Grok login/preflight, không mở Grok vì không tạo video.',
      });
      renderPipelineLog?.();
    }

    setStatus('Bỏ qua Grok vì đang bật chế độ chỉ tạo ảnh + motion prompt.', 'ok');
  } else {
${oldBlock.split('\n').map(line => line ? '    ' + line : line).join('\n')}
  }
`;

  s = s.slice(0, blockStart + 1) + wrappedBlock + s.slice(blockEnd + 1);
  console.log('OK: wrapped Grok preflight block with image+motion-only skip');
} else {
  console.log('SKIP: hard skip already installed');
}

// Chặn thêm ở các call mở/check Grok nếu vẫn còn đường khác chạy.
if (!s.includes('hard-skip-open-grok-provider-motion-only')) {
  s = s.replace(
    /await\s+ensureProviderLogin\(\s*['"]grok['"][\s\S]*?\);/g,
    `if (!isImageMotionOnlyModeEnabled()) {
    // hard-skip-open-grok-provider-motion-only
    await ensureProviderLogin('grok');
  } else {
    safeAddPipelineLog?.('renderer', 'running', 'Image + motion only: skip ensureProviderLogin(grok).');
  }`
  );

  s = s.replace(
    /await\s+checkProviderLogin\(\s*['"]grok['"][\s\S]*?\);/g,
    `if (!isImageMotionOnlyModeEnabled()) {
    // hard-skip-check-grok-provider-motion-only
    await checkProviderLogin('grok');
  } else {
    safeAddPipelineLog?.('renderer', 'running', 'Image + motion only: skip checkProviderLogin(grok).');
  }`
  );
}

// Đổi status tổng cho đúng, không nhắc Grok khi mode bật.
s = s.replace(
  /setStatus\(\s*['"`]Đang chạy full pipeline: ChatGPT tạo ảnh → Grok tạo video → lưu theo scene\.\.\.['"`]\s*,\s*['"`]running['"`]\s*\);/g,
  `setStatus(
    isImageMotionOnlyModeEnabled()
      ? 'Đang chạy pipeline: ChatGPT tạo ảnh + motion prompt, bỏ qua Grok/video...'
      : 'Đang chạy full pipeline: ChatGPT tạo ảnh → Grok tạo video → lưu theo scene...',
    'running'
  );`
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: hard skip Grok when image+motion-only mode is enabled');
console.log('Backup:', backup);
