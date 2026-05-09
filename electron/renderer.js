const projectForm = document.querySelector('#project-form');
const projectNameInput = document.querySelector('#project-name');
const storyInput = document.querySelector('#story-input');
const scriptInput = document.querySelector('#script-input');
const batchSizeInput = document.querySelector('#batch-size');
const durationInput = document.querySelector('#duration-sec');
const providerSelect = document.querySelector('#provider-select');
const accountSelect = document.querySelector('#account-select');
const modelInput = document.querySelector('#model-input');
const apiKeyInput = document.querySelector('#api-key-input');
const runBatchBtn = document.querySelector('#run-batch-btn');
const pauseBtn = document.querySelector('#pause-btn');
const resumeBtn = document.querySelector('#resume-btn');
const exportBtn = document.querySelector('#export-btn');
const approveBatchBtn = document.querySelector('#approve-batch-btn');
const regenerateBatchBtn = document.querySelector('#regenerate-batch-btn');
const openChatGptBtn = document.querySelector('#open-chatgpt-btn');
const openGrokBtn = document.querySelector('#open-grok-btn');
const checkLoginBtn = document.querySelector('#check-login-btn');
const chooseOutputFolderBtn = document.querySelector('#choose-output-folder-btn');
const sendWebBatchBtn = document.querySelector('#send-web-batch-btn');
const webSessionStatus = document.querySelector('#web-session-status');
const sceneTableBody = document.querySelector('#scene-table-body');
const statusText = document.querySelector('#status-text');
const runState = document.querySelector('#run-state');
const metricScenes = document.querySelector('#metric-scenes');
const metricApproved = document.querySelector('#metric-approved');
const metricBatch = document.querySelector('#metric-batch');
const editorDialog = document.querySelector('#editor-dialog');
const dialogTitle = document.querySelector('#dialog-title');
const editorTextarea = document.querySelector('#editor-textarea');
const saveEditBtn = document.querySelector('#save-edit-btn');

const STORAGE_KEY = 'ai-scene-batch-director:v1';
const IMAGE_PROMPT_RULES = `NHIỆM VỤ 1 — TẠO ẢNH KEYFRAME ĐẦU SCENE:\n- Nhập vai đạo diễn live action IQ/EQ cao, dựng hiện trường ảnh chuyên nghiệp.\n- Đọc story tổng, character bible, scene trước, scene hiện tại và scene sau nếu cần.\n- Xác định hành động đầu tiên của scene, tạo ảnh giai đoạn chuẩn bị diễn ra hành động đó.\n- Continuity 1-1: tạo hình, trang phục, cơ thể, mặt, đạo cụ, bối cảnh giữ chính xác qua các scene trừ khi kịch bản yêu cầu đổi.\n- Ảnh phải là 1 frame 16:9, 8K ultra-realistic live action, wide/master shot ưu tiên, sạch rõ, không text/logo/watermark.\n- Spatial Lock: khóa vị trí nhân vật/đạo cụ để đủ đất diễn cho motion 10s.\n- Nếu là POV: chỉ hiện tay/chân/vai ngoại vi, không render mặt/thân chủ thể POV.`;

const MOTION_PROMPT_RULES = `NHIỆM VỤ 2 — TẠO PROMPT VIDEO 10 GIÂY TỪ KEYFRAME:\n- Viết tiếng Việt kiểu đạo diễn tường thuật trực tiếp tại hiện trường.\n- Chỉ mô tả thứ có trong keyframe hoặc có thể thấy khi camera di chuyển logic từ keyframe.\n- Không dùng từ yếu/nhẹ/chậm nếu scene kịch tính; thay bằng mạnh, rõ, dứt khoát, dữ dội, đột ngột.\n- Mọi hành động phải hoàn thành 100%, có payoff rõ, không dừng ở trạng thái đang làm.\n- Âm thanh diegetic to rõ, không nhạc nền, không soundtrack, không voice-over.\n- Format 7 dòng bắt buộc: Dòng 1 tổng quát khung hình; Dòng 2 nội dung chuyển động chính; Dòng 3 chuyển động phụ; Dòng 4 âm thanh; Dòng 5 câu chốt live action vật lý thật; Dòng 6 technical specs; Dòng 7 negative prompt.`;

