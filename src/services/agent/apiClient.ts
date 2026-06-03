import type { Alert, AuditLog, Device, Rack, Room } from "../../types/domain";
import type { AccessRecord } from "../../features/access-management/accessRecords";
import type { ChangeEvent } from "../../features/change-management/changeEvents";
import type { ManagedConnection } from "../../features/connection-manager/connections";
import type { ProjectJson } from "../backend/data";
import type { AgentReadonlyTool } from "./apiManifest";
import type { AgentReadonlySnapshot } from "./readonlyApi";

export interface AgentReadonlyContext {
  rooms: Room[];
  racks: Rack[];
  devices: Device[];
  alerts: Alert[];
  auditLogs: AuditLog[];
  accessRecords: AccessRecord[];
  changeEvents: ChangeEvent[];
  connectionRecords: ManagedConnection[];
  dataSource: string;
}

export interface AgentReadonlyHealth {
  status: "ok" | string;
  readonly: true;
  generatedAt: string;
  endpoints: string[];
}

export interface AgentReadonlyTokenSettings {
  enabled: boolean;
  tokenPreview?: string;
}

export interface AgentApiKeyView {
  id: string;
  name: string;
  scopes: Array<"read" | "write">;
  tokenPreview: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export interface CreatedAgentApiKeyResponse {
  record: AgentApiKeyView;
  token: string;
}

type Fetcher = typeof fetch;
const TOKEN_STORAGE_KEY = "qf-ai-dcim.agent.readonlyToken";

export function getStoredAgentReadonlyToken(): string | undefined {
  if (typeof localStorage === "undefined") return undefined;
  return localStorage.getItem(TOKEN_STORAGE_KEY) ?? undefined;
}

export function storeAgentReadonlyToken(token: string | undefined): void {
  if (typeof localStorage === "undefined") return;
  if (token?.trim()) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

function buildAuthOptions(token?: string): RequestInit | undefined {
  const effectiveToken = token ?? getStoredAgentReadonlyToken();
  return effectiveToken
    ? {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      }
    : undefined;
}

function callGet(fetcher: Fetcher, url: string, token?: string) {
  const options = buildAuthOptions(token);
  return options ? fetcher(url, options) : fetcher(url);
}

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
  token?: string,
): Promise<void> {
  const authOptions = buildAuthOptions(token);
  const response = await fetcher("/api/agent/v1/snapshot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authOptions?.headers ?? {}),
    },
    body: JSON.stringify(project),
  });
  await readJsonResponse(response);
}

export async function loadAgentReadonlyContext(
  fetcher: Fetcher = fetch,
  token?: string,
): Promise<AgentReadonlyContext> {
  const snapshot = await readJsonResponse<AgentReadonlySnapshot>(
    await callGet(fetcher, "/api/agent/v1/topology", token),
  );
  return {
    rooms: snapshot.data.rooms,
    racks: snapshot.data.racks,
    devices: snapshot.data.devices,
    alerts: snapshot.data.alerts,
    auditLogs: snapshot.data.auditLogs ?? [],
    accessRecords: snapshot.data.accessRecords ?? [],
    changeEvents: snapshot.data.changeEvents ?? [],
    connectionRecords: snapshot.data.connectionRecords ?? [],
    dataSource: "只读 Agent API",
  };
}

export async function loadAgentReadonlyTools(
  fetcher: Fetcher = fetch,
  token?: string,
): Promise<AgentReadonlyTool[]> {
  const response = await readJsonResponse<{ data: AgentReadonlyTool[] }>(
    await callGet(fetcher, "/api/agent/v1/tools", token),
  );
  return response.data;
}

export async function loadAgentReadonlyHealth(
  fetcher: Fetcher = fetch,
  token?: string,
): Promise<AgentReadonlyHealth> {
  return await readJsonResponse<AgentReadonlyHealth>(
    await callGet(fetcher, "/api/agent/v1/health", token),
  );
}

export async function loadAgentReadonlyTokenSettings(
  fetcher: Fetcher = fetch,
): Promise<AgentReadonlyTokenSettings> {
  return await readJsonResponse<AgentReadonlyTokenSettings>(
    await fetcher("/api/agent/v1/auth/token"),
  );
}

export async function saveAgentReadonlyTokenSettings(
  settings: { enabled: boolean; token?: string },
  fetcher: Fetcher = fetch,
): Promise<AgentReadonlyTokenSettings> {
  const saved = await readJsonResponse<AgentReadonlyTokenSettings>(
    await fetcher("/api/agent/v1/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }),
  );
  storeAgentReadonlyToken(settings.enabled ? settings.token : undefined);
  return saved;
}

export async function loadAgentApiKeys(
  fetcher: Fetcher = fetch,
): Promise<AgentApiKeyView[]> {
  const response = await readJsonResponse<{ data: AgentApiKeyView[] }>(
    await fetcher("/api/agent/v1/auth/keys"),
  );
  return response.data;
}

export async function createServerAgentApiKey(
  input: { name: string; scopes: Array<"read" | "write"> },
  fetcher: Fetcher = fetch,
): Promise<CreatedAgentApiKeyResponse> {
  return await readJsonResponse<CreatedAgentApiKeyResponse>(
    await fetcher("/api/agent/v1/auth/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}
