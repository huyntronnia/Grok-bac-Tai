
/* vidora-crash-guard-renderer-installed */
window.addEventListener('error', (event) => {
  try {
    window.videoPlannerAPI?.appendAppLog?.({
      source: 'renderer',
      kind: 'error',
      text: 'Renderer crash/error: ' + (event.error?.message || event.message || 'unknown'),
      details: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack || '',
      },
    });
  } catch (_error) {}
});

window.addEventListener('unhandledrejection', (event) => {
  try {
    const reason = event.reason;
    window.videoPlannerAPI?.appendAppLog?.({
      source: 'renderer',
      kind: 'error',
      text: 'Renderer unhandled rejection: ' + (reason?.message || String(reason || 'unknown')),
      details: {
        message: reason?.message || String(reason || ''),
        stack: reason?.stack || '',
      },
    });
  } catch (_error) {}
});


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
const newProjectBtn = document.querySelector('#new-project-btn');
const openProjectBtn = document.querySelector('#open-project-btn');
const saveProjectBtn = document.querySelector('#save-project-btn');
const workflowResumeBtn = document.querySelector('#workflow-resume-btn');
const chatGptOpenBtn = document.querySelector('#chatgpt-open-btn');
const chatGptNewChatBtn = document.querySelector('#chatgpt-new-chat-btn');
const chatGptClearCacheBtn = document.querySelector('#chatgpt-clear-cache-btn');
const chatGptRotateScenesInput = document.querySelector('#chatgpt-rotate-scenes-input');
const chatGptAutoReloadToggle = document.querySelector('#chatgpt-auto-reload-toggle');
const chatGptAutoResumeToggle = document.querySelector('#chatgpt-auto-resume-toggle');
const chatGptRetryLimitInput = document.querySelector('#chatgpt-retry-limit-input');
const routerPanel = document.querySelector('.router-panel');
const quickActionsSlot = document.querySelector('#quick-actions-slot');
const projectSaveStatus = document.querySelector('#project-save-status');
const missingAssetWarning = document.querySelector('#missing-asset-warning');
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
const skipPromptReviewToggle = document.querySelector('#skip-prompt-review-toggle');
const skipImageReviewToggle = document.querySelector('#skip-image-review-toggle');
const skipVideoReviewToggle = document.querySelector('#skip-video-review-toggle');
const continuityRefsToggle = document.querySelector('#continuity-refs-toggle');
const continuityMaxKeyframesSelect = document.querySelector('#continuity-max-keyframes-select');
const continuityChatgptToggle = document.querySelector('#continuity-chatgpt-toggle');
const continuityGrokToggle = document.querySelector('#continuity-grok-toggle');
const grokResultRetryLimitInput = document.querySelector('#grok-result-retry-limit');
const settingsDialog = document.querySelector('#settings-dialog');
const settingsSaveBtn = document.querySelector('#settings-save-btn');
const openNv1PromptBtn = document.querySelector('#open-nv1-prompt-btn');
const openNv2PromptBtn = document.querySelector('#open-nv2-prompt-btn');
const imageGenerationMethodSelect = document.querySelector('#image-generation-method-select');
const imageApiEndpointInput = document.querySelector('#image-api-endpoint-input');
const imageApiModelSelect = document.querySelector('#image-api-model-select');
const imageApiSizeInput = document.querySelector('#image-api-size-input');
const imageApiKeyInput = document.querySelector('#image-api-key-input');
const veoupPreviewStartOnlyToggle = document.querySelector('#veoup-preview-start-only-toggle');
const autoRunBtn = document.querySelector('#auto-run-btn');
const customTargetScenesInput = document.querySelector('#custom-target-scenes-input');
let targetSceneCount = 50;
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
const finalPreviewCard = document.querySelector('#final-preview-card');
const finalPreviewVideo = document.querySelector('#final-preview-video');
const finalPreviewMeta = document.querySelector('#final-preview-meta');
const finalSceneTimeline = document.querySelector('#final-scene-timeline');
const refreshFinalPreviewBtn = document.querySelector('#refresh-final-preview-btn');
const clearLogBtn = document.querySelector('#clear-log-btn');
const copyLogBtn = document.querySelector('#copy-log-btn');
const runState = document.querySelector('#run-state');
const metricScenes = document.querySelector('#metric-scenes');
const metricApproved = document.querySelector('#metric-approved');
const metricBatch = document.querySelector('#metric-batch');
const openReviewBtn = document.querySelector('#open-review-btn');
const loginWaitDialog = document.querySelector('#login-wait-dialog');
const loginWaitTitle = document.querySelector('#login-wait-title');
const loginWaitDesc = document.querySelector('#login-wait-desc');
const loginWaitOpenBtn = document.querySelector('#login-wait-open-btn');
const newProjectDialog = document.querySelector('#new-project-dialog');
const newProjectNameInput = document.querySelector('#new-project-name-input');
const newProjectSceneFileInput = document.querySelector('#new-project-scene-file-input');
const newProjectSceneFileName = document.querySelector('#new-project-scene-file-name');
const newProjectSaveLocationInput = document.querySelector('#new-project-save-location-input');
const newProjectChooseLocationBtn = document.querySelector('#new-project-choose-location-btn');
const newProjectCreateBtn = document.querySelector('#new-project-create-btn');
const chatResolveDialog = document.querySelector('#chat-resolve-dialog');
const chatResolveMessage = document.querySelector('#chat-resolve-message');
const chatResolveNewBtn = document.querySelector('#chat-resolve-new-btn');
const chatResolveTitleInput = document.querySelector('#chat-resolve-title-input');
const chatResolveRenameBtn = document.querySelector('#chat-resolve-rename-btn');
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
const reviewMotionBlock = document.querySelector('#review-motion-block');
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
const MAX_AUTO_RESUME_PER_PROJECT = 3;
const DEFAULT_CHATGPT_RETRY_LIMIT = 2;
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
let newProjectSceneText = '';
let newProjectRootFolder = '';
let pendingChatResolve = null;
let reviewZoom = 100;
let pixverseCapability = null;
let pipelineLogs = [];
let pipelineLogVisible = true;
let lastStatusText = '';
let lastStartClickAt = 0;
let isReviewSpaceHeld = false;
let reviewPanState = null;
let isRunning = false;
let autoContinuing = false;
let currentProjectFilePath = '';
let projectDirty = false;
let veoupAutomationInFlight = false;
let lastMissingAssetCount = 0;
let projectRuntime = {
  currentStage: 'idle',
  currentBatchIndex: null,
  currentSceneId: null,
  lastCheckpointRef: null,
  lastAction: null,
  resumeMode: 'manual-start',
  waitingForUserStart: true,
};

function normalizeSceneDuration(value) {
  const numeric = Number(value);
  return numeric <= 6 ? 6 : 10;
}

function applySceneDurationValue(value) {
  if (durationInput) durationInput.value = String(normalizeSceneDuration(value));
  return normalizeSceneDuration(durationInput?.value || value);
}

function getReviewSettings() {
  const skipAll = Boolean(skipReviewToggle?.checked);
  return {
    skipAll,
    skipPrompt: skipAll || Boolean(skipPromptReviewToggle?.checked),
    skipImage: skipAll || Boolean(skipImageReviewToggle?.checked),
    skipVideo: skipAll || Boolean(skipVideoReviewToggle?.checked),
  };
}

function shouldSkipReview(type = 'all') {
  const settings = getReviewSettings();
  if (type === 'prompt') return settings.skipPrompt;
  if (type === 'image') return settings.skipImage;
  if (type === 'video') return settings.skipVideo;
  return settings.skipAll;
}

function applyReviewSettings(settings = {}) {
  if (skipReviewToggle) skipReviewToggle.checked = Boolean(settings.skipAll ?? settings.skipReview);
  if (skipPromptReviewToggle) skipPromptReviewToggle.checked = Boolean(settings.skipPrompt);
  if (skipImageReviewToggle) skipImageReviewToggle.checked = Boolean(settings.skipImage);
  if (skipVideoReviewToggle) skipVideoReviewToggle.checked = Boolean(settings.skipVideo);
}

function getContinuityReferenceSettings() {
  const maxKeyFrames = Math.max(0, Math.min(3, Number(continuityMaxKeyframesSelect?.value || 3) || 3));
  return {
    enabled: continuityRefsToggle?.checked !== false,
    includeLastFrame: true,
    maxKeyFrames,
    sendToChatGPT: continuityChatgptToggle?.checked !== false,
    sendToGrok: Boolean(continuityGrokToggle?.checked),
  };
}

function applyContinuityReferenceSettings(settings = {}) {
  if (continuityRefsToggle) continuityRefsToggle.checked = settings.enabled !== false;
  if (continuityMaxKeyframesSelect) continuityMaxKeyframesSelect.value = String(Math.max(0, Math.min(3, Number(settings.maxKeyFrames ?? 3) || 3)));
  if (continuityChatgptToggle) continuityChatgptToggle.checked = settings.sendToChatGPT !== false;
  if (continuityGrokToggle) continuityGrokToggle.checked = settings.sendToGrok === true;
}

function getGrokRecoverySettings() {
  return {
    resultRetryLimit: clamp(Number(grokResultRetryLimitInput?.value ?? 2) || 0, 0, 10),
  };
}

function applyGrokRecoverySettings(settings = {}) {
  if (grokResultRetryLimitInput) grokResultRetryLimitInput.value = String(clamp(Number(settings.resultRetryLimit ?? settings.retryLimit ?? 2) || 0, 0, 10));
}

function getChatGptStabilitySettings() {
  return {
    rotateEveryScenes: clamp(Number(chatGptRotateScenesInput?.value ?? 3) || 3, 1, 20),
    autoReload: chatGptAutoReloadToggle?.checked !== false,
    autoResume: chatGptAutoResumeToggle?.checked !== false,
    retryLimit: clamp(Number(chatGptRetryLimitInput?.value ?? DEFAULT_CHATGPT_RETRY_LIMIT) || DEFAULT_CHATGPT_RETRY_LIMIT, 1, 5),
    targetSceneCount: clamp(Number(customTargetScenesInput?.value ?? 50) || 50, 1, 100),
  };
}

function applyChatGptStabilitySettings(settings = {}) {
  if (chatGptRotateScenesInput) chatGptRotateScenesInput.value = String(clamp(Number(settings.rotateEveryScenes ?? 3) || 3, 1, 20));
  if (chatGptAutoReloadToggle) chatGptAutoReloadToggle.checked = settings.autoReload !== false;
  if (chatGptAutoResumeToggle) chatGptAutoResumeToggle.checked = settings.autoResume !== false;
  if (chatGptRetryLimitInput) chatGptRetryLimitInput.value = String(clamp(Number(settings.retryLimit ?? DEFAULT_CHATGPT_RETRY_LIMIT) || DEFAULT_CHATGPT_RETRY_LIMIT, 1, 5));
  if (customTargetScenesInput) {
    customTargetScenesInput.value = String(clamp(Number(settings.targetSceneCount ?? 50) || 50, 1, 100));
    targetSceneCount = clamp(Number(settings.targetSceneCount ?? 50) || 50, 1, 100);
  }
}

function getImageGenerationSettings() {
  return {
    method: imageGenerationMethodSelect?.value || 'web',
    endpoint: imageApiEndpointInput?.value?.trim() || 'http://localhost:20128/v1/images/generations',
    model: imageApiModelSelect?.value || 'cx/gpt-5.5-image',
    size: imageApiSizeInput?.value?.trim() || '1024x1024',
    apiKey: imageApiKeyInput?.value?.trim() || '',
  };
}

function applyImageGenerationSettings(settings = {}) {
  if (imageGenerationMethodSelect) imageGenerationMethodSelect.value = settings.method || 'web';
  if (imageApiEndpointInput) imageApiEndpointInput.value = settings.endpoint || 'http://localhost:20128/v1/images/generations';
  if (imageApiModelSelect) imageApiModelSelect.value = settings.model || 'cx/gpt-5.5-image';
  if (imageApiSizeInput) imageApiSizeInput.value = settings.size || '1024x1024';
  if (imageApiKeyInput) imageApiKeyInput.value = settings.apiKey || '';
}

function embedRouterPanelInSettings() {
  if (!routerPanel || !settingsDialog) return;
  const settingsCard = settingsDialog.querySelector('.settings-card');
  if (!settingsCard || settingsCard.contains(routerPanel)) return;
  const firstSettingsSection = settingsCard.querySelector('.settings-section');
  routerPanel.classList.add('settings-embedded-router');
  settingsCard.insertBefore(routerPanel, firstSettingsSection || settingsCard.querySelector('.dialog-actions'));
}

function moveProjectActionsOutsideSettings() {
  const actions = document.querySelector('.browser-login-actions.stacked-actions');
  if (!actions || !quickActionsSlot || quickActionsSlot.contains(actions)) return;
  actions.classList.add('quick-actions-stack');
  quickActionsSlot.appendChild(actions);
}

function openSettingsDialog() {
  embedRouterPanelInSettings();
  moveProjectActionsOutsideSettings();
  updateVeoUpSetupUI().catch(() => null);
  settingsDialog?.showModal?.();
}

function saveSettingsDialog() {
  persist();
  settingsDialog?.close?.();
  setStatus('Đã lưu Settings review automation.', 'ok');
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
  const story = storyInput?.value?.trim() || '';
  const script = scriptInput.value.trim();
  if (!script) {
    setStatus('Cần nhập scene.', 'error');
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
    chatContextTitle: projectNameInput.value.trim() || 'Untitled project',
    scenes,
    batchSize: clamp(Number(batchSizeInput.value) || 10, 1, 10),
    durationSec: applySceneDurationValue(durationInput.value),
    continuityReferences: getContinuityReferenceSettings(),
    createdAt: new Date().toISOString(),
  };
  activeBatchIds = [];
  paused = false;
  projectRuntime = { ...projectRuntime, currentStage: 'prompt_pending', currentBatchIndex: null, currentSceneId: null, lastAction: 'create_project', waitingForUserStart: true };
  markProjectDirty();
  persist();
  render();
  setStatus(`Đã parse ${scenes.length} scene. Bấm Start pipeline để tool tạo prompt và chạy workflow.`, 'ok');
  return project;
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
  projectRuntime = { ...projectRuntime, currentStage: 'generating_prompts', currentBatchIndex: 0, currentSceneId: batch[0] ? getSceneRef(batch[0], project.scenes.indexOf(batch[0])) : null, lastAction: 'generate_prompts', waitingForUserStart: false };

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
      scene.imagePrompt = scene.original || buildImagePrompt(scene);
      scene.motionPrompt = '';
      scene.status = 'approved';
      scene.reviewType = '';
      scene.provider = providerSelect.value;
      scene.account = accountSelect.value;
      scene.updatedAt = new Date().toISOString();
      await syncProjectSceneFolders();
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
    setStatus(`Batch ${activeBatchIds[0]}-${activeBatchIds.at(-1)} đã sẵn sàng. Tool sẽ gửi Kịch bản + Nhiệm vụ 1 + Scene trực tiếp để tạo ảnh.`, 'ok');
  }
  render();
}

async function syncProjectSceneFolders({ repairFromDisk = false } = {}) {
  if (!outputFolder || !project?.scenes?.length || !window.videoPlannerAPI?.ensureProjectSceneFolders) return null;
  const result = await window.videoPlannerAPI.ensureProjectSceneFolders({ outputFolder, scenes: project.scenes }).catch(() => null);
  if (repairFromDisk && result?.records?.length) {
    result.records.forEach((record) => {
      const scene = project.scenes.find((item) => String(item.id) === String(record.sceneId) || String(item.sceneId) === String(record.sceneId));
      if (!scene) return;
      if (record.keyframeExists) {
        scene.imagePath = record.keyframePath;
      } else {
        scene.imagePath = '';
        scene.imageDataUrl = '';
      }
      if (record.videoExists) {
        scene.videoPath = record.videoPath;
        scene.status = 'video_done';
        scene.progressStep = 'merge';
        scene.reviewType = '';
      } else {
        scene.videoPath = '';
        if (record.keyframeExists) {
          scene.status = scene.motionPrompt ? 'image_done' : 'image_done';
          scene.progressStep = 'motion';
          scene.reviewType = '';
        } else {
          scene.status = scene.imagePrompt ? 'waiting_review' : 'queued';
          scene.progressStep = scene.imagePrompt ? 'prompt' : 'queued';
          scene.reviewType = scene.imagePrompt ? 'prompt' : '';
        }
      }
      projectDirty = true;
    });
    activeBatchIds = normalizeActiveBatchIdsForRuntime(activeBatchIds, project.scenes);
  }
  return result;
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
  markProjectDirty();
  persist();
  setStatus('Đã pause. Có thể đổi account/model rồi Resume.', 'running');
  render();
}

function resumeRun() {
  paused = false;
  if (activeBatchIds.length) {
    autoRunRoute();
    return;
  }
  runNextBatch();
}

