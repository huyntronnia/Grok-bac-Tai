const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_hard_console_log_compact`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

if (!s.includes('vidora-hard-console-log-compact-installed')) {
  const patch = `
/* vidora-hard-console-log-compact-installed */
const __vidoraRawConsoleLog = console.log.bind(console);
const __vidoraRawConsoleWarn = console.warn.bind(console);
const __vidoraRawConsoleError = console.error.bind(console);

function __vidoraCompactConsoleArg(arg) {
  try {
    if (typeof arg === 'string') {
      let out = arg;

      out = out.replace(/"html":"[^"]{200,}"/g, '"html":"[omitted-heavy-html]"');
      out = out.replace(/"buttonText":"[^"]{500,}"/g, '"buttonText":"[truncated-buttonText]"');
      out = out.replace(/"sampleText":"[^"]{500,}"/g, '"sampleText":"[truncated-sampleText]"');
      out = out.replace(/"tailSnippet":"[^"]{500,}"/g, '"tailSnippet":"[truncated-tailSnippet]"');
      out = out.replace(/"latestAssistantText":"[^"]{500,}"/g, '"latestAssistantText":"[truncated-latestAssistantText]"');
      out = out.replace(/"node":\\{[^\\n]{200,}?\\}/g, '"node":"[omitted-heavy-dom]"');

      if (out.includes('CDP evaluate fallback: returned safe JSON after Object reference chain error.')) {
        globalThis.__vidoraLastCdpFallbackConsoleAt = globalThis.__vidoraLastCdpFallbackConsoleAt || 0;
        const now = Date.now();
        if (now - globalThis.__vidoraLastCdpFallbackConsoleAt < 15000) return null;
        globalThis.__vidoraLastCdpFallbackConsoleAt = now;
      }

      if (out.length > 5000) out = out.slice(0, 5000) + '...<console-truncated>';
      return out;
    }

    if (arg && typeof arg === 'object') {
      const seen = new WeakSet();
      const json = JSON.stringify(arg, (key, value) => {
        if (key === 'node' || key === 'html' || key === 'outerHTML' || key === 'innerHTML') return '[omitted-heavy-dom]';
        if (typeof value === 'string' && value.length > 500) return value.slice(0, 500) + '...<truncated>';
        if (value && typeof value === 'object') {
          if (seen.has(value)) return '[circular]';
          seen.add(value);
        }
        return value;
      });
      return json.length > 5000 ? json.slice(0, 5000) + '...<console-truncated>' : json;
    }

    return arg;
  } catch (_error) {
    return '[console-arg-compact-failed]';
  }
}

console.log = (...args) => {
  const compacted = args.map(__vidoraCompactConsoleArg).filter((item) => item !== null);
  if (compacted.length) __vidoraRawConsoleLog(...compacted);
};

console.warn = (...args) => {
  const compacted = args.map(__vidoraCompactConsoleArg).filter((item) => item !== null);
  if (compacted.length) __vidoraRawConsoleWarn(...compacted);
};

// Quan trọng: đừng ghi VidoraLog error ra stderr nữa, PowerShell sẽ báo NativeCommandError.
// Error vẫn nằm trong UI log/app log, chỉ chuyển console sang stdout để npm start không bị hiểu là command error.
console.error = (...args) => {
  const compacted = args.map(__vidoraCompactConsoleArg).filter((item) => item !== null);
  if (compacted.length) __vidoraRawConsoleLog(...compacted);
};

`;

  const insertAt = s.indexOf('const { app');
  if (insertAt >= 0) {
    s = s.slice(0, insertAt) + patch + '\n' + s.slice(insertAt);
  } else {
    s = patch + '\n' + s;
  }

  console.log('OK: installed hard console log compact');
} else {
  console.log('SKIP: hard console log compact already installed');
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE');
console.log('Backup:', backup);
