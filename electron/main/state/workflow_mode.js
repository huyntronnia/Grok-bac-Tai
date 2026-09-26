"use strict";

const WORKFLOW_MODE = "manual_keyframe_motion";
let workflowMode = globalThis.__vidoraWorkflowMode || null;

function normalizeWorkflowMode(value) {
  const requested = String(value || WORKFLOW_MODE).trim();
  if (requested !== WORKFLOW_MODE) {
    const error = new Error(`unsupported-workflow-mode:${requested || "empty"}`);
    error.code = "UNSUPPORTED_WORKFLOW_MODE";
    throw error;
  }
  return WORKFLOW_MODE;
}

function setWorkflowMode(value = WORKFLOW_MODE) {
  workflowMode = normalizeWorkflowMode(value);
  globalThis.__vidoraWorkflowMode = workflowMode;
  globalThis.__vidoraManualChatGPTMode = true;
  return workflowMode;
}

function getWorkflowMode() {
  return workflowMode;
}

function isManualWorkflowMode() {
  return getWorkflowMode() === WORKFLOW_MODE;
}

function assertAutomaticChatGptMutationAllowed(action = "automatic-action") {
  if (!isManualWorkflowMode()) return true;
  const error = new Error(
    `manual-mode-automatic-chatgpt-mutation-blocked:${String(action || "automatic-action")}`,
  );
  error.code = "MANUAL_MODE_AUTOMATION_BLOCKED";
  error.action = String(action || "automatic-action");
  throw error;
}

function migrateProjectWorkflowMode(payload = {}) {
  if (!payload || typeof payload !== "object") return payload;
  const project = payload.project && typeof payload.project === "object"
    ? payload.project
    : payload;
  project.workflowMode = WORKFLOW_MODE;
  delete project.manualChatGPT;
  delete project.keyframeMotionPromptOnly;
  return payload;
}

module.exports = {
  WORKFLOW_MODE,
  normalizeWorkflowMode,
  setWorkflowMode,
  getWorkflowMode,
  isManualWorkflowMode,
  assertAutomaticChatGptMutationAllowed,
  migrateProjectWorkflowMode,
};
