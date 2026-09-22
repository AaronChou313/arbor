import type { GenerateInput, ProviderConfig, StreamEvent } from "../../types/domain";
import { requireProviderFields, runConnectionTest } from "./common";
import { mapFetchError } from "./errors";
import { responsesFinishReason } from "./finishReasons";
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
      instructions: input.systemPrompt,
      input: input.messages,
      ...(!stream
        ? { max_output_tokens: 16 }
        : config.maxOutputTokens
          ? { max_output_tokens: config.maxOutputTokens }
          : {}),
      stream,
    }),
    signal: input.signal,
  });
}

export const openAIResponsesAdapter: ProviderAdapter = {
  test(config) {
    return runConnectionTest(() =>
      request(config, { systemPrompt: "", messages: [{ role: "user", content: "Reply OK." }], model: config.model }, false),
    );
  },
  async *stream(config, input): AsyncGenerator<StreamEvent> {
    try {
      const response = await request(config, input, true);
      if (!response.ok) throw await responseError(response);
      let finishReason: Extract<StreamEvent, { type: "done" }> = {
        type: "done",
        finishReason: "unknown",
      };
      for await (const item of readSse(response)) {
        if (item.data === "[DONE]") break;
        const data = JSON.parse(item.data) as Record<string, unknown>;
        const type = String(data.type ?? item.event ?? "");
        if (type === "response.output_text.delta" && typeof data.delta === "string") {
          yield { type: "text-delta", text: data.delta };
        }
        if (["response.completed", "response.incomplete", "response.failed"].includes(type)) {
          const responseData = data.response as {
            status?: string;
            incomplete_details?: { reason?: string | null } | null;
            usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
          };
          if (responseData?.usage) {
            yield {
              type: "usage",
              inputTokens: responseData.usage.input_tokens,
              outputTokens: responseData.usage.output_tokens,
              totalTokens: responseData.usage.total_tokens,
            };
          }
          const providerReason = responseData?.incomplete_details?.reason ?? responseData?.status ?? type;
          finishReason = {
            type: "done",
            finishReason: responsesFinishReason(
              responseData?.status ?? type.replace("response.", ""),
              responseData?.incomplete_details?.reason,
            ),
            providerReason,
          };
        }
      }
      yield finishReason;
    } catch (error) {
      throw mapFetchError(error);
    }
  },
};
