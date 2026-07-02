import { chromium } from "playwright";

async function main() {
  const port = Number(process.env.DEBUG_PORT ?? 9222);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);

  const context = browser.contexts()[0];
  if (!context) {
    throw new Error("No Chrome context found. Make sure Chrome is open with remote debugging enabled.");
  }

  const page = context.pages()[0] ?? await context.newPage();
  await page.bringToFront();
  await page.goto("https://chatgpt.com", { waitUntil: "domcontentloaded" });

  console.log("If you can see ChatGPT in the browser and are already logged in, the setup is ready.");
  console.log("Press Ctrl+C to exit.");

  await new Promise(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
