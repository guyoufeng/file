import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test("starts the app and navigates through v0.1 core pages", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await loginAsAdmin(page);
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
  await expect(
    page.getByRole("button", { name: "U位大图", exact: true }),
  ).toHaveClass(/active/);
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
  await page.getByRole("button", { name: "手动录入" }).click();
  await expect(page.getByRole("heading", { name: "新增虚拟服务器" })).toBeVisible();
  await page.getByLabel("虚拟机名").fill("MES-VM-DB-01");
  await page.getByLabel("业务IP").fill("192.168.129.90");
  await page.getByLabel("用途").fill("MES数据库虚拟机");
  await page.getByLabel("宿主物理服务器").fill("QF-SRV-001");
  await page.getByRole("button", { name: "保存虚拟服务器" }).click();
  await expect(page.getByRole("cell", { name: "MES-VM-DB-01" })).toBeVisible();
  await expect(page.getByText("已录入虚拟服务器：MES-VM-DB-01")).toBeVisible();

  await page.getByRole("link", { name: "报表中心" }).click();
  await expect(page.getByRole("heading", { name: "报表中心" })).toBeVisible();

  await page.getByRole("link", { name: "系统设置" }).click();
  await expect(page.getByRole("heading", { name: "系统设置" })).toBeVisible();
});

test("asset import replace mode is opt-in", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/#/assets");
  await page.getByRole("button", { name: "导入Excel" }).click();

  const replaceCheckbox = page.getByLabel("清空当前设备后导入这份 Excel");
  await expect(replaceCheckbox).not.toBeChecked();
});

test("room context menu supports renaming an existing room", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/#/rack-overview");
  await page.locator(".overview-metrics div", { hasText: "总机房" }).click({
    button: "right",
  });

  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /新增机房/ })).toBeVisible();
  await page.getByRole("menuitem", { name: /修改现有机房/ }).click();
  await page.getByLabel("选择机房").selectOption("room-nj-99");
  await page.getByLabel("机房名称").fill("99数据中心测试");
  await page.getByRole("button", { name: "保存" }).click();

  await expect(page.getByRole("button", { name: "99数据中心测试" })).toBeVisible();
});

test("rack context menu supports renaming an existing rack", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/#/rack-overview");
  await page.locator(".overview-metrics div", { hasText: "当前机柜" }).click({
    button: "right",
  });

  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /新增机柜/ })).toBeVisible();
  await page.getByRole("menuitem", { name: /修改现有机柜/ }).click();
  await page.getByLabel("选择机柜").selectOption("rack-529-a1");
  await page.getByLabel("机柜名称").fill("529-A1测试");
  await page.getByRole("button", { name: "保存" }).click();

  await expect(page.getByRole("button", { name: /529-A1测试/ })).toBeVisible();
});

