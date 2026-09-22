import { describe, expect, it } from "vitest";
import { finishReasonKey, providerErrorKey, resolveLanguage, translate } from "./index";

describe("i18n", () => {
  it("resolves Auto from the browser language", () => {
    expect(resolveLanguage("auto", "zh-CN")).toBe("zh-CN");
    expect(resolveLanguage("auto", "en-GB")).toBe("en-US");
  });

  it("keeps explicit choices", () => {
    expect(resolveLanguage("en-US", "zh-CN")).toBe("en-US");
    expect(resolveLanguage("zh-CN", "en-US")).toBe("zh-CN");
  });

  it("maps provider error codes without exposing provider payloads", () => {
    expect(providerErrorKey("AUTH")).toBe("errorAuth");
    expect(providerErrorKey("something-else")).toBe("errorUnknown");
  });

  it("localizes the delayed continuation state", () => {
    expect(translate("zh-CN", "continuing")).toBe("正在继续生成…");
    expect(translate("en-US", "continuing")).toBe("Continuing…");
  });

  it("hides normal provider stops and humanizes special finish states", () => {
    expect(finishReasonKey("stop", "done")).toBeNull();
    expect(finishReasonKey("unknown", "done")).toBeNull();
    expect(finishReasonKey("length", "truncated")).toBe("finishLength");
    expect(finishReasonKey("content-filter", "done")).toBe("finishContentFilter");
    expect(finishReasonKey("tool-call", "done")).toBe("finishToolCall");
    expect(finishReasonKey("error", "error")).toBe("finishError");
    expect(finishReasonKey(undefined, "aborted")).toBe("finishUserStopped");
  });
});
