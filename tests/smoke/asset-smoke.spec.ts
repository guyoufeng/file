import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test("shows asset table and locates a server from rack overview search", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/#/assets");

  await expect(page.getByRole("heading", { name: "资产管理" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "物理服务器" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("QF-SRV-001")).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "172.16.0.21" }).first(),
  ).toBeVisible();

  await page.goto("/#/rack-overview");
  await page
    .getByPlaceholder("搜索计算机名、业务IP、SN、资产编号、责任人")
    .fill("QF-SRV-001");
  await page.getByRole("button", { name: /QF-SRV-001/ }).click();

  await expect(page.getByText("设备详情")).toBeVisible();
  await expect(page.getByText("端口 / 连线")).toBeVisible();
});