const STORY_RULES = `QUY TẮC BIÊN KỊCH MẪU:\n- HARD RULE 1-1-2: mỗi scene chỉ 1 ý chính và tối đa 1-2 chuyển động chính.\n- Mọi thứ phải có nguồn gốc rõ, precursor/witness, không tự nhiên xuất hiện.\n- Mạch nối nhân quả: muốn đổi bối cảnh phải có động cơ rời cảnh và vật dẫn vật lý.\n- Continuity state: vết thương, trang phục, đạo cụ, cảm xúc được bảo toàn.\n- CTR upgrade: chọn phiên bản cinematic, cảm xúc, bất ngờ hơn nhưng vẫn logic.\n- Bối cảnh là đất diễn tương tác; tận dụng vật thể có mặt để hành động thông minh.`;

let project = null;
let activeBatchIds = [];
let paused = false;
let editTarget = null;
let outputFolder = '';

function createProject(event) {
  event.preventDefault();
  const story = storyInput.value.trim();
  const script = scriptInput.value.trim();
  if (!story || !script) {
    setStatus('Cần nhập đủ cốt truyện tổng và kịch bản scene.', 'error');
    return;
  }

  const scenes = parseScenes(script).map((text, index, list) => ({
    id: index + 1,
    original: text,
    previous: list[index - 1] || '',
    next: list[index + 1] || '',
    status: 'queued',
    imagePrompt: '',
    motionPrompt: '',
    provider: '',
    account: '',
    updatedAt: new Date().toISOString(),
  }));

  project = {
    id: crypto.randomUUID(),
    name: projectNameInput.value.trim() || 'Untitled project',
    story,
    scenes,
    batchSize: clamp(Number(batchSizeInput.value) || 10, 1, 10),
    durationSec: Math.max(1, Number(durationInput.value) || 10),
    createdAt: new Date().toISOString(),
  };
  activeBatchIds = [];
  paused = false;
  persist();
  render();
  setStatus(`Đã parse ${scenes.length} scene. Bấm Run batch kế tiếp để tạo prompt 10 scene đầu.`, 'ok');
}

function parseScenes(script) {
  const normalized = script.replace(/\r\n/g, '\n').trim();
  const regex = /(?:^|\n)\s*(?:SCENE|Scene|scene|CẢNH|Cảnh|cảnh)\s*\d+\s*[:.\-–]?/g;
  const matches = [...normalized.matchAll(regex)];
  if (matches.length >= 2) {
    return matches.map((match, index) => {
      const start = match.index + match[0].length;
      const end = matches[index + 1]?.index ?? normalized.length;
      const header = match[0].trim();
      const body = normalized.slice(start, end).trim();
      return `${header} ${body}`.trim();
    }).filter(Boolean);
  }

  return normalized.split(/\n\s*\n+/).map((part) => part.trim()).filter(Boolean);
}

async function runNextBatch({ regenerate = false } = {}) {
  if (!project || paused) return;
  setRunning(true);
  const candidates = regenerate && activeBatchIds.length
    ? project.scenes.filter((scene) => activeBatchIds.includes(scene.id))
    : project.scenes.filter((scene) => ['queued', 'error'].includes(scene.status));
  const batch = candidates.slice(0, project.batchSize);
  activeBatchIds = batch.map((scene) => scene.id);

  if (!batch.length) {
    setRunning(false);
    setStatus('Không còn scene queued/error để chạy. Có thể export kết quả.', 'ok');
    render();
    return;
  }

  setStatus(`Đang tạo batch ${activeBatchIds[0]}-${activeBatchIds.at(-1)} bằng ${providerSelect.value}/${accountSelect.value}...`, 'running');
  for (const scene of batch) {
    if (paused) break;
    scene.status = 'running';
    render();
    try {
      const aiResult = await generateWithProvider(scene);
      scene.imagePrompt = aiResult?.imagePrompt || buildImagePrompt(scene);
      scene.motionPrompt = aiResult?.motionPrompt || buildMotionPrompt(scene);
      scene.status = 'waiting_review';
      scene.provider = providerSelect.value;
      scene.account = accountSelect.value;
      scene.updatedAt = new Date().toISOString();
    } catch (error) {
      scene.status = 'error';
      scene.error = error.message;
      scene.imagePrompt = scene.imagePrompt || buildImagePrompt(scene);
      scene.motionPrompt = scene.motionPrompt || buildMotionPrompt(scene);
      paused = true;
      setStatus(`Scene ${scene.id} lỗi: ${error.message}. Đổi account rồi Resume.`, 'error');
      break;
    }
    persist();
    render();
  }

  setRunning(false);
  if (!paused) {
    setStatus(`Batch ${activeBatchIds[0]}-${activeBatchIds.at(-1)} đang chờ review. Sửa/regenerate/approve trước khi chạy tiếp.`, 'ok');
  }
  render();
}

