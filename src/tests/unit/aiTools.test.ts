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
    expect(result.answer).toContain(device.managementIp!);
    expect(result.answer).toContain("带外IP");
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

  it("lists active alert devices with location and owner", () => {
    const alert = sampleProject.alerts.find(
      (item) => item.status !== "recovered",
    )!;
    const device = sampleProject.devices.find(
      (item) => item.id === alert.deviceId,
    )!;
    const result = runDeterministicAiQuery(
      "现在有哪些服务器有告警？",
      sampleProject.rooms,
      sampleProject.racks,
      sampleProject.devices,
      sampleProject.alerts,
    );

    expect(result.toolName).toBe("list_alert_devices");
    expect(result.answer).toContain("当前活动告警设备");
    expect(result.answer).toContain(device.computerName!);
    expect(result.answer).toContain("位置");
    expect(result.answer).toContain("责任人");
    expect(result.answer).toContain(alert.title);
  });

  it("shows active alerts for a specific device IP", () => {
    const alert = sampleProject.alerts.find(
      (item) => item.status !== "recovered",
    )!;
    const device = sampleProject.devices.find(
      (item) => item.id === alert.deviceId,
    )!;
    const result = runDeterministicAiQuery(
      `${device.businessIp} 有什么告警？`,
      sampleProject.rooms,
      sampleProject.racks,
      sampleProject.devices,
      sampleProject.alerts,
    );

    expect(result.toolName).toBe("list_alert_devices");
    expect(result.relatedDeviceId).toBe(device.id);
    expect(result.answer).toContain(device.computerName!);
    expect(result.answer).toContain("告警详情");
    expect(result.answer).toContain(alert.title);
    expect(result.answer).toContain(alert.level);
  });

  it("ranks racks by active alert count", () => {
    const result = runDeterministicAiQuery(
      "哪个机柜告警最多？",
      sampleProject.rooms,
      sampleProject.racks,
      sampleProject.devices,
      sampleProject.alerts,
    );

    expect(result.toolName).toBe("list_alert_devices");
    expect(result.answer).toContain("机柜告警排行");
    expect(result.answer).toContain("活动告警");
    expect(result.answer).toContain("严重");
    expect(result.answer).toContain("建议");
  });

  it("searches internal devices by hostname serial asset owner or purpose", () => {
    const device = sampleProject.devices[7];
    const result = runDeterministicAiQuery(
      `查询 ${device.serialNumber} 这台设备的详细信息`,
      sampleProject.rooms,
      sampleProject.racks,
      sampleProject.devices,
      sampleProject.alerts,
    );

    expect(result.toolName).toBe("search_devices");
    expect(result.relatedDeviceId).toBe(device.id);
    expect(result.answer).toContain(device.computerName!);
    expect(result.answer).toContain(device.serialNumber!);
    expect(result.answer).toContain(device.assetNo!);
    expect(result.answer).toContain(device.hardwareSpec!);
  });

  it("lists multiple internal device matches with concise operational fields", () => {
    const owner = sampleProject.devices[0].owner!;
    const result = runDeterministicAiQuery(
      `${owner} 负责哪些服务器？`,
      sampleProject.rooms,
      sampleProject.racks,
      sampleProject.devices,
      sampleProject.alerts,
    );

    expect(result.toolName).toBe("search_devices");
    expect(result.answer).toContain("匹配设备");
    expect(result.answer).toContain(owner);
    expect(result.answer).toContain("业务IP");
    expect(result.answer).toContain("位置");
  });
});
