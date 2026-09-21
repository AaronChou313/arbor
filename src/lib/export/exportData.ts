import type { ProviderConfig } from "../../types/domain";
import { conversationRepo, nodeRepo, preferencesRepo, providerRepo } from "../db/repositories";
import type { BackupExport, ConversationExport } from "./schema";

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportConversation(conversationId: string): Promise<void> {
  const conversation = await conversationRepo.get(conversationId);
  if (!conversation) throw new Error("Conversation not found.");
  const data: ConversationExport = {
    schemaVersion: 1,
    conversation,
    nodes: await nodeRepo.list(conversationId),
  };
  downloadJson(`arbor-${conversation.title.replace(/[^\p{L}\p{N}]+/gu, "-")}.json`, data);
}

function withoutKey(provider: ProviderConfig): ProviderConfig {
  const safe = { ...provider };
  delete safe.apiKey;
  return safe;
}

export async function exportBackup(includeKeys: boolean): Promise<void> {
  const conversations = await conversationRepo.list();
  const data: BackupExport = {
    schemaVersion: 1,
    exportedAt: Date.now(),
    conversations,
    nodes: (await Promise.all(conversations.map((item) => nodeRepo.list(item.id)))).flat(),
    providers: (await providerRepo.list()).map((item) => (includeKeys ? item : withoutKey(item))),
    preferences: await preferencesRepo.get(),
  };
  downloadJson(`arbor-backup-${new Date().toISOString().slice(0, 10)}.json`, data);
}
