export type PromptItem = {
  id: string;
  prompt: string;
  category?: string;
};

export type PromptResponseRecord = {
  runId: string;
  repeatIndex: number;
  promptLabel: string;
  promptOrder: number;
  promptId: string;
  promptText: string;
  promptCategory?: string;
  provider: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  pageUrl: string;
  status: "ok" | "error" | "timeout";
  responseText: string;
  error?: string;
};

export type RunManifest = {
  runId: string;
  createdAt: string;
  updatedAt: string;
  provider: string;
  promptFile: string;
  promptCount: number;
  repeats: number;
  maxPrompts: number | null;
  shuffle: boolean;
  startIndex: number;
  config: unknown;
};

export type RunState = {
  runId: string;
  createdAt: string;
  updatedAt: string;
  nextRepeat: number;
  nextIndex: number;
  completedPromptIds: string[];
  failedPromptIds: string[];
};
