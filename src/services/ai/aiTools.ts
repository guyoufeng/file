import type { Alert, AuditLog, Device, Rack, Room } from "../../types/domain";
import type { VirtualServer } from "../../features/virtual-server-management/virtualServers";
import type { AccessRecord } from "../../features/access-management/accessRecords";
import type { ChangeEvent } from "../../features/change-management/changeEvents";
import type { ManagedConnection } from "../../features/connection-manager/connections";
import {
  formatAccessRecordSearchAnswer,
  formatActiveAlertDevicesAnswer,
  formatAuditLogSearchAnswer,
  formatDeviceAlertsAnswer,
  formatDeviceLocationAnswer,
  formatDeviceSearchAnswer,
  formatMissingFieldAnswer,
  formatRackDeviceListAnswer,
  formatRackAlertRankingAnswer,
  formatRoomDeviceSummaryAnswer,
  formatVirtualServerSearchAnswer,
  formatWarrantyExpiringAnswer,
  sourceFooter,
} from "./answerFormatter";
import { searchDevices } from "../search/deviceSearch";
import { getAuditActionLabel } from "../audit/auditLogView";

export type AiToolName =
  | "agent_command"
  | "general_chat"
  | "search_devices"
  | "get_device_detail"
  | "locate_device"
  | "list_rack_devices"
  | "list_room_devices"
  | "list_alert_devices"
  | "search_virtual_servers"
  | "search_audit_logs"
  | "search_access_records"
  | "search_change_events"
  | "search_connections"
  | "summarize_room_status";

export interface AiToolResult {
  toolName: AiToolName;
  answer: string;
  relatedDeviceId?: string;
  relatedRoomId?: string;
  relatedRackId?: string;
}

function includesKeyword(value: unknown, keyword: string): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" || typeof value === "number") {
    return String(value).toLowerCase().includes(keyword);
  }
  if (Array.isArray(value)) {
    return value.some((item) => includesKeyword(item, keyword));
  }
  if (typeof value === "object") {
    return Object.values(value).some((item) => includesKeyword(item, keyword));
  }
  return false;
}

function searchVirtualServers(
  query: string,
  virtualServers: VirtualServer[],
): VirtualServer[] {
  const keywords = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (keywords.length === 0) return [];

  return virtualServers.filter((server) =>
    keywords.every((keyword) =>
      [
        server.name,
        server.businessIp,
        server.os,
        server.purpose,
        server.owner,
        server.hostDeviceName,
        server.platform,
        server.status,
      ]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(keyword)),
    ),
  );
}

