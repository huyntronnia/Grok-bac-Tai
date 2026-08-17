const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const veoup = fs.readFileSync(path.join(root, 'electron/veoupAutomation.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');

const invokeStart = veoup.indexOf('function Invoke-FinalStartButton($Payload) {');
const invokeEnd = veoup.indexOf('Write-Host "[VeoUp] Importing $($payload.imageCount) validated keyframe file(s)', invokeStart);
assert(invokeStart >= 0 && invokeEnd > invokeStart, 'Generate submission function missing');
const invokeGenerate = veoup.slice(invokeStart, invokeEnd);

assert(invokeGenerate.includes('Invoke-GenerateClickAttempt $Payload $attempt $maxAttempts'), 'Generate click must use bounded attempt helper');
assert(invokeGenerate.includes('$maxAttempts = 2'), 'Generate click retries must be bounded to 2');
assert(invokeGenerate.includes('veoup-generate-click-not-acknowledged'), 'Missing Generate acknowledgement must fail hard');
assert(invokeGenerate.includes('Get-VideoFileSnapshot $Payload'), 'Video baseline must be recorded before Generate');
assert(invokeGenerate.indexOf('Get-VideoFileSnapshot $Payload') < invokeGenerate.indexOf('Invoke-GenerateClickAttempt $Payload'), 'Baseline must happen before Generate click');
assert(invokeGenerate.includes('Wait-For-StableNewVideo $Payload $baselinePaths $submittedAtUtc'), 'Video wait must happen after acknowledgement');
assert(!/if\s*\(!fs\.existsSync|veoup-video-missing-after-submission/.test(invokeGenerate), 'Generate function must not require MP4 immediately after click');

const clickAttemptStart = veoup.indexOf('function Invoke-GenerateClickAttempt(');
const clickAttemptEnd = veoup.indexOf('function Get-VideoSearchRoots', clickAttemptStart);
assert(clickAttemptStart >= 0 && clickAttemptEnd > clickAttemptStart, 'Generate click attempt helper missing');
const clickAttempt = veoup.slice(clickAttemptStart, clickAttemptEnd);
assert(clickAttempt.includes("Click-VeoUpClientPoint $hwnd ([double]${startButtonOffsetX}) ([double]${startButtonOffsetY}) 'generate-button'"), 'Generate fallback click must use client-to-screen mapping');
assert(clickAttempt.includes('Find-GenerateButton $window'), 'Generate should prefer UI Automation button invocation');
assert(clickAttempt.includes('Test-VeoUpSubmissionAcknowledged $beforeState $afterState'), 'Generate click must wait for state-change acknowledgement');
assert(clickAttempt.includes('Scene $($Payload.sceneId): Generate button click attempt $Attempt/$MaxAttempts.'), 'Generate attempt log missing');
assert(clickAttempt.includes('Scene $($Payload.sceneId): VeoUp generation submission acknowledged.'), 'Generate acknowledgement log missing');

const waitStart = veoup.indexOf('function Wait-For-StableNewVideo(');
const waitEnd = veoup.indexOf('function Invoke-FinalStartButton', waitStart);
assert(waitStart >= 0 && waitEnd > waitStart, 'Stable video wait helper missing');
const waitVideo = veoup.slice(waitStart, waitEnd);
assert(waitVideo.includes('$timeoutMs = 1200000'), 'Default generation timeout must be 20 minutes');
assert(waitVideo.includes('Start-Sleep -Milliseconds 5000'), 'Video polling must wait around 5 seconds');
assert(waitVideo.includes('!$BaselinePaths.ContainsKey($_.FullName)'), 'Video polling must ignore old baseline files');
assert(waitVideo.includes('$_.LastWriteTimeUtc -ge $SubmittedAtUtc'), 'Video polling must require newly modified files');
assert(waitVideo.includes('$stable[$key].count -ge 3'), 'Video file must be stable across multiple polls');
assert(waitVideo.includes('Scene $($Payload.sceneId): VeoUp rendering in progress...'), 'Rendering progress log missing');
assert(waitVideo.includes('Scene $($Payload.sceneId): New video detected; waiting for file stabilization.'), 'New video stabilization log missing');

assert(veoup.includes('sourceDownloadPath = [string]$generateResult.sourceDownloadPath'), 'Successful result must include source video path');
assert(veoup.includes('generateAcknowledged = $true'), 'Successful result must mark Generate acknowledgement');
assert(veoup.includes("return [pscustomobject]@{ ok = $false; error = "), 'VeoUp Generate failure must return ok false');
assert(main.includes('if (result?.ok === false)'), 'Main must propagate VeoUp ok:false failure');
assert(main.includes('result?.generateAcknowledged !== true'), 'Main success gate must require Generate acknowledgement');
assert(main.includes('Video validated as ${path.basename(sceneMediaPaths.videoPath)}'), 'Video validation log missing');
assert(main.includes("lastFrameValidation: { ok: true, skipped: true, reason: 'last-frame-disabled' }"), 'Last Frame validation must be explicitly disabled');
assert(main.includes('Last Frame extraction skipped'), 'Main must log skipped Last Frame extraction');
assert(main.includes('videoValidated: true'), 'Scene success must require videoValidated true');
assert(main.includes("lastFramePath: ''"), 'Scene success must not require Last Frame path');

console.log('veoup generate lifecycle tests passed');
