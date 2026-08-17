"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const chatGptUploadSource = fs.readFileSync(
  path.join(root, "electron/main/chatgpt/chatgpt_upload.js"),
  "utf8",
);
const chatGptPipelineSource = fs.readFileSync(
  path.join(root, "electron/main/chatgpt/chatgpt_pipeline.js"),
  "utf8",
);

(async () => {
  // 1. Verify chatgpt_upload.js fallback logic
  assert(
    chatGptUploadSource.includes("if (chooserUpload?.ok) return chooserUpload;"),
    "chatgpt_upload.js must check chooserUpload.ok before returning",
  );
  assert(
    !chatGptUploadSource.includes(
      `    if (chooserUpload?.ok) return chooserUpload;\n    return chooserUpload;`,
    ),
    "chatgpt_upload.js must not unconditionally return chooserUpload when ok is false",
  );

  // 2. Verify chatgpt_pipeline.js recovery logic for initial NV2 upload
  assert(
    chatGptPipelineSource.includes("nv2-initial-upload-recovery"),
    "chatgpt_pipeline.js must trigger nv2-initial-upload-recovery on upload failure",
  );
  assert(
    chatGptPipelineSource.includes(
      "Initial NV2 keyframe upload failed",
    ),
    "chatgpt_pipeline.js must log warning for initial upload failure before reloading page",
  );
  assert(
    chatGptPipelineSource.includes(
      "request: \"nv2-keyframe-and-request-file-retry\"",
    ),
    "chatgpt_pipeline.js must retry upload after page reload",
  );

  console.log("ChatGPT NV2 upload recovery tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
