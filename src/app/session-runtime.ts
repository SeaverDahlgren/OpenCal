import { formatToolResultMessage } from "../agent/tool-result-format.js";
import type { ConversationMessage, AgentDecision } from "../agent/types.js";
import {
  activateNextSubgoal,
  applyToolResultToTaskState,
  beginExecution,
  buildIncompleteTaskMessage,
  completeResponseSubgoals,
  createTaskState,
  getActiveSubgoal,
  getAwaitingPrompt,
  hasPendingSubgoals,
  registerAwaitingUserResponse,
  type TaskState,
} from "../agent/task-state.js";
import { appendDebugLog } from "../memory/logs.js";
import type { LlmProvider } from "../llm/provider.js";
import type { ToolDefinition, ToolResult } from "../tools/types.js";
import { type SkillManifest } from "../skills/manifests.js";
import type {
  AgentActionRequest,
  AppChoiceOption,
  AssistantTurnPayload,
  ConfirmationPrompt,
  PendingConfirmation,
  PendingToolCall,
  StoredSessionState,
} from "./session-types.js";
import type { AppConfig } from "../config/env.js";
import { summarizeArtifacts } from "./session-types.js";
import { formatConfirmationTime, summarizeConfirmationAction } from "./confirmation-format.js";
import {
  advanceTaskStateForUserInput,
  buildDecisionContext,
  createConversationMessage,
  findLatestUserInput,
  type ToolRegistry,
} from "./turn-engine-shared.js";

type RuntimeDeps = {
  config: AppConfig;
  provider: LlmProvider;
  tools: ToolRegistry;
  debugLogPath: string;
  promptContext:
    | {
        kind: "workspace";
        workspace: import("../memory/workspace.js").WorkspaceFiles;
      }
    | {
        kind: "hosted";
        systemContext: string;
        memoryContext: string;
        profileContext?: string;
      };
  skillManifests: SkillManifest[];
  skillsCatalog: string;
  timezone: string;
};

type MutableSession = {
  messages: ConversationMessage[];
  taskState: TaskState | null;
  pendingConfirmation: PendingConfirmation | null;
};

