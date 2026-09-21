import type { AnswerSection, StructuredAnswer } from "../../types/domain";

function stripFence(value: string): string {
  const match = value.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1] ?? value.trim();
}

function extractObject(value: string): string {
  const clean = stripFence(value);
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return start >= 0 && end > start ? clean.slice(start, end + 1) : clean;
}

export function parseStructuredAnswer(rawText: string): StructuredAnswer | null {
  try {
    const parsed: unknown = JSON.parse(extractObject(rawText));
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Record<string, unknown>;
    if (!Array.isArray(candidate.sections) || candidate.sections.length === 0) return null;

    const used = new Set<string>();
    const sections: AnswerSection[] = candidate.sections.map((value, index) => {
      if (!value || typeof value !== "object") throw new Error("Invalid section");
      const section = value as Record<string, unknown>;
      if (typeof section.title !== "string" || typeof section.content !== "string") {
        throw new Error("Invalid section fields");
      }
      const requested = typeof section.id === "string" && section.id.trim()
        ? section.id.trim()
        : `section-${index + 1}`;
      let id = requested;
      let suffix = 2;
      while (used.has(id)) id = `${requested}-${suffix++}`;
      used.add(id);
      return { id, title: section.title.trim(), content: section.content.trim() };
    });

    return {
      rawText,
      intro: typeof candidate.intro === "string" ? candidate.intro.trim() : undefined,
      sections,
      outro: typeof candidate.outro === "string" ? candidate.outro.trim() : undefined,
    };
  } catch {
    return null;
  }
}

export function fallbackAnswer(rawText: string): StructuredAnswer {
  return { rawText, sections: [] };
}
