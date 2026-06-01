import { beforeEach, describe, expect, it } from "vitest";
import {
  createAccessRecord,
  deleteAccessRecord,
  getAccessRecords,
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
});
