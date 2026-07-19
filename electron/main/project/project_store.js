const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const projectWriteQueues = new Map();

function isIgnorableSyncError(error) {
  return ["EINVAL", "ENOTSUP", "ENOSYS", "EPERM"].includes(error?.code);
}

async function replaceFile(targetPath, tempPath) {
  try {
    await fs.rename(tempPath, targetPath);
    return;
  } catch (error) {
    if (!["EEXIST", "EPERM", "EACCES"].includes(error?.code)) throw error;
  }

  const backupPath = `${targetPath}.backup-${process.pid}-${crypto.randomUUID()}`;
  let targetMoved = false;
  try {
    await fs.rename(targetPath, backupPath);
    targetMoved = true;
    await fs.rename(tempPath, targetPath);
    await fs.rm(backupPath, { force: true }).catch(() => null);
  } catch (error) {
    if (targetMoved) {
      await fs.rename(backupPath, targetPath).catch(() => null);
    }
    throw error;
  }
}

async function writeTextFileAtomic(targetPath, content) {
  const requestedTarget = String(targetPath || "").trim();
  if (!requestedTarget) throw new Error("Missing atomic write target path.");
  const resolvedTarget = path.resolve(requestedTarget);
  await fs.mkdir(path.dirname(resolvedTarget), { recursive: true });
  const tempPath = path.join(
    path.dirname(resolvedTarget),
    `.${path.basename(resolvedTarget)}.tmp-${process.pid}-${crypto.randomUUID()}`,
  );
  let handle = null;
  try {
    handle = await fs.open(tempPath, "wx");
    await handle.writeFile(String(content), "utf8");
    try {
      await handle.sync();
    } catch (error) {
      if (!isIgnorableSyncError(error)) throw error;
    }
    await handle.close();
    handle = null;
    await replaceFile(resolvedTarget, tempPath);
    return { filePath: resolvedTarget, bytesWritten: Buffer.byteLength(String(content), "utf8") };
  } finally {
    if (handle) await handle.close().catch(() => null);
    await fs.rm(tempPath, { force: true }).catch(() => null);
  }
}

async function writeJsonFileAtomic(targetPath, payload, spacing = 2) {
  const text = JSON.stringify(payload, null, spacing);
  return writeTextFileAtomic(targetPath, text);
}

function enqueueProjectWrite(targetPath, operation) {
  const requestedTarget = String(targetPath || "").trim();
  if (!requestedTarget) {
    return Promise.reject(new Error("Missing project write target path."));
  }
  const key = path.resolve(requestedTarget);
  const previous = projectWriteQueues.get(key) || Promise.resolve();
  const current = previous
    .catch(() => null)
    .then(() => operation());
  projectWriteQueues.set(key, current);
  return current.finally(() => {
    if (projectWriteQueues.get(key) === current) projectWriteQueues.delete(key);
  });
}

function getProjectWriteQueueSize() {
  return projectWriteQueues.size;
}

module.exports = {
  writeTextFileAtomic,
  writeJsonFileAtomic,
  enqueueProjectWrite,
  getProjectWriteQueueSize,
};
