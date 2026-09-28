"use strict";

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { execFileSync } = require("child_process");

function expandWindowsEnv(value, env) {
  return String(value || "").replace(/%([^%]+)%/g, (_match, name) =>
    Object.entries(env).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] || "");
}

function findChromeExecutable({ env = process.env, existsSync = fs.existsSync, run = execFileSync } = {}) {
  const installRoots = [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], "C:\\Program Files", "C:\\Program Files (x86)"]
    .filter(Boolean);
  const candidates = [env.CHROME_PATH];
  for (const root of installRoots) {
    candidates.push(path.join(root, "Google", "Chrome", "Application", "chrome.exe"));
    candidates.push(path.join(root, "Microsoft", "Edge", "Application", "msedge.exe"));
  }
  if (env.LOCALAPPDATA) {
    candidates.push(path.join(env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"));
    candidates.push(path.join(env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe"));
  }
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }

  for (const name of ["chrome.exe", "msedge.exe"]) {
    for (const hive of ["HKCU", "HKLM"]) {
      try {
        const key = `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${name}`;
        const output = run("reg.exe", ["query", key, "/ve"], { encoding: "utf8", windowsHide: true });
        const candidate = expandWindowsEnv(output.match(/REG_(?:EXPAND_)?SZ\s+([^\r\n]+)/i)?.[1]?.trim(), env);
        if (candidate && existsSync(candidate)) return candidate;
      } catch (_) {}
    }
  }
  for (const name of ["chrome.exe", "msedge.exe"]) {
    try {
      const output = run("where.exe", [name], { encoding: "utf8", windowsHide: true });
      const candidate = output.split(/\r?\n/).map((item) => item.trim()).find((item) => item && existsSync(item));
      if (candidate) return candidate;
    } catch (_) {}
  }
  throw new Error("Không tìm thấy Chrome/Edge trên máy này. Hãy cài trình duyệt hoặc đặt CHROME_PATH tới file .exe.");
}

async function readProfileDebugEndpoint(profileDir, { readFile = fsp.readFile, request = fetch } = {}) {
  let raw;
  try { raw = await readFile(path.join(profileDir, "DevToolsActivePort"), "utf8"); }
  catch (_) { return null; }
  const [portLine, browserPath] = String(raw).trim().split(/\r?\n/);
  const port = Number(portLine);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !/^\/devtools\/browser\/[^\s]+$/.test(browserPath || "")) return null;
  const endpoint = `http://127.0.0.1:${port}`;
  try {
    const response = await request(`${endpoint}/json/version`, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return null;
    const version = await response.json();
    const socket = new URL(String(version.webSocketDebuggerUrl || ""));
    if (socket.pathname !== browserPath || Number(socket.port) !== port) return null;
    return { endpoint, port };
  } catch (_) { return null; }
}

function createManualChromeEndpointResolver(profileDir, { readProfile = readProfileDebugEndpoint } = {}) {
  return async () => (await readProfile(profileDir))?.endpoint || "";
}

module.exports = { findChromeExecutable, readProfileDebugEndpoint, createManualChromeEndpointResolver };
