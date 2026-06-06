const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_click_existing_chat_before_modal`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

const helper = `
/* VIDORA_CLICK_EXISTING_CHAT_BEFORE_MODAL */
async function vidoraClickExistingChatByTitle(page, title, context = {}) {
  const target = String(title || '').trim();
  if (!target) return { ok: false, skipped: true, reason: 'empty-title' };

  return await evaluateOnCdpPage(page, \`(async () => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const norm = (v) => String(v || '').trim().replace(/\\\\s+/g, ' ').toLowerCase();
    const wanted = norm(\${JSON.stringify(target)});

    const candidates = [...document.querySelectorAll('a, button, [role="button"], [data-testid], div')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const text = String(el.innerText || el.textContent || '').trim().replace(/\\\\s+/g, ' ');
        return {
          el,
          text,
          n: norm(text),
          visible: r.width > 20 && r.height > 12 && r.bottom > 0 && r.top < innerHeight,
          box: { x: r.x, y: r.y, w: r.width, h: r.height },
        };
      })
      .filter(x => x.visible && x.text);

    // Ưu tiên exact title trong sidebar recent.
    let hit = candidates.find(x => x.n === wanted);

    // Fallback contains nhưng tránh text dài toàn trang.
    if (!hit) {
      hit = candidates.find(x => x.n.includes(wanted) && x.text.length <= Math.max(80, target.length + 20));
    }

    if (!hit) {
      return {
        ok: false,
        reason: 'existing-chat-title-not-clickable',
        target,
        sample: candidates.slice(0, 40).map(x => ({ text: x.text.slice(0, 120), box: x.box })),
      };
    }

    hit.el.scrollIntoView({ block: 'center', inline: 'nearest' });
    await sleep(250);
    hit.el.click();
    await sleep(1800);

    return {
      ok: true,
      target,
      clickedText: hit.text,
      location: location.href,
      title: document.title,
    };
  })()\`).catch((error) => ({ ok: false, error: error.message, target, context }));
}
`;

if (!s.includes('VIDORA_CLICK_EXISTING_CHAT_BEFORE_MODAL')) {
  const marker = 'async function vidoraReadChatGptComposerStateReal';
  const idx = s.indexOf(marker);
  if (idx < 0) {
    console.error('FAIL: marker not found:', marker);
    process.exit(1);
  }
  s = s.slice(0, idx) + helper + '\n' + s.slice(idx);
  console.log('OK: inserted existing-chat click helper');
} else {
  console.log('SKIP: helper exists');
}

// Chèn trước chỗ renderer báo cần chọn cách xử lý chat.
// Tìm dòng log "Cần chọn cách xử lý đoạn chat ChatGPT".
const needle = 'Cần chọn cách xử lý đoạn chat ChatGPT';
if (!s.includes('HOOK_CLICK_EXISTING_CHAT_BEFORE_CHAT_CHOICE_MODAL')) {
  const idx = s.indexOf(needle);
  if (idx < 0) {
    console.error('FAIL: cannot find modal needle');
    process.exit(1);
  }

  const appendStart = s.lastIndexOf('await notifyRenderer', idx);
  const insertAt = appendStart > 0 ? appendStart : s.lastIndexOf('await appendAppLog', idx);

  if (insertAt < 0) {
    console.error('FAIL: cannot find insertion point before chat choice modal');
    process.exit(1);
  }

  const hook = `
// HOOK_CLICK_EXISTING_CHAT_BEFORE_CHAT_CHOICE_MODAL
  {
    const existingTitle =
      String(chatContextTitle || '').trim() ||
      String(pendingChatRenameTitle || globalThis.__vidoraPendingChatRenameTitleSafe || '').trim() ||
      String(projectName || '').trim();

    const clickedExisting = await vidoraClickExistingChatByTitle(page, existingTitle, {
      stage: 'before-chat-choice-modal',
      sceneId: typeof sceneId !== 'undefined' ? sceneId : '',
    });

    await appendAppLog(null, {
      source: 'main',
      kind: clickedExisting?.ok ? 'ok' : 'running',
      text: clickedExisting?.ok
        ? \`ChatGPT existing chat found: đã vào đoạn chat "\${existingTitle}" trước khi hỏi option.\`
        : \`ChatGPT existing chat not clicked before modal: \${clickedExisting?.reason || clickedExisting?.error || 'unknown'}\`,
      details: clickedExisting,
    }).catch(() => null);

    if (clickedExisting?.ok) {
      chatContextTitle = existingTitle;
      pendingChatRenameTitle = '';
      globalThis.__vidoraPendingChatRenameTitleSafe = existingTitle;
    } else {
`;

  const closeHook = `
    }
  }
`;

  // Bọc block modal hiện tại: chèn hook mở trước modal, và đóng ngay trước throw/reject nếu có quá khó.
  // Cách an toàn: nếu click ok thì return false bằng cách set title; modal code sau vẫn có thể chạy nếu không check.
  // Vì vậy thêm early continue bằng replace cụ thể sau append log khó đoán không an toàn.
  s = s.slice(0, insertAt) + hook + s.slice(insertAt);

  // Đóng block ngay trước dòng "Chọn cách dùng ChatGPT trước"
  const secondNeedle = 'Chọn cách dùng ChatGPT trước';
  const idx2 = s.indexOf(secondNeedle, insertAt + hook.length);
  if (idx2 > 0) {
    const afterSecondAppend = s.indexOf('}).catch(() => null);', idx2);
    if (afterSecondAppend > 0) {
      s = s.slice(0, afterSecondAppend + '}).catch(() => null);'.length) + closeHook + s.slice(afterSecondAppend + '}).catch(() => null);'.length);
    }
  }

  console.log('OK: inserted click existing chat before modal hook');
} else {
  console.log('SKIP: modal hook exists');
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE');
console.log('Backup:', backup);
