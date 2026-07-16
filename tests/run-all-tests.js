"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const files = fs
  .readdirSync(__dirname)
  .filter((name) => name.endsWith(".test.js"))
  .sort();

for (const file of files) {
  process.stdout.write(`\n[Vidora test] ${file}\n`);
  const result = spawnSync(
    process.execPath,
    ["-r", path.join(__dirname, "normalize-hook.js"), path.join(__dirname, file)],
    { cwd: root, env: process.env, stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`\nAll ${files.length} Vidora test files passed.`);
