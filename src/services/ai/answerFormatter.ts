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
    `带外IP：${device.managementIp || "-"}`,
    `用途：${device.purpose || "-"}`,
    `责任人：${device.owner || "-"}`,
    `固定资产编号：${device.assetNo || "-"}`,
    `SN号：${device.serialNumber || "-"}`,
    `型号：${device.model || "-"}`,
    `操作系统：${device.operatingSystem || "-"}`,
    `硬件配置：${device.hardwareSpec || "-"}`,
    `维保时间：${device.warrantyExpireAt || "-"}`,
    `位置：${room?.name || "-"} / ${rack?.name || "-"} / ${device.side === "front" ? "正面" : "背面"} ${device.startU}U-${device.endU}U`,
    `状态：${device.status}`,
    `活动告警：${activeAlerts.length} 条`,
  ].join("\n");
}

export function formatDeviceSearchAnswer(
  matches: Array<{ device: Device; rack: Rack | undefined; room: Room | undefined; matchedText: string }>,
  alerts: Alert[],
): string {
  if (matches.length === 0) {
    return "未在平台资产库中找到匹配设备。可以尝试输入计算机名、业务IP、带外IP、固定资产编号、SN号、用途或责任人。";
  }

  if (matches.length === 1) {
    const match = matches[0];
    return [
      "匹配设备：1 台",
      `匹配字段：${match.matchedText}`,
      "",
      formatDeviceLocationAnswer(match.device, match.rack, match.room, alerts),
    ].join("\n");
  }

  const activeAlerts = alerts.filter((alert) => alert.status !== "recovered");
  const lines = matches.slice(0, 20).map(({ device, rack, room, matchedText }, index) => {
    const alertCount = activeAlerts.filter((alert) => alert.deviceId === device.id).length;
    return [
      `${index + 1}. ${device.computerName || device.name}`,
      `业务IP：${device.businessIp || "-"}`,
      `带外IP：${device.managementIp || "-"}`,
      `用途：${device.purpose || "-"}`,
      `责任人：${device.owner || "-"}`,
      `硬件配置：${device.hardwareSpec || "-"}`,
      `位置：${room?.name || "-"} / ${rack?.name || "-"} / ${device.side === "front" ? "正面" : "背面"} ${device.startU}U-${device.endU}U`,
      `匹配：${matchedText}`,
      `告警：${alertCount}条`,
    ].join(" / ");
  });

  return [
    `匹配设备：${matches.length} 台`,
    "",
    ...lines,
    matches.length > 20
      ? `仅展示前 20 台，剩余 ${matches.length - 20} 台可继续缩小条件查询。`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatWarrantyExpiringAnswer(
  matches: Array<{ device: Device; rack: Rack | undefined; room: Room | undefined; daysLeft: number }>,
  windowDays: number,
): string {
  if (matches.length === 0) {
    return `未来 ${windowDays} 天内暂无维保即将到期设备。`;
  }

  return [
    `即将过保设备：${matches.length} 台`,
    `统计窗口：未来 ${windowDays} 天`,
    "",
    ...matches.slice(0, 20).map(({ device, rack, room, daysLeft }, index) =>
      [
        `${index + 1}. ${device.computerName || device.name}`,
        `业务IP：${device.businessIp || "-"}`,
        `责任人：${device.owner || "-"}`,
        `维保时间：${device.warrantyExpireAt || "-"}`,
        `剩余：${daysLeft}天`,
        `位置：${room?.name || "-"} / ${rack?.name || "-"} / ${device.startU}U-${device.endU}U`,
      ].join(" / "),
    ),
    matches.length > 20
      ? `仅展示前 20 台，剩余 ${matches.length - 20} 台可继续缩小条件查询。`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatMissingFieldAnswer(
  label: string,
  matches: Array<{ device: Device; rack: Rack | undefined; room: Room | undefined }>,
): string {
  if (matches.length === 0) {
    return `暂无${label}。`;
  }

  return [
    `${label}：${matches.length} 台`,
    "",
    ...matches.slice(0, 20).map(({ device, rack, room }, index) =>
      [
        `${index + 1}. ${device.computerName || device.name}`,
        `业务IP：${device.businessIp || "-"}`,
        `带外IP：${device.managementIp || "-"}`,
        `责任人：${device.owner || "-"}`,
        `位置：${room?.name || "-"} / ${rack?.name || "-"} / ${device.startU}U-${device.endU}U`,
      ].join(" / "),
    ),
    matches.length > 20
      ? `仅展示前 20 台，剩余 ${matches.length - 20} 台可继续缩小条件查询。`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
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
      `带外IP：${device.managementIp || "-"}`,
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

function alertLevelLabel(level: Alert["level"]): string {
  if (level === "critical") return "严重";
  if (level === "warning") return "警告";
  return "提示";
}

function findDeviceLocation(
  device: Device,
  racks: Rack[],
  rooms: Room[],
): string {
  const rack = racks.find((item) => item.id === device.rackId);
  const room = rooms.find((item) => item.id === rack?.roomId);
  return `${room?.name || "-"} / ${rack?.name || "-"} / ${device.side === "front" ? "正面" : "背面"} ${device.startU}U-${device.endU}U`;
}

export function formatActiveAlertDevicesAnswer(
  rooms: Room[],
  racks: Rack[],
  devices: Device[],
  alerts: Alert[],
): string {
  const activeAlerts = alerts.filter((alert) => alert.status !== "recovered");
  const alertDevices = devices
    .map((device) => ({
      device,
      alerts: activeAlerts.filter((alert) => alert.deviceId === device.id),
    }))
    .filter((item) => item.alerts.length > 0)
    .slice(0, 20);

  return [
    `当前活动告警设备：${alertDevices.length} 台`,
    `活动告警总数：${activeAlerts.length} 条`,
    "",
    ...alertDevices.map(({ device, alerts: deviceAlerts }, index) => {
      const highest = deviceAlerts.some((alert) => alert.level === "critical")
        ? "严重"
        : "警告";
      return [
        `${index + 1}. ${device.computerName || device.name}`,
        `业务IP：${device.businessIp || "-"}`,
        `位置：${findDeviceLocation(device, racks, rooms)}`,
        `责任人：${device.owner || "-"}`,
        `告警：${deviceAlerts.length}条，最高${highest}`,
        `最新：${deviceAlerts[0]?.title || "-"}`,
      ].join(" / ");
    }),
  ].join("\n");
}

export function formatDeviceAlertsAnswer(
  device: Device,
  rooms: Room[],
  racks: Rack[],
  alerts: Alert[],
): string {
  const activeAlerts = alerts.filter(
    (alert) => alert.deviceId === device.id && alert.status !== "recovered",
  );
  const lines =
    activeAlerts.length > 0
      ? activeAlerts.map(
          (alert, index) =>
            `${index + 1}. ${alertLevelLabel(alert.level)}(${alert.level}) / ${alert.title} / ${alert.description || "-"} / 状态：${alert.status} / 开始：${alert.startedAt}`,
        )
      : ["无活动告警"];

  return [
    `设备：${device.computerName || device.name}`,
    `业务IP：${device.businessIp || "-"}`,
    `带外IP：${device.managementIp || "-"}`,
    `位置：${findDeviceLocation(device, racks, rooms)}`,
    `责任人：${device.owner || "-"}`,
    `告警详情：${activeAlerts.length} 条`,
    ...lines,
  ].join("\n");
}

export function formatRackAlertRankingAnswer(
  rooms: Room[],
  racks: Rack[],
  devices: Device[],
  alerts: Alert[],
): string {
  const activeAlerts = alerts.filter((alert) => alert.status !== "recovered");
  const devicesByRack = new Map<string, Device[]>();
  for (const device of devices) {
    devicesByRack.set(device.rackId, [
      ...(devicesByRack.get(device.rackId) || []),
      device,
    ]);
  }

  const rankings = racks
    .map((rack) => {
      const rackDevices = devicesByRack.get(rack.id) || [];
      const rackDeviceIds = new Set(rackDevices.map((device) => device.id));
      const rackAlerts = activeAlerts.filter((alert) =>
        rackDeviceIds.has(alert.deviceId),
      );
      return {
        rack,
        room: rooms.find((room) => room.id === rack.roomId),
        alerts: rackAlerts,
        criticalCount: rackAlerts.filter((alert) => alert.level === "critical")
          .length,
      };
    })
    .filter((item) => item.alerts.length > 0)
    .sort(
      (first, second) =>
        second.alerts.length - first.alerts.length ||
        second.criticalCount - first.criticalCount,
    )
    .slice(0, 10);

  return [
    "机柜告警排行",
    `活动告警总数：${activeAlerts.length} 条`,
    "",
    ...rankings.map(
      (item, index) =>
        `${index + 1}. ${item.room?.name || "-"} / ${item.rack.name}：活动告警 ${item.alerts.length} 条，严重 ${item.criticalCount} 条`,
    ),
    "",
    "建议：优先处理严重告警数量最多的机柜，并结合机柜图定位到具体 U 位和责任人。",
  ].join("\n");
}
