const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_quit_exit_trace`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

if (!s.includes('vidora-quit-exit-trace-installed')) {
  const block = `
/* vidora-quit-exit-trace-installed */
function vidoraTraceExit(label, extra = {}) {
  try {
    const fs2 = require('fs');
    const path2 = require('path');
    const logPath = path2.join(app.getPath('userData'), 'vidora-exit-trace.log');
    const payload = {
      time: new Date().toISOString(),
      label,
      extra,
      stack: new Error(label).stack,
    };
    fs2.appendFileSync(logPath, JSON.stringify(payload, null, 2) + '\\n---\\n', 'utf8');
    console.log('[VidoraExitTrace]', label, JSON.stringify(extra || {}));
  } catch (e) {
    try { console.log('[VidoraExitTraceFailed]', label, e?.message || e); } catch (_) {}
  }
}

process.on('exit', (code) => {
  try { console.log('[VidoraProcessExit]', code); } catch (_) {}
});

process.on('beforeExit', (code) => {
  try { console.log('[VidoraProcessBeforeExit]', code); } catch (_) {}
});

app.on('before-quit', (event) => {
  vidoraTraceExit('app:before-quit', { exitCode: process.exitCode || 0 });
});

app.on('will-quit', (event) => {
  vidoraTraceExit('app:will-quit', { exitCode: process.exitCode || 0 });
});

app.on('quit', (_event, exitCode) => {
  vidoraTraceExit('app:quit', { exitCode });
});

app.on('window-all-closed', () => {
  vidoraTraceExit('app:window-all-closed', { note: 'all windows closed' });
});

app.on('browser-window-created', (_event, win) => {
  try {
    win.on('closed', () => vidoraTraceExit('browser-window:closed', { title: win.getTitle?.() || '' }));
    win.webContents.on('render-process-gone', (_event2, details) => {
      vidoraTraceExit('webContents:render-process-gone', details || {});
    });
    win.webContents.on('unresponsive', () => {
      vidoraTraceExit('webContents:unresponsive', { title: win.getTitle?.() || '' });
    });
  } catch (_) {}
});

`;

  const idx = s.indexOf('app.whenReady');
  if (idx >= 0) {
    s = s.slice(0, idx) + block + '\n' + s.slice(idx);
  } else {
    s = block + '\n' + s;
  }

  console.log('OK: installed quit/exit trace');
} else {
  console.log('SKIP: quit/exit trace already installed');
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE');
console.log('Backup:', backup);
