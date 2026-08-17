"use strict";

const assert = require("assert");
const {
  attachmentLabelContainsFileName,
  createAttachmentUploadReceipt,
  inspectExpectedAttachments,
  inspectExpectedAttachmentVisible,
  selectCompatibleFileInputScript,
} = require("../electron/main/chatgpt/chatgpt_upload");

const expected = [
  "C:/project/scene_001/scene_001_keyframe.png",
  "C:/project/scene_001/scene_001_nv2_request.txt",
];

const ready = inspectExpectedAttachments(expected, {
  ok: true,
  composerState: "FILES_READY",
  attachmentCount: 2,
  attachmentsCompleted: 2,
  attachmentNames: [
    "scene_001_keyframe.png Image",
    "scene_001_nv2_request.txt 34 KB",
  ],
});
assert.strictEqual(ready.ok, true);

const suffixedNv1 = inspectExpectedAttachments(
  ["C:/project/scene_006/scene_006_nv1_request.txt"],
  {
    ok: true,
    composerState: "FILES_READY",
    attachmentCount: 1,
    attachmentsCompleted: 1,
    attachmentNames: ["scene_006_nv1_request(3).txt Document"],
  },
);
assert.strictEqual(suffixedNv1.ok, true);

const suffixedNv2 = inspectExpectedAttachments(expected, {
  ok: true,
  composerState: "FILES_READY",
  attachmentCount: 2,
  attachmentsCompleted: 2,
  attachmentNames: [
    "scene_001_keyframe (12).png Image",
    "scene_001_nv2_request(7).txt 34 KB",
  ],
});
assert.strictEqual(suffixedNv2.ok, true);

const timestampedNv2 = inspectExpectedAttachments(expected, {
  ok: true,
  composerState: "FILES_READY",
  attachmentCount: 2,
  attachmentsCompleted: 2,
  attachmentNames: [
    "scene_001_keyframe.png Image",
    "scene_001_nv2_request(20260812-132134).txt 34 KB",
  ],
});
assert.strictEqual(
  timestampedNv2.ok,
  true,
  "ChatGPT's exact YYYYMMDD-HHMMSS display-name suffix must preserve TXT identity",
);

const suffixedSingleFile = inspectExpectedAttachmentVisible(
  "C:/project/scene_002/scene_002_nv2_request.txt",
  {
    composerState: "FILES_READY",
    attachmentCount: 1,
    attachmentsCompleted: 1,
    attachmentNames: ["scene_002_nv2_request(7).txt"],
  },
);
assert.strictEqual(suffixedSingleFile.ok, true);
assert.strictEqual(
  attachmentLabelContainsFileName(
    "scene_002_nv1_request(5).txt Document",
    "C:/project/scene_002/scene_002_nv1_request.txt",
  ),
  true,
);
assert.strictEqual(
  attachmentLabelContainsFileName(
    "scene_002_nv1_request (5).txt Document",
    "C:/project/scene_002/scene_002_nv1_request.txt",
  ),
  true,
);

for (const wrongName of [
  "scene_002_nv1_request(final).txt",
  "scene_002_nv1_request(20260812_132134).txt",
  "scene_002_nv1_request(20260812-13213).txt",
  "scene_002_nv1_request5.txt",
  "scene_002_nv2_request(5).txt",
  "scene_002_nv1_request(5).txt.bak",
]) {
  const rejected = inspectExpectedAttachments(
    ["C:/project/scene_002/scene_002_nv1_request.txt"],
    {
      ok: true,
      composerState: "FILES_READY",
      attachmentCount: 1,
      attachmentsCompleted: 1,
      attachmentNames: [wrongName],
    },
  );
  assert.strictEqual(rejected.ok, false, wrongName);
  assert.strictEqual(rejected.error, "chatgpt-attachment-name-mismatch", wrongName);
}

const missing = inspectExpectedAttachments(expected, {
  ok: true,
  composerState: "FILES_READY",
  attachmentCount: 1,
  attachmentsCompleted: 1,
  attachmentNames: ["scene_001_keyframe.png"],
});
assert.strictEqual(missing.ok, false);
assert.strictEqual(missing.error, "chatgpt-attachment-count-mismatch");

const wrongScene = inspectExpectedAttachments(expected, {
  ok: true,
  composerState: "FILES_READY",
  attachmentCount: 2,
  attachmentsCompleted: 2,
  attachmentNames: [
    "scene_001_keyframe.png",
    "scene_002_nv2_request.txt",
  ],
});
assert.strictEqual(wrongScene.ok, false);
assert.strictEqual(wrongScene.error, "chatgpt-attachment-name-mismatch");
assert.deepStrictEqual(wrongScene.missing, ["scene_001_nv2_request.txt"]);

