import { expect, test, type Page } from "@playwright/test";

const endpoint = "https://mock.arbor.test/v1/responses";

async function mockProvider(page: Page) {
  await page.route(endpoint, async (route) => {
    const payload = route.request().postDataJSON() as { stream?: boolean } | null;
    if (!payload?.stream) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ id: "connection-test", output: [] }),
      });
      return;
    }

    const answer = JSON.stringify({
      intro: "Least squares estimates parameters by minimizing squared residuals.",
      sections: [
        { id: "idea", title: "Core idea", content: "Choose parameters that minimize the sum of squared residuals." },
        { id: "types", title: "Common variants", content: "OLS, WLS, and TLS use different error assumptions." },
      ],
      outro: "Choose a section to continue.",
    });
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
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByText(/Endpoint, authentication, and model accepted/)).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Provider saved.")).toBeVisible();
}

test("creates anchored sibling branches and restores the current path", async ({ page }) => {
  await mockProvider(page);
  await configureProvider(page);
  await page.getByRole("button", { name: "Back to chat" }).click();

  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await composer.fill("What is least squares?");
  await composer.press("Enter");
  await expect(page.getByRole("button", { name: /Core idea/ })).toBeVisible();

  await page.getByRole("button", { name: /Core idea/ }).click();
  await expect(page.getByText("Based on:")).toBeVisible();
  await composer.fill("Why squared residuals?");
  await composer.press("Enter");
  await expect(page.getByText("Why squared residuals?")).toBeVisible();

  await page.getByRole("button", { name: "Tree", exact: true }).click();
  const tree = page.locator(".tree-drawer");
  await expect(tree.getByRole("button", { name: "Why squared residuals?" })).toBeVisible();
  await tree.getByRole("button", { name: "What is least squares?" }).click();

  await page.getByRole("button", { name: /Common variants/ }).first().click();
  await composer.fill("How do the variants differ?");
  await composer.press("Enter");
  await expect(page.locator(".messages").getByText("How do the variants differ?", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await expect(tree.getByRole("button", { name: "Why squared residuals?" })).toBeVisible();
  await expect(tree.getByRole("button", { name: "How do the variants differ?" })).toBeVisible();
  await page.getByRole("button", { name: "Close tree" }).first().click();

  await page.reload();
  await expect(page.locator(".messages").getByText("How do the variants differ?", { exact: true })).toBeVisible();
  await expect(page.getByText(/from Common variants/)).toBeVisible();
});

test("persists appearance and exports a schema-versioned conversation", async ({ page }) => {
  await mockProvider(page);
  await configureProvider(page);
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
