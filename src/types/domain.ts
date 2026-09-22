export type ProviderProtocol =
  | "anthropic"
  | "openai-responses"
  | "chat-completions";

export type ProviderConfig = {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey?: string;
  rememberApiKey: boolean;
  model: string;
  maxOutputTokens?: number;
  createdAt: number;
  updatedAt: number;
};

export type AnswerSection = {
  id: string;
  title: string;
  content: string;
};

export type StructuredAnswer = {
  rawText?: string;
  intro?: string;
  sections: AnswerSection[];
  outro?: string;
  fallbackReason?: "unsectioned" | "protocol";
};

export type NodeStatus = "pending" | "streaming" | "done" | "truncated" | "error" | "aborted";

export type FinishReason =
  | "stop"
  | "length"
  | "content-filter"
  | "tool-call"
  | "error"
  | "unknown";

export type GenerationUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type TitleSource = "fallback" | "ai" | "manual";

export type ConversationNode = {
  id: string;
  conversationId: string;
  parentNodeId: string | null;
  anchorSectionId: string | null;
  anchorQuote?: string | null;
  anchorBlockId?: string | null;
  userMessage: string;
  title?: string;
  titleSource?: TitleSource;
  assistant: StructuredAnswer | null;
  providerSnapshot: { providerId: string; model: string };
  status: NodeStatus;
  error?: string;
  finishReason?: FinishReason;
  providerFinishReason?: string;
  usage?: GenerationUsage;
  createdAt: number;
};

export type Conversation = {
  id: string;
  title: string;
  titleSource?: TitleSource;
  rootNodeId: string | null;
  currentNodeId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type DetailLevel = "concise" | "balanced" | "detailed";
export type SectionDensity = "low" | "medium" | "high";
export type MathPreference = "auto" | "latex";
export type ThemePreference = "system" | "light" | "dark";
export type LanguagePreference = "auto" | "zh-CN" | "en-US";

export type Preferences = {
  id: "preferences";
  activeProviderId: string | null;
  detail: DetailLevel;
  sectionDensity: SectionDensity;
  math: MathPreference;
  userSystemPrompt: string;
  theme: ThemePreference;
  language: LanguagePreference;
};

export type CanonicalMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GenerateInput = {
  systemPrompt: string;
  messages: CanonicalMessage[];
  model: string;
  signal?: AbortSignal;
};

export type StreamEvent =
  | { type: "text-delta"; text: string }
  | ({ type: "usage" } & GenerationUsage)
  | { type: "done"; finishReason: FinishReason; providerReason?: string };

export type TestResult = {
  ok: boolean;
  stage: "network" | "cors" | "auth" | "model" | "unknown";
  message: string;
};

export const DEFAULT_PREFERENCES: Preferences = {
  id: "preferences",
  activeProviderId: null,
  detail: "balanced",
  sectionDensity: "medium",
  math: "auto",
  userSystemPrompt: "",
  theme: "system",
  language: "auto",
};
