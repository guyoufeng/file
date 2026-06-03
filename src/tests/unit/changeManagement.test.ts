import { beforeEach, describe, expect, it } from "vitest";
import {
  createChangeEvent,
  deleteChangeEvent,
  getChangeEvents,
  importChangeEventsFromRows,
  searchChangeEvents,
  updateChangeEvent,
} from "../../features/change-management/changeEvents";

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

describe("change management", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("records rack server and cabling changes with device linkage", () => {
    const event = createChangeEvent({
      title: "MES-DB-01 更换内存并调整接线",
      type: "maintenance",
      status: "completed",
      roomId: "room-nj-529",
      roomName: "529数据中心",
      rackId: "rack-529-a2",
      rackName: "529-A2",
      deviceId: "dev-mes-db-01",
      deviceName: "MES-DB-01",
      businessIp: "10.11.0.27",
      operator: "admin",
      changedAt: "2026-06-02T20:00:00+08:00",
      content: "更换 ECC 内存，接入 SW-529-A1 GE1/0/11。",
      impact: "业务无中断",
      result: "完成验证",
      relatedConnectionId: "conn-1",
      attachments: ["memory-after.jpg"],
    });

    expect(getChangeEvents()).toHaveLength(1);
    expect(searchChangeEvents("10.11.0.27")[0].deviceName).toBe("MES-DB-01");
    expect(searchChangeEvents("接线")[0].rackName).toBe("529-A2");

    const updated = updateChangeEvent(event.id, { status: "reviewed", result: "复核完成" });
    expect(updated?.status).toBe("reviewed");
    expect(updated?.result).toBe("复核完成");

    deleteChangeEvent(event.id);
    expect(getChangeEvents()).toHaveLength(0);
  });

  it("imports Excel-like rows and keeps newest change records first", () => {
    const imported = importChangeEventsFromRows([
      {
        变更标题: "QF-SRV-001 上架",
        变更类型: "物理机上架",
        状态: "已完成",
        设备名称: "QF-SRV-001",
        业务IP: "10.10.0.21",
        机房: "529数据中心",
        机柜: "529-A1",
        操作人: "张三",
        变更时间: "2026-06-01 10:00:00",
        变更内容: "服务器上架并接入生产网络",
      },
      {
        标题: "QF-SRV-002 接线复核",
        类型: "接线调整",
        状态: "进行中",
        设备: "QF-SRV-002",
        IP: "10.10.0.22",
        操作人: "李四",
        时间: "2026-06-02 12:00:00",
        内容: "复核交换机 GE1/0/12 端口",
      },
    ]);

    expect(imported).toHaveLength(2);
    expect(getChangeEvents()[0].title).toBe("QF-SRV-002 接线复核");
    expect(searchChangeEvents("GE1/0/12")[0].type).toBe("cabling");
  });
});