async function generateWithProvider(scene) {
  if (!window.videoPlannerAPI?.generateScenePrompts) {
    return null;
  }
  return window.videoPlannerAPI.generateScenePrompts({
    provider: providerSelect.value,
    account: accountSelect.value,
    apiKey: apiKeyInput.value,
    model: modelInput.value,
    projectName: project.name,
    story: project.story,
    scene,
    durationSec: project.durationSec,
    imageRules: IMAGE_PROMPT_RULES,
    motionRules: MOTION_PROMPT_RULES,
    storyRules: STORY_RULES,
  });
}

function buildImagePrompt(scene) {
  return [
    `IMAGE PROMPT — SCENE ${scene.id} — KEYFRAME ĐẦU CẢNH`,
    `Project: ${project.name}`,
    `Global story context: ${project.story}`,
    scene.previous ? `Scene trước để giữ continuity: ${scene.previous}` : 'Scene trước: không có, đây là cảnh mở đầu.',
    `Scene hiện tại: ${scene.original}`,
    scene.next ? `Scene sau để định hướng nối mạch: ${scene.next}` : 'Scene sau: không có hoặc chưa cần.',
    IMAGE_PROMPT_RULES,
    'OUTPUT BẮT BUỘC: Viết prompt ảnh duy nhất 16:9. Mô tả rõ vị trí nhân vật, đạo cụ, bối cảnh, góc máy, ánh sáng mạnh trong trẻo, trạng thái chuẩn bị diễn hành động đầu tiên. Không giải thích ngoài prompt.',
  ].join('\n\n');
}

function buildMotionPrompt(scene) {
  return [
    `MOTION PROMPT — SCENE ${scene.id} — VIDEO ${project.durationSec} GIÂY TỪ KEYFRAME`,
    `Căn cứ keyframe/image prompt: ${scene.imagePrompt || 'dùng ảnh keyframe vừa tạo cho scene này'}`,
    `Scene hiện tại: ${scene.original}`,
    MOTION_PROMPT_RULES,
    'DÒNG 1: TỔNG QUÁT KHUNG HÌNH: liệt kê tạo hình nhân vật/đạo cụ/bối cảnh thấy được, không dùng tên riêng nhân vật.',
    'DÒNG 2: NỘI DUNG VIDEO CHUYỂN ĐỘNG: mô tả chuỗi hành động chính theo nhân quả, bắt đầu chính xác từ keyframe, tối đa 1-2 chuyển động chính, hành động hoàn tất 100%.',
    'DÒNG 3: CHUYỂN ĐỘNG PHỤ: mô tả các vật thể, môi trường, phản ứng phụ thật sự nằm trong khung hình.',
    'DÒNG 4: ÂM THANH: foley + môi trường + tiếng nhân vật/động vật nếu có; MỌI ÂM THANH NỀN Ở BỐI CẢNH VIDEO VÀ MỌI VẬT THỂ đang chuyển động TRONG VIDEO Bắt buộc TẠO ÂM THANH VIDEO PHẢI TO VÀ RÕ RÀNG NHƯ ĐANG BẬT FULL 100% VOLUME LOA.',
    'DÒNG 5: VIDEO TẠO RA ĐÃ ĐẠT ĐƯỢC TẤT CẢ CÁC YÊU CẦU, diễn xuất đúng prompt, chuyển động mượt như phim live action, tuân theo vật lý đời thực, không sáng tạo thêm ngoài prompt.',
    'DÒNG 6: Technical Specifications: 8K ultra-realistic, extreme sharp details, real-world gravity, authentic cloth and fur simulation, consistent powerful natural daylight, high dynamic range (HDR), hyper-smooth 240 FPS motion, organic motion blur only where physically correct. Live action cinematic quality, razor-sharp, true-to-life textures.',
    'DÒNG 7: Negative Prompt: low quality, blurry, out of focus, temporal artifacts, noisy, grainy, inconsistent face, inconsistent clothing, foot skating, sliding, teleporting props, disappearing objects, readable text, subtitles, watermark, logo, cartoon, anime, CGI skin, random stopping, sudden jump cuts, night time, sunset, low light, NO background music, NO cinematic music, NO soundtrack, NO added music, NO score, NO dramatic music, NO film music, NO MUSIC, dialogue, NO SLOW MOTION.',
  ].join('\n\n');
}

