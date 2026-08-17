"use strict";

const assert = require("assert");
const {
  validateNv2ResponseOwnership,
} = require("../electron/main/chatgpt/chatgpt_pipeline");

const promptHash = "nv2-owned-hash";
const conversationId = "conversation-19";
const startedAt = 100000;

const exact = validateNv2ResponseOwnership({
  expectedPromptHash: promptHash,
  latestUserHash: promptHash,
  expectedConversationId: conversationId,
  currentConversationId: conversationId,
  expectedUserCount: 39,
  currentUserCount: 39,
  userHashes: [promptHash],
  now: startedAt,
});
assert.strictEqual(exact.ok, true);

const virtualized = validateNv2ResponseOwnership({
  expectedPromptHash: promptHash,
  latestUserHash: "previous-user-hash",
  expectedConversationId: conversationId,
  currentConversationId: conversationId,
  expectedUserCount: 39,
  currentUserCount: 38,
  userHashes: ["previous-user-hash"],
  now: startedAt,
  graceMs: 30000,
});
assert.strictEqual(virtualized.ok, false);
assert.strictEqual(virtualized.transient, true);
assert.strictEqual(
  virtualized.error,
  "nv2-user-message-ownership-virtualized-during-response-wait",
);
assert.strictEqual(virtualized.ownershipMissingSince, startedAt);

const stillVirtualized = validateNv2ResponseOwnership({
  expectedPromptHash: promptHash,
  latestUserHash: "previous-user-hash",
  expectedConversationId: conversationId,
  currentConversationId: conversationId,
  expectedUserCount: 39,
  currentUserCount: 38,
  userHashes: ["previous-user-hash"],
  ownershipMissingSince: startedAt,
  now: startedAt + 29999,
  graceMs: 30000,
});
assert.strictEqual(stillVirtualized.transient, true);

const graceExpired = validateNv2ResponseOwnership({
  expectedPromptHash: promptHash,
  latestUserHash: "previous-user-hash",
  expectedConversationId: conversationId,
  currentConversationId: conversationId,
  expectedUserCount: 39,
  currentUserCount: 38,
  userHashes: ["previous-user-hash"],
  ownershipMissingSince: startedAt,
  now: startedAt + 30001,
  graceMs: 30000,
});
assert.strictEqual(graceExpired.transient, undefined);
assert.strictEqual(
  graceExpired.error,
  "nv2-user-message-ownership-unavailable-after-virtualization-grace",
);

const supersededByNewPrompt = validateNv2ResponseOwnership({
  expectedPromptHash: promptHash,
  latestUserHash: "newer-user-hash",
  expectedConversationId: conversationId,
  currentConversationId: conversationId,
  expectedUserCount: 39,
  currentUserCount: 40,
  userHashes: [promptHash, "newer-user-hash"],
  now: startedAt,
});
assert.strictEqual(supersededByNewPrompt.transient, undefined);
assert.strictEqual(
  supersededByNewPrompt.error,
  "nv2-user-message-ownership-lost-during-response-wait",
);

const wrongConversation = validateNv2ResponseOwnership({
  expectedPromptHash: promptHash,
  latestUserHash: promptHash,
  expectedConversationId: conversationId,
  currentConversationId: "different-conversation",
  expectedUserCount: 39,
  currentUserCount: 39,
  userHashes: [promptHash],
});
assert.match(wrongConversation.error, /chatgpt-conversation-changed/);

const ownershipReturned = validateNv2ResponseOwnership({
  expectedPromptHash: promptHash,
  latestUserHash: promptHash,
  expectedConversationId: conversationId,
  currentConversationId: conversationId,
  expectedUserCount: 39,
  currentUserCount: 39,
  userHashes: [promptHash],
  ownershipMissingSince: startedAt,
  now: startedAt + 5000,
});
assert.strictEqual(ownershipReturned.ok, true);

console.log("ChatGPT NV2 ownership virtualization grace tests passed");
