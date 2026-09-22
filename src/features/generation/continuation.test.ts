import { describe, expect, it } from "vitest";
import type { StreamEvent } from "../../types/domain";
import type { ConversationNode } from "../../types/domain";
import { mergeContinuationText, recoverInterruptedGeneration, runGenerationLoop } from "./continuation";

async function* events(...items: StreamEvent[]): AsyncGenerator<StreamEvent> {
  for (const item of items) yield item;
}

describe("mergeContinuationText", () => {
  it("removes a repeated final sentence or line", () => {
    const previous = "First paragraph.\nThe final sentence is repeated.";
    const next = "The final sentence is repeated.\nNew material.";
    expect(mergeContinuationText(previous, next)).toBe(`${previous}\nNew material.`);
  });

  it("removes a partial Markdown overlap", () => {
    expect(mergeContinuationText("Use **important mark", "important markdown** here.")).toBe(
      "Use **important markdown** here.",
    );
  });
});

describe("runGenerationLoop", () => {
  it("automatically joins a length segment and a stop segment", async () => {
    const controller = new AbortController();
    const result = await runGenerationLoop({
      signal: controller.signal,
      streamSegment: ({ segmentIndex }) => segmentIndex === 0
        ? events(
            { type: "text-delta", text: "## Topic\n\nFirst part. Tail sentence." },
            { type: "usage", outputTokens: 10 },
            { type: "done", finishReason: "length", providerReason: "max_tokens" },
          )
        : events(
            { type: "text-delta", text: "Tail sentence. Final part." },
            { type: "usage", outputTokens: 5 },
            { type: "done", finishReason: "stop", providerReason: "end_turn" },
          ),
    });

    expect(result.text).toBe("## Topic\n\nFirst part. Tail sentence. Final part.");
    expect(result.finishReason).toBe("stop");
    expect(result.usage?.outputTokens).toBe(15);
    expect(result.automaticContinuations).toBe(1);
  });

  it("stays streaming internally until five automatic continuations are exhausted", async () => {
    const controller = new AbortController();
    let calls = 0;
    const result = await runGenerationLoop({
      signal: controller.signal,
      streamSegment: () => {
        calls += 1;
        return events(
          { type: "text-delta", text: `segment-${calls}\n` },
          { type: "done", finishReason: "length", providerReason: "max_tokens" },
        );
      },
    });

    expect(calls).toBe(6);
    expect(result.automaticContinuations).toBe(5);
    expect(result.reachedContinuationLimit).toBe(true);
    expect(result.finishReason).toBe("length");
  });

  it("aborts the entire continuation chain", async () => {
    const controller = new AbortController();
    let calls = 0;
    let visibleText = "";
    await expect(runGenerationLoop({
      signal: controller.signal,
      onText: (text) => {
        visibleText = text;
        if (calls === 2) controller.abort();
      },
      streamSegment: () => {
        calls += 1;
        return calls === 1
          ? events(
              { type: "text-delta", text: "kept first segment" },
              { type: "done", finishReason: "length" },
            )
          : events(
              { type: "text-delta", text: " plus partial continuation" },
              { type: "done", finishReason: "length" },
            );
      },
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(calls).toBe(2);
    expect(visibleText).toBe("kept first segment plus partial continuation");
  });
});

describe("recoverInterruptedGeneration", () => {
  it("keeps saved partial text while clearing an orphaned streaming state", () => {
    const node = {
      id: "node",
      conversationId: "conversation",
      parentNodeId: null,
      anchorSectionId: null,
      userMessage: "Question",
      assistant: { rawText: "Saved partial answer", sections: [] },
      providerSnapshot: { providerId: "provider", model: "model" },
      status: "streaming",
      createdAt: 1,
    } satisfies ConversationNode;
    const recovered = recoverInterruptedGeneration(node);
    expect(recovered.status).toBe("aborted");
    expect(recovered.assistant?.rawText).toBe("Saved partial answer");
    expect(recovered.error).toBe("ABORTED");
  });
});
