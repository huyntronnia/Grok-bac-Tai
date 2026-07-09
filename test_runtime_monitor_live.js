const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const CDP = require("chrome-remote-interface");

// Find Chrome path on Windows
function findChrome() {
  const paths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe")
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const chromePath = findChrome();
  if (!chromePath) {
    console.error("Không tìm thấy Google Chrome trên hệ thống của bạn.");
    process.exit(1);
  }

  const port = 9223;
  const profileDir = path.join(__dirname, "chrome-debug-profile");
  console.log(`Đang khởi động Chrome tại: ${chromePath}`);
  console.log(`Debug Port: ${port}`);
  console.log(`Profile: ${profileDir}`);

  // Launch Chrome with remote debugging
  const chrome = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "https://chatgpt.com"
  ], {
    detached: true,
    stdio: "ignore"
  });
  chrome.unref();

  console.log("Đang chờ Chrome mở (3 giây)...");
  await sleep(3000);

  let client;
  try {
    const targets = await CDP.List({ host: "127.0.0.1", port });
    const target = targets.find(t => t.type === "page" && t.url.includes("chatgpt.com")) || targets[0];
    if (!target) {
      throw new Error("Không tìm thấy tab chatgpt.com");
    }

    client = await CDP({ target, host: "127.0.0.1", port });
    await client.Page.enable();
    await client.Runtime.enable();
    await client.DOM.enable();
    await client.Network.enable().catch(() => null);

    console.log("Kết nối CDP thành công!");
  } catch (err) {
    console.error("Lỗi kết nối CDP:", err.message);
    process.exit(1);
  }

  // Import and start monitoring
  const chatGptRuntimeMonitor = require("./electron/main/chatgpt/chatgpt_runtime_monitor");
  console.log("Đang khởi động Runtime Monitor...");
  await chatGptRuntimeMonitor.startMonitoring(client);

  chatGptRuntimeMonitor.subscribe((event) => {
    console.clear();
    console.log("=========================================");
    console.log("        CHATGPT RUNTIME MONITOR LIVE     ");
    console.log("=========================================");
    console.log(`Thời gian: ${new Date(event.timestamp).toLocaleTimeString()}`);
    console.log(`Trạng thái: [${event.newState}] (Độ tin cậy: ${event.confidence})`);
    console.log(`Ý định (Intent): [${event.newIntent}]`);
    console.log("-----------------------------------------");
    console.log("DOM Metrics:");
    console.log(`- Trình soạn thảo sẵn sàng: ${event.metrics.dom.composerReady}`);
    console.log(`- Trình soạn thảo bận: ${event.metrics.dom.composerBusy}`);
    console.log(`- Số lượng file đính kèm: ${event.metrics.dom.attachmentsCount}`);
    console.log(`- File đã upload xong: ${event.metrics.dom.attachmentsCompleted}`);
    console.log(`- Chữ soạn thảo (Hash): ${event.metrics.dom.composerPromptHash}`);
    console.log(`- Trạng thái soạn thảo: ${event.metrics.dom.composerState}`);
    console.log(`- Số lượng tin nhắn trợ lý: ${event.metrics.dom.assistantMessageCount}`);
    console.log(`- Độ dài tin nhắn trợ lý mới nhất: ${event.metrics.dom.latestAssistantTextLength}`);
    console.log(`- Trợ lý đang stream chữ: ${event.metrics.dom.textStreamingActive}`);
    console.log(`- Trợ lý đang tạo ảnh (DALL-E): ${event.metrics.dom.dalleActive}`);
    console.log(`- Hiển thị Placeholder: ${event.metrics.dom.placeholderVisible}`);
    console.log(`- Tổng số lượng ảnh: ${event.metrics.dom.imageElementCount}`);
    console.log(`- Ảnh đã tải hoàn tất: ${event.metrics.dom.imageCompleteCount}`);
    console.log("-----------------------------------------");
    console.log("Network Metrics:");
    console.log(`- Các luồng tải ảnh đang chạy: ${event.metrics.network.activeMediaRequests}`);
    console.log(`- URL ảnh dalle bắt được: ${event.metrics.network.dalleUrlsCaptured.length}`);
    console.log("=========================================");
  });

  console.log("Đang theo dõi sự kiện... Nhấn Ctrl+C để thoát.");
}

run().catch(console.error);
