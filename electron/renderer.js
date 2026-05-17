const projectForm = document.querySelector('#project-form');
const projectNameInput = document.querySelector('#project-name');
const storyInput = document.querySelector('#story-input');
const scriptInput = document.querySelector('#script-input');
const storyFileInput = document.querySelector('#story-file-input');
const scriptFileInput = document.querySelector('#script-file-input');
const storyFileName = document.querySelector('#story-file-name');
const scriptFileName = document.querySelector('#script-file-name');
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
const chooseOutputFolderBtn = document.querySelector('#choose-output-folder-btn');
const saveSessionBtn = document.querySelector('#save-session-btn');
const grokAccountSelect = document.querySelector('#grok-account-select');
const grokRoutingPolicySelect = document.querySelector('#grok-routing-policy-select');
const openGrokRouterFolderBtn = document.querySelector('#open-grok-router-folder-btn');
const grokRouterState = document.querySelector('#grok-router-state');
const grokRouterEnabledToggle = document.querySelector('#grok-router-enabled-toggle');
const grokAccountList = document.querySelector('#grok-account-list');
const grokRouterMessage = document.querySelector('#grok-router-message');
const grokRouterResumeBtn = document.querySelector('#grok-router-resume-btn');
const videoPlatformSelect = document.querySelector('#video-platform-select');
const skipReviewToggle = document.querySelector('#skip-review-toggle');
const autoRunBtn = document.querySelector('#auto-run-btn');
const startPipelineInlineBtn = document.querySelector('#start-pipeline-inline-btn');
const webSessionStatus = document.querySelector('#web-session-status');
const pixverseConfig = document.querySelector('#pixverse-config');
const pixverseEnergyStatus = document.querySelector('#pixverse-energy-status');
const pixverseConfigAdvice = document.querySelector('#pixverse-config-advice');
const pixverseResolutionSelect = document.querySelector('#pixverse-resolution-select');
const pixverseRatioSelect = document.querySelector('#pixverse-ratio-select');
const pixverseDurationSelect = document.querySelector('#pixverse-duration-select');
const pixverseModelSelect = document.querySelector('#pixverse-model-select');
const pixversePreviewToggle = document.querySelector('#pixverse-preview-toggle');
const pixverseAudioToggle = document.querySelector('#pixverse-audio-toggle');
const statusText = document.querySelector('#review-inline-status');
const pipelineLogList = document.querySelector('#pipeline-log-list');
const pipelineLogCard = document.querySelector('.pipeline-log-card');
const workflowStepList = document.querySelector('#workflow-step-list');
const workflowProgressFill = document.querySelector('#workflow-progress-fill');
const workflowProgressPercent = document.querySelector('#workflow-progress-percent');
const finalPreviewCard = document.querySelector('#final-preview-card');
const finalPreviewVideo = document.querySelector('#final-preview-video');
const finalPreviewMeta = document.querySelector('#final-preview-meta');
const finalSceneTimeline = document.querySelector('#final-scene-timeline');
const refreshFinalPreviewBtn = document.querySelector('#refresh-final-preview-btn');
const clearLogBtn = document.querySelector('#clear-log-btn');
const runState = document.querySelector('#run-state');
const metricScenes = document.querySelector('#metric-scenes');
const metricApproved = document.querySelector('#metric-approved');
const metricBatch = document.querySelector('#metric-batch');
const openReviewBtn = document.querySelector('#open-review-btn');
const loginWaitDialog = document.querySelector('#login-wait-dialog');
const loginWaitTitle = document.querySelector('#login-wait-title');
const loginWaitDesc = document.querySelector('#login-wait-desc');
const assetReviewDialog = document.querySelector('#asset-review-dialog');
const reviewSceneKicker = document.querySelector('#review-scene-kicker');
const reviewSceneTitle = document.querySelector('#review-scene-title');
const reviewSceneStatus = document.querySelector('#review-scene-status');
const reviewOriginal = document.querySelector('#review-original');
const reviewStatusBadge = document.querySelector('#review-status-badge');
const reviewMediaPanel = document.querySelector('#review-media-panel');
const reviewMediaStage = document.querySelector('#review-media-stage');
const reviewImagePrompt = document.querySelector('#review-image-prompt');
const reviewMotionPrompt = document.querySelector('#review-motion-prompt');
const reviewEditImageBtn = document.querySelector('#review-edit-image-btn');
const reviewEditMotionBtn = document.querySelector('#review-edit-motion-btn');
const reviewRegenerateBtn = document.querySelector('#review-regenerate-btn');
const reviewApproveBtn = document.querySelector('#review-approve-btn');
const zoomRange = document.querySelector('#zoom-range');
const zoomOutBtn = document.querySelector('#zoom-out-btn');
const zoomInBtn = document.querySelector('#zoom-in-btn');
const editorDialog = document.querySelector('#editor-dialog');
const dialogTitle = document.querySelector('#dialog-title');
const editorTextarea = document.querySelector('#editor-textarea');
const saveEditBtn = document.querySelector('#save-edit-btn');

const STORAGE_KEY = 'ai-scene-batch-director:v1';
const RESTORE_SESSION_KEY = 'ai-scene-batch-director:restore-next-launch';
const IMAGE_PROMPT_RULES = `NHIỆM VỤ 1 — TẠO ẢNH KEYFRAME ĐẦU SCENE:\n- Nhập vai đạo diễn live action IQ/EQ cao, dựng hiện trường ảnh chuyên nghiệp.\n- Đọc story tổng, character bible, scene trước, scene hiện tại và scene sau nếu cần.\n- Xác định hành động đầu tiên của scene, tạo ảnh giai đoạn chuẩn bị diễn ra hành động đó.\n- Continuity 1-1: tạo hình, trang phục, cơ thể, mặt, đạo cụ, bối cảnh giữ chính xác qua các scene trừ khi kịch bản yêu cầu đổi.\n- Ảnh phải là 1 frame 16:9, 8K ultra-realistic live action, wide/master shot ưu tiên, sạch rõ, không text/logo/watermark.\n- Spatial Lock: khóa vị trí nhân vật/đạo cụ để đủ đất diễn cho motion 10s.\n- Nếu là POV: chỉ hiện tay/chân/vai ngoại vi, không render mặt/thân chủ thể POV.`;