function findFirstIncompleteSceneForWorkflow() {
  return (project?.scenes || []).find((scene) => {
    if (!scene || scene.status === 'skipped') return false;
    if (isImageMotionOnlyModeEnabled()) return !scene.imagePath || !(scene.motionPrompt || scene.motionPromptPath);
    return !['done', 'video_done'].includes(scene.status) && !(scene.videoPath || scene.videoUrl || scene.finalVideoPath || scene.outputVideoPath);
  });
}

async function recoverWorkflowRun() {
  if (!project) {
    setStatus('No project loaded to recover.', 'error');
    return;
  }
  if (!outputFolder) {
    await chooseOutputFolder();
    if (!outputFolder) return;
  }
  const settings = getChatGptStabilitySettings();
  const autoResumeCount = Number(projectRuntime.autoResumeCount || 0);
  if (settings.autoResume && autoResumeCount >= MAX_AUTO_RESUME_PER_PROJECT) {
    setStatus('Workflow recovery limit reached for this project. Press Start pipeline manually after checking outputs.', 'error');
    return;
  }
  if (!activeBatchIds.length) {
    const nextScene = findFirstIncompleteSceneForWorkflow();
    if (nextScene) activeBatchIds = [nextScene.id];
  }
  if (!activeBatchIds.length) {
    setStatus('Không có scene chưa hoàn thành. Đang quét project và khởi chạy VeoUp...', 'running');
    const res = await window.videoPlannerAPI?.scanProjectAndRunVeoUp?.({
      projectDir: outputFolder,
      expectedSceneCount: project.scenes.length,
      projectName: project.name || '',
      previewStartButtonOnly: Boolean(veoupPreviewStartOnlyToggle?.checked)
    });
    if (res && res.ok) {
      setStatus(`Quét project thành công! Chạy VeoUp hoàn tất: ${res.imageCount} ảnh.`, 'ok');
    } else {
      setStatus(`Không thể chạy VeoUp: ${res?.error || 'Unknown error'}`, 'error');
    }
    render();
    return;
  }
  paused = false;
  projectRuntime = {
    ...projectRuntime,
    autoResumeCount: autoResumeCount + 1,
    resumeMode: 'manual-recovery',
    waitingForUserStart: false,
    lastAction: 'workflow_recovery',
  };
  persist();
  render();
  setStatus('Recovering workflow from scene ' + activeBatchIds[0] + '.', 'running');
  await autoRunRoute();
}

async function openChatGptWindow() {
  const result = await window.videoPlannerAPI?.openWebLogin?.('chatgpt').catch((error) => ({ ok: false, error: error.message }));
  setStatus(result?.ok ? 'ChatGPT window opened.' : 'Cannot open ChatGPT: ' + (result?.error || 'unknown error'), result?.ok ? 'ok' : 'error');
}

async function openFreshChatGptWindow() {
  const result = await window.videoPlannerAPI?.openFreshChatGpt?.().catch((error) => ({ ok: false, error: error.message }));
  setStatus(result?.ok ? 'Fresh ChatGPT conversation opened.' : 'Cannot create fresh ChatGPT conversation: ' + (result?.error || 'unknown error'), result?.ok ? 'ok' : 'error');
}

async function clearChatGptCache() {
  setStatus('Đang xóa cache tạm ChatGPT...', 'running');
  const res = await window.videoPlannerAPI?.clearChatGptCache?.().catch((error) => ({ ok: false, error: error.message }));
  if (res && res.ok) {
    setStatus('Đã xóa cache tạm ChatGPT thành công!', 'ok');
  } else {
    setStatus(`Lỗi khi xóa cache: ${res?.error || 'unknown'}`, 'error');
  }
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
  markProjectDirty();
  persist();
  webSessionStatus.textContent = `Folder lưu: ${folder}`;
  render();
}

