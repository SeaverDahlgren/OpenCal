import path from "node:path";
import type { AppConfig } from "../config/env.js";
import { buildSystemPrompt } from "./prompts.js";
import { formatToolResultMessage } from "./tool-result-format.js";
import type { AgentDecision, ConversationMessage, RuntimeContext } from "./types.js";
import {
  activateNextSubgoal,
  applyToolResultToTaskState,
  beginExecution,
  bindUserReplyToTaskState,
  buildIncompleteTaskMessage,
  buildTaskSkillSelectionInput,
  completeResponseSubgoals,
  createTaskState,
  getActiveSubgoal,
  getAwaitingPrompt,
  hasPendingSubgoals,
  mergeUserInputIntoTaskState,
  registerAwaitingUserResponse,
  shouldStartNewTask,
  summarizeTaskStateForPrompt,
  type TaskState,
} from "./task-state.js";
import { compactConversation, updateToolsIndex } from "../memory/context.js";
import { appendDebugLog, appendLogEntry, appendMemory } from "../memory/logs.js";
import { ensureWorkspace, loadWorkspaceFiles } from "../memory/workspace.js";
import { estimateMessagesTokens } from "./tokenizer.js";
import type { LlmProvider } from "../llm/provider.js";
import { toUserFacingLlmErrorMessage } from "../llm/errors.js";
import type { ConsoleIO } from "../cli/io.js";
import type { ToolDefinition, ToolResult } from "../tools/types.js";
import { renderToolsMarkdown } from "../tools/registry.js";
import {
  buildSelectedSkillDetails,
  buildSkillsCatalog,
  loadSkillManifests,
  selectRelevantSkills,
  type SkillManifest,
} from "../skills/manifests.js";

type ToolRegistry = Map<string, ToolDefinition<any, unknown>>;

