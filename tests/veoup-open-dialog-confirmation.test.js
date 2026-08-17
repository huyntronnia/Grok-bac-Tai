"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "electron/main/veoup/veoup.js"),
  "utf8",
);

assert(
  source.includes("function Confirm-OpenFileDialogSelection"),
  "VeoUp must have a dedicated Open dialog confirmation helper",
);
assert(
  source.includes("function Wait-ForOpenFileDialogClosed"),
  "VeoUp must verify that the native file dialog actually closed",
);

const batchStart = source.indexOf(
  'Write-Host "[VeoUp Batch] Navigating to the exact batch folder',
);
const importWait = source.indexOf("$imageImportWaitMs = 5000", batchStart);
assert(batchStart >= 0 && importWait > batchStart, "VeoUp batch selection block missing");
const batchBlock = source.slice(batchStart, importWait);

const confirmIndex = batchBlock.indexOf("Confirm-OpenFileDialogSelection");
const selectAllIndex = batchBlock
  .slice(0, confirmIndex)
  .lastIndexOf("SendWait('^a')");
assert(selectAllIndex >= 0, "batch selection must issue Ctrl+A");
assert(confirmIndex > selectAllIndex, "batch must confirm Open after Ctrl+A");
assert(
  !batchBlock.includes("Get-OpenFileDialogSelectionProof"),
  "virtualized UIA selection count must not gate the Open action",
);

const helperStart = source.indexOf("function Confirm-OpenFileDialogSelection");
const helperEnd = source.indexOf("function Count-LeftPromptRows", helperStart);
assert(helperStart >= 0 && helperEnd > helperStart, "Open confirmation helper block missing");
const helper = source.slice(helperStart, helperEnd);
assert(helper.includes("AutomationId"), "Open helper must prefer a concrete dialog button identity");
assert(
  helper.includes("AutomationElement]::ControlTypeProperty") &&
    helper.includes("ControlType]::Button"),
  "Open helper must query only native dialog buttons instead of scanning virtualized file items",
);
assert(helper.includes("Click-Element"), "Open helper must invoke/click the native Open button");
assert(helper.includes("SendWait('{ENTER}')"), "Open helper must retain Enter fallback");
assert(helper.includes("SendWait('{ESC}')"), "Open helper must close a failed dialog instead of leaving it blocking VeoUp");
assert(helper.includes("Wait-ForOpenFileDialogClosed"), "Open helper must verify closure after every confirmation attempt");

assert(
  source.includes("veoup-file-dialog-confirm-failed"),
  "dialog confirmation failure must return a structured error",
);
assert(
  source.includes("exact-folder-ctrl-a-open-confirmed"),
  "post-close verification must record the exact-folder selection method",
);

console.log("VeoUp Open dialog confirmation regression tests passed");
