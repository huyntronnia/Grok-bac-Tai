"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

async function runTests() {
  console.log("Starting UI/UX Modernization Tests...");

  const htmlPath = path.resolve(__dirname, "../electron/index.html");
  const htmlContent = fs.readFileSync(htmlPath, "utf8");

  const cssPath = path.resolve(__dirname, "../electron/style.css");
  const cssContent = fs.readFileSync(cssPath, "utf8");

  const rendererPath = path.resolve(__dirname, "../electron/renderer.js");
  const rendererContent = fs.readFileSync(rendererPath, "utf8");

  const preloadPath = path.resolve(__dirname, "../electron/preload.js");
  const preloadContent = fs.readFileSync(preloadPath, "utf8");

  const ipcHandlersPath = path.resolve(__dirname, "../electron/main/ipc/ipc_handlers.js");
  const ipcHandlersContent = fs.readFileSync(ipcHandlersPath, "utf8");

  const mainPath = path.resolve(__dirname, "../electron/main.js");
  const mainContent = fs.readFileSync(mainPath, "utf8");

  // 1. Phase UX-1: Visual Stepper 4 Nấc & In-place Preview
  console.log("Checking Phase UX-1: Visual Stepper 4 Nấc & In-place Preview...");
  assert(htmlContent.includes('id="manual-step-prep"'), "index.html must have #manual-step-prep");
  assert(htmlContent.includes('id="manual-step-nv1"'), "index.html must have #manual-step-nv1");
  assert(htmlContent.includes('id="manual-step-nv2"'), "index.html must have #manual-step-nv2");
  assert(htmlContent.includes('id="manual-step-veoup"'), "index.html must have #manual-step-veoup");

  assert(htmlContent.includes('id="manual-nv1-preview-wrap"'), "index.html must have #manual-nv1-preview-wrap");
  assert(htmlContent.includes('id="manual-recapture-nv1-btn"'), "index.html must have #manual-recapture-nv1-btn");
  assert(htmlContent.includes('id="manual-zoom-nv1-btn"'), "index.html must have #manual-zoom-nv1-btn");
  assert(htmlContent.includes('id="manual-nv2-preview-wrap"'), "index.html must have #manual-nv2-preview-wrap");
  assert(htmlContent.includes('id="manual-recapture-nv2-btn"'), "index.html must have #manual-recapture-nv2-btn");

  // Stepper CSS
  assert(cssContent.includes('.manual-stepper-tracker'), "style.css must style .manual-stepper-tracker");
  assert(cssContent.includes('.manual-step.active'), "style.css must style .manual-step.active");
  assert(cssContent.includes('.manual-step.completed'), "style.css must style .manual-step.completed");

  // 2. Toast Notification System
  console.log("Checking Toast Notification System...");
  assert(htmlContent.includes('id="toast-container"'), "index.html must contain #toast-container");
  assert(cssContent.includes('.toast-container'), "style.css must style .toast-container");
  assert(cssContent.includes('.toast'), "style.css must style .toast");
  assert(rendererContent.includes('function showToast('), "renderer.js must implement showToast()");
  assert(rendererContent.includes('window.showToast = showToast'), "renderer.js must expose showToast globally");

  // 3. Phase UX-2: Storyboard Grid & Table View
  console.log("Checking Phase UX-2: Storyboard Grid & Table View...");
  assert(htmlContent.includes('id="storyboard-section"'), "index.html must have #storyboard-section");
  assert(htmlContent.includes('id="view-mode-grid-btn"'), "index.html must have #view-mode-grid-btn");
  assert(htmlContent.includes('id="view-mode-table-btn"'), "index.html must have #view-mode-table-btn");
  assert(htmlContent.includes('id="storyboard-grid-container"'), "index.html must have #storyboard-grid-container");
  assert(htmlContent.includes('id="storyboard-table-container"'), "index.html must have #storyboard-table-container");

  assert(cssContent.includes('.storyboard-grid-container'), "style.css must style .storyboard-grid-container");
  assert(cssContent.includes('.storyboard-card'), "style.css must style .storyboard-card");
  assert(rendererContent.includes('function renderStoryboardUI()'), "renderer.js must implement renderStoryboardUI()");

  // 4. Asset Lightbox Modal
  console.log("Checking Asset Lightbox Modal...");
  assert(htmlContent.includes('id="asset-lightbox-modal"'), "index.html must have #asset-lightbox-modal");
  assert(htmlContent.includes('id="lightbox-close-btn"'), "index.html must have #lightbox-close-btn");
  assert(htmlContent.includes('id="lightbox-media"'), "index.html must have #lightbox-media");
  assert(cssContent.includes('.asset-lightbox-modal'), "style.css must style .asset-lightbox-modal");
  assert(rendererContent.includes('function openLightbox('), "renderer.js must implement openLightbox()");
  assert(rendererContent.includes('function closeLightbox('), "renderer.js must implement closeLightbox()");

  // 5. Phase UX-3: Floating Mini-Bar Mode & IPC
  console.log("Checking Phase UX-3: Floating Mini-Bar Mode & IPC...");
  assert(htmlContent.includes('id="toggle-mini-bar-btn"'), "index.html must have #toggle-mini-bar-btn");
  assert(cssContent.includes('body.mini-bar-mode'), "style.css must style body.mini-bar-mode");

  assert(preloadContent.includes('toggleMiniBar:'), "preload.js must expose toggleMiniBar");
  assert(preloadContent.includes('setAlwaysOnTop:'), "preload.js must expose setAlwaysOnTop");
  assert(preloadContent.includes('onMiniBarStateChanged:'), "preload.js must expose onMiniBarStateChanged");

  assert(ipcHandlersContent.includes('window:toggle-mini-bar'), "ipc_handlers.js must register window:toggle-mini-bar");
  assert(ipcHandlersContent.includes('window:set-always-on-top'), "ipc_handlers.js must register window:set-always-on-top");

  assert(mainContent.includes('toggleMiniBarHandler'), "main.js must define toggleMiniBarHandler");
  assert(mainContent.includes('setAlwaysOnTopHandler'), "main.js must define setAlwaysOnTopHandler");
  assert(mainContent.includes('window:mini-bar-state-changed'), "main.js must emit window:mini-bar-state-changed");

  // 6. Global Hotkeys
  console.log("Checking Global Hotkeys...");
  assert(rendererContent.includes("e.key === '1'"), "renderer.js must support Alt+1 hotkey");
  assert(rendererContent.includes("e.key === '2'"), "renderer.js must support Alt+2 hotkey");
  assert(rendererContent.includes("e.key === 'k'"), "renderer.js must support Alt+K hotkey");
  assert(rendererContent.includes("e.key === 'm'"), "renderer.js must support Alt+M hotkey");
  assert(rendererContent.includes("e.code === 'Space'"), "renderer.js must support Alt+Space mini-bar hotkey");

  console.log("All UI/UX Modernization Tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
