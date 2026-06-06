const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_latestText_undefined`;
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

// Fix các đoạn patch cũ dùng latestText ngoài scope.
replaceAll(
  `if (isChatGptPolicyRefusalText(latestText)) {
        await notifyChatGptPolicyRefusal(sceneId, 'NV2/motion-prompt', latestText);
      }`,
  `{
        const policyCheckText =
          typeof latestText !== 'undefined' ? latestText :
          typeof text !== 'undefined' ? text :
          typeof responseText !== 'undefined' ? responseText :
          typeof latest?.text !== 'undefined' ? latest.text :
          typeof latestAssistantText !== 'undefined' ? latestAssistantText :
          '';

        if (isChatGptPolicyRefusalText(policyCheckText)) {
          await notifyChatGptPolicyRefusal(sceneId, 'NV2/motion-prompt', policyCheckText);
        }
      }`,
  'replace unsafe latestText policy check'
);

// Fix nếu có dạng khác.
replaceAll(
  `isChatGptPolicyRefusalText(latestText)`,
  `isChatGptPolicyRefusalText((typeof latestText !== 'undefined' ? latestText : ''))`,
  'replace remaining unsafe latestText expression'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: fixed latestText undefined');
console.log('Backup:', backup);
