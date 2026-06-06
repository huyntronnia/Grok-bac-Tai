const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_accept_grok_imagine_normal_ready`;
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

// 1) Trong getGrokRouteStateScript: chấp nhận /imagine thường là ready nếu có composer/upload.
// Code cũ: else if (!isImagineAgent) route = hasNormalChatComposer || path === '/' ? 'normal_chat' : 'wrong_grok_route';
replaceAll(
  `else if (!isImagineAgent) route = hasNormalChatComposer || path === '/' ? 'normal_chat' : 'wrong_grok_route';`,
  `else if (!isImagineAgent && path === '/imagine' && (hasComposer || hasUploadTarget || hasGallery)) route = 'imagine_normal_ready';
  else if (!isImagineAgent) route = hasNormalChatComposer || path === '/' ? 'normal_chat' : 'wrong_grok_route';`,
  'accept normal /imagine as ready route'
);

// 2) Các guard/wait cũ chỉ nhận imagine_agent_ready, thêm imagine_normal_ready.
replaceAll(
  `state?.route === 'imagine_agent_ready'`,
  `(state?.route === 'imagine_agent_ready' || state?.route === 'imagine_normal_ready')`,
  'accept imagine_normal_ready in state checks'
);

replaceAll(
  `lastState?.route === 'imagine_agent_ready'`,
  `(lastState?.route === 'imagine_agent_ready' || lastState?.route === 'imagine_normal_ready')`,
  'accept imagine_normal_ready in lastState checks'
);

replaceAll(
  `route?.route === 'imagine_agent_ready'`,
  `(route?.route === 'imagine_agent_ready' || route?.route === 'imagine_normal_ready')`,
  'accept imagine_normal_ready in route checks'
);

// 3) Đổi message lỗi cho đúng, không còn Agent.
replaceAll(
  `Grok Imagine Agent UI was not ready.`,
  `Grok Imagine UI was not ready.`,
  'rename Grok Agent not-ready message'
);

replaceAll(
  `Grok Imagine Agent is not ready before image upload.`,
  `Grok Imagine is not ready before image upload.`,
  'rename Grok Agent upload message'
);

replaceAll(
  `Grok route is not Imagine Agent ready before`,
  `Grok route is not Imagine ready before`,
  'rename Grok Agent route guard message'
);

// 4) uploadFileViaCdp đang gọi ensureGrokImagineAgentPage/assertGrokImagineAgentReady.
// Không đổi tên hàm, chỉ đảm bảo hàm đã chấp nhận normal route ở trên.

// 5) Nếu route normal ready nhưng chưa bật Video, click Video/Image đúng composer thường.
if (!s.includes('async function forceGrokNormalImagineVideoMode')) {
  const helper = `
async function forceGrokNormalImagineVideoMode(page, sceneId = '') {
  const result = await evaluateOnCdpPage(page, \`
    (() => {
      const body = document.body;
      const out = { ok: true, actions: [], url: location.href };

      const visible = (node) => {
        const r = node.getBoundingClientRect?.();
        return r && r.width > 8 && r.height > 8 && r.bottom > 0 && r.right > 0;
      };

      const textOf = (node) =>
        String(node.innerText || node.textContent || node.getAttribute?.('aria-label') || node.title || '').replace(/\\\\s+/g, ' ').trim();

      const buttons = Array.from(document.querySelectorAll('button, [role="button"], a')).filter(visible);

      // Không chọn Agent Beta. Chọn Image trước nếu cần, rồi Video nếu có.
      const image = buttons.find((b) => /^image$/i.test(textOf(b)) || / image /i.test(' ' + textOf(b) + ' '));
      if (image && !/selected|active|true/i.test(String(image.getAttribute('aria-pressed') || image.getAttribute('data-state') || ''))) {
        image.click();
        out.actions.push('click-image');
      }

      const video = buttons.find((b) => /^video$/i.test(textOf(b)) || / video /i.test(' ' + textOf(b) + ' '));
      if (video) {
        video.click();
        out.actions.push('click-video');
      }

      return out;
    })()
  \`).catch((error) => ({ ok: false, error: error.message }));

  await appendAppLog(null, {
    source: 'main',
    kind: result?.ok ? 'ok' : 'error',
    text: \`Scene \${sceneId}: Grok normal /imagine video mode \${result?.ok ? 'ready' : 'failed'}\`,
    details: result,
  }).catch(() => null);

  return result;
}

`;
  replaceRegex(
    /async function ensureGrokImagineAgentPage/,
    `${helper}
async function ensureGrokImagineAgentPage`,
    'insert forceGrokNormalImagineVideoMode'
  );
} else {
  console.log('SKIP: forceGrokNormalImagineVideoMode already exists');
}

// 6) Gọi helper khi route ready.
if (!s.includes('forceGrokNormalImagineVideoMode(page, sceneId);')) {
  replaceRegex(
    /(await waitForGrokImagineReady\(page,\s*sceneId\)\s*;?)/,
    `$1
  await forceGrokNormalImagineVideoMode(page, sceneId);`,
    'call force normal imagine video mode after ready'
  );
} else {
  console.log('SKIP: force video mode call already exists');
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: normal /imagine route accepted');
console.log('Backup:', backup);