const MOTION_PROMPT_RULES = `KHI ĐÃ TẠO XONG ẢNH THÌ DỰA VÀO ẢNH ĐÃ TẠO HÃY TIẾP TỤC VỚI NHIỆM VỤ 2 :
NHIỆM VỤ 2: TẠO PROMPT VIDEO 10 GIÂY TỪ ẢNH KEYFRAME ( GIAI ĐOẠN ĐẦU SCENE ) VỪA TẠO
Yêu cầu viết prompt (toàn bộ bằng tiếng Việt, VIẾT THEO KIỂU ĐẠO DIỄN trường thuật trực tiếp TẠI HIỆN TRƯỜNG) 
NHẬP VAI VÀO 1 CHUYÊN GIA MÔ TẢ , TRƯỜNG THUẬT TRỰC TIẾP TẠI HIỆN TRƯỜNG ! 
trước khi AI bắt đầu tạo prompt phải thực hiện quy tắc này đầu tiên :

QUY TẮC 1: TƯƠNG THÍCH ẢNH KHUNG HÌNH HIỆN TRƯỜNG ĐÃ TẠO VÀ PROMPT VIDEO 
bắt buộc tuân thủ nghiêm ngặt quy tắc sau trước khi viết bất kỳ prompt video nào:
- Spatial Lock (Khóa Không Gian): Prompt video chỉ được mô tả những gì thực sự nằm trong khung hình keyframe hoặc có thể thấy rõ khi camera di chuyển logic từ keyframe. Không được đưa chi tiết của không gian khác vào prompt trừ khi keyframe hoặc kịch bản scene cho phép camera chuyển sang không gian đó một cách rõ ràng.
- Visible Only Rule: Trước khi viết prompt, phải liệt kê chính xác những gì đang có trong keyframe (nhân vật, vị trí, bối cảnh, góc máy). Mọi chuyển động trong prompt phải xuất phát từ những yếu tố đã có trong keyframe.
- KHI BẮT ĐẦU Viết Prompt:
  + Mô tả chuỗi chuyển động phải bắt đầu từ chính xác những gì đang diễn ra trong keyframe ẢNH HIỆN TRƯỜNG ĐÃ TẠO.
  + Mô tả ngắn gọn: VIẾT LẠI NGẮN GỌN PHẦN CỐT TRUYỆN KỊCH BẢN CỦA SCENE NÀY THEO CÁCH ĐỂ HIỂU VÀ MỤC ĐÍCH CỦA SCENE.
  + Mô tả chuỗi chuyển động: Viết liên tục, VIẾT THÔ NHẤT CÓ THỂ, VIẾT RA CÁC CHUYỂN ĐỘNG TRONG KHUNG HÌNH THEO logic nhân quả CỦA KỊCH BẢN CỐT TRUYỆN CỰC KÌ chi tiết DÙ LÀ CHUYỂN ĐỘNG NHỎ NHẤT (VIẾT GIỐNG NHƯ ĐẠO DIỄN ĐANG TRƯỜNG THUẬT TRỰC TIẾP TẠI HIỆN TRƯỜNG).
  + Dùng tính từ + trạng từ + số lần sau mọi động từ (TÍNH CHÍNH XÁC PHẢI LÀ TUYỆT ĐỐI NHƯ ĐỜI THỰC LIVE ACTION).
  + LƯU Ý TRÁNH VIỆC AI SẼ TẠO CHUYỂN ĐỘNG SLOW MOTION NÊN PHẢI VIẾT CÁC TỪ SAU ĐỂ NỐI CÁC CHUYỂN ĐỘNG: ngay lập tức, tức thì, đồng thời, liên tiếp nhanh, CÙNG LÚC ĐÓ, SAU ĐÓ, LIÊN TỤC,... (HÃY VIẾT KÈM SAU MỖI ĐỘNG TỪ TRONG PROMPT). CẤM VIẾT NHỮNG TỪ MÔ TẢ CHUYỂN ĐỘNG NHẸ.

QUY TẮC 2 : KHI SCENE KỊCH BẢN LÀ SCENE POV:
- "ỐNG KÍNH CHÍNH LÀ NHÃN CẦU. TUYỆT ĐỐI KHÔNG RENDER THÂN HÌNH, ĐẦU HOẶC KHUÔN MẶT CỦA CHỦ THỂ POV."

QUY TẮC 3 : Khóa tọa độ khung hình 16:9
Luôn ghi rõ vị trí bắt đầu, di chuyển từ đâu → đâu, biến mất ở hướng nào.

QUY TẮC 4 : Âm thanh (bắt buộc):
- Chỉ âm thanh thực tế diegetic (foley + môi trường), thu trực tiếp tại hiện trường bằng mic cao cấp RẤT TO VÀ RÕ.
- Không nhạc nền, không soundtrack, không voice-over.
- Mọi chuyển động phải có âm thanh tương ứng, to, rõ, sống động, có độ trễ tự nhiên.
- Thoại nhân vật: ghi nguyên văn bằng tiếng Anh, và chèn "GIỌNG CỦA nhân vật RẤT GIỐNG VỚI ĐỘ TUỔI TẠO HÌNH CỦA NGƯỜI ĐÓ".
- Thoại động vật: KÈM DÒNG "TIẾNG GẦM/SỦA/KÊU ĐẶC TRƯNG CỦA GIỐNG LOÀI..." ĐỂ TRÁNH AI CHO ĐỘNG VẬT THOẠI TIẾNG NGƯỜI.
- MỌI ÂM THANH NỀN Ở BỐI CẢNH VIDEO VÀ MỌI VẬT THỂ đang chuyển động TRONG VIDEO Bắt buộc TẠO ÂM THANH VIDEO PHẢI TO VÀ RÕ RÀNG NHƯ ĐANG BẬT FULL 100% VOLUME LOA.

QUY TẮC 5 : NGĂN CHẶN HÀNH ĐỘNG BỎ DỞ
Hành động phải được hoàn tất logic và có payoff ĐÚNG MỤC ĐÍCH rõ ràng. Không được dừng ở giai đoạn "đang làm".

QUY TẮC 6: CÁCH VIẾT PROMPT CỰC DỄ HIỂU CHO MỌI LỨA TUỔI
Viết tình tiết diễn biến cực kỳ dễ hiểu, người đọc có thể hình dung video chính xác trong đầu ngay lập tức.

FORMAT MẪU XUẤT PROMPT CHUYỂN ĐỘNG 7 DÒNG:
DÒNG 1: TỔNG QUÁT LẠI KHUNG HÌNH TRONG ẢNH (chỉ viết tạo hình nhận diện, cấm viết tên).
DÒNG 2: NỘI DUNG VIDEO CHUYỂN ĐỘNG (Áp dụng tất cả quy tắc trên, mô tả cực kỳ chi tiết).
DÒNG 3: CHUYỂN ĐỘNG PHỤ CÒN LẠI TRONG KHUNG HÌNH.
DÒNG 4: ÂM THANH (Liệt kê tất cả, chèn câu chốt âm thanh 100% volume ở cuối).
DÒNG 5: CÂU CHỐT CHO VIDEO (Mọi thứ mượt như live action, tuân thủ định lý vật lý).
DÒNG 6: Technical Specifications: 8K ultra-realistic, extreme sharp details, real-world gravity, authentic cloth and fur simulation, consistent powerful natural daylight, high dynamic range (HDR), hyper-smooth 240 FPS motion, organic motion blur only where physically correct. Live action cinematic quality, razor-sharp, true-to-life textures.
DÒNG 7: Negative Prompt: low quality, blurry, out of focus, temporal artifacts, noisy, grainy, inconsistent face, inconsistent clothing, foot skating, sliding, teleporting props, disappearing objects, readable text, subtitles, watermark, logo, cartoon, anime, CGI skin, random stopping, sudden jump cuts, night time, sunset, low light, NO background music, NO cinematic music, NO soundtrack, NO added music, NO score, NO dramatic music, NO film music, NO MUSIC, dialogue, NO SLOW MOTION.`;

const STORY_RULES = `QUY TẮC BIÊN KỊCH MẪU:\n- HARD RULE 1-1-2: mỗi scene chỉ 1 ý chính và tối đa 1-2 chuyển động chính.\n- Mọi thứ phải có nguồn gốc rõ, precursor/witness, không tự nhiên xuất hiện.\n- Mạch nối nhân quả: muốn đổi bối cảnh phải có động cơ rời cảnh và vật dẫn vật lý.\n- Continuity state: vết thương, trang phục, đạo cụ, cảm xúc được bảo toàn.\n- CTR upgrade: chọn phiên bản cinematic, cảm xúc, bất ngờ hơn nhưng vẫn logic.\n- Bối cảnh là đất diễn tương tác; tận dụng vật thể có mặt để hành động thông minh.`;

let project = null;
let activeBatchIds = [];
let paused = false;
let editTarget = null;
let outputFolder = '';
let reviewSceneId = null;
let reviewZoom = 100;
let pixverseCapability = null;
let pipelineLogs = [];
let pipelineLogVisible = false;
let lastStatusText = '';
let lastStartClickAt = 0;
let isRunning = false;
let autoContinuing = false;

function shouldSkipReview() {
  return Boolean(skipReviewToggle?.checked);
}

function queueAutoContinue(delay = 350) {
  if (autoContinuing) return;
  autoContinuing = true;
  setTimeout(async () => {
    try {
      try {
        await autoRunRoute();
      } catch (error) {
        const message = error?.message || String(error);
        paused = true;
        setStatus(`Auto continue lỗi: ${message}`, 'error');
        persist();
        render();
      }
    } finally {
      autoContinuing = false;
    }
  }, delay);
}

