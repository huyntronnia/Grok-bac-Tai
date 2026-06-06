const fs = require('fs');

const mainPath = 'electron/main.js';
let s = fs.readFileSync(mainPath, 'utf8');

const backup = `${mainPath}.bak_force_new_chat`;
if (!fs.existsSync(backup)) fs.copyFileSync(mainPath, backup);

function replaceOnce(from, to, label) {
  if (!s.includes(from)) {
    console.log(`SKIP: ${label}`);
    return false;
  }
  s = s.replace(from, to);
  console.log(`OK: ${label}`);
  return true;
}

// Chặn lỗi chính:
// Nếu user chọn "tạo chat mới" => chatContextTitle rỗng + pendingChatRenameTitle có giá trị.
// Trước đây app vẫn dùng tab /c/... hiện tại, nên gửi prompt và rename nhầm chat đang mở.
// Patch này ép ChatGPT về trang root https://chatgpt.com/ trước khi gửi prompt.
replaceOnce(
`  if (chatContextTitle?.trim()) {
    const selectedChat = await selectChatGptConversationByTitle(page, chatContextTitle.trim());`,
`  if (!chatContextTitle?.trim() && pendingChatRenameTitle?.trim()) {
    await appendAppLog(null, {
      source: 'main',
      kind: 'running',
      text: \`PIPELINE Scene \${sceneId}: Option new chat selected. Force opening ChatGPT root before sending prompt. targetRename="\${pendingChatRenameTitle.trim()}"\`,
    });

    await invalidateChatGptConversationIdentity('force-new-chat-before-prompt').catch(() => null);

    const clickedNewChat = await evaluateOnCdpPage(
      page,
      \`(\${clickChatGptStartNewChatScript.toString()})()\`
    ).catch((error) => ({ ok: false, error: error.message }));

    await appendAppLog(null, {
      source: 'main',
      kind: clickedNewChat?.ok ? 'ok' : 'error',
      text: \`PIPELINE Scene \${sceneId}: click New Chat before prompt \${clickedNewChat?.ok ? 'ok' : clickedNewChat?.error || 'failed'}\`,
      details: clickedNewChat,
    });

    await page.Page.navigate({ url: 'https://chatgpt.com/' }).catch((error) =>
      appendAppLog(null, {
        source: 'main',
        kind: 'error',
        text: \`PIPELINE Scene \${sceneId}: navigate ChatGPT root failed: \${error.message}\`,
      })
    );

    await waitForCdpLoad(page).catch(() => null);
    await sleep(2200);
  }

  if (chatContextTitle?.trim()) {
    const selectedChat = await selectChatGptConversationByTitle(page, chatContextTitle.trim());`,
'force new chat when pending rename has no chatContextTitle'
);

fs.writeFileSync(mainPath, s, 'utf8');

console.log('DONE: patched electron/main.js');
console.log('Backup:', backup);
