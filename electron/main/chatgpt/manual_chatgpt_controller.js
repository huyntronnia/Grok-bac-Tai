const { validateManualKeyframe } = require("./manual_image_validation");
"use strict";

const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { enqueueProjectWrite, writeJsonFileAtomic, writeTextFileAtomic } = require("../project");
const { validateKeyframeFile, validateMotionPromptTextContent } = require("../pipeline/asset_validation");
const { createManualProjectAuditor, normalizeExpectedSceneIds } = require("./manual_project_audit");
const { buildManualStageBundle, validateReadyResponse, verifyBundleFiles } = require("./manual_stage_bundle");
const { withManualDeadline } = require("./manual_operation_deadline");
const VALID_MANUAL_STAGES = ["NV1", "NV2"];
function normalizeSceneToken(id) {
  const value = Number(String(id).replace(/^scene_/, ""));
  if (!Number.isInteger(value) || value <= 0) throw new Error("manual-invalid-scene-id");
  return `scene_${String(value).padStart(3, "0")}`;
}
function resolveSceneDir(projectPath, token) { return path.join(projectPath, token); }

const MANUAL_WORKFLOW_VERSION = 2;
const MANUAL_WORKFLOW_DIR = ".vidora";
const MANUAL_WORKFLOW_FILE = "manual_workflow.json";
const MANUAL_WORKFLOW_JOURNAL = "manual_workflow_journal.json";
const manualWorkflowQueues = new Map();

function manualWorkflowPaths(projectPath) {
  const projectDir = path.resolve(String(projectPath || ""));
  if (!String(projectPath || "").trim()) throw new Error("manual-workflow-project-path-required");
  const metadataDir = path.join(projectDir, MANUAL_WORKFLOW_DIR);
  return {
    projectDir,
    metadataDir,
    checkpointPath: path.join(metadataDir, MANUAL_WORKFLOW_FILE),
    journalPath: path.join(metadataDir, MANUAL_WORKFLOW_JOURNAL),
  };
}

function withManualWorkflowLock(projectPath, operation) {
  const key = manualWorkflowPaths(projectPath).projectDir;
  const previous = manualWorkflowQueues.get(key) || Promise.resolve();
  const current = previous.catch(() => null).then(operation);
  manualWorkflowQueues.set(key, current);
  return current.finally(() => {
    if (manualWorkflowQueues.get(key) === current) manualWorkflowQueues.delete(key);
  });
}

async function readManualWorkflowCheckpoint(projectPath) {
  const { checkpointPath } = manualWorkflowPaths(projectPath);
  const raw = await fs.readFile(checkpointPath, "utf8").catch((error) => {
    if (error?.code === "ENOENT") return "";
    throw error;
  });
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === "object" ? parsed : null;
}

async function writeManualWorkflowCheckpoint(projectPath, checkpoint) {
  const { checkpointPath } = manualWorkflowPaths(projectPath);
  checkpoint.updatedAt = new Date().toISOString();
  await enqueueProjectWrite(checkpointPath, () => writeJsonFileAtomic(checkpointPath, checkpoint, 2));
  return checkpoint;
}

async function appendManualWorkflowJournal(projectPath, event) {
  const { journalPath } = manualWorkflowPaths(projectPath);
  await enqueueProjectWrite(journalPath, async () => {
    let journal = [];
    const raw = await fs.readFile(journalPath, "utf8").catch(() => "");
    if (raw) {
      try { journal = JSON.parse(raw); } catch (_error) { journal = []; }
    }
    journal.push({
      timestamp: new Date().toISOString(),
      ...event,
    });
    await writeJsonFileAtomic(journalPath, journal, 2);
  });
}

function countRoles(messages, role) {
  return messages.filter((message) => message.role === role).length;
}

function normalizeOwnedMessages(snapshot = {}) {
  return (Array.isArray(snapshot.messages) ? snapshot.messages : []).map((message) => ({
    ...message,
    id: String(message?.id || "").trim(),
    role: String(message?.role || "").trim().toLowerCase(),
    text: String(message?.text || "").trim(),
    attachmentNames: Array.isArray(message?.attachmentNames)
      ? message.attachmentNames.map((name) => path.basename(String(name || "")).toLowerCase())
      : [],
  }));
}

function normalizedComparableText(value = "") {
  return String(value || "").normalize("NFC").replace(/\s+/g, " ").trim();
}

// ChatGPT can normalize quotes, zero-width characters and whitespace while it
// renders a user turn.  Do not require byte-for-byte DOM text here: the turn
// still has to be a *new* user turn in the armed conversation, but harmless
// presentation normalization must not make a valid manual send uncapturable.
function normalizedPromptIdentity(value = "") {
  return normalizedComparableText(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s*([,.:;!?])\s*/g, "$1")
    .toLowerCase();
}

function matchOwnedUserTurn(message, bundle = {}) {
  const expectedText = normalizedPromptIdentity(bundle.clipboardText);
  const actualText = normalizedPromptIdentity(message.text);
  // Containment covers a DOM that trims a surrounding markdown wrapper.  The
  // minimum prevents a short generic fragment from being treated as proof.
  const textMatch = Boolean(expectedText && actualText) && (
    expectedText === actualText ||
    (Math.min(expectedText.length, actualText.length) >= 48 &&
      (expectedText.includes(actualText) || actualText.includes(expectedText)))
  );
  const expectedAttachments = (bundle.attachmentNames || [])
    .map((name) => path.basename(String(name || "")).toLowerCase());
  const observedAttachments = Array.isArray(message.attachmentNames)
    ? message.attachmentNames.map((name) => path.basename(String(name || "")).toLowerCase())
    : [];
  return {
    matches: textMatch,
    expectedAttachments,
    observedAttachments,
    missingAttachments: expectedAttachments.filter((name) => !observedAttachments.includes(name)),
  };
}

function hasAllRequiredAttachments(ownership = {}) {
  return ownership.expectedAttachments?.length > 0 &&
    ownership.expectedAttachments.every((name) => ownership.observedAttachments?.includes(name));
}

