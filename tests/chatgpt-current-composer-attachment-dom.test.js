"use strict";

const assert = require("assert");
const {
  createAttachmentUploadReceipt,
  inspectExpectedAttachments,
  inspectCurrentComposerAttachmentsScript,
  mergeCurrentComposerAttachmentEvidence,
  getConversationStateWithExpectedAttachments,
} = require("../electron/main/chatgpt/chatgpt_upload");

const promptHash = "a1b2c3";
const genericStateMissedVisibleFile = {
  ok: true,
  composerHasPrompt: false,
  composerPromptHash: "",
  composerState: "EMPTY",
  composerReady: false,
  sendButtonVisible: false,
  attachmentCount: 0,
  attachmentNames: [],
  attachmentsCompleted: 0,
};
const fileEvidence = {
  ok: true,
  attachmentNames: ["scene_001_nv1_request.txt"],
  attachmentCount: 1,
  attachmentsCompleted: 1,
  attachmentUploadInProgress: false,
  removeButtonCount: 1,
  mode: "current-composer-visual-evidence-v3",
};

const filesReady = mergeCurrentComposerAttachmentEvidence(
  genericStateMissedVisibleFile,
  fileEvidence,
);
assert.strictEqual(filesReady.attachmentCount, 1);
assert.deepStrictEqual(filesReady.attachmentNames, ["scene_001_nv1_request.txt"]);
assert.strictEqual(filesReady.composerState, "FILES_READY");

const payloadReady = mergeCurrentComposerAttachmentEvidence(
  {
    ...genericStateMissedVisibleFile,
    composerHasPrompt: true,
    composerPromptHash: promptHash,
    composerReady: true,
    sendButtonVisible: true,
  },
  fileEvidence,
);
assert.strictEqual(payloadReady.composerState, "READY_TO_SEND");
assert.strictEqual(payloadReady.composerPromptHash, promptHash);

const uploading = mergeCurrentComposerAttachmentEvidence(
  genericStateMissedVisibleFile,
  {
    ...fileEvidence,
    attachmentsCompleted: 0,
    attachmentUploadInProgress: true,
  },
);
assert.strictEqual(uploading.composerState, "ATTACHING_FILES");
assert.strictEqual(uploading.attachmentsCompleted, 0);

