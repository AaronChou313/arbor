import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../../features/generation/systemPrompt";
import { looksLikeLegacyProtocol, parseMarkdownAnswer } from "../../features/structured-answer/parser";
import { buildContext } from "../context/buildContext";
import {
  DEFAULT_PREFERENCES,
  type CanonicalMessage,
  type ConversationNode,
  type FinishReason,
  type GenerationUsage,
  type ProviderConfig,
  type ProviderProtocol,
} from "../../types/domain";
import { getProviderAdapter } from ".";

const protocol = process.env.ARBOR_LIVE_PROTOCOL as ProviderProtocol | undefined;
const baseUrl = process.env.ARBOR_LIVE_BASE_URL;
const apiKey = process.env.ARBOR_LIVE_API_KEY;
const model = process.env.ARBOR_LIVE_MODEL;
const configured = Boolean(protocol && baseUrl && apiKey && model);

type GenerationResult = {
  text: string;
  finishReason: FinishReason;
  providerReason?: string;
  usage: GenerationUsage;
};

async function generate(config: ProviderConfig, messages: CanonicalMessage[]): Promise<GenerationResult> {
  let text = "";
  let finishReason: FinishReason = "unknown";
  let providerReason: string | undefined;
  let usage: GenerationUsage = {};
  for await (const event of getProviderAdapter(config.protocol).stream(config, {
    systemPrompt: buildSystemPrompt({ ...DEFAULT_PREFERENCES, detail: "detailed", math: "latex", language: "zh-CN" }),
    messages,
    model: config.model,
  })) {
    if (event.type === "text-delta") text += event.text;
    if (event.type === "usage") {
      usage = {
        inputTokens: event.inputTokens ?? usage.inputTokens,
        outputTokens: event.outputTokens ?? usage.outputTokens,
        totalTokens: event.totalTokens ?? usage.totalTokens,
      };
    }
    if (event.type === "done") {
      finishReason = event.finishReason;
      providerReason = event.providerReason;
    }
  }
  return { text, finishReason, providerReason, usage };
}

function liveConfig(maxOutputTokens: number): ProviderConfig {
  if (!protocol || !baseUrl || !apiKey || !model) throw new Error("Live provider environment is incomplete.");
  const now = Date.now();
  return {
    id: "live-provider",
    name: "Live provider",
    protocol,
    baseUrl,
    apiKey,
    rememberApiKey: false,
    model,
    maxOutputTokens,
    createdAt: now,
    updatedAt: now,
  };
}

function node(
  id: string,
  userMessage: string,
  assistant: ConversationNode["assistant"],
  parentNodeId: string | null,
  anchorSectionId: string | null = null,
): ConversationNode {
  return {
    id,
    conversationId: "live-conversation",
    parentNodeId,
    anchorSectionId,
    anchorQuote: null,
    anchorBlockId: null,
    userMessage,
    assistant,
    providerSnapshot: { providerId: "live-provider", model: model ?? "" },
    status: assistant ? "done" : "pending",
    createdAt: Date.now(),
  };
}

describe.skipIf(!configured)("live provider", () => {
  it("reports a real token-limit stop with usage instead of silently completing", async () => {
    const result = await generate(liveConfig(128), [{
      role: "user",
      content: "请写一篇非常详细的最小二乘法教程，至少包含十个知识模块、完整推导和多个例题，不要提前总结。",
    }]);

    expect(result.finishReason).toBe("length");
    expect(result.providerReason).toMatch(/max_tokens|max_output_tokens|model_context_window_exceeded/u);
    expect(result.usage.outputTokens).toBeGreaterThanOrEqual(100);
  }, 120_000);

  it("keeps a four-round math conversation scoped to the selected formula section", async () => {
    const config = liveConfig(8192);
    const rootQuestion = `请讲解最小二乘法，并严格包含以下两个顶层模块：
## 矩阵正规方程推导
在这个模块中用编号 1、2、3 给出三个推导步骤，并写出至少三个 LaTeX 公式；第三步必须是令梯度为零并求解正规方程。
## 梯度下降的全局流程
在这个模块中也给出三个步骤，包括学习率和迭代更新。`;
    const first = await generate(config, [{ role: "user", content: rootQuestion }]);
    const firstAnswer = parseMarkdownAnswer(first.text);

    expect(first.finishReason).toBe("stop");
    expect(first.usage.outputTokens).toBeGreaterThan(0);
    expect(looksLikeLegacyProtocol(first.text)).toBe(false);
    const selected = firstAnswer.sections.find((section) => section.title.includes("正规方程"));
    expect(selected).toBeDefined();
    expect((selected?.content.match(/\\[A-Za-z]+/gu) ?? []).length).toBeGreaterThanOrEqual(2);

    const root = node("root", rootQuestion, firstAnswer, null);
    const secondQuestion = "第三步没看懂，请只解释它，并保留关键公式。";
    const secondNode = node("second", secondQuestion, null, root.id, selected!.id);
    const second = await generate(config, buildContext([root, secondNode]));
    const secondAnswer = parseMarkdownAnswer(second.text);

    expect(second.finishReason).toBe("stop");
    expect(second.text).toMatch(/正规方程|梯度|X\^?T|X\^\{\\mathsf\{T\}\}/u);
    expect(second.text).not.toMatch(/学习率|迭代更新/u);

    const completedSecond = { ...secondNode, assistant: secondAnswer, status: "done" as const };
    const thirdQuestion = "能给一个两点拟合直线的数值例子吗？";
    const thirdNode = node("third", thirdQuestion, null, completedSecond.id);
    const third = await generate(config, buildContext([root, completedSecond, thirdNode]));
    expect(third.finishReason).toBe("stop");
    expect(third.text).toMatch(/[\u3400-\u9fff]/u);
    expect(third.text).toMatch(/(?:\\|\$)/u);

    const completedThird = { ...thirdNode, assistant: parseMarkdownAnswer(third.text), status: "done" as const };
    const fourthQuestion = "把刚才这条局部分支总结成三项检查清单。";
    const fourthNode = node("fourth", fourthQuestion, null, completedThird.id);
    const fourth = await generate(config, buildContext([root, completedSecond, completedThird, fourthNode]));
    expect(fourth.finishReason).toBe("stop");
    expect(fourth.text).toMatch(/[\u3400-\u9fff]/u);

    const ambiguousNode = node("ambiguous", "这个公式怎么来的？", null, root.id, selected!.id);
    const ambiguous = await generate(config, buildContext([root, ambiguousNode]));
    expect(ambiguous.finishReason).toBe("stop");
    expect(ambiguous.text).toMatch(/具体|哪一个|哪条|请指出|请明确|是指/u);
    expect(ambiguous.text.length).toBeLessThan(1500);
  }, 360_000);
});