function createProject(event) {
  event?.preventDefault?.();
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
  setStatus(`Đã parse ${scenes.length} scene. Bấm Start pipeline để tool tạo prompt và chạy workflow.`, 'ok');
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
      scene.reviewType = 'prompt';
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
    const firstReview = batch.find((scene) => scene.status === 'waiting_review');
    setStatus(`Batch ${activeBatchIds[0]}-${activeBatchIds.at(-1)} đang chờ review prompt. Popup review đã mở tự động.`, 'ok');
    if (firstReview && !shouldSkipReview()) openAssetReview(firstReview.id);
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
    'SAFETY BẮT BUỘC: tất cả nhân vật trong ảnh là người trưởng thành 25+ tuổi. Nếu scene gốc có cô bé/cậu bé/trẻ em/teen/học sinh/minor thì chuyển thành người trưởng thành 25+ tuổi, không dùng từ trẻ em/teen/minor trong prompt ảnh.',
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

  autoRunBtn.disabled = true;
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
      scene.reviewType = 'prompt';
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

async function runFullPipeline() {
  if (!project || !activeBatchIds.length) return;
  if (!outputFolder) {
    await chooseOutputFolder();
    if (!outputFolder) return;
  }
  if (!window.videoPlannerAPI?.runScenePipeline) {
    setStatus('Bridge pipeline chưa sẵn sàng. Hãy restart app.', 'error');
    return;
  }

  const runnableStatuses = new Set(['waiting_review', 'approved', 'image_done', 'error']);
  const scenesToRun = project.scenes.filter((item) => activeBatchIds.includes(item.id) && runnableStatuses.has(item.status));
  if (!scenesToRun.length) {
    setStatus('Auto route dừng: Không có scene cần tạo video trong batch hiện tại.', 'error');
    return;
  }

  autoRunBtn.disabled = true;
  const videoPlatform = getSelectedVideoPlatform();
  setStatus(`Đang chạy full pipeline: ChatGPT tạo ảnh → ${videoPlatform.label} tạo video → lưu theo scene...`, 'running');

  for (let i = 0; i < scenesToRun.length; i++) {
    const scene = scenesToRun[i];
    try {
      scene.status = scene.imagePath ? 'video_generating' : 'image_generating';
      render();
      const imagePrompt = scene.imagePrompt || buildImagePrompt(scene);
      scene.imagePrompt = imagePrompt;
      scene.progressStep = scene.imagePath ? 'motion' : 'image';
      render();
      const result = await window.videoPlannerAPI.runScenePipeline({
        projectName: project.name,
        outputFolder,
        sceneId: scene.id,
        imagePrompt,
        motionPrompt: scene.motionPrompt || '',
        imagePath: scene.imagePath || '',
        forceRegenerateImage: Boolean(scene.forceRegenerateImage),
        videoProvider: videoPlatform.value,
        videoAccount: getSelectedVideoAccount(videoPlatform.value),
        routingPolicy: grokRoutingPolicySelect?.value || 'manual',
        accountRouterEnabled: Boolean(grokRouterEnabledToggle?.checked),
        videoConfig: getVideoProviderConfig(),
      });
      scene.forceRegenerateImage = false;
      scene.imagePrompt = imagePrompt;
      if (result.motionPrompt) {
        scene.motionPrompt = result.motionPrompt;
      }
      scene.pipeline = result;
      scene.imagePath = result.imagePath || scene.imagePath || '';
      scene.imageDataUrl = result.imageDataUrl || scene.imageDataUrl || '';
      scene.videoPath = result.videoPath || scene.videoPath || '';
      scene.videoProvider = result.videoProvider || videoPlatform.value;
      scene.videoStatus = result.videoStatus || '';
      if (result.phase === 'video' && !result.videoPath) {
        scene.status = 'error';
        const detail = result.videoError || result.videoStatus || 'chưa có videoUrl mới để tải về';
        scene.progressStep = 'motion';
        scene.error = `${videoPlatform.label} chưa hoàn tất tạo video: ${detail}`;
        scene.updatedAt = new Date().toISOString();
        paused = true;
        persist();
        render();
        setStatus(`Scene ${scene.id}: ${scene.error}`, 'error');
        return;
      }
      scene.progressStep = result.phase === 'video' ? 'motion' : 'image';
      scene.reviewType = result.phase === 'video' ? 'video' : 'image';
      scene.status = 'asset_review';
      scene.updatedAt = new Date().toISOString();
      persist();
      render();
      if (shouldSkipReview()) {
        scene.status = scene.reviewType === 'video' ? 'video_done' : 'image_done';
        scene.progressStep = scene.reviewType === 'video' ? 'merge' : 'motion';
        scene.reviewType = '';
        scene.reviewedAt = new Date().toISOString();
        persist();
        render();
        if (scene.status === 'video_done') {
          await mergeAndShowFinalPreview({ scrollIntoView: true });
        }
        continue;
      }
      openAssetReview(scene.id);
      setStatus(`Scene ${scene.id} đã sẵn sàng review. Duyệt xong tool sẽ tự chạy bước tiếp theo.`, 'ok');
      return;
    } catch (error) {
      const message = error.message || String(error);
      scene.pipelineRetryCount = (scene.pipelineRetryCount || 0) + 1;
      scene.error = message;
      scene.updatedAt = new Date().toISOString();
      persist();
      render();
      if (scene.pipelineRetryCount <= 2) {
        setStatus(`Scene ${scene.id} lỗi tạm thời: ${message}. Tự gửi lại lần ${scene.pipelineRetryCount}/2...`, 'running');
        await new Promise((resolve) => setTimeout(resolve, 2500));
        scene.status = scene.imagePath ? 'video_generating' : 'image_generating';
        render();
        i--;
        continue;
      }
      scene.status = 'error';
      scene.progressStep = scene.imagePath ? 'motion' : 'image';
      paused = true;
      persist();
      render();
      setStatus(`Full pipeline lỗi ở scene ${scene.id} sau 2 lần gửi lại: ${message}`, 'error');
      return;
    }
  }

  if (shouldSkipReview()) {
    const unfinished = project.scenes.some((scene) => activeBatchIds.includes(scene.id) && !['skipped', 'video_done'].includes(scene.status));
    if (unfinished) return queueAutoContinue();
    await mergeAndShowFinalPreview();
  }
  setStatus('Không còn scene cần chạy trong batch hiện tại.', 'ok');
  render();
}

function getSelectedWebProvider() {
  return providerSelect.value === 'grok' ? 'grok' : 'chatgpt';
}

function getSelectedVideoPlatform() {
  const value = videoPlatformSelect?.value || 'grok';
  return {
    value,
    label: value === 'pixverse' ? 'PixVerse' : 'Grok',
  };
}

function getSelectedVideoAccount(videoProvider = getSelectedVideoPlatform().value) {
  if (videoProvider === 'grok') return grokAccountSelect?.value || 'grok-default-profile';
  return accountSelect.value;
}

function getVideoProviderConfig() {
  return {
    pixverse: {
      resolution: pixverseResolutionSelect?.value || '360P',
      ratio: pixverseRatioSelect?.value || '16:9',
      duration: pixverseDurationSelect?.value || '5',
      model: pixverseModelSelect?.value || 'PixVerse V6',
      previewMode: Boolean(pixversePreviewToggle?.checked),
      audio: Boolean(pixverseAudioToggle?.checked),
    },
    grok: {},
  };
}

function syncVideoPlatformConfig() {
  if (pixverseConfig) pixverseConfig.hidden = videoPlatformSelect?.value !== 'pixverse';
  updatePixVerseConfigAdvice();
}

function estimatePixVerseEnergy(config = getVideoProviderConfig().pixverse) {
  const duration = Number(config.duration || 5);
  const resolutionCost = { '360P': 25, '540P': 40, '720P': 70, '1080P': 100 }[config.resolution] || 25;
  const durationCost = Math.max(0, duration - 5) * 5;
  const modelCost = /Sora|Veo|Kling|Seedance|Happy Horse|Grok Imagine/i.test(config.model) ? 35 : 0;
  const audioCost = config.audio ? 0 : -5;
  const previewDiscount = config.previewMode ? -10 : 0;
  return Math.max(10, resolutionCost + durationCost + modelCost + audioCost + previewDiscount);
}

function isPixVerseProConfig(config = getVideoProviderConfig().pixverse) {
  return ['720P', '1080P'].includes(config.resolution) || /Sora|Veo|Kling|Seedance|Happy Horse|Grok Imagine/i.test(config.model);
}

function suggestPixVerseConfig(energy = 0, hasPro = false) {
  const suggestions = [
    { resolution: '360P', duration: '5', model: 'PixVerse V6', audio: true, previewMode: false, ratio: pixverseRatioSelect?.value || '16:9' },
    { resolution: '360P', duration: '4', model: 'PixVerse V5 Fast', audio: false, previewMode: true, ratio: pixverseRatioSelect?.value || '16:9' },
    { resolution: '360P', duration: '3', model: 'PixVerse V5 Fast', audio: false, previewMode: true, ratio: pixverseRatioSelect?.value || '16:9' },
    { resolution: '360P', duration: '2', model: 'PixVerse V5 Fast', audio: false, previewMode: true, ratio: pixverseRatioSelect?.value || '16:9' },
  ];
  return suggestions.find((item) => estimatePixVerseEnergy(item) <= energy && (!isPixVerseProConfig(item) || hasPro)) || suggestions.at(-1);
}

function updatePixVerseConfigAdvice() {
  if (!pixverseConfigAdvice || videoPlatformSelect?.value !== 'pixverse') return;
  const config = getVideoProviderConfig().pixverse;
  const estimated = estimatePixVerseEnergy(config);
  const energy = Number(pixverseCapability?.energy ?? NaN);
  const hasPro = Boolean(pixverseCapability?.hasPro);
  const proRequired = isPixVerseProConfig(config);
  if (pixverseEnergyStatus) {
    pixverseEnergyStatus.textContent = Number.isFinite(energy) ? `Energy: ${energy} · Ước tính: ${estimated}` : `Ước tính: ${estimated} energy`;
  }
  if (proRequired && !hasPro) {
    const fallback = suggestPixVerseConfig(Number.isFinite(energy) ? energy : 999, hasPro);
    pixverseConfigAdvice.textContent = `Config đang cần Pro. Đề xuất đổi sang ${fallback.model}, ${fallback.resolution}, ${fallback.duration}s, ratio ${fallback.ratio}${fallback.previewMode ? ', bật Preview' : ''}.`;
    pixverseConfigAdvice.className = 'config-advice warning';
    return;
  }
  if (Number.isFinite(energy) && estimated > energy) {
    const fallback = suggestPixVerseConfig(energy, hasPro);
    pixverseConfigAdvice.textContent = `Config hiện cần khoảng ${estimated} energy nhưng acc còn ${energy}. Đề xuất: ${fallback.model}, ${fallback.resolution}, ${fallback.duration}s, ratio ${fallback.ratio}, ${fallback.audio ? 'bật audio' : 'tắt audio'}${fallback.previewMode ? ', bật Preview mode' : ''}.`;
    pixverseConfigAdvice.className = 'config-advice warning';
    return;
  }
  pixverseConfigAdvice.textContent = Number.isFinite(energy)
    ? `Config có thể chạy: ước tính ${estimated}/${energy} energy${hasPro ? ', acc có Pro.' : ', acc Basic/không thấy Pro.'}`
    : `Chưa đọc được energy từ PixVerse. Ước tính config này cần khoảng ${estimated} energy.`;
  pixverseConfigAdvice.className = 'config-advice';
}

async function waitForProviderReady(providerValue, label) {
  await openWebLogin(providerValue);
  const startedAt = Date.now();
  let attempt = 0;
  if (loginWaitTitle) loginWaitTitle.textContent = `Đang chờ ${label} sẵn sàng...`;
  if (loginWaitDesc) loginWaitDesc.textContent = `Hãy đăng nhập hoặc vượt qua verify/Cloudflare trong cửa sổ ${label}. Tool sẽ tự quét liên tục và chạy tiếp khi xong.`;
  if (loginWaitDialog && !loginWaitDialog.open) loginWaitDialog.showModal();
  while (!paused) {
    attempt += 1;
    const state = await window.videoPlannerAPI.checkWebLogin(providerValue, accountSelect.value);
    if (state.loggedIn) {
      if (loginWaitDesc) loginWaitDesc.textContent = `${label} đã sẵn sàng. Đang tiếp tục pipeline...`;
      return state;
    }
    const reason = state.reason || state.title || state.url || 'chưa đăng nhập hoặc đang verify';
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    if (loginWaitDesc) loginWaitDesc.textContent = `${label}: ${reason}. Đã chờ ${elapsed}s, lần quét ${attempt}. Login/verify xong tool tự chạy tiếp.`;
    setStatus(`Đang chờ ${label} login/verify... (${elapsed}s)`, 'running');
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`Đã hủy khi đang chờ ${label} login/verify.`);
}

async function startPipelineFromClick(event) {
  event?.preventDefault?.();
  const now = Date.now();
  if (now - lastStartClickAt < 300) return;
  lastStartClickAt = now;
  if (isRunning) {
    setStatus('Start pipeline đã nhận click nhưng workflow đang chạy, bỏ qua click lặp.', 'running');
    return;
  }
  setStatus('Đã bấm Start pipeline. Đang khởi động workflow...', 'running');
  await autoRunRoute();
}
window.startPipelineFromClick = startPipelineFromClick;

async function autoRunRoute() {
  if (!project) {
    createProject();
    if (!project) return;
  }
  if (isRunning) return;
  setRunning(true);
  paused = false;

  try {
    if (!outputFolder) {
      setStatus('Bước 1/5: chọn folder lưu output...', 'running');
      await chooseOutputFolder();
      if (!outputFolder) throw new Error('Chưa chọn folder lưu output.');
    }

    setStatus('Bước 2/5: mở và kiểm tra ChatGPT...', 'running');
    const chatgptState = await waitForProviderReady('chatgpt', 'ChatGPT');

    const videoPlatform = getSelectedVideoPlatform();
    setStatus(`Bước 3/5: mở và kiểm tra ${videoPlatform.label}...`, 'running');
    const videoState = await waitForProviderReady(videoPlatform.value, videoPlatform.label);
    if (videoPlatform.value === 'pixverse') {
      pixverseCapability = videoState.capability || null;
      updatePixVerseConfigAdvice();
      const config = getVideoProviderConfig().pixverse;
      const estimated = estimatePixVerseEnergy(config);
      const energy = Number(pixverseCapability?.energy ?? NaN);
      const hasPro = Boolean(pixverseCapability?.hasPro);
      const proRequired = isPixVerseProConfig(config);
      if (proRequired && !hasPro) {
        const fallback = suggestPixVerseConfig(Number.isFinite(energy) ? energy : 999, hasPro);
        throw new Error(`PixVerse config đang cần Pro nhưng acc hiện tại không có Pro. Đề xuất đổi: model ${fallback.model}, ${fallback.resolution}, ${fallback.duration}s, ratio ${fallback.ratio}${fallback.previewMode ? ', bật Preview mode' : ''}.`);
      }
      if (Number.isFinite(energy) && estimated > energy) {
        const fallback = suggestPixVerseConfig(energy, hasPro);
        throw new Error(`PixVerse không đủ energy: config cần khoảng ${estimated}, acc còn ${energy}. Đề xuất đổi: model ${fallback.model}, ${fallback.resolution}, ${fallback.duration}s, ratio ${fallback.ratio}, ${fallback.audio ? 'bật audio' : 'tắt audio'}${fallback.previewMode ? ', bật Preview mode' : ''}.`);
      }
    }

    const activeScenes = project.scenes.filter((item) => activeBatchIds.includes(item.id));
    const runnableStatuses = new Set(['waiting_review', 'approved', 'image_done', 'error']);
    const shouldCreateBatch = !activeBatchIds.length
      || activeScenes.length === 0
      || activeScenes.every((scene) => ['skipped', 'video_done'].includes(scene.status));

    if (shouldCreateBatch) {
      setStatus('Bước 4/5: tạo batch prompt kế tiếp...', 'running');
      await runNextBatch();
    } else {
      activeScenes.forEach((scene) => {
        if (scene.status === 'error') {
          scene.status = scene.imagePrompt && scene.motionPrompt ? 'waiting_review' : 'queued';
          scene.reviewType = scene.status === 'waiting_review' ? 'prompt' : '';
        }
      });
    }

    if (!activeBatchIds.length) {
      throw new Error('Không có scene trong batch hiện tại để chạy.');
    }

    // Đã chuyển logic login lên trên

    webSessionStatus.textContent = `Đã login ChatGPT + ${videoPlatform.label}. Output: ${outputFolder}`;
    const waitingPrompt = project.scenes.find((scene) => activeBatchIds.includes(scene.id) && scene.status === 'waiting_review');
    if (waitingPrompt && !shouldSkipReview()) {
      openAssetReview(waitingPrompt.id);
      setStatus(`Scene ${waitingPrompt.id} đang chờ review prompt. Bấm Ổn/Next để tool tự tạo ảnh.`, 'ok');
      return;
    }
    if (waitingPrompt && shouldSkipReview()) {
      activeScenes.forEach((scene) => {
        if (scene.status === 'waiting_review') {
          scene.status = 'approved';
          scene.reviewType = '';
        }
      });
      persist();
      render();
    }
    setStatus('Bước 5/5: gửi prompt, tạo ảnh/video và lưu file...', 'running');
    if (loginWaitDialog?.open) loginWaitDialog.close();
    await runFullPipeline();
  } catch (error) {
    paused = true;
    if (loginWaitDialog?.open) loginWaitDialog.close();
    webSessionStatus.textContent = `Lỗi: ${error.message}`;
    setStatus(`Auto route dừng: ${error.message}`, 'error');
    persist();
    render();
  } finally {
    if (loginWaitDialog?.open) loginWaitDialog.close();
    setRunning(false);
    render();
  }
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
  chooseOutputFolderBtn.disabled = !project;
  autoRunBtn.disabled = false;
  openReviewBtn.disabled = !getCurrentReviewScene();

  renderWorkflowProgress();
  renderFinalPreview();
  renderAssetReviewModal();
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
  if (action === 'approve') {
    const reviewType = scene.status === 'waiting_review' ? 'prompt' : scene.reviewType || (scene.videoPath ? 'video' : scene.imagePath ? 'image' : 'prompt');
    scene.status = reviewType === 'video' ? 'video_done' : reviewType === 'image' ? 'image_done' : 'approved';
    scene.reviewType = '';
    scene.reviewedAt = new Date().toISOString();
  }
  if (action === 'skip') scene.status = 'skipped';
  if (action === 'regen') {
    scene.status = 'waiting_review';
    scene.reviewType = 'prompt';
    scene.imagePath = '';
    scene.imageDataUrl = '';
    scene.videoPath = '';
    scene.videoStatus = '';
    scene.error = '';
    scene.forceRegenerateImage = true;
    setStatus(`Scene ${scene.id} đã đưa về hàng chờ tạo lại. Có thể chỉnh prompt rồi bấm Chạy tự động toàn bộ.`, 'ok');
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
  if (scene.status === 'queued') {
    scene.status = 'waiting_review';
    scene.reviewType = 'prompt';
  }
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
  appendPipelineLog(text, kind);
}

function appendPipelineLog(text, kind = 'idle') {
  if (!text || text === lastStatusText) return;
  lastStatusText = text;
  const time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
  pipelineLogs.unshift({ time, text, kind });
  pipelineLogs = pipelineLogs.slice(0, 80);
  window.videoPlannerAPI?.appendAppLog?.({ source: 'renderer', kind, text }).catch(() => null);
  renderPipelineLog();
}

function showPipelineNotice(payload = {}) {
  const message = payload.message || 'Pipeline cần chú ý.';
  setStatus(message, payload.type === 'grok-limit' ? 'error' : 'running');
  window.alert(message);
}

window.videoPlannerAPI?.onPipelineNotice?.((payload) => {
  showPipelineNotice(payload);
});

function renderPipelineLog() {
  if (!pipelineLogList) return;
  if (pipelineLogCard) pipelineLogCard.hidden = !pipelineLogVisible;
  pipelineLogList.innerHTML = pipelineLogs.length
    ? pipelineLogs.map((entry) => `<li class="log-${entry.kind}"><span>${escapeHtml(entry.time)}</span><p>${escapeHtml(entry.text)}</p></li>`).join('')
    : '<li class="log-idle"><span>—</span><p>Chưa có log. Bấm Start pipeline để bắt đầu.</p></li>';
}

function setPipelineLogVisible(visible) {
  pipelineLogVisible = Boolean(visible);
  renderPipelineLog();
}

function getSceneWorkflowSteps(scene) {
  const done = 'done';
  const doing = 'doing';
  const error = 'error';
  const todo = 'todo';
  const hasImage = Boolean(scene.imagePath || scene.imageDataUrl);
  const hasVideoDone = Boolean(scene.videoPath || scene.status === 'video_done');
  const failed = scene.status === 'error';
  const progressStep = ['image_generating', 'video_generating', 'asset_review'].includes(scene.status) ? scene.progressStep || '' : '';
  const imageDoing = scene.status === 'image_generating' && progressStep === 'image';
  const motionDoing = scene.status === 'video_generating' && progressStep === 'motion';
  const mergeDoing = progressStep === 'merge' && !hasVideoDone;
  return [
    { key: 'image', title: `Image scene ${scene.id}`, state: failed && progressStep === 'image' ? error : hasImage || ['image_done', 'video_generating', 'video_done'].includes(scene.status) ? done : imageDoing ? doing : todo },
    { key: 'motion', title: `Motion scene ${scene.id}`, state: failed && progressStep === 'motion' ? error : hasVideoDone ? done : motionDoing ? doing : todo },
    { key: 'merge', title: `Merge scene ${scene.id}`, state: failed && progressStep === 'merge' ? error : scene.status === 'video_done' ? done : hasVideoDone || mergeDoing ? doing : todo },
  ];
}

function renderWorkflowProgress() {
  if (!workflowStepList || !workflowProgressFill || !workflowProgressPercent) return;
  const scenes = project?.scenes?.length ? project.scenes.filter((scene) => !activeBatchIds.length || activeBatchIds.includes(scene.id)) : [];
  const promptStep = scenes.length ? [{
    key: 'prompt-batch',
    title: `Chốt prompt batch · ${scenes.length} scene`,
    state: scenes.some((scene) => scene.status === 'error' && scene.progressStep === 'prompt') ? 'error'
      : scenes.some((scene) => scene.status === 'waiting_review' || scene.reviewType === 'prompt') ? 'doing'
        : scenes.every((scene) => Boolean(scene.imagePrompt && scene.motionPrompt) || ['approved', 'image_done', 'video_done', 'asset_review', 'image_generating', 'video_generating'].includes(scene.status)) ? 'done'
          : scenes.some((scene) => scene.progressStep === 'prompt') ? 'doing'
            : 'todo',
  }] : [];
  const steps = [...promptStep, ...scenes.flatMap(getSceneWorkflowSteps)];
  const doneCount = steps.filter((step) => step.state === 'done').length;
  const percent = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;
  workflowProgressFill.style.width = `${percent}%`;
  workflowProgressPercent.textContent = `${percent}%`;
  workflowStepList.innerHTML = steps.length
    ? steps.map((step) => {
      const icon = step.state === 'done' ? '✓' : step.state === 'doing' ? '⟳' : step.state === 'error' ? '!' : '•';
      const label = step.state === 'done' ? 'done' : step.state === 'doing' ? 'doing' : step.state === 'error' ? 'error' : 'pending';
      return `<article class="workflow-step ${step.state}"><span class="step-icon">${icon}</span><div><div class="step-title">${escapeHtml(step.title)}</div><div class="step-state">${label}</div></div></article>`;
    }).join('')
    : '<article class="workflow-step"><span class="step-icon">•</span><div><div class="step-title">Chưa có batch</div><div class="step-state">pending</div></div></article>';
}

function loadTextFileToTextarea(fileInput, textarea, fileNameEl, label) {
  const file = fileInput?.files?.[0];
  if (!file) return;
  if (!/\.txt$/i.test(file.name) && file.type && file.type !== 'text/plain') {
    setStatus(`${label}: file không phải .txt/text/plain.`, 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    textarea.value = String(reader.result || '').trim();
    if (fileNameEl) fileNameEl.textContent = file.name;
    setStatus(`Đã nạp ${label} từ file: ${file.name}`, 'ok');
  };
  reader.onerror = () => setStatus(`Không đọc được file ${label}: ${file.name}`, 'error');
  reader.readAsText(file, 'utf-8');
}

function setRunning(running) {
  isRunning = Boolean(running);
  runBatchBtn.disabled = isRunning;
  autoRunBtn.disabled = isRunning;
  if (startPipelineInlineBtn) startPipelineInlineBtn.disabled = isRunning;
  if (runBatchBtn) runBatchBtn.textContent = isRunning ? 'Đang chạy...' : 'Run batch kế tiếp';
  autoRunBtn.textContent = isRunning ? 'Đang chạy pipeline...' : 'Start pipeline';
  if (startPipelineInlineBtn) startPipelineInlineBtn.textContent = isRunning ? 'Đang chạy pipeline...' : 'Start pipeline ngay';
}

function statusLabel(scene) {
  if (scene.status === 'error') return `Error: ${scene.error || ''}`;
  return ({ queued: 'Queued', running: 'Running', waiting_review: 'Waiting review', asset_review: 'Review asset', approved: 'Approved', skipped: 'Skipped', image_generating: 'Generating image', image_done: 'Image done', video_generating: 'Generating video', video_done: 'Video done' })[scene.status] || scene.status;
}

function renderAssetReview(scene) {
  const image = renderImagePreview(scene);
  if (!image && !scene.imagePath) return '';
  return `<div class="review-media-stack">${image}<div class="review-hint">Kiểm tra keyframe. Nếu chưa ổn: Edit image hoặc Tạo lại.</div></div>`;
}

function renderImagePreview(scene) {
  const src = scene.imageDataUrl || (scene.imagePath ? `file:///${String(scene.imagePath).replaceAll('\\', '/')}` : '');
  if (!src) return '';
  return `<figure class="scene-image-preview"><img src="${escapeHtml(src)}" alt="Scene ${scene.id} keyframe"><figcaption>Keyframe đã lưu</figcaption></figure>`;
}

function renderVideoPreview(scene) {
  if (!scene.videoPath) {
    if (scene.videoStatus) return `<div class="review-hint">Video đã gửi lên nền tảng. Nếu chưa tự tải được, tải thủ công rồi lưu vào folder scene.</div>`;
    return '';
  }
  const src = `file:///${String(scene.videoPath).replaceAll('\\', '/')}`;
  return `<figure class="scene-video-preview"><video src="${escapeHtml(src)}" controls preload="metadata"></video><figcaption>Video đã lưu — review trước khi Next</figcaption></figure><div class="review-hint">Nếu chưa ổn: Edit motion hoặc Tạo lại.</div>`;
}

function getCurrentReviewScene() {
  if (!project) return null;
  const isReviewable = (scene) => scene && (
    scene.status === 'waiting_review'
    || scene.status === 'asset_review'
    || scene.status === 'error'
  );
  if (reviewSceneId) {
    const selected = project.scenes.find((scene) => scene.id === reviewSceneId);
    if (isReviewable(selected)) return selected;
  }
  return project.scenes.find((scene) => activeBatchIds.includes(scene.id) && isReviewable(scene))
    || project.scenes.find(isReviewable)
    || null;
}

function openAssetReview(sceneId) {
  const scene = sceneId ? project?.scenes.find((item) => item.id === sceneId) : getCurrentReviewScene();
  if (!scene) {
    setStatus('Chưa có scene cần review.', 'error');
    return;
  }
  reviewSceneId = scene.id;
  renderAssetReviewModal();
  if (!assetReviewDialog.open) assetReviewDialog.showModal();
}

function renderAssetReviewModal() {
  const scene = getCurrentReviewScene();
  if (!scene) {
    reviewSceneTitle.textContent = 'Chưa có scene cần review';
    reviewSceneStatus.textContent = 'Chạy pipeline để tạo ảnh/video rồi review tại popup này.';
    reviewOriginal.textContent = '—';
    reviewImagePrompt.textContent = '—';
    reviewMotionPrompt.textContent = '—';
    reviewStatusBadge.innerHTML = '';
    if (reviewMediaPanel) reviewMediaPanel.hidden = true;
    if (reviewMediaStage) reviewMediaStage.innerHTML = '<div class="empty-review-media">Chưa có ảnh/video để review.</div>';
    return;
  }
  reviewSceneId = scene.id;
  reviewSceneKicker.textContent = `Scene #${scene.id}`;
  const reviewType = scene.status === 'waiting_review' ? 'prompt' : scene.reviewType || (scene.videoPath ? 'video' : scene.imagePath ? 'image' : 'prompt');
  const showMedia = reviewType === 'image' || reviewType === 'video';
  assetReviewDialog?.classList.toggle('prompt-review-dialog', !showMedia);
  assetReviewDialog?.classList.toggle('media-review-dialog', showMedia);
  const reviewGrid = assetReviewDialog?.querySelector('.asset-review-grid');
  reviewGrid?.classList.toggle('media-review-grid', showMedia);
  reviewGrid?.classList.toggle('prompt-review-grid', !showMedia);
  reviewSceneTitle.textContent = reviewType === 'video' ? 'Review video đã tạo' : reviewType === 'image' ? 'Review ảnh keyframe' : 'Review prompt trước khi tạo';
  reviewSceneStatus.textContent = reviewType === 'video'
    ? 'Video đã lưu. Nếu ổn bấm Next; nếu chưa ổn sửa motion prompt hoặc tạo lại.'
    : reviewType === 'image'
      ? 'Ảnh đã lưu. Pipeline sẽ chưa qua scene tiếp theo cho tới khi bác duyệt.'
      : 'Review prompt lần này. Duyệt xong bấm Chạy tự động toàn bộ để tạo ảnh, popup prompt này sẽ không hiện lại.';
  reviewOriginal.textContent = scene.original || '—';
  reviewImagePrompt.textContent = scene.imagePrompt || '—';
  reviewMotionPrompt.textContent = scene.motionPrompt || '—';
  reviewStatusBadge.innerHTML = `<span class="status-badge ${scene.status}">${escapeHtml(statusLabel(scene))}</span>`;
  if (reviewMediaPanel) reviewMediaPanel.hidden = !showMedia;
  if (reviewMediaStage) {
    reviewMediaStage.style.setProperty('--review-zoom', `${reviewZoom / 100}`);
    reviewMediaStage.innerHTML = showMedia ? renderFocusedMedia(scene, reviewType) : '<div class="empty-review-media">Prompt review không cần preview ảnh/video.</div>';
  }
  if (zoomRange) zoomRange.value = String(reviewZoom);
}

function renderFocusedMedia(scene, reviewType) {
  if (reviewType === 'video' && scene.videoPath) {
    const src = `file:///${String(scene.videoPath).replaceAll('\\', '/')}`;
    return `<video class="focused-media" src="${escapeHtml(src)}" controls autoplay loop preload="metadata"></video>`;
  }
  const imageSrc = scene.imageDataUrl || (scene.imagePath ? `file:///${String(scene.imagePath).replaceAll('\\', '/')}` : '');
  if (imageSrc) {
    return `<img class="focused-media" src="${escapeHtml(imageSrc)}" alt="Scene ${scene.id} generated asset">`;
  }
  return '<div class="empty-review-media">Không tìm thấy file ảnh/video đã lưu. Kiểm tra output folder hoặc tạo lại scene.</div>';
}

function setReviewZoom(value) {
  reviewZoom = clamp(value, 60, 200);
  if (zoomRange) zoomRange.value = String(reviewZoom);
  renderAssetReviewModal();
}

function approveCurrentReviewScene() {
  const scene = getCurrentReviewScene();
  if (!scene) return;
  const reviewType = scene.status === 'waiting_review' ? 'prompt' : scene.reviewType || (scene.videoPath ? 'video' : scene.imagePath ? 'image' : 'prompt');
  scene.status = reviewType === 'video' ? 'video_done' : reviewType === 'image' ? 'image_done' : 'approved';
  scene.progressStep = reviewType === 'video' ? 'merge' : reviewType === 'image' ? 'motion' : 'image';
  scene.reviewType = '';
  scene.reviewedAt = new Date().toISOString();
  reviewSceneId = null;
  persist();
  render();
  if (assetReviewDialog?.open) {
    try {
      assetReviewDialog.close();
    } catch (error) {
      console.warn('Không đóng được review dialog:', error);
    }
  }
  setStatus(reviewType === 'video'
    ? `Scene ${scene.id} đã duyệt video. Tool đang tự chạy scene tiếp theo...`
    : reviewType === 'image'
      ? `Scene ${scene.id} đã duyệt ảnh. Tool đang gửi ảnh + motion prompt lên nền tảng video...`
      : `Scene ${scene.id} đã duyệt prompt. Tool đang tạo ảnh keyframe...`, 'ok');
  queueAutoContinue();
}

function regenerateCurrentReviewScene() {
  const scene = getCurrentReviewScene();
  if (!scene) return;
  scene.status = 'waiting_review';
  scene.reviewType = 'prompt';
  scene.imagePath = '';
  scene.imageDataUrl = '';
  scene.videoPath = '';
  scene.videoStatus = '';
  scene.progressStep = 'prompt';
  scene.error = '';
  scene.forceRegenerateImage = true;
  scene.updatedAt = new Date().toISOString();
  persist();
  render();
  setStatus(`Scene ${scene.id} đã đưa về chờ tạo lại. Chỉnh prompt nếu cần rồi bấm Chạy tự động toàn bộ.`, 'ok');
}



function escapeHtml(value) {
  return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function fileUrl(filePath) {
  return filePath ? `file:///${String(filePath).replaceAll('\\', '/')}` : '';
}

async function mergeAndShowFinalPreview(options = {}) {
  if (!outputFolder || !window.videoPlannerAPI?.mergeVideos) return null;
  setStatus('Đang merge video final và dựng timeline preview...', 'running');
  const result = await window.videoPlannerAPI.mergeVideos(outputFolder);
  renderFinalPreview(result);
  if (options.scrollIntoView) {
    finalPreviewCard?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    finalPreviewVideo?.play?.().catch(() => null);
  }
  setStatus(`Đã merge final video: ${result.count} scene.`, 'ok');
  return result;
}

function renderFinalPreview(result = null) {
  if (!finalPreviewCard || !finalPreviewVideo || !finalSceneTimeline) return;
  const outputPath = result?.outputPath || project?.finalVideoPath || '';
  const hasAnyVideo = Boolean(project?.scenes?.some((scene) => scene.videoPath));
  finalPreviewCard.hidden = false;

  if (!outputPath && !hasAnyVideo) {
    finalPreviewMeta.textContent = 'Chưa có video nào. Khi scene đầu tiên tạo xong, tool sẽ merge và cập nhật ở đây ngay.';
    finalPreviewVideo.removeAttribute('src');
    finalSceneTimeline.innerHTML = '<div class="timeline-empty-thumb">Đang chờ video scene đầu tiên...</div>';
    return;
  }

  if (outputPath) {
    project.finalVideoPath = outputPath;
    project.finalVideoUpdatedAt = new Date().toISOString();
    if (result?.videos) project.finalTimeline = result.videos;
    persist();
    finalPreviewVideo.src = `${fileUrl(outputPath)}?t=${Date.now()}`;
    if (finalPreviewMeta) finalPreviewMeta.textContent = `${result?.count || project.finalTimeline?.length || 0} scene · ${outputPath}`;
  } else if (finalPreviewMeta) {
    finalPreviewMeta.textContent = 'Đã có video scene, bấm Refresh preview để merge bản final.';
  }

  const timeline = result?.videos || project.finalTimeline || project.scenes.filter((scene) => scene.videoPath).map((scene) => ({
    sceneNumber: scene.id,
    path: scene.videoPath,
    keyframePath: scene.imagePath,
    name: `scene_${String(scene.id).padStart(3, '0')}`,
  }));
  finalSceneTimeline.innerHTML = timeline.map((item, index) => {
    const sceneNo = item.sceneNumber || index + 1;
    const scene = project.scenes.find((entry) => entry.id === sceneNo);
    const thumb = item.keyframePath || scene?.imagePath || '';
    const thumbHtml = thumb
      ? `<img src="${fileUrl(thumb)}" alt="Keyframe scene ${sceneNo}" />`
      : `<div class="timeline-empty-thumb">S${sceneNo}</div>`;
    return `<article class="timeline-scene-card">
      <div class="timeline-thumb">${thumbHtml}</div>
      <div class="timeline-scene-label">Scene ${sceneNo}</div>
      <small>${escapeHtml(item.name || scene?.videoStatus || '')}</small>
    </article>`;
  }).join('<span class="timeline-arrow">→</span>');
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getGrokRouterSettings() {
  return {
    enabled: Boolean(grokRouterEnabledToggle?.checked),
    account: grokAccountSelect?.value || 'grok-default-profile',
    routingPolicy: 'round_robin',
    sandboxFolder: 'dev_sandbox_grok_account_router',
  };
}

function renderGrokRouterStatus(status = {}, accounts = []) {
  if (grokRouterEnabledToggle) grokRouterEnabledToggle.checked = Boolean(status.accountRouterEnabled);
  if (grokRoutingPolicySelect) grokRoutingPolicySelect.value = status.routingPolicy || 'round_robin';
  if (grokRouterState) {
    const state = status.accountRouterEnabled ? (status.paused ? 'Paused' : 'Enabled') : 'Off';
    grokRouterState.textContent = `${state} / ${status.routingPolicy || 'round_robin'}`;
  }
  if (grokAccountSelect) {
    grokAccountSelect.innerHTML = '';
    accounts.forEach((account) => {
      const option = document.createElement('option');
      option.value = account.accountId;
      option.textContent = `${account.label || account.accountId} · ${account.maskedEmail || '***@masked.local'} · ${account.state}`;
      option.disabled = ['limited', 'login_required', 'invalid', 'disabled_by_user'].includes(account.state);
      option.selected = account.selected;
      grokAccountSelect.appendChild(option);
    });
  }
  if (grokAccountList) {
    grokAccountList.innerHTML = '';
    accounts.forEach((account) => {
      const item = document.createElement('div');
      item.className = `grok-account-row state-${account.state || 'invalid'}`;
      item.textContent = `${account.selected ? 'Active' : 'Account'}: ${account.label || account.accountId} / ${account.maskedEmail || '***@masked.local'} / ${account.state}`;
      grokAccountList.appendChild(item);
    });
  }
  if (grokRouterMessage) {
    const checkpoint = status.checkpointStatus && status.checkpointStatus !== 'none' ? ` Checkpoint: ${status.checkpointStatus}.` : '';
    grokRouterMessage.textContent = status.lastSafeMessage || (status.accountRouterEnabled ? `Router enabled.${checkpoint}` : 'Router off: single-account Grok pipeline is active.');
  }
}

async function refreshGrokRouterStatus() {
  if (!window.videoPlannerAPI?.getGrokRouterStatus || !window.videoPlannerAPI?.listGrokAccountsSafe) return;
  const [status, accounts] = await Promise.all([
    window.videoPlannerAPI.getGrokRouterStatus(),
    window.videoPlannerAPI.listGrokAccountsSafe(),
  ]);
  renderGrokRouterStatus(status, accounts);
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ project, activeBatchIds, paused, outputFolder, grokRouter: getGrokRouterSettings() }));
}

async function reconcileSavedAssets() {
  if (!project?.scenes?.length || !window.videoPlannerAPI?.assetExists) return { missing: 0 };
  let missing = 0;
  for (const scene of project.scenes) {
    if (scene.imagePath && !(await window.videoPlannerAPI.assetExists(scene.imagePath).catch(() => false))) {
      scene.imagePath = '';
      scene.imageDataUrl = '';
      if (['image_done', 'video_generating', 'asset_review'].includes(scene.status)) scene.status = 'waiting_review';
      missing += 1;
    }
    if (scene.videoPath && !(await window.videoPlannerAPI.assetExists(scene.videoPath).catch(() => false))) {
      scene.videoPath = '';
      if (scene.status === 'video_done') scene.status = 'image_done';
      missing += 1;
    }
  }
  return { missing };
}

async function saveSessionForNextLaunch() {
  const checked = await reconcileSavedAssets();
  persist();
  localStorage.setItem(RESTORE_SESSION_KEY, '1');
  const logPath = await window.videoPlannerAPI?.getAppLogPath?.().catch(() => '');
  setStatus(`Đã lưu session${checked.missing ? `, bỏ qua ${checked.missing} asset không còn trên ổ đĩa` : ''}. Log: ${logPath || 'đã ghi file log'}`, 'ok');
}

function restore() {
  try {
    const shouldRestore = localStorage.getItem(RESTORE_SESSION_KEY) === '1';
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    outputFolder = saved.outputFolder || '';
    localStorage.removeItem(RESTORE_SESSION_KEY);
    if (shouldRestore && saved.project) {
      project = saved.project;
      activeBatchIds = saved.activeBatchIds || [];
      paused = Boolean(saved.paused);
      projectNameInput.value = project.name || projectNameInput.value;
      storyInput.value = project.story || '';
      scriptInput.value = project.scenes?.map((scene) => scene.original).join('\n\n') || '';
      batchSizeInput.value = project.batchSize || batchSizeInput.value;
      durationInput.value = project.durationSec || durationInput.value;
      if (grokRouterEnabledToggle) grokRouterEnabledToggle.checked = Boolean(saved.grokRouter?.enabled);
      if (saved.grokRouter?.account && grokAccountSelect) grokAccountSelect.value = saved.grokRouter.account;
      if (grokRoutingPolicySelect) grokRoutingPolicySelect.value = 'round_robin';
      if (outputFolder) webSessionStatus.textContent = `Folder lưu: ${outputFolder}`;
      setStatus('Đã khôi phục session đã lưu. Có thể bấm Start pipeline để chạy tiếp.', 'ok');
    } else {
      localStorage.removeItem(STORAGE_KEY);
      project = null;
      activeBatchIds = [];
      paused = false;
      if (outputFolder) webSessionStatus.textContent = `Folder lưu: ${outputFolder}`;
      setStatus('Phiên mới: đã xóa tiến trình cũ. Bấm Start pipeline để chạy lại từ scene 1.', 'idle');
    }
  } catch (_error) {
    project = null;
    activeBatchIds = [];
    paused = false;
  }
  render();
}

projectForm.addEventListener('submit', createProject);
runBatchBtn?.addEventListener('click', () => runNextBatch());
pauseBtn.addEventListener('click', pauseRun);
resumeBtn.addEventListener('click', resumeRun);
exportBtn.addEventListener('click', exportProject);
chooseOutputFolderBtn.addEventListener('click', chooseOutputFolder);
saveSessionBtn?.addEventListener('click', saveSessionForNextLaunch);
grokAccountSelect?.addEventListener('change', () => {
  window.videoPlannerAPI?.selectGrokAccount?.(grokAccountSelect.value)
    .then((result) => {
      if (!result?.ok) setStatus(result?.error || 'Không chọn được Grok account.', 'error');
      return refreshGrokRouterStatus();
    })
    .catch((error) => setStatus(`Không chọn được Grok account: ${error.message}`, 'error'));
  persist();
});
grokRouterEnabledToggle?.addEventListener('change', () => {
  window.videoPlannerAPI?.setAccountRouterEnabled?.(grokRouterEnabledToggle.checked)
    .then(() => refreshGrokRouterStatus())
    .catch((error) => setStatus(`Không đổi được router flag: ${error.message}`, 'error'));
  persist();
});
grokRouterResumeBtn?.addEventListener('click', async () => {
  const result = await window.videoPlannerAPI?.resumeFromRouterCheckpoint?.();
  if (result?.ok) {
    setStatus('Grok router checkpoint đã sẵn sàng. Bấm Start pipeline để chạy tiếp an toàn.', 'ok');
  } else {
    setStatus(result?.error || 'Không có checkpoint Grok router để resume.', 'error');
  }
  await refreshGrokRouterStatus();
});
openGrokRouterFolderBtn?.addEventListener('click', async () => {
  const result = await window.videoPlannerAPI?.openGrokRouterFolder?.();
  if (result?.ok) {
    setStatus(`Đã mở folder account router: ${result.path}`, 'ok');
  } else {
    setStatus('Không mở được folder dev_sandbox_grok_account_router.', 'error');
  }
});
autoRunBtn?.addEventListener('click', startPipelineFromClick);
autoRunBtn?.addEventListener('pointerdown', startPipelineFromClick, { capture: true });
startPipelineInlineBtn?.addEventListener('click', startPipelineFromClick);
startPipelineInlineBtn?.addEventListener('pointerdown', startPipelineFromClick, { capture: true });
document.addEventListener('click', (event) => {
  if (event.target?.closest?.('#auto-run-btn, #start-pipeline-inline-btn')) startPipelineFromClick(event);
}, true);
storyFileInput?.addEventListener('change', () => loadTextFileToTextarea(storyFileInput, storyInput, storyFileName, 'story'));
scriptFileInput?.addEventListener('change', () => loadTextFileToTextarea(scriptFileInput, scriptInput, scriptFileName, 'scene script'));
openReviewBtn.addEventListener('click', () => openAssetReview());
reviewEditImageBtn.addEventListener('click', () => {
  const scene = getCurrentReviewScene();
  if (scene) openEditor(scene, 'imagePrompt');
});
reviewEditMotionBtn.addEventListener('click', () => {
  const scene = getCurrentReviewScene();
  if (scene) openEditor(scene, 'motionPrompt');
});
reviewRegenerateBtn.addEventListener('click', regenerateCurrentReviewScene);
reviewApproveBtn.addEventListener('click', approveCurrentReviewScene);
clearLogBtn?.addEventListener('click', () => {
  pipelineLogs = [];
  lastStatusText = '';
  renderPipelineLog();
});
refreshFinalPreviewBtn?.addEventListener('click', () => mergeAndShowFinalPreview().catch((error) => setStatus(`Không merge/preview được final video: ${error.message}`, 'error')));
zoomRange?.addEventListener('input', () => {
  reviewZoom = Number(zoomRange.value) || 100;
  renderAssetReviewModal();
});
zoomOutBtn?.addEventListener('click', () => setReviewZoom(reviewZoom - 10));
zoomInBtn?.addEventListener('click', () => setReviewZoom(reviewZoom + 10));
saveEditBtn.addEventListener('click', saveEdit);
videoPlatformSelect?.addEventListener('change', () => {
  syncVideoPlatformConfig();
  render();
});
[pixverseResolutionSelect, pixverseRatioSelect, pixverseDurationSelect, pixverseModelSelect, pixversePreviewToggle, pixverseAudioToggle]
  .filter(Boolean)
  .forEach((control) => control.addEventListener('change', updatePixVerseConfigAdvice));
providerSelect.addEventListener('change', () => {
  if (providerSelect.value === 'ninerouter') modelInput.value = 'cx/gpt-5.5';
  if (providerSelect.value === 'grok') modelInput.value = 'grok-3-latest';
});

window.addEventListener('error', (event) => {
  setStatus(`Renderer lỗi: ${event.message}`, 'error');
});
window.addEventListener('unhandledrejection', (event) => {
  setStatus(`Promise lỗi: ${event.reason?.message || event.reason}`, 'error');
});

syncVideoPlatformConfig();
refreshGrokRouterStatus().catch(() => null);
renderPipelineLog();
window.videoPlannerAPI?.getPipelineLogVisible?.().then(setPipelineLogVisible).catch(() => setPipelineLogVisible(false));
window.videoPlannerAPI?.onPipelineLogVisible?.(setPipelineLogVisible);
window.videoPlannerAPI?.appendAppLog?.({ source: 'renderer', kind: 'info', text: 'Renderer loaded' }).catch(() => null);

restore();
