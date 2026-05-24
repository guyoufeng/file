import { describe, expect, it } from "vitest";
import type { Alert, Device, Rack, Room } from "../../types/domain";
import { getRackOverviewMetrics } from "../../features/rack-overview/metrics";

const rooms: Room[] = [
  {
    id: "room-a",
    dataCenterId: "dc-a",
    name: "A机房",
    layoutType: "simple_rows",
    defaultRackHeightU: 42,
    racks: [],
  },
  {
    id: "room-b",
    dataCenterId: "dc-a",
    name: "B机房",
    layoutType: "single_rack",
    defaultRackHeightU: 42,
    racks: [],
  },
];

const racks: Rack[] = [
  {
    id: "rack-a1",
    roomId: "room-a",
    name: "A1",
    type: "server",
    heightU: 42,
    status: "normal",
  },
  {
    id: "rack-b1",
    roomId: "room-b",
    name: "B1",
    type: "server",
    heightU: 42,
    status: "normal",
  },
];

const devices: Device[] = [
  {
    id: "dev-a1",
    rackId: "rack-a1",
    categoryId: "server",
    name: "A设备",
    ips: [],
    side: "front",
    startU: 1,
    endU: 2,
    heightU: 2,
    status: "normal",
    ports: [],
  },
  {
    id: "dev-b1",
    rackId: "rack-b1",
    categoryId: "server",
    name: "B设备",
    ips: [],
    side: "front",
    startU: 1,
    endU: 2,
    heightU: 2,
    status: "normal",
    ports: [],
  },
];

const alerts: Alert[] = [
  {
    id: "alert-a1",
    deviceId: "dev-a1",
    source: "manual",
    level: "warning",
    status: "unconfirmed",
    title: "A告警",
    startedAt: "2026-05-24T10:00:00+08:00",
  },
  {
    id: "alert-b1",
    deviceId: "dev-b1",
    source: "manual",
    level: "critical",
    status: "unconfirmed",
    title: "B告警",
    startedAt: "2026-05-24T10:00:00+08:00",
  },
];

describe("rack overview metrics", () => {
  it("separates global totals from current room metrics", () => {
    expect(getRackOverviewMetrics(rooms, racks, devices, alerts, "room-a")).toEqual({
      totalRooms: 2,
      totalDevices: 2,
      currentRacks: 1,
      currentDevices: 1,
      currentAlerts: 1,
    });
  });
});
