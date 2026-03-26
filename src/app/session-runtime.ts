import { buildSystemPrompt } from "../agent/prompts.js";
import { formatToolResultMessage } from "../agent/tool-result-format.js";
import type { ConversationMessage, RuntimeContext, AgentDecision } from "../agent/types.js";
import {
  activateNextSubgoal,
  applyToolResultToTaskState,
  beginExecution,
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
  tryResolveBlockedReply,
  type TaskState,
} from "../agent/task-state.js";
import { estimateMessagesTokens } from "../agent/tokenizer.js";
import { compactConversation } from "../memory/context.js";
import { appendDebugLog } from "../memory/logs.js";
import type { WorkspaceFiles } from "../memory/workspace.js";
import type { LlmProvider } from "../llm/provider.js";
import type { ToolDefinition, ToolResult } from "../tools/types.js";
import {
  buildSelectedSkillDetails,
  selectRelevantSkills,
  type SkillManifest,
} from "../skills/manifests.js";
import type {
  AgentActionRequest,
  AppChoiceOption,
  AssistantTurnPayload,
  ConfirmationPrompt,
  PendingConfirmation,
  StoredSessionState,
} from "./session-types.js";
import type { AppConfig } from "../config/env.js";
import { summarizeArtifacts } from "./session-types.js";

type ToolRegistry = Map<string, ToolDefinition<any, unknown>>;

type RuntimeDeps = {
  config: AppConfig;
  provider: LlmProvider;
  tools: ToolRegistry;
  workspace: WorkspaceFiles;
  skillManifests: SkillManifest[];
  skillsCatalog: string;
  timezone: string;
};

type MutableSession = {
  messages: ConversationMessage[];
  taskState: TaskState | null;
  pendingConfirmation: PendingConfirmation | null;
};

export async function runAgentSessionTurn(
  deps: RuntimeDeps,
  storedSession: StoredSessionState,
  action: AgentActionRequest,
): Promise<{ session: StoredSessionState; response: AssistantTurnPayload }> {
  const session: MutableSession = {
    messages: [...storedSession.messages],
    taskState: storedSession.taskState,
    pendingConfirmation: storedSession.pendingConfirmation,
  };

  const debugBase = {
    sessionId: storedSession.sessionId,
    clientType: "mobile",
  };

  if (action.type === "confirm" || action.type === "cancel") {
    const result = await resolvePendingConfirmation(deps, session, action.type, debugBase);
    return {
      session: persistSession(storedSession, session),
      response: result,
    };
  }

  const userInput = action.type === "select_option" ? action.value : action.message;
  session.messages.push(createMessage("user", userInput));
  await appendDebugLog(deps.workspace.debugLogPath, "turn.user_input", {
    ...debugBase,
    content: userInput,
  });

  await updateTaskStateForLatestUserInput(session, userInput, deps.workspace.debugLogPath, debugBase);
  session.taskState = activateNextSubgoal(session.taskState);

  let finalReply = "I could not complete that request.";
  let runtimeSummary: string | undefined;

  for (let step = 0; step < 8; step += 1) {
    const compacted = await compactConversation({
      messages: session.messages,
      contextWindowLimit: deps.config.contextWindowLimit,
      compactionThreshold: deps.config.compactionThreshold,
      provider: deps.provider,
    });
    if (compacted.summary) {
      runtimeSummary = compacted.summary;
    }

    const latestUserInput = findLatestUserInput(session.messages);
    const selectedSkills = selectRelevantSkills(
      deps.skillManifests,
      buildTaskSkillSelectionInput(session.taskState, latestUserInput),
    );
    const systemPrompt = buildSystemPrompt({
      soul: deps.workspace.soul,
      user: deps.workspace.user,
      tools: [...deps.tools.values()].map((tool) => tool.promptShape),
      skillsCatalog: deps.skillsCatalog,
      selectedSkillDetails: buildSelectedSkillDetails(selectedSkills),
      taskStateSummary: summarizeTaskStateForPrompt(session.taskState),
      memory: deps.workspace.memory,
      runtime: buildRuntimeContext(deps.timezone, runtimeSummary),
      tokenUsage: {
        estimatedInputTokens: estimateMessagesTokens(compacted.messages),
        contextWindowLimit: deps.config.contextWindowLimit,
        maxOutputTokens: deps.config.maxOutputTokens,
        compactionThreshold: deps.config.compactionThreshold,
      },
    });

    const decision = await deps.provider.generateDecision({
      systemPrompt,
      messages: compacted.messages,
      tools: [...deps.tools.values()].map((tool) => tool.promptShape),
      maxOutputTokens: deps.config.maxOutputTokens,
    });
    await appendDebugLog(deps.workspace.debugLogPath, "llm.decision", {
      ...debugBase,
      type: decision.type,
      toolCalls:
        decision.type === "tool"
          ? decision.toolCalls.map((toolCall) => ({
              name: toolCall.name,
              arguments: toolCall.arguments,
            }))
          : undefined,
    });

    const outcome = await handleDecision(deps, session, decision, debugBase);
    finalReply = outcome.reply;

    if (outcome.response) {
      session.messages.push(createMessage("assistant", outcome.response.assistant.message));
      await appendDebugLog(deps.workspace.debugLogPath, "turn.assistant_reply", {
        ...debugBase,
        content: outcome.response.assistant.message,
      });
      return {
        session: persistSession(storedSession, session),
        response: outcome.response,
      };
    }

    if (!outcome.continueLoop) {
      break;
    }
  }

  if (hasPendingSubgoals(session.taskState)) {
    finalReply = buildIncompleteTaskMessage(session.taskState);
  }

  const response = buildTurnResponse(session, finalReply);
  session.messages.push(createMessage("assistant", response.assistant.message));
  await appendDebugLog(deps.workspace.debugLogPath, "turn.assistant_reply", {
    ...debugBase,
    content: response.assistant.message,
  });

  return {
    session: persistSession(storedSession, session),
    response,
  };
}

