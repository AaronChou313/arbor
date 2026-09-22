import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "../../types/domain";
import { buildSystemPrompt } from "./systemPrompt";

describe("buildSystemPrompt", () => {
  it("requests language-aware Markdown sections and normal LaTeX", () => {
    const prompt = buildSystemPrompt(DEFAULT_PREFERENCES);
    expect(prompt).toContain("normal Markdown");
    expect(prompt).toContain("language of the user's latest question");
    expect(prompt).toContain("level-two Markdown headings (##)");
    expect(prompt).toContain("Do not mechanically create");
    expect(prompt).toContain("$...$");
    expect(prompt).not.toContain("valid JSON");
    expect(prompt).not.toContain('"sections"');
  });
});
