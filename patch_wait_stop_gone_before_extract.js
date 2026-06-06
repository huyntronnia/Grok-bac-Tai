const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_wait_stop_gone_before_extract`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

const helper = `
async function waitForChatGptImageGenerationDoneBeforeExtract(client, options = {}) {
  const sceneId = options.sceneId || '';
  const startedAt = Date.now();
  let lastBusyLogAt = 0;
  let firstIdleAt = 0;

  while (Date.now() - startedAt < 360000) {
    const imageState = await evaluateOnCdpPage(
      client,
      \`(\${readChatGptImageStateScript.toString()})()\`
    ).catch((error) => ({ ok: false, generating: true, error: error.message }));

    const activeGeneration = await evaluateOnCdpPage(
      client,
      \`(\${detectChatGptActiveGenerationScriptStrict.toString()})()\`
    ).catch((error) => ({ ok: false, generating: true, error: error.message }));

    const busy = Boolean(
      imageState?.generating ||
      imageState?.preparingImage ||
      imageState?.stopButtonVisible ||
      imageState?.stopVisible ||
      imageState?.composerBusy ||
      imageState?.streamingIndicator ||
      activeGeneration?.generating
    );

    if (!busy) {
      if (!firstIdleAt) {
        firstIdleAt = Date.now();
        await appendAppLog(null, {
          source: 'main',
          kind: 'running',
          text: \`Scene \${sceneId}: ChatGPT stop button gone; waiting 4s for final image to settle before extract.\`,
          details: {
            imageState: sanitizeChatGptImageSnapshot(imageState),
            activeGeneration,
          },
        }).catch(() => null);
      }

      if (Date.now() - firstIdleAt >= 4000) {
        return {
          ok: true,
          idleMs: Date.now() - firstIdleAt,
          waitedMs: Date.now() - startedAt,
          imageState: sanitizeChatGptImageSnapshot(imageState),
          activeGeneration,
        };
      }
    } else {
      firstIdleAt = 0;
      if (Date.now() - lastBusyLogAt > 10000) {
        lastBusyLogAt = Date.now();
        await appendAppLog(null, {
          source: 'main',
          kind: 'running',
          text: \`Scene \${sceneId}: ChatGPT vẫn đang tạo ảnh; chưa extract keyframe.\`,
          details: {
            imageState: sanitizeChatGptImageSnapshot(imageState),
            activeGeneration,
          },
        }).catch(() => null);
      }
    }

    await sleep(1500);
  }

  throw new Error(\`Scene \${sceneId}: Hết thời gian chờ ChatGPT hoàn tất ảnh trước khi extract.\`);
}

`;

if (!s.includes('async function waitForChatGptImageGenerationDoneBeforeExtract')) {
  replaceRegex(
    /async function waitForLatestChatGPTGeneratedImage/,
    `${helper}
async function waitForLatestChatGPTGeneratedImage`,
    'insert wait stop-gone helper'
  );
} else {
  console.log('SKIP: wait stop-gone helper already exists');
}

// Chèn trước vòng extract: mỗi attempt chỉ cho extract sau khi ChatGPT hết busy.
if (!s.includes('waitForChatGptImageGenerationDoneBeforeExtract(client, options);')) {
  replaceRegex(
    /(while\s*\(Date\.now\(\) - attemptStartedAt < 360000\)\s*\{\s*)/,
    `$1
      await waitForChatGptImageGenerationDoneBeforeExtract(client, options);
`,
    'wait for stop gone before each image extract'
  );
} else {
  console.log('SKIP: stop-gone wait already inserted');
}

// Nâng stable tick từ 2 lên 3 nếu đang có stableTicks >= 2.
replaceRegex(
  /stableTicks\s*>=\s*2/g,
  `stableTicks >= 3`,
  'require 3 stable ticks before accepting image'
);

// Thêm lớp chặn canvas chấm chấm rõ ràng nếu helper reject chưa ăn.
if (!s.includes('isChatGptDotLoadingCanvasAsset')) {
  const dotHelper = `
function isChatGptDotLoadingCanvasAsset(asset = {}) {
  const method = String(asset.method || '').toLowerCase();
  const sourceKind = String(asset.sourceKind || '').toLowerCase();
  const width = Number(asset.width || 0);
  const height = Number(asset.height || 0);
  const byteLength = Number(asset.byteLength || 0);
  return method === 'canvas' && sourceKind === 'canvas' && width <= 700 && height <= 700 && byteLength < 150000;
}

`;
  replaceRegex(
    /async function waitForChatGptImageGenerationDoneBeforeExtract/,
    `${dotHelper}
async function waitForChatGptImageGenerationDoneBeforeExtract`,
    'insert dot canvas detector'
  );
} else {
  console.log('SKIP: dot canvas detector already exists');
}

// Chặn trước save file là lớp bảo vệ cuối.
replaceRegex(
  /(const imageAsset\s*=\s*await waitForLatestChatGPTGeneratedImage\(client,\s*options\);)/,
  `$1
  if (isChatGptDotLoadingCanvasAsset(imageAsset)) {
    await appendAppLog(null, {
      source: 'main',
      kind: 'error',
      text: \`Scene \${options.sceneId || ''}: không lưu keyframe vì ảnh lấy được vẫn là canvas loading/chấm chấm.\`,
      details: {
        method: imageAsset?.method,
        sourceKind: imageAsset?.sourceKind,
        width: imageAsset?.width,
        height: imageAsset?.height,
        byteLength: imageAsset?.byteLength,
      },
    }).catch(() => null);
    throw new Error('ChatGPT image is still loading/dot canvas; wait for final generated image before saving.');
  }`,
  'final guard against dot loading canvas before save'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: wait for ChatGPT stop button gone before extracting image');
console.log('Backup:', backup);
