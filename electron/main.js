const { execFileSync, spawn } = require('child_process');
const { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, Menu } = require('electron');
const CDP = require('chrome-remote-interface');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs/promises');
const path = require('path');

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v']);
const webWindows = new Map();
const PROVIDER_META = {
  chatgpt: { url: 'https://chatgpt.com/', title: 'ChatGPT', partition: 'chatgpt-web-session' },
  grok: { url: 'https://grok.com/', title: 'Grok', partition: 'grok-web-session' },
  pixverse: { url: 'https://app.pixverse.ai/', title: 'PixVerse', partition: 'pixverse-web-session' },
};
const WEB_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CHROME_DEBUG_PORT = 9223;
const CHROME_CDP_HOST = `http://127.0.0.1:${CHROME_DEBUG_PORT}`;
const CHROME_USER_DATA_DIR = path.resolve(__dirname, '..', '.chrome-cdp-profile');
const CHALLENGE_RECOVERY_LIMIT = 2;
const challengeRecoveryAttempts = new Map();
let chromeProcess = null;
let showPipelineLog = false;
const APP_LOG_FILE = path.join(app.getPath('userData'), 'ai-video-pipeline.log');

async function appendAppLog(_event, entry = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    source: entry.source || 'renderer',
    kind: entry.kind || 'info',
    text: entry.text || '',
    details: entry.details || null,
  });
  await fs.mkdir(path.dirname(APP_LOG_FILE), { recursive: true }).catch(() => null);
  await fs.appendFile(APP_LOG_FILE, `${line}\n`, 'utf8').catch(() => null);
  return { ok: true, path: APP_LOG_FILE };
}

async function notifyRenderer(type, message, details = null) {
  await appendAppLog(null, { source: 'main', kind: 'notice', text: message, details: { type, details } });
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send('pipeline:notice', { type, message, details, ts: new Date().toISOString() });
  });
}

async function getAppLogPath() {
  await appendAppLog(null, { source: 'main', kind: 'info', text: 'Log path requested' });
  return APP_LOG_FILE;
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: 'AI Video Prompt Planner',
    backgroundColor: '#090b16',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function broadcastPipelineLogVisibility() {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send('view:pipeline-log-visible', showPipelineLog);
  });
}

function buildAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => dialog.showMessageBox({
            type: 'info',
            title: 'New Project',
            message: 'Đang phát triển',
            detail: `Dev sandbox: ${path.join(__dirname, '..', 'dev_sandbox_project_session')}`,
          }),
        },
        {
          label: 'Open Project...',
          accelerator: 'CmdOrCtrl+O',
          click: () => dialog.showMessageBox({
            type: 'info',
            title: 'Open Project',
            message: 'Đang phát triển',
            detail: `Dev sandbox: ${path.join(__dirname, '..', 'dev_sandbox_project_session')}`,
          }),
        },
        { type: 'separator' },
        { role: 'quit', label: 'Quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Reload' },
        { role: 'forceReload', label: 'Force Reload' },
        { role: 'toggleDevTools', label: 'Toggle Developer Tools' },
        { type: 'separator' },
        {
          label: 'Hiện log workflow',
          type: 'checkbox',
          checked: showPipelineLog,
          click: (item) => {
            showPipelineLog = Boolean(item.checked);
            broadcastPipelineLogVisibility();
          },
        },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Actual Size' },
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Toggle Full Screen' },
      ],
    },
    { role: 'windowMenu', label: 'Window' },
    { role: 'help', label: 'Help' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function getPipelineLogVisibility() {
  return showPipelineLog;
}

async function openWebLogin(_event, provider) {
  const normalizedProvider = normalizeWebProvider(provider);
  const targetUrl = PROVIDER_META[normalizedProvider]?.url || PROVIDER_META.chatgpt.url;
  const page = await getCdpPage(normalizedProvider, true);
  await recoverProviderFromCacheOrChallenge(page, normalizedProvider, 'open-login').catch(() => null);
  await page.Page.bringToFront().catch(() => null);
  await page.close().catch(() => null);
  return { ok: true, url: targetUrl, profilePath: CHROME_USER_DATA_DIR, port: CHROME_DEBUG_PORT };
}

function normalizeWebProvider(provider) {
  return ['grok', 'pixverse', 'chatgpt'].includes(provider) ? provider : 'chatgpt';
}

async function closeChromeDebug() {
  for (const win of webWindows.values()) {
    try { if (!win.isDestroyed()) win.close(); } catch (_error) {}
  }
  webWindows.clear();
  try {
    const tabs = await readJson(`${CHROME_CDP_HOST}/json/list`);
    await Promise.all((tabs || []).map((tab) => tab.id ? readJson(`${CHROME_CDP_HOST}/json/close/${tab.id}`).catch(() => null) : null));
  } catch (_error) {}
  if (chromeProcess?.pid) {
    try { process.kill(chromeProcess.pid); } catch (_error) {}
  }
  chromeProcess = null;
}

async function ensureChromeDebug(openUrl) {
  if (await isChromeDebugReady()) {
    return true;
  }

  await fs.mkdir(CHROME_USER_DATA_DIR, { recursive: true });
  const chromePath = findChromeExecutable();
  const args = [
    `--remote-debugging-port=${CHROME_DEBUG_PORT}`,
    `--user-data-dir=${CHROME_USER_DATA_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-popup-blocking',
    openUrl || 'about:blank',
  ];
  chromeProcess = spawn(chromePath, args, { detached: true, stdio: 'ignore', windowsHide: false });
  chromeProcess.unref();

  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    if (await isChromeDebugReady()) return true;
    await sleep(500);
  }
  throw new Error(`Không mở được Chrome debug ở port ${CHROME_DEBUG_PORT}. Hãy đóng Chrome debug cũ hoặc đổi port.`);
}

async function isChromeDebugReady() {
  try {
    const response = await fetch(`${CHROME_CDP_HOST}/json/version`);
    return response.ok;
  } catch (_error) {
    return false;
  }
}

async function openCdpTab(url) {
  const response = await fetch(`${CHROME_CDP_HOST}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!response.ok) {
    throw new Error(`Không mở được tab Chrome CDP: ${response.status}`);
  }
  return response.json();
}

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      require('fs').accessSync(candidate);
      return candidate;
    } catch (_error) {
      // try next candidate
    }
  }

  try {
    return execFileSync('where', ['chrome'], { encoding: 'utf8' }).split(/\r?\n/).find(Boolean);
  } catch (_error) {
    throw new Error('Không tìm thấy Chrome/Edge. Hãy cài Chrome hoặc set biến môi trường CHROME_PATH.');
  }
}
async function chooseFolder() {
  const result = await dialog.showOpenDialog({
    title: 'Chọn folder chứa video đã tạo',
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

async function scanFolder(_event, folderPath) {
  if (!folderPath) {
    return [];
  }

  const videos = [];
  const collectFromDir = async (dir, sceneHint = null) => {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const match = entry.name.match(/^scene[_-]?(\d+)/i);
        await collectFromDir(fullPath, match ? Number(match[1]) : sceneHint);
        continue;
      }
      if (!entry.isFile() || !VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      if (/^(master|final)_?video|^master_video$/i.test(path.basename(entry.name, path.extname(entry.name)))) continue;
      const stat = await fs.stat(fullPath);
      const sceneNumber = getSceneNumber(entry.name) ?? sceneHint;
      const keyframePath = sceneNumber
        ? path.join(path.dirname(fullPath), `scene_${String(sceneNumber).padStart(3, '0')}_keyframe.png`)
        : '';
      videos.push({
        name: entry.name,
        path: fullPath,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        sceneNumber,
        keyframePath: keyframePath && await pathExists(keyframePath) ? keyframePath : '',
      });
    }
  };

  await collectFromDir(folderPath);
  return videos.sort((a, b) => {
    const sceneA = a.sceneNumber ?? Number.MAX_SAFE_INTEGER;
    const sceneB = b.sceneNumber ?? Number.MAX_SAFE_INTEGER;
    if (sceneA !== sceneB) return sceneA - sceneB;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

function getSceneNumber(fileName) {
  const match = path.basename(fileName, path.extname(fileName)).match(/^\D*0*(\d+)/);
  return match ? Number(match[1]) : null;
}

async function extractLastFrame(_event, videoPath) {
  return extractLastFrameFromVideo(videoPath);
}

async function extractLastFrameFromVideo(videoPath) {
  if (!videoPath) {
    throw new Error('Thiếu đường dẫn video.');
  }

  const folder = path.dirname(videoPath);
  const baseName = path.basename(videoPath, path.extname(videoPath));
  const framesFolder = path.join(folder, '_last_frames');
  const outputPath = path.join(framesFolder, `${baseName}_last_frame.png`);

  await fs.mkdir(framesFolder, { recursive: true });
  await runFfmpeg([
    '-y',
    '-i', videoPath,
    '-vf', 'reverse',
    '-frames:v', '1',
    '-q:v', '2',
    outputPath,
  ]);

  return outputPath;
}

async function copyImageToClipboard(_event, imagePath) {
  if (!imagePath) {
    throw new Error('Thiếu đường dẫn ảnh.');
  }

  const image = nativeImage.createFromPath(imagePath);
  if (image.isEmpty()) {
    throw new Error('Không đọc được ảnh frame cuối.');
  }

  clipboard.writeImage(image);
  return true;
}

async function getPreviousFrame(_event, folderPath, currentSceneIndex) {
  const previousSceneIndex = Number(currentSceneIndex) - 1;
  if (!folderPath || previousSceneIndex < 1) {
    return null;
  }

  const videos = await scanFolder(null, folderPath);
  const previousVideo = videos.find((video) => video.sceneNumber === previousSceneIndex);
  if (!previousVideo) {
    return null;
  }

  const framePath = await extractLastFrameFromVideo(previousVideo.path);
  return {
    framePath,
    previousSceneIndex,
    videoName: previousVideo.name,
  };
}

async function mergeVideos(_event, folderPath) {
  if (!folderPath) {
    throw new Error('Chưa chọn folder video.');
  }

  const videos = (await scanFolder(null, folderPath))
    .filter((video) => video.sceneNumber !== null)
    .sort((a, b) => a.sceneNumber - b.sceneNumber);

  if (videos.length === 0) {
    throw new Error(`Folder chưa có video scene để merge hoặc tool chưa scan thấy video trong: ${folderPath}`);
  }

  const outputPath = path.join(folderPath, 'master_video.mp4');
  await mergeVideoFiles(videos, outputPath);

  return {
    outputPath,
    count: videos.length,
    videos,
  };
}

async function exportFinalVideo(_event, folderPath) {
  if (!folderPath) {
    throw new Error('Chưa chọn folder video.');
  }

  const videos = (await scanFolder(null, folderPath))
    .filter((video) => video.sceneNumber !== null)
    .sort((a, b) => a.sceneNumber - b.sceneNumber);

  if (videos.length === 0) {
    throw new Error('Folder chưa có video để xuất.');
  }

  const result = await dialog.showSaveDialog({
    title: 'Xuất video tổng',
    defaultPath: path.join(folderPath, 'final_video.mp4'),
    filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  await mergeVideoFiles(videos, result.filePath);
  return {
    outputPath: result.filePath,
    count: videos.length,
  };
}

async function mergeVideoFiles(videos, outputPath) {
  const listPath = path.join(path.dirname(outputPath), '_concat_list.txt');
  const listContent = videos
    .map((video) => `file '${video.path.replaceAll("'", "'\\''")}'`)
    .join('\n');

  await fs.writeFile(listPath, listContent, 'utf8');
  await runFfmpeg([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    outputPath,
  ]);
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const binaryPath = ffmpegPath || 'ffmpeg';
    const child = spawn(binaryPath, args, { windowsHide: true });
    let stderr = '';

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      reject(new Error(`Không chạy được FFmpeg bundled (${binaryPath}). ${error.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`FFmpeg lỗi code ${code}: ${stderr.slice(-1200)}`));
    });
  });
}

async function splitPromptWithAI(_event, options) {
  const {
    provider,
    apiKey,
    model,
    basePrompt,
    totalSegments,
    segmentSeconds,
    style,
    notes,
  } = options || {};

  if (!apiKey || !apiKey.trim()) {
    throw new Error('Chưa nhập API key.');
  }
  if (!basePrompt || !basePrompt.trim()) {
    throw new Error('Chưa nhập prompt tổng.');
  }

  const systemPrompt = `Bạn là biên kịch/đạo diễn video AI. Nhiệm vụ: tách prompt tổng thành các scene nối tiếp nhau, mỗi scene có nội dung riêng cụ thể, không lặp ý. Trả về JSON hợp lệ duy nhất, không markdown, không giải thích.`;
  const userPrompt = `Prompt tổng: ${basePrompt}\nSố scene cần tạo: ${totalSegments}\nThời lượng mỗi scene tối đa: ${segmentSeconds}s\nPhong cách: ${style || 'cinematic realistic'}\nGhi chú: ${notes || 'không có'}\n\nYêu cầu JSON:\n{\n  "beats": [\n    {\n      "title": "mục tiêu cảnh cụ thể",\n      "setting": "bối cảnh riêng, thời điểm/địa điểm cụ thể",\n      "subject": "chủ thể ở trạng thái riêng của scene",\n      "action": "hành động bắt buộc, cụ thể, khác scene trước",\n      "evolution": "ý nghĩa tiến triển/nhân quả của scene này",\n      "camera": "góc máy/chuyển động camera riêng",\n      "endFrame": "mô tả frame cuối sạch để nối scene sau, kèm trạng thái ánh sáng/exposure ổn định"\n    }\n  ]\n}\n\nQuy tắc bắt buộc:\n- beats.length đúng bằng ${totalSegments}.\n- Từ scene 2 trở đi phải phát triển từ scene trước nhưng không lặp cùng mô tả.\n- Mỗi scene phải có bối cảnh, hành động, chủ thể và frame cuối khác nhau.\n- Phải giữ continuity ánh sáng giữa frame cuối scene trước và frame đầu scene sau: không tăng sáng đột ngột, không auto-exposure, không đổi white balance/gamma/contrast ở điểm nối.\n- Nếu cần đổi ánh sáng vì nội dung scene, mô tả đổi rất chậm sau 1 giây hold đầu, không đổi ngay tại frame nối.\n- Ưu tiên tiếng Việt, giàu hình ảnh, dùng được ngay cho AI video.`;

  const text = await callAIProvider({ provider, apiKey, model, systemPrompt, userPrompt });
  const parsed = parseJsonFromModel(text);
  if (!Array.isArray(parsed.beats) || parsed.beats.length === 0) {
    throw new Error('Model không trả về beats hợp lệ.');
  }

  return parsed.beats.slice(0, Number(totalSegments)).map((beat, index) => ({
    title: String(beat.title || `Scene ${index + 1}`),
    setting: String(beat.setting || ''),
    subject: String(beat.subject || ''),
    action: String(beat.action || ''),
    evolution: String(beat.evolution || ''),
    camera: String(beat.camera || 'cinematic smooth camera'),
    endFrame: String(beat.endFrame || 'frame cuối sạch, rõ chủ thể để nối scene sau'),
  }));
}

async function callAIProvider({ provider, apiKey, model, systemPrompt, userPrompt }) {
  if (provider === 'gemini') {
    const geminiModel = model || 'gemini-1.5-flash';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
      }),
    });
    const data = await readJsonResponse(response);
    return data.candidates?.[0]?.content?.parts?.map((part) => part.text).join('\n') || '';
  }

  if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-haiku-latest',
        max_tokens: 4096,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    const data = await readJsonResponse(response);
    return data.content?.map((part) => part.text || '').join('\n') || '';
  }

  const baseUrl = provider === 'openrouter'
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : provider === 'ninerouter'
      ? 'http://localhost:20128/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(provider === 'openrouter' ? { 'HTTP-Referer': 'http://localhost', 'X-Title': 'AI Video Prompt Planner' } : {}),
    },
    body: JSON.stringify({
      model: model || (provider === 'openrouter' ? 'openai/gpt-4o-mini' : provider === 'ninerouter' ? 'cx/gpt-5.5' : 'gpt-4o-mini'),
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  const data = await readJsonResponse(response);
  return data.choices?.[0]?.message?.content || '';
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`API lỗi ${response.status}: ${text.slice(0, 600)}`);
  }
  return JSON.parse(text);
}

function parseJsonFromModel(text) {
  const trimmed = String(text || '').trim();
  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Model không trả về JSON.');
    }
    return JSON.parse(match[0]);
  }
}

async function generateScenePrompts(_event, options) {
  const {
    provider,
    apiKey,
    model,
    projectName,
    story,
    scene,
    durationSec,
    imageRules,
    motionRules,
    storyRules,
  } = options || {};

  if (!scene?.original) {
    throw new Error('Thiếu scene hiện tại.');
  }

  const localFallback = !apiKey || !apiKey.trim();
  if (localFallback) {
    return buildLocalScenePrompts({ projectName, story, scene, durationSec, imageRules, motionRules, storyRules });
  }

  const systemPrompt = 'Bạn là dashboard backend cho workflow sản xuất video AI. Trả về JSON hợp lệ duy nhất, không markdown, gồm imagePrompt và motionPrompt. Tuân thủ nghiêm file quy trình, prompt mẫu tạo ảnh keyframe và prompt mẫu motion 7 dòng.';
  const userPrompt = [
    `Project: ${projectName || 'Untitled'}`,
    `Global story context + character bible + continuity: ${story || ''}`,
    scene.previous ? `Previous scene: ${scene.previous}` : 'Previous scene: none',
    `Current scene ${scene.id}: ${scene.original}`,
    scene.next ? `Next scene: ${scene.next}` : 'Next scene: none',
    `Duration: ${durationSec || 10}s`,
    `Story rules:\n${storyRules || ''}`,
    `Image keyframe rules:\n${imageRules || ''}`,
    `Motion prompt rules:\n${motionRules || ''}`,
    'Yêu cầu output JSON:',
    '{ "imagePrompt": "prompt ảnh keyframe đầu scene", "motionPrompt": "prompt video 7 dòng" }',
    'imagePrompt phải dựng hiện trường đầu scene, 16:9, 8K live action, continuity 1-1, spatial lock.',
    'SAFETY BẮT BUỘC: nếu story có nhân vật trẻ em/cô bé/cậu bé/teen thì hãy chuyển thành người trưởng thành 25+ tuổi; tuyệt đối không mô tả trẻ em, học sinh, vị thành niên, teen, child, minor.',
    'motionPrompt phải đúng format 7 dòng, chỉ mô tả từ keyframe, có âm thanh diegetic, không nhạc, hành động hoàn tất 100%.',
  ].join('\n\n');

  const text = await callAIProvider({ provider, apiKey, model, systemPrompt, userPrompt });
  const parsed = parseJsonFromModel(text);
  return {
    imagePrompt: String(parsed.imagePrompt || '').trim(),
    motionPrompt: String(parsed.motionPrompt || '').trim(),
  };
}

function buildLocalScenePrompts({ projectName, story, scene, durationSec, imageRules, motionRules, storyRules }) {
  const imagePrompt = [
    `IMAGE PROMPT — SCENE ${scene.id} — KEYFRAME ĐẦU CẢNH`,
    `Project: ${projectName || 'Untitled'}`,
    `Global story context: ${story || ''}`,
    scene.previous ? `Scene trước để giữ continuity: ${scene.previous}` : 'Scene trước: không có, đây là cảnh mở đầu.',
    `Scene hiện tại: ${scene.original}`,
    scene.next ? `Scene sau để định hướng nối mạch: ${scene.next}` : 'Scene sau: không có hoặc chưa cần.',
    storyRules || '',
    imageRules || '',
    'SAFETY BẮT BUỘC: tất cả nhân vật phải là người trưởng thành 25+ tuổi. Nếu scene gốc nói cô bé/cậu bé/trẻ em/teen/học sinh/minor thì chuyển thành người trưởng thành 25+ tuổi, không dùng từ trẻ em/teen/minor trong prompt ảnh.',
    'OUTPUT: 1 ảnh duy nhất 16:9, 8K ultra-realistic live action. Dựng hiện trường ở khoảnh khắc chuẩn bị diễn hành động đầu tiên, wide/master shot, rõ vị trí nhân vật, đạo cụ, hướng chuyển động, ánh sáng mạnh trong trẻo, không text/logo/watermark.',
  ].filter(Boolean).join('\n\n');

  const motionPrompt = [
    `MOTION PROMPT — SCENE ${scene.id} — VIDEO ${durationSec || 10} GIÂY`,
    `Scene hiện tại: ${scene.original}`,
    motionRules || '',
    'DÒNG 1: TỔNG QUÁT KHUNG HÌNH: liệt kê chính xác nhân vật/đạo cụ/bối cảnh trong keyframe, chỉ mô tả tạo hình, không ghi tên riêng.',
    'DÒNG 2: NỘI DUNG VIDEO CHUYỂN ĐỘNG: bắt đầu từ đúng keyframe, mô tả 1 ý chính và tối đa 1-2 chuyển động chính theo chuỗi nhân quả, hành động hoàn tất 100%, chuyển động mạnh rõ nếu là cảnh kịch tính.',
    'DÒNG 3: CHUYỂN ĐỘNG PHỤ: mô tả môi trường, đạo cụ, phản ứng phụ đang có trong khung hình và không lạc bối cảnh.',
    'DÒNG 4: ÂM THANH: chỉ foley + âm thanh môi trường + tiếng nhân vật/động vật nếu có, không nhạc nền; MỌI ÂM THANH NỀN Ở BỐI CẢNH VIDEO VÀ MỌI VẬT THỂ đang chuyển động TRONG VIDEO Bắt buộc TẠO ÂM THANH VIDEO PHẢI TO VÀ RÕ RÀNG NHƯ ĐANG BẬT FULL 100% VOLUME LOA.',
    'DÒNG 5: VIDEO TẠO RA ĐÃ ĐẠT ĐƯỢC TẤT CẢ CÁC YÊU CẦU, diễn xuất đúng prompt, mọi chuyển động mượt như phim live action, không chi tiết giả tạo, tuân theo vật lý đời thực, không sáng tạo thêm ngoài prompt.',
    'DÒNG 6: Technical Specifications: 8K ultra-realistic, extreme sharp details, real-world gravity, authentic cloth and fur simulation, consistent powerful natural daylight, high dynamic range (HDR), hyper-smooth 240 FPS motion, organic motion blur only where physically correct. Live action cinematic quality, razor-sharp, true-to-life textures.',
    'DÒNG 7: Negative Prompt: low quality, blurry, out of focus, temporal artifacts, noisy, grainy, inconsistent face, inconsistent clothing, foot skating, sliding, teleporting props, disappearing objects, readable text, subtitles, watermark, logo, cartoon, anime, CGI skin, random stopping, sudden jump cuts, night time, sunset, low light, NO background music, NO cinematic music, NO soundtrack, NO added music, NO score, NO dramatic music, NO film music, NO MUSIC, dialogue, NO SLOW MOTION.',
  ].filter(Boolean).join('\n\n');

  return { imagePrompt, motionPrompt };
}

async function chooseOutputFolder() {
  const result = await dialog.showOpenDialog({
    title: 'Chọn folder lưu kết quả prompt web',
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
}

async function checkWebLogin(_event, provider) {
  const normalizedProvider = normalizeWebProvider(provider);
  const page = await getCdpPage(normalizedProvider, true);
  await page.Page.bringToFront().catch(() => null);
  let state = { loggedIn: false };
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    state = await evaluateOnCdpPage(page, `(${detectLoginScript.toString()})(${JSON.stringify(normalizedProvider)})`).catch((error) => ({ loggedIn: false, reason: error.message }));
    if (state.loggedIn) break;
    await sleep(1500);
  }
  
  if (!state.loggedIn && shouldRecoverFromCacheOrChallenge(state, normalizedProvider)) {
    const recovery = await recoverProviderFromCacheOrChallenge(page, normalizedProvider, 'check-login');
    state = await evaluateOnCdpPage(page, `(${detectLoginScript.toString()})(${JSON.stringify(normalizedProvider)})`).catch((error) => ({ loggedIn: false, reason: error.message }));
    state.cacheRecovery = recovery;
  }
  await appendAppLog(null, { source: 'main', kind: state.loggedIn ? 'ok' : 'error', text: `Login check ${normalizedProvider}: ${state.loggedIn ? 'logged in' : 'not logged in'} (${state.reason || state.title || state.url || ''})`, details: state });
  const capability = ['grok', 'pixverse'].includes(normalizedProvider)
    ? await evaluateOnCdpPage(page, `(${detectVideoCapabilityScript.toString()})(${JSON.stringify(normalizedProvider)})`).catch((error) => ({ ok: false, error: error.message }))
    : null;
  await page.close().catch(() => null);
  return { ...state, capability, cdp: true, port: CHROME_DEBUG_PORT, profilePath: CHROME_USER_DATA_DIR };
}

async function sendPromptViaWeb(_event, options) {
  const {
    provider,
    prompt,
    outputFolder,
    projectName = 'project',
    sceneId = 'scene',
    promptKind = 'prompt',
  } = options || {};

  if (!prompt?.trim()) {
    throw new Error('Prompt rỗng, không thể gửi.');
  }
  if (!outputFolder) {
    throw new Error('Chưa chọn folder lưu kết quả.');
  }

  const normalizedProvider = normalizeWebProvider(provider);
  const page = await getCdpPage(normalizedProvider, true);
  const loginState = await evaluateOnCdpPage(page, `(${detectLoginScript.toString()})(${JSON.stringify(normalizedProvider)})`);
  if (!loginState.loggedIn) {
    throw new Error(`${PROVIDER_META[normalizedProvider].title} chưa đăng nhập trong Chrome debug. Hãy login ở cửa sổ Chrome vừa mở rồi chạy lại.`);
  }

  const beforeCount = await evaluateOnCdpPage(page, `(${countAssistantMessagesScript.toString()})()`);
  const sent = await sendPromptViaCdpInput(page, prompt);
  if (!sent.ok) {
    throw new Error(sent.error || 'Không tìm thấy ô nhập hoặc nút Send trong Chrome.');
  }

  const responseText = await waitForCdpAssistantResponse(page, beforeCount);
  await fs.mkdir(outputFolder, { recursive: true });
  const baseName = sanitizeFileName(`${projectName}_scene-${sceneId}_${promptKind}_${normalizedProvider}`);
  const promptPath = path.join(outputFolder, `${baseName}_prompt.txt`);
  const responsePath = path.join(outputFolder, `${baseName}_response.txt`);
  await fs.writeFile(promptPath, prompt, 'utf8');
  await fs.writeFile(responsePath, responseText, 'utf8');
  return { responseText, promptPath, responsePath, cdp: true };
}

async function runScenePipeline(_event, options) {
  const {
    projectName = 'project',
    outputFolder,
    sceneId,
    imagePrompt,
  } = options || {};
  let motionPrompt = options.motionPrompt || '';

  if (!outputFolder) throw new Error('Chưa chọn folder output.');
  if (!imagePrompt?.trim()) throw new Error('Thiếu image prompt.');

  const projectDir = path.join(outputFolder, sanitizeFileName(projectName));
  const sceneDir = path.join(projectDir, `scene_${String(sceneId).padStart(3, '0')}`);
  await fs.mkdir(sceneDir, { recursive: true });
  await fs.writeFile(path.join(sceneDir, 'image_prompt.txt'), imagePrompt, 'utf8');

  const videoProvider = normalizeVideoProvider(options.videoProvider);
  const videoConfig = options.videoConfig || {};
  let imagePath = options.imagePath || '';
  if (imagePath && !(await pathExists(imagePath))) imagePath = '';
  const expectedImagePath = path.join(sceneDir, `scene_${String(sceneId).padStart(3, '0')}_keyframe.png`);
  if (!imagePath && !options.forceRegenerateImage && await pathExists(expectedImagePath)) {
    imagePath = expectedImagePath;
  }
  
  if (!imagePath) {
    const chatGptResult = await generateImageAndMotionWithChatGPT({ imagePrompt, sceneDir, sceneId });
    imagePath = chatGptResult.imagePath;
    if (chatGptResult.motionPrompt) {
      motionPrompt = chatGptResult.motionPrompt;
    }
    if (motionPrompt) {
      await fs.writeFile(path.join(sceneDir, 'motion_prompt.txt'), motionPrompt, 'utf8');
    }
    return {
      sceneDir,
      phase: 'image',
      imagePath,
      imageDataUrl: imagePath ? await imageFileToDataUrl(imagePath).catch(() => '') : '',
      motionPrompt,
      videoPath: '',
      videoProvider,
      videoStatus: 'waiting-image-review',
    };
  }

  if (!motionPrompt?.trim()) throw new Error('Thiếu motion prompt để tiếp tục chạy tạo video.');
  await fs.writeFile(path.join(sceneDir, 'motion_prompt.txt'), motionPrompt, 'utf8');

  const existingVideoPath = path.join(sceneDir, `scene_${String(sceneId).padStart(3, '0')}_video.mp4`);
  if (!options.forceRegenerateVideo && await pathExists(existingVideoPath)) {
    await appendAppLog(null, { source: 'main', kind: 'ok', text: `Scene ${sceneId}: đã có video sẵn, bỏ qua tạo lại Grok.`, details: { existingVideoPath } });
    return {
      sceneDir,
      phase: 'video',
      imagePath,
      imageDataUrl: imagePath ? await imageFileToDataUrl(imagePath).catch(() => '') : '',
      videoPath: existingVideoPath,
      videoProvider,
      videoStatus: 'existing-video-skip-regenerate',
      motionPrompt,
    };
  }

  let videoResult = null;
  let videoError = '';
  try {
    videoResult = await generateVideoWithProvider({ provider: videoProvider, imagePath, motionPrompt, sceneDir, sceneId, videoConfig });
  } catch (error) {
    videoError = error.stack || error.message || String(error);
    await fs.writeFile(path.join(sceneDir, 'grok_video_error.txt'), videoError, 'utf8');
    await appendAppLog(null, { source: 'main', kind: 'error', text: `Scene ${sceneId}: lỗi tạo video ${videoProvider}: ${error.message || error}`, details: { imagePath, motionPrompt: motionPrompt.slice(0, 500) } });
  }

  return {
    sceneDir,
    phase: 'video',
    imagePath,
    imageDataUrl: imagePath ? await imageFileToDataUrl(imagePath).catch(() => '') : '',
    videoPath: videoResult?.videoPath || '',
    videoProvider,
    videoStatus: videoResult?.status || (videoError ? `error: ${videoError.split('\n')[0]}` : 'pending-selector-or-manual-download'),
    videoError,
  };
}

async function generateImageAndMotionWithChatGPT({ imagePrompt, sceneDir, sceneId }) {
  const page = await getCdpPage('chatgpt', true);
  const loginState = await evaluateOnCdpPage(page, `(${detectLoginScript.toString()})('chatgpt')`);
  if (!loginState.loggedIn) {
    await page.close();
    throw new Error(`ChatGPT chưa đăng nhập. Hãy đăng nhập ChatGPT trong Chrome debug rồi chạy lại. Chi tiết: ${loginState.reason || loginState.url || ''}`);
  }

  const imageInstruction = [
    'Tạo 1 ảnh duy nhất theo prompt dưới đây. Không trả lời bằng text dài. Nếu có thể, hãy render/generate image trực tiếp.',
    imagePrompt,
  ].join('\n\n');
  const beforeImages = await evaluateOnCdpPage(page, `(${collectGeneratedImageUrlsScript.toString()})()`);
  const restoredFrames = await restoreProjectKeyframesToChatGPT(page, sceneDir, sceneId);
  await appendAppLog(null, { source: 'main', kind: restoredFrames?.count ? 'ok' : 'running', text: `Scene ${sceneId}: đã add keyframe scene trước vào ChatGPT: ${restoredFrames?.count || 0} ảnh`, details: restoredFrames });
  await evaluateOnCdpPage(page, `(${prepareChatGptCreateImageScript.toString()})()`).catch(() => null);
  await sleep(800);
  const sentImage = await sendPromptViaCdpInput(page, imageInstruction);
  if (!sentImage.ok) throw new Error(sentImage.error || 'Không gửi được image prompt vào ChatGPT.');
  const imagePath = path.join(sceneDir, `scene_${String(sceneId).padStart(3, '0')}_keyframe.png`);
  const imageUrl = await waitForChatGptImageOrRetry(page, beforeImages?.urls || [], imageInstruction, sceneDir, sceneId);
  try {
    if (imageUrl && imageUrl.startsWith('chatgpt-custom-box-y')) {
      await captureLatestImageElement(page, imagePath);
    } else {
      await downloadBrowserAsset(page, imageUrl, imagePath);
    }
  } catch (error) {
    await fs.writeFile(path.join(sceneDir, 'image_url_download_error.txt'), error.stack || error.message, 'utf8');
    throw new Error(`Đã thấy ảnh ChatGPT nhưng tải file lỗi: ${error.message}`);
  }

  let generatedMotionPrompt = '';

  await page.close();
  return { imagePath, motionPrompt: generatedMotionPrompt };
}

function normalizeVideoProvider(provider) {
  return provider === 'pixverse' ? 'pixverse' : 'grok';
}

async function generateVideoWithProvider({ provider, imagePath, motionPrompt, sceneDir, sceneId, videoConfig = {} }) {
  if (provider === 'pixverse') {
    return generateVideoWithGenericProvider({ provider: 'pixverse', imagePath, motionPrompt, sceneDir, sceneId, config: videoConfig.pixverse || {} });
  }
  return generateVideoWithGenericProvider({ provider: 'grok', imagePath, motionPrompt, sceneDir, sceneId, config: videoConfig.grok || {} });
}

async function waitForGrokImagineReady(page, sceneId = '') {
  const startedAt = Date.now();
  let lastState = null;
  while (Date.now() - startedAt < 20000) {
    lastState = await evaluateOnCdpPage(page, `(${getGrokReadyStateScript.toString()})()`).catch((error) => ({ ready: false, error: error.message }));
    if (lastState?.ready) {
      await appendAppLog(null, { source: 'main', kind: 'ok', text: `Scene ${sceneId}: Grok Imagine đã load xong, bắt đầu kiểm tra/upload.`, details: lastState });
      return lastState;
    }
    await sleep(1000);
  }
  await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: Grok load chậm, vẫn tiếp tục sau timeout 20s.`, details: lastState });
  return lastState;
}

async function closeGrokTemplateModal(page, sceneId = '') {
  await page.Page.bringToFront().catch(() => null);
  await sleep(300);
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const scan = await evaluateOnCdpPage(page, `(${scanGrokTemplateModalScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
    if (scan?.open) {
      await appendAppLog(null, {
        source: 'main',
        kind: 'running',
        text: `Scene ${sceneId}: phát hiện bảng template Grok, ưu tiên bấm X/ẩn bảng thay vì chọn template.`,
        details: { scan },
      });
    }

    await page.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }).catch(() => null);
    await page.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }).catch(() => null);
    await sleep(250);
    const state = await evaluateOnCdpPage(page, `(${closeGrokTemplateModalScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
    if (state?.ok && state?.box) {
      const x = state.box.x + state.box.width / 2;
      const y = state.box.y + state.box.height / 2;
      await page.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y, button: 'none' }).catch(() => null);
      await page.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 }).catch(() => null);
      await page.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }).catch(() => null);
      await sleep(700);
    }
    const after = await evaluateOnCdpPage(page, `(${detectGrokTemplateModalScript.toString()})()`).catch(() => ({ open: false }));
    if (!after?.open) {
      if (state?.ok) await appendAppLog(null, { source: 'main', kind: 'ok', text: `Scene ${sceneId}: đã tắt bảng template Grok bằng nút X.`, details: state });
      return { ok: true, closed: Boolean(state?.ok), state };
    }
    const viewportFallback = await evaluateOnCdpPage(page, `(${getGrokTemplateViewportFallbackPointsScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
    if (viewportFallback?.ok) {
      for (const point of viewportFallback.points || []) {
        await page.Input.dispatchMouseEvent({ type: 'mouseMoved', x: point.x, y: point.y, button: 'none' }).catch(() => null);
        await page.Input.dispatchMouseEvent({ type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 }).catch(() => null);
        await page.Input.dispatchMouseEvent({ type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 }).catch(() => null);
        await sleep(900);
        const afterFallback = await evaluateOnCdpPage(page, `(${detectGrokTemplateModalScript.toString()})()`).catch(() => ({ open: false }));
        await appendAppLog(null, {
          source: 'main',
          kind: afterFallback?.open ? 'running' : 'ok',
          text: `Scene ${sceneId}: Grok fallback click ${point.name} tại (${Math.round(point.x)}, ${Math.round(point.y)}) -> ${afterFallback?.open ? 'popup vẫn còn' : 'popup đã đổi/tắt'}`,
          details: { viewportFallback, point, afterFallback },
        });
        if (!afterFallback?.open) return { ok: true, fallbackPoint: point };
      }
    }
    await sleep(500);
  }
  const forceHidden = await evaluateOnCdpPage(page, `(${forceHideGrokTemplateModalScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
  await sleep(500);
  const finalState = await evaluateOnCdpPage(page, `(${detectGrokTemplateModalScript.toString()})()`).catch(() => ({ open: true }));
  await appendAppLog(null, {
    source: 'main',
    kind: forceHidden?.ok && !finalState?.open ? 'ok' : 'running',
    text: forceHidden?.ok && !finalState?.open
      ? `Scene ${sceneId}: đã ẩn cưỡng bức bảng template Grok để tiếp tục upload.`
      : `Scene ${sceneId}: bảng template Grok vẫn còn; đã thử chọn Photo → Video, bấm X và ẩn cưỡng bức.`,
    details: { forceHidden, finalState },
  });
  return { ok: !finalState?.open || Boolean(forceHidden?.ok), state: finalState, forceHidden };
}

async function detectLoginWithRetry(page, provider, sceneId = '') {
  let lastState = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await waitForCdpLoad(page).catch(() => null);
    lastState = await evaluateOnCdpPage(page, `(${detectLoginScript.toString()})(${JSON.stringify(provider)})`).catch((error) => ({ loggedIn: false, reason: error.message }));
    await appendAppLog(null, {
      source: 'main',
      kind: lastState?.loggedIn ? 'ok' : 'running',
      text: `Scene ${sceneId}: check login ${PROVIDER_META[provider]?.title || provider} lần ${attempt}/3: ${lastState?.loggedIn ? 'đã login' : 'chưa sẵn sàng'}`,
      details: lastState,
    });
    if (lastState?.loggedIn) return lastState;
    if (shouldRecoverFromCacheOrChallenge(lastState, provider)) {
      const recovery = await recoverProviderFromCacheOrChallenge(page, provider, `scene-${sceneId || 'unknown'}-login-attempt-${attempt}`).catch((error) => ({ ok: false, error: error.message }));
      lastState = { ...lastState, cacheRecovery: recovery };
      if (recovery?.ok) continue;
    }
    await sleep(attempt === 1 ? 2500 : 4000);
  }
  return lastState;
}

async function generateVideoWithGenericProvider({ provider, imagePath, motionPrompt, sceneDir, sceneId, config = {} }) {
  const page = await getCdpPage(provider, true);
  const loginState = await detectLoginWithRetry(page, provider, sceneId);
  const title = PROVIDER_META[provider]?.title || provider;
  if (!loginState.loggedIn) {
    await page.close();
    throw new Error(`${title} chưa đăng nhập. Hãy đăng nhập trong tab ${title}, xong rồi chạy lại. Chi tiết: ${loginState.reason || loginState.url || ''}`);
  }

  if (provider === 'grok') {
    await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: dùng Grok Imagine canvas hiện tại hoặc tạo mới nếu chưa có.` });
    const canvasState = await ensureGrokEmptyCanvas(page, sceneId, false);
    await appendAppLog(null, { source: 'main', kind: canvasState?.ok ? 'ok' : 'error', text: `Grok canvas scene ${sceneId}: ${canvasState?.status === 'reuse-current-canvas' ? 'dùng lại canvas hiện tại' : canvasState?.ok ? 'đã vào canvas' : canvasState?.error || 'chưa vào canvas'}`, details: canvasState });
    if (!canvasState?.ok) throw new Error(canvasState?.error || 'Không mở được Grok Empty Canvas.');
    await clearGrokCanvasChat(page, sceneId);
    await sleep(1200);
  }

  const capability = await evaluateOnCdpPage(page, `(${detectVideoCapabilityScript.toString()})(${JSON.stringify(provider)})`);
  if (!capability?.ok) {
    await page.close();
    throw new Error(capability?.error || `${title} account này chưa có feature tạo video/upload ảnh. Hãy đổi account/plan rồi chạy lại.`);
  }

  if (provider === 'pixverse') {
    await evaluateOnCdpPage(page, `(${preparePixVerseComposerScript.toString()})(${JSON.stringify(config)})`);
    await sleep(800);
  } else if (provider === 'grok') {
    const canvasState = await ensureGrokEmptyCanvas(page, sceneId, false);
    if (!canvasState?.ok) throw new Error(canvasState?.error || 'Grok không còn ở Empty Canvas trước khi upload.');
    if (canvasState?.status !== 'reuse-current-canvas') {
      const restored = await restoreExistingProjectVideosToGrokCanvas(page, sceneDir, sceneId);
      await appendAppLog(null, { source: 'main', kind: restored?.count ? 'ok' : 'running', text: `Scene ${sceneId}: restore video cũ vào Grok canvas: ${restored?.count || 0} file`, details: restored });
    }
    await clearGrokCanvasChat(page, sceneId);
    await sleep(600);
  }

  await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: bắt đầu upload ảnh vào ${title}.`, details: { imagePath } });
  const uploadResult = await uploadFileViaCdp(page, imagePath, provider);
  if (!uploadResult.ok) {
    throw new Error(uploadResult.error || `Không upload được ảnh vào ${title}.`);
  }

  await appendAppLog(null, { source: 'main', kind: 'ok', text: `Scene ${sceneId}: ${title} đã nhận ảnh upload.`, details: uploadResult });
  if (provider === 'grok') {
    const settled = await waitForGrokUploadSettled(page, sceneId);
    await appendAppLog(null, { source: 'main', kind: settled?.ok ? 'ok' : 'running', text: `Scene ${sceneId}: Grok upload keyframe ${settled?.ok ? 'đã xong' : 'chưa xác nhận xong'}`, details: settled });
    await clearGrokCanvasSelection(page).catch(() => null);
  }

  const beforeVideos = await evaluateOnCdpPage(page, `(${collectVideoUrlsScript.toString()})()`);
  await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: bắt đầu paste prompt vào ${title}.` });
  const sent = provider === 'pixverse'
    ? await submitPixVersePrompt(page, motionPrompt, config)
    : provider === 'grok'
      ? await submitGrokVideoPrompt(page, motionPrompt, config)
      : await sendPromptViaCdpInput(page, motionPrompt);
  if (!sent.ok) throw new Error(sent.error || `Không gửi được motion prompt vào ${title}.`);
  await appendAppLog(null, { source: 'main', kind: 'ok', text: `Scene ${sceneId}: đã gửi prompt vào ${title}.`, details: sent });
  if (provider === 'grok') {
    const confirmed = await confirmGrokVideoGenerationIfAsked(page, sceneId);
    if (confirmed?.ok) {
      await appendAppLog(null, { source: 'main', kind: 'ok', text: `Scene ${sceneId}: Grok hỏi xác nhận, đã gửi lệnh tạo video.`, details: confirmed });
    }
  }

  const videoUrl = await waitForNewVideoUrl(page, beforeVideos?.urls || [], { provider, sceneId, sceneDir, imagePath, motionPrompt }).catch(() => '');
  if (!videoUrl) {
    await page.close();
    return { status: `${provider}-sent-await-manual-download` };
  }

  const videoPath = path.join(sceneDir, `scene_${String(sceneId).padStart(3, '0')}_video.mp4`);
  const downloaded = await downloadBrowserAsset(page, videoUrl, videoPath).then(
    () => ({ ok: true }),
    (error) => ({ ok: false, error: error.message }),
  );
  if (!downloaded.ok) {
    await appendAppLog(null, {
      source: 'main',
      kind: 'running',
      text: `Scene ${sceneId}: ${title} đã tạo video nhưng chưa tải tự động được, cần tải thủ công từ tab Grok.`,
      details: { videoUrl, videoPath, error: downloaded.error },
    });
    await page.close();
    return { status: `${provider}-generated-manual-download`, videoUrl, error: downloaded.error };
  }
  await page.close();
  return { status: 'video-downloaded', videoPath };
}

async function getCdpPage(provider, createIfMissing = true) {
  await ensureChromeDebug();
  const meta = PROVIDER_META[provider] || PROVIDER_META.chatgpt;
  const hostname = new URL(meta.url).hostname;
  const targets = await CDP.List({ host: '127.0.0.1', port: CHROME_DEBUG_PORT });
  const providerTargets = targets
    .filter((target) => target.type === 'page')
    .filter((target) => target.url?.includes(hostname));

  let target = null;
  for (const candidate of providerTargets) {
    const probe = await CDP({ target: candidate, host: '127.0.0.1', port: CHROME_DEBUG_PORT }).catch(() => null);
    if (!probe) continue;
    await probe.Runtime.enable().catch(() => null);
    const state = await evaluateOnCdpPage(probe, `(${detectLoginScript.toString()})(${JSON.stringify(provider)})`).catch(() => null);
    await probe.close().catch(() => null);
    if (state?.loggedIn || state?.hasComposer || state?.hasAppShell) {
      target = candidate;
      break;
    }
  }

  target = target || providerTargets.find((candidate) => !candidate.url?.startsWith('about:blank'));
  target = target || (createIfMissing ? await openCdpTab(meta.url) : null);
  if (!target) {
    throw new Error(`Không tìm thấy tab ${meta.title}.`);
  }

  const client = await CDP({ target, host: '127.0.0.1', port: CHROME_DEBUG_PORT });
  await client.Page.enable();
  await client.Runtime.enable();
  await client.DOM.enable();
  await client.Network.enable().catch(() => null);
  await client.Page.bringToFront().catch(() => null);
  await waitForCdpLoad(client);
  await recoverProviderFromCacheOrChallenge(client, provider, 'get-page').catch(() => null);
  return client;
}

async function waitForCdpLoad(client) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    const readyState = await evaluateOnCdpPage(client, 'document.readyState').catch(() => 'loading');
    if (readyState === 'complete' || readyState === 'interactive') return;
    await sleep(500);
  }
}

async function evaluateOnCdpPage(client, expression) {
  const result = await client.Runtime.evaluate({
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'CDP evaluate lỗi.');
  }
  return result.result?.value;
}

function shouldRecoverFromCacheOrChallenge(state, provider) {
  if (provider !== 'grok') return false;
  const haystack = `${state?.reason || ''}\n${state?.title || ''}\n${state?.url || ''}\n${state?.sampleText || ''}`;
  return /cloudflare|security verification|verify you are human|just a moment|checking if the site connection|challenge|ray id|grok\.com\s+performing security/i.test(haystack);
}

async function ensureGrokEmptyCanvas(page, sceneId = '', forceNew = false) {
  await page.Page.bringToFront().catch(() => null);
  const current = await evaluateOnCdpPage(page, `({ path: location.pathname.toLowerCase(), url: location.href })`).catch(() => ({ path: '' }));
  if (!forceNew && current?.path?.includes('/imagine/agent/') && current.path.length > '/imagine/agent/'.length) {
    return { ok: true, isAgentCanvas: true, status: 'reuse-current-canvas', url: current.url };
  }
  await page.Page.navigate({ url: 'https://grok.com/imagine/agent' }).catch(() => null);
  await waitForCdpLoad(page).catch(() => null);
  await sleep(1800);
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const state = await evaluateOnCdpPage(page, `(${prepareGrokVideoComposerScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
    await appendAppLog(null, { source: 'main', kind: state?.ok ? 'ok' : 'running', text: `Scene ${sceneId}: Empty Canvas attempt ${attempt}: ${state?.status || state?.error || ''}`, details: state });
    if (state?.ok && state?.isAgentCanvas) return { ...state, forceNew };
    if (state?.emptyCanvasBox) {
      const x = state.emptyCanvasBox.x + state.emptyCanvasBox.width / 2;
      const y = state.emptyCanvasBox.y + state.emptyCanvasBox.height / 2;
      await page.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y, button: 'none' }).catch(() => null);
      await page.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 }).catch(() => null);
      await page.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }).catch(() => null);
      await waitForCdpLoad(page).catch(() => null);
    }
    await sleep(1200);
  }
  const finalState = await evaluateOnCdpPage(page, `({ url: location.href, text: document.body?.innerText?.slice(0, 1000) || '' })`).catch((error) => ({ error: error.message }));
  return { ok: false, error: 'Không vào được Grok Empty Canvas; đang ở dashboard/template nên không gửi prompt để tránh bấm Create Worlds.', finalState };
}

