# ChatGPT Image Extraction Flow & Runtime Monitor Audit

## 1. Pipeline Image Flow (Luồng từ lúc ChatGPT trả ảnh đến lúc lưu keyframe)
- **Prompt Submission**: The pipeline submits a prompt using `sendPromptViaCdpInput` (`chatgpt_send.js`).
- **Wait Stage**: It calls `waitForLatestChatGPTGeneratedImage` (`chatgpt_pipeline.js`). Inside, it delegates to `waitForChatGptImageGenerationDoneBeforeExtract` which uses `ChatGptPipelineAdapter.waitForImageReady(900000, 4000)`.
- **Ready State**: `ChatGptPipelineAdapter` waits for the Runtime Monitor to transition to the `READY` state with a confidence score of `1.0` (which includes stability logic).
- **Hydration Verification**: Once `READY`, the pipeline evaluates `ensureChatGptImageLoadedAndHydratedScript` on the page to confirm elements exist, scroll them into view, and check if placeholders have disappeared.
- **Bytes Extraction**: It calls `extractLatestChatGPTGeneratedImageBytes` which executes `extractLatestChatGPTGeneratedImageBytesScript` to find the `canvas` or `img` tags under assistant message roles index `>= minAssistantRootIndex`.
  - For canvas: extracts `canvas.toDataURL("image/png")`.
  - For images: performs `fetch(src)` to download the blob and encodes to base64.
  - Fallbacks: If direct fetching fails, it tries network-captured URLs or element-level screenshots (`captureChatGptImageElementScreenshot`).
- **Validation & Writing**: The base64 buffer is decoded to PNG (`decodeImageBufferToPng`), validated using magic bytes and dimensions (`validateSavedImageFile`), and finally written to `options.outputPath`.

## 2. Runtime Monitor State Publishing (Cách Monitor công bố trạng thái)
- **Observers**: Injected browser-side `MutationObserver` and `ResizeObserver` monitor DOM changes and push `DOM_METRICS` payloads via `chatgptUiMonitorBinding` to the main process.
- **CDP Network Listeners**: Main process listens to `Network.responseReceived` and `Network.loadingFinished` to track image asset load events and increment/decrement active requests.
- **Evaluation Loop**:
  - `onBindingCalled` receives metrics.
  - Runs `runIntentDetector()`.
  - Runs `runStateMachine()`.
  - Runs `computeConfidence()`.
  - Calls `triggerStateUpdate()` which emits `"event"` carrying the updated state, intent, confidence, and snapshot metrics.

## 3. Adapter Waiting Target (Adapter đợi trạng thái nào)
- **Image Generation Target**: `waitForImageReady` waits for state `"READY"`, intent `"IMAGE_GENERATION"`, and confidence `>= 1.0` (stable).
- **Text Response Target**: `waitForResponseReady` waits for state `"READY"`, text intents, and confidence `>= 1.0`.

## 4. Image Extraction Mechanism (Cách Extractor lấy ảnh)
- The script `extractLatestChatGPTGeneratedImageBytesScript` queries `[data-message-author-role="assistant"]` messages.
- It identifies `canvas` (extracts data-URL) and `img` elements.
- It filters out elements matching `hasSpinner()` (which detects terms like "loading", "generating", etc.).
- It tries to fetch the resource URL directly using page-context `fetch` to bypass cross-origin issues and obtain raw base64 bytes.

## 5. Legacy Detector & Polling Check (Sự tồn tại của các detector và polling cũ)
- `chatgpt_dom.js` still contains deprecated DOM scrapers (`readChatGptImageStateScript`, `detectChatGptActiveGenerationScriptStrict`).
- In `chatgpt_pipeline.js` -> `waitForLatestChatGPTGeneratedImage`, after `preExtractWait` completes, the code enters a loop:
  `while (Date.now() - attemptStartedAt < 900000) { ... }`
  Within this loop, it calls `preExtractWait` repeatedly if extraction fails, but wait! If extraction succeeds, it loops up to **3 times** (`stableTicks >= 3`) to ensure image signature stability.
  In each tick of this loop, it calls `waitForChatGptImageGenerationDoneBeforeExtract`, which calls `adapter.waitForImageReady(900000, 4000)` AGAIN.
  This introduces significant, redundant delay (up to 12s of idle waiting) even when the image is fully ready and stable.

## 6. Discrepancies between Monitor and Extractor (Bất đồng bộ nguồn dữ liệu)
- **Monitor metrics vs Extractor DOM queries**:
  - Runtime Monitor uses broad queries (`main form [data-testid*='attachment']`, etc.) and basic assistant counts `assistants.length` to identify state.
  - Extractor uses `rootsFrom` which gathers elements matching message article turn selectors, parses images/canvas elements, and applies strict filters like natural width/height `>= 256` and visible boxes `>= 128`.
  - There is a mismatch: The monitor might transition to `READY` (because text streaming stopped, network requests are 0, and mutations settled for 3s), but the Extractor might still reject the image because it is too small, or is in an older assistant root index, or is a loading canvas placeholder.
  - Mismatch example: In `chatgpt_pipeline.js` line 1034, `isChatGptDotLoadingCanvasAsset` is used to reject canvas elements with a specific class or loading pattern. The monitor does not check this dot canvas condition! It simply increments `imageCompleteCount` because the canvas is structurally complete, transitioning to `READY` state too early, while the Extractor subsequently throws an error.

## 7. Race Conditions
- **State Settle vs Image Loading**:
  - The monitor transitions to `READY` once DOM mutations stop for `3.1s`.
  - However, the actual image resource download (`img.src` -> image decoding) or canvas drawing might finish *after* mutations stop.
  - If the image is not fully loaded, the Extractor will fail to fetch or verify it.
- **CDP Event Loop Lags**:
  - The monitor updates on `DOM_METRICS` debounced by 50ms. If a rapid state transition occurs and the page goes idle, the last message might arrive late, causing `stableFor` checks in the Adapter to start with stale metrics.

## 8. Infinite Wait Scenarios (Điều kiện chờ vô hạn)
- If the image is successfully generated, but the browser script fails to fetch the image bytes (e.g., due to CORS or temporary network issues), `extractLatestChatGPTGeneratedImageBytes` returns `ok: false`.
- The readiness classifier `classifyChatGptImageReadiness` returns `image_visible_but_not_extractable`.
- Since the state is not `still_generating` and not `real_stall` yet, the pipeline loops and calls `preExtractWait` which calls `adapter.waitForImageReady`.
- But the monitor state is ALREADY `READY`. The adapter immediately resolves.
- This creates an endless fast-polling loop that consumes CPU, repeatedly fails to extract, and loops indefinitely until the 15-minute outer timeout is reached.

## 9. States Never Published
- `WAITING_ASSISTANT`: Defined in watchdog rules but never actually transitioned to in `runStateMachine`. The monitor falls back directly to `IDLE` after typing ends, which is confusing and can cause early `READY` transitions if not settled.

## 10. Callbacks Never Called
- Some console and exception bindings might not trigger if CDP connection drops or if SPA navigations fail to re-register them, although this is guarded by start/stop logic.
