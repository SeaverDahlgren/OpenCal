import fs from "node:fs/promises";
import path from "node:path";
import type { ConversationMessage } from "../agent/types.js";
import { estimateMessagesTokens } from "../agent/tokenizer.js";
import type { LlmProvider } from "../llm/provider.js";

export async function compactConversation(args: {
  messages: ConversationMessage[];
  contextWindowLimit: number;
  compactionThreshold: number;
  provider: LlmProvider;
}): Promise<{ messages: ConversationMessage[]; summary?: string }> {
  const { messages, contextWindowLimit, compactionThreshold, provider } = args;
  const estimatedTokens = estimateMessagesTokens(messages);
  const threshold = Math.floor(contextWindowLimit * compactionThreshold);

  if (estimatedTokens < threshold || messages.length < 10) {
    return { messages };
  }

  const recent = messages.slice(-8);
  const older = messages.slice(0, -8);
  const summary = await provider.summarizeConversation(older);

  const summaryMessage: ConversationMessage = {
    role: "system",
    name: "compaction",
    content: `Compacted summary of earlier conversation:\n${summary}`,
    timestamp: new Date().toISOString(),
  };

  return { messages: [summaryMessage, ...recent], summary };
}

export async function updateToolsIndex(rootDir: string, toolMarkdown: string) {
  await fs.writeFile(path.join(rootDir, "TOOLS.md"), toolMarkdown, "utf8");
}
