"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const veoup = fs.readFileSync(
  path.join(root, "electron", "main", "veoup", "veoup.js"),
  "utf8",
).replace(/\r\n/g, "\n");
const coordinator = fs.readFileSync(
  path.join(root, "electron", "main", "veoup", "batch_coordinator.js"),
  "utf8",
).replace(/\r\n/g, "\n");

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert(start >= 0 && end > start, `Missing source block: ${startMarker}`);
  return source.slice(start, end);
}

const payloadBlock = sliceBetween(
  veoup,
  "const automationPayload = {",
  "await fsp.writeFile(payloadPath",
);
for (const field of [
  "batchId",
  "batchMode",
  "chunkIndex",
  "chunkCount",
  "expectedRows",
  "autoStartVideoGeneration",
  "previewStartButtonOnly",
  "batchFolderFileCount",
  "expectedFileNames",
  "singleFileSelectionText",
]) {
  assert(payloadBlock.includes(`${field}:`), `PowerShell payload is missing ${field}`);
}

const promptSelection = sliceBetween(
  veoup,
  "const collectedKeyframes = await collectKeyframes",
  "const exportedPrompts = await exportVeoUpPromptFile",
);
assert(
  promptSelection.includes("payload.batchMode") &&
    promptSelection.includes("collectMotionPromptsFromScenes"),
  "Batch mode must derive prompts from the strict manifest scenes, not a stale grouped folder",
);
assert(
  promptSelection.includes("validateVeoUpBatchCollections"),
  "Batch adapter must reject mismatched scene IDs before UI automation",
);

const rowProbe = sliceBetween(
  veoup,
  "function Wait-For-ExpectedBatchRows($Payload, $SelectionProof) {",
  "function Click-ImageToVideo-Tab",
);
assert(rowProbe.includes("Count-LeftImageRows $window"), "Batch must probe image rows");
assert(rowProbe.includes("Count-LeftPromptRows $window"), "Batch must probe prompt rows");
assert(
  rowProbe.includes("$imageRows -ge $expectedRows -and $promptRows -ge $expectedRows"),
  "Batch readiness must require both image and prompt row counts",
);
assert(
  rowProbe.includes("[Math]::Min([int]$promptRows, [int]$imageRows)"),
  "detectedRows must reflect the weaker measured side",
);
assert(rowProbe.includes("veoup-row-count-unverifiable"), "Unverifiable UIA counts must fail closed");
assert(rowProbe.includes("veoup-batch-row-count-mismatch"), "Missing rows must return a distinct mismatch error");
assert(rowProbe.includes("$imageRows -eq 0 -and $promptRows -eq 0"), "Partial visible imports must fail closed");
assert(rowProbe.includes("verified = $false; method = 'virtualized-rows-exact-batch-fallback'"), "Virtualized fallback must report its limited verification");
assert(
  veoup.includes("function Confirm-OpenFileDialogSelection") &&
    veoup.includes("function Wait-ForOpenFileDialogClosed"),
  "Batch import must invoke Open and verify that the native dialog closed",
);
assert(
  !veoup.includes("function Get-OpenFileDialogSelectionProof"),
  "Virtualized selection-item counts must not block the Open action",
);

const dispatchBlock = sliceBetween(
  veoup,
  "$rowValidation = Wait-For-ExpectedBatchRows $payload $selectionProof",
  "'VIDORA_VEOUP_RESULT ' + ($result | ConvertTo-Json -Depth 8 -Compress)\nWrite-Host \"[VeoUp] Automation completed.\"",
);
const previewStart = dispatchBlock.indexOf("if ($payload.previewStartButtonOnly) {");
const loadedStart = dispatchBlock.indexOf("if (!$payload.autoStartVideoGeneration) {");
const generateStart = dispatchBlock.indexOf("$generateResult = Invoke-FinalStartButton $payload");
assert(previewStart >= 0 && loadedStart > previewStart && generateStart > loadedStart, "Option gates must precede Generate");
assert(
  !dispatchBlock.slice(previewStart, loadedStart).includes("Invoke-FinalStartButton"),
  "Preview-only branch must not invoke Generate",
);
assert(
  !dispatchBlock.slice(loadedStart, generateStart).includes("Invoke-FinalStartButton"),
  "autoStart=false branch must not invoke Generate",
);
assert(dispatchBlock.includes("status = 'loaded'"), "autoStart=false must return loaded");
assert(dispatchBlock.includes("'previewed'"), "preview-only must return previewed");
assert(
  dispatchBlock.includes("detectedRows = [int]$rowValidation.detectedRows"),
  "Adapter result must report the measured row count",
);

const finalStart = sliceBetween(
  veoup,
  "function Invoke-FinalStartButton($Payload) {",
  "function Preview-VeoUpStartButton($Payload) {",
);
const batchReturn = finalStart.indexOf("if ($Payload.batchMode) {");
const videoWait = finalStart.indexOf("Wait-For-StableNewVideo $Payload $baselinePaths $submittedAtUtc");
const cleanup = finalStart.indexOf("Invoke-VeoUpPostGenerationCleanup $Payload");
assert(batchReturn >= 0 && videoWait > batchReturn, "Batch must return after acknowledgement before MP4 polling");
assert(cleanup > videoWait, "Per-scene cleanup must remain after stable MP4 detection");
assert(
  finalStart.slice(batchReturn, videoWait).includes("submitted = $true"),
  "Batch Generate acknowledgement must return submitted",
);
assert(
  dispatchBlock.includes("status = $(if ($payload.batchMode) { 'submitted' } else { 'completed' })"),
  "Only the existing per-scene lifecycle may return completed",
);

assert(coordinator.includes("batchMode: true"), "Coordinator must explicitly select batch adapter behavior");
assert(coordinator.includes("chunkIndex"), "Coordinator must persist chunkIndex metadata");
assert(coordinator.includes("chunkCount"), "Coordinator must persist chunkCount metadata");

console.log("VeoUp batch adapter safety contract tests passed");
