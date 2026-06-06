const fs = require('fs');
const path = 'electron/renderer.js';

let s = fs.readFileSync(path, 'utf8');
const backup = `${path}.bak_chat_choice_v2`;
if (!fs.existsSync(backup)) fs.copyFileSync(path, backup);

function replaceOnce(from, to, label) {
  if (!s.includes(from)) {
    console.log(`SKIP: ${label}`);
    return false;
  }
  s = s.replace(from, to);
  console.log(`OK: ${label}`);
  return true;
}

function replaceRegex(rx, to, label) {
  if (!rx.test(s)) {
    console.log(`SKIP: ${label}`);
    return false;
  }
  s = s.replace(rx, to);
  console.log(`OK: ${label}`);
  return true;
}

// 1) Thêm field chatResolveChoice cho project mới.
// Code hiện tại createBlankProjectFromName chưa có chatContextTitle nên không replace dòng cũ nữa.
replaceOnce(
`    scenes: [],
    batchSize: clamp(Number(batchSizeInput?.value) || 10, 1, 10),`,
`    scenes: [],
    chatContextTitle: '',
    chatResolveChoice: '',
    pendingChatRenameTitle: '',
    batchSize: clamp(Number(batchSizeInput?.value) || 10, 1, 10),`,
'add chat fields to createBlankProjectFromName'
);

// 2) Khi chạy scene, đừng fallback chatContextTitle về project.name nữa.
// Vì fallback này làm tool tự nhảy vào chat theo tên project.
replaceOnce(
`        chatContextTitle: project.chatContextTitle ?? project.name ?? projectNameInput?.value?.trim() ?? '',
        pendingChatRenameTitle: project.pendingChatRenameTitle || '',`,
`        chatContextTitle: project.chatContextTitle || '',
        pendingChatRenameTitle: project.pendingChatRenameTitle || '',`,
'remove project.name fallback from chatContextTitle'
);

// 3) Lưu lựa chọn của user: tạo mới hoặc dùng chat cũ.
replaceOnce(
`    project.chatContextTitle = '';
    project.pendingChatRenameTitle = targetTitle;`,
`    project.chatContextTitle = '';
    project.chatResolveChoice = 'new';
    project.pendingChatRenameTitle = targetTitle;`,
'remember option new chat'
);

replaceOnce(
`    project.chatContextTitle = title;
    project.pendingChatRenameTitle = targetTitle;`,
`    project.chatContextTitle = title;
    project.chatResolveChoice = 'existing';
    project.pendingChatRenameTitle = targetTitle;`,
'remember option existing chat'
);

// 4) Helper ép hỏi trước khi pipeline gọi ChatGPT lần đầu.
const helper = `
function shouldAskChatGptChatChoice(scene) {
  if (!project || !scene) return false;
  if (project.chatResolveChoice === 'new' || project.chatResolveChoice === 'existing') return false;

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
  setStatus('Chọn cách dùng ChatGPT trước: tạo chat mới hoặc nhập tên chat cũ để tool vào và đổi tên.', 'error');
  persist();
  render();
  return true;
}

`;

if (!s.includes('function shouldAskChatGptChatChoice(scene)')) {
  replaceOnce(
`async function runFullPipeline() {`,
`${helper}
async function runFullPipeline() {`,
'insert chat choice helper before runFullPipeline'
  );
} else {
  console.log('SKIP: helper already exists');
}

// 5) Chặn trước vòng chạy scene.
replaceOnce(
`  for (let i = 0; i < scenesToRun.length; i++) {
    const scene = scenesToRun[i];
    try {`,
`  for (let i = 0; i < scenesToRun.length; i++) {
    const scene = scenesToRun[i];
    if (requireChatGptChatChoiceBeforeRun(scene)) return;
    try {`,
'guard before each scene run'
);

// Nếu đã có project cũ không có field này, normalize khi chạy.
replaceOnce(
`  const scenesToRun = project.scenes.filter((scene) => shouldRunScene(scene));`,
`  project.chatContextTitle = project.chatContextTitle || '';
  project.chatResolveChoice = project.chatResolveChoice || '';
  project.pendingChatRenameTitle = project.pendingChatRenameTitle || '';

  const scenesToRun = project.scenes.filter((scene) => shouldRunScene(scene));`,
'normalize old project chat fields'
);

fs.writeFileSync(path, s, 'utf8');
console.log('DONE: patched electron/renderer.js');
console.log('Backup:', backup);
