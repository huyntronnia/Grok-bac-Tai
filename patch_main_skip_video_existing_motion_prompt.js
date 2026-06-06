const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_main_skip_video_existing_motion_prompt`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// 1) Đảm bảo main có biến imageMotionOnlyMode đọc từ options.
if (!s.includes('options.imageMotionOnlyMode') && !s.includes('imageMotionOnlyMode = Boolean')) {
  replaceRegex(
    /(const\s*\{\s*projectName = 'project'[\s\S]*?\}\s*=\s*options \|\| \{\};)/,
    `$1

  const imageMotionOnlyMode = Boolean(
    options?.imageMotionOnlyMode ||
    options?.skipVideoGeneration ||
    options?.motionOnlyMode ||
    options?.noVideoMode
  );`,
    'add imageMotionOnlyMode option near options destructure'
  );
} else {
  console.log('SKIP: imageMotionOnlyMode option already seems present');
}

// 2) Thêm helper return kết quả image+motion-only nếu chưa có.
if (!s.includes('function buildImageMotionOnlyPipelineResult')) {
  replaceRegex(
    /async function runScenePipelineLocked/,
    `async function buildImageMotionOnlyPipelineResult({
  sceneDir,
  sceneId,
  imagePath,
  motionPrompt,
  finalImagePrompt = '',
  continuityReferenceState = null,
}) {
  return {
    sceneDir,
    phase: 'motion_prompt',
    imageMotionOnlyMode: true,
    skipVideoGeneration: true,
    imagePath,
    imageDataUrl: imagePath ? await imageFileToDataUrl(imagePath).catch(() => '') : '',
    imagePromptUsed: finalImagePrompt || '',
    motionPrompt,
    motionPromptPath: path.join(sceneDir, 'motion_prompt.txt'),
    videoPath: '',
    videoProvider: 'none',
    videoStatus: 'skipped-image-motion-only',
    videoError: '',
    continuityReferencePaths: continuityReferenceState?.paths || [],
    continuityReferenceSourceScene: continuityReferenceState?.sourceSceneId || null,
    generatedContinuityReferences: {
      ok: false,
      skipped: true,
      reason: 'image-motion-only-mode',
      sourceSceneId: sceneId,
      paths: [],
    },
    router: null,
  };
}

async function runScenePipelineLocked`,
    'insert buildImageMotionOnlyPipelineResult helper'
  );
} else {
  console.log('SKIP: buildImageMotionOnlyPipelineResult already exists');
}

// 3) Chặn đúng nhánh "đã có motion_prompt.txt, bỏ qua ChatGPT NV2 và gửi thẳng Grok."
// Sau log này phải return luôn nếu imageMotionOnlyMode bật.
if (!s.includes('existing motion_prompt.txt; skipping video provider')) {
  replaceRegex(
    /(await appendAppLog\(null,\s*\{\s*source:\s*'main',\s*kind:\s*'ok',\s*text:\s*`Scene \$\{sceneId\}: đã có motion_prompt\.txt, bỏ qua ChatGPT NV2 và gửi thẳng Grok\.`[\s\S]*?\}\);)/,
    `$1

    if (imageMotionOnlyMode) {
      await appendAppLog(null, {
        source: 'main',
        kind: 'ok',
        text: \`Scene \${sceneId}: Image + motion only: đã có sẵn motion_prompt.txt; bỏ qua Grok/Veo/video.\`,
        details: {
          imagePath: imagePath ? path.basename(imagePath) : '',
          motionPromptRef: 'motion_prompt.txt',
          reason: 'existing motion_prompt.txt; skipping video provider',
        },
      }).catch(() => null);

      return await buildImageMotionOnlyPipelineResult({
        sceneDir,
        sceneId,
        imagePath,
        motionPrompt,
        finalImagePrompt,
        continuityReferenceState,
      });
    }`,
    'return before Grok when existing motion_prompt and imageMotionOnlyMode'
  );
} else {
  console.log('SKIP: existing motion_prompt image-only guard already exists');
}

// 4) Lớp bảo vệ cuối: trước mọi check login Grok/video router, nếu imageMotionOnlyMode bật thì return.
// Dùng marker "video router" vì log đang tới đó trước khi check login Grok.
if (!s.includes('final guard before video provider in image-motion-only mode')) {
  replaceRegex(
    /(await appendAppLog\(null,\s*\{\s*source:\s*'main',\s*kind:\s*'info',\s*text:\s*`Scene \$\{sceneId\}: video router)/,
    `if (imageMotionOnlyMode) {
    await appendAppLog(null, {
      source: 'main',
      kind: 'ok',
      text: \`Scene \${sceneId}: Image + motion only: final guard before video provider, bỏ qua toàn bộ Grok/Veo/video.\`,
      details: { reason: 'final guard before video provider in image-motion-only mode' },
    }).catch(() => null);

    return await buildImageMotionOnlyPipelineResult({
      sceneDir,
      sceneId,
      imagePath,
      motionPrompt,
      finalImagePrompt,
      continuityReferenceState,
    });
  }

  $1`,
    'final guard before video router/check Grok'
  );
} else {
  console.log('SKIP: final video provider guard already exists');
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: main skips Grok/video when image+motion-only mode is enabled, including existing motion_prompt.txt');
console.log('Backup:', backup);
