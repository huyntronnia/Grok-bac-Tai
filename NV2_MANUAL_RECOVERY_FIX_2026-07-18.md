# Vidora v6 — NV2 manual recovery fix

Date: 2026-07-18

## Symptom

After a scene exhausted both recovery cycles, Vidora saved the checkpoint and paused. Pressing **Start pipeline** again could enter the same stale `NV2_SENT` wait, use the already exhausted in-memory retry counter, and pause again. Deleting the scene images appeared to fix it only because that forced NV1 to rebuild the scene state.

## Root cause

- A new renderer run ID did not reset the per-scene recovery counter in the main process.
- The durable `recoveryLimitReached` state was not explicitly reopened by a manual Start.
- On an NV2 resume, the current assistant snapshot could be captured after the owned NV2 user turn. That made an already completed response look like baseline history, while an orphaned user turn could be waited on again without a controlled resend.

## Implemented behavior

1. A manual Start after `recoveryLimitReached` marks only the affected scene for recovery.
2. The main process resets only that scene's retry budget and durable pause flags.
3. A valid scene-scoped keyframe is preserved; no asset is deleted.
4. NV1 is not rerun solely to clear recovery state.
5. NV2 anchors its baseline immediately before the latest owned NV2 user turn:
   - completed response: adopt it;
   - active generation: continue waiting;
   - idle owned turn with no assistant response: upload the same valid keyframe and perform one controlled resend;
   - missing/stale owned turn: consume the one-shot recovery request and use the existing normal send path.
6. The manual recovery request is scoped by pipeline run ID, so a stale request cannot leak into a later run.
7. Stop/cancel now reaches the NV2 response wait through the current run ID.
8. Durable recovery flags are restored into scene state when reopening a project.

## Files changed

- `electron/renderer.js`
  - Collect and consume scene-scoped manual recovery requests on explicit Start.
  - Clear the pending set on Stop.
- `electron/main/pipeline/pipeline_runner.js`
  - Reopen the retry budget and durable state for exactly one requested scene.
  - Preserve validated keyframe assets and forward the run ID into NV2.
- `electron/main/chatgpt/chatgpt_pipeline.js`
  - Adopt active/completed owned turns and perform a one-shot resend only for an idle orphaned NV2 turn.
  - Forward the run ID to the response wait for cancellation.
- `electron/main/state/state.js`
  - Build an NV2 response baseline at the owned user-turn boundary.
- `electron/main.js`
  - Merge durable recovery-limit state when loading a project.
- `tests/nv2-manual-recovery-reset.test.js`
  - Cover retry reset, exact-scene isolation, keyframe preservation, orphan/adopted response detection and wiring guards.

## Compatibility boundaries

- Normal starts do not set `manualRecoveryReset` and continue through the existing flow.
- NV1 generation, VeoUp submission, batch coordination, autosave format and asset paths are unchanged.
- No scene image, motion prompt or video file is removed by the new recovery reset.

## Validation

- JavaScript syntax check: passed for every changed runtime file and the new test.
- Targeted NV2 manual-recovery test: passed.
- Full regression suite: **42/42 test files passed**.
- Covered suites include NV1/NV2 ownership, stable/in-place NV2 responses, pipeline stop/cancel, durable recovery, `.vdra` autosave, long-run memory/gray-wrapper regressions and all VeoUp batch/lifecycle tests.

The automated suite does not replace a live endurance run against the real ChatGPT and VeoUp interfaces. A practical acceptance check is to reproduce an exhausted NV2 scene, close the notice, press Start once, and verify that the existing keyframe remains unchanged while the scene either adopts the existing response or performs one controlled NV2 resend.
