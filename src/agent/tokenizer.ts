import type { ConversationMessage } from "./types.js";

export function estimateTextTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(messages: ConversationMessage[]): number {
  return messages.reduce((total, message) => total + estimateTextTokens(message.content), 0);
}
