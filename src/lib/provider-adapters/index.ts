import type { ProviderProtocol } from "../../types/domain";
import { anthropicAdapter } from "./anthropic";
import { chatCompletionsAdapter } from "./chatCompletions";
import { openAIResponsesAdapter } from "./openaiResponses";
import type { ProviderAdapter } from "./types";

const adapters: Record<ProviderProtocol, ProviderAdapter> = {
  anthropic: anthropicAdapter,
  "openai-responses": openAIResponsesAdapter,
  "chat-completions": chatCompletionsAdapter,
};

export function getProviderAdapter(protocol: ProviderProtocol): ProviderAdapter {
  return adapters[protocol];
}
