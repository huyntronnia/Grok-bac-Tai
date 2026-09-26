# PLAN

## Task summary

Implement the complete WP1–WP9 task on `fix/manual-mode-primary-workflow`, following the existing WP0 baseline work. Make Manual ChatGPT Keyframe + Motion Prompt the production default, with one main-process controller, durable attempts, proven response ownership, disk-derived readiness, and strict N/N VeoUp submission.

The user has explicitly authorized the current fixed agent configuration. Preserve the supplied task file and unrelated changes. Complete independent Tester and Reviewer stages, commit in logical groups, push, and open a PR without merging.

## Current behavior

- Baseline matches `a82fcc0`. No repository or nested `AGENTS.md` was found; the supplied Semble-first instructions apply.
- The manual button modifies renderer state and `project.manualChatGPT`. It does not synchronize a canonical main-process mode.
- Some send functions inspect `globalThis.__vidoraManualChatGPTMode`, but lower-level submit, upload, recovery, and navigation paths are not comprehensively guarded.
- `manual_chatgpt_controller.js` supports four stage names, but `startManualStage()` replaces the baseline and resets completion. It has no immutable attempt identity or project-wide state machine.
- Capture accepts `force` and `skipBaselineCheck`; normal renderer capture buttons pass `force:true`.
- Ownership can succeed without proving a new matching user turn. Image and text extraction then select global latest output, independently of the ownership result.
- `chatgpt_manual_detector.js` and `captureManualSceneAssets()` in `chatgpt_pipeline.js` provide competing manual capture implementations.
- Renderer functions own polling, transitions, auto-advance, and readiness. Navigation and copying call baseline initialization. Request 1/2 are not first-class steps in the active UI.
- Manual prompt text is built independently of the canonical request-file compiler.
- The scan-to-VeoUp UI sends `allowPartial:true`. The main handler accepts it and trusts renderer-provided expected scene metadata.
- VeoUp collection reconciliation can recover from staged copies or inline motion text. That behavior must not conceal deletion of a manual workflow’s audited source artifact.
- Existing project storage already provides atomic writers, serialized write queues, path-only manifests, scene snapshots, journals, and legacy embedded-asset migration.
- `npm test` discovers `tests/*.test.js`, but excludes the two tests under `electron/`. Its `normalize-hook.js` globally changes string matching and source reads. Several existing manual tests assert source strings, simulate independent logic, or barely assert ownership behavior.

## Desired behavior

Main process owns this sequence:

`PROJECT_AUDIT → REQUEST_1 → REQUEST_2 → scene NV1 → scene NV2 → next incomplete scene → PROJECT_COMPLETE → VEOUP_READY → VEOUP_RUNNING → VEOUP_COMPLETE`.

Each preparation returns the canonical prompt, attachment checklist, current audit, and allowed commands. Only explicit arming creates an attempt. User attachment, paste, Send, and conversation selection remain outside application automation.

Capture requires the active attempt, matching conversation, matching scene/stage, a newly observed user turn matching the prepared bundle, and an identified assistant response owned by that turn. Missing evidence returns `UNPROVEN`. Disk validation determines all progress and readiness.

## Scope

- Canonical workflow mode and project migration.
- Main-process mutation guards and production IPC reachability.
- One durable manual controller and one stage-aware watcher.
- Canonical hydration and scene bundles.
- Ownership-bound capture and explicit override rescue.
- Project audit, resume, navigation, redo, cancellation, and renderer view model.
- Strict integration with the existing VeoUp coordinator.
- Behavioral characterization, integration tests, documentation, and PR delivery.

No new runtime dependency is required unless implementation demonstrates a concrete need. Reuse Node crypto, existing Playwright/CDP adapters, Electron clipboard/native image APIs, and project persistence helpers.

## Files to inspect/change

