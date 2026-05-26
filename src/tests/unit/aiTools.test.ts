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

  it("lists devices whose warranty is expiring within a requested window", () => {
    const devices = sampleProject.devices.map((device, index) => ({
      ...device,
      warrantyExpireAt: index === 0 ? "2026-06-15" : "2028-12-31",
    }));
    const result = runDeterministicAiQuery(
      "未来60天哪些服务器即将过保？",
      sampleProject.rooms,
      sampleProject.racks,
      devices,
      sampleProject.alerts,
    );

    expect(result.toolName).toBe("search_devices");
    expect(result.answer).toContain("即将过保设备");
    expect(result.answer).toContain(devices[0].computerName!);
    expect(result.answer).toContain("2026-06-15");
    expect(result.answer).not.toContain(devices[1].computerName!);
  });

  it("searches devices by hardware memory or operating system keywords", () => {
    const result = runDeterministicAiQuery(
      "查询硬件配置包含 256GB RAM 的服务器",
      sampleProject.rooms,
      sampleProject.racks,
      sampleProject.devices,
      sampleProject.alerts,
    );

    expect(result.toolName).toBe("search_devices");
    expect(result.answer).toContain("256GB RAM");
    expect(result.answer).toContain("硬件配置");
  });

  it("finds real imported assets by hostname and owner phrasing", () => {
    const importedDevices = [
      {
        ...sampleProject.devices[0],
        id: "real-cnsmffluxdb1",
        computerName: "cnsmffluxdb1",
        name: "cnsmffluxdb1",
        businessIp: "192.168.129.200",
        managementIp: "192.168.45.200",
        ips: ["192.168.129.200", "192.168.45.200"],
        owner: "张文军",
        purpose: "MES数据库",
        metadata: {
          excelRemark: "从实际资产表导入",
        },
      },
      {
        ...sampleProject.devices[1],
        id: "real-owner-second",
        computerName: "cnsmffluxdb2",
        name: "cnsmffluxdb2",
        businessIp: "192.168.129.201",
        ips: ["192.168.129.201"],
        owner: "张文军",
      },
    ];

    const hostnameResult = runDeterministicAiQuery(
      "查看下cnsmffluxdb1",
      sampleProject.rooms,
      sampleProject.racks,
      importedDevices,
      sampleProject.alerts,
    );
    const ownerResult = runDeterministicAiQuery(
      "查看下张文军责任人的服务器",
      sampleProject.rooms,
      sampleProject.racks,
      importedDevices,
      sampleProject.alerts,
    );

    expect(hostnameResult.toolName).toBe("search_devices");
    expect(hostnameResult.relatedDeviceId).toBe("real-cnsmffluxdb1");
    expect(hostnameResult.answer).toContain("192.168.129.200");
    expect(ownerResult.toolName).toBe("search_devices");
    expect(ownerResult.answer).toContain("张文军");
    expect(ownerResult.answer).toContain("cnsmffluxdb1");
    expect(ownerResult.answer).toContain("cnsmffluxdb2");
  });

  it("supports multi-keyword rack owner purpose and subnet style internal queries", () => {
    const importedDevices = [
      {
        ...sampleProject.devices[0],
        id: "multi-keyword-hit",
        rackId: "rack-529-a2",
        computerName: "mes-db-01",
        name: "mes-db-01",
        businessIp: "192.168.129.210",
        ips: ["192.168.129.210"],
        owner: "张文军",
        purpose: "MES数据库",
      },
      {
        ...sampleProject.devices[1],
        id: "same-owner-other-rack",
        rackId: "rack-529-a1",
        computerName: "mes-app-01",
        name: "mes-app-01",
        businessIp: "192.168.130.22",
        ips: ["192.168.130.22"],
        owner: "张文军",
        purpose: "MES应用",
      },
    ];

    const multiKeywordResult = runDeterministicAiQuery(
      "张文军 529-A2 数据库",
      sampleProject.rooms,
      sampleProject.racks,
      importedDevices,
      sampleProject.alerts,
    );
    const subnetResult = runDeterministicAiQuery(
      "192.168.129 网段服务器",
      sampleProject.rooms,
      sampleProject.racks,
      importedDevices,
      sampleProject.alerts,
    );

    expect(multiKeywordResult.toolName).toBe("search_devices");
    expect(multiKeywordResult.answer).toContain("mes-db-01");
    expect(multiKeywordResult.answer).not.toContain("mes-app-01");
    expect(subnetResult.toolName).toBe("search_devices");
    expect(subnetResult.answer).toContain("192.168.129.210");
    expect(subnetResult.answer).not.toContain("192.168.130.22");
  });

  it("lists devices missing management ip or owner for data quality checks", () => {
    const devices = [
      {
        ...sampleProject.devices[0],
        id: "missing-oob",
        computerName: "missing-oob",
        managementIp: "",
        ips: [sampleProject.devices[0].businessIp!],
      },
      {
        ...sampleProject.devices[1],
        id: "complete-device",
        computerName: "complete-device",
        managementIp: "172.16.1.1",
        owner: "张文军",
      },
    ];

    const result = runDeterministicAiQuery(
      "没有带外IP的设备",
      sampleProject.rooms,
      sampleProject.racks,
      devices,
      sampleProject.alerts,
    );

    expect(result.toolName).toBe("search_devices");
    expect(result.answer).toContain("缺失带外IP设备");
    expect(result.answer).toContain("missing-oob");
    expect(result.answer).not.toContain("complete-device");
  });

  it("lists devices missing serial asset warranty or business ip for data cleanup", () => {
    const devices = [
      {
        ...sampleProject.devices[0],
        id: "missing-serial",
        computerName: "missing-serial",
        serialNumber: "",
        assetNo: "FA-001",
        warrantyExpireAt: "2027-12-31",
        businessIp: "192.168.88.10",
      },
      {
        ...sampleProject.devices[1],
        id: "missing-asset",
        computerName: "missing-asset",
        serialNumber: "SN-001",
        assetNo: "",
        warrantyExpireAt: "2027-12-31",
        businessIp: "192.168.88.11",
      },
      {
        ...sampleProject.devices[2],
        id: "missing-warranty",
        computerName: "missing-warranty",
        serialNumber: "SN-002",
        assetNo: "FA-002",
        warrantyExpireAt: "",
        businessIp: "192.168.88.12",
      },
      {
        ...sampleProject.devices[3],
        id: "missing-business-ip",
        computerName: "missing-business-ip",
        serialNumber: "SN-003",
        assetNo: "FA-003",
        warrantyExpireAt: "2027-12-31",
        businessIp: "",
        ips: [],
      },
    ];

    const serialResult = runDeterministicAiQuery(
      "没有SN号的设备",
      sampleProject.rooms,
      sampleProject.racks,
      devices,
      sampleProject.alerts,
    );
    const assetResult = runDeterministicAiQuery(
      "缺少固定资产编号的服务器",
      sampleProject.rooms,
      sampleProject.racks,
      devices,
      sampleProject.alerts,
    );
    const warrantyResult = runDeterministicAiQuery(
      "未填维保时间的设备",
      sampleProject.rooms,
      sampleProject.racks,
      devices,
      sampleProject.alerts,
    );
    const businessIpResult = runDeterministicAiQuery(
      "没有业务IP的设备",
      sampleProject.rooms,
      sampleProject.racks,
      devices,
      sampleProject.alerts,
    );

    expect(serialResult.answer).toContain("缺失SN号设备");
    expect(serialResult.answer).toContain("missing-serial");
    expect(assetResult.answer).toContain("缺失固定资产编号设备");
    expect(assetResult.answer).toContain("missing-asset");
    expect(warrantyResult.answer).toContain("缺失维保时间设备");
    expect(warrantyResult.answer).toContain("missing-warranty");
    expect(businessIpResult.answer).toContain("缺失业务IP设备");
    expect(businessIpResult.answer).toContain("missing-business-ip");
  });
});
