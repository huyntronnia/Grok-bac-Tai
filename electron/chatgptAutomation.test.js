const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  CHATGPT_ERROR_REASONS,
  classifyChatGptState,
  getRecoveryDecision,
  isRejectedSendLabel,
  shouldRotateConversation,
} = require('./chatgptStability');

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'chatgpt-states', `${name}.json`), 'utf8'));
}

function run() {
  assert.strictEqual(classifyChatGptState(fixture('composer-busy')).reason, CHATGPT_ERROR_REASONS.COMPOSER_BUSY);
  assert.strictEqual(getRecoveryDecision(CHATGPT_ERROR_REASONS.COMPOSER_BUSY, 1), 'wait');
  assert.strictEqual(getRecoveryDecision(CHATGPT_ERROR_REASONS.COMPOSER_BUSY, 4), 'escape-overlays');

  assert.strictEqual(isRejectedSendLabel('Chia se hinh anh nay'), true);
  assert.strictEqual(classifyChatGptState(fixture('wrong-send-button-share-image')).reason, CHATGPT_ERROR_REASONS.SEND_BUTTON_SHARE_IMAGE);

  assert.strictEqual(classifyChatGptState(fixture('choice-required')).reason, CHATGPT_ERROR_REASONS.OUTPUT_CHOICE_REQUIRED);
  assert.strictEqual(classifyChatGptState(fixture('logged-out')).reason, CHATGPT_ERROR_REASONS.LOGGED_OUT);
  assert.strictEqual(classifyChatGptState(fixture('nv2-stuck-generating')).reason, CHATGPT_ERROR_REASONS.COMPOSER_BUSY);

  assert.deepStrictEqual(
    shouldRotateConversation({ sceneOrdinal: 3 }),
    { rotate: false, reason: '' }
  );
  assert.strictEqual(
    shouldRotateConversation({ assistantMessageCount: fixture('long-conversation').assistantMessageCount }).rotate,
    false
  );

  console.log('chatgptAutomation.test.js ok');
}

run();
