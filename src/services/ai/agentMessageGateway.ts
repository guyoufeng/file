export type AgentGatewayProvider = "wechat" | "wecom" | "dingtalk";
export type GatewayMessageDirection = "inbound" | "outbound";

export interface AgentGatewayConfig {
  id: string;
  provider: AgentGatewayProvider;
  name: string;
  enabled: boolean;
  endpoint: string;
  token: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type AgentGatewayConfigInput = Omit<AgentGatewayConfig, "id" | "createdAt" | "updatedAt">;

export interface GatewayPairing {
  configId: string;
  provider: AgentGatewayProvider;
  payload: string;
  expiresAt: string;
  qrCells: boolean[];
}

export interface GatewayMessage {
  id: string;
  direction: GatewayMessageDirection;
  content: string;
  createdAt: string;
}

export interface GatewaySession {
  id: string;
  provider: AgentGatewayProvider;
  externalUserId: string;
  displayName: string;
  skillScope: "shared";
  messages: GatewayMessage[];
  updatedAt: string;
}

export interface GatewayMessageInput {
  provider: AgentGatewayProvider;
  externalUserId: string;
  displayName: string;
  direction: GatewayMessageDirection;
  content: string;
}

const CONFIG_STORAGE_KEY = "qf-ai-dcim.agentGatewayConfigs";
const SESSION_STORAGE_KEY = "qf-ai-dcim.agentGatewaySessions";

function storage() {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readJson<T>(key: string, fallback: T): T {
  const raw = storage()?.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  storage()?.setItem(key, JSON.stringify(value));
}

export function buildGatewayQrCells(value: string, size = 21): boolean[] {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Array.from({ length: size * size }, (_, index) => {
    const x = index % size;
    const y = Math.floor(index / size);
    const finder =
      (x < 7 && y < 7) ||
      (x >= size - 7 && y < 7) ||
      (x < 7 && y >= size - 7);
    if (finder) {
      const localX = x < 7 ? x : x - (size - 7);
      const localY = y < 7 ? y : y - (size - 7);
      return (
        localX === 0 ||
        localX === 6 ||
        localY === 0 ||
        localY === 6 ||
        (localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4)
      );
    }
    const bit = (hash >> (index % 24)) & 1;
    hash = Math.imul(hash ^ (index + 17), 1103515245);
    return Boolean(bit);
  });
}

export function getGatewayConfigs(): AgentGatewayConfig[] {
  return readJson<AgentGatewayConfig[]>(CONFIG_STORAGE_KEY, []).sort((first, second) =>
    second.updatedAt.localeCompare(first.updatedAt),
  );
}

export function saveGatewayConfig(input: AgentGatewayConfigInput): AgentGatewayConfig {
  const now = new Date().toISOString();
  const existing = getGatewayConfigs().find(
    (config) => config.provider === input.provider && config.name === input.name,
  );
  const next: AgentGatewayConfig = {
    ...input,
    id: existing?.id ?? createId("gateway"),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const records = getGatewayConfigs().filter((config) => config.id !== next.id);
  writeJson(CONFIG_STORAGE_KEY, [next, ...records]);
  return next;
}

export function deleteGatewayConfig(id: string) {
  writeJson(
    CONFIG_STORAGE_KEY,
    getGatewayConfigs().filter((config) => config.id !== id),
  );
}

export function createGatewayPairing(configId: string, publicBaseUrl = ""): GatewayPairing {
  const config = getGatewayConfigs().find((item) => item.id === configId);
  if (!config) throw new Error("网关配置不存在");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const payload = JSON.stringify({
    type: "qf-ai-dcim-agent-gateway",
    provider: config.provider,
    configId,
    endpoint: publicBaseUrl ? `${publicBaseUrl}/api/agent/v1/gateway/${config.provider}` : config.endpoint,
    token: config.token ? `${config.token.slice(0, 4)}...${config.token.slice(-4)}` : "",
    expiresAt,
  });
  return {
    configId,
    provider: config.provider,
    payload,
    expiresAt,
    qrCells: buildGatewayQrCells(payload),
  };
}

export function getGatewaySessions(): GatewaySession[] {
  return readJson<GatewaySession[]>(SESSION_STORAGE_KEY, []).sort((first, second) =>
    second.updatedAt.localeCompare(first.updatedAt),
  );
}

export function recordGatewayMessage(input: GatewayMessageInput): GatewaySession {
  const now = new Date().toISOString();
  const sessions = getGatewaySessions();
  const sessionId = `${input.provider}-${input.externalUserId}`;
  const message: GatewayMessage = {
    id: createId("gateway-message"),
    direction: input.direction,
    content: input.content,
    createdAt: now,
  };
  const existing = sessions.find((session) => session.id === sessionId);
  const next: GatewaySession = {
    id: sessionId,
    provider: input.provider,
    externalUserId: input.externalUserId,
    displayName: input.displayName,
    skillScope: "shared",
    messages: [...(existing?.messages ?? []), message],
    updatedAt: now,
  };
  writeJson(
    SESSION_STORAGE_KEY,
    [next, ...sessions.filter((session) => session.id !== sessionId)],
  );
  return next;
}