const detectorSource = inspectCurrentComposerAttachmentsScript.toString();
assert.match(detectorSource, /input\[type=\\?"file\\?"\]/);
assert.match(detectorSource, /data-file-name/);
assert.match(detectorSource, /removeButtonCount/);
assert.match(detectorSource, /isComposerTextNode/);
assert.match(detectorSource, /assumedFromVisualCount/);
assert.match(detectorSource, /inputFilesAreDiagnosticOnly/);
assert.match(detectorSource, /contradictoryLiveInput/);
assert.match(detectorSource, /unexpectedReadableNames/);
assert.strictEqual(typeof getConversationStateWithExpectedAttachments, "function");
const uploadModuleSource = require("fs").readFileSync(
  require("path").join(
    __dirname,
    "../electron/main/chatgpt/chatgpt_upload.js",
  ),
  "utf8",
);
assert.match(
  uploadModuleSource,
  /const state = await getConversationStateWithExpectedAttachments\(\s*page,\s*expectedFilePaths/,
);

function makeNode(overrides = {}) {
  return {
    tagName: "DIV",
    parentElement: null,
    innerText: "",
    textContent: "",
    getAttribute: () => "",
    hasAttribute: () => false,
    getBoundingClientRect: () => ({ width: 120, height: 32 }),
    contains: () => false,
    closest: () => null,
    querySelectorAll: () => [],
    ...overrides,
  };
}

function runCurrentComposerFixture({
  showFileName,
  inputFileName = "",
  displayedFileName = "scene_001_nv1_request.txt",
}) {
  const body = makeNode({ tagName: "BODY" });
  const html = makeNode({ tagName: "HTML" });
  const main = makeNode({ tagName: "MAIN", parentElement: body });
  const panel = makeNode({ parentElement: main });
  const composerShell = makeNode({ parentElement: panel });
  const composer = makeNode({
    tagName: "DIV",
    parentElement: composerShell,
    innerText: "Tạo ảnh theo file sau: scene_001_nv1_request.txt",
    textContent: "Tạo ảnh theo file sau: scene_001_nv1_request.txt",
  });
  const fileChip = makeNode({
    parentElement: panel,
    innerText: showFileName ? `${displayedFileName} 34 KB` : "Document",
    textContent: showFileName ? `${displayedFileName} 34 KB` : "Document",
  });
  const removeButton = makeNode({
    tagName: "BUTTON",
    parentElement: fileChip,
    getAttribute: (name) => name === "aria-label" ? "Remove file" : "",
  });
  const fileInput = makeNode({
    tagName: "INPUT",
    parentElement: composerShell,
    files: inputFileName ? [{ name: inputFileName }] : [],
  });
  composer.contains = (node) => node === composer;
  composer.closest = (selector) =>
    selector === '[data-testid="composer"]' ? composerShell : null;
  composerShell.contains = (node) =>
    [composer, fileChip, removeButton, fileInput].includes(node);
  panel.contains = composerShell.contains;
  main.contains = composerShell.contains;
  fileChip.contains = (node) => node === removeButton;
  panel.querySelectorAll = (selector) => {
    if (selector.includes('role="progressbar"')) return [];
    if (selector === "img, canvas") return [];
    if (selector.includes('aria-label*="remove"')) return [removeButton];
    return [composer, fileChip, removeButton];
  };

  const previousDocument = global.document;
  const previousWindow = global.window;
  global.document = {
    body,
    documentElement: html,
    querySelector: (selector) => selector === "#prompt-textarea" ? composer : null,
    querySelectorAll: (selector) =>
      selector === 'input[type="file"]' && inputFileName ? [fileInput] : [],
  };
  global.window = {
    getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }),
  };
  try {
    return inspectCurrentComposerAttachmentsScript(["scene_001_nv1_request.txt"]);
  } finally {
    global.document = previousDocument;
    global.window = previousWindow;
  }
}

const renamedChatGptDom = runCurrentComposerFixture({ showFileName: true });
assert.strictEqual(renamedChatGptDom.ok, true);
assert.deepStrictEqual(renamedChatGptDom.attachmentNames, ["scene_001_nv1_request.txt"]);
assert.strictEqual(renamedChatGptDom.attachmentCount, 1);
assert.strictEqual(renamedChatGptDom.assumedFromVisualCount, false);

const numericSuffixChatGptDom = runCurrentComposerFixture({
  showFileName: true,
  displayedFileName: "scene_001_nv1_request(5).txt",
});
assert.deepStrictEqual(numericSuffixChatGptDom.attachmentNames, [
  "scene_001_nv1_request.txt",
]);
assert.strictEqual(numericSuffixChatGptDom.attachmentCount, 1);
assert.strictEqual(numericSuffixChatGptDom.assumedFromVisualCount, false);

const spacedNumericSuffixChatGptDom = runCurrentComposerFixture({
  showFileName: true,
  displayedFileName: "scene_001_nv1_request (5).txt",
});
assert.deepStrictEqual(spacedNumericSuffixChatGptDom.attachmentNames, [
  "scene_001_nv1_request.txt",
]);
assert.strictEqual(spacedNumericSuffixChatGptDom.assumedFromVisualCount, false);

const iconOnlyChatGptDom = runCurrentComposerFixture({ showFileName: false });
assert.deepStrictEqual(iconOnlyChatGptDom.attachmentNames, ["scene_001_nv1_request.txt"]);
assert.strictEqual(iconOnlyChatGptDom.attachmentCount, 1);
assert.strictEqual(iconOnlyChatGptDom.assumedFromVisualCount, true);

const contradictoryInputDom = runCurrentComposerFixture({
  showFileName: false,
  inputFileName: "scene_999_nv1_request.txt",
});
assert.deepStrictEqual(contradictoryInputDom.attachmentNames, [
  "unidentified-attachment-1",
]);
assert.strictEqual(contradictoryInputDom.assumedFromVisualCount, false);
assert.strictEqual(contradictoryInputDom.contradictoryLiveInput, true);

