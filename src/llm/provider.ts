import type { AgentDecision, ConversationMessage } from "../agent/types.js";
import type { ToolPromptShape } from "../tools/types.js";

export type ProviderRequest = {
  systemPrompt: string;
  messages: ConversationMessage[];
  tools: ToolPromptShape[];
  maxOutputTokens: number;
};

export interface LlmProvider {
  readonly name: string;
  generateDecision(request: ProviderRequest): Promise<AgentDecision>;
  summarizeConversation(messages: ConversationMessage[]): Promise<string>;
}
