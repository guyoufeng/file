import { describe, expect, it } from "vitest";
import { buildAgentWriteDraft, updateAgentWriteDraftField } from "../../services/ai/agentWriteDraft";
import type { Device, Rack, Room } from "../../types/domain";

const room: Room = {
  id: "room-529",
  dataCenterId: "dc-nj",
  name: "529数据中心",
  layoutType: "micro_module",
  defaultRackHeightU: 42,
  racks: [],
};

const rack: Rack = {
  id: "rack-529-a1",
  roomId: "room-529",
  name: "529-A1",
  type: "server",
  heightU: 42,
  status: "normal",
};

const device: Device = {
  id: "dev-qf-srv-001",
  rackId: "rack-529-a1",
  categoryId: "server",
  name: "物理服务器",
  computerName: "QF-SRV-001",
  businessIp: "10.10.0.21",
  managementIp: "172.16.0.21",
  ips: ["10.10.0.21", "172.16.0.21"],
  side: "front",
  startU: 39,
  endU: 41,
  heightU: 3,
  status: "normal",
  ports: [],
};

describe("AI agent write draft", () => {
  it("turns access-management natural language into a confirmable form draft", () => {
    const draft = buildAgentWriteDraft({
      question: "我要在进出管理里面录入信息，2026年6月4号，529机房保洁进去打扫卫生",
      rooms: [room],
      racks: [rack],
      devices: [device],
    });

    expect(draft).toMatchObject({
      kind: "access_record",
      title: "请确认进出记录",
    });
    expect(draft?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "date", value: "2026-06-04" }),
        expect.objectContaining({ key: "unit", value: "保洁" }),
        expect.objectContaining({ key: "visitorName", value: "保洁" }),
        expect.objectContaining({ key: "reason", value: expect.stringContaining("529机房保洁进去打扫卫生") }),
      ]),
    );
  });

  it("routes change-management natural language to a change draft and can update fields", () => {
    const draft = buildAgentWriteDraft({
      question: "现在在变更管理录入信息，服务器10.10.0.21修改了网线，增加了内存条",
      rooms: [room],
      racks: [rack],
      devices: [device],
    });

    expect(draft).toMatchObject({
      kind: "change_event",
      targetDeviceId: "dev-qf-srv-001",
    });

    const nextDraft = updateAgentWriteDraftField(draft!, "status", "reviewed");

    expect(nextDraft.fields.find((field) => field.key === "status")?.value).toBe("reviewed");
    expect(nextDraft.fields.find((field) => field.key === "deviceName")?.value).toBe("QF-SRV-001");
  });

  it("prefills asset update fields from natural language patches", () => {
    const draft = buildAgentWriteDraft({
      question: "更新服务器10.10.0.21的信息，责任人改为李四，用途改为数据库服务",
      rooms: [room],
      racks: [rack],
      devices: [device],
    });

    expect(draft).toMatchObject({
      kind: "asset_update",
      targetDeviceId: "dev-qf-srv-001",
    });
    expect(draft?.fields.find((field) => field.key === "owner")?.value).toBe("李四");
    expect(draft?.fields.find((field) => field.key === "purpose")?.value).toBe("数据库服务");
  });
});
