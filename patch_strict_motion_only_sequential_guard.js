const fs = require('fs');

const p = 'electron/renderer.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_strict_motion_only_sequential_guard`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

if (!s.includes('function hasMotionOnlySceneDoneStrict')) {
  const helper = `
function hasMotionOnlySceneDoneStrict(scene) {
  return Boolean(
    scene &&
    (
      scene.videoStatus === 'skipped-image-motion-only' ||
      scene.status === 'done' ||
      scene.motionPrompt ||
      scene.motionPromptPath
    )
  );
}

function findBlockingPreviousMotionScene(targetSceneId) {
  if (!isImageMotionOnlyModeEnabled() || !project?.scenes?.length) return null;

  const target = Number(targetSceneId || 0);
  if (!target || target <= 1) return null;

  const sorted = [...project.scenes].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

  for (const scene of sorted) {
    const id = Number(scene.id || 0);
    if (!id || id >= target) continue;

    if (!hasMotionOnlySceneDoneStrict(scene)) {
      return scene;
    }
  }

  return null;
}

`;
  replaceRegex(
    /async function runFullPipeline\s*\(\)\s*\{/,
    `${helper}
async function runFullPipeline() {`,
    'insert strict motion-only sequential guard helpers'
  );
} else {
  console.log('SKIP: strict motion-only guard helpers already exist');
}

// Chèn guard ngay trước khi gọi runScenePipeline cho từng scene.
if (!s.includes('strict-motion-only-before-run-scene-guard')) {
  replaceRegex(
    /(const result = await window\.videoPlannerAPI\.runScenePipeline\(\{\s*)/,
    `// strict-motion-only-before-run-scene-guard
      if (isImageMotionOnlyModeEnabled()) {
        const blockingPreviousMotionScene = findBlockingPreviousMotionScene(scene.id);
        if (blockingPreviousMotionScene) {
          activeBatchIds = [Number(blockingPreviousMotionScene.id)];
          safeAddPipelineLog?.(
            'renderer',
            'running',
            \`Image + motion only: chặn nhảy scene \${scene.id}; quay lại scene \${blockingPreviousMotionScene.id} vì scene trước chưa commit motion prompt.\`,
            { activeBatchIds }
          );
          persist();
          render();
          return runFullPipeline();
        }
      }

      $1`,
    'guard before runScenePipeline'
  );
} else {
  console.log('SKIP: strict motion-only before run scene guard already installed');
}

// Sau khi result image-motion-only về, commit scene thật chắc.
replaceRegex(
  /(scene\.videoStatus = 'skipped-image-motion-only';\s*scene\.videoPath = '';\s*scene\.videoUrl = '';\s*scene\.status = 'done';)/,
  `scene.videoStatus = 'skipped-image-motion-only';
        scene.videoPath = '';
        scene.videoUrl = '';
        scene.status = 'done';
        scene.motionPrompt = result.motionPrompt || scene.motionPrompt || '[saved: motion_prompt.txt]';
        scene.motionPromptPath = result.motionPromptPath || scene.motionPromptPath || 'motion_prompt.txt';`,
  'force commit motion prompt fields before scene done'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: strict sequential guard for image+motion-only scenes');
console.log('Backup:', backup);