| Area | Files and concrete responsibility |
|---|---|
| Canonical controller | `electron/main/chatgpt/manual_chatgpt_controller.js`: replace scene-local baseline orchestration with the project workflow, durable receipts, commands, watcher, and view model. |
| Focused supporting modules | Add narrowly scoped mode, bundle, audit, ownership, or IPC modules under existing `main/state`, `main/chatgpt`, `main/pipeline`, and `main/ipc` directories when this keeps dependencies acyclic and makes actual handlers testable. |
| Main wiring | `electron/main.js`, `electron/main/ipc/ipc_handlers.js`, relevant bootstrap wiring: canonical IPC, session initialization, guard enforcement, dependency injection, clipboard, and VeoUp routing. |
| Bridge/UI | `electron/preload.js`, `electron/renderer.js`, `electron/index.html`; existing stylesheet only for attachment/stage/override presentation. |
| Mutation boundaries | `chatgpt_send.js`, `chatgpt_upload.js`, `chatgpt_recovery.js`, `chatgpt_pipeline.js`, `pipeline_runner.js`; inspect browser/core helpers reached from these for hidden navigation or recovery. |
| Consolidation | `chatgpt_manual_detector.js`, `electron/main/chatgpt/index.js`: remove duplicate engine exports and route any retained compatibility API to the canonical controller. |
| Prompt contract | `scene_request_files.js`; shared hydration definitions currently in `chatgpt_pipeline.js`; collectors and hard-prompt loader currently in `main.js`. |
| Persistence | `project_manifest.js`, relevant scene-state helpers, and project load/save handlers: mode migration, asset aliases, durable workflow storage. |
| VeoUp | `batch_coordinator.js`, `batch_manifest.js`, and `collection_store.js` only where needed to enforce authoritative manual source validation and pre-submit checks. |
| Tests | Existing `manual-*.test.js`, IPC parity, project migration, and VeoUp tests; add cross-layer behavioral suites and fixtures. |
| Documentation | `README.md`, `docs/manual_chatgpt_mode/*`, `.bangiao/*`. |

Do not change hard-prompt template semantics, account storage, unrelated providers, packaging configuration, video generation algorithms, or the low-level VeoUp desktop automation.

## Implementation steps

1. **WP1: Record failing behavioral characterization before changing production code.**
   - Add a reusable temporary-project fixture and mock CDP boundary that exposes conversation identities, stable message IDs, user text/attachments, assistant text/images, and generation state.
   - Exercise the registered production IPC handlers and actual preload bridge, using injected external dependencies rather than copying handler logic into tests.
   - Cover mode synchronization, resumable hydration, normal capture options, stale/mismatched output, repeated copy, disk readiness, N-1/N rejection, and strict coordinator arguments.
   - Record test commands and failing assertions in `.bangiao` before implementation. New tests must also run directly with Node without `normalize-hook.js`.

2. **WP2: Establish canonical mode and block automatic ChatGPT mutations.**
   - Introduce `workflowMode: "manual_keyframe_motion"` with main-owned get/set functions. Initialize the production app in that mode before IPC can execute.
   - Migrate legacy `manualChatGPT` and `keyframeMotionPromptOnly` on create/load/restore/save. Preserve asset fields and existing path migration; do not persist base64.
   - Keep a single production IPC namespace for mode and manual commands. Reject unsupported mode values and prevent renderer payload flags from disabling protection.
   - Synchronize mode through preload during startup, project restore, and workflow activation.
   - Guard production entry points including `browser:send-prompt`, `pipeline:run-scene`, fresh-chat actions, and any AI prompt-generation handler that can drive ChatGPT.
   - Guard actual send/input functions, including force submit, robust send ladder, real-send-button, clear-before-paste, and NV2 composer paths.
   - Guard upload chooser/direct-input/sequential upload boundaries, sidebar conversation selection, new-chat helpers, rotation, hydration automation, and recovery resend paths.
   - Recheck mode before mutations that follow asynchronous waits. A mode change must stop an already-running automatic path before its next mutation.
   - Manual observation must acquire an existing CDP page without login recovery, conversation selection, new-chat creation, or automatic navigation.

3. **WP3: Implement the single durable orchestrator.**
   - Persist a versioned project workflow checkpoint using existing atomic write/queue helpers. Store expected scene IDs from the loaded project, conversation hydration records, attempt history, active attempt ID, state, revision, and last audit summary.
   - Implement `prepare`, `arm`, `capture`, `complete`, `redo`, `cancel`, `resume`, and scene-selection commands. Implement all states required by the task, including explicit captured, scene/project complete, blocked, cancelled, and VeoUp states.
   - Serialize commands per project and prevent multiple active watchers or attempts across project switching.
   - `arm` creates one UUID receipt with the required baseline counts, stable IDs, conversation identity, prompt/payload fingerprints, timestamp, and artifact metadata.
   - Repeated arm/copy during `WAITING` returns the same attempt. Navigation/render/status requests never create attempts or reset completion.
   - Redo creates a new receipt while retaining history. Redoing NV1 invalidates dependent NV2 readiness and any staged VeoUp collection without silently deleting unrelated assets.
   - Journal every transition and rejection. Tie writes/capture to the current attempt and workflow revision so cancellation or redo cannot accept a late asynchronous result.
   - Persist artifact completion in an order that supports crash recovery: validated atomic artifact write, receipt/checkpoint update, and auditable reconciliation. Resume must recognize already-written artifacts without capturing them twice.

