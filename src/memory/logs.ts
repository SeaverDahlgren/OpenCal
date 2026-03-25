import fs from "node:fs/promises";
import type { ConversationMessage } from "../agent/types.js";

export async function appendLogEntry(logPath: string, message: ConversationMessage) {
  const line = `- [${message.timestamp}] ${message.role}${message.name ? `:${message.name}` : ""}: ${message.content}\n`;
  await fs.appendFile(logPath, line, "utf8");
}

export async function appendDebugLog(
  logPath: string,
  event: string,
  payload: Record<string, unknown> = {},
) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ...payload,
  });
  await fs.appendFile(logPath, `${line}\n`, "utf8");
}

export async function appendMemory(memoryPath: string, content: string) {
  if (!content.trim()) {
    return;
  }

  const block = [``, `## ${new Date().toISOString()}`, content.trim(), ``].join("\n");
  await fs.appendFile(memoryPath, block, "utf8");
}
