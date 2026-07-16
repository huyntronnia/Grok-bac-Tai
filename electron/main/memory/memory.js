const { BrowserWindow } = require("electron");
const { appendAppLog } = require("../logging");

let sceneMemoryBaseline = null;
let lastMilestoneMemory = null;

async function getCdpPageMemoryMetrics(client) {
  if (!client) return null;
  let playwrightSession = null;
  try {
    let metrics = [];
    let domCounters = null;
    if (client.clientType === "playwright" && client.page) {
      playwrightSession = await client.page
        .context()
        .newCDPSession(client.page);
      await playwrightSession.send("Performance.enable").catch(() => null);
      const performance = await playwrightSession
        .send("Performance.getMetrics")
        .catch(() => ({ metrics: [] }));
      metrics = performance.metrics || [];
      domCounters = await playwrightSession
        .send("Memory.getDOMCounters")
        .catch(() => null);
    } else if (client.Performance) {
      await client.Performance.enable().catch(() => null);
      ({ metrics = [] } = await client.Performance.getMetrics());
      domCounters = client.Memory?.getDOMCounters
        ? await client.Memory.getDOMCounters().catch(() => null)
        : null;
    } else {
      return null;
    }
    const result = {};
    for (const m of metrics) {
      if (["JSHeapUsedSize", "JSHeapTotalSize", "LayoutCount", "RecalcStyleCount", "Timestamp"].includes(m.name)) {
        result[m.name] = m.value;
      }
    }
    if (domCounters) {
      result.Documents = Number(domCounters.documents || 0);
      result.Nodes = Number(domCounters.nodes || 0);
      result.JSEventListeners = Number(domCounters.jsEventListeners || 0);
    }
    return result;
  } catch (_e) {
    return null;
  } finally {
    if (playwrightSession) {
      await playwrightSession.detach().catch(() => null);
    }
  }
}

