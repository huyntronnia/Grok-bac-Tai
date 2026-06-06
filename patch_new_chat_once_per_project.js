const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_new_chat_once_per_project`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// Tìm chỗ tính useFreshNewChat hiện tại và đổi thành:
// - Scene đầu / lần đầu: mở new chat.
// - Các scene sau cùng project: dùng lại chat hiện tại, không navigate root nữa.
// - Vẫn bật no-sidebar-touch để không đụng lịch sử chat.
replaceRegex(
  /const useFreshNewChat\s*=\s*!String\(chatContextTitle \|\| ''\)\.trim\(\)\s*&&\s*String\(pendingChatRenameTitle \|\| ''\)\.trim\(\);\s*globalThis\.__vidoraChatGptNewChatMode = Boolean\(useFreshNewChat\);/,
  `const wantsFreshNewChat = !String(chatContextTitle || '').trim() && String(pendingChatRenameTitle || '').trim();

  const projectFreshChatKey = String(projectName || pendingChatRenameTitle || 'default-project').trim();
  const previousFreshChatKey = globalThis.__vidoraFreshChatCreatedForProject || '';

  const useFreshNewChat = Boolean(wantsFreshNewChat && previousFreshChatKey !== projectFreshChatKey);

  if (useFreshNewChat) {
    globalThis.__vidoraFreshChatCreatedForProject = projectFreshChatKey;
  }

  // Giữ flag này true khi user chọn New, kể cả scene sau, để recovery không đụng sidebar lịch sử.
  globalThis.__vidoraChatGptNewChatMode = Boolean(wantsFreshNewChat);

  if (wantsFreshNewChat && !useFreshNewChat) {
    await appendAppLog(null, {
      source: 'main',
      kind: 'running',
      text: \`ChatGPT new-chat mode: project already has a fresh chat; reuse current ChatGPT tab for scene \${sceneId}.\`,
      details: {
        sceneId,
        projectFreshChatKey,
        previousFreshChatKey,
      },
    }).catch(() => null);
  }`,
  'make ChatGPT new chat only once per project'
);

// Nếu có dòng set flag dạng khác thì vẫn chặn bớt.
replaceRegex(
  /globalThis\.__vidoraChatGptNewChatMode = Boolean\(useFreshNewChat\);/g,
  `globalThis.__vidoraChatGptNewChatMode = Boolean(wantsFreshNewChat || useFreshNewChat);`,
  'keep no-sidebar-touch for selected New mode'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: ChatGPT New chat will be created only once per project/session');
console.log('Backup:', backup);
