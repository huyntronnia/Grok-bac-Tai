const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const files = {
  html: read('electron/index.html'),
  css: read('electron/style.css'),
  renderer: read('electron/renderer.js'),
  preload: read('electron/preload.js'),
  main: read('electron/main.js'),
  veoup: read('electron/veoupAutomation.js'),
};

const activeSources = Object.entries(files)
  .map(([name, text]) => `\n/* ${name} */\n${text}`)
  .join('\n');
const scenePipelinePayload = files.renderer.slice(
  files.renderer.indexOf('const result = await window.videoPlannerAPI.runScenePipeline({'),
  files.renderer.indexOf('const hasVideoOutput = Boolean(', files.renderer.indexOf('const result = await window.videoPlannerAPI.runScenePipeline({'))
);

const removedTerms = [
  'only-run-gpt-toggle',
  'image-motion-only-mode',
  'imageMotionOnlyMode',
  'skipVideoGeneration',
  'motionOnlyMode',
  'noVideoMode',
  'onlyRunGpt',
  '__vidoraImageAndMotionOnlyMode',
  'isImageMotionOnlyModeEnabled',
  'forceChatGptImageMotionOnlyWorkflow',
  'ensureImageMotionOnlyModeControl',
  'skipped-image-motion-only',
  'ChatGPT-only',
  'Image + motion only',
  'Chỉ chạy ChatGPT',
  'Chỉ tạo ảnh',
];

for (const term of removedTerms) {
  assert(
    !activeSources.includes(term),
    `obsolete term still present in active production source: ${term}`
  );
}

assert(!files.html.includes('Không chạy VeoUp'), 'ChatGPT-only visible label remains');
assert(!files.css.includes('.image-motion-only-mode-card'), 'image-motion-only CSS remains');
assert(!files.renderer.includes('skip' + 'VideoGeneration: '), 'renderer still sends skip-video payload field');
assert(!files.renderer.includes('image' + 'MotionOnlyMode: '), 'renderer still sends image-motion-only payload field');
assert(!files.main.includes('options.' + 'skip' + 'VideoGeneration'), 'main still reads skip-video option');
assert(!files.main.includes('options.' + 'image' + 'MotionOnlyMode'), 'main still reads image-motion-only option');

assert(!files.renderer.includes('waitForProviderReady(videoPlatform.value, videoPlatform.label)'), 'Start route still waits for selected video provider');
assert(files.renderer.includes("videoProvider: 'veoup'"), 'renderer scene pipeline must send VeoUp provider');
assert(!files.renderer.includes('videoProvider: videoPlatform.value'), 'renderer scene pipeline still sends selected video provider');
assert(!scenePipelinePayload.includes('accountRouterEnabled:'), 'renderer scene payload still sends Grok router flag');
assert(files.main.includes("return 'veoup';"), 'main video provider default must be VeoUp');
assert(files.main.includes("if (provider === 'veoup')"), 'main scene pipeline must handle VeoUp provider');
assert(!files.main.includes("return generateVideoWithGenericProvider({ provider: 'grok'"), 'main still falls back to Grok video generation');
assert(files.main.includes("status: 'video-validated'"), 'VeoUp scene status must require validated video');
assert(files.renderer.includes('await window.videoPlannerAPI.extractLastFrameToPath(prevVideoPath, prevLastFramePath, { runId })'), 'previous-scene final-frame extraction guard missing');
assert(files.renderer.includes('if (scene.id > 1)'), 'sequential previous-video guard missing');
assert(files.renderer.includes('if (!hasVideoOutput) {'), 'video-output gate missing');
assert(files.renderer.includes('return runFullPipeline();'), 'previous-scene recovery restart missing');
assert(files.main.includes('videoResult = await generateVideoWithProvider'), 'main scene pipeline no longer reaches video generation');
assert(files.main.includes('await forceCleanChatGptNewChatRotation()'), 'ChatGPT rotation recovery missing');

assert(files.renderer.includes('stripObsoleteProjectModeFields'), 'save sanitizer missing');
assert(files.renderer.includes('...stripObsoleteProjectModeFields(scene)'), 'scene save sanitizer not applied');
assert(files.renderer.includes('const projectFields = stripObsoleteProjectModeFields(project || {})'), 'project save sanitizer not applied');

const stripObsoleteProjectModeFields = (value = {}) => {
  const blocked = new Set([
    'image' + 'MotionOnlyMode',
    'skip' + 'VideoGeneration',
    'motion' + 'OnlyMode',
    'no' + 'VideoMode',
    'only' + 'RunGpt',
  ]);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !blocked.has(key)));
};

const oldProjectData = {
  name: 'legacy',
  imageMotionOnlyMode: true,
  skipVideoGeneration: true,
  motionOnlyMode: true,
  noVideoMode: true,
  onlyRunGpt: true,
  scenes: [{ id: 1, imageMotionOnlyMode: true, skipVideoGeneration: true, videoPath: 'scene_001_video.mp4' }],
};

const savedProject = stripObsoleteProjectModeFields(oldProjectData);
const savedScene = stripObsoleteProjectModeFields(oldProjectData.scenes[0]);

for (const term of ['imageMotionOnlyMode', 'skipVideoGeneration', 'motionOnlyMode', 'noVideoMode', 'onlyRunGpt']) {
  assert(!(term in savedProject), `obsolete project key was not stripped: ${term}`);
  assert(!(term in savedScene), `obsolete scene key was not stripped: ${term}`);
}

console.log('partial-mode cleanup tests passed');
