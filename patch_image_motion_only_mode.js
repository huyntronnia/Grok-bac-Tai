const fs = require('fs');

const files = {
  main: 'electron/main.js',
  renderer: 'electron/renderer.js',
  css: 'electron/style.css',
};

for (const file of Object.values(files)) {
  const backup = `${file}.bak_image_motion_only_mode`;
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
}

let main = fs.readFileSync(files.main, 'utf8');
let renderer = fs.readFileSync(files.renderer, 'utf8');
let css = fs.readFileSync(files.css, 'utf8');

function replaceMain(rx, to, label) {
  const before = main;
  main = main.replace(rx, to);
  console.log(before === main ? `SKIP main: ${label}` : `OK main: ${label}`);
}

function replaceRenderer(rx, to, label) {
  const before = renderer;
  renderer = renderer.replace(rx, to);
  console.log(before === renderer ? `SKIP renderer: ${label}` : `OK renderer: ${label}`);
}

function replaceAllRenderer(from, to, label) {
  const count = renderer.split(from).length - 1;
  if (!count) {
    console.log(`SKIP renderer: ${label}`);
    return;
  }
  renderer = renderer.split(from).join(to);
  console.log(`OK renderer: ${label} (${count})`);
}

// =========================
// 1) MAIN: nhận option skip video.
// =========================
replaceMain(
  /(const\s*\{\s*projectName = 'project',[\s\S]*?sceneText = '',\s*\}\s*=\s*options \|\| \{\};\s*let motionPrompt = options\.motionPrompt \|\| '';\s*)/,
  `$1
  const imageMotionOnlyMode = Boolean(
    options.imageMotionOnlyMode ||
    options.skipVideoGeneration ||
    options.motionOnlyMode ||
    options.noVideoMode
  );
`,
  'add imageMotionOnlyMode option in runScenePipelineLocked'
);

// Cắt pipeline ngay sau khi motion_prompt.txt đã được lưu, trước checkpoint/video.
if (!main.includes('videoStatus: \'skipped-image-motion-only\'')) {
  replaceMain(
    /(await fs\.writeFile\(path\.join\(sceneDir,\s*'motion_prompt\.txt'\),\s*motionPrompt,\s*'utf8'\);\s*)/,
    `$1

  if (imageMotionOnlyMode) {
    await appendAppLog(null, {
      source: 'main',
      kind: 'ok',
      text: \`Scene \${sceneId}: Image + motion only mode: đã lưu keyframe và motion_prompt.txt, bỏ qua Grok/Veo/video.\`,
      details: {
        imagePath: imagePath ? path.basename(imagePath) : '',
        motionPromptRef: 'motion_prompt.txt',
      },
    }).catch(() => null);

    return {
      sceneDir,
      phase: 'motion_prompt',
      imageMotionOnlyMode: true,
      imagePath,
      imageDataUrl: imagePath ? await imageFileToDataUrl(imagePath).catch(() => '') : '',
      imagePromptUsed: finalImagePrompt,
      motionPrompt,
      motionPromptPath: path.join(sceneDir, 'motion_prompt.txt'),
      videoPath: '',
      videoProvider: 'none',
      videoStatus: 'skipped-image-motion-only',
      videoError: '',
      continuityReferencePaths: continuityReferenceState?.paths || [],
      continuityReferenceSourceScene: continuityReferenceState?.sourceSceneId || null,
      generatedContinuityReferences: { ok: false, skipped: true, reason: 'image-motion-only-mode', sourceSceneId: sceneId, paths: [] },
      router: null,
    };
  }
`,
    'return after motion prompt when imageMotionOnlyMode'
  );
} else {
  console.log('SKIP main: image-motion-only return already exists');
}

// Đảm bảo final return bình thường cũng có motionPrompt cho renderer dùng.
replaceMain(
  /(videoError:\s*maskRouterText\(videoError\),\s*)/,
  `$1
    motionPrompt,
    imageMotionOnlyMode: false,
`,
  'include motionPrompt in normal final return'
);