function approveBatch() {
  if (!project || !activeBatchIds.length) return;
  project.scenes.forEach((scene) => {
    if (activeBatchIds.includes(scene.id) && scene.status === 'waiting_review') {
      scene.status = 'approved';
      scene.updatedAt = new Date().toISOString();
    }
  });
  activeBatchIds = [];
  persist();
  render();
  setStatus('Đã approve batch. Có thể chạy batch kế tiếp.', 'ok');
}

function pauseRun() {
  paused = true;
  setStatus('Đã pause. Có thể đổi account/model rồi Resume.', 'running');
  render();
}

function resumeRun() {
  paused = false;
  runNextBatch();
}

async function openWebLogin(provider) {
  if (!window.videoPlannerAPI?.openWebLogin) {
    setStatus('Không thấy Electron browser bridge. Hãy restart app.', 'error');
    return;
  }

  await window.videoPlannerAPI.openWebLogin(provider, accountSelect.value);
  setStatus(`Đã mở cửa sổ ${provider === 'grok' ? 'Grok' : 'ChatGPT'} để đăng nhập. Sau khi login xong có thể giữ cửa sổ hoặc đóng lại, session vẫn được lưu.`, 'ok');
}

async function chooseOutputFolder() {
  if (!window.videoPlannerAPI?.chooseOutputFolder) {
    setStatus('Không thấy folder picker bridge. Hãy restart app.', 'error');
    return;
  }
  const folder = await window.videoPlannerAPI.chooseOutputFolder();
  if (!folder) return;
  outputFolder = folder;
  persist();
  webSessionStatus.textContent = `Folder lưu: ${folder}`;
  render();
}

async function checkSelectedWebLogin() {
  const webProvider = getSelectedWebProvider();
  const state = await window.videoPlannerAPI.checkWebLogin(webProvider, accountSelect.value);
  webSessionStatus.textContent = state.loggedIn
    ? `${webProvider === 'grok' ? 'Grok' : 'ChatGPT'} / ${accountSelect.value}: đã đăng nhập.`
    : `${webProvider === 'grok' ? 'Grok' : 'ChatGPT'} / ${accountSelect.value}: chưa đăng nhập, cửa sổ login đã mở.`;
  render();
  return state.loggedIn;
}

async function sendCurrentBatchViaWeb() {
  if (!project || !activeBatchIds.length) return;
  if (!outputFolder) {
    await chooseOutputFolder();
    if (!outputFolder) return;
  }

  const webProvider = getSelectedWebProvider();
  const isLoggedIn = await checkSelectedWebLogin();
  if (!isLoggedIn) {
    setStatus('Chưa đăng nhập web. Đăng nhập xong rồi bấm Gửi batch qua web lại.', 'error');
    return;
  }

  sendWebBatchBtn.disabled = true;
  setStatus(`Đang gửi batch qua ${webProvider === 'grok' ? 'Grok' : 'ChatGPT'} web và lưu kết quả...`, 'running');

  for (const scene of project.scenes.filter((item) => activeBatchIds.includes(item.id))) {
    try {
      scene.status = 'running';
      render();
      const image = scene.imagePrompt || buildImagePrompt(scene);
      const motion = scene.motionPrompt || buildMotionPrompt(scene);
      const imageResult = await window.videoPlannerAPI.sendPromptViaWeb({
        provider: webProvider,
        account: accountSelect.value,
        prompt: image,
        outputFolder,
        projectName: project.name,
        sceneId: scene.id,
        promptKind: 'image',
      });
      const motionResult = await window.videoPlannerAPI.sendPromptViaWeb({
        provider: webProvider,
        account: accountSelect.value,
        prompt: motion,
        outputFolder,
        projectName: project.name,
        sceneId: scene.id,
        promptKind: 'motion',
      });
      scene.imagePrompt = imageResult.responseText || image;
      scene.motionPrompt = motionResult.responseText || motion;
      scene.webOutput = {
        imagePromptPath: imageResult.promptPath,
        imageResponsePath: imageResult.responsePath,
        motionPromptPath: motionResult.promptPath,
        motionResponsePath: motionResult.responsePath,
      };
      scene.status = 'waiting_review';
      scene.updatedAt = new Date().toISOString();
      persist();
      render();
    } catch (error) {
      scene.status = 'error';
      scene.error = error.message;
      paused = true;
      persist();
      render();
      setStatus(`Web automation lỗi ở scene ${scene.id}: ${error.message}`, 'error');
      return;
    }
  }

  setStatus(`Đã gửi xong batch qua web. Kết quả lưu tại: ${outputFolder}`, 'ok');
  render();
}

