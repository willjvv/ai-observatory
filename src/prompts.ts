import { readFile } from "node:fs/promises";
import { PromptItem } from "./types.js";

function assertPromptItem(value: unknown, index: number): asserts value is PromptItem {
  if (!value || typeof value !== "object") {
    throw new Error(`Prompt at index ${index} is not an object.`);
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id.trim()) {
    throw new Error(`Prompt at index ${index} is missing a non-empty string id.`);
  }
  if (typeof record.prompt !== "string" || !record.prompt.trim()) {
    throw new Error(`Prompt at index ${index} is missing a non-empty string prompt.`);
  }
}

export async function loadPrompts(filePath: string): Promise<PromptItem[]> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Prompt file must contain an array: ${filePath}`);
  }

  parsed.forEach(assertPromptItem);
  return parsed;
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
