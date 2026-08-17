"use strict";

const fs = require("fs");
const path = require("path");

const { appendAppLog } = require("../logging");
const { sleep } = require("../utils");
const { clickUploadButtonScript } = require("./chatgpt_dom");
const { evaluateOnCdpPage, getConversationState } = require("./chatgpt_core");

let setChatGptSendState = () => null;

function initChatGptUpload(runtime = {}) {
  if (typeof runtime.setChatGptSendState === "function") {
    setChatGptSendState = runtime.setChatGptSendState;
  }
}

function normalizeAttachmentLabel(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function escapeAttachmentNameForRegExp(value = "") {
  return String(value || "").replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function attachmentLabelContainsExpectedName(label = "", expectedName = "") {
  const normalizedLabel = normalizeAttachmentLabel(label);
  const fileName = normalizeAttachmentLabel(expectedName);
  if (!normalizedLabel || !fileName) return false;

  const extension = path.extname(fileName);
  const stem = extension ? fileName.slice(0, -extension.length) : fileName;
  const escapedStem = escapeAttachmentNameForRegExp(stem);
  const escapedExtension = escapeAttachmentNameForRegExp(extension);
  const duplicateSuffixToken =
    extension === ".txt" ? "(?:\\d+|\\d{8}-\\d{6})" : "\\d+";
  const duplicateSuffix = `(?:\\s*\\(${duplicateSuffixToken}\\))?`;
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}_.-])${escapedStem}${duplicateSuffix}${escapedExtension}` +
      `(?=$|[^\\p{L}\\p{N}_.-])`,
    "u",
  );
  return pattern.test(normalizedLabel);
}

function attachmentLabelContainsFileName(label = "", filePath = "") {
  const fileName = path.basename(String(filePath || "")).toLowerCase();
  return attachmentLabelContainsExpectedName(label, fileName);
}

function isImageAttachmentName(value = "") {
  return /\.(?:png|jpe?g|webp|gif|bmp|avif)$/i.test(
    path.basename(String(value || "")),
  );
}

function createAttachmentUploadReceipt(filePaths = [], verification = {}) {
  const expectedNames = (Array.isArray(filePaths) ? filePaths : [])
    .map((filePath) => path.basename(String(filePath || "")).toLowerCase())
    .filter(Boolean);
  const inspection = verification?.inspection || verification || {};
  const actualLabels = (Array.isArray(inspection?.actualLabels)
    ? inspection.actualLabels
    : []
  ).map(normalizeAttachmentLabel);
  const confirmedNames = expectedNames.filter((expectedName) =>
    actualLabels.some((label) =>
      attachmentLabelContainsExpectedName(label, expectedName),
    ),
  );
  const expectedCount = expectedNames.length;
  const actualCount = Number(inspection?.actualCount || 0);
  const valid = Boolean(
    verification?.ok === true &&
      inspection?.ok === true &&
      expectedCount > 0 &&
      actualCount === expectedCount &&
      confirmedNames.length === expectedCount,
  );

  return {
    valid,
    expectedNames,
    confirmedNames,
    expectedCount,
    actualCount,
    confirmedAttachments: confirmedNames.map((name) => ({
      name,
      kind: isImageAttachmentName(name) ? "image" : "file",
    })),
    source: "pre-settle-attachment-verification",
  };
}

function inspectExpectedAttachments(filePaths = [], pageState = {}, options = {}) {
  const expected = (Array.isArray(filePaths) ? filePaths : [])
    .map((filePath) => path.basename(String(filePath || "")).toLowerCase())
    .filter(Boolean);
  const actualLabels = (Array.isArray(pageState?.attachmentNames)
    ? pageState.attachmentNames
    : []
  ).map(normalizeAttachmentLabel);
  const usedIndexes = new Set();
  let missing = [];

  for (const expectedName of expected) {
    const matchIndex = actualLabels.findIndex(
      (label, index) =>
        !usedIndexes.has(index) &&
        attachmentLabelContainsExpectedName(label, expectedName),
    );
    if (matchIndex < 0) missing.push(expectedName);
    else usedIndexes.add(matchIndex);
  }

  const uploading = Boolean(
    pageState?.composerState === "ATTACHING_FILES" ||
      pageState?.attachmentsCompleted < pageState?.attachmentCount ||
      pageState?.attachmentUploadInProgress,
  );
  const evidence = pageState?.currentComposerAttachmentEvidence || {};
  const readableNameCandidates = (Array.isArray(evidence?.unexpectedReadableNames)
    ? evidence.unexpectedReadableNames
    : []
  ).map(normalizeAttachmentLabel).filter(Boolean);
  const acceptedReadableAliases = readableNameCandidates.filter((name) =>
    expected.some((expectedName) =>
      attachmentLabelContainsExpectedName(name, expectedName),
    ),
  );
  const unexpectedReadableNames = readableNameCandidates.filter(
    (name) => !acceptedReadableAliases.includes(name),
  );
  const liveInputNames = (Array.isArray(evidence?.liveInputNames)
    ? evidence.liveInputNames
    : []
  ).map(normalizeAttachmentLabel).filter(Boolean);
  const contradictoryLiveInput = Boolean(
    evidence?.contradictoryLiveInput ||
      liveInputNames.some((name) =>
        !expected.some((expectedName) =>
          attachmentLabelContainsExpectedName(name, expectedName),
        ),
      ),
  );
  const uploadReceipt = options?.uploadReceipt || null;
  const receiptExpectedNames = (Array.isArray(uploadReceipt?.expectedNames)
    ? uploadReceipt.expectedNames
    : []
  ).map(normalizeAttachmentLabel).filter(Boolean);
  const receiptConfirmedNames = new Set(
    (Array.isArray(uploadReceipt?.confirmedNames)
      ? uploadReceipt.confirmedNames
      : []
    ).map(normalizeAttachmentLabel).filter(Boolean),
  );
  const receiptMatchesExpected = Boolean(
    uploadReceipt?.valid === true &&
      Number(uploadReceipt?.expectedCount || 0) === expected.length &&
      receiptExpectedNames.length === expected.length &&
      expected.every((name) => receiptExpectedNames.includes(name)),
  );
  const unidentifiedIndexes = actualLabels
    .map((label, index) => ({ label, index }))
    .filter(({ label, index }) =>
      !usedIndexes.has(index) && /^unidentified-attachment-\d+$/.test(label),
    )
    .map(({ index }) => index);
  const expectedImageCount = expected.filter(isImageAttachmentName).length;
  const exactVisualCardCount = Boolean(
    Number(pageState?.attachmentCount || 0) === expected.length &&
      Number(evidence?.removeButtonCount || 0) === expected.length,
  );
  const expectedImagesStillVisible = Boolean(
    expectedImageCount === 0 ||
      Number(evidence?.imagePreviewCount || 0) >= expectedImageCount,
  );
  const recoveredFromUploadReceipt = [];
  if (
    missing.length > 0 &&
    !uploading &&
    receiptMatchesExpected &&
    exactVisualCardCount &&
    expectedImagesStillVisible &&
    !contradictoryLiveInput &&
    unexpectedReadableNames.length === 0 &&
    unidentifiedIndexes.length >= missing.length &&
    missing.every((name) => receiptConfirmedNames.has(name))
  ) {
    for (const missingName of missing) {
      const recoveredIndex = unidentifiedIndexes.shift();
      if (recoveredIndex === undefined) break;
      usedIndexes.add(recoveredIndex);
      recoveredFromUploadReceipt.push(missingName);
    }
    missing = missing.filter(
      (name) => !recoveredFromUploadReceipt.includes(name),
    );
  }
  const unexpected = actualLabels.filter((_label, index) => !usedIndexes.has(index));
  let error = "";
  if (!pageState?.ok) error = pageState?.error || "chatgpt-composer-state-unavailable";
  else if (uploading) error = "chatgpt-attachment-upload-in-progress";
  else if (Number(pageState?.attachmentCount || 0) !== expected.length)
    error = "chatgpt-attachment-count-mismatch";
  else if (
    missing.length ||
    unexpected.length ||
    unexpectedReadableNames.length ||
    contradictoryLiveInput
  )
    error = "chatgpt-attachment-name-mismatch";

  return {
    ok: !error,
    error,
    expectedNames: expected,
    expectedImageCount,
    actualLabels,
    expectedCount: expected.length,
    actualCount: Number(pageState?.attachmentCount || 0),
    missing,
    unexpected,
    unexpectedReadableNames,
    acceptedReadableAliases,
    liveInputNames,
    contradictoryLiveInput,
    recoveredFromUploadReceipt,
    uploadReceiptUsed: recoveredFromUploadReceipt.length > 0,
    uploading,
    composerState: pageState?.composerState || "",
    evidenceMode: pageState?.currentComposerAttachmentEvidence?.mode || "legacy-selector",
    removeButtonCount: Number(
      pageState?.currentComposerAttachmentEvidence?.removeButtonCount || 0,
    ),
    assumedFromVisualCount: Boolean(
      pageState?.currentComposerAttachmentEvidence?.assumedFromVisualCount,
    ),
    imagePreviewCount: Number(
      pageState?.currentComposerAttachmentEvidence?.imagePreviewCount || 0,
    ),
    assumedImageNames: Array.isArray(
      pageState?.currentComposerAttachmentEvidence?.assumedImageNames,
    )
      ? pageState.currentComposerAttachmentEvidence.assumedImageNames
      : [],
  };
}

function verifyAttachmentsReady(filePaths, pageState) {
  return inspectExpectedAttachments(filePaths, pageState).ok;
}

function inspectExpectedAttachmentVisible(filePath, pageState = {}) {
  const targetName = path.basename(String(filePath || "")).toLowerCase();
  const targetVisible = Boolean(
    targetName &&
      (pageState?.attachmentNames || []).some((label) =>
        attachmentLabelContainsExpectedName(label, targetName),
      ),
  );
  const uploading = Boolean(
    pageState?.composerState === "ATTACHING_FILES" ||
      pageState?.attachmentUploadInProgress ||
      pageState?.attachmentsCompleted < pageState?.attachmentCount,
  );
  return {
    ok: targetVisible && !uploading,
    targetName,
    targetKind: isImageAttachmentName(targetName) ? "image-thumbnail" : "named-file",
    targetVisible,
    uploading,
  };
}

function inspectCurrentComposerAttachmentsScript(expectedNames = []) {
  const normalize = (value = "") =>
    String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  const escapeRegExp = (value = "") =>
    String(value || "").replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  const labelContainsExpectedName = (label = "", expectedName = "") => {
    const normalizedLabel = normalize(label);
    const fileName = normalize(expectedName);
    if (!normalizedLabel || !fileName) return false;
    const dotIndex = fileName.lastIndexOf(".");
    const hasExtension = dotIndex > 0;
    const stem = hasExtension ? fileName.slice(0, dotIndex) : fileName;
    const extension = hasExtension ? fileName.slice(dotIndex) : "";
    const duplicateSuffixToken =
      extension === ".txt" ? "(?:\\d+|\\d{8}-\\d{6})" : "\\d+";
    const duplicateSuffix = `(?:\\s*\\(${duplicateSuffixToken}\\))?`;
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}_.-])${escapeRegExp(stem)}` +
        `${duplicateSuffix}${escapeRegExp(extension)}` +
        `(?=$|[^\\p{L}\\p{N}_.-])`,
      "u",
    );
    return pattern.test(normalizedLabel);
  };
  const expected = (Array.isArray(expectedNames) ? expectedNames : [])
    .map((name) => String(name || "").split(/[\\/]/).pop())
    .map(normalize)
    .filter(Boolean);
  const isImageName = (name = "") =>
    /\.(?:png|jpe?g|webp|gif|bmp|avif)$/i.test(String(name || ""));
  const composer =
    document.querySelector("#prompt-textarea") ||
    document.querySelector('textarea[data-testid*="composer"]') ||
    document.querySelector('[data-testid="composer"] [contenteditable="true"]') ||
    document.querySelector('main [contenteditable="true"]') ||
    document.querySelector("textarea") ||
    document.querySelector('[contenteditable="true"]');
  if (!composer) {
    return {
      ok: false,
      error: "chatgpt-composer-not-found-for-attachment-inspection",
      attachmentNames: [],
      attachmentCount: 0,
    };
  }

  const visible = (node) => {
    if (!node?.getBoundingClientRect) return false;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle?.(node);
    return !style || (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || 1) !== 0
    );
  };
  const addRoot = (roots, node) => {
    if (
      node &&
      node !== document.body &&
      node !== document.documentElement &&
      !roots.includes(node)
    ) {
      roots.push(node);
    }
  };

  const roots = [];
  addRoot(roots, composer.closest?.('[data-testid="composer"]'));
  addRoot(roots, composer.closest?.('form'));
  let ancestor = roots[0] || roots[1] || composer.parentElement;
  for (let depth = 0; depth < 4 && ancestor?.parentElement; depth += 1) {
    const parent = ancestor.parentElement;
    if (parent === document.body || parent === document.documentElement) break;
    addRoot(roots, parent);
    ancestor = parent;
    if (parent.tagName === "MAIN") break;
  }
  const searchRoot = [...roots].reverse().find((node) => node.tagName !== "MAIN") ||
    roots[0] || composer.parentElement;

  const isComposerTextNode = (node) =>
    node === composer ||
    composer.contains?.(node) ||
    node.contains?.(composer);
  const isOldMessageNode = (node) => Boolean(
    node.closest?.('[data-message-author-role], article[data-message-id]'),
  );
  const candidateIsUsable = (node) =>
    visible(node) && !isComposerTextNode(node) && !isOldMessageNode(node);
  const readNodeLabel = (node) => [
    node?.getAttribute?.("data-file-name"),
    node?.getAttribute?.("data-filename"),
    node?.getAttribute?.("data-name"),
    node?.getAttribute?.("aria-label"),
    node?.getAttribute?.("title"),
    node?.getAttribute?.("alt"),
    node?.innerText,
    node?.textContent,
  ].filter(Boolean).join(" ");

  const matchedNames = new Set();
  const liveInputNames = new Set();
  const readableAttachmentNames = new Set();
  const extractReadableFileNames = (value = "") => {
    const matches = String(value || "").match(
      /[^\s"'<>]+(?:\s*\((?:\d+|\d{8}-\d{6})\))?\.(?:txt|png|jpe?g|webp|gif|bmp|avif)(?=$|[\s,;:)\]])/gi,
    );
    return (matches || []).map(normalize).filter(Boolean);
  };
  for (const input of document.querySelectorAll('input[type="file"]')) {
    const inputNearComposer = roots.some((root) => root.contains?.(input));
    if (!inputNearComposer && !input.hasAttribute?.("data-vidora-file-target")) continue;
    for (const file of Array.from(input.files || [])) {
      const name = normalize(file?.name);
      if (!name) continue;
      liveInputNames.add(name);
    }
  }

  const candidates = searchRoot
    ? Array.from(searchRoot.querySelectorAll(
      '[data-file-name], [data-filename], [data-name], [data-testid*="attachment" i], [data-testid*="file" i], [class*="attachment" i], [class*="file-preview" i], [class*="file-upload" i], [class*="upload-preview" i], [aria-label], [title], button, span, p, div',
    ))
    : [];
  for (const node of candidates) {
    if (!candidateIsUsable(node)) continue;
    const raw = readNodeLabel(node);
    if (!raw || raw.length > 1200) continue;
    const label = normalize(raw);
    for (const readableName of extractReadableFileNames(raw)) {
      readableAttachmentNames.add(readableName);
    }
    for (const expectedName of expected) {
      if (labelContainsExpectedName(label, expectedName)) {
        matchedNames.add(expectedName);
      }
    }
  }

  const removeButtons = searchRoot
    ? Array.from(searchRoot.querySelectorAll(
      'button[aria-label*="remove" i], button[aria-label*="delete" i], button[aria-label*="cancel" i], button[aria-label*="xóa" i], button[title*="remove" i], button[title*="delete" i], [data-testid*="remove" i], [data-testid*="delete" i]',
    )).filter((button) => {
      if (!candidateIsUsable(button)) return false;
      const label = normalize(readNodeLabel(button));
      if (/file|attachment|upload|image|photo|tệp|tep|ảnh|anh/.test(label)) return true;
      let container = button.parentElement;
      for (let depth = 0; depth < 4 && container; depth += 1) {
        const containerLabel = normalize(readNodeLabel(container));
        if (
          expected.some((name) =>
            labelContainsExpectedName(containerLabel, name),
          )
        ) return true;
        container = container.parentElement;
      }
      return false;
    })
    : [];

  const progressNodes = searchRoot
    ? Array.from(searchRoot.querySelectorAll(
      '[role="progressbar"], [aria-busy="true"], [data-testid*="uploading" i], [class*="uploading" i], [class*="upload-progress" i]',
    )).filter(candidateIsUsable)
    : [];
  const uploading = progressNodes.length > 0;
  // Image attachment cards in the current ChatGPT composer often expose only
  // a thumbnail and a "Remove image" control. They do not expose the original
  // filename anywhere in visible text. Count only raster previews inside the
  // live composer shell; SVG document/tool icons are deliberately excluded.
  const imagePreviewNodes = searchRoot
    ? Array.from(searchRoot.querySelectorAll("img, canvas")).filter((node) => {
      if (!candidateIsUsable(node)) return false;
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width < 28 || rect.height < 28) return false;
      const label = normalize(readNodeLabel(node));
      if (/avatar|profile|logo|emoji/.test(label)) return false;
      return true;
    })
    : [];
  const imageRemoveButtonCount = removeButtons.filter((button) =>
    /image|photo|ảnh|anh/.test(normalize(readNodeLabel(button))),
  ).length;
  const genericImageSlotCount = Math.max(
    imagePreviewNodes.length,
    imageRemoveButtonCount,
  );
  const expectedImageNames = expected.filter(isImageName);
  const matchedImageNames = expectedImageNames.filter((name) =>
    matchedNames.has(name),
  );
  let remainingGenericImageSlots = Math.max(
    0,
    genericImageSlotCount - matchedImageNames.length,
  );
  const assumedImageNames = [];
  for (const expectedImageName of expectedImageNames) {
    if (matchedNames.has(expectedImageName) || remainingGenericImageSlots <= 0) continue;
    matchedNames.add(expectedImageName);
    assumedImageNames.push(expectedImageName);
    remainingGenericImageSlots -= 1;
  }
  // `input.files` is diagnostic-only. ChatGPT can keep a File object on a
  // detached/wrong input even though React never created an attachment chip.
  // Counting it as an attachment caused the gate to accept a text-only draft.
  const visualAttachmentCount = Math.max(
    matchedNames.size,
    removeButtons.length,
    genericImageSlotCount,
  );
  const contradictoryLiveInput = Array.from(liveInputNames).some(
    (name) =>
      !expected.some((expectedName) =>
        labelContainsExpectedName(name, expectedName),
      ),
  );
  const unexpectedReadableNames = Array.from(readableAttachmentNames).filter(
    (name) =>
      !expected.some((expectedName) =>
        labelContainsExpectedName(name, expectedName),
      ),
  );
  let assumedFromVisualCount = assumedImageNames.length > 0;
  if (
    !uploading &&
    !contradictoryLiveInput &&
    expectedImageNames.length === 0 &&
    matchedNames.size < expected.length &&
    visualAttachmentCount === expected.length
  ) {
    for (const expectedName of expected) matchedNames.add(expectedName);
    assumedFromVisualCount = true;
  }
  const attachmentNameSet = new Set(matchedNames);
  const attachmentNames = Array.from(attachmentNameSet);
  while (attachmentNames.length < visualAttachmentCount) {
    attachmentNames.push(`unidentified-attachment-${attachmentNames.length + 1}`);
  }

  return {
    ok: true,
    attachmentNames,
    attachmentCount: visualAttachmentCount,
    attachmentsCompleted: uploading ? 0 : visualAttachmentCount,
    attachmentUploadInProgress: uploading,
    matchedExpectedNames: Array.from(matchedNames),
    readableAttachmentNames: Array.from(readableAttachmentNames),
    unexpectedReadableNames,
    liveInputNames: Array.from(liveInputNames),
    removeButtonCount: removeButtons.length,
    progressNodeCount: progressNodes.length,
    imagePreviewCount: imagePreviewNodes.length,
    imageRemoveButtonCount,
    genericImageSlotCount,
    assumedImageNames,
    assumedFromVisualCount,
    contradictoryLiveInput,
    inputFilesAreDiagnosticOnly: true,
    mode: "current-composer-visual-evidence-v4",
  };
}

