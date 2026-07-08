const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');

function extractFunction(name, isAsync = false) {
  const prefix = isAsync ? `async function ${name}(` : `function ${name}(`;
  const start = main.indexOf(prefix);
  assert(start >= 0, `${name} source not found`);
  const endFunction = main.indexOf('\n}\n\nfunction ', start);
  const endAsync = main.indexOf('\n}\n\nasync function ', start);
  const candidates = [endFunction, endAsync].filter((value) => value > start);
  assert(candidates.length, `${name} source end not found`);
  return main.slice(start, Math.min(...candidates) + 3);
}

const functionStart = main.indexOf('async function generateMotionPromptWithChatGPTOnce(');
const functionEnd = main.indexOf('function validateMotionPromptResponse', functionStart);
assert(functionStart >= 0 && functionEnd > functionStart, 'NV2 motion prompt function not found');
const nv2Flow = main.slice(functionStart, functionEnd);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${extractFunction('isValidChatGptConversationUrl')}
this.isValidChatGptConversationUrl = isValidChatGptConversationUrl;`, sandbox);

assert.strictEqual(sandbox.isValidChatGptConversationUrl('https://chatgpt.com/'), false, 'root URL with slash must be rejected');
assert.strictEqual(sandbox.isValidChatGptConversationUrl('https://chatgpt.com'), false, 'root URL without slash must be rejected');
assert.strictEqual(sandbox.isValidChatGptConversationUrl('https://chatgpt.com/c/abc123'), true, '/c/id URL must be accepted');
assert.strictEqual(sandbox.isValidChatGptConversationUrl('https://chatgpt.com/c/abc123?model=gpt-4'), true, '/c/id URL with query must be accepted');

assert(nv2Flow.includes('const persistedChatUrl = String(durableNv2State.chatUrl || durableNv2State.chatGptConversationUrl || \'\').trim();'), 'durable retry must read persisted chatUrl');
assert(nv2Flow.includes('isValidChatGptConversationUrl(persistedChatUrl)'), 'durable retry must validate persisted chatUrl');
assert(nv2Flow.includes('await page.Page.navigate({ url: exactConversationUrl });'), 'valid persisted conversation must be reopened');
assert(nv2Flow.includes('Scene ${sceneId}: Restoring persisted NV2 conversation URL.'), 'persisted URL restore log missing');

assert(nv2Flow.includes('Scene ${sceneId}: Waiting for ChatGPT conversation URL promotion.'), 'post-send URL promotion wait log missing');
assert(nv2Flow.includes('Date.now() + 15000'), 'URL promotion must wait up to 15s');
assert(nv2Flow.includes('await sleep(500);'), 'URL promotion should check about every 500ms');
assert(nv2Flow.includes('Scene ${sceneId}: Conversation URL captured: ${promotedUrl}'), 'captured conversation URL log missing');
assert(nv2Flow.includes('chatUrl: promotedUrl'), 'promoted URL must persist chatUrl');
assert(nv2Flow.includes('Scene ${sceneId}: Persisted exact NV2 conversation URL.'), 'persisted URL log missing');

const refreshBlock = nv2Flow.slice(nv2Flow.indexOf('const refreshExactConversationAndExtract'), nv2Flow.indexOf('await appendAppLog(null, { source: \'main\', kind: \'running\', text: `Scene ${sceneId}: NV2 generation acknowledged'));
assert(refreshBlock.includes('if (isValidChatGptConversationUrl(exactConversationUrl))'), 'refresh must validate exact conversation URL');
assert(refreshBlock.includes('Scene ${sceneId}: Root URL is not refresh-safe; skipping refresh.'), 'root refresh skip log missing');
assert(refreshBlock.includes('await waitForConversationUrlPromotion();'), 'invalid URL path should keep watching promotion');
assert(refreshBlock.includes('const snapshot = await evaluateOnCdpPage(page, `(${readAssistantMessageSnapshotScript.toString()})()`'), 'invalid URL path must still extract current DOM');
assert(refreshBlock.includes("refreshMode: 'f5'"), 'refresh must use F5 mode');
assert(refreshBlock.includes("page.Input.dispatchKeyEvent({ type: 'keyDown', key: 'F5'"), 'refresh must dispatch F5 keyDown');
assert(!refreshBlock.includes('page.Page.navigate({ url: exactConversationUrl })'), 'refresh must not navigate by URL');
assert(!refreshBlock.includes("page.Page.navigate({ url: 'https://chatgpt.com/' })"), 'refresh must never navigate to root');

assert(main.includes('...(isValidChatGptConversationUrl(currentChatUrlForPipeline) ? { chatUrl: currentChatUrlForPipeline'), 'initial pipeline state must not persist root chatUrl');
assert(main.includes("...(isValidChatGptConversationUrl(exactConversationUrl) ? { chatUrl: exactConversationUrl"), 'nv2_saved must not persist root chatUrl');

console.log('nv2 conversation URL tests passed');