async function collectExistingProjectVideos(sceneDir, currentSceneId = 0) {
  const projectDir = path.dirname(sceneDir);
  const entries = await fs.readdir(projectDir, { withFileTypes: true }).catch(() => []);
  const videos = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^scene_(\d+)/i);
    if (!match) continue;
    const sceneNo = Number(match[1]);
    if (!sceneNo || sceneNo >= Number(currentSceneId || 0)) continue;
    const dir = path.join(projectDir, entry.name);
    const files = await fs.readdir(dir).catch(() => []);
    for (const file of files) {
      if (!/\.(mp4|webm|mov)$/i.test(file)) continue;
      if (!/video|generated|grok|pixverse/i.test(file)) continue;
      videos.push({ sceneNo, path: path.join(dir, file), file });
    }
  }
  return videos.sort((a, b) => a.sceneNo - b.sceneNo || a.file.localeCompare(b.file));
}

async function restoreExistingProjectVideosToGrokCanvas(page, sceneDir, sceneId = 0) {
  const videos = await collectExistingProjectVideos(sceneDir, sceneId);
  const restored = [];
  for (const item of videos) {
    const result = await addMediaFileToGrokCanvas(page, item.path, 'video').catch((error) => ({ ok: false, error: error.message }));
    restored.push({ ...item, result });
    await sleep(1200);
  }
  return { ok: true, count: restored.filter((item) => item.result?.ok).length, total: videos.length, restored };
}

async function collectProjectKeyframes(sceneDir, currentSceneId = 0, includeCurrent = false) {
  const projectDir = path.dirname(sceneDir);
  const entries = await fs.readdir(projectDir, { withFileTypes: true }).catch(() => []);
  const frames = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^scene_(\d+)/i);
    if (!match) continue;
    const sceneNo = Number(match[1]);
    if (!sceneNo || sceneNo > Number(currentSceneId || 0) || (!includeCurrent && sceneNo === Number(currentSceneId || 0))) continue;
    const keyframe = path.join(projectDir, entry.name, `scene_${String(sceneNo).padStart(3, '0')}_keyframe.png`);
    if (await pathExists(keyframe)) frames.push({ sceneNo, path: keyframe, file: path.basename(keyframe) });
  }
  return frames.sort((a, b) => a.sceneNo - b.sceneNo);
}

async function restoreProjectKeyframesToGrokCanvas(page, sceneDir, sceneId = 0, includeCurrent = false) {
  const frames = await collectProjectKeyframes(sceneDir, sceneId, includeCurrent);
  const restored = [];
  for (const item of frames) {
    const result = await addMediaFileToGrokCanvas(page, item.path, 'image').catch((error) => ({ ok: false, error: error.message }));
    restored.push({ ...item, result });
    await sleep(900);
  }
  return { ok: true, count: restored.filter((item) => item.result?.ok).length, total: frames.length, restored };
}

async function restoreProjectKeyframesToChatGPT(page, sceneDir, sceneId = 0) {
  const frames = await collectProjectKeyframes(sceneDir, sceneId, false);
  const restored = [];
  for (const item of frames) {
    const result = await uploadFileViaCdp(page, item.path, 'chatgpt').catch((error) => ({ ok: false, error: error.message }));
    restored.push({ ...item, result });
    await sleep(1000);
  }
  return { ok: true, count: restored.filter((item) => item.result?.ok).length, total: frames.length, restored };
}

async function waitForGrokUploadSettled(page, sceneId = '') {
  const started = Date.now();
  while (Date.now() - started < 90000) {
    const state = await evaluateOnCdpPage(page, `(${detectGrokUploadStateScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
    if (state?.ok && !state.uploading) return { ok: true, sceneId, state };
    await sleep(1500);
  }
  return { ok: false, sceneId, error: 'timeout-waiting-upload-settled' };
}

async function clearGrokCanvasSelection(page) {
  await page.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }).catch(() => null);
  await page.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }).catch(() => null);
  await sleep(250);
  await evaluateOnCdpPage(page, `(${clickGrokComposerAreaScript.toString()})()`).catch(() => null);
  await sleep(250);
}

async function recoverGrokCanvasAfterLimit(page, options = {}) {
  const sceneId = options.sceneId || '';
  const sceneDir = options.sceneDir;
  await ensureGrokEmptyCanvas(page, sceneId, true);
  const videos = await restoreExistingProjectVideosToGrokCanvas(page, sceneDir, sceneId);
  const keyframes = await restoreProjectKeyframesToGrokCanvas(page, sceneDir, sceneId, true);
  await clearGrokCanvasChat(page, sceneId);
  const uploadCurrent = await uploadFileViaCdp(page, options.imagePath, 'grok');
  if (!uploadCurrent?.ok) throw new Error(uploadCurrent?.error || 'Không upload lại keyframe scene hiện tại sau limit.');
  const beforeVideos = await evaluateOnCdpPage(page, `(${collectVideoUrlsScript.toString()})()`).catch(() => ({ urls: [] }));
  const sent = await submitGrokVideoPrompt(page, options.motionPrompt, {});
  if (!sent?.ok) throw new Error(sent?.error || 'Không gửi lại motion prompt sau limit.');
  const confirmed = await confirmGrokVideoGenerationIfAsked(page, sceneId);
  return { ok: true, videos, keyframes, uploadCurrent, beforeVideos, sent, confirmed };
}

async function addMediaFileToGrokCanvas(client, filePath, mediaType = 'image') {
  const uploadClick = await clickGrokUploadAndChooseFile(client, filePath);
  if (!uploadClick?.ok) return uploadClick;
  const accepted = await waitForGrokUploadedAsset(client, mediaType === 'video' ? 60000 : 45000);
  return accepted?.ok ? { ok: true, uploadClick, accepted } : { ok: false, error: accepted?.error || 'Grok chưa nhận media.', uploadClick, accepted };
}

async function labelGrokCanvas(page, sceneId = '', sceneDir = '') {
  const label = `SCENE ${String(sceneId).padStart(3, '0')} · ${path.basename(sceneDir || '') || 'video'}`;
  const state = await evaluateOnCdpPage(page, `(${labelGrokCanvasScript.toString()})(${JSON.stringify(label)})`).catch((error) => ({ ok: false, error: error.message }));
  await appendAppLog(null, { source: 'main', kind: state?.ok ? 'ok' : 'running', text: `Scene ${sceneId}: đặt tên Grok canvas: ${state?.ok ? label : state?.error || 'skip'}`, details: state });
  await sleep(500);
  return state;
}

async function clearGrokCanvasChat(page, sceneId = '') {
  const state = await evaluateOnCdpPage(page, `(${clearGrokCanvasChatScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
  await appendAppLog(null, { source: 'main', kind: state?.ok ? 'ok' : 'running', text: `Scene ${sceneId}: Grok clear chat panel: ${state?.ok ? state.mode : state?.error || 'skip'}`, details: state });
  await sleep(800);
  return state;
}

async function confirmGrokVideoGenerationIfAsked(page, sceneId = '') {
  await sleep(5000);
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const state = await evaluateOnCdpPage(page, `(${detectGrokConfirmationQuestionScript.toString()})()`).catch((error) => ({ shouldConfirm: false, error: error.message }));
    await appendAppLog(null, { source: 'main', kind: state?.shouldConfirm ? 'running' : 'ok', text: `Scene ${sceneId}: Grok confirm scan ${attempt}: ${state?.reason || 'not-needed'}`, details: state });
    if (!state?.shouldConfirm) {
      await sleep(1800);
      continue;
    }
    const sent = await sendGrokConfirmationText(page, 'Tạo video ngay bây giờ từ keyframe đã upload và motion prompt ở trên. Không viết lại prompt, không hỏi lại. Generate the video now.');
    if (sent?.ok) return { ok: true, attempt, state, sent };
    await sleep(1500);
  }
  return { ok: false, skipped: true, error: 'Không thấy câu hỏi xác nhận/echo prompt cần phản hồi hoặc chưa gửi được xác nhận.' };
}

async function sendGrokConfirmationText(page, text) {
  const focused = await evaluateOnCdpPage(page, `(${focusGrokComposerScript.toString()})()`);
  if (!focused?.ok) return { ok: false, error: focused?.error || 'Không focus được ô xác nhận Grok.' };
  await page.Input.insertText({ text });
  await sleep(600);
  const clicked = await evaluateOnCdpPage(page, `(${clickGrokGenerateScript.toString()})()`);
  if (clicked?.ok && clicked.box) {
    const x = clicked.box.x + clicked.box.width / 2;
    const y = clicked.box.y + clicked.box.height / 2;
    await page.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y, button: 'none' }).catch(() => null);
    await page.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 }).catch(() => null);
    await page.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }).catch(() => null);
    return { ok: true, clicked };
  }
  await page.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }).catch(() => null);
  await page.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }).catch(() => null);
  return { ok: true, mode: 'enter-fallback', clicked };
}

