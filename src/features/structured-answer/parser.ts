import type { AnswerSection, StructuredAnswer } from "../../types/domain";

const h2Pattern = /^ {0,3}##(?!#)\s+(.+?)\s*#*\s*$/;
const fencePattern = /^ {0,3}(`{3,}|~{3,})(.*)$/;

function sectionId(title: string, index: number, used: Set<string>): string {
  const slug = title
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const base = `section-${slug || index + 1}`;
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
}

export function looksLikeLegacyProtocol(rawText: string): boolean {
  const trimmed = rawText.trimStart();
  return (
    (trimmed.startsWith("{") || trimmed.startsWith("[")) &&
    /["'](?:sections|intro|outro)["']\s*:/.test(trimmed.slice(0, 1200))
  );
}

export function parseMarkdownAnswer(rawText: string): StructuredAnswer {
  if (looksLikeLegacyProtocol(rawText)) {
    return { rawText: "", sections: [], fallbackReason: "protocol" };
  }

  const lines = rawText.replace(/\r\n?/g, "\n").split("\n");
  const intro: string[] = [];
  const parsed: Array<{ title: string; content: string[] }> = [];
  let current: { title: string; content: string[] } | undefined;
  let fence: { character: "`" | "~"; length: number } | undefined;

  for (const line of lines) {
    const fenceMatch = line.match(fencePattern);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      const character = marker[0] as "`" | "~";
      if (!fence) fence = { character, length: marker.length };
      else if (fence.character === character && marker.length >= fence.length && !fenceMatch[2].trim()) {
        fence = undefined;
      }
      (current?.content ?? intro).push(line);
      continue;
    }

    const heading = !fence ? line.match(h2Pattern) : null;
    if (heading) {
      current = { title: heading[1].trim(), content: [] };
      parsed.push(current);
      continue;
    }
    (current?.content ?? intro).push(line);
  }

  if (!parsed.length) {
    return { rawText, sections: [], fallbackReason: "unsectioned" };
  }

  const used = new Set<string>();
  const sections: AnswerSection[] = parsed.map((section, index) => ({
    id: sectionId(section.title, index, used),
    title: section.title,
    content: section.content.join("\n").trim(),
  }));

  return {
    rawText,
    intro: intro.join("\n").trim() || undefined,
    sections,
  };
}
