import type { Alert, Device, Rack, Room } from "../../types/domain";
import {
  formatActiveAlertDevicesAnswer,
  formatDeviceAlertsAnswer,
  formatDeviceLocationAnswer,
  formatDeviceSearchAnswer,
  formatRackDeviceListAnswer,
  formatRackAlertRankingAnswer,
  formatRoomDeviceSummaryAnswer,
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
  const asksAlert = /告警|报警|异常|故障/.test(question);
  const asksAlertRanking =
    asksAlert && /最多|排行|排名|哪个机柜/.test(question);
  const asksDeviceSearch =
    /查询|查下|查一下|搜索|负责|用途|资产|编号|sn|SN|详细|详情|哪些服务器|哪些设备/.test(
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

  if (asksAlertRanking) {
    return {
      toolName: "list_alert_devices",
      answer:
        formatRackAlertRankingAnswer(rooms, racks, devices, alerts) +
        sourceFooter({ label: "本地资产库、机柜库、告警库", queriedAt }),
    };
  }

  if (asksDeviceSearch) {
    const cleanedQuery = question
      .replace(/查询|查下|查一下|搜索|这台设备|设备|服务器|的详细信息|详情|负责哪些|负责|有哪些|哪些|用途|资产|编号|SN|sn|吗|？|\?/g, " ")
      .trim();
    const candidates = [cleanedQuery, question]
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
