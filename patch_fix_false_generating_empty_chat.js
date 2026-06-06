const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_false_generating_empty_chat`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// Helper nhận diện trạng thái "generating" giả: ChatGPT root/trống, không stop, không preparing, composer idle.
if (!s.includes('function isFalseChatGptImageGeneratingState')) {
  replaceRegex(
    /async function waitForChatGptImageGenerationDoneBeforeExtract/,
    `function isFalseChatGptImageGeneratingState(state = {}) {
  return Boolean(
    state.generating &&
    !state.preparingImage &&
    !state.stopButtonVisible &&
    !state.stopButton &&
    !state.sendReady &&
    !state.composerBusy &&
    !String(state.sendText || '').trim()
  );
}

async function waitForChatGptImageGenerationDoneBeforeExtract`,
    'insert false generating detector'
  );
} else {
  console.log('SKIP: false generating detector already exists');
}

// Trong vòng chờ ảnh, nếu gặp false generating nhiều lần thì break/return để không kẹt vô hạn.
if (!s.includes('false-generating-empty-chat-break')) {
  replaceRegex(
    /(const snapshot = await evaluateOnCdpPage\(client,\s*`\(\$\{readChatGptImageStateScript\.toString\(\)\}\)\(\)`\);[\s\S]*?lastSnapshot = snapshot;)/,
    `$1

      // false-generating-empty-chat-break
      if (isFalseChatGptImageGeneratingState(snapshot)) {
        falseGeneratingTicks = (typeof falseGeneratingTicks === 'number' ? falseGeneratingTicks : 0) + 1;

        await appendAppLog(null, {
          source: 'main',
          kind: 'running',
          text: \`Scene \${options.sceneId}: ChatGPT image generating looks stale/empty; tick \${falseGeneratingTicks}/3.\`,
          details: { imageState: snapshot },
        }).catch(() => null);

        if (falseGeneratingTicks >= 3) {
          await appendAppLog(null, {
            source: 'main',
            kind: 'error',
            text: \`Scene \${options.sceneId}: ChatGPT không thực sự tạo ảnh; thoát vòng chờ để retry gửi NV1.\`,
            details: { imageState: snapshot, reason: 'false-generating-empty-chat' },
          }).catch(() => null);

          throw new Error('false-generating-empty-chat: ChatGPT page is idle/empty but detector says generating.');
        }
      } else {
        falseGeneratingTicks = 0;
      }`,
    'add false generating break in image wait loop'
  );
} else {
  console.log('SKIP: false generating break already installed');
}

// Nếu chưa có biến falseGeneratingTicks trong scope, khai báo gần lastSnapshot.
replaceRegex(
  /(let lastSnapshot\s*=\s*[^;]+;\s*)/,
  `$1
    let falseGeneratingTicks = 0;
`,
  'declare falseGeneratingTicks'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: fixed false ChatGPT image generating wait on empty/new chat');
console.log('Backup:', backup);
