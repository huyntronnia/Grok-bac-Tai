# Vidora TXT real-attachment fix — 2026-08-04

## Baseline

- Applied on top of SHA-256 `c6add000a2cc8efd2167e3db16fca4032a696a712cf3e017c75851a7df8390de`.
- Keeps the automatic pipeline recovery behavior inherited from `f84b…90ffa`.

## Observed failure

The ChatGPT composer contained the short control prompt but displayed no TXT
attachment chip. The previous detector could treat `input.files` as proof that
the upload succeeded even when the selected input was not the active ChatGPT
attachment input.

## Changes

- Open the ChatGPT `+` menu explicitly.
- Select `Add photos & files` / the localized equivalent.
- Use Playwright's real `filechooser` event when available.
- Fall back to a compatible input only after the attachment menu has been
  opened.
- Treat `input.files` as diagnostic information only.
- Require visible composer evidence (attachment filename and/or its remove
  control) before accepting an upload.
- Verify each newly uploaded file before continuing to the next NV2 attachment.
- Require the complete attachment set again immediately before Send.
- Stop the current attempt before inserting/sending the control prompt if no
  visible attachment was created; the existing automatic recovery loop then
  retries the scene.

## Scope

The shared uploader is used by both flows:

- NV1: `scene_XXX_nv1_request.txt`.
- NV2: `scene_XXX_keyframe.*` and `scene_XXX_nv2_request.txt`.

## Validation

- All JavaScript files pass `node --check`.
- Explicit attachment-menu/filechooser behavior test passes.
- Input-only false-positive regression test passes.
- Exact attachment gate and atomic payload gate tests pass.
- Complete suite: 54/54 test files pass.

An end-to-end smoke test on Windows with the live ChatGPT DOM is still required.
