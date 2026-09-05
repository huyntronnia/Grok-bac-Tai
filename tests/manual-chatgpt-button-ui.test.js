"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

async function runTests() {
  console.log("Starting Manual ChatGPT Button UI Tests...");

  const htmlPath = path.resolve(__dirname, "../electron/index.html");
  const htmlContent = fs.readFileSync(htmlPath, "utf8");

  // Requirement: Must be a button element with id="manual-chatgpt-btn"
  assert(htmlContent.includes('id="manual-chatgpt-btn"'), "index.html must contain button element with id='manual-chatgpt-btn'");
  assert(htmlContent.includes('<button'), "manual-chatgpt-btn must be a button element");

  // Requirement: MUST NOT use checkbox for manual-chatgpt-toggle
  assert(!htmlContent.includes('id="manual-chatgpt-toggle"'), "index.html must NOT use checkbox id='manual-chatgpt-toggle'");

  const rendererPath = path.resolve(__dirname, "../electron/renderer.js");
  const rendererContent = fs.readFileSync(rendererPath, "utf8");
  assert(rendererContent.includes("manualChatGptBtn"), "renderer.js must reference manualChatGptBtn");

  console.log("Manual ChatGPT Button UI Tests passed!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