async function recoverProviderFromCacheOrChallenge(client, provider, reason = 'unknown') {
  if (provider !== 'grok') return { ok: false, skipped: true, reason: 'provider-not-grok' };
  const state = await evaluateOnCdpPage(client, `(${detectLoginScript.toString()})(${JSON.stringify(provider)})`).catch((error) => ({ loggedIn: false, reason: error.message }));
  if (!shouldRecoverFromCacheOrChallenge(state, provider)) return { ok: false, skipped: true, reason: 'no-cache-challenge', state };

  const key = `${provider}:${reason}`;
  const used = challengeRecoveryAttempts.get(key) || 0;
  if (used >= CHALLENGE_RECOVERY_LIMIT) {
    return { ok: false, error: 'Đã thử clear cache/hard reload nhiều lần nhưng Grok vẫn đang ở Cloudflare challenge. Cần tick Verify you are human thủ công một lần trong Chrome.', state };
  }
  challengeRecoveryAttempts.set(key, used + 1);

  await appendAppLog(null, { source: 'main', kind: 'running', text: `Grok dính cache/Cloudflare challenge (${reason}), clear cache + hard reload lần ${used + 1}/${CHALLENGE_RECOVERY_LIMIT}.`, details: state });
  await client.Network.clearBrowserCache().catch(() => null);
  await client.Network.clearBrowserCookies().catch(() => null);
  await client.Storage.clearDataForOrigin({ origin: 'https://grok.com', storageTypes: 'appcache,cache_storage,service_workers,websql,indexeddb,local_storage' }).catch(() => null);
  await client.Page.navigate({ url: 'about:blank' }).catch(() => null);
  await sleep(700);
  await client.Page.navigate({ url: PROVIDER_META.grok.url }).catch(() => null);
  await waitForCdpLoad(client).catch(() => null);
  await client.Page.reload({ ignoreCache: true }).catch(() => null);
  await sleep(2500);
  const after = await evaluateOnCdpPage(client, `(${detectLoginScript.toString()})(${JSON.stringify(provider)})`).catch((error) => ({ loggedIn: false, reason: error.message }));
  return { ok: !shouldRecoverFromCacheOrChallenge(after, provider), before: state, after, attempt: used + 1 };
}

async function sendPromptViaCdpInput(client, prompt) {
  await client.Page.bringToFront().catch(() => null);
  await sleep(500);
  const focused = await evaluateOnCdpPage(client, `(${focusPromptInputScript.toString()})()`);
  if (!focused?.ok) {
    return { ok: false, error: focused?.error || 'Không focus được ô nhập prompt.' };
  }

  await client.Input.insertText({ text: prompt });
  await sleep(1000);
  let afterInsert = await evaluateOnCdpPage(client, `(${getComposerTextScript.toString()})()`);
  if (!afterInsert?.text || afterInsert.text.length < Math.min(20, prompt.length)) {
    await evaluateOnCdpPage(client, `(${setPromptInputValueScript.toString()})(${JSON.stringify(prompt)})`).catch(() => null);
    await sleep(800);
    afterInsert = await evaluateOnCdpPage(client, `(${getComposerTextScript.toString()})()`);
  }
  if (!afterInsert?.text || afterInsert.text.length < Math.min(20, prompt.length)) {
    return { ok: false, error: `Đã focus nhưng prompt không xuất hiện trong composer. Selector: ${focused.selector || 'unknown'}` };
  }

  let lastClick = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await sleep(attempt === 1 ? 800 : 1500);
    lastClick = await evaluateOnCdpPage(client, `(${clickSendButtonScript.toString()})()`);
    if (lastClick?.ok && lastClick.box) {
      const x = lastClick.box.x + lastClick.box.width / 2;
      const y = lastClick.box.y + lastClick.box.height / 2;
      await client.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y, button: 'none' }).catch(() => null);
      await client.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await client.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    }
    await sleep(1200);
    const afterSend = await evaluateOnCdpPage(client, `(${getComposerTextScript.toString()})()`).catch(() => ({ text: '' }));
    if (!afterSend?.text || afterSend.text.length < 5) {
      return { ok: true, mode: `cdp-insertText+send-attempt-${attempt}`, selector: focused.selector, send: lastClick?.selector || lastClick?.mode };
    }
  }

  await client.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await client.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await sleep(1200);
  const finalText = await evaluateOnCdpPage(client, `(${getComposerTextScript.toString()})()`).catch(() => ({ text: '' }));
  if (finalText?.text && finalText.text.length >= 5) {
    return { ok: false, error: `Prompt đã paste nhưng chưa gửi được. Nút send: ${lastClick?.error || lastClick?.selector || 'unknown'}` };
  }
  return { ok: true, mode: 'cdp-insertText+enter-retry', selector: focused.selector };
}

async function waitForCdpAssistantResponse(client, beforeCount) {
  let lastText = '';
  let stableTicks = 0;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 180000) {
    await sleep(2500);
    const snapshot = await evaluateOnCdpPage(client, `(${readLatestAssistantScript.toString()})()`);
    const text = String(snapshot?.text || '').trim();
    const hasNewMessage = Number(snapshot?.count || 0) > Number(beforeCount || 0);
    if (hasNewMessage && text.length > 20) {
      if (text === lastText) {
        stableTicks += 1;
      } else {
        stableTicks = 0;
        lastText = text;
      }
      if (stableTicks >= 2 && !snapshot.generating) {
        await client.close();
        return text;
      }
    }
  }
  await client.close();
  if (lastText) return lastText;
  throw new Error('Hết thời gian chờ response từ Chrome CDP.');
}

async function waitForNewImageUrl(client, existingUrls = []) {
  const known = new Set(existingUrls);
  const startedAt = Date.now();
  while (Date.now() - startedAt < 300000) {
    await sleep(3000);
    const snapshot = await evaluateOnCdpPage(client, `(${collectGeneratedImageUrlsScript.toString()})()`);
    const imageUrl = (snapshot?.urls || []).find((url) => !known.has(url));
    if (imageUrl) return imageUrl;
  }
  throw new Error('Hết thời gian chờ ChatGPT tạo ảnh hoặc không detect được ảnh mới.');
}

async function waitForChatGptImageOrRetry(client, existingUrls = [], prompt, sceneDir, sceneId) {
  const known = new Set(existingUrls);
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const attemptStartedAt = Date.now();
    let sawGenerating = false;
    let readyTicks = 0;
    while (Date.now() - attemptStartedAt < 360000) {
      await sleep(3000);
      const snapshot = await evaluateOnCdpPage(client, `(${readChatGptImageStateScript.toString()})()`);
      const imageUrl = (snapshot?.urls || []).find((url) => !known.has(url));
      if (snapshot?.generating || snapshot?.preparingImage) {
        sawGenerating = true;
        readyTicks = 0;
        continue;
      }
      if (imageUrl) return imageUrl;
      const composerLooksReady = snapshot?.voiceReady;
      const textOnlyAnswer = Number(snapshot?.assistantCount || 0) > 0
        && String(snapshot?.latestAssistantText || '').length > 20
        && !/preparing image|creating image|generating image|đang tạo ảnh/i.test(String(snapshot?.latestAssistantText || ''));
      if (composerLooksReady) readyTicks += 1;
      if (((sawGenerating && composerLooksReady && readyTicks >= 4) || textOnlyAnswer)) {
        await fs.writeFile(
          path.join(sceneDir, `scene_${String(sceneId).padStart(3, '0')}_chatgpt_image_retry_${attempt}.txt`),
          JSON.stringify(snapshot, null, 2),
          'utf8',
        ).catch(() => null);
        if (attempt >= maxAttempts) {
          throw new Error('ChatGPT đã dừng/hiện nút voice nhưng chưa có ảnh sau nhiều lần gửi lại prompt.');
        }
        const retryPrompt = `${prompt}\n\nLẦN GỬI LẠI ${attempt + 1}: Lần trước ChatGPT không trả ảnh. Bắt buộc tạo/render 1 ảnh ngay trong chat, không trả lời text.`;
        await evaluateOnCdpPage(client, `(${prepareChatGptCreateImageScript.toString()})()`).catch(() => null);
        await sleep(800);
        const resent = await sendPromptViaCdpInput(client, retryPrompt);
        if (!resent.ok) throw new Error(resent.error || 'Không gửi lại được image prompt vào ChatGPT.');
        break;
      }
    }
    if (attempt >= maxAttempts) break;
  }
  throw new Error('Hết thời gian chờ ChatGPT tạo ảnh hoặc không detect được ảnh mới.');
}

async function waitForNewVideoUrl(client, existingUrls = [], options = {}) {
  const known = new Set(existingUrls);
  const provider = options.provider || 'grok';
  const sceneId = options.sceneId || '';
  const startedAt = Date.now();
  let retryCount = 0;
  let notifiedLimit = false;
  while (Date.now() - startedAt < 600000) {
    await sleep(5000);
    if (provider === 'grok') {
      const grokState = await evaluateOnCdpPage(client, `(${detectGrokGenerationProblemScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
      if (grokState?.kind === 'unable-finish' && retryCount < 3) {
        retryCount += 1;
        await appendAppLog(null, { source: 'main', kind: 'running', text: `Scene ${sceneId}: Grok unable to finish replying, tự bấm Retry lần ${retryCount}/3.`, details: grokState });
        await clickGrokRetryButton(client, grokState).catch(() => null);
        await sleep(8000);
        continue;
      }
      if (grokState?.kind === 'limit') {
        if (!notifiedLimit) {
          notifiedLimit = true;
          await notifyRenderer('grok-limit', `Scene ${sceneId}: Grok báo limit trong canvas hiện tại. Tool sẽ tạo canvas mới, restore keyframe/video scene trước rồi gửi lại.`, grokState);
          await appendAppLog(null, { source: 'main', kind: 'error', text: `Scene ${sceneId}: Grok canvas limit detected, switching to a new canvas.`, details: grokState });
        }
        if (retryCount < 3 && options.sceneDir && options.imagePath && options.motionPrompt) {
          retryCount += 1;
          const recovered = await recoverGrokCanvasAfterLimit(client, options).catch((error) => ({ ok: false, error: error.message }));
          await appendAppLog(null, { source: 'main', kind: recovered?.ok ? 'ok' : 'error', text: `Scene ${sceneId}: recover canvas sau limit lần ${retryCount}/3: ${recovered?.ok ? 'ok' : recovered?.error}`, details: recovered });
          await sleep(10000);
          continue;
        }
        const routerDevFolder = path.join(__dirname, '..', 'dev_sandbox_grok_account_router');
        await notifyRenderer('grok-account-router-dev', `Scene ${sceneId}: đã thử tạo 3 canvas mới nhưng vẫn bị limit. Roll Grok account đang được phát triển tại ${routerDevFolder}`, { sceneId, devFolder: routerDevFolder });
        throw new Error(`Grok limit sau 3 lần đổi canvas. Roll account đang phát triển: ${routerDevFolder}`);
      }
    }
    const snapshot = await evaluateOnCdpPage(client, `(${collectVideoUrlsScript.toString()})()`);
    const videoUrl = (snapshot?.urls || []).find((url) => !known.has(url));
    if (videoUrl) return videoUrl;
  }
  throw new Error('Hết thời gian chờ Grok tạo video hoặc không detect được video mới.');
}

async function downloadBrowserAsset(client, url, outputPath) {
  if (!url) throw new Error('URL asset rỗng.');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  if (url.startsWith('data:')) {
    const match = url.match(/^data:[^;]+;base64,(.+)$/);
    if (!match) throw new Error('Data URL không hợp lệ.');
    await fs.writeFile(outputPath, Buffer.from(match[1], 'base64'));
    return outputPath;
  }

  const result = await evaluateOnCdpPage(client, `(${downloadAssetInPageScript.toString()})(${JSON.stringify(url)})`);
  if (!result?.ok) {
    throw new Error(result?.error || 'Không tải được asset trong browser context.');
  }
  await fs.writeFile(outputPath, Buffer.from(result.base64, 'base64'));
  return outputPath;
}

async function captureLatestImageElement(client, outputPath) {
  const target = await evaluateOnCdpPage(client, `(${getLatestImageBoxScript.toString()})()`);
  if (!target?.ok) {
    throw new Error(target?.error || 'Không tìm thấy ảnh mới để chụp screenshot.');
  }
  const screenshot = await client.Page.captureScreenshot({
    format: 'png',
    clip: {
      x: Math.max(0, target.box.x),
      y: Math.max(0, target.box.y),
      width: Math.max(1, target.box.width),
      height: Math.max(1, target.box.height),
      scale: 1,
    },
    captureBeyondViewport: true,
  });
  await fs.writeFile(outputPath, Buffer.from(screenshot.data, 'base64'));
  return outputPath;
}

async function pathExists(filePath) {
  if (!filePath) return false;
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function checkAssetExists(_event, filePath) {
  return pathExists(filePath);
}

async function imageFileToDataUrl(imagePath) {
  const buffer = await fs.readFile(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function waitForGrokUploadedAsset(client, timeoutMs = 45000) {
  const started = Date.now();
  let last = null;
  let attempt = 0;
  while (Date.now() - started < timeoutMs) {
    attempt += 1;
    last = await evaluateOnCdpPage(client, `(${detectUploadedAssetScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
    if (last?.ok) return { ...last, attempt, waitedMs: Date.now() - started };
    await appendAppLog(null, { source: 'main', kind: 'running', text: `Grok: chờ ảnh add vào canvas (${Math.round((Date.now() - started) / 1000)}s)...`, details: last });
    await sleep(2500);
  }
  return { ok: false, error: last?.error || `Hết ${Math.round(timeoutMs / 1000)}s vẫn chưa thấy ảnh trong Grok canvas.`, last };
}

async function clickGrokUploadAndChooseFile(client, filePath) {
  await client.Page.setInterceptFileChooserDialog({ enabled: true }).catch(() => null);
  let resolved = false;
  const chooserPromise = new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!resolved) resolve({ ok: false, error: 'Timeout chờ Grok mở file chooser.' });
    }, 8000);
    const handler = async (event) => {
      resolved = true;
      clearTimeout(timer);
      try {
        await client.DOM.setFileInputFiles({ backendNodeId: event.backendNodeId, files: [filePath] });
        resolve({ ok: true, mode: 'fileChooserOpened', backendNodeId: event.backendNodeId, filePath });
      } catch (error) {
        resolve({ ok: false, error: error.message, event });
      }
    };
    client.Page.fileChooserOpened(handler);
  });
  const uploadClick = await evaluateOnCdpPage(client, `(${clickGrokCanvasUploadImageScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
  if (!uploadClick?.ok) {
    await client.Page.setInterceptFileChooserDialog({ enabled: false }).catch(() => null);
    return { ok: false, error: uploadClick?.error || 'Không click được nút Upload Image.', uploadClick };
  }
  await sleep(500);
  const menuClick = await evaluateOnCdpPage(client, `(${clickGrokUploadImageMenuItemScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
  await sleep(700);
  const directInput = await setFirstFileInput(client, filePath).catch((error) => ({ ok: false, error: error.message }));
  if (directInput?.ok) {
    await client.Page.setInterceptFileChooserDialog({ enabled: false }).catch(() => null);
    return { ...directInput, mode: 'direct-input-after-upload-menu', uploadClick, menuClick };
  }
  const result = await chooserPromise;
  await client.Page.setInterceptFileChooserDialog({ enabled: false }).catch(() => null);
  return { ...result, uploadClick, menuClick, directInput };
}

async function setFirstFileInput(client, filePath) {
  const handle = await client.DOM.getDocument();
  const selector = 'input[type="file"], input[accept], input[accept*="image"], input[accept*="video"], input[accept*="png"], input[accept*="jpg"], input[accept*="jpeg"], input[accept*="mp4"], input[accept*="webm"]';
  const query = await client.DOM.querySelector({ nodeId: handle.root.nodeId, selector }).catch(() => ({ nodeId: 0 }));
  if (!query?.nodeId) return { ok: false, error: 'Không tìm thấy input file sau khi bấm Upload Image.' };
  await client.DOM.setFileInputFiles({ nodeId: query.nodeId, files: [filePath] });
  return { ok: true, nodeId: query.nodeId, filePath };
}

async function uploadFileViaCdp(client, filePath, provider = 'grok') {
  if (provider === 'grok') {
    await appendAppLog(null, { source: 'main', kind: 'running', text: 'Grok: copy ảnh vào clipboard, click workspace Empty Canvas rồi Ctrl+V trực tiếp.' });
    await pasteImageViaClipboard(client, filePath, 'workspace');
    let accepted = await waitForGrokUploadedAsset(client, 18000);
    if (!accepted?.ok) {
      await appendAppLog(null, { source: 'main', kind: 'running', text: 'Grok chưa nhận Ctrl+V workspace, thử nút Upload Image và tự chọn file qua CDP.' });
      const fileSet = await clickGrokUploadAndChooseFile(client, filePath);
      await appendAppLog(null, { source: 'main', kind: fileSet?.ok ? 'ok' : 'error', text: `Grok Upload Image file chooser: ${fileSet?.ok ? 'đã chọn file' : fileSet?.error || 'failed'}`, details: fileSet });
      if (fileSet?.ok) accepted = await waitForGrokUploadedAsset(client, 45000);
    }
    await appendAppLog(null, { source: 'main', kind: accepted?.ok ? 'ok' : 'error', text: `Kết quả add ảnh vào Grok workspace: ${accepted?.ok ? 'đã thấy ảnh, tiếp tục prompt' : accepted?.error || 'chưa thấy ảnh'}`, details: accepted });
    return accepted?.ok ? { ok: true, uploaded: accepted, mode: 'grok-workspace-image-add' } : { ok: false, error: accepted?.error || 'Grok chưa add ảnh xong, không gửi prompt để tránh tạo sai.' };
  }

  const handle = await client.DOM.getDocument();
  let nodeId = null;
  try {
    const selector = provider === 'pixverse'
      ? 'input[type="file"], input[accept*="image"], input[accept*="png"], input[accept*="jpg"]'
      : 'input[type="file"]';
    const query = await client.DOM.querySelector({ nodeId: handle.root.nodeId, selector });
    nodeId = query.nodeId;
  } catch (_error) {
    nodeId = null;
  }

  const shouldOpenUploadMenu = !nodeId;
  if (shouldOpenUploadMenu) {
    const clicked = await evaluateOnCdpPage(client, `(${clickUploadButtonScript.toString()})(${JSON.stringify(provider)})`);
    await sleep(1400);
    const refreshed = await client.DOM.getDocument();
    const selector = provider === 'pixverse'
      ? 'input[type="file"], input[accept*="image"], input[accept*="png"], input[accept*="jpg"]'
      : 'input[type="file"]';
    const query = await client.DOM.querySelector({ nodeId: refreshed.root.nodeId, selector });
    nodeId = query.nodeId;
    if (!nodeId && !clicked?.ok) return { ok: false, error: clicked?.error || `Không tìm thấy nút upload ảnh/file trong ${provider}.` };
  }

  if (!nodeId) return { ok: false, error: 'Không tìm thấy input[type=file] sau khi bấm upload.' };
  await appendAppLog(null, { source: 'main', kind: 'running', text: `Upload ảnh vào ${provider}: setFileInputFiles ${filePath}` });
  await client.DOM.setFileInputFiles({ nodeId, files: [filePath] });
  await sleep(provider === 'pixverse' ? 4500 : 4500);
  let accepted = await evaluateOnCdpPage(client, `(${detectUploadedAssetScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
  if (provider === 'grok' && !accepted?.ok) {
    await appendAppLog(null, { source: 'main', kind: 'running', text: 'Grok chưa nhận ảnh qua input file, thử fallback Ctrl+V từ clipboard.' });
    await pasteImageViaClipboard(client, filePath);
    await sleep(2500);
    accepted = await evaluateOnCdpPage(client, `(${detectUploadedAssetScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
  }
  await appendAppLog(null, { source: 'main', kind: accepted?.ok ? 'ok' : 'error', text: `Kết quả upload ${provider}: ${accepted?.ok ? 'đã nhận ảnh' : accepted?.error || 'chưa nhận ảnh'}`, details: accepted });
  if (provider === 'grok' && !accepted?.ok) {
    return { ok: false, error: accepted?.error || 'Grok chưa nhận ảnh upload.' };
  }
  return { ok: true, uploaded: accepted };
}

async function pasteImageViaClipboard(client, imagePath, target = 'composer') {
  const image = nativeImage.createFromPath(imagePath);
  if (image.isEmpty()) throw new Error(`Không đọc được ảnh để paste clipboard: ${imagePath}`);
  clipboard.writeImage(image);
  if (target === 'workspace') {
    const focused = await evaluateOnCdpPage(client, `(${focusGrokWorkspaceScript.toString()})()`);
    await appendAppLog(null, { source: 'main', kind: focused?.ok ? 'ok' : 'running', text: `Grok workspace focus: ${focused?.ok ? focused.mode : focused?.error || 'fallback'}`, details: focused });
    if (focused?.point) {
      const { x, y } = focused.point;
      await client.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y, button: 'none' }).catch(() => null);
      await client.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 }).catch(() => null);
      await client.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }).catch(() => null);
    }
  } else {
    await evaluateOnCdpPage(client, `(${focusGrokComposerScript.toString()})()`);
  }
  await sleep(300);
  await client.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17, nativeVirtualKeyCode: 17, modifiers: 2 }).catch(() => null);
  await client.Input.dispatchKeyEvent({ type: 'keyDown', key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86, nativeVirtualKeyCode: 86, modifiers: 2 }).catch(() => null);
  await client.Input.dispatchKeyEvent({ type: 'keyUp', key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86, nativeVirtualKeyCode: 86, modifiers: 2 }).catch(() => null);
  await client.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17, nativeVirtualKeyCode: 17, modifiers: 0 }).catch(() => null);
}

