import { describe, expect, it } from "vitest";
import {
  applyToolOutcome,
  bindUserReplyToTaskState,
  buildIncompleteTaskMessage,
  buildTaskSkillSelectionInput,
  completeResponseSubgoals,
  createTaskState,
  hasPendingSubgoals,
  registerAwaitingUserResponse,
  shouldStartNewTask,
  summarizeTaskStateForPrompt,
} from "../src/agent/task-state.js";

describe("task state", () => {
  it("creates separate pending subgoals for multi-intent scheduling requests", () => {
    const taskState = createTaskState(
      "I have three meetings I need to schedule with Joe, Dan, and Sally. Write me an email draft I can share with each of them.",
    );

    expect(taskState.subgoals.map((subgoal) => subgoal.description)).toEqual([
      "Schedule meeting with Joe",
      "Schedule meeting with Dan",
      "Schedule meeting with Sally",
      "Draft a shareable email",
    ]);
    expect(taskState.subgoals.filter((subgoal) => subgoal.status === "pending")).toHaveLength(4);
  });

  it("binds terse follow-up replies to an awaiting task instead of starting a new one", () => {
    const taskState = registerAwaitingUserResponse(
      createTaskState("Schedule a meeting with Joe and draft the follow-up email."),
      "Which slot should I use?",
      "clarification",
      ["calendar-1", "email-1"],
    );

    expect(shouldStartNewTask(taskState, "yes")).toBe(false);

    const bound = bindUserReplyToTaskState(taskState, "yes");
    expect(bound.awaitingUserResponse).toBeUndefined();
    expect(bound.taskSummary).toContain("Schedule a meeting with Joe");
  });

  it("treats unrelated asks as a new task", () => {
    const taskState = createTaskState("Reschedule my meeting with Joe.");

    expect(shouldStartNewTask(taskState, "What emails did Sarah send me yesterday?")).toBe(true);
  });

  it("keeps tool-backed work pending until the matching tool completes", () => {
    let taskState = createTaskState(
      "Schedule meetings with Joe, Dan, and Sally, then write me an email draft I can share with each of them.",
    );

    taskState = applyToolOutcome(taskState, "create_event", "success", "Joe scheduled");
    taskState = applyToolOutcome(taskState, "create_event", "success", "Dan scheduled");
    taskState = applyToolOutcome(taskState, "create_event", "success", "Sally scheduled");

    expect(taskState.subgoals.filter((subgoal) => subgoal.status === "completed")).toHaveLength(3);
    expect(hasPendingSubgoals(taskState)).toBe(true);
    expect(buildIncompleteTaskMessage(taskState)).toContain("Draft a shareable email");

    taskState = applyToolOutcome(taskState, "write_draft", "success", "Draft created");
    expect(hasPendingSubgoals(taskState)).toBe(false);
  });

  it("allows response-only work to finalize without a protected tool", () => {
    let taskState = createTaskState("How many times am I swimming next month?");

    expect(hasPendingSubgoals(taskState)).toBe(false);

    taskState = completeResponseSubgoals(taskState, "You are swimming four times next month.")!;
    expect(taskState.subgoals[0]?.status).toBe("completed");
  });

  it("builds prompt-ready task summaries and skill-selection input", () => {
    const taskState = createTaskState(
      "Schedule meetings with Joe, Dan, and Sally, then write me an email draft I can share with each of them.",
    );

    const promptSummary = summarizeTaskStateForPrompt(taskState);
    const skillInput = buildTaskSkillSelectionInput(taskState, "yes");

    expect(promptSummary).toContain("pending_subgoals:");
    expect(promptSummary).toContain("Draft a shareable email");
    expect(skillInput).toContain("Schedule meetings with Joe, Dan, and Sally");
    expect(skillInput).toContain("Draft a shareable email");
  });
});
