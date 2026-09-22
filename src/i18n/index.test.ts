import { describe, expect, it } from "vitest";
import { providerErrorKey, resolveLanguage } from "./index";

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
});
