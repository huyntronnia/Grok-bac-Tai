const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');

function extractFunction(name, isAsync = false) {
  const prefix = isAsync ? `async function ${name}(` : `function ${name}(`;
  const start = main.indexOf(prefix);
  assert(start >= 0, `${name} source not found`);
  const end = main.indexOf('\n}\n\nfunction ', start);
  const asyncEnd = main.indexOf('\n}\n\nasync function ', start);
  const candidates = [end, asyncEnd].filter((value) => value > start);
  assert(candidates.length, `${name} source end not found`);
  return main.slice(start, Math.min(...candidates) + 3);
}

const functionStart = main.indexOf('async function generateMotionPromptWithChatGPTOnce(');
const functionEnd = main.indexOf('function validateMotionPromptResponse', functionStart);
assert(functionStart >= 0 && functionEnd > functionStart, 'NV2 motion prompt function not found');
const nv2Flow = main.slice(functionStart, functionEnd);
const nv2Sender = extractFunction('sendNv2PromptViaDeepCdpInput', true);
const nv2Focus = extractFunction('focusNv2ComposerWithCdp', true);
const nv2Guard = extractFunction('waitForNv2GenerationStartGuard', true);
const nv2Inspect = extractFunction('inspectNv2ComposerSubmitStateScript');

assert(main.includes("const task2VideoPrompt = hardTasks.task2 || '';"), 'NV2 must use only NV2_MOTION_PROMPT.txt contents');
assert(!main.includes('buildMotionStagePrompt({ nv2: hardTasks.task2'), 'NV2 must not include scene script or wrapper prompt');
assert(nv2Flow.includes("const instruction = String(prompt || '').trim();"), 'NV2 send must use raw prompt text only');
assert(!nv2Flow.includes('uploadFileToChatGptDirectly(page, imagePath'), 'NV2 must not upload keyframe');
assert(!nv2Flow.includes('uploadFilesToChatGptSequentially(page, motionStageFiles'), 'NV2 must not upload character images or keyframe');
assert(!nv2Flow.includes('setFileInputFiles'), 'NV2 flow must not use file input upload');

