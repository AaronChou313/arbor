import type { ProviderConfig, TestResult } from "../../types/domain";
import { getProviderKey } from "../utils/secret";
import { errorToTestResult, mapFetchError } from "./errors";
import { responseError } from "./sse";

export function requireProviderFields(config: ProviderConfig): string {
  const key = getProviderKey(config);
  if (!config.baseUrl.trim()) throw new Error("Base URL is required.");
  if (!key) throw new Error("API key is required.");
  if (!config.model.trim()) throw new Error("Model is required.");
  return key;
}

export async function runConnectionTest(request: () => Promise<Response>): Promise<TestResult> {
  try {
    const response = await request();
    if (!response.ok) throw await responseError(response);
    return { ok: true, stage: "model", message: "Endpoint, authentication, and model accepted." };
  } catch (error) {
    return errorToTestResult(mapFetchError(error));
  }
}
