const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_stop_on_chatgpt_refusal`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

const refusalHelper = `
function isChatGptPolicyRefusalText(text = '') {
  const t = String(text || '').toLowerCase();
  return (
    t.includes('vi phạm các quy định') ||
    t.includes('quy định của chúng tôi về bạo lực') ||
    t.includes('có thể vi phạm') ||
    t.includes('i can’t help create') ||
    t.includes('i can’t assist with') ||
    t.includes('policy') && t.includes('violence')
  );
}
`;

if (!s.includes('function isChatGptPolicyRefusalText')) {
  replaceRegex(
    /async function generateImageAndMotionWithChatGPT/,
    `${refusalHelper}
async function generateImageAndMotionWithChatGPT`,
    'insert ChatGPT refusal detector'
  );
} else {
  console.log('SKIP: refusal detector already exists');
}

// Chặn trong loop chờ NV2 nếu text là refusal.
// Pattern này bắt ngay trước các log "chờ ChatGPT hoàn tất NV2".
if (!s.includes('ChatGPT từ chối nội dung NV2/policy')) {
  replaceRegex(
    /(quality:\s*quality,\s*textHead:\s*String\(latestText \|\| ''\)\.slice\(0,\s*240\),\s*\},\s*\}\);)/,
    `$1

      if (isChatGptPolicyRefusalText(latestText)) {
        throw new Error('ChatGPT từ chối nội dung NV2/policy. Hãy giảm yếu tố bạo lực trong scene/prompt rồi chạy lại scene này.');
      }`,
    'stop waiting when NV2 returns policy refusal'
  );
} else {
  console.log('SKIP: NV2 refusal stop already exists');
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: stop on ChatGPT policy refusal installed');
console.log('Backup:', backup);
