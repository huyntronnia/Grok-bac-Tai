const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_map_normal_imagine_to_ready`;
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

// Route /imagine thường đã có composer + upload target,
// nhưng code cũ chỉ cho đi tiếp nếu route là imagine_agent_ready.
// Vì vậy map imagine_normal_ready -> imagine_agent_ready.
replaceAll(
  `route = 'imagine_normal_ready'`,
  `route = 'imagine_agent_ready'`,
  'map normal imagine route assignment to old ready route'
);

replaceAll(
  `"imagine_normal_ready"`,
  `"imagine_agent_ready"`,
  'map normal imagine route string double quote'
);

replaceAll(
  `'imagine_normal_ready'`,
  `'imagine_agent_ready'`,
  'map normal imagine route string single quote'
);

// Đổi log/message cho đỡ hiểu nhầm.
replaceAll(
  `Grok Imagine Agent UI was not ready.`,
  `Grok Imagine UI was not ready.`,
  'rename not ready message'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: mapped normal /imagine to ready route');
console.log('Backup:', backup);
