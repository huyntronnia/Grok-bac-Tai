const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_stop_grok_navigate_when_ready`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

const marker = 'grok-stop-navigate-when-ready';

if (s.includes(marker)) {
  console.log('SKIP: already patched');
  process.exit(0);
}

const needle = 'grokRoute: navigating to https://grok.com/imagine';
let idx = s.indexOf(needle);
let patched = 0;

while (idx >= 0) {
  const appendStart = s.lastIndexOf('await appendAppLog', idx);

  if (appendStart < 0) {
    console.log('WARN: appendAppLog not found before marker at', idx);
    idx = s.indexOf(needle, idx + needle.length);
    continue;
  }

  const guard = `
    // ${marker}
    {
      const __grokReadyState =
        (typeof state !== 'undefined' && state) ||
        (typeof route !== 'undefined' && route) ||
        (typeof routeState !== 'undefined' && routeState) ||
        (typeof lastState !== 'undefined' && lastState) ||
        null;

      const __grokReadyRoute = String(__grokReadyState?.route || '');
      const __grokReadyUrl = String(__grokReadyState?.safeUrl || __grokReadyState?.url || '');

      if (
        __grokReadyRoute === 'imagine_agent_ready' ||
        __grokReadyRoute === 'imagine_normal_ready' ||
        (__grokReadyUrl.startsWith('https://grok.com/imagine') && __grokReadyRoute !== 'normal_chat')
      ) {
        await appendAppLog(null, {
          source: 'main',
          kind: 'ok',
          text: \`grokRoute: ready accepted before navigate. route=\${__grokReadyRoute} url=\${__grokReadyUrl}\`,
          details: { sceneId, route: __grokReadyRoute, url: __grokReadyUrl },
        }).catch(() => null);

        return __grokReadyState || { ok: true, route: __grokReadyRoute || 'imagine_agent_ready', url: __grokReadyUrl || 'https://grok.com/imagine' };
      }
    }

`;

  s = s.slice(0, appendStart) + guard + s.slice(appendStart);
  patched++;

  idx = s.indexOf(needle, appendStart + guard.length + needle.length);
}

if (!patched) {
  console.log('FAIL: Không tìm thấy marker grokRoute navigating.');
} else {
  fs.writeFileSync(p, s, 'utf8');
  console.log(`OK: inserted ready guard before Grok navigate (${patched})`);
  console.log('Backup:', backup);
}
