"use strict";

const assert = require("assert");
const {
  inspectCurrentComposerAttachmentsScript,
  inspectExpectedAttachmentVisible,
  inspectExpectedAttachments,
  waitForExpectedAttachmentVisible,
} = require("../electron/main/chatgpt/chatgpt_upload");

function makeNode(overrides = {}) {
  return {
    tagName: "DIV",
    parentElement: null,
    innerText: "",
    textContent: "",
    files: [],
    getAttribute: () => "",
    hasAttribute: () => false,
    getBoundingClientRect: () => ({ width: 64, height: 64 }),
    contains: () => false,
    closest: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    ...overrides,
  };
}

function runNv2ComposerFixture(expectedNames, { includeText = true } = {}) {
  const body = makeNode({ tagName: "BODY" });
  const html = makeNode({ tagName: "HTML" });
  const main = makeNode({ tagName: "MAIN", parentElement: body });
  const panel = makeNode({ parentElement: main });
  const shell = makeNode({ parentElement: panel });
  const composer = makeNode({ tagName: "DIV", parentElement: shell });
  const imageCard = makeNode({ parentElement: panel });
  const thumbnail = makeNode({
    tagName: "IMG",
    parentElement: imageCard,
    getAttribute: (name) => name === "alt" ? "" : "",
  });
  const removeImage = makeNode({
    tagName: "BUTTON",
    parentElement: imageCard,
    getAttribute: (name) => name === "aria-label" ? "Remove image" : "",
  });
  const textCard = makeNode({
    parentElement: panel,
    innerText: "scene_001_nv2_request.txt Document",
    textContent: "scene_001_nv2_request.txt Document",
  });
  const removeFile = makeNode({
    tagName: "BUTTON",
    parentElement: textCard,
    getAttribute: (name) => name === "aria-label" ? "Remove file" : "",
  });

  composer.closest = (selector) =>
    selector === '[data-testid="composer"]' ? shell : null;
  composer.contains = (node) => node === composer;
  shell.contains = (node) =>
    [composer, imageCard, thumbnail, removeImage]
      .concat(includeText ? [textCard, removeFile] : [])
      .includes(node);
  panel.contains = shell.contains;
  imageCard.contains = (node) => node === thumbnail || node === removeImage;
  textCard.contains = (node) => node === removeFile;
  imageCard.querySelector = (selector) =>
    selector.includes("img") ? thumbnail : selector.includes("button") ? removeImage : null;
  textCard.querySelector = (selector) =>
    selector.includes("button") ? removeFile : null;
  panel.querySelectorAll = (selector) => {
    if (selector.includes('role="progressbar"')) return [];
    if (selector === "img, canvas") return [thumbnail];
    if (selector.includes('aria-label*="remove"')) {
      return includeText ? [removeImage, removeFile] : [removeImage];
    }
    return [imageCard, thumbnail, removeImage]
      .concat(includeText ? [textCard, removeFile] : []);
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
    return inspectCurrentComposerAttachmentsScript(expectedNames);
  } finally {
    global.document = previousDocument;
    global.window = previousWindow;
  }
}

const expectedNames = [
  "scene_001_keyframe.png",
  "scene_001_nv2_request.txt",
];
const evidence = runNv2ComposerFixture(expectedNames);
assert.strictEqual(evidence.ok, true);
assert.strictEqual(evidence.attachmentCount, 2);
assert.strictEqual(evidence.imagePreviewCount, 1);
assert.deepStrictEqual(evidence.assumedImageNames, ["scene_001_keyframe.png"]);
assert(evidence.attachmentNames.includes("scene_001_keyframe.png"));
assert(evidence.attachmentNames.includes("scene_001_nv2_request.txt"));

const finalGate = inspectExpectedAttachments(expectedNames, {
  ok: true,
  composerState: "FILES_READY",
  attachmentCount: evidence.attachmentCount,
  attachmentsCompleted: evidence.attachmentCount,
  attachmentNames: evidence.attachmentNames,
  currentComposerAttachmentEvidence: evidence,
});
assert.strictEqual(finalGate.ok, true);
assert.strictEqual(finalGate.imagePreviewCount, 1);

const imageOnlyEvidence = runNv2ComposerFixture(expectedNames, {
  includeText: false,
});
assert.strictEqual(imageOnlyEvidence.attachmentCount, 1);
assert.deepStrictEqual(imageOnlyEvidence.attachmentNames, [
  "scene_001_keyframe.png",
]);
const perFileGate = inspectExpectedAttachmentVisible(
  "C:/project/scene_001/scene_001_keyframe.png",
  {
    composerState: "FILES_READY",
    attachmentCount: 1,
    attachmentsCompleted: 1,
    attachmentNames: imageOnlyEvidence.attachmentNames,
  },
);
assert.strictEqual(perFileGate.ok, true);

const stillUploading = inspectExpectedAttachmentVisible(
  "C:/project/scene_001/scene_001_keyframe.png",
  {
    composerState: "ATTACHING_FILES",
    attachmentCount: 1,
    attachmentsCompleted: 0,
    attachmentNames: imageOnlyEvidence.attachmentNames,
  },
);
assert.strictEqual(stillUploading.ok, false);
assert.strictEqual(stillUploading.uploading, true);

assert.strictEqual(typeof waitForExpectedAttachmentVisible, "function");
const source = require("fs").readFileSync(
  require("path").join(__dirname, "../electron/main/chatgpt/chatgpt_upload.js"),
  "utf8",
);
assert.match(source, /waitForExpectedAttachmentVisible\(\s*page,\s*filePath,\s*expectedFilePaths/);
assert.doesNotMatch(source, /expectedFilePaths\.slice\(0, index \+ 1\)/);

console.log("ChatGPT NV2 unnamed thumbnail attachment regression tests passed");
