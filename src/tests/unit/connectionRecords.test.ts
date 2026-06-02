import { beforeEach, describe, expect, it } from "vitest";
import {
  createConnectionRecord,
  deleteConnectionRecord,
  getConnectionRecords,
  searchConnectionRecords,
  updateConnectionRecord,
} from "../../features/connection-manager/connections";

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

describe("connection records", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("creates searches updates and deletes physical cabling records", () => {
    const record = createConnectionRecord({
      sourceDeviceId: "server-1",
      sourceDeviceName: "MES-DB-01",
      sourcePortName: "eth0",
      targetDeviceId: "switch-1",
      targetDeviceName: "SW-529-A1",
      targetPortName: "GE1/0/11",
      cableNo: "CAB-529-A1-011",
      cableType: "万兆光纤",
      direction: "front_to_rear",
      status: "active",
      notes: "生产网链路",
    });

    expect(getConnectionRecords()).toHaveLength(1);
    expect(searchConnectionRecords("MES-DB")).toHaveLength(1);
    expect(searchConnectionRecords("GE1/0/11")[0].cableNo).toBe("CAB-529-A1-011");

    const updated = updateConnectionRecord(record.id, {
      status: "planned",
      notes: "计划迁移到核心交换机",
    });
    expect(updated?.status).toBe("planned");
    expect(updated?.notes).toContain("核心交换机");

    deleteConnectionRecord(record.id);
    expect(getConnectionRecords()).toHaveLength(0);
  });
});