function searchAuditLogsForAi(query: string, auditLogs: AuditLog[]): AuditLog[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return [];
  const keywords = keyword.split(/\s+/).filter(Boolean);

  return auditLogs
    .filter((log) => {
      const fields = [
        log.actor,
        log.action,
        getAuditActionLabel(log.action),
        log.targetType,
        log.targetId,
        log.summary,
        JSON.stringify(log.metadata ?? {}),
      ].filter(Boolean);
      const joined = fields.join(" ").toLowerCase();

      return (
        joined.includes(keyword) ||
        keywords.every((item) => joined.includes(item)) ||
        keywords.every((item) => includesKeyword(log.metadata, item))
      );
    })
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

function searchAccessRecordsForAi(query: string, records: AccessRecord[]): AccessRecord[] {
  const keywords = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (keywords.length === 0) return [];
  return records
    .filter((record) => keywords.every((keyword) => includesKeyword(record, keyword)))
    .sort((first, second) =>
      `${second.date} ${second.enterTime}`.localeCompare(`${first.date} ${first.enterTime}`),
    );
}

function searchChangeEventsForAi(
  query: string,
  records: ChangeEvent[],
): ChangeEvent[] {
  const keywords = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (keywords.length === 0) return [];
  return records
    .filter((record) => keywords.every((keyword) => includesKeyword(record, keyword)))
    .sort((first, second) => second.changedAt.localeCompare(first.changedAt));
}

function searchConnectionsForAi(
  query: string,
  records: ManagedConnection[],
): ManagedConnection[] {
  const keywords = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (keywords.length === 0) return [];
  return records
    .filter((record) => keywords.every((keyword) => includesKeyword(record, keyword)))
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}

function formatChangeEventSearchAnswer(records: ChangeEvent[]): string {
  if (records.length === 0) {
    return "未在变更管理中找到匹配记录。可以尝试输入服务器名、业务IP、机柜、变更类型、操作人或接线关键词。";
  }

  return [
    `匹配变更记录：${records.length} 条`,
    "",
    ...records.slice(0, 20).map((record, index) =>
      [
        `${index + 1}. ${record.title}`,
        `时间：${record.changedAt}`,
        `状态：${record.status}`,
        `设备：${record.deviceName || record.deviceId || "-"}`,
        `业务IP：${record.businessIp || "-"}`,
        `位置：${record.roomName || "-"} / ${record.rackName || "-"}`,
        `操作人：${record.operator}`,
        `内容：${record.content}`,
        `影响：${record.impact || "-"}`,
        `结果：${record.result || "-"}`,
        `附件：${record.attachments.length > 0 ? record.attachments.join("、") : "-"}`,
      ].join(" / "),
    ),
    records.length > 20
      ? `仅展示前 20 条，剩余 ${records.length - 20} 条可继续缩小条件查询。`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatConnectionSearchAnswer(records: ManagedConnection[]): string {
  if (records.length === 0) {
    return "未在连线管理中找到匹配记录。可以尝试输入服务器名、交换机名、端口号、线缆编号或业务说明。";
  }

  return [
    `匹配连线记录：${records.length} 条`,
    "",
    ...records.slice(0, 20).map((record, index) =>
      [
        `${index + 1}. ${record.sourceDeviceName} ${record.sourcePortName} -> ${record.targetDeviceName} ${record.targetPortName}`,
        `线缆编号：${record.cableNo || "-"}`,
        `线缆类型：${record.cableType || "-"}`,
        `方向：${record.direction}`,
        `状态：${record.status}`,
        `说明：${record.notes || "-"}`,
      ].join(" / "),
    ),
    records.length > 20
      ? `仅展示前 20 条，剩余 ${records.length - 20} 条可继续缩小条件查询。`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function extractLikelyAssetToken(question: string) {
  const tokens = question.match(/[a-zA-Z0-9][a-zA-Z0-9._-]{2,}/g) ?? [];
  return tokens.find((token) => /^[a-zA-Z]/.test(token) && /[\d.-]/.test(token));
}

function resolveDeviceFromQuestion(
  question: string,
  rooms: Room[],
  racks: Rack[],
  devices: Device[],
): Device | undefined {
  const ip = question.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/)?.[0];
  if (ip) {
    const device = devices.find(
      (item) =>
        item.businessIp === ip ||
        item.managementIp === ip ||
        item.ips.includes(ip),
    );
    if (device) return device;
  }
  const token = extractLikelyAssetToken(question);
  if (!token) return undefined;
  return searchDevices(token, devices, racks, rooms)[0]?.device;
}

export function runDeterministicAiQuery(
  question: string,
  rooms: Room[],
  racks: Rack[],
  devices: Device[],
  alerts: Alert[],
  virtualServers: VirtualServer[] = [],
  auditLogs: AuditLog[] = [],
  accessRecords: AccessRecord[] = [],
  changeEvents: ChangeEvent[] = [],
  connectionRecords: ManagedConnection[] = [],
): AiToolResult {
  const queriedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const normalized = question.toLowerCase();
  const ip = question.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/)?.[0];
  const ipPrefix = question.match(/\b\d{1,3}(?:\.\d{1,3}){2}\b/)?.[0];
  const asksAlert = /告警|报警|异常|故障/.test(question);
  const asksAlertDetail =
    asksAlert || /处理方法|处理状态|处理到|解决方法|解决方案|附件|照片/.test(question);
  const asksAlertRanking =
    asksAlert && /最多|排行|排名|哪个机柜/.test(question);
  const asksWarranty = /过保|维保.*到期|到期.*维保|保修.*到期|即将.*到期/.test(question);
  const asksVirtualServer = /虚拟机|虚拟服务器|云主机|vm|VM|zstack|ZStack|宿主/.test(question);
  const asksAuditLog = /审计|操作记录|日志|历史记录|谁|导入记录|查询记录|修改记录/.test(question);
  const asksAccessRecord = /进出|进入|离开|访客|维修记录|维修历史|维保记录|入场|出场|来过|谁来|维修/.test(question);
  const asksChangeEvent = /变更|上架|下架|接线调整|调整接线|更换|安装|配置修改|改过|做过哪些|操作过/.test(question);
  const asksConnection = /连线|接线|端口|交换机|网线|光纤|线缆|接在哪|连接到|对端/.test(question);
  const asksMissingField = /没有|缺少|为空|未填/.test(question);
  const missingFieldRules = [
    {
      matched: asksMissingField && /带外IP|带外ip|管理IP|管理ip|OOB|oob/.test(question),
      label: "缺失带外IP设备",
      isMissing: (device: Device) => !device.managementIp?.trim(),
    },
    {
      matched: asksMissingField && /业务IP|业务ip/.test(question),
      label: "缺失业务IP设备",
      isMissing: (device: Device) => !device.businessIp?.trim(),
    },
    {
      matched: asksMissingField && /责任人|负责人/.test(question),
      label: "缺失责任人设备",
      isMissing: (device: Device) => !device.owner?.trim(),
    },
    {
      matched: asksMissingField && /固定资产|资产编号|资产号/.test(question),
      label: "缺失固定资产编号设备",
      isMissing: (device: Device) => !device.assetNo?.trim(),
    },
    {
      matched: asksMissingField && /SN|sn|序列号/.test(question),
      label: "缺失SN号设备",
      isMissing: (device: Device) => !device.serialNumber?.trim(),
    },
    {
      matched: asksMissingField && /维保|保修/.test(question),
      label: "缺失维保时间设备",
      isMissing: (device: Device) => !device.warrantyExpireAt?.trim(),
    },
  ];
  const asksDeviceSearch =
    /查询|查下|查一下|查看|看下|看一下|搜索|负责|用途|资产|编号|sn|SN|详细|详情|哪些服务器|哪些设备|硬件配置|内存|cpu|CPU|操作系统|型号|处理方法|处理状态|处理到|解决方法|解决方案|附件|照片/.test(
      question,
    );

  if (asksVirtualServer) {
    const cleanedQuery = question
      .replace(/查询|查下|查一下|查看下|查看|看下|看一下|搜索|这台|虚拟机|虚拟服务器|云主机|用途|责任人|宿主服务器|宿主物理服务器|业务IP|业务ip|平台|状态|操作系统|的|吗|？|\?/g, " ")
      .trim();
    const directToken = question.match(/[a-zA-Z][a-zA-Z0-9._-]{2,}/)?.[0];
    const candidates =
      [directToken, ip, cleanedQuery, question]
        .filter((query): query is string => Boolean(query))
        .map((query) => searchVirtualServers(query, virtualServers))
        .find((matches) => matches.length > 0) ?? [];

    return {
      toolName: "search_virtual_servers",
      answer:
        formatVirtualServerSearchAnswer(candidates) +
        sourceFooter({ label: "本地虚拟服务器库", queriedAt }),
    };
  }

  if (asksAuditLog) {
    const cleanedQuery = question
      .replace(/最近|查询|查下|查一下|查看|看下|看一下|搜索|审计|操作记录|日志|历史记录|记录|哪些|谁|的|吗|？|\?/g, " ")
      .trim();
    const candidates =
      [ip, cleanedQuery, question]
        .filter((query): query is string => Boolean(query))
        .map((query) => searchAuditLogsForAi(query, auditLogs))
        .find((matches) => matches.length > 0) ?? [];

    return {
      toolName: "search_audit_logs",
      answer:
        formatAuditLogSearchAnswer(candidates) +
        sourceFooter({ label: "本地审计日志", queriedAt }),
    };
  }

  if (asksAccessRecord) {
    const relatedDevice = ip
      ? devices.find(
          (item) =>
            item.businessIp === ip ||
            item.managementIp === ip ||
            item.ips.includes(ip),
        )
      : undefined;
    const cleanedQuery = question
      .replace(/最近|查询|查下|查一下|查看|看下|看一下|搜索|有没有|数据中心|机房|进出|进入|离开|访客|维修记录|维修历史|维保记录|入场|出场|来过|谁来|维修|记录|的|吗|？|\?/g, " ")
      .trim();
    const candidates =
      [
        relatedDevice?.computerName,
        relatedDevice?.businessIp,
        relatedDevice?.name,
        ip,
        cleanedQuery,
        question,
      ]
        .filter((query): query is string => Boolean(query))
        .map((query) => searchAccessRecordsForAi(query, accessRecords))
        .find((matches) => matches.length > 0) ?? [];
    const deviceFromRecord = candidates.find((record) => record.deviceId)?.deviceId;
    const device = relatedDevice ?? devices.find((item) => item.id === deviceFromRecord);
    const rack = racks.find((item) => item.id === device?.rackId);
    const room = rooms.find((item) => item.id === rack?.roomId);
    return {
      toolName: "search_access_records",
      relatedDeviceId: device?.id,
      relatedRackId: rack?.id,
      relatedRoomId: room?.id,
      answer:
        formatAccessRecordSearchAnswer(candidates) +
        sourceFooter({ label: "数据中心进出管理", queriedAt }),
    };
  }

  if (asksChangeEvent) {
    const relatedDevice = resolveDeviceFromQuestion(question, rooms, racks, devices);
    const cleanedQuery = question
      .replace(/最近|查询|查下|查一下|查看|看下|看一下|搜索|有没有|哪些|做过|变更|变更记录|上架|下架|接线调整|调整接线|更换|安装|配置修改|改过|的|吗|？|\?/g, " ")
      .trim();
    const candidates =
      [
        relatedDevice?.id,
        relatedDevice?.computerName,
        relatedDevice?.businessIp,
        relatedDevice?.name,
        cleanedQuery,
        question,
      ]
        .filter((query): query is string => Boolean(query))
        .map((query) => searchChangeEventsForAi(query, changeEvents))
        .find((matches) => matches.length > 0) ?? [];
    const device = relatedDevice ?? devices.find((item) => item.id === candidates[0]?.deviceId);
    const rack = racks.find((item) => item.id === device?.rackId || item.id === candidates[0]?.rackId);
    const room = rooms.find((item) => item.id === rack?.roomId || item.id === candidates[0]?.roomId);

    return {
      toolName: "search_change_events",
      relatedDeviceId: device?.id,
      relatedRackId: rack?.id,
      relatedRoomId: room?.id,
      answer:
        formatChangeEventSearchAnswer(candidates) +
        sourceFooter({ label: "变更管理", queriedAt }),
    };
  }

  if (asksConnection) {
    const relatedDevice = resolveDeviceFromQuestion(question, rooms, racks, devices);
    const cleanedQuery = question
      .replace(/最近|查询|查下|查一下|查看|看下|看一下|搜索|这台|服务器|设备|连线|接线|端口|交换机|网线|光纤|线缆|接在哪|连接到|对端|的|吗|？|\?/g, " ")
      .trim();
    const candidates =
      [
        relatedDevice?.id,
        relatedDevice?.computerName,
        relatedDevice?.businessIp,
        relatedDevice?.name,
        cleanedQuery,
        question,
      ]
        .filter((query): query is string => Boolean(query))
        .map((query) => searchConnectionsForAi(query, connectionRecords))
        .find((matches) => matches.length > 0) ?? [];
    const device = relatedDevice ?? devices.find(
      (item) => item.id === candidates[0]?.sourceDeviceId || item.id === candidates[0]?.targetDeviceId,
    );
    const rack = racks.find((item) => item.id === device?.rackId);
    const room = rooms.find((item) => item.id === rack?.roomId);

    return {
      toolName: "search_connections",
      relatedDeviceId: device?.id,
      relatedRackId: rack?.id,
      relatedRoomId: room?.id,
      answer:
        formatConnectionSearchAnswer(candidates) +
        sourceFooter({ label: "连线管理", queriedAt }),
    };
  }

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
      if (asksAlertDetail) {
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

  const missingFieldRule = missingFieldRules.find((rule) => rule.matched);
  if (missingFieldRule) {
    const matches = devices
      .filter((device) => missingFieldRule.isMissing(device))
      .map((device) => {
        const rack = racks.find((item) => item.id === device.rackId);
        const room = rooms.find((item) => item.id === rack?.roomId);
        return { device, rack, room };
      });

    return {
      toolName: "search_devices",
      relatedDeviceId: matches.length === 1 ? matches[0].device.id : undefined,
      relatedRackId: matches.length === 1 ? matches[0].rack?.id : undefined,
      relatedRoomId: matches.length === 1 ? matches[0].room?.id : undefined,
      answer:
        formatMissingFieldAnswer(missingFieldRule.label, matches) +
        sourceFooter({ label: "本地资产库、机柜库", queriedAt }),
    };
  }

  const directAssetToken = extractLikelyAssetToken(question);
  if (directAssetToken) {
    const candidates = searchDevices(directAssetToken, devices, racks, rooms);
    if (candidates.length > 0) {
      if (asksAlertDetail && candidates.length === 1) {
        return {
          toolName: "list_alert_devices",
          relatedDeviceId: candidates[0].device.id,
          relatedRackId: candidates[0].rack?.id,
          relatedRoomId: candidates[0].room?.id,
          answer:
            formatDeviceAlertsAnswer(candidates[0].device, rooms, racks, alerts) +
            sourceFooter({ label: "本地资产库、机柜库、告警库", queriedAt }),
        };
      }
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

  if (asksDeviceSearch) {
    const cleanedQuery = question
      .replace(/查询|查下|查一下|查看下|查看|看下|看一下|搜索|这台设备|设备|服务器|的详细信息|详情|责任人|负责哪些|负责|有哪些|哪些|用途|资产|编号|SN|sn|硬件配置|操作系统|型号|告警|报警|异常|故障|处理方法|处理状态|处理到什么状态|处理到|解决方法|解决方案|附件|照片|有没有|是什么|最近|包含|的|吗|？|\?/g, " ")
      .trim();
    const containsQuery = question.match(/包含\s*([a-zA-Z0-9.\-_\s]+?)(?:的|服务器|设备|$)/)?.[1]?.trim();
    const candidates = [containsQuery, directAssetToken, cleanedQuery, question]
      .filter((query): query is string => Boolean(query))
      .map((query) => searchDevices(query, devices, racks, rooms))
      .find((results) => results.length > 0);

    if (candidates && candidates.length > 0) {
      if (asksAlertDetail && candidates.length === 1) {
        return {
          toolName: "list_alert_devices",
          relatedDeviceId: candidates[0].device.id,
          relatedRackId: candidates[0].rack?.id,
          relatedRoomId: candidates[0].room?.id,
          answer:
            formatDeviceAlertsAnswer(candidates[0].device, rooms, racks, alerts) +
            sourceFooter({ label: "本地资产库、机柜库、告警库", queriedAt }),
        };
      }
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