async function checkSelectedWebLogin() {
  const webProvider = getSelectedWebProvider();
  const state = await window.videoPlannerAPI.checkWebLogin(webProvider, {});
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



function ensureChatChoiceFields() {
  if (!project) return;
  project.chatContextTitle = project.chatContextTitle || '';
  project.chatResolveChoice = project.chatResolveChoice || '';
  project.pendingChatRenameTitle = project.pendingChatRenameTitle || '';
  project.chatChoiceConfirmed = project.chatChoiceConfirmed === true;
}

function shouldAskChatGptChatChoice(scene) {
  if (!project || !scene) return false;
  ensureChatChoiceFields();

  // Chỉ bỏ qua hỏi nếu user đã chọn trong dialog mới.
  if (project.chatChoiceConfirmed === true) return false;

  const imageSettings = getImageGenerationSettings?.() || {};
  if (imageSettings.method === 'api') return false;

  const alreadyHasImage = Boolean(scene.imagePath || scene.imageDataUrl);
  if (alreadyHasImage && !scene.forceRegenerateImage) return false;

  return true;
}

function requireChatGptChatChoiceBeforeRun(scene) {
  if (!shouldAskChatGptChatChoice(scene)) return false;

  paused = true;
  isRunning = false;
  autoContinuing = false;

  if (scene && ['running', 'image_generating', 'keyframe_generating'].includes(scene.status)) {
    scene.status = scene.imagePath ? 'image_done' : 'approved';
  }

  openChatResolveDialog(scene, 'choose-chat-before-run');
  setStatus('Chọn cách dùng ChatGPT trước: tạo chat mới hoặc nhập tên chat cũ để tool vào rồi đổi tên.', 'error');
  persist();
  render();
  return true;
}


function getSceneVideoPathValue(scene) {
  return scene?.videoPath || scene?.videoUrl || scene?.finalVideoPath || scene?.outputVideoPath || '';
}

function getSceneKeyframePathValue(scene) {
  return scene?.imagePath || scene?.imageUrl || scene?.keyframePath || scene?.keyframeUrl || '';
}

function findFirstIncompleteSceneBefore(sceneId) {
  if (!project?.scenes?.length) return null;

  const sorted = [...project.scenes].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  for (const scene of sorted) {
    const id = Number(scene.id || 0);
    if (!id || id >= Number(sceneId || 0)) continue;

    if (!sceneHasRequiredOutputForCurrentMode(scene)) {
      return scene;
    }
  }

  return null;
}

function shouldBlockSceneBecausePreviousVideoMissing(scene) {
  const previous = findFirstIncompleteSceneBefore(scene?.id);
  return previous || null;
}


function safeAddPipelineLog(source, kind, text, details = null) {
  try {
    if (typeof addPipelineLog === 'function') {
      addPipelineLog(source, kind, text, details);
      return;
    }
  } catch (_error) {}

  try {
    if (Array.isArray(pipelineLogs)) {
      pipelineLogs.unshift({
        time: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
        source,
        kind,
        text,
        details,
      });

      if (pipelineLogs.length > 300) pipelineLogs = pipelineLogs.slice(0, 300);
      renderPipelineLog?.();
    }
  } catch (_error) {}
}

function sceneHasMotionPromptOutput(scene) {
  return Boolean(
    scene?.motionPrompt ||
    scene?.motionPromptPath ||
    scene?.videoStatus === 'skipped-image-motion-only'
  );
}

function sceneHasRequiredOutputForCurrentMode(scene) {
  if (isImageMotionOnlyModeEnabled()) {
    return sceneHasMotionPromptOutput(scene);
  }

  return Boolean(scene?.videoPath || scene?.videoUrl || scene?.finalVideoPath || scene?.outputVideoPath);
}

function sceneHasVideoOutput(scene) {
  return sceneHasRequiredOutputForCurrentMode(scene);
}

function findFirstSceneMissingVideo() {
  if (!project?.scenes?.length) return null;

  return [...project.scenes]
    .sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
    .find((scene) => !sceneHasRequiredOutputForCurrentMode(scene)) || null;
}

function forceResumeFirstIncompleteSceneIfNeeded() {
  const firstIncomplete = findFirstSceneMissingVideo();
  if (!firstIncomplete) return false;

  const id = Number(firstIncomplete.id || 0);
  if (!id) return false;

  const currentIds = Array.isArray(activeBatchIds) ? activeBatchIds.map(Number) : [];

  // Nếu batch hiện tại đã bắt đầu bằng scene cần chạy tiếp thì không đổi.
  if (currentIds.length && currentIds[0] === id) return false;

  // Trong image+motion-only, nếu batch 2-10 đang có scene chưa có motion prompt,
  // giữ batch đó thay vì ép quay lại scene 1 đã xong motion.
  if (isImageMotionOnlyModeEnabled() && currentIds.includes(id)) {
    safeAddPipelineLog(
      'renderer',
      'running',
      `Image + motion only: giữ batch hiện tại, scene tiếp theo cần chạy là scene ${id}.`,
      { activeBatchIds }
    );
    return false;
  }

  activeBatchIds = [id];

  if (isImageMotionOnlyModeEnabled()) {
    firstIncomplete.status = firstIncomplete.imagePath ? 'motion_prompt_pending' : 'image_generating';
    firstIncomplete.progressStep = firstIncomplete.imagePath ? 'motion' : 'image';
  } else if (firstIncomplete.motionPrompt && !sceneHasVideoOutput(firstIncomplete)) {
    firstIncomplete.status = 'video_pending';
    firstIncomplete.progressStep = 'video';
  } else if (firstIncomplete.imagePath && !firstIncomplete.motionPrompt) {
    firstIncomplete.status = 'motion_prompt_pending';
    firstIncomplete.progressStep = 'motion';
  }

  safeAddPipelineLog(
    'renderer',
    'running',
    isImageMotionOnlyModeEnabled()
      ? `Resume guard: ép pipeline về scene ${id} vì scene này chưa có motion prompt.`
      : `Resume guard: scene ${id} chưa có video, ép pipeline quay lại scene này trước khi chạy scene sau.`,
    { activeBatchIds }
  );

  return true;
}



function isImageMotionOnlyModeEnabled() {
  return Boolean(project?.imageMotionOnlyMode || document.querySelector('#image-motion-only-mode')?.checked);
}

function forceChatGptImageMotionOnlyWorkflow() {
  if (project) project.imageMotionOnlyMode = true;
  ensureImageMotionOnlyModeControl();

  const checkbox = document.querySelector('#image-motion-only-mode');
  if (checkbox) checkbox.checked = true;

  if (grokRouterEnabledToggle) grokRouterEnabledToggle.checked = false;
  if (continuityGrokToggle) continuityGrokToggle.checked = false;

  window.videoPlannerAPI?.setAccountRouterEnabled?.(false)
    .then(() => refreshGrokRouterStatus?.())
    .catch((error) => safeAddPipelineLog?.('renderer', 'error', `Could not disable Grok router: ${error.message || error}`));

  persist?.();
}

function ensureImageMotionOnlyModeControl() {
  try {
    if (document.querySelector('#image-motion-only-mode-card')) {
      const checkbox = document.querySelector('#image-motion-only-mode');
      if (checkbox && project) checkbox.checked = Boolean(project.imageMotionOnlyMode);
      return;
    }

    const startBtn =
      document.querySelector('#start-pipeline-btn') ||
      document.querySelector('#start-full-pipeline-btn') ||
      document.querySelector('[data-action="start-pipeline"]') ||
      Array.from(document.querySelectorAll('button')).find((btn) =>
        /start pipeline|chạy pipeline|pipeline ngay/i.test(String(btn.innerText || btn.textContent || ''))
      );

    const card = document.createElement('div');
    card.id = 'image-motion-only-mode-card';
    card.className = 'image-motion-only-mode-card';
    card.innerHTML = `
      <label class="image-motion-only-mode-label">
        <input id="image-motion-only-mode" type="checkbox" />
        <span>
          <b>Chỉ tạo ảnh + motion prompt</b>
          <small>Bỏ qua Grok/Veo/video. Dùng khi acc video die, tự đem ảnh + prompt đi làm tay.</small>
        </span>
      </label>
    `;

    const checkbox = card.querySelector('#image-motion-only-mode');
    checkbox.checked = Boolean(project?.imageMotionOnlyMode);
    checkbox.addEventListener('change', () => {
      if (project) {
        project.imageMotionOnlyMode = checkbox.checked;
        persist?.();
      }

      setStatus(
        checkbox.checked
          ? 'Đã bật chế độ chỉ tạo ảnh + motion prompt, sẽ bỏ qua Grok/Veo/video.'
          : 'Đã tắt chế độ chỉ tạo ảnh + motion prompt.',
        checkbox.checked ? 'ok' : 'idle'
      );
    });

    if (startBtn?.parentElement) {
      startBtn.parentElement.insertBefore(card, startBtn);
    } else {
      document.body.appendChild(card);
    }
  } catch (error) {
    console.warn('ensureImageMotionOnlyModeControl failed', error);
  }
}



function getCompletedScenesCount() {
  if (!project?.scenes) return 0;
  const imageMotionOnly = isImageMotionOnlyModeEnabled();
  return project.scenes.filter((scene) => {
    if (scene.status === 'skipped') return false;
    if (imageMotionOnly) {
      return Boolean(scene.imagePath && (scene.motionPrompt || scene.motionPromptPath));
    } else {
      return Boolean(scene.videoPath || scene.status === 'video_done');
    }
  }).length;
}

function getNextBatchForSegment(doneSceneId = 0) {
  if (!project?.scenes?.length) return [];

  const sorted = [...project.scenes].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  const imageMotionOnly = isImageMotionOnlyModeEnabled();

  const next = sorted.find((scene) => {
    const id = Number(scene.id || 0);
    if (!id || id <= Number(doneSceneId || 0)) return false;

    if (scene.status === 'skipped') return false;

    if (imageMotionOnly) {
      const hasMotion = Boolean(
        scene.motionPrompt ||
        scene.motionPromptPath ||
        scene.videoStatus === 'skipped-image-motion-only'
      );
      return !hasMotion;
    } else {
      return !Boolean(scene.videoPath || scene.status === 'video_done');
    }
  });

  if (!next?.id) return [];

  const batchSize = clamp(Number(project.batchSize || 10), 1, 10);
  return sorted
    .map((scene) => Number(scene.id || 0))
    .filter((id) => id >= Number(next.id || 0))
    .slice(0, batchSize);
}

function getNextImageMotionOnlyBatchAfter(doneSceneId = 0) {
  if (!project?.scenes?.length) return [];

  const sorted = [...project.scenes].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

  const next = sorted.find((scene) => {
    const id = Number(scene.id || 0);
    if (!id || id <= Number(doneSceneId || 0)) return false;

    const hasMotion = Boolean(
      scene.motionPrompt ||
      scene.motionPromptPath ||
      scene.videoStatus === 'skipped-image-motion-only'
    );

    return !hasMotion;
  });

  if (!next?.id) return [];

  return sorted
    .map((scene) => Number(scene.id || 0))
    .filter((id) => id >= Number(next.id || 0))
    .slice(0, 10);
}



function hasMotionOnlySceneDoneStrict(scene) {
  return Boolean(
    scene &&
    (
      scene.videoStatus === 'skipped-image-motion-only' ||
      scene.status === 'done' ||
      scene.motionPrompt ||
      scene.motionPromptPath
    )
  );
}

function findBlockingPreviousMotionScene(targetSceneId) {
  if (!isImageMotionOnlyModeEnabled() || !project?.scenes?.length) return null;

  const target = Number(targetSceneId || 0);
  if (!target || target <= 1) return null;

  const sorted = [...project.scenes].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

  for (const scene of sorted) {
    const id = Number(scene.id || 0);
    if (!id || id >= target) continue;

    if (!hasMotionOnlySceneDoneStrict(scene)) {
      return scene;
    }
  }

  return null;
}


async function runFullPipeline() {
  ensureImageMotionOnlyModeControl();

  ensureChatChoiceFields();
  if (!project || !activeBatchIds.length) return;
  forceResumeFirstIncompleteSceneIfNeeded();
  if (!outputFolder) {
    await chooseOutputFolder();
    if (!outputFolder) return;
  }
  if (!window.videoPlannerAPI?.runScenePipeline) {
    setStatus('Bridge pipeline chưa sẵn sàng. Hãy restart app.', 'error');
    return;
  }

  const runnableStatuses = new Set(['pending', 'waiting_review', 'approved', 'image_pending', 'image_generating', 'keyframe_pending', 'keyframe_generating', 'image_done', 'image_generated', 'motion_prompt_pending', 'motion_prompt_generated', 'video_pending', 'video_generating', 'error', 'failed']);
  const scenesToRun = project.scenes.filter((item) => activeBatchIds.includes(item.id) && runnableStatuses.has(item.status));
  if (!scenesToRun.length) {
    const decision = getNextResumeAction({ project, runtime: { ...projectRuntime, activeBatchIds } });
    if (decision.action === 'batch_complete') {
      setStatus('Batch complete: all active scenes already have videos.', 'ok');
      render();
      return;
    }

    if (isImageMotionOnlyModeEnabled() && project && outputFolder) {
      const allScenesComplete = project.scenes.every(scene => 
        scene.status === 'done' || 
        scene.videoStatus === 'skipped-image-motion-only' ||
        Boolean(scene.imagePath && (scene.motionPrompt || scene.motionPromptPath))
      );
      if (allScenesComplete) {
        setStatus('Không có scene cần chạy. Đang tự động quét project và chạy VeoUp...', 'running');
        try {
          console.log('[VeoUp Handoff] Auto-triggering scanProjectAndRunVeoUp from runFullPipeline...');
          const res = await window.videoPlannerAPI.scanProjectAndRunVeoUp({
            projectDir: outputFolder,
            expectedSceneCount: project.scenes.length,
            projectName: project.name || ''
          });
          if (res && res.ok) {
            setStatus(`Tự động chạy VeoUp thành công! ${res.imageCount} ảnh đã nạp.`, 'ok');
            render();
            return;
          } else {
            setStatus(`Resume stopped: no runnable scene in current batch. Tự động chạy VeoUp lỗi: ${res?.error || 'Unknown error'}`, 'error');
            render();
            return;
          }
        } catch (err) {
          setStatus(`Resume stopped: no runnable scene. Tự động chạy VeoUp lỗi: ${err.message || err}`, 'error');
          render();
          return;
        }
      }
    }

    setStatus('Resume stopped: no runnable scene in current batch.', 'error');
    render();
    return;
  }

  autoRunBtn.disabled = true;
  const videoPlatform = getSelectedVideoPlatform();
  const imageMotionOnlyMode = isImageMotionOnlyModeEnabled();
  setStatus(
    imageMotionOnlyMode
      ? 'Running ChatGPT-only workflow: keyframe + motion prompt, skipping Grok/video...'
      : `Running full pipeline: ChatGPT keyframe -> ${videoPlatform.label} video -> save by scene...`,
    'running'
  );

  for (let i = 0; i < scenesToRun.length; i++) {
    const scene = scenesToRun[i];
    const blockingPreviousScene = shouldBlockSceneBecausePreviousVideoMissing(scene);
    if (blockingPreviousScene) {
      paused = true;
      isRunning = false;
      autoContinuing = false;
      setStatus(
        isImageMotionOnlyModeEnabled()
          ? `Không chạy scene ${scene.id}: scene ${blockingPreviousScene.id} chưa có motion prompt hoàn chỉnh.`
          : `Không chạy scene ${scene.id}: scene ${blockingPreviousScene.id} chưa có video hoàn chỉnh.`,
        'error'
      );
      safeAddPipelineLog('renderer', 'error', (isImageMotionOnlyModeEnabled()
        ? `Không chạy scene kế tiếp vì scene trước chưa có motion prompt hoàn chỉnh: scene ${blockingPreviousScene.id}`
        : `Không chạy scene kế tiếp vì scene trước chưa có video hoàn chỉnh: scene ${blockingPreviousScene.id}`));
      persist();
      render();
      return;
    }
    if (requireChatGptChatChoiceBeforeRun(scene)) return;
    try {
      const sceneIndex = project.scenes.indexOf(scene);
      const resumeAction = getNextResumeAction({ project, runtime: { ...projectRuntime, activeBatchIds, currentSceneId: getSceneRef(scene, sceneIndex) } });
      projectRuntime = { ...projectRuntime, currentStage: resumeAction.currentStage, currentSceneId: getSceneRef(scene, sceneIndex), currentBatchIndex: activeBatchIds.findIndex((id) => id === scene.id), lastAction: resumeAction.action, waitingForUserStart: false };
      scene.status = scene.imagePath ? 'video_generating' : 'image_generating';
      render();
      const imagePrompt = scene.imagePrompt || scene.original || buildImagePrompt(scene);
      scene.imagePrompt = imagePrompt;
      const motionPrompt = scene.motionPrompt || '';
      if (motionPrompt) scene.motionPrompt = motionPrompt;
      scene.progressStep = scene.imagePath ? 'motion' : 'image';
      render();
      // strict-motion-only-before-run-scene-guard
      if (isImageMotionOnlyModeEnabled()) {
        const blockingPreviousMotionScene = findBlockingPreviousMotionScene(scene.id);
        if (blockingPreviousMotionScene) {
          activeBatchIds = [Number(blockingPreviousMotionScene.id)];
          safeAddPipelineLog?.(
            'renderer',
            'running',
            `Image + motion only: chặn nhảy scene ${scene.id}; quay lại scene ${blockingPreviousMotionScene.id} vì scene trước chưa commit motion prompt.`,
            { activeBatchIds }
          );
          persist();
          render();
          return runFullPipeline();
        }
      }

      const result = await window.videoPlannerAPI.runScenePipeline({
        targetSceneCount,
        imageMotionOnlyMode: isImageMotionOnlyModeEnabled(),
        skipVideoGeneration: isImageMotionOnlyModeEnabled(),
projectName: project.name,
        outputFolder,
        sceneId: scene.id,
        imagePrompt,
        motionPrompt,
        imagePath: scene.imagePath || '',
        forceRegenerateImage: Boolean(scene.forceRegenerateImage),
        videoProvider: videoPlatform.value,
        videoAccount: getSelectedVideoAccount(videoPlatform.value),
        routingPolicy: grokRoutingPolicySelect?.value || 'manual',
        accountRouterEnabled: isImageMotionOnlyModeEnabled() ? false : Boolean(grokRouterEnabledToggle?.checked),
        videoConfig: getVideoProviderConfig(),
        imageProvider: getImageGenerationSettings(),
        continuityReferences: getContinuityReferenceSettings(),
        chatContextTitle: project.chatContextTitle || '',
        pendingChatRenameTitle: project.pendingChatRenameTitle || '',
        scriptText: storyInput?.value?.trim() || project?.story || '',
        sceneText: scene.original || '',
      });

      // motion-only-mark-result-done-v2
      if (
        isImageMotionOnlyModeEnabled() &&
        (
          result?.imageMotionOnlyMode ||
          result?.skipVideoGeneration ||
          result?.videoStatus === 'skipped-image-motion-only'
        )
      ) {
        scene.imagePath = result.keyframeOutputPath || result.imagePath || scene.imagePath || '';
        scene.imageDataUrl = result.imageDataUrl || scene.imageDataUrl || '';
        scene.motionPrompt = result.motionPrompt || scene.motionPrompt || '[saved: motion_prompt.txt]';
        scene.motionPromptPath = result.motionPromptOutputPath || result.motionPromptPath || scene.motionPromptPath || 'motion_prompt.txt';
        scene.videoStatus = 'skipped-image-motion-only';
        scene.videoPath = '';
        scene.videoUrl = '';
        scene.status = 'done';
        scene.motionPrompt = result.motionPrompt || scene.motionPrompt || '[saved: motion_prompt.txt]';
        scene.motionPromptPath = result.motionPromptOutputPath || result.motionPromptPath || scene.motionPromptPath || 'motion_prompt.txt';
        scene.progressStep = 'motion';
        scene.error = '';
        scene.updatedAt = new Date().toISOString();

        safeAddPipelineLog?.(
          'renderer',
          'ok',
          `Image + motion only: scene ${scene.id} completed without video.`
        );

        persist();
        render();

        const remainingInCurrentBatch = (activeBatchIds || [])
          .map(Number)
          .filter((id) => id > Number(scene.id || 0));

        if (!remainingInCurrentBatch.length) {
          const totalCompletedScenesCount = getCompletedScenesCount();
          if (totalCompletedScenesCount < targetSceneCount) {
            const nextBatch = getNextBatchForSegment(Number(scene.id));

            if (nextBatch.length) {
              activeBatchIds = nextBatch;
              for (const sceneId of nextBatch) {
                const s = project.scenes.find((x) => x.id === sceneId);
                if (s && ['queued', 'error', 'pending'].includes(s.status)) {
                  s.imagePrompt = s.original || buildImagePrompt(s);
                  s.motionPrompt = '';
                  s.status = 'approved';
                  s.reviewType = '';
                  s.provider = providerSelect.value;
                  s.account = accountSelect.value;
                  s.updatedAt = new Date().toISOString();
                }
              }
              await syncProjectSceneFolders();
              safeAddPipelineLog?.(
                'renderer',
                'running',
                `Image + motion only: tự chuyển sang batch kế tiếp bắt đầu từ scene ${nextBatch[0]}. Completed: ${totalCompletedScenesCount}/${targetSceneCount}`,
                { activeBatchIds }
              );
              persist();
              render();
              return runFullPipeline();
            }
          }
        }

        continue;
      }


      if (isImageMotionOnlyModeEnabled() && result?.imageMotionOnlyMode) {
        scene.imagePath = result.keyframeOutputPath || result.imagePath || scene.imagePath;
        scene.imageDataUrl = result.imageDataUrl || scene.imageDataUrl;
        scene.motionPrompt = result.motionPrompt || scene.motionPrompt || '';
        scene.motionPromptPath = result.motionPromptOutputPath || result.motionPromptPath || scene.motionPromptPath || '';
        scene.videoStatus = 'skipped-image-motion-only';
        scene.status = 'done';
        scene.progressStep = 'motion';
        scene.error = '';
        safeAddPipelineLog?.('renderer', 'ok', `Image + motion only: scene ${scene.id} completed without video.`);
        persist();
        render();
        continue;
      // image-motion-only-auto-continue-next-batch
      // Scene này đã xong yêu cầu của mode ảnh+motion. Nếu batch chỉ có scene này,
      // lần loop/auto-route tiếp theo phải tìm scene thiếu motionPrompt, không bị kẹt ở scene cũ.
      }

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

      if (!hasVideoOutput && !isImageMotionOnlyModeEnabled()) {
        paused = true;
        isRunning = false;
        autoContinuing = false;
        scene.status = scene.motionPrompt ? 'video_pending' : 'motion_prompt_pending';
        scene.progressStep = scene.motionPrompt ? 'video' : 'motion';
        scene.error = 'Scene này chưa có motion/video hoàn chỉnh nên đã chặn chạy scene kế tiếp.';
        persist();
        render();
        setStatus(`Scene ${scene.id} chưa có video hoàn chỉnh. Đã dừng để tránh nhảy sang scene kế tiếp.`, 'error');
        return;
      }

      scene.forceRegenerateImage = false;
      scene.imagePrompt = result.imagePromptUsed || scene.imagePrompt || imagePrompt;
      if (result.motionPrompt) {
        scene.motionPrompt = result.motionPrompt;
      }
      scene.pipeline = result;
      const sceneFolderToken = `scene_${String(scene.id).padStart(3, '0')}`;
      const resultImagePath = result.imagePath || '';
      const resultVideoPath = result.videoPath || '';
      scene.imagePath = resultImagePath && String(resultImagePath).includes(sceneFolderToken) ? resultImagePath : scene.imagePath || '';
      scene.imageDataUrl = resultImagePath && String(resultImagePath).includes(sceneFolderToken) ? (result.imageDataUrl || scene.imageDataUrl || '') : scene.imageDataUrl || '';
      scene.videoPath = resultVideoPath && String(resultVideoPath).includes(sceneFolderToken) ? resultVideoPath : scene.videoPath || '';
      scene.videoProvider = result.videoProvider || videoPlatform.value;
      scene.videoStatus = result.videoStatus || '';
      scene.continuityReferencePaths = result.continuityReferencePaths || scene.continuityReferencePaths || [];
      scene.continuityReferenceSourceScene = result.continuityReferenceSourceScene || scene.continuityReferenceSourceScene || null;
      scene.generatedContinuityReferences = result.generatedContinuityReferences || scene.generatedContinuityReferences || null;
      const resultLoginProvider = parseLoginRequiredError(`${result.videoError || ''}\n${result.videoStatus || ''}`, scene);
      if (resultLoginProvider) {
        await recoverLoginAndRetryScene(resultLoginProvider, scene, result.videoError || result.videoStatus || '');
        i--;
        continue;
      }
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
      if (project.pendingChatRenameTitle && (result.phase === 'image' || result.imagePath)) {
        project.chatContextTitle = project.pendingChatRenameTitle;
        project.pendingChatRenameTitle = '';
      }
      scene.progressStep = result.phase === 'video' ? 'motion' : result.phase === 'motion_prompt' ? 'motion_review' : 'image';
      scene.reviewType = result.phase === 'video' ? 'video' : result.phase === 'motion_prompt' ? 'prompt' : 'image';
      scene.status = 'asset_review';
      scene.updatedAt = new Date().toISOString();
      persist();
      render();
      if (shouldSkipReview(scene.reviewType) || isRunning || !paused) {
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
      const loginProvider = parseLoginRequiredError(message, scene);
      if (loginProvider) {
        await recoverLoginAndRetryScene(loginProvider, scene, message);
        i--;
        continue;
      }
      if (/ChatGPT.*sidebar|sidebar|conversation.*ChatGPT|Không.*ChatGPT|Không thấy chat/i.test(message)) {
        scene.error = message;
        scene.updatedAt = new Date().toISOString();
        paused = true;
        persist();
        render();
        openChatResolveDialog(scene, message);
        return;
      }
      scene.pipelineRetryCount = (scene.pipelineRetryCount || 0) + 1;
      scene.error = message;
      scene.updatedAt = new Date().toISOString();
      persist();
      render();
      const chatGptRetryLimit = getChatGptStabilitySettings().retryLimit;
      if (isRetryableChatGptWorkflowError(message) && scene.pipelineRetryCount <= chatGptRetryLimit) {
        scene.status = scene.imagePath ? 'motion_prompt_pending' : 'image_pending';
        scene.progressStep = scene.imagePath ? 'motion' : 'image';
        scene.error = `ChatGPT retryable pipeline error; retry ${scene.pipelineRetryCount}/${chatGptRetryLimit}: ${message}`;
        safeAddPipelineLog?.('renderer', 'running', `ChatGPT retryable pipeline error on scene ${scene.id}; retry ${scene.pipelineRetryCount}/${chatGptRetryLimit}.`, { message });
        persist();
        render();
        i--;
        await sleep(2500);
        continue;
      }
      if (/Object reference chain is too long|Cannot find context with specified id|Execution context was destroyed|Target closed/i.test(message)) {
        scene.status = 'error';
        scene.progressStep = scene.imagePath ? 'motion' : 'image';
        paused = true;
        persist();
        render();
        setStatus(`Scene ${scene.id} lỗi CDP/browser: ${message}. Đã dừng retry để tránh gửi lặp vào sai chat.`, 'error');
        return;
      }
      scene.status = 'error';
      scene.progressStep = scene.imagePath ? 'motion' : 'image';
      paused = true;
      persist();
      render();
      setStatus(`Full pipeline error at scene ${scene.id} after ${getChatGptStabilitySettings().retryLimit} retry attempt(s): ${message}`, 'error');
      return;
    }
  }

  const totalCompletedScenesCount = getCompletedScenesCount();
  if (totalCompletedScenesCount < targetSceneCount) {
    const lastSceneId = activeBatchIds.length ? Math.max(...activeBatchIds) : 0;
    const nextBatch = getNextBatchForSegment(lastSceneId);
    if (nextBatch.length > 0) {
      activeBatchIds = nextBatch;
      for (const sceneId of nextBatch) {
        const s = project.scenes.find((x) => x.id === sceneId);
        if (s && ['queued', 'error', 'pending'].includes(s.status)) {
          s.imagePrompt = s.original || buildImagePrompt(s);
          s.motionPrompt = '';
          s.status = 'approved';
          s.reviewType = '';
          s.provider = providerSelect.value;
          s.account = accountSelect.value;
          s.updatedAt = new Date().toISOString();
        }
      }
      await syncProjectSceneFolders();
      persist();
      render();

      safeAddPipelineLog?.(
        'renderer',
        'running',
        `Auto-advancing batch segment to scenes: ${nextBatch.join(', ')}. Completed count: ${totalCompletedScenesCount}/${targetSceneCount}.`
      );
      setStatus(`Tự động chuyển sang batch kế tiếp: Cảnh ${nextBatch[0]}-${nextBatch.at(-1)}`, 'running');

      setTimeout(async () => {
        await runFullPipeline();
      }, 1000);
      return;
    }
  }

  if (shouldSkipReview()) {
    const unfinished = project.scenes.some((scene) => activeBatchIds.includes(scene.id) && !isSceneCompleteForVeoUp(scene));
    if (unfinished) return queueAutoContinue();
    await mergeAndShowFinalPreview();
  }
  setStatus('Không còn scene cần chạy hoặc đã đạt mục tiêu.', 'ok');

  render();

  await maybeRunVeoUpAutomationAfterPipeline('runFullPipeline-complete');
}


function isSceneCompleteForVeoUp(scene) {
  if (!scene || scene.status === 'skipped') return true;
  if (scene.videoStatus === 'skipped-image-motion-only') return Boolean(scene.imagePath && (scene.motionPrompt || scene.motionPromptPath));
  if (scene.status === 'done') return Boolean(scene.imagePath && (scene.motionPrompt || scene.motionPromptPath));
  return Boolean(scene.videoPath || scene.videoUrl || scene.finalVideoPath || scene.outputVideoPath || scene.status === 'video_done');
}

function isProjectCompleteForVeoUp() {
  return Boolean(project?.scenes?.length) && project.scenes.every(isSceneCompleteForVeoUp);
}

async function maybeRunVeoUpAutomationAfterPipeline(reason = 'pipeline-complete') {
  if (veoupAutomationInFlight) return;
  if (projectRuntime?.veoupAutomationResult?.ok) return;
  if (!window.videoPlannerAPI?.runVeoUpAutomation || !isProjectCompleteForVeoUp()) return;

  veoupAutomationInFlight = true;
  projectRuntime = {
    ...projectRuntime,
    veoupAutomationTriggeredAt: new Date().toISOString(),
    veoupAutomationReason: reason,
  };
  persist();

  safeAddPipelineLog?.('renderer', 'running', 'VeoUp automation: starting after completed Vidora pipeline.', { reason, outputFolder });
  setStatus('Pipeline complete. Starting VeoUp automation...', 'running');

  const result = await window.videoPlannerAPI.runVeoUpAutomation({
    outputFolder,
    projectName: project?.name || projectNameInput?.value || '',
    previewStartButtonOnly: Boolean(veoupPreviewStartOnlyToggle?.checked),
    scenes: (project?.scenes || []).map((scene) => ({
      id: scene.id,
      imagePath: scene.imagePath || scene.keyframeOutputPath || '',
      keyframeOutputPath: scene.keyframeOutputPath || '',
      motionPrompt: scene.motionPrompt || '',
      motionPromptPath: scene.motionPromptPath || '',
      motionPromptOutputPath: scene.motionPromptOutputPath || '',
      status: scene.status || '',
      videoStatus: scene.videoStatus || '',
    })),
  }).catch((error) => ({ ok: false, error: error.message || String(error) }));

  projectRuntime = { ...projectRuntime, veoupAutomationResult: result };
  persist();
  safeAddPipelineLog?.(
    'renderer',
    result?.ok ? 'ok' : 'error',
    result?.ok
      ? `VeoUp automation complete: ${result.imageCount || 0} images, ${result.promptLineCount || 0} prompts.`
      : `VeoUp automation failed: ${result?.error || 'validation mismatch'}`,
    result
  );
  setStatus(
    result?.ok
      ? 'Pipeline complete. VeoUp automation loaded images and prompts.'
      : `Pipeline complete, but VeoUp automation failed: ${result?.error || 'validation mismatch'}`,
    result?.ok ? 'ok' : 'error'
  );
  veoupAutomationInFlight = false;
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
    grok: {
      resolution: '720p',
      duration: String(normalizeSceneDuration(project?.durationSec || durationInput?.value || 10)),
      ...getGrokRecoverySettings(),
    },
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
  // hard-skip-waitForProviderReady-video-provider-motion-only
  if (
    typeof isImageMotionOnlyModeEnabled === 'function' &&
    isImageMotionOnlyModeEnabled() &&
    providerValue !== 'chatgpt'
  ) {
    safeAddPipelineLog?.(
      'renderer',
      'running',
      `Image + motion only: skip waitForProviderReady(${providerValue}), không mở/check ${label}.`
    );

    setStatus(
      `Bỏ qua ${label} vì đang bật chế độ chỉ tạo ảnh + motion prompt.`,
      'ok'
    );

    return {
      provider: providerValue,
      loggedIn: true,
      skipped: true,
      imageMotionOnlyMode: true,
      reason: 'image-motion-only-skip-video-provider',
    };
  }
  await openWebLogin(providerValue);
  const startedAt = Date.now();
  let attempt = 0;
  if (loginWaitTitle) loginWaitTitle.textContent = `Đang chờ ${label} sẵn sàng...`;
  if (loginWaitDesc) loginWaitDesc.textContent = `Hãy đăng nhập hoặc vượt qua verify/Cloudflare trong cửa sổ ${label}. Tool sẽ tự quét liên tục và chạy tiếp khi xong.`;
  if (loginWaitDialog && !loginWaitDialog.open) loginWaitDialog.showModal();
  while (!paused) {
    attempt += 1;
    const state = await window.videoPlannerAPI.checkWebLogin(providerValue, {
      autoOpenSaved: providerValue === 'grok' && Boolean(grokRouterEnabledToggle?.checked) && attempt === 1,
      bringToFront: providerValue === 'grok' && Boolean(grokRouterEnabledToggle?.checked) && attempt === 1,
    });
    if (state.loggedIn) {
      if (loginWaitDesc) loginWaitDesc.textContent = `${label} đã sẵn sàng. Đang tiếp tục pipeline...`;
      if (loginWaitDialog?.open) loginWaitDialog.close();
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

function isRetryableChatGptWorkflowError(message = '') {
  return /CHATGPT_ERROR:|composer-busy|prompt-pasted-but-send-not-ready|send-button-share-image|send-button-wrong-target|image-upload-timeout|image-preview-not-detected|chatgpt-response-timeout|chatgpt-output-choice-required|chatgpt-too-long-conversation|chatgpt-memory-cache-heavy|chatgpt-tab-crashed|network-stall|unsafe-sidebar-modal|unknown-ui-state|pre-extract-wait|chatgpt-image-tool-error|text-only-answer|no-usable-image|real_stall|still loading|Timed out waiting for a complete ChatGPT generated image asset|Timed out waiting|missing-motion-prompt-signals|retryable-bad-motion-text|bad-response-idle|no-assistant-after-send/i.test(String(message || ''));
}
function parseLoginRequiredError(message = '', scene = null) {
  const text = String(message || '');
  const explicit = text.match(/LOGIN_REQUIRED:(chatgpt|grok|pixverse)\b/i)?.[1]?.toLowerCase();
  if (explicit) return explicit;
  if (/ChatGPT.*(chưa|login|đăng nhập|sign in|session|verify)|chưa login.*ChatGPT/i.test(text)) return 'chatgpt';
  if (/Grok.*(chưa|login|đăng nhập|sign in|session|verify)|grok login is required/i.test(text)) return 'grok';
  if (/PixVerse.*(chưa|login|đăng nhập|sign in|session|verify)/i.test(text)) return 'pixverse';
  if (/chưa đăng nhập|chưa login|session.*hết hạn|sign in|sign up|đăng nhập lại/i.test(text)) {
    return scene?.imagePath ? getSelectedVideoPlatform().value : 'chatgpt';
  }
  return '';
}

async function recoverLoginAndRetryScene(providerValue, scene, message = '') {
  const labels = { chatgpt: 'ChatGPT', grok: 'Grok', pixverse: 'PixVerse' };
  const label = labels[providerValue] || providerValue;
  scene.error = `${label} bị đăng xuất hoặc cần verify lại. Đang chờ đăng nhập để chạy tiếp.`;
  scene.updatedAt = new Date().toISOString();
  persist();
  render();
  setStatus(`Scene ${scene.id}: ${label} bị đăng xuất. Đăng nhập/verify xong tool sẽ chạy tiếp scene này.`, 'running');
  await window.videoPlannerAPI?.appendAppLog?.({ source: 'renderer', kind: 'running', text: `Login recovery required for ${label} at scene ${scene.id}: ${message}` });
  await waitForProviderReady(providerValue, label);
  scene.error = '';
  scene.pipelineRetryCount = 0;
  scene.status = scene.imagePath ? 'video_generating' : 'image_generating';
  scene.updatedAt = new Date().toISOString();
  persist();
  render();
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
  if (customTargetScenesInput) {
    targetSceneCount = clamp(Number(customTargetScenesInput.value) || 50, 1, 100);
  }
  setStatus('Đã bấm Start pipeline. Đang khởi động workflow...', 'running');
  forceChatGptImageMotionOnlyWorkflow();
  await autoRunRoute();
}
window.startPipelineFromClick = startPipelineFromClick;

async function autoRunRoute() {
  if (!project || !project.scenes?.length) {
    createProject();
    if (!project || !project.scenes?.length) return;
  }
  forceChatGptImageMotionOnlyWorkflow();
  if (isRunning) return;
  setRunning(true);
  paused = false;
  projectRuntime = { ...projectRuntime, waitingForUserStart: false, resumeMode: 'manual-start' };

  try {
    if (!outputFolder) {
      setStatus('Bước 1/5: chọn folder lưu output...', 'running');
      await chooseOutputFolder();
      if (!outputFolder) throw new Error('Chưa chọn folder lưu output.');
    }

    setStatus('Bước 2/5: mở và kiểm tra ChatGPT...', 'running');
    const chatgptState = await waitForProviderReady('chatgpt', 'ChatGPT');

// VIDORA_AUTO_CONFIRM_EXISTING_CHAT_FROM_LOGIN_SAMPLE
    {
      const norm = (v) => String(v || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/\s+/g, ' ');

      const projectTitle =
        String(project?.name || project?.projectName || projectNameInput?.value || projectTitleInput?.value || '').trim();

      const visibleChatText = [
        chatgptState?.title,
        chatgptState?.url,
        chatgptState?.sampleText,
      ].map(v => String(v || '')).join('\n');

      if (
        project &&
        projectTitle &&
        !project.chatChoiceConfirmed &&
        norm(visibleChatText).includes(norm(projectTitle))
      ) {
        project.chatChoiceConfirmed = true;
        project.chatContextTitle = projectTitle;
        project.pendingChatRenameTitle = '';
        project.forceFreshChat = false;

        safeAddPipelineLog?.(
          'renderer',
          'ok',
          `ChatGPT existing chat auto-confirmed from sidebar/login sample: "${projectTitle}".`,
          {
            projectTitle,
            chatgptTitle: chatgptState?.title || '',
            chatgptUrl: chatgptState?.url || '',
          }
        );

        persist?.();
        render?.();
      }
    }


    const videoPlatform = getSelectedVideoPlatform();


    let videoState = null;



    // skip-video-provider-ready-image-motion-only


    if (isImageMotionOnlyModeEnabled()) {


      safeAddPipelineLog?.(


        'renderer',


        'running',


        `Image + motion only: bỏ qua bước mở/kiểm tra ${videoPlatform.label}, không cần provider video.`


      );


      setStatus('Bỏ qua provider video vì đang bật chế độ chỉ tạo ảnh + motion prompt.', 'ok');


    } else {


      setStatus(`Bước 3/5: mở và kiểm tra ${videoPlatform.label}...`, 'running');


      videoState = await waitForProviderReady(videoPlatform.value, videoPlatform.label);


    }
    if (!isImageMotionOnlyModeEnabled() && videoPlatform.value === 'pixverse') {
      pixverseCapability = videoState?.capability || null;
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
          scene.status = 'approved';
          scene.reviewType = '';
        }
      });
    }

    if (!activeBatchIds.length) {
      throw new Error('Không có scene trong batch hiện tại để chạy.');
    }

    // Đã chuyển logic login lên trên

    webSessionStatus.textContent = `Đã login ChatGPT + ${videoPlatform.label}. Output: ${outputFolder}`;
    project.scenes.forEach((scene) => {
      if (activeBatchIds.includes(scene.id) && scene.status === 'waiting_review') {
        scene.status = 'approved';
        scene.reviewType = '';
      }
    });
    persist();
    render();
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
  
  ensureImageMotionOnlyModeControl();
const scenes = project?.scenes || [];
  metricScenes.textContent = scenes.length;
  metricApproved.textContent = scenes.filter((scene) => scene.status === 'approved').length;
  metricBatch.textContent = activeBatchIds.length ? `${activeBatchIds[0]}-${activeBatchIds.at(-1)}` : '—';

  runBatchBtn.disabled = !project || paused || activeBatchIds.some((id) => project.scenes.find((scene) => scene.id === id)?.status === 'waiting_review');
  pauseBtn.disabled = !project || paused;
  resumeBtn.disabled = !project || !paused;
  exportBtn.disabled = !project;
  chooseOutputFolderBtn.disabled = !project;
  if (saveProjectBtn) saveProjectBtn.disabled = !project;
  autoRunBtn.disabled = false;
  openReviewBtn.disabled = !getCurrentReviewScene();

  renderFinalPreview();
  renderAssetReviewModal();
  renderProjectSessionStatus();
  if (typeof updateScanButtonVisibility === 'function') {
    updateScanButtonVisibility();
  }
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
  markProjectDirty();
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
  markProjectDirty();
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

function summarizeLogDetails(details) {
  if (!details) return '';
  try {
    if (typeof details === 'string') return details.slice(0, 320);
    const compact = JSON.stringify(details, (_key, value) => {
      if (typeof value === 'string') return value.length > 180 ? `${value.slice(0, 180)}...` : value;
      return value;
    });
    return compact.length > 420 ? `${compact.slice(0, 420)}...` : compact;
  } catch (_error) {
    return '';
  }
}

function appendPipelineLog(text, kind = 'idle', options = {}) {
  if (!text) return;
  const source = options.source || 'renderer';
  const duplicateKey = `${source}:${kind}:${text}`;
  if (!options.allowDuplicate && duplicateKey === lastStatusText) return;
  lastStatusText = duplicateKey;
  const time = options.ts
    ? new Date(options.ts).toLocaleTimeString('vi-VN', { hour12: false })
    : new Date().toLocaleTimeString('vi-VN', { hour12: false });
  pipelineLogs.unshift({ time, text, kind, source, details: summarizeLogDetails(options.details) });
  pipelineLogs = pipelineLogs.slice(0, 80);
  if (!options.skipPersist) window.videoPlannerAPI?.appendAppLog?.({ source: 'renderer', kind, text }).catch(() => null);
  renderPipelineLog();
}

function showPipelineNotice(payload = {}) {
  const message = payload.message || 'Pipeline cần chú ý.';
  setStatus(message, payload.type === 'grok-limit' ? 'error' : 'running');
  if (payload.type === 'chatgpt-image-retry') return;
  window.alert(message);
}

window.videoPlannerAPI?.onPipelineNotice?.((payload) => {
  showPipelineNotice(payload);
});

window.videoPlannerAPI?.onPipelineLogEntry?.((entry = {}) => {
  appendPipelineLog(entry.text || '', entry.kind || 'info', {
    source: entry.source || 'main',
    ts: entry.ts,
    details: entry.details,
    skipPersist: true,
    allowDuplicate: true,
  });
});

function formatPipelineLogsForCopy() {
  const lines = [];
  lines.push('=== Vidora pipeline log ===');
  lines.push(`Time: ${new Date().toLocaleString('vi-VN', { hour12: false })}`);
  if (project?.name) lines.push(`Project: ${project.name}`);
  lines.push('');

  if (!pipelineLogs.length) {
    lines.push('(No pipeline logs)');
    return lines.join('\n');
  }

  [...pipelineLogs].reverse().forEach((entry, index) => {
    const source = entry.source || 'app';
    const kind = entry.kind || 'info';
    lines.push(`[${String(index + 1).padStart(3, '0')}] ${entry.time || ''} · ${source} · ${kind}`);
    lines.push(entry.text || '');
    if (entry.details) {
      lines.push('details:');
      lines.push(String(entry.details));
    }
    lines.push('');
  });

  return lines.join('\n');
}

async function copyPipelineLog() {
  const text = formatPipelineLogsForCopy();

  try {
    await navigator.clipboard.writeText(text);
    if (copyLogBtn) {
      const old = copyLogBtn.textContent;
      copyLogBtn.textContent = 'Copied ✓';
      setTimeout(() => { copyLogBtn.textContent = old; }, 1200);
    }
    setStatus('Đã copy pipeline log vào clipboard.', 'ok');
  } catch (error) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (_err) {
      ok = false;
    }

    textarea.remove();

    if (ok) {
      if (copyLogBtn) {
        const old = copyLogBtn.textContent;
        copyLogBtn.textContent = 'Copied ✓';
        setTimeout(() => { copyLogBtn.textContent = old; }, 1200);
      }
      setStatus('Đã copy pipeline log vào clipboard.', 'ok');
      return;
    }

    setStatus(`Không copy được log: ${error?.message || error}`, 'error');
  }
}

function renderPipelineLog() {
  if (!pipelineLogList) return;
  if (pipelineLogCard) pipelineLogCard.hidden = !pipelineLogVisible;
  pipelineLogList.innerHTML = pipelineLogs.length
    ? pipelineLogs.map((entry) => `<li class="log-${entry.kind}"><span>${escapeHtml(entry.time)} · ${escapeHtml(entry.source || 'app')}</span><p>${escapeHtml(entry.text)}</p>${entry.details ? `<small>${escapeHtml(entry.details)}</small>` : ''}</li>`).join('')
    : '<li class="log-idle"><span>—</span><p>Chưa có log. Bấm Start pipeline để bắt đầu.</p></li>';
}

function setPipelineLogVisible(visible) {
  pipelineLogVisible = Boolean(visible);
  renderPipelineLog();
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
    markProjectDirty();
    persist();
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
  const scene = reviewSceneId ? project?.scenes?.find((item) => item.id === reviewSceneId) : getCurrentReviewScene();
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
  const showMotionPrompt = reviewType !== 'image';
  if (reviewMotionBlock) reviewMotionBlock.hidden = !showMotionPrompt;
  if (reviewEditMotionBtn) reviewEditMotionBtn.hidden = !showMotionPrompt;
  reviewMotionPrompt.textContent = showMotionPrompt ? (scene.motionPrompt || '—') : '';
  reviewStatusBadge.innerHTML = `<span class="status-badge ${scene.status}">${escapeHtml(statusLabel(scene))}</span>`;
  if (reviewMediaPanel) reviewMediaPanel.hidden = !showMedia;
  if (reviewMediaStage) {
    reviewMediaStage.style.setProperty('--review-zoom', `${reviewZoom / 100}`);
    reviewMediaStage.classList.toggle('is-zoomed', reviewZoom > 100);
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

function setReviewZoom(value, { rerender = false } = {}) {
  reviewZoom = clamp(value, 60, 320);
  if (zoomRange) zoomRange.value = String(reviewZoom);
  if (reviewMediaStage) {
    reviewMediaStage.style.setProperty('--review-zoom', `${reviewZoom / 100}`);
    reviewMediaStage.classList.toggle('is-zoomed', reviewZoom > 100);
  }
  if (rerender) renderAssetReviewModal();
}

function handleReviewWheelZoom(event) {
  if (!isAssetReviewOpen() || !event.ctrlKey) return;
  event.preventDefault();
  const before = reviewMediaStage ? {
    left: reviewMediaStage.scrollLeft,
    top: reviewMediaStage.scrollTop,
    width: reviewMediaStage.scrollWidth,
    height: reviewMediaStage.scrollHeight,
  } : null;
  setReviewZoom(reviewZoom + (event.deltaY < 0 ? 12 : -12));
  if (before && reviewMediaStage) {
    requestAnimationFrame(() => {
      const widthRatio = before.width ? reviewMediaStage.scrollWidth / before.width : 1;
      const heightRatio = before.height ? reviewMediaStage.scrollHeight / before.height : 1;
      reviewMediaStage.scrollLeft = before.left * widthRatio;
      reviewMediaStage.scrollTop = before.top * heightRatio;
    });
  }
}

function isAssetReviewOpen() {
  return Boolean(assetReviewDialog?.open && assetReviewDialog?.classList.contains('media-review-dialog'));
}

function startReviewPan(event) {
  if (!isAssetReviewOpen() || !isReviewSpaceHeld || !reviewMediaStage) return;
  event.preventDefault();
  reviewPanState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: reviewMediaStage.scrollLeft,
    scrollTop: reviewMediaStage.scrollTop,
  };
  reviewMediaStage.classList.add('is-panning');
  reviewMediaStage.setPointerCapture?.(event.pointerId);
}

function moveReviewPan(event) {
  if (!reviewPanState || !reviewMediaStage) return;
  event.preventDefault();
  reviewMediaStage.scrollLeft = reviewPanState.scrollLeft - (event.clientX - reviewPanState.startX);
  reviewMediaStage.scrollTop = reviewPanState.scrollTop - (event.clientY - reviewPanState.startY);
}

function stopReviewPan(event) {
  if (!reviewPanState || !reviewMediaStage) return;
  reviewMediaStage.releasePointerCapture?.(event.pointerId || reviewPanState.pointerId);
  reviewPanState = null;
  reviewMediaStage.classList.remove('is-panning');
}

function handleReviewShortcut(event) {
  if (!isAssetReviewOpen()) return;
  const targetTag = event.target?.tagName?.toLowerCase();
  if (['input', 'textarea', 'select'].includes(targetTag)) return;
  if ((event.ctrlKey || event.metaKey) && ['+', '=', '-', '_', '0'].includes(event.key)) {
    event.preventDefault();
    if (event.key === '0') setReviewZoom(100);
    else setReviewZoom(reviewZoom + (event.key === '-' || event.key === '_' ? -10 : 10));
    return;
  }
  if (event.code === 'Space') {
    event.preventDefault();
    isReviewSpaceHeld = true;
    reviewMediaStage?.classList.add('is-panning');
  }
}

function releaseReviewShortcut(event) {
  if (event.code !== 'Space') return;
  isReviewSpaceHeld = false;
  stopReviewPan(event);
}

function approveCurrentReviewScene() {
  const scene = reviewSceneId ? project?.scenes?.find((item) => item.id === reviewSceneId) : getCurrentReviewScene();
  if (!scene) return;
  const reviewType = scene.status === 'waiting_review' ? 'prompt' : scene.reviewType || (scene.videoPath ? 'video' : scene.imagePath ? 'image' : 'prompt');
  const isMotionPromptReview = reviewType === 'prompt' && scene.imagePath;
  scene.status = reviewType === 'video' ? 'video_done' : reviewType === 'image' || isMotionPromptReview ? 'image_done' : 'approved';
  scene.progressStep = reviewType === 'video' ? 'merge' : reviewType === 'image' || isMotionPromptReview ? 'motion' : 'image';
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
  const result = await window.videoPlannerAPI.mergeVideos(outputFolder, { imageMotionOnly: isImageMotionOnlyModeEnabled() });
  if (result && result.skipped) {
    setStatus('Image + motion only mode active. Skipping final video merge step successfully.', 'ok');
    return result;
  }
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
  if (!project) {
    finalPreviewCard.hidden = true;
    finalPreviewVideo.removeAttribute('src');
    if (finalPreviewMeta) finalPreviewMeta.textContent = '';
    finalSceneTimeline.innerHTML = '';
    return;
  }
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
    routingPolicy: grokRoutingPolicySelect?.value || 'round_robin',
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


function getSelectedText(control) {
  return control?.selectedOptions?.[0]?.textContent || control?.value || '';
}

function getSceneRef(scene, index) {
  return String(scene?.sceneId || scene?.id || `scene-${String(index + 1).padStart(3, '0')}`);
}

const KEYFRAME_RESUME_STATUSES = new Set(['image_pending', 'image_generating', 'keyframe_pending', 'keyframe_generating']);
const IMAGE_READY_RESUME_STATUSES = new Set(['image_done', 'image_generated', 'motion_prompt_pending', 'motion_prompt_generated', 'video_pending', 'video_generating']);
const VIDEO_DONE_RESUME_STATUSES = new Set(['video_done', 'video_generated', 'video_ready']);

function isVideoCompleteForResume(scene = {}) {
  return Boolean(scene.videoPath);
}

function hasKeyframeForResume(scene = {}) {
  return Boolean(scene.imagePath || scene.imageDataUrl) || isVideoCompleteForResume(scene);
}

function findSceneByRuntimeRef(ref, scenes = project?.scenes || []) {
  if (ref == null || ref === '') return null;
  const key = String(ref);
  return scenes.find((scene, index) => String(scene.id) === key || getSceneRef(scene, index) === key) || null;
}

function normalizeActiveBatchIdsForRuntime(ids = [], scenes = project?.scenes || []) {
  if (!Array.isArray(ids)) return [];
  return ids
    .map((id) => findSceneByRuntimeRef(id, scenes)?.id ?? id)
    .filter((id) => id != null && id !== '');
}

function getOrderedResumeScenes(state = {}) {
  const scenes = state.project?.scenes || [];
  const activeIds = normalizeActiveBatchIdsForRuntime(state.runtime?.activeBatchIds || state.activeBatchIds || [], scenes);
  const activeScenes = activeIds.length
    ? activeIds.map((id) => scenes.find((scene) => String(scene.id) === String(id))).filter(Boolean)
    : scenes;
  const currentRef = state.runtime?.currentSceneId || '';
  const currentIndex = activeScenes.findIndex((scene, index) => String(scene.id) === String(currentRef) || getSceneRef(scene, index) === String(currentRef));
  return currentIndex > 0 ? activeScenes.slice(currentIndex).concat(activeScenes.slice(0, currentIndex)) : activeScenes;
}

function getNextResumeAction(state = {}) {
  const scenes = getOrderedResumeScenes(state);
  for (const scene of scenes) {
    if (isVideoCompleteForResume(scene)) continue;
    const sceneIndex = (state.project?.scenes || []).indexOf(scene);
    const sceneId = getSceneRef(scene, sceneIndex >= 0 ? sceneIndex : 0);
    if (!hasKeyframeForResume(scene) || KEYFRAME_RESUME_STATUSES.has(scene.status)) {
      return { action: 'generate_keyframe', currentStage: 'generating_keyframe', sceneId, internalSceneId: scene.id, status: scene.status };
    }
    if (!scene.motionPrompt) {
      return { action: 'generate_motion_prompt', currentStage: 'generating_motion_prompt', sceneId, internalSceneId: scene.id, status: scene.status };
    }
    return { action: 'generate_video', currentStage: 'generating_video', sceneId, internalSceneId: scene.id, status: scene.status };
  }
  return { action: 'batch_complete', currentStage: 'batch_complete', sceneId: null, internalSceneId: null, status: 'complete' };
}

function getCurrentResumeScene() {
  const activeScenes = (project?.scenes || []).filter((scene) => activeBatchIds.includes(scene.id));
  const inProgress = activeScenes.find((scene) => ['pending', 'running', 'image_pending', 'image_generating', 'keyframe_pending', 'keyframe_generating', 'motion_prompt_pending', 'video_pending', 'video_generating', 'asset_review', 'waiting_review', 'error', 'failed'].includes(scene.status));
  if (inProgress) return inProgress;
  const restored = findSceneByRuntimeRef(projectRuntime.currentSceneId);
  if (restored) return restored;
  const decision = getNextResumeAction({ project, runtime: { ...projectRuntime, activeBatchIds } });
  return decision.internalSceneId != null ? project?.scenes?.find((scene) => scene.id === decision.internalSceneId) || null : null;
}

function getRuntimeSnapshot() {
  const currentScene = getCurrentResumeScene();
  const currentSceneId = currentScene ? getSceneRef(currentScene, project.scenes.indexOf(currentScene)) : null;
  const normalizedBatchIds = normalizeActiveBatchIdsForRuntime(activeBatchIds, project?.scenes || []);
  const currentBatchIndex = currentScene ? normalizedBatchIds.findIndex((id) => String(id) === String(currentScene.id)) : -1;
  const decision = getNextResumeAction({
    project,
    runtime: { ...projectRuntime, activeBatchIds: normalizedBatchIds, currentSceneId },
  });
  return {
    currentStage: decision.currentStage || projectRuntime.currentStage || 'idle',
    currentBatchIndex: currentBatchIndex >= 0 ? currentBatchIndex : (normalizedBatchIds.length ? 0 : null),
    currentSceneId,
    activeBatchIds: normalizedBatchIds,
    paused,
    lastCheckpointRef: projectRuntime.lastCheckpointRef || getRouterMetadata().status?.lastSafeCheckpointRef || null,
    lastAction: decision.action || projectRuntime.lastAction || null,
    resumeMode: projectRuntime.resumeMode || 'manual-start',
    lastErrorClassification: projectRuntime.lastErrorClassification || null,
    waitingForUserStart: true,
    imageGeneration: {
      ...getImageGenerationSettings(),
      apiKey: '',
    },
    continuityReferences: getContinuityReferenceSettings(),
  };
}

function getSceneFileRecord(scene, index) {
  const sceneId = getSceneRef(scene, index);
  return {
    ...scene,
    sceneId,
    sceneIndex: index,
    rawSceneText: scene.rawSceneText || scene.original || '',
    imagePrompt: scene.imagePrompt || '',
    motionPrompt: scene.motionPrompt || '',
    imagePath: scene.imagePath || '',
    videoPath: scene.videoPath || '',
    continuityReferencePaths: Array.isArray(scene.continuityReferencePaths) ? scene.continuityReferencePaths : [],
    continuityReferenceSourceScene: scene.continuityReferenceSourceScene || null,
    generatedContinuityReferences: scene.generatedContinuityReferences || null,
    errorClassification: scene.errorClassification || (scene.error ? 'scene_error' : null),
    updatedAt: scene.updatedAt || new Date().toISOString(),
  };
}

function getPreviewTimeline() {
  if (Array.isArray(project?.finalTimeline) && project.finalTimeline.length) return project.finalTimeline;
  return (project?.scenes || []).filter((scene) => scene.videoPath).map((scene, index) => ({
    sceneId: getSceneRef(scene, index),
    sceneNumber: scene.id,
    videoPath: scene.videoPath,
    keyframePath: scene.imagePath || '',
    durationSeconds: normalizeSceneDuration(project?.durationSec || durationInput?.value || 10),
    name: `scene_${String(scene.id || index + 1).padStart(3, '0')}`,
  }));
}

function getProjectAssets(previewTimeline = getPreviewTimeline()) {
  const scenes = project?.scenes || [];
  return {
    images: scenes.filter((scene) => scene.imagePath).map((scene, index) => ({ sceneId: getSceneRef(scene, index), path: scene.imagePath })),
    videos: scenes.filter((scene) => scene.videoPath).map((scene, index) => ({ sceneId: getSceneRef(scene, index), path: scene.videoPath })),
    finalOutputs: project?.finalVideoPath ? [{ kind: 'preview', path: project.finalVideoPath }] : previewTimeline.filter((item) => item.outputPath).map((item) => ({ kind: 'preview', path: item.outputPath })),
  };
}

function getCurrentSceneRef() {
  const currentScene = reviewSceneId ? project?.scenes?.find((scene) => scene.id === reviewSceneId) : getCurrentResumeScene();
  if (!currentScene) return null;
  const index = project?.scenes?.indexOf(currentScene);
  return index >= 0 ? getSceneRef(currentScene, index) : String(currentScene.id);
}

function getRouterMetadata() {
  return {
    accountRouterEnabled: Boolean(grokRouterEnabledToggle?.checked),
    selectedGrokAccountId: grokAccountSelect?.value || null,
    routingPolicy: grokRoutingPolicySelect?.value || 'round_robin',
    selectedLabels: {
      provider: 'Grok',
      model: videoPlatformSelect?.value === 'pixverse' ? 'PixVerse' : 'Grok',
      account: getSelectedText(grokAccountSelect),
    },
    status: {
      selectedAccountState: grokAccountSelect?.selectedOptions?.[0]?.disabled ? 'unavailable' : 'available',
      routerState: grokRouterState?.textContent || '',
    },
  };
}

function getProjectSessionPayload() {
  const previewTimeline = getPreviewTimeline();
  const scenes = (project?.scenes || []).map(getSceneFileRecord);
  const runtime = getRuntimeSnapshot();
  return {
    schemaVersion: 1,
    appVersion: 'electron-phase2',
    savedAt: new Date().toISOString(),
    project: {
      ...project,
      description: project?.description || '',
      updatedAt: new Date().toISOString(),
      scenes,
      continuityReferences: getContinuityReferenceSettings(),
      finalTimeline: previewTimeline,
    },
    inputs: {
      storyPrompt: storyInput?.value || project?.story || '',
      scriptPrompt: scriptInput?.value || scenes.map((scene) => scene.rawSceneText).join('\n\n'),
      chatContextTitle: project?.name || projectNameInput?.value?.trim() || '',
      promptTemplates: {
        image: { id: 'renderer-image-rules', version: '1' },
        motion: { id: 'renderer-motion-rules', version: '1' },
        story: { id: 'renderer-story-rules', version: '1' },
      },
      batchPromptRefs: [],
    },
    config: {
      scriptProvider: providerSelect?.value || '',
      imageProvider: providerSelect?.value || '',
      videoProvider: videoPlatformSelect?.value || 'grok',
      imageGeneration: {
        ...getImageGenerationSettings(),
        apiKey: '',
      },
      continuityReferences: getContinuityReferenceSettings(),
      selectedModels: {
        script: modelInput?.value || '',
        image: providerSelect?.value || '',
        video: videoPlatformSelect?.value || 'grok',
      },
      selectedLabels: {
        provider: getSelectedText(providerSelect),
        account: getSelectedText(accountSelect),
        model: modelInput?.value || '',
      },
      batchSize: Number(batchSizeInput?.value) || project?.batchSize || 10,
      sceneDurationSeconds: normalizeSceneDuration(durationInput?.value || project?.durationSec || 10),
      outputLanguage: 'Vietnamese',
      stylePreset: 'current-renderer-settings',
    },
    router: getRouterMetadata(),
    runtime: {
      ...runtime,
      outputFolder,
      videoPlatform: videoPlatformSelect?.value || 'grok',
      reviewSettings: getReviewSettings(),
      skipReview: shouldSkipReview(),
      pixverse: {
        resolution: pixverseResolutionSelect?.value || '',
        ratio: pixverseRatioSelect?.value || '',
        duration: pixverseDurationSelect?.value || '',
        model: pixverseModelSelect?.value || '',
        preview: Boolean(pixversePreviewToggle?.checked),
        audio: Boolean(pixverseAudioToggle?.checked),
      },
      continuityReferences: getContinuityReferenceSettings(),
      grokRecovery: getGrokRecoverySettings(),
      chatGptStability: getChatGptStabilitySettings(),
      grokRouter: getGrokRouterSettings(),
      activePreviewTimeline: previewTimeline,
      autoRun: false,
      waitingForUserStart: true,
      active: false,
    },
    assets: getProjectAssets(previewTimeline),
    previewTimeline,
    extensions: {},
  };
}

function normalizeRendererScene(scene = {}, index = 0) {
  const numericId = Number(scene.id);
  const sceneIdMatch = String(scene.sceneId || '').match(/\d+$/);
  const id = scene.id != null && scene.id !== '' && Number.isFinite(numericId) ? numericId : sceneIdMatch ? Number(sceneIdMatch[0]) : index + 1;
  return {
    ...scene,
    id,
    original: scene.original || scene.rawSceneText || '',
    previous: scene.previous || '',
    next: scene.next || '',
    status: scene.status || 'queued',
    imagePrompt: scene.imagePrompt || '',
    motionPrompt: scene.motionPrompt || '',
    provider: scene.provider || '',
    account: scene.account || '',
    imagePath: scene.imagePath || '',
    imageDataUrl: scene.imageDataUrl || '',
    videoPath: scene.videoPath || '',
    videoStatus: scene.videoStatus || '',
    continuityReferencePaths: Array.isArray(scene.continuityReferencePaths) ? scene.continuityReferencePaths : [],
    continuityReferenceSourceScene: scene.continuityReferenceSourceScene || null,
    generatedContinuityReferences: scene.generatedContinuityReferences || null,
    reviewType: scene.reviewType || '',
    progressStep: scene.progressStep || '',
    updatedAt: scene.updatedAt || new Date().toISOString(),
  };
}

function normalizeProjectSessionForRenderer(payload = {}) {
  const sourceProject = payload.project || {};
  const scenes = Array.isArray(sourceProject.scenes) ? sourceProject.scenes.map(normalizeRendererScene) : [];
  scenes.forEach((scene, index) => {
    if (!scene.previous) scene.previous = scenes[index - 1]?.original || '';
    if (!scene.next) scene.next = scenes[index + 1]?.original || '';
  });
  return {
    ...sourceProject,
    story: sourceProject.story || payload.inputs?.storyPrompt || '',
    scenes,
    batchSize: sourceProject.batchSize || payload.config?.batchSize || 10,
    durationSec: normalizeSceneDuration(sourceProject.durationSec || payload.config?.sceneDurationSeconds || 10),
    continuityReferences: sourceProject.continuityReferences || payload.runtime?.continuityReferences || payload.config?.continuityReferences || {},
    finalVideoPath: sourceProject.finalVideoPath || payload.assets?.finalOutputs?.[0]?.path || '',
    finalTimeline: Array.isArray(payload.previewTimeline) && payload.previewTimeline.length
      ? payload.previewTimeline
      : Array.isArray(sourceProject.finalTimeline) ? sourceProject.finalTimeline : payload.runtime?.activePreviewTimeline || [],
  };
}

function setControlValue(control, value) {
  if (!control || value == null || value === '') return;
  control.value = String(value);
}

function migrateProjectAssetPathsToOutputFolder(filePath = '') {
  if (!outputFolder || !project?.scenes?.length) return;
  const baseDir = filePath ? filePath.replace(/[\\/][^\\/]+$/, '') : '';
  const projectFolderName = outputFolder.split(/[\\/]/).pop();
  project.scenes.forEach((scene) => {
    ['imagePath', 'videoPath'].forEach((key) => {
      const value = scene[key];
      if (!value) return;
      const normalized = String(value).replace(/\\/g, '/');
      const doubleSegment = `/${projectFolderName}/${projectFolderName}/`;
      if (normalized.includes(doubleSegment)) {
        scene[key] = normalized.replace(doubleSegment, `/${projectFolderName}/`).replace(/\//g, value.includes('\\') ? '\\' : '/');
      } else if (baseDir && !normalized.includes(`/${projectFolderName}/`) && /scene_\d+/.test(normalized)) {
        const tail = normalized.slice(normalized.search(/scene_\d+/));
        scene[key] = `${outputFolder}${outputFolder.includes('\\') ? '\\' : '/'}${tail.replace(/\//g, outputFolder.includes('\\') ? '\\' : '/')}`;
      }
    });
  });
}

function applyProjectSessionPayload(payload = {}, filePath = '') {
  project = normalizeProjectSessionForRenderer(payload);
  activeBatchIds = normalizeActiveBatchIdsForRuntime(payload.runtime?.activeBatchIds || [], project.scenes);
  paused = Boolean(payload.runtime?.paused);
  projectRuntime = {
    currentStage: payload.runtime?.currentStage || 'idle',
    currentBatchIndex: payload.runtime?.currentBatchIndex ?? null,
    currentSceneId: payload.runtime?.currentSceneId || null,
    lastCheckpointRef: payload.runtime?.lastCheckpointRef || payload.router?.status?.lastSafeCheckpointRef || null,
    lastAction: payload.runtime?.lastAction || null,
    resumeMode: payload.runtime?.resumeMode || 'manual-start',
    lastErrorClassification: payload.runtime?.lastErrorClassification || null,
    waitingForUserStart: true,
  };
  isRunning = false;
  autoContinuing = false;
  reviewSceneId = null;
  outputFolder = payload.runtime?.outputFolder || '';
  migrateProjectAssetPathsToOutputFolder(filePath);
  currentProjectFilePath = filePath || '';
  projectDirty = false;
  lastMissingAssetCount = 0;
  if (payload.runtime?.currentSceneId) {
    const currentRef = String(payload.runtime.currentSceneId);
    const found = project.scenes.find((scene, index) => String(scene.id) === currentRef || getSceneRef(scene, index) === currentRef);
    if (found) reviewSceneId = found.id;
  }
  if (projectNameInput) projectNameInput.value = project?.name || '';
  if (storyInput) storyInput.value = payload.inputs?.storyPrompt || project?.story || '';

  if (scriptInput) scriptInput.value = project?.scenes?.map((scene) => scene.original).join('\n\n') || payload.inputs?.scriptPrompt || '';
  setControlValue(batchSizeInput, project?.batchSize);
  applySceneDurationValue(project?.durationSec || 10);
  setControlValue(providerSelect, payload.config?.scriptProvider);
  setControlValue(accountSelect, payload.config?.selectedLabels?.account);
  setControlValue(modelInput, payload.config?.selectedModels?.script || payload.config?.selectedLabels?.model);
  setControlValue(videoPlatformSelect, payload.runtime?.videoPlatform || payload.config?.videoProvider);
  applyImageGenerationSettings(payload.runtime?.imageGeneration || payload.config?.imageGeneration);
  applyReviewSettings(payload.runtime?.reviewSettings || { skipReview: payload.runtime?.skipReview });
  applyContinuityReferenceSettings(payload.runtime?.continuityReferences || payload.config?.continuityReferences || project?.continuityReferences || {});
  applyGrokRecoverySettings(payload.runtime?.grokRecovery || payload.config?.grokRecovery || payload.config?.videoConfig?.grok || {});
  applyChatGptStabilitySettings(payload.runtime?.chatGptStability || payload.config?.chatGptStability || {});
  setControlValue(pixverseResolutionSelect, payload.runtime?.pixverse?.resolution);
  setControlValue(pixverseRatioSelect, payload.runtime?.pixverse?.ratio);
  setControlValue(pixverseDurationSelect, payload.runtime?.pixverse?.duration);
  setControlValue(pixverseModelSelect, payload.runtime?.pixverse?.model);
  if (pixversePreviewToggle) pixversePreviewToggle.checked = Boolean(payload.runtime?.pixverse?.preview ?? payload.runtime?.pixverse?.previewMode);
  if (pixverseAudioToggle) pixverseAudioToggle.checked = Boolean(payload.runtime?.pixverse?.audio);
  const router = payload.router || payload.runtime?.grokRouter || {};
  if (grokRouterEnabledToggle) grokRouterEnabledToggle.checked = Boolean(router.accountRouterEnabled ?? router.enabled);
  setControlValue(grokAccountSelect, router.selectedGrokAccountId || router.account);
  setControlValue(grokRoutingPolicySelect, router.routingPolicy || 'round_robin');
  if (webSessionStatus) webSessionStatus.textContent = outputFolder ? `Folder lưu: ${outputFolder}` : 'Opened project. Waiting for Start.';
  syncVideoPlatformConfig();
  updatePixVerseConfigAdvice();
  syncProjectSceneFolders({ repairFromDisk: true }).then(() => {
    projectDirty = false;
    persist();
    render();
  }).catch(() => null);
  persist();
  render();
}

function renderProjectSessionStatus() {
  if (projectSaveStatus) {
    const label = currentProjectFilePath ? currentProjectFilePath.split(/[\\/]/).pop() : 'Unsaved project';
    projectSaveStatus.textContent = !project && !currentProjectFilePath ? 'No project file loaded' : projectDirty ? `Unsaved changes - ${label}` : `Saved - ${label}`;
    projectSaveStatus.className = `project-save-status ${projectDirty ? 'dirty' : 'saved'}`;
  }
  if (missingAssetWarning) {
    missingAssetWarning.hidden = !lastMissingAssetCount;
    missingAssetWarning.textContent = lastMissingAssetCount ? `${lastMissingAssetCount} saved asset path(s) are missing. Related previews were cleared and can be regenerated.` : '';
  }
}

function markProjectDirty() {
  projectDirty = Boolean(project);
  renderProjectSessionStatus();
}

async function confirmUnsavedProjectAction(actionLabel) {
  if (!projectDirty) return true;
  const decision = await window.videoPlannerAPI?.newProjectSession?.({ hasUnsavedChanges: true, actionLabel }).catch(() => null);
  if (decision?.action === 'save') return saveProjectSessionFlow({ silent: true });
  if (decision?.action === 'discard') return true;
  return false;
}

function openChatResolveDialog(scene, message) {
  pendingChatResolve = { sceneId: scene?.id || null, message };
  if (chatResolveMessage) chatResolveMessage.textContent = `Chọn cách dùng ChatGPT cho project "${project?.name || ''}": tạo chat mới hoặc nhập tên đoạn chat cũ để tool vào rồi đổi tên.`;
  if (chatResolveTitleInput) chatResolveTitleInput.value = '';
  if (chatResolveDialog && !chatResolveDialog.open) chatResolveDialog.showModal();
  setStatus('Cần chọn cách xử lý đoạn chat ChatGPT để tiếp tục pipeline.', 'error');
}

function closeChatResolveDialog() {
  if (!chatResolveDialog) return;
  try { chatResolveDialog.close(); } catch (_error) {}
  chatResolveDialog.removeAttribute('open');
}

async function resolveChatAndContinue(mode) {
  if (!pendingChatResolve) return;
  const title = chatResolveTitleInput?.value?.trim() || '';
  if (mode === 'rename' && !title) {
    setStatus('Nhập tên đoạn chat cũ trước khi chọn đổi tên.', 'error');
    chatResolveTitleInput?.focus?.();
    return;
  }
  closeChatResolveDialog();
  paused = false;
  if (mode === 'new') {
    const targetTitle = project?.name || projectNameInput?.value?.trim() || '';
    project.chatContextTitle = '';
    project.chatResolveChoice = 'new';
    
    project.chatChoiceConfirmed = true;project.pendingChatRenameTitle = targetTitle;
    setStatus(`Option 1: bỏ tìm chat cũ. Tool sẽ mở chat mới, gửi prompt, rồi rename an toàn đúng chat hiện tại.`, 'running');
    await window.videoPlannerAPI?.appendAppLog?.({ source: 'renderer', kind: 'running', text: `Chat resolve option 1: bypass old chat, pendingRenameTitle=${targetTitle}` });
  } else {
    const targetTitle = project?.name || projectNameInput?.value?.trim() || '';
    project.chatContextTitle = title;
    project.chatResolveChoice = 'existing';
    
    project.chatChoiceConfirmed = true;project.pendingChatRenameTitle = targetTitle;
    setStatus(`Option 2: tool sẽ vào đoạn chat "${title}", rồi check/rename liên tục thành "${targetTitle}" trước khi tiếp tục pipeline.`, 'running');
    await window.videoPlannerAPI?.appendAppLog?.({ source: 'renderer', kind: 'running', text: `Chat resolve option 2: select old chat="${title}", pendingRenameTitle=${targetTitle}` });
  }
  const scene = project?.scenes?.find((item) => item.id === pendingChatResolve.sceneId);
  if (scene) {
    scene.error = '';
    scene.pipelineRetryCount = 0;
    scene.status = scene.imagePath ? 'image_done' : 'approved';
  }
  pendingChatResolve = null;
  markProjectDirty();
  persist();
  render();
  queueAutoContinue(200);
}

function forceCloseNewProjectDialog() {
  if (!newProjectDialog) return;
  try { newProjectDialog.close(); } catch (_error) {}
  newProjectDialog.removeAttribute('open');
  newProjectDialog.classList.add('force-hidden');
  document.body?.classList?.remove('modal-open');
  setTimeout(() => newProjectDialog.classList.remove('force-hidden'), 300);
}

function createBlankProjectFromName() {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: projectNameInput?.value?.trim() || 'Untitled project',
    story: storyInput?.value?.trim() || '',
    scenes: [],
    chatContextTitle: '',
    chatResolveChoice: '',
    chatChoiceConfirmed: false,
    pendingChatRenameTitle: '',
    batchSize: clamp(Number(batchSizeInput?.value) || 10, 1, 10),
    durationSec: applySceneDurationValue(durationInput?.value || 10),
    createdAt: now,
    updatedAt: now,
  };
}

async function createInitialProjectFileInOutputFolder(rootFolder = outputFolder) {
  if (!rootFolder || !window.videoPlannerAPI?.createProjectSession) return null;
  const result = await window.videoPlannerAPI.createProjectSession({
    folderPath: rootFolder,
    projectName: project.name,
    payload: getProjectSessionPayload(),
  }).catch((error) => ({ ok: false, error: error.message }));
  if (!result?.ok) {
    project = null;
    setStatus(`Không tạo được file .vdra: ${result?.error || 'unknown error'}`, 'error');
    return null;
  }
  currentProjectFilePath = result.filePath || '';
  outputFolder = result.projectFolder || outputFolder;
  projectDirty = false;
  persist();
  render();
  return result;
}

async function newProjectSessionFlow() {
  if (!(await confirmUnsavedProjectAction('creating a new project'))) return;
  await window.videoPlannerAPI?.newProjectSession?.().catch(() => null);
  project = null;
  activeBatchIds = [];
  paused = false;
  isRunning = false;
  autoContinuing = false;
  reviewSceneId = null;
  pipelineLogs = [];
  lastStatusText = '';
  currentProjectFilePath = '';
  outputFolder = '';
  projectDirty = false;
  lastMissingAssetCount = 0;
  newProjectSceneText = '';
  newProjectRootFolder = '';
  projectRuntime = { currentStage: 'idle', currentBatchIndex: null, currentSceneId: null, lastCheckpointRef: null, lastAction: 'new_project', resumeMode: 'manual-start', waitingForUserStart: true };
  projectForm?.reset?.();
  if (newProjectNameInput) newProjectNameInput.value = '';
  if (newProjectSceneFileInput) newProjectSceneFileInput.value = '';
  if (newProjectSceneFileName) newProjectSceneFileName.textContent = 'Chưa chọn file scene.';
  if (newProjectSaveLocationInput) newProjectSaveLocationInput.value = '';
  persist();
  render();
  setStatus('Nhập thông tin project mới trước khi tạo file .vdra.', 'idle');
  if (newProjectDialog && !newProjectDialog.open) newProjectDialog.showModal();
}

async function submitNewProjectDialog() {
  const projectName = newProjectNameInput?.value?.trim() || '';
  if (!projectName) {
    setStatus('Cần nhập tên project trước khi tạo.', 'error');
    newProjectNameInput?.focus?.();
    return;
  }
  if (!newProjectSceneText.trim()) {
    setStatus('Cần chọn file scene .txt trước khi tạo project.', 'error');
    return;
  }
  if (!newProjectRootFolder) {
    setStatus('Cần chọn vị trí lưu project.', 'error');
    return;
  }
  forceCloseNewProjectDialog();
  projectNameInput.value = projectName;
  scriptInput.value = newProjectSceneText;
  const createdProject = createProject();
  if (!createdProject) return;
  const createdFile = await createInitialProjectFileInOutputFolder(newProjectRootFolder);
  if (!createdFile?.ok) {
    setStatus('Project đã tạo scene nhưng chưa lưu được file .vdra; bấm Save Project để lưu lại.', 'error');
    return;
  }
  setStatus(`Đã tạo ${currentProjectFilePath.split(/[\\/]/).pop()} và folder ${outputFolder.split(/[\\/]/).pop()}.`, 'ok');
}

async function saveProjectSessionFlow(options = {}) {
  if (!project) return false;
  if (!options.skipSync) {
    await syncProjectSceneFolders({ repairFromDisk: true });
    const checked = await reconcileSavedAssets();
    lastMissingAssetCount = checked.missing || 0;
  }
  const payload = getProjectSessionPayload();
  const result = currentProjectFilePath && window.videoPlannerAPI?.overwriteProjectSession
    ? await window.videoPlannerAPI.overwriteProjectSession({ filePath: currentProjectFilePath, payload })
    : await window.videoPlannerAPI?.saveProjectSession?.(payload);
  if (!result?.ok) return false;
  currentProjectFilePath = result.filePath || currentProjectFilePath;
  projectDirty = false;
  persist();
  render();
  if (!options.silent) setStatus(`Saved .vdra${lastMissingAssetCount ? `; ${lastMissingAssetCount} missing asset path(s) cleared` : ''}.`, 'ok');
  return true;
}

async function openProjectSessionFlow() {
  if (!window.videoPlannerAPI?.openProjectSession) return;
  if (!(await confirmUnsavedProjectAction('opening a different project'))) return;
  const result = await window.videoPlannerAPI.openProjectSession();
  if (!result?.ok) return;
  applyProjectSessionPayload(result.payload, result.filePath);
  await syncProjectSceneFolders({ repairFromDisk: true });
  const checked = await reconcileSavedAssets();
  await syncProjectSceneFolders({ repairFromDisk: true });
  lastMissingAssetCount = checked.missing || 0;
  projectDirty = Boolean(lastMissingAssetCount);
  persist();
  render();
  setStatus(`Opened .vdra. ${lastMissingAssetCount ? `${lastMissingAssetCount} missing asset path(s) need regeneration. ` : ''}Press Start pipeline to continue.`, lastMissingAssetCount ? 'error' : 'ok');
}

function persist() {
  try {
    let sanitizedProject = null;
    if (project) {
      sanitizedProject = {
        ...project,
        scenes: Array.isArray(project.scenes)
          ? project.scenes.map(s => {
              if (s) {
                const copy = { ...s };
                delete copy.imageDataUrl;
                return copy;
              }
              return s;
            })
          : []
      };
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      project: sanitizedProject,
      activeBatchIds,
      paused,
      outputFolder,
      currentProjectFilePath,
      projectDirty,
      projectRuntime,
      grokRouter: getGrokRouterSettings(),
      reviewSettings: getReviewSettings(),
      imageGeneration: getImageGenerationSettings(),
      continuityReferences: getContinuityReferenceSettings(),
      grokRecovery: getGrokRecoverySettings(),
      chatGptStability: getChatGptStabilitySettings(),
      veoupPreviewStartOnly: Boolean(veoupPreviewStartOnlyToggle?.checked)
    }));
  } catch (e) {
    console.warn('[LocalStorage Persist Quota Error] Failed to execute setItem, applying safe fallback:', e);
    try {
      let fallbackProject = null;
      if (project) {
        const activeSceneId = projectRuntime?.currentSceneId;
        fallbackProject = {
          ...project,
          scenes: Array.isArray(project.scenes)
            ? project.scenes.map((s, idx) => {
                if (!s) return s;
                const copy = { ...s };
                delete copy.imageDataUrl;
                
                const isCompleted = ['video_done', 'video_ready', 'scene_completed'].includes(copy.status);
                const isActive = String(copy.id) === String(activeSceneId) || String(idx + 1) === String(activeSceneId);
                
                if (isCompleted && !isActive) {
                  // Keep only essential metadata to free up space
                  copy.original = '';
                  copy.imagePrompt = '';
                  copy.motionPrompt = '';
                  copy.continuityReferencePaths = [];
                }
                return copy;
              })
            : []
        };
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        project: fallbackProject,
        activeBatchIds,
        paused,
        outputFolder,
        currentProjectFilePath,
        projectDirty,
        projectRuntime,
        grokRouter: getGrokRouterSettings(),
        reviewSettings: getReviewSettings(),
        imageGeneration: getImageGenerationSettings(),
        continuityReferences: getContinuityReferenceSettings(),
        grokRecovery: getGrokRecoverySettings(),
        chatGptStability: getChatGptStabilitySettings(),
        veoupPreviewStartOnly: Boolean(veoupPreviewStartOnlyToggle?.checked)
      }));
    } catch (innerErr) {
      console.error('[LocalStorage Persist Critical] Fallback also failed:', innerErr);
    }
  }
}

async function reconcileSavedAssets() {
  if (!project?.scenes?.length || !window.videoPlannerAPI?.assetExists) return { missing: 0 };
  let missing = 0;
  const pathMissingCache = new Map();
  const missingPath = async (filePath) => {
    if (!filePath) return false;
    if (pathMissingCache.has(filePath)) return pathMissingCache.get(filePath);
    const isMissing = !(await window.videoPlannerAPI.assetExists(filePath).catch(() => false));
    pathMissingCache.set(filePath, isMissing);
    return isMissing;
  };
  for (const scene of project.scenes) {
    if (scene.imagePath && await missingPath(scene.imagePath)) {
      scene.imagePath = '';
      scene.imageDataUrl = '';
      if (['image_done', 'image_generated', 'video_pending', 'video_generating', 'video_done', 'video_generated', 'video_ready', 'asset_review'].includes(scene.status)) scene.status = 'image_pending';
      missing += 1;
    }
    if (scene.videoPath && await missingPath(scene.videoPath)) {
      scene.videoPath = '';
      if (['video_done', 'video_generated', 'video_ready'].includes(scene.status)) scene.status = scene.imagePath ? 'image_done' : 'image_pending';
      missing += 1;
    }
  }
  if (project.finalVideoPath && await missingPath(project.finalVideoPath)) {
    project.finalVideoPath = '';
    missing += 1;
  }
  if (Array.isArray(project.finalTimeline)) {
    const kept = [];
    for (const item of project.finalTimeline) {
      const videoMissing = item.videoPath && await missingPath(item.videoPath);
      const keyframeMissing = item.keyframePath && await missingPath(item.keyframePath);
      if (videoMissing || keyframeMissing) {
        missing += Number(Boolean(videoMissing)) + Number(Boolean(keyframeMissing));
      } else {
        kept.push(item);
      }
    }
    project.finalTimeline = kept;
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
    applyImageGenerationSettings(saved.imageGeneration || {});
    applyReviewSettings(saved.reviewSettings || { skipReview: saved.skipReview });
    applyContinuityReferenceSettings(saved.continuityReferences || saved.project?.continuityReferences || {});
    applyGrokRecoverySettings(saved.grokRecovery || {});
    applyChatGptStabilitySettings(saved.chatGptStability || {});
    if (veoupPreviewStartOnlyToggle) veoupPreviewStartOnlyToggle.checked = Boolean(saved.veoupPreviewStartOnly);
    currentProjectFilePath = saved.currentProjectFilePath || '';
    projectDirty = Boolean(saved.projectDirty);
    projectRuntime = { ...projectRuntime, ...(saved.projectRuntime || {}) };
    localStorage.removeItem(RESTORE_SESSION_KEY);
    if (shouldRestore && saved.project) {
      project = saved.project;
      activeBatchIds = normalizeActiveBatchIdsForRuntime(saved.activeBatchIds || [], project.scenes || []);
      paused = Boolean(saved.paused);
      projectNameInput.value = project.name || projectNameInput.value;
      if (storyInput) storyInput.value = project.story || '';

      scriptInput.value = project.scenes?.map((scene) => scene.original).join('\n\n') || '';
      batchSizeInput.value = project.batchSize || batchSizeInput.value;
      applySceneDurationValue(project.durationSec || durationInput.value || 10);
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
      currentProjectFilePath = '';
      projectDirty = false;
      projectRuntime = { currentStage: 'idle', currentBatchIndex: null, currentSceneId: null, lastCheckpointRef: null, lastAction: null, resumeMode: 'manual-start', waitingForUserStart: true };
      if (outputFolder) webSessionStatus.textContent = `Folder lưu: ${outputFolder}`;
      setStatus('Phiên mới: đã xóa tiến trình cũ. Bấm Start pipeline để chạy lại từ scene 1.', 'idle');
    }
  } catch (_error) {
    project = null;
    activeBatchIds = [];
    paused = false;
    projectRuntime = { currentStage: 'idle', currentBatchIndex: null, currentSceneId: null, lastCheckpointRef: null, lastAction: null, resumeMode: 'manual-start', waitingForUserStart: true };
  }
  render();
}

projectForm.addEventListener('submit', createProject);
runBatchBtn?.addEventListener('click', () => runNextBatch());
pauseBtn.addEventListener('click', pauseRun);
resumeBtn.addEventListener('click', resumeRun);
workflowResumeBtn?.addEventListener('click', recoverWorkflowRun);
chatGptOpenBtn?.addEventListener('click', openChatGptWindow);
chatGptNewChatBtn?.addEventListener('click', openFreshChatGptWindow);
chatGptClearCacheBtn?.addEventListener('click', clearChatGptCache);
exportBtn.addEventListener('click', exportProject);
chooseOutputFolderBtn.addEventListener('click', chooseOutputFolder);
saveSessionBtn?.addEventListener('click', saveSessionForNextLaunch);
newProjectBtn?.addEventListener('click', newProjectSessionFlow);
newProjectSceneFileInput?.addEventListener('change', async () => {
  const file = newProjectSceneFileInput.files?.[0];
  if (!file) return;
  newProjectSceneText = await file.text();
  if (newProjectSceneFileName) newProjectSceneFileName.textContent = file.name;
});
newProjectChooseLocationBtn?.addEventListener('click', async () => {
  const folder = await window.videoPlannerAPI?.chooseProjectRootFolder?.();
  if (!folder) return;
  newProjectRootFolder = folder;
  if (newProjectSaveLocationInput) newProjectSaveLocationInput.value = folder;
});
newProjectCreateBtn?.addEventListener('click', submitNewProjectDialog);
chatResolveNewBtn?.addEventListener('click', () => resolveChatAndContinue('new'));
chatResolveRenameBtn?.addEventListener('click', () => resolveChatAndContinue('rename'));
openProjectBtn?.addEventListener('click', openProjectSessionFlow);
saveProjectBtn?.addEventListener('click', saveProjectSessionFlow);
[projectNameInput, storyInput, scriptInput, batchSizeInput, durationInput].forEach((control) => control?.addEventListener('input', () => {
  markProjectDirty();
  persist();
}));
grokAccountSelect?.addEventListener('change', () => {
  markProjectDirty();
  window.videoPlannerAPI?.selectGrokAccount?.(grokAccountSelect.value)
    .then((result) => {
      if (!result?.ok) setStatus(result?.error || 'Không chọn được Grok account.', 'error');
      return refreshGrokRouterStatus();
    })
    .catch((error) => setStatus(`Không chọn được Grok account: ${error.message}`, 'error'));
  persist();
});
grokRouterEnabledToggle?.addEventListener('change', () => {
  markProjectDirty();
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
  setReviewZoom(Number(zoomRange.value) || 100);
});
reviewMediaStage?.addEventListener('wheel', handleReviewWheelZoom, { passive: false });
zoomOutBtn?.addEventListener('click', () => setReviewZoom((Number(zoomRange?.value) || reviewZoom || 100) - 10));
zoomInBtn?.addEventListener('click', () => setReviewZoom((Number(zoomRange?.value) || reviewZoom || 100) + 10));
reviewMediaStage?.addEventListener('pointerdown', startReviewPan);
reviewMediaStage?.addEventListener('pointermove', moveReviewPan);
reviewMediaStage?.addEventListener('pointerup', stopReviewPan);
reviewMediaStage?.addEventListener('pointercancel', stopReviewPan);
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 's') {
    event.preventDefault();
    event.stopPropagation();
    saveProjectSessionFlow({ fromShortcut: true, skipSync: true }).catch((error) => setStatus(`Không lưu được project: ${error.message}`, 'error'));
  }
}, true);
document.addEventListener('keydown', handleReviewShortcut);
document.addEventListener('keyup', releaseReviewShortcut);
saveEditBtn.addEventListener('click', saveEdit);
videoPlatformSelect?.addEventListener('change', () => {
  syncVideoPlatformConfig();
  markProjectDirty();
  persist();
  render();
});
[pixverseResolutionSelect, pixverseRatioSelect, pixverseDurationSelect, pixverseModelSelect, pixversePreviewToggle, pixverseAudioToggle]
  .filter(Boolean)
  .forEach((control) => control.addEventListener('change', () => {
    updatePixVerseConfigAdvice();
    markProjectDirty();
    persist();
  }));
