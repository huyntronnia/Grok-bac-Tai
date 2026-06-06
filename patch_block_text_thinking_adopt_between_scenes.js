const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_block_text_thinking_adopt_between_scenes`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

if (s.includes('VIDORA_BLOCK_TEXT_THINKING_ADOPT_BETWEEN_SCENES')) {
  console.log('SKIP: patch exists');
  process.exit(0);
}

const needle = "ChatGPT dang generate; adopt active generation instead of opening root/new chat.";
const idx = s.indexOf(needle);

if (idx < 0) {
  console.error('FAIL: không tìm thấy adopt log string');
  process.exit(1);
}

const ifIdx = s.lastIndexOf('if (', idx);
if (ifIdx < 0) {
  console.error('FAIL: không tìm thấy if adopt trước log');
  process.exit(1);
}

const guard = `
// VIDORA_BLOCK_TEXT_THINKING_ADOPT_BETWEEN_SCENES
  {
    const activeMode = String(initialActiveGeneration?.mode || '');
    const tail = String(initialActiveGeneration?.tailSnippet || '');
    const imageReallyGenerating =
      initialImageState?.generating === true ||
      initialImageState?.preparingImage === true ||
      initialImageState?.stopButtonVisible === true;

    const textThinkingOnly =
      initialActiveGeneration?.generating === true &&
      activeMode.includes('thinking') &&
      !imageReallyGenerating;

    const looksLikeOldMotionPrompt =
      /negative prompt|no music|dòng 1|dòng 2|motion prompt|technical specifications|khung hình trong ảnh/i.test(tail);

    if (textThinkingOnly || looksLikeOldMotionPrompt) {
      await appendAppLog(null, {
        source: 'main',
        kind: 'running',
        text: 'ChatGPT adopt active generation bị chặn: chỉ là text/thinking cũ, không phải tạo ảnh scene hiện tại.',
        details: {
          activeMode,
          tailSnippet: tail.slice(0, 600),
          imageReallyGenerating,
          textThinkingOnly,
          looksLikeOldMotionPrompt,
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

s = s.slice(0, ifIdx) + guard + s.slice(ifIdx);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: block text/thinking adopt between scenes');
console.log('Backup:', backup);
