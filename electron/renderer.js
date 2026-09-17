
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
const prepromptFolderBtn = document.querySelector('#preprompt-folder-btn');
const newProjectBtn = document.querySelector('#new-project-btn');
const openProjectBtn = document.querySelector('#open-project-btn');
const saveProjectBtn = document.querySelector('#save-project-btn');
const workflowResumeBtn = document.querySelector('#workflow-resume-btn');
const chatGptOpenBtn = document.querySelector('#chatgpt-open-btn');
const chatGptNewChatBtn = document.querySelector('#chatgpt-new-chat-btn');
const chatGptClearCacheBtn = document.querySelector('#chatgpt-clear-cache-btn');
const chatGptAutoReloadToggle = document.querySelector('#chatgpt-auto-reload-toggle');
const chatGptAutoResumeToggle = document.querySelector('#chatgpt-auto-resume-toggle');
const chatGptRetryLimitInput = document.querySelector('#chatgpt-retry-limit-input');
const routerPanel = document.querySelector('.router-panel');
const quickActionsSlot = document.querySelector('#quick-actions-slot');
const projectSaveStatus = document.querySelector('#project-save-status');
const missingAssetWarning = document.querySelector('#missing-asset-warning');
const skipReviewToggle = document.querySelector('#skip-review-toggle');
const skipPromptReviewToggle = document.querySelector('#skip-prompt-review-toggle');
const skipImageReviewToggle = document.querySelector('#skip-image-review-toggle');
const skipVideoReviewToggle = document.querySelector('#skip-video-review-toggle');
const keyframeMotionOnlyToggle = document.querySelector('#keyframe-motion-only-toggle');
const manualChatGptBtn = document.querySelector('#manual-chatgpt-btn');
const manualChatGptCard = document.querySelector('#manual-chatgpt-card');
const manualChatGptSection = document.querySelector('#manual-chatgpt-section');
const manualStageBadge = document.querySelector('#manual-stage-badge');
const manualProjectProgress = document.querySelector('#manual-project-progress');
const manualVeoUpGateStatus = document.querySelector('#manual-veoup-gate-status');
const continuityRefsToggle = document.querySelector('#continuity-refs-toggle');
const continuityMaxKeyframesSelect = document.querySelector('#continuity-max-keyframes-select');
const continuityChatgptToggle = document.querySelector('#continuity-chatgpt-toggle');
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
let targetSceneCount = 0;
const startPipelineInlineBtn = document.querySelector('#start-pipeline-inline-btn');
const stopPipelineBtn = document.querySelector('#stop-pipeline-btn');
const stopPipelineInlineBtn = document.querySelector('#stop-pipeline-inline-btn');
const webSessionStatus = document.querySelector('#web-session-status');
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
const IMAGE_PROMPT_RULES = `NHIỆM VỤ 1 — TẠO ẢNH KEYFRAME ĐẦU SCENE:\n- Nhập vai đạo diễn live action IQ/EQ cao, dựng hiện trường ảnh chuyên nghiệp.\n- Đọc story tổng, toàn bộ preprompt, scene trước, scene hiện tại và scene sau nếu cần.\n- Xác định hành động đầu tiên của scene, tạo ảnh giai đoạn chuẩn bị diễn ra hành động đó.\n- Continuity 1-1: tạo hình, trang phục, cơ thể, mặt, đạo cụ, bối cảnh giữ chính xác qua các scene trừ khi kịch bản yêu cầu đổi.\n- Ảnh phải là 1 frame 16:9, 8K ultra-realistic live action, wide/master shot ưu tiên, sạch rõ, không text/logo/watermark.\n- Spatial Lock: khóa vị trí nhân vật/đạo cụ để đủ đất diễn cho motion 10s.\n- Nếu là POV: chỉ hiện tay/chân/vai ngoại vi, không render mặt/thân chủ thể POV.`;

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
let newProjectSceneFileOriginalName = '';
let newProjectSceneFilePath = '';
let newProjectRootFolder = '';
let pendingChatResolve = null;
let reviewZoom = 100;
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
const PROJECT_AUTOSAVE_DEBOUNCE_MS = 1000;
const MAX_PROJECT_SCENE_COUNT = 10000;
const INTER_SCENE_BREATHER_MS = 10000;
let projectAutosaveTimer = null;
let projectAutosaveRevision = 0;
let projectAutosaveSavedRevision = 0;
let projectAutosaveInFlight = null;
let projectAutosaveLastError = '';
let veoupAutomationInFlight = false;
let lastMissingAssetCount = 0;
let activePipelineRunId = '';
let cancelledPipelineRunId = '';
let stopPipelineInFlight = false;
let pendingManualRecoveryResetSceneIds = new Set();
const pipelineTimers = new Map();
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

function isKeyframeMotionPromptOnlyModeEnabled() {
  return Boolean(
    keyframeMotionOnlyToggle?.checked
  );
}

function applyPipelineModeSettings(settings = {}) {
  const enabled = Boolean(settings.keyframeMotionPromptOnly);
  if (keyframeMotionOnlyToggle) keyframeMotionOnlyToggle.checked = enabled;
  if (project) project.keyframeMotionPromptOnly = enabled;
}

function getContinuityReferenceSettings() {
  const maxKeyFrames = Math.max(0, Math.min(3, Number(continuityMaxKeyframesSelect?.value || 3) || 3));
  return {
    enabled: continuityRefsToggle?.checked !== false,
    includeLastFrame: true,
    maxKeyFrames,
    sendToChatGPT: continuityChatgptToggle?.checked !== false,
  };
}

function applyContinuityReferenceSettings(settings = {}) {
  if (continuityRefsToggle) continuityRefsToggle.checked = settings.enabled !== false;
  if (continuityMaxKeyframesSelect) continuityMaxKeyframesSelect.value = String(Math.max(0, Math.min(3, Number(settings.maxKeyFrames ?? 3) || 3)));
  if (continuityChatgptToggle) continuityChatgptToggle.checked = settings.sendToChatGPT !== false;
}

function getChatGptStabilitySettings() {
  const projectSceneCount = getProjectTargetSceneDefault();
  return {
    autoRotateConversation: false,
    autoReload: chatGptAutoReloadToggle?.checked !== false,
    autoResume: chatGptAutoResumeToggle?.checked !== false,
    retryLimit: clamp(Number(chatGptRetryLimitInput?.value ?? DEFAULT_CHATGPT_RETRY_LIMIT) || DEFAULT_CHATGPT_RETRY_LIMIT, 1, 5),
    targetSceneCount: clamp(Number(customTargetScenesInput?.value ?? projectSceneCount) || projectSceneCount, 1, MAX_PROJECT_SCENE_COUNT),
  };
}

function applyChatGptStabilitySettings(settings = {}) {
  if (chatGptAutoReloadToggle) chatGptAutoReloadToggle.checked = settings.autoReload !== false;
  if (chatGptAutoResumeToggle) chatGptAutoResumeToggle.checked = settings.autoResume !== false;
  if (chatGptRetryLimitInput) chatGptRetryLimitInput.value = String(clamp(Number(settings.retryLimit ?? DEFAULT_CHATGPT_RETRY_LIMIT) || DEFAULT_CHATGPT_RETRY_LIMIT, 1, 5));
  if (customTargetScenesInput) {
    const projectSceneCount = getProjectTargetSceneDefault();
    customTargetScenesInput.value = String(clamp(Number(settings.targetSceneCount ?? projectSceneCount) || projectSceneCount, 1, MAX_PROJECT_SCENE_COUNT));
    targetSceneCount = clamp(Number(settings.targetSceneCount ?? projectSceneCount) || projectSceneCount, 1, MAX_PROJECT_SCENE_COUNT);
  }
}

function getProjectTargetSceneDefault() {
  return clamp(Number(project?.scenes?.length || 0) || 1, 1, MAX_PROJECT_SCENE_COUNT);
}

function syncTargetSceneCountToProjectDefault() {
  const projectSceneCount = getProjectTargetSceneDefault();
  targetSceneCount = projectSceneCount;
  if (customTargetScenesInput) customTargetScenesInput.value = String(projectSceneCount);
}

