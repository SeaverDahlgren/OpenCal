import crypto from "node:crypto";
import type { MemoryRepository } from "../storage/types.js";
import type { UserProfile } from "../users/profile.js";
import type { ProductionMemoryRecord } from "./types.js";

const PROFILE_SOURCE = "profile_snapshot";

export function buildHostedMemoryContext(records: ProductionMemoryRecord[]) {
  if (records.length === 0) {
    return "none";
  }

  return records
    .slice(0, 6)
    .map((record) => [`- summary: ${record.summary}`, `  content: ${record.content}`].join("\n"))
    .join("\n");
}

export async function syncProfileMemory(
  memories: MemoryRepository,
  profile: UserProfile,
  now = new Date().toISOString(),
) {
  const existing = await memories.loadBySource(profile.email, PROFILE_SOURCE);
  const content = buildProfileMemoryContent(profile);
  if (existing?.content === content && existing.updatedAt >= profile.updatedAt) {
    return existing;
  }
  const record: ProductionMemoryRecord = {
    memoryId: existing?.memoryId ?? `mem_${crypto.randomUUID()}`,
    email: profile.email,
    kind: "profile_snapshot",
    summary: "Durable user profile context",
    content,
    source: PROFILE_SOURCE,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await memories.save(record);
  return record;
}

function buildProfileMemoryContent(profile: UserProfile) {
  return [
    `user_name: ${profile.name}`,
    `work_hours: ${profile.workStart}-${profile.workEnd}`,
    `meeting_preference: ${profile.meetingPreference || "none"}`,
    `current_interests: ${profile.interests || "none"}`,
    `additional_context: ${profile.additionalContext || "none"}`,
    `assistant_notes: ${profile.assistantNotes || "none"}`,
  ].join("\n");
}
