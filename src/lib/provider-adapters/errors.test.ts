import { describe, expect, it } from "vitest";
import { errorToTestResult, mapFetchError, mapHttpError } from "./errors";

describe("provider error mapping", () => {
  it("maps HTTP status codes to useful errors", () => {
    expect(mapHttpError(401).code).toBe("AUTH");
    expect(mapHttpError(404).code).toBe("MODEL_NOT_FOUND");
    expect(mapHttpError(429).code).toBe("RATE_LIMIT");
  });

  it("treats browser fetch failures as possible CORS failures", () => {
    const error = mapFetchError(new TypeError("Failed to fetch"));
    expect(error.code).toBe("CORS");
    expect(errorToTestResult(error).stage).toBe("cors");
  });
});
