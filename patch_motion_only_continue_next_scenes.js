const fs = require('fs');

const p = 'electron/renderer.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_motion_only_continue_next_scenes`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// 1) Helper: trong image+motion-only, scene hoàn tất khi đã có motionPrompt/motionPromptPath.
if (!s.includes('function sceneHasMotionPromptOutput')) {
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
    'replace scene completion helpers for image+motion-only'
  );
} else {
  console.log('SKIP: sceneHasMotionPromptOutput already exists');
}

// 2) Sửa findFirstSceneMissingVideo: ở mode ảnh+motion thì tìm scene thiếu motionPrompt, không tìm thiếu video.
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

// 3) Sửa findFirstIncompleteSceneBefore nếu có: scene trước có motionPrompt thì không chặn.
replaceRegex(
  /function findFirstIncompleteSceneBefore\s*\(sceneId\)\s*\{[\s\S]*?\n\}/,
  `function findFirstIncompleteSceneBefore(sceneId) {
  if (!project?.scenes?.length) return null;

  const sorted = [...project.scenes].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  for (const scene of sorted) {
    const id = Number(scene.id || 0);
    if (!id || id >= Number(sceneId || 0)) continue;

    if (!sceneHasRequiredOutputForCurrentMode(scene)) {
      return scene;
    }
  }

  return null;
}`,
  'make findFirstIncompleteSceneBefore mode-aware'
);

// 4) Sửa forceResumeFirstIncompleteSceneIfNeeded: trong image+motion mode, đừng ép về scene đã có motionPrompt.
replaceRegex(
  /function forceResumeFirstIncompleteSceneIfNeeded\s*\(\)\s*\{[\s\S]*?\n\}/,
  `function forceResumeFirstIncompleteSceneIfNeeded() {
  const firstIncomplete = findFirstSceneMissingVideo();
  if (!firstIncomplete) return false;

  const id = Number(firstIncomplete.id || 0);
  if (!id) return false;

  const currentIds = Array.isArray(activeBatchIds) ? activeBatchIds.map(Number) : [];

  // Nếu batch hiện tại đã bắt đầu bằng scene cần chạy tiếp thì không đổi.
  if (currentIds.length && currentIds[0] === id) return false;

  // Trong image+motion-only, nếu batch 2-10 đang có scene chưa có motion prompt,
  // giữ batch đó thay vì ép quay lại scene 1 đã xong motion.
  if (isImageMotionOnlyModeEnabled() && currentIds.includes(id)) {
    safeAddPipelineLog(
      'renderer',
      'running',
      \`Image + motion only: giữ batch hiện tại, scene tiếp theo cần chạy là scene \${id}.\`,
      { activeBatchIds }
    );
    return false;
  }

  activeBatchIds = [id];

  if (isImageMotionOnlyModeEnabled()) {
    firstIncomplete.status = firstIncomplete.imagePath ? 'motion_prompt_pending' : 'image_generating';
    firstIncomplete.progressStep = firstIncomplete.imagePath ? 'motion' : 'image';
  } else if (firstIncomplete.motionPrompt && !sceneHasVideoOutput(firstIncomplete)) {
    firstIncomplete.status = 'video_pending';
    firstIncomplete.progressStep = 'video';
  } else if (firstIncomplete.imagePath && !firstIncomplete.motionPrompt) {
    firstIncomplete.status = 'motion_prompt_pending';
    firstIncomplete.progressStep = 'motion';
  }

  safeAddPipelineLog(
    'renderer',
    'running',
    isImageMotionOnlyModeEnabled()
      ? \`Resume guard: ép pipeline về scene \${id} vì scene này chưa có motion prompt.\`
      : \`Resume guard: scene \${id} chưa có video, ép pipeline quay lại scene này trước khi chạy scene sau.\`,
    { activeBatchIds }
  );

  return true;
}`,
  'make forceResumeFirstIncompleteSceneIfNeeded mode-aware'
);

// 5) Khi scene image+motion-only xong, đừng chỉ continue trong batch [1]; cho renderer tự tạo batch kế tiếp.
if (!s.includes('image-motion-only-auto-continue-next-batch')) {
  replaceRegex(
    /(safeAddPipelineLog\?\.\('renderer', 'ok', `Image \+ motion only: scene \$\{scene\.id\} completed without video\.`\);\s*persist\(\);\s*render\(\);\s*continue;)/,
    `$1
      // image-motion-only-auto-continue-next-batch
      // Scene này đã xong yêu cầu của mode ảnh+motion. Nếu batch chỉ có scene này,
      // lần loop/auto-route tiếp theo phải tìm scene thiếu motionPrompt, không bị kẹt ở scene cũ.`,
    'annotate image-motion-only continue'
  );
} else {
  console.log('SKIP: image-motion-only auto continue annotation already exists');
}

// 6) Sửa text log "chưa có video" cho đúng khi đang mode ảnh+motion.
replaceRegex(
  /setStatus\(`Không chạy scene \$\{scene\.id\}: scene \$\{blockingPreviousScene\.id\} chưa có video hoàn chỉnh\.`, 'error'\);/g,
  `setStatus(
        isImageMotionOnlyModeEnabled()
          ? \`Không chạy scene \${scene.id}: scene \${blockingPreviousScene.id} chưa có motion prompt hoàn chỉnh.\`
          : \`Không chạy scene \${scene.id}: scene \${blockingPreviousScene.id} chưa có video hoàn chỉnh.\`,
        'error'
      );`,
  'mode-aware blocking status text'
);

replaceRegex(
  /`Không chạy scene kế tiếp vì scene trước chưa có video hoàn chỉnh: scene \$\{blockingPreviousScene\.id\}`/g,
  `(isImageMotionOnlyModeEnabled()
        ? \`Không chạy scene kế tiếp vì scene trước chưa có motion prompt hoàn chỉnh: scene \${blockingPreviousScene.id}\`
        : \`Không chạy scene kế tiếp vì scene trước chưa có video hoàn chỉnh: scene \${blockingPreviousScene.id}\`)`,
  'mode-aware blocking log text'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: image+motion-only will continue to next scenes based on motion_prompt, not video');
console.log('Backup:', backup);