function buildRecentScenesForHydration(currentSceneId = 0, limit = 20) {
  if (!project?.scenes?.length) return [];
  const currentId = Number(currentSceneId || 0);
  const scenes = project.scenes
    .filter((scene) => !currentId || Number(scene?.id || 0) <= currentId)
    .slice(-Math.max(1, Number(limit) || 20))
    .map((scene) => ({
      id: scene.id,
      text: scene.original || scene.sceneText || '',
    }))
    .filter((scene) => String(scene.text || '').trim());
  return scenes;
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

function createPipelineRunId() {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getActivePipelineRunId() {
  return activePipelineRunId || '';
}

function isPipelineRunActive(runId = getActivePipelineRunId()) {
  return Boolean(runId && activePipelineRunId === runId && cancelledPipelineRunId !== runId && !paused);
}

function makePipelineCancelledError(runId = getActivePipelineRunId()) {
  const error = new Error(`PIPELINE_CANCELLED:${runId || 'unknown'}`);
  error.code = 'PIPELINE_CANCELLED';
  error.pipelineRunId = runId;
  return error;
}

function assertPipelineRunActive(runId = getActivePipelineRunId()) {
  if (!isPipelineRunActive(runId)) throw makePipelineCancelledError(runId);
}

function clearPipelineTimers(runId = '') {
  for (const [timerId, meta] of pipelineTimers.entries()) {
    if (!runId || meta.runId === runId) {
      clearTimeout(timerId);
      pipelineTimers.delete(timerId);
      meta.reject?.(makePipelineCancelledError(meta.runId));
    }
  }
}

function hasPipelineTimers(runId = '') {
  for (const meta of pipelineTimers.values()) {
    if (!runId || meta.runId === runId) return true;
  }
  return false;
}

function pipelineDelay(ms, runId = getActivePipelineRunId()) {
  if (!runId) return new Promise((resolve) => setTimeout(resolve, ms));
  assertPipelineRunActive(runId);
  return new Promise((resolve, reject) => {
    const timerId = setTimeout(() => {
      pipelineTimers.delete(timerId);
      if (!isPipelineRunActive(runId)) {
        reject(makePipelineCancelledError(runId));
        return;
      }
      resolve();
    }, ms);
    pipelineTimers.set(timerId, { runId, reject });
  });
}

async function waitForInterSceneBreather(runId, sceneId) {
  assertPipelineRunActive(runId);
  safeAddPipelineLog(
    'renderer',
    'running',
    `Scene ${sceneId}: inter-scene breather started (${INTER_SCENE_BREATHER_MS}ms).`
  );
  await pipelineDelay(INTER_SCENE_BREATHER_MS, runId);
  assertPipelineRunActive(runId);
  safeAddPipelineLog(
    'renderer',
    'ok',
    `Scene ${sceneId}: inter-scene breather completed; continuing pipeline.`
  );
}

function sleep(ms) {
  return pipelineDelay(ms);
}

function schedulePipelineTimer(callback, delay = 0, runId = getActivePipelineRunId()) {
  if (runId) assertPipelineRunActive(runId);
  const timerId = setTimeout(async () => {
    pipelineTimers.delete(timerId);
    if (runId && !isPipelineRunActive(runId)) return;
    try {
      await callback();
    } catch (error) {
      if (isPipelineCancelledError(error)) return;
      const message = error?.message || String(error);
      paused = true;
      isRunning = false;
      autoContinuing = false;
      projectRuntime = {
        ...projectRuntime,
        lastErrorClassification: 'scheduled-continuation-failed',
        lastAction: 'scheduled-continuation-failed',
        waitingForUserStart: true,
      };
      safeAddPipelineLog(
        'renderer',
        'error',
        `Scheduled pipeline continuation failed: ${message}`
      );
      setStatus(`Pipeline continuation dừng: ${message}`, 'error');
      finishPipelineRun(runId);
      persist({ immediateAutosave: true, reason: 'scheduled-continuation-failed' });
      render();
    }
  }, delay);
  pipelineTimers.set(timerId, { runId, reject: null });
  return timerId;
}

function updateStopPipelineControls() {
  const stopping = Boolean(stopPipelineInFlight);
  const running = Boolean(isRunning || (activePipelineRunId && cancelledPipelineRunId !== activePipelineRunId));
  const disabled = !running || stopping;
  if (stopPipelineBtn) stopPipelineBtn.disabled = disabled;
  if (stopPipelineInlineBtn) stopPipelineInlineBtn.disabled = disabled;
}

function beginPipelineRun() {
  activePipelineRunId = createPipelineRunId();
  cancelledPipelineRunId = '';
  stopPipelineInFlight = false;
  projectRuntime = {
    ...projectRuntime,
    activePipelineRunId,
    cancelledPipelineRunId: '',
    waitingForUserStart: false,
  };
  window.__vidoraActivePipelineRunId = activePipelineRunId;
  updateStopPipelineControls();
  return activePipelineRunId;
}

function finishPipelineRun(runId = getActivePipelineRunId()) {
  if (!runId || activePipelineRunId !== runId) return;
  clearPipelineTimers(runId);
  activePipelineRunId = '';
  stopPipelineInFlight = false;
  window.__vidoraActivePipelineRunId = '';
  projectRuntime = { ...projectRuntime, activePipelineRunId: '', waitingForUserStart: true };
  setRunning(false);
  updateStopPipelineControls();
}

function isPipelineCancelledError(error) {
  return error?.code === 'PIPELINE_CANCELLED' || /^PIPELINE_CANCELLED:/i.test(String(error?.message || error || ''));
}

async function stopPipelineFromClick(event) {
  event?.preventDefault?.();
  const runId = getActivePipelineRunId();
  if (!runId || stopPipelineInFlight) return;
  stopPipelineInFlight = true;
  cancelledPipelineRunId = runId;
  paused = true;
  isRunning = false;
  autoContinuing = false;
  veoupAutomationInFlight = false;
  activeBatchIds = [];
  pendingManualRecoveryResetSceneIds.clear();
  clearPipelineTimers(runId);
  window.isVidoraPipelineBusy = false;
  window.__vidoraCancelledPipelineRunId = runId;
  projectRuntime = {
    ...projectRuntime,
    activePipelineRunId: '',
    cancelledPipelineRunId: runId,
    currentStage: 'idle',
    currentBatchIndex: null,
    currentSceneId: null,
    lastAction: 'user-stop',
    waitingForUserStart: true,
  };
  updateStopPipelineControls();
  setRunning(false);
  try {
    await window.videoPlannerAPI?.stopPipeline?.({ runId, reason: 'user-stop' });
  } catch (error) {
    safeAddPipelineLog?.('renderer', 'error', `pipeline:stop failed: ${error?.message || error}`);
  }
  safeAddPipelineLog?.('renderer', 'error', 'Pipeline đã được người dùng dừng hoàn toàn.', { runId });
  setStatus('Pipeline đã được người dùng dừng hoàn toàn.', 'ok');
  persist();
  render();
  finishPipelineRun(runId);
}

function queueAutoContinue(delay = 350) {
  if (autoContinuing) return;
  const runId = getActivePipelineRunId();
  if (runId && !isPipelineRunActive(runId)) return;
  autoContinuing = true;
  schedulePipelineTimer(async () => {
    try {
      try {
        if (runId) assertPipelineRunActive(runId);
        await autoRunRoute();
      } catch (error) {
        if (isPipelineCancelledError(error)) return;
        const message = error?.message || String(error);
        paused = true;
        setStatus(`Auto continue lỗi: ${message}`, 'error');
        persist();
        render();
      }
    } finally {
      autoContinuing = false;
    }
  }, delay, runId);
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
    sourceSceneFileName: newProjectSceneFileOriginalName || 'scene.txt',
    sourceSceneFilePath: newProjectSceneFilePath || '',
    sourceSceneText: script,
    chatContextTitle: projectNameInput.value.trim() || 'Untitled project',
    scenes,
    batchSize: clamp(Number(batchSizeInput.value) || 10, 1, 10),
    durationSec: applySceneDurationValue(durationInput.value),
    keyframeMotionPromptOnly: isKeyframeMotionPromptOnlyModeEnabled(),
    continuityReferences: getContinuityReferenceSettings(),
    createdAt: new Date().toISOString(),
  };
  syncTargetSceneCountToProjectDefault();
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
  const normalized = String(script || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  const formattedSceneHeaderRegex = /^\s*(?:#{1,6}\s*)?(?:SCENE|Scene|scene|CẢNH|Cảnh|cảnh)\s*0*\d{1,4}\s*(?:[:：.\-–—])?\s+.*$/gm;
  let matches = [...normalized.matchAll(formattedSceneHeaderRegex)];
  if (!matches.length) {
    const looseSceneHeaderRegex = /^\s*(?:#{1,6}\s*)?(?:SCENE|Scene|scene|CẢNH|Cảnh|cảnh)\s*0*\d{1,4}\s*(?:[:：.\-–—])?\s*$/gm;
    matches = [...normalized.matchAll(looseSceneHeaderRegex)];
  }

  if (matches.length >= 1) {
    return matches.map((match, index) => {
      const start = match.index;
      const end = matches[index + 1]?.index ?? normalized.length;
      return normalized.slice(start, end).trim();
    }).filter((part) => {
      if (!part) return false;
      return /^(?:#{1,6}\s*)?(?:SCENE|Scene|scene|CẢNH|Cảnh|cảnh)\s*0*\d{1,4}\b/.test(part);
    });
  }

  return normalized.split(/\n\s*\n+/).map((part) => part.trim()).filter(Boolean);
}

async function runNextBatch({ regenerate = false } = {}) {
  if (!project || paused) return;
  setRunning(true);
  const candidates = regenerate && activeBatchIds.length
    ? project.scenes.filter((scene) => activeBatchIds.includes(scene.id))
    : project.scenes.filter((scene) => !sceneHasVideoOutput(scene) && scene.status !== 'skipped');
  const safeBatchSize = clamp(Number(project.batchSize || 10), 1, 10);
  const batch = candidates.slice(0, safeBatchSize);
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
      scene.imagePrompt = scene.imagePrompt || scene.original || buildImagePrompt(scene);
      scene.motionPrompt = scene.motionPrompt || '';
      scene.status = scene.imagePath ? 'image_done' : 'approved';
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
  const result = await window.videoPlannerAPI.ensureProjectSceneFolders({ outputFolder, scenes: project.scenes, inspectOnly: repairFromDisk }).catch(() => null);
  if (repairFromDisk && result?.records?.length) {
    result.records.forEach((record) => {
      const scene = project.scenes.find((item) => String(item.id) === String(record.sceneId) || String(item.sceneId) === String(record.sceneId));
      if (!scene) return;
      const keyframeValid = record.keyframeExists === true && record.keyframeValid === true;
      const motionPromptValid = record.motionPromptExists === true && record.motionPromptValid === true;
      scene.assetStatCheckedAtMs = Number(record.assetStatCheckedAtMs || Date.now());
      scene.keyframeFileExists = record.keyframeExists === true;
      scene.keyframeFileValid = record.keyframeValid === true;
      scene.keyframeValidationError = record.keyframeValidationError || '';
      scene.motionPromptFileExists = record.motionPromptExists === true;
      scene.motionPromptFileValid = record.motionPromptValid === true;
      scene.motionPromptValidationError = record.motionPromptValidationError || '';
      if (keyframeValid) {
        scene.imagePath = record.keyframePath;
        scene.keyframeFileMtimeMs = record.keyframeMtimeMs || 0;
      } else {
        scene.imagePath = '';
        scene.imageDataUrl = '';
        scene.keyframeFileMtimeMs = 0;
      }
      if (motionPromptValid) {
        scene.motionPromptPath = record.motionPromptPath;
        scene.motionPromptOutputPath = record.motionPromptPath;
      } else {
        scene.motionPromptPath = '';
        scene.motionPromptOutputPath = '';
      }
      if (record.videoExists) {
        scene.videoPath = record.videoPath;
        scene.lastFramePath = record.lastFrameExists ? record.lastFramePath : scene.lastFramePath || '';
        scene.videoFileExists = true;
        scene.videoFileMtimeMs = record.videoMtimeMs || 0;
        scene.outputStatCheckedAtMs = Date.now();
        scene.videoValidated = true;
        scene.status = 'video_done';
        scene.completionStatus = 'complete';
        scene.progressStep = 'merge';
        scene.reviewType = '';
      } else {
        scene.videoPath = '';
        scene.videoFileExists = false;
        scene.videoFileMtimeMs = 0;
        scene.outputStatCheckedAtMs = Date.now();
        scene.videoValidated = false;
        scene.lastFramePath = '';
        if (keyframeValid && isKeyframeMotionPromptOnlyModeEnabled() && motionPromptValid) {
          scene.status = 'done';
          scene.completionStatus = 'keyframe_motion_complete';
          scene.videoStatus = 'skipped-keyframe-motion-only';
          scene.progressStep = 'complete';
          scene.reviewType = '';
        } else if (keyframeValid) {
          scene.status = 'image_done';
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
    return scene.status !== 'done' && !sceneHasVideoOutput(scene);
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
    if (nextScene) {
      const safeBatchSize = clamp(Number(project?.batchSize || 10), 1, 10);
      const nextBatch = (project?.scenes || [])
        .filter((scene) => Number(scene.id || 0) >= Number(nextScene.id || 0) && !sceneHasVideoOutput(scene) && scene.status !== 'skipped')
        .map((scene) => Number(scene.id || 0))
        .slice(0, safeBatchSize);
      activeBatchIds = nextBatch.length ? nextBatch : [nextScene.id];
    }
  }
  if (!activeBatchIds.length) {
    setStatus('Không có scene chưa hoàn thành. Đang quét project và khởi chạy VeoUp...', 'running');
    const res = await window.videoPlannerAPI?.scanProjectAndRunVeoUp?.({
      projectDir: outputFolder,
      expectedSceneCount: project.scenes.length,
      expectedSceneIds: project.scenes.map((scene) => Number(scene.id || scene.sceneId)).filter(Number.isInteger),
      projectName: project.name || '',
      trigger: 'workflow-recovery',
      autoStartVideoGeneration: true,
      previewStartButtonOnly: Boolean(veoupPreviewStartOnlyToggle?.checked)
    });
    if (res && res.ok) {
      setStatus(`Đã ${res.status === 'previewed' ? 'preview' : 'gửi'} batch VeoUp: ${res.imageCount} scene.`, 'ok');
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

  await window.videoPlannerAPI.openWebLogin('chatgpt', accountSelect.value);
  setStatus('Đã mở cửa sổ ChatGPT để đăng nhập. Sau khi login xong có thể giữ cửa sổ hoặc đóng lại, session vẫn được lưu.', 'ok');
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

async function openProjectPrepromptFolderFlow() {
  if (!outputFolder) {
    setStatus('Hay tao hoac mo project truoc khi mo thu muc preprompt.', 'error');
    alert('Hay tao hoac mo project truoc khi mo thu muc preprompt.');
    return;
  }
  if (!window.videoPlannerAPI?.openProjectPrepromptFolder) {
    setStatus('Bridge prompt request 1 khong kha dung. Hay restart app.', 'error');
    return;
  }

  setStatus('Dang mo thu muc preprompt...', 'running');
  try {
    const result = await window.videoPlannerAPI.openProjectPrepromptFolder(outputFolder);
    setStatus(result?.ok ? 'Da mo thu muc preprompt.' : `Mo thu muc preprompt that bai: ${result?.error || 'Loi khong xac dinh'}`, result?.ok ? 'ok' : 'error');
  } catch (err) {
    setStatus(`Loi mo thu muc preprompt: ${err.message}`, 'error');
    console.error(err);
  }
}

async function checkSelectedWebLogin() {
  const webProvider = getSelectedWebProvider();
  const state = await window.videoPlannerAPI.checkWebLogin(webProvider, {});
  webSessionStatus.textContent = state.loggedIn
    ? `ChatGPT / ${accountSelect.value}: đã đăng nhập.`
    : `ChatGPT / ${accountSelect.value}: chưa đăng nhập, cửa sổ login đã mở.`;
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
  setStatus('Đang gửi batch qua ChatGPT web và lưu kết quả...', 'running');

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
  return false;
}

function requireChatGptChatChoiceBeforeRun(scene) {
  return false;
}


function getSceneVideoPathValue(scene) {
  return scene?.videoPath || scene?.videoUrl || scene?.finalVideoPath || scene?.outputVideoPath || '';
}

function getSceneKeyframePathValue(scene) {
  return scene?.imagePath || scene?.imageUrl || scene?.keyframePath || scene?.keyframeUrl || '';
}

function hasValidSceneOutputPath(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

const SCENE_OUTPUT_STAT_TTL_MS = 5 * 60 * 1000;
const SCENE_ASSET_AUDIT_TTL_MS = 5 * 60 * 1000;

function sceneHasRequiredOutputForCurrentMode(scene) {
  try {
    if (isKeyframeMotionPromptOnlyModeEnabled()) {
      const isMarkedComplete = scene?.completionStatus === 'keyframe_motion_complete' ||
                               scene?.completionStatus === 'complete' ||
                               scene?.status === 'done';
      const checkedAt = Number(scene?.assetStatCheckedAtMs || 0);
      const timestampIsRecent = checkedAt > 0 && Date.now() - checkedAt <= SCENE_ASSET_AUDIT_TTL_MS;
      return Boolean(
        scene &&
        hasValidSceneOutputPath(scene.imagePath) &&
        scene.keyframeFileExists === true &&
        scene.keyframeFileValid === true &&
        hasValidSceneOutputPath(scene.motionPromptPath) &&
        scene.motionPromptFileExists === true &&
        scene.motionPromptFileValid === true &&
        (timestampIsRecent || isMarkedComplete)
      );
    }
    const isMarkedComplete = scene?.completionStatus === 'complete' || scene?.status === 'video_done';
    const checkedAt = Number(scene?.outputStatCheckedAtMs || scene?.videoFileCheckedAtMs || 0);
    const timestampIsRecent = checkedAt > 0 && Date.now() - checkedAt <= SCENE_OUTPUT_STAT_TTL_MS;
    return Boolean(scene && hasValidSceneOutputPath(scene.videoPath) && scene.videoFileExists === true && (timestampIsRecent || isMarkedComplete));
  } catch (_error) {
    return false;
  }
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

function sceneHasVideoOutput(scene) {
  return sceneHasRequiredOutputForCurrentMode(scene);
}

function findFirstSceneMissingVideo() {
  if (!project?.scenes?.length) return null;

  return [...project.scenes]
    .sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
    .find((scene) => !sceneHasVideoOutput(scene)) || null;
}

function forceResumeFirstIncompleteSceneIfNeeded() {
  const firstIncomplete = findFirstSceneMissingVideo();
  if (!firstIncomplete) return false;

  const id = Number(firstIncomplete.id || 0);
  if (!id) return false;

  const safeBatchSize = clamp(Number(project?.batchSize || 10), 1, 10);
  const nextBatch = (project?.scenes || [])
    .filter((scene) => Number(scene.id || 0) >= id && !sceneHasVideoOutput(scene) && scene.status !== 'skipped')
    .map((scene) => Number(scene.id || 0))
    .slice(0, safeBatchSize);

  const targetBatch = nextBatch.length ? nextBatch : [id];
  const currentIds = Array.isArray(activeBatchIds) ? activeBatchIds.map(Number) : [];

  if (
    currentIds.length === targetBatch.length &&
    currentIds.every((val, idx) => val === targetBatch[idx])
  ) {
    return false;
  }

  activeBatchIds = targetBatch;

  if (isKeyframeMotionPromptOnlyModeEnabled()) {
    firstIncomplete.status = firstIncomplete.imagePath ? 'motion_prompt_pending' : 'image_pending';
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
    `Resume guard: scene ${id} missing required on-disk output; forcing pipeline back to this scene before continuing.`,
    { activeBatchIds }
  );

  return true;
}








function getCompletedScenesCount() {
  if (!project?.scenes) return 0;
  return project.scenes.filter((scene) => {
    if (scene.status === 'skipped') return false;
    return sceneHasVideoOutput(scene);
  }).length;
}

function getNextBatchForSegment(_doneSceneId = 0) {
  if (!project?.scenes?.length) return [];

  const sorted = [...project.scenes].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  const next = sorted.find((scene) => {
    const id = Number(scene.id || 0);
    if (!id) return false;
    if (scene.status === 'skipped') return false;
    return !sceneHasVideoOutput(scene);
  });

  if (!next?.id) return [];

  const batchSize = clamp(Number(project.batchSize || 10), 1, 10);
  return sorted
    .map((scene) => Number(scene.id || 0))
    .filter((id) => id >= Number(next.id || 0))
    .slice(0, batchSize);
}





async function runFullPipeline() {
  const runId = getActivePipelineRunId() || beginPipelineRun();
  assertPipelineRunActive(runId);
  ensureChatChoiceFields();
  if (!project || !activeBatchIds.length) return;
  if (!outputFolder) {
    await chooseOutputFolder();
    if (!outputFolder) return;
  }
  const startDiskAudit = await syncProjectSceneFolders({ repairFromDisk: true });
  assertPipelineRunActive(runId);
  if (!startDiskAudit?.ok || !Array.isArray(startDiskAudit.records) || startDiskAudit.records.length !== project.scenes.length) {
    paused = true;
    setRunning(false);
    safeAddPipelineLog('renderer', 'error', 'Disk audit failed before Start/Resume; pipeline stopped before touching ChatGPT.', {
      expectedSceneCount: project.scenes.length,
      auditedSceneCount: Array.isArray(startDiskAudit?.records) ? startDiskAudit.records.length : 0,
      error: startDiskAudit?.error || 'scene-output-audit-unavailable',
    });
    setStatus('Không thể xác minh output scene trên ổ đĩa. Pipeline đã dừng an toàn trước khi gửi prompt.', 'error');
    return;
  }
  forceResumeFirstIncompleteSceneIfNeeded();
  const schedulerAuditSceneIds = new Set(
    (activeBatchIds || []).flatMap((id) => [Number(id) - 2, Number(id) - 1, Number(id), Number(id) + 1])
      .filter((id) => Number.isInteger(id) && id > 0),
  );
  const schedulerAuditRecords = startDiskAudit.records
    .filter((record) => schedulerAuditSceneIds.has(Number(record.sceneId || 0)))
    .map((record) => ({
      sceneId: Number(record.sceneId || 0),
      keyframeExists: record.keyframeExists === true,
      keyframeValid: record.keyframeValid === true,
      keyframeValidationError: record.keyframeValidationError || '',
      motionPromptExists: record.motionPromptExists === true,
      motionPromptValid: record.motionPromptValid === true,
      motionPromptValidationError: record.motionPromptValidationError || '',
      videoExists: record.videoExists === true,
    }));
  safeAddPipelineLog(
    'renderer',
    'running',
    `Disk scheduler audit selected scene ${activeBatchIds[0] || 'none'} after checking required outputs.`,
    {
      mode: isKeyframeMotionPromptOnlyModeEnabled() ? 'keyframe-motion-only' : 'full-pipeline',
      selectedSceneIds: [...activeBatchIds],
      nearbySceneOutputs: schedulerAuditRecords,
    },
  );
  if (!window.videoPlannerAPI?.runScenePipeline) {
    setStatus('Bridge pipeline chưa sẵn sàng. Hãy restart app.', 'error');
    return;
  }

  const runnableStatuses = new Set(['pending', 'waiting_review', 'approved', 'image_pending', 'image_generating', 'keyframe_pending', 'keyframe_generating', 'image_done', 'image_generated', 'motion_prompt_pending', 'motion_prompt_generated', 'video_pending', 'video_generating', 'error', 'failed']);
  const scenesToRun = project.scenes.filter((item) => {
    const isSelected = activeBatchIds.includes(item.id);
    if (!isSelected) return false;
    if (sceneHasVideoOutput(item)) return false;
    return runnableStatuses.has(item.status) || ['queued', 'done', 'complete', 'video_done', 'keyframe_motion_complete'].includes(item.status);
  });
  if (!scenesToRun.length) {
    const decision = getNextResumeAction({ project, runtime: { ...projectRuntime, activeBatchIds } });
    if (decision.action === 'batch_complete') {
      setStatus('Batch complete: all active scenes already have videos.', 'ok');
      render();
      return;
    }



    setStatus('Resume stopped: no runnable scene in current batch.', 'error');
    render();
    return;
  }

  autoRunBtn.disabled = true;
  const videoPlatform = getSelectedVideoPlatform();
  const keyframeMotionPromptOnly = isKeyframeMotionPromptOnlyModeEnabled();
  setStatus(
    keyframeMotionPromptOnly
      ? 'Running pipeline: ChatGPT keyframe -> ChatGPT motion prompt; VeoUp skipped...'
      : 'Running full pipeline: ChatGPT keyframe -> ChatGPT motion prompt -> VeoUp video -> validate by scene...',
    'running'
  );

  for (let i = 0; i < scenesToRun.length; i++) {
    assertPipelineRunActive(runId);
    const scene = scenesToRun[i];
    let manualRecoveryReset = false;

    // Preceding Video Validation Guard & Hard Rollback Loop (Scene N > 1)
    if (scene.id > 1) {
      if (!keyframeMotionPromptOnly) {
        const separator = outputFolder.includes('\\') ? '\\' : '/';
        const prevSceneFolderToken = `scene_${String(scene.id - 1).padStart(3, '0')}`;
        const prevVideoPath = `${outputFolder}${separator}${prevSceneFolderToken}${separator}${prevSceneFolderToken}_video.mp4`;
        let hasValidVideo = false;
        try {
          const videoExists = await window.videoPlannerAPI.assetExists(prevVideoPath);
          if (videoExists) {
            hasValidVideo = true;
          }
        } catch (err) {
          hasValidVideo = false;
        }
        if (hasValidVideo) {
          try {
            const prevLastFramePath = `${outputFolder}${separator}${prevSceneFolderToken}${separator}${prevSceneFolderToken}_last_frame.png`;
            setStatus(`Đang trích xuất frame cuối của scene trước làm tham chiếu...`, 'running');
            await window.videoPlannerAPI.extractLastFrameToPath(prevVideoPath, prevLastFramePath, { runId });
            safeAddPipelineLog('renderer', 'ok', `Đã trích xuất và lưu frame cuối continuity: ${prevLastFramePath}`);
          } catch (err) {
            safeAddPipelineLog('renderer', 'error', `Trích xuất frame cuối thất bại (video có thể lỗi): ${err.message}`);
            hasValidVideo = false;
          }
        }
        if (!hasValidVideo) {
          safeAddPipelineLog('renderer', 'error', `Chặn chạy scene ${scene.id} do video scene trước (${scene.id - 1}) bị thiếu hoặc lỗi. Đang thực hiện rollback...`);

          const prevScene = project.scenes.find((s) => s.id === scene.id - 1);
          if (prevScene) {
            prevScene.videoPath = '';
            prevScene.videoUrl = '';
            prevScene.videoValidated = false;
            prevScene.status = 'approved';
            prevScene.reviewType = '';
          }

          const nextBatchIds = activeBatchIds.filter((id) => id >= scene.id - 1);
          if (!nextBatchIds.includes(scene.id - 1)) {
            nextBatchIds.unshift(scene.id - 1);
          }
          activeBatchIds = nextBatchIds.sort((a, b) => a - b);

          paused = false;
          isRunning = true;
          window.isVidoraPipelineBusy = false;
          persist();
          render();

          assertPipelineRunActive(runId);
          return runFullPipeline();
        }
      }
    }

    const blockingPreviousScene = keyframeMotionPromptOnly ? null : shouldBlockSceneBecausePreviousVideoMissing(scene);
    if (blockingPreviousScene) {
      paused = true;
      isRunning = false;
      autoContinuing = false;
      setStatus(
        `Khong chay scene ${scene.id}: scene ${blockingPreviousScene.id} chua co video hoan chinh.`,
        'error'
      );
      safeAddPipelineLog(
        'renderer',
        'error',
        `Khong chay scene ke tiep vi scene truoc chua co video hoan chinh: scene ${blockingPreviousScene.id}`
      );
      persist();
      render();
      return;
    }
    // if (requireChatGptChatChoiceBeforeRun(scene)) return;
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
      const nextSceneForPrefetch = project.scenes.find((item) => Number(item?.id || 0) === Number(scene.id || 0) + 1) || null;
      const nextScenePrefetch = nextSceneForPrefetch
        ? {
            sceneId: nextSceneForPrefetch.id,
            imagePrompt: nextSceneForPrefetch.imagePrompt || nextSceneForPrefetch.original || buildImagePrompt(nextSceneForPrefetch),
            sceneText: nextSceneForPrefetch.original || '',
            imagePath: nextSceneForPrefetch.imagePath || '',
          }
        : null;
      scene.progressStep = scene.imagePath ? 'motion' : 'image';
      render();

      manualRecoveryReset = pendingManualRecoveryResetSceneIds.delete(scene.id);
      if (manualRecoveryReset) {
        scene.recoveryLimitReached = false;
        scene.pipelineRetryCount = 0;
        scene.error = '';
        projectRuntime = {
          ...projectRuntime,
          lastErrorClassification: null,
          lastAction: 'manual-recovery-reset',
          waitingForUserStart: false,
        };
        safeAddPipelineLog(
          'renderer',
          'running',
          `Scene ${scene.id}: mở lại chu kỳ phục hồi thủ công, giữ nguyên keyframe hợp lệ.`
        );
        persist({ immediateAutosave: true, reason: 'manual-recovery-reset' });
      }


      assertPipelineRunActive(runId);
      const result = await window.videoPlannerAPI.runScenePipeline({
        runId,
        targetSceneCount,
projectName: project.name,
        outputFolder,
        sceneId: scene.id,
        imagePrompt,
        motionPrompt,
        imagePath: scene.imagePath || '',
        forceRegenerateImage: Boolean(scene.forceRegenerateImage),
        manualRecoveryReset,
        videoProvider: 'veoup',
        keyframeMotionPromptOnly,
        videoConfig: getVideoProviderConfig(),
        imageProvider: getImageGenerationSettings(),
        continuityReferences: getContinuityReferenceSettings(),
        chatContextTitle: project.chatContextTitle || '',
        pendingChatRenameTitle: project.pendingChatRenameTitle || '',
        scriptText: storyInput?.value?.trim() || project?.story || '',
        sourceSceneFileName: project?.sourceSceneFileName || '',
        sourceSceneFilePath: project?.sourceSceneFilePath || '',
        sourceSceneText: project?.sourceSceneText || scriptInput?.value?.trim() || '',
        sceneText: scene.original || '',
        recentScenes: buildRecentScenesForHydration(scene.id, 20),
        nextScenePrefetch,
      });
      assertPipelineRunActive(runId);



      const resultSceneId = Number(result?.sceneId || scene.id || 0);
      const sceneFolderToken = `scene_${String(resultSceneId || scene.id).padStart(3, '0')}`;
      const resultImagePath = result?.imagePath || '';
      const resultVideoPath = result?.videoPath || '';
      const resultLastFramePath = result?.lastFramePath || '';
      safeAddPipelineLog('renderer', 'running', 'Renderer run-scene raw result', {
        ok: result?.ok,
        sceneId: result?.sceneId,
        videoPath: resultVideoPath,
        videoValidated: result?.videoValidated,
        lastFramePath: resultLastFramePath,
        sourceVideoPath: result?.sourceVideoPath || result?.sourceDownloadPath || '',
        completionStatus: result?.completionStatus || '',
      });
      const sceneIndexFromProject = project.scenes.findIndex((item, index) => Number(item?.id || index + 1) === resultSceneId);
      const currentScene = sceneIndexFromProject >= 0 ? project.scenes[sceneIndexFromProject] : scene;
      if (sceneIndexFromProject >= 0) scenesToRun[i] = currentScene;
      if (resultImagePath && String(resultImagePath).includes(sceneFolderToken)) {
        currentScene.imagePath = resultImagePath;
        currentScene.imageDataUrl = '';
      }
      if (result?.keyframeMotionPromptOnly === true) {
        currentScene.forceRegenerateImage = false;
        currentScene.imagePrompt = result.imagePromptUsed || currentScene.imagePrompt || imagePrompt;
        currentScene.motionPrompt = result.motionPrompt || currentScene.motionPrompt || '';
        currentScene.motionPromptPath = result.motionPromptPath || currentScene.motionPromptPath || 'motion_prompt.txt';
        currentScene.keyframeOutputPath = result.keyframeOutputPath || currentScene.keyframeOutputPath || '';
        currentScene.motionPromptOutputPath = result.motionPromptOutputPath || currentScene.motionPromptOutputPath || '';
        currentScene.readyForVeoUp = result.readyForVeoUp === true;
        currentScene.videoPath = '';
        currentScene.videoValidated = false;
        currentScene.videoFileExists = false;
        currentScene.videoStatus = result.videoStatus || 'skipped-keyframe-motion-only';
        currentScene.status = 'done';
        currentScene.completionStatus = 'keyframe_motion_complete';
        currentScene.progressStep = 'motion';
        currentScene.reviewType = '';
        currentScene.keyframeFileExists = true;
        currentScene.keyframeFileValid = true;
        currentScene.motionPromptFileExists = true;
        currentScene.motionPromptFileValid = true;
        currentScene.assetStatCheckedAtMs = Date.now();
        currentScene.outputStatCheckedAtMs = Date.now();
        currentScene.updatedAt = new Date().toISOString();
        currentScene.pipeline = compactScenePipelineResult(result);
        persist({ immediateAutosave: true, reason: 'keyframe-motion-complete' });
        render();
        safeAddPipelineLog('renderer', 'ok', `Scene ${currentScene.id}: keyframe + motion prompt complete; VeoUp skipped.`);
        if (!result?.alreadyCompleted) {
          await waitForInterSceneBreather(runId, currentScene.id);
        }
        continue;
      }
      if (resultVideoPath && result?.videoValidated === true && String(resultVideoPath).includes(sceneFolderToken)) {
        currentScene.videoPath = result.videoPath;
        currentScene.videoValidated = true;
        currentScene.lastFramePath = result.lastFramePath || '';
        currentScene.sourceVideoPath = result.sourceVideoPath || result.sourceDownloadPath || currentScene.sourceVideoPath || '';
        currentScene.status = 'video_done';
        currentScene.completionStatus = 'complete';
        currentScene.progressStep = 'merge';
        currentScene.reviewType = '';
        currentScene.updatedAt = new Date().toISOString();
        currentScene.pipeline = compactScenePipelineResult(result);
        persist({ immediateAutosave: true, reason: 'scene-video-complete' });
      }
      safeAddPipelineLog('renderer', 'running', 'Renderer hydrated scene state', {
        sceneId: currentScene?.id,
        videoPath: currentScene?.videoPath || '',
        videoValidated: currentScene?.videoValidated,
        lastFramePath: currentScene?.lastFramePath || '',
        sourceVideoPath: currentScene?.sourceVideoPath || '',
        completionStatus: currentScene?.completionStatus || '',
        status: currentScene?.status || '',
      });
      const resultVideoStat = currentScene.videoPath
        ? await (window.videoPlannerAPI.assetStat
          ? window.videoPlannerAPI.assetStat(currentScene.videoPath)
          : window.videoPlannerAPI.assetExists(currentScene.videoPath).then((exists) => ({ exists })))
          .catch(() => ({ exists: false, mtimeMs: 0, size: 0 }))
        : { exists: false, mtimeMs: 0, size: 0 };
      const resultVideoExists = Boolean(resultVideoStat?.exists);
      currentScene.videoFileExists = resultVideoExists;
      currentScene.videoFileMtimeMs = Number(resultVideoStat?.mtimeMs || 0);
      currentScene.videoFileCheckedAtMs = Date.now();
      currentScene.outputStatCheckedAtMs = currentScene.videoFileCheckedAtMs;
      if (!resultVideoExists) currentScene.videoValidated = false;
      const hasVideoOutput = Boolean(
        result?.ok === true &&
        currentScene.videoValidated === true &&
        resultVideoPath &&
        currentScene.videoPath &&
        resultVideoExists
      );
      safeAddPipelineLog('renderer', 'running', 'Renderer completion gate state', {
        resultOk: result?.ok,
        resultVideoValidated: result?.videoValidated,
        resultVideoPath,
        resultLastFramePath,
        hydratedVideoPath: currentScene.videoPath || '',
        hydratedLastFramePath: currentScene.lastFramePath || '',
        hydratedVideoValidated: currentScene.videoValidated,
        resultVideoExists,
        lastFrameRequired: false,
        hasVideoOutput,
      });

      if (!hasVideoOutput && result?.videoSkipped) {
        currentScene.status = 'skipped';
        currentScene.videoStatus = result.videoStatus || 'veoup-video-failed-skipped';
        currentScene.videoSkipped = true;
        currentScene.videoValidated = false;
        currentScene.completionStatus = 'skipped';
        currentScene.progressStep = 'skipped';
        currentScene.reviewType = '';
        currentScene.error = `VeoUp tao video that bai, da skip scene nay: ${result.videoError || result.videoStatus || 'unknown'}`;
        currentScene.updatedAt = new Date().toISOString();
        currentScene.pipeline = compactScenePipelineResult(result);
        persist();
        render();
        safeAddPipelineLog(
          'renderer',
          'warning',
          `Scene ${currentScene.id}: VeoUp failed; skipped and continuing to next scene.`,
          { videoStatus: result.videoStatus || '', videoError: result.videoError || '' }
        );
        if (!result?.alreadyCompleted) {
          await waitForInterSceneBreather(runId, currentScene.id);
        }
        continue;
      }

      if (!hasVideoOutput) {
        paused = true;
        isRunning = false;
        autoContinuing = false;
        currentScene.status = currentScene.motionPrompt ? 'video_pending' : 'motion_prompt_pending';
        currentScene.progressStep = currentScene.motionPrompt ? 'video' : 'motion';
        currentScene.error = 'Scene này chưa có motion/video hoàn chỉnh nên đã chặn chạy scene kế tiếp.';
        persist();
        render();
        setStatus(`Scene ${currentScene.id} chưa có video hoàn chỉnh. Đã dừng để tránh nhảy sang scene kế tiếp.`, 'error');
        return;
      }

      currentScene.forceRegenerateImage = false;
      currentScene.imagePrompt = result.imagePromptUsed || currentScene.imagePrompt || imagePrompt;
      if (result.motionPrompt) {
        currentScene.motionPrompt = result.motionPrompt;
      }
      currentScene.pipeline = compactScenePipelineResult(result);
      currentScene.imagePath = resultImagePath && String(resultImagePath).includes(sceneFolderToken) ? resultImagePath : currentScene.imagePath || '';
      currentScene.imageDataUrl = '';
      currentScene.videoPath = resultVideoPath && String(resultVideoPath).includes(sceneFolderToken) ? resultVideoPath : currentScene.videoPath || '';
      currentScene.videoProvider = result.videoProvider || 'veoup';
      currentScene.videoStatus = result.videoStatus || '';
      currentScene.lastFramePath = resultLastFramePath && String(resultLastFramePath).includes(sceneFolderToken) ? resultLastFramePath : '';
      currentScene.videoValidated = Boolean(result.videoValidated && currentScene.videoPath);
      currentScene.videoFileExists = Boolean(currentScene.videoValidated && resultVideoExists);
      currentScene.videoFileMtimeMs = Number(resultVideoStat?.mtimeMs || currentScene.videoFileMtimeMs || 0);
      currentScene.videoFileCheckedAtMs = Date.now();
      currentScene.outputStatCheckedAtMs = currentScene.videoFileCheckedAtMs;
      currentScene.sourceVideoPath = result.sourceVideoPath || result.sourceDownloadPath || currentScene.sourceVideoPath || '';
      currentScene.completionStatus = currentScene.videoValidated ? 'complete' : currentScene.completionStatus || '';
      currentScene.continuityReferencePaths = result.continuityReferencePaths || currentScene.continuityReferencePaths || [];
      currentScene.continuityReferenceSourceScene = result.continuityReferenceSourceScene || currentScene.continuityReferenceSourceScene || null;
      currentScene.generatedContinuityReferences = result.generatedContinuityReferences || currentScene.generatedContinuityReferences || null;
      const resultLoginProvider = parseLoginRequiredError(`${result.videoError || ''}\n${result.videoStatus || ''}`, currentScene);
      if (resultLoginProvider) {
        assertPipelineRunActive(runId);
        await recoverLoginAndRetryScene(resultLoginProvider, currentScene, result.videoError || result.videoStatus || '');
        assertPipelineRunActive(runId);
        i--;
        continue;
      }
      if (result.phase === 'video' && (!result.videoPath || result.videoValidated !== true)) {
        currentScene.status = 'error';
        const detail = result.videoError || result.videoStatus || 'chưa có videoUrl mới để tải về';
        currentScene.progressStep = 'motion';
        currentScene.error = `VeoUp chưa hoàn tất tạo video: ${detail}`;
        currentScene.updatedAt = new Date().toISOString();
        paused = true;
        persist();
        render();
        setStatus(`Scene ${currentScene.id}: ${currentScene.error}`, 'error');
        return;
      }
      if (project.pendingChatRenameTitle && (result.phase === 'image' || result.imagePath)) {
        project.chatContextTitle = project.pendingChatRenameTitle;
        project.pendingChatRenameTitle = '';
      }
      currentScene.progressStep = result.phase === 'video' ? 'motion' : result.phase === 'motion_prompt' ? 'motion_review' : 'image';
      currentScene.reviewType = result.phase === 'video' ? 'video' : result.phase === 'motion_prompt' ? 'prompt' : 'image';
      currentScene.status = 'asset_review';
      currentScene.updatedAt = new Date().toISOString();
      persist();
      render();
      if (shouldSkipReview(currentScene.reviewType) || isRunning || !paused) {
        currentScene.status = currentScene.reviewType === 'video' ? 'video_done' : 'image_done';
        currentScene.progressStep = currentScene.reviewType === 'video' ? 'merge' : 'motion';
        currentScene.reviewType = '';
        currentScene.reviewedAt = new Date().toISOString();
        persist();
        render();
        if (currentScene.status === 'video_done') {
          const completedAfterScene = getCompletedScenesCount();
          if (completedAfterScene >= targetSceneCount) {
            assertPipelineRunActive(runId);
            await mergeAndShowFinalPreview({ scrollIntoView: true });
            assertPipelineRunActive(runId);
          } else {
            safeAddPipelineLog(
              'renderer',
              'running',
              `Scene ${currentScene.id} complete; continuing to next scene before final merge.`
            );
          }
        }
        if (currentScene.status === 'image_done') {
          i--;
        }
        if (!result?.alreadyCompleted) {
          await waitForInterSceneBreather(runId, currentScene.id);
        }
        continue;
      }
      openAssetReview(currentScene.id);
      setStatus(`Scene ${currentScene.id} đã sẵn sàng review. Duyệt xong tool sẽ tự chạy bước tiếp theo.`, 'ok');
      return;
    } catch (error) {
      if (isPipelineCancelledError(error)) {
        paused = true;
        isRunning = false;
        autoContinuing = false;
        render();
        return;
      }
      const message = error.message || String(error);
      if (message.includes('PIPELINE_PAUSED_AFTER_RECOVERY_LIMIT')) {
        scene.error = '';
        scene.status = scene.imagePath ? 'motion_prompt_pending' : 'image_pending';
        scene.progressStep = scene.imagePath ? 'motion' : 'image';
        scene.recoveryLimitReached = false;
        scene.pipelineRetryCount = 0;
        scene.updatedAt = new Date().toISOString();
        paused = false;
        isRunning = true;
        autoContinuing = true;
        pendingManualRecoveryResetSceneIds.add(scene.id);
        projectRuntime = {
          ...projectRuntime,
          active: true,
          waitingForUserStart: false,
          lastErrorClassification: 'automatic_recovery_restart',
          lastAction: 'automatic_restart_after_recovery_limit',
        };
        persist({ immediateAutosave: true, reason: 'pipeline-auto-restart-fallback' });
        render();
        setStatus(`Scene ${scene.id}: tự chạy lại pipeline từ checkpoint sau lỗi phục hồi.`, 'running');
        i--;
        await pipelineDelay(15000, runId);
        continue;
      }
      const loginProvider = parseLoginRequiredError(message, scene);
      if (loginProvider) {
        assertPipelineRunActive(runId);
        await recoverLoginAndRetryScene(loginProvider, scene, message);
        assertPipelineRunActive(runId);
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
        await pipelineDelay(2500, runId);
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

  const finalDiskAudit = await syncProjectSceneFolders({ repairFromDisk: true });
  assertPipelineRunActive(runId);
  if (!finalDiskAudit?.ok || !Array.isArray(finalDiskAudit.records) || finalDiskAudit.records.length !== project.scenes.length) {
    paused = true;
    setRunning(false);
    safeAddPipelineLog('renderer', 'error', 'Disk audit failed before auto-advance; batch cursor was not moved.', {
      expectedSceneCount: project.scenes.length,
      auditedSceneCount: Array.isArray(finalDiskAudit?.records) ? finalDiskAudit.records.length : 0,
      error: finalDiskAudit?.error || 'scene-output-audit-unavailable',
    });
    setStatus('Không thể xác minh output scene trên ổ đĩa. Đã giữ nguyên batch và dừng trước khi tự chuyển scene.', 'error');
    return;
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
      await syncProjectSceneFolders({ repairFromDisk: true });
      persist();
      render();

      safeAddPipelineLog?.(
        'renderer',
        'running',
        `Auto-advancing batch segment to scenes: ${nextBatch.join(', ')}. Completed count: ${totalCompletedScenesCount}/${targetSceneCount}.`
      );
      setStatus(`Tự động chuyển sang batch kế tiếp: Cảnh ${nextBatch[0]}-${nextBatch.at(-1)}`, 'running');

      schedulePipelineTimer(async () => {
        assertPipelineRunActive(runId);
        await runFullPipeline();
      }, 1000, runId);
      return;
    }
  }

  if (shouldSkipReview()) {
    const unfinished = project.scenes.some((scene) => activeBatchIds.includes(scene.id) && !isSceneCompleteForVeoUp(scene));
    if (unfinished) return queueAutoContinue();
    if (!isKeyframeMotionPromptOnlyModeEnabled()) {
      assertPipelineRunActive(runId);
      await mergeAndShowFinalPreview();
    }
  }
  setStatus('Không còn scene cần chạy hoặc đã đạt mục tiêu.', 'ok');

  render();

  assertPipelineRunActive(runId);
  await maybeRunVeoUpAutomationAfterPipeline('runFullPipeline-complete', runId);
}


function isSceneCompleteForVeoUp(scene) {
  if (!scene || scene.status === 'skipped') return false;
  return Boolean(
    (scene.imagePath || scene.keyframeOutputPath) &&
    (scene.motionPrompt || scene.motionPromptPath || scene.motionPromptOutputPath)
  );
}

function isProjectCompleteForVeoUp() {
  return Boolean(project?.scenes?.length) && project.scenes.every(isSceneCompleteForVeoUp);
}

async function maybeRunVeoUpAutomationAfterPipeline(reason = 'pipeline-complete', runId = getActivePipelineRunId()) {
  if (runId) assertPipelineRunActive(runId);
  if (project?.manualChatGPT || (manualChatGptBtn && manualChatGptBtn.getAttribute('aria-pressed') === 'true')) return;
  if (!isKeyframeMotionPromptOnlyModeEnabled()) return;
  if (veoupAutomationInFlight) return;
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

  try {
    const result = await window.videoPlannerAPI.runVeoUpAutomation({
      runId,
      trigger: reason,
      outputFolder,
      projectName: project?.name || projectNameInput?.value || '',
      autoStartVideoGeneration: true,
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
    }).catch((error) => ({ ok: false, error: error.message || String(error), code: error?.code || '' }));

    if (runId && !result?.cancelled) assertPipelineRunActive(runId);
    projectRuntime = { ...projectRuntime, veoupAutomationResult: result };
    persist();
    const successLabel = result?.status === 'previewed'
      ? 'đã preview nút Start'
      : result?.status === 'loaded'
        ? 'đã nạp vào VeoUp'
        : 'đã gửi sang VeoUp';
    safeAddPipelineLog?.(
      'renderer',
      result?.ok ? 'ok' : 'error',
      result?.ok
        ? `VeoUp batch ${successLabel}: ${result.imageCount || 0} ảnh, ${result.promptLineCount || 0} prompt.`
        : `VeoUp batch thất bại: ${result?.error || 'validation mismatch'}`,
      result
    );
    setStatus(
      result?.ok
        ? `NV1/NV2 đã hoàn tất; batch ${successLabel} (${result.imageCount || 0} scene).`
        : `NV1/NV2 đã hoàn tất nhưng batch VeoUp thất bại: ${result?.error || 'validation mismatch'}`,
      result?.ok ? 'ok' : 'error'
    );
  } finally {
    veoupAutomationInFlight = false;
  }
}
function getSelectedWebProvider() {
  return 'chatgpt';
}

function getSelectedVideoPlatform() {
  return {
    value: 'veoup',
    label: 'VeoUp',
  };
}

function getVideoProviderConfig() {
  return {};
}

async function waitForProviderReady(providerValue, label) {
  providerValue = 'chatgpt';
  label = 'ChatGPT';
  const runId = getActivePipelineRunId();
  if (runId) assertPipelineRunActive(runId);
  await openWebLogin(providerValue);
  const startedAt = Date.now();
  let attempt = 0;
  if (loginWaitTitle) loginWaitTitle.textContent = `Đang chờ ${label} sẵn sàng...`;
  if (loginWaitDesc) loginWaitDesc.textContent = `Hãy đăng nhập hoặc vượt qua verify/Cloudflare trong cửa sổ ${label}. Tool sẽ tự quét liên tục và chạy tiếp khi xong.`;
  if (loginWaitDialog && !loginWaitDialog.open) loginWaitDialog.showModal();
  while (!paused) {
    if (runId) assertPipelineRunActive(runId);
    attempt += 1;
    const state = await window.videoPlannerAPI.checkWebLogin('chatgpt', {});
    if (runId) assertPipelineRunActive(runId);
    if (state.loggedIn) {
      if (loginWaitDesc) loginWaitDesc.textContent = `${label} đã sẵn sàng. Đang tiếp tục pipeline...`;
      if (loginWaitDialog?.open) loginWaitDialog.close();
      return state;
    }
    const reason = state.reason || state.title || state.url || 'chưa đăng nhập hoặc đang verify';
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    if (loginWaitDesc) loginWaitDesc.textContent = `${label}: ${reason}. Đã chờ ${elapsed}s, lần quét ${attempt}. Login/verify xong tool tự chạy tiếp.`;
    setStatus(`Đang chờ ${label} login/verify... (${elapsed}s)`, 'running');
    await pipelineDelay(3000, runId);
  }
  throw new Error(`Đã hủy khi đang chờ ${label} login/verify.`);
}

function isRetryableChatGptWorkflowError(message = '') {
  return /CHATGPT_ERROR:|composer-busy|prompt-pasted-but-send-not-ready|send-button-share-image|send-button-wrong-target|image-upload-timeout|image-preview-not-detected|chatgpt-response-timeout|chatgpt-output-choice-required|chatgpt-too-long-conversation|chatgpt-memory-cache-heavy|chatgpt-tab-crashed|network-stall|unsafe-sidebar-modal|unknown-ui-state|pre-extract-wait|chatgpt-image-tool-error|text-only-answer|no-usable-image|real_stall|still loading|Timed out waiting for a complete ChatGPT generated image asset|Timed out waiting|missing-motion-prompt-signals|retryable-bad-motion-text|bad-response-idle|no-assistant-after-send|chatgpt-upload-did-not-create-visible-attachment|chatgpt-attachment-settle-timeout|chatgpt-upload-readiness-timeout|chatgpt-payload-prompt-mismatch|chatgpt-payload-fingerprint-mismatch|chatgpt-same-chat-refresh-failed|prompt-send-ack-without-user-message-ownership|prompt-send-retry-user-message-ownership-not-confirmed|chatgpt-payload-attachment-prepare-failed|chatgpt-payload-recovery-attachment-prepare-failed|ChatGPT sequential upload failed|ChatGPT NV2 keyframe upload failed|NV2 recovery keyframe upload failed|long-run-memory-refresh|Prompt send rejected|chatgpt-stuck-turn-detected/i.test(String(message || ''));
}
function parseLoginRequiredError(message = '', scene = null) {
  const text = String(message || '');
  if (/LOGIN_REQUIRED:chatgpt\b/i.test(text)) return 'chatgpt';
  if (/ChatGPT.*(chưa|login|đăng nhập|sign in|session|verify)|chưa login.*ChatGPT/i.test(text)) return 'chatgpt';
  if (/chưa đăng nhập|chưa login|session.*hết hạn|sign in|sign up|đăng nhập lại/i.test(text)) {
    return scene?.imagePath ? '' : 'chatgpt';
  }
  return '';
}

async function recoverLoginAndRetryScene(providerValue, scene, message = '') {
  providerValue = 'chatgpt';
  const label = 'ChatGPT';
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
    const projectSceneCount = getProjectTargetSceneDefault();
    targetSceneCount = clamp(Number(customTargetScenesInput.value) || projectSceneCount, 1, MAX_PROJECT_SCENE_COUNT);
    customTargetScenesInput.value = String(targetSceneCount);
  }
  const recoverySceneIds = (project?.scenes || [])
    .filter((scene) => scene.recoveryLimitReached === true)
    .map((scene) => scene.id);
  const runtimeRecoveryScene =
    projectRuntime.lastErrorClassification === 'recovery_limit_reached'
      ? findSceneByRuntimeRef(projectRuntime.currentSceneId)
      : null;
  if (runtimeRecoveryScene?.id && !recoverySceneIds.includes(runtimeRecoveryScene.id)) {
    recoverySceneIds.push(runtimeRecoveryScene.id);
  }
  pendingManualRecoveryResetSceneIds = new Set(recoverySceneIds);
  beginPipelineRun();
  setStatus(
    recoverySceneIds.length
      ? `Đang phục hồi scene ${recoverySceneIds[0]} và giữ nguyên keyframe hợp lệ...`
      : 'Đã bấm Start pipeline. Đang khởi động workflow...',
    'running'
  );
  await autoRunRoute();
}
window.startPipelineFromClick = startPipelineFromClick;

async function autoRunRoute() {
  const runId = getActivePipelineRunId() || beginPipelineRun();
  if (!project || !project.scenes?.length) {
    createProject();
    if (!project || !project.scenes?.length) return;
  }
  if (isRunning) return;
  setRunning(true);
  paused = false;
  projectRuntime = { ...projectRuntime, activePipelineRunId: runId, waitingForUserStart: false, resumeMode: 'manual-start' };

  try {
    assertPipelineRunActive(runId);
    if (!outputFolder) {
      setStatus('Bước 1/5: chọn folder lưu output...', 'running');
      await chooseOutputFolder();
      assertPipelineRunActive(runId);
      if (!outputFolder) throw new Error('Chưa chọn folder lưu output.');
    }

    setStatus('Bước 2/5: mở và kiểm tra ChatGPT...', 'running');
    const chatgptState = await waitForProviderReady('chatgpt', 'ChatGPT');
    assertPipelineRunActive(runId);

    if (project?.manualChatGPT) {
      setStatus('Đang hoạt động ở chế độ Manual ChatGPT (Tự gửi prompt & Tự lưu output).', 'ok');
      safeAddPipelineLog('renderer', 'ok', 'Chế độ Manual ChatGPT được kích hoạt. Pipeline tự động gõ phím đã bị vô hiệu hóa.');
      if (loginWaitDialog?.open) loginWaitDialog.close();
      setRunning(false);
      await startManualGptWorkflow();
      return;
    }

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
    if (isKeyframeMotionPromptOnlyModeEnabled()) {
      setStatus('Step 3/5: keyframe + motion prompt mode; VeoUp skipped.', 'running');
      safeAddPipelineLog?.('renderer', 'running', 'Pipeline mode: Generate Keyframe + Motion Prompt only. VeoUp skipped.');
    } else {
      setStatus('Bước 3/5: kiểm tra cấu hình VeoUp...', 'running');
      await updateVeoUpSetupUI().catch(() => null);
      safeAddPipelineLog?.('renderer', 'running', 'Production video provider: VeoUp; legacy video-provider login checks skipped.');
    }

    await syncProjectSceneFolders({ repairFromDisk: true });
    const activeScenes = project.scenes.filter((item) => activeBatchIds.includes(item.id));
    const runnableStatuses = new Set(['waiting_review', 'approved', 'image_done', 'error']);
    const safeBatchSize = clamp(Number(project.batchSize || 10), 1, 10);
    const incompleteScenes = project.scenes.filter((scene) => scene.status !== 'skipped' && !sceneHasVideoOutput(scene));
    const shouldCreateBatch = !activeBatchIds.length
      || activeScenes.length === 0
      || activeScenes.every((scene) => scene.status === 'skipped' || sceneHasVideoOutput(scene))
      || (activeBatchIds.length < Math.min(safeBatchSize, incompleteScenes.length) && !activeScenes.some((scene) => scene.status === 'running'));

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
    assertPipelineRunActive(runId);
    await runFullPipeline();
  } catch (error) {
    if (isPipelineCancelledError(error)) {
      if (loginWaitDialog?.open) loginWaitDialog.close();
      return;
    }
    paused = true;
    if (loginWaitDialog?.open) loginWaitDialog.close();
    webSessionStatus.textContent = `Lỗi: ${error.message}`;
    setStatus(`Auto route dừng: ${error.message}`, 'error');
    persist();
    render();
  } finally {
    if (loginWaitDialog?.open) loginWaitDialog.close();
    setRunning(false);
    if (!hasPipelineTimers(runId)) finishPipelineRun(runId);
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
  if (saveProjectBtn) saveProjectBtn.disabled = !project;
  autoRunBtn.disabled = isRunning;
  openReviewBtn.disabled = !getCurrentReviewScene();

  renderFinalPreview();
  renderAssetReviewModal();
  renderProjectSessionStatus();
  if (typeof updateScanButtonVisibility === 'function') {
    updateScanButtonVisibility();
  }
  if (typeof updateManualProjectProgressUI === 'function') {
    updateManualProjectProgressUI();
  }
  if (typeof renderStoryboardUI === 'function') {
    renderStoryboardUI();
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
    const reviewType = scene.status === 'waiting_review' ? 'prompt' : scene.reviewType || (sceneHasVideoOutput(scene) ? 'video' : scene.imagePath ? 'image' : 'prompt');
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
    scene.lastFramePath = '';
    scene.videoValidated = false;
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
  const noticeType = String(payload.type || '');
  const isAutomaticRecoveryNotice = [
    'chatgpt-image-retry',
    'pipeline-auto-restart',
    'pipeline-paused', 'chatgpt-policy-refusal',
  ].includes(noticeType);
  setStatus(
    message,
    isAutomaticRecoveryNotice
      ? 'running'
      : noticeType.includes('limit')
        ? 'error'
        : 'running'
  );
  if (isAutomaticRecoveryNotice) return;
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
  const pipelineLocked = Boolean(isRunning || (activePipelineRunId && cancelledPipelineRunId !== activePipelineRunId));
  runBatchBtn.disabled = pipelineLocked;
  autoRunBtn.disabled = pipelineLocked;
  if (startPipelineInlineBtn) startPipelineInlineBtn.disabled = pipelineLocked;
  if (runBatchBtn) runBatchBtn.textContent = pipelineLocked ? 'Đang chạy...' : 'Run batch kế tiếp';
  autoRunBtn.textContent = pipelineLocked ? 'Đang chạy pipeline...' : 'Start pipeline';
  if (startPipelineInlineBtn) startPipelineInlineBtn.textContent = pipelineLocked ? 'Đang chạy pipeline...' : 'Start pipeline ngay';
  updateStopPipelineControls();
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
  const reviewType = scene.status === 'waiting_review' ? 'prompt' : scene.reviewType || (sceneHasVideoOutput(scene) ? 'video' : scene.imagePath ? 'image' : 'prompt');
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
  if (isKeyframeMotionPromptOnlyModeEnabled()) {
    return isSceneCompleteForVeoUp(scene) || sceneHasRequiredOutputForCurrentMode(scene);
  }
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
    if (isKeyframeMotionPromptOnlyModeEnabled()) continue;
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
    lastCheckpointRef: projectRuntime.lastCheckpointRef || null,
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
  const sceneRecord = scrubLegacyProjectFields(
    stripObsoleteProjectModeFields(sceneWithoutInlineImageData(scene)),
  );
  return {
    ...sceneRecord,
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

function stripObsoleteProjectModeFields(value = {}) {
  if (!value || typeof value !== 'object') return value;
  const blocked = new Set([
    'image' + 'Motion' + 'OnlyMode',
    'skip' + 'VideoGeneration',
    'motion' + 'OnlyMode',
    'no' + 'VideoMode',
    'only' + 'RunGpt',
  ]);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !blocked.has(key)));
}

function normalizeLegacyVideoProvider(_value) {
  return 'veoup';
}

function scrubLegacyProjectFields(value) {
  const blocked = new Set([
    'accountRouterEnabled',
    'grokRecovery',
    'grokRouter',
    'pixverse',
    'router',
    'routingPolicy',
    'selectedGrokAccountId',
    'sendToGrok',
    'videoPlatform',
    'videoProvider',
  ]);
  if (Array.isArray(value)) {
    return value.map((item) => scrubLegacyProjectFields(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !blocked.has(key))
      .map(([key, item]) => [key, scrubLegacyProjectFields(item)]),
  );
}

function getProjectSessionPayload() {
  const previewTimeline = getPreviewTimeline();
  const scenes = (project?.scenes || []).map(getSceneFileRecord);
  const runtime = getRuntimeSnapshot();
  const { scenes: _discardedProjectScenes, ...projectMetadata } = project || {};
  const projectFields = scrubLegacyProjectFields(
    stripObsoleteProjectModeFields(projectMetadata),
  );
  const continuityReferences = getContinuityReferenceSettings();
  return {
    schemaVersion: 1,
    appVersion: 'electron-phase2',
    savedAt: new Date().toISOString(),
    project: {
      ...projectFields,
      description: project?.description || '',
      updatedAt: new Date().toISOString(),
      scenes,
      continuityReferences,
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
      videoProvider: 'veoup',
      imageGeneration: {
        ...getImageGenerationSettings(),
        apiKey: '',
      },
      continuityReferences,
      selectedModels: {
        script: modelInput?.value || '',
        image: providerSelect?.value || '',
        video: 'veoup',
      },
      selectedLabels: {
        provider: getSelectedText(providerSelect),
        account: getSelectedText(accountSelect),
        model: modelInput?.value || '',
      },
      batchSize: clamp(Number(batchSizeInput?.value) || project?.batchSize || 10, 1, 10),
      sceneDurationSeconds: normalizeSceneDuration(durationInput?.value || project?.durationSec || 10),
      keyframeMotionPromptOnly: isKeyframeMotionPromptOnlyModeEnabled(),
      outputLanguage: 'Vietnamese',
      stylePreset: 'current-renderer-settings',
    },
    runtime: {
      ...runtime,
      projectAutosaveRevision,
      outputFolder,
      videoProvider: 'veoup',
      reviewSettings: getReviewSettings(),
      skipReview: shouldSkipReview(),
      keyframeMotionPromptOnly: isKeyframeMotionPromptOnlyModeEnabled(),
      continuityReferences,
      chatGptStability: getChatGptStabilitySettings(),
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

function compactScenePipelineResult(result = null) {
  if (!result || typeof result !== 'object') return null;
  const text = (value, max = 2000) => String(value || '').slice(0, max);
  const paths = (value) => Array.isArray(value)
    ? value.filter(Boolean).map((item) => text(item, 1000)).slice(0, 8)
    : [];
  return {
    ok: Boolean(result.ok),
    sceneId: result.sceneId || null,
    phase: text(result.phase, 100),
    imagePath: text(result.imagePath, 1000),
    motionPromptPath: text(result.motionPromptPath, 1000),
    videoPath: text(result.videoPath, 1000),
    videoValidated: Boolean(result.videoValidated),
    lastFramePath: text(result.lastFramePath, 1000),
    sourceVideoPath: text(result.sourceVideoPath, 1000),
    sourceDownloadPath: text(result.sourceDownloadPath, 1000),
    completionStatus: text(result.completionStatus, 100),
    keyframeMotionPromptOnly: Boolean(result.keyframeMotionPromptOnly),
    videoProvider: text(result.videoProvider, 100),
    videoStatus: text(result.videoStatus, 500),
    videoError: text(result.videoError, 1000),
    continuityReferencePaths: paths(result.continuityReferencePaths),
    continuityReferenceSourceScene: result.continuityReferenceSourceScene || null,
  };
}

function sceneWithoutInlineImageData(scene = {}) {
  const {
    imageDataUrl: _discardedImageDataUrl,
    pipeline: rawPipeline,
    ...rest
  } = scene || {};
  const pipeline = compactScenePipelineResult(rawPipeline);
  return pipeline ? { ...rest, pipeline } : rest;
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
    imageDataUrl: '',
    pipeline: compactScenePipelineResult(scene.pipeline),
    videoPath: scene.videoPath || '',
    videoFileExists: scene.videoFileExists === true,
    videoFileMtimeMs: Number(scene.videoFileMtimeMs || 0),
    videoFileCheckedAtMs: Number(scene.videoFileCheckedAtMs || 0),
    outputStatCheckedAtMs: Number(scene.outputStatCheckedAtMs || 0),
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
    batchSize: clamp(Number(sourceProject.batchSize || payload.config?.batchSize || 10), 1, 10),
    durationSec: normalizeSceneDuration(sourceProject.durationSec || payload.config?.sceneDurationSeconds || 10),
    keyframeMotionPromptOnly: Boolean(sourceProject.keyframeMotionPromptOnly ?? payload.runtime?.keyframeMotionPromptOnly ?? payload.config?.keyframeMotionPromptOnly),
    continuityReferences: scrubLegacyProjectFields(sourceProject.continuityReferences || payload.runtime?.continuityReferences || payload.config?.continuityReferences || {}),
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
    lastCheckpointRef: payload.runtime?.lastCheckpointRef || null,
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
  projectAutosaveRevision += 1;
  projectAutosaveSavedRevision = projectAutosaveRevision;
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
  normalizeLegacyVideoProvider(payload.runtime?.videoProvider || payload.runtime?.videoPlatform || payload.config?.videoProvider);
  applyImageGenerationSettings(payload.runtime?.imageGeneration || payload.config?.imageGeneration);
  applyReviewSettings(payload.runtime?.reviewSettings || { skipReview: payload.runtime?.skipReview });
  applyPipelineModeSettings({ keyframeMotionPromptOnly: project?.keyframeMotionPromptOnly ?? payload.runtime?.keyframeMotionPromptOnly ?? payload.config?.keyframeMotionPromptOnly });
  applyContinuityReferenceSettings(payload.runtime?.continuityReferences || payload.config?.continuityReferences || project?.continuityReferences || {});
  applyChatGptStabilitySettings(payload.runtime?.chatGptStability || payload.config?.chatGptStability || {});
  syncTargetSceneCountToProjectDefault();
  if (webSessionStatus) webSessionStatus.textContent = outputFolder ? `Folder lưu: ${outputFolder}` : 'Opened project. Waiting for Start.';
  syncProjectSceneFolders({ repairFromDisk: true }).then(() => {
    projectDirty = false;
    persist({ skipAutosave: true });
    render();
  }).catch(() => null);
  persist({ skipAutosave: true });
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

function queueProjectAutosave({ immediate = false, reason = 'change' } = {}) {
  if (!project || !currentProjectFilePath) return false;
  projectAutosaveRevision += 1;
  projectDirty = true;
  projectAutosaveLastError = '';
  renderProjectSessionStatus();
  if (projectAutosaveTimer) {
    clearTimeout(projectAutosaveTimer);
    projectAutosaveTimer = null;
  }
  if (immediate) {
    void flushProjectAutosave({ reason });
  } else {
    projectAutosaveTimer = setTimeout(() => {
      projectAutosaveTimer = null;
      void flushProjectAutosave({ reason });
    }, PROJECT_AUTOSAVE_DEBOUNCE_MS);
  }
  return true;
}

async function flushProjectAutosave({ force = false, reason = 'autosave' } = {}) {
  if (projectAutosaveTimer) {
    clearTimeout(projectAutosaveTimer);
    projectAutosaveTimer = null;
  }
  if (!project || !currentProjectFilePath) return true;
  if (projectAutosaveInFlight) {
    try {
      await projectAutosaveInFlight;
    } catch (_error) {
      return false;
    }
    if (projectAutosaveSavedRevision >= projectAutosaveRevision) return true;
    return flushProjectAutosave({ force: false, reason: 'changes-during-save' });
  }
  if (force && projectAutosaveSavedRevision >= projectAutosaveRevision) {
    projectAutosaveRevision += 1;
  }
  const autosaveRun = (async () => {
    while (
      project &&
      currentProjectFilePath &&
      projectAutosaveSavedRevision < projectAutosaveRevision
    ) {
      const revisionToSave = projectAutosaveRevision;
      const filePathToSave = currentProjectFilePath;
      const payload = getProjectSessionPayload();
      payload.runtime = {
        ...(payload.runtime || {}),
        projectAutosaveRevision: revisionToSave,
      };
      const result = await window.videoPlannerAPI?.overwriteProjectSession?.({
        filePath: filePathToSave,
        payload,
        revision: revisionToSave,
      });
      if (!result?.ok) {
        throw new Error(result?.error || 'project-autosave-failed');
      }
      if (currentProjectFilePath === filePathToSave) {
        currentProjectFilePath = result.filePath || filePathToSave;
        projectAutosaveSavedRevision = Math.max(
          projectAutosaveSavedRevision,
          Number(result.revision || revisionToSave),
        );
      }
      projectAutosaveLastError = '';
      if (projectAutosaveSavedRevision >= projectAutosaveRevision) {
        projectDirty = false;
      }
      persist({ skipAutosave: true });
      renderProjectSessionStatus();
    }
    return true;
  })();
  projectAutosaveInFlight = autosaveRun;
  try {
    await autosaveRun;
  } catch (error) {
    projectAutosaveLastError = error?.message || String(error);
    projectDirty = true;
    renderProjectSessionStatus();
    setStatus(
      `Autosave .vdra thất bại (${reason}): ${projectAutosaveLastError}`,
      'error',
    );
    return false;
  } finally {
    if (projectAutosaveInFlight === autosaveRun) {
      projectAutosaveInFlight = null;
    }
  }
  return projectAutosaveSavedRevision >= projectAutosaveRevision;
}

function persistProjectCheckpoint(reason = 'pipeline-checkpoint') {
  persist({ skipAutosave: true });
  return queueProjectAutosave({ immediate: true, reason });
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
    setStatus(`Không tạo được file .vdra: ${result?.error || 'unknown error'}`, 'error');
    return result;
  }
  currentProjectFilePath = result.filePath || '';
  outputFolder = result.projectFolder || outputFolder;
  projectDirty = false;
  projectAutosaveRevision += 1;
  projectAutosaveSavedRevision = projectAutosaveRevision;
  persist({ skipAutosave: true });
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
  newProjectSceneFileOriginalName = '';
  newProjectSceneFilePath = '';
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
    if (createdFile?.error === 'project-already-exists') {
      setStatus('Tên project đã tồn tại tại vị trí này. Hãy nhập tên khác; dữ liệu cũ không bị ghi đè.', 'error');
      if (newProjectDialog && !newProjectDialog.open) newProjectDialog.showModal();
      newProjectNameInput?.focus?.();
    } else {
      setStatus('Không tạo được file .vdra. Project chưa được xác nhận; hãy sửa lỗi và thử lại.', 'error');
    }
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
  projectAutosaveRevision += 1;
  projectAutosaveSavedRevision = projectAutosaveRevision;
  persist({ skipAutosave: true });
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

function persist(options = {}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      projectSummary: project ? {
        id: project.id || '',
        name: project.name || '',
        sceneCount: Array.isArray(project.scenes) ? project.scenes.length : 0,
        updatedAt: project.updatedAt || '',
      } : null,
      activeBatchIds,
      paused,
      outputFolder,
      currentProjectFilePath,
      projectDirty,
      projectRuntime: scrubLegacyProjectFields(projectRuntime),
      reviewSettings: getReviewSettings(),
      imageGeneration: getImageGenerationSettings(),
      continuityReferences: getContinuityReferenceSettings(),
      chatGptStability: getChatGptStabilitySettings(),
      pipelineMode: { keyframeMotionPromptOnly: isKeyframeMotionPromptOnlyModeEnabled() },
      veoupPreviewStartOnly: Boolean(veoupPreviewStartOnlyToggle?.checked)
    }));
  } catch (e) {
    console.warn('[LocalStorage Persist Error] Could not save compact UI state:', e);
  }
  if (!options.skipAutosave) {
    queueProjectAutosave({
      immediate: Boolean(options.immediateAutosave),
      reason: options.reason || 'state-change',
    });
  }
}

async function reconcileSavedAssets() {
  if (!project?.scenes?.length || !window.videoPlannerAPI?.assetExists) return { missing: 0 };
  let missing = 0;
  const pathMissingCache = new Map();
  const pathStatCache = new Map();
  const missingPath = async (filePath) => {
    if (!filePath) return false;
    if (pathMissingCache.has(filePath)) return pathMissingCache.get(filePath);
    const isMissing = !(await window.videoPlannerAPI.assetExists(filePath).catch(() => false));
    pathMissingCache.set(filePath, isMissing);
    return isMissing;
  };
  const statPath = async (filePath) => {
    if (!filePath) return { exists: false, mtimeMs: 0, size: 0 };
    if (pathStatCache.has(filePath)) return pathStatCache.get(filePath);
    const stat = await (window.videoPlannerAPI.assetStat
      ? window.videoPlannerAPI.assetStat(filePath)
      : window.videoPlannerAPI.assetExists(filePath).then((exists) => ({ exists, mtimeMs: 0, size: 0 })))
      .catch(() => ({ exists: false, mtimeMs: 0, size: 0 }));
    pathStatCache.set(filePath, stat);
    return stat;
  };
  for (const scene of project.scenes) {
    if (scene.imagePath && await missingPath(scene.imagePath)) {
      scene.imagePath = '';
      scene.imageDataUrl = '';
      if (['image_done', 'image_generated', 'video_pending', 'video_generating', 'video_done', 'video_generated', 'video_ready', 'asset_review'].includes(scene.status)) scene.status = 'image_pending';
      missing += 1;
    }
    if (scene.videoPath) {
      const videoStat = await statPath(scene.videoPath);
      scene.videoFileExists = Boolean(videoStat?.exists);
      scene.videoFileMtimeMs = Number(videoStat?.mtimeMs || 0);
      scene.videoFileCheckedAtMs = Date.now();
      scene.outputStatCheckedAtMs = scene.videoFileCheckedAtMs;
      if (!scene.videoFileExists) {
        scene.videoPath = '';
        scene.lastFramePath = '';
        scene.videoValidated = false;
        if (['video_done', 'video_generated', 'video_ready'].includes(scene.status)) scene.status = scene.imagePath ? 'image_done' : 'image_pending';
        missing += 1;
      } else {
        scene.videoValidated = true;
      }
    } else {
      scene.videoFileExists = false;
      scene.videoFileMtimeMs = 0;
      scene.outputStatCheckedAtMs = Date.now();
    }
    if (scene.lastFramePath && await missingPath(scene.lastFramePath)) {
      scene.lastFramePath = '';
      scene.videoValidated = false;
      if (['video_done', 'video_generated', 'video_ready'].includes(scene.status)) scene.status = scene.videoPath ? 'video_pending' : (scene.imagePath ? 'image_done' : 'image_pending');
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
  persist({ skipAutosave: true });
  const saved = await flushProjectAutosave({ force: true, reason: 'save-session' });
  const logPath = await window.videoPlannerAPI?.getAppLogPath?.().catch(() => '');
  setStatus(`${saved ? 'Đã lưu session' : 'Không lưu được session'}${checked.missing ? `, bỏ qua ${checked.missing} asset không còn trên ổ đĩa` : ''}. Log: ${logPath || 'đã ghi file log'}`, saved ? 'ok' : 'error');
}

async function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    applyImageGenerationSettings(saved.imageGeneration || {});
    applyReviewSettings(saved.reviewSettings || { skipReview: saved.skipReview });
    applyPipelineModeSettings(saved.pipelineMode || { keyframeMotionPromptOnly: saved.project?.keyframeMotionPromptOnly });
    applyContinuityReferenceSettings(saved.continuityReferences || saved.project?.continuityReferences || {});
    applyChatGptStabilitySettings(saved.chatGptStability || {});
    if (veoupPreviewStartOnlyToggle) veoupPreviewStartOnlyToggle.checked = Boolean(saved.veoupPreviewStartOnly);
    localStorage.removeItem(RESTORE_SESSION_KEY);
    const restored = await window.videoPlannerAPI?.openLastProjectSession?.().catch(() => null);
    if (restored?.ok) {
      applyProjectSessionPayload(restored.payload, restored.filePath);
      paused = false;
      isRunning = false;
      autoContinuing = false;
      projectRuntime = {
        ...projectRuntime,
        active: false,
        autoRun: false,
        resumeMode: 'manual-start',
        waitingForUserStart: true,
      };
      persist({ skipAutosave: true });
      setStatus(`Đã tự động mở lại ${restored.filePath.split(/[\\/]/).pop()}. Bấm Start pipeline để tiếp tục.`, 'ok');
    } else {
      project = null;
      activeBatchIds = [];
      paused = false;
      currentProjectFilePath = '';
      projectDirty = false;
      projectRuntime = { currentStage: 'idle', currentBatchIndex: null, currentSceneId: null, lastCheckpointRef: null, lastAction: null, resumeMode: 'manual-start', waitingForUserStart: true };
      outputFolder = '';
      setStatus('Chưa có project .vdra gần nhất. Hãy tạo hoặc mở project.', 'idle');
    }
  } catch (error) {
    project = null;
    activeBatchIds = [];
    paused = false;
    projectRuntime = { currentStage: 'idle', currentBatchIndex: null, currentSceneId: null, lastCheckpointRef: null, lastAction: null, resumeMode: 'manual-start', waitingForUserStart: true };
    setStatus(`Không khôi phục được project gần nhất: ${error?.message || error}`, 'error');
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
prepromptFolderBtn?.addEventListener('click', openProjectPrepromptFolderFlow);
newProjectBtn?.addEventListener('click', newProjectSessionFlow);
newProjectSceneFileInput?.addEventListener('change', async () => {
  const file = newProjectSceneFileInput.files?.[0];
  if (!file) return;
  newProjectSceneFileOriginalName = file.name || 'scene.txt';
  newProjectSceneFilePath = file.path || '';
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
autoRunBtn?.addEventListener('click', startPipelineFromClick);
autoRunBtn?.addEventListener('pointerdown', startPipelineFromClick, { capture: true });
startPipelineInlineBtn?.addEventListener('click', startPipelineFromClick);
startPipelineInlineBtn?.addEventListener('pointerdown', startPipelineFromClick, { capture: true });
stopPipelineBtn?.addEventListener('click', stopPipelineFromClick);
stopPipelineInlineBtn?.addEventListener('click', stopPipelineFromClick);
document.addEventListener('click', (event) => {
  if (event.target?.closest?.('#auto-run-btn, #start-pipeline-inline-btn')) startPipelineFromClick(event);
  if (event.target?.closest?.('#stop-pipeline-btn, #stop-pipeline-inline-btn')) stopPipelineFromClick(event);
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
providerSelect.addEventListener('change', () => {
  if (providerSelect.value === 'ninerouter') modelInput.value = 'cx/gpt-5.5';
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
[chatGptAutoReloadToggle, chatGptAutoResumeToggle, chatGptRetryLimitInput, customTargetScenesInput]
  .filter(Boolean)
  .forEach((control) => control.addEventListener('change', () => {
    if (control === customTargetScenesInput) {
      const projectSceneCount = getProjectTargetSceneDefault();
      targetSceneCount = clamp(Number(customTargetScenesInput.value) || projectSceneCount, 1, MAX_PROJECT_SCENE_COUNT);
      customTargetScenesInput.value = String(targetSceneCount);
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
keyframeMotionOnlyToggle?.addEventListener('change', () => {
  if (project) project.keyframeMotionPromptOnly = isKeyframeMotionPromptOnlyModeEnabled();
  markProjectDirty();
  persist();
  render();
});
[imageGenerationMethodSelect, imageApiEndpointInput, imageApiModelSelect, imageApiSizeInput, imageApiKeyInput]
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

window.videoPlannerAPI?.onProjectFlushBeforeClose?.(() =>
  flushProjectAutosave({ force: true, reason: 'window-close' })
);
restore().catch((error) => setStatus(`Không khôi phục được project: ${error.message}`, 'error'));



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
        expectedSceneIds: project.scenes.map((scene) => Number(scene.id || scene.sceneId)).filter(Number.isInteger),
        projectName: project.name || '',
        trigger: 'manual-scan',
        allowPartial: true,
        autoStartVideoGeneration: true,
        previewStartButtonOnly: Boolean(veoupPreviewStartOnlyToggle?.checked)
      });
      if (res && res.ok) {
        const action = res.status === 'previewed'
          ? 'Đã preview nút Start cho'
          : res.status === 'loaded'
            ? 'Đã nạp vào VeoUp'
            : 'Đã gửi sang VeoUp';
        const skippedSceneIds = Array.isArray(res.skippedSceneIds) ? res.skippedSceneIds : [];
        const partialNote = skippedSceneIds.length
          ? ` Đã bỏ qua ${skippedSceneIds.length} scene chưa sạch: ${skippedSceneIds.join(', ')}.`
          : '';
        setStatus(`${action}: ${res.imageCount} scene.${partialNote}`, skippedSceneIds.length ? 'running' : 'ok');
        alert(`${action} ${res.imageCount} scene.${partialNote}`);
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

  let manualSelectedSceneId = 1;
  let manualWatcherTimer = null;
  let manualIsCapturing = false;

  function formatFileSize(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  }

  function getManualSelectedScene() {
    if (!project?.scenes?.length) return null;
    return project.scenes.find((s) => s.id === Number(manualSelectedSceneId)) || project.scenes[0];
  }

  function showToast(message, type = 'info', duration = 3000) {
    let container = document.querySelector('#toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconMap = {
      success: '✓',
      error: '✕',
      warning: '⚠️',
      info: 'ℹ️',
    };
    const icon = iconMap[type] || 'ℹ️';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <div class="toast-content">${typeof escapeHtml === 'function' ? escapeHtml(message) : message}</div>
    `;

    container.appendChild(toast);

    const removeToast = () => {
      if (toast.classList.contains('toast-hiding')) return;
      toast.classList.add('toast-hiding');
      setTimeout(() => {
        toast.remove();
      }, 250);
    };

    toast.addEventListener('click', removeToast);
    if (duration > 0) {
      setTimeout(removeToast, duration);
    }
    return toast;
  }
  window.showToast = showToast;

  async function copyTextToClipboard(text, btnElement) {
    if (!text) return false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      if (btnElement) {
        const origText = btnElement.textContent;
        btnElement.textContent = '✓ ĐÃ SAO CHÉP!';
        btnElement.classList.add('copied');
        setTimeout(() => {
          btnElement.textContent = origText;
          btnElement.classList.remove('copied');
        }, 2000);
      }
      showToast('Đã sao chép prompt vào Clipboard!', 'success', 2000);
      return true;
    } catch (err) {
      showToast(`Không thể sao chép: ${err.message}`, 'error');
      return false;
    }
  }

  manualChatGptBtn?.addEventListener('click', async () => {
    const isCurrentlyActive = manualChatGptBtn.getAttribute('aria-pressed') === 'true';
    const nextState = !isCurrentlyActive;
    manualChatGptBtn.setAttribute('aria-pressed', nextState ? 'true' : 'false');
    if (nextState) {
      manualChatGptBtn.classList.add('active');
    } else {
      manualChatGptBtn.classList.remove('active');
    }
    if (manualChatGptCard) manualChatGptCard.hidden = !nextState;
    if (manualChatGptSection) manualChatGptSection.hidden = !nextState;
    if (nextState && keyframeMotionOnlyToggle) keyframeMotionOnlyToggle.checked = false;
    if (project) project.manualChatGPT = nextState;
    markProjectDirty();
    persist();
    render();
    if (nextState) {
      manualChatGptCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      await renderManualChatGptUI();
      startManualWatcher();
      safeAddPipelineLog('manual-gpt', 'ok', 'Đã bật chế độ Manual ChatGPT. Giao diện điều khiển thủ công đã mở.');
    } else {
      stopManualWatcher();
      safeAddPipelineLog('manual-gpt', 'info', 'Đã tắt chế độ Manual ChatGPT.');
    }
    updateManualProjectProgressUI();
  });

  function checkAllScenesChatGptReady() {
    if (!project?.scenes?.length) return { ready: false, reason: "Chưa có scene nào trong project." };
    for (let index = 0; index < project.scenes.length; index += 1) {
      const scene = project.scenes[index];
      const sceneIdStr = `scene_${String(scene.id || index + 1).padStart(3, '0')}`;
      const hasImage = Boolean(scene.imagePath || scene.keyframePath);
      const hasMotion = Boolean(scene.motionPrompt || scene.motionPromptPath);
      if (!hasImage) {
        return { ready: false, sceneId: sceneIdStr, reason: `${sceneIdStr} chưa hoàn thành NV1 (thiếu keyframe image).` };
      }
      if (!hasMotion) {
        return { ready: false, sceneId: sceneIdStr, reason: `${sceneIdStr} chưa hoàn thành NV2 (thiếu motion prompt).` };
      }
    }
    return { ready: true };
  }

  function updateManualProjectProgressUI() {
    const manualProjectProgress = document.querySelector('#manual-project-progress');
    const manualVeoUpGateStatus = document.querySelector('#manual-veoup-gate-status');
    if (!project?.scenes?.length) {
      if (manualProjectProgress) manualProjectProgress.textContent = "0 / 0 scenes hoàn tất";
      if (manualVeoUpGateStatus) {
        manualVeoUpGateStatus.textContent = "LOCKED";
        manualVeoUpGateStatus.className = "gate-status locked";
      }
      return;
    }
    let readyCount = 0;
    const totalCount = project.scenes.length;
    for (let index = 0; index < totalCount; index += 1) {
      const scene = project.scenes[index];
      const hasImage = Boolean(scene.imagePath || scene.keyframePath);
      const hasMotion = Boolean(scene.motionPrompt || scene.motionPromptPath);
      if (hasImage && hasMotion) readyCount += 1;
    }
    if (manualProjectProgress) manualProjectProgress.textContent = `${readyCount} / ${totalCount} scenes hoàn tất`;
    const isAllReady = readyCount === totalCount && totalCount > 0;
    if (manualVeoUpGateStatus) {
      if (isAllReady) {
        manualVeoUpGateStatus.textContent = "READY";
        manualVeoUpGateStatus.className = "gate-status ready";
      } else {
        manualVeoUpGateStatus.textContent = `LOCKED (${readyCount}/${totalCount})`;
        manualVeoUpGateStatus.className = "gate-status locked";
      }
    }
  }

  async function renderManualChatGptUI() {
    const bannerMessage = document.querySelector('#manual-guidance-message');
    const bannerTitle = document.querySelector('#manual-guidance-title');
    if (!project?.scenes?.length) {
      if (bannerTitle) bannerTitle.textContent = 'Chưa Có Scene Nào';
      if (bannerMessage) bannerMessage.textContent = "Vui lòng nhập kịch bản ở khung bên trái rồi bấm 'Tách Scene & Tạo Project'.";
      return;
    }
    const scene = getManualSelectedScene();
    if (!scene) return;

    const totalCount = project.scenes.length;
    const sceneToken = `scene_${String(scene.id).padStart(3, '0')}`;

    // Update Dropdown
    const sceneSelect = document.querySelector('#manual-scene-select');
    if (sceneSelect) {
      sceneSelect.innerHTML = '';
      project.scenes.forEach((s) => {
        const isDone = Boolean((s.imagePath || s.keyframePath) && (s.motionPrompt || s.motionPromptPath));
        const hasKfOnly = Boolean(s.imagePath || s.keyframePath) && !Boolean(s.motionPrompt || s.motionPromptPath);
        const mark = isDone ? '✓' : (hasKfOnly ? '⏳' : '⚪');
        const opt = document.createElement('option');
        opt.value = String(s.id);
        opt.textContent = `Scene ${s.id} [${mark}]`;
        if (s.id === scene.id) opt.selected = true;
        sceneSelect.appendChild(opt);
      });
    }

    // Title & Meta
    const titleEl = document.querySelector('#manual-current-scene-title');
    if (titleEl) {
      const desc = String(scene.original || '').trim();
      titleEl.textContent = `Scene ${scene.id} / ${totalCount}${desc ? `: ${desc.slice(0, 35)}...` : ''}`;
    }

    // Prompts preview
    const nv1Preview = document.querySelector('#manual-nv1-prompt-preview');
    if (nv1Preview) {
      nv1Preview.value = scene.imagePrompt || scene.original || (typeof buildImagePrompt === 'function' ? buildImagePrompt(scene) : '');
    }
    const nv2Preview = document.querySelector('#manual-nv2-prompt-preview');
    if (nv2Preview) {
      nv2Preview.value = scene.motionPrompt || (typeof buildMotionPrompt === 'function' ? buildMotionPrompt(scene) : '');
    }

    // Audit on disk
    let audit = null;
    if (outputFolder) {
      audit = await window.videoPlannerAPI?.getManualSceneAudit({
        projectPath: outputFolder,
        sceneId: sceneToken,
      }).catch(() => null);
    }

    const hasKeyframe = Boolean(audit?.keyframe?.valid || scene.imagePath || scene.keyframePath);
    const hasMotion = Boolean(audit?.motionPrompt?.valid || scene.motionPrompt || scene.motionPromptPath);

    // NV1 status & badge
    const nv1Status = document.querySelector('#manual-nv1-status');
    const nv1Badge = document.querySelector('#manual-nv1-disk-badge');
    if (nv1Badge) {
      if (audit?.keyframe?.valid) {
        nv1Badge.className = 'stage-disk-badge saved';
        nv1Badge.innerHTML = `<span class="disk-icon">💾</span> File đĩa: <strong class="disk-status">✓ ${audit.keyframe.fileName} (${formatFileSize(audit.keyframe.size)})</strong>`;
        if (nv1Status) nv1Status.textContent = '✓ Đã lưu keyframe';
      } else {
        nv1Badge.className = 'stage-disk-badge missing';
        nv1Badge.innerHTML = `<span class="disk-icon">💾</span> File đĩa: <span class="disk-status">❌ Chưa có keyframe</span>`;
        if (nv1Status) nv1Status.textContent = 'Chờ gửi prompt NV1';
      }
    }

    // NV2 status & badge
    const nv2Status = document.querySelector('#manual-nv2-status');
    const nv2Badge = document.querySelector('#manual-nv2-disk-badge');
    if (nv2Badge) {
      if (audit?.motionPrompt?.valid) {
        nv2Badge.className = 'stage-disk-badge saved';
        nv2Badge.innerHTML = `<span class="disk-icon">💾</span> File đĩa: <strong class="disk-status">✓ ${audit.motionPrompt.fileName} (${audit.motionPrompt.length} ký tự)</strong>`;
        if (nv2Status) nv2Status.textContent = '✓ Đã lưu motion prompt';
      } else {
        nv2Badge.className = 'stage-disk-badge missing';
        nv2Badge.innerHTML = `<span class="disk-icon">💾</span> File đĩa: <span class="disk-status">❌ Chưa có motion prompt</span>`;
        if (nv2Status) nv2Status.textContent = hasKeyframe ? 'Chờ gửi prompt NV2' : 'Chưa đến lượt';
      }
    }

    // In-place Preview & Re-capture for NV1
    const nv1PreviewWrap = document.querySelector('#manual-nv1-preview-wrap');
    const nv1ImgPreview = document.querySelector('#manual-nv1-img-preview');
    const nv1RecaptureBtn = document.querySelector('#manual-recapture-nv1-btn');
    const nv1ZoomBtn = document.querySelector('#manual-zoom-nv1-btn');
    
    let keyframeMediaSrc = '';
    if (audit?.keyframe?.path) {
      keyframeMediaSrc = audit.keyframe.url || (audit.keyframe.path.startsWith('data:') ? audit.keyframe.path : `file:///${audit.keyframe.path.replaceAll('\\', '/')}`);
    } else if (scene.imagePath) {
      keyframeMediaSrc = scene.imagePath.startsWith('data:') ? scene.imagePath : `file:///${scene.imagePath.replaceAll('\\', '/')}`;
    }

    if (nv1PreviewWrap) {
      if (hasKeyframe && keyframeMediaSrc) {
        nv1PreviewWrap.style.display = 'block';
        if (nv1ImgPreview) nv1ImgPreview.src = keyframeMediaSrc;
        if (nv1RecaptureBtn) nv1RecaptureBtn.style.display = 'inline-block';
        if (nv1ZoomBtn) {
          nv1ZoomBtn.onclick = () => {
            if (typeof openLightbox === 'function') {
              openLightbox(keyframeMediaSrc, `Keyframe Scene ${scene.id}`);
            }
          };
        }
      } else {
        nv1PreviewWrap.style.display = 'none';
        if (nv1RecaptureBtn) nv1RecaptureBtn.style.display = 'none';
      }
    }

    // In-place Preview & Re-capture for NV2
    const nv2PreviewWrap = document.querySelector('#manual-nv2-preview-wrap');
    const nv2TextPreview = document.querySelector('#manual-nv2-text-preview');
    const nv2RecaptureBtn = document.querySelector('#manual-recapture-nv2-btn');
    const motionPromptText = audit?.motionPrompt?.content || scene.motionPrompt || '';

    if (nv2PreviewWrap) {
      if (hasMotion && motionPromptText) {
        nv2PreviewWrap.style.display = 'block';
        if (nv2TextPreview) nv2TextPreview.textContent = motionPromptText;
        if (nv2RecaptureBtn) nv2RecaptureBtn.style.display = 'inline-block';
      } else {
        nv2PreviewWrap.style.display = 'none';
        if (nv2RecaptureBtn) nv2RecaptureBtn.style.display = 'none';
      }
    }

    // Stepper 4 nấc trực quan (Prep -> NV1 -> NV2 -> VeoUp)
    const stepPrep = document.querySelector('#manual-step-prep');
    const stepNv1 = document.querySelector('#manual-step-nv1');
    const stepNv2 = document.querySelector('#manual-step-nv2');
    const stepVeoup = document.querySelector('#manual-step-veoup');
    const sceneStatusBadge = document.querySelector('#manual-scene-status-badge');

    const hasPrompt = Boolean(scene.imagePrompt || scene.original);

    if (stepPrep) {
      stepPrep.className = hasPrompt ? 'manual-step completed done' : 'manual-step active';
    }
    if (stepNv1) {
      if (hasKeyframe) {
        stepNv1.className = 'manual-step completed done';
      } else if (hasPrompt) {
        stepNv1.className = 'manual-step active';
      } else {
        stepNv1.className = 'manual-step';
      }
    }
    if (stepNv2) {
      if (hasMotion) {
        stepNv2.className = 'manual-step completed done';
      } else if (hasKeyframe) {
        stepNv2.className = 'manual-step active';
      } else {
        stepNv2.className = 'manual-step';
      }
    }
    if (stepVeoup) {
      if (hasKeyframe && hasMotion) {
        stepVeoup.className = 'manual-step completed done';
      } else {
        stepVeoup.className = 'manual-step';
      }
    }

    if (sceneStatusBadge) {
      if (hasKeyframe && hasMotion) {
        sceneStatusBadge.className = 'status-badge approved';
        sceneStatusBadge.textContent = '✓ HOÀN TẤT';
      } else if (hasKeyframe) {
        sceneStatusBadge.className = 'status-badge waiting_review';
        sceneStatusBadge.textContent = '⏳ THIẾU NV2';
      } else {
        sceneStatusBadge.className = 'status-badge idle';
        sceneStatusBadge.textContent = '⚪ CHƯA BẮT ĐẦU';
      }
    }

    updateManualProjectProgressUI();
    if (typeof renderStoryboardUI === 'function') {
      renderStoryboardUI();
    }
  }

  function startManualWatcher() {
    if (manualWatcherTimer) clearInterval(manualWatcherTimer);
    const startWatcherBtn = document.querySelector('#manual-start-watcher-btn');
    const stageBadge = document.querySelector('#manual-stage-badge');
    if (startWatcherBtn) {
      startWatcherBtn.textContent = '⏸ Tạm dừng Giám sát';
      startWatcherBtn.classList.remove('primary');
    }
    if (stageBadge) {
      stageBadge.textContent = 'Đang giám sát...';
      stageBadge.className = 'state-pill running';
    }

    manualWatcherTimer = setInterval(async () => {
      if (manualIsCapturing || !project?.manualChatGPT) return;
      const autoWatchToggle = document.querySelector('#manual-auto-watch-toggle');
      if (autoWatchToggle && !autoWatchToggle.checked) return;

      try {
        const progress = await window.videoPlannerAPI?.detectChatGPTProgress().catch(() => null);
        if (!progress || !progress.ok) return;

        const stageBadgeEl = document.querySelector('#manual-stage-badge');
        if (progress.isGenerating) {
          if (stageBadgeEl) {
            stageBadgeEl.textContent = '🎨 ChatGPT đang tạo...';
            stageBadgeEl.className = 'state-pill running';
          }
          return;
        }

        const scene = getManualSelectedScene();
        if (!scene || !outputFolder) return;
        const sceneToken = `scene_${String(scene.id).padStart(3, '0')}`;
        const audit = await window.videoPlannerAPI?.getManualSceneAudit({
          projectPath: outputFolder,
          sceneId: sceneToken,
        }).catch(() => null);

        // Check if NV1 is missing and ChatGPT has an image
        if (!audit?.keyframe?.valid && progress.hasImage) {
          manualIsCapturing = true;
          safeAddPipelineLog('manual-gpt', 'running', `[Scene ${scene.id} - NV1] Phát hiện ảnh trên ChatGPT, đang tự động lưu keyframe...`);
          const nv1StatusEl = document.querySelector('#manual-nv1-status');
          if (nv1StatusEl) nv1StatusEl.textContent = 'Đang tự động lưu ảnh...';

          const capRes = await window.videoPlannerAPI?.captureManualStage({
            projectPath: outputFolder,
            sceneId: sceneToken,
            stage: 'NV1',
            options: {},
          }).catch((err) => ({ ok: false, error: err.message }));

          if (capRes?.ok) {
            scene.imagePath = capRes.artifactPath || capRes.filePath;
            scene.keyframePath = capRes.artifactPath || capRes.filePath;
            safeAddPipelineLog('manual-gpt', 'ok', `[Scene ${scene.id} - NV1] ✓ Đã lưu keyframe thành công: ${capRes.filePath} (${formatFileSize(capRes.size)})`);
            setStatus(`Scene ${scene.id}: Đã lưu ảnh keyframe! Hãy dán prompt NV2 vào ChatGPT.`, 'ok');
            markProjectDirty();
            persist();
            render();
            await renderManualChatGptUI();
          } else {
            safeAddPipelineLog('manual-gpt', 'warning', `[Scene ${scene.id} - NV1] Tự động lưu ảnh thất bại: ${capRes?.reason || capRes?.error}`);
          }
          manualIsCapturing = false;
          return;
        }

        // Check if NV2 is missing (and NV1 is done) and ChatGPT has text
        if (audit?.keyframe?.valid && !audit?.motionPrompt?.valid && progress.textLength > 35) {
          manualIsCapturing = true;
          safeAddPipelineLog('manual-gpt', 'running', `[Scene ${scene.id} - NV2] Phát hiện motion prompt trên ChatGPT, đang tự động lưu...`);
          const nv2StatusEl = document.querySelector('#manual-nv2-status');
          if (nv2StatusEl) nv2StatusEl.textContent = 'Đang tự động lưu motion prompt...';

          const capRes = await window.videoPlannerAPI?.captureManualStage({
            projectPath: outputFolder,
            sceneId: sceneToken,
            stage: 'NV2',
            options: {},
          }).catch((err) => ({ ok: false, error: err.message }));

          if (capRes?.ok) {
            scene.motionPrompt = capRes.motionPrompt;
            scene.motionPromptPath = capRes.artifactPath || capRes.filePath;
            scene.status = 'done';
            scene.completionStatus = 'keyframe_motion_complete';
            scene.progressStep = 'done';
            safeAddPipelineLog('manual-gpt', 'ok', `[Scene ${scene.id} - NV2] ✓ Đã lưu motion prompt thành công: ${capRes.filePath} (${capRes.length} ký tự). Scene ${scene.id} HOÀN TẤT!`);
            setStatus(`Scene ${scene.id}: Hoàn tất cả Keyframe và Motion Prompt!`, 'ok');
            markProjectDirty();
            persist();
            render();
            await renderManualChatGptUI();

            const autoAdvanceToggle = document.querySelector('#manual-auto-advance-toggle');
            if (autoAdvanceToggle?.checked !== false) {
              const nextIncomplete = (project?.scenes || []).find((s) => s.id > scene.id && (!s.imagePath || !s.motionPrompt));
              if (nextIncomplete) {
                manualSelectedSceneId = nextIncomplete.id;
                safeAddPipelineLog('manual-gpt', 'running', `Tự động chuyển sang Scene ${manualSelectedSceneId}...`);
                await renderManualChatGptUI();
                await syncManualStageBaseline(nextIncomplete);
              }
            }
          } else {
            safeAddPipelineLog('manual-gpt', 'warning', `[Scene ${scene.id} - NV2] Tự động lưu motion prompt thất bại: ${capRes?.reason || capRes?.error}`);
          }
          manualIsCapturing = false;
          return;
        }

        if (audit?.isSceneComplete) {
          if (stageBadgeEl) {
            stageBadgeEl.textContent = 'Scene hoàn tất ✓';
            stageBadgeEl.className = 'state-pill done';
          }
        } else {
          if (stageBadgeEl) {
            stageBadgeEl.textContent = 'Chờ gửi prompt';
            stageBadgeEl.className = 'state-pill idle';
          }
        }
      } catch (err) {
        manualIsCapturing = false;
      }
    }, 2500);
  }

  function stopManualWatcher() {
    if (manualWatcherTimer) {
      clearInterval(manualWatcherTimer);
      manualWatcherTimer = null;
    }
    const startWatcherBtn = document.querySelector('#manual-start-watcher-btn');
    const stageBadge = document.querySelector('#manual-stage-badge');
    if (startWatcherBtn) {
      startWatcherBtn.textContent = '▶ Bắt đầu Giám sát';
      startWatcherBtn.classList.add('primary');
    }
    if (stageBadge) {
      stageBadge.textContent = 'Đã dừng giám sát';
      stageBadge.className = 'state-pill idle';
    }
  }

  async function syncManualStageBaseline(scene) {
    if (!scene || !outputFolder) return;
    const sceneToken = `scene_${String(scene.id).padStart(3, '0')}`;
    const targetStage = !scene.imagePath ? 'NV1' : (!scene.motionPrompt ? 'NV2' : null);
    if (!targetStage) return;
    await window.videoPlannerAPI?.startManualStage?.({
      projectPath: outputFolder,
      sceneId: sceneToken,
      stage: targetStage,
    }).catch((error) => safeAddPipelineLog('manual-gpt', 'warning', `[${targetStage}] Baseline sync: ${error?.message || error}`));
  }

  async function startManualGptWorkflow() {
    if (!outputFolder) {
      await chooseOutputFolder();
      if (!outputFolder) return;
    }
    if (manualChatGptCard) manualChatGptCard.hidden = false;
    if (manualChatGptSection) manualChatGptSection.hidden = false;
    if (manualChatGptBtn) {
      manualChatGptBtn.setAttribute('aria-pressed', 'true');
      manualChatGptBtn.classList.add('active');
    }
    if (project) project.manualChatGPT = true;
    manualChatGptCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    await syncProjectSceneFolders({ repairFromDisk: true }).catch(() => null);

    const firstIncomplete = (project?.scenes || []).find((s) => !s.imagePath || !s.motionPrompt);
    if (firstIncomplete) {
      manualSelectedSceneId = firstIncomplete.id;
    }

    await renderManualChatGptUI();

    // Establish ownership baseline before the user sends prompt
    if (firstIncomplete) {
      await syncManualStageBaseline(firstIncomplete);
    }

    const autoWatchToggle = document.querySelector('#manual-auto-watch-toggle');
    if (autoWatchToggle?.checked !== false) {
      startManualWatcher();
    }

    safeAddPipelineLog('manual-gpt', 'running', `Đã khởi động Chế độ Manual ChatGPT tại Scene ${manualSelectedSceneId}. Hãy sao chép prompt và dán vào tab ChatGPT.`);
    setStatus(`Manual ChatGPT: Đang tại Scene ${manualSelectedSceneId}. Hãy copy prompt và gửi trên ChatGPT.`, 'running');
  }
  window.startManualGptWorkflow = startManualGptWorkflow;

  function bindManualChatGptUi() {
    // Navigation
    document.querySelector('#manual-prev-scene-btn')?.addEventListener('click', async () => {
      const totalCount = project?.scenes?.length || 1;
      manualSelectedSceneId = manualSelectedSceneId > 1 ? manualSelectedSceneId - 1 : totalCount;
      await renderManualChatGptUI();
      await syncManualStageBaseline(getManualSelectedScene());
    });

    document.querySelector('#manual-next-scene-btn')?.addEventListener('click', async () => {
      const totalCount = project?.scenes?.length || 1;
      manualSelectedSceneId = manualSelectedSceneId < totalCount ? manualSelectedSceneId + 1 : 1;
      await renderManualChatGptUI();
      await syncManualStageBaseline(getManualSelectedScene());
    });

    document.querySelector('#manual-scene-select')?.addEventListener('change', async (e) => {
      manualSelectedSceneId = Number(e.target.value) || 1;
      await renderManualChatGptUI();
      await syncManualStageBaseline(getManualSelectedScene());
    });

    // Copy Prompt Buttons
    const copyNv1Btn = document.querySelector('#manual-copy-nv1-btn');
    copyNv1Btn?.addEventListener('click', async () => {
      const scene = getManualSelectedScene();
      if (scene && !scene.imagePath) {
        await syncManualStageBaseline(scene);
      }
      const textarea = document.querySelector('#manual-nv1-prompt-preview');
      const text = textarea?.value || '';
      const ok = await copyTextToClipboard(text, copyNv1Btn);
      if (ok) {
        safeAddPipelineLog('manual-gpt', 'ok', `Đã sao chép Prompt Tạo Ảnh (NV1) Scene ${manualSelectedSceneId} vào clipboard.`);
        setStatus(`Đã copy prompt NV1 Scene ${manualSelectedSceneId}! Dán vào ChatGPT và nhấn Enter.`, 'ok');
      }
    });

    const copyNv2Btn = document.querySelector('#manual-copy-nv2-btn');
    copyNv2Btn?.addEventListener('click', async () => {
      const scene = getManualSelectedScene();
      if (scene && !scene.motionPrompt) {
        const sceneToken = `scene_${String(scene.id).padStart(3, '0')}`;
        await window.videoPlannerAPI?.startManualStage?.({
          projectPath: outputFolder,
          sceneId: sceneToken,
          stage: 'NV2',
        }).catch(() => null);
      }
      const textarea = document.querySelector('#manual-nv2-prompt-preview');
      const text = textarea?.value || '';
      const ok = await copyTextToClipboard(text, copyNv2Btn);
      if (ok) {
        safeAddPipelineLog('manual-gpt', 'ok', `Đã sao chép Prompt Motion (NV2) Scene ${manualSelectedSceneId} vào clipboard.`);
        setStatus(`Đã copy prompt NV2 Scene ${manualSelectedSceneId}! Dán vào ChatGPT và nhấn Enter.`, 'ok');
      }
    });

    // Capture Buttons
    document.querySelector('#manual-capture-nv1-btn')?.addEventListener('click', async () => {
      const scene = getManualSelectedScene();
      if (!scene || !outputFolder) return;
      const sceneToken = `scene_${String(scene.id).padStart(3, '0')}`;
      const statusLabel = document.querySelector('#manual-nv1-status');
      if (statusLabel) statusLabel.textContent = 'Đang trích xuất ảnh từ ChatGPT...';
      safeAddPipelineLog('manual-gpt', 'running', `[Scene ${scene.id} - NV1] Đang trích xuất keyframe từ tab ChatGPT...`);

      const result = await window.videoPlannerAPI?.captureManualStage({
        projectPath: outputFolder,
        sceneId: sceneToken,
        stage: 'NV1',
        options: { force: true },
      }).catch((err) => ({ ok: false, error: err.message }));

      if (result?.ok) {
        scene.imagePath = result.artifactPath || result.filePath;
        scene.keyframePath = result.artifactPath || result.filePath;
        if (statusLabel) statusLabel.textContent = `✓ Đã lưu ${result.filePath}`;
        safeAddPipelineLog('manual-gpt', 'ok', `[Scene ${scene.id} - NV1] ✓ Đã lưu keyframe thành công: ${result.filePath} (${formatFileSize(result.size)})`);
        setStatus(`Scene ${scene.id}: Đã lưu ảnh keyframe! Hãy dán prompt NV2 tiếp theo.`, 'ok');
        showToast(`Scene ${scene.id}: Đã lưu ảnh keyframe thành công!`, 'success');
        markProjectDirty();
        persist();
        render();
        await renderManualChatGptUI();
      } else {
        if (statusLabel) statusLabel.textContent = `❌ ${result?.reason || result?.error || 'thất bại'}`;
        safeAddPipelineLog('manual-gpt', 'warning', `[Scene ${scene.id} - NV1] Lưu keyframe thất bại: ${result?.reason || result?.error}`);
        showToast(`Lưu keyframe thất bại: ${result?.reason || result?.error || 'lỗi'}`, 'error');
      }
    });

    document.querySelector('#manual-capture-nv2-btn')?.addEventListener('click', async () => {
      const scene = getManualSelectedScene();
      if (!scene || !outputFolder) return;
      const sceneToken = `scene_${String(scene.id).padStart(3, '0')}`;
      const statusLabel = document.querySelector('#manual-nv2-status');
      if (statusLabel) statusLabel.textContent = 'Đang trích xuất motion prompt...';
      safeAddPipelineLog('manual-gpt', 'running', `[Scene ${scene.id} - NV2] Đang trích xuất motion prompt từ tab ChatGPT...`);

      const result = await window.videoPlannerAPI?.captureManualStage({
        projectPath: outputFolder,
        sceneId: sceneToken,
        stage: 'NV2',
        options: { force: true },
      }).catch((err) => ({ ok: false, error: err.message }));

      if (result?.ok) {
        scene.motionPrompt = result.motionPrompt;
        scene.motionPromptPath = result.artifactPath || result.filePath;
        if (scene.imagePath && scene.motionPrompt) {
          scene.status = 'done';
          scene.completionStatus = 'keyframe_motion_complete';
          scene.progressStep = 'done';
        }
        if (statusLabel) statusLabel.textContent = `✓ Đã lưu ${result.filePath}`;
        safeAddPipelineLog('manual-gpt', 'ok', `[Scene ${scene.id} - NV2] ✓ Đã lưu motion prompt thành công: ${result.filePath} (${result.length} ký tự).`);
        setStatus(`Scene ${scene.id}: Đã lưu motion prompt thành công!`, 'ok');
        showToast(`Scene ${scene.id}: Đã lưu motion prompt thành công!`, 'success');
        markProjectDirty();
        persist();
        render();
        await renderManualChatGptUI();
      } else {
        if (statusLabel) statusLabel.textContent = `❌ ${result?.reason || result?.error || 'thất bại'}`;
        safeAddPipelineLog('manual-gpt', 'warning', `[Scene ${scene.id} - NV2] Lưu motion prompt thất bại: ${result?.reason || result?.error}`);
        showToast(`Lưu motion prompt thất bại: ${result?.reason || result?.error || 'lỗi'}`, 'error');
      }
    });

    // Re-capture buttons
    document.querySelector('#manual-recapture-nv1-btn')?.addEventListener('click', () => {
      showToast('Đang bắt lại keyframe...', 'info');
      document.querySelector('#manual-capture-nv1-btn')?.click();
    });

    document.querySelector('#manual-recapture-nv2-btn')?.addEventListener('click', () => {
      showToast('Đang bắt lại motion prompt...', 'info');
      document.querySelector('#manual-capture-nv2-btn')?.click();
    });

    // Step Guidance & Force Capture Buttons
    document.querySelector('#manual-force-capture-keyframe-btn')?.addEventListener('click', () => {
      document.querySelector('#manual-capture-nv1-btn')?.click();
    });

    document.querySelector('#manual-force-capture-motion-btn')?.addEventListener('click', () => {
      document.querySelector('#manual-capture-nv2-btn')?.click();
    });

    window.videoPlannerAPI?.onManualStepChanged?.(async (data) => {
      if (!data) return;
      const bannerTitle = document.querySelector('#manual-guidance-title');
      const bannerMsg = document.querySelector('#manual-guidance-message');
      const forceKeyframeBtn = document.querySelector('#manual-force-capture-keyframe-btn');
      const forceMotionBtn = document.querySelector('#manual-force-capture-motion-btn');

      if (data.step === 'WAITING_FOR_NV1_IMAGE') {
        if (bannerTitle) bannerTitle.textContent = 'Bước 1: Tạo Ảnh NV1';
        if (bannerMsg) bannerMsg.textContent = 'Đang đợi bạn tạo ảnh NV1 trên ChatGPT... (Prompt đã được copy vào Clipboard)';
        if (forceKeyframeBtn) forceKeyframeBtn.style.display = 'inline-block';
        if (forceMotionBtn) forceMotionBtn.style.display = 'none';
        if (data.prompt) {
          await window.videoPlannerAPI?.copyPromptToClipboard?.(data.prompt).catch(() => null);
        }
      } else if (data.step === 'WAITING_FOR_NV2_PROMPT') {
        if (bannerTitle) bannerTitle.textContent = 'Bước 2: Tạo Motion Prompt NV2';
        if (bannerMsg) bannerMsg.textContent = 'Đã nhận diện Keyframe! Đang đợi bạn tạo Motion Prompt NV2...';
        if (forceKeyframeBtn) forceKeyframeBtn.style.display = 'none';
        if (forceMotionBtn) forceMotionBtn.style.display = 'inline-block';
        if (data.prompt) {
          await window.videoPlannerAPI?.copyPromptToClipboard?.(data.prompt).catch(() => null);
        }
      }
      await renderManualChatGptUI();
    });

    // Toolbar Buttons
    document.querySelector('#manual-start-watcher-btn')?.addEventListener('click', () => {
      if (manualWatcherTimer) {
        stopManualWatcher();
      } else {
        startManualWatcher();
      }
    });

    document.querySelector('#manual-audit-disk-btn')?.addEventListener('click', async () => {
      setStatus('Đang quét và kiểm tra output các scene trên ổ đĩa...', 'running');
      await syncProjectSceneFolders({ repairFromDisk: true }).catch(() => null);
      await renderManualChatGptUI();
      setStatus('Đã hoàn tất quét đĩa.', 'ok');
      showToast('Đã hoàn tất quét và đồng bộ output từ ổ đĩa.', 'success');
    });

    document.querySelector('#manual-open-scene-folder-btn')?.addEventListener('click', async () => {
      const scene = getManualSelectedScene();
      if (!scene || !outputFolder) return;
      const sceneToken = `scene_${String(scene.id).padStart(3, '0')}`;
      const separator = outputFolder.includes('\\') ? '\\' : '/';
      const sceneFolderPath = `${outputFolder}${separator}${sceneToken}`;
      await window.videoPlannerAPI?.openSceneFolder(sceneFolderPath).catch(() => null);
    });

    // --- UI/UX Modernization: Lightbox Modal ---
    function openLightbox(mediaSrc, caption = '') {
      const modal = document.querySelector('#asset-lightbox-modal');
      const mediaContainer = document.querySelector('#lightbox-media');
      const captionEl = document.querySelector('#lightbox-caption');
      if (!modal || !mediaContainer) return;

      if (mediaSrc.endsWith('.mp4') || mediaSrc.endsWith('.webm')) {
        mediaContainer.innerHTML = `<video src="${mediaSrc}" controls autoplay style="max-width: 85vw; max-height: 70vh;"></video>`;
      } else {
        mediaContainer.innerHTML = `<img src="${mediaSrc}" alt="Asset Preview" style="max-width: 85vw; max-height: 70vh; object-fit: contain;" />`;
      }

      if (captionEl) {
        captionEl.textContent = caption;
        captionEl.style.display = caption ? 'block' : 'none';
      }

      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
    }

    function closeLightbox() {
      const modal = document.querySelector('#asset-lightbox-modal');
      if (!modal) return;
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
      const mediaContainer = document.querySelector('#lightbox-media');
      if (mediaContainer) mediaContainer.innerHTML = '';
    }

    document.querySelector('#lightbox-close-btn')?.addEventListener('click', closeLightbox);
    document.querySelector('#asset-lightbox-modal .lightbox-backdrop')?.addEventListener('click', closeLightbox);
    document.querySelector('#asset-lightbox-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'asset-lightbox-modal') closeLightbox();
    });

    // --- UI/UX Modernization: Storyboard Grid & Table View ---
    function renderStoryboardUI() {
      const gridContainer = document.querySelector('#storyboard-grid-container');
      const tableBody = document.querySelector('#storyboard-table-body');
      if (!gridContainer || !tableBody) return;

      if (!project?.scenes?.length) {
        gridContainer.innerHTML = '<div class="storyboard-empty-state">Chưa có scene nào trong project. Vui lòng tạo hoặc mở project.</div>';
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">Chưa có dữ liệu scene</td></tr>';
        return;
      }

      let gridHtml = '';
      let tableHtml = '';

      project.scenes.forEach((scene) => {
        const hasImage = Boolean(scene.imagePath || scene.keyframePath);
        const hasMotion = Boolean(scene.motionPrompt || scene.motionPromptPath);
        
        let statusClass = 'pending';
        let statusLabel = '⚪ Chưa bắt đầu';
        if (hasImage && hasMotion) {
          statusClass = 'ready';
          statusLabel = '✓ Sẵn sàng';
        } else if (hasImage) {
          statusClass = 'pending';
          statusLabel = '⏳ Thiếu NV2';
        }

        let imageSrc = '';
        if (scene.imagePath || scene.keyframePath) {
          const rawPath = scene.imagePath || scene.keyframePath;
          imageSrc = rawPath.startsWith('data:') ? rawPath : `file:///${String(rawPath).replaceAll('\\', '/')}`;
        }

        const promptText = scene.imagePrompt || scene.original || 'Chưa có prompt';
        const motionText = scene.motionPrompt || 'Chưa có motion prompt';

        // Grid card
        gridHtml += `
          <div class="storyboard-card ${Number(manualSelectedSceneId) === scene.id ? 'active-card' : ''}" data-scene-id="${scene.id}">
            <div class="storyboard-card-thumb-wrap" data-thumb-src="${imageSrc}" data-scene-title="Scene ${scene.id}">
              ${imageSrc
                ? `<img class="storyboard-card-thumb" src="${imageSrc}" alt="Scene ${scene.id} Thumbnail" loading="lazy" />`
                : `<div class="storyboard-card-placeholder"><span>🎬</span><span>Chưa có ảnh NV1</span></div>`
              }
              <span class="storyboard-card-badge">Scene ${scene.id}</span>
              <span class="storyboard-card-status-badge ${statusClass}">${statusLabel}</span>
            </div>
            <div class="storyboard-card-body">
              <h4 class="storyboard-card-title">Scene ${scene.id}</h4>
              <div class="storyboard-card-prompt-snippet" title="${escapeHtml(promptText)}"><strong>NV1:</strong> ${escapeHtml(promptText)}</div>
              <div class="storyboard-card-prompt-snippet" title="${escapeHtml(motionText)}"><strong>NV2:</strong> ${escapeHtml(motionText)}</div>
              <div class="storyboard-card-actions">
                <button class="ghost mini storyboard-select-btn" data-scene-id="${scene.id}" type="button">🎯 Chọn Scene</button>
                <div style="display: flex; gap: 4px;">
                  <button class="ghost mini storyboard-quick-nv1-btn" data-scene-id="${scene.id}" type="button" title="Copy Prompt NV1">📋 NV1</button>
                  <button class="ghost mini storyboard-quick-nv2-btn" data-scene-id="${scene.id}" type="button" title="Copy Prompt NV2">📋 NV2</button>
                </div>
              </div>
            </div>
          </div>
        `;

        // Table row
        tableHtml += `
          <tr>
            <td><strong>Scene ${scene.id}</strong></td>
            <td>
              ${imageSrc
                ? `<img src="${imageSrc}" alt="Scene ${scene.id}" style="width: 56px; height: 32px; object-fit: cover; border-radius: 4px; cursor: pointer;" class="table-thumb" data-thumb-src="${imageSrc}" data-scene-title="Scene ${scene.id}" />`
                : `<span style="color: #64748b; font-size: 11px;">Chưa có ảnh</span>`
              }
            </td>
            <td style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(promptText)}">${escapeHtml(promptText)}</td>
            <td style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(motionText)}">${escapeHtml(motionText)}</td>
            <td><span class="storyboard-card-status-badge ${statusClass}" style="position: static;">${statusLabel}</span></td>
            <td>
              <button class="ghost mini storyboard-select-btn" data-scene-id="${scene.id}" type="button">🎯 Chọn</button>
            </td>
          </tr>
        `;
      });

      gridContainer.innerHTML = gridHtml;
      tableBody.innerHTML = tableHtml;

      // Bind event handlers
      gridContainer.querySelectorAll('.storyboard-card-thumb-wrap').forEach((wrap) => {
        wrap.addEventListener('click', () => {
          const src = wrap.dataset.thumbSrc;
          const title = wrap.dataset.sceneTitle;
          if (src) openLightbox(src, title);
        });
      });

      tableBody.querySelectorAll('.table-thumb').forEach((thumb) => {
        thumb.addEventListener('click', () => {
          const src = thumb.dataset.thumbSrc;
          const title = thumb.dataset.sceneTitle;
          if (src) openLightbox(src, title);
        });
      });

      document.querySelectorAll('.storyboard-select-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const sceneId = Number(btn.dataset.sceneId);
          if (sceneId) {
            manualSelectedSceneId = sceneId;
            const select = document.querySelector('#manual-scene-select');
            if (select) select.value = String(sceneId);
            await renderManualChatGptUI();
            const sc = project?.scenes?.find((s) => s.id === sceneId);
            if (sc) await syncManualStageBaseline(sc);
            showToast(`Đã chuyển sang Scene ${sceneId}`, 'info');
            document.querySelector('#manual-chatgpt-section')?.scrollIntoView({ behavior: 'smooth' });
          }
        });
      });

      gridContainer.querySelectorAll('.storyboard-quick-nv1-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const sceneId = Number(btn.dataset.sceneId);
          const scene = project?.scenes?.find((s) => s.id === sceneId);
          if (scene) {
            const text = scene.imagePrompt || scene.original || '';
            await copyTextToClipboard(text, btn);
            showToast(`Scene ${sceneId}: Đã copy prompt NV1!`, 'success');
          }
        });
      });

      gridContainer.querySelectorAll('.storyboard-quick-nv2-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const sceneId = Number(btn.dataset.sceneId);
          const scene = project?.scenes?.find((s) => s.id === sceneId);
          if (scene) {
            const text = scene.motionPrompt || '';
            await copyTextToClipboard(text, btn);
            showToast(`Scene ${sceneId}: Đã copy prompt NV2!`, 'success');
          }
        });
      });
    }

    // Storyboard View Switcher
    const gridViewBtn = document.querySelector('#view-mode-grid-btn');
    const tableViewBtn = document.querySelector('#view-mode-table-btn');
    const gridContainerEl = document.querySelector('#storyboard-grid-container');
    const tableContainerEl = document.querySelector('#storyboard-table-container');

    gridViewBtn?.addEventListener('click', () => {
      gridViewBtn.classList.add('active');
      tableViewBtn?.classList.remove('active');
      if (gridContainerEl) gridContainerEl.style.display = 'grid';
      if (tableContainerEl) tableContainerEl.style.display = 'none';
    });

    tableViewBtn?.addEventListener('click', () => {
      tableViewBtn.classList.add('active');
      gridViewBtn?.classList.remove('active');
      if (gridContainerEl) gridContainerEl.style.display = 'none';
      if (tableContainerEl) tableContainerEl.style.display = 'block';
    });

    // Floating Mini-Bar Mode
    const toggleMiniBarBtn = document.querySelector('#toggle-mini-bar-btn');
    toggleMiniBarBtn?.addEventListener('click', async () => {
      try {
        const res = await window.videoPlannerAPI?.toggleMiniBar();
        if (res && !res.ok && res.error) {
          showToast(`Không thể bật mini-bar: ${res.error}`, 'error');
        }
      } catch (err) {
        showToast(`Lỗi mini-bar: ${err.message}`, 'error');
      }
    });

    window.videoPlannerAPI?.onMiniBarStateChanged?.((data) => {
      if (data?.active) {
        document.body.classList.add('mini-bar-mode');
        if (toggleMiniBarBtn) toggleMiniBarBtn.textContent = '🔲 Mở rộng Cửa sổ';
        showToast('Đã chuyển sang chế độ Mini-Bar nổi (Alt+Space)', 'info');
      } else {
        document.body.classList.remove('mini-bar-mode');
        if (toggleMiniBarBtn) toggleMiniBarBtn.textContent = '📌 Ghim Mini-Bar';
        showToast('Đã khôi phục giao diện tiêu chuẩn', 'info');
      }
    });

    // Global Hotkeys
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const lightboxModal = document.querySelector('#asset-lightbox-modal');
        if (lightboxModal?.hasAttribute('open')) {
          closeLightbox();
          e.preventDefault();
          return;
        }
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === '1') {
          e.preventDefault();
          document.querySelector('#manual-copy-nv1-btn')?.click();
        } else if (e.key === '2') {
          e.preventDefault();
          document.querySelector('#manual-copy-nv2-btn')?.click();
        } else if (e.key === 'k' || e.key === 'K') {
          e.preventDefault();
          document.querySelector('#manual-capture-nv1-btn')?.click();
        } else if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          document.querySelector('#manual-capture-nv2-btn')?.click();
        } else if (e.code === 'Space' || e.key === ' ') {
          e.preventDefault();
          document.querySelector('#toggle-mini-bar-btn')?.click();
        }
      }
    });

    // Initial render
    renderManualChatGptUI();
  }

  bindManualChatGptUi();
})();
