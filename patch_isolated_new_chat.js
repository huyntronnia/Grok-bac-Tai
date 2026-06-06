const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_new_chat_isolated_tab`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function insertBefore(marker, code, label) {
  if (s.includes(code.split('\n')[1]?.trim() || label)) {
    console.log(`SKIP: ${label}`);
    return;
  }
  const idx = s.indexOf(marker);
  if (idx < 0) {
    console.log(`SKIP: marker not found for ${label}`);
    return;
  }
  s = s.slice(0, idx) + code + '\n' + s.slice(idx);
  console.log(`OK: ${label}`);
}

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// Helper: mở một target/tab ChatGPT root hoàn toàn mới bằng CDP.
// Không dùng tab /c/... đang mở nữa.
const helper = `
async function openFreshChatGptRootPage(reason = 'new-chat') {
  await ensureChrome();

  const created = await CDP.New({ url: 'https://chatgpt.com/' });
  const targetId = created && (created.id || created.targetId);

  let client = null;
  if (targetId) {
    client = await CDP({ target: targetId });
  } else {
    client = await CDP();
  }

  await client.Page.enable().catch(() => null);
  await client.Runtime.enable().catch(() => null);
  await client.Page.bringToFront().catch(() => null);
  await waitForCdpLoad(client).catch(() => null);
  await sleep(2500);

  const location = await evaluateOnCdpPage(client, 'location.href').catch(() => '');
  await appendAppLog(null, {
    source: 'main',
    kind: /chatgpt\\.com\\/?(\\?|#)?$/i.test(String(location)) || !/\\/c\\//i.test(String(location)) ? 'ok' : 'error',
    text: \`ChatGPT new-chat target opened for \${reason}: \${location}\`,
    details: { reason, location, targetId },
  });

  return client;
}

async function assertChatGptNotExistingConversation(client, sceneId = '') {
  const location = await evaluateOnCdpPage(client, 'location.href').catch(() => '');
  if (/chatgpt\\.com\\/c\\//i.test(String(location))) {
    throw new Error(
      \`Đã chọn tạo chat mới nhưng ChatGPT vẫn đang ở conversation cũ: \${location}. Đã chặn gửi prompt/rename để không phá đoạn chat hiện tại.\`
    );
  }
  return location;
}

`;

insertBefore('async function generateImageWithImageApi', helper, 'insert isolated new ChatGPT target helpers');

// Thay đoạn lấy page trong generateImageAndMotionWithChatGPT.
// Bắt pattern đủ mềm: const page = await getCdpPage('chatgpt', true);
replaceRegex(
  /async function generateImageAndMotionWithChatGPT\s*\(\s*\{([\s\S]*?)\}\s*\)\s*\{([\s\S]*?)const page = await getCdpPage\('chatgpt', true\);/,
  `async function generateImageAndMotionWithChatGPT({$1}) {
$2const useFreshNewChat = !String(chatContextTitle || '').trim() && String(pendingChatRenameTitle || '').trim();
  const page = useFreshNewChat
    ? await openFreshChatGptRootPage(\`scene-\${sceneId}-image-new-chat\`)
    : await getCdpPage('chatgpt', true);

  if (useFreshNewChat) {
    await assertChatGptNotExistingConversation(page, sceneId);
  }`,
  'use isolated tab for ChatGPT image new-chat mode'
);

// Nếu sau đó code vẫn có block navigate/click root từ patch cũ thì không sao, nhưng thêm guard ngay trước gửi prompt.
replaceRegex(
  /(const beforeCount\s*=\s*await evaluateOnCdpPage\(page,\s*`\(\$\{countAssistantMessagesScript\.toString\(\)\}\)\(\)`\);)/,
  `if (!String(chatContextTitle || '').trim() && String(pendingChatRenameTitle || '').trim()) {
    await assertChatGptNotExistingConversation(page, sceneId);
  }

  $1`,
  'guard before ChatGPT image prompt send'
);

// Chặn rename nếu còn ở /c/... trong new mode.
replaceRegex(
  /(if\s*\(pendingChatRenameTitle\?\.trim\(\)\)\s*\{)/,
  `if (!String(chatContextTitle || '').trim() && String(pendingChatRenameTitle || '').trim()) {
    await assertChatGptNotExistingConversation(page, sceneId);
  }

  $1`,
  'guard before ChatGPT rename'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: patched electron/main.js');
console.log('Backup:', backup);
