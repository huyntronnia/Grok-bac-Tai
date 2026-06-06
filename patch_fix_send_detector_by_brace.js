const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_send_detector_by_brace`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

const needle = "const t = String(text || '').trim().toLowerCase();";
const idx = s.indexOf(needle);

if (idx < 0) {
  console.error('FAIL: không tìm thấy detector line:', needle);
  process.exit(1);
}

const start = s.lastIndexOf('function ', idx);
if (start < 0) {
  console.error('FAIL: không tìm thấy function start trước detector line');
  process.exit(1);
}

const braceStart = s.indexOf('{', start);
if (braceStart < 0 || braceStart > idx) {
  console.error('FAIL: không tìm thấy { của function detector');
  process.exit(1);
}

let depth = 0;
let end = -1;
for (let i = braceStart; i < s.length; i++) {
  const ch = s[i];
  if (ch === '{') depth++;
  if (ch === '}') depth--;

  if (depth === 0) {
    end = i + 1;
    break;
  }
}

if (end < 0) {
  console.error('FAIL: không tìm thấy } đóng function detector');
  process.exit(1);
}

// Nếu sau function còn sót dòng ");" do patch cũ làm hỏng thì xóa luôn.
let after = end;
const tail = s.slice(after, after + 80);
const m = tail.match(/^\s*\);\s*/);
if (m) {
  after += m[0].length;
  console.log('OK: removed stray ); after detector function');
}

const cleanFunction = `function isLikelyChatGptSendButtonText(text) {
  const t = String(text || '').trim().toLowerCase();

  if (!t) return false;

  // Tuyệt đối không coi các nút tool/mode là nút gửi.
  if (
    t.includes('viết hoặc') ||
    t.includes('hỉnh sửa') ||
    t.includes('chỉnh sửa') ||
    t.includes('tạo ảnh') ||
    t.includes('tra cứu') ||
    t.includes('voice') ||
    t.includes('micro')
  ) {
    return false;
  }

  return (
    t.includes('send') ||
    t.includes('gửi') ||
    t.includes('submit') ||
    t.includes('arrow-up') ||
    t.includes('send-button') ||
    t.includes('composer-submit')
  );
}`;

s = s.slice(0, start) + cleanFunction + s.slice(after);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: replaced broken send detector function');
console.log('Backup:', backup);
