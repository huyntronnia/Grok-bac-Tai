"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const {
  createManualChatGptController,
  manualWorkflowPaths,
} = require("../electron/main/chatgpt/manual_chatgpt_controller");

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-manual-nv-only-migration-"));
  const controller = createManualChatGptController({
    readConversationSnapshot: async () => ({ conversationId: "conversation-1", messages: [], generating: false }),
  });
  try {
    await controller.initialize({ projectPath: root, expectedSceneIds: [1] });
    const { checkpointPath } = manualWorkflowPaths(root);
    const checkpoint = JSON.parse(await fs.readFile(checkpointPath, "utf8"));
    checkpoint.version = 1;
    checkpoint.state = "HYDRATE_REQUEST_1_WAITING";
    checkpoint.preparedBundle = { stage: "REQUEST_1", payloadFingerprint: "legacy" };
    checkpoint.attempts.push({ attemptId: "legacy-request", stage: "REQUEST_1", status: "WAITING" });
    checkpoint.activeAttemptId = "legacy-request";
    await fs.writeFile(checkpointPath, JSON.stringify(checkpoint));

    const migrated = await controller.resume({ projectPath: root });
    assert.strictEqual(migrated.version, 2);
    assert.strictEqual(migrated.state, "SCENE_NV1_READY");
    assert.strictEqual(migrated.nextStage, "NV1");
    assert.strictEqual(migrated.activeAttempt, null);
    assert.strictEqual(migrated.preparedBundle, null);
    const revisionAfterMigration = migrated.revision;
    const resumedAgain = await controller.resume({ projectPath: root });
    assert.strictEqual(resumedAgain.revision, revisionAfterMigration, "legacy cancelled attempts must not re-trigger migration on every resume");
    console.log("Manual NV1/NV2-only checkpoint migration test passed");
  } finally {
    controller.dispose();
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
