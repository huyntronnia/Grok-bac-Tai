const { chromium } = require("playwright");
const repl = require("repl");

(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");

  const context = browser.contexts()[0];

  const pages = context.pages();

  console.log("\n====== OPEN PAGES ======\n");

  for (let i = 0; i < pages.length; i++) {
    console.log(i);

    console.log(await pages[i].title());

    console.log(pages[i].url());

    console.log("--------------------");
  }

  const page = pages.find((p) => p.url().includes("chatgpt.com"));

  if (!page) {
    console.log("Không tìm thấy ChatGPT");

    return;
  }

  console.log("Connected!");

  const r = repl.start("> ");
  r.context.page = page;

  await page.pause();
})();
