const fs = require('fs');

const p = 'electron/renderer.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_motion_only_scene_done_and_next`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

function insertAfterRunScenePipelineResult() {
  if (s.includes('motion-only-mark-result-done-v2')) {
    console.log('SKIP: motion-only result handler already exists');
    return;
  }

  const marker = `const result = await window.videoPlannerAPI.runScenePipeline({`;
  const idx = s.indexOf(marker);
  if (idx < 0) {
    console.log('FAIL: Không tìm thấy runScenePipeline call.');
    return;
  }

  const end = s.indexOf(`      });`, idx);
  if (end < 0) {
    console.log('FAIL: Không tìm thấy cuối block runScenePipeline.');
    return;
  }

  const insertAt = end + `      });`.length;

  const handler = `

      // motion-only-mark-result-done-v2
      if (
        isImageMotionOnlyModeEnabled() &&
        (
          result?.imageMotionOnlyMode ||
          result?.skipVideoGeneration ||
          result?.videoStatus === 'skipped-image-motion-only'
        )
      ) {
        scene.imagePath = result.imagePath || scene.imagePath || '';
        scene.imageDataUrl = result.imageDataUrl || scene.imageDataUrl || '';
        scene.motionPrompt = result.motionPrompt || scene.motionPrompt || '[saved: motion_prompt.txt]';
        scene.motionPromptPath = result.motionPromptPath || scene.motionPromptPath || 'motion_prompt.txt';
        scene.videoStatus = 'skipped-image-motion-only';
        scene.videoPath = '';
        scene.videoUrl = '';
        scene.status = 'done';
        scene.progressStep = 'motion';
        scene.error = '';
        scene.updatedAt = new Date().toISOString();

        safeAddPipelineLog?.(
          'renderer',
          'ok',
          \`Image + motion only: scene \${scene.id} completed without video.\`
        );

        persist();
        render();
        continue;
      }
`;

  s = s.slice(0, insertAt) + handler + s.slice(insertAt);
  console.log('OK: inserted motion-only result done handler');
}

insertAfterRunScenePipelineResult();

// Đảm bảo helper hoàn tất theo mode tồn tại/đúng.
if (!s.includes('function sceneHasRequiredOutputForCurrentMode')) {
  replaceRegex(
    /function sceneHasVideoOutput\s*\(scene\)\s*\{[\s\S]*?\n\}/,
    `function sceneHasMotionPromptOutput(scene) {
  return Boolean(
    scene?.motionPrompt ||
    scene?.motionPromptPath ||
    scene?.videoStatus === 'skipped-image-motion-only'
  );
}

function sceneHasRequiredOutputForCurrentMode(scene) {
  if (isImageMotionOnlyModeEnabled()) {
    return sceneHasMotionPromptOutput(scene);
  }

  return Boolean(scene?.videoPath || scene?.videoUrl || scene?.finalVideoPath || scene?.outputVideoPath);
}

function sceneHasVideoOutput(scene) {
  return sceneHasRequiredOutputForCurrentMode(scene);
}`,
    'install mode-aware scene completion helpers'
  );
}

// Nếu đã có findFirstSceneMissingVideo cũ, sửa lại.
replaceRegex(
  /function findFirstSceneMissingVideo\s*\(\)\s*\{[\s\S]*?\n\}/,
  `function findFirstSceneMissingVideo() {
  if (!project?.scenes?.length) return null;

  return [...project.scenes]
    .sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
    .find((scene) => !sceneHasRequiredOutputForCurrentMode(scene)) || null;
}`,
  'make findFirstSceneMissingVideo mode-aware'
);

// Khi batch hiện tại hết, tự chuyển sang scene kế tiếp thiếu motionPrompt.
if (!s.includes('motion-only-auto-next-batch-when-current-empty')) {
  replaceRegex(
    /setStatus\('Không còn scene cần chạy trong batch hiện tại\.', 'ok'\);\s*return;/,
    `if (isImageMotionOnlyModeEnabled()) {
      const nextMotionScene = findFirstSceneMissingVideo?.();
      if (nextMotionScene?.id) {
        const allIds = [...project.scenes]
          .sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
          .map((item) => Number(item.id || 0))
          .filter((id) => id >= Number(nextMotionScene.id || 0))
          .slice(0, 10);

        activeBatchIds = allIds.length ? allIds : [Number(nextMotionScene.id)];
        safeAddPipelineLog?.(
          'renderer',
          'running',
          \`Image + motion only: batch hiện tại đã xong, chuyển sang batch bắt đầu từ scene \${nextMotionScene.id}.\`,
          { activeBatchIds }
        );
        persist();
        render();
        return runFullPipeline();
      }
    }

    setStatus('Không còn scene cần chạy trong batch hiện tại.', 'ok');
    return;`,
    'motion-only-auto-next-batch-when-current-empty'
  );
} else {
  console.log('SKIP: auto next batch already installed');
}

// Sửa resume guard: scene có videoStatus skipped hoặc motionPrompt thì không ép lại.
replaceRegex(
  /const firstMissingVideo = findFirstSceneMissingVideo\(\);/g,
  `const firstMissingVideo = findFirstSceneMissingVideo();`,
  'touch firstMissingVideo marker'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: fixed image+motion-only scene completion and next-scene continuation');
console.log('Backup:', backup);