// =========================
// 2) RENDERER: tạo checkbox option.
// =========================
const rendererHelper = `
function isImageMotionOnlyModeEnabled() {
  return Boolean(project?.imageMotionOnlyMode || document.querySelector('#image-motion-only-mode')?.checked);
}

function ensureImageMotionOnlyModeControl() {
  try {
    if (document.querySelector('#image-motion-only-mode-card')) {
      const checkbox = document.querySelector('#image-motion-only-mode');
      if (checkbox && project) checkbox.checked = Boolean(project.imageMotionOnlyMode);
      return;
    }

    const startBtn =
      document.querySelector('#start-pipeline-btn') ||
      document.querySelector('#start-full-pipeline-btn') ||
      document.querySelector('[data-action="start-pipeline"]') ||
      Array.from(document.querySelectorAll('button')).find((btn) =>
        /start pipeline|chạy pipeline|pipeline ngay/i.test(String(btn.innerText || btn.textContent || ''))
      );

    const card = document.createElement('div');
    card.id = 'image-motion-only-mode-card';
    card.className = 'image-motion-only-mode-card';
    card.innerHTML = \`
      <label class="image-motion-only-mode-label">
        <input id="image-motion-only-mode" type="checkbox" />
        <span>
          <b>Chỉ tạo ảnh + motion prompt</b>
          <small>Bỏ qua Grok/Veo/video. Dùng khi acc video die, tự đem ảnh + prompt đi làm tay.</small>
        </span>
      </label>
    \`;

    const checkbox = card.querySelector('#image-motion-only-mode');
    checkbox.checked = Boolean(project?.imageMotionOnlyMode);
    checkbox.addEventListener('change', () => {
      if (project) {
        project.imageMotionOnlyMode = checkbox.checked;
        persist?.();
      }

      setStatus(
        checkbox.checked
          ? 'Đã bật chế độ chỉ tạo ảnh + motion prompt, sẽ bỏ qua Grok/Veo/video.'
          : 'Đã tắt chế độ chỉ tạo ảnh + motion prompt.',
        checkbox.checked ? 'ok' : 'idle'
      );
    });

    if (startBtn?.parentElement) {
      startBtn.parentElement.insertBefore(card, startBtn);
    } else {
      document.body.appendChild(card);
    }
  } catch (error) {
    console.warn('ensureImageMotionOnlyModeControl failed', error);
  }
}

`;

