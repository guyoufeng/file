import { describe, expect, it } from "vitest";
import { runDeterministicAiQuery } from "../../services/ai/aiTools";
import type { AccessRecord } from "../../features/access-management/accessRecords";
import type { Device, Rack, Room } from "../../types/domain";

const room: Room = {
  id: "room-529",
  dataCenterId: "dc-1",
  name: "529数据中心",
  layoutType: "micro_module",
  defaultRackHeightU: 42,
  racks: [],
};

const rack: Rack = {
  id: "rack-a1",
  roomId: "room-529",
  name: "529-A1",
  type: "server",
  heightU: 42,
  status: "normal",
};

const device: Device = {
  id: "dev-1",
  rackId: "rack-a1",
  categoryId: "server",
  name: "数据库服务器",
  computerName: "db01",
  businessIp: "192.168.11.191",
  ips: ["192.168.11.191"],
  side: "front",
  startU: 10,
  endU: 11,
  heightU: 2,
  status: "normal",
  ports: [],
};

const records: AccessRecord[] = [
  {
    id: "access-1",
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
    createdAt: "2026-06-01T01:10:00.000Z",
    updatedAt: "2026-06-01T02:40:00.000Z",
  },
];

describe("AI access record query", () => {
  it("answers maintenance and entry history for a physical server", () => {
    const result = runDeterministicAiQuery(
      "192.168.11.191 最近有没有维修和进出记录？",
      [room],
      [rack],
      [device],
      [],
      [],
      [],
      records,
    );

    expect(result.toolName).toBe("search_access_records");
    expect(result.relatedDeviceId).toBe("dev-1");
    expect(result.answer).toContain("ECC 内存报警");
    expect(result.answer).toContain("维保厂家");
    expect(result.answer).toContain("更换内存并观察");
  });
});
