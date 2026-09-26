"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const snapshotSource = fs.readFileSync(
  path.join(root, "electron/main/chatgpt/manual_cdp_snapshot.js"),
  "utf8",
);
const controllerSource = fs.readFileSync(
  path.join(root, "electron/main/chatgpt/manual_chatgpt_controller.js"),
  "utf8",
);
const uiSource = fs.readFileSync(
  path.join(root, "electron/manual_workflow_ui.js"),
  "utf8",
);

assert(
  snapshotSource.includes(".agent-turn") && snapshotSource.includes("getElementsByClassName('group/imagegen-image')"),
  "Manual NV1 detection must scan ChatGPT's generated-image agent turn.",
);
assert(
  snapshotSource.includes("manual-imagegen:") && snapshotSource.includes("followsLatestUser"),
  "A generated card must be represented as an assistant output only after the current user turn.",
);
assert(
  snapshotSource.includes("wantedId.startsWith('manual-imagegen:')"),
  "Manual NV1 extraction must route virtual image outputs back to their imagegen card.",
);
assert(
  snapshotSource.includes("displayArea") && snapshotSource.includes("sort((left, right)"),
  "Manual NV1 extraction must prefer the large generated image over thumbnail variants.",
);
assert(
  controllerSource.includes("extractOwnedImage({ assistantTurnId: assistant.id, attempt, signal })"),
  "The manual controller must persist the detected image through the owner-scoped extractor.",
);
assert(
  uiSource.includes("function notifySavedArtifact") && uiSource.includes("Đã lưu ${label} thành công"),
  "A persisted NV1/NV2 artifact must show a success toast to the user.",
);

console.log("Manual .agent-turn generated-image detection tests passed");
