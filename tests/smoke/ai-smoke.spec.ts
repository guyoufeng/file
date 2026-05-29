import { expect, test } from "@playwright/test";

test("opens AI assistant and answers a read-only asset location question", async ({
  page,
}) => {
  await page.goto("/#/rack-overview");

  await page.getByRole("button", { name: "打开 AI助手" }).click();
  const drawer = page.getByTestId("ai-floating-window");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "AI 助手" })).toBeVisible();
  await expect(drawer.getByText(/当前模型/)).toBeVisible();
  await expect(drawer.getByText("只读智能查询")).toHaveCount(0);
  await expect(drawer.getByTestId("ai-message-list")).toBeVisible();
  await expect(drawer.getByTestId("ai-composer")).toBeVisible();
  await expect(drawer.getByRole("button", { name: "添加图片" })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "添加附件" })).toBeVisible();

  const promptInput = page.getByPlaceholder(
    "输入问题，按 Enter 发送，Shift+Enter 换行",
  );
  await expect(promptInput).toHaveValue("");
  await promptInput.fill("IP 为 10.10.0.21 的服务器在哪里？");
  await promptInput.press("Enter");

  await expect(drawer.getByTestId("ai-message-list")).toContainText("QF-SRV-001");
  await expect(drawer.getByTestId("ai-message-list")).toContainText("529数据中心");
  await expect(drawer.getByText("Agent 轨迹")).toBeVisible();
  await drawer.getByText("Agent 轨迹").click();
  await expect(drawer.getByText("工具完成")).toBeVisible();
  await expect(drawer.getByText(/locate_device.*只读 Agent API/).first()).toBeVisible();
  await expect(drawer.getByText(/模型：qwen3.6-35b-a3b-awq/)).toHaveCount(0);

  await drawer.getByRole("button", { name: "定位到机柜/设备" }).click();

  await expect(page).toHaveURL(/rack-overview/);
  await expect(page).toHaveURL(/deviceId=dev-001/);
  await expect(page.getByTestId("location-focus-banner")).toContainText(
    "已定位",
  );
  await expect(page.getByTestId("location-focus-banner")).toContainText(
    "529-A1",
  );
  await expect(page.getByRole("button", { name: "U位大图" })).toHaveClass(
    /active/,
  );
  await expect(page.getByTestId("location-focus-banner")).toContainText(
    "529-A1",
  );
  await expect(page.getByTestId("rack-detail-floating-window")).toHaveCount(0);
});

test("AI assistant lists readonly Agent API tools with slash command", async ({
  page,
}) => {
  await page.goto("/#/rack-overview");

  await page.getByRole("button", { name: "打开 AI助手" }).click();
  const drawer = page.getByTestId("ai-floating-window");
  const promptInput = page.getByPlaceholder(
    "输入问题，按 Enter 发送，Shift+Enter 换行",
  );

  await promptInput.fill("/tools");
  await promptInput.press("Enter");

  await expect(drawer.getByTestId("ai-message-list")).toContainText(
    "agent_search_devices",
  );
  await expect(drawer.getByTestId("ai-message-list")).toContainText(
    "GET /api/agent/v1/devices",
  );
});
