"use strict";
const fs = require("fs/promises");
const zlib = require("zlib");
const { validateKeyframeFile, KEYFRAME_MIN_DIMENSION } = require("../pipeline/asset_validation");

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

// The legacy validator can run under Node without Electron's native decoder.
// Manual readiness still needs proof of a complete decodable image in that case.
async function validateManualKeyframe(filePath) {
  const validation = await validateKeyframeFile(filePath);
  if (!validation.ok) return validation;
  const bytes = await fs.readFile(filePath);
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    return validation.width >= KEYFRAME_MIN_DIMENSION && validation.height >= KEYFRAME_MIN_DIMENSION
      ? validation : { ok: false, error: "image-decoder-unavailable" };
  }
  try {
    let offset = 8, width = 0, height = 0, channels = 0, bitDepth = 0, interlace = 0, ended = false;
    const chunks = [];
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset);
      if (length > bytes.length - offset - 12) throw new Error("truncated-chunk");
      const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
      const data = bytes.subarray(offset + 8, offset + 8 + length);
      if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== bytes.readUInt32BE(offset + 8 + length)) throw new Error("bad-crc");
      if (type === "IHDR") {
        if (offset !== 8 || length !== 13) throw new Error("invalid-header");
        width = data.readUInt32BE(0); height = data.readUInt32BE(4);
        bitDepth = data[8]; channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 })[data[9]];
        interlace = data[12];
      }
      if (type === "IDAT") chunks.push(data);
      offset += length + 12;
      if (type === "IEND") { ended = true; break; }
    }
    if (!ended || !channels || !chunks.length || width < KEYFRAME_MIN_DIMENSION || height < KEYFRAME_MIN_DIMENSION) throw new Error("invalid-dimensions-or-data");
    if (interlace && validation.width && validation.height) return validation;
    if (interlace || ![1, 2, 4, 8, 16].includes(bitDepth)) throw new Error("unsupported-png-layout");
    const rowLength = Math.ceil(width * channels * bitDepth / 8) + 1;
    const required = rowLength * height;
    if (required > 256 * 1024 * 1024) throw new Error("image-too-large");
    const decoded = zlib.inflateSync(Buffer.concat(chunks), { maxOutputLength: required });
    if (decoded.length !== required) throw new Error("incomplete-pixels");
    for (let row = 0; row < height; row++) if (decoded[row * rowLength] > 4) throw new Error("invalid-filter");
    return { ...validation, width, height };
  } catch (error) {
    return { ok: false, error: `image-decode-failed:${error.message}`, filePath };
  }
}
module.exports = { validateManualKeyframe };
