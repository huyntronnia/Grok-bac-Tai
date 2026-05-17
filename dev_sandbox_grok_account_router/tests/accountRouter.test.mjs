import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ACCOUNT_STATES,
  checkpointContainsSecret,
  containsFullPrivateEmail,
  containsPlainSecret,
  createAccount,
  createCheckpoint,
  createMockEncryptedStorage,
  handleGenerationError,
  isSelectableAccount,
  loadMockCheckpoint,
  markActive,
  markAvailable,
  markCooldown,
  pickNextAccount,
  resumeFromCheckpoint,
  saveMockCheckpoint,
  transitionAccount,
} from '../prototype/accountRouter.js';

const root = path.resolve(import.meta.dirname, '..');
const fixturePath = path.join(root, 'tests', 'sample_account_router.json');
const fixtureText = fs.readFileSync(fixturePath, 'utf8');
const fixture = JSON.parse(fixtureText);

function cloneAccounts() {
  return fixture.accounts.map((account) => ({ ...account }));
}

function createStore() {
  return { checkpoints: new Map(), secrets: createMockEncryptedStorage() };
}

assert.equal(fixture.schemaVersion, 1);
assert.equal(Array.isArray(fixture.accounts), true);
assert.equal(fixture.routing.strategy, 'round_robin');
assert.equal(containsPlainSecret(fixtureText), false, 'fixture must not contain plaintext secrets');
assert.equal(containsFullPrivateEmail(fixtureText), false, 'fixture must not contain full private emails');

for (const account of fixture.accounts) {
  assert.equal(Object.hasOwn(account, 'email'), false);
  assert.equal(Object.hasOwn(account, 'password'), false);
  assert.equal(Object.hasOwn(account, 'cookies'), false);
  assert.equal(Object.hasOwn(account, 'sessionToken'), false);
  assert.equal(Object.hasOwn(account, 'refreshToken'), false);
  assert.equal(Object.hasOwn(account, 'apiKey'), false);
}

{
  const account = createAccount({ accountId: 'acc_safe', displayName: 'Masked Account', maskedEmail: 'm***@example.test' });
  assert.equal(account.status, ACCOUNT_STATES.AVAILABLE);
  assert.throws(() => createAccount({ accountId: 'acc_bad', maskedEmail: 'person@example.test' }));
  assert.throws(() => createAccount({ accountId: 'acc_bad', password: 'not-allowed' }));
}

{
  const accounts = cloneAccounts();
  const checkpoint = createCheckpoint({ accountId: 'acc_sample_001', sceneId: 'scene_001' });
  const result = handleGenerationError({ accounts, activeAccountId: 'acc_sample_001', error: 'account daily limit reached', checkpoint, routing: fixture.routing, store: createStore() });
  assert.equal(result.action, 'switch_account');
  assert.equal(result.activeAccountId, 'acc_sample_002');
  assert.equal(result.accounts.find((account) => account.accountId === 'acc_sample_001').status, ACCOUNT_STATES.LIMITED);
}

{
  const accounts = cloneAccounts();
  const checkpoint = createCheckpoint({ accountId: 'acc_sample_001', sceneId: 'scene_002' });
  const result = handleGenerationError({ accounts, activeAccountId: 'acc_sample_001', error: 'canvas quota limit reached', checkpoint, routing: fixture.routing, store: createStore() });
  assert.equal(result.action, 'switch_canvas');
  assert.equal(result.activeAccountId, 'acc_sample_001');
  assert.match(result.canvasRef, /^canvas_/);
}

{
  const accounts = cloneAccounts().map((account) => ({ ...account, status: ACCOUNT_STATES.LIMITED }));
  const checkpoint = createCheckpoint({ accountId: 'acc_sample_001', sceneId: 'scene_003' });
  const result = handleGenerationError({ accounts, activeAccountId: 'acc_sample_001', error: 'account limit reached', checkpoint, routing: fixture.routing, store: createStore() });
  assert.equal(result.action, 'pause');
  assert.equal(result.checkpoint.lastErrorClassification, 'account_limit');
}

