import type { TaskArtifact, TaskSubgoal } from "./task-state-types.js";
import { asRecord, asRecordArray, stringField } from "./task-state-utils.js";

export function buildArtifact(toolName: string, data: unknown, summary: string, now: Date): TaskArtifact {
  switch (toolName) {
    case "find_time_slots": {
      const slots = asRecordArray(data);
      return {
        key: "candidate_slots",
        type: "candidate_slots",
        value: slots,
        summary: `Found ${slots.length} candidate slots.`,
        createdAt: now.toISOString(),
      };
    }
    case "write_draft": {
      const draft = asRecord(data);
      return {
        key: "draft_result",
        type: "draft_result",
        value: draft,
        summary: `Draft created: ${stringField(draft, "subject")}`,
        createdAt: now.toISOString(),
      };
    }
    case "create_event":
    case "update_event": {
      const event = asRecord(data);
      return {
        key: "event_result",
        type: "event_result",
        value: event,
        summary: `${toolName === "create_event" ? "Created" : "Updated"} event ${stringField(event, "summary") || stringField(event, "id")}`,
        createdAt: now.toISOString(),
      };
    }
    default:
      return {
        key: `tool:${toolName}`,
        type: "tool_result",
        value: data,
        summary,
        createdAt: now.toISOString(),
      };
  }
}

export function completesSubgoal(toolName: string, subgoal: TaskSubgoal) {
  if (subgoal.kind === "email") {
    return toolName === "write_draft";
  }

  if (subgoal.kind === "calendar") {
    return ["create_event", "update_event", "delete_event"].includes(toolName);
  }

  return subgoal.completionMode === "response";
}
