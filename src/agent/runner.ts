import path from "node:path";
import type { AppConfig } from "../config/env.js";
import { buildSystemPrompt } from "./prompts.js";
import type { AgentDecision, ConversationMessage, RuntimeContext } from "./types.js";
import { compactConversation, updateToolsIndex } from "../memory/context.js";
import { appendDebugLog, appendLogEntry, appendMemory } from "../memory/logs.js";
import { ensureWorkspace, loadWorkspaceFiles } from "../memory/workspace.js";
import { estimateMessagesTokens } from "./tokenizer.js";
import type { LlmProvider } from "../llm/provider.js";
import { toUserFacingLlmErrorMessage } from "../llm/errors.js";
import type { ConsoleIO } from "../cli/io.js";
import type { ToolDefinition, ToolResult } from "../tools/types.js";
import { renderToolsMarkdown } from "../tools/registry.js";

type ToolRegistry = Map<string, ToolDefinition<any, unknown>>;

export class AgentRunner {
  private readonly messages: ConversationMessage[] = [];

  constructor(
    private readonly config: AppConfig,
    private readonly provider: LlmProvider,
    private readonly io: ConsoleIO,
    private readonly tools: ToolRegistry,
  ) {}

  async initialize() {
    await ensureWorkspace(this.config.rootDir);
    await updateToolsIndex(this.config.rootDir, renderToolsMarkdown(this.tools));
  }

  async runChatLoop(): Promise<void> {
    const now = new Date();
    const dateOnly = now.toISOString().slice(0, 10);
    const workspace = await loadWorkspaceFiles(this.config.rootDir, dateOnly);
    const timezone = extractTimezone(workspace.user) ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.io.print("openCal ready. Type `exit` to quit.");

    while (true) {
      const input = await this.io.ask("You");
      if (!input) {
        continue;
      }
      if (["exit", "quit"].includes(input.toLowerCase())) {
        break;
      }

      const userMessage = createMessage("user", input);
      this.messages.push(userMessage);
      await appendLogEntry(workspace.dailyLogPath, userMessage);
      await appendDebugLog(workspace.debugLogPath, "turn.user_input", {
        content: input,
      });

      let finalReply: string;
      try {
        finalReply = await this.processTurn({
          timezone,
          workspace,
        });
      } catch (error) {
        await appendDebugLog(workspace.debugLogPath, "turn.error", {
          error: serializeError(error),
        });
        finalReply = toUserFacingLlmErrorMessage(error);
      }

      const assistantMessage = createMessage("assistant", finalReply);
      this.messages.push(assistantMessage);
      await appendLogEntry(workspace.dailyLogPath, assistantMessage);
      await appendDebugLog(workspace.debugLogPath, "turn.assistant_reply", {
        content: finalReply,
      });
      this.io.print(`\n${finalReply}\n`);
    }

    try {
      const summary = await this.provider.summarizeConversation(
        this.messages.filter((message) => message.role === "user" || message.role === "assistant"),
      );
      await appendMemory(path.join(this.config.rootDir, "Memory.md"), summary);
    } catch {
      // Session shutdown should not fail if the summarizer is temporarily unavailable.
    }
  }

  private async processTurn(args: {
    timezone: string;
    workspace: Awaited<ReturnType<typeof loadWorkspaceFiles>>;
  }): Promise<string> {
    let stepCount = 0;
    let finalReply = "I could not complete that request.";
    let runtimeSummary: string | undefined;

    while (stepCount < 8) {
      stepCount += 1;

      const compacted = await compactConversation({
        messages: this.messages,
        contextWindowLimit: this.config.contextWindowLimit,
        compactionThreshold: this.config.compactionThreshold,
        provider: this.provider,
      });

      if (compacted.summary) {
        runtimeSummary = compacted.summary;
      }

      const runtimeContext = buildRuntimeContext(args.timezone, runtimeSummary);
      const systemPrompt = buildSystemPrompt({
        soul: args.workspace.soul,
        user: args.workspace.user,
        tools: [...this.tools.values()].map((tool) => tool.promptShape),
        memory: args.workspace.memory,
        runtime: runtimeContext,
        tokenUsage: {
          estimatedInputTokens: estimateMessagesTokens(compacted.messages),
          contextWindowLimit: this.config.contextWindowLimit,
          maxOutputTokens: this.config.maxOutputTokens,
          compactionThreshold: this.config.compactionThreshold,
        },
      });

      const decision = await this.provider.generateDecision({
        systemPrompt,
        messages: compacted.messages,
        tools: [...this.tools.values()].map((tool) => tool.promptShape),
        maxOutputTokens: this.config.maxOutputTokens,
      });
      await appendDebugLog(args.workspace.debugLogPath, "llm.decision", {
        type: decision.type,
        toolCalls:
          decision.type === "tool"
            ? decision.toolCalls.map((toolCall) => ({
                name: toolCall.name,
                arguments: toolCall.arguments,
              }))
            : undefined,
      });

      finalReply = await this.handleDecision(decision, args.timezone, args.workspace.debugLogPath);
      if (decision.type === "message" || decision.type === "stop") {
        return finalReply;
      }
    }

    return finalReply;
  }

