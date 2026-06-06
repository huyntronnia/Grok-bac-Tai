const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_hard_skip_old_text_adopt`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

// 1) Đặt flag hard-skip trước cụm guard adopt.
if (!s.includes('let vidoraSkipAdoptActiveGeneration = false;')) {
  const marker = '// VIDORA_DISABLE_ADOPT_ACTIVE_GENERATION_ON_ROOT';
  const idx = s.indexOf(marker);
  if (idx < 0) {
    console.error('FAIL: marker VIDORA_DISABLE_ADOPT_ACTIVE_GENERATION_ON_ROOT not found');
    process.exit(1);
  }
  s = s.slice(0, idx) + '  let vidoraSkipAdoptActiveGeneration = false;\n\n' + s.slice(idx);
  console.log('OK: inserted vidoraSkipAdoptActiveGeneration flag');
}

// 2) Trong các guard hiện có, khi chặn thì set hard-skip = true.
s = s.replaceAll(
  "try { if (initialActiveGeneration) initialActiveGeneration.generating = false; } catch {}",
  "vidoraSkipAdoptActiveGeneration = true;\n      try { if (initialActiveGeneration) initialActiveGeneration.generating = false; } catch {}"
);

// 3) Thêm rule mạnh hơn: scene >1 + thinking-text + không có stop thật => không bao giờ adopt.
if (!s.includes('VIDORA_HARD_SKIP_THINKING_TEXT_ADOPT_SCENE_GT1')) {
  const marker = '// VIDORA_BLOCK_TEXT_THINKING_ADOPT_BETWEEN_SCENES';
  const idx = s.indexOf(marker);
  if (idx < 0) {
    console.error('FAIL: marker VIDORA_BLOCK_TEXT_THINKING_ADOPT_BETWEEN_SCENES not found');
    process.exit(1);
  }

  const hardGuard = `
// VIDORA_HARD_SKIP_THINKING_TEXT_ADOPT_SCENE_GT1
  {
    const sid =
      Number((typeof options !== 'undefined' && options?.sceneId) || (typeof context !== 'undefined' && context?.sceneId) || 0);

    const activeMode = String(initialActiveGeneration?.mode || '');
    const tail = String(initialActiveGeneration?.tailSnippet || '');
    const stopReal =
      initialImageState?.stopButtonVisible === true ||
      /dừng|stop/i.test(String(initialActiveGeneration?.stopText || ''));

    const oldTextThinking =
      sid > 1 &&
      initialActiveGeneration?.generating === true &&
      activeMode.includes('thinking') &&
      !stopReal;

    if (oldTextThinking) {
      vidoraSkipAdoptActiveGeneration = true;

      await appendAppLog(null, {
        source: 'main',
        kind: 'running',
        text: 'ChatGPT adopt active generation HARD-SKIP: scene sau đang thấy thinking-text cũ, không phải NV1 ảnh mới.',
        details: {
          sceneId: sid,
          activeMode,
          stopReal,
          tailSnippet: tail.slice(0, 800),
          initialImageState: sanitizeChatGptImageSnapshot(initialImageState),
        },
      }).catch(() => null);

      try { if (initialActiveGeneration) initialActiveGeneration.generating = false; } catch {}
      try { if (initialImageState) initialImageState.generating = false; } catch {}
      try { if (initialImageState) initialImageState.preparingImage = false; } catch {}
      try { if (initialImageState) initialImageState.stopButtonVisible = false; } catch {}
    }
  }

`;
  s = s.slice(0, idx) + hardGuard + s.slice(idx);
  console.log('OK: inserted hard skip thinking-text scene>1 guard');
}

// 4) Bọc nhánh adopt chính bằng !vidoraSkipAdoptActiveGeneration.
const adoptLog = "ChatGPT dang generate; adopt active generation instead of opening root/new chat.";
const logIdx = s.indexOf(adoptLog);
if (logIdx < 0) {
  console.error('FAIL: adopt log not found');
  process.exit(1);
}

const ifIdx = s.lastIndexOf('if (', logIdx);
if (ifIdx < 0) {
  console.error('FAIL: adopt if not found');
  process.exit(1);
}

const before = s.slice(ifIdx, ifIdx + 80);
if (!before.includes('vidoraSkipAdoptActiveGeneration')) {
  s = s.slice(0, ifIdx + 4) + '!vidoraSkipAdoptActiveGeneration && ' + s.slice(ifIdx + 4);
  console.log('OK: wrapped adopt if with !vidoraSkipAdoptActiveGeneration');
} else {
  console.log('SKIP: adopt if already wrapped');
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: hard skip old text/thinking adopt between scenes');
console.log('Backup:', backup);
