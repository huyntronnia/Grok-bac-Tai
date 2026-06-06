const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_motion_only_final_guard_tdz`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// Thêm helper tìm keyframe an toàn, không dùng biến imagePath trước khi init.
if (!s.includes('async function findSceneKeyframePathSafe')) {
  replaceRegex(
    /async function buildImageMotionOnlyPipelineResult/,
    `async function findSceneKeyframePathSafe(sceneDir, sceneId) {
  const candidates = [
    path.join(sceneDir, \`scene_\${String(sceneId).padStart(3, '0')}_keyframe.png\`),
    path.join(sceneDir, 'scene_keyframe.png'),
    path.join(sceneDir, 'keyframe.png'),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch (_error) {}
  }

  return '';
}

async function buildImageMotionOnlyPipelineResult`,
    'insert safe keyframe finder'
  );
} else {
  console.log('SKIP: safe keyframe finder already exists');
}

// Sửa final guard: chỉ return khi ĐÃ CÓ motionPrompt.
// Nếu scene mới chưa có motionPrompt thì phải để pipeline tạo ảnh + NV2 tiếp.
replaceRegex(
  /if \(imageMotionOnlyMode\) \{\s*await appendAppLog\(null,\s*\{[\s\S]*?reason: 'final guard before video provider in image-motion-only mode'[\s\S]*?return await buildImageMotionOnlyPipelineResult\(\{[\s\S]*?\}\);\s*\}\s*\n\s*await appendAppLog\(null,\s*\{\s*source:\s*'main',\s*kind:\s*'info',\s*text:\s*`Scene \$\{sceneId\}: video router/,
  `if (imageMotionOnlyMode && String(motionPrompt || '').trim()) {
    const imageMotionOnlySafeImagePath = await findSceneKeyframePathSafe(sceneDir, sceneId);

    await appendAppLog(null, {
      source: 'main',
      kind: 'ok',
      text: \`Scene \${sceneId}: Image + motion only: đã có motion prompt, bỏ qua toàn bộ Grok/Veo/video.\`,
      details: {
        imagePath: imageMotionOnlySafeImagePath ? path.basename(imageMotionOnlySafeImagePath) : '',
        motionPromptRef: 'motion_prompt.txt',
        reason: 'final guard before video provider in image-motion-only mode',
      },
    }).catch(() => null);

    return await buildImageMotionOnlyPipelineResult({
      sceneDir,
      sceneId,
      imagePath: imageMotionOnlySafeImagePath,
      motionPrompt,
      finalImagePrompt: '',
      continuityReferenceState: null,
    });
  }

  await appendAppLog(null, { source: 'main', kind: 'info', text: \`Scene \${sceneId}: video router`,
  'fix final guard to only skip video after motionPrompt exists'
);

// Xóa các return còn dùng typeof imagePath vì vẫn có thể dính TDZ với let/const.
replaceRegex(
  /imagePath:\s*typeof imagePath !== 'undefined' \? imagePath : '',/g,
  `imagePath: await findSceneKeyframePathSafe(sceneDir, sceneId),`,
  'remove TDZ-unsafe typeof imagePath'
);

replaceRegex(
  /finalImagePrompt:\s*typeof finalImagePrompt !== 'undefined' \? finalImagePrompt : '',/g,
  `finalImagePrompt: '',`,
  'remove TDZ-unsafe typeof finalImagePrompt'
);

replaceRegex(
  /continuityReferenceState:\s*typeof continuityReferenceState !== 'undefined' \? continuityReferenceState : null,/g,
  `continuityReferenceState: null,`,
  'remove TDZ-unsafe typeof continuityReferenceState'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: fixed image+motion-only final guard TDZ and premature skip');
console.log('Backup:', backup);
