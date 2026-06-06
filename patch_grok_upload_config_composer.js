const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_grok_upload_config_composer`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

function replaceAll(from, to, label) {
  const count = s.split(from).length - 1;
  if (!count) {
    console.log(`SKIP: ${label}`);
    return;
  }
  s = s.split(from).join(to);
  console.log(`OK: ${label} (${count})`);
}

// 1) Tắt rename/title canvas vì nó đang click nhầm template như Professional Headshot.
replaceRegex(
  /await\s+renameGrokCanvasTitle\([\s\S]*?\)\.catch\([\s\S]*?\);/g,
  `await appendAppLog(null, {
    source: 'main',
    kind: 'running',
    text: 'Grok rename/title skipped: avoid clicking templates on /imagine.',
    details: { sceneId }
  }).catch(() => null);`,
  'disable Grok canvas rename/title calls'
);

replaceRegex(
  /await\s+setGrokCanvasTitle\([\s\S]*?\)\.catch\([\s\S]*?\);/g,
  `await appendAppLog(null, {
    source: 'main',
    kind: 'running',
    text: 'Grok canvas title skipped: avoid clicking templates on /imagine.',
    details: { sceneId }
  }).catch(() => null);`,
  'disable Grok set title calls'
);

// 2) Helper upload đúng ảnh vào composer + ép config.
const helper = `
async function forceGrokComposerImageUploadAndConfig(page, imagePath, sceneId = '') {
  await page.Page.bringToFront().catch(() => null);

  const before = await evaluateOnCdpPage(page, \`
    (() => {
      return {
        url: location.href,
        text: String(document.body?.innerText || '').slice(0, 1200),
        fileInputs: document.querySelectorAll('input[type="file"]').length,
        textboxes: document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]').length,
      };
    })()
  \`).catch((error) => ({ ok: false, error: error.message }));

  await appendAppLog(null, {
    source: 'main',
    kind: 'running',
    text: \`Scene \${sceneId}: Grok prepare composer upload/config start\`,
    details: before,
  }).catch(() => null);

  // Đưa ảnh vào file input của composer, không click workspace/gallery/template.
  const uploadResult = await uploadFileViaCdp(page, imagePath, 'grok', {
    sceneId,
    skipRouteCheck: true,
    preferComposerInput: true,
    noWorkspaceClick: true,
  }).catch((error) => ({ ok: false, error: error.message }));

  await appendAppLog(null, {
    source: 'main',
    kind: uploadResult?.ok ? 'ok' : 'error',
    text: \`Scene \${sceneId}: Grok composer image upload \${uploadResult?.ok ? 'ok' : 'failed'}\`,
    details: uploadResult,
  }).catch(() => null);

  if (!uploadResult?.ok) {
    throw new Error(\`Grok upload ảnh vào composer thất bại: \${uploadResult?.error || 'unknown'}\`);
  }

  // Ép mode/config sau khi upload: Video, 720p, 10s, 16:9.
  const configResult = await evaluateOnCdpPage(page, \`
    (() => {
      const out = { ok: true, actions: [] };

      const visible = (el) => {
        const r = el.getBoundingClientRect?.();
        return r && r.width > 8 && r.height > 8 && r.bottom > 0 && r.right > 0;
      };

      const textOf = (el) =>
        String(el.innerText || el.textContent || el.getAttribute?.('aria-label') || el.title || '')
          .replace(/\\\\s+/g, ' ')
          .trim();

      const controls = Array.from(document.querySelectorAll('button, [role="button"], a')).filter(visible);

      function clickByText(pattern, label) {
        const found = controls.find((el) => pattern.test(textOf(el)));
        if (found) {
          found.click();
          out.actions.push({ action: label, text: textOf(found) });
          return true;
        }
        out.actions.push({ action: label, missing: true });
        return false;
      }

      // Không bấm Agent Beta, không bấm template cards.
      clickByText(/^Video$/i, 'click-video');
      clickByText(/^720p$/i, 'click-720p');
      clickByText(/^10s$/i, 'click-10s');

      // Aspect ratio dropdown/chip 16:9 nếu có, nếu không thì bỏ qua.
      clickByText(/^16:9$/i, 'click-16x9');

      const composer =
        document.querySelector('[contenteditable="true"]') ||
        document.querySelector('[role="textbox"]') ||
        document.querySelector('textarea');

      const composerText = String(composer?.innerText || composer?.value || composer?.textContent || '');
      const imgs = Array.from(document.querySelectorAll('img')).map((img) => {
        const r = img.getBoundingClientRect();
        return {
          w: Math.round(r.width),
          h: Math.round(r.height),
          top: Math.round(r.top),
          left: Math.round(r.left),
          src: String(img.src || '').slice(0, 120),
        };
      }).filter((x) => x.w > 20 && x.h > 20);

      out.composerTextHead = composerText.slice(0, 300);
      out.imageCount = imgs.length;
      out.images = imgs.slice(-10);
      out.bodyHead = String(document.body?.innerText || '').slice(0, 1200);
      return out;
    })()
  \`).catch((error) => ({ ok: false, error: error.message }));

  await appendAppLog(null, {
    source: 'main',
    kind: configResult?.ok ? 'ok' : 'error',
    text: \`Scene \${sceneId}: Grok forced Video/720p/10s config \${configResult?.ok ? 'ok' : 'failed'}\`,
    details: configResult,
  }).catch(() => null);

  return { ok: true, uploadResult, configResult };
}

`;

if (!s.includes('async function forceGrokComposerImageUploadAndConfig')) {
  replaceRegex(
    /async function generateVideoWithGenericProvider/,
    `${helper}
async function generateVideoWithGenericProvider`,
    'insert force Grok composer upload/config helper'
  );
} else {
  console.log('SKIP: forceGrokComposerImageUploadAndConfig already exists');
}

// 3) Thay nhánh upload kiểu workspace/clipboard bằng helper mới.
// Bắt log cũ "Grok: copy ảnh vào clipboard..." để chặn đường sai.
replaceRegex(
  /await appendAppLog\(null,\s*\{\s*source:\s*'main',\s*kind:\s*'running',\s*text:\s*'Grok: copy ảnh vào clipboard, click workspace Empty Canvas rồi Ctrl\+V trực tiếp\.'[\s\S]*?\}\);[\s\S]*?const uploadResult\s*=\s*await[\s\S]*?;/,
  `const forcedUpload = await forceGrokComposerImageUploadAndConfig(page, imagePath, sceneId);
  const uploadResult = forcedUpload.uploadResult;`,
  'replace old Grok workspace/clipboard upload with composer upload'
);

// 4) Nếu không match block trên, thêm guard ngay trước log cũ để lỗi rõ.
if (!s.includes('Grok old workspace upload path blocked')) {
  replaceAll(
    `text: 'Grok: copy ảnh vào clipboard, click workspace Empty Canvas rồi Ctrl+V trực tiếp.'`,
    `text: 'Grok old workspace upload path blocked: use composer file input instead.'`,
    'rename old workspace upload log if still present'
  );
}

// 5) Không cho config bị skip kiểu already-prepared-before-upload.
replaceAll(
  `status:"already-prepared-before-upload"`,
  `status:"force-config-after-upload"`,
  'replace compact already-prepared status'
);

replaceAll(
  `status: 'already-prepared-before-upload'`,
  `status: 'force-config-after-upload'`,
  'replace already-prepared status'
);

replaceAll(
  `status:"already-prepared-before-upload"`,
  `status:"force-config-after-upload"`,
  'replace remaining already-prepared status'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: Grok upload image into composer + force config');
console.log('Backup:', backup);