test("room and rack context menus manage a temporary room without touching existing rooms", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/#/rack-overview");

  await page.locator(".overview-metrics div", { hasText: "总机房" }).click({
    button: "right",
  });
  await page.getByRole("menuitem", { name: /新增机房/ }).click();
  await page.getByLabel("机房名称").fill("临时测试机房");
  await page.getByRole("button", { name: "确认新增" }).click();
  await expect(page.getByRole("button", { name: "临时测试机房" })).toBeVisible();

  await page.locator(".overview-metrics div", { hasText: "当前机柜" }).click({
    button: "right",
  });
  await page.getByRole("menuitem", { name: /新增机柜/ }).click();
  await page.getByLabel("机柜名称").fill("TEMP-A1");
  await page.getByLabel("机柜类型").selectOption("server");
  await page.getByRole("button", { name: "确认新增" }).click();
  await expect(page.getByRole("button", { name: /TEMP-A1/ })).toBeVisible();

  await page.locator(".overview-metrics div", { hasText: "当前机柜" }).click({
    button: "right",
  });
  await page.getByRole("menuitem", { name: /修改现有机柜/ }).click();
  await page.getByLabel("选择机柜").selectOption("rack-temp-a1");
  await page.getByLabel("机柜名称").fill("TEMP-A1-改名");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByRole("button", { name: /TEMP-A1-改名/ })).toBeVisible();

  await page.locator(".overview-metrics div", { hasText: "总机房" }).click({
    button: "right",
  });
  await page.getByRole("menuitem", { name: /修改现有机房/ }).click();
  await page.getByLabel("选择机房").selectOption("room-new-room");
  await page.getByLabel("机房名称").fill("临时测试机房-改名");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByRole("button", { name: "临时测试机房-改名" })).toBeVisible();

  await page.locator(".overview-metrics div", { hasText: "当前机柜" }).click({
    button: "right",
  });
  await page.getByRole("menuitem", { name: /删除现有机柜/ }).click();
  await page.getByLabel("选择机柜").selectOption("rack-temp-a1");
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByRole("button", { name: /TEMP-A1-改名/ })).toHaveCount(0);

  await page.getByRole("link", { name: "系统设置" }).click();
  await page.getByRole("button", { name: "数据管理" }).click();
  await expect(page.getByRole("heading", { name: "回收站 / 恢复中心" })).toBeVisible();
  await expect(page.getByLabel("可恢复拓扑")).toContainText("TEMP-A1-改名");
  await page.getByRole("link", { name: "机柜总览" }).click();

  await page.locator(".overview-metrics div", { hasText: "当前机柜" }).click({
    button: "right",
  });
  await page.getByRole("menuitem", { name: /恢复已删除机柜/ }).click();
  await page.getByRole("button", { name: /TEMP-A1-改名/ }).click();
  await expect(page.getByRole("button", { name: /TEMP-A1-改名/ })).toBeVisible();

  await page.locator(".overview-metrics div", { hasText: "总机房" }).click({
    button: "right",
  });
  await page.getByRole("menuitem", { name: /删除现有机房/ }).click();
  await page.getByLabel("选择机房").selectOption("room-new-room");
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByRole("button", { name: "临时测试机房-改名" })).toHaveCount(0);

  await page.getByRole("link", { name: "系统设置" }).click();
  await page.getByRole("button", { name: "数据管理" }).click();
  await page.getByRole("button", { name: /恢复 临时测试机房-改名/ }).click();
  await expect(page.getByText("已恢复机房：临时测试机房-改名")).toBeVisible();
  await page.getByRole("link", { name: "机柜总览" }).click();
  await expect(page.getByRole("button", { name: "临时测试机房-改名" })).toBeVisible();
  await page.getByRole("button", { name: "临时测试机房-改名" }).click();
  await expect(page.getByRole("button", { name: /TEMP-A1-改名/ })).toBeVisible();

  await page.locator(".overview-metrics div", { hasText: "总机房" }).click({
    button: "right",
  });
  await page.getByRole("menuitem", { name: /删除现有机房/ }).click();
  await page.getByLabel("选择机房").selectOption("room-new-room");
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByRole("button", { name: "临时测试机房-改名" })).toHaveCount(0);

  await page.getByRole("link", { name: "系统设置" }).click();
  await page.getByRole("button", { name: "审计日志" }).click();
  await expect(page.locator(".pill", { hasText: "新增机房" }).first()).toBeVisible();
  await expect(page.locator(".pill", { hasText: "修改机房" }).first()).toBeVisible();
  await expect(page.locator(".pill", { hasText: "恢复机房" }).first()).toBeVisible();
  await page.getByRole("link", { name: "机柜总览" }).click();

  for (const roomName of [
    "529数据中心",
    "99数据中心",
    "308数据中心",
    "杭州数据中心",
    "越南C7数据中心",
  ]) {
    await expect(page.getByRole("button", { name: roomName })).toBeVisible();
  }
});

test("alert locate opens rack u view and highlights the related device", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/#/alerts");
  await page.getByRole("heading", { name: "告警中心" }).waitFor();
  await page.locator("tbody button", { hasText: "定位" }).first().click();

  await expect(page).toHaveURL(/rack-overview/);
  await expect(
    page.getByRole("button", { name: "U位大图", exact: true }),
  ).toHaveClass(/active/);
  await expect(page.getByTestId("location-focus-banner")).toContainText("已定位");
  await expect(page.getByTestId("rack-u-overview")).toBeVisible();
});

test("light theme keeps rack visualization and context menus on pale surfaces", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.evaluate(() => localStorage.setItem("qf-ai-dcim.theme", "light"));
  await page.goto("/#/rack-overview");

  await expect(page.getByRole("heading", { name: "机柜总览" })).toBeVisible();
  const backgroundSignature = async (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((element) => {
        const style = window.getComputedStyle(element);
        return `${style.backgroundColor} ${style.backgroundImage}`;
      });
  const darkSurfacePattern =
    /rgba?\((5, 10, 22|8, 17, 31|17, 24, 39|2, 6, 23|10, 18, 32|11, 23, 40|6, 17, 31)/;

  await expect.poll(() => backgroundSignature(".rack-u-view")).not.toMatch(darkSurfacePattern);

  await page.getByRole("button", { name: "布局总览" }).click();
  await expect.poll(() => backgroundSignature(".module-section")).not.toMatch(darkSurfacePattern);

  await page.getByRole("button", { name: "3D轻量视图" }).click();
  await expect.poll(() => backgroundSignature(".rack-3d-view")).not.toMatch(darkSurfacePattern);

  await page.locator(".overview-metrics div", { hasText: "总机房" }).click({
    button: "right",
  });
  await expect
    .poll(async () => {
      const style = await page.getByRole("menu").evaluate((element) => {
        const computed = window.getComputedStyle(element);
        return `${computed.backgroundColor} ${computed.backgroundImage}`;
      });
      return style;
    })
    .not.toMatch(darkSurfacePattern);
});

test("alert webhook is managed from a compact floating window", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/#/alerts");

  await page.getByRole("button", { name: "Webhook接入" }).click();
  await expect(page.getByRole("dialog", { name: "告警 Webhook 接入" })).toBeVisible();
  await page.getByLabel("Webhook名称").fill("卓豪硬件告警");
  await page.getByLabel("Webhook来源").selectOption("zoho");
  await page.getByRole("button", { name: "创建Webhook" }).click();

  await expect(page.getByRole("dialog", { name: "告警 Webhook 接入" })).toContainText("卓豪硬件告警");
});

