const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_reject_loading_canvas`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

const helper = `
function isLikelyChatGptLoadingPlaceholderImage(asset = {}) {
  const method = String(asset.method || '').toLowerCase();
  const sourceKind = String(asset.sourceKind || '').toLowerCase();
  const width = Number(asset.width || 0);
  const height = Number(asset.height || 0);
  const byteLength = Number(asset.byteLength || 0);

  // ChatGPT loading/placeholder thường là canvas vuông 600x600, byte rất nhỏ,
  // nhìn như chấm chấm, không phải ảnh kết quả thật.
  if (method === 'canvas' && width <= 700 && height <= 700 && byteLength < 120000) return true;

  // Canvas thật có thể tồn tại, nhưng phải đủ lớn/dày dữ liệu.
  if (method === 'canvas' && sourceKind === 'canvas' && byteLength < 180000) return true;

  return false;
}

function isPreferredChatGptRealImageAsset(asset = {}) {
  const method = String(asset.method || '').toLowerCase();
  const sourceKind = String(asset.sourceKind || '').toLowerCase();
  const width = Number(asset.width || 0);
  const height = Number(asset.height || 0);
  const byteLength = Number(asset.byteLength || 0);

  if (isLikelyChatGptLoadingPlaceholderImage(asset)) return false;

  // Ưu tiên ảnh thật từ URL/backend.
  if (method === 'img' && (sourceKind.includes('remote') || sourceKind.includes('url')) && width >= 512 && height >= 512 && byteLength >= 120000) {
    return true;
  }

  // Canvas chỉ nhận khi đủ lớn và đủ byte.
  if (method === 'canvas' && width >= 768 && height >= 768 && byteLength >= 250000) {
    return true;
  }

  return false;
}

`;

if (!s.includes('function isLikelyChatGptLoadingPlaceholderImage')) {
  replaceRegex(
    /async function waitForLatestChatGPTGeneratedImage/,
    `${helper}
async function waitForLatestChatGPTGeneratedImage`,
    'insert placeholder image rejection helpers'
  );
} else {
  console.log('SKIP: placeholder helpers already exist');
}

// Chặn ngay trước khi log found candidate stable.
// Pattern các bản code hiện tại thường có if (extracted?.ok) hoặc if (extracted?.base64).
replaceRegex(
  /(if\s*\(extracted\?\.ok\s*\|\|\s*extracted\?\.base64\)\s*\{)/,
  `$1
        if (isLikelyChatGptLoadingPlaceholderImage(extracted)) {
          lastReadiness = { state: 'loading_placeholder_canvas', method: extracted.method, sourceKind: extracted.sourceKind, width: extracted.width, height: extracted.height, byteLength: extracted.byteLength };
          if (Date.now() - lastLogAt > 5000) {
            lastLogAt = Date.now();
            await appendAppLog(null, {
              source: 'main',
              kind: 'running',
              text: \`chatgptImageExtract: rejected loading placeholder canvas for scene \${options.sceneId || ''}\`,
              details: {
                method: extracted.method,
                sourceKind: extracted.sourceKind,
                width: extracted.width,
                height: extracted.height,
                byteLength: extracted.byteLength,
              },
            });
          }
          await sleep(3000);
          continue;
        }`,
  'reject placeholder canvas in extracted ok branch'
);

// Fallback: trước khi return lastExtract hoặc extracted, chặn asset không phải ảnh thật.
// Bắt các return extracted phổ biến.
replaceRegex(
  /return extracted;/g,
  `if (!isPreferredChatGptRealImageAsset(extracted)) {
        await appendAppLog(null, {
          source: 'main',
          kind: 'running',
          text: \`chatgptImageExtract: candidate not accepted as real final image for scene \${options.sceneId || ''}\`,
          details: {
            method: extracted?.method,
            sourceKind: extracted?.sourceKind,
            width: extracted?.width,
            height: extracted?.height,
            byteLength: extracted?.byteLength,
          },
        });
        await sleep(3000);
        continue;
      }
      return extracted;`,
  'guard return extracted'
);

replaceRegex(
  /return lastExtract;/g,
  `if (!isPreferredChatGptRealImageAsset(lastExtract)) {
        await appendAppLog(null, {
          source: 'main',
          kind: 'running',
          text: \`chatgptImageExtract: last candidate rejected as loading/preview for scene \${options.sceneId || ''}\`,
          details: {
            method: lastExtract?.method,
            sourceKind: lastExtract?.sourceKind,
            width: lastExtract?.width,
            height: lastExtract?.height,
            byteLength: lastExtract?.byteLength,
          },
        });
        await sleep(3000);
        continue;
      }
      return lastExtract;`,
  'guard return lastExtract'
);

// Nếu không match branch trên, chặn ở saveChatGPTGeneratedImageToFile trước khi ghi file.
// Đây là lớp bảo vệ cuối.
replaceRegex(
  /(async function saveChatGPTGeneratedImageToFile\s*\(client,\s*options = \{\}\)\s*\{\s*const imageAsset = await waitForLatestChatGPTGeneratedImage\(client,\s*options\);)/,
  `$1
  if (isLikelyChatGptLoadingPlaceholderImage(imageAsset)) {
    await appendAppLog(null, {
      source: 'main',
      kind: 'error',
      text: \`Scene \${options.sceneId || ''}: từ chối lưu keyframe vì ảnh lấy được là canvas loading/chấm chấm, chưa phải ảnh ChatGPT hoàn chỉnh.\`,
      details: {
        method: imageAsset?.method,
        sourceKind: imageAsset?.sourceKind,
        width: imageAsset?.width,
        height: imageAsset?.height,
        byteLength: imageAsset?.byteLength,
      },
    });
    throw new Error('ChatGPT image is still loading placeholder canvas; refusing to save as keyframe.');
  }`,
  'final guard before saving placeholder keyframe'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: reject ChatGPT loading canvas placeholder');
console.log('Backup:', backup);
