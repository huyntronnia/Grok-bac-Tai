const fs = require('fs');

const p = 'electron/renderer.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_resume_first_incomplete_and_log`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

function replaceAll(from, to, label) {
  const count = s.split(from).length - 1;
  if (!count) {
    console.log(`SKIP: ${label}`);
    return;
  }
  s = s.split(from).join(to);
  console.log(`OK: ${label} (${count})`);
}

// 1) Thêm logger an toàn, không dùng addPipelineLog chưa tồn tại.
const helper = `
function safeAddPipelineLog(source, kind, text, details = null) {
  try {
    if (typeof addPipelineLog === 'function') {
      addPipelineLog(source, kind, text, details);
      return;
    }
  } catch (_error) {}

  try {
    if (Array.isArray(pipelineLogs)) {
      pipelineLogs.unshift({
        time: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
        source,
        kind,
        text,
        details,
      });

      if (pipelineLogs.length > 300) pipelineLogs = pipelineLogs.slice(0, 300);
      renderPipelineLog?.();
    }
  } catch (_error) {}
}

function sceneHasVideoOutput(scene) {
  return Boolean(scene?.videoPath || scene?.videoUrl || scene?.finalVideoPath || scene?.outputVideoPath);
}

function findFirstSceneMissingVideo() {
  if (!project?.scenes?.length) return null;
  return [...project.scenes]
    .sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
    .find((scene) => !sceneHasVideoOutput(scene)) || null;
}

function forceResumeFirstIncompleteSceneIfNeeded() {
  const firstMissingVideo = findFirstSceneMissingVideo();
  if (!firstMissingVideo) return false;

  const id = Number(firstMissingVideo.id || 0);
  if (!id) return false;

  const currentIds = Array.isArray(activeBatchIds) ? activeBatchIds.map(Number) : [];
  if (currentIds.length && currentIds[0] === id) return false;

  activeBatchIds = [id];

  // Đảm bảo scene này runnable, thay vì nhảy sang batch 2-10.
  if (firstMissingVideo.motionPrompt && !sceneHasVideoOutput(firstMissingVideo)) {
    firstMissingVideo.status = 'video_pending';
    firstMissingVideo.progressStep = 'video';
  } else if (firstMissingVideo.imagePath && !firstMissingVideo.motionPrompt) {
    firstMissingVideo.status = 'motion_prompt_pending';
    firstMissingVideo.progressStep = 'motion';
  }

  safeAddPipelineLog(
    'renderer',
    'running',
    \`Resume guard: scene \${id} chưa có video, ép pipeline quay lại scene này trước khi chạy scene sau.\`,
    { activeBatchIds }
  );

  return true;
}

`;

if (!s.includes('function safeAddPipelineLog(source, kind, text')) {
  replaceRegex(
    /async function runFullPipeline\s*\(\)\s*\{/,
    `${helper}
async function runFullPipeline() {`,
    'insert safe log + resume incomplete helpers'
  );
} else {
  console.log('SKIP: helpers already exist');
}

// 2) Thay addPipelineLog?.(...) gây ReferenceError.
replaceAll(
  `addPipelineLog?.(`,
  `safeAddPipelineLog(`,
  'replace unsafe addPipelineLog optional calls'
);

// 3) Ngay đầu runFullPipeline: nếu scene 1 chưa có video thì ép activeBatchIds về [1].
if (!s.includes('forceResumeFirstIncompleteSceneIfNeeded();')) {
  replaceRegex(
    /(ensureChatChoiceFields\(\);\s*if \(!project \|\| !activeBatchIds\.length\) return;)/,
    `$1
  forceResumeFirstIncompleteSceneIfNeeded();`,
    'force resume first incomplete scene at run start'
  );

  // Fallback nếu đầu hàm hơi khác.
  if (!s.includes('forceResumeFirstIncompleteSceneIfNeeded();')) {
    replaceRegex(
      /(async function runFullPipeline\s*\(\)\s*\{\s*)/,
      `$1
  forceResumeFirstIncompleteSceneIfNeeded();
`,
      'force resume first incomplete scene fallback'
    );
  }
} else {
  console.log('SKIP: resume guard already called');
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: fixed resume first incomplete scene and safe pipeline log');
console.log('Backup:', backup);