if (!renderer.includes('function isImageMotionOnlyModeEnabled()')) {
  replaceRenderer(
    /async function runFullPipeline\s*\(\)\s*\{/,
    `${rendererHelper}
async function runFullPipeline() {
  ensureImageMotionOnlyModeControl();
`,
    'insert image motion only UI helper before runFullPipeline'
  );
} else {
  console.log('SKIP renderer: image motion only helper already exists');
}

// Gọi tạo UI sau load/render.
if (!renderer.includes('setTimeout(ensureImageMotionOnlyModeControl, 0);')) {
  renderer += `

setTimeout(ensureImageMotionOnlyModeControl, 0);
document.addEventListener('DOMContentLoaded', ensureImageMotionOnlyModeControl);
`;
  console.log('OK renderer: call ensureImageMotionOnlyModeControl');
} else {
  console.log('SKIP renderer: ensureImageMotionOnlyModeControl already called');
}

// Nếu có render(), refresh checkbox theo project.
replaceRenderer(
  /(function render\s*\(\)\s*\{\s*)/,
  `$1
  ensureImageMotionOnlyModeControl();
`,
  'refresh image motion only control in render'
);

// Thêm field vào payload gửi main.
if (!renderer.includes('imageMotionOnlyMode: isImageMotionOnlyModeEnabled()')) {
  replaceRenderer(
    /(window\.videoPlannerAPI\.runScenePipeline\(\s*\{\s*)/,
    `$1
        imageMotionOnlyMode: isImageMotionOnlyModeEnabled(),
        skipVideoGeneration: isImageMotionOnlyModeEnabled(),
`,
    'add imageMotionOnlyMode to runScenePipeline payload'
  );
} else {
  console.log('SKIP renderer: payload already has imageMotionOnlyMode');
}

// Nếu payload pattern không match, thử chèn trước videoProvider.
if (!renderer.includes('imageMotionOnlyMode: isImageMotionOnlyModeEnabled()')) {
  replaceRenderer(
    /(videoProvider:\s*)/,
    `imageMotionOnlyMode: isImageMotionOnlyModeEnabled(),
        skipVideoGeneration: isImageMotionOnlyModeEnabled(),
        $1`,
    'add imageMotionOnlyMode before videoProvider fallback'
  );
}

// Khi mode này bật, scene có motionPrompt được coi là hoàn tất để không bị chặn vì thiếu video.
replaceRenderer(
  /function sceneHasVideoOutput\s*\(scene\)\s*\{[\s\S]*?\n\}/,
  `function sceneHasVideoOutput(scene) {
  if (isImageMotionOnlyModeEnabled() && (scene?.motionPrompt || scene?.motionPromptPath || scene?.videoStatus === 'skipped-image-motion-only')) {
    return true;
  }

  return Boolean(scene?.videoPath || scene?.videoUrl || scene?.finalVideoPath || scene?.outputVideoPath);
}`,
  'update sceneHasVideoOutput for image-motion-only mode'
);

// Guard đã thêm trước đó: nếu thiếu video thì dừng. Cho phép bỏ qua khi image-motion-only.
replaceAllRenderer(
  `if (!hasVideoOutput) {`,
  `if (!hasVideoOutput && !isImageMotionOnlyModeEnabled()) {`,
  'do not block missing video in image-motion-only mode'
);

// Sau khi nhận result từ main, nếu là image-motion-only thì đánh dấu scene done.
if (!renderer.includes('Image + motion only: scene completed without video')) {
  const marker = `      const result = await window.videoPlannerAPI.runScenePipeline({`;
  const idx = renderer.indexOf(marker);
  if (idx >= 0) {
    const closeIdx = renderer.indexOf(`      });`, idx);
    if (closeIdx >= 0) {
      const insertAt = closeIdx + `      });`.length;
      renderer =
        renderer.slice(0, insertAt) +
        `

      if (isImageMotionOnlyModeEnabled() && result?.imageMotionOnlyMode) {
        scene.imagePath = result.imagePath || scene.imagePath;
        scene.imageDataUrl = result.imageDataUrl || scene.imageDataUrl;
        scene.motionPrompt = result.motionPrompt || scene.motionPrompt || '';
        scene.motionPromptPath = result.motionPromptPath || scene.motionPromptPath || '';
        scene.videoStatus = 'skipped-image-motion-only';
        scene.status = 'done';
        scene.progressStep = 'motion';
        scene.error = '';
        safeAddPipelineLog?.('renderer', 'ok', \`Image + motion only: scene \${scene.id} completed without video.\`);
        persist();
        render();
        continue;
      }
` +
        renderer.slice(insertAt);
      console.log('OK renderer: mark scene done after image-motion-only result');
    } else {
      console.log('SKIP renderer: could not find end of runScenePipeline call for result handling');
    }
  } else {
    console.log('SKIP renderer: could not find runScenePipeline call marker');
  }
} else {
  console.log('SKIP renderer: image-motion-only result handler already exists');
}

// Nếu preflight Grok làm phiền thì chỉ đổi status text trong mode này.
// Không đụng mạnh block check login để tránh hỏng flow hiện tại.
replaceAllRenderer(
  `Đang chạy full pipeline: ChatGPT tạo ảnh → Grok tạo video → lưu theo scene...`,
  `Đang chạy pipeline: ChatGPT tạo ảnh + motion prompt${'${isImageMotionOnlyModeEnabled() ? " → bỏ qua video" : " → Grok tạo video"}'}...`,
  'update running status text'
);

// =========================
// 3) CSS.
// =========================
if (!css.includes('.image-motion-only-mode-card')) {
  css += `

.image-motion-only-mode-card {
  margin: 0.75rem 0;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(80, 220, 220, 0.35);
  border-radius: 16px;
  background: rgba(10, 28, 45, 0.72);
}

.image-motion-only-mode-label {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  cursor: pointer;
  color: #eefcff;
}

.image-motion-only-mode-label input {
  margin-top: 0.25rem;
  transform: scale(1.2);
}

.image-motion-only-mode-label span {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.image-motion-only-mode-label small {
  color: rgba(225, 245, 255, 0.72);
  line-height: 1.35;
}
`;
  console.log('OK css: add image motion only styles');
} else {
  console.log('SKIP css: styles already exist');
}

fs.writeFileSync(files.main, main, 'utf8');
fs.writeFileSync(files.renderer, renderer, 'utf8');
fs.writeFileSync(files.css, css, 'utf8');

console.log('DONE: added Image + Motion Prompt only mode');
console.log('Backups:');
console.log(`${files.main}.bak_image_motion_only_mode`);
console.log(`${files.renderer}.bak_image_motion_only_mode`);
console.log(`${files.css}.bak_image_motion_only_mode`);
