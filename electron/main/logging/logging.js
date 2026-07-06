const { app, BrowserWindow } = require("electron");
const fsPromises = require("fs/promises");
const fs = require("fs");
const path = require("path");

const __vidoraRawConsoleLog = console.log.bind(console);
const __vidoraRawConsoleWarn = console.warn.bind(console);

const VIDORA_CRASH_LOG = path.join(app.getPath("userData"), "vidora-crash.log");
const APP_LOG_FILE = path.join(
  app.getPath("userData"),
  "ai-video-pipeline.log",
);

const SECRET_KEY_PATTERN =
  /(api[_-]?key|cookie|password|passwd|secret|session[_-]?token|refresh[_-]?token|bearer|authorization|localStorage|sessionStorage|browserStorage|rawBrowserStorage)/i;
const SECRET_VALUE_PATTERN =
  /(bearer\s+[a-z0-9._~+/=-]{8,}|sk-[a-z0-9_-]{12,}|xox[baprs]-[a-z0-9-]{8,}|(?:api[_-]?key|cookie|password|passwd|session[_-]?token|refresh[_-]?token)\s*[:=])/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const LOG_URL_PATTERN = /\b(?:https?:\/\/|blob:https?:\/\/)[^\s"'<>\\)]+/gi;

function __vidoraCompactConsoleArg(arg) {
  try {
    if (typeof arg === "string") {
      let out = arg;

      out = out.replace(
        /"html":"[^"]{200,}"/g,
        '"html":"[omitted-heavy-html]"',
      );
      out = out.replace(
        /"buttonText":"[^"]{500,}"/g,
        '"buttonText":"[truncated-buttonText]"',
      );
      out = out.replace(
        /"sampleText":"[^"]{500,}"/g,
        '"sampleText":"[truncated-sampleText]"',
      );
      out = out.replace(
        /"tailSnippet":"[^"]{500,}"/g,
        '"tailSnippet":"[truncated-tailSnippet]"',
      );
      out = out.replace(
        /"latestAssistantText":"[^"]{500,}"/g,
        '"latestAssistantText":"[truncated-latestAssistantText]"',
      );
      out = out.replace(
        /"node":\{[^\n]{200,}?\}/g,
        '"node":"[omitted-heavy-dom]"',
      );

      if (
        out.includes(
          "CDP evaluate fallback: returned safe JSON after Object reference chain error.",
        )
      ) {
        globalThis.__vidoraLastCdpFallbackConsoleAt =
          globalThis.__vidoraLastCdpFallbackConsoleAt || 0;
        const now = Date.now();
        if (now - globalThis.__vidoraLastCdpFallbackConsoleAt < 15000)
          return null;
        globalThis.__vidoraLastCdpFallbackConsoleAt = now;
      }

      if (out.length > 5000)
        out = out.slice(0, 5000) + "...<console-truncated>";
      return out;
    }

    if (arg && typeof arg === "object") {
      const seen = new WeakSet();
      const json = JSON.stringify(arg, (key, value) => {
        if (
          key === "node" ||
          key === "html" ||
          key === "outerHTML" ||
          key === "innerHTML"
        )
          return "[omitted-heavy-dom]";
        if (typeof value === "string" && value.length > 500)
          return value.slice(0, 500) + "...<truncated>";
        if (value && typeof value === "object") {
          if (seen.has(value)) return "[circular]";
          seen.add(value);
        }
        return value;
      });
      return json.length > 5000
        ? json.slice(0, 5000) + "...<console-truncated>"
        : json;
    }

    return arg;
  } catch (_error) {
    return "[console-arg-compact-failed]";
  }
}

console.log = (...args) => {
  const compacted = args
    .map(__vidoraCompactConsoleArg)
    .filter((item) => item !== null);
  if (compacted.length) __vidoraRawConsoleLog(...compacted);
};

console.warn = (...args) => {
  const compacted = args
    .map(__vidoraCompactConsoleArg)
    .filter((item) => item !== null);
  if (compacted.length) __vidoraRawConsoleWarn(...compacted);
};

// Quan trọng: đừng ghi VidoraLog error ra stderr nữa, PowerShell sẽ báo NativeCommandError.
// Error vẫn nằm trong UI log/app log, chỉ chuyển console sang stdout để npm start không bị hiểu là command error.
console.error = (...args) => {
  const compacted = args
    .map(__vidoraCompactConsoleArg)
    .filter((item) => item !== null);
  if (compacted.length) __vidoraRawConsoleLog(...compacted);
};

