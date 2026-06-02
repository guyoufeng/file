import { describe, expect, it } from "vitest";
import {
  buildAgentReadonlySnapshot,
  filterAgentAlerts,
  filterAgentAuditLogs,
  filterAgentChangeEvents,
  filterAgentConnections,
  filterAgentDevices,
  filterAgentRacks,
} from "../../services/agent/readonlyApi";
import type { Alert, AuditLog, Device, Rack, Room } from "../../types/domain";

const rooms: Room[] = [
  {
    id: "room-529",
    dataCenterId: "dc-nanjing",
    name: "529数据中心",
    layoutType: "micro_module",
    defaultRackHeightU: 42,
    racks: [],
  },
];

const racks: Rack[] = [
  {
    id: "rack-529-a1",
    roomId: "room-529",
    name: "529-A1",
    type: "server",
    rowName: "A排",
    columnIndex: 1,
    heightU: 42,
    status: "normal",
  },
];

const devices: Device[] = [
  {
    id: "device-cnsmffluxdb1",
    rackId: "rack-529-a1",
    categoryId: "server",
    name: "数据库服务器",
    computerName: "cnsmffluxdb1",
    businessIp: "192.168.129.200",
    managementIp: "172.16.1.20",
    ips: ["192.168.129.200", "172.16.1.20"],
    purpose: "数据库服务",
    owner: "张文军",
    side: "front",
    startU: 31,
    endU: 32,
    heightU: 2,
    status: "normal",
    ports: [],
  },
];

const alerts: Alert[] = [
  {
    id: "alert-1",
    deviceId: "device-cnsmffluxdb1",
    source: "manual",
    level: "warning",
    status: "unconfirmed",
    title: "硬盘告警",
    startedAt: "2026-05-29T08:00:00+08:00",
  },
];

const auditLogs: AuditLog[] = [
  {
    id: "audit-1",
    actor: "AI助手",
    action: "ai_readonly_query",
    targetType: "device",
    targetId: "device-cnsmffluxdb1",
    summary: "查询 cnsmffluxdb1",
    createdAt: "2026-05-29 08:00:00",
    metadata: { status: "success" },
  },
];

describe("agent readonly api helpers", () => {
  it("builds a readonly snapshot without leaking ai model api keys", () => {
    const snapshot = buildAgentReadonlySnapshot({
      schemaVersion: "0.1.0",
      exportedAt: "2026-05-29T00:00:00.000Z",
      data: {
        rooms,
        racks,
        devices,
        alerts,
        auditLogs,
        aiModelConfigs: [
          {
            id: "ai-local",
            provider: "gpustack",
            name: "GPUStack",
            baseUrl: "http://192.168.127.8/v1",
            model: "qwen3.6-35b-a3b-awq",
            apiKeyRef: "secret-key",
            enabled: true,
          },
        ],
      },
    });

    expect(snapshot.readonly).toBe(true);
    expect(snapshot.data.devices).toHaveLength(1);
    expect(snapshot.data.aiModelConfigs?.[0]).not.toHaveProperty("apiKeyRef");
  });

  it("filters devices by keyword ip owner rack and room", () => {
    expect(filterAgentDevices({ rooms, racks, devices }, { q: "cnsmffluxdb1" })).toHaveLength(1);
    expect(filterAgentDevices({ rooms, racks, devices }, { ip: "192.168.129.200" })).toHaveLength(1);
    expect(filterAgentDevices({ rooms, racks, devices }, { owner: "张文军" })).toHaveLength(1);
    expect(filterAgentDevices({ rooms, racks, devices }, { rackId: "rack-529-a1" })).toHaveLength(1);
    expect(filterAgentDevices({ rooms, racks, devices }, { roomId: "room-529" })).toHaveLength(1);
    expect(filterAgentDevices({ rooms, racks, devices }, { q: "不存在" })).toHaveLength(0);
  });

  it("filters racks alerts and audit logs for agent queries", () => {
    expect(filterAgentRacks({ racks }, { roomId: "room-529" })).toHaveLength(1);
    expect(filterAgentAlerts({ alerts }, { status: "unconfirmed" })).toHaveLength(1);
    expect(filterAgentAuditLogs({ auditLogs }, { q: "cnsmffluxdb1" })).toHaveLength(1);
  });

  it("filters change events and connection records for agent queries", () => {
    const changeEvents = [
      {
        id: "change-1",
        title: "cnsmffluxdb1 更换内存",
        type: "maintenance" as const,
        status: "completed" as const,
        deviceId: "device-cnsmffluxdb1",
        deviceName: "cnsmffluxdb1",
        businessIp: "192.168.129.200",
        operator: "admin",
        changedAt: "2026-06-02T10:00:00+08:00",
        content: "更换 ECC 内存并验证完成。",
        attachments: [],
        createdAt: "2026-06-02T10:00:00+08:00",
        updatedAt: "2026-06-02T10:00:00+08:00",
      },
    ];
    const connectionRecords = [
      {
        id: "conn-1",
        sourceDeviceId: "device-cnsmffluxdb1",
        sourceDeviceName: "cnsmffluxdb1",
        sourcePortName: "eth0",
        targetDeviceId: "switch-1",
        targetDeviceName: "SW-529-A1",
        targetPortName: "GE1/0/11",
        cableNo: "CAB-001",
        cableType: "万兆光纤",
        direction: "front_to_rear" as const,
        status: "active" as const,
        notes: "生产网",
        createdAt: "2026-06-02T10:00:00+08:00",
        updatedAt: "2026-06-02T10:00:00+08:00",
      },
    ];

    expect(filterAgentChangeEvents({ changeEvents }, { q: "ECC" })).toHaveLength(1);
    expect(filterAgentConnections({ connectionRecords }, { q: "GE1/0/11" })).toHaveLength(1);
  });
});