function mergeCurrentComposerAttachmentEvidence(pageState = {}, evidence = {}) {
  if (!evidence?.ok || Number(evidence?.attachmentCount || 0) <= 0) {
    return pageState;
  }
  const attachmentNames = Array.isArray(evidence.attachmentNames)
    ? evidence.attachmentNames.filter(Boolean)
    : [];
  const attachmentCount = Number(evidence.attachmentCount || attachmentNames.length);
  const uploading = Boolean(evidence.attachmentUploadInProgress);
  const hasPrompt = Boolean(pageState?.composerHasPrompt || pageState?.composerPromptHash);
  let composerState = pageState?.composerState || "";
  if (uploading) composerState = "ATTACHING_FILES";
  else if (attachmentCount > 0 && hasPrompt) {
    composerState = pageState?.sendButtonVisible ? "READY_TO_SEND" : "PROMPT_READY";
  } else if (attachmentCount > 0) composerState = "FILES_READY";

  return {
    ...pageState,
    attachmentNames,
    attachmentCount,
    attachmentsCompleted: uploading
      ? Number(evidence.attachmentsCompleted || 0)
      : attachmentCount,
    attachmentUploadInProgress: uploading,
    composerState,
    currentComposerAttachmentEvidence: evidence,
  };
}

async function getConversationStateWithExpectedAttachments(page, filePaths = []) {
  const state = await getConversationState(page);
  const expectedNames = (Array.isArray(filePaths) ? filePaths : [])
    .map((filePath) => path.basename(String(filePath || "")))
    .filter(Boolean);
  if (!expectedNames.length) return state;
  const evidence = await evaluateOnCdpPage(
    page,
    `(${inspectCurrentComposerAttachmentsScript.toString()})(${JSON.stringify(expectedNames)})`,
  ).catch((error) => ({ ok: false, error: error.message }));
  return mergeCurrentComposerAttachmentEvidence(state, evidence);
}

