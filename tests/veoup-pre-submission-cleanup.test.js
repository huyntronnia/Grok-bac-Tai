const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const veoup = fs.readFileSync(path.join(root, 'electron/veoupAutomation.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');

function sliceBetween(startMarker, endMarker) {
  const start = veoup.indexOf(startMarker);
  const end = veoup.indexOf(endMarker, start);
  assert(start >= 0 && end > start, `${startMarker} block not found`);
  return veoup.slice(start, end);
}

const state = sliceBetween('function Get-VeoUpInputState($Window) {', 'function Write-VeoUpCleanupSnapshot');
assert(state.includes('hasConfirmedStaleInput = [bool]($imageRows -gt 0 -or $nonEmptyPromptFields -gt 0)'), 'stale input must require positive rows or prompt text');
assert(state.includes("$hasImageFileToken = $name -match '\\.png|\\.jpg|\\.jpeg|\\.webp|scene[_\\s-]*\\d+|keyframe'"), 'image rows must require a concrete file/keyframe token');
assert(!state.includes("$control -match 'Image|DataItem|ListItem')) { $imageRows += 1 }"), 'generic Qt image/list controls must not count as stale rows');
assert(state.includes('inspectOk = $inspectOk'), 'snapshot must report uncertain Qt inspection state');
assert(state.includes('inspectedElementCount = $inspectedElementCount'), 'snapshot must include inspected element count');

const cleanup = sliceBetween('function Invoke-VeoUpInputCleanup($Payload, [switch]$BeforeSubmission) {', 'function Invoke-VeoUpPostGenerationCleanup($Payload) {');
assert(cleanup.includes('Dismiss-VeoUpCompletionPopup $hwnd'), 'pre-submission cleanup must dismiss completion popup');
assert(cleanup.includes('VeoUp pre-cleanup snapshot'), 'pre-cleanup snapshot log missing');
assert(cleanup.includes('VeoUp post-cleanup snapshot'), 'post-cleanup snapshot log missing');
assert(cleanup.includes('VeoUp pre-submission state appears clean; continuing.'), 'uncertain clean state must continue');
assert(cleanup.includes('if ($BeforeSubmission -and !$before.hasConfirmedStaleInput)'), 'pre-submission gate must not fail on uncertain inspection');
assert(cleanup.includes('VeoUp stale input detected.'), 'confirmed stale log missing');
assert(cleanup.includes('Find-MainVeoUpXoaButton $window'), 'confirmed stale rows must trigger main Xoa');
assert(cleanup.includes('Clear-VeoUpPromptFieldsDirectly $window'), 'fallback prompt clearing missing');
assert(cleanup.includes('Invoke-VeoUpPerRowCleanup $window'), 'fallback per-row cleanup missing');
assert(cleanup.includes('confirmedStaleBeforeCleanup = $true'), 'hard failure must record confirmed stale');
assert(!cleanup.includes("return [pscustomobject]@{ ok = $false; error = 'veoup-red-xoa-button-not-found'; before = $before }"), 'missing Xoa alone must not fail before fallback cleanup');

const preGate = sliceBetween('Write-Host "[VeoUp] Verifying clean input state before new scene submission..."', 'Write-Host "[VeoUp] Importing exact keyframe files:');
assert(preGate.includes('Invoke-VeoUpInputCleanup $payload -BeforeSubmission'), 'pre-submission cleanup retry missing');
assert(preGate.includes("error = 'veoup-pre-submission-cleanup-failed'"), 'confirmed stale cleanup failure must return ok:false before import');
assert(preGate.indexOf("error = 'veoup-pre-submission-cleanup-failed'") < preGate.indexOf('exit 0'), 'failure result must exit before import');

assert(main.includes('if (result?.ok === false)'), 'main must propagate VeoUp ok:false');
assert(main.includes('throw error;'), 'VeoUp ok:false must throw before scene success logging');
assert(main.indexOf('if (result?.ok === false)') < main.indexOf('const sourceVideoPath = getVeoUpVideoSourcePath(result)'), 'VeoUp failure must stop before video success path');

console.log('veoup pre-submission cleanup tests passed');
