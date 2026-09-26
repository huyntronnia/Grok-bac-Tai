"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "electron/index.html"), "utf8");
const ui = fs.readFileSync(path.join(root, "electron/manual_workflow_ui.js"), "utf8");
const renderer = fs.readFileSync(path.join(root, "electron/renderer.js"), "utf8");

for (const id of [
  "manual-chatgpt-card",
  "manual-prompt-label",
  "manual-prompt-preview",
  "manual-attachments",
  "manual-arm-btn",
  "manual-capture-btn",
  "manual-recovery-details",
  "manual-redo-stage-select",
  "manual-redo-btn",
  "manual-retry-veoup-btn",
]) {
  assert(html.includes(`id=\"${id}\"`), `Manual Workflow UI must contain #${id}`);
}

assert(!html.includes('id="manual-auto-watch-toggle"'), "legacy automatic watcher controls must not be visible");
assert(!html.includes('id="manual-auto-advance-toggle"'), "legacy automatic advance controls must not be visible");
assert(!html.includes('id="manual-veoup-btn"'), "generic VeoUp action must not be visible");
assert(!html.includes('id="veoup-scan-run-btn"'), "legacy VeoUp scan action must not be visible");
for (const id of ["manual-audit-disk-btn", "manual-prepare-btn", "view-mode-grid-btn", "view-mode-table-btn", "toggle-mini-bar-btn", "asset-lightbox-modal"]) {
  assert(!html.includes(`id="${id}"`), `unused control #${id} must be removed`);
}
const accountDialogStart = html.indexOf('<dialog id="account-required-dialog">');
const accountDialogEnd = html.indexOf("</dialog>", accountDialogStart);
const toastStart = html.indexOf('id="toast-container"');
assert(accountDialogStart >= 0 && accountDialogEnd > accountDialogStart && toastStart > accountDialogEnd,
  "manual save toasts must live outside the closed account dialog");
assert(!/<button id="manual-redo-btn"[^>]*\bhidden\b/.test(html), "manual Redo must be reachable in recovery details");
assert(ui.includes('open.textContent = "Mở thư mục"'), "each attachment must offer its folder");
assert(ui.includes('retryVeoUp.hidden = !view.canRetryVeoUp'), "VeoUp retry must appear only after failure");
assert(renderer.includes('startManualGptWorkflow'), "renderer must use the canonical Manual Workflow entry point");

console.log("Manual workflow production UI tests passed");