providerSelect.addEventListener('change', () => {
  if (providerSelect.value === 'ninerouter') modelInput.value = 'cx/gpt-5.5';
  if (providerSelect.value === 'grok') modelInput.value = 'grok-3-latest';
  markProjectDirty();
  persist();
});
accountSelect?.addEventListener('change', () => {
  markProjectDirty();
  persist();
});
modelInput?.addEventListener('input', () => {
  markProjectDirty();
  persist();
});
[chatGptRotateScenesInput, chatGptAutoReloadToggle, chatGptAutoResumeToggle, chatGptRetryLimitInput, customTargetScenesInput]
  .filter(Boolean)
  .forEach((control) => control.addEventListener('change', () => {
    if (control === customTargetScenesInput) {
      targetSceneCount = clamp(Number(customTargetScenesInput.value) || 50, 1, 100);
    }
    persist();
  }));
[skipReviewToggle, skipPromptReviewToggle, skipImageReviewToggle, skipVideoReviewToggle]
  .filter(Boolean)
  .forEach((control) => control.addEventListener('change', () => {
    if (control === skipReviewToggle && skipReviewToggle.checked) {
      [skipPromptReviewToggle, skipImageReviewToggle, skipVideoReviewToggle].forEach((item) => {
        if (item) item.checked = true;
      });
    }
    markProjectDirty();
    persist();
  }));
