const crypto = require("crypto");
const {
  buildVeoUpBatchManifest,
  createVeoUpBatchFingerprint,
  manifestToAutomationScenes,
} = require("./batch_manifest");
const {
  readVeoUpBatchState,
  writeVeoUpBatchState,
} = require("./batch_state_store");

const REUSABLE_BATCH_STATUSES = new Set([
  "previewed",
  "loaded",
  "submitted",
  "running_external",
  "completed",
]);

function compactBatchResult(result = {}) {
  return {
    ok: Boolean(result.ok),
    status: String(result.status || ""),
    error: String(result.error || ""),
    imageCount: Number(result.imageCount || 0),
    promptLineCount: Number(result.promptLineCount || 0),
    expectedRows: Number(result.expectedRows || 0),
    detectedRows: Number(result.detectedRows || 0),
    imageRows: Number(result.imageRows || 0),
    promptRows: Number(result.promptRows || 0),
    selectionCount: Number(result.selectionCount || 0),
    selectionVerified: Boolean(result.selectionVerified),
    selectionMethod: String(result.selectionMethod || ""),
    verificationMethod: String(result.verificationMethod || ""),
    chunkIndex: Number(result.chunkIndex || 1),
    chunkCount: Number(result.chunkCount || 1),
    generateAcknowledged: Boolean(result.generateAcknowledged),
    outputFolder: String(result.outputFolder || ""),
  };
}

