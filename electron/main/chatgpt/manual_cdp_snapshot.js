"use strict";

const { evaluateOnCdpPage } = require("./chatgpt_core");
const { withManualDeadline } = require("./manual_operation_deadline");

// Runs inside ChatGPT's page. The site uses different turn wrappers across
// accounts, so message-author attributes cannot be the only source of turns.
function findManualConversationTurns() {
  const conversationKey = String(location.pathname || '').match(/\/c\/([^/?#]+)/)?.[1] || 'new';
  const roleOf = (node) => {
    const explicit = String(node.getAttribute?.('data-message-author-role') || node.getAttribute?.('data-role') || '').toLowerCase();
    if (explicit === 'user' || explicit === 'assistant') return explicit;
    const testId = String(node.getAttribute?.('data-testid') || '').toLowerCase();
    if (/user-message|conversation-turn-user/.test(testId)) return 'user';
    if (/assistant-message|conversation-turn-assistant/.test(testId)) return 'assistant';
    if (node.matches?.('.whitespace-pre-wrap, [class*="whitespace-pre-wrap"]')) return 'user';
    if (node.matches?.('.markdown, [class*="markdown"]')) return 'assistant';
    if (node.querySelector?.('[data-testid="user-message"], [data-message-author-role="user"]')) return 'user';
    if (node.querySelector?.('[data-testid="assistant-message"], [data-message-author-role="assistant"]')) return 'assistant';
    const userBody = node.querySelector?.('.whitespace-pre-wrap');
    const assistantBody = node.querySelector?.('.markdown, [class*="markdown"]');
    if (userBody && !assistantBody) return 'user';
    if (assistantBody && !userBody) return 'assistant';
    return '';
  };
  const hash = (value) => {
    let number = 2166136261;
    for (const character of String(value || '')) {
      number ^= character.charCodeAt(0);
      number = Math.imul(number, 16777619);
    }
    return (number >>> 0).toString(16);
  };
  const describe = (node) => {
    const role = roleOf(node);
    if (!role) return null;
    const content = node.querySelector?.(role === 'user' ? '[data-testid="user-message"]' : '[data-testid="assistant-message"]') || node;
    const explicitRole = node.getAttribute?.('data-message-author-role');
    const textRoot = explicitRole ? node : content;
    const text = String(textRoot.textContent || textRoot.innerText || '').trim();
    const idNode = node.closest?.('[data-message-id], [data-turn-id]') ||
      node.querySelector?.('[data-message-id], [data-turn-id]') || node;
    let id = String(idNode.getAttribute?.('data-message-id') || idNode.getAttribute?.('data-turn-id') ||
      node.getAttribute?.('data-message-id') || node.getAttribute?.('data-turn-id') || '').trim();
    if (!id) {
      const turnKey = String(node.getAttribute?.('data-testid') || node.closest?.('[data-testid^="conversation-turn-"]')?.getAttribute?.('data-testid') || '');
      const media = [...(node.querySelectorAll?.('img, canvas') || [])]
        .find((image) => Number(image.naturalWidth || image.width || 0) >= 256);
      const signature = text || String(media?.currentSrc || media?.src || '');
      if (turnKey.startsWith('conversation-turn-')) id = 'manual-dom:' + conversationKey + ':' + role + ':' + turnKey;
      else if (signature) id = 'manual-dom:' + conversationKey + ':' + role + ':' + turnKey + ':' + hash(signature);
    }
    return { node, role, id, text };
  };
  const direct = [...document.querySelectorAll('[data-message-author-role="user"], [data-message-author-role="assistant"]')];
  const wrappers = [...document.querySelectorAll('[data-testid^="conversation-turn-"], main article')]
    .filter((node) => !node.parentElement?.closest?.('[data-testid^="conversation-turn-"]'));
  const turns = [];
  for (const node of [...wrappers, ...direct,
    ...document.querySelectorAll('[data-testid="user-message"], [data-testid="assistant-message"]'),
    ...document.querySelectorAll('main .whitespace-pre-wrap, main [class*="whitespace-pre-wrap"], main .markdown, main [class*="markdown"]')]) {
    if (turns.some((turn) => turn.node === node || turn.node.contains?.(node))) continue;
    const turn = describe(node);
    if (turn) turns.push(turn);
  }
  return turns.sort((left, right) => {
    const position = left.node.compareDocumentPosition?.(right.node) || 0;
    return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : position & Node.DOCUMENT_POSITION_PRECEDING ? 1 : 0;
  });
}

async function readManualConversationSnapshot(page, { signal, timeoutMs = 30000 } = {}) {
  if (!page) throw new Error("manual-observation-page-unavailable");
  const snapshot = await withManualDeadline(() => evaluateOnCdpPage(page, `(async () => {
    const pathname = String(location.pathname || '');
    const conversationId = pathname.match(/\\/c\\/([^/?#]+)/)?.[1] || '';
    const pageTitle = String(document.title || '');
    const loggedOut = /log in|sign in|sign up|đăng nhập|đăng ký/i.test(pageTitle) ||
      Boolean([...document.querySelectorAll('button, a')].find((node) => /log in|sign in|sign up|đăng nhập|đăng ký/i.test(String(node.textContent || '').trim())));
    const stopVisible = [...document.querySelectorAll('button')].some((button) => {
      const value = [button.getAttribute('aria-label'), button.getAttribute('data-testid'), button.textContent]
        .filter(Boolean).join(' ').toLowerCase();
      const box = button.getBoundingClientRect?.();
      return /stop|dừng|cancel generation/.test(value) &&
        (button.offsetParent !== null || (box?.width > 0 && box?.height > 0));
    });
    const turns = (${findManualConversationTurns.toString()})();
    const messages = turns.map(({ node, role, id, text }) => {
      // ChatGPT may split a long user prompt into several rendered blocks.
      // Reading only the first .whitespace-pre-wrap loses the ownership text.
      let attachmentRoot = node;
      if (role === 'user' && node.matches?.('.whitespace-pre-wrap, [class*="whitespace-pre-wrap"]')) {
        for (let parent = node.parentElement, depth = 0; parent && depth < 5; parent = parent.parentElement, depth += 1) {
          if (parent.matches?.('main, [role="main"]') ||
            parent.querySelector?.('[data-message-author-role="assistant"], [data-testid="assistant-message"], .markdown')) break;
          attachmentRoot = parent;
          if (parent.querySelector?.('[data-testid*="attachment"]')) break;
        }
      }
      const attachmentNames = [...attachmentRoot.querySelectorAll('[data-testid*="attachment"], [aria-label], [title], [role="button"]')]
        .map((item) => String(item.getAttribute('aria-label') || item.getAttribute('title') || item.textContent || '').trim())
        .flatMap((label) => label.match(/[\\w(). -]+\\.(?:txt|png|jpe?g|webp|pdf|docx?)/ig) || [])
        .map((name) => name.trim());
      const images = role === 'assistant'
        ? [...node.querySelectorAll('img, canvas')].map((image) => ({
            src: image.tagName === 'IMG' ? String(image.currentSrc || image.src || '') : '',
            width: Number(image.naturalWidth || image.width || image.clientWidth || 0),
            height: Number(image.naturalHeight || image.height || image.clientHeight || 0),
          })).filter((image) => image.width >= 256 && image.height >= 256)
        : [];
      return { id, role, text, attachmentNames, images, settled: !stopVisible };
    });
    // Image generation is rendered in a separate agent-turn in current
    // ChatGPT. It is not a descendant of the logical assistant message, so a
    // message-only scan sees the prompt but misses the generated keyframe.
    const imageCardOf = (turn) => turn.getElementsByClassName?.('group/imagegen-image')[0] ||
      turn.querySelector?.('[class*="imagegen-image"], [data-testid*="imagegen"], [data-testid*="generated-image"]') ||
      (turn.matches?.('.agent-turn') && [...turn.querySelectorAll('img, canvas')].some((image) =>
        Number(image.naturalWidth || image.width || 0) >= 512 && Number(image.naturalHeight || image.height || 0) >= 512) ? turn : null);
    const latestUserRoot = turns.filter((turn) => turn.role === 'user').at(-1)?.node;
    const imageCards = [...new Set([...document.querySelectorAll('.agent-turn, [data-testid*="imagegen"], [data-testid*="generated-image"]')]
      .map(imageCardOf).filter(Boolean))];
    for (let index = 0; index < imageCards.length; index += 1) {
      const card = imageCards[index];
      const followsLatestUser = !latestUserRoot || Boolean(
        latestUserRoot.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
      if (!followsLatestUser) continue;
      const placeholderVisible = [...card.querySelectorAll('[role="progressbar"], [aria-busy="true"], [class*="animate-spin"], [data-testid*="loading"]')]
        .some((node) => node.getBoundingClientRect?.().width > 0 && node.getBoundingClientRect?.().height > 0);
      const images = [...card.querySelectorAll('img, canvas')].map((image) => ({
        tagName: image.tagName,
        src: image.tagName === 'IMG' ? String(image.currentSrc || image.src || '') : '',
        width: Number(image.naturalWidth || image.width || image.clientWidth || 0),
        height: Number(image.naturalHeight || image.height || image.clientHeight || 0),
        displayArea: Math.round((image.getBoundingClientRect?.().width || 0) * (image.getBoundingClientRect?.().height || 0)),
        complete: image.tagName === 'CANVAS' || Boolean(image.complete),
      })).filter((image) => image.width >= 256 && image.height >= 256);
      if (!images.length) continue;
      const ready = !placeholderVisible && images.some((image) =>
        image.complete && image.width >= 512 && image.height >= 512 && Boolean(image.src || image.tagName === 'CANVAS'));
      messages.push({
        // Keep the agent-turn index explicit: this is not a normal assistant
        // message id, and extraction must go back to the imagegen card.
        id: 'manual-imagegen:' + (conversationId || 'new') + ':' + index,
        role: 'assistant',
        text: '[ChatGPT generated keyframe image]',
        attachmentNames: [],
        images,
        generatedImageCard: true,
        ready,
        placeholderVisible,
        settled: !stopVisible,
      });
    }
    const latestAssistantRoot = turns.filter((turn) => turn.role === 'assistant').at(-1)?.node;
    const streaming = Boolean(latestAssistantRoot?.querySelector?.('[data-is-streaming="true"], .result-streaming, [aria-busy="true"]'));
    const domProbe = {
      authorRoleNodes: document.querySelectorAll('[data-message-author-role]').length,
      conversationTurnNodes: document.querySelectorAll('[data-testid^="conversation-turn-"]').length,
      articleNodes: document.querySelectorAll('main article').length,
      userMessageNodes: document.querySelectorAll('[data-testid="user-message"]').length,
      assistantMessageNodes: document.querySelectorAll('[data-testid="assistant-message"]').length,
    };
    return { conversationId, pathname, pageTitle, loggedOut, generating: stopVisible || streaming, messages, domProbe };
  })()`), { timeoutMs, signal, label: "manual-snapshot" });
  return { ...snapshot, pageId: page.pageId || "" };
}

async function extractOwnedAssistantImage(page, assistantTurnId, { signal, timeoutMs = 70000 } = {}) {
  if (!page || !String(assistantTurnId || "").trim()) {
    throw new Error("manual-owned-assistant-id-required");
  }
  const result = await withManualDeadline(() => evaluateOnCdpPage(page, `(async () => {
    const wantedId = ${JSON.stringify(String(assistantTurnId))};
    let root = null;
    if (wantedId.startsWith('manual-imagegen:')) {
      const parts = wantedId.slice('manual-imagegen:'.length).split(':');
      const index = Number(parts.at(-1));
      const wantedConversation = parts.length > 1 ? parts.slice(0, -1).join(':') : '';
      const currentConversation = String(location.pathname || '').match(/\\/c\\/([^/?#]+)/)?.[1] || 'new';
      if (wantedConversation && wantedConversation !== currentConversation) return { ok: false, error: 'owned-assistant-conversation-changed' };
      const imageCardOf = (turn) => turn.getElementsByClassName?.('group/imagegen-image')[0] ||
        turn.querySelector?.('[class*="imagegen-image"], [data-testid*="imagegen"], [data-testid*="generated-image"]') ||
        (turn.matches?.('.agent-turn') && [...turn.querySelectorAll('img, canvas')].some((image) =>
          Number(image.naturalWidth || image.width || 0) >= 512 && Number(image.naturalHeight || image.height || 0) >= 512) ? turn : null);
      root = [...new Set([...document.querySelectorAll('.agent-turn, [data-testid*="imagegen"], [data-testid*="generated-image"]')]
        .map(imageCardOf).filter(Boolean))][index] || null;
    } else {
      root = (${findManualConversationTurns.toString()})()
        .find((turn) => turn.role === 'assistant' && turn.id === wantedId)?.node || null;
    }
    if (!root) return { ok: false, error: 'owned-assistant-turn-not-rendered' };
    const candidates = [...root.querySelectorAll('img, canvas')].map((image) => {
      const width = Number(image.naturalWidth || image.width || image.clientWidth || 0);
      const height = Number(image.naturalHeight || image.height || image.clientHeight || 0);
      const rect = image.getBoundingClientRect?.();
      return { image, width, height, displayArea: Number(rect?.width || 0) * Number(rect?.height || 0) };
    }).filter((candidate) => candidate.width >= 256 && candidate.height >= 256)
      .sort((left, right) => (right.displayArea - left.displayArea) || ((right.width * right.height) - (left.width * left.height)));
    const image = candidates[0]?.image;
    if (!image) return { ok: false, error: 'owned-assistant-image-not-found' };
    if (image.tagName === 'CANVAS') {
      return { ok: true, base64: image.toDataURL('image/png').replace(/^data:image\\/[^;]+;base64,/, '') };
    }
    const src = String(image.currentSrc || image.src || '');
    if (!src) return { ok: false, error: 'owned-assistant-image-src-missing' };
    if (src.startsWith('data:image/')) {
      return { ok: true, base64: src.replace(/^data:image\\/[^;]+;base64,/, '') };
    }
    const fetchController = new AbortController();
    const fetchTimer = setTimeout(() => fetchController.abort(), 20000);
    let bytes;
    try {
      const response = await fetch(src, { credentials: 'include', cache: 'no-store', signal: fetchController.signal });
      if (!response.ok) return { ok: false, error: 'owned-assistant-image-fetch-' + response.status, src };
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      return { ok: false, error: error?.name === 'AbortError' ? 'owned-assistant-image-fetch-timeout' : 'owned-assistant-image-fetch-failed', src };
    } finally {
      clearTimeout(fetchTimer);
    }
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return { ok: true, base64: btoa(binary) };
  })()`), { timeoutMs, signal, label: "manual-image-extraction" });
  // A generated image CDN may allow display in Chrome while blocking page
  // fetch through CORS. BrowserContext.request shares the same session cookies
  // and reads only the URL taken from the proven assistant image element.
  if (!result?.ok && result?.src && /^https:\/\//i.test(result.src)) {
    const request = page.page?.context?.()?.request;
    if (request?.get) {
      try {
        const response = await withManualDeadline(
          () => request.get(result.src, { timeout: 45000, failOnStatusCode: false }),
          { timeoutMs: 47000, signal, label: "manual-image-context-fetch" },
        );
        if (response.ok()) {
          const bytes = await withManualDeadline(
            () => response.body(),
            { timeoutMs: 47000, signal, label: "manual-image-context-body" },
          );
          if (bytes?.length && bytes.length <= 40 * 1024 * 1024) return Buffer.from(bytes);
        }
      } catch (error) {
        if (error?.code === "MANUAL_OPERATION_CANCELLED") throw error;
      }
    }
  }
  if (!result?.ok || !result.base64) {
    const error = new Error(result?.error || "manual-owned-assistant-image-unavailable");
    error.code = "UNPROVEN";
    throw error;
  }
  return Buffer.from(result.base64, "base64");
}

module.exports = {
  readManualConversationSnapshot,
  extractOwnedAssistantImage,
};
