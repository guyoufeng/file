import { describe, expect, it, vi } from "vitest";
import { defaultAccountPermissions, type AuthSession } from "../../services/auth/accountAccess";
import { executeAgentWriteCommand } from "../../services/ai/agentWriteTools";
import type { Device, Rack, Room } from "../../types/domain";

const room: Room = {
  id: "room-529",
  dataCenterId: "dc-nj",
  name: "529数据中心",
  layoutType: "micro_module",
  defaultRackHeightU: 42,
  racks: [],
};

const rack: Rack = {
  id: "rack-529-a1",
  roomId: "room-529",
  name: "529-A1",
  type: "server",
  heightU: 42,
  status: "normal",
};

const device: Device = {
  id: "dev-qf-srv-001",
  rackId: "rack-529-a1",
  categoryId: "server",
  name: "物理服务器",
  computerName: "QF-SRV-001",
  businessIp: "10.10.0.21",
  managementIp: "172.16.0.21",
  ips: ["10.10.0.21", "172.16.0.21"],
  purpose: "生产业务",
  owner: "张三",
  side: "front",
  startU: 39,
  endU: 41,
  heightU: 3,
  status: "normal",
  ports: [],
};

const adminSession: AuthSession = {
  accountId: "account-admin",
  username: "admin",
  displayName: "系统管理员",
  role: "admin",
  permissions: defaultAccountPermissions("admin"),
  signedInAt: "2026-06-03T00:00:00.000Z",
};

const viewerSession: AuthSession = {
  accountId: "account-readonly",
  username: "readonly",
  displayName: "只读账号",
  role: "viewer",
  permissions: defaultAccountPermissions("viewer"),
  signedInAt: "2026-06-03T00:00:00.000Z",
};

describe("AI agent write tools", () => {
  it("allows admin to update asset fields through natural language", async () => {
    const saveDevice = vi.fn(async (next: Device) => next);

    const result = await executeAgentWriteCommand({
      question: "把 QF-SRV-001 的责任人改成李四，用途改成虚拟化资源池",
      session: adminSession,
      rooms: [room],
      racks: [rack],
      devices: [device],
      dependencies: { saveDevice },
    });

    expect(result?.status).toBe("success");
    expect(saveDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "dev-qf-srv-001",
        owner: "李四",
        purpose: "虚拟化资源池",
      }),
    );
    expect(result?.answer).toContain("已更新资产");
  });

  it("allows admin to create a physical server asset through natural language", async () => {
    const saveDevice = vi.fn(async (next: Device) => next);

    const result = await executeAgentWriteCommand({
      question: "新增服务器：计算机名 QF-SRV-NEW，业务IP 10.10.9.9，带外IP 172.16.9.9，机柜 529-A1，U位 21-22，责任人 王五，用途 测试业务",
      session: adminSession,
      rooms: [room],
      racks: [rack],
      devices: [device],
      dependencies: { saveDevice },
    });

    expect(result?.status).toBe("success");
    expect(saveDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        rackId: "rack-529-a1",
        computerName: "QF-SRV-NEW",
        businessIp: "10.10.9.9",
        managementIp: "172.16.9.9",
        startU: 21,
        endU: 22,
        heightU: 2,
        owner: "王五",
        purpose: "测试业务",
      }),
    );
    expect(result?.answer).toContain("已新增资产");
  });

  it("blocks viewer write attempts and does not call write dependencies", async () => {
    const saveDevice = vi.fn(async (next: Device) => next);

    const result = await executeAgentWriteCommand({
      question: "把 QF-SRV-001 的责任人改成李四",
      session: viewerSession,
      rooms: [room],
      racks: [rack],
      devices: [device],
      dependencies: { saveDevice },
    });

    expect(result?.status).toBe("denied");
    expect(result?.answer).toContain("没有资产管理修改权限");
    expect(saveDevice).not.toHaveBeenCalled();
  });

  it("allows admin to create access and change records through natural language", async () => {
    const createAccessRecord = vi.fn((input) => ({ id: "access-1", ...input }));
    const createChangeEvent = vi.fn((input) => ({ id: "change-1", ...input }));

    const access = await executeAgentWriteCommand({
      question: "新增进出记录：日期2026-06-03，单位维保厂家，人员王工，事由检查 QF-SRV-001 重启问题",
      session: adminSession,
      rooms: [room],
      racks: [rack],
      devices: [device],
      dependencies: { createAccessRecord },
    });
    const change = await executeAgentWriteCommand({
      question: "新增变更记录：QF-SRV-001 更换内存并完成验证",
      session: adminSession,
      rooms: [room],
      racks: [rack],
      devices: [device],
      dependencies: { createChangeEvent },
    });

    expect(access?.status).toBe("success");
    expect(createAccessRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-06-03",
        unit: "维保厂家",
        visitorName: "王工",
        deviceId: "dev-qf-srv-001",
      }),
    );
    expect(change?.status).toBe("success");
    expect(createChangeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("QF-SRV-001"),
        deviceId: "dev-qf-srv-001",
      }),
    );
  });
});
