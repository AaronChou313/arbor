import { describe, expect, it } from "vitest";
import { buildTitleContext, canAutomaticallyTitle, sanitizeGeneratedTitle } from "./titleGeneration";

describe("title generation", () => {
  it("uses only the selected Section, question, intro, and Section titles", () => {
    const context = buildTitleContext({
      anchorSectionTitle: "Normal equations",
      userMessage: "Where does this formula come from?",
      answer: {
        rawText: "A deliberately long answer body that must not be sent.",
        intro: "A projection-based derivation.",
        sections: [
          { id: "one", title: "Gradient step", content: "Long private content" },
          { id: "two", title: "Normal equation", content: "More long content" },
        ],
      },
    });

    expect(context).toContain("Selected Section: Normal equations");
    expect(context).toContain("User question: Where does this formula come from?");
    expect(context).toContain("Answer introduction: A projection-based derivation.");
    expect(context).toContain("Answer Section titles: Gradient step | Normal equation");
    expect(context).not.toContain("deliberately long answer body");
    expect(context).not.toContain("Long private content");
  });

  it("cleans valid bilingual titles and rejects verbose or malformed output", () => {
    expect(sanitizeGeneratedTitle("“最小二乘法几何投影”。\nextra")).toBe("最小二乘法几何投影");
    expect(sanitizeGeneratedTitle("## Least Squares Geometry.")).toBe("Least Squares Geometry");
    expect(sanitizeGeneratedTitle("About least squares")).toBeNull();
    expect(sanitizeGeneratedTitle("回归")).toBeNull();
  });

  it("only replaces explicit fallback titles and leaves legacy, AI, and manual titles alone", () => {
    expect(canAutomaticallyTitle("fallback")).toBe(true);
    expect(canAutomaticallyTitle("ai")).toBe(false);
    expect(canAutomaticallyTitle("manual")).toBe(false);
    expect(canAutomaticallyTitle(undefined)).toBe(false);
  });
});
