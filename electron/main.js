const { execFileSync, spawn } = require('child_process');
const { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage } = require('electron');
const CDP = require('chrome-remote-interface');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs/promises');
const path = require('path');

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v']);
const webWindows = new Map();
const PROVIDER_META = {
  chatgpt: { url: 'https://chatgpt.com/', title: 'ChatGPT', partition: 'chatgpt-web-session' },
  grok: { url: 'https://grok.com/', title: 'Grok', partition: 'grok-web-session' },
};
const WEB_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CHROME_DEBUG_PORT = 9223;
const CHROME_CDP_HOST = `http://127.0.0.1:${CHROME_DEBUG_PORT}`;
const CHROME_USER_DATA_DIR = path.join(app.getPath('userData'), 'chrome-cdp-profile');
let chromeProcess = null;

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

async function openWebLogin(_event, provider) {
  const normalizedProvider = normalizeWebProvider(provider);
  const targetUrl = PROVIDER_META[normalizedProvider]?.url || PROVIDER_META.chatgpt.url;
  await ensureChromeDebug(targetUrl);
  return { ok: true, url: targetUrl, profilePath: CHROME_USER_DATA_DIR, port: CHROME_DEBUG_PORT };
}

function normalizeWebProvider(provider) {
  return provider === 'grok' ? 'grok' : 'chatgpt';
}

async function ensureChromeDebug(openUrl) {
  if (await isChromeDebugReady()) {
    if (openUrl) await openCdpTab(openUrl);
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

  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  const files = await Promise.all(entries
    .filter((entry) => entry.isFile())
    .filter((entry) => VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map(async (entry) => {
      const fullPath = path.join(folderPath, entry.name);
      const stat = await fs.stat(fullPath);
      return {
        name: entry.name,
        path: fullPath,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        sceneNumber: getSceneNumber(entry.name),
      };
    }));

  return files.sort((a, b) => {
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
    throw new Error('Folder chưa có video đặt tên theo số.');
  }

  const outputPath = path.join(folderPath, 'master_video.mp4');
  await mergeVideoFiles(videos, outputPath);

  return {
    outputPath,
    count: videos.length,
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
  const state = await evaluateOnCdpPage(page, `(${detectLoginScript.toString()})(${JSON.stringify(normalizedProvider)})`);
  if (!state.loggedIn) {
    await openCdpTab(PROVIDER_META[normalizedProvider].url);
  }
  return { ...state, cdp: true, port: CHROME_DEBUG_PORT, profilePath: CHROME_USER_DATA_DIR };
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
    await openCdpTab(PROVIDER_META[normalizedProvider].url);
    throw new Error(`${PROVIDER_META[normalizedProvider].title} chưa đăng nhập trong Chrome debug. Hãy login ở cửa sổ Chrome vừa mở rồi chạy lại.`);
  }

  const beforeCount = await evaluateOnCdpPage(page, `(${countAssistantMessagesScript.toString()})()`);
  const sent = await evaluateOnCdpPage(page, `(${sendPromptScript.toString()})(${JSON.stringify(prompt)})`);
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

async function getCdpPage(provider, createIfMissing = true) {
  await ensureChromeDebug();
  const meta = PROVIDER_META[provider] || PROVIDER_META.chatgpt;
  const targets = await CDP.List({ host: '127.0.0.1', port: CHROME_DEBUG_PORT });
  const pageTarget = targets
    .filter((target) => target.type === 'page')
    .find((target) => target.url?.includes(new URL(meta.url).hostname));

  const target = pageTarget || (createIfMissing ? await openCdpTab(meta.url) : null);
  if (!target) {
    throw new Error(`Không tìm thấy tab ${meta.title}.`);
  }

  const client = await CDP({ target, host: '127.0.0.1', port: CHROME_DEBUG_PORT });
  await client.Page.enable();
  await client.Runtime.enable();
  await waitForCdpLoad(client);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function detectLoginScript(provider) {
  const bodyText = document.body?.innerText || '';
  const hasComposer = Boolean(document.querySelector('textarea, div[contenteditable="true"], [data-testid="composer"]'));
  const loginWords = provider === 'grok'
    ? /sign in|log in|đăng nhập|continue with/i
    : /log in|sign up|sign in|đăng nhập|continue/i;
  const loggedOut = loginWords.test(bodyText) && !hasComposer;
  return {
    provider,
    loggedIn: hasComposer && !loggedOut,
    hasComposer,
    url: location.href,
    title: document.title,
  };
}

function countAssistantMessagesScript() {
  return document.querySelectorAll('[data-message-author-role="assistant"], article, .message, [class*="response"]').length;
}

function sendPromptScript(prompt) {
  const input = document.querySelector('textarea')
    || document.querySelector('div[contenteditable="true"]')
    || document.querySelector('[data-testid="composer"] [contenteditable="true"]')
    || document.querySelector('[role="textbox"]');
  if (!input) return { ok: false, error: 'Không tìm thấy ô nhập prompt.' };

  input.focus();
  if (input.tagName === 'TEXTAREA') {
    input.value = prompt;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, prompt);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
  }

  const sendButton = [...document.querySelectorAll('button')].find((button) => {
    const label = `${button.getAttribute('aria-label') || ''} ${button.textContent || ''} ${button.dataset?.testid || ''}`;
    return /send|submit|gửi|arrow-up|composer-submit/i.test(label) && !button.disabled;
  }) || document.querySelector('button[data-testid="send-button"], button[data-testid="composer-submit-button"]');

  if (sendButton && !sendButton.disabled) {
    sendButton.click();
    return { ok: true, mode: 'button' };
  }

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
  return { ok: true, mode: 'enter' };
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
  ipcMain.handle('browser:open-login', openWebLogin);
  ipcMain.handle('browser:check-login', checkWebLogin);
  ipcMain.handle('browser:send-prompt', sendPromptViaWeb);
  ipcMain.handle('output:choose-folder', chooseOutputFolder);
  ipcMain.handle('folder:choose', chooseFolder);
  ipcMain.handle('folder:scan', scanFolder);
  ipcMain.handle('video:extract-last-frame', extractLastFrame);
  ipcMain.handle('video:merge', mergeVideos);
  ipcMain.handle('video:export-final', exportFinalVideo);
  ipcMain.handle('image:copy-to-clipboard', copyImageToClipboard);
  ipcMain.handle('frame:get-previous', getPreviousFrame);
  ipcMain.handle('ai:split-prompt', splitPromptWithAI);
  ipcMain.handle('ai:generate-scene-prompts', generateScenePrompts);
  ipcMain.handle('project:export', exportProject);

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
