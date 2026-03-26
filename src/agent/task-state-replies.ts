import type { AwaitingUserResponseOption, TaskArtifact, TaskSubgoal } from "./task-state-types.js";
import { asRecordArray, normalizeReply, stringField } from "./task-state-utils.js";

export function looksLikeFollowUpReply(value: string) {
  return /^(yes|y|ok|okay|sure|sounds good|that works|go ahead|do it|use the first one|use the second one|use the third one|perfect lets use this)\b/i.test(
    value,
  );
}

export function looksLikeContinuation(value: string) {
  return looksLikeFollowUpReply(value) || /^(also|and|plus|one more thing)\b/i.test(value);
}

export function resolveSlotSelection(active: TaskSubgoal, userInput: string, now: Date): TaskArtifact | null {
  const candidateArtifact = active.artifacts.find((artifact) => artifact.key === "candidate_slots");
  const slots = asRecordArray(candidateArtifact?.value);
  if (slots.length === 0) {
    return null;
  }

  const trimmed = userInput.trim();
  const index = Number(trimmed);
  if (Number.isInteger(index) && index >= 1 && index <= slots.length) {
    const slot = slots[index - 1]!;
    return buildSelectedSlotArtifact(slot, now);
  }

  const matched = slots.find((slot) => {
    const start = stringField(slot, "start");
    const end = stringField(slot, "end");
    return trimmed.includes(start) || trimmed.includes(end);
  });

  return matched ? buildSelectedSlotArtifact(matched, now) : null;
}

export function buildSlotPrompt(description: string, slots: Record<string, unknown>[]) {
  const lines = slots.slice(0, 5).map((slot, index) => {
    return `${index + 1}. ${stringField(slot, "start")} -> ${stringField(slot, "end")}`;
  });

  return [
    `I found multiple possible time slots for ${description}. Which one should I use?`,
    ...lines,
  ].join("\n");
}

export function buildSlotOptions(slots: Record<string, unknown>[]): AwaitingUserResponseOption[] {
  return slots.map((slot, index) => {
    const start = stringField(slot, "start");
    const end = stringField(slot, "end");
    const labels = buildSlotLabels(start, end);
    return {
      value: String(index + 1),
      labels: [...new Set([String(index + 1), `${index + 1}.`, ...labels])],
      summary: `${index + 1}. ${start} -> ${end}`,
    };
  });
}

export function resolveAwaitingOption(
  options: AwaitingUserResponseOption[],
  userInput: string,
): AwaitingUserResponseOption | null {
  const normalized = normalizeReply(userInput);
  if (!normalized) {
    return null;
  }

  const directIndex = Number(normalized);
  if (Number.isInteger(directIndex) && directIndex >= 1 && directIndex <= options.length) {
    return options[directIndex - 1] ?? null;
  }

  const ordinalMatch = normalized.match(/\b(first|second|third|fourth|fifth|option\s+1|option\s+2|option\s+3|option\s+4|option\s+5)\b/);
  if (ordinalMatch) {
    const ordinalIndex = ordinalToIndex(ordinalMatch[1] ?? "");
    if (ordinalIndex >= 0 && ordinalIndex < options.length) {
      return options[ordinalIndex] ?? null;
    }
  }

  for (const option of options) {
    if (
      option.labels.some((label) => {
        const normalizedLabel = normalizeReply(label);
        return normalized.includes(normalizedLabel) || normalizedLabel.includes(normalized);
      })
    ) {
      return option;
    }
  }

  return null;
}

function buildSelectedSlotArtifact(slot: Record<string, unknown>, now: Date): TaskArtifact {
  return {
    key: "selected_slot",
    type: "selected_slot",
    value: slot,
    summary: `Selected slot ${stringField(slot, "start")} -> ${stringField(slot, "end")}`,
    createdAt: now.toISOString(),
  };
}

function ordinalToIndex(value: string) {
  switch (value.replace(/\s+/g, " ").trim()) {
    case "first":
    case "option 1":
      return 0;
    case "second":
    case "option 2":
      return 1;
    case "third":
    case "option 3":
      return 2;
    case "fourth":
    case "option 4":
      return 3;
    case "fifth":
    case "option 5":
      return 4;
    default:
      return -1;
  }
}

function buildSlotLabels(start: string, end: string) {
  const labels = [start, end, `${start} -> ${end}`];
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) {
    return labels;
  }

  labels.push(startDate.toLocaleDateString("en-US", { weekday: "long" }));
  labels.push(
    `${startDate.toLocaleDateString("en-US", { weekday: "long" })} at ${startDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`,
  );
  labels.push(startDate.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }));
  labels.push(
    `${startDate.toLocaleDateString("en-US", { month: "numeric", day: "numeric" })} ${startDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`,
  );

  return labels;
}
