const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_wait_stop_false_busy`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceText(from, to, label) {
  if (!s.includes(from)) {
    console.log(`SKIP: ${label}`);
    return;
  }
  s = s.replace(from, to);
  console.log(`OK: ${label}`);
}

// Trong waitForChatGptImageGenerationDoneBeforeExtract:
// bỏ activeGeneration?.generating khỏi busy, vì nó hay false-positive khi còn text "Thought/Thinking".
replaceText(
`    const busy = Boolean(
      imageState?.generating ||
      imageState?.preparingImage ||
      imageState?.stopButtonVisible ||
      imageState?.stopVisible ||
      imageState?.composerBusy ||
      imageState?.streamingIndicator ||
      activeGeneration?.generating
    );`,
`    const busy = Boolean(
      imageState?.generating ||
      imageState?.preparingImage ||
      imageState?.stopButtonVisible ||
      imageState?.stopVisible ||
      imageState?.composerBusy ||
      imageState?.streamingIndicator
    );`,
'remove activeGeneration false-positive from image extract wait'
);

// Đổi log cho đúng nghĩa.
replaceText(
`text: \`Scene \${sceneId}: ChatGPT vẫn đang tạo ảnh; chưa extract keyframe.\`,`,
`text: \`Scene \${sceneId}: ChatGPT còn dấu hiệu đang tạo ảnh; chưa extract keyframe.\`,`,
'update busy wait log text'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: fixed false busy wait before image extract');
console.log('Backup:', backup);
