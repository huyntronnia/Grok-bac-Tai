const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pipeline = fs.readFileSync(path.join(root, 'electron/main/pipeline/pipeline_runner.js'), 'utf8');
const recovery = fs.readFileSync(path.join(root, 'electron/main/chatgpt/chatgpt_recovery.js'), 'utf8');

assert(pipeline.includes('const CHAT_ROTATION_ENABLED = false;'), 'CHAT_ROTATION_ENABLED must be false');
assert(
  /CHAT_ROTATION_ENABLED\s*&&\s*[\s\S]*?consecutiveFailures\s*>=\s*2/.test(pipeline),
  'consecutive failure rotation branch must be gated by CHAT_ROTATION_ENABLED',
);

const failureBranchStart = pipeline.indexOf('consecutiveFailures >= 2');
const failureBranchEnd = pipeline.indexOf('throw error;', failureBranchStart);
const failureBranch = pipeline.slice(failureBranchStart, failureBranchEnd);
assert(
  failureBranch.includes('forceCleanChatGptNewChatRotation()'),
  'rotation helper may remain in dead-gated consecutive failure branch',
);

const level8Start = recovery.indexOf('if (recoveryLevel === 8)');
assert(level8Start >= 0, 'Recovery Level 8 block missing');
const level8End = recovery.indexOf('if (recoveryLevel === 9)', level8Start);
assert(level8End > level8Start, 'Recovery Level 8 block end missing');
const level8Block = recovery.slice(level8Start, level8End);

assert(!level8Block.includes('forceCleanChatGptNewChatRotation()'), 'Recovery Level 8 must not auto-rotate chat');
assert(
  level8Block.includes('automatic chat rotation disabled'),
  'Recovery Level 8 must log disabled automatic rotation',
);

console.log('no automatic ChatGPT rotation tests passed');
