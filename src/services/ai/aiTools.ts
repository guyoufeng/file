import type { Alert, Device, Rack, Room } from "../../types/domain";
import {
  formatActiveAlertDevicesAnswer,
  formatDeviceAlertsAnswer,
  formatDeviceLocationAnswer,
  formatDeviceSearchAnswer,
  formatMissingFieldAnswer,
  formatRackDeviceListAnswer,
  formatRackAlertRankingAnswer,
  formatRoomDeviceSummaryAnswer,
  formatWarrantyExpiringAnswer,
  sourceFooter,
} from "./answerFormatter";
import { searchDevices } from "../search/deviceSearch";

export type AiToolName =
  | "general_chat"
  | "search_devices"
  | "get_device_detail"
  | "locate_device"
  | "list_rack_devices"
  | "list_room_devices"
  | "list_alert_devices"
  | "summarize_room_status";

export interface AiToolResult {
  toolName: AiToolName;
  answer: string;
  relatedDeviceId?: string;
  relatedRoomId?: string;
  relatedRackId?: string;
}

export function runDeterministicAiQuery(
  question: string,
  rooms: Room[],
  racks: Rack[],
  devices: Device[],
  alerts: Alert[],
): AiToolResult {
  const queriedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const normalized = question.toLowerCase();
  const ip = question.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/)?.[0];
  const ipPrefix = question.match(/\b\d{1,3}(?:\.\d{1,3}){2}\b/)?.[0];
  const asksAlert = /告警|报警|异常|故障/.test(question);
  const asksAlertRanking =
    asksAlert && /最多|排行|排名|哪个机柜/.test(question);
  const asksWarranty = /过保|维保.*到期|到期.*维保|保修.*到期|即将.*到期/.test(question);
  const asksMissingManagementIp = /没有|缺少|为空|未填/.test(question) && /带外IP|带外ip|管理IP|管理ip|OOB|oob/.test(question);
  const asksMissingOwner = /没有|缺少|为空|未填/.test(question) && /责任人|负责人/.test(question);
  const asksDeviceSearch =
    /查询|查下|查一下|查看|看下|看一下|搜索|负责|用途|资产|编号|sn|SN|详细|详情|哪些服务器|哪些设备|硬件配置|内存|cpu|CPU|操作系统|型号/.test(
      question,
    );

  if (ip) {
    const device = devices.find(
      (item) =>
        item.businessIp === ip ||
        item.managementIp === ip ||
        item.ips.includes(ip),
    );
    if (device) {
      const rack = racks.find((item) => item.id === device.rackId);
      const room = rooms.find((item) => item.id === rack?.roomId);
      if (asksAlert) {
        return {
          toolName: "list_alert_devices",
          relatedDeviceId: device.id,
          relatedRackId: rack?.id,
          relatedRoomId: room?.id,
          answer:
            formatDeviceAlertsAnswer(device, rooms, racks, alerts) +
            sourceFooter({ label: "本地资产库、机柜库、告警库", queriedAt }),
        };
      }
      return {
        toolName: "locate_device",
        relatedDeviceId: device.id,
        relatedRackId: rack?.id,
        relatedRoomId: room?.id,
        answer:
          formatDeviceLocationAnswer(device, rack, room, alerts) +
          sourceFooter({ label: "本地资产库、机柜库、告警库", queriedAt }),
      };
    }
  }

  if (!ip && ipPrefix && /网段|服务器|设备|资产|查询|查看|查/.test(question)) {
    const candidates = searchDevices(ipPrefix, devices, racks, rooms);
    if (candidates.length > 0) {
      return {
        toolName: "search_devices",
        relatedDeviceId: candidates.length === 1 ? candidates[0].device.id : undefined,
        relatedRackId: candidates.length === 1 ? candidates[0].rack?.id : undefined,
        relatedRoomId: candidates.length === 1 ? candidates[0].room?.id : undefined,
        answer:
          formatDeviceSearchAnswer(candidates, alerts) +
          sourceFooter({ label: "本地资产库、机柜库、告警库", queriedAt }),
      };
    }
  }

  if (asksAlertRanking) {
    return {
      toolName: "list_alert_devices",
      answer:
        formatRackAlertRankingAnswer(rooms, racks, devices, alerts) +
        sourceFooter({ label: "本地资产库、机柜库、告警库", queriedAt }),
    };
  }

  if (asksWarranty) {
    const requestedWindow = question.match(/未来\s*(\d+)\s*天/)?.[1];
    const windowDays = requestedWindow ? Number(requestedWindow) : 90;
    const now = new Date("2026-05-26T00:00:00+08:00");
    const matches = devices
      .map((device) => {
        const expireAt = device.warrantyExpireAt ? new Date(device.warrantyExpireAt) : undefined;
        if (!expireAt || Number.isNaN(expireAt.getTime())) return null;
        const daysLeft = Math.ceil((expireAt.getTime() - now.getTime()) / 86_400_000);
        if (daysLeft < 0 || daysLeft > windowDays) return null;
        const rack = racks.find((item) => item.id === device.rackId);
        const room = rooms.find((item) => item.id === rack?.roomId);
        return { device, rack, room, daysLeft };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((first, second) => first.daysLeft - second.daysLeft);

    return {
      toolName: "search_devices",
      relatedDeviceId: matches.length === 1 ? matches[0].device.id : undefined,
      relatedRackId: matches.length === 1 ? matches[0].rack?.id : undefined,
      relatedRoomId: matches.length === 1 ? matches[0].room?.id : undefined,
      answer:
        formatWarrantyExpiringAnswer(matches, windowDays) +
        sourceFooter({ label: "本地资产库、机柜库", queriedAt }),
    };
  }

  if (asksMissingManagementIp || asksMissingOwner) {
    const matches = devices
      .filter((device) =>
        asksMissingManagementIp
          ? !device.managementIp?.trim()
          : !device.owner?.trim(),
      )
      .map((device) => {
        const rack = racks.find((item) => item.id === device.rackId);
        const room = rooms.find((item) => item.id === rack?.roomId);
        return { device, rack, room };
      });
    const label = asksMissingManagementIp ? "缺失带外IP设备" : "缺失责任人设备";

    return {
      toolName: "search_devices",
      relatedDeviceId: matches.length === 1 ? matches[0].device.id : undefined,
      relatedRackId: matches.length === 1 ? matches[0].rack?.id : undefined,
      relatedRoomId: matches.length === 1 ? matches[0].room?.id : undefined,
      answer:
        formatMissingFieldAnswer(label, matches) +
        sourceFooter({ label: "本地资产库、机柜库", queriedAt }),
    };
  }

  if (asksDeviceSearch) {
    const cleanedQuery = question
      .replace(/查询|查下|查一下|查看下|查看|看下|看一下|搜索|这台设备|设备|服务器|的详细信息|详情|责任人|负责哪些|负责|有哪些|哪些|用途|资产|编号|SN|sn|硬件配置|操作系统|型号|包含|的|吗|？|\?/g, " ")
      .trim();
    const containsQuery = question.match(/包含\s*([a-zA-Z0-9.\-_\s]+?)(?:的|服务器|设备|$)/)?.[1]?.trim();
    const candidates = [containsQuery, cleanedQuery, question]
      .filter((query): query is string => Boolean(query))
      .map((query) => searchDevices(query, devices, racks, rooms))
      .find((results) => results.length > 0);

    if (candidates && candidates.length > 0) {
      return {
        toolName: "search_devices",
        relatedDeviceId: candidates.length === 1 ? candidates[0].device.id : undefined,
        relatedRackId: candidates.length === 1 ? candidates[0].rack?.id : undefined,
        relatedRoomId: candidates.length === 1 ? candidates[0].room?.id : undefined,
        answer:
          formatDeviceSearchAnswer(candidates, alerts) +
          sourceFooter({ label: "本地资产库、机柜库、告警库", queriedAt }),
      };
    }
  }

  const multiKeywordCandidates = question
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  if (multiKeywordCandidates.length >= 2) {
    const candidates = searchDevices(multiKeywordCandidates.join(" "), devices, racks, rooms);
    if (candidates.length > 0) {
      return {
        toolName: "search_devices",
        relatedDeviceId: candidates.length === 1 ? candidates[0].device.id : undefined,
        relatedRackId: candidates.length === 1 ? candidates[0].rack?.id : undefined,
        relatedRoomId: candidates.length === 1 ? candidates[0].room?.id : undefined,
        answer:
          formatDeviceSearchAnswer(candidates, alerts) +
          sourceFooter({ label: "本地资产库、机柜库、告警库", queriedAt }),
      };
    }
  }

  const rack = racks.find((item) =>
    normalized.includes(item.name.toLowerCase()),
  );
  if (rack) {
    const room = rooms.find((item) => item.id === rack.roomId);
    const rackDevices = devices.filter((device) => device.rackId === rack.id);
    return {
      toolName: "list_rack_devices",
      relatedRackId: rack.id,
      relatedRoomId: room?.id,
      answer:
        formatRackDeviceListAnswer(rack, room, rackDevices, alerts) +
        sourceFooter({ label: "本地资产库、机柜库、告警库", queriedAt }),
    };
  }

  const room = rooms.find((item) =>
    normalized.includes(item.name.toLowerCase()),
  );
  if (room) {
    const roomRacks = racks.filter((rack) => rack.roomId === room.id);
    const roomRackIds = new Set(roomRacks.map((rack) => rack.id));
    const roomDevices = devices.filter((device) =>
      roomRackIds.has(device.rackId),
    );
    return {
      toolName: "list_room_devices",
      relatedRoomId: room.id,
      answer:
        formatRoomDeviceSummaryAnswer(room, roomRacks, roomDevices, alerts) +
        sourceFooter({
          label: "本地资产库、机房库、机柜库、告警库",
          queriedAt,
        }),
    };
  }

  if (asksAlert && /哪些|所有|当前|现在/.test(question)) {
    return {
      toolName: "list_alert_devices",
      answer:
        formatActiveAlertDevicesAnswer(rooms, racks, devices, alerts) +
        sourceFooter({ label: "本地资产库、机柜库、告警库", queriedAt }),
    };
  }

  const activeAlerts = alerts.filter((alert) => alert.status !== "recovered");
  return {
    toolName: "summarize_room_status",
    answer:
      `当前平台已纳管 ${rooms.length} 个机房、${racks.length} 个机柜、${devices.length} 台设备，活动告警 ${activeAlerts.length} 条。` +
      sourceFooter({ label: "本地资产库、告警库", queriedAt }),
  };
}
