"use strict";

const assert = require("assert");
const vm = require("vm");
const { readManualConversationSnapshot, extractOwnedAssistantImage } = require("../electron/main/chatgpt/manual_cdp_snapshot");

function createPage({ withAssistant = false, generating = false } = {}) {
  const image = {
    tagName: "IMG", currentSrc: "data:image/png;base64,AAEC", naturalWidth: 1024,
    naturalHeight: 1024, complete: true,
    getBoundingClientRect: () => ({ width: 300, height: 300 }),
  };
  const prompt = "Tạo ảnh theo file sau: scene_001_nv1_request.txt";
  const userBody = { textContent: prompt, getAttribute: () => "", querySelector: () => null, querySelectorAll: () => [] };
  const assistantBody = { textContent: "", getAttribute: () => "", querySelector: () => null, querySelectorAll: () => [] };
  const makeTurn = (index, role, body) => ({
    textContent: body.textContent,
    parentElement: null,
    getAttribute: (name) => name === "data-testid" ? `conversation-turn-${index}` : "",
    closest: () => null,
    contains: (node) => node === body,
    compareDocumentPosition: (node) => index < Number(node.getAttribute("data-testid").split("-").at(-1)) ? 4 : 2,
    querySelector: (selector) => selector.includes(`[data-testid="${role}-message"]`) ||
      (role === "user" && selector === ".whitespace-pre-wrap") ||
      (role === "assistant" && selector.includes(".markdown")) ? body : null,
    querySelectorAll: (selector) => selector === "img, canvas" && role === "assistant" ? [image] : [],
  });
  const userTurn = makeTurn(0, "user", userBody);
  const assistantTurn = makeTurn(1, "assistant", assistantBody);
  const turns = withAssistant ? [userTurn, assistantTurn] : [userTurn];
  const stop = {
    textContent: "", offsetParent: {}, getAttribute: (name) => name === "aria-label" ? "Stop generating" : "",
    getBoundingClientRect: () => ({ width: 20, height: 20 }),
  };
  const document = {
    title: "ChatGPT",
    querySelectorAll(selector) {
      if (selector === "button, a" || selector === "button") return generating ? [stop] : [];
      if (selector === '[data-testid^="conversation-turn-"], main article' ||
          selector === '[data-testid^="conversation-turn-"]' || selector === "main article") return turns;
      if (selector === '[data-testid="user-message"]') return [userBody];
      if (selector === '[data-testid="assistant-message"]') return withAssistant ? [assistantBody] : [];
      if (selector === '[data-testid="user-message"], [data-testid="assistant-message"]')
        return withAssistant ? [userBody, assistantBody] : [userBody];
      return [];
    },
    querySelector: () => null,
  };
  return {
    clientType: "playwright", pageId: "customer-page",
    evaluate: (expression) => vm.runInNewContext(expression, {
      document, location: { pathname: "/c/customer-conversation" },
      Node: { DOCUMENT_POSITION_FOLLOWING: 4, DOCUMENT_POSITION_PRECEDING: 2 },
    }),
  };
}

(async () => {
  // The customer screenshot has a sent user prompt and a visible Stop button,
  // but no data-message-author-role attributes. It must not appear as 0 turns.
  const waiting = await readManualConversationSnapshot(createPage({ generating: true }));
  assert.equal(waiting.conversationId, "customer-conversation");
  assert.equal(waiting.generating, true);
  assert.equal(waiting.messages.length, 1);
  assert.equal(waiting.messages[0].role, "user");
  assert.equal(waiting.messages[0].text, "Tạo ảnh theo file sau: scene_001_nv1_request.txt");
  assert.equal(waiting.messages[0].id, "manual-dom:user:conversation-turn-0");

  const finishedPage = createPage({ withAssistant: true });
  const finished = await readManualConversationSnapshot(finishedPage);
  assert.deepEqual(Array.from(finished.messages, ({ role }) => role), ["user", "assistant"]);
  assert.equal(finished.messages[1].id, "manual-dom:assistant:conversation-turn-1");
  assert.equal((await extractOwnedAssistantImage(finishedPage, finished.messages[1].id)).toString("hex"), "000102");
  console.log("Manual observation recognizes customer turn wrappers without author-role attributes");
})().catch((error) => { console.error(error); process.exitCode = 1; });