  private async handleDecision(
    decision: AgentDecision,
    timezone: string,
    debugLogPath: string,
  ): Promise<string> {
    if (decision.type === "message") {
      return decision.message;
    }

    if (decision.type === "clarify") {
      const answer = await this.io.ask(decision.message);
      this.messages.push(createMessage("user", answer));
      return "Working with that clarification.";
    }

    if (decision.type === "stop") {
      return decision.message.replace(/^<STOP>\s*/i, "").trim();
    }

    for (const toolCall of decision.toolCalls) {
      const tool = this.tools.get(toolCall.name);
      if (!tool) {
        await appendDebugLog(debugLogPath, "tool.missing", {
          name: toolCall.name,
          arguments: toolCall.arguments,
        });
        this.messages.push(
          createMessage("tool", `Tool ${toolCall.name} is not registered.`, toolCall.name),
        );
        continue;
      }

      const parsedInput = tool.inputSchema.safeParse(toolCall.arguments);
      if (!parsedInput.success) {
        await appendDebugLog(debugLogPath, "tool.invalid_input", {
          name: tool.name,
          arguments: toolCall.arguments,
          issues: parsedInput.error.issues,
        });
        const content = `Invalid input for ${tool.name}: ${parsedInput.error.message}`;
        this.messages.push(createMessage("tool", content, tool.name));
        continue;
      }

      await appendDebugLog(debugLogPath, "tool.start", {
        name: tool.name,
        arguments: parsedInput.data,
        protected: tool.protected,
      });

      if (tool.protected) {
        const preview = JSON.stringify(parsedInput.data, null, 2);
        const confirmed = await this.io.confirm(
          `Protected action: ${tool.name}\n${preview}\nExecute this action?`,
        );
        await appendDebugLog(debugLogPath, "tool.confirmation", {
          name: tool.name,
          confirmed,
        });
        if (!confirmed) {
          this.messages.push(createMessage("tool", `${tool.name} cancelled by user.`, tool.name));
          return `${tool.name} cancelled.`;
        }
      }

      let toolMessage: string;
      try {
        const result = await tool.execute(parsedInput.data, { timezone });
        await appendDebugLog(debugLogPath, "tool.result", {
          name: tool.name,
          result: sanitizeForLog(result),
        });
        toolMessage = await this.handleToolResult(tool.name, result);
      } catch (error) {
        await appendDebugLog(debugLogPath, "tool.error", {
          name: tool.name,
          arguments: parsedInput.data,
          error: serializeError(error),
        });
        toolMessage = `${tool.name}: ${
          error instanceof Error ? error.message : "Unknown tool execution failure."
        }`;
      }

      this.messages.push(createMessage("tool", toolMessage, tool.name));
    }

    return "Working through the tool results.";
  }

  private async handleToolResult(toolName: string, result: ToolResult<unknown>): Promise<string> {
    if (result.ok) {
      return `${toolName}: ${result.summary}\n${JSON.stringify(result.data, null, 2)}`;
    }

    if (result.ambiguous) {
      const selection = await this.io.choose(
        result.ambiguous.prompt,
        result.ambiguous.candidates.map((candidate) => ({
          label: candidate.label,
          value: candidate.value,
        })),
      );

      if (!selection) {
        return `${toolName}: ambiguity unresolved by user.`;
      }

      const clarification = `User selected ${selection.value} for ambiguous ${result.ambiguous.kind}.`;
      this.messages.push(createMessage("user", clarification));
      return `${toolName}: ${clarification}`;
    }

    return `${toolName}: ${result.error}`;
  }
}

function buildRuntimeContext(timezone: string, compactedSummary?: string): RuntimeContext {
  const now = new Date();
  return {
    nowIso: now.toISOString(),
    dayOfWeek: now.toLocaleDateString("en-US", { weekday: "long", timeZone: timezone }),
    timezone,
    compactedSummary,
  };
}

function extractTimezone(userMarkdown: string): string | undefined {
  const match = userMarkdown.match(/timezone:\s*([A-Za-z_\/]+)/i);
  return match?.[1];
}

function createMessage(role: ConversationMessage["role"], content: string, name?: string): ConversationMessage {
  return {
    role,
    content,
    name,
    timestamp: new Date().toISOString(),
  };
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === "object" && error !== null) {
    return sanitizeForLog(error);
  }

  return { value: String(error) };
}

function sanitizeForLog(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, innerValue) => {
      if (innerValue instanceof Error) {
        return {
          name: innerValue.name,
          message: innerValue.message,
          stack: innerValue.stack,
        };
      }
      if (typeof innerValue === "bigint") {
        return innerValue.toString();
      }
      return innerValue;
    }),
  );
}
