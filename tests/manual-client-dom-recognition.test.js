"use strict";

const assert = require("assert");
const vm = require("vm");
const { readManualConversationSnapshot, extractOwnedAssistantImage } = require("../electron/main/chatgpt/manual_cdp_snapshot");

function createPage({ cardClass = "group/imagegen-image", busyOutsideTurn = false, idAttribute = "data-message-id" } = {}) {
  const image = {
    tagName: "IMG",
    currentSrc: "data:image/png;base64,AAEC",
    naturalWidth: 1024,
    naturalHeight: 1024,
    complete: true,
    getBoundingClientRect: () => ({ width: 180, height: 180 }),
  };
  const card = {
    querySelectorAll: (selector) => selector === "img, canvas" ? [image] : [],
  };
  const user = {
    textContent: "The entire manual scene prompt, including the second paragraph and all instructions.",
    innerText: "The entire manual scene prompt, including the second paragraph and all instructions.",
    getAttribute: (name) => name === idAttribute ? "user-1" : name === "data-message-author-role" ? "user" : "",
    closest: () => user,
    querySelector: () => ({ innerText: "The first paragraph only." }),
    querySelectorAll: () => [],
    compareDocumentPosition: () => 4,
  };
  const imageTurn = {
    getElementsByClassName: (name) => name === cardClass ? [card] : [],
    querySelector: (selector) => cardClass !== "plain-agent-turn" &&
      (selector.includes("imagegen-image") || selector.includes("generated-image")) ? card : null,
    querySelectorAll: (selector) => selector === "img, canvas" ? [image] : [],
    matches: (selector) => selector === ".agent-turn",
  };
  const document = {
    title: "ChatGPT",
    querySelectorAll(selector) {
      if (selector === "button, a" || selector === "button") return [];
      if (selector.includes("data-message-author-role")) return [user];
      if (selector.includes(".agent-turn")) return [imageTurn];
      return [];
    },
    querySelector: (selector) => busyOutsideTurn && selector.includes("aria-busy") ? {} : null,
  };
  return {
    clientType: "playwright",
    pageId: "client-page",
    evaluate: (expression) => vm.runInNewContext(expression, {
      document,
      location: { pathname: "/c/client-conversation" },
      Node: { DOCUMENT_POSITION_FOLLOWING: 4 },
    }),
  };
}

function createWrapperlessPage({ stage = "NV1" } = {}) {
  const prompt = stage === "NV1" ? "Tạo ảnh theo file sau: scene_001_nv1_request.txt"
    : "Tạo motion prompt theo file sau: scene_001_nv2_request.txt";
  const chips = (stage === "NV1"
    ? ["Document scene_001_nv1_request(20260928-2010).txt"]
    : ["Document scene_001_nv2_request(2).txt", "scene_001_keyframe.png"])
    .map((name) => ({ textContent: name, getAttribute: () => "" }));
  const parent = {
    parentElement: null,
    matches: () => false,
    querySelector: (selector) => selector === '[data-testid*="attachment"]' ? chips[0] : null,
    querySelectorAll: () => chips,
  };
  const user = {
    textContent: prompt, parentElement: parent,
    matches: (selector) => selector.includes("whitespace-pre-wrap"),
    getAttribute: () => "",
    closest: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    compareDocumentPosition: () => 4,
  };
  const image = {
    tagName: "IMG", currentSrc: "data:image/png;base64,AAEC", naturalWidth: 1024,
    naturalHeight: 1024, complete: true,
    getBoundingClientRect: () => ({ width: 300, height: 300 }),
  };
  const card = { querySelectorAll: (selector) => selector === "img, canvas" ? [image] : [] };
  const imageTurn = {
    getElementsByClassName: (name) => name === "group/imagegen-image" ? [card] : [],
    querySelectorAll: (selector) => selector === "img, canvas" ? [image] : [],
    matches: (selector) => selector === ".agent-turn",
  };
  const assistant = {
    textContent: "Scene 1 Camera panning slowly across wide cinematic horizon with golden hour sunlight shining through thick forest trees and soft dust particles floating in quiet warm air.",
    matches: (selector) => selector.includes(".markdown") && !selector.includes("whitespace-pre-wrap"),
    getAttribute: () => "",
    closest: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    compareDocumentPosition: () => 2,
  };
  const document = {
    title: "ChatGPT",
    querySelectorAll(selector) {
      if (selector.includes("main .whitespace-pre-wrap")) return stage === "NV1" ? [user] : [user, assistant];
      if (selector.includes(".agent-turn")) return stage === "NV1" ? [imageTurn] : [];
      return [];
    },
    querySelector: () => null,
  };
  return {
    clientType: "playwright", pageId: "new-tab",
    evaluate: (expression) => vm.runInNewContext(expression, {
      document, location: { pathname: "/c/new-conversation" },
      Node: { DOCUMENT_POSITION_FOLLOWING: 4, DOCUMENT_POSITION_PRECEDING: 2 },
    }),
  };
}

