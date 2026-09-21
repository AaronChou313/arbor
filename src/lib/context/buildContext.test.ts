import { describe, expect, it } from "vitest";
import type { ConversationNode } from "../../types/domain";
import { buildContext } from "./buildContext";

const root: ConversationNode = {
  id: "root",
  conversationId: "conversation",
  parentNodeId: null,
  anchorSectionId: null,
  userMessage: "Compare methods",
  assistant: {
    intro: "Overview",
    sections: [
      { id: "ols", title: "OLS", content: "Ordinary least squares" },
      { id: "tls", title: "TLS", content: "Total least squares" },
    ],
    outro: "Choose carefully",
  },
  providerSnapshot: { providerId: "provider", model: "model" },
  status: "done",
  createdAt: 1,
};

describe("buildContext", () => {
  it("includes a complete answer for an unanchored continuation", () => {
    const child = { ...root, id: "child", parentNodeId: "root", userMessage: "How do I choose?", assistant: null };
    const messages = buildContext([root, child]);
    expect(messages[1].content).toContain("Ordinary least squares");
    expect(messages[1].content).toContain("Total least squares");
  });

  it("crops the parent answer to the selected anchor", () => {
    const child = { ...root, id: "child", parentNodeId: "root", anchorSectionId: "tls", userMessage: "How is TLS solved?", assistant: null };
    const messages = buildContext([root, child]);
    expect(messages[1].content).toContain("Overview");
    expect(messages[1].content).toContain("Total least squares");
    expect(messages[1].content).not.toContain("Ordinary least squares");
  });

  it("does not append an empty assistant turn for the node being generated", () => {
    const pending = {
      ...root,
      id: "pending",
      assistant: { rawText: "", sections: [] },
      status: "streaming" as const,
    };
    expect(buildContext([pending])).toEqual([{ role: "user", content: "Compare methods" }]);
  });
});
