const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_imagePath_tdz_motion_only`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// Sửa nhánh image+motion-only đang dùng imagePath trước khi biến imagePath được khai báo.
// Không reference imagePath/finalImagePrompt/continuityReferenceState ở nhánh early return nữa.
replaceRegex(
  /if \(imageMotionOnlyMode\) \{\s*await appendAppLog\(null,\s*\{[\s\S]*?reason: 'existing motion_prompt\.txt; skipping video provider',\s*\},\s*\}\)\.catch\(\(\) => null\);\s*return await buildImageMotionOnlyPipelineResult\(\{[\s\S]*?continuityReferenceState,\s*\}\);\s*\}/,
  `if (imageMotionOnlyMode) {
      const imageMotionOnlySafeImagePathCandidates = [
        path.join(sceneDir, \`scene_\${String(sceneId).padStart(3, '0')}_keyframe.png\`),
        path.join(sceneDir, 'scene_keyframe.png'),
        path.join(sceneDir, 'keyframe.png'),
      ];

      let imageMotionOnlySafeImagePath = '';
      for (const candidate of imageMotionOnlySafeImagePathCandidates) {
        try {
          await fs.access(candidate);
          imageMotionOnlySafeImagePath = candidate;
          break;
        } catch (_error) {}
      }

      await appendAppLog(null, {
        source: 'main',
        kind: 'ok',
        text: \`Scene \${sceneId}: Image + motion only: đã có sẵn motion_prompt.txt; bỏ qua Grok/Veo/video.\`,
        details: {
          imagePath: imageMotionOnlySafeImagePath ? path.basename(imageMotionOnlySafeImagePath) : '',
          motionPromptRef: 'motion_prompt.txt',
          reason: 'existing motion_prompt.txt; skipping video provider',
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
    }`,
  'fix early image-motion-only existing motion_prompt branch without imagePath TDZ'
);

// Sửa final guard nếu cũng dùng imagePath trước init trong scope khác.
replaceRegex(
  /return await buildImageMotionOnlyPipelineResult\(\{\s*sceneDir,\s*sceneId,\s*imagePath,\s*motionPrompt,\s*finalImagePrompt,\s*continuityReferenceState,\s*\}\);/g,
  `return await buildImageMotionOnlyPipelineResult({
      sceneDir,
      sceneId,
      imagePath: typeof imagePath !== 'undefined' ? imagePath : '',
      motionPrompt,
      finalImagePrompt: typeof finalImagePrompt !== 'undefined' ? finalImagePrompt : '',
      continuityReferenceState: typeof continuityReferenceState !== 'undefined' ? continuityReferenceState : null,
    });`,
  'make remaining image-motion-only returns safer'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: fixed imagePath before initialization in image+motion-only mode');
console.log('Backup:', backup);
