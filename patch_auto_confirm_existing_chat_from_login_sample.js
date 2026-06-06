const fs = require('fs');

const p = 'electron/renderer.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_auto_confirm_existing_chat_from_login_sample`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

if (s.includes('VIDORA_AUTO_CONFIRM_EXISTING_CHAT_FROM_LOGIN_SAMPLE')) {
  console.log('SKIP: patch already exists');
  process.exit(0);
}

const needle = "const chatgptState = await waitForProviderReady('chatgpt', 'ChatGPT');";
const idx = s.indexOf(needle);

if (idx < 0) {
  console.error('FAIL: không tìm thấy dòng chatgptState waitForProviderReady');
  process.exit(1);
}

const insertAt = idx + needle.length;

const code = `

// VIDORA_AUTO_CONFIRM_EXISTING_CHAT_FROM_LOGIN_SAMPLE
    {
      const norm = (v) => String(v || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/\\s+/g, ' ');

      const projectTitle =
        String(project?.name || project?.projectName || projectNameInput?.value || projectTitleInput?.value || '').trim();

      const visibleChatText = [
        chatgptState?.title,
        chatgptState?.url,
        chatgptState?.sampleText,
      ].map(v => String(v || '')).join('\\n');

      if (
        project &&
        projectTitle &&
        !project.chatChoiceConfirmed &&
        norm(visibleChatText).includes(norm(projectTitle))
      ) {
        project.chatChoiceConfirmed = true;
        project.chatContextTitle = projectTitle;
        project.pendingChatRenameTitle = '';
        project.forceFreshChat = false;

        safeAddPipelineLog?.(
          'renderer',
          'ok',
          \`ChatGPT existing chat auto-confirmed from sidebar/login sample: "\${projectTitle}".\`,
          {
            projectTitle,
            chatgptTitle: chatgptState?.title || '',
            chatgptUrl: chatgptState?.url || '',
          }
        );

        persist?.();
        render?.();
      }
    }
`;

s = s.slice(0, insertAt) + code + s.slice(insertAt);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: renderer auto-confirm existing chat from ChatGPT sampleText');
console.log('Backup:', backup);