4. **WP4: Build canonical Request 1/2/NV1/NV2 bundles.**
   - Implement `buildManualStageBundle({projectPath, sceneId, stage})` using main-owned project scene text and the existing hard-prompt loader.
   - Reuse `materializeSceneRequestFiles()`, `buildRequestControlPrompt()`, and `createComposerPayload()` for scene stages.
   - Share the exact Request 1/2 prompt definitions and ready validator with the legacy pipeline rather than duplicating them.
   - Reuse the preprompt collector and recent-keyframe collector. Keep `CHATGPT_HYDRATION_KEYFRAME_LIMIT = 10`, nearest previous scene first, excluding the current/future scenes.
   - Request 2 remains a real acknowledgement stage when no prior keyframe exists. Hydration bundles must support an empty attachment list.
   - NV2 includes the validated current keyframe plus its request file where the existing contract requires it.
   - Return clipboard text, attachment names/paths, content hashes, payload fingerprint, and user instructions. Freeze the prepared bundle within an armed attempt; changed attachment content requires explicit re-prepare/redo.
   - Track hydration by conversation identity, not per scene. Resume completed hydration for that same conversation.
   - Handle a fresh root tab acquiring its first conversation ID only with proof from the first matching owned user turn on the observed page. Do not treat arbitrary conversation changes as that promotion.

5. **WP5: Bind capture to proven ownership and add rescue override.**
   - Have one main-process watcher poll only when an active `WAITING` receipt exists. Buttons invoke the same capture command.
   - Read an ordered message snapshot with real message IDs, roles, text, attachment evidence, assistant descendants, and generation state. Do not synthesize positional IDs as ownership proof.
   - Identify the new matching user turn after arming, verify its prepared control prompt and observable attachments, then identify its assistant response. Capture receives that owned assistant ID.
   - Scope image extraction, network candidate selection, screenshot fallback, and text extraction to the proven assistant turn. Never fall back to global latest image/text.
   - Require settled output; validate hydration with the shared ready validator, images with existing decode/dimension validation, and NV2 with the current motion quality gate.
   - Reject missing attempt, wrong attempt/scene/stage/conversation, old output, changed bundle, and still-generating output. Virtualized history without sufficient anchors returns `UNPROVEN`.
   - Remove normal `force`/`skipBaselineCheck` support from public capture IPC.
   - Implement separate override preview and confirm commands. Preview includes scene, stage, candidate text/image, and ownership warning. Main issues a short-lived candidate token bound to attempt and candidate hash.
   - Confirmation rechecks token/candidate and artifact validators, records `manual_override`, and holds the workflow for an explicit continue command. No automatic scene advancement or VeoUp submission follows override.
   - On conversation changes during waiting, stop the attempt, record the mismatch, and require Request 1/2 for the new conversation before scene capture resumes.

6. **WP6: Make audit authoritative and reduce renderer to commands/view model.**
   - Implement `auditManualProject(projectPath, expectedSceneIds)` with strict positive/unique IDs and per-scene existence, validity, resolved path, SHA-256, error, stage, and readiness.
   - Derive scene inventory from the loaded project/checkpoint rather than arbitrary scene-folder scanning or a caller-supplied smaller list.
   - Preserve valid legacy asset paths through migration and an explicit main-owned source mapping. Once mapped, a missing/corrupt source must not silently fall back to an older staged VeoUp copy.
   - Use audit for selector badges, progress, first incomplete scene, resume, automatic advancement, and VeoUp readiness.
   - Missing artifacts revoke readiness even if a receipt was previously complete. Keep history; expose the scene requiring repair.
   - Replace renderer manual polling/transitions/prompt builders/path-based completion with view-model rendering and canonical commands.
   - Make Request 1/2 visible with prompt text and attachment checklist. Present unarmed/waiting/captured states, explicit arm/copy, capture, cancel, redo, preview/confirm override, and safe folder/path actions.
   - Remove the manual/auto toggle and reachable auto-run controls. Workflow start opens/resumes manual preparation.
   - Scene navigation changes the viewed scene only; while an attempt is active, changing its target requires an explicit cancel/redo action.
   - Use one clipboard IPC implementation for manual text/path copying; remove duplicate manual fallbacks and listeners.

