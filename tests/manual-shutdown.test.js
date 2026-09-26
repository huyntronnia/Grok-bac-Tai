"use strict";

const assert = require("assert");
const { EventEmitter } = require("events");
const { installManualShutdown } = require("../electron/main/bootstrap/manual_shutdown");

function fakeApp() {
  const app = new EventEmitter();
  app.quitCalls = 0;
  app.exited = false;
  app.quit = () => {
    app.quitCalls += 1;
    let prevented = false;
    app.emit("before-quit", { preventDefault: () => { prevented = true; } });
    if (!prevented) app.exited = true;
  };
  return app;
}

(async () => {
  const app = fakeApp();
  let disposed = 0;
  let cancelled = 0;
  let active = { batchId: "batch-1", projectDir: "project" };
  installManualShutdown({
    app,
    controller: { dispose: () => { disposed += 1; } },
    getCoordinator: () => ({
      getActiveJob: () => active,
      cancelBatch: async () => { cancelled += 1; setTimeout(() => { active = null; }, 10); },
    }),
  });
  app.emit("window-all-closed");
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(cancelled, 1);
  assert.equal(app.exited, true, "closing the last Windows window must finish quitting");
  assert(disposed >= 1, "manual watcher must be disposed before quit");

  const noBatch = fakeApp();
  let noBatchDisposed = 0;
  installManualShutdown({ app: noBatch, controller: { dispose: () => { noBatchDisposed += 1; } } });
  noBatch.emit("window-all-closed");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(noBatch.exited, true);
  assert(noBatchDisposed >= 1, "closing without a batch must still stop the watcher");

  const stuck = fakeApp();
  let killedChildren = 0;
  installManualShutdown({
    app: stuck,
    controller: { dispose() {} },
    waitForBatchMs: 1,
    getCoordinator: () => ({
      getActiveJob: () => ({ batchId: "stuck", projectDir: "project" }),
      cancelBatch: async () => ({ ok: true, cancelled: true }),
    }),
    killChildren: () => { killedChildren += 1; },
  });
  stuck.emit("window-all-closed");
  await new Promise((resolve) => setTimeout(resolve, 130));
  assert.equal(killedChildren, 1, "an unresponsive batch child must be killed before exit");
  assert.equal(stuck.exited, true);
  console.log("Manual shutdown stops watcher and active batch before app exit");
})().catch((error) => { console.error(error?.stack || error); process.exitCode = 1; });
