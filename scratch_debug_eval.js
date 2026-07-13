const CDP = require("chrome-remote-interface");
const dom = require("./electron/main/chatgpt/chatgpt_dom");

async function run() {
  try {
    const targets = await CDP.List({ host: "127.0.0.1", port: 9223 });
    const target = targets.find(t => t.type === "page" && t.url.includes("chatgpt.com")) || targets[0];
    if (!target) {
      console.error("No ChatGPT tab found!");
      return;
    }
    console.log("Connected to target:", target.url);
    const client = await CDP({ target, host: "127.0.0.1", port: 9223 });
    await client.Runtime.enable();
    
    // Evaluate readLatestAssistantScript
    const expression = `(${dom.readLatestAssistantScript.toString()})()`;
    const res = await client.Runtime.evaluate({
      expression,
      returnByValue: true
    });
    console.log("readLatestAssistantScript result:", JSON.stringify(res.result.value, null, 2));

    // Evaluate window.__extractConversationSnapshot() directly to see the snapshot object
    const snapExpr = `(() => {
      if (typeof window.__extractConversationSnapshot !== 'function') {
        return { error: 'not_defined' };
      }
      return window.__extractConversationSnapshot();
    })()`;
    const snapRes = await client.Runtime.evaluate({
      expression: snapExpr,
      returnByValue: true
    });
    console.log("Snapshot object:", JSON.stringify(snapRes.result.value, null, 2));

    await client.close();
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