test("access records are created from a compact floating window", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/#/access-records");

  await page.getByRole("button", { name: "新增进出记录" }).click();
  await expect(page.getByRole("dialog", { name: "新增进出记录" })).toBeVisible();
  await page.getByLabel("单位").fill("维保厂家");
  await page.getByLabel("人员").fill("李工");
  await page.getByRole("button", { name: "新增", exact: true }).click();

  await expect(page.getByRole("cell", { name: /维保厂家/ })).toBeVisible();
});

test("AI Agent settings shows readonly Agent API status and tools", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/#/settings");

  await page.getByRole("button", { name: "AI Agent" }).click();
  await expect(page.getByLabel("AI Agent 工作台")).toContainText("角色定义");
  await expect(page.getByLabel("AI Agent 工作台")).toContainText("长期记忆");
  await expect(page.getByLabel("AI Agent 工作台")).toContainText("Skill 管理");
  await expect(page.getByLabel("AI Agent 工作台")).toContainText("知识库");
  await expect(page.getByLabel("AI Agent 工作台")).toContainText("账号凭据");
  await expect(page.getByRole("region", { name: "CMDB / MCP 工具接入" })).toContainText("工具接入");
  await expect(page.getByRole("region", { name: "Agent 执行记录" })).toContainText("Agent 执行记录");
  await expect(page.getByText("天气查询 Skill")).toHaveCount(0);
  await expect(page.getByText("网页搜索 Skill")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "只读 Agent API" })).toBeVisible();
  await page.getByRole("button", { name: "测试 API" }).click();

  await expect(page.getByText("API 可用", { exact: true })).toBeVisible();
  await expect(page.getByText("agent_search_devices")).toBeVisible();
  await expect(page.getByText("GET /api/agent/v1/devices")).toBeVisible();
  await expect(page.getByLabel("只读 API 访问令牌")).toContainText("只读访问令牌");
  await expect(page.getByText("外部 Agent 调用示例")).toBeVisible();
  await expect(page.getByText("/api/agent/v1/openapi.json")).toBeVisible();
});

test("project restore refreshes current browser data without manual reload", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/#/settings");
  await page.getByRole("button", { name: "数据管理" }).click();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("恢复示例数据");
    await dialog.accept("恢复示例数据");
  });
  await page.getByRole("button", { name: "恢复示例数据" }).click();

  await expect(page.getByText("机房、机柜、资产、告警和 AI 配置已刷新")).toBeVisible();
});

test("readonly agent api snapshot exposes current asset data", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/#/settings");
  await page.getByRole("button", { name: "数据管理" }).click();
  await expect(page.getByLabel("只读 Agent API 配置")).toContainText("/api/agent/v1/devices");
  await page.getByRole("button", { name: "同步只读API快照" }).click();
  await expect(page.getByText("只读 Agent API 快照已同步")).toBeVisible();

  const health = await page.request.get("/api/agent/v1/health");
  expect(health.ok()).toBe(true);
  await expect.poll(async () => (await health.json()).readonly).toBe(true);

  const devices = await page.request.get("/api/agent/v1/devices?q=QF-SRV-001");
  expect(devices.ok()).toBe(true);
  const payload = (await devices.json()) as { data: Array<{ computerName?: string }> };
  expect(payload.data.some((device) => device.computerName === "QF-SRV-001")).toBe(true);

  const tools = await page.request.get("/api/agent/v1/tools");
  expect(tools.ok()).toBe(true);
  const toolPayload = (await tools.json()) as { data: Array<{ name: string; readonly: boolean }> };
  expect(toolPayload.data.some((tool) => tool.name === "agent_search_devices" && tool.readonly)).toBe(true);

  const openapi = await page.request.get("/api/agent/v1/openapi.json");
  expect(openapi.ok()).toBe(true);
  const openapiPayload = (await openapi.json()) as { paths: Record<string, unknown> };
  expect(openapiPayload.paths).toHaveProperty("/devices");
});

test("project import shows a review preview before confirmation", async ({
  page,
}) => {
  await loginAsAdmin(page);
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
