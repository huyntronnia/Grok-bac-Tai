const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs
  .readFileSync(path.join(root, 'electron/main/chatgpt/chatgpt_pipeline.js'), 'utf8')
  .replace(/\r\n/g, '\n');

assert(
  source.includes('reason: "network-image-not-final-enough"'),
  'network extraction must reject small/non-final network images before accepting',
);

assert(
  /method === "network"\s*&&\s*sourceKind\.includes\("cdp-network-response"\)\s*&&\s*width >= 512\s*&&\s*height >= 512\s*&&\s*byteLength >= 120000/.test(source),
  'preferred image filter must accept completed CDP network responses as real images',
);

assert(
  /if \(chosen\?\.ok && chosen\.method === "network"\) \{[\s\S]*?accepted completed CDP network image[\s\S]*?return chosen;[\s\S]*?\}\s*const readiness = classifyChatGptImageReadiness/.test(source),
  'completed CDP network image must return before readiness/stable polling',
);

assert(
  source.includes('mode: "document-media-fallback"'),
  'image extraction must scan document body when selected assistant root has no media',
);

assert(
  /selectedRoots\.length && !selectedRoots\.some\(rootHasDirectMedia\)[\s\S]*?usingLatestRootFallback = true/.test(source),
  'document media fallback must keep known-url protection enabled',
);

console.log('chatgpt network image extraction tests passed');