function assistantFingerprint(message = {}) {
  if (message.role !== "assistant") return "";
  const payload = message.generatedImageCard || message.imageBuffer || message.images?.length
    ? Buffer.isBuffer(message.imageBuffer)
      ? message.imageBuffer
      : JSON.stringify(message.images || [])
    : String(message.text || "");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function isStageAssistant(message, stage) {
  if (message.role !== "assistant") return false;
  if (stage === "NV1") return Boolean(message.imageBuffer || message.images?.length);
  return stage === "NV2" && !message.generatedImageCard && Boolean(message.text);
}

// This is intentionally narrower than a generic "last assistant response".
// It lets a user explicitly save a response that was sent before they pressed
// Arm, while still proving that it belongs to the prepared scene/stage. A
// valid proof is either the canonical prompt or every required attachment on
// the immediately preceding user turn in the current conversation.
function findPreparedResponseCandidate(snapshot = {}, checkpoint = null) {
  const bundle = checkpoint?.preparedBundle;
  if (!bundle?.payloadFingerprint || snapshot?.generating) return null;
  const liveConversationId = String(snapshot?.conversationId || "");
  if (checkpoint?.conversationId && checkpoint.conversationId !== liveConversationId) return null;
  const messages = normalizeOwnedMessages(snapshot);
  if (!messages.length || messages.some((message) => !message.id)) return null;
  const userIndex = messages.map((message) => message.role).lastIndexOf("user");
  if (userIndex < 0) return null;
  const user = messages[userIndex];
  const ownership = matchOwnedUserTurn(user, bundle);
  const attachmentMatch = hasAllRequiredAttachments(ownership);
  if (!ownership.matches && !attachmentMatch) return null;
  const assistant = messages.slice(userIndex + 1)
    .filter((message) => isStageAssistant(message, bundle.stage))
    .at(-1);
  if (!assistant || assistant.settled === false) return null;
  return {
    bundle,
    messages,
    user,
    userIndex,
    assistant,
    ownership,
    proof: ownership.matches ? "canonical-prompt" : "all-required-attachments",
  };
}

function summarizeManualObservation(snapshot = {}, checkpoint = null) {
  const messages = normalizeOwnedMessages(snapshot);
  const compact = (value, limit = 700) => {
    const text = String(value || "").trim();
    return text.length > limit ? `${text.slice(0, limit)}…` : text;
  };
  const turns = messages.slice(-6).map((message) => ({
    id: message.id,
    role: message.role,
    text: compact(message.text),
    attachmentNames: message.attachmentNames,
    settled: message.settled !== false,
    hasImage: Boolean(message.imageBuffer || message.images?.length),
  }));
  const activeAttempt = checkpoint?.activeAttemptId
    ? checkpoint.attempts?.find((attempt) => attempt.attemptId === checkpoint.activeAttemptId) || null
    : null;
  const preparedResponseCandidate = activeAttempt || checkpoint?.rearmRequired
    ? null : findPreparedResponseCandidate(snapshot, checkpoint);
  const capturedByAssistantId = new Map((checkpoint?.attempts || [])
    .filter((attempt) => attempt.capturedAssistantTurnId && attempt.artifactPath)
    .map((attempt) => [attempt.capturedAssistantTurnId, attempt]));
  const describeAssistantOutput = (message) => {
    const captured = capturedByAssistantId.get(message.id);
    const hasImage = Boolean(message.imageBuffer || message.images?.length);
    const isReady = validateReadyResponse(message.text);
    const kind = captured?.stage === "NV1" || hasImage
      ? "image"
      : captured?.stage === "NV2"
        ? "motion_prompt"
        : isReady
          ? "ready"
          : "text";
    return {
      assistantTurnId: message.id,
      kind,
      stage: captured?.stage || activeAttempt?.stage || "",
      sceneId: captured?.sceneId || activeAttempt?.sceneId || null,
      settled: message.settled !== false,
      fileName: captured?.artifactPath ? path.basename(captured.artifactPath) : "",
      artifactPath: captured?.artifactPath || "",
      text: compact(message.text, 260),
      saved: Boolean(captured?.artifactPath),
    };
  };
  const observedOutputs = messages.filter((message) => message.role === "assistant")
    .slice(-6).map(describeAssistantOutput);
  const savedOutputs = (checkpoint?.attempts || [])
    .filter((attempt) => attempt.artifactPath && ["CAPTURED", "OVERRIDDEN"].includes(attempt.status))
    .map((attempt) => ({
      assistantTurnId: attempt.capturedAssistantTurnId || "",
      kind: attempt.stage === "NV1" ? "image" : attempt.stage === "NV2" ? "motion_prompt" : "ready",
      stage: attempt.stage,
      sceneId: attempt.sceneId,
      fileName: path.basename(attempt.artifactPath),
      artifactPath: attempt.artifactPath,
      saved: true,
    }));
  return {
    available: true,
    checkedAt: new Date().toISOString(),
    conversationId: String(snapshot.conversationId || ""),
    pathname: String(snapshot.pathname || ""),
    pageTitle: String(snapshot.pageTitle || ""),
    loggedOut: Boolean(snapshot.loggedOut),
    pageId: String(snapshot.pageId || ""),
    generating: Boolean(snapshot.generating),
    messageCount: messages.length,
    userMessageCount: countRoles(messages, "user"),
    assistantMessageCount: countRoles(messages, "assistant"),
    activeAttempt: activeAttempt ? {
      attemptId: activeAttempt.attemptId,
      sceneId: activeAttempt.sceneId,
      stage: activeAttempt.stage,
      conversationId: activeAttempt.conversationId,
      baselineTurnCount: (activeAttempt.baselineTurnIds || []).length,
    } : null,
    capturablePreparedResponse: preparedResponseCandidate ? {
      sceneId: Number(preparedResponseCandidate.bundle.sceneId),
      stage: preparedResponseCandidate.bundle.stage,
      assistantTurnId: preparedResponseCandidate.assistant.id,
      proof: preparedResponseCandidate.proof,
    } : null,
    observedOutputs,
    savedOutputs,
    turns,
  };
}

function waitingState(stage) {
  return stage === "NV1" ? "SCENE_NV1_WAITING" : "SCENE_NV2_WAITING";
}

function readyState(stage) {
  return stage === "NV1" ? "SCENE_NV1_READY" : "SCENE_NV2_READY";
}

function capturedState(stage) {
  return stage === "NV1" ? "SCENE_NV1_CAPTURED" : "SCENE_NV2_CAPTURED";
}

async function writeBufferAtomic(targetPath, buffer) {
  const resolved = path.resolve(targetPath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  const tempPath = path.join(path.dirname(resolved), `.${path.basename(resolved)}.${crypto.randomUUID()}.tmp`);
  try {
    await fs.writeFile(tempPath, buffer);
    await fs.rename(tempPath, resolved);
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => null);
  }
  return resolved;
}

function createManualChatGptController(runtime = {}) {
  const rawReadConversationSnapshot = runtime.readConversationSnapshot || (async () => ({
    conversationId: "",
    messages: [],
    generating: false,
  }));
  let snapshotRetryAfter = 0;
  const readConversationSnapshot = async (options = {}) => {
    if (Date.now() < snapshotRetryAfter) {
      const error = new Error("manual-conversation-temporarily-unavailable-after-timeout");
      error.code = "MANUAL_OPERATION_TIMEOUT";
      throw error;
    }
    try {
      return await withManualDeadline(
        () => rawReadConversationSnapshot(options),
        { timeoutMs: 35000, signal: options.signal, label: "manual-conversation-snapshot" },
      );
    } catch (error) {
      if (error?.code === "MANUAL_OPERATION_TIMEOUT") snapshotRetryAfter = Date.now() + 30000;
      throw error;
    }
  };
  const buildStageBundle = runtime.buildStageBundle || buildManualStageBundle;
  const auditProject = runtime.auditProject || createManualProjectAuditor();
  const submitBatch = runtime.submitVeoUp || (async () => ({ ok: false, error: "veoup-coordinator-unavailable" }));
  let watchedProject = "";
  let watcher = null;
  let watchBusy = false;
  const epochs = new Map();
  const overrideCandidates = new Map();
  const stableCandidates = new Map();
  const attachmentWarnings = new Set();
  const activeVeoUpJobs = new Map();
  const activeCaptureAborters = new Map();

  function emitChanged(payload) {
    try { runtime.onChanged?.(payload); }
    catch (error) { try { runtime.onObservationError?.(error); } catch (_) {} }
  }

  function observeAutoCandidate(attempt, assistant) {
    const now = typeof runtime.now === "function" ? Number(runtime.now()) : Date.now();
    const signature = `${assistant.id}:${assistantFingerprint(assistant)}`;
    const previous = stableCandidates.get(attempt.attemptId);
    const state = previous?.signature === signature
      ? { ...previous, ticks: previous.ticks + 1 }
      : { signature, ticks: 1, since: now };
    stableCandidates.set(attempt.attemptId, state);
    const requiredTicks = attempt.stage === "NV1" ? 2 : 3;
    const requiredMs = attempt.stage === "NV1" ? 0 : 4000;
    return {
      ready: state.ticks >= requiredTicks && now - state.since >= requiredMs,
      ticks: state.ticks,
      requiredTicks,
      stableMs: now - state.since,
      requiredMs,
    };
  }

  function invalidate(projectPath) {
    const key = path.resolve(projectPath);
    for (const aborter of activeCaptureAborters.get(key) || []) aborter.abort();
    epochs.set(key, (epochs.get(key) || 0) + 1);
    stableCandidates.clear();
    attachmentWarnings.clear();
  }
  function stopWatcher() {
    if (watcher) clearInterval(watcher);
    watcher = null;
  }
  function activate(projectPath) {
    const resolved = path.resolve(projectPath);
    if (watchedProject && watchedProject !== resolved) invalidate(watchedProject);
    watchedProject = resolved;
    stopWatcher();
    if (!runtime.watchIntervalMs) return;
    watcher = setInterval(async () => {
      if (watchBusy) return;
      watchBusy = true;
      try {
        const checkpoint = await readManualWorkflowCheckpoint(resolved);
        if (!checkpoint) return;
        let browserAvailable = true;
        let browser = null;
        try {
          browser = await readConversationSnapshot();
          runtime.onObservation?.({
            projectPath: resolved,
            observation: summarizeManualObservation(browser, checkpoint),
          });
        } catch (error) {
          browserAvailable = false;
          runtime.onObservation?.({
            projectPath: resolved,
            observation: {
              available: false,
              checkedAt: new Date().toISOString(),
              error: error?.message || String(error),
              messageCount: 0,
              userMessageCount: 0,
              assistantMessageCount: 0,
              turns: [],
              observedOutputs: [],
              savedOutputs: [],
            },
          });
          runtime.onObservationError?.(error);
        }
        if (!browserAvailable) return;
        let attempt = checkpoint?.attempts.find((item) => item.attemptId === checkpoint.activeAttemptId);
        if (!attempt && checkpoint.preparedBundle?.payloadFingerprint && !checkpoint.overrideHold &&
          !checkpoint.rearmRequired &&
          /^SCENE_NV[12]_READY$/.test(checkpoint.state) && browser?.conversationId &&
          (!checkpoint.conversationId || checkpoint.conversationId === browser.conversationId)) {
          const armed = await arm({ projectPath: resolved, bundle: checkpoint.preparedBundle, auto: true });
          if (armed.ok) {
            attempt = armed.attempt;
            runtime.onChanged?.({ projectPath: resolved, viewModel: armed.viewModel, autoArmed: true });
          }
        }
        if (!attempt || attempt.status !== "WAITING") return;
        const result = await capture({ projectPath: resolved, attemptId: attempt.attemptId, sceneId: attempt.sceneId, stage: attempt.stage, autoCapture: true });
        if (!result.ok && watchedProject === resolved) {
          runtime.onObservation?.({
            projectPath: resolved,
            observation: {
              ...summarizeManualObservation(browser, checkpoint),
              captureStatus: { code: result.code || "WAITING", error: result.error || "", stability: result.stability || null },
            },
          });
        }
        if (watchedProject === resolved && (result.ok || result.code === "CONVERSATION_MISMATCH")) {
          runtime.onChanged?.({
            projectPath: resolved,
            observation: result.observation || null,
            viewModel: await getViewModel({ projectPath: resolved }),
            capture: result.ok ? { attempt: result.attempt } : null,
          });
        }
      } catch (error) {
        runtime.onObservationError?.(error);
      } finally { watchBusy = false; }
    }, runtime.watchIntervalMs);
    watcher.unref?.();
  }
  async function reject(projectPath, code, error = code) {
    await appendManualWorkflowJournal(projectPath, { kind: "command_rejected", code, error });
    return { ok: false, code, error };
  }
  function nextStage(checkpoint, audit) {
    const scene = audit.scenes.find((item) => item.sceneId === checkpoint.currentSceneId);
    return scene?.keyframe.valid ? "NV2" : "NV1";
  }

  function migrateToNvOnly(checkpoint, audit) {
    let changed = false;
    for (const attempt of checkpoint.attempts || []) {
      if (VALID_MANUAL_STAGES.includes(attempt.stage)) continue;
      if (attempt.status === "WAITING") {
        attempt.status = "CANCELLED";
        attempt.cancelledAt = new Date().toISOString();
        attempt.cancelReason = "manual-request-stages-removed";
        changed = true;
      }
      if (checkpoint.activeAttemptId === attempt.attemptId) {
        checkpoint.activeAttemptId = null;
        changed = true;
      }
    }
    if (checkpoint.preparedBundle && !VALID_MANUAL_STAGES.includes(checkpoint.preparedBundle.stage)) {
      checkpoint.preparedBundle = null;
      changed = true;
    }
    if (/REQUEST|HYDRATE/.test(String(checkpoint.state || ""))) {
      checkpoint.currentSceneId = audit.firstIncompleteSceneId || checkpoint.currentSceneId;
      checkpoint.state = audit.complete ? "VEOUP_READY" : readyState(nextStage(checkpoint, audit));
      changed = true;
    }
    if (Number(checkpoint.version || 0) < 2) {
      checkpoint.version = 2;
      changed = true;
    }
    return changed;
  }

  async function loadRequired(projectPath) {
    const checkpoint = await readManualWorkflowCheckpoint(projectPath);
    if (!checkpoint) throw new Error("manual-workflow-not-initialized");
    return checkpoint;
  }

  async function currentAudit(projectPath, checkpoint, options = {}) {
    return auditProject(projectPath, checkpoint.expectedSceneIds, {
      sourceMap: checkpoint.sourceMap || {},
      forceFull: options.forceFull === true,
    });
  }

  async function makeViewModel(projectPath, checkpoint) {
    const audit = await currentAudit(projectPath, checkpoint);
    const activeAttempt = checkpoint.activeAttemptId
      ? checkpoint.attempts.find((attempt) => attempt.attemptId === checkpoint.activeAttemptId) || null
      : null;
    return {
      ok: true,
      version: checkpoint.version,
      revision: checkpoint.revision,
      state: checkpoint.state,
      currentSceneId: checkpoint.currentSceneId,
      conversationId: checkpoint.conversationId || "",
      expectedSceneIds: [...checkpoint.expectedSceneIds],
      activeAttempt,
      preparedBundle: checkpoint.preparedBundle || null,
      overrideHold: Boolean(checkpoint.overrideHold),
      rearmRequired: Boolean(checkpoint.rearmRequired),
      viewedSceneId: checkpoint.viewedSceneId || checkpoint.currentSceneId,
      nextStage: nextStage(checkpoint, audit),
      lastError: checkpoint.lastError || "",
      canRetryVeoUp: Boolean(
        audit.complete &&
        checkpoint.state === "BLOCKED" &&
        !activeAttempt &&
        !checkpoint.overrideHold,
      ),
      canCancelVeoUp: checkpoint.state === "VEOUP_RUNNING",
      veoUpCancelling: Boolean(activeVeoUpJobs.get(path.resolve(projectPath))?.cancelled),
      allowedCommands: activeAttempt
        ? ["capture", "cancel", "override-preview"]
        : checkpoint.overrideHold
          ? ["continue", "redo"]
          : ["prepare", "arm", "redo", "continue"],
      audit,
    };
  }

  async function autoStartVeoUpWhenReady(projectPath, result, trigger, { detached = false } = {}) {
    const viewModel = result?.viewModel || result;
    if (!result?.ok || viewModel?.state !== "VEOUP_READY" || !viewModel.audit?.complete) {
      return result;
    }
    if (detached) {
      void submitVeoUp({ projectPath, trigger }).catch((error) => {
        try { runtime.onObservationError?.(error); } catch (_) {}
      });
      return { ...result, autoVeoUp: { ok: true, status: "starting" } };
    }
    const autoVeoUp = await submitVeoUp({ projectPath, trigger });
    return {
      ...result,
      autoVeoUp,
      viewModel: autoVeoUp?.viewModel || viewModel,
    };
  }

  // Preparation has no ChatGPT side effect. Keep the UI on the actionable
  // prompt for the next required stage instead of asking the user to choose a
  // scene/stage and click a second button after every successful save.
  async function autoPrepareReadyStage(projectPath, result) {
    const viewModel = result?.viewModel || result;
    if (!result?.ok || !viewModel || viewModel.activeAttempt || viewModel.preparedBundle ||
      viewModel.overrideHold || !/^SCENE_NV[12]_READY$/.test(String(viewModel.state || ""))) {
      return result;
    }
    let prepared;
    try {
      prepared = await prepare({
        projectPath,
        sceneId: viewModel.currentSceneId,
        stage: viewModel.nextStage,
      });
    } catch (error) {
      return { ...result, autoPrepareError: error?.message || String(error) };
    }
    if (!prepared?.ok) return { ...result, autoPrepareError: prepared?.error || prepared?.code || "manual-auto-prepare-failed" };
    const confirmedViewModel = prepared.viewModel || await getViewModel({ projectPath });
    const preparedBundle = prepared.bundle || confirmedViewModel?.preparedBundle;
    if (!preparedBundle?.sceneId || !preparedBundle?.stage) {
      const autoPrepareError = "manual-auto-prepare-missing-bundle";
      return {
        ...result,
        autoPrepareError,
        viewModel: { ...viewModel, lastError: autoPrepareError },
      };
    }
    return {
      ...result,
      autoPrepared: { sceneId: preparedBundle.sceneId, stage: preparedBundle.stage },
      bundle: preparedBundle,
      viewModel: confirmedViewModel,
    };
  }

  async function initialize({ projectPath, expectedSceneIds, scenes = [] } = {}) {
    activate(projectPath);
    return withManualWorkflowLock(projectPath, async () => {
      if (runtime.loadProject) {
        const loaded = await runtime.loadProject(projectPath);
        scenes = loaded.scenes;
        expectedSceneIds = scenes.map((scene) => Number(scene.id));
      }
      const ids = normalizeExpectedSceneIds(expectedSceneIds);
      if (runtime.ensureProjectFiles) await runtime.ensureProjectFiles(projectPath, scenes);
      let checkpoint = await readManualWorkflowCheckpoint(projectPath);
      if (!checkpoint) {
        checkpoint = {
          version: MANUAL_WORKFLOW_VERSION,
          revision: 1,
          state: "PROJECT_AUDIT",
          expectedSceneIds: ids,
          currentSceneId: ids[0],
          conversationId: "",
          attempts: [],
          activeAttemptId: null,
          preparedBundle: null,
          sourceMap: Object.fromEntries(scenes.map((scene) => [scene.id, {
            ...(scene.keyframePath || scene.imagePath || scene.keyframeOutputPath ? { keyframePath: scene.keyframePath || scene.imagePath || scene.keyframeOutputPath } : {}),
            ...(scene.motionPromptPath || scene.motionPromptOutputPath ? { motionPromptPath: scene.motionPromptPath || scene.motionPromptOutputPath } : {}),
          }])),
          scenes: Array.isArray(scenes) ? scenes : [],
          createdAt: new Date().toISOString(),
        };
        checkpoint.state = "SCENE_NV1_READY";
        await writeManualWorkflowCheckpoint(projectPath, checkpoint);
        await appendManualWorkflowJournal(projectPath, {
          kind: "workflow_initialized",
          state: checkpoint.state,
          expectedSceneIds: ids,
        });
      } else {
        if (!runtime.loadProject && JSON.stringify(ids) !== JSON.stringify(checkpoint.expectedSceneIds)) {
          return reject(projectPath, "SCENE_INVENTORY_MISMATCH");
        }
        checkpoint.expectedSceneIds = ids;
        if (Array.isArray(scenes) && scenes.length) checkpoint.scenes = scenes;
        checkpoint.revision = Number(checkpoint.revision || 0) + 1;
        await writeManualWorkflowCheckpoint(projectPath, checkpoint);
      }
      const audit = await currentAudit(projectPath, checkpoint);
      if (migrateToNvOnly(checkpoint, audit)) {
        checkpoint.revision = Number(checkpoint.revision || 0) + 1;
        await writeManualWorkflowCheckpoint(projectPath, checkpoint);
        await appendManualWorkflowJournal(projectPath, { kind: "workflow_migrated_nv1_nv2_only", state: checkpoint.state });
      }
      return makeViewModel(projectPath, checkpoint);
    });
  }

  async function resume({ projectPath } = {}) {
    activate(projectPath);
    const result = await withManualWorkflowLock(projectPath, async () => {
      const checkpoint = await loadRequired(projectPath);
      const initialAudit = await currentAudit(projectPath, checkpoint);
      if (migrateToNvOnly(checkpoint, initialAudit)) {
        checkpoint.revision = Number(checkpoint.revision || 0) + 1;
        await writeManualWorkflowCheckpoint(projectPath, checkpoint);
        await appendManualWorkflowJournal(projectPath, { kind: "workflow_migrated_nv1_nv2_only", state: checkpoint.state });
      }
      const pending = checkpoint.attempts.find((item) => item.attemptId === checkpoint.activeAttemptId);
      if (pending?.pendingArtifact) {
        const bytes = await fs.readFile(pending.pendingArtifact.path).catch(() => null);
        if (bytes && crypto.createHash("sha256").update(bytes).digest("hex") === pending.pendingArtifact.hash) {
          Object.assign(pending, {
            status: "CAPTURED", artifactPath: pending.pendingArtifact.path,
            artifactHash: pending.pendingArtifact.hash, capturedAssistantTurnId: pending.pendingArtifact.assistantId,
          });
          checkpoint.activeAttemptId = null;
          checkpoint.preparedBundle = null;
          checkpoint.conversationId = pending.conversationId;
          checkpoint.sourceMap[pending.sceneId] ||= {};
          if (pending.stage === "NV1") Object.assign(checkpoint.sourceMap[pending.sceneId], { keyframePath: pending.artifactPath, invalidatedKeyframe: false });
          if (pending.stage === "NV2") Object.assign(checkpoint.sourceMap[pending.sceneId], { motionPromptPath: pending.artifactPath, invalidatedMotion: false });
          checkpoint.state = capturedState(pending.stage);
          await writeManualWorkflowCheckpoint(projectPath, checkpoint);
          await appendManualWorkflowJournal(projectPath, { kind: "artifact_reconciled", attemptId: pending.attemptId });
        }
      }
      const audit = await currentAudit(projectPath, checkpoint);
      if (checkpoint.state === "VEOUP_RUNNING") {
        const batchStatus = await runtime.getVeoUpBatchStatus?.(projectPath);
        if (!batchStatus?.active && !activeVeoUpJobs.has(path.resolve(projectPath))) {
          checkpoint.state = "BLOCKED";
          checkpoint.lastError = "manual-veoup-interrupted-check-batch-before-retry";
          checkpoint.revision += 1;
          await writeManualWorkflowCheckpoint(projectPath, checkpoint);
          await appendManualWorkflowJournal(projectPath, { kind: "veoup_interrupted", batchId: checkpoint.veoUpBatchId || null });
        }
      }
      if (!checkpoint.activeAttemptId && !checkpoint.overrideHold && audit.complete &&
        (checkpoint.state !== "BLOCKED" || checkpoint.lastError === "manual-project-audit-incomplete") &&
        !/^VEOUP_/.test(checkpoint.state)) {
        checkpoint.state = "VEOUP_READY";
        checkpoint.revision += 1;
        await writeManualWorkflowCheckpoint(projectPath, checkpoint);
      } else if (!audit.complete && checkpoint.state === "VEOUP_READY") {
        checkpoint.state = "BLOCKED";
        checkpoint.lastError = "manual-audit-readiness-revoked";
        checkpoint.revision += 1;
        await writeManualWorkflowCheckpoint(projectPath, checkpoint);
      }
      // A cancelled attempt or a crash between capture and transition leaves
      // no active turn. Rebuild the actionable stage from the disk audit so
      // reconnecting the workflow can prepare its prompt again.
      if (!checkpoint.activeAttemptId && !checkpoint.overrideHold && !audit.complete &&
        (["CANCELLED", "SCENE_NV1_CAPTURED", "SCENE_NV2_CAPTURED", "SCENE_COMPLETE"].includes(checkpoint.state) ||
          (checkpoint.state === "BLOCKED" && checkpoint.lastError === "manual-conversation-changed-reprepare-required"))) {
        checkpoint.currentSceneId = audit.firstIncompleteSceneId;
        checkpoint.state = readyState(nextStage(checkpoint, audit));
        checkpoint.preparedBundle = null;
        checkpoint.lastError = "";
        checkpoint.revision += 1;
        await writeManualWorkflowCheckpoint(projectPath, checkpoint);
        await appendManualWorkflowJournal(projectPath, {
          kind: "workflow_recovered_from_disk",
          sceneId: checkpoint.currentSceneId,
          state: checkpoint.state,
        });
      }
      // Older checkpoints (and a renderer that was closed mid-transition) can
      // retain a bundle from the previous scene. Never show that stale NV2
      // bundle while the workflow is already asking for the next scene's NV1.
      if (!checkpoint.activeAttemptId && !checkpoint.overrideHold && checkpoint.preparedBundle && !audit.complete) {
        const nextSceneId = audit.firstIncompleteSceneId;
        const nextScene = audit.scenes.find((scene) => scene.sceneId === nextSceneId);
        const expectedStage = nextScene?.keyframe.valid ? "NV2" : "NV1";
        if (Number(checkpoint.preparedBundle.sceneId) !== Number(nextSceneId) || checkpoint.preparedBundle.stage !== expectedStage) {
          checkpoint.currentSceneId = nextSceneId;
          checkpoint.preparedBundle = null;
          checkpoint.state = readyState(expectedStage);
          checkpoint.revision += 1;
          await writeManualWorkflowCheckpoint(projectPath, checkpoint);
          await appendManualWorkflowJournal(projectPath, {
            kind: "stale_prepared_bundle_discarded",
            expectedSceneId: nextSceneId,
            expectedStage,
          });
        }
      }
      return makeViewModel(projectPath, checkpoint);
    });
    return autoPrepareReadyStage(
      projectPath,
      await autoStartVeoUpWhenReady(projectPath, result, "manual-auto-resume"),
    );
  }

  async function prepare({ projectPath, sceneId, stage } = {}) {
    return withManualWorkflowLock(projectPath, async () => {
      const checkpoint = await loadRequired(projectPath);
      if (checkpoint.activeAttemptId) {
        return { ok: false, code: "ATTEMPT_ACTIVE", error: "manual-attempt-already-active" };
      }
      if (checkpoint.overrideHold) return reject(projectPath, "OVERRIDE_CONTINUE_REQUIRED");
      // Preparing a prompt is deliberately independent from Chrome.  The user
      // must be able to see/copy the exact prompt and attachment checklist
      // before opening ChatGPT.  Conversation ownership is enforced later by
      // `arm`, immediately before the user sends the prompt.
      const browser = await readConversationSnapshot().catch(() => null);
      const identity = String(browser?.conversationId || "");
      if (identity && identity !== checkpoint.conversationId) {
        checkpoint.conversationId = identity;
        checkpoint.preparedBundle = null;
      }
      const audit = await currentAudit(projectPath, checkpoint);
      const normalizedStage = String(stage || nextStage(checkpoint, audit)).toUpperCase();
      const numericSceneId = Number(sceneId || checkpoint.currentSceneId);
      if (!checkpoint.expectedSceneIds.includes(numericSceneId)) return reject(projectPath, "SCENE_MISMATCH");
      if (!VALID_MANUAL_STAGES.includes(normalizedStage)) return reject(projectPath, "STAGE_MISMATCH");
      const sceneAudit = audit.scenes.find((item) => item.sceneId === numericSceneId);
      if (normalizedStage === "NV2" && !sceneAudit.keyframe.valid) return reject(projectPath, "NV1_REQUIRED");
      if ((normalizedStage === "NV1" && sceneAudit.keyframe.valid) ||
          (normalizedStage === "NV2" && sceneAudit.readyForVeoUp)) return reject(projectPath, "STAGE_COMPLETE_USE_REDO");
      const scene = (checkpoint.scenes || []).find((item) => Number(item.id || item.sceneId) === numericSceneId) || {};
      const bundle = await buildStageBundle({
        projectPath,
        sceneId: numericSceneId,
        stage: normalizedStage,
        scene,
        keyframePath: sceneAudit.keyframe.path,
      });
      checkpoint.currentSceneId = numericSceneId;
      checkpoint.preparedBundle = JSON.parse(JSON.stringify(bundle));
      checkpoint.state = readyState(normalizedStage);
      checkpoint.overrideHold = false;
      checkpoint.lastError = "";
      checkpoint.revision += 1;
      await writeManualWorkflowCheckpoint(projectPath, checkpoint);
      await appendManualWorkflowJournal(projectPath, {
        kind: "stage_prepared",
        sceneId: numericSceneId,
        stage: normalizedStage,
        payloadFingerprint: bundle.payloadFingerprint,
        revision: checkpoint.revision,
      });
      return { ok: true, bundle: checkpoint.preparedBundle, viewModel: await makeViewModel(projectPath, checkpoint) };
    });
  }

  async function arm({ projectPath, bundle, auto = false } = {}) {
    if (!auto) activate(projectPath);
    return withManualWorkflowLock(projectPath, async () => {
      const checkpoint = await loadRequired(projectPath);
      const requestedBundle = checkpoint.preparedBundle;
      if (bundle && bundle.payloadFingerprint !== requestedBundle?.payloadFingerprint) return reject(projectPath, "BUNDLE_MISMATCH");
      if (!requestedBundle?.payloadFingerprint) {
        return { ok: false, code: "BUNDLE_REQUIRED", error: "manual-bundle-required" };
      }
      const active = checkpoint.activeAttemptId
        ? checkpoint.attempts.find((attempt) => attempt.attemptId === checkpoint.activeAttemptId)
        : null;
      if (active?.status === "WAITING") {
        if (active.payloadFingerprint !== requestedBundle.payloadFingerprint) {
          return { ok: false, code: "ATTEMPT_ACTIVE", error: "manual-attempt-has-different-bundle" };
        }
        return { ok: true, reused: true, attempt: active, viewModel: await makeViewModel(projectPath, checkpoint) };
      }
      const browser = await readConversationSnapshot();
      if (checkpoint.rearmRequired && browser.generating) {
        return { ok: false, code: "STILL_GENERATING", error: "manual-wait-for-cancelled-response-before-rearming" };
      }
      if (!checkpoint.conversationId && browser.conversationId) checkpoint.conversationId = String(browser.conversationId);
      if (String(browser.conversationId || "") !== checkpoint.conversationId) return reject(projectPath, "CONVERSATION_CHANGED_PREPARE_REQUIRED");
      if (!await verifyBundleFiles(requestedBundle)) return reject(projectPath, "BUNDLE_CHANGED");
      const messages = normalizeOwnedMessages(browser);
      if (messages.some((message) => !message.id)) return reject(projectPath, "UNPROVEN", "stable-message-ids-required-to-arm");
      // The user may press Send before Arm. If that exact prompt is already the
      // last turn, keep it in the attempt's fresh range so its later image/text
      // response can still be attributed to this scene.
      const latestUserIndex = messages.map((message) => message.role).lastIndexOf("user");
      const latestUserMatches = latestUserIndex >= 0 && matchOwnedUserTurn(messages[latestUserIndex], requestedBundle).matches;
      const hasOwnedOutput = latestUserMatches && messages.slice(latestUserIndex + 1)
        .some((message) => isStageAssistant(message, requestedBundle.stage));
      const previousAttemptForStage = checkpoint.attempts.some((item) =>
        item.sceneId === Number(requestedBundle.sceneId) && item.stage === requestedBundle.stage);
      const includePreSentUser = latestUserMatches &&
        (latestUserIndex === messages.length - 1 || (auto && hasOwnedOutput && !previousAttemptForStage));
      const baselineMessages = includePreSentUser ? messages.slice(0, latestUserIndex) : messages;
      const receipt = {
        attemptId: crypto.randomUUID(),
        sceneId: Number(requestedBundle.sceneId),
        stage: requestedBundle.stage,
        conversationId: String(browser?.conversationId || ""),
        pageId: String(browser.pageId || ""),
        pathname: String(browser.pathname || ""),
        promptFingerprint: crypto.createHash("sha256").update(String(requestedBundle.clipboardText || ""), "utf8").digest("hex"),
        payloadFingerprint: requestedBundle.payloadFingerprint,
        baselineUserTurnId: [...baselineMessages].reverse().find((message) => message.role === "user")?.id || null,
        baselineUserCount: countRoles(baselineMessages, "user"),
        baselineAssistantCount: countRoles(baselineMessages, "assistant"),
        baselineImageCount: baselineMessages.reduce((sum, message) => sum + (Array.isArray(message.images) ? message.images.length : 0), 0),
        baselineTurnIds: baselineMessages.map((message) => message.id).filter(Boolean),
        baselineAssistantFingerprints: Object.fromEntries(baselineMessages
          .filter((message) => message.role === "assistant")
          .map((message) => [message.id, assistantFingerprint(message)])),
        baselineAssistantTextHash: assistantFingerprint(baselineMessages.filter((message) => isStageAssistant(message, "NV2")).at(-1)),
        bundle: JSON.parse(JSON.stringify(requestedBundle)),
        createdAt: new Date().toISOString(),
        status: "WAITING",
        autoArmed: Boolean(auto),
        requireFreshUserTurn: Boolean(checkpoint.rearmRequired),
        capturedAssistantTurnId: null,
        artifactPath: null,
      };
      checkpoint.attempts.push(receipt);
      checkpoint.activeAttemptId = receipt.attemptId;
      checkpoint.preparedBundle = receipt.bundle;
      checkpoint.rearmRequired = false;
      checkpoint.currentSceneId = receipt.sceneId;
      checkpoint.state = waitingState(receipt.stage);
      checkpoint.revision += 1;
      await writeManualWorkflowCheckpoint(projectPath, checkpoint);
      await appendManualWorkflowJournal(projectPath, {
        kind: "stage_armed",
        attemptId: receipt.attemptId,
        sceneId: receipt.sceneId,
        stage: receipt.stage,
        conversationId: receipt.conversationId,
        revision: checkpoint.revision,
      });
      return { ok: true, attempt: receipt, viewModel: await makeViewModel(projectPath, checkpoint) };
    });
  }

  async function persistOwnedArtifact(projectPath, attempt, assistant, stillCurrent = () => true, beforeWrite = async () => {}, signal = null) {
    const token = normalizeSceneToken(attempt.sceneId);
    const sceneDir = resolveSceneDir(projectPath, token);
    await fs.mkdir(sceneDir, { recursive: true });
    if (attempt.stage === "NV1") {
      let buffer = Buffer.isBuffer(assistant.imageBuffer) ? assistant.imageBuffer : null;
      if (!buffer && Array.isArray(assistant.images)) {
        const candidate = assistant.images[assistant.images.length - 1];
        if (Buffer.isBuffer(candidate?.buffer)) buffer = candidate.buffer;
        else if (candidate?.base64) buffer = Buffer.from(candidate.base64, "base64");
      }
      if (!buffer && typeof runtime.extractOwnedImage === "function") {
        const extracted = await withManualDeadline(
          () => runtime.extractOwnedImage({ assistantTurnId: assistant.id, attempt, signal }),
          { timeoutMs: 75000, signal, label: "manual-owned-image" },
        );
        if (Buffer.isBuffer(extracted)) buffer = extracted;
        else if (extracted?.base64) buffer = Buffer.from(extracted.base64, "base64");
      }
      if (!buffer) return { ok: false, code: "UNPROVEN", error: "manual-owned-assistant-image-unavailable" };
      const artifactPath = path.join(sceneDir, `${token}_keyframe.png`);
      const tempPath = path.join(sceneDir, `.${attempt.attemptId}.png`);
      await writeBufferAtomic(tempPath, buffer);
      const validation = await validateManualKeyframe(tempPath);
      if (!validation.ok) {
        await fs.rm(tempPath, { force: true }).catch(() => null);
        return { ok: false, code: "INVALID_KEYFRAME", error: validation.error };
      }
      if (!stillCurrent()) {
        await fs.rm(tempPath, { force: true });
        return { ok: false, code: "ATTEMPT_CANCELLED" };
      }
      await beforeWrite(artifactPath, buffer);
      if (!stillCurrent() || signal?.aborted) {
        await fs.rm(tempPath, { force: true });
        return { ok: false, code: "ATTEMPT_CANCELLED" };
      }
      await fs.rename(tempPath, artifactPath);
      return {
        ok: true,
        artifactPath,
        hash: crypto.createHash("sha256").update(await fs.readFile(artifactPath)).digest("hex"),
      };
    }
    const validation = validateMotionPromptTextContent(assistant.text, {
      instruction: attempt.bundle.clipboardText,
    });
    if (!validation.ok) {
      return { ok: false, code: "INVALID_MOTION_PROMPT", error: validation.error };
    }
    const artifactPath = path.join(sceneDir, "motion_prompt.txt");
    if (!stillCurrent()) return { ok: false, code: "ATTEMPT_CANCELLED" };
    await beforeWrite(artifactPath, Buffer.from(validation.text));
    if (!stillCurrent() || signal?.aborted) return { ok: false, code: "ATTEMPT_CANCELLED" };
    await writeTextFileAtomic(artifactPath, validation.text);
    const savedText = await fs.readFile(artifactPath, "utf8");
    if (savedText !== validation.text || !validateMotionPromptTextContent(savedText).ok) {
      return { ok: false, code: "INVALID_MOTION_PROMPT", error: "saved-motion-prompt-validation-failed" };
    }
    return { ok: true, artifactPath, hash: crypto.createHash("sha256").update(savedText).digest("hex") };
  }

  async function capture({ projectPath, attemptId, sceneId, stage, adoptPrepared = false, autoCapture = false } = {}) {
    const resolvedProject = path.resolve(projectPath);
    const epoch = epochs.get(resolvedProject) || 0;
    const stillCurrent = () => epoch === (epochs.get(resolvedProject) || 0);
    const captureAbort = new AbortController();
    if (!activeCaptureAborters.has(resolvedProject)) activeCaptureAborters.set(resolvedProject, new Set());
    activeCaptureAborters.get(resolvedProject).add(captureAbort);
    const result = await withManualWorkflowLock(projectPath, async () => {
      const checkpoint = await loadRequired(projectPath);
      let attempt = checkpoint.attempts.find((item) => item.attemptId === checkpoint.activeAttemptId);
      let browser = null;
      let adoptedPreparedResponse = false;
      let confirmedExistingResponse = false;
      if (!attempt || attempt.status !== "WAITING") {
        if (!adoptPrepared) {
          return { ok: false, code: "NO_ACTIVE_ATTEMPT", error: "manual-active-attempt-required" };
        }
        if (checkpoint.rearmRequired) {
          return { ok: false, code: "REARM_REQUIRED", error: "manual-new-turn-required-after-cancel" };
        }
        browser = await readConversationSnapshot({ signal: captureAbort.signal });
        if (browser?.generating) {
          return { ok: false, code: "STILL_GENERATING", error: "manual-assistant-still-generating" };
        }
        const candidate = findPreparedResponseCandidate(browser, checkpoint);
        if (!candidate) {
          return { ok: false, code: "UNPROVEN", error: "manual-prepared-response-not-found" };
        }
        const baseline = candidate.messages.slice(0, candidate.userIndex);
        attempt = {
          attemptId: crypto.randomUUID(),
          sceneId: Number(candidate.bundle.sceneId),
          stage: candidate.bundle.stage,
          conversationId: String(browser.conversationId || ""),
          pageId: String(browser.pageId || ""),
          pathname: String(browser.pathname || ""),
          promptFingerprint: crypto.createHash("sha256").update(String(candidate.bundle.clipboardText || ""), "utf8").digest("hex"),
          payloadFingerprint: candidate.bundle.payloadFingerprint,
          baselineUserTurnId: [...baseline].reverse().find((message) => message.role === "user")?.id || null,
          baselineUserCount: countRoles(baseline, "user"),
          baselineAssistantCount: countRoles(baseline, "assistant"),
          baselineImageCount: baseline.reduce((sum, message) => sum + (Array.isArray(message.images) ? message.images.length : 0), 0),
          baselineTurnIds: baseline.map((message) => message.id).filter(Boolean),
          baselineAssistantFingerprints: Object.fromEntries(baseline
            .filter((message) => message.role === "assistant")
            .map((message) => [message.id, assistantFingerprint(message)])),
          baselineAssistantTextHash: assistantFingerprint(baseline.filter((message) => isStageAssistant(message, "NV2")).at(-1)),
          bundle: JSON.parse(JSON.stringify(candidate.bundle)),
          createdAt: new Date().toISOString(),
          status: "WAITING",
          adoptedPreparedResponse: true,
          adoptionProof: candidate.proof,
        };
        checkpoint.attempts.push(attempt);
        checkpoint.activeAttemptId = attempt.attemptId;
        adoptedPreparedResponse = true;
        await appendManualWorkflowJournal(projectPath, {
          kind: "prepared_response_adopted_for_manual_capture",
          attemptId: attempt.attemptId,
          sceneId: attempt.sceneId,
          stage: attempt.stage,
          assistantTurnId: candidate.assistant.id,
          proof: candidate.proof,
        });
      }
      if (!adoptedPreparedResponse && (attempt.attemptId !== attemptId || attempt.sceneId !== Number(sceneId) || attempt.stage !== String(stage || "").toUpperCase())) {
        return { ok: false, code: "ATTEMPT_MISMATCH", error: "manual-attempt-scene-stage-mismatch" };
      }
      browser ||= await readConversationSnapshot({ signal: captureAbort.signal });
      if (browser?.generating) {
        stableCandidates.delete(attempt.attemptId);
        return { ok: false, code: "STILL_GENERATING", error: "manual-assistant-still-generating" };
      }
      const liveConversationId = String(browser?.conversationId || "");
      const messages = normalizeOwnedMessages(browser);
      if (messages.some((message) => !message.id)) {
        return { ok: false, code: "UNPROVEN", error: "manual-stable-message-ids-required" };
      }
      if (attempt.conversationId && attempt.conversationId !== liveConversationId) {
        if (!liveConversationId) {
          return { ok: false, code: "CONVERSATION_UNRESOLVED", error: "manual-conversation-url-not-ready" };
        }
        const latestUser = [...messages].reverse().find((message) => message.role === "user");
        const ownership = latestUser ? matchOwnedUserTurn(latestUser, attempt.bundle) : null;
        const baselineIds = new Set(attempt.baselineTurnIds || []);
        const sameConversationEvidence = messages.some((message) => baselineIds.has(message.id));
        const samePage = Boolean(attempt.pageId && attempt.pageId === browser.pageId);
        if (!samePage || !ownership?.matches ||
          !(sameConversationEvidence || hasAllRequiredAttachments(ownership))) {
          return { ok: false, code: "CONVERSATION_MISMATCH", error: "manual-return-to-armed-conversation" };
        }
        const previousConversationId = attempt.conversationId;
        attempt.conversationId = liveConversationId;
        checkpoint.conversationId = liveConversationId;
        checkpoint.revision += 1;
        await writeManualWorkflowCheckpoint(projectPath, checkpoint);
        await appendManualWorkflowJournal(projectPath, {
          kind: "owned_conversation_promoted",
          attemptId: attempt.attemptId,
          previousConversationId,
          conversationId: liveConversationId,
        });
      }
      // A DOM-virtualized image turn or assistant acknowledgement can vanish
      // between NV1 and NV2. A missing historical baseline ID is not evidence
      // that the current owned user/assistant pair is absent. Match the latest
      // user turn to this stage, then use the assistant's ID/content relative
      // to the baseline to prove that the response is new.
      const userIndex = messages.map((message) => message.role).lastIndexOf("user");
      const ownedUser = userIndex >= 0 ? messages[userIndex] : null;
      const ownership = ownedUser ? matchOwnedUserTurn(ownedUser, attempt.bundle) : null;
      if (attempt.requireFreshUserTurn && ownedUser && (attempt.baselineTurnIds || []).includes(ownedUser.id)) {
        return { ok: false, code: "UNPROVEN", error: "manual-new-user-turn-required-after-cancel" };
      }
      if (!ownership?.matches && !(adoptPrepared && hasAllRequiredAttachments(ownership))) {
        return {
          ok: false,
          code: "UNPROVEN",
          error: "manual-owned-user-turn-not-found",
          observation: summarizeManualObservation(browser, checkpoint),
        };
      }
      if (ownership.missingAttachments.length && !attachmentWarnings.has(attempt.attemptId)) {
        attachmentWarnings.add(attempt.attemptId);
        await appendManualWorkflowJournal(projectPath, {
          kind: "manual-attachment-dom-not-visible",
          attemptId: attempt.attemptId,
          expectedAttachments: ownership.expectedAttachments,
          observedAttachments: ownership.observedAttachments,
          missingAttachments: ownership.missingAttachments,
        });
      }
      const baselineIds = new Set(attempt.baselineTurnIds || []);
      const baselineFingerprints = attempt.baselineAssistantFingerprints || {};
      let assistant = messages.slice(userIndex + 1)
        .filter((message) => isStageAssistant(message, attempt.stage))
        .at(-1);
      // NV2 can mutate the previous logical assistant slot in place. This is
      // only admissible with an exact owned latest user and a recorded change
      // from the pre-send text hash; it never applies to an NV1 image card.
      if (!assistant && attempt.stage === "NV2" && ownership.matches) {
        const previousAssistant = messages.slice(0, userIndex)
          .filter((message) => isStageAssistant(message, "NV2"))
          .at(-1);
        if (previousAssistant && baselineFingerprints[previousAssistant.id] &&
          baselineFingerprints[previousAssistant.id] !== assistantFingerprint(previousAssistant)) {
          assistant = previousAssistant;
        }
      }
      if (!assistant || assistant.settled === false) {
        stableCandidates.delete(attempt.attemptId);
        return { ok: false, code: "UNPROVEN", error: "manual-owned-assistant-turn-not-found" };
      }
      if (assistant.ready === false || assistant.placeholderVisible || browser.softBusy) {
        stableCandidates.delete(attempt.attemptId);
        return { ok: false, code: "STILL_GENERATING", error: "manual-assistant-output-not-ready" };
      }
      const alreadyCaptured = checkpoint.attempts.some((item) =>
        item.status === "CAPTURED" && item.sceneId === attempt.sceneId && item.stage === attempt.stage &&
        item.capturedAssistantTurnId === assistant.id);
      if (alreadyCaptured) return { ok: false, code: "ALREADY_CAPTURED", error: "manual-assistant-already-captured" };
      const assistantFresh = !baselineIds.has(assistant.id) ||
        Boolean(baselineFingerprints[assistant.id] && baselineFingerprints[assistant.id] !== assistantFingerprint(assistant));
      if (!assistantFresh && !adoptPrepared) {
        return { ok: false, code: "UNPROVEN", error: "manual-owned-assistant-not-new" };
      }
      confirmedExistingResponse = !assistantFresh;
      if (attempt.stage === "NV2") {
        const quality = validateMotionPromptTextContent(assistant.text, {
          instruction: attempt.bundle.clipboardText,
        });
        if (!quality.ok) {
          stableCandidates.delete(attempt.attemptId);
          return { ok: false, code: "INVALID_MOTION_PROMPT", error: quality.error };
        }
        if (attempt.baselineAssistantTextHash && assistantFingerprint(assistant) === attempt.baselineAssistantTextHash) {
          return { ok: false, code: "UNPROVEN", error: "manual-motion-response-unchanged-from-baseline" };
        }
      }
      if (autoCapture || runtime.watchIntervalMs) {
        const stability = observeAutoCandidate(attempt, assistant);
        if (!stability.ready) {
          return { ok: false, code: "RESPONSE_SETTLING", error: "manual-response-settling", stability };
        }
      }
      if (!attempt.conversationId && liveConversationId) {
        if (attempt.baselineTurnIds.length || !attempt.pageId || attempt.pageId !== browser.pageId || attempt.stage !== "NV1") {
          return reject(projectPath, "UNPROVEN", "root-conversation-promotion-unproven");
        }
        attempt.conversationId = liveConversationId;
      }
      if (!await verifyBundleFiles(attempt.bundle)) return reject(projectPath, "BUNDLE_CHANGED");
      let persisted;
      try {
        persisted = await persistOwnedArtifact(projectPath, attempt, assistant, stillCurrent, async (artifactPath, bytes) => {
          attempt.pendingArtifact = { path: artifactPath, hash: crypto.createHash("sha256").update(bytes).digest("hex"), assistantId: assistant.id };
          await writeManualWorkflowCheckpoint(projectPath, checkpoint);
        }, captureAbort.signal);
      } catch (error) {
        const code = error?.code === "MANUAL_OPERATION_CANCELLED" ? "ATTEMPT_CANCELLED"
          : error?.code === "MANUAL_OPERATION_TIMEOUT" || /image-fetch-timeout/.test(String(error?.message || "")) ? "IMAGE_FETCH_TIMEOUT"
            : error?.code === "UNPROVEN" ? "UNPROVEN" : "ARTIFACT_SAVE_FAILED";
        return { ok: false, code, error: error?.message || String(error) };
      }
      if (!persisted.ok) return persisted;
      if (!stillCurrent()) return reject(projectPath, "ATTEMPT_CANCELLED");
      auditProject.invalidate?.(persisted.artifactPath);
      attempt.status = "CAPTURED";
      stableCandidates.delete(attempt.attemptId);
      attachmentWarnings.delete(attempt.attemptId);
      delete attempt.pendingArtifact;
      attempt.capturedAssistantTurnId = assistant.id;
      attempt.artifactPath = persisted.artifactPath;
      attempt.artifactHash = persisted.hash;
      attempt.capturedAt = new Date().toISOString();
      checkpoint.activeAttemptId = null;
      checkpoint.preparedBundle = null;
      checkpoint.sourceMap[attempt.sceneId] ||= {};
      if (attempt.stage === "NV1") {
        checkpoint.sourceMap[attempt.sceneId].keyframePath = persisted.artifactPath;
        checkpoint.sourceMap[attempt.sceneId].invalidatedKeyframe = false;
      }
      if (attempt.stage === "NV2") {
        checkpoint.sourceMap[attempt.sceneId].motionPromptPath = persisted.artifactPath;
        checkpoint.sourceMap[attempt.sceneId].invalidatedMotion = false;
      }
      checkpoint.conversationId = attempt.conversationId || liveConversationId;
      checkpoint.state = capturedState(attempt.stage);
      checkpoint.revision += 1;
      await writeManualWorkflowCheckpoint(projectPath, checkpoint);
      await appendManualWorkflowJournal(projectPath, {
        kind: "stage_captured",
        attemptId: attempt.attemptId,
        sceneId: attempt.sceneId,
        stage: attempt.stage,
        assistantTurnId: assistant.id,
        artifactPath: persisted.artifactPath,
        artifactHash: persisted.hash,
        captureSource: adoptedPreparedResponse || confirmedExistingResponse ? "user-confirmed-prepared-response" : "armed-response",
        revision: checkpoint.revision,
      });
      if (attempt.stage === "NV1") {
        checkpoint.state = "SCENE_NV2_READY";
        await appendManualWorkflowJournal(projectPath, { kind: "transition", state: "SCENE_NV2_READY", sceneId: attempt.sceneId });
        await writeManualWorkflowCheckpoint(projectPath, checkpoint);
      }
      if (attempt.stage === "NV2") {
        checkpoint.state = "SCENE_COMPLETE";
        await appendManualWorkflowJournal(projectPath, { kind: "transition", state: "SCENE_COMPLETE", sceneId: attempt.sceneId });
        const audit = await currentAudit(projectPath, checkpoint);
        if (audit.complete) {
          await appendManualWorkflowJournal(projectPath, { kind: "transition", state: "PROJECT_COMPLETE" });
          checkpoint.state = "VEOUP_READY";
        } else {
          checkpoint.currentSceneId = audit.firstIncompleteSceneId;
          checkpoint.state = readyState(nextStage(checkpoint, audit));
        }
        await writeManualWorkflowCheckpoint(projectPath, checkpoint);
      }
      return {
        ok: true,
        attempt,
        observation: summarizeManualObservation(browser, checkpoint),
        viewModel: await makeViewModel(projectPath, checkpoint),
      };
    }).catch((error) => {
      if (error?.code === "MANUAL_OPERATION_CANCELLED") return { ok: false, code: "ATTEMPT_CANCELLED", error: "manual-attempt-cancelled" };
      if (error?.code === "MANUAL_OPERATION_TIMEOUT") return { ok: false, code: "OBSERVATION_TIMEOUT", error: error.message };
      throw error;
    }).finally(() => {
      const aborters = activeCaptureAborters.get(resolvedProject);
      aborters?.delete(captureAbort);
      if (aborters && !aborters.size) activeCaptureAborters.delete(resolvedProject);
    });
    if (result?.ok && result.attempt?.artifactPath) {
      emitChanged({ projectPath: path.resolve(projectPath), viewModel: result.viewModel, capture: { attempt: result.attempt } });
    }
    return autoPrepareReadyStage(
      projectPath,
      await autoStartVeoUpWhenReady(projectPath, result, "manual-auto-complete", { detached: autoCapture }),
    );
  }

  async function continueWorkflow({ projectPath } = {}) {
    const result = await withManualWorkflowLock(projectPath, async () => {
      const checkpoint = await loadRequired(projectPath);
      if (checkpoint.activeAttemptId) return reject(projectPath, "ATTEMPT_ACTIVE");
      const audit = await currentAudit(projectPath, checkpoint);
      checkpoint.overrideHold = false;
      if (checkpoint.state === "SCENE_NV1_CAPTURED") checkpoint.state = "SCENE_NV2_READY";
      else if (["SCENE_NV2_CAPTURED", "SCENE_COMPLETE", "BLOCKED", "CANCELLED"].includes(checkpoint.state)) {
        if (audit.complete) checkpoint.state = "VEOUP_READY";
        else {
          checkpoint.currentSceneId = audit.firstIncompleteSceneId;
          checkpoint.state = readyState(nextStage(checkpoint, audit));
        }
      }
      checkpoint.preparedBundle = null;
      checkpoint.revision += 1;
      await writeManualWorkflowCheckpoint(projectPath, checkpoint);
      await appendManualWorkflowJournal(projectPath, { kind: "workflow_continued", state: checkpoint.state });
      return makeViewModel(projectPath, checkpoint);
    });
    const prepared = await autoPrepareReadyStage(projectPath, result);
    return {
      ...(prepared.viewModel || prepared),
      ...(prepared.autoPrepareError ? { autoPrepareError: prepared.autoPrepareError } : {}),
    };
  }

  async function cancel({ projectPath, reason = "user-cancelled" } = {}) {
    invalidate(projectPath);
    stopWatcher();
    return withManualWorkflowLock(projectPath, async () => {
      const checkpoint = await loadRequired(projectPath);
      const attempt = checkpoint.attempts.find((item) => item.attemptId === checkpoint.activeAttemptId);
      if (attempt) {
        attempt.status = "CANCELLED";
        attempt.cancelledAt = new Date().toISOString();
      }
      checkpoint.activeAttemptId = null;
      checkpoint.preparedBundle = null;
      checkpoint.overrideHold = false;
      checkpoint.rearmRequired = Boolean(attempt) || Boolean(checkpoint.rearmRequired) || reason === "redo";
      checkpoint.state = "CANCELLED";
      checkpoint.revision += 1;
      await writeManualWorkflowCheckpoint(projectPath, checkpoint);
      await appendManualWorkflowJournal(projectPath, { kind: "workflow_cancelled", reason, attemptId: attempt?.attemptId || null });
      return { ok: true, viewModel: await makeViewModel(projectPath, checkpoint) };
    });
  }

  async function redo({ projectPath, sceneId, stage } = {}) {
    const id = Number(sceneId);
    const validTarget = await withManualWorkflowLock(projectPath, async () => {
      const checkpoint = await loadRequired(projectPath);
      return checkpoint.state !== "VEOUP_RUNNING" &&
        checkpoint.expectedSceneIds.includes(id) && VALID_MANUAL_STAGES.includes(stage);
    });
    if (!validTarget) return { ok: false, code: "INVALID_REDO_TARGET" };
    const cancelled = await cancel({ projectPath, reason: "redo" });
    if (!cancelled.ok) return cancelled;
    await withManualWorkflowLock(projectPath, async () => {
      const checkpoint = await loadRequired(projectPath);
      checkpoint.sourceMap[id] ||= {};
      if (stage === "NV1") checkpoint.sourceMap[id].invalidatedKeyframe = true;
      if (["NV1", "NV2"].includes(stage)) checkpoint.sourceMap[id].invalidatedMotion = true;
      checkpoint.veoUpBatchId = null;
      await writeManualWorkflowCheckpoint(projectPath, checkpoint);
      await appendManualWorkflowJournal(projectPath, { kind: "stage_redo_requested", sceneId: id, stage });
    });
    const prepared = await prepare({ projectPath, sceneId, stage });
    if (prepared?.ok) activate(projectPath);
    return prepared;
  }

  async function previewOverride({ projectPath } = {}) {
    return withManualWorkflowLock(projectPath, async () => {
      const checkpoint = await loadRequired(projectPath);
      const attempt = checkpoint.attempts.find((item) => item.attemptId === checkpoint.activeAttemptId);
      if (!attempt?.attemptId) return { ok: false, code: "NO_ACTIVE_ATTEMPT" };
      const browser = await readConversationSnapshot();
      if (browser.generating) return reject(projectPath, "STILL_GENERATING");
      const candidate = [...normalizeOwnedMessages(browser)].reverse().find((message) => message.role === "assistant");
      if (!candidate?.id) return { ok: false, code: "NO_OVERRIDE_CANDIDATE" };
      if (attempt.stage === "NV1" && !candidate.imageBuffer) {
        candidate.imageBuffer = runtime.extractOwnedImage
          ? await runtime.extractOwnedImage({ assistantTurnId: candidate.id, attempt })
          : candidate.images?.[0]?.buffer || (candidate.images?.[0]?.base64 ? Buffer.from(candidate.images[0].base64, "base64") : null);
      }
      const candidateHash = hashOverrideCandidate(candidate);
      const token = crypto.randomUUID();
      overrideCandidates.set(token, candidate);
      checkpoint.overridePreview = {
        token,
        attemptId: attempt.attemptId,
        candidateHash,
        candidateId: candidate.id,
        conversationId: String(browser.conversationId || ""),
        expiresAt: Date.now() + 5 * 60 * 1000,
      };
      checkpoint.revision += 1;
      await writeManualWorkflowCheckpoint(projectPath, checkpoint);
      return {
        ok: true,
        token,
        sceneId: attempt.sceneId,
        stage: attempt.stage,
        candidate: { id: candidate.id, text: candidate.text, hasImage: Boolean(candidate.imageBuffer || candidate.images?.length), imageDataUrl: candidate.imageBuffer ? `data:image/png;base64,${candidate.imageBuffer.toString("base64")}` : "" },
        warning: "Ownership could not be proven. Confirm only after reviewing this exact candidate.",
      };
    });
  }

  async function confirmOverride({ projectPath, token } = {}) {
    const epoch = epochs.get(path.resolve(projectPath)) || 0;
    return withManualWorkflowLock(projectPath, async () => {
      const checkpoint = await loadRequired(projectPath);
      const preview = checkpoint.overridePreview;
      const attempt = checkpoint.attempts.find((item) => item.attemptId === checkpoint.activeAttemptId);
      if (!preview || preview.token !== token || preview.expiresAt < Date.now() || preview.attemptId !== attempt?.attemptId) {
        return { ok: false, code: "OVERRIDE_TOKEN_INVALID" };
      }
      const browser = await readConversationSnapshot();
      const candidate = normalizeOwnedMessages(browser).find((message) => message.id === preview.candidateId);
      if (!candidate || browser.generating || String(browser.conversationId || "") !== preview.conversationId || !overrideCandidates.has(token)) return reject(projectPath, "OVERRIDE_CANDIDATE_CHANGED");
      if (attempt.stage === "NV1") candidate.imageBuffer = runtime.extractOwnedImage
        ? await runtime.extractOwnedImage({ assistantTurnId: candidate.id, attempt })
        : candidate.imageBuffer || candidate.images?.[0]?.buffer || (candidate.images?.[0]?.base64 ? Buffer.from(candidate.images[0].base64, "base64") : null);
      if (hashOverrideCandidate(candidate) !== preview.candidateHash) return reject(projectPath, "OVERRIDE_CANDIDATE_CHANGED");
      const persisted = await persistOwnedArtifact(projectPath, attempt, candidate, () => epoch === (epochs.get(path.resolve(projectPath)) || 0));
      if (!persisted.ok) return persisted;
      attempt.status = "OVERRIDDEN";
      attempt.artifactPath = persisted.artifactPath;
      attempt.artifactHash = persisted.hash;
      attempt.capturedAssistantTurnId = candidate.id;
      attempt.capturedAt = new Date().toISOString();
      checkpoint.activeAttemptId = null;
      checkpoint.overridePreview = null;
      checkpoint.overrideHold = true;
      checkpoint.overrideStage = attempt.stage;
      checkpoint.conversationId = preview.conversationId;
      checkpoint.sourceMap[attempt.sceneId] ||= {};
      if (attempt.stage === "NV1") Object.assign(checkpoint.sourceMap[attempt.sceneId], { keyframePath: persisted.artifactPath, invalidatedKeyframe: false });
      if (attempt.stage === "NV2") Object.assign(checkpoint.sourceMap[attempt.sceneId], { motionPromptPath: persisted.artifactPath, invalidatedMotion: false });
      overrideCandidates.delete(token);
      checkpoint.state = "BLOCKED";
      checkpoint.lastError = "manual-override-awaiting-explicit-continue";
      checkpoint.revision += 1;
      await writeManualWorkflowCheckpoint(projectPath, checkpoint);
      await appendManualWorkflowJournal(projectPath, {
        kind: "manual_override",
        attemptId: attempt.attemptId,
        sceneId: attempt.sceneId,
        stage: attempt.stage,
        candidateHash: preview.candidateHash,
        artifactPath: persisted.artifactPath,
      });
      return { ok: true, held: true, viewModel: await makeViewModel(projectPath, checkpoint) };
    });
  }

  async function submitVeoUp({ projectPath, trigger = "manual-retry" } = {}) {
    const resolved = path.resolve(projectPath);
    const started = await withManualWorkflowLock(projectPath, async () => {
      const checkpoint = await loadRequired(projectPath);
      if (checkpoint.state === "VEOUP_RUNNING") return reject(projectPath, "VEOUP_RUNNING");
      if (checkpoint.activeAttemptId || checkpoint.overrideHold) return reject(projectPath, "WORKFLOW_HELD");
      const audit = await currentAudit(projectPath, checkpoint, { forceFull: true });
      if (!audit.complete) {
        checkpoint.state = "BLOCKED";
        checkpoint.lastError = "manual-project-audit-incomplete";
        checkpoint.revision += 1;
        await writeManualWorkflowCheckpoint(projectPath, checkpoint);
        await appendManualWorkflowJournal(projectPath, {
          kind: "veoup_submission_rejected",
          missingSceneIds: audit.scenes.filter((scene) => !scene.readyForVeoUp).map((scene) => scene.sceneId),
        });
        return { ok: false, code: "PROJECT_INCOMPLETE", error: checkpoint.lastError, audit };
      }
      const job = { operationId: crypto.randomUUID(), cancelled: false };
      checkpoint.state = "VEOUP_RUNNING";
      checkpoint.veoUpOperationId = job.operationId;
      checkpoint.revision += 1;
      await writeManualWorkflowCheckpoint(projectPath, checkpoint);
      const viewModel = await makeViewModel(projectPath, checkpoint);
      activeVeoUpJobs.set(resolved, job);
      return { ok: true, checkpoint, audit, job, viewModel };
    });
    if (!started.ok) return started;
    const { checkpoint, audit, job } = started;
    emitChanged({ projectPath: resolved, viewModel: started.viewModel });
    let result;
    try {
        const submissionScenes = [];
        for (const scene of audit.scenes) {
          const inside = (filePath) => {
            const relative = path.relative(path.resolve(projectPath), filePath);
            return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
          };
          const materialize = async (filePath, name) => {
            if (inside(filePath)) return filePath;
            const target = path.join(projectPath, ".vidora", "veoup-inputs", String(scene.sceneId), name);
            await writeBufferAtomic(target, await fs.readFile(filePath));
            return target;
          };
          submissionScenes.push({
            id: scene.sceneId,
            imagePath: await materialize(scene.keyframe.path, "keyframe.png"),
            motionPromptPath: await materialize(scene.motionPrompt.path, "motion_prompt.txt"),
            manualAuditSource: true,
          });
        }
        result = await submitBatch({
          projectDir: manualWorkflowPaths(projectPath).projectDir,
          expectedSceneIds: [...checkpoint.expectedSceneIds],
          expectedSceneCount: checkpoint.expectedSceneIds.length,
          allowPartial: false,
          scenes: submissionScenes,
          trigger,
          isCancelled: () => job.cancelled,
          auditedSources: audit.scenes.map((scene) => ({
            sceneId: scene.sceneId,
            keyframePath: scene.keyframe.path,
            keyframeHash: scene.keyframe.hash,
            motionPromptPath: scene.motionPrompt.path,
            motionPromptHash: scene.motionPrompt.hash,
          })),
          preSubmitAudit: async () => {
            if (job.cancelled) return { ok: false, error: "manual-veoup-cancelled" };
            const fresh = await currentAudit(projectPath, checkpoint, { forceFull: true });
            const unchanged = fresh.complete && fresh.scenes.every((scene, index) => scene.keyframe.hash === audit.scenes[index].keyframe.hash && scene.motionPrompt.hash === audit.scenes[index].motionPrompt.hash);
            return unchanged ? { ok: true, audit: fresh } : { ok: false, error: "manual-pre-submit-audit-failed", audit: fresh };
          },
        });
    } catch (error) {
        result = { ok: false, status: "failed", error: error?.message || String(error) };
    }
    let completed;
    try {
      completed = await withManualWorkflowLock(projectPath, async () => {
      const checkpoint = await loadRequired(projectPath);
      if (checkpoint.veoUpOperationId !== job.operationId) return { ...result, stale: true, viewModel: await makeViewModel(projectPath, checkpoint) };
      checkpoint.state = result?.ok ? "VEOUP_COMPLETE" : "BLOCKED";
      checkpoint.lastError = result?.ok ? "" : result?.error || "veoup-submission-failed";
      checkpoint.veoUpBatchId = result?.batchId || checkpoint.veoUpBatchId || null;
      checkpoint.revision += 1;
      await writeManualWorkflowCheckpoint(projectPath, checkpoint);
      await appendManualWorkflowJournal(projectPath, {
        kind: result?.ok ? "veoup_submission_completed" : "veoup_submission_failed",
        batchId: result?.batchId || null,
        error: result?.error || "",
      });
      return { ...result, audit, viewModel: await makeViewModel(projectPath, checkpoint) };
      });
    } finally {
      if (activeVeoUpJobs.get(resolved) === job) activeVeoUpJobs.delete(resolved);
    }
    emitChanged({ projectPath: resolved, viewModel: completed.viewModel });
    return completed;
  }

  async function cancelVeoUp({ projectPath } = {}) {
    const resolved = path.resolve(projectPath);
    const job = activeVeoUpJobs.get(resolved);
    if (job) job.cancelled = true;
    const current = await getViewModel({ projectPath });
    if (current.state !== "VEOUP_RUNNING") return { ok: false, code: "VEOUP_NOT_RUNNING", viewModel: current };
    let batch;
    try { batch = await runtime.cancelVeoUpBatch?.(resolved); }
    catch (error) { batch = { ok: false, error: error?.message || String(error) }; }
    const viewModel = await getViewModel({ projectPath });
    if (viewModel.state !== "VEOUP_RUNNING") return { ok: true, status: viewModel.state, batch, viewModel };
    const cancellingView = { ...viewModel, veoUpCancelling: true };
    emitChanged({ projectPath: resolved, viewModel: cancellingView });
    return { ok: true, status: "cancelling", batch, viewModel: cancellingView };
  }

  async function getViewModel({ projectPath } = {}) {
    return withManualWorkflowLock(projectPath, async () => makeViewModel(projectPath, await loadRequired(projectPath)));
  }

  async function getObservation({ projectPath } = {}) {
    let browser;
    let observationError;
    try { browser = await readConversationSnapshot(); }
    catch (error) { observationError = error; }
    return withManualWorkflowLock(projectPath, async () => {
      const checkpoint = await loadRequired(projectPath);
      if (!observationError) {
        return {
          ok: true,
          observation: summarizeManualObservation(browser, checkpoint),
          viewModel: await makeViewModel(projectPath, checkpoint),
        };
      }
      return {
        ok: true,
        observation: {
          available: false,
          checkedAt: new Date().toISOString(),
          error: observationError?.message || String(observationError),
          messageCount: 0,
          userMessageCount: 0,
          assistantMessageCount: 0,
          turns: [],
          observedOutputs: [],
          savedOutputs: [],
        },
        viewModel: await makeViewModel(projectPath, checkpoint),
      };
    });
  }

  async function selectScene({ projectPath, sceneId } = {}) {
    return withManualWorkflowLock(projectPath, async () => {
      const checkpoint = await loadRequired(projectPath);
      if (!checkpoint.expectedSceneIds.includes(Number(sceneId))) return reject(projectPath, "SCENE_MISMATCH");
      checkpoint.viewedSceneId = Number(sceneId);
      await writeManualWorkflowCheckpoint(projectPath, checkpoint);
      return makeViewModel(projectPath, checkpoint);
    });
  }

  return {
    initialize,
    resume,
    prepare,
    arm,
    capture,
    continue: continueWorkflow,
    cancel,
    redo,
    previewOverride,
    confirmOverride,
    submitVeoUp,
    cancelVeoUp,
    getViewModel,
    getObservation,
    selectScene,
    dispose: () => { if (watchedProject) invalidate(watchedProject); stopWatcher(); },
  };
}

function hashOverrideCandidate(candidate) {
  return crypto.createHash("sha256").update(candidate.id).update(candidate.text || "")
    .update(Buffer.isBuffer(candidate.imageBuffer) ? candidate.imageBuffer : Buffer.from(JSON.stringify(candidate.images || []))).digest("hex");
}

module.exports = {
  VALID_MANUAL_STAGES, normalizeSceneToken, resolveSceneDir,
  MANUAL_WORKFLOW_VERSION, manualWorkflowPaths, readManualWorkflowCheckpoint,
  normalizedPromptIdentity, matchOwnedUserTurn, summarizeManualObservation,
  createManualChatGptController,
};
