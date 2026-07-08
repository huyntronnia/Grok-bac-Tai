const assert = require('assert');

const {
  CHATGPT_ERROR_REASONS,
  classifyChatGptError,
  getRecoveryDecision,
} = require('./chatgptStability');

function run() {
  assert.strictEqual(classifyChatGptError('ChatGPT composer is still busy; cannot send motion_prompt'), CHATGPT_ERROR_REASONS.COMPOSER_BUSY);
  assert.strictEqual(classifyChatGptError('Prompt pasted but not sent. Button: Chia se hinh anh nay'), CHATGPT_ERROR_REASONS.SEND_BUTTON_SHARE_IMAGE);
  assert.strictEqual(classifyChatGptError('Execution context was destroyed'), CHATGPT_ERROR_REASONS.TAB_CRASHED); // tab crash fixture covers same reason via state tests
  assert.strictEqual(classifyChatGptError('Cloudflare security verification'), CHATGPT_ERROR_REASONS.CLOUDFLARE_OR_PERMISSION_BLOCK);
  assert.strictEqual(getRecoveryDecision(CHATGPT_ERROR_REASONS.PROMPT_PASTED_BUT_SEND_NOT_READY, 5), 'keyboard-submit');
  assert.strictEqual(getRecoveryDecision(CHATGPT_ERROR_REASONS.PROMPT_PASTED_BUT_SEND_NOT_READY, 6), 'soft-reload');

  console.log('chatgptRecovery.test.js ok');
}

run();
