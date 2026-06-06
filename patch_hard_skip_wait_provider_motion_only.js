const fs = require('fs');

const p = 'electron/renderer.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_hard_skip_wait_provider_motion_only`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

if (!s.includes('function isImageMotionOnlyModeEnabled')) {
  console.log('FAIL: Chưa có isImageMotionOnlyModeEnabled.');
  process.exit(1);
}

if (!s.includes('hard-skip-waitForProviderReady-video-provider-motion-only')) {
  replaceRegex(
    /async function waitForProviderReady\s*\(providerValue,\s*label\)\s*\{/,
    `async function waitForProviderReady(providerValue, label) {
  // hard-skip-waitForProviderReady-video-provider-motion-only
  if (
    typeof isImageMotionOnlyModeEnabled === 'function' &&
    isImageMotionOnlyModeEnabled() &&
    providerValue !== 'chatgpt'
  ) {
    safeAddPipelineLog?.(
      'renderer',
      'running',
      \`Image + motion only: skip waitForProviderReady(\${providerValue}), không mở/check \${label}.\`
    );

    setStatus(
      \`Bỏ qua \${label} vì đang bật chế độ chỉ tạo ảnh + motion prompt.\`,
      'ok'
    );

    return {
      provider: providerValue,
      loggedIn: true,
      skipped: true,
      imageMotionOnlyMode: true,
      reason: 'image-motion-only-skip-video-provider',
    };
  }`,
    'hard skip video provider inside waitForProviderReady'
  );
} else {
  console.log('SKIP: waitForProviderReady hard skip already exists');
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: hard skipped video provider wait/open in image+motion-only mode');
console.log('Backup:', backup);