async function waitForExpectedAttachments(page, filePaths, options = {}) {
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || 45000));
  const pollMs = Math.max(100, Number(options.pollMs || 500));
  const stableTicksRequired = Math.max(2, Number(options.stableTicks || 2));
  const startedAt = Date.now();
  let stableTicks = 0;
  let lastInspection = null;
  let lastState = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastState = await getConversationStateWithExpectedAttachments(page, filePaths);
    lastInspection = inspectExpectedAttachments(filePaths, lastState, options);
    if (lastInspection.ok) {
      stableTicks += 1;
      if (stableTicks >= stableTicksRequired) {
        return {
          ok: true,
          inspection: lastInspection,
          state: lastState,
          stableTicks,
          waitedMs: Date.now() - startedAt,
        };
      }
    } else {
      stableTicks = 0;
    }
    await sleep(pollMs);
  }

  return {
    ok: false,
    error: lastInspection?.error || "chatgpt-attachment-upload-timeout",
    inspection: lastInspection,
    state: lastState,
    waitedMs: Date.now() - startedAt,
  };
}

async function waitForExpectedAttachmentVisible(
  page,
  filePath,
  allExpectedFilePaths,
  options = {},
) {
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || 30000));
  const pollMs = Math.max(100, Number(options.pollMs || 500));
  const stableTicksRequired = Math.max(2, Number(options.stableTicks || 2));
  const targetName = path.basename(String(filePath || "")).toLowerCase();
  const startedAt = Date.now();
  let stableTicks = 0;
  let lastState = null;
  let lastInspection = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastState = await getConversationStateWithExpectedAttachments(
      page,
      allExpectedFilePaths,
    );
    lastInspection = inspectExpectedAttachments(allExpectedFilePaths, lastState);
    const targetInspection = inspectExpectedAttachmentVisible(filePath, lastState);
    if (targetInspection.ok) {
      stableTicks += 1;
      if (stableTicks >= stableTicksRequired) {
        return {
          ok: true,
          targetName,
          inspection: lastInspection,
          state: lastState,
          stableTicks,
          waitedMs: Date.now() - startedAt,
        };
      }
    } else {
      stableTicks = 0;
    }
    await sleep(pollMs);
  }

  return {
    ok: false,
    error: "chatgpt-upload-did-not-create-visible-attachment",
    targetName,
    inspection: lastInspection,
    state: lastState,
    waitedMs: Date.now() - startedAt,
  };
}

