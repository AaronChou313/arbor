import type { ConversationNode } from "../../types/domain";

export function buildPath(
  currentNodeId: string | null,
  nodes: ConversationNode[],
): ConversationNode[] {
  if (!currentNodeId) return [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const path: ConversationNode[] = [];
  const visited = new Set<string>();
  let current = byId.get(currentNodeId);

  while (current) {
    if (visited.has(current.id)) throw new Error("Conversation tree contains a cycle.");
    visited.add(current.id);
    path.push(current);
    current = current.parentNodeId ? byId.get(current.parentNodeId) : undefined;
  }

  return path.reverse();
}
