"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const main = read("electron/main.js");
const renderer = read("electron/renderer.js");
const preload = read("electron/preload.js");
const ipc = read("electron/main/ipc/ipc_handlers.js");
const html = read("electron/index.html");

assert(main.includes("await ensureProjectPrepromptFolder(projectFolder, { logCreated: true });"));
assert(main.includes("await ensureProjectPrepromptFolder(projectFolder);"));
assert(main.includes("shell.openPath(prepromptFolderPath)"));
assert(main.includes("prepromptFolderPath"));
assert(renderer.includes("openProjectPrepromptFolderFlow"));
assert(renderer.includes("preprompt-folder-btn"));
assert(preload.includes("openProjectPrepromptFolder"));
assert(ipc.includes('"project:open-preprompt-folder"'));
assert(html.includes("Mở thư mục preprompt"));

console.log("project preprompt folder lifecycle tests passed");
