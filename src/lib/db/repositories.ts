import type {
  Conversation,
  ConversationNode,
  Preferences,
  ProviderConfig,
} from "../../types/domain";
import { DEFAULT_PREFERENCES } from "../../types/domain";
import { getDatabase } from "./database";

export const conversationRepo = {
  async list(): Promise<Conversation[]> {
    const values = await (await getDatabase()).getAll("conversations");
    return values.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async get(id: string): Promise<Conversation | undefined> {
    return (await getDatabase()).get("conversations", id);
  },
  async put(value: Conversation): Promise<void> {
    await (await getDatabase()).put("conversations", value);
  },
  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    const tx = db.transaction(["conversations", "nodes"], "readwrite");
    const nodes = await tx.objectStore("nodes").index("by-conversation").getAll(id);
    await Promise.all(nodes.map((node) => tx.objectStore("nodes").delete(node.id)));
    await tx.objectStore("conversations").delete(id);
    await tx.done;
  },
};

export const nodeRepo = {
  async list(conversationId: string): Promise<ConversationNode[]> {
    return (await getDatabase()).getAllFromIndex("nodes", "by-conversation", conversationId);
  },
  async get(id: string): Promise<ConversationNode | undefined> {
    return (await getDatabase()).get("nodes", id);
  },
  async put(value: ConversationNode): Promise<void> {
    await (await getDatabase()).put("nodes", value);
  },
};

export const providerRepo = {
  async list(): Promise<ProviderConfig[]> {
    return (await (await getDatabase()).getAll("providers")).sort(
      (a, b) => a.createdAt - b.createdAt,
    );
  },
  async put(value: ProviderConfig): Promise<void> {
    await (await getDatabase()).put("providers", value);
  },
  async delete(id: string): Promise<void> {
    await (await getDatabase()).delete("providers", id);
  },
};

export const preferencesRepo = {
  async get(): Promise<Preferences> {
    const stored = await (await getDatabase()).get("preferences", "preferences");
    return { ...DEFAULT_PREFERENCES, ...stored, id: "preferences" };
  },
  async put(value: Preferences): Promise<void> {
    await (await getDatabase()).put("preferences", value);
  },
};
