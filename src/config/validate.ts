import { existsSync } from "node:fs";
import { ObservatoryConfig } from "./types.js";

export function validateConfig(config: ObservatoryConfig): void {
  if (config.version !== 1) {
    throw new Error(`Unsupported config version: ${config.version}`);
  }

  if (config.provider !== "chatgpt") {
    throw new Error(`Unsupported provider: ${config.provider}`);
  }

  if (!Number.isInteger(config.browser.debugPort) || config.browser.debugPort < 1) {
    throw new Error("browser.debugPort must be a positive integer");
  }

  if (!config.run.promptFile || typeof config.run.promptFile !== "string") {
    throw new Error("run.promptFile must be a non-empty string");
  }

  if (!existsSync(config.run.promptFile)) {
    throw new Error(`Prompt file does not exist:
${config.run.promptFile}`);
  }

  if (!Number.isInteger(config.run.repeats) || config.run.repeats < 1) {
    throw new Error("run.repeats must be at least 1");
  }

  if (config.run.maxPrompts !== null && (!Number.isInteger(config.run.maxPrompts) || config.run.maxPrompts < 1)) {
    throw new Error("run.maxPrompts must be null or a positive integer");
  }

  if (!Number.isInteger(config.run.startIndex) || config.run.startIndex < 0) {
    throw new Error("run.startIndex must be a non-negative integer");
  }

  if (typeof config.behavior.openNewChatEachPrompt !== "boolean") {
    throw new Error("behavior.openNewChatEachPrompt must be true or false");
  }

  if (!config.output.runsDir || typeof config.output.runsDir !== "string") {
    throw new Error("output.runsDir must be a non-empty string");
  }
}