[imageGenerationMethodSelect, imageApiEndpointInput, imageApiModelSelect, imageApiSizeInput, imageApiKeyInput, grokResultRetryLimitInput]
  .filter(Boolean)
  .forEach((control) => control.addEventListener('change', () => {
    markProjectDirty();
    persist();
  }));

veoupPreviewStartOnlyToggle?.addEventListener('change', () => {
  persist();
});

/* VIDORA_HARD_PROMPT_FILE_PICKER_UI_V2 */
function ensureHardPromptFilePickerUi() {
  const openBtn = document.getElementById('openHardPromptBtn');
  if (!openBtn || document.getElementById('chooseHardPromptBtn')) return;

  const wrap = document.createElement('div');
  wrap.className = 'setting-row';
  wrap.style.marginTop = '8px';
  wrap.style.display = 'flex';
  wrap.style.gap = '8px';
  wrap.style.alignItems = 'center';
  wrap.style.flexWrap = 'wrap';

  const chooseBtn = document.createElement('button');
  chooseBtn.id = 'chooseHardPromptBtn';
  chooseBtn.type = 'button';
  chooseBtn.className = openBtn.className || 'secondary';
  chooseBtn.textContent = 'Chọn file hard prompt';

  const label = document.createElement('span');
  label.id = 'hardPromptFileLabel';
  label.style.opacity = '0.8';
  label.style.fontSize = '12px';
  label.textContent = 'Đang dùng file hard prompt mặc định';

  wrap.appendChild(chooseBtn);
  wrap.appendChild(label);
  openBtn.insertAdjacentElement('afterend', wrap);

  async function refreshLabel() {
    const info = await window.videoPlannerAPI?.getHardPromptFile?.().catch(() => null);
    if (!info?.ok) return;
    label.textContent = info.usingCustomFile
      ? `Hard prompt: ${info.filePath}`
      : `Hard prompt mặc định: ${info.filePath}`;
  }

  chooseBtn.addEventListener('click', async () => {
    const result = await window.videoPlannerAPI?.chooseHardPromptFile?.().catch((error) => ({ ok: false, error: error.message }));
    if (result?.ok) {
      setStatus(`Đã chọn file hard prompt: ${result.filePath}`, 'ok');
      await refreshLabel();
    } else if (!result?.canceled) {
      setStatus(`Không chọn được file hard prompt: ${result?.error || 'unknown'}`, 'error');
    }
  });

  refreshLabel().catch(() => null);
}

