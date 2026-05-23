import { describe, expect, it } from "vitest";
import { runDeterministicAiQuery } from "../../services/ai/aiTools";
import { sampleProject } from "../../services/backend/data";

describe("ai tools", () => {
  it("locates a device by business IP", () => {
    const device = sampleProject.devices[10];
    const result = runDeterministicAiQuery(
      `IP 为 ${device.businessIp} 的服务器在哪里？`,
      sampleProject.rooms,
      sampleProject.racks,
      sampleProject.devices,
      sampleProject.alerts,
    );

    expect(result.toolName).toBe("locate_device");
    expect(result.answer).toContain(device.businessIp!);
    expect(result.answer).toContain(device.computerName!);
    expect(result.answer).toContain("数据来源");
  });

  it("lists devices by rack name", () => {
    const rack = sampleProject.racks[0];
    const result = runDeterministicAiQuery(
      `${rack.name} 里面有哪些服务器？`,
      sampleProject.rooms,
      sampleProject.racks,
      sampleProject.devices,
      sampleProject.alerts,
    );

    expect(result.toolName).toBe("list_rack_devices");
    expect(result.answer).toContain(rack.name);
    expect(result.relatedRackId).toBe(rack.id);
  });

  it("lists rack devices with operational fields and alert summary", () => {
    const deviceWithAlert = sampleProject.devices.find((device) =>
      sampleProject.alerts.some(
        (alert) => alert.deviceId === device.id && alert.status !== "recovered",
      ),
    )!;
    const rack = sampleProject.racks.find(
      (item) => item.id === deviceWithAlert.rackId,
    )!;
    const result = runDeterministicAiQuery(
      `${rack.name} 有哪些服务器，用途责任人业务IP和告警情况？`,
      sampleProject.rooms,
      sampleProject.racks,
      sampleProject.devices,
      sampleProject.alerts,
    );

    expect(result.toolName).toBe("list_rack_devices");
    expect(result.answer).toContain("设备清单");
    expect(result.answer).toContain("业务IP");
    expect(result.answer).toContain("责任人");
    expect(result.answer).toContain("U位");
    expect(result.answer).toContain("告警");
    expect(result.answer).toContain(deviceWithAlert.computerName!);
    expect(result.answer).toContain(deviceWithAlert.owner!);
  });

  it("summarizes room devices with rack distribution and alert count", () => {
    const room = sampleProject.rooms[0];
    const result = runDeterministicAiQuery(
      `${room.name} 有哪些服务器和告警情况？`,
      sampleProject.rooms,
      sampleProject.racks,
      sampleProject.devices,
      sampleProject.alerts,
    );

    expect(result.toolName).toBe("list_room_devices");
    expect(result.answer).toContain(room.name);
    expect(result.answer).toContain("设备总数");
    expect(result.answer).toContain("机柜分布");
    expect(result.answer).toContain("活动告警");
    expect(result.answer).toContain("重点设备");
  });
});
