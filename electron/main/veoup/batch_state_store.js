const fs = require("fs/promises");
const path = require("path");
const { writeJsonFileAtomic, enqueueProjectWrite } = require("../project");

const VEOUP_BATCH_STATE_FILE = "veoup_batch_state.json";

function getVeoUpBatchStatePath(projectDir = "") {
  return path.join(path.resolve(String(projectDir || "")), VEOUP_BATCH_STATE_FILE);
}

async function readVeoUpBatchState(projectDir = "") {
  if (!projectDir) return null;
  const statePath = getVeoUpBatchStatePath(projectDir);
  try {
    const raw = await fs.readFile(statePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_error) {
    return null;
  }
}

async function writeVeoUpBatchState(projectDir = "", state = {}) {
  if (!projectDir) throw new Error("Missing project directory for VeoUp batch state.");
  const statePath = getVeoUpBatchStatePath(projectDir);
  const safeState = {
    version: 1,
    ...state,
    projectDir: path.resolve(projectDir),
    updatedAt: new Date().toISOString(),
  };
  const result = await enqueueProjectWrite(statePath, () =>
    writeJsonFileAtomic(statePath, safeState),
  );
  return { ...safeState, statePath, bytesWritten: result.bytesWritten };
}

module.exports = {
  VEOUP_BATCH_STATE_FILE,
  getVeoUpBatchStatePath,
  readVeoUpBatchState,
  writeVeoUpBatchState,
};
