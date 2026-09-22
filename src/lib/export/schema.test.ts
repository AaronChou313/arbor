import { describe, expect, it } from "vitest";
import { isBackupExport, isConversationExport } from "./schema";

describe("import schema validation", () => {
  const conversation = {
    id: "c",
    title: "T",
    rootNodeId: null,
    currentNodeId: null,
    createdAt: 1,
    updatedAt: 1,
  };
  const preferences = {
    id: "preferences",
    activeProviderId: null,
    detail: "balanced",
    sectionDensity: "medium",
    math: "auto",
    userSystemPrompt: "",
    theme: "system",
    language: "auto",
  };

  it("accepts the v1 conversation envelope", () => {
    expect(isConversationExport({ schemaVersion: 1, conversation, nodes: [] })).toBe(true);
  });

  it("accepts new title metadata while keeping legacy title-less nodes compatible", () => {
    const titledConversation = { ...conversation, titleSource: "ai" };
    const titledNode = {
      id: "n",
      conversationId: "c",
      parentNodeId: null,
      anchorSectionId: null,
      userMessage: "Question",
      title: "Focused topic",
      titleSource: "manual",
      assistant: null,
      providerSnapshot: { providerId: "p", model: "m" },
      status: "done",
      createdAt: 1,
    };
    const legacyNode = { ...titledNode };
    delete (legacyNode as Partial<typeof titledNode>).title;
    delete (legacyNode as Partial<typeof titledNode>).titleSource;

    expect(isConversationExport({ schemaVersion: 1, conversation: titledConversation, nodes: [titledNode] })).toBe(true);
    expect(isConversationExport({ schemaVersion: 1, conversation, nodes: [legacyNode] })).toBe(true);
  });

  it("rejects unknown versions and executable-looking non-data", () => {
    expect(isConversationExport({ schemaVersion: 2, conversation: {}, nodes: [] })).toBe(false);
    expect(isBackupExport("alert('x')")).toBe(false);
  });

  it("accepts the v1 backup envelope", () => {
    expect(isBackupExport({ schemaVersion: 1, exportedAt: 1, conversations: [], nodes: [], providers: [], preferences })).toBe(true);
  });
});
