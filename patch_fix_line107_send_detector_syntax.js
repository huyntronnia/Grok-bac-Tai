const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_line107_send_detector_syntax`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

// Sửa function detector đầu file bị patch hỏng quanh dòng 94-107.
// Thay toàn bộ function có return bị hỏng bằng bản an toàn.
s = s.replace(
/function\s+\w*is\w*Send\w*Button\w*\s*\([^)]*\)\s*\{[\s\S]{0,900}?const t = String\(text \|\| ''\)\.trim\(\)\.toLowerCase\(\);[\s\S]{0,900}?return \([\s\S]{0,900}?\);\s*\}/,
`function isLikelyChatGptSendButtonText(text) {
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
}`
);

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: fixed send detector syntax near line 107');
console.log('Backup:', backup);
