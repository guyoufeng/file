import { expect, test } from "@playwright/test";

test("login page uses Chervon branding and signs in as admin", async ({ page }) => {
  await page.goto("/#/login");

  await expect(page.getByRole("heading", { name: "泉峰AI数据中心管理平台" })).toBeVisible();
  await expect(page.getByTestId("chervon-login-logo")).toContainText("CHERVON");
  await expect(page.getByRole("textbox", { name: "账号" })).toHaveValue("admin");
  await page.getByRole("textbox", { name: "密码" }).fill("admin123");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page).toHaveURL(/rack-overview/);
  await expect(page.getByTestId("current-user")).toContainText("admin");
});

test("account management creates a read-only user and filters modules after login", async ({
  page,
}) => {
  await page.goto("/#/login");
  await page.getByRole("textbox", { name: "密码" }).fill("admin123");
  await page.getByRole("button", { name: "登录" }).click();

  await page.getByRole("link", { name: "系统设置" }).click();
  await page.getByRole("button", { name: "账号管理" }).click();
  await expect(page.getByRole("heading", { name: "账号管理" })).toBeVisible();

  await page.getByLabel("账号名").fill("audit");
  await page.getByLabel("显示名称").fill("审计只读");
  await page.getByLabel("初始密码").fill("audit123");
  await page.getByRole("button", { name: "创建账号" }).click();
  await expect(page.getByRole("cell", { name: "audit" })).toBeVisible();

  await page.getByTestId("current-user").click();
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.getByRole("textbox", { name: "账号" }).fill("audit");
  await page.getByRole("textbox", { name: "密码" }).fill("audit123");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page.getByRole("link", { name: "机柜总览" })).toBeVisible();
  await expect(page.getByRole("link", { name: "系统设置" })).toHaveCount(0);
});