const suffixedExpectedInputDom = runCurrentComposerFixture({
  showFileName: true,
  displayedFileName: "scene_001_nv1_request(9).txt",
  inputFileName: "scene_001_nv1_request(9).txt",
});
assert.deepStrictEqual(suffixedExpectedInputDom.attachmentNames, [
  "scene_001_nv1_request.txt",
]);
assert.strictEqual(suffixedExpectedInputDom.contradictoryLiveInput, false);

function runInputOnlyFixture() {
  const composer = makeNode({ tagName: "DIV" });
  const shell = makeNode();
  const input = makeNode({
    tagName: "INPUT",
    files: [{ name: "scene_001_nv1_request.txt" }],
  });
  composer.closest = (selector) =>
    selector === '[data-testid="composer"]' ? shell : null;
  composer.contains = (node) => node === composer;
  shell.contains = (node) => node === composer || node === input;
  shell.querySelectorAll = () => [];
  const previousDocument = global.document;
  const previousWindow = global.window;
  global.document = {
    body: makeNode({ tagName: "BODY" }),
    documentElement: makeNode({ tagName: "HTML" }),
    querySelector: (selector) => selector === "#prompt-textarea" ? composer : null,
    querySelectorAll: (selector) => selector === 'input[type="file"]' ? [input] : [],
  };
  global.window = {
    getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }),
  };
  try {
    return inspectCurrentComposerAttachmentsScript(["scene_001_nv1_request.txt"]);
  } finally {
    global.document = previousDocument;
    global.window = previousWindow;
  }
}

const inputOnly = runInputOnlyFixture();
assert.deepStrictEqual(inputOnly.liveInputNames, ["scene_001_nv1_request.txt"]);
assert.strictEqual(inputOnly.attachmentCount, 0);
assert.deepStrictEqual(inputOnly.attachmentNames, []);

function runNv2PostSettleFixture(displayedTxtName = "") {
  const expectedNames = [
    "scene_006_keyframe.png",
    "scene_006_nv2_request.txt",
  ];
  const body = makeNode({ tagName: "BODY" });
  const html = makeNode({ tagName: "HTML" });
  const main = makeNode({ tagName: "MAIN", parentElement: body });
  const panel = makeNode({ parentElement: main });
  const composerShell = makeNode({ parentElement: panel });
  const composer = makeNode({ tagName: "DIV", parentElement: composerShell });
  const imageCard = makeNode({
    parentElement: panel,
    innerText: "Uploaded image",
    textContent: "Uploaded image",
  });
  const imagePreview = makeNode({
    tagName: "IMG",
    parentElement: imageCard,
    getAttribute: (name) => name === "alt" ? "Uploaded image" : "",
    getBoundingClientRect: () => ({ width: 96, height: 96 }),
  });
  const removeImage = makeNode({
    tagName: "BUTTON",
    parentElement: imageCard,
    getAttribute: (name) => name === "aria-label" ? "Remove image" : "",
  });
  const fileCard = makeNode({
    parentElement: panel,
    innerText: displayedTxtName || "Document",
    textContent: displayedTxtName || "Document",
  });
  const removeFile = makeNode({
    tagName: "BUTTON",
    parentElement: fileCard,
    getAttribute: (name) => name === "aria-label" ? "Remove file" : "",
  });
  composer.closest = (selector) =>
    selector === '[data-testid="composer"]' ? composerShell : null;
  composer.contains = (node) => node === composer;
  imageCard.contains = (node) => [imagePreview, removeImage].includes(node);
  fileCard.contains = (node) => node === removeFile;
  const fixtureNodes = [
    composer,
    imageCard,
    imagePreview,
    removeImage,
    fileCard,
    removeFile,
  ];
  composerShell.contains = (node) => fixtureNodes.includes(node);
  panel.contains = composerShell.contains;
  panel.querySelectorAll = (selector) => {
    if (selector.includes('role="progressbar"')) return [];
    if (selector === "img, canvas") return [imagePreview];
    if (selector.includes('aria-label*="remove"')) {
      return [removeImage, removeFile];
    }
    return fixtureNodes;
  };

  const previousDocument = global.document;
  const previousWindow = global.window;
  global.document = {
    body,
    documentElement: html,
    querySelector: (selector) => selector === "#prompt-textarea" ? composer : null,
    querySelectorAll: () => [],
  };
  global.window = {
    getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }),
  };
  try {
    return {
      expectedNames,
      evidence: inspectCurrentComposerAttachmentsScript(expectedNames),
    };
  } finally {
    global.document = previousDocument;
    global.window = previousWindow;
  }
}