async function submitPixVersePrompt(client, prompt, config = {}) {
  await evaluateOnCdpPage(client, `(${preparePixVerseComposerScript.toString()})(${JSON.stringify(config)})`).catch(() => null);
  await sleep(500);
  const pasted = await evaluateOnCdpPage(client, `(${setPixVersePromptScript.toString()})(${JSON.stringify(prompt)})`);
  if (!pasted?.ok) return { ok: false, error: pasted?.error || 'Không paste được prompt vào PixVerse.' };
  await sleep(800);
  const clicked = await evaluateOnCdpPage(client, `(${clickPixVerseCreateScript.toString()})()`);
  if (clicked?.ok && clicked.box) {
    const x = clicked.box.x + clicked.box.width / 2;
    const y = clicked.box.y + clicked.box.height / 2;
    await client.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y, button: 'none' }).catch(() => null);
    await client.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 }).catch(() => null);
    await client.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }).catch(() => null);
  }
  return clicked?.ok ? { ok: true, mode: 'pixverse-create', selector: clicked.selector } : { ok: false, error: clicked?.error || 'Không bấm được nút Create PixVerse.' };
}

async function submitGrokVideoPrompt(client, prompt, config = {}) {
  const forcedMode = await evaluateOnCdpPage(client, `(${forceGrokVideoModeScript.toString()})()`).catch((error) => ({ ok: false, error: error.message }));
  await appendAppLog(null, { source: 'main', kind: forcedMode?.ok ? 'ok' : 'running', text: `Grok video mode: ${forcedMode?.status || forcedMode?.error || 'checked'}`, details: forcedMode });
  const prepared = await evaluateOnCdpPage(client, `(${prepareGrokVideoComposerScript.toString()})(${JSON.stringify(config || {})})`).catch((error) => ({ ok: false, error: error.message }));
  await appendAppLog(null, { source: 'main', kind: prepared?.ok ? 'ok' : 'running', text: `Grok config: ${prepared?.ok ? JSON.stringify(prepared.config || {}) : prepared?.error || 'không đọc được'}`, details: prepared });
  await sleep(500);
  const focused = await evaluateOnCdpPage(client, `(${focusGrokComposerScript.toString()})()`);
  if (!focused?.ok) return { ok: false, error: focused?.error || 'Không focus được ô nhập Grok.' };
  await client.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17, nativeVirtualKeyCode: 17, modifiers: 2 }).catch(() => null);
  await client.Input.dispatchKeyEvent({ type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65, modifiers: 2 }).catch(() => null);
  await client.Input.dispatchKeyEvent({ type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65, modifiers: 2 }).catch(() => null);
  await client.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17, nativeVirtualKeyCode: 17, modifiers: 0 }).catch(() => null);
  await client.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 }).catch(() => null);
  await client.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 }).catch(() => null);
  await sleep(250);
  await client.Input.insertText({ text: prompt });
  await sleep(800);
  let verified = await evaluateOnCdpPage(client, `(${getActiveComposerTextScript.toString()})()`).catch(() => ({ text: '' }));
  if (!verified?.text || !verified.text.includes(prompt.slice(0, Math.min(24, prompt.length)))) {
    const domSet = await evaluateOnCdpPage(client, `(${setGrokComposerTextScript.toString()})(${JSON.stringify(prompt)})`).catch((error) => ({ ok: false, error: error.message }));
    await appendAppLog(null, { source: 'main', kind: domSet?.ok ? 'ok' : 'running', text: `Fallback set composer Grok: ${domSet?.ok ? 'ok' : domSet?.error || 'fail'}`, details: domSet });
    await sleep(500);
    verified = await evaluateOnCdpPage(client, `(${getActiveComposerTextScript.toString()})()`).catch(() => ({ text: '' }));
  }
  await appendAppLog(null, { source: 'main', kind: verified?.text?.includes(prompt.slice(0, 24)) ? 'ok' : 'error', text: `Paste prompt Grok: verify ${verified?.text ? 'có text' : 'trống'}`, details: { selector: verified?.selector, expectedHead: prompt.slice(0, 180), actualHead: String(verified?.text || '').slice(0, 260) } });
  if (!verified?.text || !verified.text.includes(prompt.slice(0, Math.min(24, prompt.length)))) {
    return { ok: false, error: `Grok chưa nhận đúng motion prompt trong composer đang focus. Text hiện tại: ${String(verified?.text || '').slice(0, 160)}` };
  }
  let clicked = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    clicked = await evaluateOnCdpPage(client, `(${clickGrokGenerateScript.toString()})()`);
    if (clicked?.ok && clicked.box) {
      const x = clicked.box.x + clicked.box.width / 2;
      const y = clicked.box.y + clicked.box.height / 2;
      await client.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y, button: 'none' }).catch(() => null);
      await client.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 }).catch(() => null);
      await client.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }).catch(() => null);
    }
    await sleep(1200);
    const afterClick = await evaluateOnCdpPage(client, `(${getComposerTextScript.toString()})()`).catch(() => ({ text: '' }));
    if (!afterClick?.text || afterClick.text.length < 5) {
      return { ok: true, mode: `grok-generate-attempt-${attempt}`, selector: clicked?.selector };
    }
  }
  return { ok: false, error: clicked?.error || clicked?.selector || 'Prompt đã paste nhưng Grok chưa gửi sau 3 lần bấm send.' };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function downloadAssetInPageScript(url) {
  return fetch(url, { credentials: 'include' })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.blob();
    })
    .then((blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = String(reader.result || '');
        const base64 = dataUrl.includes(',') ? dataUrl.split(',').pop() : '';
        resolve({ ok: Boolean(base64), base64, type: blob.type, size: blob.size });
      };
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    }))
    .catch((error) => ({ ok: false, error: error.message }));
}

function detectLoginScript(provider) {
  const bodyText = document.body?.innerText || '';
  const buttonsText = [...document.querySelectorAll('button, a, [role="button"]')]
    .map((el) => `${el.textContent || ''} ${el.getAttribute('aria-label') || ''}`.trim())
    .join(' | ');
  const composerSelectors = [
    'textarea',
    'div[contenteditable="true"]',
    '[contenteditable="true"].ProseMirror',
    '.ProseMirror[contenteditable="true"]',
    '[data-testid="composer"]',
    '[data-testid="composer"] [contenteditable="true"]',
    '[role="textbox"]',
    '#prompt-textarea',
    '[aria-label*="Message"]',
    '[aria-label*="Ask"]',
    '[placeholder*="Ask"]',
  ];
  const composer = composerSelectors.map((selector) => document.querySelector(selector)).find(Boolean);
  const hasAppShell = provider === 'grok'
    ? /Grok|Imagine|DeepSearch|Think|What do you want to know|Ask anything/i.test(bodyText)
    : provider === 'pixverse'
      ? /PixVerse|Create|Generate|Image to Video|Text to Video|My Videos|Workspace/i.test(bodyText)
      : /New chat|Search chats|Library|Recents|What’s on the agenda|Ask anything|Projects/i.test(bodyText);
  const hasExplicitLoginButton = provider === 'grok'
    ? /(^|\|)\s*(sign in|log in|đăng nhập|sign up|đăng ký)\s*(\||$)/i.test(buttonsText)
      || /(^|\n)\s*(Sign in|Sign up)\s*($|\n)/i.test(bodyText)
      || /Sign up to keep chatting/i.test(bodyText)
    : /(^|\|)\s*(log in|sign in|đăng nhập)\s*(\||$)/i.test(buttonsText);
  const loggedOutWords = provider === 'grok'
    ? /sign in|log in|đăng nhập|continue with|sign up to keep chatting/i
    : provider === 'pixverse'
      ? /sign in|log in|sign up|continue with|đăng nhập/i
      : /log in|sign up|sign in|đăng nhập|get started/i;
  const hasChatGptLoginUi = provider === 'chatgpt' && (
    /(^|\|)\s*(log in|sign in|đăng nhập|sign up for free|sign up)\s*(\||$)/i.test(buttonsText)
    || /(^|\n)\s*(Log in|Sign up for free|Sign up)\s*($|\n)/i.test(bodyText)
    || /Get responses tailored to you|Log in to get|saved chats|upload files/i.test(bodyText)
  );
  const chatgptLoggedInShell = provider === 'chatgpt' && !hasChatGptLoginUi && (
    /Projects|GPTs|Company knowledge|Invite team members/i.test(bodyText)
    || /CUSTOMVOICE|Business|Team|Workspace/i.test(bodyText)
    || /Share\s*\|/i.test(buttonsText)
  );
  const grokLoggedInShell = provider === 'grok' && (
    /SuperGrok|Imagine|Private|What do you want to know\?|Ask anything|Sign Out|Settings|Connectors|Tasks|Files/i.test(bodyText)
    || Boolean(composer)
  );
  const hasSignedInAccount = provider === 'grok'
    ? grokLoggedInShell || /@[\w.-]+|Projects|History|Private|SuperGrok|Charlotte Garcia|New Project|Sign Out/i.test(bodyText)
    : chatgptLoggedInShell;
  const looksLoggedOut = provider === 'chatgpt'
    ? hasChatGptLoginUi
    : provider === 'grok'
      ? hasExplicitLoginButton || /continue with google|continue with apple|sign in to grok|sign up to grok/i.test(bodyText)
      : hasExplicitLoginButton || (loggedOutWords.test(bodyText) && !composer && !hasSignedInAccount);
  const cloudflareChallenge = provider === 'grok' && /cloudflare|performing security verification|verify you are human|checking if the site connection is secure|just a moment|Ray ID/i.test(`${bodyText} ${document.title}`);
  return {
    provider,
    loggedIn: cloudflareChallenge ? false : provider === 'chatgpt'
      ? chatgptLoggedInShell && !looksLoggedOut
      : provider === 'grok'
        ? !looksLoggedOut && (grokLoggedInShell || hasSignedInAccount)
        : Boolean(composer || hasAppShell || hasSignedInAccount) && !looksLoggedOut,
    hasComposer: Boolean(composer),
    hasAppShell,
    looksLoggedOut,
    cloudflareChallenge,
    reason: cloudflareChallenge ? 'Grok đang hiện Cloudflare security verification / cache challenge.' : looksLoggedOut ? 'Trang đang hiện Sign in/Sign up hoặc yêu cầu đăng nhập.' : '',
    hasSignedInAccount,
    composerTag: composer?.tagName || null,
    composerClass: composer?.className || null,
    url: location.href,
    title: document.title,
    sampleText: bodyText.slice(0, 1200),
  };
}

function detectVideoCapabilityScript(provider) {
  const bodyText = document.body?.innerText || '';
  if (/sign in|log in|sign up to keep chatting|đăng nhập/i.test(bodyText) && !/SuperGrok|Imagine|Private|Sign Out|What do you want to know\?/i.test(bodyText)) {
    return { ok: false, error: `${provider === 'pixverse' ? 'PixVerse' : 'Grok'} chưa đăng nhập hoặc session bị giới hạn: trang đang hiện Sign in/Sign up.` };
  }
  const fileInput = document.querySelector('input[type="file"]');
  const actionText = [...document.querySelectorAll('button, [role="button"], a, label')]
    .map((el) => `${el.textContent || ''} ${el.getAttribute('aria-label') || ''} ${el.title || ''}`)
    .join(' | ');
  const featurePattern = provider === 'pixverse'
    ? /Image to Video|Text to Video|Create|Generate|Upload|Start|PixVerse/i
    : /Imagine|Create images|image generation|attach|upload|plus|\+|create/i;
  const uploadPattern = provider === 'pixverse'
    ? /upload|image|file|add|create|generate|start|\+/i
    : /attach|upload|image|file|plus|\+|add/i;
  const featureText = featurePattern.test(bodyText) || featurePattern.test(actionText);
  const hasUploadAction = uploadPattern.test(actionText) || Boolean(fileInput);
  const signedInShell = provider === 'grok' && /SuperGrok|Imagine|Private|Sign Out|What do you want to know\?|What would you like to create\?|Type to imagine/i.test(bodyText);
  const blocked = /upgrade|subscribe|premium|limit reached|not available|not supported|join waitlist|quota|insufficient|credits/i.test(bodyText);
  if (blocked && !signedInShell) {
    return { ok: false, error: `${provider === 'pixverse' ? 'PixVerse' : 'Grok'} account đang bị giới hạn quota/plan hoặc feature tạo video chưa khả dụng. Hãy đổi account/plan rồi chạy lại.` };
  }
  if (!featureText && !hasUploadAction) {
    return { ok: false, error: `Không thấy feature upload/tạo video trong ${provider === 'pixverse' ? 'PixVerse' : 'Grok'}. Có thể account này chưa có quyền tạo video từ ảnh.` };
  }
  const energyMatch = bodyText.match(/(?:⚡|energy|credit|credits|trial left|free trial left)[^0-9]{0,20}(\d{1,5})/i)
    || bodyText.match(/(\d{1,5})\s*(?:⚡|energy|credits?|free trial left|trial left)/i);
  const planMatch = bodyText.match(/\b(Basic|Pro\+?|Premium|Personal|Team|Enterprise)\b/i);
  const hasPro = /\b(Pro\+?|Premium|Team|Enterprise)\b/i.test(bodyText) || /PRO\+/i.test(actionText);
  const proModelsVisible = /Seedance|Happy Horse|Kling|Veo|Sora|Grok Imagine/i.test(bodyText);
  return {
    ok: true,
    hasUploadAction,
    featureText,
    fileInput: Boolean(fileInput),
    energy: energyMatch ? Number(energyMatch[1]) : null,
    plan: planMatch ? planMatch[1] : null,
    hasPro,
    proModelsVisible,
  };
}

