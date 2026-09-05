# Manual ChatGPT Capture Mode — Code Map & Function Contract

## 1. Overview

This document maps exact current codebase functions for implementing the `manualChatGPT` execution mode in Vidora.

---

## 2. Source Mapping & Reusable Primitives

### 2.1 ChatGPT DOM & Monitoring (`electron/main/chatgpt/chatgpt_dom.js`, `chatgpt_runtime_monitor.js`)
- `getConversationState(page)` — Extract current conversation metadata (user turns, assistant turns, conversationId).
- `countChatGptAssistantRootsScript` — Count assistant roots in current DOM.
- `countChatGptImageAgentTurnsScript` — Count image agent turns in current DOM.
- `isChatGptActivelyGenerating(page)` — Check if ChatGPT is currently generating.
- `chatGptRuntimeMonitor` — Runtime observer for generation/streaming status.

### 2.2 ChatGPT Pipeline Extraction (`electron/main/chatgpt/chatgpt_pipeline.js`)
- **NV1 Image Extraction**:
  - `waitForLatestChatGPTGeneratedImage(page, ...)`
  - `extractLatestChatGPTGeneratedImageBytes(page, ...)`
  - `saveChatGPTGeneratedImageAsset(imageBytes, targetPath)`
  - `validateSavedImageFile(targetPath)`
- **NV2 Stable Text Extraction**:
  - `waitForChatGptResponse(page, ...)`
  - `validateMotionPromptResponse(text)`
- **Ownership & Stability**:
  - `validateNv2ResponseOwnership(domState, baseline)` (to be adapted/extended for manual mode without prompt hash requirement)

### 2.3 State Management (`electron/main/state/state.js`)
- `writeSceneSnapshot(projectPath, sceneId, snapshot)` — Write scene snapshot JSON atomically.
- `readSceneSnapshot(projectPath, sceneId)` — Read scene snapshot JSON.
- `verifyDraftOwnership(snapshot, ...)` — Draft/baseline ownership helper.

### 2.4 Storage & Atomic Writes (`electron/main/project/project_store.js`)
- `writeJsonFileAtomic(filePath, data)` — Atomic JSON write.
- `enqueueProjectWrite(projectPath, writeFn)` — Enqueue project write operations.

### 2.5 Pipeline Runner & Gating (`electron/main/pipeline/pipeline_runner.js`)
- `runScenePipeline(projectPath, sceneId, options)` — Main pipeline runner entry point.
- `materializeSceneRequestFiles` — Materializes prompt files.
- `validateKeyframeFile`, `validateMotionPromptTextContent` — Asset validation helpers.

---

## 3. Bypass / Guard List (Must NOT be invoked in manual mode)

The following automatic prompt-sending and rotation functions MUST be guarded or bypassed in `manualChatGPT` mode:
1. `sendPromptViaCdpInput` (`electron/main/chatgpt/chatgpt_send.js`)
2. `sendNv2PromptViaDeepCdpInput` (`electron/main/chatgpt/chatgpt_send.js`)
3. `clickSendButtonViaCdp` (`electron/main/chatgpt/chatgpt_send.js`)
4. `forceCleanChatGptNewChatRotation` (`electron/main/chatgpt/chatgpt_recovery.js`)
5. Automatic retry/resend loops in `generateImageAndMotionWithChatGPT` and `generateMotionPromptWithChatGPT` (`electron/main/chatgpt/chatgpt_pipeline.js`).

---

## 4. Output Contract

Output paths per scene (`scene_xxx/`):
- `request_1_response.txt` — UTF-8 text response for Request 1.
- `request_2_response.txt` — UTF-8 text response for Request 2.
- `scene_xxx_keyframe.png` — Validated keyframe image for NV1.
- `motion_prompt.txt` — Validated motion prompt text for NV2.
- `scene_snapshot.json` — Durably updated with `manualChatGpt` status.

Downstream tools (VeoUp, disk audit, resume) consume these exact artifacts without modification.
