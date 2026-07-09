# ChatGPT Image Extraction Flow Post-Audit

## 1. Runtime Monitor
- **Changes**: Added a canvas loading verification check to `collectMetrics()`. It scans `<canvas>` elements for classes indicating generating/loading state (e.g., `.dot`, `.loading` or parent divs with `.preparing`, `.loading` classes). If present, it sets `placeholderVisible = true`.
- **Verdict**: Verified. Correctly halts early transition to `READY` state while a dotted canvas is active.

## 2. Adapter
- **Verdict**: Verified. Retains decoupled policy checking using `waitForImageReady` without business logic intrusion.

## 3. Image Extractor & Pipeline
- **Changes**:
  - Implemented `hasWaitedOnce` state to prevent redundant adapter waits (no longer calls `waitForChatGptImageGenerationDoneBeforeExtract` continuously on subsequent loops once state is `READY`).
  - Added 2000ms polling throttle inside the wait loop if we already got `READY` state once, preventing CPU starvation.
  - Interlocked `isChatGptDotLoadingCanvasAsset` check inside the `waitForLatestChatGPTGeneratedImage` loop. If the extracted image matches loading canvas dimensions and sizes, it is immediately discarded (`chosen = null`), allowing the pipeline to continue waiting instead of returning a partial canvas to the saver and throwing.
- **Verdict**: Verified. Eliminates CPU busy-looping and prevents early canvas extraction failures.

## 4. Send & Recovery
- **Verdict**: Verified. Preserves strict send validations and logging improvements made in previous turns.

## 5. Potential Issues & Post-Implementation Checklist
- **OpenAI Class Changes**: If OpenAI changes canvas classes to something else, the monitor fallback depends on normal DOM mutation settle times (3s), which will eventually resolve, but early extraction checks using `isChatGptDotLoadingCanvasAsset` in the main process still protect the pipeline.
- No other potential regression detected.
