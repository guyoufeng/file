import type { Alert, Device, Rack, Room } from "../../types/domain";

export interface AnswerSource {
  label: string;
  queriedAt: string;
}

export function sourceFooter(source: AnswerSource): string {
  return `\n\n数据来源：${source.label}\n查询时间：${source.queriedAt}`;
}

export function formatDeviceLocationAnswer(
  device: Device,
  rack: Rack | undefined,
  room: Room | undefined,
  alerts: Alert[],
): string {
  const activeAlerts = alerts.filter(
    (alert) => alert.deviceId === device.id && alert.status !== "recovered",
  );
  return [
    `设备：${device.computerName || device.name}`,
    `业务IP：${device.businessIp || "-"}`,
    `用途：${device.purpose || "-"}`,
    `责任人：${device.owner || "-"}`,
    `位置：${room?.name || "-"} / ${rack?.name || "-"} / ${device.side === "front" ? "正面" : "背面"} ${device.startU}U-${device.endU}U`,
    `状态：${device.status}`,
    `活动告警：${activeAlerts.length} 条`,
  ].join("\n");
}

export function formatRackDeviceListAnswer(
  rack: Rack,
  room: Room | undefined,
  devices: Device[],
  alerts: Alert[],
): string {
  const activeAlerts = alerts.filter((alert) => alert.status !== "recovered");
  const rackActiveAlerts = activeAlerts.filter((alert) =>
    devices.some((device) => device.id === alert.deviceId),
  );
  const lines = devices.slice(0, 20).map((device, index) => {
    const deviceAlerts = activeAlerts.filter(
      (alert) => alert.deviceId === device.id,
    );
    const alertText =
      deviceAlerts.length > 0
        ? `${deviceAlerts.length}条，最高${deviceAlerts.some((alert) => alert.level === "critical") ? "严重" : "警告"}`
        : "无";

    return [
      `${index + 1}. ${device.computerName || device.name}`,
      `业务IP：${device.businessIp || "-"}`,
      `用途：${device.purpose || "-"}`,
      `责任人：${device.owner || "-"}`,
      `U位：${device.side === "front" ? "正面" : "背面"} ${device.startU}U-${device.endU}U`,
      `状态：${device.status}`,
      `告警：${alertText}`,
    ].join(" / ");
  });

  return [
    `机柜：${room?.name || "-"} / ${rack.name}`,
    `设备清单：${devices.length} 台`,
    `活动告警：${rackActiveAlerts.length} 条`,
    "",
    ...lines,
    devices.length > 20
      ? `仅展示前 20 台，剩余 ${devices.length - 20} 台可继续追问。`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatRoomDeviceSummaryAnswer(
  room: Room,
  racks: Rack[],
  devices: Device[],
  alerts: Alert[],
): string {
  const rackById = new Map(racks.map((rack) => [rack.id, rack]));
  const activeAlerts = alerts.filter((alert) => alert.status !== "recovered");
  const roomDeviceIds = new Set(devices.map((device) => device.id));
  const roomAlerts = activeAlerts.filter((alert) =>
    roomDeviceIds.has(alert.deviceId),
  );
  const rackDistribution = racks
    .map((rack) => ({
      rack,
      count: devices.filter((device) => device.rackId === rack.id).length,
    }))
    .filter((item) => item.count > 0)
    .slice(0, 8)
    .map((item) => `${item.rack.name}：${item.count}台`);
  const keyDevices = devices.slice(0, 8).map((device) => {
    const rack = rackById.get(device.rackId);
    const alertCount = roomAlerts.filter(
      (alert) => alert.deviceId === device.id,
    ).length;
    return `${device.computerName || device.name} / ${device.businessIp || "-"} / ${rack?.name || "-"} / ${device.purpose || "-"} / 告警${alertCount}条`;
  });

  return [
    `机房：${room.name}`,
    `设备总数：${devices.length} 台`,
    `机柜数量：${racks.length} 个`,
    `活动告警：${roomAlerts.length} 条`,
    `机柜分布：${rackDistribution.length > 0 ? rackDistribution.join("，") : "-"}`,
    "",
    "重点设备：",
    ...keyDevices.map((device) => `- ${device}`),
  ].join("\n");
}
