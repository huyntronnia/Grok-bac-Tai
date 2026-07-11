const path = require("path");

const { appendAppLog } = require("../logging");
const { sleep } = require("../utils");
const {
  clickUploadButtonScript,
  detectUploadedAssetScript,
} = require("./chatgpt_dom");
const {
  evaluateOnCdpPage,
  getConversationState,
} = require("./chatgpt_core");

let setChatGptSendState = () => null;

function initChatGptUpload(runtime = {}) {
  if (typeof runtime.setChatGptSendState === "function") {
    setChatGptSendState = runtime.setChatGptSendState;
  }
}

function verifyAttachmentsReady(filePaths, pageState) {
  if (!pageState || !pageState.ok) return false;
  if (pageState.attachmentCount !== filePaths.length) return false;
  
  const expectedNames = filePaths.map(f => path.basename(f).toLowerCase());
  const actualNames = (pageState.attachmentNames || []).map(n => n.toLowerCase());
  
  for (const name of expectedNames) {
    const found = actualNames.some(act => act.includes(name) || name.includes(act));
    if (!found) return false;
  }
  return true;
}

async function uploadFilesToChatGptSequentially(
  page,
  filePaths,
  sceneId = "",
  options = {},
) {
  setChatGptSendState(sceneId, "PREPARING");
  await appendAppLog(sceneId, {
    source: "main",
    kind: "running",
    text: `[MILESTONE] UPLOAD_BEGIN for scene ${sceneId}`,
  }).catch(() => null);

  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `Scene ${sceneId}: ChatGPT sequential upload starting for files: ${filePaths.map((f) => path.basename(f)).join(", ")}`,
  });

  if (page && page.clientType === "playwright") {
    // Xóa các file đính kèm không mong muốn
    await evaluateOnCdpPage(
      page,
      `((allowedNames) => {
        const attachments = Array.from(document.querySelectorAll('main form [data-testid*="attachment"], main form [class*="attachment"], main form [class*="file-preview"], main form [data-testid*="file-preview"]')).filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && el.tagName !== 'INPUT';
        });
        let clickedCount = 0;
        for (const el of attachments) {
          const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').toLowerCase();
          const isAllowed = allowedNames.some(name => text.includes(name));
          if (!isAllowed) {
            const btn = el.querySelector('button, [class*="remove"], [class*="close"], [data-testid*="remove"]');
            if (btn) {
              btn.click();
              clickedCount++;
            }
          }
        }
        return { ok: true, clickedCount };
      })(${JSON.stringify(filePaths.map(f => path.basename(f).toLowerCase()))})`
    ).catch(() => null);
    await sleep(600);

    const pageState = await getConversationState(page);
    const existingNames = (pageState.attachmentNames || []).map(n => n.toLowerCase());
    const characterCount = Number(options.characterCount || 0);

    for (let index = 0; index < filePaths.length; index += 1) {
      const filePath = filePaths[index];
      const basename = path.basename(filePath).toLowerCase();
      
      const alreadyUploaded = existingNames.some(extName => extName.includes(basename) || basename.includes(extName));
      if (alreadyUploaded) {
        await appendAppLog(sceneId, {
          source: "main",
          kind: "info",
          text: `Scene ${sceneId}: File ${path.basename(filePath)} already attached. Resuming and skipping upload.`
        }).catch(() => null);
        continue;
      }

      if (index < characterCount) {
        await appendAppLog(null, {
          source: "main",
          kind: "running",
          text: `Scene ${sceneId}: Uploading character preset ${index + 1}/${characterCount}.`,
        });
      } else {
        await appendAppLog(null, {
          source: "main",
          kind: "running",
          text: options.trailingUploadLog || `Scene ${sceneId}: Uploading previous Last Frame for IMAGE_STAGE...`,
        });
      }
      
      await page.setInputFiles('input[type="file"]', filePath);
      await sleep(1500);
    }

    await appendAppLog(null, {
      source: "main",
      kind: "running",
      text: `Scene ${sceneId}: Sequential upload done. Waiting for 5000ms post-upload delay...`,
    });
    await sleep(5000);

    const accepted = await evaluateOnCdpPage(
      page,
      `(${detectUploadedAssetScript.toString()})()`,
    ).catch((error) => ({ ok: false, error: error.message }));

    await appendAppLog(null, {
      source: "main",
      kind: accepted?.ok ? "ok" : "error",
      text: `Scene ${sceneId}: ChatGPT sequential upload result: ${accepted?.ok ? "đã nhận files" : accepted?.error || "chưa nhận files"}`,
      details: accepted,
    });

    if (accepted?.ok) {
      setChatGptSendState(sceneId, "PREPARING");
      await appendAppLog(sceneId, {
        source: "main",
        kind: "ok",
        text: `[MILESTONE] UPLOAD_FINISHED for scene ${sceneId}`,
      }).catch(() => null);
      return { ok: true, uploaded: accepted };
    }
    return { ok: false, error: accepted?.error || "ChatGPT chưa nhận files upload." };
  }

  const handle = await page.DOM.getDocument();
  let nodeId = null;
  try {
    const query = await page.DOM.querySelector({
      nodeId: handle.root.nodeId,
      selector: 'input[type="file"]',
    });
    nodeId = query.nodeId;
  } catch (_error) {
    nodeId = null;
  }
  if (!nodeId) {
    const clicked = await evaluateOnCdpPage(
      page,
      `(${clickUploadButtonScript.toString()})('chatgpt')`,
    );
    await sleep(1500);
    const refreshed = await page.DOM.getDocument();
    try {
      const query = await page.DOM.querySelector({
        nodeId: refreshed.root.nodeId,
        selector: 'input[type="file"]',
      });
      nodeId = query.nodeId;
    } catch (_error) {
      nodeId = null;
    }
    if (!nodeId && !clicked?.ok) {
      return {
        ok: false,
        error:
          clicked?.error ||
          "Không tìm thấy input[type=file] sau khi bấm upload.",
      };
    }
  }
  if (!nodeId)
    return { ok: false, error: "Không tìm thấy input[type=file] trong DOM." };

  // Clear only unwanted attachments
  await evaluateOnCdpPage(
    page,
    `((allowedNames) => {
      const attachments = Array.from(document.querySelectorAll('main form [data-testid*="attachment"], main form [class*="attachment"], main form [class*="file-preview"], main form [data-testid*="file-preview"]')).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && el.tagName !== 'INPUT';
      });
      let clickedCount = 0;
      for (const el of attachments) {
        const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').toLowerCase();
        const isAllowed = allowedNames.some(name => text.includes(name));
        if (!isAllowed) {
          const btn = el.querySelector('button, [class*="remove"], [class*="close"], [data-testid*="remove"]');
          if (btn) {
            btn.click();
            clickedCount++;
          }
        }
      }
      return { ok: true, clickedCount };
    })(${JSON.stringify(filePaths.map(f => path.basename(f).toLowerCase()))})`
  ).catch(() => null);
  await sleep(600);

  const pageState = await getConversationState(page);
  const existingNames = (pageState.attachmentNames || []).map(n => n.toLowerCase());

  const characterCount = Number(options.characterCount || 0);
  // Sequentially upload each file with staggered delays
  for (let index = 0; index < filePaths.length; index += 1) {
    const filePath = filePaths[index];
    const basename = path.basename(filePath).toLowerCase();
    
    // Check if already uploaded
    const alreadyUploaded = existingNames.some(extName => extName.includes(basename) || basename.includes(extName));
    if (alreadyUploaded) {
      await appendAppLog(sceneId, {
        source: "main",
        kind: "info",
        text: `Scene ${sceneId}: File ${path.basename(filePath)} already attached. Resuming and skipping upload.`
      }).catch(() => null);
      continue;
    }

    if (index < characterCount) {
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text: `Scene ${sceneId}: Uploading character preset ${index + 1}/${characterCount}.`,
      });
    } else {
      await appendAppLog(null, {
        source: "main",
        kind: "running",
        text:
          options.trailingUploadLog ||
          `Scene ${sceneId}: Uploading previous Last Frame for IMAGE_STAGE...`,
      });
    }
    await page.DOM.setFileInputFiles({ nodeId, files: [filePath] });
    await sleep(1500);
  }

  // After all sequential uploads, do the global 5000ms Post-Upload padding
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `Scene ${sceneId}: Sequential upload done. Waiting for 5000ms post-upload delay...`,
  });
  await sleep(5000);

  const accepted = await evaluateOnCdpPage(
    page,
    `(${detectUploadedAssetScript.toString()})()`,
  ).catch((error) => ({ ok: false, error: error.message }));
  await appendAppLog(null, {
    source: "main",
    kind: accepted?.ok ? "ok" : "error",
    text: `Scene ${sceneId}: ChatGPT sequential upload result: ${accepted?.ok ? "đã nhận files" : accepted?.error || "chưa nhận files"}`,
    details: accepted,
  });
  if (accepted?.ok) {
    setChatGptSendState(sceneId, "PREPARING");
    await appendAppLog(sceneId, {
      source: "main",
      kind: "ok",
      text: `[MILESTONE] UPLOAD_FINISHED for scene ${sceneId}`,
    }).catch(() => null);
    return { ok: true, uploaded: accepted };
  }
  return {
    ok: false,
    error: accepted?.error || "ChatGPT chưa nhận files upload.",
  };
}