function selectCompatibleFileInputScript(fileName = "", marker = "") {
  const name = String(fileName || "").toLowerCase();
  const extension = name.includes(".") ? `.${name.split(".").pop()}` : "";
  const mime = extension === ".txt"
    ? "text/plain"
    : [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension)
      ? "image/"
      : "";
  const allInputs = Array.from(document.querySelectorAll('input[type="file"]'));
  const inputs = allInputs.filter((input) => !input.disabled);
  const matchesAccept = (acceptValue) => {
    const accept = String(acceptValue || "").toLowerCase().trim();
    if (!accept || accept === "*/*") return true;
    const entries = accept.split(",").map((entry) => entry.trim()).filter(Boolean);
    return entries.some((entry) =>
      entry === extension ||
      (mime && (entry === mime || entry.startsWith(mime))) ||
      (extension === ".txt" && entry === "text/*"),
    );
  };
  const scored = inputs
    .filter((input) => matchesAccept(input.getAttribute("accept")))
    .map((input) => {
      const accept = String(input.getAttribute("accept") || "").toLowerCase();
      let score = input.closest("main form") ? 40 : input.closest("main") ? 20 : 0;
      if (!accept || accept === "*/*") score += 30;
      if (extension && accept.includes(extension)) score += 80;
      if (mime && accept.includes(mime)) score += 70;
      if (input.multiple) score += 5;
      return { input, score, accept, multiple: Boolean(input.multiple) };
    })
    .sort((left, right) => right.score - left.score);
  const picked = scored[0];
  if (!picked) {
    return {
      ok: false,
      error: "chatgpt-compatible-file-input-not-found",
      extension,
      inputs: inputs.map((input) => ({
        accept: input.getAttribute("accept") || "",
        multiple: Boolean(input.multiple),
        inComposer: Boolean(input.closest("main form")),
      })),
    };
  }
  for (const input of allInputs) input.removeAttribute("data-vidora-file-target");
  picked.input.setAttribute("data-vidora-file-target", marker);
  return {
    ok: true,
    selector: `input[data-vidora-file-target="${marker}"]`,
    accept: picked.accept,
    multiple: picked.multiple,
    score: picked.score,
    extension,
  };
}