ensureHardPromptFilePickerUi();
document.addEventListener('DOMContentLoaded', ensureHardPromptFilePickerUi);

settingsSaveBtn?.addEventListener('click', saveSettingsDialog);
copyLogBtn?.addEventListener('click', copyPipelineLog);

openNv1PromptBtn?.addEventListener('click', async () => {
  const result = await window.videoPlannerAPI?.openHardPromptFile?.('NV1_TAO_ANH').catch((error) => ({ ok: false, error: error.message }));
  setStatus(result?.ok ? 'Đã mở file NV1_TAO_ANH.txt.' : `Không mở được file NV1_TAO_ANH.txt: ${result?.error || 'unknown'}`, result?.ok ? 'ok' : 'error');
});

openNv2PromptBtn?.addEventListener('click', async () => {
  const result = await window.videoPlannerAPI?.openHardPromptFile?.('NV2_MOTION_PROMPT').catch((error) => ({ ok: false, error: error.message }));
  setStatus(result?.ok ? 'Đã mở file NV2_MOTION_PROMPT.txt.' : `Không mở được file NV2_MOTION_PROMPT.txt: ${result?.error || 'unknown'}`, result?.ok ? 'ok' : 'error');
});

window.addEventListener('error', (event) => {
  setStatus(`Renderer lỗi: ${event.message}`, 'error');
});
window.addEventListener('unhandledrejection', (event) => {
  setStatus(`Promise lỗi: ${event.reason?.message || event.reason}`, 'error');
});

