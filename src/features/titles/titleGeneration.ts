import type { ProviderConfig, StructuredAnswer, TitleSource } from "../../types/domain";
import { getProviderAdapter } from "../../lib/provider-adapters";

export const TITLE_MAX_OUTPUT_TOKENS = 64;

const TITLE_SYSTEM_PROMPT = `Create one concise topic title for a learning conversation turn.
Return only the title as plain text.
For Chinese, use about 4–14 Chinese characters. For English, use about 3–8 words.
Describe the knowledge topic actually learned in this turn.
Do not use quotation marks, ending punctuation, Markdown, or redundant forms such as "a question about..." or "关于……的问题".`;

export type TitleGenerationContext = {
  anchorSectionTitle?: string | null;
  userMessage: string;
  answer: StructuredAnswer;
};

export function canAutomaticallyTitle(source?: TitleSource): boolean {
  return source === "fallback";
}

export function buildTitleContext(context: TitleGenerationContext): string {
  const sectionTitles = context.answer.sections.map((section) => section.title).filter(Boolean);
  return [
    context.anchorSectionTitle ? `Selected Section: ${context.anchorSectionTitle}` : undefined,
    `User question: ${context.userMessage}`,
    context.answer.intro ? `Answer introduction: ${context.answer.intro}` : undefined,
    sectionTitles.length ? `Answer Section titles: ${sectionTitles.join(" | ")}` : undefined,
  ].filter(Boolean).join("\n");
}

export function sanitizeGeneratedTitle(raw: string): string | null {
  let title = raw
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean) ?? "";
  title = title
    .replace(/^#{1,6}\s*/u, "")
    .replace(/^(?:title|标题)\s*[:：]\s*/iu, "")
    .replace(/[.!?。！？；;:,，]+$/gu, "")
    .replace(/^["'`“”「」『』]+|["'`“”「」『』]+$/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (!title || /^(?:about\b|questions? about\b)/iu.test(title) || /^关于.*(?:的问题|问题)$/u.test(title)) return null;

  const hanCount = (title.match(/[\p{Script=Han}]/gu) ?? []).length;
  if (hanCount > 0) return hanCount >= 4 && hanCount <= 14 ? title : null;
  const wordCount = title.split(/\s+/u).filter(Boolean).length;
  return wordCount >= 3 && wordCount <= 8 ? title : null;
}

export async function requestGeneratedTitle(
  provider: ProviderConfig,
  context: TitleGenerationContext,
): Promise<string | null> {
  const adapter = getProviderAdapter(provider.protocol);
  let raw = "";
  for await (const event of adapter.stream(
    { ...provider, maxOutputTokens: TITLE_MAX_OUTPUT_TOKENS },
    {
      systemPrompt: TITLE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildTitleContext(context) }],
      model: provider.model,
    },
  )) {
    if (event.type === "text-delta") raw += event.text;
  }
  return sanitizeGeneratedTitle(raw);
}