(async () => {
  for (const cardClass of ["group/imagegen-image", "generated-image-card", "plain-agent-turn"]) {
    const page = createPage({ cardClass, busyOutsideTurn: true, idAttribute: cardClass === "plain-agent-turn" ? "data-turn-id" : "data-message-id" });
    const snapshot = await readManualConversationSnapshot(page);
    assert.equal(snapshot.conversationId, "client-conversation");
    assert.equal(snapshot.generating, false, "an unrelated busy element must not block manual recognition");
    assert.equal(snapshot.messages[0].id, "user-1", "stable alternate turn IDs must remain usable for ownership");
    assert.equal(snapshot.messages[0].text.includes("second paragraph"), true, "user prompt must retain all paragraphs");
    const image = snapshot.messages.find((message) => message.generatedImageCard);
    assert(image, `image card ${cardClass} must be recognized`);
    assert.equal(image.ready, true, "a full-size image remains ready at narrow window or high DPI");
    const bytes = await extractOwnedAssistantImage(page, image.id);
    assert.equal(bytes.toString("hex"), "000102", "extraction must find the same generated card");
  }
  const wrapperlessPage = createWrapperlessPage();
  const wrapperless = await readManualConversationSnapshot(wrapperlessPage);
  assert.equal(wrapperless.messages[0].role, "user", "a plain ChatGPT prompt bubble must be recognized without turn attributes");
  assert.equal(wrapperless.messages[0].text, "Tạo ảnh theo file sau: scene_001_nv1_request.txt");
  assert.deepEqual(Array.from(wrapperless.messages[0].attachmentNames), ["Document scene_001_nv1_request(20260928-2010).txt"]);
  assert.equal(wrapperless.messages[1].id, "manual-imagegen:new-conversation:0");
  assert.equal((await extractOwnedAssistantImage(wrapperlessPage, wrapperless.messages[1].id)).toString("hex"), "000102");
  const nv2 = await readManualConversationSnapshot(createWrapperlessPage({ stage: "NV2" }));
  assert.deepEqual(Array.from(nv2.messages, ({ role }) => role), ["user", "assistant"]);
  assert.deepEqual(Array.from(nv2.messages[0].attachmentNames), ["Document scene_001_nv2_request(2).txt", "scene_001_keyframe.png"]);
  assert.match(nv2.messages[1].text, /Camera panning slowly/);
  const cdnFallback = {
    clientType: "playwright",
    evaluate: async () => ({ ok: false, error: "owned-assistant-image-fetch-failed", src: "https://cdn.example.test/owned-image.png" }),
    page: { context: () => ({ request: { get: async (url) => {
      assert.equal(url, "https://cdn.example.test/owned-image.png");
      return { ok: () => true, body: async () => Buffer.from([3, 4, 5]) };
    } } }) },
  };
  assert.equal((await extractOwnedAssistantImage(cdnFallback, "assistant-1")).toString("hex"), "030405",
    "a displayed generated image must still save when browser-side CDN fetch is blocked by CORS");
  console.log("Manual recognition handles client DOM variants and compact image previews");
})().catch((error) => { console.error(error); process.exitCode = 1; });