async function markCompatibleFileInput(page, filePath) {
  const marker = `vidora-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const runSelection = () => evaluateOnCdpPage(
    page,
    `(${selectCompatibleFileInputScript.toString()})(${JSON.stringify(path.basename(filePath))}, ${JSON.stringify(marker)})`,
  ).catch((error) => ({ ok: false, error: error.message }));

  let selected = await runSelection();
  if (!selected?.ok) {
    const clicked = await evaluateOnCdpPage(
      page,
      `(${clickUploadButtonScript.toString()})('chatgpt')`,
    ).catch((error) => ({ ok: false, error: error.message }));
    await sleep(1000);
    selected = await runSelection();
    if (!selected?.ok && clicked?.error && !selected?.error) selected.error = clicked.error;
  }
  return { ...selected, marker };
}

async function firstVisibleLocator(locator) {
  const count = Math.min(await locator.count().catch(() => 0), 30);
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  return null;
}

async function openChatGptAttachmentChooserWithPlaywright(page, filePath) {
  const nativePage = page?.clientType === "playwright" ? page.page : null;
  if (!nativePage) {
    return { ok: false, error: "chatgpt-playwright-page-unavailable" };
  }

  // Close a stale Tools/Create image menu before opening the attachment menu.
  await nativePage.keyboard.press("Escape").catch(() => null);
  await sleep(500);

  const plusSelectors = [
    'button[aria-label="Add files and more"]',
    'button[aria-label*="Add files" i]',
    'button[aria-label*="Attach" i]',
    'button[aria-label*="Upload" i]',
    'button[data-testid*="composer-plus" i]',
    'button[data-testid*="attachment" i]',
  ];
  let plusButton = null;
  for (const selector of plusSelectors) {
    plusButton = await firstVisibleLocator(nativePage.locator(selector));
    if (plusButton) break;
  }
  if (!plusButton) {
    const composer = nativePage.locator(
      '#prompt-textarea, textarea, [data-testid="composer"] [contenteditable="true"]',
    ).first();
    const form = composer.locator("xpath=ancestor::form[1]");
    const buttons = form.locator('button, [role="button"]');
    const count = Math.min(await buttons.count().catch(() => 0), 30);
    for (let index = 0; index < count; index += 1) {
      const candidate = buttons.nth(index);
      if (!(await candidate.isVisible().catch(() => false))) continue;
      const label = `${await candidate.getAttribute("aria-label").catch(() => "") || ""} ${await candidate.getAttribute("data-testid").catch(() => "") || ""} ${await candidate.textContent().catch(() => "") || ""}`.trim();
      if (/send|submit|voice|micro|record|dictate|stop|cancel/i.test(label)) continue;
      const box = await candidate.boundingBox().catch(() => null);
      if (box && box.width <= 64 && box.height <= 64) {
        plusButton = candidate;
        break;
      }
    }
  }
  if (!plusButton) {
    return { ok: false, error: "chatgpt-add-files-button-not-found" };
  }

  await plusButton.click({ timeout: 5000 });
  await sleep(800);

  const itemName = /Add photos? (?:and|&) files|Upload (?:from computer|file)|Attach files?|Th[eê]m (?:ảnh|anh) (?:và|va) t[eệ]p|Tải t[eệ]p lên/i;
  const itemLocators = [
    nativePage.getByRole("menuitem", { name: itemName }),
    nativePage.getByRole("option", { name: itemName }),
    nativePage.getByRole("button", { name: itemName }),
    nativePage.getByText(itemName),
  ];
  let menuItem = null;
  for (const locator of itemLocators) {
    menuItem = await firstVisibleLocator(locator);
    if (menuItem) break;
  }

  if (menuItem) {
    const chooserPromise = nativePage
      .waitForEvent("filechooser", { timeout: 6000 })
      .catch(() => null);
    await menuItem.click({ timeout: 5000 });
    const chooser = await chooserPromise;
    if (chooser) {
      await chooser.setFiles(filePath);
      return { ok: true, mode: "chatgpt-add-files-filechooser" };
    }
    // Some ChatGPT builds reveal a hidden input without opening a native
    // chooser. The compatible-input fallback below handles that variant.
  }

  const selected = await markCompatibleFileInput(page, filePath);
  if (!selected?.ok) {
    return {
      ok: false,
      error: menuItem
        ? "chatgpt-add-files-menu-created-no-compatible-input"
        : "chatgpt-add-files-menu-item-not-found",
      selected,
    };
  }
  await page.setInputFiles(selected.selector, filePath);
  await evaluateOnCdpPage(
    page,
    `document.querySelectorAll('input[data-vidora-file-target]').forEach((input) => input.removeAttribute('data-vidora-file-target'))`,
  ).catch(() => null);
  return {
    ok: true,
    mode: "chatgpt-open-menu-compatible-input",
    selected,
  };
}

async function uploadOneFileToCompatibleInput(page, filePath) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: "chatgpt-attachment-local-file-missing" };
  }
  if (page?.clientType === "playwright" && page?.page) {
    const chooserUpload = await openChatGptAttachmentChooserWithPlaywright(
      page,
      filePath,
    ).catch((error) => ({ ok: false, error: error.message }));
    if (chooserUpload?.ok) return chooserUpload;
  }
  const selected = await markCompatibleFileInput(page, filePath);
  if (!selected?.ok) return selected;
  const selector = selected.selector;
  try {
    if (page?.clientType === "playwright") {
      await page.setInputFiles(selector, filePath);
    } else {
      const documentHandle = await page.DOM.getDocument();
      const query = await page.DOM.querySelector({
        nodeId: documentHandle.root.nodeId,
        selector,
      });
      if (!query?.nodeId) {
        return { ok: false, error: "chatgpt-compatible-file-input-node-missing", selected };
      }
      await page.DOM.setFileInputFiles({ nodeId: query.nodeId, files: [filePath] });
    }
    return { ok: true, selected };
  } finally {
    await evaluateOnCdpPage(
      page,
      `document.querySelectorAll('input[data-vidora-file-target]').forEach((input) => input.removeAttribute('data-vidora-file-target'))`,
    ).catch(() => null);
  }
}

async function clearUnexpectedAttachments(page, filePaths) {
  const allowedNames = filePaths.map((filePath) => path.basename(filePath).toLowerCase());
  return evaluateOnCdpPage(
    page,
    `((allowedNames) => {
      const isImageName = (name) => /\.(?:png|jpe?g|webp|gif|bmp|avif)$/i.test(String(name || ''));
      const expectedImageCount = allowedNames.filter(isImageName).length;
      const composer = document.querySelector('#prompt-textarea, textarea, [data-testid="composer"] [contenteditable="true"], main [contenteditable="true"], [contenteditable="true"]');
      const roots = [];
      if (composer?.closest?.('[data-testid="composer"]')) roots.push(composer.closest('[data-testid="composer"]'));
      if (composer?.closest?.('form')) roots.push(composer.closest('form'));
      let root = roots[0] || roots[1] || composer?.parentElement;
      for (let depth = 0; depth < 3 && root?.parentElement; depth += 1) {
        const parent = root.parentElement;
        if (parent === document.body || parent === document.documentElement || parent.tagName === 'MAIN') break;
        root = parent;
      }
      const scope = root || document;
      const clickedButtons = new Set();
      const attachments = Array.from(scope.querySelectorAll('[data-testid*="attachment" i], [data-testid*="file-preview" i], [data-testid*="file-upload" i], [class*="attachment" i], [class*="file-preview" i], [class*="file-upload" i], [class*="upload-preview" i]')).filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && element.tagName !== 'INPUT';
      });
      let clickedCount = 0;
      for (const attachment of attachments) {
        const label = String(attachment.innerText || attachment.textContent || attachment.getAttribute('aria-label') || '').toLowerCase();
        const imageLike = Boolean(attachment.querySelector('img, canvas')) || /image|photo|ảnh|anh/.test(label);
        const allowed = allowedNames.some((name) => label.includes(name)) || (imageLike && expectedImageCount > 0);
        if (!allowed) {
          const button = attachment.querySelector('button, [class*="remove"], [class*="close"], [data-testid*="remove"]');
          if (button) {
            button.click();
            clickedButtons.add(button);
            clickedCount += 1;
          }
        }
      }
      const removeButtons = Array.from(scope.querySelectorAll('button[aria-label*="remove" i], button[aria-label*="delete" i], button[aria-label*="cancel" i], button[aria-label*="xóa" i], [data-testid*="remove" i]'));
      for (const button of removeButtons) {
        if (clickedButtons.has(button)) continue;
        const rect = button.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        let container = button.parentElement;
        let label = '';
        for (let depth = 0; depth < 4 && container; depth += 1) {
          label += ' ' + String(container.innerText || container.textContent || container.getAttribute?.('aria-label') || '');
          container = container.parentElement;
        }
        const normalized = label.toLowerCase();
        const imageLike = /image|photo|ảnh|anh/.test(normalized) || Boolean(button.parentElement?.querySelector?.('img, canvas'));
        const allowed = allowedNames.some((name) => normalized.includes(name)) || (imageLike && expectedImageCount > 0);
        if (!allowed) {
          button.click();
          clickedCount += 1;
        }
      }
      return { ok: true, clickedCount };
    })(${JSON.stringify(allowedNames)})`,
  ).catch((error) => ({ ok: false, error: error.message }));
}

async function uploadFilesToChatGptSequentially(page, filePaths, sceneId = "", options = {}) {
  const expectedFilePaths = (Array.isArray(filePaths) ? filePaths : []).filter(Boolean);
  if (!expectedFilePaths.length) {
    return { ok: false, error: "chatgpt-payload-has-no-attachments" };
  }
  setChatGptSendState(sceneId, "ATTACHING");
  await appendAppLog(sceneId, {
    source: "main",
    kind: "running",
    text: `[MILESTONE] UPLOAD_BEGIN for scene ${sceneId}`,
    details: {
      stage: options.request || options.stage || "",
      expectedAttachmentNames: expectedFilePaths.map((filePath) => path.basename(filePath)),
    },
  }).catch(() => null);

  await clearUnexpectedAttachments(page, expectedFilePaths);
  await sleep(1000);

  for (let index = 0; index < expectedFilePaths.length; index += 1) {
    const filePath = expectedFilePaths[index];
    const state = await getConversationStateWithExpectedAttachments(
      page,
      expectedFilePaths,
    );
    const alreadyAttached = (state.attachmentNames || []).some((label) =>
      attachmentLabelContainsFileName(label, filePath),
    );
    if (alreadyAttached) continue;

    await appendAppLog(sceneId, {
      source: "main",
      kind: "running",
      text: `Scene ${sceneId}: Uploading attachment ${index + 1}/${expectedFilePaths.length}: ${path.basename(filePath)}`,
      details: { stage: options.request || options.stage || "" },
    }).catch(() => null);
    const uploaded = await uploadOneFileToCompatibleInput(page, filePath);
    if (!uploaded?.ok) {
      return {
        ok: false,
        error: uploaded?.error || "chatgpt-attachment-upload-failed",
        fileName: path.basename(filePath),
        diagnostics: uploaded,
      };
    }
    const visibleAfterUpload = await waitForExpectedAttachmentVisible(
      page,
      filePath,
      expectedFilePaths,
      {
        timeoutMs: Number(options.perFileVisualTimeoutMs || 30000),
        pollMs: options.attachmentPollMs,
        stableTicks: 2,
      },
    );
    if (!visibleAfterUpload?.ok) {
      return {
        ok: false,
        error: "chatgpt-upload-did-not-create-visible-attachment",
        fileName: path.basename(filePath),
        uploadMode: uploaded?.mode || "",
        inspection: visibleAfterUpload?.inspection || null,
      };
    }
    await appendAppLog(sceneId, {
      source: "main",
      kind: "ok",
      text: `Scene ${sceneId}: visible attachment confirmed: ${path.basename(filePath)}`,
      details: {
        stage: options.request || options.stage || "",
        uploadMode: uploaded?.mode || "",
        attachmentCount: visibleAfterUpload?.inspection?.actualCount || 0,
        evidenceMode:
          visibleAfterUpload?.inspection?.evidenceMode || "",
      },
    }).catch(() => null);
    await sleep(Number(options.interFileDelayMs || 1500));
  }

  const verified = await waitForExpectedAttachments(page, expectedFilePaths, {
    timeoutMs: options.attachmentTimeoutMs,
    pollMs: options.attachmentPollMs,
    stableTicks: 2,
  });
  if (!verified?.ok) {
    await appendAppLog(sceneId, {
      source: "main",
      kind: "error",
      text: `Scene ${sceneId}: attachment set verification failed.`,
      details: verified?.inspection || { error: verified?.error || "unknown" },
    }).catch(() => null);
    return verified;
  }

  // A visible chip is necessary but not sufficient: ChatGPT may still be
  // registering/parsing the file after the progress indicator disappears.
  // Keep NV1 and NV2 behind the same quiet-period gate, then revalidate the
  // complete attachment set before any control prompt is inserted.
  const postAttachmentSettleMs = Math.max(
    1500,
    Number(options.postAttachmentSettleMs || 5000),
  );
  await appendAppLog(sceneId, {
    source: "main",
    kind: "running",
    text: `[MILESTONE] ATTACHMENT_SETTLE_BEGIN for scene ${sceneId}`,
    details: {
      stage: options.request || options.stage || "",
      settleMs: postAttachmentSettleMs,
      expectedAttachmentNames: verified.inspection.expectedNames,
    },
  }).catch(() => null);
  await sleep(postAttachmentSettleMs);

  const settled = await waitForExpectedAttachments(page, expectedFilePaths, {
    timeoutMs: Number(options.postAttachmentValidationTimeoutMs || 15000),
    pollMs: options.attachmentPollMs,
    stableTicks: 3,
    uploadReceipt: createAttachmentUploadReceipt(expectedFilePaths, verified),
  });
  if (!settled?.ok) {
    await appendAppLog(sceneId, {
      source: "main",
      kind: "error",
      text: `Scene ${sceneId}: post-settle attachment verification failed.`,
      details: {
        stage: options.request || options.stage || "",
        error: settled?.error || "chatgpt-attachment-not-settled-before-prompt",
        actualLabels: settled?.inspection?.actualLabels || [],
        missing: settled?.inspection?.missing || [],
        unexpected: settled?.inspection?.unexpected || [],
        unexpectedReadableNames:
          settled?.inspection?.unexpectedReadableNames || [],
        liveInputNames: settled?.inspection?.liveInputNames || [],
        attachmentCount: settled?.inspection?.actualCount || 0,
        removeButtonCount: settled?.inspection?.removeButtonCount || 0,
        imagePreviewCount: settled?.inspection?.imagePreviewCount || 0,
        recoveredFromUploadReceipt:
          settled?.inspection?.recoveredFromUploadReceipt || [],
      },
    }).catch(() => null);
    return {
      ...settled,
      error: settled?.error || "chatgpt-attachment-not-settled-before-prompt",
    };
  }

  setChatGptSendState(sceneId, "PREPARING");
  await appendAppLog(sceneId, {
    source: "main",
    kind: "ok",
    text: `[MILESTONE] UPLOAD_FINISHED for scene ${sceneId}`,
    details: {
      stage: options.request || options.stage || "",
      expectedAttachmentNames: settled.inspection.expectedNames,
      attachmentCount: settled.inspection.actualCount,
      settledForMs: postAttachmentSettleMs,
      recoveredFromUploadReceipt:
        settled.inspection.recoveredFromUploadReceipt || [],
    },
  }).catch(() => null);
  return {
    ok: true,
    uploaded: settled.state,
    verified: settled,
    postAttachmentSettleMs,
  };
}

async function uploadFileToChatGptDirectly(page, filePath, sceneId = "") {
  return uploadFilesToChatGptSequentially(page, [filePath], sceneId, {
    request: "direct-file-upload",
  });
}

module.exports = {
  initChatGptUpload,
  normalizeAttachmentLabel,
  attachmentLabelContainsFileName,
  createAttachmentUploadReceipt,
  inspectExpectedAttachments,
  verifyAttachmentsReady,
  inspectExpectedAttachmentVisible,
  inspectCurrentComposerAttachmentsScript,
  mergeCurrentComposerAttachmentEvidence,
  getConversationStateWithExpectedAttachments,
  waitForExpectedAttachments,
  waitForExpectedAttachmentVisible,
  selectCompatibleFileInputScript,
  markCompatibleFileInput,
  openChatGptAttachmentChooserWithPlaywright,
  uploadOneFileToCompatibleInput,
  uploadFilesToChatGptSequentially,
  uploadFileToChatGptDirectly,
};
