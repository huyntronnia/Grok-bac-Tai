const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs
  .readFileSync(path.join(root, 'electron/main/chatgpt/chatgpt_pipeline.js'), 'utf8')
  .replace(/\r\n/g, '\n');

assert(
  source.includes('acceptStableTextWithoutDone = false'),
  'shared response waiter must default stable-text acceptance off',
);

assert(
  /const hasChangedStableText =[\s\S]*?acceptStableTextWithoutDone[\s\S]*?normalizedText !== normalizedBeforeText[\s\S]*?!obsState\.generating/.test(source),
  'response waiter must detect changed stable text when ChatGPT does not mark done',
);

assert(
  source.includes('minResponseTextLength: 120'),
  'NV2 waiter must not complete on short loading/status text',
);

assert(
  source.includes('value.length >= 120'),
  'NV2 validation must require substantive motion prompt text',
);

assert(
  /đang\|dang[\s\S]*phân tích\|phan tich[\s\S]*analyzing\|processing\|loading\|thinking/.test(source),
  'NV2 validation must reject loading/analyzing status text',
);

assert(
  /const isCompleted =[\s\S]*?obsState\.done[\s\S]*?\(hasNewMessage && !obsState\.generating\)[\s\S]*?hasChangedStableText/.test(source),
  'changed stable text must complete the response wait',
);

assert(
  /logLabel: "NV2"[\s\S]*?beforeText: before\?\.text \|\| ""[\s\S]*?acceptStableTextWithoutDone: true/.test(source),
  'NV2 waiter must accept stable text without done/count increment',
);

assert(
  source.includes('motionValidated snapshot is stale; motion_prompt.txt is missing. Regenerating NV2.'),
  'stale motionValidated snapshot must not skip NV2 when motion_prompt.txt is missing',
);

assert(
  /if \(snapshot\.motionValidated && !motionPromptFileExists\)[\s\S]*?snapshot\.motionValidated = false/.test(source),
  'missing motion prompt file must clear stale motionValidated flag',
);

console.log('chatgpt nv2 stable text response tests passed');
