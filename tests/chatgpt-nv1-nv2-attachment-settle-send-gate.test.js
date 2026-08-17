"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const {
  hashChatGptSnapshotText,
  normalizeChatGptSnapshotText,
} = require("../electron/main/state");
const {
  verifyComposerPayloadReady,
} = require("../electron/main/chatgpt/chatgpt_send");

const nv1Prompt =
  "Tạo ảnh theo file sau: scene_001_nv1_request.txt";
const nv2Prompt =
  "Tạo prompt motion theo file sau: scene_001_nv2_request.txt";
const nv1File = "C:/project/scene_001/scene_001_nv1_request.txt";
const nv2Keyframe = "C:/project/scene_001/scene_001_keyframe.png";
const nv2File = "C:/project/scene_001/scene_001_nv2_request.txt";

function readyState(prompt, attachmentNames) {
  const browserText = `${prompt.normalize("NFD").slice(0, 5)}\u200b${prompt
    .normalize("NFD")
    .slice(5)}`;
  return {
    ok: true,
    // Simulates the stale hidden composer hash seen in Pasted text(6).txt.
    composerPromptHash: "811c9dc5",
    composerText: browserText,
    composerReady: true,
    composerState: "READY_TO_SEND",
    sendButtonVisible: true,
    attachmentCount: attachmentNames.length,
    attachmentsCompleted: attachmentNames.length,
    attachmentNames,
  };
}

assert.strictEqual(
  normalizeChatGptSnapshotText(nv1Prompt.normalize("NFD")),
  normalizeChatGptSnapshotText(nv1Prompt),
);
assert.strictEqual(
  hashChatGptSnapshotText(`${nv1Prompt.slice(0, 10)}\u200b${nv1Prompt.slice(10)}`),
  hashChatGptSnapshotText(nv1Prompt),
);

const nv1Ready = verifyComposerPayloadReady(
  nv1Prompt,
  [nv1File],
  readyState(nv1Prompt, ["scene_001_nv1_request.txt"]),
);
assert.strictEqual(nv1Ready.ok, true);
assert.strictEqual(nv1Ready.promptEvidence, "normalized-current-composer-text");

const nv2Ready = verifyComposerPayloadReady(
  nv2Prompt,
  [nv2Keyframe, nv2File],
  readyState(nv2Prompt, [
    "scene_001_keyframe.png",
    "scene_001_nv2_request(6).txt",
  ]),
);
assert.strictEqual(nv2Ready.ok, true);

const wrongNv2Id = verifyComposerPayloadReady(
  `${nv2Prompt} unexpected`,
  [nv2Keyframe, nv2File],
  readyState(nv2Prompt, [
    "scene_001_keyframe.png",
    "scene_001_nv2_request.txt",
  ]),
);
assert.strictEqual(wrongNv2Id.ok, false);
assert.strictEqual(wrongNv2Id.error, "chatgpt-payload-prompt-mismatch");

const missingNv2Txt = verifyComposerPayloadReady(
  nv2Prompt,
  [nv2Keyframe, nv2File],
  readyState(nv2Prompt, ["scene_001_keyframe.png"]),
);
assert.strictEqual(missingNv2Txt.ok, true);

const uploadSource = fs.readFileSync(
  path.join(__dirname, "../electron/main/chatgpt/chatgpt_upload.js"),
  "utf8",
);
const settleIndex = uploadSource.indexOf("ATTACHMENT_SETTLE_BEGIN");
const finishedIndex = uploadSource.indexOf("[MILESTONE] UPLOAD_FINISHED", settleIndex);
assert(settleIndex > 0, "shared uploader must wait for the attachment quiet period");
assert(finishedIndex > settleIndex, "UPLOAD_FINISHED must occur after the quiet-period revalidation");
assert.match(uploadSource, /postAttachmentSettleMs \|\| 5000/);
assert.match(uploadSource, /stableTicks: 3/);

const domSource = fs.readFileSync(
  path.join(__dirname, "../electron/main/chatgpt/chatgpt_dom.js"),
  "utf8",
);
assert.match(domSource, /stale\/hidden textarea/);
assert.match(domSource, /const composerCandidates = composerSelectors/);
assert.match(domSource, /composerText: snap\.composerText/);

const pipelineSource = fs.readFileSync(
  path.join(__dirname, "../electron/main/chatgpt/chatgpt_pipeline.js"),
  "utf8",
);
assert.match(
  pipelineSource,
  /request: "nv1-request-file"/,
  "NV1 must use the shared settled-attachment uploader",
);
assert.match(
  pipelineSource,
  /request: "nv2-keyframe-and-request-file"/,
  "NV2 must use the shared settled-attachment uploader",
);

console.log("ChatGPT NV1/NV2 settled attachment + send gate tests passed");
