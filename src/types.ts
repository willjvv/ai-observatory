export type PromptItem = {
  id: string;
  prompt: string;
  category?: string;
};

export type PromptRunRecord = {
  runId: string;
  promptIndex: number;
  prompt: PromptItem;
  platform: "chatgpt";
  startedAt: string;
  finishedAt: string;
  responseText: string;
  pageUrl: string;
  status: "ok" | "error" | "timeout";
  error?: string;
};

export type RunState = {
  runId: string;
  createdAt: string;
  updatedAt: string;
  nextIndex: number;
  completedPromptIds: string[];
  failedPromptIds: string[];
};

export type RunnerOptions = {
  promptsPath: string;
  runId: string;
  debugPort: number;
  maxPrompts?: number;
  startIndex?: number;
};
