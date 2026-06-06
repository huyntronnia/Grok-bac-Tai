const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_nv2_wait_input_not_sent`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

if (s.includes('VIDORA_FORCE_SEND_NV2_BEFORE_WAIT_REAL')) {
  console.log('SKIP: patch exists');
  process.exit(0);
}

const needle = "stage: 'before-nv2-wait'";
const idx = s.indexOf(needle);

if (idx < 0) {
  console.error("FAIL: không tìm thấy stage before-nv2-wait");
  process.exit(1);
}

// Tìm đầu call vidoraChatGptInputGate gần nhất trước stage before-nv2-wait
const callStart = s.lastIndexOf('await vidoraChatGptInputGate', idx);
if (callStart < 0) {
  console.error("FAIL: không tìm thấy await vidoraChatGptInputGate trước before-nv2-wait");
  process.exit(1);
}

// Tìm hết statement gate hiện tại
const stmtEnd = s.indexOf(');', idx);
if (stmtEnd < 0) {
  console.error("FAIL: không tìm thấy kết thúc call gate before-nv2-wait");
  process.exit(1);
}

const insertAt = stmtEnd + 2;

const code = `

// VIDORA_FORCE_SEND_NV2_BEFORE_WAIT_REAL
  {
    const nv2GateTarget = (typeof client !== 'undefined' ? client : (typeof page !== 'undefined' ? page : null));

    let nv2InputState = await vidoraReadChatGptComposerStateReal(nv2GateTarget, {
      sceneId: ((typeof options !== 'undefined' && options?.sceneId) || (typeof context !== 'undefined' && context?.sceneId) || ''),
      stage: 'nv2-force-send-before-wait-check',
    }).catch((error) => ({ ok: false, error: error.message }));

    await appendAppLog(null, {
      source: 'main',
      kind: 'running',
      text: 'NV2 SEND GATE: kiểm tra input trước khi chờ ChatGPT trả motion prompt.',
      details: { nv2InputState },
    }).catch(() => null);

    if (nv2InputState?.ok && nv2InputState.composerHasText) {
      await appendAppLog(null, {
        source: 'main',
        kind: 'error',
        text: 'NV2 SEND GATE: input còn prompt NV2 => chưa gửi thật, ép bấm nút gửi.',
        details: {
          textLength: nv2InputState.composerTextLength,
          textHead: nv2InputState.composerTextHead,
          sendButton: nv2InputState.sendButton,
          sendCandidates: nv2InputState.sendCandidates,
        },
      }).catch(() => null);

      for (let attempt = 1; attempt <= 5; attempt++) {
        const click = await vidoraClickChatGptRealSendButton(nv2GateTarget, nv2InputState)
          .catch((error) => ({ ok: false, error: error.message }));

        await sleep(1200);

        const after = await vidoraReadChatGptComposerStateReal(nv2GateTarget, {
          sceneId: ((typeof options !== 'undefined' && options?.sceneId) || (typeof context !== 'undefined' && context?.sceneId) || ''),
          stage: 'nv2-force-send-after-click',
          attempt,
        }).catch((error) => ({ ok: false, error: error.message }));

        await appendAppLog(null, {
          source: 'main',
          kind: (!after?.composerHasText || after?.stopVisible) ? 'ok' : 'running',
          text: (!after?.composerHasText || after?.stopVisible)
            ? \`NV2 SEND GATE: attempt \${attempt} gửi OK, input đã trống hoặc ChatGPT đang chạy.\`
            : \`NV2 SEND GATE: attempt \${attempt} chưa gửi, input vẫn còn nội dung.\`,
          details: { attempt, click, after },
        }).catch(() => null);

        nv2InputState = after;

        if (!after?.composerHasText || after?.stopVisible) break;
      }

      if (nv2InputState?.composerHasText && !nv2InputState?.stopVisible) {
        throw new Error('nv2-send-gate-failed-input-still-has-prompt');
      }
    }
  }
`;

s = s.slice(0, insertAt) + code + s.slice(insertAt);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: force-send NV2 before waiting for motion prompt');
console.log('Backup:', backup);