const sendCalls = (nv2Flow.match(/sendNv2PromptViaDeepCdpInput\(page, instruction/g) || []).length;
assert.strictEqual(sendCalls, 1, 'NV2 must be sent only once');
assert(!nv2Flow.includes('sendPromptViaCdpInputSingle(page, instruction'), 'NV2 must not use generic sender');
assert(!nv2Flow.includes('motion_prompt_retry'), 'NV2 second refresh must not resend text');
assert(!nv2Flow.includes('resending NV2'), 'NV2 retry/resend log must be removed');

assert(nv2Sender.includes('sendNv2PromptViaDeepCdpInput'), 'NV2 deep sender missing');
assert(nv2Inspect.includes("'main form textarea', '[contenteditable=\"true\"]'"), 'NV2 composer lookup must use textarea then contenteditable fallback');
assert(nv2Focus.includes('client.Page.bringToFront()'), 'NV2 must foreground ChatGPT before sending');
assert(nv2Focus.includes("client.DOM.querySelector({ nodeId: documentRoot.root.nodeId, selector: 'main form textarea' })"), 'NV2 must use CDP DOM lookup for textarea');
assert(nv2Focus.includes('client.DOM.focus({ nodeId: query.nodeId })'), 'NV2 must use CDP DOM.focus');
assert(nv2Focus.includes('dispatchMouseEvent({ type: \'mousePressed\''), 'NV2 must physically click composer');
assert(nv2Focus.includes('deepFocusNv2ComposerScript.toString()'), 'NV2 must call page .focus() helper');
assert(nv2Sender.includes('client.Input.insertText({ text: prompt })'), 'NV2 must insert through CDP input path');
assert(nv2Sender.includes('dispatchNv2ComposerInputEventsScript.toString()'), 'NV2 must dispatch bubbling input events');
assert(main.includes("new InputEvent('beforeinput'"), 'NV2 must dispatch beforeinput');
assert(main.includes("new InputEvent('input'"), 'NV2 must dispatch input');
assert(main.includes("new Event('change'"), 'NV2 must dispatch change');
assert(nv2Sender.includes('!loaded?.activeComposer || !loaded?.fullPromptLoaded || !loaded?.sendReady'), 'NV2 must verify active composer, full prompt, send enabled');
assert(nv2Sender.includes("type: 'keyDown'"), 'NV2 must submit Enter keyDown first');
assert(nv2Sender.includes("type: 'char'"), 'NV2 must dispatch optional Enter char');
assert(nv2Sender.includes("type: 'keyUp'"), 'NV2 must submit Enter keyUp');
assert(nv2Sender.includes('NV2 Enter submission dispatched'), 'NV2 Enter log missing');
assert(nv2Sender.includes('if (!state?.generationAcknowledged && state?.sendReady && state?.fullPromptLoaded && state?.sendButton)'), 'guarded Send fallback condition missing');
assert(nv2Sender.includes('Guarded physical Send click'), 'guarded physical Send click log missing');
assert(nv2Sender.includes('waitForNv2GenerationStartGuard'), '15s start guard missing');
assert(nv2Guard.includes('Date.now() - startedAt < 15000'), 'NV2 guard must last 15s');
assert(nv2Guard.includes('await sleep(3000);'), 'NV2 guard must check about every 3s');
assert(!nv2Guard.includes('Page.navigate'), 'NV2 start guard must not refresh/navigate');
assert(!nv2Guard.includes('sendNv2PromptViaDeepCdpInput'), 'NV2 start guard must not resend');
assert(nv2Guard.includes('nv2-generation-not-started-after-passive-guard'), 'NV2 start failure error missing');

assert(nv2Flow.includes('let exactConversationUrl = await evaluateOnCdpPage(page, \'location.href\')'), 'NV2 must record exact conversation URL before send');
assert(nv2Flow.includes('readAssistantMessageSnapshotScript.toString()'), 'NV2 must record assistant IDs/count/hashes');
assert(nv2Flow.includes('Scene ${sceneId}: NV2 generation acknowledged; entering 45s passive wait.'), '45s passive wait log missing');
assert(nv2Flow.includes('await sleep(45000);'), 'NV2 must perform one 45s passive wait');
assert(!nv2Flow.includes('await sleep(25000);'), 'NV2 must not use old 25s passive wait');
const refreshBlock = nv2Flow.slice(nv2Flow.indexOf('const refreshExactConversationAndExtract'), nv2Flow.indexOf('await appendAppLog(null, { source: \'main\', kind: \'running\', text: `Scene ${sceneId}: NV2 generation acknowledged'));
assert(refreshBlock.includes("refreshMode: 'f5'"), 'NV2 refresh must use F5 mode');
assert(refreshBlock.includes("page.Input.dispatchKeyEvent({ type: 'keyDown', key: 'F5'"), 'NV2 refresh must dispatch F5 keyDown');
assert(!refreshBlock.includes('page.Page.navigate({ url: exactConversationUrl })'), 'NV2 refresh must not navigate by URL');
assert(!nv2Flow.includes("page.Page.navigate({ url: 'https://chatgpt.com/' })"), 'NV2 must not navigate to ChatGPT root');
assert(nv2Flow.includes('Scene ${sceneId}: Refreshing existing ChatGPT conversation with F5 to load completed NV2 response.'), 'first F5 refresh log missing');
assert(nv2Flow.includes('Scene ${sceneId}: NV2 response still generating after refresh; waiting 10s.'), 'still-generating fallback wait log missing');
assert(nv2Flow.includes('await sleep(10000);'), 'NV2 still-generating fallback must wait 10s');
assert(nv2Flow.includes('Scene ${sceneId}: Performing final conversation refresh with F5.'), 'final F5 refresh log missing');
assert(nv2Flow.includes('nv2-response-still-generating-after-passive-waits'), 'still-generating failure error missing');
assert(nv2Flow.includes('nv2-response-missing-after-passive-wait-and-refresh'), 'clear NV2 missing error missing');
assert(nv2Flow.includes('Scene ${sceneId}: Motion Prompt saved.'), 'motion prompt saved log missing');
assert(nv2Flow.includes('extractCompletedNv2ResponseFromSnapshot(snapshot, baseline)'), 'NV2 must gate extraction on finished generation state');
assert(nv2Flow.includes('Scene ${sceneId}: Existing NV2 assistant response detected.'), 'existing completed NV2 response log missing');
assert(nv2Flow.includes('Scene ${sceneId}: Generation inactive; validating response stability.'), 'existing response stability log missing');
assert(nv2Flow.includes('Scene ${sceneId}: Stable NV2 response saved.'), 'existing stable response save log missing');
assert(nv2Flow.includes('Scene ${sceneId}: Continuing to veoup_prepare.'), 'existing response must continue to VeoUp');
assert(nv2Flow.includes('shouldRecoverExistingNv2'), 'NV2 must inspect existing conversation before resend');
assert(nv2Flow.includes('hasDurableNv2SendBaseline'), 'existing NV2 recovery must require durable send baseline');
assert(nv2Flow.includes('hashChatGptSnapshotText(instruction)'), 'NV2 must hash prompt text to detect an already-sent user bubble');
assert(nv2Flow.includes('Existing NV2 user message detected; not sending duplicate NV2.'), 'NV2 must not resend when the same NV2 user message is already present');
assert(nv2Flow.includes('latestUserHash === instructionHash'), 'NV2 duplicate gate must compare latest user hash with instruction hash');
assert(nv2Flow.includes('latestUserCompareText.includes(instructionHead)'), 'NV2 duplicate gate must survive ChatGPT pasted-text user bubbles');
assert(extractFunction('readAssistantMessageSnapshotScript').includes('userMessages'), 'NV2 snapshot must expose user messages for duplicate detection');
assert(nv2Flow.includes('nv2-user-message-not-confirmed-after-send'), 'NV2 send must confirm user message before waiting');
assert(nv2Flow.includes("persistDurableStage(path.dirname(sceneDir), sceneId, 'nv2_sent'"), 'nv2_sent must be persisted only inside sender after send confirmation');
assert(!main.includes("persistDurableStage(projectDir, sceneId, 'nv2_sent'"), 'outer pipeline must not mark nv2_sent before NV2 is sent');
assert(nv2Flow.indexOf('shouldRecoverExistingNv2') < nv2Flow.indexOf('sendNv2PromptViaDeepCdpInput(page, instruction'), 'existing response recovery must happen before sending NV2 again');
assert(nv2Flow.includes('nv2-existing-response-still-generating'), 'active existing response must wait without resend');
assert(main.includes('!isNv2ExistingResponseStillGenerating'), 'active existing response must not trigger chat rotation');
assert(nv2Flow.includes("extracted?.error === 'nv2-response-still-generating'"), 'Stop/busy/streaming state must trigger second passive wait');
assert(nv2Flow.includes("extracted?.error === 'nv2-response-text-not-stable'"), 'unstable text must not be saved');
assert(nv2Flow.includes("String(first.text || '').trim() !== String(second.text || '').trim()"), 'NV2 must require two identical assistant reads');
assert(nv2Flow.includes('await sleep(2000);'), 'NV2 stability reads must be about 2s apart');

assert(!nv2Flow.includes('NV2_ACTIVE_POLL_INTERVAL_MS'), 'NV2 active polling interval must be removed');
assert(!nv2Flow.includes('[NV2] Polling'), 'NV2 DOM polling log must be removed');
assert(!nv2Flow.includes('Passive poll iteration'), 'NV2 passive polling loop must be removed');
assert(!nv2Flow.includes('image-upload-timeout'), 'NV2 must not use image-upload-timeout recovery naming');
assert(/await sleep\(45000\);\s*assertPipelineRunActive\(\);\s*let extracted = await refreshExactConversationAndExtract\(\);/.test(nv2Flow), 'Stop cancellation must interrupt before first refresh/extraction');
assert(nv2Flow.includes('await sleep(45000);\n    assertPipelineRunActive();'), 'Stop cancellation must interrupt 45s wait');
assert(nv2Flow.includes('await sleep(10000);\n      assertPipelineRunActive();'), 'Stop cancellation must interrupt 10s wait');

assert(main.includes('const isNv2GenerationStartFailure = /nv2-generation-not-started-after-passive-guard/i.test'), 'NV2 start failure must be classified');
assert(main.includes('forceRegenerateImage: true'), '2 failures must restart whole scene from NV1');
assert(main.includes("motionPrompt: ''"), '2 failures must not restart from cached NV2');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${extractFunction('isNv2SnapshotGenerationActive')}
${extractFunction('selectNewAssistantMessageAfterBaseline')}
${extractFunction('extractCompletedNv2ResponseFromSnapshot')}
${extractFunction('selectLatestCompletedAssistantMessage')}
this.selectNewAssistantMessageAfterBaseline = selectNewAssistantMessageAfterBaseline;
this.extractCompletedNv2ResponseFromSnapshot = extractCompletedNv2ResponseFromSnapshot;
this.selectLatestCompletedAssistantMessage = selectLatestCompletedAssistantMessage;
this.isNv2SnapshotGenerationActive = isNv2SnapshotGenerationActive;`, sandbox);

const sameCountNewHash = sandbox.selectNewAssistantMessageAfterBaseline({
  count: 2,
  messages: [
    { index: 1, id: '', hash: 'old-2', text: 'Old answer' },
    { index: 0, id: '', hash: 'new-motion', text: 'New motion prompt after reload' },
  ],
}, {
  count: 2,
  ids: [],
  hashes: ['old-1', 'old-2'],
});
assert.strictEqual(sameCountNewHash.ok, true, 'extraction must survive DOM index changes via text hash');
assert.strictEqual(sameCountNewHash.text, 'New motion prompt after reload');

const newStableId = sandbox.selectNewAssistantMessageAfterBaseline({
  count: 2,
  messages: [
    { index: 7, id: 'msg-old', hash: 'same-old', text: 'Old answer' },
    { index: 3, id: 'msg-new', hash: 'new-id-hash', text: 'Newest by stable id' },
  ],
}, {
  count: 2,
  ids: ['msg-old'],
  hashes: ['same-old', 'other-old'],
});
assert.strictEqual(newStableId.ok, true, 'extraction must prefer stable message ID');
assert.strictEqual(newStableId.text, 'Newest by stable id');

const noNewResponse = sandbox.selectNewAssistantMessageAfterBaseline({
  count: 1,
  maxTurnIndex: 1,
  messages: [{ index: 0, turnIndex: 1, id: 'msg-old', hash: 'old-hash', text: 'Old answer' }],
}, {
  count: 1,
  ids: ['msg-old'],
  hashes: ['old-hash'],
  maxTurnIndex: 1,
});
assert.strictEqual(noNewResponse.ok, false, 'old response must not be accepted');

const oldSceneResponseAfterReload = sandbox.selectNewAssistantMessageAfterBaseline({
  count: 2,
  messages: [
    { index: 0, turnIndex: 1, id: 'scene-2-motion', hash: 'scene-2-hash', text: 'Scene 2 motion prompt' },
    { index: 1, turnIndex: 3, id: 'scene-3-nv1-image', hash: 'scene-3-image-hash', text: 'Scene 3 keyframe assistant text' },
  ],
}, {
  count: 2,
  ids: ['scene-2-motion', 'scene-3-nv1-image'],
  hashes: ['scene-2-hash', 'scene-3-image-hash'],
  maxTurnIndex: 4,
  nv2UserTurnIndex: 4,
});
assert.strictEqual(oldSceneResponseAfterReload.ok, false, 'Scene 2/old assistant response must not be reused for Scene 3 NV2');

const scene3ResponseAfterNv2User = sandbox.selectNewAssistantMessageAfterBaseline({
  count: 3,
  messages: [
    { index: 0, turnIndex: 1, id: 'scene-2-motion', hash: 'scene-2-hash', text: 'Scene 2 motion prompt' },
    { index: 1, turnIndex: 3, id: 'scene-3-image', hash: 'scene-3-image-hash', text: 'Scene 3 keyframe assistant text' },
    { index: 2, turnIndex: 5, id: 'scene-3-motion', hash: 'scene-3-motion-hash', text: 'Scene 3 motion prompt after NV2 user' },
  ],
}, {
  count: 2,
  ids: ['scene-2-motion', 'scene-3-image'],
  hashes: ['scene-2-hash', 'scene-3-image-hash'],
  maxTurnIndex: 4,
  nv2UserTurnIndex: 4,
});
assert.strictEqual(scene3ResponseAfterNv2User.ok, true, 'Scene 3 NV2 response after Scene 3 user message must be accepted');
assert.strictEqual(scene3ResponseAfterNv2User.text, 'Scene 3 motion prompt after NV2 user');

const partialText = 'x'.repeat(219);
for (const flag of ['composerBusy', 'streamingIndicator']) {
  const activeSnapshot = {
    count: 2,
    messages: [{ index: 1, id: 'msg-new', hash: `hash-${flag}`, text: partialText }],
    [flag]: true,
  };
  assert.strictEqual(sandbox.isNv2SnapshotGenerationActive(activeSnapshot), true, `${flag} must mark NV2 generation active`);
  const blocked = sandbox.extractCompletedNv2ResponseFromSnapshot(activeSnapshot, { count: 1, ids: [], hashes: [] });
  assert.strictEqual(blocked.ok, false, `${flag} must prevent extraction`);
  assert.strictEqual(blocked.error, 'nv2-response-still-generating', `${flag} must use still-generating error`);
}

const staleStopCompleted = sandbox.extractCompletedNv2ResponseFromSnapshot({
  count: 2,
  stopVisible: true,
  composerBusy: false,
  streamingIndicator: false,
  activeGenerationMarker: false,
  generationActive: false,
  messages: [{ index: 1, id: 'msg-stop-stale', hash: 'stop-stale-hash', text: 'Completed motion prompt text despite stale stop button' }],
}, { count: 1, ids: [], hashes: [] });
assert.strictEqual(staleStopCompleted.ok, true, 'stale Stop button alone must not block completed NV2 extraction');
assert.strictEqual(staleStopCompleted.text, 'Completed motion prompt text despite stale stop button');

const completed = sandbox.extractCompletedNv2ResponseFromSnapshot({
  count: 2,
  stopVisible: false,
  composerBusy: false,
  streamingIndicator: false,
  messages: [{ index: 1, id: 'msg-complete', hash: 'complete-hash', text: 'Completed motion prompt text' }],
}, { count: 1, ids: [], hashes: [] });
assert.strictEqual(completed.ok, true, 'completed stable response can be extracted when generation flags are clear');
assert.strictEqual(completed.text, 'Completed motion prompt text');

const fullText = 'Completed motion prompt '.repeat(80);
const existingCompleted = sandbox.selectLatestCompletedAssistantMessage({
  count: 1,
  stopVisible: false,
  composerBusy: false,
  streamingIndicator: false,
  activeGenerationMarker: false,
  messages: [{ index: 0, id: 'existing-nv2', hash: 'full-hash', text: fullText }],
});
assert.strictEqual(existingCompleted.ok, true, 'existing completed assistant response must be captured');
assert.strictEqual(existingCompleted.text.length, fullText.trim().length, 'existing response must not be truncated to 900 chars');

const assistantNodeOnly = sandbox.selectLatestCompletedAssistantMessage({
  count: 1,
  messages: [{ index: 0, id: 'existing-nv2', hash: 'full-hash', text: fullText }],
});
assert.strictEqual(assistantNodeOnly.ok, true, 'assistant node presence alone must not mean busy');

const activeExisting = sandbox.selectLatestCompletedAssistantMessage({
  count: 1,
  stopVisible: false,
  composerBusy: false,
  streamingIndicator: true,
  messages: [{ index: 0, id: 'active-nv2', hash: 'active-hash', text: 'Partial but active' }],
});
assert.strictEqual(activeExisting.ok, false, 'active assistant response must wait without saving');
assert.strictEqual(activeExisting.error, 'nv2-response-still-generating');

const snapshotScript = extractFunction('readAssistantMessageSnapshotScript');
assert(snapshotScript.includes('[data-message-author-role="assistant"] [data-message-id]'), 'assistant data-message-id selector missing');
assert(snapshotScript.includes('[class*="prose"]'), 'common prose selector missing');
assert(snapshotScript.includes('return (pieces.join'), 'assistant root innerText fallback missing');
assert(!snapshotScript.includes("node.closest?.('[aria-busy=\"true\"]')"), 'assistant/root aria-busy must not mark composer busy');
assert(!snapshotScript.includes('const streamingIndicator = stopVisible ||'), 'stale Stop button must not be treated as streaming');
assert(!snapshotScript.includes('[data-testid*="stop"], [class*="streaming"]'), 'stale Stop button must not be an active generation marker');

console.log('nv2 passive-refresh flow tests passed');
