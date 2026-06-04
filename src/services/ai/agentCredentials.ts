import { createPersistentCollection } from "../persistence/unifiedPersistence";

export type AgentCredentialType = "zoho" | "prometheus" | "cmdb" | "zstack" | "webhook" | "other";

export interface AgentCredential {
  id: string;
  type: AgentCredentialType;
  name: string;
  endpoint?: string;
  username?: string;
  secret?: string;
  notes?: string;
  createdAt: string;
}

export type AgentCredentialInput = Omit<AgentCredential, "id" | "createdAt">;

const STORAGE_KEY = "qf-ai-dcim.agent.credentials";
const credentialCollection = createPersistentCollection<AgentCredential>({
  name: "agent.credentials",
  legacyKeys: [STORAGE_KEY],
  exportable: false,
  sensitive: true,
});

function readCredentials(): AgentCredential[] {
  return credentialCollection.read();
}

function writeCredentials(credentials: AgentCredential[]) {
  credentialCollection.write(credentials);
}

export function getAgentCredentials(): AgentCredential[] {
  return readCredentials().sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt),
  );
}

export function saveAgentCredential(input: AgentCredentialInput): AgentCredential {
  const credential: AgentCredential = {
    ...input,
    id: `credential-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const next = [
    credential,
    ...readCredentials().filter((item) => item.name !== credential.name),
  ];
  writeCredentials(next);
  return credential;
}

export function deleteAgentCredential(id: string) {
  writeCredentials(readCredentials().filter((item) => item.id !== id));
}

export function formatCredentialCatalogForAgent(credentials = getAgentCredentials()): string {
  if (credentials.length === 0) return "账号凭据目录：暂无。";
  return [
    "账号凭据目录（仅供工具执行器识别可用连接，禁止向模型暴露密码、Token、Secret）：",
    ...credentials.map((item, index) =>
      `${index + 1}. ${item.name} / ${item.type} / ${item.endpoint || "未配置地址"} / 用户：${item.username || "未配置"} / 密钥：${item.secret ? "已保存" : "未保存"}`,
    ),
  ].join("\n");
}
