const fs = require('fs');

const p = 'electron/renderer.js';
let s = fs.readFileSync(p, 'utf8');

const backup = `${p}.bak_stop_next_scene_until_video`;
if (!fs.existsSync(backup)) fs.copyFileSync(p, backup);

function replaceOnce(from, to, label) {
  if (!s.includes(from)) {
    console.log(`SKIP: ${label}`);
    return false;
  }
  s = s.replace(from, to);
  console.log(`OK: ${label}`);
  return true;
}

const guard = `
      const hasVideoOutput = Boolean(
        scene.videoPath ||
        scene.videoUrl ||
        scene.finalVideoPath ||
        scene.outputVideoPath ||
        result?.videoPath ||
        result?.videoUrl ||
        result?.finalVideoPath ||
        result?.outputVideoPath
      );

      if (!hasVideoOutput) {
        paused = true;
        isRunning = false;
        autoContinuing = false;
        scene.status = scene.motionPrompt ? 'video_pending' : 'motion_prompt_pending';
        scene.progressStep = scene.motionPrompt ? 'video' : 'motion';
        scene.error = 'Scene này chưa có motion/video hoàn chỉnh nên đã chặn chạy scene kế tiếp.';
        persist();
        render();
        setStatus(\`Scene \${scene.id} chưa có video hoàn chỉnh. Đã dừng để tránh nhảy sang scene kế tiếp.\`, 'error');
        return;
      }
`;

// Chèn guard ngay sau khi nhận result từ runScenePipeline.
replaceOnce(
`      const result = await window.videoPlannerAPI.runScenePipeline({`,
`      const result = await window.videoPlannerAPI.runScenePipeline({`,
'found runScenePipeline call'
);

// Pattern phổ biến sau payload runScenePipeline là dòng đóng "});" rồi update scene.
// Chèn sau dòng "});" đầu tiên SAU runScenePipeline bằng cách thủ công theo vùng.
const marker = `      const result = await window.videoPlannerAPI.runScenePipeline({`;
const idx = s.indexOf(marker);

if (idx < 0) {
  console.log('FAIL: Không tìm thấy runScenePipeline block.');
} else if (s.includes('Scene này chưa có motion/video hoàn chỉnh nên đã chặn chạy scene kế tiếp.')) {
  console.log('SKIP: guard already installed');
} else {
  const after = s.indexOf(`      });`, idx);
  if (after < 0) {
    console.log('FAIL: Không tìm thấy cuối block runScenePipeline.');
  } else {
    const insertAt = after + `      });`.length;
    s = s.slice(0, insertAt) + guard + s.slice(insertAt);
    fs.writeFileSync(p, s, 'utf8');
    console.log('OK: inserted stop-next-scene-until-video guard');
    console.log('Backup:', backup);
  }
}
