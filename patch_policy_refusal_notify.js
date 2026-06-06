const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_policy_refusal_notify`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceRegex(rx, to, label) {
  const before = s;
  s = s.replace(rx, to);
  console.log(before === s ? `SKIP: ${label}` : `OK: ${label}`);
}

// 1) Helper detect câu từ chối policy của ChatGPT.
const helper = `
function isChatGptPolicyRefusalText(text = '') {
  const t = String(text || '').toLowerCase();
  return (
    t.includes('vi phạm các quy định') ||
    t.includes('quy định của chúng tôi về bạo lực') ||
    t.includes('có thể vi phạm') ||
    t.includes('về bạo lực') ||
    t.includes('chỉnh sửa câu lệnh') ||
    t.includes('i can’t help') ||
    t.includes("i can't help") ||
    t.includes('i can’t assist') ||
    t.includes("i can't assist") ||
    (t.includes('policy') && (t.includes('violence') || t.includes('violent')))
  );
}

async function notifyChatGptPolicyRefusal(sceneId, stage, text) {
  const cleanText = String(text || '').replace(/\\s+/g, ' ').trim().slice(0, 800);
  const message = \`Scene \${sceneId}: ChatGPT đã từ chối vì policy/bạo lực. Hãy giảm mô tả tấn công, móng vuốt, rơi/ngã, va đập, thương tích rồi chạy lại scene này.\`;

  await appendAppLog(null, {
    source: 'main',
    kind: 'error',
    text: message,
    details: { sceneId, stage, chatgptText: cleanText },
  }).catch(() => null);

  await notifyRenderer('chatgpt-policy-refusal', message, {
    sceneId,
    stage,
    text: cleanText,
    suggestion: 'Giảm mức bạo lực trực tiếp: đổi “tấn công/cào/rơi/va đập” thành “đe dọa/căng thẳng/truy đuổi điện ảnh, không thương tích, không máu”.',
  }).catch(() => null);

  throw new Error(message);
}
`;

if (!s.includes('function isChatGptPolicyRefusalText')) {
  replaceRegex(
    /function isChatGptLimitText\s*\(/,
    `${helper}
function isChatGptLimitText(`,
    'insert ChatGPT policy refusal helper before limit detector'
  );
} else {
  console.log('SKIP: policy refusal helper already exists');
}

// 2) Trong wait ảnh NV1: nếu assistant trả text refusal thì báo ngay, không retry text-only vô hạn.
replaceRegex(
  /(if\s*\(textOnlyAnswer\s*&&\s*isChatGptLimitText\(snapshot\?\.latestAssistantText\)\)\s*\{)/,
  `if (textOnlyAnswer && isChatGptPolicyRefusalText(snapshot?.latestAssistantText)) {
        await notifyChatGptPolicyRefusal(sceneId, 'NV1/image', snapshot?.latestAssistantText);
      }

      $1`,
  'notify/stop on NV1 image policy refusal'
);

// 3) Trong NV2/motion prompt: nếu latestText là refusal thì báo ngay, không chờ same-as-before mãi.
// Bắt ngay trước log "chờ ChatGPT hoàn tất NV2".
replaceRegex(
  /(await appendAppLog\(null,\s*\{\s*source:\s*'main',\s*kind:\s*'running',\s*text:\s*`Scene \$\{sceneId\}: chờ ChatGPT hoàn tất NV2)/,
  `if (isChatGptPolicyRefusalText(latestText)) {
        await notifyChatGptPolicyRefusal(sceneId, 'NV2/motion-prompt', latestText);
      }

      $1`,
  'notify/stop on NV2 policy refusal before waiting log'
);

// 4) Fallback cho các nhánh log tiếng Việt khác: "đang chờ ChatGPT trả NV2".
replaceRegex(
  /(await appendAppLog\(null,\s*\{\s*source:\s*'main',\s*kind:\s*'running',\s*text:\s*`Scene \$\{sceneId\}: đang chờ ChatGPT trả NV2)/,
  `if (isChatGptPolicyRefusalText(latestText)) {
        await notifyChatGptPolicyRefusal(sceneId, 'NV2/motion-prompt', latestText);
      }

      $1`,
  'notify/stop on NV2 policy refusal fallback'
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: installed ChatGPT policy refusal notification');
console.log('Backup:', backup);