type DecisionOutcome = {
  reply: string;
  continueLoop: boolean;
  response?: AssistantTurnPayload;
  persistAssistantMessage?: boolean;
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
    session.messages.push(createConversationMessage("assistant", result.assistant.message));
    await appendDebugLog(deps.debugLogPath, "turn.assistant_reply", {
      ...debugBase,
      content: result.assistant.message,
    });
    return {
      session: persistSession(storedSession, session),
      response: result,
    };
  }

  const userInput = action.type === "select_option" ? action.value : action.message;
  session.messages.push(createConversationMessage("user", userInput));
  await appendDebugLog(deps.debugLogPath, "turn.user_input", {
    ...debugBase,
    content: userInput,
  });

  await advanceTaskStateForUserInput({
    state: session,
    latestUserInput: userInput,
    log: async (event, payload) => {
      await appendDebugLog(deps.debugLogPath, event, {
        ...debugBase,
        ...payload,
      });
    },
  });
  session.taskState = activateNextSubgoal(session.taskState);

  let finalReply = "I could not complete that request.";
  let runtimeSummary: string | undefined;

  for (let step = 0; step < 8; step += 1) {
    const decisionContext = await buildDecisionContext(deps, session, runtimeSummary);
    runtimeSummary = decisionContext.runtimeSummary;

    const decision = await deps.provider.generateDecision({
      systemPrompt: decisionContext.systemPrompt,
      messages: decisionContext.compactedMessages,
      tools: [...deps.tools.values()].map((tool) => tool.promptShape),
      maxOutputTokens: deps.config.maxOutputTokens,
    });
    await appendDebugLog(deps.debugLogPath, "llm.decision", {
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
      if (outcome.persistAssistantMessage !== false) {
        session.messages.push(createConversationMessage("assistant", outcome.response.assistant.message));
        await appendDebugLog(deps.debugLogPath, "turn.assistant_reply", {
          ...debugBase,
          content: outcome.response.assistant.message,
        });
      }
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
  session.messages.push(createConversationMessage("assistant", response.assistant.message));
  await appendDebugLog(deps.debugLogPath, "turn.assistant_reply", {
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
  const actionSummary = summarizeConfirmationAction(pending.toolName, pending.arguments, deps.timezone);

  if (action === "cancel") {
    const cancelled = `Understood. I won't ${actionSummary}.`;
    session.taskState = applyToolResultToTaskState(
      session.taskState ?? createTaskState(findLatestUserInput(session.messages)),
      pending.toolName,
      null,
      "cancelled",
      cancelled,
    );
    await appendDebugLog(deps.debugLogPath, "tool.confirmation", {
      ...debugBase,
      name: pending.toolName,
      confirmed: false,
    });
    return buildTurnResponse(session, cancelled);
  }

  await appendDebugLog(deps.debugLogPath, "tool.confirmation", {
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
    result.response.assistant.message = `Confirmed. ${result.response.assistant.message}`;
    return result.response;
  }

  if (result.toolMessage) {
    session.messages.push(createConversationMessage("tool", result.toolMessage, tool.name));
  }

  const queuedOutcome = await continueQueuedToolCalls(
    deps,
    session,
    pending.queuedToolCalls ?? [],
    debugBase,
    `Confirmed. I'll ${actionSummary}.`,
  );
  if (queuedOutcome) {
    return queuedOutcome;
  }

  if (hasPendingSubgoals(session.taskState)) {
    session.taskState = activateNextSubgoal(session.taskState);
  } else {
    session.taskState = null;
  }
  return buildTurnResponse(session, `Confirmed. I'll ${actionSummary}.`);
}

async function handleDecision(
  deps: RuntimeDeps,
  session: MutableSession,
  decision: AgentDecision,
  debugBase: Record<string, unknown>,
): Promise<DecisionOutcome> {
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

  for (let index = 0; index < decision.toolCalls.length; index += 1) {
    const toolCall = decision.toolCalls[index];
    const tool = deps.tools.get(toolCall.name);
    if (!tool) {
      const reply = `Tool ${toolCall.name} is not registered.`;
      session.messages.push(createConversationMessage("tool", reply, toolCall.name));
      session.taskState = applyToolResultToTaskState(session.taskState, toolCall.name, null, "error", reply);
      continue;
    }

    const parsedInput = tool.inputSchema.safeParse(toolCall.arguments);
    if (!parsedInput.success) {
      const reply = `Invalid input for ${tool.name}: ${parsedInput.error.message}`;
      session.messages.push(createConversationMessage("tool", reply, tool.name));
      session.taskState = applyToolResultToTaskState(session.taskState, tool.name, null, "error", reply);
      continue;
    }

    if (tool.protected) {
      const confirmationInput = await enrichProtectedToolArguments(deps, tool.name, parsedInput.data);
      const queuedToolCalls = decision.toolCalls
        .slice(index + 1)
        .map((remainingToolCall) => ({
          toolName: remainingToolCall.name,
          arguments: remainingToolCall.arguments,
        }));
      session.pendingConfirmation = {
        toolName: tool.name,
        arguments: confirmationInput,
        queuedToolCalls,
      };
      const actionSummary = summarizeConfirmationAction(tool.name, confirmationInput, deps.timezone);
      return {
        reply: `Please confirm: should I ${actionSummary}?`,
        continueLoop: false,
        persistAssistantMessage: false,
        response: buildTurnResponse(
          session,
          `Please confirm: should I ${actionSummary}?`,
          buildConfirmationPrompt(tool.name, confirmationInput, deps.timezone, queuedToolCalls.length),
        ),
      };
    }

    const result = await executeToolCall(deps, session, tool, parsedInput.data, debugBase);
    if (result.response) {
      return { reply: result.response.assistant.message, continueLoop: false, response: result.response };
    }
    if (result.toolMessage) {
      session.messages.push(createConversationMessage("tool", result.toolMessage, tool.name));
    }
  }

  session.taskState = activateNextSubgoal(session.taskState);
  return { reply: "Working through the tool results.", continueLoop: true };
}

async function continueQueuedToolCalls(
  deps: RuntimeDeps,
  session: MutableSession,
  queuedToolCalls: PendingToolCall[],
  debugBase: Record<string, unknown>,
  confirmedReply: string,
) {
  const remainingToolCalls = [...queuedToolCalls];

  while (remainingToolCalls.length > 0) {
    const queuedToolCall = remainingToolCalls.shift()!;
    const tool = deps.tools.get(queuedToolCall.toolName);
    if (!tool) {
      const reply = `Tool ${queuedToolCall.toolName} is not registered.`;
      session.messages.push(createConversationMessage("tool", reply, queuedToolCall.toolName));
      session.taskState = applyToolResultToTaskState(
        session.taskState ?? createTaskState(findLatestUserInput(session.messages)),
        queuedToolCall.toolName,
        null,
        "error",
        reply,
      );
      continue;
    }

    const parsedInput = tool.inputSchema.safeParse(queuedToolCall.arguments);
    if (!parsedInput.success) {
      const reply = `Invalid input for ${tool.name}: ${parsedInput.error.message}`;
      session.messages.push(createConversationMessage("tool", reply, tool.name));
      session.taskState = applyToolResultToTaskState(
        session.taskState ?? createTaskState(findLatestUserInput(session.messages)),
        tool.name,
        null,
        "error",
        reply,
      );
      continue;
    }

    if (tool.protected) {
      const confirmationInput = await enrichProtectedToolArguments(deps, tool.name, parsedInput.data);
      session.pendingConfirmation = {
        toolName: tool.name,
        arguments: confirmationInput,
        queuedToolCalls: remainingToolCalls,
      };
      return buildTurnResponse(
        session,
        `${confirmedReply}\n\nPlease confirm: should I ${summarizeConfirmationAction(tool.name, confirmationInput, deps.timezone)}?`,
        buildConfirmationPrompt(tool.name, confirmationInput, deps.timezone, remainingToolCalls.length),
      );
    }

    const result = await executeToolCall(deps, session, tool, parsedInput.data, debugBase);
    if (result.response) {
      result.response.assistant.message = `${confirmedReply}\n\n${result.response.assistant.message}`;
      return result.response;
    }
    if (result.toolMessage) {
      session.messages.push(createConversationMessage("tool", result.toolMessage, tool.name));
    }
  }

  return null;
}

async function enrichProtectedToolArguments(
  deps: RuntimeDeps,
  toolName: string,
  input: Record<string, unknown>,
) {
  if (!["update_event", "delete_event"].includes(toolName)) {
    return input;
  }

  const eventId = asString(input.eventId);
  if (!eventId) {
    return input;
  }

  const needsLookup =
    !asString(input.summary) ||
    !asString(input.title) ||
    !asString(input.oldStart) ||
    !asString(input.oldEnd);
  if (!needsLookup) {
    return input;
  }

  const getEventTool = deps.tools.get("get_event");
  if (!getEventTool) {
    return input;
  }

  const calendarId = asString(input.calendarId) ?? "primary";
  const parsedLookup = getEventTool.inputSchema.safeParse({
    calendarId,
    eventId,
  });
  if (!parsedLookup.success) {
    return input;
  }

  try {
    const result = await getEventTool.execute(parsedLookup.data, { timezone: deps.timezone });
    if (!result.ok || typeof result.data !== "object" || !result.data) {
      return input;
    }
    const event = result.data as Record<string, unknown>;
    return {
      ...input,
      calendarId,
      summary: asString(input.summary) ?? asString(event.summary),
      title: asString(input.title) ?? asString(event.summary),
      oldStart: asString(input.oldStart) ?? asString(event.start),
      oldEnd: asString(input.oldEnd) ?? asString(event.end),
    };
  } catch {
    return input;
  }
}

async function executeToolCall(
  deps: RuntimeDeps,
  session: MutableSession,
  tool: ToolDefinition<any, unknown>,
  input: Record<string, unknown>,
  debugBase: Record<string, unknown>,
) {
  await appendDebugLog(deps.debugLogPath, "tool.start", {
    ...debugBase,
    name: tool.name,
    arguments: input,
    protected: tool.protected,
  });

  try {
    const result = await tool.execute(input, { timezone: deps.timezone });
    await appendDebugLog(deps.debugLogPath, "tool.result", {
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
    await appendDebugLog(deps.debugLogPath, "tool.error", {
      ...debugBase,
      name: tool.name,
      arguments: input,
      error: error instanceof Error ? error.message : String(error),
    });
    return { toolMessage };
  }
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

function buildConfirmationPrompt(
  toolName: string,
  input: Record<string, unknown>,
  timezone: string,
  remainingCount = 0,
): ConfirmationPrompt {
  const actionSummary = summarizeConfirmationAction(toolName, input, timezone);
  const queueSuffix = remainingCount > 0 ? ` ${remainingCount} more action${remainingCount === 1 ? "" : "s"} queued.` : "";
  return {
    type: "protected_action",
    prompt: `Please confirm: should I ${actionSummary}?${queueSuffix}`,
    actionLabel: "Confirm",
    cancelLabel: "Cancel",
    payloadPreview: {
      kind: toolName,
      title: asString(input.summary),
      summary: actionSummary,
      oldTime: formatConfirmationTime(input.oldStart ?? input.previousStart, timezone),
      newTime: formatConfirmationTime(input.start, timezone),
      calendarId: asString(input.calendarId),
      subject: asString(input.subject),
      recipients: Array.isArray(input.to) ? input.to.map(String) : undefined,
      body: asString(input.body),
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

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
