# Vidora hotfix — Request 2 / NV1 image / ChatGPT conversation lock

Date: 2026-07-14

## Symptoms reproduced from the supplied logs

1. Request 2 entered response polling even though its prompt had not been accepted by ChatGPT.
2. NV1 image extraction logged a valid candidate as `stable=2/2`, but did not save it.
3. UI recovery clicked a generic `Prompt File Review` action and could move the app away from the conversation that owned NV1.
4. Image polling could scan an older assistant/image root when the new NV1 assistant turn did not exist yet.

## Root causes

- A visible Stop button, an empty composer, or the `HYDRATING` runtime state was treated as proof that the current prompt had been sent. Those signals can belong to the previous request.
- The image stability log showed a target of 2 ticks while the actual save threshold was 3 ticks.
- The recovery selector allowed generic Review/Continue/Action Required controls outside the active chat.
- The extractor used response-root indices that were not comparable with the assistant-count baseline and could fall back to root 0.
- Automatic reloads during hydration/NV1 waiting destroyed the live DOM/network state used to locate the generated image.

## Fixes included

- Prompt submission is acknowledged only when the latest ChatGPT user-message hash exactly owns the prompt being sent.
- Request 2 cannot transition to WAIT/polling without that ownership proof.
- Attachment labels are excluded when deriving the user-message prompt hash.
- NV1 stores and continuously verifies both its prompt hash and ChatGPT conversation ID.
- Image scanning starts only after a new assistant turn exists beyond the NV1 baseline.
- Assistant/image roots are scoped to that new turn; old-root fallback is disabled.
- Stable image threshold and log are both 2 observations.
- Automatic hydration/image-wait reloads are disabled.
- Automatic sidebar selection by chat title is disabled; a conversation mismatch now fails closed.
- Generic Review/Continue/Action Required recovery clicks and sidebar/navigation targets are blocked.

## Files changed

- `electron/main.js`
- `electron/main/chatgpt/chatgpt_dom.js`
- `electron/main/chatgpt/chatgpt_pipeline.js`
- `electron/main/chatgpt/chatgpt_send.js`
- `package.json`
- `tests/chatgpt-stage-isolation.test.js`
- `tests/chatgpt-prompt-ownership-nv1-lock.test.js`

## Validation

- Syntax checks passed for all four changed runtime JavaScript files.
- `npm test`: 9/9 suites passed.
- Every `tests/*.test.js` executed directly with `node -r ./tests/normalize-hook.js`:
  - 19 passed.
  - 10 pre-existing baseline failures remained.
  - No new direct-test failure was introduced by this hotfix.

The former baseline failures were addressed in the consolidated cleanup and recovery pass; the current suite validates preprompt folders, scoped network images, NV2 stability, runtime monitoring, durable recovery, and VeoUp fixtures.

## Recommended manual verification

Run one fresh scene with Request 1 and Request 2 enabled, then confirm:

1. Request 2 appears as the latest user message before its wait log begins.
2. NV1 remains in the same `/c/<conversation-id>` URL.
3. No `action-required:Prompt File Review` recovery action appears.
4. The generated keyframe is saved immediately after the second identical stable candidate observation.
5. NV2 continues in the same conversation after the keyframe is saved.