function countAssistantMessagesScript() {
  return [...document.querySelectorAll('[data-message-author-role="assistant"], article, .message, [class*="response"], [class*="markdown"]')]
    .filter((node) => (node.innerText || '').trim().length > 20).length;
}

function getPromptInputCandidates() {
  return [
    '#prompt-textarea',
    'textarea',
    'div[contenteditable="true"].ProseMirror',
    '.ProseMirror[contenteditable="true"]',
    '[data-testid="composer"] [contenteditable="true"]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
  ];
}

function focusPromptInputScript() {
  const selectors = [
    '#prompt-textarea',
    'textarea',
    'div[contenteditable="true"].ProseMirror',
    '.ProseMirror[contenteditable="true"]',
    '[data-testid="composer"] [contenteditable="true"]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
  ];
  for (const selector of selectors) {
    const input = document.querySelector(selector);
    if (!input) continue;
    input.scrollIntoView({ block: 'center' });
    input.focus();
    input.click();
    const selection = window.getSelection();
    if (input.isContentEditable && selection) {
      const range = document.createRange();
      range.selectNodeContents(input);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return { ok: true, selector, tag: input.tagName, className: input.className || '' };
  }
  return { ok: false, error: 'Không tìm thấy composer ChatGPT/Grok.' };
}

function getComposerTextScript() {
  const selectors = [
    '#prompt-textarea',
    'textarea',
    'div[contenteditable="true"].ProseMirror',
    '.ProseMirror[contenteditable="true"]',
    '[data-testid="composer"] [contenteditable="true"]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
  ];
  const rightPanelCandidates = selectors
    .flatMap((selector) => [...document.querySelectorAll(selector)].map((node) => ({ node, selector })))
    .filter(({ node }) => {
      const rect = node.getBoundingClientRect?.();
      return rect && rect.width > 80 && rect.height > 16 && rect.left > window.innerWidth * 0.62 && rect.bottom > window.innerHeight * 0.55;
    })
    .sort((a, b) => b.node.getBoundingClientRect().bottom - a.node.getBoundingClientRect().bottom);
  const active = document.activeElement;
  const activeText = active ? (active.value || active.innerText || active.textContent || '').trim() : '';
  const activeCandidate = active && selectors.some((selector) => active.matches?.(selector) || active.closest?.(selector)) && activeText
    ? { node: active.matches?.(selectors.join(',')) ? active : active.closest(selectors.join(',')), selector: 'activeElement' }
    : null;
  const fallbackCandidates = selectors
    .flatMap((selector) => [...document.querySelectorAll(selector)].map((node) => ({ node, selector })))
    .filter(({ node }) => {
      const rect = node.getBoundingClientRect?.();
      const text = (node.value || node.innerText || node.textContent || '').trim();
      return rect && rect.width > 80 && rect.height > 10 && rect.bottom > 0 && text.length > 0 && text.length < 30000;
    })
    .sort((a, b) => b.node.getBoundingClientRect().bottom - a.node.getBoundingClientRect().bottom);
  const item = rightPanelCandidates[0] || activeCandidate || fallbackCandidates[0];
  if (item) {
    const input = item.node;
    return { ok: true, selector: item.selector, text: input.value || input.innerText || input.textContent || '' };
  }
  return { ok: false, text: '' };
}

function getActiveComposerTextScript() {
  const selectors = '#prompt-textarea, textarea, div[contenteditable="true"].ProseMirror, .ProseMirror[contenteditable="true"], [data-testid="composer"] [contenteditable="true"], div[contenteditable="true"], [role="textbox"]';
  const active = document.activeElement;
  const node = active?.matches?.(selectors) ? active : active?.closest?.(selectors);
  if (!node) return { ok: false, text: '', selector: 'activeElement-none' };
  const text = node.value || node.innerText || node.textContent || '';
  const rect = node.getBoundingClientRect?.();
  return { ok: true, selector: 'activeElement', text, box: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null };
}

function setPromptInputValueScript(prompt) {
  const selectors = [
    '#prompt-textarea',
    'textarea',
    'div[contenteditable="true"].ProseMirror',
    '.ProseMirror[contenteditable="true"]',
    '[data-testid="composer"] [contenteditable="true"]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
  ];
  const input = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
  if (!input) return { ok: false, error: 'Không tìm thấy composer để set prompt.' };
  input.scrollIntoView({ block: 'center' });
  input.focus();
  input.click();
  if ('value' in input) {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.value = prompt;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, prompt);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
  }
  return { ok: true };
}

function clickSendButtonScript() {
  const candidates = [
    ...document.querySelectorAll('button[data-testid="send-button"], button[data-testid="composer-submit-button"], button[aria-label="Send prompt"], button[aria-label="Send message"], button[aria-label*="Send"], button[type="submit"]'),
    ...document.querySelectorAll('form button, [data-testid="composer"] button, button'),
  ];
  const unique = [...new Set(candidates)];
  const sendButton = unique.find((button) => {
    if (button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
    const rect = button.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return false;
    const label = `${button.getAttribute('aria-label') || ''} ${button.textContent || ''} ${button.dataset?.testid || ''} ${button.innerHTML || ''}`;
    return /send|submit|gửi|arrow-up|composer-submit|send-button|M2\.01|up/i.test(label) || button.closest('form');
  });
  if (!sendButton) return { ok: false, error: 'Không tìm thấy nút send đang enabled.' };
  sendButton.scrollIntoView({ block: 'center', inline: 'center' });
  sendButton.focus();
  sendButton.click();
  const rect = sendButton.getBoundingClientRect();
  return {
    ok: true,
    selector: sendButton.getAttribute('data-testid') || sendButton.getAttribute('aria-label') || sendButton.textContent || 'button',
    box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
  };
}

function sendPromptScript(prompt) {
  const selectors = [
    'textarea',
    '#prompt-textarea',
    'div[contenteditable="true"].ProseMirror',
    '.ProseMirror[contenteditable="true"]',
    '[data-testid="composer"] [contenteditable="true"]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
  ];
  const input = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
  if (!input) return { ok: false, error: 'Không tìm thấy ô nhập prompt Ask anything / composer.' };

  input.scrollIntoView({ block: 'center' });
  input.focus();
  if (input.tagName === 'TEXTAREA') {
    input.value = prompt;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, prompt);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
  }

  const buttons = [...document.querySelectorAll('button')];
  const sendButton = document.querySelector('button[data-testid="send-button"], button[data-testid="composer-submit-button"], button[aria-label="Send prompt"], button[aria-label="Send message"]')
    || buttons.find((button) => {
      const label = `${button.getAttribute('aria-label') || ''} ${button.textContent || ''} ${button.dataset?.testid || ''} ${button.innerHTML || ''}`;
      return /send|submit|gửi|arrow-up|composer-submit|send-button/i.test(label) && !button.disabled;
    })
    || buttons.reverse().find((button) => !button.disabled && button.closest('form'));

  setTimeout(() => {
    const retryButton = document.querySelector('button[data-testid="send-button"], button[data-testid="composer-submit-button"], button[aria-label="Send prompt"], button[aria-label="Send message"]');
    if (retryButton && !retryButton.disabled) retryButton.click();
  }, 250);

  if (sendButton && !sendButton.disabled) {
    sendButton.click();
    return { ok: true, mode: 'button', selector: sendButton.getAttribute('data-testid') || sendButton.getAttribute('aria-label') || sendButton.textContent || 'button' };
  }

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
  return { ok: true, mode: 'enter' };
}

function collectGeneratedImageUrlsScript() {
  const urls = [...document.images]
    .map((img) => img.currentSrc || img.src)
    .filter(Boolean)
    .filter((url) => /blob:|data:image|oaiusercontent|oaidalleapiprodscus|chatgpt|openai|grok|xai/i.test(url));
  return { urls: [...new Set(urls)] };
}

function getLatestImageBoxScript() {
  const isImageNode = (node) => {
    if (node.tagName === 'IMG' || node.tagName === 'CANVAS') return true;
    const text = node.innerText || '';
    if (/Generated image/i.test(text) && (text.includes('Edit') || node.querySelector('button'))) return true;
    const style = window.getComputedStyle(node);
    if (style.backgroundImage && style.backgroundImage !== 'none' && !style.backgroundImage.includes('gradient')) return true;
    return false;
  };
  
  const nodes = [...document.querySelectorAll('img, canvas, button, div')]
    .filter((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.width < 180 || rect.height < 120) return false;
      if (rect.width > window.innerWidth * 0.9 && rect.height > window.innerHeight * 0.9) return false;
      if (node.closest('header, nav, aside')) return false;
      return isImageNode(node);
    })
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        node,
        src: node.currentSrc || node.src || 'custom-box',
        area: rect.width * rect.height,
        box: { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height },
      };
    })
    // Ưu tiên các node ở xa nhất phía dưới (mới nhất)
    .sort((a, b) => b.box.y - a.box.y);
    
  const best = nodes[0];
  if (!best) return { ok: false, error: 'Không tìm thấy image element đủ lớn trong ChatGPT.' };
  best.node.scrollIntoView({ block: 'center' });
  return { ok: true, src: best.src, box: best.box };
}

function collectVideoUrlsScript() {
  const urls = [
    ...[...document.querySelectorAll('video')].map((video) => video.currentSrc || video.src),
    ...[...document.querySelectorAll('a[href]')].map((link) => link.href).filter((href) => /\.mp4|video|download/i.test(href)),
  ].filter(Boolean);
  return { urls: [...new Set(urls)] };
}

function clickUploadButtonScript(provider = 'grok') {
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 4 && rect.height > 4;
  };
  const textOf = (node) => `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''} ${node.innerHTML || ''}`;
  if (provider !== 'grok') {
    const input = document.querySelector('input[type="file"]');
    if (input) return { ok: true, mode: 'existing-input' };
  }
  const buttons = [...document.querySelectorAll('button, [role="button"], label, div, span')].filter(visible);
  let uploadButton = null;
  if (provider === 'pixverse') {
    uploadButton = buttons.find((button) => /image|upload|reference|ảnh|file|\+/i.test(textOf(button)));
  } else {
    const bottomButtons = buttons
      .map((button) => ({ button, rect: button.getBoundingClientRect(), text: textOf(button) }))
      .filter((item) => item.rect.top > window.innerHeight * 0.55);
    uploadButton = bottomButtons.find((item) => /^\s*\+\s*$/.test(item.text) || /Add|Attach|Upload|paperclip/i.test(item.text) || (item.rect.width <= 64 && /svg|path/i.test(item.button.innerHTML || '')))?.button
      || buttons.find((button) => /upload|attach|image|ảnh|file|paperclip|plus|add/i.test(textOf(button)));
  }
  if (!uploadButton) return { ok: false, error: 'Không thấy nút upload/attach/image.' };
  uploadButton.scrollIntoView({ block: 'center', inline: 'center' });
  uploadButton.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  uploadButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  uploadButton.click();
  uploadButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  return { ok: true, mode: 'clicked-upload' };
}

function getGrokReadyStateScript() {
  const bodyText = document.body?.innerText || '';
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 8 && rect.height > 8;
  };
  const composer = [...document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]')]
    .find((node) => visible(node) && /imagine|what do you want|ask/i.test(`${node.getAttribute?.('placeholder') || ''} ${node.getAttribute?.('aria-label') || ''} ${node.textContent || ''}`));
  const hasImagineHome = /Featured Templates|Discover|Type to imagine|Create Template/i.test(bodyText);
  const hasSignedShell = /SuperGrok|Imagine|Private|Sign Out|What do you want to know\?/i.test(bodyText);
  const loading = /loading|just a moment|please wait|checking/i.test(bodyText) || [...document.querySelectorAll('[aria-busy="true"], .spinner, [class*="loading"], [class*="spinner"]')].some(Boolean);
  return {
    ready: Boolean((composer || hasImagineHome || hasSignedShell) && !loading),
    hasComposer: Boolean(composer),
    hasImagineHome,
    hasSignedShell,
    loading,
    url: location.href,
    title: document.title,
    sampleText: bodyText.slice(0, 800),
  };
}

function detectGrokTemplateModalScript() {
  const bodyText = document.body?.innerText || '';
  const open = /Choose a template type to begin|Name your template|Template Name|Photo\s*→\s*Video|Photo\s*→\s*Style Edit|Photo\s*→\s*Edit\s*→\s*Video/i.test(bodyText);
  return { open, sampleText: bodyText.slice(0, 1000), url: location.href };
}

function closeGrokTemplateModalScript() {
  const bodyText = document.body?.innerText || '';
  const state = {
    open: /Choose a template type to begin|Name your template|Template Name|Photo\s*→\s*Video|Photo\s*→\s*Style Edit|Photo\s*→\s*Edit\s*→\s*Video/i.test(bodyText),
    sampleText: bodyText.slice(0, 1000),
    url: location.href,
  };
  if (!state.open) return { ok: false, reason: 'modal-not-open' };
  const textOf = (node) => `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''} ${node.innerHTML || ''}`.trim();
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 4 && rect.height > 4 && rect.bottom > 0 && rect.right > 0;
  };
  const textNodes = [...document.querySelectorAll('div, section, article, main, [role="dialog"], [class]')]
    .filter((node) => {
      if (!visible(node)) return false;
      const text = node.innerText || '';
      const hasTemplateChoice = /Choose a template type to begin/i.test(text) && /Photo\s*→\s*Video/i.test(text);
      const hasNameTemplateStep = /Name your template|Template Name|Add a description/i.test(text);
      return hasTemplateChoice || hasNameTemplateStep;
    })
    .map((node) => ({ node, rect: node.getBoundingClientRect(), text: node.innerText || '' }))
    .filter((item) => item.rect.width > 260 && item.rect.width < window.innerWidth * 0.9 && item.rect.height > 120 && item.rect.height < window.innerHeight * 0.95)
    .sort((a, b) => (a.rect.width * a.rect.height) - (b.rect.width * b.rect.height));
  const modal = textNodes[0];
  const buttons = [...document.querySelectorAll('button, [role="button"], [aria-label], svg, path')]
    .map((node) => node.closest?.('button, [role="button"], [aria-label]') || node)
    .filter((node, index, list) => node && list.indexOf(node) === index && visible(node))
    .map((node) => ({ node, rect: node.getBoundingClientRect(), text: textOf(node) }));
  const candidates = buttons.filter((item) => {
    const inModalTopRight = modal
      && item.rect.top >= modal.rect.top
      && item.rect.top <= modal.rect.top + 70
      && item.rect.left >= modal.rect.right - 90
      && item.rect.left <= modal.rect.right + 10
      && item.rect.width <= 80
      && item.rect.height <= 80;
    const xLike = /^(×|x)$/i.test(item.text) || /close|dismiss|đóng/i.test(item.text);
    const iconOnly = inModalTopRight && /svg|path|circle|lucide|icon/i.test(item.text || item.node.innerHTML || '');
    return (xLike && (!modal || inModalTopRight || item.rect.top < 180)) || iconOnly || inModalTopRight;
  }).sort((a, b) => (b.rect.left - a.rect.left) || (a.rect.top - b.rect.top));
  const target = candidates[0];
  const syntheticBox = modal ? {
    x: Math.max(0, modal.rect.right - 30),
    y: Math.max(0, modal.rect.top + 8),
    width: 26,
    height: 26,
  } : null;
  if (!target && !syntheticBox) return { ok: false, error: 'Không tìm thấy nút X hoặc khung bảng template Grok.', state, buttons: buttons.slice(0, 20).map((item) => ({ text: item.text.slice(0, 80), box: { x: item.rect.x, y: item.rect.y, width: item.rect.width, height: item.rect.height } })) };
  if (target) {
    target.node.scrollIntoView?.({ block: 'center', inline: 'center' });
    target.node.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    target.node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    target.node.click?.();
    target.node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }
  const box = target ? { x: target.rect.x, y: target.rect.y, width: target.rect.width, height: target.rect.height } : syntheticBox;
  return { ok: true, selector: target?.text?.slice(0, 80) || 'modal-relative-synthetic-x', box, modal: modal ? { x: modal.rect.x, y: modal.rect.y, width: modal.rect.width, height: modal.rect.height } : null, state };
}