function maskRouterText(value = "") {
  const text = String(value || "");
  return text
    .replace(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi, "***@$1")
    .replace(/(bearer\s+)[a-z0-9._-]+/gi, "$1[redacted]")
    .replace(
      /(password|cookie|session[_-]?token|refresh[_-]?token|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[redacted]",
    );
}

function sanitizeLogString(value = "") {
  return maskRouterText(
    String(value || "").replace(LOG_URL_PATTERN, (raw) => {
      try {
        const parsed = new URL(raw);
        if (parsed.protocol === "blob:") {
          const origin =
            String(raw).match(/^blob:(https?:\/\/[^/]+)/i)?.[1] ||
            "blob:[redacted]";
          return `blob:${origin}/...`;
        }
        const host = parsed.hostname.toLowerCase();
        const safePath = parsed.pathname || "/";
        if (host === "grok.com" || host === "chatgpt.com")
          return `${parsed.origin}${safePath}`;
        return `${parsed.origin}/...`;
      } catch (_error) {
        return "[redacted-url]";
      }
    }),
  );
}

function sanitizeLogValue(value, key = "", depth = 0, seen = new WeakSet()) {
  if (depth > 5) return "[max-depth]";
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value))
    return value
      .slice(0, 40)
      .map((item) => sanitizeLogValue(item, key, depth + 1, seen));
  if (value && typeof value === "object") {
    if (seen.has(value)) return "[circular]";
    seen.add(value);
    if (Buffer.isBuffer(value)) return `[buffer:${value.length}]`;
    const clean = {};
    for (const [childKey, child] of Object.entries(value).slice(0, 80)) {
      if (SECRET_KEY_PATTERN.test(childKey)) continue;
      clean[childKey] = sanitizeLogValue(child, childKey, depth + 1, seen);
    }
    return clean;
  }
  if (typeof value === "string") {
    const clean = sanitizeLogString(value);
    const max =
      /tail|sample|body|html|actual|expected|composer|prompt|snippet/i.test(key)
        ? 520
        : 1400;
    return clean.length > max ? `${clean.slice(0, max)}...` : clean;
  }
  return value;
}

function sanitizeIpcValue(value, key = "", depth = 0, seen = new WeakSet()) {
  if (depth > 8) return "[max-depth]";
  if (typeof value === "bigint") return value.toString();
  if (
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "undefined"
  )
    return null;
  if (typeof value === "string")
    return value.length > 50_000_000
      ? `${value.slice(0, 50_000_000)}...`
      : value;
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  if (Buffer.isBuffer(value)) return `[buffer:${value.length}]`;
  if (value instanceof Error) {
    return {
      name: value.name || "Error",
      message: sanitizeLogString(value.message || ""),
      stack: sanitizeLogString(value.stack || "").slice(0, 4000),
    };
  }
  if (Array.isArray(value))
    return value
      .slice(0, 120)
      .map((item) => sanitizeIpcValue(item, key, depth + 1, seen));
  const clean = {};
  for (const [childKey, child] of Object.entries(value).slice(0, 120)) {
    if (SECRET_KEY_PATTERN.test(childKey)) continue;
    clean[childKey] = sanitizeIpcValue(child, childKey, depth + 1, seen);
  }
  return clean;
}

function safeIpcHandler(handler) {
  return async (...args) => {
    try {
      return sanitizeIpcValue(await handler(...args));
    } catch (error) {
      const message = sanitizeLogString(
        error?.message || String(error || "Unknown IPC error"),
      );
      const safe = new Error(message);
      safe.name = error?.name || "Error";
      throw safe;
    }
  };
}

function vidoraCompactLogDetails(value, depth = 0) {
  if (value == null) return value;

  if (typeof value === "string") {
    return value.length > 700 ? value.slice(0, 700) + "...<truncated>" : value;
  }

  if (typeof value !== "object") return value;

  if (depth > 4) return "[depth-truncated]";

  if (Array.isArray(value)) {
    return value
      .slice(0, 8)
      .map((item) => vidoraCompactLogDetails(item, depth + 1));
  }

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      key === "node" ||
      key === "html" ||
      key === "outerHTML" ||
      key === "innerHTML" ||
      key === "svg" ||
      key === "children" ||
      key === "parentElement"
    ) {
      out[key] = "[omitted-heavy-dom]";
      continue;
    }

    if (
      key === "buttonText" ||
      key === "tailSnippet" ||
      key === "sampleText" ||
      key === "latestAssistantText"
    ) {
      out[key] = String(item || "").slice(0, 500);
      continue;
    }

    out[key] = vidoraCompactLogDetails(item, depth + 1);
  }

  return out;
}

