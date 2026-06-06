const fs = require('fs');

const p = 'electron/renderer.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_motion_only_force_next_after_done`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

if (!s.includes('function isImageMotionOnlyModeEnabled')) {
  console.log('FAIL: Chưa có image+motion-only mode helper.');
  process.exit(1);
}

// Helper tìm batch kế tiếp thiếu motion prompt.
if (!s.includes('function getNextImageMotionOnlyBatchAfter')) {
  const helper = `
function getNextImageMotionOnlyBatchAfter(doneSceneId = 0) {
  if (!project?.scenes?.length) return [];

  const sorted = [...project.scenes].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

  const next = sorted.find((scene) => {
    const id = Number(scene.id || 0);
    if (!id || id <= Number(doneSceneId || 0)) return false;

    const hasMotion = Boolean(
      scene.motionPrompt ||
      scene.motionPromptPath ||
      scene.videoStatus === 'skipped-image-motion-only'
    );

    return !hasMotion;
  });

  if (!next?.id) return [];

  return sorted
    .map((scene) => Number(scene.id || 0))
    .filter((id) => id >= Number(next.id || 0))
    .slice(0, 10);
}

`;
  replaceRegex(
    /async function runFullPipeline\s*\(\)\s*\{/,
    `${helper}
async function runFullPipeline() {`,
    'insert getNextImageMotionOnlyBatchAfter helper'
  );
} else {
  console.log('SKIP: getNextImageMotionOnlyBatchAfter already exists');
}

// Sửa handler sau khi scene image+motion-only xong.
// Thay vì continue rồi rơi vào "Không còn scene", nếu batch chỉ có scene đó thì chạy batch kế tiếp.
replaceRegex(
  /(safeAddPipelineLog\?\.\(\s*'renderer',\s*'ok',\s*`Image \+ motion only: scene \$\{scene\.id\} completed without video\.`\s*\);\s*persist\(\);\s*render\(\);\s*continue;)/,
  `safeAddPipelineLog?.(
          'renderer',
          'ok',
          \`Image + motion only: scene \${scene.id} completed without video.\`
        );

        persist();
        render();

        const remainingInCurrentBatch = (activeBatchIds || [])
          .map(Number)
          .filter((id) => id > Number(scene.id || 0));

        if (!remainingInCurrentBatch.length) {
          const nextBatch = getNextImageMotionOnlyBatchAfter(scene.id);

          if (nextBatch.length) {
            activeBatchIds = nextBatch;
            safeAddPipelineLog?.(
              'renderer',
              'running',
              \`Image + motion only: tự chuyển sang batch kế tiếp bắt đầu từ scene \${nextBatch[0]}.\`,
              { activeBatchIds }
            );
            persist();
            render();
            return runFullPipeline();
          }
        }

        continue;`,
  'force next batch after image+motion-only scene done'
);

// Sửa fallback "Không còn scene..." để nếu còn scene chưa motion thì chạy tiếp.
if (!s.includes('motion-only-no-scenes-fallback-force-next')) {
  replaceRegex(
    /setStatus\('Không còn scene cần chạy trong batch hiện tại\.', 'ok'\);\s*return;/,
    `// motion-only-no-scenes-fallback-force-next
    if (isImageMotionOnlyModeEnabled()) {
      const lastDoneId = Math.max(0, ...(activeBatchIds || []).map(Number).filter(Boolean));
      const nextBatch = getNextImageMotionOnlyBatchAfter(lastDoneId);

      if (nextBatch.length) {
        activeBatchIds = nextBatch;
        safeAddPipelineLog?.(
          'renderer',
          'running',
          \`Image + motion only: batch hiện tại hết, tự chạy tiếp từ scene \${nextBatch[0]}.\`,
          { activeBatchIds }
        );
        persist();
        render();
        return runFullPipeline();
      }
    }

    setStatus('Không còn scene cần chạy trong batch hiện tại.', 'ok');
    return;`,
    'force next batch from no-scenes fallback'
  );
} else {
  console.log('SKIP: no-scenes fallback already patched');
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: image+motion-only now continues to next batch after scene done');
console.log('Backup:', backup);