const uploading = inspectExpectedAttachments(expected, {
  ok: true,
  composerState: "ATTACHING_FILES",
  attachmentCount: 2,
  attachmentsCompleted: 1,
  attachmentNames: [
    "scene_001_keyframe.png",
    "scene_001_nv2_request.txt",
  ],
});
assert.strictEqual(uploading.ok, false);
assert.strictEqual(uploading.error, "chatgpt-attachment-upload-in-progress");

const uploadReceipt = createAttachmentUploadReceipt(expected, {
  ok: true,
  inspection: ready,
});
assert.strictEqual(uploadReceipt.valid, true);
const postSettleUnnamedTxt = inspectExpectedAttachments(
  expected,
  {
    ok: true,
    composerState: "FILES_READY",
    attachmentCount: 2,
    attachmentsCompleted: 2,
    attachmentNames: [
      "scene_001_keyframe.png",
      "unidentified-attachment-2",
    ],
    currentComposerAttachmentEvidence: {
      mode: "current-composer-visual-evidence-v4",
      removeButtonCount: 2,
      imagePreviewCount: 1,
      liveInputNames: [],
      unexpectedReadableNames: [],
      contradictoryLiveInput: false,
    },
  },
  { uploadReceipt },
);
assert.strictEqual(postSettleUnnamedTxt.ok, true);
assert.deepStrictEqual(postSettleUnnamedTxt.recoveredFromUploadReceipt, [
  "scene_001_nv2_request.txt",
]);

const postSettleTimestampedTxt = inspectExpectedAttachments(
  expected,
  {
    ok: true,
    composerState: "FILES_READY",
    attachmentCount: 2,
    attachmentsCompleted: 2,
    attachmentNames: [
      "scene_001_keyframe.png",
      "unidentified-attachment-2",
    ],
    currentComposerAttachmentEvidence: {
      mode: "current-composer-visual-evidence-v4",
      removeButtonCount: 2,
      imagePreviewCount: 1,
      liveInputNames: ["scene_001_nv2_request.txt"],
      unexpectedReadableNames: [
        "scene_001_nv2_request(20260812-132134).txt",
      ],
      contradictoryLiveInput: false,
    },
  },
  { uploadReceipt },
);
assert.strictEqual(
  postSettleTimestampedTxt.ok,
  true,
  "post-settle timestamp alias must be reconciled with the verified upload receipt",
);
assert.deepStrictEqual(
  postSettleTimestampedTxt.recoveredFromUploadReceipt,
  ["scene_001_nv2_request.txt"],
);

for (const unsafePostSettleState of [
  {
    attachmentCount: 2,
    attachmentNames: ["scene_001_keyframe.png", "scene_999_nv2_request.txt"],
  },
  {
    attachmentCount: 2,
    attachmentNames: ["scene_001_keyframe.png", "unidentified-attachment-2"],
    currentComposerAttachmentEvidence: {
      removeButtonCount: 2,
      imagePreviewCount: 1,
      unexpectedReadableNames: ["scene_999_nv2_request.txt"],
      contradictoryLiveInput: false,
    },
  },
  {
    attachmentCount: 2,
    attachmentNames: ["scene_001_keyframe.png", "unidentified-attachment-2"],
    currentComposerAttachmentEvidence: {
      removeButtonCount: 2,
      imagePreviewCount: 1,
      unexpectedReadableNames: [],
      contradictoryLiveInput: true,
    },
  },
]) {
  const rejectedAfterSettle = inspectExpectedAttachments(
    expected,
    {
      ok: true,
      composerState: "FILES_READY",
      attachmentsCompleted: unsafePostSettleState.attachmentCount,
      ...unsafePostSettleState,
    },
    { uploadReceipt },
  );
  assert.strictEqual(rejectedAfterSettle.ok, false);
  assert.strictEqual(
    rejectedAfterSettle.error,
    "chatgpt-attachment-name-mismatch",
  );
}

assert.strictEqual(typeof selectCompatibleFileInputScript, "function");
assert.match(selectCompatibleFileInputScript.toString(), /text\/plain/);
assert.match(selectCompatibleFileInputScript.toString(), /image\//);
assert.doesNotMatch(selectCompatibleFileInputScript.toString(), /querySelector\(['"]input\[type=["']file/);

const uploadModuleSource = require("fs").readFileSync(
  require("path").join(__dirname, "../electron/main/chatgpt/chatgpt_upload.js"),
  "utf8",
);
assert.match(uploadModuleSource, /waitForEvent\("filechooser"/);
assert.match(uploadModuleSource, /Add photos\?/);
assert.match(uploadModuleSource, /chatgpt-upload-did-not-create-visible-attachment/);
assert.match(uploadModuleSource, /inputFilesAreDiagnosticOnly/);

console.log("ChatGPT exact attachment gate tests passed");
