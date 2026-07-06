import path from "node:path";
import { connectBrowser } from "./browser.js";
import { loadConfig } from "./config/config.js";
import { validateConfig } from "./config/validate.js";
import { loadPrompts, shuffle } from "./prompts.js";
import { openChatGPT, sendPromptAndCapture, startNewChatIfPossible } from "./chatgpt.js";
import { readJsonIfExists, writeJson, ensureDir } from "./storage.js";
import { PromptItem, PromptResponseRecord, RunManifest, RunState } from "./types.js";

function parseRuntimeArgs(argv: string[]) {
  const result = {
    configFile: "config/default.yaml",
    runId: ""
  };

  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--config=")) {
      result.configFile = arg.slice("--config=".length);
    } else if (arg.startsWith("--run-id=")) {
      result.runId = arg.slice("--run-id=".length);
    }
  }

  return result;
}

function createRunId(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function promptDirectoryName(promptOrder: number): string {
  return `prompt-${String(promptOrder).padStart(3, "0")}`;
}

function runRecordPath(runDir: string, promptOrder: number, repeatIndex: number): string {
  const promptNum = String(promptOrder).padStart(3, "0");
  const repeatNum = String(repeatIndex).padStart(3, "0");
  return path.join(runDir, "responses", promptDirectoryName(promptOrder), `${promptNum}-test-${repeatNum}.json`);
}

async function loadState(statePath: string, runId: string, startIndex: number): Promise<RunState> {
  const existing = await readJsonIfExists<Partial<RunState>>(statePath);
  const now = new Date().toISOString();

  if (!existing) {
    return {
      runId,
      createdAt: now,
      updatedAt: now,
      nextRepeat: 1,
      nextIndex: startIndex,
      completedPromptIds: [],
      failedPromptIds: []
    };
  }

  return {
    runId: existing.runId ?? runId,
    createdAt: existing.createdAt ?? now,
    updatedAt: existing.updatedAt ?? now,
    nextRepeat: typeof existing.nextRepeat === "number" && existing.nextRepeat >= 1 ? existing.nextRepeat : 1,
    nextIndex: typeof existing.nextIndex === "number" && existing.nextIndex >= 0 ? existing.nextIndex : startIndex,
    completedPromptIds: Array.isArray(existing.completedPromptIds) ? existing.completedPromptIds : [],
    failedPromptIds: Array.isArray(existing.failedPromptIds) ? existing.failedPromptIds : []
  };
}

async function saveState(statePath: string, state: RunState): Promise<void> {
  await writeJson(statePath, state);
}

async function main() {
  const { configFile, runId: cliRunId } = parseRuntimeArgs(process.argv);
  const config = loadConfig(configFile);

  validateConfig(config);

  const runId = cliRunId || createRunId();
  const promptsAll = await loadPrompts(config.run.promptFile);
  const preparedPrompts = config.run.shuffle ? shuffle(promptsAll) : promptsAll;
  const prompts = config.run.maxPrompts === null ? preparedPrompts : preparedPrompts.slice(0, config.run.maxPrompts);

  const runDir = path.join(config.output.runsDir, runId);
  const statePath = path.join(runDir, "state.json");
  const runPath = path.join(runDir, "run.json");
  const promptsSnapshotPath = path.join(runDir, "prompts.json");

  await ensureDir(runDir);
  await ensureDir(path.join(runDir, "responses"));

  const now = new Date().toISOString();
  const manifest: RunManifest = {
    runId,
    createdAt: now,
    updatedAt: now,
    provider: config.provider,
    promptFile: config.run.promptFile,
    promptCount: prompts.length,
    repeats: config.run.repeats,
    maxPrompts: config.run.maxPrompts,
    shuffle: config.run.shuffle,
    startIndex: config.run.startIndex,
    config
  };

  await writeJson(runPath, manifest);
  await writeJson(promptsSnapshotPath, prompts);

  let state = await loadState(statePath, runId, config.run.startIndex);
  await saveState(statePath, state);

  const browser = await connectBrowser(config.browser.debugPort);
  const context = browser.contexts()[0] ?? (await browser.newContext());

  console.log(`Connected to Chrome on port ${config.browser.debugPort}.`);
  console.log(`Loaded ${prompts.length} prompts.`);
  console.log(`Run ID: ${runId}`);
  console.log(`Output: ${runDir}`);

  for (let promptIndex = state.nextIndex; promptIndex < prompts.length; promptIndex += 1) {
    const prompt: PromptItem = prompts[promptIndex];
    const startRepeat = promptIndex === state.nextIndex ? state.nextRepeat : 1;

    console.log("");
    console.log(`========== Prompt ${promptIndex + 1} of ${prompts.length}: ${prompt.id} ==========`);

    for (let repeatIndex = startRepeat; repeatIndex <= config.run.repeats; repeatIndex += 1) {
      const startedAtMs = Date.now();
      const startedAt = new Date(startedAtMs).toISOString();

      console.log(`
[${promptIndex + 1}/${prompts.length} repeat ${repeatIndex}/${config.run.repeats}] ${prompt.id}: ${prompt.prompt}`);

      const page = await context.newPage();

      try {
        await openChatGPT(page);
        if (config.behavior.openNewChatEachPrompt) {
          await startNewChatIfPossible(page);
        }

        const responseText = await sendPromptAndCapture(page, prompt.prompt);
        const finishedAt = new Date().toISOString();

        const record: PromptResponseRecord = {
          runId,
          repeatIndex,
          promptLabel: promptDirectoryName(promptIndex + 1),
          promptOrder: promptIndex + 1,
          promptId: prompt.id,
          promptText: prompt.prompt,
          promptCategory: prompt.category,
          provider: config.provider,
          startedAt,
          finishedAt,
          durationMs: Date.now() - startedAtMs,
          pageUrl: page.url(),
          status: "ok",
          responseText
        };

        await writeJson(runRecordPath(runDir, promptIndex + 1, repeatIndex), record);

        state.nextIndex = promptIndex;
        state.nextRepeat = repeatIndex + 1;
        if (!state.completedPromptIds.includes(prompt.id)) state.completedPromptIds.push(prompt.id);
        state.updatedAt = finishedAt;
        await saveState(statePath, state);

        console.log(`Saved ${prompt.id} repeat ${repeatIndex}.`);
      } catch (err: any) {
        const finishedAt = new Date().toISOString();
        const message = err?.message ?? String(err);

        const record: PromptResponseRecord = {
          runId,
          repeatIndex,
          promptLabel: promptDirectoryName(promptIndex + 1),
          promptOrder: promptIndex + 1,
          promptId: prompt.id,
          promptText: prompt.prompt,
          promptCategory: prompt.category,
          provider: config.provider,
          startedAt,
          finishedAt,
          durationMs: Date.now() - startedAtMs,
          pageUrl: page.url(),
          status: message.toLowerCase().includes("timed out") ? "timeout" : "error",
          responseText: "",
          error: message
        };

        await writeJson(runRecordPath(runDir, promptIndex + 1, repeatIndex), record);

        state.nextIndex = promptIndex;
        state.nextRepeat = repeatIndex + 1;
        if (!state.failedPromptIds.includes(prompt.id)) state.failedPromptIds.push(prompt.id);
        state.updatedAt = finishedAt;
        await saveState(statePath, state);

        console.error(`Failed ${prompt.id} repeat ${repeatIndex}:`, message);
      } finally {
        await page.close().catch(() => {});
      }
    }

    state.nextIndex = promptIndex + 1;
    state.nextRepeat = 1;
    state.updatedAt = new Date().toISOString();
    await saveState(statePath, state);
  }

  console.log("\nDone.");
  await browser.close().catch(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
