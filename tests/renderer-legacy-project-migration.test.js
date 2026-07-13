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

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(
  `${extractFunction('normalizeLegacyVideoProvider')}
   ${extractFunction('scrubLegacyProjectFields')}
   this.normalizeLegacyVideoProvider = normalizeLegacyVideoProvider;
   this.scrubLegacyProjectFields = scrubLegacyProjectFields;`,
  sandbox,
);

assert.strictEqual(sandbox.normalizeLegacyVideoProvider('grok'), 'veoup', 'legacy Grok provider must load as VeoUp');
assert.strictEqual(sandbox.normalizeLegacyVideoProvider('pixverse'), 'veoup', 'legacy PixVerse provider must load as VeoUp');
assert.strictEqual(sandbox.normalizeLegacyVideoProvider('veoup'), 'veoup', 'VeoUp provider must remain VeoUp');

const scrubbed = sandbox.scrubLegacyProjectFields({
  name: 'legacy project',
  videoProvider: 'grok',
  videoPlatform: 'pixverse',
  router: { selectedGrokAccountId: 'secret-account' },
  grokRouter: { accountRouterEnabled: true },
  grokRecovery: { resultRetryLimit: 2 },
  pixverse: { token: 'secret-token' },
  sendToGrok: true,
  selectedGrokAccountId: 'grok-account-1',
  routingPolicy: 'manual',
  accountRouterEnabled: true,
  imagePath: 'scene_001/keyframe.png',
  motionPrompt: 'keep this',
  scenes: [
    {
      id: 1,
      imagePath: 'scene_001/keyframe.png',
      nested: {
        pixverse: { token: 'nested-secret' },
        safe: 'keep nested safe value',
      },
    },
  ],
});

for (const key of [
  'accountRouterEnabled',
  'grokRecovery',
  'grokRouter',
  'pixverse',
  'router',
  'routingPolicy',
  'selectedGrokAccountId',
  'sendToGrok',
  'videoProvider',
  'videoPlatform',
]) {
  assert.ok(!(key in scrubbed), `${key} must be stripped from new saved payloads`);
}

assert.strictEqual(scrubbed.imagePath, 'scene_001/keyframe.png', 'scene asset paths must survive migration');
assert.strictEqual(scrubbed.motionPrompt, 'keep this', 'scene prompts must survive migration');
assert.ok(Array.isArray(scrubbed.scenes), 'arrays must stay arrays after recursive scrub');
assert.strictEqual(scrubbed.scenes[0].nested.safe, 'keep nested safe value', 'nested safe values must survive scrub');
assert.ok(!('pixverse' in scrubbed.scenes[0].nested), 'nested PixVerse data must be stripped');

const payloadStart = renderer.indexOf('function getProjectSessionPayload()');
assert(payloadStart >= 0, 'getProjectSessionPayload missing');
const payloadEnd = renderer.indexOf('\n}\n\nfunction normalizeRendererScene', payloadStart);
assert(payloadEnd > payloadStart, 'getProjectSessionPayload block end missing');
const payloadBlock = renderer.slice(payloadStart, payloadEnd);

assert(payloadBlock.includes("videoProvider: 'veoup'"), 'new project payload must write VeoUp provider');
assert(payloadBlock.includes("video: 'veoup'"), 'new project payload model metadata must write VeoUp');
assert(!payloadBlock.includes('router:'), 'new project payload must not write router metadata');
assert(!payloadBlock.includes('grokRouter'), 'new project payload must not write Grok router metadata');
assert(!payloadBlock.includes('grokRecovery'), 'new project payload must not write Grok recovery metadata');
assert(!payloadBlock.includes('pixverse:'), 'new project payload must not write PixVerse metadata');
assert(!payloadBlock.includes('sendToGrok'), 'new project payload must not write Grok continuity metadata');

console.log('renderer legacy project migration tests passed');