function getGrokTemplateViewportFallbackPointsScript() {
  const bodyText = document.body?.innerText || '';
  const open = /Choose a template type to begin|Photo\s*→\s*Video|Template Name/i.test(bodyText);
  if (!open) return { ok: false, reason: 'modal-not-open' };
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 20 && rect.height > 20 && rect.bottom > 0 && rect.right > 0;
  };
  const textOf = (node) => `${node.innerText || node.textContent || ''}`.trim().replace(/\s+/g, ' ');
  const modalCandidates = [...document.querySelectorAll('div, section, article, main, [role="dialog"], [class]')]
    .filter((node) => visible(node) && /Choose a template type to begin/i.test(textOf(node)) && /Photo\s*→\s*Video/i.test(textOf(node)))
    .map((node) => ({ rect: node.getBoundingClientRect(), text: textOf(node).slice(0, 200) }))
    .filter((item) => item.rect.width > 400 && item.rect.height > 260 && item.rect.width < innerWidth * 0.95 && item.rect.height < innerHeight * 0.95)
    .sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height));
  const modal = modalCandidates[0]?.rect;
  const points = modal ? [
    { name: 'modal-x-hard', x: modal.right - 18, y: modal.top + 18 },
    { name: 'modal-x-hard-2', x: modal.right - 26, y: modal.top + 26 },
    { name: 'backdrop-top-left', x: 20, y: 20 },
    { name: 'backdrop-bottom-left', x: 20, y: innerHeight - 20 },
  ] : [
    { name: 'viewport-x-hard', x: innerWidth * 0.81, y: innerHeight * 0.14 },
    { name: 'viewport-x-hard-2', x: innerWidth * 0.80, y: innerHeight * 0.15 },
    { name: 'backdrop-top-left', x: 20, y: 20 },
    { name: 'backdrop-bottom-left', x: 20, y: innerHeight - 20 },
  ];
  const hits = points.map((point) => {
    const hit = document.elementFromPoint(point.x, point.y);
    return { ...point, hitTag: hit?.tagName || '', hitText: textOf(hit || document.body).slice(0, 160) };
  });
  return { ok: true, viewport: { width: innerWidth, height: innerHeight }, modal: modal ? { x: modal.x, y: modal.y, width: modal.width, height: modal.height } : null, points, hits, candidates: modalCandidates.slice(0, 8).map((item) => ({ box: { x: item.rect.x, y: item.rect.y, width: item.rect.width, height: item.rect.height }, text: item.text })) };
}

function scanGrokTemplateModalScript() {
  const bodyText = document.body?.innerText || '';
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 8 && rect.height > 8 && rect.bottom > 0 && rect.right > 0;
  };
  const textOf = (node) => `${node.innerText || node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim().replace(/\s+/g, ' ');
  const interesting = [...document.querySelectorAll('button, [role="button"], div, section, article, [class], [aria-label]')]
    .filter(visible)
    .map((node) => ({ node, rect: node.getBoundingClientRect(), text: textOf(node), tag: node.tagName, role: node.getAttribute?.('role') || '', cls: String(node.className || '').slice(0, 100) }))
    .filter((item) => /Choose a template|Photo|Video|Style|Edit|Template|close|dismiss|×|x/i.test(item.text) || /dialog|modal|button/i.test(`${item.role} ${item.cls}`))
    .sort((a, b) => (a.rect.y - b.rect.y) || (a.rect.x - b.rect.x))
    .slice(0, 80)
    .map((item) => ({ tag: item.tag, role: item.role, className: item.cls, text: item.text.slice(0, 220), box: { x: item.rect.x, y: item.rect.y, width: item.rect.width, height: item.rect.height } }));
  return { ok: true, open: /Choose a template type to begin|Name your template|Template Name|Add a description/i.test(bodyText), url: location.href, viewport: { width: innerWidth, height: innerHeight }, sampleText: bodyText.slice(0, 1200), interesting };
}

function selectGrokPhotoVideoTemplateScript() {
  const bodyText = document.body?.innerText || '';
  const open = /Choose a template type to begin|Photo\s*→\s*Video|Name your template|Template Name/i.test(bodyText);
  if (!open) return { ok: false, reason: 'modal-not-open' };
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 20 && rect.height > 20 && rect.bottom > 0 && rect.right > 0;
  };
  const textOf = (node) => `${node.innerText || node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim().replace(/\s+/g, ' ');
  const all = [...document.querySelectorAll('button, [role="button"], div, section, article')]
    .filter(visible)
    .map((node) => ({ node, rect: node.getBoundingClientRect(), text: textOf(node), tag: node.tagName, role: node.getAttribute?.('role') || '', cls: String(node.className || '').slice(0, 100) }));
  const cards = all
    .filter((item) => /Photo\s*→\s*Video/i.test(item.text) && /Animate a photo using a video prompt/i.test(item.text) && !/Style|Edit → Video|different visual style/i.test(item.text))
    .filter((item) => item.rect.width >= 160 && item.rect.width <= 360 && item.rect.height >= 70 && item.rect.height <= 150)
    .sort((a, b) => (a.rect.y - b.rect.y) || (a.rect.x - b.rect.x));
  const card = cards[0];
  if (!card) return { ok: false, error: 'Không tìm thấy container card Photo → Video.', candidates: all.filter((item) => /Photo|Video|Animate/i.test(item.text)).slice(0, 30).map((item) => ({ tag: item.tag, role: item.role, className: item.cls, text: item.text.slice(0, 180), box: { x: item.rect.x, y: item.rect.y, width: item.rect.width, height: item.rect.height } })) };
  const clickPoints = [
    { name: 'center', x: card.rect.x + card.rect.width / 2, y: card.rect.y + card.rect.height / 2 },
    { name: 'title-left', x: card.rect.x + 56, y: card.rect.y + 26 },
    { name: 'icon', x: card.rect.x + 22, y: card.rect.y + 26 },
  ];
  const hits = clickPoints.map((point) => {
    const hit = document.elementFromPoint(point.x, point.y);
    return { ...point, hitText: textOf(hit || document.body).slice(0, 160), hitTag: hit?.tagName || '' };
  });
  return { ok: true, selector: 'Photo → Video container', box: { x: card.rect.x, y: card.rect.y, width: card.rect.width, height: card.rect.height }, clickPoints, hits, text: card.text.slice(0, 220), tag: card.tag, role: card.role, className: card.cls };
}

function forceHideGrokTemplateModalScript() {
  const bodyText = document.body?.innerText || '';
  const open = /Choose a template type to begin|Name your template|Template Name|Photo\s*→\s*Video|Photo\s*→\s*Style Edit|Photo\s*→\s*Edit\s*→\s*Video/i.test(bodyText);
  if (!open) return { ok: false, reason: 'modal-not-open' };
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 10 && rect.height > 10 && rect.bottom > 0 && rect.right > 0;
  };
  const modalNodes = [...document.querySelectorAll('div, section, article, main, [role="dialog"], [class]')]
    .filter((node) => {
      if (!visible(node)) return false;
      const text = node.innerText || '';
      const hasTemplateChoice = /Choose a template type to begin/i.test(text) && /Photo\s*→\s*Video/i.test(text);
      const hasNameTemplateStep = /Name your template|Template Name|Add a description/i.test(text);
      return hasTemplateChoice || hasNameTemplateStep;
    })
    .map((node) => ({ node, rect: node.getBoundingClientRect(), text: node.innerText || '' }))
    .filter((item) => item.rect.width > 260 && item.rect.height > 120)
    .sort((a, b) => (a.rect.width * a.rect.height) - (b.rect.width * b.rect.height));
  const modal = modalNodes[0];
  const hidden = [];
  if (modal?.node) {
    let node = modal.node;
    for (let depth = 0; node && depth < 4; depth += 1) {
      const rect = node.getBoundingClientRect?.();
      const text = node.innerText || '';
      if (rect && /Choose a template type to begin|Name your template|Template Name|Add a description/i.test(text) && rect.width < window.innerWidth * 0.98 && rect.height < window.innerHeight * 0.98) {
        node.style.setProperty('display', 'none', 'important');
        node.style.setProperty('visibility', 'hidden', 'important');
        node.style.setProperty('pointer-events', 'none', 'important');
        hidden.push({ tag: node.tagName, className: String(node.className || '').slice(0, 120), box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } });
        break;
      }
      node = node.parentElement;
    }
  }
  [...document.querySelectorAll('div, [class]')].forEach((node) => {
    const rect = node.getBoundingClientRect?.();
    if (!rect || rect.width < window.innerWidth * 0.5 || rect.height < window.innerHeight * 0.5) return;
    const style = getComputedStyle(node);
    const looksBackdrop = Number(style.opacity || 1) > 0 && (style.backdropFilter !== 'none' || /blur|overlay|modal|dialog|backdrop/i.test(String(node.className || '')));
    if (!looksBackdrop) return;
    node.style.setProperty('display', 'none', 'important');
    node.style.setProperty('visibility', 'hidden', 'important');
    node.style.setProperty('pointer-events', 'none', 'important');
    hidden.push({ tag: node.tagName, className: String(node.className || '').slice(0, 120), backdrop: true, box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } });
  });
  document.body.style.pointerEvents = 'auto';
  document.documentElement.style.pointerEvents = 'auto';
  return { ok: hidden.length > 0, hidden, modal: modal ? { x: modal.rect.x, y: modal.rect.y, width: modal.rect.width, height: modal.rect.height } : null };
}

async function prepareGrokVideoComposerScript(config = {}) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const textOf = (node) => `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim();
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 4 && rect.height > 4 && rect.bottom > 0 && rect.right > 0;
  };
  const clickNode = (target) => {
    if (!target) return false;
    target.scrollIntoView({ block: 'center', inline: 'center' });
    target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    target.click();
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return true;
  };
  const buttons = [...document.querySelectorAll('button, [role="button"], a, label, div, span')].filter(visible);
  const videoTab = buttons.find((node) => /(^|\s)(Video|Motion)(\s|$)/i.test(textOf(node)) && !/Image|Photo/i.test(textOf(node)));
  clickNode(videoTab);
  await sleep(350);
  const path = location.pathname.toLowerCase();
  const isAgentCanvas = path.includes('/imagine/agent/') && path.length > '/imagine/agent/'.length;
  if (isAgentCanvas) return { ok: true, isAgentCanvas: true, status: 'already-canvas-video-mode', url: location.href };

  const emptyCanvasTextNode = buttons.find((node) => /(^|\s)Empty\s*Canvas(\s|$)/i.test(textOf(node)));
  const emptyCanvas = emptyCanvasTextNode?.closest?.('button, [role="button"], a, label') || emptyCanvasTextNode;
  if (!emptyCanvas) {
    const bodyText = document.body?.innerText || '';
    const hasGallery = /Select|Featured Templates|Discover|Upload Images|Create Worlds|Historical Stories/i.test(bodyText);
    if (hasGallery || path === '/imagine/agent' || path === '/imagine/agent/') {
      return { ok: false, isAgentCanvas: false, status: 'agent-gallery-no-empty-canvas', url: location.href, buttons: buttons.map((b) => textOf(b)).filter(Boolean).slice(0, 80) };
    }
    return { ok: false, isAgentCanvas: false, status: 'empty-canvas-button-not-found', url: location.href, buttons: buttons.map((b) => textOf(b)).filter(Boolean).slice(0, 80) };
  }
  clickNode(emptyCanvas);
  const started = Date.now();
  while (Date.now() - started < 5000) {
    await sleep(250);
    const nowPath = location.pathname.toLowerCase();
    if (nowPath.includes('/imagine/agent/') && nowPath.length > '/imagine/agent/'.length) {
      return { ok: true, isAgentCanvas: true, emptyCanvasClicked: true, status: 'clicked-empty-canvas', url: location.href };
    }
  }
  const rect = emptyCanvas.getBoundingClientRect?.();
  return { ok: false, isAgentCanvas: false, emptyCanvasClicked: true, status: 'clicked-but-no-navigation', url: location.href, emptyCanvasBox: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null };
}

function preparePixVerseComposerScript(config = {}) {
  const textOf = (node) => `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim();
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 4 && rect.height > 4;
  };
  const clickByText = (pattern) => {
    const nodes = [...document.querySelectorAll('button, [role="button"], label, div, span')].filter(visible);
    const target = nodes.find((node) => pattern.test(textOf(node)));
    if (target) {
      target.scrollIntoView({ block: 'center', inline: 'center' });
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      target.click();
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      return true;
    }
    return false;
  };
  clickByText(/Video/i);
  clickByText(/Image\s*(to|2)\s*Video|Image/i);
  if (config.resolution) clickByText(new RegExp(String(config.resolution).replace('P', '\\s*P'), 'i'));
  if (config.ratio) clickByText(new RegExp(String(config.ratio).replace(':', '\\s*[:：]\\s*'), 'i'));
  if (config.duration) clickByText(new RegExp(`${config.duration}\\s*s`, 'i'));
  if (config.model) clickByText(new RegExp(String(config.model).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'));
  const bodyText = document.body?.innerText || '';
  if (typeof config.previewMode === 'boolean') {
    const previewOn = /Preview Mode\s*[^\n]{0,30}(on|✓|checked)/i.test(bodyText);
    if (config.previewMode !== previewOn) clickByText(/Preview Mode/i);
  }
  if (typeof config.audio === 'boolean') {
    const audioOn = /Audio\s*[^\n]{0,20}(on|✓|checked)/i.test(bodyText);
    if (config.audio !== audioOn) clickByText(/Audio/i);
  }
  clickByText(/Reference|Upload|Image|Add image|\+/i);
  return { ok: true };
}

function setPixVersePromptScript(prompt) {
  const selectors = [
    'textarea[placeholder*="Describe"]',
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'div[class*="input"] textarea',
  ];
  const input = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
  if (!input) return { ok: false, error: 'Không tìm thấy ô Describe PixVerse.' };
  input.scrollIntoView({ block: 'center' });
  input.focus();
  input.click();
  if ('value' in input) {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.value = prompt;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, prompt);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
  }
  return { ok: true, selector: input.tagName };
}

function setGrokComposerTextScript(text) {
  const candidates = [...document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"], input')];
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 40 && rect.height > 16 && rect.left > window.innerWidth * 0.58 && rect.top > window.innerHeight * 0.45;
  };
  const target = candidates.filter(visible).sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
  if (!target) return { ok: false, error: 'composer-not-found' };
  target.focus?.();
  target.click?.();
  if ('value' in target) {
    target.value = text;
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    target.textContent = text;
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  }
  return { ok: true, text: String(target.value || target.textContent || '').slice(0, 120) };
}

function focusGrokComposerScript() {
  const selectors = [
    'textarea[placeholder*="imagine" i]',
    'textarea[placeholder*="Imagine" i]',
    'textarea[placeholder*="create" i]',
    '[contenteditable="true"]',
    '[role="textbox"]',
    'textarea',
  ];
  const candidates = selectors
    .flatMap((selector) => [...document.querySelectorAll(selector)])
    .filter((node) => {
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width <= 40 || rect.height <= 16) return false;
      // Motion prompt phải nhập ở chat composer panel phải, không nhập vào ô inline dưới image trên canvas.
      if (rect.left < window.innerWidth * 0.58) return false;
      if (rect.top < window.innerHeight * 0.45) return false;
      const text = (node.innerText || node.textContent || node.value || '').trim();
      if (text.length > 1200) return false;
      return true;
    })
    .map((node) => ({ node, rect: node.getBoundingClientRect(), label: `${node.getAttribute?.('placeholder') || ''} ${node.getAttribute?.('aria-label') || ''} ${node.textContent || ''}` }))
    .sort((a, b) => {
      const aInput = /message|ask|prompt|type|imagine|describe|create/i.test(a.label) ? 1 : 0;
      const bInput = /message|ask|prompt|type|imagine|describe|create/i.test(b.label) ? 1 : 0;
      if (aInput !== bInput) return bInput - aInput;
      return b.rect.bottom - a.rect.bottom;
    });
  const input = candidates[0]?.node;
  if (!input) return { ok: false, error: 'Không tìm thấy composer Grok để focus.' };
  input.scrollIntoView({ block: 'center', inline: 'center' });
  input.focus();
  input.click();
  return { ok: true };
}

function labelGrokCanvasScript(label) {
  const buttons = [...document.querySelectorAll('button, [role="button"], [contenteditable="true"], input')]
    .map((node) => ({ node, rect: node.getBoundingClientRect?.(), text: `${node.textContent || node.value || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim() }))
    .filter((item) => item.rect && item.rect.width > 30 && item.rect.height > 16 && item.rect.left < window.innerWidth * 0.45 && item.rect.top < 120);
  const titleButton = buttons.find((item) => /Untitled|SCENE|scene/i.test(item.text)) || buttons.find((item) => item.rect.left > 80 && item.rect.top < 120);
  if (!titleButton) return { ok: false, error: 'Không tìm thấy title/dropdown canvas để rename.', candidates: buttons.map((b) => b.text).slice(0, 12) };
  titleButton.node.click();
  const input = [...document.querySelectorAll('input, textarea, [contenteditable="true"]')]
    .map((node) => ({ node, rect: node.getBoundingClientRect?.() }))
    .filter((item) => item.rect && item.rect.width > 60 && item.rect.height > 18 && item.rect.top < 180)
    .sort((a, b) => b.rect.width - a.rect.width)[0]?.node;
  if (!input) return { ok: false, error: 'Đã mở title nhưng không thấy ô rename.', clicked: titleButton.text };
  input.focus();
  if ('value' in input) {
    input.value = label;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: label }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, label);
  }
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
  return { ok: true, label, clicked: titleButton.text };
}

function clearGrokCanvasChatScript() {
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .map((node) => ({ node, rect: node.getBoundingClientRect?.(), text: `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim() }))
    .filter((item) => item.rect && item.rect.width > 10 && item.rect.height > 10 && item.rect.left > window.innerWidth * 0.72);
  const newChat = buttons.find((item) => /^\s*New\s*Chat\s*$/i.test(item.text));
  if (!newChat) return { ok: false, error: 'no-new-chat-button', buttons: buttons.map((b) => b.text).slice(0, 20) };
  newChat.node.click();
  return { ok: true, mode: 'clicked-new-chat', text: newChat.text };
}

