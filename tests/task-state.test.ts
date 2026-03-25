import { describe, expect, it } from "vitest";
import {
  activateNextSubgoal,
  applyToolResultToTaskState,
  bindUserReplyToTaskState,
  buildIncompleteTaskMessage,
  buildTaskSkillSelectionInput,
  completeResponseSubgoals,
  createTaskState,
  getActiveSubgoal,
  hasPendingSubgoals,
  isBlocked,
  registerAwaitingUserResponse,
  shouldStartNewTask,
  summarizeTaskStateForPrompt,
} from "../src/agent/task-state.js";

describe("task state", () => {
  it("activates only one subgoal at a time", () => {
    const taskState = activateNextSubgoal(
      createTaskState(
        "I have three meetings I need to schedule with Joe, Dan, and Sally. Write me an email draft I can share with each of them.",
      ),
    )!;

    expect(taskState.subgoals.map((subgoal) => subgoal.description)).toEqual([
      "Schedule meeting with Joe",
      "Schedule meeting with Dan",
      "Schedule meeting with Sally",
      "Draft a shareable email",
    ]);
    expect(taskState.subgoals.filter((subgoal) => subgoal.status === "active")).toHaveLength(1);
    expect(getActiveSubgoal(taskState)?.description).toBe("Schedule meeting with Joe");
  });

  it("binds terse follow-up replies to the blocked active subgoal", () => {
    const taskState = registerAwaitingUserResponse(
      activateNextSubgoal(createTaskState("Schedule a meeting with Joe and draft the follow-up email."))!,
      "Which slot should I use?",
      "clarification",
      "calendar-1",
    );

    expect(shouldStartNewTask(taskState, "yes")).toBe(false);

    const bound = bindUserReplyToTaskState(taskState, "yes");
    expect(bound.awaitingUserResponse).toBeUndefined();
    expect(getActiveSubgoal(bound)?.artifacts.at(-1)?.type).toBe("clarification_answer");
  });

  it("treats unrelated asks as a new task", () => {
    const taskState = activateNextSubgoal(createTaskState("Reschedule my meeting with Joe."));
    expect(shouldStartNewTask(taskState, "What emails did Sarah send me yesterday?")).toBe(true);
  });

  it("stores candidate slots as artifacts and blocks for slot choice", () => {
    let taskState = activateNextSubgoal(createTaskState("Schedule a meeting with Joe next week."))!;

    taskState = applyToolResultToTaskState(
      taskState,
      "find_time_slots",
      {
        ok: true,
        summary: "Found 2 free time slots.",
        data: [
          {
            start: "2026-03-30T13:00:00-07:00",
            end: "2026-03-30T13:30:00-07:00",
          },
          {
            start: "2026-03-30T15:00:00-07:00",
            end: "2026-03-30T15:30:00-07:00",
          },
        ],
      },
      "success",
      "Found 2 free time slots.",
    );

    expect(isBlocked(taskState)).toBe(true);
    expect(getActiveSubgoal(taskState)?.artifacts[0]?.key).toBe("candidate_slots");
    expect(buildIncompleteTaskMessage(taskState)).toContain("Which one should I use?");

    const rebound = bindUserReplyToTaskState(taskState, "2");
    expect(rebound.awaitingUserResponse).toBeUndefined();
    expect(getActiveSubgoal(rebound)?.artifacts.some((artifact) => artifact.key === "selected_slot")).toBe(true);
  });

  it("completes only the active subgoal when a completion tool succeeds", () => {
    let taskState = activateNextSubgoal(
      createTaskState(
        "Schedule meetings with Joe, Dan, and Sally, then write me an email draft I can share with each of them.",
      ),
    )!;

    taskState = applyToolResultToTaskState(
      taskState,
      "create_event",
      {
        ok: true,
        summary: "Created event Chat with Joe.",
        data: {
          id: "event-1",
          summary: "Chat with Joe",
          start: "2026-03-30T13:00:00-07:00",
          end: "2026-03-30T13:30:00-07:00",
        },
      },
      "success",
      "Created event Chat with Joe.",
    );

    expect(taskState.subgoals.filter((subgoal) => subgoal.status === "completed")).toHaveLength(1);
    expect(taskState.subgoals.filter((subgoal) => subgoal.status === "active")).toHaveLength(0);
    expect(hasPendingSubgoals(taskState)).toBe(true);

    taskState = activateNextSubgoal(taskState)!;
    expect(getActiveSubgoal(taskState)?.description).toBe("Schedule meeting with Dan");
  });

  it("allows response-only work to finalize without a tool", () => {
    let taskState = activateNextSubgoal(createTaskState("How many times am I swimming next month?"));

    taskState = completeResponseSubgoals(taskState, "You are swimming four times next month.")!;
    expect(hasPendingSubgoals(taskState)).toBe(false);
    expect(taskState.subgoals[0]?.status).toBe("completed");
  });

  it("builds prompt-ready summaries around the active subgoal and artifacts", () => {
    let taskState = activateNextSubgoal(
      createTaskState(
        "Schedule meetings with Joe, Dan, and Sally, then write me an email draft I can share with each of them.",
      ),
    )!;
    taskState = applyToolResultToTaskState(
      taskState,
      "find_time_slots",
      {
        ok: true,
        summary: "Found 1 free time slot.",
        data: [
          {
            start: "2026-03-30T13:00:00-07:00",
            end: "2026-03-30T13:30:00-07:00",
          },
        ],
      },
      "success",
      "Found 1 free time slot.",
    );

    const promptSummary = summarizeTaskStateForPrompt(taskState);
    const skillInput = buildTaskSkillSelectionInput(taskState, "yes");

    expect(promptSummary).toContain("active_subgoal: Schedule meeting with Joe");
    expect(promptSummary).toContain("Found 1 candidate slots.");
    expect(skillInput).toContain("Schedule meeting with Joe");
    expect(skillInput).toContain("Found 1 candidate slots.");
  });
});
