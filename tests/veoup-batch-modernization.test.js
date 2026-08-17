"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const main = read("electron/main.js");
const runner = read("electron/main/pipeline/pipeline_runner.js");
const veoup = read("electron/main/veoup/veoup.js");
const collection = read("electron/main/veoup/collection_store.js");
const manifest = read("electron/main/veoup/batch_manifest.js");
const renderer = read("electron/renderer.js");

assert(runner.includes("stageSceneForVeoUp({"), "NV1/NV2-only completion must stage each scene incrementally");
assert(runner.includes("readyForVeoUp: true"), "scene completion must persist readyForVeoUp");
assert(runner.includes("enqueueProjectWrite(stateFile"), "pipeline_state.json updates must share a serialized write queue");
assert(collection.includes("copyFileAtomic(sourceKeyframePath"), "keyframe collection must use atomic copy");
assert(collection.includes("rebuildVeoUpPromptsReadyUnlocked"), "aggregate prompt file must be incrementally rebuilt");
assert(manifest.includes("reconcileVeoUpCollection({"), "manifest must reconcile the canonical collection");
assert(veoup.includes("prepareVeoUpBatchSelectionFolder"), "batch adapter must use an exact selection folder");
assert(!/\bfileSelectionText\s*:/.test(veoup), "batch adapter must not rebuild a long absolute-path string");
assert(veoup.includes("SendWait('+{TAB}')") && veoup.includes("SendWait('^a')"), "native dialog must select all files from its file list");
assert(veoup.includes("Confirm-OpenFileDialogSelection"), "native dialog selection must be confirmed through the Open button helper");
assert(!veoup.includes("Get-OpenFileDialogSelectionProof ([int]$payload.imageCount)"), "virtualized selection count must not abort before Open");
assert(veoup.includes("dialog-selection-plus-surface-ready"), "virtualized VeoUp UI must have a non-row-count verification path");
assert(!veoup.includes("async function scanProjectAndRunVeoUp(payload = {})"), "dead legacy scan implementation must be removed");
assert(!veoup.includes("buildVeoUpPromptsReadyFile"), "dead prompt aggregation implementation must be removed");
assert(!main.includes("persistImageMotionOnlySharedOutputs"), "dead non-atomic shared-output implementation must be removed");
assert(main.includes("async function scanProjectAndRunVeoUpHandler"), "active scan IPC handler must remain");
assert(renderer.includes("currentScene.readyForVeoUp = result.readyForVeoUp === true"), "renderer must retain canonical readiness metadata");

console.log("VeoUp batch modernization regression tests passed");
