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

test("opens a movable asset detail window with relations changes qr and topology", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/#/assets");

  await page.getByRole("button", { name: "查看 QF-SRV-001 资产详情" }).click();
  const detailWindow = page.getByRole("dialog", { name: "资产详情 QF-SRV-001" });
  await expect(detailWindow).toBeVisible();
  await expect(detailWindow).toContainText("详细信息");
  await expect(detailWindow).toContainText("实例关系");
  await expect(detailWindow).toContainText("变更记录");
  await expect(detailWindow).toContainText("二维码");
  await expect(detailWindow).toContainText("默认拓扑");
  await expect(detailWindow).toContainText("新建拓扑");

  await detailWindow.getByRole("button", { name: "实例关系" }).click();
  await expect(detailWindow).toContainText("所属机柜");
  await detailWindow.getByRole("button", { name: "变更记录" }).click();
  await expect(detailWindow).toContainText("新增变更记录");
  await detailWindow.getByRole("button", { name: "二维码" }).click();
  await expect(detailWindow.getByTestId("asset-qr-code")).toBeVisible();

  await page.locator(".page-header").click({ position: { x: 8, y: 8 } });
  await expect(detailWindow).toHaveCount(0);
});
