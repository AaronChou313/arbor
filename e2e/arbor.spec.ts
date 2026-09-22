import { expect, test, type Page, type Route } from "@playwright/test";

const endpoint = "https://mock.arbor.test/v1/responses";

type MockPayload = {
  stream?: boolean;
  max_output_tokens?: number;
  instructions?: string;
  input?: unknown;
};

function isTitleRequest(payload: MockPayload | null): boolean {
  return Boolean(payload?.instructions?.includes("Create one concise topic title"));
}

function titleForRequest(payload: MockPayload): string {
  const context = JSON.stringify(payload.input ?? "");
  if (context.includes("Why squared residuals")) return "Squared Residuals Explained";
  if (context.includes("How do the variants differ")) return "Least Squares Variants";
  if (context.includes("Create an export")) return "Conversation Export Guide";
  if (context.includes("Give me a long derivation")) return "Long Derivation Walkthrough";
  return "Least Squares Foundations";
}

async function fulfillTitleRequest(route: Route, payload: MockPayload): Promise<void> {
  expect(payload.max_output_tokens).toBe(64);
  const title = titleForRequest(payload);
  await route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    headers: { "access-control-allow-origin": "*" },
    body: [
      `event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: title })}`,
      `event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: { status: "completed", usage: { output_tokens: 6 } } })}`,
    ].join("\n\n"),
  });
}

async function mockProvider(page: Page) {
  await page.route(endpoint, async (route) => {
    const payload = route.request().postDataJSON() as MockPayload | null;
    if (!payload?.stream) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ id: "connection-test", output: [] }),
      });
      return;
    }
    if (payload && isTitleRequest(payload)) {
      await fulfillTitleRequest(route, payload);
      return;
    }
    expect(payload.max_output_tokens).toBeUndefined();

    const answer = `Least squares estimates parameters by minimizing squared residuals.

## Core idea

Choose parameters that minimize the sum of squared residuals $\\sum_i r_i^2$.

## Common variants

OLS, WLS, and TLS use different error assumptions.

Choose a section to continue.`;
    const events = [
      `event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: answer.slice(0, 90) })}`,
      `event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: answer.slice(90) })}`,
      `event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: { usage: {} } })}`,
    ].join("\n\n") + "\n\n";
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: { "access-control-allow-origin": "*" },
      body: events,
    });
  });
}

async function configureProvider(page: Page) {
  await page.goto("/#/settings");
  await page.getByRole("button", { name: /Add provider/ }).click();
  await page.getByLabel("Name").fill("Test provider");
  await page.getByLabel("Base URL").fill("https://mock.arbor.test");
  await page.getByLabel("API Key", { exact: true }).fill("test-key");
  await page.getByLabel("Model").fill("test-model");
  await page.getByText("Advanced", { exact: true }).click();
  await expect(page.getByLabel("Max output tokens")).toHaveValue("");
  await expect(page.getByLabel("Max output tokens")).toHaveAttribute("placeholder", "Auto");
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByText(/Endpoint, authentication, and model accepted/)).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Provider saved.")).toBeVisible();
}

async function mockTruncatedProvider(page: Page) {
  let generation = 0;
  await page.route(endpoint, async (route) => {
    const payload = route.request().postDataJSON() as MockPayload | null;
    if (!payload?.stream) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ id: "connection-test", output: [] }),
      });
      return;
    }
    if (payload && isTitleRequest(payload)) {
      await fulfillTitleRequest(route, payload);
      return;
    }
    expect(payload.max_output_tokens).toBeUndefined();

    generation += 1;
    const first = generation === 1;
    const longDerivation = Array.from({ length: 45 }, (_, index) => `Derivation detail ${index + 1}: $x_${index + 1}^2$.`).join("\n\n");
    const text = first
      ? `An answer that stops early.\n\n## Derivation\n\n${longDerivation}\n\nTail sentence.`
      : "Tail sentence.\n\nIt continues through the remaining derivation.";
    const terminal = first
      ? { type: "response.incomplete", response: { status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, usage: { input_tokens: 10, output_tokens: 128, total_tokens: 138 } } }
      : { type: "response.completed", response: { status: "completed", usage: { input_tokens: 20, output_tokens: 64, total_tokens: 84 } } };
    const body = [
      `event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: text })}`,
      `event: ${terminal.type}\ndata: ${JSON.stringify(terminal)}`,
    ].join("\n\n");
    if (!first) await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: { "access-control-allow-origin": "*" },
      body,
    });
  });
}

async function mockAlwaysTruncatedProvider(page: Page) {
  let generations = 0;
  await page.route(endpoint, async (route) => {
    const payload = route.request().postDataJSON() as MockPayload | null;
    if (!payload?.stream) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: "{}",
      });
      return;
    }
    expect(payload.max_output_tokens).toBeUndefined();
    generations += 1;
    const terminal = {
      type: "response.incomplete",
      response: {
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
      },
    };
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: { "access-control-allow-origin": "*" },
      body: [
        `event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: ` part-${generations}` })}`,
        `event: response.incomplete\ndata: ${JSON.stringify(terminal)}`,
      ].join("\n\n"),
    });
  });
  return () => generations;
}