embedRouterPanelInSettings();
moveProjectActionsOutsideSettings();
syncVideoPlatformConfig();
refreshGrokRouterStatus().catch(() => null);
renderPipelineLog();
window.videoPlannerAPI?.getPipelineLogVisible?.().then(setPipelineLogVisible).catch(() => setPipelineLogVisible(false));
window.videoPlannerAPI?.onPipelineLogVisible?.(setPipelineLogVisible);
window.videoPlannerAPI?.onProjectMenuCommand?.((command) => {
  if (command === 'new') newProjectSessionFlow();
  if (command === 'open') openProjectSessionFlow();
  if (command === 'save') saveProjectSessionFlow();
  if (command === 'settings') openSettingsDialog();
});
window.videoPlannerAPI?.appendAppLog?.({ source: 'renderer', kind: 'info', text: 'Renderer loaded' }).catch(() => null);

restore();


setTimeout(ensureImageMotionOnlyModeControl, 0);
document.addEventListener('DOMContentLoaded', ensureImageMotionOnlyModeControl);

async function updateVeoUpSetupUI() {
  const statusEl = document.querySelector('#veoup-setup-status');
  const displayEl = document.querySelector('#veoup-coords-display');
  const deleteBtn = document.querySelector('#veoup-delete-setup-btn');
  const stepsEl = document.querySelector('#veoup-calibration-steps');
  
  if (!statusEl || !displayEl) return;
  
  try {
    const config = await window.videoPlannerAPI?.getVeoUpCoordinateConfig?.();
    if (config) {
      statusEl.textContent = 'Đã thiết lập';
      statusEl.style.color = '#4caf50';
      
      displayEl.innerHTML = `
        <div style="margin-top: 5px; color: var(--text);">Tọa độ hiện tại (Maximized):</div>
        <div>Blue Box Offset: X=${config.blueBoxOffsetX}, Y=${config.blueBoxOffsetY}</div>
        <div>Red Box Offset: X=${config.redBoxOffsetX}, Y=${config.redBoxOffsetY}</div>
        <div>Start Button Offset: X=${config.startButtonOffsetX}, Y=${config.startButtonOffsetY}</div>
        <div style="font-size:0.8em; color:var(--muted); margin-top:5px;">Lưu tại: AppData/userData/veoup-coordinates.json</div>
      `;
      if (deleteBtn) deleteBtn.style.display = 'inline-block';
    } else {
      statusEl.textContent = 'Chưa thiết lập';
      statusEl.style.color = 'var(--muted)';
      displayEl.textContent = 'Chưa có tọa độ VeoUp. Hãy chạy “Thiết lập tọa độ VeoUp”.';
      if (deleteBtn) deleteBtn.style.display = 'none';
    }
    if (stepsEl) stepsEl.style.display = 'none';
  } catch (err) {
    console.error('Failed to get VeoUp coordinate config:', err);
    statusEl.textContent = 'Lỗi tải config';
    statusEl.style.color = 'var(--danger)';
  }
}

