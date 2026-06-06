const fs = require('fs');

const p = 'electron/renderer.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_skip_video_provider_ready_motion_only`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

if (!s.includes('function isImageMotionOnlyModeEnabled')) {
  console.log('FAIL: Chưa có isImageMotionOnlyModeEnabled. Chạy lại patch image+motion-only trước.');
  process.exit(1);
}

if (s.includes('skip-video-provider-ready-image-motion-only')) {
  console.log('SKIP: already patched');
  process.exit(0);
}

// Chặn đúng block còn sót:
// const videoPlatform = getSelectedVideoPlatform();
// setStatus(`Bước 3/5: mở và kiểm tra ${videoPlatform.label}...`, 'running');
// const videoState = await waitForProviderReady(videoPlatform.value, videoPlatform.label);
replaceRegex(
  /(\s*)const videoPlatform = getSelectedVideoPlatform\(\);\s*\n\s*setStatus\(`Bước 3\/5: mở và kiểm tra \$\{videoPlatform\.label\}\.\.\.`, 'running'\);\s*\n\s*const videoState = await waitForProviderReady\(videoPlatform\.value, videoPlatform\.label\);/,
  `$1const videoPlatform = getSelectedVideoPlatform();
$1let videoState = null;

$1// skip-video-provider-ready-image-motion-only
$1if (isImageMotionOnlyModeEnabled()) {
$1  safeAddPipelineLog?.(
$1    'renderer',
$1    'running',
$1    \`Image + motion only: bỏ qua bước mở/kiểm tra \${videoPlatform.label}, không cần provider video.\`
$1  );
$1  setStatus('Bỏ qua provider video vì đang bật chế độ chỉ tạo ảnh + motion prompt.', 'ok');
$1} else {
$1  setStatus(\`Bước 3/5: mở và kiểm tra \${videoPlatform.label}...\`, 'running');
$1  videoState = await waitForProviderReady(videoPlatform.value, videoPlatform.label);
$1}`,
  'skip waitForProviderReady when image+motion-only'
);

// Nếu bên dưới có dùng videoState.capability khi pixverse, bọc lại cho khỏi null.
replaceRegex(
  /if \(videoPlatform\.value === 'pixverse'\) \{\s*\n\s*pixverseCapability = videoState\.capability \|\| null;/,
  `if (!isImageMotionOnlyModeEnabled() && videoPlatform.value === 'pixverse') {
      pixverseCapability = videoState?.capability || null;`,
  'guard pixverse capability when videoState skipped'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: skipped selected video provider preflight in image+motion-only mode');
console.log('Backup:', backup);
