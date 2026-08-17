"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const chatGptSource = fs.readFileSync(
  path.join(root, "electron/main/chatgpt/chatgpt_pipeline.js"),
  "utf8",
);
const runnerSource = fs.readFileSync(
  path.join(root, "electron/main/pipeline/pipeline_runner.js"),
  "utf8",
);

const {
  isNv1ImageCandidateSaveEligible,
  networkCandidateMatchesOwnedNv1Card,
  validateNv2ResponseOwnership,
} = require("../electron/main/chatgpt/chatgpt_pipeline");
const {
  validateKeyframeFile,
  validateMotionPromptTextContent,
} = require("../electron/main/pipeline/asset_validation");

const readyNv1 = {
  chosen: { ok: true, rootIndex: 7 },
  activeGeneration: false,
  ownershipConfirmed: true,
  imageTurnScope: {
    turnsAfterLatestUser: 1,
    ownedImageAgentTurnIndexes: [7],
    imageReady: true,
    canvasReady: false,
    placeholderVisible: false,
    stopVisible: false,
  },
};

assert.strictEqual(isNv1ImageCandidateSaveEligible(readyNv1), true);
assert.strictEqual(
  isNv1ImageCandidateSaveEligible({ ...readyNv1, activeGeneration: true }),
  false,
  "NV1 must not save while generation is active",
);
assert.strictEqual(
  isNv1ImageCandidateSaveEligible({
    ...readyNv1,
    imageTurnScope: { ...readyNv1.imageTurnScope, stopVisible: true },
  }),
  false,
  "NV1 must not save while Stop is visible",
);
assert.strictEqual(
  isNv1ImageCandidateSaveEligible({
    ...readyNv1,
    imageTurnScope: { ...readyNv1.imageTurnScope, placeholderVisible: true },
  }),
  false,
  "NV1 must not save while the owned card still has a placeholder",
);
assert.strictEqual(
  isNv1ImageCandidateSaveEligible({
    ...readyNv1,
    chosen: { ok: true, rootIndex: 6 },
  }),
  false,
  "NV1 must reject a candidate outside the owned image turn",
);

const ownedNetworkScope = {
  ownershipConfirmed: true,
  cardReady: true,
  ownedRootIndex: 7,
  ownedImageUrls: ["https://cdn.example/final.png?token=owned"],
};
assert.strictEqual(
  networkCandidateMatchesOwnedNv1Card(
    { url: "https://cdn.example/final.png?token=owned" },
    ownedNetworkScope,
  ),
  true,
);
assert.strictEqual(
  networkCandidateMatchesOwnedNv1Card(
    { url: "https://cdn.example/scene-old.png?token=old" },
    ownedNetworkScope,
  ),
  false,
  "a network image that is not referenced by the owned card must be rejected",
);
assert.strictEqual(
  networkCandidateMatchesOwnedNv1Card(
    { url: "https://cdn.example/final.png?token=owned" },
    { ...ownedNetworkScope, cardReady: false },
  ),
  false,
  "network bytes need a ready owned image-card anchor",
);

assert.deepStrictEqual(
  validateNv2ResponseOwnership({
    expectedPromptHash: "prompt-hash",
    latestUserHash: "prompt-hash",
    expectedConversationId: "conversation-1",
    currentConversationId: "conversation-1",
  }),
  { ok: true },
);
assert.strictEqual(
  validateNv2ResponseOwnership({
    expectedPromptHash: "prompt-hash",
    latestUserHash: "",
    expectedConversationId: "conversation-1",
    currentConversationId: "conversation-1",
  }).error,
  "nv2-user-message-ownership-unavailable-during-response-wait",
);
assert.strictEqual(
  validateNv2ResponseOwnership({
    expectedPromptHash: "prompt-hash",
    latestUserHash: "prompt-hash",
    expectedConversationId: "conversation-1",
    currentConversationId: "conversation-2",
  }).error,
  "chatgpt-conversation-changed-during-nv2-response-wait:conversation-1:conversation-2",
);

const goodMotionPrompt = (
  "Slow dolly movement follows the subject while foreground leaves create parallax; " +
  "the camera eases into a medium framing, ambient motion remains natural, and the final beat settles cleanly."
).padEnd(180, " ");
assert.strictEqual(validateMotionPromptTextContent(goodMotionPrompt).ok, true);
assert.strictEqual(
  validateMotionPromptTextContent("This response is too short.").error,
  "too-short",
);
assert.strictEqual(
  validateMotionPromptTextContent(
    "Processing the requested motion prompt now. ".repeat(8),
  ).error,
  "loading-status-not-final",
);
assert.strictEqual(
  validateMotionPromptTextContent("Thought for 12 seconds\nEdit\n" + "x".repeat(150)).error,
  "thinking-summary-not-final",
);

(async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vidora-asset-gate-"));
  try {
    const tinyPath = path.join(tempDir, "tiny.png");
    fs.writeFileSync(tinyPath, Buffer.alloc(3000));
    const tiny = await validateKeyframeFile(tinyPath);
    assert.strictEqual(tiny.ok, false);
    assert.strictEqual(tiny.error, "file-too-small");

    assert(
      chatGptSource.includes("isNv1ImageCandidateSaveEligible"),
      "the live NV1 save path must use the complete save gate",
    );
    assert(
      chatGptSource.includes("networkCandidateMatchesOwnedNv1Card"),
      "network extraction must be anchored to the owned image card",
    );
    assert(
      /quality\.ok\s*&&\s*promptOwned\s*&&/.test(chatGptSource),
      "NV2 return must require exact prompt ownership",
    );
    assert(
      !chatGptSource.includes("forceNv2Resend") &&
        !runnerSource.includes("manualNv2RetryRequested: true"),
      "NV2 timeout recovery must not create a resend path",
    );
    assert(
      chatGptSource.includes("nv2PreviouslyProvenSent") &&
        chatGptSource.includes("nv2-sent-prompt-ownership-unavailable-no-resend"),
      "a previously proven NV2 send must fail closed when live ownership is unavailable",
    );
    assert(
      runnerSource.includes("isNv2NoResendTerminalFailure") &&
        runnerSource.includes('"pipeline-paused"'),
      "NV2 timeout must pause at its checkpoint instead of automatic resend/restart",
    );
    assert(
      runnerSource.includes("validateMotionPromptTextContent") &&
        runnerSource.includes("validateKeyframeFile"),
      "cached assets and scene completion must use the shared quality gates",
    );

    console.log("NV1/NV2 specification compliance tests passed");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
