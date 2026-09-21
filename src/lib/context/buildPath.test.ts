import { describe, expect, it } from "vitest";
import type { ConversationNode } from "../../types/domain";
import { buildPath } from "./buildPath";

function node(id: string, parentNodeId: string | null): ConversationNode {
  return {
    id,
    conversationId: "conversation",
    parentNodeId,
    anchorSectionId: null,
    userMessage: id,
    assistant: null,
    providerSnapshot: { providerId: "provider", model: "model" },
    status: "done",
    createdAt: 1,
  };
}

describe("buildPath", () => {
  it("returns only the root-to-current branch", () => {
    const nodes = [node("root", null), node("left", "root"), node("right", "root"), node("leaf", "left")];
    expect(buildPath("leaf", nodes).map((item) => item.id)).toEqual(["root", "left", "leaf"]);
  });

  it("returns an empty path without a current node", () => {
    expect(buildPath(null, [node("root", null)])).toEqual([]);
  });

  it("rejects cycles", () => {
    expect(() => buildPath("a", [node("a", "b"), node("b", "a")])).toThrow(/cycle/i);
  });
});
