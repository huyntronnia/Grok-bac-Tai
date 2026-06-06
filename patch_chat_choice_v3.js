const fs = require('fs');
const path = 'electron/renderer.js';

let s = fs.readFileSync(path, 'utf8');

const backup = `${path}.bak_chat_choice_v3`;
if (!fs.existsSync(backup)) {
  fs.copyFileSync(path, backup);
}

function ok(label) {
  console.log(`OK: ${label}`);
}

function skip(label) {
  console.log(`SKIP: ${label}`);
}

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  if (s !== before) ok(label);
  else skip(label);
}

// 1) Đảm bảo project cũ/project mới có field lựa chọn chat.
if (!s.includes('function ensureChatChoiceFields')) {
  const helper = `
function ensureChatChoiceFields() {
  if (!project) return;
  project.chatContextTitle = project.chatContextTitle || '';
  project.chatResolveChoice = project.chatResolveChoice || '';
  project.pendingChatRenameTitle = project.pendingChatRenameTitle || '';
}

`;
  replaceRegex(
    /async function runFullPipeline\s*\(\)\s*\{/,
    `${helper}async function runFullPipeline() {`,
    'insert ensureChatChoiceFields'
  );
} else {
  skip('ensureChatChoiceFields already exists');
}

// 2) Thêm helper hỏi lựa chọn chat nếu v2 chưa thêm hoặc đã thêm thì bỏ qua.
if (!s.includes('function shouldAskChatGptChatChoice(scene)')) {
  const helper = `
function shouldAskChatGptChatChoice(scene) {
  if (!project || !scene) return false;
  ensureChatChoiceFields();

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
  replaceRegex(
    /async function runFullPipeline\s*\(\)\s*\{/,
    `${helper}async function runFullPipeline() {`,
    'insert chat choice helper'
  );
} else {
  ok('chat choice helper already exists');
}

// 3) Gọi normalize ngay đầu runFullPipeline.
if (!s.includes('ensureChatChoiceFields();\n  if (!project || !activeBatchIds.length) return;')) {
  replaceRegex(
    /async function runFullPipeline\s*\(\)\s*\{\s*if \(!project \|\| !activeBatchIds\.length\) return;/,
    `async function runFullPipeline() {
  ensureChatChoiceFields();
  if (!project || !activeBatchIds.length) return;`,
    'call ensureChatChoiceFields at runFullPipeline start'
  );
} else {
  skip('ensureChatChoiceFields already called in runFullPipeline');
}

// 4) Chặn trước khi mỗi scene gọi runScenePipeline.
if (!s.includes('if (requireChatGptChatChoiceBeforeRun(scene)) return;')) {
  replaceRegex(
    /(for\s*\(let i = 0; i < scenesToRun\.length; i\+\+\)\s*\{\s*const scene = scenesToRun\[i\];)/,
    `$1
    if (requireChatGptChatChoiceBeforeRun(scene)) return;`,
    'insert guard before each scene run'
  );
} else {
  ok('guard already exists');
}

// 5) Khi chọn tạo mới, lưu chatResolveChoice = new.
if (!s.includes("project.chatResolveChoice = 'new';")) {
  replaceRegex(
    /(if\s*\(mode === 'new'\)\s*\{[\s\S]*?project\.chatContextTitle\s*=\s*'';\s*)project\.pendingChatRenameTitle\s*=\s*targetTitle;/,
    `$1project.chatResolveChoice = 'new';
    project.pendingChatRenameTitle = targetTitle;`,
    'remember new chat choice'
  );
} else {
  ok('new chat choice already remembered');
}

// 6) Khi chọn chat cũ/rename, lưu chatResolveChoice = existing.
if (!s.includes("project.chatResolveChoice = 'existing';")) {
  replaceRegex(
    /(project\.chatContextTitle\s*=\s*title;\s*)project\.pendingChatRenameTitle\s*=\s*targetTitle;/,
    `$1project.chatResolveChoice = 'existing';
    project.pendingChatRenameTitle = targetTitle;`,
    'remember existing chat choice'
  );
} else {
  ok('existing chat choice already remembered');
}

// 7) Bỏ fallback project.name/projectNameInput ở payload gửi main.
// Nếu còn fallback này thì tool vẫn tự nhảy theo tên project.
replaceRegex(
  /chatContextTitle:\s*project\.chatContextTitle\s*\?\?\s*project\.name\s*\?\?\s*projectNameInput\?\.value\?\.trim\(\)\s*\?\?\s*''/g,
  `chatContextTitle: project.chatContextTitle || ''`,
  'remove project.name fallback from nullish chatContextTitle'
);

replaceRegex(
  /chatContextTitle:\s*project\.chatContextTitle\s*\|\|\s*project\.name\s*\|\|\s*projectNameInput\?\.value\?\.trim\(\)\s*\|\|\s*''/g,
  `chatContextTitle: project.chatContextTitle || ''`,
  'remove project.name fallback from or chatContextTitle'
);

// 8) Cập nhật message dialog cho đúng: không phải chỉ "không tìm thấy", mà là hỏi trước.
replaceRegex(
  /chatResolveMessage\.textContent\s*=\s*`[^`]*Chọn[^`]*tiếp tục\.`;/,
  "chatResolveMessage.textContent = `Chọn cách dùng ChatGPT cho project \"${project?.name || ''}\": tạo chat mới hoặc nhập tên đoạn chat cũ để tool vào rồi đổi tên.`;",
  'update chat dialog message'
);

fs.writeFileSync(path, s, 'utf8');

console.log('DONE: patched electron/renderer.js');
console.log('Backup:', backup);
