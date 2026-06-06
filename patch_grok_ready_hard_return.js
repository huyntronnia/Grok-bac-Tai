const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_grok_ready_hard_return`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function findFunctionRange(src, fnName) {
  const start = src.indexOf(`async function ${fnName}`);
  if (start < 0) return null;

  const open = src.indexOf('{', start);
  if (open < 0) return null;

  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return { start, open, end: i + 1 };
    }
  }
  return null;
}

function patchFunction(fnName) {
  const range = findFunctionRange(s, fnName);
  if (!range) {
    console.log(`SKIP: function not found ${fnName}`);
    return false;
  }

  let body = s.slice(range.open + 1, range.end - 1);

  if (body.includes('grok-ready-hard-return-after-currentUrl')) {
    console.log(`SKIP: already patched ${fnName}`);
    return false;
  }

  const marker = 'grokRoute: currentUrl=';
  const markerIdx = body.indexOf(marker);
  if (markerIdx < 0) {
    console.log(`SKIP: currentUrl log not found in ${fnName}`);
    return false;
  }

  // Tìm cuối appendAppLog chứa "grokRoute: currentUrl=..."
  const appendStart = body.lastIndexOf('await appendAppLog', markerIdx);
  if (appendStart < 0) {
    console.log(`SKIP: appendAppLog start not found in ${fnName}`);
    return false;
  }

  const afterAppend = body.indexOf('});', markerIdx);
  if (afterAppend < 0) {
    console.log(`SKIP: appendAppLog end not found in ${fnName}`);
    return false;
  }

  const insertAt = afterAppend + '});'.length;

  const guard = `

    // grok-ready-hard-return-after-currentUrl
    {
      const readyRouteValue =
        state?.route ||
        route?.route ||
        routeState?.route ||
        lastState?.route ||
        '';

      const readyUrlValue =
        state?.safeUrl || state?.url ||
        route?.safeUrl || route?.url ||
        routeState?.safeUrl || routeState?.url ||
        lastState?.safeUrl || lastState?.url ||
        '';

      if (
        readyRouteValue === 'imagine_agent_ready' ||
        readyRouteValue === 'imagine_normal_ready' ||
        (String(readyUrlValue).startsWith('https://grok.com/imagine') && readyRouteValue !== 'normal_chat')
      ) {
        await appendAppLog(null, {
          source: 'main',
          kind: 'ok',
          text: \`grokRoute: ready accepted, stop navigating. route=\${readyRouteValue} url=\${readyUrlValue}\`,
          details: {
            sceneId,
            route: readyRouteValue,
            url: readyUrlValue,
            functionName: '${fnName}',
          },
        }).catch(() => null);

        return state || route || routeState || lastState || { ok: true, route: readyRouteValue, url: readyUrlValue };
      }
    }
`;

  body = body.slice(0, insertAt) + guard + body.slice(insertAt);

  s = s.slice(0, range.open + 1) + body + s.slice(range.end - 1);
  console.log(`OK: patched ${fnName}`);
  return true;
}

let patched = false;
patched = patchFunction('ensureGrokImagineAgentPage') || patched;
patched = patchFunction('waitForGrokImagineReady') || patched;
patched = patchFunction('ensureGrokImagineReady') || patched;

if (!patched) {
  console.log('FAIL: Không patch được hàm Grok ready.');
  console.log('Chạy Select-String bên dưới rồi gửi output.');
} else {
  fs.writeFileSync(p, s, 'utf8');
  console.log('DONE: inserted hard return when Grok route is ready');
  console.log('Backup:', backup);
}
