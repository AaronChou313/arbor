import { describe, expect, it } from "vitest";
import { looksLikeLegacyProtocol, parseMarkdownAnswer } from "./parser";

describe("parseMarkdownAnswer", () => {
  it("parses Chinese intro and multiple H2 sections", () => {
    const answer = parseMarkdownAnswer("先理解整体思路。\n\n## 定义\n最小化残差平方和。\n\n## 几何意义\n寻找最佳投影。");
    expect(answer.intro).toBe("先理解整体思路。");
    expect(answer.sections).toHaveLength(2);
    expect(answer.sections.map((section) => section.title)).toEqual(["定义", "几何意义"]);
    expect(answer.sections[0].id).toBe("section-定义");
  });

  it("preserves LaTeX without JSON escaping", () => {
    const raw = String.raw`## 正规方程
参数满足 $\theta=(X^TX)^{-1}X^Ty$，也可以写成
$$\hat{\theta}=\arg\min_\theta \sum_{i=1}^{n}(y_i-x_i^T\theta)^2.$$`;
    const answer = parseMarkdownAnswer(raw);
    expect(answer.sections[0].content).toContain(String.raw`\theta`);
    expect(answer.sections[0].content).toContain(String.raw`\sum_{i=1}^{n}`);
  });

  it("handles many formulas across sections", () => {
    const raw = String.raw`引言中的公式 $y=X\beta+\epsilon$。

## 损失函数
$$J(\beta)=\|y-X\beta\|_2^2$$
$$\nabla J=-2X^T(y-X\beta)$$

### 推导
$X^TX\beta=X^Ty$。

## 解与方差
$$\hat\beta=(X^TX)^{-1}X^Ty$$
$$\mathrm{Var}(\hat\beta)=\sigma^2(X^TX)^{-1}$$`;
    const answer = parseMarkdownAnswer(raw);
    expect(answer.sections).toHaveLength(2);
    expect(answer.sections[0].content).toContain("### 推导");
    expect(answer.sections[1].content).toContain(String.raw`\mathrm{Var}`);
  });

  it("ignores H2-looking lines inside fenced code blocks", () => {
    const raw = "## 示例\n```markdown\n## 不是 Section\n### 也不是\n```\n示例结束。\n\n## 结论\n完成。";
    const answer = parseMarkdownAnswer(raw);
    expect(answer.sections).toHaveLength(2);
    expect(answer.sections[0].content).toContain("## 不是 Section");
    expect(answer.sections[1].title).toBe("结论");
  });

  it("keeps H3 and lower headings inside the current H2 section", () => {
    const answer = parseMarkdownAnswer("## Parent\n### Child\nBody\n#### Detail\nMore");
    expect(answer.sections).toHaveLength(1);
    expect(answer.sections[0].content).toContain("### Child");
    expect(answer.sections[0].content).toContain("#### Detail");
  });

  it("falls back safely when there is no H2", () => {
    const raw = "A useful answer with $x^2$ but no top-level module.";
    expect(parseMarkdownAnswer(raw)).toEqual({ rawText: raw, sections: [], fallbackReason: "unsectioned" });
  });

  it("does not expose the legacy JSON protocol as answer content", () => {
    const raw = '{"intro":"hidden","sections":[{"title":"A","content":"B"}]}';
    expect(looksLikeLegacyProtocol(raw)).toBe(true);
    expect(parseMarkdownAnswer(raw)).toEqual({ rawText: "", sections: [], fallbackReason: "protocol" });
  });
});