{
  const accounts = cloneAccounts();
  const checkpoint = createCheckpoint({ accountId: 'acc_sample_001', sceneId: 'scene_004' });
  const result = handleGenerationError({ accounts, activeAccountId: 'acc_sample_001', error: 'login required', checkpoint, routing: fixture.routing, store: createStore() });
  assert.equal(result.action, 'pause_for_login');
  assert.equal(result.accounts.find((account) => account.accountId === 'acc_sample_001').status, ACCOUNT_STATES.LOGIN_REQUIRED);
}

{
  const accounts = [
    { ...cloneAccounts()[0], accountId: 'acc_a', status: ACCOUNT_STATES.ACTIVE },
    { ...cloneAccounts()[0], accountId: 'acc_limited', status: ACCOUNT_STATES.LIMITED },
    { ...cloneAccounts()[0], accountId: 'acc_login', status: ACCOUNT_STATES.LOGIN_REQUIRED },
    { ...cloneAccounts()[0], accountId: 'acc_invalid', status: ACCOUNT_STATES.INVALID },
    { ...cloneAccounts()[0], accountId: 'acc_disabled', status: ACCOUNT_STATES.DISABLED_BY_USER },
    { ...cloneAccounts()[0], accountId: 'acc_b', status: ACCOUNT_STATES.AVAILABLE },
  ];
  const next = pickNextAccount(accounts, 'acc_a', fixture.routing);
  assert.equal(next.account.accountId, 'acc_b');
}

{
  const account = { ...cloneAccounts()[0], status: ACCOUNT_STATES.INVALID };
  const result = transitionAccount(account, ACCOUNT_STATES.ACTIVE);
  assert.equal(result.changed, false);
  assert.equal(result.account, account);
  assert.equal(result.account.status, ACCOUNT_STATES.INVALID);
  assert.equal(result.log.includes(account.accountId), false);
}

{
  const checkpoint = createCheckpoint({ accountId: 'acc_sample_001', sceneId: 'scene_safe' });
  assert.equal(checkpointContainsSecret(checkpoint), false);
  assert.throws(() => saveMockCheckpoint(createStore(), { ...checkpoint, motionPrompt: 'password=not-allowed' }));
  assert.throws(() => createCheckpoint({ accountId: 'acc_sample_001', motionPrompt: 'contact person@example.test' }));
  assert.throws(() => createCheckpoint({ accountId: 'acc_sample_001', motionPrompt: 'bearer abcdefghijklmnopqrstuvwxyz' }));
}

{
  const checkpoint = createCheckpoint({ accountId: 'acc_sample_001', sceneId: 'scene_resume' });
  const store = createStore();
  const saved = saveMockCheckpoint(store, checkpoint);
  assert.deepEqual(loadMockCheckpoint(store, saved.checkpointId), saved);
  const result = resumeFromCheckpoint(checkpoint, cloneAccounts());
  assert.equal(result.action, 'resume_scene');
  assert.equal(result.accountId, 'acc_sample_001');
  assert.equal(result.sceneId, 'scene_resume');
}

{
  const checkpoint = createCheckpoint({ accountId: 'acc_sample_001', sceneId: 'scene_resume_pause' });
  const accounts = cloneAccounts().map((account) => account.accountId === 'acc_sample_001' ? { ...account, status: ACCOUNT_STATES.LIMITED } : account);
  const result = resumeFromCheckpoint(checkpoint, accounts);
  assert.equal(result.action, 'pause');
  assert.equal(result.accountId, 'acc_sample_001');
}

