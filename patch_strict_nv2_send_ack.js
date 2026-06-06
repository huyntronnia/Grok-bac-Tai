const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_strict_nv2_send_ack`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// Trong NV2 single-send, không cho "composerCleared" được xem là gửi thành công.
// Vì ChatGPT có thể clear composer nhưng không tạo response mới => kẹt same-as-before.
replaceRegex(
  /if \(acknowledged\?\.ok\) \{\s*return \{ ok: true, mode, selector: focused\.selector, send: click\?\.selector \|\| click\?\.error \|\| mode, acknowledged, recoveryAttempts: attempt - 1 \};\s*\}/,
  `if (acknowledged?.ok) {
      const trulyStarted = Boolean(
        acknowledged.generating ||
        acknowledged.assistantAdvanced ||
        acknowledged.lastAssistant?.generating ||
        Number(acknowledged.lastAssistant?.count || 0) > Number(context.beforeCount || 0)
      );

      if (trulyStarted) {
        return {
          ok: true,
          mode,
          selector: focused.selector,
          send: click?.selector || click?.error || mode,
          acknowledged,
          recoveryAttempts: attempt - 1,
        };
      }

      await appendAppLog(null, {
        source: 'main',
        kind: 'running',
        text: \`motionPromptSend: send not truly acknowledged for scene \${context.sceneId || ''}; retrying immediately.\`,
        details: {
          sceneId: context.sceneId || '',
          attempt,
          acknowledged,
          reason: 'composer-cleared-but-no-new-assistant-and-no-generation',
        },
      }).catch(() => null);

      acknowledged = {
        ok: false,
        error: 'Composer cleared, but ChatGPT did not start a new assistant response.',
        previous: acknowledged,
      };
    }`,
  'strict NV2 send acknowledgement'
);

// Làm waitForPromptSendAcknowledged trả thông tin rõ hơn, nhưng vẫn giữ tương thích nơi khác.
replaceRegex(
  /if \(composerCleared \|\| assistantAdvanced \|\| lastAssistant\?\.generating\) \{\s*return \{ ok: true, composerCleared, assistantAdvanced, generating: Boolean\(lastAssistant\?\.generating\), lastComposer, lastAssistant \};\s*\}/,
  `if (composerCleared || assistantAdvanced || lastAssistant?.generating) {
      return {
        ok: true,
        composerCleared,
        assistantAdvanced,
        generating: Boolean(lastAssistant?.generating),
        lastComposer,
        lastAssistant,
      };
    }`,
  'normalize waitForPromptSendAcknowledged return'
);

// Sau mỗi failed ack, ép focus + set prompt lại trước vòng tiếp theo.
replaceRegex(
  /await recoverChatGptBlockingUi\(client, \{ \.\.\.context, stage: 'single-ack-failed', attempt, reason: acknowledged\?\.error \|\| '' \}\)\.catch\(\(\) => null\);/,
  `await recoverChatGptBlockingUi(client, { ...context, stage: 'single-ack-failed', attempt, reason: acknowledged?.error || '' }).catch(() => null);
    await evaluateOnCdpPage(client, \`(\${focusPromptInputScript.toString()})()\`).catch(() => null);
    await evaluateOnCdpPage(client, \`(\${setPromptInputValueScript.toString()})(\${JSON.stringify(prompt)})\`).catch(() => null);
    await sleep(700);`,
  'reset prompt after failed NV2 ack'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: strict NV2 send acknowledgement installed');
console.log('Backup:', backup);