test("creates anchored sibling branches and restores the current path", async ({ page }) => {
  await mockProvider(page);
  await configureProvider(page);
  await page.getByRole("button", { name: "Back to chat" }).click();

  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await composer.fill("What is least squares?");
  await composer.press("Enter");
  await expect(page.getByRole("button", { name: /Core idea/ })).toBeVisible();
  await expect(page.locator(".chat-title")).toHaveText("Least Squares Foundations");
  await expect(page.locator(".user-message").first().locator(".message-role")).toHaveCount(0);

  await page.getByRole("button", { name: /Core idea/ }).click();
  await expect(page.getByText("Based on:")).toBeVisible();
  await composer.fill("Why squared residuals?");
  await composer.press("Enter");
  await expect(page.locator(".messages").getByText("Why squared residuals?", { exact: true })).toBeVisible();
  await expect(page.locator(".user-message").last().locator(".user-anchor-label")).toHaveText("Based on: Core idea");

  await page.getByRole("button", { name: "Tree", exact: true }).click();
  const tree = page.locator(".tree-drawer");
  await expect(tree.getByRole("button", { name: "Squared Residuals Explained", exact: true })).toBeVisible();
  await expect(tree.getByRole("button", { name: "Squared Residuals Explained", exact: true })).toHaveAttribute("title", "Why squared residuals?");
  page.once("dialog", (dialog) => void dialog.accept("Residual Geometry"));
  await tree.getByRole("button", { name: "Actions for Squared Residuals Explained" }).click();
  await tree.getByRole("button", { name: "Rename" }).click();
  await expect(tree.getByRole("button", { name: "Residual Geometry", exact: true })).toBeVisible();
  await tree.getByRole("button", { name: "Least Squares Foundations", exact: true }).click();

  await page.getByRole("button", { name: /Common variants/ }).first().click();
  await composer.fill("How do the variants differ?");
  await composer.press("Enter");
  await expect(page.locator(".messages").getByText("How do the variants differ?", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await expect(tree.getByRole("button", { name: "Residual Geometry", exact: true })).toBeVisible();
  await expect(tree.getByRole("button", { name: "Least Squares Variants", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close tree" }).first().click();

  await page.reload();
  await expect(page.locator(".messages").getByText("How do the variants differ?", { exact: true })).toBeVisible();
  await expect(page.getByText("Based on: Common variants")).toBeVisible();
});

test("persists appearance and exports a schema-versioned conversation", async ({ page }) => {
  await mockProvider(page);
  await configureProvider(page);
  await page.getByLabel("Language").selectOption("zh-CN");
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "模型服务" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "回答" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "系统提示词" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "外观" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "数据" })).toBeVisible();
  await expect(page.getByRole("button", { name: /新建对话/ })).toBeVisible();
  await page.getByLabel("界面语言").selectOption("en-US");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Response" })).toBeVisible();
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Back to chat" }).click();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Create an export");
  await page.getByRole("textbox", { name: "Message", exact: true }).press("Enter");
  await expect(page.getByRole("button", { name: /Core idea/ })).toBeVisible();
  await page.getByRole("link", { name: "Settings" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.locator(".data-row").filter({ hasText: "Current conversation" }).getByRole("button", { name: "Export" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^arbor-.+\.json$/);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("automatically continues into one answer and parses sections only after stop", async ({ page }) => {
  await mockTruncatedProvider(page);
  await configureProvider(page);
  await page.getByRole("button", { name: "Back to chat" }).click();
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await composer.fill("Give me a long derivation");
  await composer.press("Enter");

  await expect(page.getByText("Continuing…")).toBeVisible();
  await expect(page.locator(".answer-section")).toHaveCount(0);
  const scroll = page.locator(".chat-scroll");
  await scroll.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect(page.getByText("Continuing…")).not.toBeVisible();
  expect(await scroll.evaluate((element) => element.scrollTop)).toBeLessThan(50);
  await expect(page.getByRole("button", { name: "Jump to latest" })).toBeVisible();
  await page.getByRole("button", { name: "Jump to latest" }).click();
  await expect.poll(() => scroll.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeLessThan(5);
  const section = page.locator(".answer-section").filter({ hasText: "Derivation" });
  await expect(section).toBeVisible();
  const sectionText = await section.innerText();
  expect(sectionText.match(/Tail sentence\./g)).toHaveLength(1);
  await expect(page.getByText("The response reached the output length limit.")).not.toBeVisible();
  await expect(page.getByLabel("Usage")).toContainText("output 192");
  await expect(page.getByLabel("Usage")).not.toContainText("completed");
});

test("offers manual continuation only after five automatic continuations", async ({ page }) => {
  const generations = await mockAlwaysTruncatedProvider(page);
  await configureProvider(page);
  await page.getByRole("button", { name: "Back to chat" }).click();
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await composer.fill("Keep going forever");
  await composer.press("Enter");

  await expect(page.getByText("The response reached the output length limit.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue generating" })).toBeVisible();
  expect(generations()).toBe(6);
  await expect(page.locator(".answer-section")).toHaveCount(0);
});
