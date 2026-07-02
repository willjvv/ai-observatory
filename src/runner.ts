import path from "node:path";
import { connectBrowser } from "./browser.js";
import { loadConfig } from "./config/config.js";
import { loadPrompts, shuffle } from "./prompts.js";
import { openChatGPT, sendPromptAndCapture, startNewChatIfPossible } from "./chatgpt.js";
import { readJsonIfExists, writeJson, ensureDir } from "./storage.js";
import { RunState, RunnerOptions } from "./types.js";
import { validateConfig } from "./config/validate.js";

async function loadState(statePath: string, runId: string): Promise<RunState> {
  const existing = await readJsonIfExists<RunState>(statePath);
  if (existing) return existing;

  const now = new Date().toISOString();
  return {
    runId,
    createdAt: now,
    updatedAt: now,
    nextIndex: 0,
    completedPromptIds: [],
    failedPromptIds: []
  };
}

async function saveState(statePath: string, state: RunState): Promise<void> {
  await writeJson(statePath, state);
}

function runRecordPath(runDir: string, repeat: number, index: number, promptId: string): string {
  const safeId = promptId.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const num = String(index + 1).padStart(3, "0");
  return path.join(runDir, `repeat-${repeat}`, "chatgpt", `${num}-${safeId}.json`);
}

async function main() {
  const config = loadConfig();

  validateConfig(config);

  const runId = new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

  const promptsAll = await loadPrompts(
      config.run.promptFile
  );

  const shuffled = config.run.shuffle
      ? shuffle(promptsAll)
      : promptsAll;

  const prompts =
      config.run.maxPrompts === null
          ? shuffled
          : shuffled.slice(0, config.run.maxPrompts);

  const runDir = path.join(
      config.output.runsDir,
      runId
  );
  const statePath = path.join(runDir, "state.json");

  await ensureDir(path.join(runDir, "chatgpt"));
  let state = await loadState(statePath, runId);
  if (config.run.startIndex > 0) {
    state.nextIndex = Math.max(state.nextIndex, config.run.startIndex);
  }
  await saveState(statePath, state);

  const browser = await connectBrowser(config.browser.debugPort);
  const context = browser.contexts()[0] ?? await browser.newContext();

  console.log(`Connected to Chrome on port ${config.browser.debugPort}.`);
  console.log(`Loaded ${prompts.length} prompts.`);
  console.log(`Run ID: ${runId}`);

  for (
    let repeat = 0;
    repeat < config.run.repeats;
    repeat++
  ) {

    console.log("");

    console.log(
      `========== Run ${repeat + 1} of ${config.run.repeats} ==========`
    );

    state.nextIndex = 0;

    for (
      let index = state.nextIndex;
      index < prompts.length;
      index++
    ) {
      const prompt = prompts[index];
      const startedAt = new Date().toISOString();

      console.log(`\n[${index + 1}/${prompts.length}] ${prompt.id}: ${prompt.prompt}`);

      const page = await context.newPage();
      try {
        await openChatGPT(page);
        await startNewChatIfPossible(page);

        const responseText = await sendPromptAndCapture(page, prompt.prompt);

        const finishedAt = new Date().toISOString();
        const record = {
          runId: runId,
          promptIndex: index,
          prompt,
          platform: "chatgpt" as const,
          startedAt,
          finishedAt,
          responseText,
          pageUrl: page.url(),
          status: "ok" as const
        };

        await writeJson(runRecordPath(runDir, repeat, index, prompt.id), record);

        state.nextIndex = index + 1;
        if (!state.completedPromptIds.includes(prompt.id)) state.completedPromptIds.push(prompt.id);
        state.updatedAt = finishedAt;
        await saveState(statePath, state);

        console.log(`Saved ${prompt.id}.`);
      } catch (err: any) {
        const finishedAt = new Date().toISOString();
        const record = {
          runId: runId,
          repeat: repeat,
          promptIndex: index,
          prompt,
          platform: "chatgpt" as const,
          startedAt,
          finishedAt,
          responseText: "",
          pageUrl: page.url(),
          status: "error" as const,
          error: err?.message ?? String(err)
        };

        await writeJson(runRecordPath(runDir, repeat + 1, index, prompt.id), record);

        state.nextIndex = index + 1;
        if (!state.failedPromptIds.includes(prompt.id)) state.failedPromptIds.push(prompt.id);
        state.updatedAt = finishedAt;
        await saveState(statePath, state);

        console.error(`Failed ${prompt.id}:`, err?.message ?? err);
      } finally {
        await page.close().catch(() => {});
      }
    }
  }

  console.log("\nDone.");
  await browser.close().catch(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
