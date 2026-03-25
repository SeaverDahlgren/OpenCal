import { z } from "zod";

export type ToolPromptShape = {
  name: string;
  description: string;
  protected: boolean;
  inputShape: string;
};

export type AmbiguityCandidate = {
  value: string;
  label: string;
};

export type ToolResult<T> =
  | { ok: true; data: T; summary: string }
  | {
      ok: false;
      error: string;
      ambiguous?: {
        kind: "entity" | "time";
        prompt: string;
        candidates: AmbiguityCandidate[];
      };
    };

export type ToolExecutionContext = {
  timezone: string;
};

export type ToolDefinition<TInput extends z.ZodTypeAny, TResult> = {
  name: string;
  description: string;
  protected: boolean;
  inputSchema: TInput;
  promptShape: ToolPromptShape;
  execute: (
    input: z.infer<TInput>,
    context: ToolExecutionContext,
  ) => Promise<ToolResult<TResult>>;
};
