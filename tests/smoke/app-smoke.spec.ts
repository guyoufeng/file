import { expect, test } from "@playwright/test";

test("starts the app and navigates through v0.1 core pages", async ({
  page,
}) => {
  await page.goto("/#/rack-overview");

  await expect(page.getByRole("heading", { name: "机柜总览" })).toBeVisible();
  await expect(page.getByRole("button", { name: "529数据中心" })).toBeVisible();
  await expect(page.getByText("208")).toBeVisible();
  await expect(page.getByRole("button", { name: "系统展示" })).toBeVisible();
  await expect(page.getByTestId("current-user")).toHaveText("admin");
  await expect(page.getByTestId("app-clock")).toBeVisible();
  await expect(page.getByRole("button", { name: "打开 AI助手" })).toBeVisible();
  await expect(page.getByText("南京 / 529数据中心")).toHaveCount(0);
  await expect(page.getByText("只读AI查询")).toHaveCount(0);

  await page.getByRole("button", { name: "U位大图" }).click();
  const uView = page.getByTestId("rack-u-overview");
  await expect(
    page.getByRole("button", { name: "50%", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "75%", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "125%", exact: true }),
  ).toHaveClass(/active/);
  await expect(
    uView.getByTestId("rack-u-row-A排").getByText("529-A1", { exact: true }),
  ).toBeVisible();
  await expect(
    uView.getByTestId("rack-u-row-A排").getByText("529-A10", { exact: true }),
  ).toBeVisible();
  await expect(
    uView.getByTestId("rack-u-row-B排").getByText("529-B1", { exact: true }),
  ).toBeVisible();
  await uView
    .getByTestId("rack-u-row-A排")
    .getByRole("button", { name: /^529-A1\b/ })
    .click();
  await expect(page.getByTestId("rack-detail-floating-window")).toBeVisible();
  await expect(page.getByTestId("selected-rack-detail-title")).toHaveText(
    "529-A1",
  );
  await expect(
    page
      .getByTestId("rack-detail-floating-window")
      .getByRole("button", { name: "标准" }),
  ).toHaveCount(0);
  await expect(
    page
      .getByTestId("rack-detail-floating-window")
      .getByRole("button", { name: "放大" }),
  ).toHaveCount(0);
  await expect(
    page
      .getByTestId("rack-detail-floating-window")
      .getByRole("button", { name: "收起" }),
  ).toBeVisible();
  await expect(page.locator(".overview-grid")).not.toHaveClass(/detail-open/);
  await page
    .getByTestId("rack-detail-floating-window")
    .getByRole("button", { name: "编辑 QF-SRV-001" })
    .click();
  await expect(page.getByRole("heading", { name: "编辑设备" })).toBeVisible();
  await page.getByLabel("用途").fill("核心生产业务");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByTestId("rack-detail-floating-window")).toHaveCount(0);
  await expect(page.getByTestId("location-focus-banner")).toContainText(
    "QF-SRV-001",
  );

  await page.getByRole("button", { name: "3D轻量视图" }).click();
  await expect(
    page.locator('canvas[aria-label="3D轻量机柜视图"]'),
  ).toBeVisible();

  await page.getByRole("link", { name: "告警中心" }).click();
  await expect(page.getByRole("heading", { name: "告警中心" })).toBeVisible();

  await page.getByRole("link", { name: "虚拟服务器" }).click();
  await expect(page.getByRole("heading", { name: "虚拟服务器管理" })).toBeVisible();
  await expect(page.getByRole("button", { name: "MCP同步" })).toBeVisible();

  await page.getByRole("link", { name: "报表中心" }).click();
  await expect(page.getByRole("heading", { name: "报表中心" })).toBeVisible();

  await page.getByRole("link", { name: "系统设置" }).click();
  await expect(page.getByRole("heading", { name: "系统设置" })).toBeVisible();
});

test("asset import replace mode is opt-in", async ({ page }) => {
  await page.goto("/#/assets");
  await page.getByRole("button", { name: "导入Excel" }).click();

  const replaceCheckbox = page.getByLabel("清空当前设备后导入这份 Excel");
  await expect(replaceCheckbox).not.toBeChecked();
});

test("project restore refreshes current browser data without manual reload", async ({
  page,
}) => {
  await page.goto("/#/settings");
  await page.getByRole("button", { name: "数据管理" }).click();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("恢复示例数据");
    await dialog.accept("恢复示例数据");
  });
  await page.getByRole("button", { name: "恢复示例数据" }).click();

  await expect(page.getByText("机房、机柜、资产、告警和 AI 配置已刷新")).toBeVisible();
});

test("project import shows a review preview before confirmation", async ({
  page,
}) => {
  await page.goto("/#/settings");
  await page.getByRole("button", { name: "数据管理" }).click();

  const project = {
    schemaVersion: "0.1.0",
    exportedAt: "2026-05-25T08:00:00.000Z",
    data: {
      dataCenters: [
        { id: "dc-preview", name: "预览数据中心", location: "南京", rooms: [] },
      ],
      rooms: [
        {
          id: "room-preview",
          dataCenterId: "dc-preview",
          name: "预览机房",
          layoutType: "single_rack",
          defaultRackHeightU: 42,
          racks: [],
        },
      ],
      racks: [
        {
          id: "rack-preview",
          roomId: "room-preview",
          name: "PREVIEW-A1",
          type: "server",
          heightU: 42,
          status: "normal",
        },
      ],
      devices: [],
      alerts: [],
      aiModelConfigs: [],
    },
  };

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("将导入 1 个机房");
    await dialog.dismiss();
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: "preview-project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project), "utf-8"),
  });

  await expect(page.getByLabel("项目导入预览")).toBeVisible();
  await expect(page.getByText("1 机房")).toBeVisible();
  await expect(page.getByText("1 机柜")).toBeVisible();
  await expect(page.getByText("导入后会覆盖当前拓扑、资产和告警数据")).toBeVisible();
});
