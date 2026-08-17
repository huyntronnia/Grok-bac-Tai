# Vidora V6 — VeoUp batch stabilization implementation

Date: 2026-07-19

## Outcome

The NV1/NV2-only pipeline now collects VeoUp inputs incrementally after every completed scene. Project scan and automatic pipeline completion use one canonical manifest/coordinator path. Batch import no longer pastes every absolute image path into the Windows **File name** field.

The existing VeoUp per-scene video flow remains separate and continues to submit one keyframe path at a time.

## New project artifacts

```text
project/
├── scene_001/
│   ├── scene_001_keyframe.png
│   └── motion_prompt.txt
├── keyframes/
│   ├── scene_001_keyframe.png
│   └── _batch_ready/
│       └── scene_001_keyframe.png
├── motion_prompts/
│   └── scene_001_motion_prompt.txt
├── veoup_prompts_ready.txt
└── pipeline_state.json
```

- `keyframes/` and `motion_prompts/` are updated after each NV1/NV2 scene succeeds.
- `veoup_prompts_ready.txt` is rebuilt in scene-number order after each readiness change.
- `_batch_ready/` is a derived exact-selection folder. It contains only files in the validated manifest and prefers hard links to avoid another full image copy; it falls back to atomic copying when hard links are unavailable.
- The original scene assets remain the recovery source for legacy V6 projects.

## Atomic and durable behavior

- Text/JSON writes use temp-file + sync + replace.
- Binary keyframe staging uses atomic copy + validation.
- All `pipeline_state.json` writes share the same per-project write queue.
- A regenerated scene is marked not ready before regeneration and becomes ready only after both new assets are staged successfully.
- Image headers, non-empty prompts, scene pairing, duplicates, expected IDs, sizes and hashes are checked before submission.
- Old V6 projects are migrated lazily during scan by reconstructing canonical assets from each `scene_XXX` folder.

New scene state fields include:

- `readyForVeoUp`
- `veoUpReadyAt`
- `veoUpCollectionVersion`
- `veoUpKeyframePath`
- `veoUpMotionPromptPath`
- `veoUpKeyframeSize`
- `veoUpKeyframeHash`
- `veoUpMotionPromptHash`
- `veoUpCollectionError`

## Batch submission behavior

1. Reconcile canonical assets against the requested scene IDs.
2. Build a strict manifest for automatic pipeline completion. Manual scan may submit only clean scenes and reports every skipped scene ID.
3. Prepare `keyframes/_batch_ready` with the exact validated set.
4. Open the native Windows file dialog.
5. Navigate to `_batch_ready`, focus **File name**, enter the first filename, press `Shift+Tab`, then `Ctrl+A` in the file list.
6. Verify the native selection when UI Automation exposes it; otherwise require an exact prepared-folder count and a successfully closed dialog.
7. Paste the exact prompt file and validate either visible image/prompt rows or the stronger dialog-selection + prompt-count + stable-VeoUp-surface proof.
8. Invoke Generate only after validation succeeds.

This removes the Windows control-length failure caused by a long string of dozens or hundreds of absolute paths. It also avoids failing solely because VeoUp virtualizes its rows and UI Automation reports zero visible rows.

## Compatibility boundaries

- NV1 image generation, NV2 same-conversation handling and Request 2 hydration (10 previous keyframes) are unchanged.
- `.vdra` autosave remains path-only; no base64 asset embedding was reintroduced.
- Per-scene VeoUp uses `veoup_prompt_current.txt`, so it cannot overwrite the batch aggregate file.
- Pre-submission cleanup, Generate acknowledgement, output polling and post-generation cleanup remain in place.
- The dead legacy scanner, old prompt builder and unused non-atomic shared-output helper were removed.

## Diagnostics

Failed batch state/log entries now retain:

- expected/detected/image/prompt row counts;
- selected file count and selection verification status;
- selection and row-verification methods;
- expected/ready/skipped scene counts and IDs.

## Verification

- JavaScript syntax checks passed for all changed runtime files.
- All **44/44** automated Vidora test files passed.
- Scale tests cover a 300-scene manifest and a 75-file exact batch-selection folder.
- Concurrency tests verify that simultaneous scene staging does not lose `pipeline_state.json` entries.

The real VeoUp GUI is Windows/Qt-specific and cannot be exercised in the Linux build workspace. Before a long production run, perform one Windows smoke test with 2 scenes and one batch test with at least 75 scenes, checking the new `selectionMethod` and `verificationMethod` fields in the log.
