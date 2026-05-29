import type { Alert, AuditLog, Device, Rack, Room } from "../../types/domain";
import type { ProjectJson } from "../backend/data";
import type { AgentReadonlySnapshot } from "./readonlyApi";

export interface AgentReadonlyContext {
  rooms: Room[];
  racks: Rack[];
  devices: Device[];
  alerts: Alert[];
  auditLogs: AuditLog[];
  dataSource: string;
}

type Fetcher = typeof fetch;

async function readJsonResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new Error(data.message ?? "只读 Agent API 请求失败");
  }
  return data;
}

export async function syncAgentReadonlySnapshot(
  project: ProjectJson,
  fetcher: Fetcher = fetch,
): Promise<void> {
  const response = await fetcher("/api/agent/v1/snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project),
  });
  await readJsonResponse(response);
}

export async function loadAgentReadonlyContext(
  fetcher: Fetcher = fetch,
): Promise<AgentReadonlyContext> {
  const snapshot = await readJsonResponse<AgentReadonlySnapshot>(
    await fetcher("/api/agent/v1/topology"),
  );
  return {
    rooms: snapshot.data.rooms,
    racks: snapshot.data.racks,
    devices: snapshot.data.devices,
    alerts: snapshot.data.alerts,
    auditLogs: snapshot.data.auditLogs ?? [],
    dataSource: "只读 Agent API",
  };
}
