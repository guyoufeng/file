import { beforeEach, describe, expect, it } from "vitest";
import {
  createChangeEvent,
  deleteChangeEvent,
  getChangeEvents,
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
});
