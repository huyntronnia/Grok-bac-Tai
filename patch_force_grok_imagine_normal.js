const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_force_grok_imagine_normal`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceAll(from, to, label) {
  const count = s.split(from).length - 1;
  if (!count) {
    console.log(`SKIP: ${label}`);
    return;
  }
  s = s.split(from).join(to);
  console.log(`OK: ${label} (${count})`);
}

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// 1) Không vào Agent nữa. Ép mọi route /imagine/agent về /imagine.
replaceAll(
  `https://grok.com/imagine/agent`,
  `https://grok.com/imagine`,
  'replace Grok agent URL with normal imagine URL'
);

// 2) Nếu có check Agent URL thì coi như false để không kích hoạt canvas logic.
replaceRegex(
  /function isGrokImagineAgentUrl\s*\(value = ''\)\s*\{[\s\S]*?\n\}/,
  `function isGrokImagineAgentUrl(value = '') {
  return false;
}`,
  'disable isGrokImagineAgentUrl'
);

// 3) Thêm helper ép chọn mode thường: Image/Video, không Agent Beta.
const helper = `
async function forceGrokNormalImagineMode(page, sceneId = '') {
  await page.Page.bringToFront().catch(() => null);

  const result = await evaluateOnCdpPage(page, \`
    (() => {
      const out = { ok: true, url: location.href, actions: [] };

      // Nếu đang lỡ ở Agent canvas, quay về Imagine thường.
      if (location.pathname.startsWith('/imagine/agent')) {
        history.pushState(null, '', '/imagine');
        location.href = 'https://grok.com/imagine';
        out.actions.push('redirect-agent-to-imagine');
        return out;
      }

      const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'));

      function textOf(el) {
        return String(el.innerText || el.textContent || el.getAttribute('aria-label') || el.title || '').trim();
      }

      // Tắt Agent/Beta nếu đang active bằng cách chọn Image trước.
      const imageBtn = buttons.find((el) => /^image$/i.test(textOf(el)) || /\\bimage\\b/i.test(textOf(el)));
      if (imageBtn) {
        imageBtn.click();
        out.actions.push('click-image-mode');
      }

      // Nếu có Video button thì click video vì bước Grok là image-to-video.
      const videoBtn = buttons.find((el) => /^video$/i.test(textOf(el)) || /\\bvideo\\b/i.test(textOf(el)));
      if (videoBtn) {
        videoBtn.click();
        out.actions.push('click-video-mode');
      }

      // Không click Agent Beta / Agent.
      out.body = String(document.body?.innerText || '').slice(0, 1000);
      return out;
    })()
  \`).catch((error) => ({ ok: false, error: error.message }));

  await appendAppLog(null, {
    source: 'main',
    kind: result?.ok ? 'ok' : 'error',
    text: \`Scene \${sceneId}: Grok normal Imagine mode \${result?.ok ? 'ready' : 'failed'}\`,
    details: result,
  }).catch(() => null);

  return result;
}

`;

if (!s.includes('async function forceGrokNormalImagineMode')) {
  replaceRegex(
    /async function ensureGrokEmptyCanvas/,
    `${helper}
async function ensureGrokEmptyCanvas`,
    'insert forceGrokNormalImagineMode helper'
  );
} else {
  console.log('SKIP: forceGrokNormalImagineMode already exists');
}

// 4) Sau khi Grok load ready thì gọi helper ép normal imagine mode.
if (!s.includes('forceGrokNormalImagineMode(page, sceneId)')) {
  replaceRegex(
    /(await waitForGrokImagineReady\(page,\s*sceneId\)\s*;?)/,
    `$1
  await forceGrokNormalImagineMode(page, sceneId);`,
    'call force normal imagine after Grok ready'
  );
} else {
  console.log('SKIP: force normal imagine call already exists');
}

// 5) Chặn tuyệt đối gửi prompt nếu đang ở /imagine/agent.
if (!s.includes('Grok đang ở Agent mode; đã chặn gửi prompt')) {
  replaceRegex(
    /(async function generateVideoWithGenericProvider\s*\([\s\S]*?\)\s*\{)/,
    `$1
  if (provider === 'grok') {
    const routeGuard = await evaluateOnCdpPage(await getCdpPage('grok', true), "({ url: location.href, path: location.pathname })").catch(() => null);
    if (routeGuard?.path?.startsWith('/imagine/agent')) {
      throw new Error('Grok đang ở Agent mode; đã chặn gửi prompt. Tool phải dùng grok.com/imagine thường.');
    }
  }`,
    'guard against Grok agent mode before video generation'
  );
} else {
  console.log('SKIP: Grok agent mode guard already exists');
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: forced Grok normal /imagine mode, disabled Agent mode');
console.log('Backup:', backup);
