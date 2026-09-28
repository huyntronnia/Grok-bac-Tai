"use strict";

const { evaluateOnCdpPage } = require("./chatgpt_core");
const { withManualDeadline } = require("./manual_operation_deadline");

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
    const roots = [...document.querySelectorAll('[data-message-author-role="user"], [data-message-author-role="assistant"]')];
    const messages = roots.map((node) => {
      const container = node.closest('[data-message-id], [data-turn-id]') ||
        node.querySelector('[data-message-id], [data-turn-id]') || node;
      const id = String(container.getAttribute('data-message-id') || container.getAttribute('data-turn-id') ||
        node.getAttribute('data-message-id') || node.getAttribute('data-turn-id') || '').trim();
      const role = String(node.getAttribute('data-message-author-role') || '').trim();
      // ChatGPT may split a long user prompt into several rendered blocks.
      // Reading only the first .whitespace-pre-wrap loses the ownership text.
      const text = String(node.textContent || node.innerText || '').trim();
      const attachmentNames = [...node.querySelectorAll('[data-testid*="attachment"], [aria-label], [title]')]
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
    const latestUserRoot = roots.filter((node) => node.getAttribute('data-message-author-role') === 'user').at(-1);
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
        id: 'manual-imagegen:' + index,
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
    const latestAssistantRoot = roots.filter((node) => node.getAttribute('data-message-author-role') === 'assistant').at(-1);
    const streaming = Boolean(latestAssistantRoot?.querySelector?.('[data-is-streaming="true"], .result-streaming, [aria-busy="true"]'));
    return { conversationId, pathname, pageTitle, loggedOut, generating: stopVisible || streaming, messages };
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
      const index = Number(wantedId.slice('manual-imagegen:'.length));
      const imageCardOf = (turn) => turn.getElementsByClassName?.('group/imagegen-image')[0] ||
        turn.querySelector?.('[class*="imagegen-image"], [data-testid*="imagegen"], [data-testid*="generated-image"]') ||
        (turn.matches?.('.agent-turn') && [...turn.querySelectorAll('img, canvas')].some((image) =>
          Number(image.naturalWidth || image.width || 0) >= 512 && Number(image.naturalHeight || image.height || 0) >= 512) ? turn : null);
      root = [...new Set([...document.querySelectorAll('.agent-turn, [data-testid*="imagegen"], [data-testid*="generated-image"]')]
        .map(imageCardOf).filter(Boolean))][index] || null;
    } else {
      const roots = [...document.querySelectorAll('[data-message-author-role="assistant"]')];
      root = roots.find((node) => {
        const container = node.closest('[data-message-id], [data-turn-id]') ||
          node.querySelector('[data-message-id], [data-turn-id]') || node;
        return String(container.getAttribute('data-message-id') || container.getAttribute('data-turn-id') ||
          node.getAttribute('data-message-id') || node.getAttribute('data-turn-id') || '') === wantedId;
      });
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