async function resolvePendingConfirmation(
  deps: RuntimeDeps,
  session: MutableSession,
  action: "confirm" | "cancel",
  debugBase: Record<string, unknown>,
) {
  if (!session.pendingConfirmation) {
    return buildTurnResponse(session, "There is no pending confirmation.");
  }

  const pending = session.pendingConfirmation;
  session.pendingConfirmation = null;

  if (action === "cancel") {
    const cancelled = `${pending.toolName} cancelled.`;
    session.taskState = applyToolResultToTaskState(
      session.taskState ?? createTaskState(findLatestUserInput(session.messages)),
      pending.toolName,
      null,
      "cancelled",
      cancelled,
    );
    await appendDebugLog(deps.workspace.debugLogPath, "tool.confirmation", {
      ...debugBase,
      name: pending.toolName,
      confirmed: false,
    });
    return buildTurnResponse(session, cancelled);
  }

  await appendDebugLog(deps.workspace.debugLogPath, "tool.confirmation", {
    ...debugBase,
    name: pending.toolName,
    confirmed: true,
  });
  const tool = deps.tools.get(pending.toolName);
  if (!tool) {
    const reply = `Tool ${pending.toolName} is not registered.`;
    session.taskState = applyToolResultToTaskState(
      session.taskState ?? createTaskState(findLatestUserInput(session.messages)),
      pending.toolName,
      null,
      "error",
      reply,
    );
    return buildTurnResponse(session, reply);
  }

  const result = await executeToolCall(deps, session, tool, pending.arguments, debugBase);
  if (result.response) {
    return result.response;
  }

  if (result.toolMessage) {
    session.messages.push(createMessage("tool", result.toolMessage, tool.name));
  }

  session.taskState = activateNextSubgoal(session.taskState);
  return buildTurnResponse(session, "Confirmed. Continuing the request.");
}

