const fs = require('fs');
const path = 'electron/renderer.js';

let s = fs.readFileSync(path, 'utf8');
fs.copyFileSync(path, `${path}.bak_chat_choice`);

function mustReplace(from, to, label) {
  if (!s.includes(from)) {
    throw new Error(`Không tìm thấy đoạn cần sửa: ${label}`);
  }
  s = s.replace(from, to);
}

mustReplace(
`    chatContextTitle: projectNameInput.value.trim() || 'Untitled project',
    scenes,`,
`    chatContextTitle: '',
    chatResolveChoice: '',
    scenes,`,
'new project default chatContextTitle'
);

mustReplace(
`        chatContextTitle: project.chatContextTitle ?? project.name ?? projectNameInput?.value?.trim() ?? '',
        pendingChatRenameTitle: project.pendingChatRenameTitle || '',`,
`        chatContextTitle: project.chatContextTitle || '',
        pendingChatRenameTitle: project.pendingChatRenameTitle || '',`,
'runScenePipeline chatContextTitle fallback'
);

mustReplace(
`    project.chatContextTitle = '';
    project.pendingChatRenameTitle = targetTitle;`,
`    project.chatContextTitle = '';
    project.chatResolveChoice = 'new';
    project.pendingChatRenameTitle = targetTitle;`,
'chat resolve new choice'
);

mustReplace(
`    project.chatContextTitle = title;
    project.pendingChatRenameTitle = targetTitle;`,
`    project.chatContextTitle = title;
    project.chatResolveChoice = 'existing';
    project.pendingChatRenameTitle = targetTitle;`,
'chat resolve existing choice'
);

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
  mustReplace(
`async function runFullPipeline() {`,
`${helper}
async function runFullPipeline() {`,
'insert chat choice guard helper'
  );
}

mustReplace(
`  for (let i = 0; i < scenesToRun.length; i++) {
    const scene = scenesToRun[i];
    try {`,
`  for (let i = 0; i < scenesToRun.length; i++) {
    const scene = scenesToRun[i];
    if (requireChatGptChatChoiceBeforeRun(scene)) return;
    try {`,
'guard before scene pipeline starts'
);

fs.writeFileSync(path, s, 'utf8');
console.log('OK: patched electron/renderer.js');
console.log('Backup:', `${path}.bak_chat_choice`);
