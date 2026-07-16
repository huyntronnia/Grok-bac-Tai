"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "electron/main.js"), "utf8");
const renderer = fs.readFileSync(path.join(root, "electron/renderer.js"), "utf8");
const preload = fs.readFileSync(path.join(root, "electron/preload.js"), "utf8");
const bootstrap = fs.readFileSync(
  path.join(root, "electron/main/bootstrap/bootstrap.js"),
  "utf8",
);

assert(main.includes("const VDRA_SCHEMA_VERSION = 1;"));
assert(main.includes('path.join(folderPath, `${safeName}.vdra`)'));
assert(main.includes("const projectFolder = path.join(folderPath, safeName);"));
assert(main.includes("fileAlreadyExists || folderAlreadyExists"));
assert(main.includes('error: "project-already-exists"'));
assert(main.includes("rememberLastProjectFile(filePath)"));
assert(main.includes("async function openLastProjectSessionFile()"));
assert(!main.includes(".grokproj"));
assert(renderer.includes("const PROJECT_AUTOSAVE_DEBOUNCE_MS = 1000;"));
assert(renderer.includes("flushProjectAutosave({ force: true, reason: 'window-close' })"));
assert(renderer.includes("openLastProjectSession"));
assert(renderer.includes("waitingForUserStart: true"));
assert(preload.includes("project:flush-before-close-complete"));
assert(bootstrap.includes('mainWindow.webContents.send("project:flush-before-close", token)'));
assert(bootstrap.includes("7000"));

console.log(".vdra project lifecycle tests passed");
