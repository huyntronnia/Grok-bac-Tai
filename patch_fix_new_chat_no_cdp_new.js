const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_new_chat_no_cdp_new`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

const rx = /async function openFreshChatGptRootPage\s*\(reason = 'new-chat'\)\s*\{[\s\S]*?\n\}\s*\n\s*async function assertChatGptNotExistingConversation/;

const replacement = `async function openFreshChatGptRootPage(reason = 'new-chat') {
  // Use the project's existing CDP recovery/open helper.
  // Do NOT call CDP.New directly because 127.0.0.1:9222 may be temporarily down/restarting.
  const page = await getCdpPage('chatgpt', true, { bringToFront: true, recover: true });

  await appendAppLog(null, {
    source: 'main',
    kind: 'running',
    text: \`ChatGPT new-chat mode: using recovered ChatGPT page for \${reason}, navigating to root before prompt.\`,
  });

  await page.Page.bringToFront().catch(() => null);

  // First try ChatGPT's own New Chat button if available.
  const clickedNewChat = await evaluateOnCdpPage(
    page,
    \`(\${clickChatGptStartNewChatScript.toString()})()\`
  ).catch((error) => ({ ok: false, error: error.message }));

  await appendAppLog(null, {
    source: 'main',
    kind: clickedNewChat?.ok ? 'ok' : 'running',
    text: \`ChatGPT new-chat mode: click New Chat result: \${clickedNewChat?.ok ? 'ok' : clickedNewChat?.error || 'not-clicked'}\`,
    details: clickedNewChat,
  });

  // Then force root URL. This prevents sending into an existing /c/... conversation.
  await page.Page.navigate({ url: 'https://chatgpt.com/' });
  await waitForCdpLoad(page).catch(() => null);
  await sleep(2500);

  const location = await evaluateOnCdpPage(page, 'location.href').catch(() => '');
  await appendAppLog(null, {
    source: 'main',
    kind: /\\/c\\//i.test(String(location)) ? 'error' : 'ok',
    text: \`ChatGPT new-chat mode: ready location=\${location}\`,
    details: { reason, location },
  });

  return page;
}

async function assertChatGptNotExistingConversation`;

if (!rx.test(s)) {
  console.log('FAIL: Không tìm thấy block openFreshChatGptRootPage để thay.');
  console.log('Hãy gửi output Select-String ở cuối.');
} else {
  s = s.replace(rx, replacement);
  fs.writeFileSync(p, s, 'utf8');
  console.log('OK: replaced openFreshChatGptRootPage without CDP.New');
  console.log('Backup:', backup);
}
