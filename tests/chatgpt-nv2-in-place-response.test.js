"use strict";

const assert = require("assert");
const {
  extractCompletedNv2ResponseFromSnapshot,
  hashChatGptSnapshotText,
} = require("../electron/main/state/state");

const readyText = "Ready.";
const motionText = "Mô tả ngắn gọn: ".padEnd(8917, "x");
const baseline = {
  count: 2,
  text: readyText,
  ids: ["assistant-1", "assistant-reused"],
  hashes: [hashChatGptSnapshotText("Earlier"), hashChatGptSnapshotText(readyText)],
  maxTurnIndex: 5,
};
const inPlaceSnapshot = {
  count: 2,
  composerBusy: false,
  streamingIndicator: false,
  activeGenerationMarker: false,
  generationActive: false,
  messages: [
    {
      id: "assistant-1",
      hash: hashChatGptSnapshotText("Earlier"),
      text: "Earlier",
      turnIndex: 1,
      index: 0,
    },
    {
      id: "assistant-reused",
      hash: hashChatGptSnapshotText(motionText),
      text: motionText,
      turnIndex: 3,
      index: 1,
    },
  ],
};

const rejectedWithoutOwnership = extractCompletedNv2ResponseFromSnapshot(
  inPlaceSnapshot,
  baseline,
);
assert.strictEqual(rejectedWithoutOwnership.ok, false);
assert.strictEqual(rejectedWithoutOwnership.error, "no-new-assistant");

const acceptedWithOwnership = extractCompletedNv2ResponseFromSnapshot(
  inPlaceSnapshot,
  baseline,
  { allowInPlaceMutation: true },
);
assert.strictEqual(acceptedWithOwnership.ok, true);
assert.strictEqual(acceptedWithOwnership.text.length, 8917);
assert.strictEqual(
  acceptedWithOwnership.state.source,
  "assistant-role-in-place-mutation",
);

const unchangedSnapshot = {
  ...inPlaceSnapshot,
  messages: [
    inPlaceSnapshot.messages[0],
    {
      ...inPlaceSnapshot.messages[1],
      text: readyText,
      hash: hashChatGptSnapshotText(readyText),
    },
  ],
};
assert.strictEqual(
  extractCompletedNv2ResponseFromSnapshot(unchangedSnapshot, baseline, {
    allowInPlaceMutation: true,
  }).ok,
  false,
);

const streamingSnapshot = {
  ...inPlaceSnapshot,
  streamingIndicator: true,
};
assert.strictEqual(
  extractCompletedNv2ResponseFromSnapshot(streamingSnapshot, baseline, {
    allowInPlaceMutation: true,
  }).error,
  "nv2-response-still-generating",
);

console.log("ChatGPT NV2 in-place assistant response tests passed");
