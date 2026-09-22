import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProviderConfig, StreamEvent } from "../../types/domain";
import { anthropicAdapter } from "./anthropic";
import { chatCompletionsAdapter } from "./chatCompletions";
import { openAIResponsesAdapter } from "./openaiResponses";

function config(protocol: ProviderConfig["protocol"], maxOutputTokens?: number): ProviderConfig {
  return {
    id: "provider",
    name: "Provider",
    protocol,
    baseUrl: "https://provider.test",
    apiKey: "test-key",
    rememberApiKey: false,
    model: "test-model",
    maxOutputTokens,
    createdAt: 1,
    updatedAt: 1,
  };
}

async function collect(adapter: typeof anthropicAdapter, provider: ProviderConfig): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of adapter.stream(provider, {
    systemPrompt: "System",
    messages: [{ role: "user", content: "Question" }],
    model: provider.model,
  })) events.push(event);
  return events;
}

afterEach(() => vi.unstubAllGlobals());

describe("streaming provider metadata", () => {
  it("reads Chat Completions finish_reason and usage", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.max_tokens).toBe(8192);
      return new Response([
        `data: ${JSON.stringify({ choices: [{ delta: { content: "partial" }, finish_reason: null }] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "length" }], usage: { prompt_tokens: 20, completion_tokens: 8192, total_tokens: 8212 } })}`,
        "data: [DONE]",
      ].join("\n\n"));
    });
    vi.stubGlobal("fetch", fetchMock);

    const events = await collect(chatCompletionsAdapter, config("chat-completions", 8192));
    expect(events).toContainEqual({ type: "usage", inputTokens: 20, outputTokens: 8192, totalTokens: 8212 });
    expect(events.at(-1)).toEqual({ type: "done", finishReason: "length", providerReason: "length" });
  });

  it("reads Anthropic message_delta stop_reason and usage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response([
      `event: message_start\ndata: ${JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 30, output_tokens: 0 } } })}`,
      `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "partial" } })}`,
      `event: message_delta\ndata: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "max_tokens" }, usage: { output_tokens: 8192 } })}`,
    ].join("\n\n"))));

    const events = await collect(anthropicAdapter, config("anthropic", 8192));
    expect(events).toContainEqual({ type: "usage", outputTokens: 8192 });
    expect(events.at(-1)).toEqual({ type: "done", finishReason: "length", providerReason: "max_tokens" });
  });

  it("reads Responses incomplete details and omits an empty token setting", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).not.toHaveProperty("max_output_tokens");
      return new Response([
        `event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: "partial" })}`,
        `event: response.incomplete\ndata: ${JSON.stringify({ type: "response.incomplete", response: { status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, usage: { input_tokens: 40, output_tokens: 512, total_tokens: 552 } } })}`,
      ].join("\n\n"));
    }));

    const events = await collect(openAIResponsesAdapter, config("openai-responses"));
    expect(events).toContainEqual({ type: "usage", inputTokens: 40, outputTokens: 512, totalTokens: 552 });
    expect(events.at(-1)).toEqual({ type: "done", finishReason: "length", providerReason: "max_output_tokens" });
  });
});
