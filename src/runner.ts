import path from "node:path";
import { connectBrowser } from "./browser.js";
import { loadPrompts, shuffle } from "./prompts.js";
import { openChatGPT, sendPromptAndCapture, startNewChatIfPossible } from "./chatgpt.js";
import { readJsonIfExists, writeJson, ensureDir } from "./storage.js";
import { RunState, RunnerOptions } from "./types.js";

function parseArgs(argv: string[]): RunnerOptions {
  const opts: Partial<RunnerOptions> = {
    promptsPath: "prompts/example.json",
    runId: new Date().toISOString().replace(/[:.]/g, "-"),
    debugPort: 9222,
    startIndex: 0
  };

  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--prompts=")) opts.promptsPath = arg.slice("--prompts=".length);
    else if (arg.startsWith("--run-id=")) opts.runId = arg.slice("--run-id=".length);
    else if (arg.startsWith("--debug-port=")) opts.debugPort = Number(arg.slice("--debug-port=".length));
    else if (arg.startsWith("--max-prompts=")) opts.maxPrompts = Number(arg.slice("--max-prompts=".length));
    else if (arg.startsWith("--start-index=")) opts.startIndex = Number(arg.slice("--start-index=".length));
  }

  if (!opts.promptsPath) throw new Error("Missing --prompts");
  if (!opts.runId) throw new Error("Missing --run-id");
  if (!opts.debugPort || Number.isNaN(opts.debugPort)) throw new Error("Invalid --debug-port");

  return opts as RunnerOptions;
}

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

function runRecordPath(runDir: string, index: number, promptId: string): string {
  const safeId = promptId.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const num = String(index + 1).padStart(3, "0");
  return path.join(runDir, "chatgpt", `${num}-${safeId}.json`);
}

async function main() {
  const opts = parseArgs(process.argv);
  const promptsAll = shuffle(await loadPrompts(opts.promptsPath));
  const prompts = opts.maxPrompts ? promptsAll.slice(0, opts.maxPrompts) : promptsAll;
  const runDir = path.join("runs", opts.runId);
  const statePath = path.join(runDir, "state.json");

  await ensureDir(path.join(runDir, "chatgpt"));
  let state = await loadState(statePath, opts.runId);
  if (opts.startIndex && opts.startIndex > 0) {
    state.nextIndex = Math.max(state.nextIndex, opts.startIndex);
  }
  await saveState(statePath, state);

  const browser = await connectBrowser(opts.debugPort);
  const context = browser.contexts()[0] ?? await browser.newContext();

  console.log(`Connected to Chrome on port ${opts.debugPort}.`);
  console.log(`Loaded ${prompts.length} prompts.`);
  console.log(`Run ID: ${opts.runId}`);

  for (let index = state.nextIndex; index < prompts.length; index += 1) {
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
        runId: opts.runId,
        promptIndex: index,
        prompt,
        platform: "chatgpt" as const,
        startedAt,
        finishedAt,
        responseText,
        pageUrl: page.url(),
        status: "ok" as const
      };

      await writeJson(runRecordPath(runDir, index, prompt.id), record);

      state.nextIndex = index + 1;
      if (!state.completedPromptIds.includes(prompt.id)) state.completedPromptIds.push(prompt.id);
      state.updatedAt = finishedAt;
      await saveState(statePath, state);

      console.log(`Saved ${prompt.id}.`);
    } catch (err: any) {
      const finishedAt = new Date().toISOString();
      const record = {
        runId: opts.runId,
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

      await writeJson(runRecordPath(runDir, index, prompt.id), record);

      state.nextIndex = index + 1;
      if (!state.failedPromptIds.includes(prompt.id)) state.failedPromptIds.push(prompt.id);
      state.updatedAt = finishedAt;
      await saveState(statePath, state);

      console.error(`Failed ${prompt.id}:`, err?.message ?? err);
    } finally {
      await page.close().catch(() => {});
    }
  }

  console.log("\nDone.");
  await browser.close().catch(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
