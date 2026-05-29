import type { AiModelConfig, Alert, AuditLog, DataCenter, Device, MicroModule, Rack, Room } from "../../types/domain";
import type { ProjectJson } from "../backend/data";

export interface AgentReadonlyData {
  dataCenters?: DataCenter[];
  rooms: Room[];
  microModules?: MicroModule[];
  racks: Rack[];
  devices: Device[];
  alerts: Alert[];
  auditLogs?: AuditLog[];
  aiModelConfigs?: Omit<AiModelConfig, "apiKeyRef">[];
}

export interface AgentReadonlySnapshot {
  schemaVersion: string;
  generatedAt: string;
  readonly: true;
  data: AgentReadonlyData;
}

export interface AgentQuery {
  q?: string;
  roomId?: string;
  rackId?: string;
  deviceId?: string;
  ip?: string;
  owner?: string;
  action?: string;
  status?: string;
}

function includesKeyword(value: unknown, keyword: string): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" || typeof value === "number") {
    return String(value).toLowerCase().includes(keyword);
  }
  if (Array.isArray(value)) return value.some((item) => includesKeyword(item, keyword));
  if (typeof value === "object") {
    return Object.values(value).some((item) => includesKeyword(item, keyword));
  }
  return false;
}

function matchesKeyword(values: unknown[], query?: string): boolean {
  const keywords = query?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  if (keywords.length === 0) return true;
  return keywords.every((keyword) => values.some((value) => includesKeyword(value, keyword)));
}

export function buildAgentReadonlySnapshot(project: ProjectJson): AgentReadonlySnapshot {
  return {
    schemaVersion: project.schemaVersion,
    generatedAt: new Date().toISOString(),
    readonly: true,
    data: {
      dataCenters: project.data.dataCenters,
      rooms: project.data.rooms ?? [],
      microModules: project.data.microModules,
      racks: project.data.racks ?? [],
      devices: project.data.devices ?? [],
      alerts: project.data.alerts ?? [],
      auditLogs: project.data.auditLogs,
      aiModelConfigs: project.data.aiModelConfigs?.map(({ apiKeyRef: _apiKeyRef, ...config }) => config),
    },
  };
}

export function filterAgentRacks(
  data: Pick<AgentReadonlyData, "racks">,
  query: AgentQuery,
): Rack[] {
  return data.racks.filter(
    (rack) =>
      (!query.roomId || rack.roomId === query.roomId) &&
      matchesKeyword([rack.name, rack.type, rack.rowName, rack.notes], query.q),
  );
}

export function filterAgentDevices(
  data: Pick<AgentReadonlyData, "rooms" | "racks" | "devices">,
  query: AgentQuery,
): Device[] {
  const roomRackIds = query.roomId
    ? new Set(data.racks.filter((rack) => rack.roomId === query.roomId).map((rack) => rack.id))
    : null;

  return data.devices.filter((device) => {
    const rack = data.racks.find((item) => item.id === device.rackId);
    const room = data.rooms.find((item) => item.id === rack?.roomId);
    return (
      (!query.rackId || device.rackId === query.rackId) &&
      (!roomRackIds || roomRackIds.has(device.rackId)) &&
      (!query.ip || device.businessIp === query.ip || device.managementIp === query.ip || device.ips.includes(query.ip)) &&
      (!query.owner || device.owner?.includes(query.owner)) &&
      matchesKeyword(
        [
          device.name,
          device.computerName,
          device.businessIp,
          device.managementIp,
          device.ips,
          device.purpose,
          device.owner,
          device.vendor,
          device.model,
          device.serialNumber,
          device.assetNo,
          device.hardwareSpec,
          device.operatingSystem,
          rack?.name,
          room?.name,
          device.metadata,
        ],
        query.q,
      )
    );
  });
}

export function filterAgentAlerts(
  data: Pick<AgentReadonlyData, "alerts">,
  query: AgentQuery,
): Alert[] {
  return data.alerts.filter(
    (alert) =>
      (!query.deviceId || alert.deviceId === query.deviceId) &&
      (!query.status || alert.status === query.status) &&
      matchesKeyword([alert.title, alert.description, alert.source, alert.level, alert.status], query.q),
  );
}

export function filterAgentAuditLogs(
  data: Pick<AgentReadonlyData, "auditLogs">,
  query: AgentQuery,
): AuditLog[] {
  return (data.auditLogs ?? []).filter(
    (log) =>
      (!query.action || log.action === query.action) &&
      (!query.status || log.metadata?.status === query.status) &&
      matchesKeyword(
        [log.actor, log.action, log.targetType, log.targetId, log.summary, log.metadata],
        query.q,
      ),
  );
}
