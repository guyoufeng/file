import type { Page } from "@playwright/test";

export async function loginAsAdmin(page: Page) {
  await page.goto("/#/login");
  await page.getByRole("textbox", { name: "账号" }).fill("admin");
  await page.getByRole("textbox", { name: "密码" }).fill("admin123");
  await page.getByRole("button", { name: "登录" }).click();
}
