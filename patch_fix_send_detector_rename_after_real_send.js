const fs = require('fs');

const p = 'electron/main.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_fix_send_detector_and_rename_after_real_send`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

// 1) Sửa detector sai: tuyệt đối không coi "Viết hoặc chỉnh sửa" là nút send.
s = s.replace(
  /return\s*\(\s*t\.includes\('viết hoặc'\)\s*\|\|\s*t\.includes\('hỉnh sửa'\)\s*\|\|\s*t\.includes\('chỉnh sửa'\)\s*\|\|/g,
  `return (
    !t.includes('viết hoặc') &&
    !t.includes('hỉnh sửa') &&
    !t.includes('chỉnh sửa') &&
    !t.includes('tạo ảnh') &&
    !t.includes('tra cứu') &&
    (`
);

// Đóng ngoặc cho block vừa thay nếu có pattern send/submit phía sau.
s = s.replace(
  /(t\.includes\('composer-submit'\)\s*\);)/g,
  `$1
  )`
);

// 2) Nếu kết quả send vẫn là "Viết hoặc..." thì fail ngay, không được rename, không được chờ ảnh.
if (!s.includes('guard-wrong-send-button-viet-hoac-final')) {
  s = s.replace(
    /(Scene \$\{sceneId\}: ChatGPT send image prompt ok[\s\S]*?details:\s*\{[\s\S]*?send:\s*[^,\n]+[\s\S]*?\}\s*\}\)\.catch\(\(\) => null\);)/,
    `$1

  // guard-wrong-send-button-viet-hoac-final
  {
    const lastSendLabel = String(sendResult?.send || sendResult?.selector || sendResult?.mode || '').toLowerCase();
    if (
      lastSendLabel.includes('viết hoặc') ||
      lastSendLabel.includes('hỉnh sửa') ||
      lastSendLabel.includes('chỉnh sửa') ||
      lastSendLabel.includes('tạo ảnh') ||
      lastSendLabel.includes('tra cứu')
    ) {
      await appendAppLog(null, {
        source: 'main',
        kind: 'error',
        text: \`Scene \${sceneId}: CLICK NHẦM nút tool mode "\${lastSendLabel}", không phải nút gửi. Dừng ngay.\`,
        details: { sendResult },
      }).catch(() => null);

      throw new Error('clicked-wrong-chatgpt-tool-button-not-send');
    }
  }`
  );
}

// 3) Rename chỉ được poll sau khi path thành /c/...; nếu còn / thì log rõ là chưa gửi/thất bại.
if (!s.includes('rename-only-after-real-conversation-url-final')) {
  s = s.replace(
    /(Scene \$\{sceneId\}: ChatGPT rename poll path=\$\{[^}]+\})/g,
    `$1`
  );

  s = s.replace(
    /(await appendAppLog\(null,\s*\{\s*source:\s*'main',\s*kind:\s*'running',\s*text:\s*`Scene \$\{sceneId\}: ChatGPT rename poll path=\$\{([^}]+)\}`[\s\S]*?\}\)\.catch\(\(\) => null\);)/,
    `// rename-only-after-real-conversation-url-final
      if (String($2 || '') === '/' || !String($2 || '').includes('/c/')) {
        await appendAppLog(null, {
          source: 'main',
          kind: 'error',
          text: \`Scene \${sceneId}: chưa có hội thoại /c/... vì prompt chưa gửi thật; bỏ rename poll và quay về kiểm tra input.\`,
          details: { path: $2, reason: 'no-conversation-url-before-rename' },
        }).catch(() => null);
        break;
      }

      $1`
  );
}

fs.writeFileSync(p, s, 'utf8');

console.log('DONE: fixed ChatGPT send detector + wrong send guard + rename only after /c');
console.log('Backup:', backup);
