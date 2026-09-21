import type { TestResult } from "../../types/domain";

export type AppErrorCode =
  | "NETWORK"
  | "CORS"
  | "AUTH"
  | "MODEL_NOT_FOUND"
  | "RATE_LIMIT"
  | "BAD_RESPONSE"
  | "ABORTED"
  | "UNKNOWN";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function mapHttpError(status: number, message = "Request failed."): AppError {
  if (status === 401 || status === 403) {
    return new AppError("AUTH", "API key was rejected by the provider.", status);
  }
  if (status === 404 || /model.+not found|unknown model/i.test(message)) {
    return new AppError("MODEL_NOT_FOUND", "The configured model or endpoint was not found.", status);
  }
  if (status === 429) {
    return new AppError("RATE_LIMIT", "The provider rate limit was reached. Try again shortly.", status);
  }
  if (status >= 500) {
    return new AppError("NETWORK", "The provider is temporarily unavailable.", status);
  }
  return new AppError("BAD_RESPONSE", message || "The provider returned an invalid response.", status);
}

export function mapFetchError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new AppError("ABORTED", "Generation was stopped.");
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/failed to fetch|load failed|networkerror/i.test(message)) {
    return new AppError(
      "CORS",
      "The browser could not reach this endpoint. It may be blocked by CORS.",
    );
  }
  return new AppError("UNKNOWN", message || "An unknown provider error occurred.");
}

export function errorToTestResult(error: unknown): TestResult {
  const mapped = mapFetchError(error);
  const stage = mapped.code === "CORS"
    ? "cors"
    : mapped.code === "AUTH"
      ? "auth"
      : mapped.code === "MODEL_NOT_FOUND"
        ? "model"
        : mapped.code === "NETWORK"
          ? "network"
          : "unknown";
  return { ok: false, stage, message: mapped.message };
}
