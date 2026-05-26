import { describe, expect, it } from "vitest";
import type { Alert, Device, Rack, Room } from "../../types/domain";
import { buildAlertLocateQuery } from "../../services/alerts/alertNavigation";

const alert: Alert = {
  id: "alert-1",
  deviceId: "dev-1",
  source: "manual",
  level: "critical",
  status: "unconfirmed",
  title: "硬盘故障",
  startedAt: "2026-05-26T08:00:00+08:00",
};

const device: Device = {
  id: "dev-1",
  rackId: "rack-1",
  categoryId: "server",
  name: "DB-SRV-01",
  computerName: "DB-SRV-01",
  businessIp: "192.168.1.10",
  ips: ["192.168.1.10"],
  side: "front",
  startU: 21,
  endU: 22,
  heightU: 2,
  status: "normal",
  ports: [],
};

const rack: Rack = {
  id: "rack-1",
  roomId: "room-1",
  name: "529-A1",
  type: "server",
  heightU: 42,
  status: "normal",
};

const room: Room = {
  id: "room-1",
  dataCenterId: "dc-1",
  name: "529数据中心",
  layoutType: "micro_module",
  defaultRackHeightU: 42,
  racks: [],
};

describe("alert navigation", () => {
  it("builds a rack overview query that opens u view and highlights the alert device", () => {
    expect(buildAlertLocateQuery(alert, [device], [rack], [room])).toEqual({
      roomId: "room-1",
      rackId: "rack-1",
      deviceId: "dev-1",
      view: "u-view",
      source: "alert",
    });
  });
});
