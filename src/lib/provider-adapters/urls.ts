import type { ProviderProtocol } from "../../types/domain";

const paths: Record<ProviderProtocol, string> = {
  anthropic: "messages",
  "openai-responses": "responses",
  "chat-completions": "chat/completions",
};

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function resolveProviderUrl(baseUrl: string, protocol: ProviderProtocol): string {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) throw new Error("Base URL is required.");
  const endpoint = paths[protocol];
  const pathname = new URL(normalized).pathname.replace(/\/+$/, "");
  if (pathname.endsWith(`/${endpoint}`)) return normalized;
  if (pathname.endsWith("/v1")) return `${normalized}/${endpoint}`;
  return `${normalized}/v1/${endpoint}`;
}
