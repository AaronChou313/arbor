import type { GenerateInput, ProviderConfig, StreamEvent } from "../../types/domain";
import { mapFetchError } from "./errors";
import { requireProviderFields, runConnectionTest } from "./common";
import { readSse, responseError } from "./sse";
import type { ProviderAdapter } from "./types";
import { resolveProviderUrl } from "./urls";

function request(config: ProviderConfig, input: GenerateInput, stream: boolean): Promise<Response> {
  const key = requireProviderFields(config);
  return fetch(resolveProviderUrl(config.baseUrl, config.protocol), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: input.model,
      system: input.systemPrompt,
      messages: input.messages,
      max_tokens: stream ? 4096 : 1,
      stream,
    }),
    signal: input.signal,
  });
}

export const anthropicAdapter: ProviderAdapter = {
  test(config) {
    return runConnectionTest(() =>
      request(config, { systemPrompt: "", messages: [{ role: "user", content: "Reply OK." }], model: config.model }, false),
    );
  },
  async *stream(config, input): AsyncGenerator<StreamEvent> {
    try {
      const response = await request(config, input, true);
      if (!response.ok) throw await responseError(response);
      for await (const item of readSse(response)) {
        if (item.data === "[DONE]") break;
        const data = JSON.parse(item.data) as Record<string, unknown>;
        if (data.type === "content_block_delta") {
          const delta = data.delta as { type?: string; text?: string } | undefined;
          if (delta?.type === "text_delta" && delta.text) yield { type: "text-delta", text: delta.text };
        }
        if (data.type === "message_delta") {
          const usage = data.usage as { output_tokens?: number } | undefined;
          if (usage) yield { type: "usage", outputTokens: usage.output_tokens };
        }
      }
      yield { type: "done" };
    } catch (error) {
      throw mapFetchError(error);
    }
  },
};
