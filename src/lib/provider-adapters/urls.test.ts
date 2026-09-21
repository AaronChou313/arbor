import { describe, expect, it } from "vitest";
import { normalizeBaseUrl, resolveProviderUrl } from "./urls";

describe("provider URLs", () => {
  it("normalizes trailing slashes", () => {
    expect(normalizeBaseUrl(" https://api.example.com/// ")).toBe("https://api.example.com");
  });

  it("appends protocol paths to roots and v1 bases", () => {
    expect(resolveProviderUrl("https://api.example.com", "anthropic")).toBe("https://api.example.com/v1/messages");
    expect(resolveProviderUrl("https://api.example.com/v1/", "openai-responses")).toBe("https://api.example.com/v1/responses");
  });

  it("preserves complete endpoints", () => {
    expect(resolveProviderUrl("https://relay.example.com/v1/chat/completions/", "chat-completions")).toBe("https://relay.example.com/v1/chat/completions");
  });
});
