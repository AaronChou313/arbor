import { expect, test } from "@playwright/test";

const protocol = process.env.ARBOR_LIVE_PROTOCOL;
const baseUrl = process.env.ARBOR_LIVE_BASE_URL;
const apiKey = process.env.ARBOR_LIVE_API_KEY;
const model = process.env.ARBOR_LIVE_MODEL;
const configured = Boolean(protocol && baseUrl && apiKey && model);

test.use({ trace: "off", screenshot: "off", video: "off", locale: "en-US" });
test.skip(!configured, "Live provider environment is not configured.");
test.describe.configure({ mode: "serial" });

test("real provider completes the branching learning flow", async ({ page }) => {
  test.setTimeout(360_000);
  if (!protocol || !baseUrl || !apiKey || !model) throw new Error("Live provider environment is incomplete.");

  await page.goto("/#/settings");
  await page.getByRole("button", { name: /Add provider/ }).click();
  await page.getByLabel("Name").fill("Live provider");
  await page.getByLabel("Protocol").selectOption(protocol);
  await page.getByLabel("Base URL").fill(baseUrl);
  await page.getByLabel("API Key", { exact: true }).fill(apiKey);
  await page.getByLabel("Model").fill(model);
  await page.getByText("Advanced", { exact: true }).click();
  await expect(page.getByLabel("Max output tokens")).toHaveValue("");
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByText("Endpoint, authentication, and model accepted.")).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Provider saved.")).toBeVisible();

  await page.getByLabel("Language").selectOption("zh-CN");
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "模型服务" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "回答" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "系统提示词" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "外观" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "数据" })).toBeVisible();

  await page.getByRole("button", { name: "返回对话" }).click();
  const composer = page.getByRole("textbox", { name: "消息", exact: true });
  const rootQuestion = "给我讲讲什么是最小二乘法";
  await composer.fill(rootQuestion);
  await composer.press("Enter");
  const rootSections = page.locator(".messages .answer-section");
  await expect(rootSections.nth(1)).toBeVisible({ timeout: 120_000 });
  expect(await rootSections.count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator(".messages .katex").first()).toBeVisible();
  await expect(page.getByLabel("用量").first()).not.toContainText("end_turn");

  const firstTitle = (await rootSections.nth(0).locator(".section-title").innerText()).trim();
  const secondTitle = (await rootSections.nth(1).locator(".section-title").innerText()).trim();
  await rootSections.nth(0).click();
  await expect(page.locator(".anchor-chip")).toContainText(`基于： ${firstTitle}`);
  const firstFollowUp = "请给一个简单数值例子";
  await composer.fill(firstFollowUp);
  await composer.press("Enter");
  await expect(page.locator(".messages").getByText(firstFollowUp, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "发送消息" })).toBeVisible({ timeout: 120_000 });

  await page.getByRole("button", { name: "对话树", exact: true }).click();
  const tree = page.locator(".tree-drawer");
  await expect(tree.getByRole("button", { name: firstFollowUp })).toBeVisible();
  await tree.getByRole("button", { name: rootQuestion }).click();

  await page.locator(".messages .answer-section").nth(1).click();
  const siblingFollowUp = "这个模块与第一个模块有什么不同？";
  await composer.fill(siblingFollowUp);
  await composer.press("Enter");
  await expect(page.locator(".messages").getByText(siblingFollowUp, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "发送消息" })).toBeVisible({ timeout: 120_000 });

  await page.getByRole("button", { name: "对话树", exact: true }).click();
  await expect(tree.getByRole("button", { name: firstFollowUp })).toBeVisible();
  await expect(tree.getByRole("button", { name: siblingFollowUp })).toBeVisible();
  await page.getByRole("button", { name: "关闭对话树" }).first().click();

  await page.reload();
  await expect(page.locator(".messages").getByText(siblingFollowUp, { exact: true })).toBeVisible();
  await expect(page.getByText(new RegExp(`基于 ${secondTitle}`))).toBeVisible();

  await page.getByRole("link", { name: "设置" }).click();
  await page.getByLabel("界面语言").selectOption("en-US");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Providers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Response" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "System prompt" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Data" })).toBeVisible();
  await expect(page.getByRole("button", { name: /New chat/ })).toBeVisible();
  expect(firstTitle).not.toHaveLength(0);
}, 360_000);

test("real provider auto-continues a deliberately long answer as one response", async ({ page }) => {
  test.setTimeout(480_000);
  if (!protocol || !baseUrl || !apiKey || !model) throw new Error("Live provider environment is incomplete.");

  await page.goto("/#/settings");
  await page.getByRole("button", { name: /Add provider/ }).click();
  await page.getByLabel("Name").fill("Live long-answer provider");
  await page.getByLabel("Protocol").selectOption(protocol);
  await page.getByLabel("Base URL").fill(baseUrl);
  await page.getByLabel("API Key", { exact: true }).fill(apiKey);
  await page.getByLabel("Model").fill(model);
  await page.getByText("Advanced", { exact: true }).click();
  await page.getByLabel("Max output tokens").fill("512");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Provider saved.")).toBeVisible();
  await page.getByLabel("Language").selectOption("zh-CN");
  await page.getByRole("button", { name: "返回对话" }).click();

  const composer = page.getByRole("textbox", { name: "消息", exact: true });
  await composer.fill("这是一个有限的数学序列问题。严格按固定模板输出：先写 `## 1 到 150`，然后从 1 到 150 每行一个整数；再写 `## 151 到 300`，然后从 151 到 300 每行一个整数。不要推导、解释、前言或总结；输出 300 后立即结束。");
  await composer.press("Enter");

  const sections = page.locator(".messages .answer-section");
  await expect(sections.nth(1)).toBeVisible({ timeout: 360_000 });
  expect(await sections.count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator(".assistant-message")).toHaveCount(1);
  await expect(page.getByText("回答已达到输出长度上限。")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "继续生成" })).not.toBeVisible();
  await expect(page.getByLabel("用量")).not.toContainText("end_turn");

  const usageText = await page.getByLabel("用量").innerText();
  const outputTokens = Number(usageText.match(/输出\s+(\d+)/u)?.[1] ?? 0);
  expect(outputTokens).toBeGreaterThan(512);

  await expect(sections.nth(0)).toContainText("150");
  await expect(sections.nth(1)).toContainText("300");
}, 480_000);