async function uploadFileToChatGptDirectly(page, filePath, sceneId = "") {
  await appendAppLog(null, {
    source: "main",
    kind: "running",
    text: `Scene ${sceneId}: ChatGPT direct upload starting for file: ${path.basename(filePath)}`,
  });

  if (page && page.clientType === "playwright") {
    await page.setInputFiles('input[type="file"]', filePath);
    await sleep(2000);
    await appendAppLog(null, {
      source: "main",
      kind: "ok",
      text: `Scene ${sceneId}: ChatGPT direct upload completed for file: ${path.basename(filePath)}`,
    });
    return { ok: true };
  }

  const handle = await page.DOM.getDocument();
  let nodeId = null;
  try {
    const query = await page.DOM.querySelector({
      nodeId: handle.root.nodeId,
      selector: 'input[type="file"]',
    });
    nodeId = query.nodeId;
  } catch (_error) {
    nodeId = null;
  }
  if (!nodeId) {
    const clicked = await evaluateOnCdpPage(
      page,
      `(${clickUploadButtonScript.toString()})('chatgpt')`,
    );
    await sleep(1500);
    const refreshed = await page.DOM.getDocument();
    try {
      const query = await page.DOM.querySelector({
        nodeId: refreshed.root.nodeId,
        selector: 'input[type="file"]',
      });
      nodeId = query.nodeId;
    } catch (_error) {
      nodeId = null;
    }
    if (!nodeId && !clicked?.ok) {
      return {
        ok: false,
        error:
          clicked?.error ||
          "Không tìm thấy input[type=file] sau khi bấm upload.",
      };
    }
  }
  if (!nodeId)
    return { ok: false, error: "Không tìm thấy input[type=file]." };
  await page.DOM.setFileInputFiles({ nodeId, files: [filePath] });
  await sleep(2000);
  await appendAppLog(null, {
    source: "main",
    kind: "ok",
    text: `Scene ${sceneId}: ChatGPT direct upload completed for file: ${path.basename(filePath)}`,
  });
  return { ok: true };
}

module.exports = {
  initChatGptUpload,
  verifyAttachmentsReady,
  uploadFilesToChatGptSequentially,
  uploadFileToChatGptDirectly,
};
