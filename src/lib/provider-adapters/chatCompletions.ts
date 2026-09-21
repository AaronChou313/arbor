import type { GenerateInput, ProviderConfig, StreamEvent } from "../../types/domain";
import { requireProviderFields, runConnectionTest } from "./common";
import { mapFetchError } from "./errors";
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
      max_tokens: stream ? 4096 : 1,
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
      for await (const item of readSse(response)) {
        if (item.data === "[DONE]") break;
        const data = JSON.parse(item.data) as {
          choices?: Array<{ delta?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const text = data.choices?.[0]?.delta?.content;
        if (text) yield { type: "text-delta", text };
        if (data.usage) {
          yield {
            type: "usage",
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
          };
        }
      }
      yield { type: "done" };
    } catch (error) {
      throw mapFetchError(error);
    }
  },
};
