const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto("https://chatgpt.com");

  console.log(await page.title());

  await page.waitForTimeout(1000);

  await page.locator("textarea").fill("Xin chào");

  await page.waitForTimeout(5000);

  await browser.close();
})();
