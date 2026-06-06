const fs = require('fs');

const p = 'electron/renderer.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_no_grok_recovery_motion_only`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// Nếu có hàm xử lý provider logout, chặn ngay đầu khi mode ảnh+motion bật.
if (!s.includes('skip-provider-logout-recovery-image-motion-only')) {
  replaceRegex(
    /(async function handleProviderLoggedOut\s*\([\s\S]*?\)\s*\{)/,
    `$1
  // skip-provider-logout-recovery-image-motion-only
  if (typeof isImageMotionOnlyModeEnabled === 'function' && isImageMotionOnlyModeEnabled()) {
    safeAddPipelineLog?.(
      'renderer',
      'ok',
      'Image + motion only: bỏ qua provider logout recovery vì không tạo video.'
    );
    return true;
  }
`,
    'skip handleProviderLoggedOut in image+motion-only mode'
  );

  replaceRegex(
    /(async function handleVideoProviderLoggedOut\s*\([\s\S]*?\)\s*\{)/,
    `$1
  // skip-provider-logout-recovery-image-motion-only
  if (typeof isImageMotionOnlyModeEnabled === 'function' && isImageMotionOnlyModeEnabled()) {
    safeAddPipelineLog?.(
      'renderer',
      'ok',
      'Image + motion only: bỏ qua Grok/Veo logout recovery vì không tạo video.'
    );
    return true;
  }
`,
    'skip handleVideoProviderLoggedOut in image+motion-only mode'
  );
} else {
  console.log('SKIP: provider logout recovery guard already exists');
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: renderer will not recover Grok logout in image+motion-only mode');
console.log('Backup:', backup);
