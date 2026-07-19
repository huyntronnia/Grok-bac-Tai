# Vidora v6 — Request 2 uses 10 recent keyframes

Date: 2026-07-18

## Change

- Added the shared constant `CHATGPT_HYDRATION_KEYFRAME_LIMIT = 10`.
- Fresh-chat Request 2 now uploads up to 10 keyframes from scenes before the current scene.
- Recovery/rotation Request 2 uses the same 10-keyframe limit.
- The Request 2 instruction now states the configured limit instead of hard-coding five scenes.

## Unchanged behavior

- Keyframes are still sorted from the nearest previous scene backwards.
- The current scene is excluded from the normal Request 2 continuity set.
- Upload remains sequential and retains the existing acknowledgement and response-validation gates.
- NV1, NV2, VeoUp, batch coordination and autosave logic are unchanged.

## Validation

- JavaScript syntax check passed.
- Request 2, stage-isolation and rotation-policy checks passed through the project test runner.
- Full regression suite passed: **42/42 test files**.
