const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_direct_patch_grok_navigate`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// Chèn guard ngay trước các Page.navigate({ url: 'https://grok.com/imagine' })
// Đây là chỗ chắc chắn đang gây loop trong log.
const guard = `
      {
        const __route =
          (typeof state !== 'undefined' && state?.route) ||
          (typeof route !== 'undefined' && route?.route) ||
          (typeof routeState !== 'undefined' && routeState?.route) ||
          (typeof lastState !== 'undefined' && lastState?.route) ||
          '';

        const __url =
          (typeof state !== 'undefined' && (state?.safeUrl || state?.url)) ||
          (typeof route !== 'undefined' && (route?.safeUrl || route?.url)) ||
          (typeof routeState !== 'undefined' && (routeState?.safeUrl || routeState?.url)) ||
          (typeof lastState !== 'undefined' && (lastState?.safeUrl || lastState?.url)) ||
          '';

        if (
          __route === 'imagine_agent_ready' ||
          __route === 'imagine_normal_ready' ||
          String(__url).startsWith('https://grok.com/imagine')
        ) {
          await appendAppLog(null, {
            source: 'main',
            kind: 'ok',
            text: \`grokRoute: already ready; skip navigate to /imagine. route=\${__route} url=\${__url}\`,
            details: { sceneId, route: __route, url: __url },
          }).catch(() => null);

          return (
            (typeof state !== 'undefined' && state) ||
            (typeof route !== 'undefined' && route) ||
            (typeof routeState !== 'undefined' && routeState) ||
            (typeof lastState !== 'undefined' && lastState) ||
            { ok: true, route: __route || 'imagine_agent_ready', url: __url || 'https://grok.com/imagine' }
          );
        }
      }

`;

// Bắt mọi navigate tới grok.com/imagine.
replaceRegex(
  /(\s*)await\s+page\.Page\.navigate\(\{\s*url:\s*'https:\/\/grok\.com\/imagine'\s*\}\);/g,
  `$1${guard}$1await page.Page.navigate({ url: 'https://grok.com/imagine' });`,
  'guard before page.Page.navigate grok imagine'
);

replaceRegex(
  /(\s*)await\s+client\.Page\.navigate\(\{\s*url:\s*'https:\/\/grok\.com\/imagine'\s*\}\);/g,
  `$1${guard}$1await client.Page.navigate({ url: 'https://grok.com/imagine' });`,
  'guard before client.Page.navigate grok imagine'
);

// Bắt cả dạng double quote nếu có.
replaceRegex(
  /(\s*)await\s+page\.Page\.navigate\(\{\s*url:\s*"https:\/\/grok\.com\/imagine"\s*\}\);/g,
  `$1${guard}$1await page.Page.navigate({ url: "https://grok.com/imagine" });`,
  'guard before page.Page.navigate grok imagine double quote'
);

replaceRegex(
  /(\s*)await\s+client\.Page\.navigate\(\{\s*url:\s*"https:\/\/grok\.com\/imagine"\s*\}\);/g,
  `$1${guard}$1await client.Page.navigate({ url: "https://grok.com/imagine" });`,
  'guard before client.Page.navigate grok imagine double quote'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: direct patched Grok imagine navigate loop');
console.log('Backup:', backup);
