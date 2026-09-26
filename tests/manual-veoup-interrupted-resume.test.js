"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const { createHarness } = require("./helpers/manual-workflow-fixture");
const { manualWorkflowPaths } = require("../electron/main/chatgpt/manual_chatgpt_controller");

(async () => {
  const harness = await createHarness({ ids: [1] });
  try {
    await harness.writeScene(1);
    const checkpointPath = manualWorkflowPaths(harness.root).checkpointPath;
    const checkpoint = JSON.parse(await fs.readFile(checkpointPath, "utf8"));
    checkpoint.state = "VEOUP_RUNNING";
    checkpoint.veoUpBatchId = "interrupted-batch";
    await fs.writeFile(checkpointPath, JSON.stringify(checkpoint));
    harness.runtime.getVeoUpBatchStatus = async () => ({ active: false, status: "cancelled" });

    const resumed = await harness.restart();
    assert.equal(resumed.state, "BLOCKED");
    assert.equal(resumed.canRetryVeoUp, true);
    assert.equal(harness.submitCalls.length, 0, "an interrupted batch must not auto-submit on restart");
    console.log("Interrupted manual VeoUp batch requires explicit retry");
  } finally {
    await harness.cleanup();
  }
})().catch((error) => { console.error(error?.stack || error); process.exitCode = 1; });
