const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_reduce_cdp_log_spam`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

if (!s.includes('function vidoraCompactLogDetails')) {
  const helper = `
function vidoraCompactLogDetails(value, depth = 0) {
  if (value == null) return value;

  if (typeof value === 'string') {
    return value.length > 700 ? value.slice(0, 700) + '...<truncated>' : value;
  }

  if (typeof value !== 'object') return value;

  if (depth > 4) return '[depth-truncated]';

  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item) => vidoraCompactLogDetails(item, depth + 1));
  }

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      key === 'node' ||
      key === 'html' ||
      key === 'outerHTML' ||
      key === 'innerHTML' ||
      key === 'svg' ||
      key === 'children' ||
      key === 'parentElement'
    ) {
      out[key] = '[omitted-heavy-dom]';
      continue;
    }

    if (key === 'buttonText' || key === 'tailSnippet' || key === 'sampleText' || key === 'latestAssistantText') {
      out[key] = String(item || '').slice(0, 500);
      continue;
    }

    out[key] = vidoraCompactLogDetails(item, depth + 1);
  }

  return out;
}

function vidoraShouldThrottleLog(key, intervalMs = 12000) {
  globalThis.__vidoraLogThrottle = globalThis.__vidoraLogThrottle || {};
  const now = Date.now();
  const last = globalThis.__vidoraLogThrottle[key] || 0;
  if (now - last < intervalMs) return true;
  globalThis.__vidoraLogThrottle[key] = now;
  return false;
}

`;
  const insertAt = s.indexOf('async function appendAppLog');
  if (insertAt >= 0) {
    s = s.slice(0, insertAt) + helper + '\n' + s.slice(insertAt);
    console.log('OK: inserted compact log helpers before appendAppLog');
  } else {
    s = helper + '\n' + s;
    console.log('OK: inserted compact log helpers at top fallback');
  }
} else {
  console.log('SKIP: compact log helpers already exist');
}

// Compact details ngay trong appendAppLog nếu tìm được object log.
replaceRegex(
  /(async function appendAppLog\s*\([^)]*\)\s*\{[\s\S]*?)(const entry\s*=\s*\{[\s\S]*?\};)/,
  `$1
  if (payload && payload.details) {
    payload.details = vidoraCompactLogDetails(payload.details);
  }

  if (
    payload &&
    typeof payload.text === 'string' &&
    payload.text.includes('CDP evaluate fallback') &&
    vidoraShouldThrottleLog('cdp-evaluate-fallback-object-chain', 15000)
  ) {
    return null;
  }

  $2`,
  'compact/throttle inside appendAppLog'
);

// Nếu appendAppLog dùng tham số tên khác, compact mọi chỗ appendAppLog có details imageState nặng bằng cách giảm trước log.
replaceRegex(
  /details:\s*\{\s*imageState:\s*snapshot,\s*activeGeneration\s*\}/g,
  `details: vidoraCompactLogDetails({ imageState: snapshot, activeGeneration })`,
  'compact image wait details snapshot+activeGeneration'
);

replaceRegex(
  /details:\s*\{\s*imageState:\s*snapshot\s*\}/g,
  `details: vidoraCompactLogDetails({ imageState: snapshot })`,
  'compact image wait details snapshot'
);

replaceRegex(
  /details:\s*\{\s*imageState:\s*state,\s*activeGeneration\s*\}/g,
  `details: vidoraCompactLogDetails({ imageState: state, activeGeneration })`,
  'compact image wait details state+activeGeneration'
);

replaceRegex(
  /details:\s*\{\s*imageState:\s*state\s*\}/g,
  `details: vidoraCompactLogDetails({ imageState: state })`,
  'compact image wait details state'
);

// Throttle riêng dòng CDP fallback nếu nó được log trực tiếp.
replaceRegex(
  /await appendAppLog\(null,\s*\{\s*source:\s*'main',\s*kind:\s*'running',\s*text:\s*'CDP evaluate fallback: returned safe JSON after Object reference chain error\.',\s*details:\s*\{ originalError: error\.message \}\s*\}\)\.catch\(\(\) => null\);/g,
  `if (!vidoraShouldThrottleLog('cdp-evaluate-fallback-object-chain', 15000)) {
      await appendAppLog(null, {
        source: 'main',
        kind: 'running',
        text: 'CDP evaluate fallback: returned safe JSON after Object reference chain error.',
        details: { originalError: error.message },
      }).catch(() => null);
    }`,
  'throttle direct CDP fallback log'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: reduced CDP/log spam that can make Electron exit');
console.log('Backup:', backup);
