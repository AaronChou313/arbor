import { DEFAULT_PREFERENCES, type Conversation, type ConversationNode } from "../../types/domain";
import { clearDatabase } from "../db/database";
import { conversationRepo, nodeRepo, preferencesRepo, providerRepo } from "../db/repositories";
import { createId } from "../utils/id";
import { isBackupExport, isConversationExport } from "./schema";

export async function importConversationData(value: unknown): Promise<string> {
  if (!isConversationExport(value)) throw new Error("This is not a valid Arbor conversation export.");
  const conversationId = createId("conversation");
  const idMap = new Map(value.nodes.map((node) => [node.id, createId("node")]));
  const conversation: Conversation = {
    ...value.conversation,
    id: conversationId,
    rootNodeId: value.conversation.rootNodeId
      ? idMap.get(value.conversation.rootNodeId) ?? null
      : null,
    currentNodeId: value.conversation.currentNodeId
      ? idMap.get(value.conversation.currentNodeId) ?? null
      : null,
    updatedAt: Date.now(),
  };
  await conversationRepo.put(conversation);
  await Promise.all(
    value.nodes.map((node) => {
      const imported: ConversationNode = {
        ...node,
        id: idMap.get(node.id)!,
        conversationId,
        parentNodeId: node.parentNodeId ? idMap.get(node.parentNodeId) ?? null : null,
      };
      return nodeRepo.put(imported);
    }),
  );
  return conversationId;
}

export async function restoreBackup(value: unknown): Promise<void> {
  if (!isBackupExport(value)) throw new Error("This is not a valid Arbor backup.");
  await clearDatabase();
  await Promise.all(value.conversations.map((item) => conversationRepo.put(item)));
  await Promise.all(value.nodes.map((item) => nodeRepo.put(item)));
  await Promise.all(value.providers.map((item) => providerRepo.put(item)));
  await preferencesRepo.put({ ...DEFAULT_PREFERENCES, ...value.preferences, id: "preferences" });
}

export async function readJsonFile(file: File): Promise<unknown> {
  return JSON.parse(await file.text()) as unknown;
}
