import { beforeEach, describe, expect, it } from "vitest";
import {
  createAccessRecord,
  deleteAccessRecord,
  getAccessRecords,
  importAccessRecords,
  searchAccessRecords,
  updateAccessRecord,
} from "../../features/access-management/accessRecords";

function installLocalStorage() {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
    configurable: true,
  });
}

describe("data center access records", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("creates, updates, searches and deletes entry/exit records", () => {
    const record = createAccessRecord({
      date: "2026-06-01",
      unit: "维保厂家",
      visitorName: "李工",
      enterTime: "09:10",
      leaveTime: "10:40",
      reason: "物理机维修",
      isServerRepair: true,
      deviceId: "dev-1",
      deviceName: "db01",
      faultDescription: "ECC 内存报警",
      result: "更换内存并观察",
      attachments: ["photo-1.jpg"],
    });

    expect(getAccessRecords()).toHaveLength(1);
    expect(searchAccessRecords("ECC")).toHaveLength(1);
    expect(searchAccessRecords("db01")).toHaveLength(1);

    const updated = updateAccessRecord(record.id, { leaveTime: "11:00" });
    expect(updated?.leaveTime).toBe("11:00");

    deleteAccessRecord(record.id);
    expect(getAccessRecords()).toEqual([]);
  });

  it("imports the real access Excel shape even when visitor name is missing", () => {
    const imported = importAccessRecords([
      {
        日期: "2026-06-02",
        单位: "服务器维保厂家",
        地点: "529数据中心",
        进入时间: "1899-12-30T13:42:00.000Z",
        离开时间: "1899-12-30T15:18:00.000Z",
        事由: "处理虚拟化服务器重启问题",
        固定资产编号: "QF-FA-001",
        资产说明: "QF-SRV-001",
        IP地址: "10.10.0.21",
        用途描述: "虚拟化资源池",
      } as Record<string, unknown>,
    ]);

    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({
      date: "2026-06-02",
      unit: "服务器维保厂家",
      visitorName: "服务器维保厂家",
      enterTime: "13:42",
      leaveTime: "15:18",
      isServerRepair: true,
    });
    expect(imported[0].deviceName).toContain("QF-SRV-001");
    expect(imported[0].deviceName).toContain("10.10.0.21");
  });
});