function updateScanButtonVisibility() {
  const scanRunBtn = document.querySelector('#veoup-scan-run-btn');
  if (!scanRunBtn) return;
  scanRunBtn.style.display = (project && outputFolder) ? 'inline-block' : 'none';
}

// VeoUp calibration UI bindings
(function initVeoUpCalibration() {
  const veoupStartSetupBtn = document.querySelector('#veoup-start-setup-btn');
  const veoupSetupStatus = document.querySelector('#veoup-setup-status');
  const veoupCalibrationSteps = document.querySelector('#veoup-calibration-steps');
  const veoupCoordsDisplay = document.querySelector('#veoup-coords-display');
  const veoupDeleteSetupBtn = document.querySelector('#veoup-delete-setup-btn');
  const veoupCancelSetupBtn = document.querySelector('#veoup-cancel-setup-btn');

  let activeCalibrationOffsets = {};
  let isCalibrating = false;

  const setStepActive = (stepNum) => {
    // Update visual rows opacity
    const row1 = document.querySelector('#veoup-step-1-row');
    const row2 = document.querySelector('#veoup-step-2-row');
    const row3 = document.querySelector('#veoup-step-3-row');
    
    if (row1) row1.style.opacity = stepNum === 1 ? '1.0' : '0.5';
    if (row2) row2.style.opacity = stepNum === 2 ? '1.0' : '0.5';
    if (row3) row3.style.opacity = stepNum === 3 ? '1.0' : '0.5';

    const inst = document.querySelector('#veoup-calibration-instruction');
    if (!inst) return;

    if (stepNum === 1) {
      inst.textContent = 'Bước 1/3: Đưa chuột vào giữa vùng “Đã chọn 0 ảnh”, sau đó nhấn Enter.';
    } else if (stepNum === 2) {
      inst.textContent = 'Bước 2/3: Đưa chuột vào giữa ô nhập prompt, sau đó nhấn Enter.';
    } else if (stepNum === 3) {
      inst.textContent = 'Bước 3/3: Đưa chuột vào giữa nút “Bắt đầu tạo video”, sau đó nhấn Enter.';
    } else {
      inst.textContent = '';
    }
  };

  const runCalibrationLoop = async () => {
    isCalibrating = true;
    
    // Reset visual statuses
    const s1 = document.querySelector('#veoup-step-1-status');
    const s2 = document.querySelector('#veoup-step-2-status');
    const s3 = document.querySelector('#veoup-step-3-status');
    
    if (s1) { s1.textContent = 'Chờ ghi nhận'; s1.className = 'badge'; }
    if (s2) { s2.textContent = 'Chờ ghi nhận'; s2.className = 'badge'; }
    if (s3) { s3.textContent = 'Chờ ghi nhận'; s3.className = 'badge'; }
    
    // Step 1: Blue Box
    setStepActive(1);
    if (s1) { s1.textContent = 'Đợi nhấn Enter...'; s1.className = 'badge warning'; }
    
    let step1Done = false;
    while (!step1Done && isCalibrating) {
      const res = await window.videoPlannerAPI?.captureVeoUpCoordinate?.('blueBox');
      if (!isCalibrating) return; // calibration was cancelled while awaiting
      if (res && res.ok) {
        activeCalibrationOffsets = res.offsets || {};
        if (s1) {
          s1.textContent = `Đã ghi (X=${activeCalibrationOffsets.blueBoxOffsetX}, Y=${activeCalibrationOffsets.blueBoxOffsetY})`;
          s1.className = 'badge success';
        }
        step1Done = true;
      } else {
        if (res?.error && (res.error.includes('cancelled') || res.error.includes('No active calibration') || res.error.includes('Calibration cancelled'))) {
          cleanupSetupUI();
          return;
        }
        // Validation failed
        const msg = res?.error || 'Tọa độ Blue Box chưa đúng, hãy đưa chuột vào đúng vùng bấm mở ảnh rồi nhấn Enter lại.';
        const inst = document.querySelector('#veoup-calibration-instruction');
        if (inst) inst.textContent = msg;
        if (s1) { s1.textContent = 'Thử lại...'; s1.className = 'badge danger'; }
      }
    }

    if (!isCalibrating) return;

    // Step 2: Red Box
    setStepActive(2);
    if (s2) { s2.textContent = 'Đợi nhấn Enter...'; s2.className = 'badge warning'; }
    
    let step2Done = false;
    while (!step2Done && isCalibrating) {
      const res = await window.videoPlannerAPI?.captureVeoUpCoordinate?.('redBox');
      if (!isCalibrating) return;
      if (res && res.ok) {
        activeCalibrationOffsets = res.offsets || {};
        if (s2) {
          s2.textContent = `Đã ghi (X=${activeCalibrationOffsets.redBoxOffsetX}, Y=${activeCalibrationOffsets.redBoxOffsetY})`;
          s2.className = 'badge success';
        }
        step2Done = true;
      } else {
        if (res?.error && (res.error.includes('cancelled') || res.error.includes('No active calibration') || res.error.includes('Calibration cancelled'))) {
          cleanupSetupUI();
          return;
        }
        if (s2) { s2.textContent = 'Lỗi, thử lại...'; s2.className = 'badge danger'; }
      }
    }

    if (!isCalibrating) return;

    // Step 3: Start Button
    setStepActive(3);
    if (s3) { s3.textContent = 'Đợi nhấn Enter...'; s3.className = 'badge warning'; }
    
    let step3Done = false;
    while (!step3Done && isCalibrating) {
      const res = await window.videoPlannerAPI?.captureVeoUpCoordinate?.('startButton');
      if (!isCalibrating) return;
      if (res && res.ok) {
        if (res.needsConfirmation) {
          const confirmed = confirm('Bạn có nhìn thấy con trỏ chuột di chuyển đến đúng vị trí nút "Bắt đầu tạo video" (Start Video) trên VeoUp không?');
          if (confirmed) {
            const saveRes = await window.videoPlannerAPI?.saveVeoUpCoordinateConfig?.({
              ...res.offsets,
              startButtonValidated: true
            });
            if (saveRes && saveRes.ok) {
              if (s3) {
                s3.textContent = 'Hoàn tất';
                s3.className = 'badge success';
              }
              step3Done = true;
              isCalibrating = false;
              alert('Căn chỉnh tọa độ VeoUp hoàn tất! Cấu hình đã được lưu.');
              await updateVeoUpSetupUI();
            } else {
              alert('Không lưu được cấu hình: ' + (saveRes?.error || 'Unknown error'));
            }
          } else {
            const inst = document.querySelector('#veoup-calibration-instruction');
            if (inst) inst.textContent = 'Căn chỉnh nút Start không khớp, vui lòng di chuột trên VeoUp và nhấn Enter lại.';
            if (s3) { s3.textContent = 'Thử lại...'; s3.className = 'badge danger'; }
          }
        }
      } else {
        if (res?.error && (res.error.includes('cancelled') || res.error.includes('No active calibration') || res.error.includes('Calibration cancelled'))) {
          cleanupSetupUI();
          return;
        }
        const msg = res?.error || 'Tọa độ nút Start Button không hợp lệ. Vui lòng di chuột đúng vị trí và nhấn Enter lại.';
        const inst = document.querySelector('#veoup-calibration-instruction');
        if (inst) inst.textContent = msg;
        if (s3) { s3.textContent = 'Lỗi, thử lại...'; s3.className = 'badge danger'; }
      }
    }
  };

  const cleanupSetupUI = () => {
    isCalibrating = false;
    veoupSetupStatus.textContent = 'Đã hủy';
    veoupSetupStatus.style.color = 'var(--danger)';
    if (veoupCalibrationSteps) veoupCalibrationSteps.style.display = 'none';
    veoupCoordsDisplay.textContent = 'Đã hủy quá trình thiết lập.';
    
    // Reset visual statuses
    const s1 = document.querySelector('#veoup-step-1-status');
    const s2 = document.querySelector('#veoup-step-2-status');
    const s3 = document.querySelector('#veoup-step-3-status');
    if (s1) { s1.textContent = 'Chờ ghi nhận'; s1.className = 'badge'; }
    if (s2) { s2.textContent = 'Chờ ghi nhận'; s2.className = 'badge'; }
    if (s3) { s3.textContent = 'Chờ ghi nhận'; s3.className = 'badge'; }
  };

  veoupStartSetupBtn?.addEventListener('click', async () => {
    veoupStartSetupBtn.disabled = true;
    const oldText = veoupStartSetupBtn.textContent;
    veoupStartSetupBtn.textContent = 'Đang mở/tối đa hóa VeoUp...';
    veoupSetupStatus.textContent = 'Đang kết nối...';
    veoupSetupStatus.style.color = 'var(--muted)';
    veoupCoordsDisplay.textContent = 'Đang khởi chạy hoặc kết nối tới VeoUp và phóng to cửa sổ...';
    
    try {
      const res = await window.videoPlannerAPI?.startVeoUpCoordinateSetup?.();
      if (res && res.ok) {
        veoupSetupStatus.textContent = 'Đang thiết lập';
        veoupSetupStatus.style.color = '#ff9800';
        if (veoupCalibrationSteps) veoupCalibrationSteps.style.display = 'block';
        veoupCoordsDisplay.textContent = 'Đang trong quá trình hiệu chuẩn. Vui lòng di chuột trên VeoUp và nhấn Enter.';
        
        // Start the hotkey waiting loop
        runCalibrationLoop().catch((err) => {
          console.error('[VeoUp Setup] Calibration loop error:', err);
        });
      } else {
        veoupSetupStatus.textContent = 'Thất bại';
        veoupSetupStatus.style.color = 'var(--danger)';
        veoupCoordsDisplay.textContent = `Lỗi: ${res?.error || 'Không tìm thấy hoặc không mở được cửa sổ VeoUp.'}`;
      }
    } catch (err) {
      veoupSetupStatus.textContent = 'Thất bại';
      veoupSetupStatus.style.color = 'var(--danger)';
      veoupCoordsDisplay.textContent = `Lỗi: ${err.message || err}`;
    } finally {
      veoupStartSetupBtn.disabled = false;
      veoupStartSetupBtn.textContent = oldText;
    }
  });

  veoupCancelSetupBtn?.addEventListener('click', async () => {
    isCalibrating = false;
    await window.videoPlannerAPI?.cancelVeoUpCoordinateSetup?.();
    cleanupSetupUI();
    await updateVeoUpSetupUI();
  });

  veoupDeleteSetupBtn?.addEventListener('click', async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa tọa độ VeoUp đã thiết lập? Bạn sẽ cần thiết lập lại trước khi chạy VeoUp.')) return;
    try {
      const res = await window.videoPlannerAPI?.deleteVeoUpCoordinateConfig?.({
        projectDir: outputFolder
      });
      if (res && res.ok) {
        alert('Đã xóa tọa độ VeoUp. Vui lòng thiết lập lại trước khi chạy VeoUp.');
        await updateVeoUpSetupUI();
      } else {
        alert('Không xóa được tọa độ: ' + (res?.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Lỗi: ' + (err.message || err));
    }
  });
})();

// Project scanning logic
(function initVeoUpProjectScan() {
  const scanRunBtn = document.querySelector('#veoup-scan-run-btn');

  scanRunBtn?.addEventListener('click', async () => {
    if (!project || !outputFolder) {
      alert('Vui lòng tạo hoặc mở project trước.');
      return;
    }
    
    scanRunBtn.disabled = true;
    const oldText = scanRunBtn.textContent;
    scanRunBtn.textContent = 'Đang quét & chạy VeoUp...';
    setStatus('Đang quét project và khởi chạy VeoUp...', 'running');
    
    try {
      const res = await window.videoPlannerAPI?.scanProjectAndRunVeoUp?.({
        projectDir: outputFolder,
        expectedSceneCount: project.scenes.length,
        projectName: project.name || '',
        previewStartButtonOnly: Boolean(veoupPreviewStartOnlyToggle?.checked)
      });
      if (res && res.ok) {
        setStatus(`Quét project thành công! Chạy VeoUp hoàn tất: ${res.imageCount} ảnh.`, 'ok');
        alert(`Hoàn tất chạy VeoUp cho ${res.imageCount} scenes!`);
      } else {
        const errMsg = res?.error || 'Có lỗi xảy ra.';
        setStatus(`Lỗi quét project hoặc chạy VeoUp: ${errMsg}`, 'error');
        alert(`Lỗi: ${errMsg}`);
      }
    } catch (err) {
      setStatus(`Lỗi: ${err.message || err}`, 'error');
      alert(`Lỗi: ${err.message || err}`);
    } finally {
      scanRunBtn.disabled = false;
      scanRunBtn.textContent = oldText;
    }
  });
})();
