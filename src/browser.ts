import { chromium, Browser, BrowserContext, Page } from "playwright";

export async function connectBrowser(debugPort: number): Promise<Browser> {
  return chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
}

export async function getOrCreatePage(context: BrowserContext): Promise<Page> {
  const page = context.pages()[0] ?? await context.newPage();
  await page.bringToFront();
  return page;
}
