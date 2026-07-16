const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const veoup = fs.readFileSync(path.join(root, 'electron/main/veoup/veoup.js'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'electron/main/pipeline/pipeline_runner.js'), 'utf8');

const executeStart = veoup.indexOf('async function executeVeoUpAutomation(payload = {})');
const executeEnd = veoup.indexOf('\n}\nlet calibrationSession', executeStart);
assert(executeStart >= 0 && executeEnd > executeStart, 'executeVeoUpAutomation source not found');
const executeBlock = veoup.slice(executeStart, executeEnd);

assert(executeBlock.includes("let resolvedOutputFolder = '';"), 'executeVeoUpAutomation must declare scoped output folder before try');
assert(executeBlock.includes("payload.outputFolder || payload.videoOutputFolder || process.env.VEOUP_OUTPUT_DIR || DEFAULT_VEOUP_OUTPUT_DIR"), 'resolved output folder must derive from options/env/default');
assert(!executeBlock.includes('return { ok: false, error: error?.message || String(error), outputFolder };'), 'catch must not reference undeclared outputFolder');
assert(executeBlock.includes('outputFolder: resolvedOutputFolder'), 'failures must return scoped output folder');

assert(veoup.includes('async function findRunningVeoUpWindow()'), 'running VeoUp window probe missing');
assert(veoup.includes("if ($proc.ProcessName -match 'VeoUp')"), 'running probe must detect VeoUp process name');
assert(veoup.includes("if ($title -match '^\\\\s*VeoUp(\\\\s|v|$)')"), 'running probe must detect VeoUp window title');
assert(veoup.includes("$className -match '^Qt' -or $className -eq 'Qt690QWindowIcon'"), 'running probe must detect Qt VeoUp window class');
assert(executeBlock.includes('if (runningVeoUpWindow?.running)'), 'automation must attach to running VeoUp before launcher lookup');
assert(executeBlock.includes('Attached to running VeoUp window'), 'attach log missing');

assert(veoup.includes('async function resolveVeoUpLauncher(payload = {})'), 'launcher resolver missing');
assert(veoup.includes('payload.veoupExePath'), 'configured executable path must be checked first');
assert(veoup.includes('process.env.VEOUP_EXE'), 'VEOUP_EXE must be checked');
assert(veoup.includes('cachedVeoupExecutablePath'), 'saved executable path must be checked');
assert(veoup.includes('findRunningVeoUpExecutablePaths'), 'running VeoUp executable paths must be searched');
assert(veoup.includes("'D:\\\\bac_tai\\\\veoup_video\\\\VeoUp_video_generator.exe'"), 'known VeoUp generator install path must be searched');
assert(veoup.includes('/veoup|bac_tai/i'), 'launcher scan must include the actual bac_tai install tree');
assert(veoup.includes('findWindowsShortcutLaunchers'), 'Windows shortcuts must be searched');
assert(veoup.includes("return { ok: false, error: 'veoup-launcher-not-found', searchedPaths };"), 'missing launcher must return structured error');
assert(executeBlock.includes("return { ok: false, error: 'veoup-launcher-not-found', status: 'veoup-launcher-not-found'"), 'execute must propagate structured launcher failure');
assert(executeBlock.includes('payload.veoupExePath = resolvedLauncher.launcherPath;'), 'resolved launcher must be passed into PowerShell payload');
assert(executeBlock.includes('payload.veoupExePath = runningVeoUpWindow.window.executablePath;'), 'running VeoUp executable path must be passed into PowerShell payload');
assert(executeBlock.includes('veoupExePath: payload.veoupExePath ||'), 'PowerShell automation payload must include resolved executable');
assert(executeBlock.includes('spawn(resolvedLauncher.launcherPath'), 'configured/resolved executable must launch VeoUp');

assert(veoup.includes('function isVeoUpStageError(error)'), 'VeoUp stage error classifier missing');
assert(veoup.includes('error?.details?.result?.videoError'), 'VeoUp classifier must inspect nested durable result videoError');
assert(runner.includes('!isVeoUpFailure'), 'VeoUp failures must bypass Fresh Room Recovery');
assert(runner.includes('const isVeoUpFailure = isVeoUpStageError(error) || isPersistedVeoUpStage;'), 'VeoUp stage must bypass Fresh Room Recovery even when wrapped');
assert(veoup.includes("error.status = result?.status || result?.error || 'veoup-automation-failed';"), 'runVeoUpScriptAsPromise must preserve structured status');
assert(veoup.includes('error.details = result || {};'), 'runVeoUpScriptAsPromise must preserve structured result details');
assert(/const currentStage = isVeoUpFailure\s*\? "veoup_prepare"/.test(runner), 'VeoUp failures must persist veoup_prepare');
const veoupSubmitStart = runner.indexOf('persistDurableStage(projectDir, sceneId, "veoup_prepare"');
const veoupSubmitEnd = runner.indexOf('videoResult = await generateVideoWithProvider', veoupSubmitStart);
assert(veoupSubmitStart >= 0 && veoupSubmitEnd > veoupSubmitStart, 'VeoUp submit block not found');
const preAutomationStageBlock = runner.slice(veoupSubmitStart, veoupSubmitEnd);
assert(!preAutomationStageBlock.includes("'veoup_image_loaded'"), 'must not persist veoup_image_loaded before automation success');
assert(!preAutomationStageBlock.includes("'veoup_prompt_loaded'"), 'must not persist veoup_prompt_loaded before automation success');
assert(preAutomationStageBlock.includes('keyframePath: imagePath'), 'VeoUp retries must preserve keyframe path');
assert(preAutomationStageBlock.includes('motionPromptPath: existingMotionPromptPath'), 'VeoUp retries must preserve motion prompt path');

console.log('veoup launch recovery tests passed');
