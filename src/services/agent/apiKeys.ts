export type AgentApiKeyScope = "read" | "write";

export interface AgentApiKeyRecord {
  id: string;
  name: string;
  scopes: AgentApiKeyScope[];
  tokenHash: string;
  tokenPreview: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export interface AgentApiKeyCreateInput {
  name: string;
  scopes: AgentApiKeyScope[];
}

export interface CreatedAgentApiKey {
  record: Omit<AgentApiKeyRecord, "tokenHash">;
  token: string;
}

export interface AgentApiKeyAuthorization {
  ok: boolean;
  message: string;
  record?: Omit<AgentApiKeyRecord, "tokenHash">;
}

const STORAGE_KEY = "qf-ai-dcim.agent.apiKeys";

function storage() {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function now() {
  return new Date().toISOString();
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `agent-key-${crypto.randomUUID()}`;
  }
  return `agent-key-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createToken() {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `qf_agent_${random}`;
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function previewToken(token: string) {
  return token.length <= 16 ? `${token.slice(0, 6)}...` : `${token.slice(0, 10)}...${token.slice(-6)}`;
}

function sanitizeScopes(scopes: AgentApiKeyScope[]) {
  const unique = new Set(scopes);
  if (unique.has("write")) unique.add("read");
  if (unique.size === 0) unique.add("read");
  return [...unique];
}

function readRecords(): AgentApiKeyRecord[] {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AgentApiKeyRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecords(records: AgentApiKeyRecord[]) {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(records));
}

function publicRecord(record: AgentApiKeyRecord): Omit<AgentApiKeyRecord, "tokenHash"> {
  const { tokenHash: _tokenHash, ...publicPart } = record;
  return publicPart;
}

export function listAgentApiKeys(): Array<Omit<AgentApiKeyRecord, "tokenHash">> {
  return readRecords()
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .map(publicRecord);
}

export function createAgentApiKey(input: AgentApiKeyCreateInput): CreatedAgentApiKey {
  const token = createToken();
  const timestamp = now();
  const record: AgentApiKeyRecord = {
    id: createId(),
    name: input.name.trim() || "未命名 Agent API Key",
    scopes: sanitizeScopes(input.scopes),
    tokenHash: hashToken(token),
    tokenPreview: previewToken(token),
    enabled: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  writeRecords([record, ...readRecords()]);
  return {
    record: publicRecord(record),
    token,
  };
}

export function deleteAgentApiKey(id: string) {
  writeRecords(readRecords().filter((record) => record.id !== id));
}

export function authorizeAgentApiKey(
  token: string,
  requiredScope: AgentApiKeyScope,
): AgentApiKeyAuthorization {
  const hash = hashToken(token.trim());
  const records = readRecords();
  const record = records.find((item) => item.tokenHash === hash);
  if (!record || !record.enabled) {
    return { ok: false, message: "API Key 不存在或已停用。" };
  }
  if (!record.scopes.includes(requiredScope)) {
    return { ok: false, message: `API Key 缺少 ${requiredScope} 权限。`, record: publicRecord(record) };
  }
  const updated: AgentApiKeyRecord = {
    ...record,
    lastUsedAt: now(),
    updatedAt: now(),
  };
  writeRecords(records.map((item) => (item.id === record.id ? updated : item)));
  return { ok: true, message: "API Key 验证通过。", record: publicRecord(updated) };
}