function getSelectedWebProvider() {
  return providerSelect.value === 'grok' ? 'grok' : 'chatgpt';
}

async function exportProject() {
  if (!project) return;
  const payload = {
    project,
    exportedAt: new Date().toISOString(),
    csv: buildCsv(),
  };
  if (window.videoPlannerAPI?.exportProject) {
    await window.videoPlannerAPI.exportProject(payload);
    setStatus('Đã export JSON và CSV.', 'ok');
    return;
  }
  await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  setStatus('Không thấy Electron export bridge; đã copy JSON vào clipboard.', 'ok');
}

function buildCsv() {
  const rows = [['Scene ID', 'Scene gốc', 'Image prompt', 'Motion prompt', 'Status']];
  project.scenes.forEach((scene) => rows.push([scene.id, scene.original, scene.imagePrompt, scene.motionPrompt, scene.status]));
  return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
}

function render() {
  const scenes = project?.scenes || [];
  metricScenes.textContent = scenes.length;
  metricApproved.textContent = scenes.filter((scene) => scene.status === 'approved').length;
  metricBatch.textContent = activeBatchIds.length ? `${activeBatchIds[0]}-${activeBatchIds.at(-1)}` : '—';

  runBatchBtn.disabled = !project || paused || activeBatchIds.some((id) => project.scenes.find((scene) => scene.id === id)?.status === 'waiting_review');
  pauseBtn.disabled = !project || paused;
  resumeBtn.disabled = !project || !paused;
  exportBtn.disabled = !project;
  sendWebBatchBtn.disabled = !project || !activeBatchIds.length || !outputFolder || paused;
  approveBatchBtn.disabled = !activeBatchIds.some((id) => project?.scenes.find((scene) => scene.id === id)?.status === 'waiting_review');
  regenerateBatchBtn.disabled = !activeBatchIds.length || paused;

  if (!scenes.length) {
    sceneTableBody.innerHTML = '<tr class="empty-row"><td colspan="6">Màn review sẽ hiện batch scene tại đây.</td></tr>';
    return;
  }

  const visible = activeBatchIds.length
    ? scenes.filter((scene) => activeBatchIds.includes(scene.id))
    : scenes.slice(0, project.batchSize);

  sceneTableBody.innerHTML = visible.map((scene) => `
    <tr class="${scene.status}">
      <td><strong>#${scene.id}</strong></td>
      <td><div class="cell-scroll">${escapeHtml(scene.original)}</div></td>
      <td><div class="cell-scroll prompt-cell">${escapeHtml(scene.imagePrompt || 'Chưa tạo')}</div></td>
      <td><div class="cell-scroll prompt-cell">${escapeHtml(scene.motionPrompt || 'Chưa tạo')}</div></td>
      <td><span class="status-badge ${scene.status}">${statusLabel(scene)}</span></td>
      <td>
        <div class="row-actions">
          <button class="mini" data-action="copy-image" data-id="${scene.id}" type="button">Copy image</button>
          <button class="mini" data-action="copy-motion" data-id="${scene.id}" type="button">Copy motion</button>
          <button class="mini" data-action="edit-image" data-id="${scene.id}" type="button">Edit image</button>
          <button class="mini" data-action="edit-motion" data-id="${scene.id}" type="button">Edit motion</button>
          <button class="mini" data-action="regen" data-id="${scene.id}" type="button">Regenerate</button>
          <button class="mini approve" data-action="approve" data-id="${scene.id}" type="button">Approve</button>
          <button class="mini muted" data-action="skip" data-id="${scene.id}" type="button">Skip</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function handleTableClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button || !project) return;
  const scene = project.scenes.find((item) => item.id === Number(button.dataset.id));
  if (!scene) return;
  const action = button.dataset.action;
  if (action === 'copy-image') return copyText(scene.imagePrompt, button);
  if (action === 'copy-motion') return copyText(scene.motionPrompt, button);
  if (action === 'edit-image') return openEditor(scene, 'imagePrompt');
  if (action === 'edit-motion') return openEditor(scene, 'motionPrompt');
  if (action === 'approve') scene.status = 'approved';
  if (action === 'skip') scene.status = 'skipped';
  if (action === 'regen') {
    scene.status = 'running';
    render();
    const aiResult = await generateWithProvider(scene).catch(() => null);
    scene.imagePrompt = aiResult?.imagePrompt || buildImagePrompt(scene);
    scene.motionPrompt = aiResult?.motionPrompt || buildMotionPrompt(scene);
    scene.status = 'waiting_review';
  }
  scene.updatedAt = new Date().toISOString();
  persist();
  render();
}

function openEditor(scene, field) {
  editTarget = { sceneId: scene.id, field };
  dialogTitle.textContent = `${field === 'imagePrompt' ? 'Edit image prompt' : 'Edit motion prompt'} — Scene ${scene.id}`;
  editorTextarea.value = scene[field];
  editorDialog.showModal();
}

function saveEdit() {
  if (!editTarget || !project) return;
  const scene = project.scenes.find((item) => item.id === editTarget.sceneId);
  if (!scene) return;
  scene[editTarget.field] = editorTextarea.value;
  scene.status = scene.status === 'queued' ? 'waiting_review' : scene.status;
  scene.updatedAt = new Date().toISOString();
  persist();
  render();
  editorDialog.close();
}

async function copyText(text, button) {
  await navigator.clipboard.writeText(text || '');
  const old = button.textContent;
  button.textContent = 'Copied ✓';
  setTimeout(() => { button.textContent = old; }, 1000);
}

function setStatus(text, kind = 'idle') {
  statusText.textContent = text;
  runState.textContent = kind === 'running' ? 'Running' : kind === 'error' ? 'Paused/Error' : kind === 'ok' ? 'Review' : 'Idle';
  runState.className = `state-pill ${kind}`;
}

function setRunning(isRunning) {
  runBatchBtn.disabled = isRunning;
  runBatchBtn.textContent = isRunning ? 'Đang chạy...' : 'Run batch kế tiếp';
}

function statusLabel(scene) {
  if (scene.status === 'error') return `Error: ${scene.error || ''}`;
  return ({ queued: 'Queued', running: 'Running', waiting_review: 'Waiting review', approved: 'Approved', skipped: 'Skipped' })[scene.status] || scene.status;
}

function escapeHtml(value) {
  return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ project, activeBatchIds, paused, outputFolder }));
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    project = saved.project || null;
    activeBatchIds = saved.activeBatchIds || [];
    paused = Boolean(saved.paused);
    outputFolder = saved.outputFolder || '';
    if (outputFolder) {
      webSessionStatus.textContent = `Folder lưu: ${outputFolder}`;
    }
    if (project) {
      projectNameInput.value = project.name;
      storyInput.value = project.story;
      scriptInput.value = project.scenes.map((scene) => scene.original).join('\n\n');
      batchSizeInput.value = project.batchSize;
      durationInput.value = project.durationSec;
      setStatus('Đã khôi phục project local.', 'ok');
    }
  } catch (_error) {
    project = null;
  }
  render();
}

projectForm.addEventListener('submit', createProject);
runBatchBtn.addEventListener('click', () => runNextBatch());
pauseBtn.addEventListener('click', pauseRun);
resumeBtn.addEventListener('click', resumeRun);
exportBtn.addEventListener('click', exportProject);
approveBatchBtn.addEventListener('click', approveBatch);
regenerateBatchBtn.addEventListener('click', () => runNextBatch({ regenerate: true }));
openChatGptBtn.addEventListener('click', () => openWebLogin('chatgpt'));
openGrokBtn.addEventListener('click', () => openWebLogin('grok'));
checkLoginBtn.addEventListener('click', checkSelectedWebLogin);
chooseOutputFolderBtn.addEventListener('click', chooseOutputFolder);
sendWebBatchBtn.addEventListener('click', sendCurrentBatchViaWeb);
sceneTableBody.addEventListener('click', handleTableClick);
saveEditBtn.addEventListener('click', saveEdit);
providerSelect.addEventListener('change', () => {
  if (providerSelect.value === 'ninerouter') modelInput.value = 'cx/gpt-5.5';
  if (providerSelect.value === 'grok') modelInput.value = 'grok-3-latest';
});

restore();