7. **WP7: Enforce strict VeoUp transition in main.**
   - Implement a controller-owned submission command requiring a fresh N/N audit.
   - Call the existing coordinator with authoritative scene IDs and `allowPartial:false`, overriding or rejecting conflicting caller fields.
   - Route all production VeoUp IPC paths reachable from Manual Mode through this gate, including direct automation and scan entry points.
   - Add a narrowly scoped pre-submit validation hook in the coordinator when needed to check audited source files again immediately before invoking automation.
   - Ensure source deletion or content change is caught despite staged collection copies. Return scene-specific failures and update the view model.
   - Keep coordinator deduplication, cancellation, manifest generation, and existing automation. Persist batch identity and reconcile its status on restart without duplicate submission.
   - Partial debug tooling may remain internal/test-only; it must not be reachable through the production Manual Mode bridge.

8. **WP8: Consolidate and document.**
   - Use exhaustive `rg` call-site searches before removing duplicate exports, IPC, watcher, detector, and capture code.
   - Remove or make compatibility wrappers route entirely to the controller. Eliminate `pipeline:manual-step-changed`, `pipeline:manual-force-capture`, hidden hydration controls, and conflicting renderer booleans.
   - Preserve shared automatic-pipeline primitives required by tests/runtime, but production IPC must not activate automatic ChatGPT actions.
   - Update affected legacy tests to assert the new contract; do not preserve obsolete source snippets solely to satisfy string tests or weaken validation.
   - Document attachment flow, arming, hydration, restart, conversation changes, redo, overrides, disk errors, migration, and strict VeoUp behavior.

9. **WP9: Verify and deliver.**
   - Run targeted tests after each package and retain red-to-green evidence.
   - Run syntax checks on changed JavaScript, full `npm test`, both independent Electron tests, and direct new integration tests without the normalization hook.
   - Run `git diff --check`, inspect full diff/status, and exclude dependency/build/log artifacts.
   - Complete independent Tester, then Reviewer. Any source correction invalidates the previous pass and requires retesting.
   - Commit logical groups with corresponding tests. Push and open a PR containing architecture before/after, migration, test results, UI flow description/screenshots, remaining limitations, and all fourteen DoD checklist items. Do not merge.

## Edge cases

- Fresh `/` tab becomes `/c/<id>` after Request 1; distinguish this from user switching conversations.
- Existing nonempty conversation has no trustworthy hydration receipt.
- Request 1/2 have no attachments; recent scene IDs are non-contiguous.
- Multiple assistant parts, old generated images, streaming completion, virtualized messages, reused text, and unrelated user messages appear after arming.
- Repeated copy, double-click arm/capture, delayed capture after cancellation, and concurrent renderer status requests.
- Restart before/after each artifact/checkpoint write and at each hydration/scene/VeoUp state.
- Existing complete scenes coexist with corrupt/missing artifacts or stale renderer paths.
- NV1 redo changes the keyframe while an old NV2 prompt and staged batch still exist.
- Empty project, duplicate scene IDs, malicious scene/path values, external legacy paths, or missing project metadata.
- Artifact deletion/change after READY, while staging, or immediately before submission.
- Override candidate changes between preview and confirmation; repeated confirmation; restart after override.
- Switching projects must stop the previous watcher and prevent stale notifications changing the current view.

## Test plan

Use real controller, bundle, audit, persistence, IPC registration, and preload code. Mock CDP/browser access, clipboard/shell, and VeoUp execution only at external boundaries.

Required behavioral suites:

