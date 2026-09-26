"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const {
  buildRequestControlPrompt,
  createComposerPayload,
  materializeSceneRequestFiles,
} = require("../electron/main/pipeline/scene_request_files");

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vidora-scene-request-"));
  try {
    const scene1Dir = path.join(root, "scene_001");
    const scene2Dir = path.join(root, "scene_002");
    const common = { nv1: "NV1 MASTER", nv2: "NV2 MASTER" };
    const first = await materializeSceneRequestFiles({
      ...common,
      sceneDir: scene1Dir,
      sceneId: 1,
      sceneText: "Nội dung scene một",
    });
    const second = await materializeSceneRequestFiles({
      ...common,
      sceneDir: scene2Dir,
      sceneId: 2,
      sceneText: "Nội dung scene hai",
    });

    assert.notStrictEqual(first.nv1.fileName, second.nv1.fileName);
    assert.notStrictEqual(first.nv2.fileName, second.nv2.fileName);
    assert.match(first.nv1.fileName, /^scene_001_nv1_request\.txt$/);
    assert.match(first.nv2.fileName, /^scene_001_nv2_request\.txt$/);

    const nv1Text = await fs.readFile(first.nv1.filePath, "utf8");
    const nv2Text = await fs.readFile(first.nv2.filePath, "utf8");
    assert.match(nv1Text, /NV1 MASTER/);
    assert.match(nv1Text, /Nội dung scene một/);
    assert.doesNotMatch(nv1Text, /NV2 MASTER|CURRENT SCENE|CONTINUITY INPUTS/);
    assert.match(nv2Text, /NV2 MASTER/);
    assert.match(nv2Text, /Nội dung scene một/);
    assert.doesNotMatch(nv2Text, /NV1 MASTER|CURRENT SCENE|CONTINUITY INPUTS/);
    assert.match(nv1Text, /KỊCH BẢN CẦN TẠO:/);
    assert.match(nv2Text, /KỊCH BẢN CẦN TẠO:/);

    assert.strictEqual(
      first.nv1.controlPrompt,
      "Tạo ảnh theo file sau: scene_001_nv1_request.txt",
    );
    assert.strictEqual(
      first.nv2.controlPrompt,
      "Tạo prompt motion theo file sau: scene_001_nv2_request.txt",
    );

    const changed = await materializeSceneRequestFiles({
      ...common,
      sceneDir: scene1Dir,
      sceneId: 1,
      sceneText: "Nội dung scene một đã đổi",
    });
    assert.notStrictEqual(changed.nv1.contentSha256, first.nv1.contentSha256);
    assert.strictEqual(changed.nv1.controlPrompt, first.nv1.controlPrompt);
    assert.notStrictEqual(changed.nv1.payloadFingerprint, first.nv1.payloadFingerprint);
    assert.notStrictEqual(changed.nv2.contentSha256, first.nv2.contentSha256);

    const retryPrompt = buildRequestControlPrompt({
      stage: "NV1",
      filePath: changed.nv1.filePath,
      contentSha256: changed.nv1.contentSha256,
      retry: 1,
    });
    assert.strictEqual(
      retryPrompt,
      `${changed.nv1.controlPrompt} | retry=1`,
    );
    assert.doesNotMatch(retryPrompt, /\| id=/);
    assert.doesNotMatch(retryPrompt, /Thực hiện yêu cầu/i);
    assert.ok(retryPrompt.length < 180);

    assert.throws(
      () => buildRequestControlPrompt({
        filePath: changed.nv1.filePath,
        contentSha256: changed.nv1.contentSha256,
      }),
      /Invalid request stage/,
    );

    const nv1Payload = await createComposerPayload({
      stage: "NV1",
      sceneId: 1,
      controlPrompt: changed.nv1.controlPrompt,
      expectedFilePaths: [changed.nv1.filePath],
    });
    assert.deepStrictEqual(nv1Payload.expectedAttachmentNames, [changed.nv1.fileName]);
    assert.strictEqual(nv1Payload.localFileSha256s[0], changed.nv1.contentSha256);
    assert.strictEqual(nv1Payload.payloadFingerprint.length, 64);

    await fs.writeFile(changed.nv1.filePath, "Manual NV1 request kept on disk", "utf8");
    const existingNv2 = await fs.readFile(changed.nv2.filePath, "utf8");
    const preserved = await materializeSceneRequestFiles({
      ...common,
      sceneDir: scene1Dir,
      sceneId: 1,
      sceneText: "Renderer scene data changed while manual waited",
      preserveExisting: true,
    });
    assert.strictEqual(await fs.readFile(changed.nv1.filePath, "utf8"), "Manual NV1 request kept on disk");
    assert.strictEqual(await fs.readFile(changed.nv2.filePath, "utf8"), existingNv2);
    assert.strictEqual(preserved.nv1.contentSha256,
      crypto.createHash("sha256").update("Manual NV1 request kept on disk").digest("hex"));

    const bulkArtifacts = [];
    for (let sceneId = 1; sceneId <= 20; sceneId += 1) {
      bulkArtifacts.push(await materializeSceneRequestFiles({
        ...common,
        sceneDir: path.join(root, "bulk", `scene_${String(sceneId).padStart(3, "0")}`),
        sceneId,
        sceneText: `Kịch bản bulk ${sceneId}`,
      }));
    }
    const bulkFiles = bulkArtifacts.flatMap((artifact) => [
      artifact.nv1.filePath,
      artifact.nv2.filePath,
    ]);
    assert.strictEqual(bulkFiles.length, 40);
    assert.strictEqual(new Set(bulkFiles).size, 40);
    for (const filePath of bulkFiles) {
      assert.ok((await fs.stat(filePath)).size > 0);
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }

  console.log("scene request file artifact tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
