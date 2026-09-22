import type { GenerateInput, ProviderConfig, StreamEvent } from "../../types/domain";
import { requireProviderFields, runConnectionTest } from "./common";
import { mapFetchError } from "./errors";
import { chatFinishReason } from "./finishReasons";
import { readSse, responseError } from "./sse";
import type { ProviderAdapter } from "./types";
import { resolveProviderUrl } from "./urls";

function request(config: ProviderConfig, input: GenerateInput, stream: boolean): Promise<Response> {
  const key = requireProviderFields(config);
  return fetch(resolveProviderUrl(config.baseUrl, config.protocol), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: input.model,
      messages: [
        ...(input.systemPrompt ? [{ role: "system", content: input.systemPrompt }] : []),
        ...input.messages,
      ],
      ...(!stream
        ? { max_tokens: 1 }
        : config.maxOutputTokens
          ? { max_tokens: config.maxOutputTokens }
          : {}),
      stream,
      ...(stream ? { stream_options: { include_usage: true } } : {}),
    }),
    signal: input.signal,
  });
}

export const chatCompletionsAdapter: ProviderAdapter = {
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
        const data = JSON.parse(item.data) as {
          choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        };
        const choice = data.choices?.[0];
        const text = choice?.delta?.content;
        if (text) yield { type: "text-delta", text };
        if (choice?.finish_reason) providerReason = choice.finish_reason;
        if (data.usage) {
          yield {
            type: "usage",
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          };
        }
      }
      yield {
        type: "done",
        finishReason: chatFinishReason(providerReason),
        providerReason,
      };
    } catch (error) {
      throw mapFetchError(error);
    }
  },
};
