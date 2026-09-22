import type {
  Conversation,
  ConversationNode,
  Preferences,
  ProviderConfig,
} from "../../types/domain";

export type ConversationExport = {
  schemaVersion: 1;
  conversation: Conversation;
  nodes: ConversationNode[];
};

export type BackupExport = {
  schemaVersion: 1;
  exportedAt: number;
  conversations: Conversation[];
  nodes: ConversationNode[];
  providers: ProviderConfig[];
  preferences: Preferences;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const isStringOrNull = (value: unknown): value is string | null =>
  typeof value === "string" || value === null;

function isConversation(value: unknown): value is Conversation {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    isStringOrNull(value.rootNodeId) &&
    isStringOrNull(value.currentNodeId) &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number"
  );
}

function isNode(value: unknown): value is ConversationNode {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.conversationId === "string" &&
    isStringOrNull(value.parentNodeId) &&
    isStringOrNull(value.anchorSectionId) &&
    (value.anchorQuote === undefined || isStringOrNull(value.anchorQuote)) &&
    (value.anchorBlockId === undefined || isStringOrNull(value.anchorBlockId)) &&
    typeof value.userMessage === "string" &&
    (value.assistant === null || isRecord(value.assistant)) &&
    isRecord(value.providerSnapshot) &&
    typeof value.providerSnapshot.providerId === "string" &&
    typeof value.providerSnapshot.model === "string" &&
    ["pending", "streaming", "done", "truncated", "error", "aborted"].includes(String(value.status)) &&
    typeof value.createdAt === "number"
  );
}

function isProvider(value: unknown): value is ProviderConfig {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    ["anthropic", "openai-responses", "chat-completions"].includes(String(value.protocol)) &&
    typeof value.baseUrl === "string" &&
    (value.apiKey === undefined || typeof value.apiKey === "string") &&
    typeof value.rememberApiKey === "boolean" &&
    typeof value.model === "string" &&
    (value.maxOutputTokens === undefined ||
      (typeof value.maxOutputTokens === "number" && Number.isInteger(value.maxOutputTokens) && value.maxOutputTokens > 0)) &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number"
  );
}

function isPreferences(value: unknown): value is Preferences {
  return (
    isRecord(value) &&
    (value.id === undefined || value.id === "preferences") &&
    isStringOrNull(value.activeProviderId) &&
    ["concise", "balanced", "detailed"].includes(String(value.detail)) &&
    ["low", "medium", "high"].includes(String(value.sectionDensity)) &&
    ["auto", "latex"].includes(String(value.math)) &&
    typeof value.userSystemPrompt === "string" &&
    ["system", "light", "dark"].includes(String(value.theme)) &&
    (value.language === undefined || ["auto", "zh-CN", "en-US"].includes(String(value.language)))
  );
}

export function isConversationExport(value: unknown): value is ConversationExport {
  if (!isRecord(value) || value.schemaVersion !== 1) return false;
  return isConversation(value.conversation) && Array.isArray(value.nodes) && value.nodes.every(isNode);
}

export function isBackupExport(value: unknown): value is BackupExport {
  if (!isRecord(value) || value.schemaVersion !== 1) return false;
  return (
    typeof value.exportedAt === "number" &&
    Array.isArray(value.conversations) && value.conversations.every(isConversation) &&
    Array.isArray(value.nodes) && value.nodes.every(isNode) &&
    Array.isArray(value.providers) && value.providers.every(isProvider) &&
    isPreferences(value.preferences)
  );
}