export class AgentRunner {
  private readonly messages: ConversationMessage[] = [];
  private skillsCatalog = "No semantic skills are configured.";
  private skillManifests: SkillManifest[] = [];
  private currentTaskState: TaskState | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly provider: LlmProvider,
    private readonly io: ConsoleIO,
    private readonly tools: ToolRegistry,
  ) {}

  async initialize() {
    await ensureWorkspace(this.config.rootDir);
    await updateToolsIndex(this.config.rootDir, renderToolsMarkdown(this.tools));
    this.skillManifests = await loadSkillManifests(this.config.rootDir);
    this.skillsCatalog = buildSkillsCatalog(this.skillManifests);
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
    await this.updateTaskStateForLatestUserInput(args.workspace.debugLogPath);
    this.currentTaskState = activateNextSubgoal(this.currentTaskState);

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
      const latestUserInput = findLatestUserInput(this.messages);
      const skillSelectionInput = buildTaskSkillSelectionInput(this.currentTaskState, latestUserInput);
      const selectedSkills = selectRelevantSkills(this.skillManifests, skillSelectionInput);
      await appendDebugLog(args.workspace.debugLogPath, "skill.catalog", {
        catalog: this.skillsCatalog,
      });
      await appendDebugLog(args.workspace.debugLogPath, "skill.selected", {
        input: skillSelectionInput,
        selectedSkillIds: selectedSkills.map((skill) => skill.id),
        selectedSkillPaths: selectedSkills.map((skill) => skill.path),
      });
      const systemPrompt = buildSystemPrompt({
        soul: args.workspace.soul,
        user: args.workspace.user,
        tools: [...this.tools.values()].map((tool) => tool.promptShape),
        skillsCatalog: this.skillsCatalog,
        selectedSkillDetails: buildSelectedSkillDetails(selectedSkills),
        taskStateSummary: summarizeTaskStateForPrompt(this.currentTaskState),
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

      const outcome = await this.handleDecision(decision, args.timezone, args.workspace.debugLogPath);
      finalReply = outcome.reply;
      if (!outcome.continueLoop) {
        return finalReply;
      }
    }

    if (hasPendingSubgoals(this.currentTaskState)) {
      return buildIncompleteTaskMessage(this.currentTaskState);
    }

    return finalReply;
  }

  private async handleDecision(
    decision: AgentDecision,
    timezone: string,
    debugLogPath: string,
  ): Promise<{ reply: string; continueLoop: boolean }> {
    if (decision.type === "message") {
      this.currentTaskState = completeResponseSubgoals(this.currentTaskState, decision.message);
      if (hasPendingSubgoals(this.currentTaskState)) {
        this.currentTaskState = activateNextSubgoal(this.currentTaskState);
        return { reply: decision.message, continueLoop: true };
      }
      await this.completeTaskIfDone(debugLogPath);
      return { reply: decision.message, continueLoop: false };
    }

    if (decision.type === "clarify") {
      const active = getActiveSubgoal(this.currentTaskState);
      this.currentTaskState = registerAwaitingUserResponse(
        this.currentTaskState ?? createTaskState(findLatestUserInput(this.messages)),
        decision.message,
        "clarification",
        active?.id ?? "general-1",
      );
      await appendDebugLog(debugLogPath, "task.awaiting_user_response", {
        taskId: this.currentTaskState.taskId,
        prompt: decision.message,
        subgoalId: this.currentTaskState.awaitingUserResponse?.subgoalId,
      });
      return { reply: decision.message, continueLoop: false };
    }

    if (decision.type === "stop") {
      if (hasPendingSubgoals(this.currentTaskState)) {
        await appendDebugLog(debugLogPath, "task.updated", {
          taskId: this.currentTaskState?.taskId,
          reason: "stop_blocked_pending_subgoals",
          state: this.currentTaskState,
        });
        return {
          reply: getAwaitingPrompt(this.currentTaskState) ?? buildIncompleteTaskMessage(this.currentTaskState),
          continueLoop: false,
        };
      }

      const reply = decision.message.replace(/^<STOP>\s*/i, "").trim();
      await this.completeTaskIfDone(debugLogPath);
      return { reply, continueLoop: false };
    }

    this.currentTaskState = beginExecution(
      activateNextSubgoal(this.currentTaskState ?? createTaskState(findLatestUserInput(this.messages)))!,
      decision.toolCalls.map((toolCall) => toolCall.name),
    );
    await appendDebugLog(debugLogPath, "task.updated", {
      taskId: this.currentTaskState.taskId,
      reason: "tool_calls_started",
      state: this.currentTaskState,
    });

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
        this.currentTaskState = applyToolResultToTaskState(
          this.currentTaskState,
          toolCall.name,
          null,
          "error",
          `Tool ${toolCall.name} is not registered.`,
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
        this.currentTaskState = applyToolResultToTaskState(
          this.currentTaskState,
          tool.name,
          null,
          "error",
          content,
        );
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
          this.currentTaskState = applyToolResultToTaskState(
            this.currentTaskState,
            tool.name,
            null,
            "cancelled",
            `${tool.name} cancelled by user.`,
          );
          await appendDebugLog(debugLogPath, "task.updated", {
            taskId: this.currentTaskState?.taskId,
            reason: "tool_cancelled",
            state: this.currentTaskState,
          });
          return { reply: `${tool.name} cancelled.`, continueLoop: false };
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
        this.currentTaskState = applyToolResultToTaskState(
          this.currentTaskState,
          tool.name,
          result,
          result.ok ? "success" : "error",
          result.ok ? result.summary : result.error,
        );
      } catch (error) {
        await appendDebugLog(debugLogPath, "tool.error", {
          name: tool.name,
          arguments: parsedInput.data,
          error: serializeError(error),
        });
        toolMessage = `${tool.name}: ${
          error instanceof Error ? error.message : "Unknown tool execution failure."
        }`;
        this.currentTaskState = applyToolResultToTaskState(
          this.currentTaskState,
          tool.name,
          null,
          "error",
          toolMessage,
        );
      }

      this.messages.push(createMessage("tool", toolMessage, tool.name));
      await appendDebugLog(debugLogPath, "task.updated", {
        taskId: this.currentTaskState?.taskId,
        reason: "tool_result",
        state: this.currentTaskState,
      });

      if (this.currentTaskState?.awaitingUserResponse) {
        return { reply: this.currentTaskState.awaitingUserResponse.prompt, continueLoop: false };
      }
    }

    this.currentTaskState = activateNextSubgoal(this.currentTaskState);
    return { reply: "Working through the tool results.", continueLoop: true };
  }

  private async updateTaskStateForLatestUserInput(debugLogPath: string) {
    const latestUserInput = findLatestUserInput(this.messages);
    if (!latestUserInput) {
      return;
    }

    const priorTaskId = this.currentTaskState?.taskId;
    const hadOpenTask = this.currentTaskState !== null;

    if (shouldStartNewTask(this.currentTaskState, latestUserInput)) {
      if (this.currentTaskState) {
        await appendDebugLog(debugLogPath, "task.replaced", {
          previousTaskId: this.currentTaskState.taskId,
          previousTaskSummary: this.currentTaskState.taskSummary,
          newInput: latestUserInput,
        });
      }

      this.currentTaskState = createTaskState(latestUserInput);
      this.currentTaskState = activateNextSubgoal(this.currentTaskState)!;
      await appendDebugLog(debugLogPath, "task.created", {
        taskId: this.currentTaskState.taskId,
        taskSummary: this.currentTaskState.taskSummary,
        subgoals: this.currentTaskState.subgoals,
      });
      return;
    }

    if (!this.currentTaskState) {
      this.currentTaskState = createTaskState(latestUserInput);
      this.currentTaskState = activateNextSubgoal(this.currentTaskState)!;
      await appendDebugLog(debugLogPath, "task.created", {
        taskId: this.currentTaskState.taskId,
        taskSummary: this.currentTaskState.taskSummary,
        subgoals: this.currentTaskState.subgoals,
      });
      return;
    }

    if (this.currentTaskState.awaitingUserResponse) {
      this.currentTaskState = bindUserReplyToTaskState(this.currentTaskState, latestUserInput);
      this.currentTaskState = activateNextSubgoal(this.currentTaskState)!;
      await appendDebugLog(debugLogPath, "task.bound_followup", {
        taskId: this.currentTaskState.taskId,
        previousTaskId: priorTaskId,
        reply: latestUserInput,
        state: this.currentTaskState,
      });
      return;
    }

    this.currentTaskState = mergeUserInputIntoTaskState(this.currentTaskState, latestUserInput);
    this.currentTaskState = activateNextSubgoal(this.currentTaskState)!;
    if (hadOpenTask) {
      await appendDebugLog(debugLogPath, "task.updated", {
        taskId: this.currentTaskState.taskId,
        reason: "user_followup",
        state: this.currentTaskState,
      });
    }
  }

  private async completeTaskIfDone(debugLogPath: string) {
    if (!this.currentTaskState || hasPendingSubgoals(this.currentTaskState)) {
      return;
    }

    await appendDebugLog(debugLogPath, "task.completed", {
      taskId: this.currentTaskState.taskId,
      taskSummary: this.currentTaskState.taskSummary,
      subgoals: this.currentTaskState.subgoals,
    });
    this.currentTaskState = null;
  }

  private async handleToolResult(toolName: string, result: ToolResult<unknown>): Promise<string> {
    if (result.ok) {
      return formatToolResultMessage(toolName, result, this.config.toolResultVerbosity);
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

function findLatestUserInput(messages: ConversationMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}
