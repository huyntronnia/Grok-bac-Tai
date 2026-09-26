"use strict";

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { createManualChatGptController } = require("../electron/main/chatgpt/manual_chatgpt_controller");

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-manual-live-"));
  const observations = [];
  const controller = createManualChatGptController({
    watchIntervalMs: 10,
    readConversationSnapshot: async () => ({
      conversationId: "live-conversation",
      pathname: "/c/live-conversation",
      messages: [
        { id: "user-1", role: "user", text: "Request 1" },
        { id: "assistant-1", role: "assistant", text: "Ready", settled: true },
      ],
      generating: false,
    }),
    onObservation: (payload) => observations.push(payload.observation),
  });
  try {
    await controller.initialize({ projectPath: root, expectedSceneIds: [1] });
    await new Promise((resolve) => setTimeout(resolve, 45));
    assert(observations.length > 0, "the watcher must publish live observations without a manual refresh");
    assert.strictEqual(observations.at(-1).conversationId, "live-conversation");
    assert.strictEqual(observations.at(-1).observedOutputs[0].kind, "ready");
    console.log("Manual live observation watcher test passed");
  } finally {
    controller.dispose();
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
