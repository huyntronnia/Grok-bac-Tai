"use strict";

function manualOperationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function withManualDeadline(operation, { timeoutMs, signal, label = "manual-operation" } = {}) {
  if (signal?.aborted) throw manualOperationError("MANUAL_OPERATION_CANCELLED", `${label}-cancelled`);
  let timer;
  let onAbort;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(manualOperationError("MANUAL_OPERATION_TIMEOUT", `${label}-timed-out`)), timeoutMs);
    if (signal) {
      onAbort = () => reject(manualOperationError("MANUAL_OPERATION_CANCELLED", `${label}-cancelled`));
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
  try {
    return await Promise.race([Promise.resolve().then(operation), deadline]);
  } finally {
    clearTimeout(timer);
    if (signal && onAbort) signal.removeEventListener("abort", onAbort);
  }
}

module.exports = { withManualDeadline };
