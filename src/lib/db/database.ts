import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  Conversation,
  ConversationNode,
  Preferences,
  ProviderConfig,
} from "../../types/domain";

interface ArborDB extends DBSchema {
  conversations: {
    key: string;
    value: Conversation;
    indexes: { "by-updatedAt": number };
  };
  nodes: {
    key: string;
    value: ConversationNode;
    indexes: { "by-conversation": string; "by-parent": string };
  };
  providers: { key: string; value: ProviderConfig };
  preferences: { key: "preferences"; value: Preferences };
}

let databasePromise: Promise<IDBPDatabase<ArborDB>> | undefined;

export function getDatabase(): Promise<IDBPDatabase<ArborDB>> {
  databasePromise ??= openDB<ArborDB>("arbor", 1, {
    upgrade(db) {
      const conversations = db.createObjectStore("conversations", { keyPath: "id" });
      conversations.createIndex("by-updatedAt", "updatedAt");
      const nodes = db.createObjectStore("nodes", { keyPath: "id" });
      nodes.createIndex("by-conversation", "conversationId");
      nodes.createIndex("by-parent", "parentNodeId");
      db.createObjectStore("providers", { keyPath: "id" });
      db.createObjectStore("preferences", { keyPath: "id" });
    },
  });
  return databasePromise;
}

export async function clearDatabase(): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction(
    ["conversations", "nodes", "providers", "preferences"],
    "readwrite",
  );
  await Promise.all([
    tx.objectStore("conversations").clear(),
    tx.objectStore("nodes").clear(),
    tx.objectStore("providers").clear(),
    tx.objectStore("preferences").clear(),
  ]);
  await tx.done;
}