{
  const futureCooldown = new Date(Date.now() + 60_000).toISOString();
  const pastCooldown = new Date(Date.now() - 60_000).toISOString();
  const cooling = { ...cloneAccounts()[0], accountId: 'acc_cooling', status: ACCOUNT_STATES.COOLDOWN, cooldownUntil: futureCooldown };
  const cooled = { ...cloneAccounts()[0], accountId: 'acc_cooled', status: ACCOUNT_STATES.COOLDOWN, cooldownUntil: pastCooldown };
  assert.equal(isSelectableAccount(cooling), false);
  assert.equal(isSelectableAccount(cooled), true);
  assert.equal(pickNextAccount([cooling, cooled], 'acc_cooling', fixture.routing).account.accountId, 'acc_cooled');
}

{
  const account = { ...cloneAccounts()[0], status: ACCOUNT_STATES.AVAILABLE };
  const active = markActive(account);
  assert.equal(active.changed, true);
  assert.equal(active.account.status, ACCOUNT_STATES.ACTIVE);
  assert.equal(Boolean(active.account.lastUsedAt), true);
  assert.equal(active.log.includes(account.accountId), false);
  const cooldownUntil = new Date(Date.now() + 60_000).toISOString();
  const cooling = markCooldown(active.account, { cooldownUntil });
  assert.equal(cooling.changed, true);
  assert.equal(cooling.account.status, ACCOUNT_STATES.COOLDOWN);
  assert.equal(cooling.account.cooldownUntil, cooldownUntil);
}

{
  const accounts = [
    { ...cloneAccounts()[0], accountId: 'acc_a', status: ACCOUNT_STATES.ACTIVE },
    { ...cloneAccounts()[0], accountId: 'acc_b', status: ACCOUNT_STATES.AVAILABLE },
    { ...cloneAccounts()[0], accountId: 'acc_c', status: ACCOUNT_STATES.AVAILABLE },
  ];
  const first = pickNextAccount(accounts, 'acc_a', fixture.routing);
  assert.equal(first.account.accountId, 'acc_b');
  const second = pickNextAccount(accounts, first.account.accountId, fixture.routing);
  assert.equal(second.account.accountId, 'acc_c');
  const wrap = pickNextAccount(accounts, second.account.accountId, fixture.routing);
  assert.equal(wrap.account.accountId, 'acc_a');
}

{
  const accounts = cloneAccounts();
  const checkpoint = createCheckpoint({ accountId: 'acc_sample_001', sceneId: 'scene_network' });
  const result = handleGenerationError({ accounts, activeAccountId: 'acc_sample_001', error: 'network timeout while uploading', checkpoint, routing: fixture.routing, store: createStore() });
  assert.equal(result.action, 'pause');
  assert.equal(result.reason, 'network_error');
  assert.equal(result.accounts.find((account) => account.accountId === 'acc_sample_001').status, ACCOUNT_STATES.ACTIVE);
  assert.equal(result.checkpoint.accountId, 'acc_sample_001');
}

{
  const accounts = cloneAccounts();
  const checkpoint = createCheckpoint({ accountId: 'acc_sample_001', sceneId: 'scene_unknown' });
  const result = handleGenerationError({ accounts, activeAccountId: 'acc_sample_001', error: 'unexpected renderer failure', checkpoint, routing: fixture.routing, store: createStore() });
  assert.equal(result.action, 'pause');
  assert.equal(result.reason, 'unknown_error');
  assert.equal(result.checkpoint.lastErrorClassification, 'unknown_error');
  assert.equal(result.checkpoint.accountId, 'acc_sample_001');
}

{
  const storage = createMockEncryptedStorage();
  storage.saveSecret('mock-ref', { provider: 'grok', note: 'fake payload only' });
  assert.deepEqual(storage.dumpRefs(), ['mock-ref']);
  assert.throws(() => storage.saveSecret('bad-ref', { note: 'password=not-allowed' }));
  assert.throws(() => storage.saveSecret('bad-email-ref', { note: 'person@example.test' }));
}

{
  const disabled = { ...cloneAccounts()[0], status: ACCOUNT_STATES.DISABLED_BY_USER };
  const result = markAvailable(disabled);
  assert.equal(result.changed, true);
  assert.equal(result.account.status, ACCOUNT_STATES.AVAILABLE);
}

console.log('Phase 1 account router prototype tests passed');