1. **Bridge and guard:** startup, activation, restore, rejected alternate mode, every production automatic-action IPC, and direct low-level send/upload/recovery/navigation boundaries. Assert zero browser mutations.
2. **Bundles:** exact canonical NV1/NV2 control prompts and attachment contents; shared hydration text; Request 2 limit/order/exclusion; hashes change with content; no attachments supported for hydration.
3. **Receipts:** single active UUID; repeated copy/arm stable; navigation inert; completed stages survive restart; redo preserves history; late captures rejected.
4. **Ownership:** old/unrelated output rejected; wrong scene/stage/attempt/conversation rejected; owned assistant image/text selected among many candidates; virtualization becomes `UNPROVEN`; streaming waits.
5. **Audit/migration:** missing and corrupt image, invalid motion, preserved legacy paths, path-only round trip, stale renderer data ignored, dependent output invalidated after redo.
6. **Two-scene integration:** Request 1 → Request 2 → NV1 → NV2 → scene 2 NV1 → NV2 → strict VeoUp through actual IPC/controller.
7. **Restart matrix:** restart at every ready/waiting/captured/completed stage; no duplicate attempts, artifact writes, sends, or batch submission.
8. **Conversation change:** waiting attempt is blocked, no artifact saved, and Request 1/2 required before continuing.
9. **Strict gate:** N-1/N cannot reach coordinator; forged smaller scene list and `allowPartial:true` cannot bypass; deleted source rejected even when staged copies exist.
10. **Override:** explicit preview/confirm required, stale token rejected, journal records `manual_override`, and advancement requires an additional command.
11. **Renderer behavior:** controls issue canonical commands through preload; Request 1/2 and attachment checklist are visible; navigation/render do not arm; displayed readiness exactly matches the returned audit.

Use valid image fixtures and a decoder-aware boundary test so “PNG magic bytes plus padding” cannot satisfy the new corrupt-image acceptance checks accidentally.

Execute:

- `npm test`
- `node electron/chatgptAutomation.test.js`
- `node electron/chatgptRecovery.test.js`
- Direct `node tests/<new-behavioral-suite>.test.js` commands without `-r tests/normalize-hook.js`
- `node --check <changed-js-file>`
- `git diff --check`

Record actual results; distinguish mocked integration from live external-service validation.

## Acceptance criteria

All fourteen user DoD items pass, demonstrated by behavior:

- Manual workflow is the default and only production workflow UI.
- No reachable UI/IPC initiates automatic ChatGPT input, Send, upload, sidebar selection, or new-chat/recovery sending.
- Request 1/2 are functional, resumable, and conversation-scoped.
- Valid NV1 is required before NV2.
- Captured output is tied to the active conversation/scene/stage/attempt and owned assistant turn.
- Restart preserves completed work and active receipt identity.
- Renderer readiness, resume, navigation badges, and progress use the same main audit.
- Only N/N valid scenes can submit; every workflow submission is strict.
- One manual capture engine remains.
- Legacy projects preserve valid assets and remain path-only.
- Existing relevant tests and all new tests pass.
- README accurately describes the shipped UI.
- Independent Tester PASS and Reviewer APPROVED apply to the final implementation.
- Logical commits are pushed and a PR is opened without merging.

## Risks

- The existing controller/pipeline dependency cycle can worsen if the controller imports a barrel that reimports itself. Put pure contracts and mode state in dependency-light modules.
- Strict ownership may reject some virtualized ChatGPT DOM states. This is intentional; the preview/confirm rescue path must remain usable and auditable.
- Existing tests often rely on implementation strings and weak image fixtures. Replace obsolete assertions with stronger behavioral evidence rather than relaxing production checks.
- VeoUp’s staged-copy recovery can defeat source deletion checks unless manual source identity is enforced before reconciliation/submission.
- Hashing every asset on every UI refresh is expensive. Serialize audits and reuse an audit result for a view-model update, while always performing a fresh gate audit before submission.
- In-flight asynchronous work can cross cancel/project/mode changes. Receipt identity and revision checks must surround artifact writes and external mutations.

## Out of scope

- Changing prompt semantics, provider/account architecture, or unrelated UI design.
- Rewriting VeoUp automation or adding an alternate video provider.
- Automatically sending to live ChatGPT/VeoUp to prove integration when mocked external boundaries cover the required contract.
- Merging the PR.
- Replacing the repository-wide normalization harness as an unrelated cleanup; new behavioral suites must prove their results independently of it.

## Open questions

- The task does not define how to trust an existing nonempty conversation with no durable hydration receipt. Use the safe default: require Request 1/2 once for that conversation; never infer hydration from unrelated existing messages.
- Exact live ChatGPT DOM evidence varies. Implementation must return `UNPROVEN` whenever stable ownership cannot be established; no permissive fallback is authorized.
- Some legacy asset paths may be external to the project root. Preserve their references during load; validate and explicitly materialize approved source assets into the project when VeoUp’s existing containment contract requires it.
- Baseline dependency installation and test results are being recorded by the orchestrator. Incorporate the actual results before claiming regression success.

PLANNER_STATUS: READY
