const fs = require('fs');

const files = {
  main: 'electron/main.js',
  renderer: 'electron/renderer.js',
};

for (const file of Object.values(files)) {
  const backup = `${file}.bak_crash_guard_logger`;
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
}

let main = fs.readFileSync(files.main, 'utf8');
let renderer = fs.readFileSync(files.renderer, 'utf8');

function patchMain() {
  if (main.includes('vidora-crash-guard-main-installed')) {
    console.log('SKIP main crash guard');
    return;
  }

  const guard = `
/* vidora-crash-guard-main-installed */
const VIDORA_CRASH_LOG = path.join(app.getPath('userData'), 'vidora-crash.log');

function writeCrashLog(label, error, extra = {}) {
  try {
    const payload = {
      time: new Date().toISOString(),
      label,
      message: error?.message || String(error || ''),
      stack: error?.stack || '',
      extra,
    };
    fs.appendFileSync(VIDORA_CRASH_LOG, JSON.stringify(payload, null, 2) + '\\n---\\n', 'utf8');
    console.error('[VidoraCrash]', label, payload.message, payload.stack || '');
  } catch (_error) {}
}

process.on('uncaughtException', (error) => {
  writeCrashLog('main:uncaughtException', error);
});

process.on('unhandledRejection', (reason) => {
  writeCrashLog('main:unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)));
});

app.on('render-process-gone', (_event, webContents, details) => {
  writeCrashLog('electron:render-process-gone', new Error(details?.reason || 'render-process-gone'), {
    reason: details?.reason,
    exitCode: details?.exitCode,
    url: webContents?.getURL?.(),
  });
});

app.on('child-process-gone', (_event, details) => {
  writeCrashLog('electron:child-process-gone', new Error(details?.reason || 'child-process-gone'), details || {});
});

app.on('gpu-process-crashed', (_event, killed) => {
  writeCrashLog('electron:gpu-process-crashed', new Error('gpu-process-crashed'), { killed });
});

`;

  const insertAt = main.indexOf('app.whenReady');
  if (insertAt >= 0) {
    main = main.slice(0, insertAt) + guard + '\n' + main.slice(insertAt);
    console.log('OK main crash guard before app.whenReady');
  } else {
    main = guard + '\n' + main;
    console.log('OK main crash guard at top fallback');
  }

  // Không để app quit im lặng khi window bị đóng/crash ngoài ý muốn trong lúc pipeline.
  main = main.replace(
    /app\.on\('window-all-closed',\s*\(\)\s*=>\s*\{[\s\S]*?\}\);/,
    `app.on('window-all-closed', () => {
  writeCrashLog('electron:window-all-closed', new Error('All windows closed'), { note: 'App kept alive for crash debugging.' });
  if (process.platform !== 'darwin') {
    // Trong lúc debug pipeline, không quit im lặng. Người dùng có thể Ctrl+C ở terminal.
    return;
  }
});`
  );
}

function patchRenderer() {
  if (renderer.includes('vidora-crash-guard-renderer-installed')) {
    console.log('SKIP renderer crash guard');
    return;
  }

  const guard = `
/* vidora-crash-guard-renderer-installed */
window.addEventListener('error', (event) => {
  try {
    window.videoPlannerAPI?.appendAppLog?.({
      source: 'renderer',
      kind: 'error',
      text: 'Renderer crash/error: ' + (event.error?.message || event.message || 'unknown'),
      details: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack || '',
      },
    });
  } catch (_error) {}
});

window.addEventListener('unhandledrejection', (event) => {
  try {
    const reason = event.reason;
    window.videoPlannerAPI?.appendAppLog?.({
      source: 'renderer',
      kind: 'error',
      text: 'Renderer unhandled rejection: ' + (reason?.message || String(reason || 'unknown')),
      details: {
        message: reason?.message || String(reason || ''),
        stack: reason?.stack || '',
      },
    });
  } catch (_error) {}
});

`;

  renderer = guard + '\n' + renderer;
  console.log('OK renderer crash guard');
}

patchMain();
patchRenderer();

fs.writeFileSync(files.main, main, 'utf8');
fs.writeFileSync(files.renderer, renderer, 'utf8');

console.log('DONE: crash guard/logger installed');
console.log('Crash log will be at: C:\\\\Users\\\\Admin\\\\AppData\\\\Roaming\\\\vidora\\\\vidora-crash.log');
