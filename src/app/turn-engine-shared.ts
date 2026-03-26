import { buildSystemPrompt } from "../agent/prompts.js";
import { estimateMessagesTokens } from "../agent/tokenizer.js";
import type { AgentDecision, ConversationMessage, RuntimeContext } from "../agent/types.js";
import {
  activateNextSubgoal,
  createTaskState,
  hasPendingSubgoals,
  mergeUserInputIntoTaskState,
  shouldStartNewTask,
  summarizeTaskStateForPrompt,
  tryResolveBlockedReply,
  type TaskState,
  buildTaskSkillSelectionInput,
} from "../agent/task-state.js";
import { compactConversation } from "../memory/context.js";
import type { WorkspaceFiles } from "../memory/workspace.js";
import type { AppConfig } from "../config/env.js";
import type { LlmProvider } from "../llm/provider.js";
import type { ToolDefinition } from "../tools/types.js";
import {
  buildSelectedSkillDetails,
  selectRelevantSkills,
  type SkillManifest,
} from "../skills/manifests.js";

export type ToolRegistry = Map<string, ToolDefinition<any, unknown>>;

export type SharedTurnDeps = {
  config: AppConfig;
  provider: LlmProvider;
  tools: ToolRegistry;
  workspace: WorkspaceFiles;
  skillManifests: SkillManifest[];
  skillsCatalog: string;
  timezone: string;
};

export type TurnMutableState = {
  messages: ConversationMessage[];
  taskState: TaskState | null;
};

export async function buildDecisionContext(
  deps: SharedTurnDeps,
  state: TurnMutableState,
  runtimeSummary?: string,
) {
  const compacted = await compactConversation({
    messages: state.messages,
    contextWindowLimit: deps.config.contextWindowLimit,
    compactionThreshold: deps.config.compactionThreshold,
    provider: deps.provider,
  });

  const latestUserInput = findLatestUserInput(state.messages);
  const skillSelectionInput = buildTaskSkillSelectionInput(state.taskState, latestUserInput);
  const selectedSkills = selectRelevantSkills(deps.skillManifests, skillSelectionInput);
  const runtime = buildRuntimeContext(deps.timezone, compacted.summary ?? runtimeSummary);

  const systemPrompt = buildSystemPrompt({
    soul: deps.workspace.soul,
    user: deps.workspace.user,
    tools: [...deps.tools.values()].map((tool) => tool.promptShape),
    skillsCatalog: deps.skillsCatalog,
    selectedSkillDetails: buildSelectedSkillDetails(selectedSkills),
    taskStateSummary: summarizeTaskStateForPrompt(state.taskState),
    memory: deps.workspace.memory,
    runtime,
    tokenUsage: {
      estimatedInputTokens: estimateMessagesTokens(compacted.messages),
      contextWindowLimit: deps.config.contextWindowLimit,
      maxOutputTokens: deps.config.maxOutputTokens,
      compactionThreshold: deps.config.compactionThreshold,
    },
  });

  return {
    compactedMessages: compacted.messages,
    runtimeSummary: compacted.summary ?? runtimeSummary,
    latestUserInput,
    skillSelectionInput,
    selectedSkills,
    systemPrompt,
  };
}

export async function advanceTaskStateForUserInput(args: {
  state: TurnMutableState;
  latestUserInput: string;
  log: (event: string, payload: Record<string, unknown>) => Promise<void>;
}) {
  const { state, latestUserInput, log } = args;
  if (!latestUserInput) {
    return;
  }

  const priorTaskId = state.taskState?.taskId;
  const blockedTaskId = state.taskState?.taskId;
  const blockedTaskSummary = state.taskState?.taskSummary;

  if (!state.taskState) {
    state.taskState = activateNextSubgoal(createTaskState(latestUserInput))!;
    await log("task.created", {
      taskId: state.taskState.taskId,
      taskSummary: state.taskState.taskSummary,
      subgoals: state.taskState.subgoals,
    });
    return;
  }

  if (state.taskState.awaitingUserResponse) {
    const resolution = tryResolveBlockedReply(state.taskState, latestUserInput);
    if (resolution.matched) {
      state.taskState = activateNextSubgoal(resolution.taskState)!;
      await log("task.bound_followup", {
        taskId: state.taskState.taskId,
        previousTaskId: priorTaskId,
        reply: latestUserInput,
        matchedValue: resolution.matchedValue,
        state: state.taskState,
      });
      return;
    }

    await log("task.updated", {
      taskId: blockedTaskId,
      reason: "blocked_reply_unmatched",
      reply: latestUserInput,
      state: state.taskState,
    });

    state.taskState = activateNextSubgoal(createTaskState(latestUserInput))!;
    await log("task.replaced", {
      previousTaskId: blockedTaskId,
      previousTaskSummary: blockedTaskSummary,
      newInput: latestUserInput,
    });
    await log("task.created", {
      taskId: state.taskState.taskId,
      taskSummary: state.taskState.taskSummary,
      subgoals: state.taskState.subgoals,
    });
    return;
  }

  if (shouldStartNewTask(state.taskState, latestUserInput)) {
    await log("task.replaced", {
      previousTaskId: state.taskState.taskId,
      previousTaskSummary: state.taskState.taskSummary,
      newInput: latestUserInput,
    });
    state.taskState = activateNextSubgoal(createTaskState(latestUserInput))!;
    await log("task.created", {
      taskId: state.taskState.taskId,
      taskSummary: state.taskState.taskSummary,
      subgoals: state.taskState.subgoals,
    });
    return;
  }

  state.taskState = activateNextSubgoal(mergeUserInputIntoTaskState(state.taskState, latestUserInput))!;
  await log("task.updated", {
    taskId: state.taskState.taskId,
    reason: "user_followup",
    state: state.taskState,
  });
}

export async function clearCompletedTask(
  state: TurnMutableState,
  log: (event: string, payload: Record<string, unknown>) => Promise<void>,
) {
  if (!state.taskState || hasPendingSubgoals(state.taskState)) {
    return;
  }

  await log("task.completed", {
    taskId: state.taskState.taskId,
    taskSummary: state.taskState.taskSummary,
    subgoals: state.taskState.subgoals,
  });
  state.taskState = null;
}

export function buildRuntimeContext(timezone: string, compactedSummary?: string): RuntimeContext {
  const now = new Date();
  return {
    nowIso: now.toISOString(),
    dayOfWeek: now.toLocaleDateString("en-US", { weekday: "long", timeZone: timezone }),
    timezone,
    compactedSummary,
  };
}

export function createConversationMessage(
  role: ConversationMessage["role"],
  content: string,
  name?: string,
): ConversationMessage {
  return {
    role,
    content,
    name,
    timestamp: new Date().toISOString(),
  };
}

export function findLatestUserInput(messages: ConversationMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}