async function logMemoryMilestone(sceneId, milestone) {
  const memUsage = process.memoryUsage();
  const mainRss = memUsage.rss;
  const mainHeapUsed = memUsage.heapUsed;

  let rendererPrivate = 0;
  let rendererResident = 0;
  
  const activeWin = BrowserWindow.getAllWindows().find((win) => !win.isDestroyed());
  if (activeWin) {
    try {
      const processInfo = await activeWin.webContents.getProcessMemoryInfo().catch(() => null);
      if (processInfo) {
        // Electron ProcessMemoryInfo is reported in KiB. Convert to bytes so
        // the formatter and thresholds use the same unit as process.memoryUsage().
        rendererPrivate = Number(processInfo.private || 0) * 1024;
        rendererResident = Number(processInfo.residentSet || 0) * 1024;
      }
    } catch (_err) {}
  }

  let cdpMemory = null;
  if (globalThis.activeCdpClient) {
    cdpMemory = await getCdpPageMemoryMetrics(globalThis.activeCdpClient).catch(() => null);
  }

  const current = {
    ts: Date.now(),
    rss: mainRss,
    heapUsed: mainHeapUsed,
    rendererPrivate,
    rendererResident,
  };

  // Set baseline at "Before upload"
  if (milestone === "Before upload") {
    sceneMemoryBaseline = current;
  }

  const deltaFromLast = lastMilestoneMemory ? {
    rss: current.rss - lastMilestoneMemory.rss,
    heapUsed: current.heapUsed - lastMilestoneMemory.heapUsed,
    rendererPrivate: current.rendererPrivate - lastMilestoneMemory.rendererPrivate,
    rendererResident: current.rendererResident - lastMilestoneMemory.rendererResident,
  } : null;

  const deltaFromBaseline = sceneMemoryBaseline ? {
    rss: current.rss - sceneMemoryBaseline.rss,
    heapUsed: current.heapUsed - sceneMemoryBaseline.heapUsed,
    rendererPrivate: current.rendererPrivate - sceneMemoryBaseline.rendererPrivate,
    rendererResident: current.rendererResident - sceneMemoryBaseline.rendererResident,
  } : null;

  lastMilestoneMemory = current;

  function formatBytes(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function formatDelta(bytes) {
    const prefix = bytes >= 0 ? "+" : "";
    return `${prefix}${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  await appendAppLog(sceneId, {
    source: "main",
    kind: "info",
    text: `[MEMORY MILESTONE] Scene ${sceneId}: ${milestone}`,
    details: {
      milestone,
      current: {
        mainRss: formatBytes(current.rss),
        mainHeapUsed: formatBytes(current.heapUsed),
        rendererPrivate: formatBytes(current.rendererPrivate),
        rendererResident: formatBytes(current.rendererResident),
        externalCdpJSHeapUsed: cdpMemory?.JSHeapUsedSize ? formatBytes(cdpMemory.JSHeapUsedSize) : "N/A",
        externalCdpJSHeapTotal: cdpMemory?.JSHeapTotalSize ? formatBytes(cdpMemory.JSHeapTotalSize) : "N/A",
        externalCdpLayoutCount: cdpMemory?.LayoutCount ?? "N/A",
        externalCdpStyleRecalcCount: cdpMemory?.RecalcStyleCount ?? "N/A",
        externalCdpDomNodes: cdpMemory?.Nodes ?? "N/A",
        externalCdpDocuments: cdpMemory?.Documents ?? "N/A",
        externalCdpJsEventListeners: cdpMemory?.JSEventListeners ?? "N/A",
      },
      deltaFromLast: deltaFromLast ? {
        mainRss: formatDelta(deltaFromLast.rss),
        mainHeapUsed: formatDelta(deltaFromLast.heapUsed),
        rendererPrivate: formatDelta(deltaFromLast.rendererPrivate),
        rendererResident: formatDelta(deltaFromLast.rendererResident),
      } : null,
      deltaFromBaseline: deltaFromBaseline ? {
        mainRss: formatDelta(deltaFromBaseline.rss),
        mainHeapUsed: formatDelta(deltaFromBaseline.heapUsed),
        rendererPrivate: formatDelta(deltaFromBaseline.rendererPrivate),
        rendererResident: formatDelta(deltaFromBaseline.rendererResident),
      } : null,
    },
  });

  // End of scene memory leak suspicion check
  if (milestone === "End of scene" && sceneMemoryBaseline) {
    const rssThreshold = sceneMemoryBaseline.rss * 0.15;
    const heapThreshold = sceneMemoryBaseline.heapUsed * 0.15;
    const rendererPrivateThreshold = sceneMemoryBaseline.rendererPrivate * 0.15;

    const rssLeaking = deltaFromBaseline.rss > rssThreshold;
    const heapLeaking = deltaFromBaseline.heapUsed > heapThreshold;
    const rendererLeaking = sceneMemoryBaseline.rendererPrivate > 0 && (deltaFromBaseline.rendererPrivate > rendererPrivateThreshold);

    if (rssLeaking || heapLeaking || rendererLeaking) {
      await appendAppLog(sceneId, {
        source: "main",
        kind: "warning",
        text: `MEMORY_LEAK_SUSPECTED: Memory did not decrease back within 10-15% of baseline.`,
        details: {
          baseline: {
            rss: formatBytes(sceneMemoryBaseline.rss),
            heapUsed: formatBytes(sceneMemoryBaseline.heapUsed),
            rendererPrivate: formatBytes(sceneMemoryBaseline.rendererPrivate),
          },
          current: {
            rss: formatBytes(current.rss),
            heapUsed: formatBytes(current.heapUsed),
            rendererPrivate: formatBytes(current.rendererPrivate),
          },
          delta: {
            rss: formatDelta(deltaFromBaseline.rss),
            heapUsed: formatDelta(deltaFromBaseline.heapUsed),
            rendererPrivate: formatDelta(deltaFromBaseline.rendererPrivate),
          },
          thresholds: {
            rss: formatBytes(rssThreshold),
            heapUsed: formatBytes(heapThreshold),
            rendererPrivate: formatBytes(rendererPrivateThreshold),
          },
          suspects: {
            rssLeaking,
            heapLeaking,
            rendererLeaking,
          }
        }
      });
    }
  }
}

module.exports = {
  getCdpPageMemoryMetrics,
  logMemoryMilestone,
};