function vidoraShouldThrottleLog(key, intervalMs = 12000) {
  globalThis.__vidoraLogThrottle = globalThis.__vidoraLogThrottle || {};
  const now = Date.now();
  const last = globalThis.__vidoraLogThrottle[key] || 0;
  if (now - last < intervalMs) return true;
  globalThis.__vidoraLogThrottle[key] = now;
  return false;
}

async function appendAppLog(first, second, third, fourth) {
  let entry = {};
  if (first && typeof first === "object" && second === undefined) {
    entry = first;
  } else if (
    first === null &&
    second &&
    typeof second === "object" &&
    third === undefined
  ) {
    entry = second;
  } else {
    entry = {
      source: "main",
      kind: typeof second === "string" ? second : "info",
      text: typeof third === "string" ? third : "",
      details: fourth || null,
    };
  }

  const memUsage = process.memoryUsage();
  const mainMemory = {
    rss: memUsage.rss,
    heapTotal: memUsage.heapTotal,
    heapUsed: memUsage.heapUsed,
    external: memUsage.external,
    arrayBuffers: memUsage.arrayBuffers || 0,
  };

  let rendererMemory = null;
  const activeWin = BrowserWindow.getAllWindows().find(
    (win) => !win.isDestroyed(),
  );
  if (activeWin) {
    try {
      const processInfo = await activeWin.webContents
        .getProcessMemoryInfo()
        .catch(() => null);
      if (processInfo) {
        rendererMemory = {
          privateBytes: processInfo.privateBytes,
          sharedBytes: processInfo.sharedBytes,
          residentSetBytes: processInfo.residentSetBytes,
        };
      }
    } catch (_err) {}
  }

  const record = {
    ts: new Date().toISOString(),
    source: entry.source || "renderer",
    kind: entry.kind || "info",
    text: sanitizeLogString(entry.text || ""),
    details: entry.details ? sanitizeLogValue(entry.details) : null,
    memory: {
      main: mainMemory,
      renderer: rendererMemory,
    },
  };
  const line = JSON.stringify(record);
  const terminalLine = `[VidoraLog][${record.source}][${record.kind}] ${
    record.text
  }${record.details ? ` ${JSON.stringify(record.details).slice(0, 2000)}` : ""}`;
  if (record.kind === "error") console.error(terminalLine);
  else console.log(terminalLine);
  await fsPromises
    .mkdir(path.dirname(APP_LOG_FILE), { recursive: true })
    .catch(() => null);
  await fsPromises
    .appendFile(APP_LOG_FILE, `${line}\n`, "utf8")
    .catch(() => null);
  if (record.source !== "renderer") {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (win.isDestroyed()) return;
      try {
        win.webContents.send("pipeline:log-entry", sanitizeIpcValue(record));
      } catch (error) {
        console.error(
          `[VidoraLog][main][error] pipeline log IPC skipped: ${error.message}`,
        );
      }
    });
  }
  return { ok: true, path: APP_LOG_FILE };
}

async function getAppLogPath() {
  return APP_LOG_FILE;
}

function writeCrashLog(label, error, extra = {}) {
  try {
    const payload = {
      time: new Date().toISOString(),
      label,
      message: error?.message || String(error || ""),
      stack: error?.stack || "",
      extra,
    };
    fs.appendFileSync(
      VIDORA_CRASH_LOG,
      JSON.stringify(payload, null, 2) + "\n---\n",
      "utf8",
    );
    console.error(
      "[VidoraCrash]",
      label,
      payload.message,
      payload.stack || "",
    );
  } catch (_error) {}
}

function vidoraTraceExit(label, extra = {}) {
  try {
    const logPath = path.join(app.getPath("userData"), "vidora-exit-trace.log");
    const payload = {
      time: new Date().toISOString(),
      label,
      extra,
      stack: new Error(label).stack,
    };
    fs.appendFileSync(
      logPath,
      JSON.stringify(payload, null, 2) + "\n---\n",
      "utf8",
    );
    console.log("[VidoraExitTrace]", label, JSON.stringify(extra || {}));
  } catch (e) {
    try {
      console.log("[VidoraExitTraceFailed]", label, e?.message || e);
    } catch (_) {}
  }
}

module.exports = {
  __vidoraCompactConsoleArg,
  appendAppLog,
  getAppLogPath,
  writeCrashLog,
  vidoraTraceExit,
  vidoraCompactLogDetails,
  vidoraShouldThrottleLog,
  sanitizeLogString,
  sanitizeLogValue,
  sanitizeIpcValue,
  safeIpcHandler,
  maskRouterText,
  SECRET_KEY_PATTERN,
  SECRET_VALUE_PATTERN,
  EMAIL_PATTERN,
  LOG_URL_PATTERN,
  APP_LOG_FILE,
  VIDORA_CRASH_LOG,
};
