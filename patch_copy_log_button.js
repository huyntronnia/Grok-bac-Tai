const fs = require('fs');

const files = {
  html: 'electron/index.html',
  renderer: 'electron/renderer.js',
  css: 'electron/style.css',
};

for (const file of Object.values(files)) {
  const backup = `${file}.bak_copy_log`;
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
}

let html = fs.readFileSync(files.html, 'utf8');
let renderer = fs.readFileSync(files.renderer, 'utf8');
let css = fs.readFileSync(files.css, 'utf8');

function replaceOnceText(source, from, to, label) {
  if (!source.includes(from)) {
    console.log(`SKIP: ${label}`);
    return source;
  }
  console.log(`OK: ${label}`);
  return source.replace(from, to);
}

function replaceRegex(source, rx, to, label) {
  const before = source;
  source = source.replace(rx, to);
  console.log(before === source ? `SKIP: ${label}` : `OK: ${label}`);
  return source;
}

// 1) Thêm nút Copy log cạnh nút Xóa log.
html = replaceOnceText(
  html,
  `<button id="clear-log-btn" class="ghost mini" type="button">Xóa log</button>`,
  `<div class="pipeline-log-actions">
          <button id="copy-log-btn" class="ghost mini" type="button">Copy log</button>
          <button id="clear-log-btn" class="ghost mini" type="button">Xóa log</button>
        </div>`,
  'add copy log button html utf8'
);

// Fallback nếu file đang bị mojibake nhưng id clear-log-btn vẫn còn.
if (!html.includes('id="copy-log-btn"')) {
  html = replaceRegex(
    html,
    /<button id="clear-log-btn" class="ghost mini" type="button">[\s\S]*?<\/button>/,
    `<div class="pipeline-log-actions">
          <button id="copy-log-btn" class="ghost mini" type="button">Copy log</button>
          <button id="clear-log-btn" class="ghost mini" type="button">Xóa log</button>
        </div>`,
    'add copy log button html regex'
  );
}

// 2) Query selector cho nút.
renderer = replaceOnceText(
  renderer,
  `const clearLogBtn = document.querySelector('#clear-log-btn');`,
  `const clearLogBtn = document.querySelector('#clear-log-btn');
const copyLogBtn = document.querySelector('#copy-log-btn');`,
  'add copyLogBtn selector'
);

// 3) Hàm build text log để copy.
if (!renderer.includes('function formatPipelineLogsForCopy()')) {
  renderer = replaceOnceText(
    renderer,
    `function renderPipelineLog() {`,
    `function formatPipelineLogsForCopy() {
  const lines = [];
  lines.push('=== Vidora pipeline log ===');
  lines.push(\`Time: \${new Date().toLocaleString('vi-VN', { hour12: false })}\`);
  if (project?.name) lines.push(\`Project: \${project.name}\`);
  lines.push('');

  if (!pipelineLogs.length) {
    lines.push('(No pipeline logs)');
    return lines.join('\\n');
  }

  [...pipelineLogs].reverse().forEach((entry, index) => {
    const source = entry.source || 'app';
    const kind = entry.kind || 'info';
    lines.push(\`[\${String(index + 1).padStart(3, '0')}] \${entry.time || ''} · \${source} · \${kind}\`);
    lines.push(entry.text || '');
    if (entry.details) {
      lines.push('details:');
      lines.push(String(entry.details));
    }
    lines.push('');
  });

  return lines.join('\\n');
}

async function copyPipelineLog() {
  const text = formatPipelineLogsForCopy();

  try {
    await navigator.clipboard.writeText(text);
    if (copyLogBtn) {
      const old = copyLogBtn.textContent;
      copyLogBtn.textContent = 'Copied ✓';
      setTimeout(() => { copyLogBtn.textContent = old; }, 1200);
    }
    setStatus('Đã copy pipeline log vào clipboard.', 'ok');
  } catch (error) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (_err) {
      ok = false;
    }

    textarea.remove();

    if (ok) {
      if (copyLogBtn) {
        const old = copyLogBtn.textContent;
        copyLogBtn.textContent = 'Copied ✓';
        setTimeout(() => { copyLogBtn.textContent = old; }, 1200);
      }
      setStatus('Đã copy pipeline log vào clipboard.', 'ok');
      return;
    }

    setStatus(\`Không copy được log: \${error?.message || error}\`, 'error');
  }
}

function renderPipelineLog() {`,
    'insert copy pipeline log functions'
  );
} else {
  console.log('SKIP: copy log functions already exist');
}

// 4) Gắn event click. Đặt cạnh clearLogBtn listener nếu tìm được.
if (!renderer.includes('copyLogBtn?.addEventListener')) {
  renderer = replaceOnceText(
    renderer,
    `clearLogBtn?.addEventListener('click', () => {
  pipelineLogs = [];
  renderPipelineLog();
});`,
    `copyLogBtn?.addEventListener('click', copyPipelineLog);

clearLogBtn?.addEventListener('click', () => {
  pipelineLogs = [];
  renderPipelineLog();
});`,
    'add copy log click listener before clear log'
  );

  if (!renderer.includes('copyLogBtn?.addEventListener')) {
    renderer = replaceOnceText(
      renderer,
      `openHardPromptBtn?.addEventListener('click', async () => {`,
      `copyLogBtn?.addEventListener('click', copyPipelineLog);

openHardPromptBtn?.addEventListener('click', async () => {`,
      'add copy log click listener fallback'
    );
  }
} else {
  console.log('SKIP: copy log click listener already exists');
}

// 5) CSS cho cụm nút.
if (!css.includes('.pipeline-log-actions')) {
  css += `

.pipeline-log-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
`;
  console.log('OK: add pipeline-log-actions css');
} else {
  console.log('SKIP: pipeline-log-actions css already exists');
}

fs.writeFileSync(files.html, html, 'utf8');
fs.writeFileSync(files.renderer, renderer, 'utf8');
fs.writeFileSync(files.css, css, 'utf8');

console.log('DONE: added Copy log button');
console.log('Backups:');
console.log(`${files.html}.bak_copy_log`);
console.log(`${files.renderer}.bak_copy_log`);
console.log(`${files.css}.bak_copy_log`);
