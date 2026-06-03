import { beforeEach, describe, expect, it } from "vitest";
import {
  buildConnectionNodeSummaries,
  createConnectionRecord,
  deleteConnectionRecord,
  ensureDemoConnectionRecords,
  getConnectionRecords,
  getSavedConnectionViews,
  saveConnectionView,
  searchConnectionRecords,
  updateConnectionRecord,
} from "../../features/connection-manager/connections";
import type { Device } from "../../types/domain";

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

  it("seeds demo switch cabling only once and persists saved topology views", () => {
    const devices = [
      {
        id: "dev-qf-srv-001",
        rackId: "rack-529-a1",
        categoryId: "cat-server",
        name: "物理服务器",
        computerName: "QF-SRV-001",
        businessIp: "10.10.0.21",
        ips: ["10.10.0.21"],
        side: "front",
        startU: 39,
        endU: 41,
        heightU: 3,
        status: "normal",
        ports: [],
      },
      {
        id: "dev-qf-srv-002",
        rackId: "rack-529-a1",
        categoryId: "cat-server",
        name: "物理服务器",
        computerName: "QF-SRV-002",
        businessIp: "10.10.0.22",
        ips: ["10.10.0.22"],
        side: "front",
        startU: 30,
        endU: 33,
        heightU: 4,
        status: "normal",
        ports: [],
      },
    ] satisfies Device[];

    const seeded = ensureDemoConnectionRecords(devices);
    expect(seeded.length).toBeGreaterThanOrEqual(2);
    expect(searchConnectionRecords("SW-529").length).toBeGreaterThan(0);
    expect(ensureDemoConnectionRecords(devices)).toHaveLength(seeded.length);

    const view = saveConnectionView({
      name: "529生产网",
      selectedDeviceIds: ["dev-qf-srv-001"],
      keyword: "QF-SRV",
      zoom: 1.2,
      nodePositions: {
        "dev-qf-srv-001": { x: 120, y: 160 },
      },
    });

    expect(getSavedConnectionViews()[0]).toMatchObject({
      id: view.id,
      name: "529生产网",
      selectedDeviceIds: ["dev-qf-srv-001"],
      zoom: 1.2,
    });
  });

  it("summarizes switch nodes by link and port counts instead of a single reused port", () => {
    const records = [
      {
        id: "conn-1",
        sourceDeviceId: "server-1",
        sourceDeviceName: "QF-SRV-001",
        sourcePortName: "eth0",
        targetDeviceId: "switch-core-a",
        targetDeviceName: "SW-529-CORE-A",
        targetPortName: "GE1/0/1",
        direction: "uplink" as const,
        status: "active" as const,
        createdAt: "2026-06-03T00:00:00.000Z",
        updatedAt: "2026-06-03T00:00:00.000Z",
      },
      {
        id: "conn-2",
        sourceDeviceId: "server-2",
        sourceDeviceName: "QF-SRV-002",
        sourcePortName: "eth0",
        targetDeviceId: "switch-core-a",
        targetDeviceName: "SW-529-CORE-A",
        targetPortName: "GE1/0/2",
        direction: "uplink" as const,
        status: "active" as const,
        createdAt: "2026-06-03T00:00:00.000Z",
        updatedAt: "2026-06-03T00:00:00.000Z",
      },
    ];

    const summaries = buildConnectionNodeSummaries(records);
    const switchSummary = summaries.find((item) => item.id === "switch-core-a");

    expect(switchSummary?.subtitle).toBe("2 条链路 / 2 个端口");
    expect(switchSummary?.links.map((item) => item.localPort)).toEqual(["GE1/0/1", "GE1/0/2"]);
  });
});
