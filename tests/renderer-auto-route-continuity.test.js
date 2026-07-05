const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const renderer = fs.readFileSync(path.join(root, 'electron/renderer.js'), 'utf8');

function extractFunction(name) {
  const start = renderer.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} source not found`);
  const end = renderer.indexOf('\n}\n\nfunction ', start);
  assert(end > start, `${name} source end not found`);
  return renderer.slice(start, end + 3);
}

const helperIndex = renderer.indexOf('function sceneHasRequiredOutputForCurrentMode(scene)');
const firstUseIndex = renderer.indexOf('sceneHasRequiredOutputForCurrentMode(scene)');
assert(helperIndex >= 0, 'sceneHasRequiredOutputForCurrentMode must be defined');
assert(helperIndex <= firstUseIndex, 'sceneHasRequiredOutputForCurrentMode must be declared before runtime use');

const sandbox = {
  isKeyframeMotionPromptOnlyModeEnabled: () => false
};
vm.createContext(sandbox);
vm.runInContext(`
${extractFunction('hasValidSceneOutputPath')}
${extractFunction('sceneHasRequiredOutputForCurrentMode')}
${extractFunction('sceneHasVideoOutput')}
${extractFunction('findFirstIncompleteSceneBefore')}
${extractFunction('shouldBlockSceneBecausePreviousVideoMissing')}
this.sceneHasRequiredOutputForCurrentMode = sceneHasRequiredOutputForCurrentMode;
this.sceneHasVideoOutput = sceneHasVideoOutput;
this.findFirstIncompleteSceneBefore = findFirstIncompleteSceneBefore;
this.shouldBlockSceneBecausePreviousVideoMissing = shouldBlockSceneBecausePreviousVideoMissing;
`, sandbox);

assert.strictEqual(
  sandbox.sceneHasRequiredOutputForCurrentMode({
    videoPath: 'D:\\project\\scene_001\\scene_001_video.mp4',
    videoFileExists: true,
    outputStatCheckedAtMs: Date.now(),
  }),
  true,
  'cached Scene 1 with existing recent video must pass'
);

assert.doesNotThrow(() => sandbox.sceneHasRequiredOutputForCurrentMode(null), 'missing scene must not throw');
assert.strictEqual(sandbox.sceneHasRequiredOutputForCurrentMode(null), false, 'missing scene must return false');
assert.strictEqual(sandbox.sceneHasRequiredOutputForCurrentMode({ videoPath: '', videoFileExists: true, outputStatCheckedAtMs: Date.now() }), false, 'missing output paths must return false');
assert.strictEqual(sandbox.sceneHasRequiredOutputForCurrentMode({ videoPath: 'x.mp4', videoFileExists: false, outputStatCheckedAtMs: Date.now() }), false, 'missing file must return false');
assert.strictEqual(sandbox.sceneHasRequiredOutputForCurrentMode({ videoPath: 'x.mp4', videoFileExists: true, outputStatCheckedAtMs: Date.now() - (10 * 60 * 1000) }), false, 'stale file stat must return false');

sandbox.project = {
  scenes: [
    {
      id: 1,
      videoPath: 'D:\\project\\scene_001\\scene_001_video.mp4',
      videoFileExists: true,
      outputStatCheckedAtMs: Date.now(),
    },
    { id: 2, videoPath: '', videoFileExists: false, outputStatCheckedAtMs: Date.now() },
  ],
};
assert.strictEqual(sandbox.shouldBlockSceneBecausePreviousVideoMissing({ id: 2 }), null, 'Scene 2 must continue after previous video exists with recent stat');

sandbox.project.scenes[0].outputStatCheckedAtMs = Date.now() - (10 * 60 * 1000);
assert.strictEqual(sandbox.shouldBlockSceneBecausePreviousVideoMissing({ id: 2 })?.id, 1, 'Scene 2 must block when previous video stat is stale');

assert(renderer.includes('return sceneHasRequiredOutputForCurrentMode(scene);'), 'sceneHasVideoOutput must delegate to shared helper');
assert(renderer.includes('if (!sceneHasRequiredOutputForCurrentMode(scene))'), 'previous-scene continuity check must use shared helper');

console.log('renderer auto-route continuity tests passed');