function createVeoUpBatchCoordinator({
  executeAutomation,
  appendLog = null,
  readState = readVeoUpBatchState,
  writeState = writeVeoUpBatchState,
} = {}) {
  if (typeof executeAutomation !== "function") {
    throw new Error("VeoUp batch coordinator requires executeAutomation.");
  }

  let activeJob = null;

  const log = async (kind, text, details = null) => {
    if (typeof appendLog !== "function") return;
    await appendLog(null, {
      source: "veoup-batch",
      kind,
      text,
      details,
    }).catch(() => null);
  };

  async function requestBatch(payload = {}) {
    const projectDir = String(payload.projectDir || payload.outputFolder || "").trim();
    const manifest = await buildVeoUpBatchManifest({
      ...payload,
      projectDir,
    });
    if (!manifest.ok) {
      await log("warn", "VeoUp batch manifest validation failed.", {
        expectedSceneCount: manifest.expectedSceneCount,
        readySceneCount: manifest.readySceneCount,
        missing: manifest.missing,
        duplicates: manifest.duplicates,
      });
      return manifest;
    }

    const options = {
      previewStartButtonOnly: Boolean(payload.previewStartButtonOnly),
      autoStartVideoGeneration: payload.autoStartVideoGeneration !== false,
    };
    const fingerprint = createVeoUpBatchFingerprint(manifest, options);
    const previous = await readState(projectDir);
    if (
      payload.force !== true &&
      previous?.fingerprint === fingerprint &&
      REUSABLE_BATCH_STATUSES.has(previous.status)
    ) {
      return {
        ok: true,
        deduplicated: true,
        batchId: previous.batchId,
        fingerprint,
        status: previous.status,
        expectedSceneCount: manifest.expectedSceneCount,
        readySceneCount: manifest.readySceneCount,
        skippedSceneIds: manifest.skippedSceneIds || [],
        imageCount: Number(previous?.result?.imageCount || manifest.readySceneCount),
        promptLineCount: Number(previous?.result?.promptLineCount || manifest.readySceneCount),
        expectedRows: Number(previous?.result?.expectedRows || manifest.readySceneCount),
        detectedRows: Number(previous?.result?.detectedRows || manifest.readySceneCount),
      };
    }

    if (activeJob) {
      if (activeJob.fingerprint === fingerprint) {
        return {
          ok: true,
          joined: true,
          batchId: activeJob.batchId,
          fingerprint,
          status: activeJob.status,
          expectedSceneCount: manifest.expectedSceneCount,
          readySceneCount: manifest.readySceneCount,
          skippedSceneIds: manifest.skippedSceneIds || [],
          imageCount: manifest.readySceneCount,
          promptLineCount: manifest.readySceneCount,
        };
      }
      return {
        ok: false,
        status: "busy",
        error: "veoup-batch-busy",
        activeBatchId: activeJob.batchId,
      };
    }

    const batchId = crypto.randomUUID();
    const chunkIndex = 1;
    const chunkCount = 1;
    const trigger = String(payload.trigger || "manual-scan");
    const startedAt = new Date().toISOString();
    const job = {
      batchId,
      fingerprint,
      projectDir,
      status: "validated",
      cancelled: false,
    };
    activeJob = job;
    await writeState(projectDir, {
      batchId,
      fingerprint,
      trigger,
      status: "validated",
      expectedSceneCount: manifest.expectedSceneCount,
      readySceneCount: manifest.readySceneCount,
      skippedSceneIds: manifest.skippedSceneIds || [],
      currentChunk: chunkIndex,
      chunkCount,
      startedAt,
      lastError: "",
    });
    await log("running", `VeoUp batch ${batchId}: validated ${manifest.readySceneCount} scene(s).`, {
      batchId,
      fingerprint,
      trigger,
    });

    try {
      job.status = "loading";
      await writeState(projectDir, {
        batchId,
        fingerprint,
        trigger,
        status: "loading",
        expectedSceneCount: manifest.expectedSceneCount,
        readySceneCount: manifest.readySceneCount,
        skippedSceneIds: manifest.skippedSceneIds || [],
        currentChunk: chunkIndex,
        chunkCount,
        startedAt,
        lastError: "",
      });
      const externalCancelled = typeof payload.isCancelled === "function"
        ? payload.isCancelled
        : () => false;
      if (typeof payload.preSubmitAudit === "function") {
        const gate = await payload.preSubmitAudit();
        if (!gate?.ok) {
          const error = new Error(gate?.error || "veoup-pre-submit-audit-failed");
          error.result = gate;
          throw error;
        }
      }
      const result = await executeAutomation({
        ...payload,
        outputFolder: projectDir,
        projectDir,
        batchMode: true,
        batchId,
        expectedRows: manifest.readySceneCount,
        chunkIndex,
        chunkCount,
        autoStartVideoGeneration: options.autoStartVideoGeneration,
        previewStartButtonOnly: options.previewStartButtonOnly,
        scenes: manifestToAutomationScenes(manifest),
        isCancelled: () => job.cancelled || externalCancelled(),
      });
      if (!result?.ok) {
        const error = new Error(result?.error || "veoup-batch-automation-failed");
        error.result = result;
        throw error;
      }
      const status = options.previewStartButtonOnly
        ? "previewed"
        : options.autoStartVideoGeneration
          ? "submitted"
          : "loaded";
      job.status = status;
      const compactResult = compactBatchResult({ ...result, status });
      await writeState(projectDir, {
        batchId,
        fingerprint,
        trigger,
        status,
        expectedSceneCount: manifest.expectedSceneCount,
        readySceneCount: manifest.readySceneCount,
        skippedSceneIds: manifest.skippedSceneIds || [],
        submittedSceneCount: status === "submitted" ? manifest.readySceneCount : 0,
        currentChunk: chunkIndex,
        chunkCount,
        startedAt,
        finishedAt: new Date().toISOString(),
        lastError: "",
        result: compactResult,
      });
      await log("ok", `VeoUp batch ${batchId}: ${status} ${manifest.readySceneCount} scene(s).`, {
        batchId,
        fingerprint,
        status,
      });
      return {
        ...compactResult,
        ok: true,
        status,
        batchId,
        fingerprint,
        expectedSceneCount: manifest.expectedSceneCount,
        readySceneCount: manifest.readySceneCount,
        skippedSceneIds: manifest.skippedSceneIds || [],
        chunkIndex,
        chunkCount,
        imageCount: Number(result.imageCount || manifest.readySceneCount),
        promptLineCount: Number(result.promptLineCount || manifest.readySceneCount),
      };
    } catch (error) {
      const cancelled = job.cancelled || error?.code === "PIPELINE_CANCELLED";
      const status = cancelled ? "cancelled" : "failed";
      const failedResult = compactBatchResult(error?.result || {});
      job.status = status;
      await writeState(projectDir, {
        batchId,
        fingerprint,
        trigger,
        status,
        expectedSceneCount: manifest.expectedSceneCount,
        readySceneCount: manifest.readySceneCount,
        skippedSceneIds: manifest.skippedSceneIds || [],
        currentChunk: chunkIndex,
        chunkCount,
        startedAt,
        finishedAt: new Date().toISOString(),
        lastError: error?.message || String(error),
        result: failedResult,
      }).catch(() => null);
      await log(cancelled ? "warn" : "error", `VeoUp batch ${batchId}: ${status}.`, {
        batchId,
        error: error?.message || String(error),
        result: failedResult,
        expectedSceneCount: manifest.expectedSceneCount,
        readySceneCount: manifest.readySceneCount,
      });
      return {
        ...failedResult,
        ok: false,
        cancelled,
        status,
        error: error?.message || String(error),
        batchId,
        fingerprint,
      };
    } finally {
      if (activeJob === job) activeJob = null;
    }
  }

  async function getBatchStatus(projectDir = "") {
    if (activeJob && (!projectDir || activeJob.projectDir === projectDir)) {
      return {
        ok: true,
        active: true,
        batchId: activeJob.batchId,
        fingerprint: activeJob.fingerprint,
        status: activeJob.status,
      };
    }
    const state = await readState(projectDir);
    return state ? { ok: true, active: false, ...state } : { ok: true, active: false, status: "idle" };
  }

  async function cancelBatch({ batchId = "", projectDir = "" } = {}) {
    if (!activeJob) return { ok: true, cancelled: false, status: "idle" };
    if (batchId && activeJob.batchId !== batchId) {
      return { ok: false, cancelled: false, error: "veoup-batch-id-mismatch" };
    }
    if (projectDir && activeJob.projectDir !== projectDir) {
      return { ok: false, cancelled: false, error: "veoup-batch-project-mismatch" };
    }
    activeJob.cancelled = true;
    activeJob.status = "cancelling";
    return { ok: true, cancelled: true, batchId: activeJob.batchId, status: "cancelling" };
  }

  return {
    requestBatch,
    getBatchStatus,
    cancelBatch,
    getActiveJob: () => activeJob ? { ...activeJob } : null,
  };
}

module.exports = {
  REUSABLE_BATCH_STATUSES,
  compactBatchResult,
  createVeoUpBatchCoordinator,
};
