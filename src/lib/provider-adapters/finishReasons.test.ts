import { describe, expect, it } from "vitest";
import { anthropicFinishReason, chatFinishReason, responsesFinishReason } from "./finishReasons";

describe("provider finish reasons", () => {
  it("maps Chat Completions length and tool reasons", () => {
    expect(chatFinishReason("length")).toBe("length");
    expect(chatFinishReason("tool_calls")).toBe("tool-call");
    expect(chatFinishReason("stop")).toBe("stop");
  });

  it("maps Anthropic max_tokens from message_delta", () => {
    expect(anthropicFinishReason("max_tokens")).toBe("length");
    expect(anthropicFinishReason("end_turn")).toBe("stop");
  });

  it("maps incomplete Responses output", () => {
    expect(responsesFinishReason("incomplete", "max_output_tokens")).toBe("length");
    expect(responsesFinishReason("completed")).toBe("stop");
    expect(responsesFinishReason("failed")).toBe("error");
  });
});
