import type { TaskSubgoal, TaskSubgoalKind } from "./task-state-types.js";
import { looksLikeFollowUpReply } from "./task-state-replies.js";
import { normalizeText } from "./task-state-utils.js";

export function inferSubgoals(userInput: string): TaskSubgoal[] {
  const normalized = normalizeText(userInput);
  const subgoals: TaskSubgoal[] = [];
  const people = extractPeopleList(userInput);
  const wantsCalendar = /\b(meeting|meetings|schedule|resched|calendar|event|slot|availability|free busy|find time)\b/i.test(
    normalized,
  );
  const wantsEmail = /\b(email|draft|message|reply|share)\b/i.test(normalized);

  if (wantsCalendar && people.length > 0) {
    people.forEach((person, index) => {
      subgoals.push(createSubgoal(`calendar-${index + 1}`, `Schedule meeting with ${person}`, "calendar", "tool"));
    });
  } else if (wantsCalendar) {
    const completionMode = requiresCalendarMutation(normalized) ? "tool" : "response";
    subgoals.push(
      createSubgoal("calendar-1", "Complete the calendar scheduling request", "calendar", completionMode),
    );
  }

  if (wantsEmail) {
    const description = /\bshare\b/i.test(normalized) ? "Draft a shareable email" : "Draft the requested email";
    subgoals.push(createSubgoal("email-1", description, "email", "tool"));
  }

  if (subgoals.length === 0) {
    subgoals.push(createSubgoal("general-1", "Complete the current request", "general", "response"));
  }

  return subgoals;
}

export function summarizeTask(currentSummary: string, userInput: string) {
  const normalizedCurrent = normalizeText(currentSummary);
  const normalizedInput = normalizeText(userInput);
  if (!normalizedInput || normalizedCurrent.includes(normalizedInput)) {
    return currentSummary;
  }

  if (looksLikeFollowUpReply(normalizedInput)) {
    return currentSummary;
  }

  return `${currentSummary} Follow-up: ${userInput.trim()}`;
}

function createSubgoal(
  id: string,
  description: string,
  kind: TaskSubgoalKind,
  completionMode: "tool" | "response",
): TaskSubgoal {
  return {
    id,
    description,
    status: "pending",
    kind,
    completionMode,
    relatedTools: [],
    artifacts: [],
  };
}

function extractPeopleList(userInput: string) {
  const withMatch = userInput.match(/\bwith\s+([^.!?\n]+)/i);
  if (!withMatch) {
    return [];
  }

  const candidateBlock = withMatch[1].split(/\bthen\b|\bso\b|\bbecause\b/i)[0] ?? withMatch[1];
  return candidateBlock
    .split(/,|\band\b/gi)
    .map((value) => value.trim())
    .map((value) => value.replace(/^(the|a)\s+/i, ""))
    .filter((value) => /^[A-Za-z][A-Za-z .'-]*$/.test(value));
}

function requiresCalendarMutation(normalizedUserInput: string) {
  return /\b(schedule|resched|reschedule|move|book|create|delete|cancel)\b/i.test(normalizedUserInput);
}
