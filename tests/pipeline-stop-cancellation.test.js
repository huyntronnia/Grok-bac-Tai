const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const html = read('electron/index.html');
const css = read('electron/style.css');
const renderer = read('electron/renderer.js');
const preload = read('electron/preload.js');
const main = read('electron/main.js');
const veoup = read('electron/veoupAutomation.js');

assert(html.includes('id="stop-pipeline-btn"'), 'Stop button missing beside main Start Pipeline');
assert(html.includes('id="stop-pipeline-inline-btn"'), 'Inline Stop button missing beside inline Start Pipeline');
assert(/id="stop-pipeline-btn"[\s\S]*?class="ghost danger stop-action"[\s\S]*?type="button"[\s\S]*?disabled/.test(html), 'Main Stop button must be disabled while idle');
assert(/id="stop-pipeline-inline-btn"[\s\S]*?class="ghost danger stop-action"[\s\S]*?type="button"[\s\S]*?disabled/.test(html), 'Inline Stop button must be disabled while idle');
assert(css.includes('.ghost.stop-action'), 'Stop button destructive style missing');

assert(preload.includes('stopPipeline: (options) => ipcRenderer.invoke(\'pipeline:stop\', options)'), 'preload stopPipeline bridge missing');
assert(main.includes("ipcMain.handle('pipeline:stop'"), 'pipeline:stop IPC handler missing');
assert(main.includes('async function stopPipeline'), 'main stopPipeline handler missing');

assert(renderer.includes('let activePipelineRunId'), 'renderer active run token missing');
assert(renderer.includes('function beginPipelineRun()'), 'renderer beginPipelineRun missing');
assert(renderer.includes('function assertPipelineRunActive'), 'renderer cancellation assertion missing');
assert(renderer.includes('function stopPipelineFromClick'), 'renderer stop handler missing');
assert(renderer.includes('activeBatchIds = []'), 'stop must clear or invalidate activeBatchIds');
assert(renderer.includes('window.isVidoraPipelineBusy = false'), 'stop must release busy flag');
assert(renderer.includes('stopPipelineInFlight'), 'duplicate stop guard missing');
assert(renderer.includes('cancelledPipelineRunId'), 'cancelled run token missing');
assert(renderer.includes('pipelineLocked = Boolean(isRunning || (activePipelineRunId && cancelledPipelineRunId !== activePipelineRunId))'), 'Start buttons must stay disabled while a run token is active');
assert(renderer.includes('runId,'), 'renderer must pass runId into scene IPC payload');
assert(renderer.includes('extractLastFrameToPath(prevVideoPath, prevLastFramePath, { runId })'), 'final-frame extraction must carry runId');
assert(renderer.includes('schedulePipelineTimer(async () =>'), 'recursive timers must use cancellable scheduler');
assert(!renderer.includes('setTimeout(async () => {\n        await runFullPipeline();'), 'recursive runFullPipeline timer lacks cancellation guard');
assert(renderer.includes('await pipelineDelay(2500, runId)'), 'retry delay must be cancellable');
assert(renderer.includes('await maybeRunVeoUpAutomationAfterPipeline(\'runFullPipeline-complete\', runId)'), 'VeoUp completion automation must carry runId');
assert(renderer.includes('if (runId) assertPipelineRunActive(runId);'), 'VeoUp result must be ignored after cancellation');

assert(main.includes('const { AsyncLocalStorage } = require(\'async_hooks\')'), 'main AsyncLocalStorage cancellation scope missing');
assert(main.includes('const pipelineRunScope = new AsyncLocalStorage()'), 'main run scope missing');
assert(main.includes('pipelineCancellation.cancelledRunIds'), 'main cancelled run registry missing');
assert(main.includes('function cancelPipelineRun'), 'main cancelPipelineRun missing');
assert(main.includes('function trackPipelineChildProcess'), 'main child-process tracking missing');
assert(main.includes('pipelineRunScope.run({ runId }'), 'runScenePipeline must execute inside run scope');
assert(main.includes('assertPipelineRunActive(runId)'), 'main scene pipeline must assert run activity');
assert(!main.includes('pipelineCancellation.cancelledRunIds.delete(runId);'), 'main must not revive a cancelled runId when late IPC arrives');
assert(!main.includes('await sleep(10000)'), 'main IPC must return durable scene success before the inter-scene breather');
assert(renderer.includes('await waitForInterSceneBreather(runId, currentScene.id)'), 'renderer must own the cancellable inter-scene breather');
assert(main.includes('isPipelineCancelledError(error)'), 'main cancellation errors must be recognized');
assert(main.includes('registerChildProcess: (child) => trackPipelineChildProcess(child, runId)'), 'VeoUp child process must be tracked');
assert(main.includes('runId,'), 'main must pass runId to VeoUp automation');
assert(main.includes('trackPipelineChildProcess(child, runId)'), 'FFmpeg or VeoUp child tracking missing');
assert(main.includes('async function extractLastFrameToPathHandler(_event, { videoPath, outputPath, runId = \'\''), 'final-frame handler must accept runId');

assert(veoup.includes('isCancelled'), 'VeoUp automation cancellation hook missing');
assert(veoup.includes('registerChildProcess'), 'VeoUp PowerShell child registration missing');
assert(veoup.includes('PIPELINE_CANCELLED'), 'VeoUp cancellation error missing');
assert(veoup.includes('clearInterval(cancelTimer)'), 'VeoUp cancel timer cleanup missing');

assert(renderer.includes("videoProvider: 'veoup'"), 'video provider must remain VeoUp');
assert(!renderer.includes('videoProvider: videoPlatform.value'), 'renderer must not restore Grok/PixVerse selected provider');
assert(!main.includes("return generateVideoWithGenericProvider({ provider: 'grok'"), 'main must not fall back to Grok');

console.log('pipeline stop cancellation tests passed');
