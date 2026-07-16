const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const main = read('electron/main.js');
const runner = read('electron/main/pipeline/pipeline_runner.js');
const dom = read('electron/main/chatgpt/chatgpt_dom.js');
const recovery = read('electron/main/chatgpt/chatgpt_recovery.js');
const sharedRecovery = read('electron/main/recovery/recovery.js');
const utils = read('electron/main/utils/utils.js');

const generateStart = main.indexOf('async function generateVideoWithProvider({');
const generateEnd = main.indexOf('\nasync function getCdpPage(', generateStart);
assert(generateStart >= 0 && generateEnd > generateStart, 'VeoUp adapter boundary is missing');
const generateBlock = main.slice(generateStart, generateEnd);
assert(generateBlock.includes('runVeoUpScriptAsPromise('), 'video adapter must call VeoUp');
assert(generateBlock.includes('finalizeValidatedSceneVideo({'), 'VeoUp output validation must remain');
assert(!/grok|pixverse|generateVideoWithGenericProvider/i.test(generateBlock), 'legacy web-video branch remains');

assert(runner.includes('const videoProvider = "veoup";'), 'pipeline provider must be fixed to VeoUp');
assert(!/Grok|PixVerse|routerActive|selectGrokAccount|getGrokRouterStatus/i.test(runner), 'pipeline still depends on legacy router/provider code');

const runtimeStart = main.indexOf('runtimePipelineRunner: {');
const runtimeEnd = main.indexOf('\n    runtimeIpcHandlers:', runtimeStart);
const runtimeBlock = main.slice(runtimeStart, runtimeEnd);
assert(!/GrokRouter|GrokAccount|selectGrok|pauseGrok|writeGrok/i.test(runtimeBlock), 'runtime pipeline DI still exposes Grok router');

const nonLegacyMain = main.replace(
  /const GROKPROJ_SCHEMA_VERSION[\s\S]*?async function openProjectFileDialog/,
  'async function openProjectFileDialog',
);
assert(!/Grok router|PixVerse|generateGrok|submitGrok|prepareGrok|detectGrok/i.test(nonLegacyMain), 'Grok/PixVerse browser engine remains in main.js');
assert(!/grok|pixverse/i.test(dom), 'ChatGPT DOM helpers still contain Grok/PixVerse behavior');
assert(!/grok|pixverse/i.test(recovery), 'ChatGPT recovery still contains Grok/PixVerse behavior');
assert(!/grok|pixverse/i.test(sharedRecovery), 'shared recovery still exports Grok/PixVerse behavior');
assert(!/grok|pixverse/i.test(utils), 'shared utilities still normalize Grok/PixVerse providers');

console.log('phase 3 VeoUp/main cleanup tests passed');
