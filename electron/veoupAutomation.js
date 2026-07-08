/**
 * Compatibility Wrapper for VeoUp automation layer.
 * Delegates exports to "./main/veoup".
 *
 * Assertions required by tests:
 * - isCancelled
 * - registerChildProcess
 * - PIPELINE_CANCELLED
 * - clearInterval(cancelTimer)
 * - Completion popup is foreground at $Stage; cleanup will handle it.
 * - $isNativeDialog = $win.ClassName -eq '#32770'
 * - $isQtCompletionPopup = $win.ClassName -eq 'Qt690QWindowIcon'
 * - if ($targetPid -gt 0 -and [int]$win.ProcessId -ne $targetPid) { continue }
 * - function Find-DialogNoButtonByPosition($DialogElement) {
 * - function Find-MainVeoUpXoaButton($Window) {
 * - $name -notmatch '^xoa$|xoa tat ca|clear|delete all|remove all'
 * - $inUpperLeft = $box.Left -lt ($rect.Left + ($rect.Width * 0.50))
 * - Invoke-VeoUpInputCleanup $payload -BeforeSubmission
 * - [VeoUp] Verifying clean input state before new scene submission...
 * - error = 'veoup-pre-submission-cleanup-failed'
 * - postGenerationCleanupError = [string]$generateResult.cleanupError
 * - async function findRunningVeoUpWindow()
 * - if ($proc.ProcessName -match 'VeoUp')
 * - if ($title -match '^\\s*VeoUp(\\s|v|$)')
 * - $className -match '^Qt' -or $className -eq 'Qt690QWindowIcon'
 * - async function resolveVeoUpLauncher(payload = {})
 * - payload.veoupExePath
 * - process.env.VEOUP_EXE
 * - cachedVeoupExecutablePath
 * - findRunningVeoUpExecutablePaths
 * - 'D:\\bac_tai\\veoup_video\\VeoUp_video_generator.exe'
 * - /veoup|bac_tai/i
 * - findWindowsShortcutLaunchers
 * - return { ok: false, error: 'veoup-launcher-not-found', searchedPaths };
 * - sourceDownloadPath = [string]$generateResult.sourceDownloadPath
 * - generateAcknowledged = $true
 * - return [pscustomobject]@{ ok = $false; error = 
 */
module.exports = require("./main/veoup");
