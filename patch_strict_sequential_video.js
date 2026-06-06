const fs = require('fs');

const p = 'electron/renderer.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_strict_sequential_video`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

const helper = `
function getSceneVideoPathValue(scene) {
  return scene?.videoPath || scene?.videoUrl || scene?.finalVideoPath || scene?.outputVideoPath || '';
}

function getSceneKeyframePathValue(scene) {
  return scene?.imagePath || scene?.imageUrl || scene?.keyframePath || scene?.keyframeUrl || '';
}

function findFirstIncompleteSceneBefore(sceneId) {
  if (!project?.scenes?.length) return null;

  const sorted = [...project.scenes].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  for (const scene of sorted) {
    const id = Number(scene.id || 0);
    if (!id || id >= Number(sceneId || 0)) continue;

    const hasVideo = Boolean(getSceneVideoPathValue(scene));
    if (!hasVideo) {
      return scene;
    }
  }

  return null;
}

function shouldBlockSceneBecausePreviousVideoMissing(scene) {
  const previous = findFirstIncompleteSceneBefore(scene?.id);
  return previous || null;
}
`;

if (!s.includes('function findFirstIncompleteSceneBefore(sceneId)')) {
  replaceRegex(
    /async function runFullPipeline\s*\(\)\s*\{/,
    `${helper}
async function runFullPipeline() {`,
    'insert strict sequential helpers'
  );
} else {
  console.log('SKIP: strict sequential helpers already exist');
}

// Chặn ngay trong vòng for trước khi gọi runScenePipeline.
if (!s.includes('Không chạy scene kế tiếp vì scene trước chưa có video hoàn chỉnh')) {
  replaceRegex(
    /(for\s*\(let i = 0; i < scenesToRun\.length; i\+\+\)\s*\{\s*const scene = scenesToRun\[i\];)/,
    `$1
    const blockingPreviousScene = shouldBlockSceneBecausePreviousVideoMissing(scene);
    if (blockingPreviousScene) {
      paused = true;
      isRunning = false;
      autoContinuing = false;
      setStatus(\`Không chạy scene \${scene.id}: scene \${blockingPreviousScene.id} chưa có video hoàn chỉnh.\`, 'error');
      addPipelineLog?.('renderer', 'error', \`Không chạy scene kế tiếp vì scene trước chưa có video hoàn chỉnh: scene \${blockingPreviousScene.id}\`);
      persist();
      render();
      return;
    }`,
    'block later scene if any previous scene has no video'
  );
} else {
  console.log('SKIP: strict sequential guard already exists');
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: strict sequential video guard installed');
console.log('Backup:', backup);