const preSettleState = {
  ok: true,
  composerState: "FILES_READY",
  attachmentCount: 2,
  attachmentsCompleted: 2,
  attachmentNames: [
    "scene_006_keyframe.png",
    "scene_006_nv2_request.txt",
  ],
};
const preSettleInspection = inspectExpectedAttachments(
  ["scene_006_keyframe.png", "scene_006_nv2_request.txt"],
  preSettleState,
);
const receipt = createAttachmentUploadReceipt(
  ["scene_006_keyframe.png", "scene_006_nv2_request.txt"],
  { ok: true, inspection: preSettleInspection },
);

const postSettleNv2 = runNv2PostSettleFixture();
assert.deepStrictEqual(postSettleNv2.evidence.attachmentNames, [
  "scene_006_keyframe.png",
  "unidentified-attachment-2",
]);
assert.strictEqual(postSettleNv2.evidence.removeButtonCount, 2);
assert.strictEqual(postSettleNv2.evidence.imagePreviewCount, 1);
const recoveredPostSettleNv2 = inspectExpectedAttachments(
  postSettleNv2.expectedNames,
  mergeCurrentComposerAttachmentEvidence(
    { ok: true, composerState: "EMPTY", attachmentCount: 0 },
    postSettleNv2.evidence,
  ),
  { uploadReceipt: receipt },
);
assert.strictEqual(recoveredPostSettleNv2.ok, true);
assert.deepStrictEqual(recoveredPostSettleNv2.recoveredFromUploadReceipt, [
  "scene_006_nv2_request.txt",
]);

const timestampedPostSettleNv2 = runNv2PostSettleFixture(
  "scene_006_nv2_request(20260812-132134).txt 34 KB",
);
assert.deepStrictEqual(
  [...timestampedPostSettleNv2.evidence.attachmentNames].sort(),
  ["scene_006_keyframe.png", "scene_006_nv2_request.txt"].sort(),
);
assert.deepStrictEqual(
  timestampedPostSettleNv2.evidence.unexpectedReadableNames,
  [],
);
const acceptedTimestampedPostSettleNv2 = inspectExpectedAttachments(
  timestampedPostSettleNv2.expectedNames,
  mergeCurrentComposerAttachmentEvidence(
    { ok: true, composerState: "EMPTY", attachmentCount: 0 },
    timestampedPostSettleNv2.evidence,
  ),
  { uploadReceipt: receipt },
);
assert.strictEqual(acceptedTimestampedPostSettleNv2.ok, true);

const wrongPostSettleNv2 = runNv2PostSettleFixture(
  "scene_999_nv2_request.txt 34 KB",
);
assert.deepStrictEqual(wrongPostSettleNv2.evidence.unexpectedReadableNames, [
  "scene_999_nv2_request.txt",
]);
const rejectedWrongPostSettleNv2 = inspectExpectedAttachments(
  wrongPostSettleNv2.expectedNames,
  mergeCurrentComposerAttachmentEvidence(
    { ok: true, composerState: "EMPTY", attachmentCount: 0 },
    wrongPostSettleNv2.evidence,
  ),
  { uploadReceipt: receipt },
);
assert.strictEqual(rejectedWrongPostSettleNv2.ok, false);
assert.strictEqual(
  rejectedWrongPostSettleNv2.error,
  "chatgpt-attachment-name-mismatch",
);

assert.match(
  uploadModuleSource,
  /uploadReceipt:\s*createAttachmentUploadReceipt\(expectedFilePaths, verified\)/,
  "post-settle verification must use a receipt from the successful pre-settle verification",
);

console.log("ChatGPT current-composer attachment DOM fallback tests passed");
