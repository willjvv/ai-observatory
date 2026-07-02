import { Page } from "playwright";

const PROMPT_SELECTORS = [
  "#prompt-textarea",
  'textarea[placeholder*="Message"]',
  'textarea[placeholder*="Send a message"]',
  "textarea",
  '[contenteditable="true"]'
];

const ASSISTANT_SELECTORS = [
  '[data-message-author-role="assistant"]',
  'article[data-message-author-role="assistant"]',
  '[role="article"][data-message-author-role="assistant"]'
];

async function firstVisibleLocator(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      if (await locator.count()) {
        await locator.waitFor({ state: "visible", timeout: 2000 });
        return locator;
      }
    } catch {
      // try next selector
    }
  }
  throw new Error(`Could not find any visible locator from: ${selectors.join(", ")}`);
}

export async function openChatGPT(page: Page): Promise<void> {
  await page.goto("https://chatgpt.com", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
}

export async function locatePromptBox(page: Page) {
  return firstVisibleLocator(page, PROMPT_SELECTORS);
}

export async function startNewChatIfPossible(page: Page): Promise<void> {
  const candidates = [
    page.getByRole("button", { name: /new chat/i }),
    page.getByRole("button", { name: /new conversation/i }),
    page.getByRole("link", { name: /new chat/i }),
    page.getByRole("link", { name: /new conversation/i })
  ];

  for (const candidate of candidates) {
    try {
      if (await candidate.count()) {
        await candidate.first().click({ timeout: 1500 });
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        return;
      }
    } catch {
      // Ignore and continue.
    }
  }
}

async function getLastAssistantText(page: Page): Promise<string> {
  for (const selector of ASSISTANT_SELECTORS) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    if (!count) continue;
    const last = locator.nth(count - 1);
    const text = (await last.innerText({ timeout: 2000 }).catch(() => ""))?.trim();
    if (text) return text;
  }
  return "";
}

export async function sendPromptAndCapture(page: Page, prompt: string, timeoutMs = 180000): Promise<string> {
  const promptBox = await locatePromptBox(page);
  await promptBox.fill(prompt);

  await promptBox.press("Enter").catch(async () => {
    const sendButton = page.getByRole("button", { name: /send/i });
    if (await sendButton.count()) {
      await sendButton.first().click();
      return;
    }
    throw new Error("Could not submit prompt.");
  });

  const started = Date.now();
  let lastText = "";
  let stableCount = 0;
  let seenAnyResponse = false;

  while (Date.now() - started < timeoutMs) {
    const current = await getLastAssistantText(page);

    if (current) {
      seenAnyResponse = true;
      if (current === lastText) {
        stableCount += 1;
      } else {
        stableCount = 0;
        lastText = current;
      }

      if (seenAnyResponse && stableCount >= 3) {
        return current;
      }
    }

    await page.waitForTimeout(3000);
  }

  if (lastText) return lastText;
  throw new Error("Timed out waiting for assistant response.");
}
