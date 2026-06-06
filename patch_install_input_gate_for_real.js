const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_install_input_gate_for_real`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function insertBefore(marker, code, label) {
  if (s.includes(label)) {
    console.log(`SKIP: ${label}`);
    return;
  }
  const idx = s.indexOf(marker);
  if (idx < 0) {
    console.log(`WARN: marker not found: ${marker}`);
    s += '\n' + code;
  } else {
    s = s.slice(0, idx) + code + '\n' + s.slice(idx);
  }
  console.log(`OK: ${label}`);
}

function replaceOnce(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

const helper = `
/* VIDORA_CHATGPT_INPUT_GATE_REAL */
async function vidoraReadChatGptComposerStateReal(client, context = {}) {
  return await evaluateOnCdpPage(client, \`(() => {
    const norm = (v) => String(v || '').trim();

    const composer =
      document.querySelector('#prompt-textarea') ||
      document.querySelector('textarea') ||
      document.querySelector('[contenteditable="true"]');

    const composerText = norm(
      composer?.value ||
      composer?.innerText ||
      composer?.textContent ||
      ''
    );

    const buttons = [...document.querySelectorAll('button')].map((button) => {
      const r = button.getBoundingClientRect();
      const label = [
        button.getAttribute('aria-label'),
        button.getAttribute('data-testid'),
        button.id,
        button.innerText,
        button.textContent
      ].map(norm).filter(Boolean).join(' | ');

      return {
        label,
        id: button.id || '',
        testid: button.getAttribute('data-testid') || '',
        aria: button.getAttribute('aria-label') || '',
        disabled: Boolean(button.disabled || button.getAttribute('aria-disabled') === 'true'),
        visible: r.width > 8 && r.height > 8,
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      };
    });

    const stopButton = buttons.find((b) => {
      const t = b.label.toLowerCase();
      return b.visible && (t.includes('stop') || t.includes('dừng'));
    });

    const sendCandidates = buttons.filter((b) => {
      const t = b.label.toLowerCase();

      if (!b.visible || b.disabled) return false;

      // CẤM click nhầm mấy nút mode/tool.
      if (
        t.includes('viết hoặc') ||
        t.includes('hỉnh sửa') ||
        t.includes('chỉnh sửa') ||
        t.includes('tạo ảnh') ||
        t.includes('tra cứu') ||
        t.includes('voice') ||
        t.includes('micro')
      ) return false;

      return (
        b.id === 'composer-submit-button' ||
        b.testid === 'send-button' ||
        t.includes('send-button') ||
        t.includes('composer-submit') ||
        t.includes('gửi lời nhắc') ||
        t === 'send' ||
        t === 'gửi'
      );
    });

    const sendButton = sendCandidates
      .sort((a, b) => (b.rect.y - a.rect.y) || (b.rect.x - a.rect.x))[0] || null;

    const assistantRoots = [
      ...document.querySelectorAll('[data-message-author-role="assistant"]'),
      ...document.querySelectorAll('article')
    ].filter((el) => {
      const r = el.getBoundingClientRect();
      const txt = norm(el.innerText || el.textContent);
      return r.width > 50 && r.height > 20 && txt.length > 0;
    });

    return {
      ok: true,
      url: location.href,
      path: location.pathname,
      title: document.title,
      composerFound: Boolean(composer),
      composerTextLength: composerText.length,
      composerTextHead: composerText.slice(0, 900),
      composerHasText: composerText.length > 5,
      composerHasPrompt: /SCENE\\s*0?\\d+|NHIỆM VỤ|TẠO ẢNH|Create exactly one image|Dựa trên ảnh keyframe|MOTION PROMPT|NỘI DUNG CHUYỂN ĐỘNG/i.test(composerText),
      stopVisible: Boolean(stopButton),
      sendReady: Boolean(sendButton),
      sendButton,
      sendCandidates: sendCandidates.slice(-10),
      assistantRootCount: assistantRoots.length,
      latestAssistantText: assistantRoots.length ? norm(assistantRoots[assistantRoots.length - 1].innerText || assistantRoots[assistantRoots.length - 1].textContent).slice(0, 900) : '',
      buttonTail: buttons.slice(-18),
    };
  })()\`).catch((error) => ({
    ok: false,
    error: error.message,
    context,
  }));
}

async function vidoraClickChatGptRealSendButton(client, state) {
  const rect = state?.sendButton?.rect;
  if (!rect) return { ok: false, error: 'send-button-not-found', state };

  const x = Math.round(rect.x + rect.w / 2);
  const y = Math.round(rect.y + rect.h / 2);

  await client.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y, button: 'none' }).catch(() => null);
  await sleep(120);
  await client.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 }).catch(() => null);
  await sleep(90);
  await client.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }).catch(() => null);

  return { ok: true, x, y, sendButton: state.sendButton };
}

async function vidoraChatGptInputGate(client, context = {}) {
  let state = await vidoraReadChatGptComposerStateReal(client, context);

  await appendAppLog(null, {
    source: 'main',
    kind: 'running',
    text: 'ChatGPT INPUT GATE: check khung input trước khi chuyển bước.',
    details: { context, state },
  }).catch(() => null);

  if (!state?.ok) {
    throw new Error(\`chatgpt-input-gate-read-failed: \${state?.error || 'unknown'}\`);
  }

  // Đang có nút Stop => đã gửi thật và ChatGPT đang chạy.
  if (state.stopVisible) {
    return { ok: true, mode: 'stop-visible-running', state };
  }

  // Input trống + có assistant message => có thể chuyển bước.
  if (!state.composerHasText && state.assistantRootCount > 0) {
    return { ok: true, mode: 'input-empty-assistant-exists', state };
  }

  // Input trống nhưng chưa có assistant message => chưa chắc đã gửi, dừng.
  if (!state.composerHasText && state.assistantRootCount === 0) {
    await appendAppLog(null, {
      source: 'main',
      kind: 'error',
      text: 'ChatGPT INPUT GATE FAIL: input trống nhưng chưa có assistant message mới; không được chờ ảnh/NV2.',
      details: { context, state },
    }).catch(() => null);

    throw new Error('chatgpt-input-empty-but-no-assistant-message');
  }

  // Còn chữ trong input => chưa gửi hoặc gửi lỗi. Retry send thật.
  if (state.composerHasText) {
    await appendAppLog(null, {
      source: 'main',
      kind: 'error',
      text: 'ChatGPT INPUT GATE: input còn nội dung => prompt chưa gửi hoặc gửi lỗi. Retry nút gửi thật.',
      details: { context, state },
    }).catch(() => null);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      state = await vidoraReadChatGptComposerStateReal(client, { ...context, attempt });
      const click = await vidoraClickChatGptRealSendButton(client, state);

      await sleep(1800);

      const after = await vidoraReadChatGptComposerStateReal(client, { ...context, attempt, afterClick: true });

      await appendAppLog(null, {
        source: 'main',
        kind: (!after.composerHasText || after.stopVisible) ? 'ok' : 'error',
        text: (!after.composerHasText || after.stopVisible)
          ? \`ChatGPT INPUT GATE: retry \${attempt} gửi được; input đã trống hoặc ChatGPT đang chạy.\`
          : \`ChatGPT INPUT GATE: retry \${attempt} vẫn chưa gửi; input còn nội dung.\`,
        details: { context, attempt, click, after },
      }).catch(() => null);

      if (after.stopVisible) {
        return { ok: true, mode: 'running-after-retry', attempt, after };
      }

      if (!after.composerHasText && after.assistantRootCount > 0) {
        return { ok: true, mode: 'input-empty-after-retry', attempt, after };
      }

      if (!after.composerHasText && after.assistantRootCount === 0) {
        await sleep(2500);
        const later = await vidoraReadChatGptComposerStateReal(client, { ...context, attempt, later: true });
        if (later.stopVisible || later.assistantRootCount > 0) {
          return { ok: true, mode: 'later-after-retry', attempt, later };
        }
      }
    }

    const finalState = await vidoraReadChatGptComposerStateReal(client, { ...context, final: true });

    await appendAppLog(null, {
      source: 'main',
      kind: 'error',
      text: 'ChatGPT INPUT GATE FAIL: input vẫn còn nội dung sau 3 lần retry. Dừng để tránh chạy sai.',
      details: { context, finalState },
    }).catch(() => null);

    throw new Error('chatgpt-input-still-has-text-after-retries');
  }

  return { ok: true, mode: 'safe-fallback', state };
}

async function vidoraClearChatGptInputBeforePaste(client, context = {}) {
  const state = await vidoraReadChatGptComposerStateReal(client, context);
  if (!state?.ok || !state.composerHasText) return { ok: true, skipped: true, state };

  await appendAppLog(null, {
    source: 'main',
    kind: 'running',
    text: 'ChatGPT INPUT GATE: trước khi paste prompt mới, input đang có nội dung cũ; xóa sạch.',
    details: { context, state },
  }).catch(() => null);

  const cleared = await evaluateOnCdpPage(client, \`(() => {
    const composer =
      document.querySelector('#prompt-textarea') ||
      document.querySelector('textarea') ||
      document.querySelector('[contenteditable="true"]');

    if (!composer) return { ok: false, error: 'composer-not-found' };

    composer.focus();

    if ('value' in composer) {
      composer.value = '';
      composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
      composer.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      composer.textContent = '';
      composer.innerHTML = '';
      composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    }

    const after = String(composer.value || composer.innerText || composer.textContent || '').trim();

    return {
      ok: after.length === 0,
      afterLength: after.length,
      afterHead: after.slice(0, 300),
    };
  })()\`).catch((error) => ({ ok: false, error: error.message }));

  await appendAppLog(null, {
    source: 'main',
    kind: cleared?.ok ? 'ok' : 'error',
    text: cleared?.ok
      ? 'ChatGPT INPUT GATE: đã xóa sạch input cũ.'
      : 'ChatGPT INPUT GATE: xóa input cũ thất bại.',
    details: { context, cleared },
  }).catch(() => null);

  return cleared;
}
`;

insertBefore('async function waitForChatGptImageGenerationDoneBeforeExtract', helper, 'VIDORA_CHATGPT_INPUT_GATE_REAL');

// Clear input cũ trước khi focus/paste prompt mới.
replaceOnce(
  /(let focused = await evaluateOnCdpPage\(client,\s*`\(\$\{focusPromptInputScript\.toString\(\)\}\)\(\)`\);)/,
  `await vidoraClearChatGptInputBeforePaste(client, {
    stage: 'before-focus-prompt',
    sceneId: typeof sceneId !== 'undefined' ? sceneId : (context?.sceneId || options?.sceneId || ''),
  }).catch(() => null);

  $1`,
  'insert clear input before focus'
);

// Sau send image prompt ok: check input.
replaceOnce(
  /(await appendAppLog\(null,\s*\{\s*source:\s*'main',\s*kind:\s*'ok',\s*text:\s*`Scene \$\{sceneId\}: ChatGPT send image prompt ok`[\s\S]*?\}\)\.catch\(\(\) => null\);)/,
  `$1

  await vidoraChatGptInputGate(client, {
    sceneId,
    stage: 'after-nv1-send-image-prompt-ok',
  });`,
  'insert input gate after NV1 send ok'
);

// Trước khi chờ extract ảnh: check input.
replaceOnce(
  /(await appendAppLog\(null,\s*\{\s*source:\s*'main',\s*kind:\s*'running',\s*text:\s*`chatgptImageExtract: waiting for latest assistant image for scene \$\{sceneId\}`[\s\S]*?\}\)\.catch\(\(\) => null\);)/,
  `$1

  await vidoraChatGptInputGate(client, {
    sceneId,
    stage: 'before-image-extract-wait',
  });`,
  'insert input gate before image extract wait'
);

// Trước settle/extract cuối: check input.
replaceOnce(
  /(await appendAppLog\(null,\s*\{\s*source:\s*'main',\s*kind:\s*'running',\s*text:\s*`Scene \$\{options\.sceneId\}: ChatGPT stop button gone; waiting 4s for final image to settle before extract\.`[\s\S]*?\}\)\.catch\(\(\) => null\);)/,
  `await vidoraChatGptInputGate(client, {
        sceneId: options?.sceneId || '',
        stage: 'before-final-image-settle',
      });

      $1`,
  'insert input gate before final image settle'
);

// Trước khi chờ NV2: check input.
replaceOnce(
  /(await appendAppLog\(null,\s*\{\s*source:\s*'main',\s*kind:\s*'running',\s*text:\s*`Scene \$\{sceneId\}: chờ ChatGPT hoàn tất NV2)/,
  `await vidoraChatGptInputGate(client, {
        sceneId,
        stage: 'before-nv2-wait',
      });

      $1`,
  'insert input gate before NV2 wait'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: installed real ChatGPT INPUT GATE');
console.log('Backup:', backup);
