const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const veoup = fs.readFileSync(path.join(root, 'electron/veoupAutomation.js'), 'utf8');

function sliceBetween(startMarker, endMarker) {
  const start = veoup.indexOf(startMarker);
  const end = veoup.indexOf(endMarker, start);
  assert(start >= 0 && end > start, `${startMarker} block not found`);
  return veoup.slice(start, end);
}

const popup = sliceBetween('function Dismiss-VeoUpCompletionPopup($VeoUpHwnd) {', 'function Get-VeoUpInputState($Window) {');
assert(veoup.includes('Completion popup is foreground at $Stage; cleanup will handle it.'), 'foreground verification must allow completion popup before cleanup');
assert(veoup.includes("$isNativeDialog = $win.ClassName -eq '#32770'"), 'popup detection must include native #32770 dialog windows');
assert(veoup.includes("$isQtCompletionPopup = $win.ClassName -eq 'Qt690QWindowIcon'"), 'popup detection must include VeoUp Qt completion popup windows');
assert(veoup.includes('if ($targetPid -gt 0 -and [int]$win.ProcessId -ne $targetPid) { continue }'), 'popup detection must belong to VeoUp process');
assert(popup.includes('VeoUp completion popup detected.'), 'completion popup detection log missing');
assert(popup.includes('Find-DialogButtonByName $dialogElement @(\'^no$\''), 'popup cleanup must target No button');
assert(veoup.includes('function Find-DialogNoButtonByPosition($DialogElement) {'), 'popup cleanup must fallback to right-side No button position');
assert(popup.includes('$noButton = Find-DialogNoButtonByPosition $dialogElement'), 'popup cleanup must use positional No fallback');
assert(popup.includes('Find-DialogButtonByName $dialogElement @(\'^yes$\''), 'popup code must detect Yes so it can avoid it');
assert(popup.indexOf('Find-DialogButtonByName $dialogElement @(\'^no$\'') < popup.indexOf('[void](Click-Element $noButton)'), 'No button must be selected before click');
assert(!popup.includes('Click-Element $yesButton'), 'popup cleanup must never click Yes');
assert(popup.includes('VeoUp completion popup: clicked No.'), 'No-click log missing');
assert(popup.includes('veoup-completion-popup-did-not-close'), 'cleanup must wait for popup closure');

const cleanup = sliceBetween('function Invoke-VeoUpInputCleanup($Payload, [switch]$BeforeSubmission) {', 'function Invoke-VeoUpPostGenerationCleanup($Payload) {');
assert(cleanup.includes('VeoUp post-generation cleanup started.'), 'cleanup start log missing');
assert(veoup.includes('function Find-MainVeoUpXoaButton($Window) {'), 'main Xoa locator missing');
assert(veoup.includes("$name -notmatch '^xoa$|xoa tat ca|clear|delete all|remove all'"), 'main Xoa locator must match Xoa button text');
assert(veoup.includes('$inUpperLeft = $box.Left -lt ($rect.Left + ($rect.Width * 0.50))'), 'main Xoa locator must restrict to upper-left image-selection area');
assert(cleanup.includes('$button = Find-MainVeoUpXoaButton $window'), 'cleanup must prefer main red Xoa button by text/location');
assert(cleanup.includes("Click-VeoUpClientPoint $hwnd ([double]${clearButtonOffsetX}) ([double]${clearButtonOffsetY}) 'clear-xoa-button'"), 'cleanup fallback must use client-to-screen coordinate mapping');
assert(cleanup.includes('VeoUp red Xóa button clicked.'), 'red Xoa click log missing');
assert(cleanup.includes('Confirm-VeoUpClearDialogIfPresent $hwnd'), 'cleanup must confirm clear dialog when present');
assert(cleanup.includes('$after.hasStaleInput'), 'cleanup must verify old rows/prompts are gone');
assert(cleanup.includes('VeoUp input state cleared for next scene.'), 'input cleared log missing');

const finalStart = sliceBetween('function Invoke-FinalStartButton($Payload) {', 'Write-Host "[VeoUp] Verifying clean input state before new scene submission..."');
assert(finalStart.includes('Wait-For-StableNewVideo $Payload $baselinePaths $submittedAtUtc'), 'cleanup must happen after stable video detection');
assert(finalStart.indexOf('Wait-For-StableNewVideo $Payload $baselinePaths $submittedAtUtc') < finalStart.indexOf('Invoke-VeoUpPostGenerationCleanup $Payload'), 'post cleanup must run after stable MP4 detection');
assert(finalStart.includes('veoup-post-generation-cleanup-failed'), 'post-generation cleanup failure marker missing');
assert(finalStart.includes('ok = $true; sourceDownloadPath = $video.path; videoPath = $video.path'), 'cleanup failure must not turn valid video into failure');

assert(veoup.includes('Invoke-VeoUpInputCleanup $payload -BeforeSubmission'), 'pre-submission cleanup retry missing');
assert(veoup.includes('[VeoUp] Verifying clean input state before new scene submission...'), 'pre-submission clean-state log missing');
assert(veoup.includes("error = 'veoup-pre-submission-cleanup-failed'"), 'stale pre-submission cleanup failure must stop before import');
assert(veoup.indexOf("error = 'veoup-pre-submission-cleanup-failed'") < veoup.indexOf('Write-Host "[VeoUp] Importing $($payload.imageCount) validated keyframe file(s)'), 'pre-submission cleanup gate must run before keyframe import');
assert(veoup.includes('postGenerationCleanupError = [string]$generateResult.cleanupError'), 'success result must expose cleanup failure marker');
assert(!/Remove-Item\s+\$video\.path|Remove-Item\s+\$generateResult\.videoPath|Remove-Item\s+\$generateResult\.sourceDownloadPath/i.test(veoup), 'cleanup must not delete generated MP4');

console.log('veoup post-generation cleanup tests passed');