async function handleDecision(
  deps: RuntimeDeps,
  session: MutableSession,
  decision: AgentDecision,
  debugBase: Record<string, unknown>,
): Promise<{ reply: string; continueLoop: boolean; response?: AssistantTurnPayload }> {
  if (decision.type === "message") {
    session.taskState = completeResponseSubgoals(session.taskState, decision.message);
    if (hasPendingSubgoals(session.taskState)) {
      session.taskState = activateNextSubgoal(session.taskState);
      return { reply: decision.message, continueLoop: true };
    }
    session.taskState = null;
    return { reply: decision.message, continueLoop: false };
  }

  if (decision.type === "clarify") {
    const active = getActiveSubgoal(session.taskState);
    session.taskState = registerAwaitingUserResponse(
      session.taskState ?? createTaskState(findLatestUserInput(session.messages)),
      decision.message,
      "clarification",
      active?.id ?? "general-1",
    );
    return {
      reply: decision.message,
      continueLoop: false,
      response: buildTurnResponse(session, decision.message),
    };
  }

  if (decision.type === "stop") {
    if (hasPendingSubgoals(session.taskState)) {
      const reply = getAwaitingPrompt(session.taskState) ?? buildIncompleteTaskMessage(session.taskState);
      return {
        reply,
        continueLoop: false,
        response: buildTurnResponse(session, reply),
      };
    }

    session.taskState = null;
    const reply = decision.message.replace(/^<STOP>\s*/i, "").trim() || "Done.";
    return { reply, continueLoop: false };
  }

  session.taskState = beginExecution(
    activateNextSubgoal(session.taskState ?? createTaskState(findLatestUserInput(session.messages)))!,
    decision.toolCalls.map((toolCall) => toolCall.name),
  );

  for (const toolCall of decision.toolCalls) {
    const tool = deps.tools.get(toolCall.name);
    if (!tool) {
      const reply = `Tool ${toolCall.name} is not registered.`;
      session.messages.push(createMessage("tool", reply, toolCall.name));
      session.taskState = applyToolResultToTaskState(session.taskState, toolCall.name, null, "error", reply);
      continue;
    }

    const parsedInput = tool.inputSchema.safeParse(toolCall.arguments);
    if (!parsedInput.success) {
      const reply = `Invalid input for ${tool.name}: ${parsedInput.error.message}`;
      session.messages.push(createMessage("tool", reply, tool.name));
      session.taskState = applyToolResultToTaskState(session.taskState, tool.name, null, "error", reply);
      continue;
    }

    if (tool.protected) {
      session.pendingConfirmation = {
        toolName: tool.name,
        arguments: parsedInput.data,
      };
      return {
        reply: `I’m ready to ${tool.name.replace(/_/g, " ")} once you confirm.`,
        continueLoop: false,
        response: buildTurnResponse(
          session,
          `I’m ready to ${tool.name.replace(/_/g, " ")} once you confirm.`,
          buildConfirmationPrompt(tool.name, parsedInput.data),
        ),
      };
    }

    const result = await executeToolCall(deps, session, tool, parsedInput.data, debugBase);
    if (result.response) {
      return { reply: result.response.assistant.message, continueLoop: false, response: result.response };
    }
    if (result.toolMessage) {
      session.messages.push(createMessage("tool", result.toolMessage, tool.name));
    }
  }

  session.taskState = activateNextSubgoal(session.taskState);
  return { reply: "Working through the tool results.", continueLoop: true };
}

async function executeToolCall(
  deps: RuntimeDeps,
  session: MutableSession,
  tool: ToolDefinition<any, unknown>,
  input: Record<string, unknown>,
  debugBase: Record<string, unknown>,
) {
  await appendDebugLog(deps.workspace.debugLogPath, "tool.start", {
    ...debugBase,
    name: tool.name,
    arguments: input,
    protected: tool.protected,
  });

  try {
    const result = await tool.execute(input, { timezone: deps.timezone });
    await appendDebugLog(deps.workspace.debugLogPath, "tool.result", {
      ...debugBase,
      name: tool.name,
      result,
    });

    if (!result.ok && result.ambiguous) {
      const options = result.ambiguous.candidates.map((candidate, index) => ({
        id: String(index + 1),
        label: candidate.label,
        value: candidate.value,
      }));
      const active = getActiveSubgoal(session.taskState);
      session.taskState = registerAwaitingUserResponse(
        session.taskState ?? createTaskState(findLatestUserInput(session.messages)),
        result.ambiguous.prompt,
        "clarification",
        active?.id ?? "general-1",
        options.map((option) => ({
          value: option.value,
          labels: [option.id, option.label, option.value],
          summary: option.label,
        })),
      );
      return {
        response: buildTurnResponse(
          session,
          result.ambiguous.prompt,
          null,
          buildClarificationPrompt(result.ambiguous.prompt, options),
        ),
      };
    }

    session.taskState = applyToolResultToTaskState(
      session.taskState ?? createTaskState(findLatestUserInput(session.messages)),
      tool.name,
      result,
      result.ok ? "success" : "error",
      result.ok ? result.summary : result.error,
    );
    return {
      toolMessage: result.ok
        ? formatToolResultMessage(tool.name, result, deps.config.toolResultVerbosity)
        : `${tool.name}: ${result.error}`,
    };
  } catch (error) {
    const toolMessage = `${tool.name}: ${error instanceof Error ? error.message : "Unknown tool execution failure."}`;
    session.taskState = applyToolResultToTaskState(
      session.taskState ?? createTaskState(findLatestUserInput(session.messages)),
      tool.name,
      null,
      "error",
      toolMessage,
    );
    await appendDebugLog(deps.workspace.debugLogPath, "tool.error", {
      ...debugBase,
      name: tool.name,
      arguments: input,
      error: error instanceof Error ? error.message : String(error),
    });
    return { toolMessage };
  }
}

