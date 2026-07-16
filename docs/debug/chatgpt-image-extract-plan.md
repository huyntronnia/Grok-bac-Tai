# ChatGPT Image Extraction Fix Plan

## 1. Root Cause
- **Redundant Adapter Waits**: In the `waitForLatestChatGPTGeneratedImage` loop, if a candidate image is found but not yet marked stable (`stableTicks < 3`), the loop restarts and calls `waitForChatGptImageGenerationDoneBeforeExtract` again. The adapter waits for `stableFor = 4000ms` on every single iteration, adding 12+ seconds of idle time.
- **Infinite Loop on Unextractable Images**: If an image is visible but cannot be fetched (e.g., cross-origin issues or temporary network failure), `classifyChatGptImageReadiness` returns `image_visible_but_not_extractable`. The pipeline loops immediately without sleep because the adapter is already in `READY` state. This creates an endless high-CPU loop.
- **Canvas Loading Desync**: The Runtime Monitor considers all canvas elements "complete" immediately because `<canvas>` tags do not have loading states like `<img>` elements. However, ChatGPT draws a dotted animation on the canvas while generating. The Extractor rejects it (`isChatGptDotLoadingCanvasAsset`), but the Monitor stays in `READY` state because mutations have stopped.

## 2. Impact
- High CPU utilization and bloated logs during extraction failure.
- Slow keyframe extraction times (minimum 12s delay).
- Intermittent pipeline stalls when ChatGPT canvas loading indicator is active.

## 3. Proposed Fix
### Task A: Prevent Redundant Adapter Calls & Busy Loops in `chatgpt_pipeline.js`
- Skip `waitForChatGptImageGenerationDoneBeforeExtract` on subsequent iterations of the stable signature loop if the image has already been verified as done.
- If the image is `image_visible_but_not_extractable`, sleep for 2000ms to prevent CPU flooding, and fallback to element-screenshot crop after 5 consecutive extraction failures.

### Task B: Track Canvas Loading State in Runtime Monitor
- Update `collectMetrics` in `chatgpt_runtime_monitor.js` to inspect `<canvas>` elements.
- If a canvas element contains classes indicating loading (e.g., `.dot`, `.loading`, `.aspect-square div div` containing spinner classes), or if `isChatGptDotLoadingCanvasAsset` condition is met, set `placeholderVisible = true`.

## 4. Files to Modify
- `d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_pipeline.js` (Task A)
- `d:/bac_tai/Grok-bac-Tai/electron/main/chatgpt/chatgpt_runtime_monitor.js` (Task B)

## 5. Risks & Regression
- **Regression**: Checking canvas classes in the monitor could be sensitive to OpenAI frontend changes. 
- **Mitigation**: Use broad class patterns and fallback to standard mutation idle checks if classes change.

## 6. Verification
- Verify that `npm test` and `chatgpt-runtime-monitor.test.js` pass.
