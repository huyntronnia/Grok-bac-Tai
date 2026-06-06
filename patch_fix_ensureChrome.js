const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_ensureChrome`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

const from = `async function openFreshChatGptRootPage(reason = 'new-chat') {
  await ensureChrome();

  const created = await CDP.New({ url: 'https://chatgpt.com/' });`;

const to = `async function openFreshChatGptRootPage(reason = 'new-chat') {
  // Ensure Chrome/CDP is alive by using the project's existing helper.
  // Do not use the returned page for sending; it may be an old /c/... conversation.
  await getCdpPage('chatgpt', true, { bringToFront: false, recover: true }).catch((error) =>
    appendAppLog(null, {
      source: 'main',
      kind: 'running',
      text: \`ChatGPT new-chat bootstrap via getCdpPage failed/continued: \${error.message}\`,
    })
  );

  const created = await CDP.New({ url: 'https://chatgpt.com/' });`;

if (!s.includes(from)) {
  console.log('SKIP: Không tìm thấy đoạn ensureChrome cần thay.');
  console.log('Hãy gửi output Select-String ở cuối nếu bị SKIP.');
} else {
  s = s.replace(from, to);
  fs.writeFileSync(p, s, 'utf8');
  console.log('OK: replaced ensureChrome with getCdpPage bootstrap');
  console.log('Backup:', backup);
}
