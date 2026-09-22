import type { GenerateInput, ProviderConfig, StreamEvent } from "../../types/domain";
import { mapFetchError } from "./errors";
import { requireProviderFields, runConnectionTest } from "./common";
import { anthropicFinishReason } from "./finishReasons";
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
      ...(!stream
        ? { max_tokens: 1 }
        : config.maxOutputTokens
          ? { max_tokens: config.maxOutputTokens }
          : {}),
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
      let providerReason: string | undefined;
      for await (const item of readSse(response)) {
        if (item.data === "[DONE]") break;
        const data = JSON.parse(item.data) as Record<string, unknown>;
        if (data.type === "message_start") {
          const message = data.message as { usage?: { input_tokens?: number; output_tokens?: number } } | undefined;
          if (message?.usage) {
            yield {
              type: "usage",
              inputTokens: message.usage.input_tokens,
              outputTokens: message.usage.output_tokens,
            };
          }
        }
        if (data.type === "content_block_delta") {
          const delta = data.delta as { type?: string; text?: string } | undefined;
          if (delta?.type === "text_delta" && delta.text) yield { type: "text-delta", text: delta.text };
        }
        if (data.type === "message_delta") {
          const delta = data.delta as { stop_reason?: string | null } | undefined;
          if (delta?.stop_reason) providerReason = delta.stop_reason;
          const usage = data.usage as { output_tokens?: number } | undefined;
          if (usage) yield { type: "usage", outputTokens: usage.output_tokens };
        }
      }
      yield {
        type: "done",
        finishReason: anthropicFinishReason(providerReason),
        providerReason,
      };
    } catch (error) {
      throw mapFetchError(error);
    }
  },
};
