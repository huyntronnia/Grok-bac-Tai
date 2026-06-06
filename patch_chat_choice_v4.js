const fs = require('fs');
const path = 'electron/renderer.js';

let s = fs.readFileSync(path, 'utf8');

const backup = `${path}.bak_chat_choice_v4`;
if (!fs.existsSync(backup)) {
  fs.copyFileSync(path, backup);
}

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

function insertBeforeRunFullPipeline(code, label) {
  if (s.includes(code.split('\n')[1]?.trim() || label)) {
    console.log(`SKIP: ${label}`);
    return;
  }
  replaceRegex(/async function runFullPipeline\s*\(\)\s*\{/, `${code}\nasync function runFullPipeline() {`, label);
}

// 1) Gỡ helper cũ nếu có.
replaceRegex(
  /function ensureChatChoiceFields\s*\(\)\s*\{[\s\S]*?\n\}\s*\n/g,
  '',
  'remove old ensureChatChoiceFields'
);

replaceRegex(
  /function shouldAskChatGptChatChoice\s*\(scene\)\s*\{[\s\S]*?\n\}\s*\n\s*function requireChatGptChatChoiceBeforeRun\s*\(scene\)\s*\{[\s\S]*?\n\}\s*\n/g,
  '',
  'remove old chat choice helpers'
);

// 2) Chèn helper mới: dùng chatChoiceConfirmed, bỏ qua state cũ chatResolveChoice.
const helpers = `
function ensureChatChoiceFields() {
  if (!project) return;
  project.chatContextTitle = project.chatContextTitle || '';
  project.chatResolveChoice = project.chatResolveChoice || '';
  project.pendingChatRenameTitle = project.pendingChatRenameTitle || '';
  project.chatChoiceConfirmed = project.chatChoiceConfirmed === true;
}

function shouldAskChatGptChatChoice(scene) {
  if (!project || !scene) return false;
  ensureChatChoiceFields();

  // Chỉ bỏ qua hỏi nếu user đã chọn trong dialog mới.
  if (project.chatChoiceConfirmed === true) return false;

  const imageSettings = getImageGenerationSettings?.() || {};
  if (imageSettings.method === 'api') return false;

  const alreadyHasImage = Boolean(scene.imagePath || scene.imageDataUrl);
  if (alreadyHasImage && !scene.forceRegenerateImage) return false;

  return true;
}

function requireChatGptChatChoiceBeforeRun(scene) {
  if (!shouldAskChatGptChatChoice(scene)) return false;

  paused = true;
  isRunning = false;
  autoContinuing = false;

  if (scene && ['running', 'image_generating', 'keyframe_generating'].includes(scene.status)) {
    scene.status = scene.imagePath ? 'image_done' : 'approved';
  }

  openChatResolveDialog(scene, 'choose-chat-before-run');
  setStatus('Chọn cách dùng ChatGPT trước: tạo chat mới hoặc nhập tên chat cũ để tool vào rồi đổi tên.', 'error');
  persist();
  render();
  return true;
}
`;

insertBeforeRunFullPipeline(helpers, 'insert v4 chat choice helpers');

// 3) Đảm bảo đầu runFullPipeline có normalize.
if (!s.includes('ensureChatChoiceFields();\n  if (!project || !activeBatchIds.length) return;')) {
  replaceRegex(
    /async function runFullPipeline\s*\(\)\s*\{\s*if \(!project \|\| !activeBatchIds\.length\) return;/,
    `async function runFullPipeline() {
  ensureChatChoiceFields();
  if (!project || !activeBatchIds.length) return;`,
    'call ensureChatChoiceFields at runFullPipeline start'
  );
} else {
  console.log('OK: runFullPipeline already calls ensureChatChoiceFields');
}

// 4) Đảm bảo guard nằm trước try trong vòng scene.
if (!s.includes('if (requireChatGptChatChoiceBeforeRun(scene)) return;')) {
  replaceRegex(
    /(for\s*\(let i = 0; i < scenesToRun\.length; i\+\+\)\s*\{\s*const scene = scenesToRun\[i\];)/,
    `$1
    if (requireChatGptChatChoiceBeforeRun(scene)) return;`,
    'insert guard before scene run'
  );
} else {
  console.log('OK: guard already exists');
}

// 5) Khi chọn tạo chat mới, xác nhận user đã chọn.
if (!s.includes("project.chatChoiceConfirmed = true;")) {
  replaceRegex(
    /(project\.chatResolveChoice\s*=\s*'new';\s*)/,
    `$1
    project.chatChoiceConfirmed = true;`,
    'confirm new chat choice'
  );

  replaceRegex(
    /(project\.chatResolveChoice\s*=\s*'existing';\s*)/,
    `$1
    project.chatChoiceConfirmed = true;`,
    'confirm existing chat choice'
  );
} else {
  console.log('OK: chatChoiceConfirmed already exists');
}

// 6) Nếu project mới được tạo, reset lựa chọn chat.
replaceRegex(
  /(name:\s*projectNameInput\?\.value\?\.trim\(\)\s*\|\|\s*'Untitled project',[\s\S]*?scenes:\s*\[\],)/,
  `$1
    chatContextTitle: '',
    chatResolveChoice: '',
    chatChoiceConfirmed: false,
    pendingChatRenameTitle: '',`,
  'add/reset chat fields for new project'
);

// 7) Khi gửi pipeline sang main, tuyệt đối không fallback về project.name nữa.
replaceRegex(
  /chatContextTitle:\s*project\.chatContextTitle\s*\?\?\s*project\.name\s*\?\?\s*projectNameInput\?\.value\?\.trim\(\)\s*\?\?\s*''/g,
  `chatContextTitle: project.chatContextTitle || ''`,
  'remove nullish fallback chatContextTitle'
);

replaceRegex(
  /chatContextTitle:\s*project\.chatContextTitle\s*\|\|\s*project\.name\s*\|\|\s*projectNameInput\?\.value\?\.trim\(\)\s*\|\|\s*''/g,
  `chatContextTitle: project.chatContextTitle || ''`,
  'remove OR fallback chatContextTitle'
);

// 8) Chặn lỗi Object reference chain retry vô hạn: lỗi này phải pause, không retry mãi.
replaceRegex(
  /if\s*\(true\)\s*\{\s*setStatus\(`Scene \$\{scene\.id\}[^`]*\$\{message\}[^`]*`, 'running'\);[\s\S]*?i--;\s*continue;\s*\}/,
  `if (/Object reference chain is too long|Cannot find context with specified id|Execution context was destroyed|Target closed/i.test(message)) {
        scene.status = 'error';
        scene.progressStep = scene.imagePath ? 'motion' : 'image';
        paused = true;
        persist();
        render();
        setStatus(\`Scene \${scene.id} lỗi CDP/browser: \${message}. Đã dừng retry để tránh gửi lặp vào sai chat.\`, 'error');
        return;
      }`,
  'stop infinite retry for CDP object/reference errors'
);

// 9) Cập nhật dialog message.
replaceRegex(
  /chatResolveMessage\.textContent\s*=\s*`[^`]*`;/,
  "chatResolveMessage.textContent = `Chọn cách dùng ChatGPT cho project \"${project?.name || ''}\": tạo chat mới hoặc nhập tên đoạn chat cũ để tool vào rồi đổi tên.`;",
  'update chat dialog message'
);

fs.writeFileSync(path, s, 'utf8');
console.log('DONE: patched electron/renderer.js');
console.log('Backup:', backup);
