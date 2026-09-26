const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const files = {
  html: read('electron/index.html'),
  renderer: read('electron/renderer.js'),
  main: read('electron/main.js'),
};

console.log('Running focused tests for "Generate Keyframe + Motion Prompt only" pipeline mode...');

// Manual workflow supersedes the old opt-in checkbox.
assert.strictEqual(require('../electron/main/state/workflow_mode').normalizeWorkflowMode(), 'manual_keyframe_motion');

// 2. Renderer Settings & Persistence Assertion
assert(files.renderer.includes('const keyframeMotionOnlyToggle = document.querySelector(\'#keyframe-motion-only-toggle\');'), 'keyframe-motion-only-toggle DOM selector missing in renderer.js');
assert(files.renderer.includes('function isKeyframeMotionPromptOnlyModeEnabled()'), 'isKeyframeMotionPromptOnlyModeEnabled helper missing in renderer.js');
assert(files.renderer.includes('pipelineMode: { keyframeMotionPromptOnly: isKeyframeMotionPromptOnlyModeEnabled() }'), 'pipelineMode setting must be persisted in renderer.js');
assert(files.renderer.includes('applyPipelineModeSettings('), 'applyPipelineModeSettings must be called to restore settings in renderer.js');

// 3. Renderer Pipeline Handoff Assertion
assert(files.renderer.includes('keyframeMotionPromptOnly: isKeyframeMotionPromptOnlyModeEnabled(),'), 'keyframeMotionPromptOnly flag must be passed in runScenePipeline payload');

// 4. Renderer Completion Gate / Scene Skipping Assertion
assert(files.renderer.includes('if (result?.keyframeMotionPromptOnly === true)'), 'Renderer must handle keyframe-motion-only completion result');
assert(files.renderer.includes('currentScene.status = \'done\';'), 'Renderer must mark scene done under keyframe-motion-only result');
assert(files.renderer.includes('currentScene.completionStatus = \'keyframe_motion_complete\';'), 'Renderer must set keyframe_motion_complete status');
assert(files.renderer.includes('continue;'), 'Renderer must skip VeoUp and continue to next scene in the loop');

// 5. Main Process Assertion
assert(files.main.includes('const keyframeMotionPromptOnly = Boolean(options?.keyframeMotionPromptOnly);'), 'main.js must read keyframeMotionPromptOnly option');
assert(files.main.includes('if (keyframeMotionPromptOnly && !options.prefetchOnly) {'), 'main.js must check keyframeMotionPromptOnly to exit early');
assert(files.main.includes('completionStatus: \'keyframe_motion_complete\','), 'main.js must persist keyframe_motion_complete status');
assert(files.main.includes('videoStatus: \'skipped-keyframe-motion-only\','), 'main.js must set skipped-keyframe-motion-only status');
assert(files.main.includes('function assertDurableSceneSuccess('), 'assertDurableSceneSuccess must exist');
assert(files.main.includes('if (result?.keyframeMotionPromptOnly === true && result?.ok && result?.imagePath && result?.motionPrompt) {'), 'assertDurableSceneSuccess must bypass video validation in keyframe-motion-only mode');

console.log('All focused tests for "Generate Keyframe + Motion Prompt only" pipeline mode passed successfully!');
