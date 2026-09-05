'use strict';

const assert = require('assert');
const path = require('path');
const vm = require('vm');
const fs = require('fs');

const { isChatGptPolicyRefusalText } = require('../electron/main/recovery');

console.log('Running batch and policy fix regression tests...');

// 1. Test isChatGptPolicyRefusalText
assert.strictEqual(
  isChatGptPolicyRefusalText('Bằng cách nhắn tin cho ChatGPT, bạn đồng ý với Điều khoản và đã đọc Chính sách quyền riêng tư của chúng tôi.'),
  false,
  'ChatGPT privacy policy footer must not be classified as refusal'
);
assert.strictEqual(
  isChatGptPolicyRefusalText('By messaging ChatGPT, you agree to our Terms and have read our Privacy Policy.'),
  false,
  'English ChatGPT privacy policy footer must not be classified as refusal'
);
assert.strictEqual(
  isChatGptPolicyRefusalText('Kịch bản có đoạn nhân vật có thể vi phạm giao thông.'),
  false,
  'Normal script text with "có thể vi phạm" must not be classified as refusal'
);
assert.strictEqual(
  isChatGptPolicyRefusalText('Yêu cầu này có thể vi phạm chính sách của chúng tôi.'),
  true,
  'Explicit policy refusal with "có thể vi phạm chính sách" must be detected'
);
assert.strictEqual(
  isChatGptPolicyRefusalText('Yêu cầu vi phạm các quy định của chúng tôi.'),
  true,
  'Explicit refusal with "vi phạm các quy định" must be detected'
);

// 2. Test renderer batch & resume behaviors
const renderer = fs.readFileSync(path.join(__dirname, '../electron/renderer.js'), 'utf8');

// Ensure chatgpt-policy-refusal is in isAutomaticRecoveryNotice
assert(
  renderer.includes("'chatgpt-policy-refusal'"),
  'chatgpt-policy-refusal must be included in isAutomaticRecoveryNotice'
);

function extractFunction(name) {
  const start = renderer.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} source not found`);
  const parenEnd = renderer.indexOf(')', start);
  assert(parenEnd > start, `${name} param end not found`);
  const bodyStart = renderer.indexOf('{', parenEnd);
  assert(bodyStart > start, `${name} source body not found`);
  let depth = 0;
  for (let index = bodyStart; index < renderer.length; index++) {
    if (renderer[index] === '{') depth++;
    if (renderer[index] === '}') depth--;
    if (depth === 0) return renderer.slice(start, index + 1);
  }
  assert.fail(`${name} source end not found`);
}

const sandbox = {
  console,
  Date,
  Array,
  Number,
  Boolean,
  String,
  Set,
  Map,
  project: null,
  activeBatchIds: [],
  isKeyframeMotionPromptOnlyModeEnabled: () => true,
  hasValidSceneOutputPath: (p) => Boolean(p && String(p).trim()),
  KEYFRAME_RESUME_STATUSES: new Set(['image_pending', 'image_generating', 'keyframe_pending', 'keyframe_generating']),
  VIDEO_DONE_RESUME_STATUSES: new Set(['video_done', 'video_generated', 'video_ready']),
};

vm.createContext(sandbox);
vm.runInContext(`
const SCENE_OUTPUT_STAT_TTL_MS = 5 * 60 * 1000;
const SCENE_ASSET_AUDIT_TTL_MS = 5 * 60 * 1000;
${extractFunction('getSceneRef')}
${extractFunction('isSceneCompleteForVeoUp')}
${extractFunction('sceneHasRequiredOutputForCurrentMode')}
${extractFunction('isVideoCompleteForResume')}
${extractFunction('hasKeyframeForResume')}
${extractFunction('findSceneByRuntimeRef')}
${extractFunction('normalizeActiveBatchIdsForRuntime')}
${extractFunction('getOrderedResumeScenes')}
${extractFunction('getNextResumeAction')}
this.isVideoCompleteForResume = isVideoCompleteForResume;
this.getNextResumeAction = getNextResumeAction;
`, sandbox);

// Test isVideoCompleteForResume in keyframeMotionPromptOnly mode
const completeKeyframeMotionScene = {
  id: 1,
  imagePath: 'D:/proj/scene_001/scene_001_keyframe.png',
  motionPrompt: 'Camera pan left gently across snow field...',
  motionPromptPath: 'D:/proj/scene_001/motion_prompt.txt',
  videoPath: '',
};
assert.strictEqual(
  sandbox.isVideoCompleteForResume(completeKeyframeMotionScene),
  true,
  'Scene with keyframe and motion prompt must be complete for resume in keyframeMotionPromptOnly mode'
);

// Test getNextResumeAction returns batch_complete when all scenes in batch are done
sandbox.project = {
  scenes: [
    completeKeyframeMotionScene,
    {
      id: 2,
      imagePath: 'D:/proj/scene_002/scene_002_keyframe.png',
      motionPrompt: 'Camera zoom in towards character...',
      motionPromptPath: 'D:/proj/scene_002/motion_prompt.txt',
      videoPath: '',
    },
  ],
};
sandbox.activeBatchIds = [1, 2];

const resumeAction = sandbox.getNextResumeAction({
  project: sandbox.project,
  runtime: { activeBatchIds: [1, 2], currentSceneId: '1' },
});

assert.strictEqual(
  resumeAction.action,
  'batch_complete',
  'getNextResumeAction must return batch_complete when all batch scenes have keyframe + motion prompt'
);

console.log('All batch and policy fix regression tests passed successfully!');
