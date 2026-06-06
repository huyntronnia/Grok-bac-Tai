const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_sceneId_not_defined_extract`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

const safeSceneId = "(typeof sceneId !== 'undefined' ? sceneId : ((typeof options !== 'undefined' && options?.sceneId) || (typeof context !== 'undefined' && context?.sceneId) || ''))";

function replaceNearStage(stage) {
  const patterns = [
    `sceneId,\\n        stage: '${stage}'`,
    `sceneId,\\n    stage: '${stage}'`,
    `sceneId,\\r\\n        stage: '${stage}'`,
    `sceneId,\\r\\n    stage: '${stage}'`,
  ];

  for (const pat of patterns) {
    const real = pat.replaceAll('\\n', '\n').replaceAll('\\r', '\r');
    if (s.includes(real)) {
      const spaces = real.includes('\n        ') || real.includes('\r\n        ') ? '        ' : '    ';
      s = s.replaceAll(real, `sceneId: ${safeSceneId},\n${spaces}stage: '${stage}'`);
      console.log('OK fixed stage:', stage);
    }
  }
}

replaceNearStage('image-wait-before-extract');
replaceNearStage('before-final-image-settle');
replaceNearStage('before-image-extract-wait');
replaceNearStage('after-nv1-sentImage-log');
replaceNearStage('after-nv1-send-before-rename');

// Fix log/template nào còn dùng sceneId trần trong vùng extract.
s = s.replaceAll(
  "`Scene ${sceneId}: ChatGPT stop button gone; waiting 4s for final image to settle before extract.`",
  "`Scene ${" + safeSceneId + "}: ChatGPT stop button gone; waiting 4s for final image to settle before extract.`"
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: fixed sceneId undefined around image extract stages');
console.log('Backup:', backup);
