import { access, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { LocalServiceDataSource } from "../../../local-service/dataSource";

let tempDir = "";

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("local service data source", () => {
  it("persists snapshot and audit records through the unified local service data source", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "qf-ai-dcim-service-"));
    const dataSource = new LocalServiceDataSource(tempDir);
    await dataSource.init();

    await dataSource.saveSnapshot({
      schemaVersion: "0.1.0",
      generatedAt: "2026-06-05T00:00:00.000Z",
      data: {
        rooms: [],
        racks: [],
        devices: [],
        alerts: [],
        auditLogs: [],
        accessRecords: [],
        changeEvents: [],
        connectionRecords: [],
      },
    });
    await dataSource.appendAudit({
      actor: "external-agent",
      action: "agent_api.devices.read",
      targetType: "agent_api",
      requiredScope: "read",
      status: "success",
      summary: "读取设备接口",
      metadata: { endpoint: "/api/agent/v1/devices" },
    });

    expect((await dataSource.loadSnapshot())?.generatedAt).toBe("2026-06-05T00:00:00.000Z");
    expect(await dataSource.loadAuditLogs()).toEqual([
      expect.objectContaining({
        actor: "external-agent",
        action: "agent_api.devices.read",
        status: "success",
        metadata: { endpoint: "/api/agent/v1/devices" },
      }),
    ]);
    dataSource.close();
  });

  it("persists business collections, write approvals and gateway messages in sqlite", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "qf-ai-dcim-service-"));
    const dataSource = new LocalServiceDataSource(tempDir);
    await dataSource.init();

    await dataSource.saveCollection("operations.changeEvents", [
      { id: "change-1", title: "服务器增加显卡" },
    ]);
    expect(await dataSource.loadCollection("operations.changeEvents")).toEqual([
      { id: "change-1", title: "服务器增加显卡" },
    ]);

    const approval = await dataSource.createWriteApproval({
      actor: "admin",
      module: "change-management",
      action: "create",
      summary: "新增变更记录：服务器增加显卡",
      payload: { title: "服务器增加显卡" },
    });
    expect(approval.status).toBe("pending");

    const approved = await dataSource.decideWriteApproval({
      id: approval.id,
      status: "approved",
      decisionBy: "admin",
      decisionNote: "确认写入",
    });
    expect(approved?.status).toBe("approved");
    expect(await dataSource.loadWriteApprovals()).toEqual([
      expect.objectContaining({
        id: approval.id,
        status: "approved",
        decisionBy: "admin",
      }),
    ]);

    const gatewayMessage = await dataSource.appendGatewayMessage({
      provider: "wechat",
      externalUserId: "wx-user-1",
      displayName: "微信用户",
      direction: "inbound",
      content: "查询 529-A1 有哪些服务器",
      rawPayload: { text: "查询 529-A1 有哪些服务器" },
    });
    expect(gatewayMessage.id).toMatch(/^gateway-message-/);
    expect(await dataSource.loadGatewayMessages()).toEqual([
      expect.objectContaining({
        provider: "wechat",
        content: "查询 529-A1 有哪些服务器",
      }),
    ]);

    const backup = await dataSource.createBackup();
    await expect(access(backup.path)).resolves.toBeUndefined();

    dataSource.close();
  });
});
