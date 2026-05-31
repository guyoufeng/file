const STORAGE_KEY = "qf-ai-dcim.agent.toolIntegrations";

export type AgentToolIntegrationType = "cmdb" | "mcp";

export interface AgentToolIntegrationInput {
  id?: string;
  type: AgentToolIntegrationType;
  name: string;
  endpoint: string;
  token?: string;
  enabled: boolean;
  notes: string;
}

export interface AgentToolIntegration extends AgentToolIntegrationInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  lastTestAt?: string;
  lastTestOk?: boolean;
  lastTestMessage?: string;
}

export interface AgentToolIntegrationTestResult {
  ok: boolean;
  message: string;
  testedAt: string;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function storage(): StorageLike | undefined {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function createId(type: AgentToolIntegrationType, name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `agent-tool-${type}-${normalized || Date.now()}`;
}

function readIntegrations(): AgentToolIntegration[] {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AgentToolIntegration[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIntegrations(integrations: AgentToolIntegration[]) {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(integrations));
}

export function getAgentToolIntegrations() {
  return readIntegrations();
}

export function saveAgentToolIntegration(
  input: AgentToolIntegrationInput,
): AgentToolIntegration {
  const now = new Date().toISOString();
  const name = input.name.trim();
  const integration: AgentToolIntegration = {
    ...input,
    id: input.id ?? createId(input.type, name),
    name,
    endpoint: input.endpoint.trim(),
    token: input.token?.trim(),
    notes: input.notes.trim(),
    createdAt:
      readIntegrations().find((item) => item.id === input.id)?.createdAt ?? now,
    updatedAt: now,
  };
  const next = [
    integration,
    ...readIntegrations().filter((item) => item.id !== integration.id),
  ];
  writeIntegrations(next);
  return integration;
}

export function deleteAgentToolIntegration(id: string) {
  writeIntegrations(readIntegrations().filter((item) => item.id !== id));
}

export async function testAgentToolIntegration(
  input: AgentToolIntegrationInput,
): Promise<AgentToolIntegrationTestResult> {
  const testedAt = new Date().toISOString();
  const name = input.name.trim();
  const endpoint = input.endpoint.trim();
  if (!name) {
    return { ok: false, message: "工具名称不能为空。", testedAt };
  }
  if (!endpoint) {
    return { ok: false, message: "Endpoint 不能为空。", testedAt };
  }
  if (input.type === "cmdb" && !/^https?:\/\//i.test(endpoint)) {
    return { ok: false, message: "CMDB Endpoint 建议使用 http:// 或 https://。", testedAt };
  }
  if (input.type === "mcp" && !/^(mcp|http|https):\/\//i.test(endpoint)) {
    return { ok: false, message: "MCP Endpoint 建议使用 mcp://、http:// 或 https://。", testedAt };
  }
  return {
    ok: true,
    message: `${input.type.toUpperCase()} 工具配置格式有效，可保存后由 Agent 工具执行器调用。`,
    testedAt,
  };
}

export async function testAndSaveAgentToolIntegration(
  input: AgentToolIntegrationInput,
): Promise<AgentToolIntegrationTestResult> {
  const result = await testAgentToolIntegration(input);
  if (!result.ok) return result;
  const saved = saveAgentToolIntegration(input);
  const next = readIntegrations().map((item) =>
    item.id === saved.id
      ? {
          ...item,
          lastTestAt: result.testedAt,
          lastTestOk: result.ok,
          lastTestMessage: result.message,
        }
      : item,
  );
  writeIntegrations(next);
  return result;
}

export function formatAgentToolIntegrationPrompt(
  integrations: AgentToolIntegration[] = getAgentToolIntegrations(),
) {
  const enabled = integrations.filter((item) => item.enabled);
  if (enabled.length === 0) return "外部工具接入：暂无启用的 CMDB/MCP 工具。";
  return [
    "外部工具接入（只读优先，密钥不进入模型上下文）：",
    ...enabled.map((item) =>
      [
        `工具：${item.name}`,
        `类型：${item.type}`,
        `Endpoint：${item.endpoint || "未配置"}`,
        `密钥：${item.token ? "已保存" : "未保存"}`,
        item.notes ? `备注：${item.notes}` : "",
      ]
        .filter(Boolean)
        .join(" / "),
    ),
  ].join("\n");
}