function clickGrokUploadImageMenuItemScript() {
  const items = [...document.querySelectorAll('button, [role="menuitem"], [role="button"], div, span')]
    .map((node) => ({
      node,
      rect: node.getBoundingClientRect?.(),
      text: `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim(),
    }))
    .filter((item) => item.rect && item.rect.width > 40 && item.rect.height > 16 && item.rect.top > 80 && item.rect.bottom < window.innerHeight - 40);
  const uploadImage = items.find((item) => /^\s*Upload\s*Image\s*$/i.test(item.text))
    || items.find((item) => /Upload\s*Image/i.test(item.text));
  if (!uploadImage) return { ok: false, error: 'Không thấy menu item Upload Image.', items: items.map((item) => ({ text: item.text, box: { x: item.rect.x, y: item.rect.y, w: item.rect.width, h: item.rect.height } })).slice(0, 40) };
  uploadImage.node.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: uploadImage.rect.x + 8, clientY: uploadImage.rect.y + 8 }));
  uploadImage.node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: uploadImage.rect.x + 8, clientY: uploadImage.rect.y + 8 }));
  uploadImage.node.click();
  uploadImage.node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: uploadImage.rect.x + 8, clientY: uploadImage.rect.y + 8 }));
  return { ok: true, text: uploadImage.text, box: { x: uploadImage.rect.x, y: uploadImage.rect.y, width: uploadImage.rect.width, height: uploadImage.rect.height } };
}

function clickGrokCanvasUploadImageScript() {
  const candidates = [...document.querySelectorAll('button, [role="button"], label')]
    .map((node) => ({
      node,
      rect: node.getBoundingClientRect?.(),
      text: `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim(),
      html: node.innerHTML || '',
    }))
    .filter((item) => item.rect && item.rect.width >= 20 && item.rect.height >= 20 && item.rect.left < window.innerWidth * 0.72 && item.rect.top > window.innerHeight * 0.55);
  const upload = candidates.find((item) => /Upload\s*Image|Add\s*Image|Image/i.test(item.text))
    || candidates.find((item) => /image|upload|plus|photo|picture/i.test(`${item.text} ${item.html}`));
  if (!upload) return { ok: false, error: 'Không tìm thấy nút Upload Image trong toolbar canvas.', candidates: candidates.map((c) => ({ text: c.text, box: c.rect ? { x: c.rect.x, y: c.rect.y, w: c.rect.width, h: c.rect.height } : null })).slice(0, 20) };
  upload.node.scrollIntoView({ block: 'center', inline: 'center' });
  upload.node.click();
  const rect = upload.node.getBoundingClientRect();
  return { ok: true, text: upload.text, box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
}

function focusGrokWorkspaceScript() {
  const viewport = { width: window.innerWidth || 1200, height: window.innerHeight || 800 };
  const candidates = [...document.querySelectorAll('canvas, [class*="canvas" i], [class*="workspace" i], [class*="stage" i], main, body')]
    .map((node) => ({ node, rect: node.getBoundingClientRect?.() }))
    .filter((item) => item.rect && item.rect.width > viewport.width * 0.35 && item.rect.height > viewport.height * 0.35)
    .sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height));
  const target = candidates[0]?.node || document.body;
  const rect = target.getBoundingClientRect?.() || { left: 0, top: 0, width: viewport.width * 0.7, height: viewport.height };
  const x = Math.min(rect.left + rect.width * 0.5, viewport.width * 0.65);
  const y = Math.min(rect.top + rect.height * 0.5, viewport.height * 0.55);
  const el = document.elementFromPoint(x, y) || target;
  el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
  return { ok: true, mode: 'workspace-click', point: { x, y }, target: el.tagName, className: String(el.className || '').slice(0, 120) };
}

function detectUploadedAssetScript() {
  const bodyText = document.body?.innerText || '';
  const images = [...document.querySelectorAll('img, canvas, video')]
    .map((node) => {
      const rect = node.getBoundingClientRect?.();
      return { tag: node.tagName, width: rect?.width || 0, height: rect?.height || 0, top: rect?.top || 0, left: rect?.left || 0, src: node.currentSrc || node.src || '' };
    })
    .filter((item) => item.width >= 24 && item.height >= 24 && item.top > 40);
  const fileInputs = [...document.querySelectorAll('input[type="file"]')].map((input) => ({ files: input.files?.length || 0, accept: input.accept || '' }));
  const hasFileName = /\.png|\.jpe?g|\.mp4|\.webm|\.mov|image uploaded|video uploaded|upload complete|remove image|remove video|attached|ảnh|video/i.test(bodyText);
  const canvasImages = images.filter((item) => item.left < window.innerWidth * 0.78 || item.tag === 'CANVAS');
  const hasPreview = canvasImages.length > 0;
  const hasInputFile = fileInputs.some((input) => input.files > 0);
  if (hasPreview || hasInputFile || hasFileName) return { ok: true, hasPreview, hasInputFile, hasFileName, images, canvasImages, fileInputs };
  return { ok: false, error: 'Chưa thấy ảnh được paste vào workspace/canvas Grok sau Ctrl+V.', images, fileInputs, sampleText: bodyText.slice(-1000) };
}

function setGrokVideoPromptScript(prompt) {
  const selectors = [
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="Describe"]',
    'textarea[placeholder*="create" i]',
    'textarea',
    '#prompt-textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
  ];
  const candidates = selectors
    .flatMap((selector) => [...document.querySelectorAll(selector)])
    .filter((node) => {
      const rect = node.getBoundingClientRect?.();
      return rect && rect.width > 80 && rect.height > 20;
    })
    .map((node) => ({ node, rect: node.getBoundingClientRect(), label: `${node.getAttribute?.('placeholder') || ''} ${node.getAttribute?.('aria-label') || ''} ${node.textContent || ''}` }))
    .sort((a, b) => {
      const aImagine = /imagine/i.test(a.label) ? 1 : 0;
      const bImagine = /imagine/i.test(b.label) ? 1 : 0;
      if (aImagine !== bImagine) return bImagine - aImagine;
      return b.rect.top - a.rect.top;
    });
  const input = candidates[0]?.node;
  if (!input) return { ok: false, error: 'Không tìm thấy ô nhập prompt của Grok.' };
  input.scrollIntoView({ block: 'center' });
  input.focus();
  input.click();
  if ('value' in input) {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.value = prompt;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, prompt);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
  }
  return { ok: true, selector: input.tagName || input.getAttribute('role') || 'textbox' };
}

function detectGrokConfirmationQuestionScript() {
  const text = document.body?.innerText || '';
  const tail = text.slice(-3000);
  const asked = /Bạn muốn tôi sử dụng prompt này để tạo video|Hãy xác nhận để tôi tiến hành generate|Would you like me to use this prompt|confirm.*generate|generate.*now/i.test(tail);
  const echoedMotionPrompt = /DÒNG\s*1|DÒNG\s*2|DÒNG\s*7|Negative\s*Prompt|Technical\s*Specifications/i.test(tail)
    && /MOTION\s*PROMPT|VIDEO\s*10|keyframe|8K|NO\s*MUSIC/i.test(tail);
  const hasVideo = /\.mp4|video generated|download|play video|regenerate/i.test(tail);
  return {
    shouldConfirm: (asked || echoedMotionPrompt) && !hasVideo,
    asked,
    echoedMotionPrompt,
    hasVideo,
    reason: asked ? 'asked-confirmation' : echoedMotionPrompt ? 'echoed-motion-prompt' : hasVideo ? 'video-present' : 'no-confirm-needed',
    tail,
  };
}

function detectGrokUploadStateScript() {
  const bodyText = document.body?.innerText || '';
  const uploading = /Uploading|Đang tải|uploading/i.test(bodyText);
  const visibleUploading = [...document.querySelectorAll('div, span, button')]
    .some((node) => {
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width < 10 || rect.height < 10 || rect.bottom < 0 || rect.right < 0) return false;
      return /Uploading|Đang tải|uploading/i.test(node.textContent || '');
    });
  return { ok: true, uploading: uploading || visibleUploading };
}

function clickGrokComposerAreaScript() {
  const candidates = [...document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"], input')];
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 30 && rect.height > 20 && rect.bottom > 0 && rect.right > 0;
  };
  const target = candidates.filter(visible).sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
  if (!target) return { ok: false, error: 'composer-not-found' };
  target.scrollIntoView({ block: 'center', inline: 'center' });
  target.focus?.();
  target.click?.();
  return { ok: true, tag: target.tagName, text: String(target.textContent || target.value || '').slice(0, 80) };
}

function forceGrokVideoModeScript() {
  const textOf = (node) => `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim();
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 8 && rect.height > 8 && rect.bottom > 0 && rect.right > 0;
  };
  const nodes = [...document.querySelectorAll('button, [role="tab"], [role="button"], label, div, span')].filter(visible);
  const motionTab = nodes.find((node) => /(^|\s)(Motion|Video)(\s|$)/i.test(textOf(node)) && !/Image|Photo|Ảnh/i.test(textOf(node)));
  if (!motionTab) return { ok: false, status: 'video-mode-button-not-found', buttons: nodes.map(textOf).filter(Boolean).slice(0, 80) };
  motionTab.scrollIntoView({ block: 'center', inline: 'center' });
  motionTab.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  motionTab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  motionTab.click();
  motionTab.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  return { ok: true, status: 'clicked-video-motion-mode', text: textOf(motionTab) };
}

function detectGrokGenerationProblemScript() {
  const bodyText = document.body?.innerText || '';
  const tail = bodyText.slice(-5000);
  const buttons = [...document.querySelectorAll('button, [role="button"]')]
    .map((node) => {
      const rect = node.getBoundingClientRect?.();
      const text = `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim();
      return { node, rect, text };
    })
    .filter((item) => item.rect && item.rect.width > 10 && item.rect.height > 10);
  const retry = buttons.find((item) => /(^|\s)(Retry|Try again|Thử lại|Gửi lại)(\s|$)/i.test(item.text));
  const unable = /Grok was unable to finish replying|unable to finish replying|couldn'?t finish|Something went wrong|try again/i.test(tail);
  const limit = /Video generation hiện đang gặp giới hạn|generation.*limit|rate limit|too many requests|limit được reset|quota|usage limit|come back later|try again later/i.test(tail);
  return {
    ok: true,
    kind: limit ? 'limit' : unable || retry ? 'unable-finish' : '',
    hasRetry: Boolean(retry),
    retryBox: retry?.rect ? { x: retry.rect.x, y: retry.rect.y, width: retry.rect.width, height: retry.rect.height } : null,
    retryText: retry?.text || '',
    tail,
  };
}

async function clickGrokRetryButton(client, state = null) {
  const current = state || await evaluateOnCdpPage(client, `(${detectGrokGenerationProblemScript.toString()})()`).catch(() => null);
  if (!current?.retryBox) return { ok: false, error: 'Không thấy nút Retry Grok.' };
  const x = current.retryBox.x + current.retryBox.width / 2;
  const y = current.retryBox.y + current.retryBox.height / 2;
  await client.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y, button: 'none' }).catch(() => null);
  await client.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 }).catch(() => null);
  await client.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }).catch(() => null);
  return { ok: true, mode: 'clicked-retry', point: { x, y }, retryText: current.retryText };
}

function clickGrokGenerateScript() {
  const nodes = [...document.querySelectorAll('button, [role="button"]')];
  const input = document.activeElement;
  const button = nodes.find((item) => {
    if (item.disabled || item.getAttribute('aria-disabled') === 'true') return false;
    const rect = item.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 20) return false;
    
    const inputRect = input?.getBoundingClientRect?.();
    const isNearInput = inputRect && rect.top > inputRect.top - 80 && rect.top < inputRect.bottom + 80 && rect.left > inputRect.left - 40;
    const isComposerSubmit = rect.left > window.innerWidth * 0.72 && rect.top > window.innerHeight * 0.72;
    if (!isNearInput && !isComposerSubmit) return false;

    const text = `${item.textContent || ''} ${item.getAttribute('aria-label') || ''} ${item.title || ''} ${item.dataset?.testid || ''}`.trim();
    if (/Agent\s*\(?Beta\)?|Create\s*Worlds|Historical\s*Stories|Short\s*Film|UGC\s*Product|^\s*(Image|Video|480p|720p|6s|10s)\s*$/i.test(text)) return false;
    
    const html = item.innerHTML || '';
    const hasSendIcon = /arrow-up|send-icon|paper-plane/i.test(html);
    return /^(Generate|Create|Start|Send|Submit|gửi|Imagine)$/i.test(text) || (text === '' && hasSendIcon);
  });
  if (!button) {
    if (input) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
      return { ok: true, selector: 'enter-fallback' };
    }
    return { ok: false, error: 'Không tìm thấy nút Generate/Create/Send Grok đang enabled.' };
  }
  button.scrollIntoView({ block: 'center', inline: 'center' });
  button.focus();
  button.click();
  const rect = button.getBoundingClientRect();
  return { ok: true, selector: button.textContent || button.getAttribute('aria-label') || 'Grok generate', box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
}

function prepareChatGptCreateImageScript() {
  const textOf = (node) => `${node.textContent || ''} ${node.getAttribute?.('aria-label') || ''} ${node.title || ''}`.trim();
  const visible = (node) => {
    const rect = node.getBoundingClientRect?.();
    return rect && rect.width > 4 && rect.height > 4;
  };
  const clickNode = (node) => {
    node.scrollIntoView({ block: 'center', inline: 'center' });
    node.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    node.click();
    node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  };
  const plus = [...document.querySelectorAll('button, [role="button"]')]
    .filter(visible)
    .find((node) => /Add files and more|Attach|Add|\+/i.test(textOf(node)) || (node.getBoundingClientRect().width <= 60 && /svg|path/i.test(node.innerHTML || '')));
  if (plus) clickNode(plus);
  const startedAt = Date.now();
  while (Date.now() - startedAt < 1500) {
    const createImage = [...document.querySelectorAll('button, [role="menuitem"], [role="option"], div, span')]
      .filter(visible)
      .find((node) => /Create image|Tạo ảnh|Generate image/i.test(textOf(node)));
    if (createImage) {
      clickNode(createImage);
      return { ok: true, mode: 'create-image-menu' };
    }
  }
  return { ok: Boolean(plus), mode: plus ? 'plus-opened-no-create-image-item' : 'no-plus-found' };
}

function clickPixVerseCreateScript() {
  const nodes = [...document.querySelectorAll('button, [role="button"]')];
  const createButton = nodes.find((button) => {
    if (button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
    const rect = button.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 24) return false;
    const text = `${button.textContent || ''} ${button.getAttribute('aria-label') || ''} ${button.title || ''}`;
    return /Create|Generate|Start/i.test(text);
  });
  if (!createButton) return { ok: false, error: 'Không tìm thấy nút Create PixVerse đang enabled.' };
  createButton.scrollIntoView({ block: 'center', inline: 'center' });
  createButton.click();
  const rect = createButton.getBoundingClientRect();
  return { ok: true, selector: createButton.textContent || createButton.getAttribute('aria-label') || 'Create', box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
}

function readLatestAssistantScript() {
  const stopButton = [...document.querySelectorAll('button')].some((button) => /stop|dừng|generating/i.test(`${button.textContent || ''} ${button.getAttribute('aria-label') || ''}`));
  const nodes = [...document.querySelectorAll('[data-message-author-role="assistant"], article, .message, [class*="response"], [class*="markdown"]')]
    .filter((node) => (node.innerText || '').trim().length > 20);
  const last = nodes.at(-1);
  return {
    count: nodes.length,
    text: last ? last.innerText.trim() : '',
    generating: stopButton,
  };
}

function readChatGptImageStateScript() {
  const bodyText = document.body?.innerText || '';
  const buttonText = [...document.querySelectorAll('button')]
    .map((button) => `${button.textContent || ''} ${button.getAttribute('aria-label') || ''} ${button.title || ''}`.trim())
    .filter(Boolean)
    .join(' | ');
  const generating = /stop|dừng|generating/i.test(buttonText);
  const preparingImage = /preparing image|creating image|generating image|đang tạo ảnh|đang chuẩn bị ảnh/i.test(bodyText);
  const voiceReady = /voice|mic|microphone|record|dictate/i.test(buttonText);
  const urls = [...document.querySelectorAll('img, picture source')]
    .filter((node) => {
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width < 180 || rect.height < 120) return false;
      const label = `${node.alt || ''} ${node.getAttribute?.('aria-label') || ''} ${node.className || ''}`;
      return !/avatar|profile|logo|icon|emoji/i.test(label);
    })
    .map((node) => node.currentSrc || node.src || node.getAttribute('srcset') || node.getAttribute('src') || '')
    .filter((url) => /^https?:|^blob:|^data:image\//i.test(url));
    
  const customBoxes = [...document.querySelectorAll('div, button, canvas')]
    .filter((node) => {
      const rect = node.getBoundingClientRect?.();
      if (!rect || rect.width < 180 || rect.height < 120 || rect.width > window.innerWidth * 0.9) return false;
      const text = node.innerText || '';
      return /Generated image/i.test(text) || node.tagName === 'CANVAS';
    })
    .map((node) => `chatgpt-custom-box-y${Math.round(node.getBoundingClientRect().y)}`);
    
  urls.push(...customBoxes);
  const assistantNodes = [...document.querySelectorAll('[data-message-author-role="assistant"], article, .message, [class*="response"], [class*="markdown"]')]
    .filter((node) => (node.innerText || '').trim().length > 20);
  const latestAssistantText = assistantNodes.at(-1)?.innerText?.trim() || '';
  return {
    generating,
    preparingImage,
    voiceReady,
    buttonText,
    urls,
    assistantCount: assistantNodes.length,
    latestAssistantText,
  };
}

async function exportProject(_event, payload) {
  const result = await dialog.showSaveDialog({
    title: 'Export project JSON',
    defaultPath: `${sanitizeFileName(payload?.project?.name || 'ai-scene-project')}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  const jsonPath = result.filePath;
  const csvPath = jsonPath.replace(/\.json$/i, '.csv');
  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  if (payload?.csv) {
    await fs.writeFile(csvPath, payload.csv, 'utf8');
  }
  return { jsonPath, csvPath };
}

function sanitizeFileName(value) {
  return String(value).replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, '-').slice(0, 80) || 'ai-scene-project';
}

app.whenReady().then(() => {
  ipcMain.handle('app:append-log', appendAppLog);
  ipcMain.handle('app:get-log-path', getAppLogPath);
  ipcMain.handle('view:get-pipeline-log-visible', getPipelineLogVisibility);
  ipcMain.handle('browser:open-login', openWebLogin);
  ipcMain.handle('browser:check-login', checkWebLogin);
  ipcMain.handle('browser:send-prompt', sendPromptViaWeb);
  ipcMain.handle('pipeline:run-scene', runScenePipeline);
  ipcMain.handle('output:choose-folder', chooseOutputFolder);
  ipcMain.handle('folder:choose', chooseFolder);
  ipcMain.handle('folder:scan', scanFolder);
  ipcMain.handle('video:extract-last-frame', extractLastFrame);
  ipcMain.handle('video:merge', mergeVideos);
  ipcMain.handle('video:export-final', exportFinalVideo);
  ipcMain.handle('image:copy-to-clipboard', copyImageToClipboard);
  ipcMain.handle('asset:exists', checkAssetExists);
  ipcMain.handle('frame:get-previous', getPreviousFrame);
  ipcMain.handle('ai:split-prompt', splitPromptWithAI);
  ipcMain.handle('ai:generate-scene-prompts', generateScenePrompts);
  ipcMain.handle('project:export', exportProject);

  buildAppMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  closeChromeDebug().catch(() => null);
});

process.on('exit', () => {
  if (chromeProcess?.pid) {
    try { process.kill(chromeProcess.pid); } catch (_error) {}
  }
});
