import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../../features/generation/systemPrompt";
import { looksLikeLegacyProtocol, parseMarkdownAnswer } from "../../features/structured-answer/parser";
import { DEFAULT_PREFERENCES, type CanonicalMessage, type ProviderConfig, type ProviderProtocol } from "../../types/domain";
import { getProviderAdapter } from ".";

const protocol = process.env.ARBOR_LIVE_PROTOCOL as ProviderProtocol | undefined;
const baseUrl = process.env.ARBOR_LIVE_BASE_URL;
const apiKey = process.env.ARBOR_LIVE_API_KEY;
const model = process.env.ARBOR_LIVE_MODEL;
const configured = Boolean(protocol && baseUrl && apiKey && model);

async function generate(config: ProviderConfig, messages: CanonicalMessage[]): Promise<string> {
  let answer = "";
  for await (const event of getProviderAdapter(config.protocol).stream(config, {
    systemPrompt: buildSystemPrompt({ ...DEFAULT_PREFERENCES, math: "latex", language: "zh-CN" }),
    messages,
    model: config.model,
  })) {
    if (event.type === "text-delta") answer += event.text;
  }
  return answer;
}

describe.skipIf(!configured)("live provider", () => {
  it("returns Chinese Markdown with LaTeX sections and supports an anchored follow-up", async () => {
    if (!protocol || !baseUrl || !apiKey || !model) throw new Error("Live provider environment is incomplete.");
    expect(["anthropic", "openai-responses", "chat-completions"]).toContain(protocol);

    const now = Date.now();
    const config: ProviderConfig = {
      id: "live-provider",
      name: "Live provider",
      protocol,
      baseUrl,
      apiKey,
      rememberApiKey: false,
      model,
      createdAt: now,
      updatedAt: now,
    };

    const question = "给我讲讲什么是最小二乘法。请用数学公式解释目标函数和解析解。";
    const answer = await generate(config, [{ role: "user", content: question }]);
    const parsed = parseMarkdownAnswer(answer);

    expect(answer).not.toHaveLength(0);
    expect(looksLikeLegacyProtocol(answer)).toBe(false);
    expect(answer).toMatch(/[\u3400-\u9fff]/u);
    expect(answer).toMatch(/(?:\\(?:theta|frac|sum|hat|mathbf|begin)|\$\$)/u);
    expect(parsed.sections.length).toBeGreaterThanOrEqual(2);

    const anchor = parsed.sections[0];
    const followUp = await generate(config, [
      { role: "user", content: question },
      { role: "assistant", content: `${parsed.intro ?? ""}\n\n## ${anchor.title}\n\n${anchor.content}` },
      { role: "user", content: `请只围绕“${anchor.title}”进一步解释，并给出一个小例子。` },
    ]);

    expect(followUp).toMatch(/[\u3400-\u9fff]/u);
    expect(looksLikeLegacyProtocol(followUp)).toBe(false);
    expect(parseMarkdownAnswer(followUp).sections.length).toBeGreaterThan(0);
  }, 180_000);
});
