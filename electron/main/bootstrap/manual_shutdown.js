"use strict";

function installManualShutdown({
  app,
  controller,
  getCoordinator = () => null,
  killChildren = () => {},
  onError = () => {},
  waitForBatchMs = 5000,
} = {}) {
  let shutdownPromise = null;
  let readyToQuit = false;
  let quitResumeScheduled = false;

  function beginShutdown() {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      controller?.dispose?.();
      const coordinator = getCoordinator();
      const job = coordinator?.getActiveJob?.();
      if (!job) return;
      try {
        await coordinator.cancelBatch({ batchId: job.batchId, projectDir: job.projectDir });
      } catch (error) {
        onError(error);
      }
      const deadline = Date.now() + waitForBatchMs;
      while (coordinator.getActiveJob() && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (coordinator.getActiveJob()) killChildren();
    })().catch(onError).finally(() => { shutdownPromise = null; });
    return shutdownPromise;
  }

  app.on("window-all-closed", () => {
    app.quit();
  });
  app.on("before-quit", (event) => {
    if (readyToQuit) {
      controller?.dispose?.();
      return;
    }
    event.preventDefault();
    if (quitResumeScheduled) return;
    quitResumeScheduled = true;
    void beginShutdown().finally(() => {
      readyToQuit = true;
      app.quit();
    });
  });
  return { beginShutdown };
}

module.exports = { installManualShutdown };