async function updateTaskStateForLatestUserInput(
  session: MutableSession,
  latestUserInput: string,
  debugLogPath: string,
  debugBase: Record<string, unknown>,
) {
  if (!session.taskState) {
    session.taskState = activateNextSubgoal(createTaskState(latestUserInput))!;
    await appendDebugLog(debugLogPath, "task.created", {
      ...debugBase,
      taskId: session.taskState.taskId,
      taskSummary: session.taskState.taskSummary,
    });
    return;
  }

  if (session.taskState.awaitingUserResponse) {
    const resolution = tryResolveBlockedReply(session.taskState, latestUserInput);
    if (resolution.matched) {
      session.taskState = activateNextSubgoal(resolution.taskState)!;
      await appendDebugLog(debugLogPath, "task.bound_followup", {
        ...debugBase,
        taskId: session.taskState.taskId,
        reply: latestUserInput,
        matchedValue: resolution.matchedValue,
      });
      return;
    }
  }

  if (shouldStartNewTask(session.taskState, latestUserInput)) {
    session.taskState = activateNextSubgoal(createTaskState(latestUserInput))!;
    await appendDebugLog(debugLogPath, "task.created", {
      ...debugBase,
      taskId: session.taskState.taskId,
      taskSummary: session.taskState.taskSummary,
    });
    return;
  }

  session.taskState = activateNextSubgoal(mergeUserInputIntoTaskState(session.taskState, latestUserInput))!;
  await appendDebugLog(debugLogPath, "task.updated", {
    ...debugBase,
    taskId: session.taskState.taskId,
    reason: "user_followup",
  });
}

function buildTurnResponse(
  session: MutableSession,
  reply: string,
  confirmation: ConfirmationPrompt | null = null,
  clarification = session.taskState?.awaitingUserResponse
    ? buildClarificationPrompt(
        session.taskState.awaitingUserResponse.prompt,
        (session.taskState.awaitingUserResponse.options ?? []).map((option, index) => ({
          id: String(index + 1),
          label: option.summary,
          value: option.value,
        })),
      )
    : null,
): AssistantTurnPayload {
  const active = getActiveSubgoal(session.taskState);
  return {
    assistant: { message: reply },
    taskState: {
      taskId: session.taskState?.taskId ?? "none",
      summary: session.taskState?.taskSummary ?? "No active task",
      status: session.taskState?.mode ?? "idle",
      activeSubgoal: active?.description,
      hasBlockedPrompt: Boolean(session.taskState?.awaitingUserResponse),
    },
    clarification,
    confirmation,
    artifacts: active ? summarizeArtifacts(active.artifacts) : [],
    session: {
      hasBlockedTask: Boolean(session.taskState?.awaitingUserResponse || session.pendingConfirmation),
    },
  };
}

function buildClarificationPrompt(prompt: string, options: AppChoiceOption[]) {
  return {
    type: options.length > 0 ? "choice" : "freeform",
    prompt,
    options,
  } as const;
}

function buildConfirmationPrompt(toolName: string, input: Record<string, unknown>): ConfirmationPrompt {
  return {
    type: "protected_action",
    prompt: `Confirm ${toolName.replace(/_/g, " ")}.`,
    actionLabel: "Confirm",
    cancelLabel: "Cancel",
    payloadPreview: {
      kind: toolName,
      title: asString(input.summary),
      summary: asString(input.summary),
      oldTime: undefined,
      newTime: asString(input.start),
      calendarId: asString(input.calendarId),
      subject: asString(input.subject),
      recipients: Array.isArray(input.to) ? input.to.map(String) : undefined,
      raw: input,
    },
  };
}

function persistSession(stored: StoredSessionState, session: MutableSession): StoredSessionState {
  return {
    ...stored,
    updatedAt: new Date().toISOString(),
    messages: session.messages,
    taskState: session.taskState,
    pendingConfirmation: session.pendingConfirmation,
  };
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

function createMessage(role: ConversationMessage["role"], content: string, name?: string): ConversationMessage {
  return {
    role,
    content,
    name,
    timestamp: new Date().toISOString(),
  };
}

function findLatestUserInput(messages: ConversationMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
