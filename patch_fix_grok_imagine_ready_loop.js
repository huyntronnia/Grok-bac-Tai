const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_grok_imagine_ready_loop`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceAll(from, to, label) {
  const count = s.split(from).length - 1;
  if (!count) {
    console.log(`SKIP: ${label}`);
    return;
  }
  s = s.split(from).join(to);
  console.log(`OK: ${label} (${count})`);
}

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// 1) Gom helper check route ready.
if (!s.includes('function isGrokImagineReadyRoute')) {
  replaceRegex(
    /function isGrokImagineAgentUrl\s*\(value = ''\)\s*\{[\s\S]*?\n\}/,
    `function isGrokImagineAgentUrl(value = '') {
  return false;
}

function isGrokImagineReadyRoute(route) {
  return route === 'imagine_agent_ready' || route === 'imagine_normal_ready';
}`,
    'insert isGrokImagineReadyRoute helper'
  );
} else {
  console.log('SKIP: isGrokImagineReadyRoute already exists');
}

// 2) Thay mọi check route cũ.
replaceAll(
  `state.route === 'imagine_agent_ready'`,
  `isGrokImagineReadyRoute(state.route)`,
  'state.route ready check'
);

replaceAll(
  `state?.route === 'imagine_agent_ready'`,
  `isGrokImagineReadyRoute(state?.route)`,
  'state?.route ready check'
);

replaceAll(
  `lastState.route === 'imagine_agent_ready'`,
  `isGrokImagineReadyRoute(lastState.route)`,
  'lastState.route ready check'
);

replaceAll(
  `lastState?.route === 'imagine_agent_ready'`,
  `isGrokImagineReadyRoute(lastState?.route)`,
  'lastState?.route ready check'
);

replaceAll(
  `route.route === 'imagine_agent_ready'`,
  `isGrokImagineReadyRoute(route.route)`,
  'route.route ready check'
);

replaceAll(
  `route?.route === 'imagine_agent_ready'`,
  `isGrokImagineReadyRoute(route?.route)`,
  'route?.route ready check'
);

// 3) Nếu patch trước tạo dạng lồng ngoặc thì normalize.
replaceRegex(
  /\(state\?\.route === 'imagine_agent_ready' \|\| state\?\.route === 'imagine_normal_ready'\)/g,
  `isGrokImagineReadyRoute(state?.route)`,
  'normalize patched state?.route ready check'
);

replaceRegex(
  /\(lastState\?\.route === 'imagine_agent_ready' \|\| lastState\?\.route === 'imagine_normal_ready'\)/g,
  `isGrokImagineReadyRoute(lastState?.route)`,
  'normalize patched lastState?.route ready check'
);

replaceRegex(
  /\(route\?\.route === 'imagine_agent_ready' \|\| route\?\.route === 'imagine_normal_ready'\)/g,
  `isGrokImagineReadyRoute(route?.route)`,
  'normalize patched route?.route ready check'
);

// 4) Chặn điều hướng lặp khi đã imagine_normal_ready.
// Pattern này bắt block thường gặp: nếu route chưa ready thì navigate.
replaceRegex(
  /(if\s*\(\s*state\.route\s*!==\s*'imagine_agent_ready'\s*\)\s*\{)/g,
  `if (!isGrokImagineReadyRoute(state.route)) {`,
  'replace state.route not-ready condition'
);

replaceRegex(
  /(if\s*\(\s*lastState\.route\s*!==\s*'imagine_agent_ready'\s*\)\s*\{)/g,
  `if (!isGrokImagineReadyRoute(lastState.route)) {`,
  'replace lastState.route not-ready condition'
);

replaceRegex(
  /(if\s*\(\s*route\.route\s*!==\s*'imagine_agent_ready'\s*\)\s*\{)/g,
  `if (!isGrokImagineReadyRoute(route.route)) {`,
  'replace route.route not-ready condition'
);

// 5) Đổi lỗi/log còn sót chữ Agent.
replaceAll(
  `Grok Imagine Agent UI was not ready.`,
  `Grok Imagine UI was not ready.`,
  'rename agent not ready'
);

replaceAll(
  `imagine_agent_ready`,
  `imagine_agent_ready`,
  'noop keep literal'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: fixed Grok imagine_normal_ready loop');
console.log('Backup:', backup);
