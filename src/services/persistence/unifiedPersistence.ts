export type PersistenceBackendType = "browser-local" | "tauri-sqlite" | "remote-api";

export interface PersistenceBackendInfo {
  type: PersistenceBackendType;
  namespace: string;
  sqliteReady: boolean;
  tauriReady: boolean;
  collections: PersistentCollectionRegistration[];
}

export interface PersistentCollectionOptions {
  name: string;
  legacyKeys?: string[];
  maxRecords?: number;
  exportable?: boolean;
  sensitive?: boolean;
  description?: string;
}

export interface PersistentCollection<T> {
  key: string;
  read(): T[];
  write(records: T[]): void;
  clear(): void;
}

export interface PersistentCollectionRegistration {
  name: string;
  key: string;
  legacyKeys: string[];
  exportable: boolean;
  sensitive: boolean;
  description?: string;
}

export const DATA_NAMESPACE = "qf-ai-dcim.data";

const knownCollections: PersistentCollectionRegistration[] = [
  {
    name: "agent.runRecords",
    key: collectionKey("agent.runRecords"),
    legacyKeys: ["qf-ai-dcim.agent.runRecords"],
    exportable: true,
    sensitive: false,
    description: "AI Agent 执行轨迹、工具调用、用时和结果。",
  },
  {
    name: "operations.accessRecords",
    key: collectionKey("operations.accessRecords"),
    legacyKeys: ["qf-ai-dcim.accessRecords"],
    exportable: true,
    sensitive: false,
    description: "数据中心进出、维修和现场处理记录。",
  },
  {
    name: "operations.changeEvents",
    key: collectionKey("operations.changeEvents"),
    legacyKeys: ["qf-ai-dcim.changeEvents"],
    exportable: true,
    sensitive: false,
    description: "上架、下架、接线、维修和配置变更记录。",
  },
  {
    name: "operations.virtualServers",
    key: collectionKey("operations.virtualServers"),
    legacyKeys: ["qf-ai-dcim.virtualServers"],
    exportable: true,
    sensitive: false,
    description: "虚拟服务器与宿主物理机的关联数据。",
  },
  {
    name: "connections.records",
    key: collectionKey("connections.records"),
    legacyKeys: ["qf-ai-dcim.connectionRecords"],
    exportable: true,
    sensitive: false,
    description: "服务器、交换机、端口和线缆关系。",
  },
  {
    name: "connections.views",
    key: collectionKey("connections.views"),
    legacyKeys: ["qf-ai-dcim.connectionViews"],
    exportable: true,
    sensitive: false,
    description: "连线管理保存的拓扑视图。",
  },
  {
    name: "ai.knowledgeBase",
    key: collectionKey("ai.knowledgeBase"),
    legacyKeys: ["qf-ai-dcim.agent.knowledgeBase"],
    exportable: true,
    sensitive: false,
    description: "AI 知识库条目。",
  },
  {
    name: "ai.customSkills",
    key: collectionKey("ai.customSkills"),
    legacyKeys: ["qf-ai-dcim.agent.customSkills"],
    exportable: true,
    sensitive: false,
    description: "用户维护的 Agent Skill。",
  },
  {
    name: "agent.gatewaySessions",
    key: collectionKey("agent.gatewaySessions"),
    legacyKeys: ["qf-ai-dcim.agentGatewaySessions"],
    exportable: true,
    sensitive: false,
    description: "外部消息网关的独立会话记录。",
  },
  {
    name: "agent.gatewayConfigs",
    key: collectionKey("agent.gatewayConfigs"),
    legacyKeys: ["qf-ai-dcim.agentGatewayConfigs"],
    exportable: false,
    sensitive: true,
    description: "消息网关配置，包含 Token，默认不导出。",
  },
  {
    name: "alerts.webhooks",
    key: collectionKey("alerts.webhooks"),
    legacyKeys: ["qf-ai-dcim.alertWebhooks"],
    exportable: false,
    sensitive: true,
    description: "告警 Webhook 配置，包含接入 Token，默认不导出。",
  },
  {
    name: "agent.apiKeys",
    key: collectionKey("agent.apiKeys"),
    legacyKeys: ["qf-ai-dcim.agent.apiKeys"],
    exportable: false,
    sensitive: true,
    description: "外部 Agent API Key 记录，默认不导出。",
  },
  {
    name: "agent.credentials",
    key: collectionKey("agent.credentials"),
    legacyKeys: ["qf-ai-dcim.agent.credentials"],
    exportable: false,
    sensitive: true,
    description: "卓豪、Prometheus、CMDB 等凭据，默认不导出。",
  },
];

const registry = new Map<string, PersistentCollectionRegistration>(
  knownCollections.map((collection) => [collection.name, collection]),
);

function storage() {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function collectionKey(name: string) {
  return `${DATA_NAMESPACE}.${name}`;
}

function parseRecords<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function migrateLegacyKeys<T>(key: string, legacyKeys: string[]) {
  const store = storage();
  if (!store || store.getItem(key)) return;
  for (const legacyKey of legacyKeys) {
    const legacyRecords = parseRecords<T>(store.getItem(legacyKey));
    if (legacyRecords.length === 0) continue;
    store.setItem(key, JSON.stringify(legacyRecords));
    store.removeItem(legacyKey);
    return;
  }
}

function registerCollection(options: PersistentCollectionOptions): PersistentCollectionRegistration {
  const existing = registry.get(options.name);
  const registration: PersistentCollectionRegistration = {
    name: options.name,
    key: collectionKey(options.name),
    legacyKeys: Array.from(new Set([...(existing?.legacyKeys ?? []), ...(options.legacyKeys ?? [])])),
    exportable: options.exportable ?? existing?.exportable ?? true,
    sensitive: options.sensitive ?? existing?.sensitive ?? false,
    description: options.description ?? existing?.description,
  };
  registry.set(options.name, registration);
  return registration;
}

export function createPersistentCollection<T>(
  options: PersistentCollectionOptions,
): PersistentCollection<T> {
  const registration = registerCollection(options);
  const key = registration.key;
  migrateLegacyKeys<T>(key, registration.legacyKeys);
  return {
    key,
    read() {
      return parseRecords<T>(storage()?.getItem(key) ?? null);
    },
    write(records: T[]) {
      storage()?.setItem(
        key,
        JSON.stringify(
          typeof options.maxRecords === "number"
            ? records.slice(0, options.maxRecords)
            : records,
        ),
      );
    },
    clear() {
      storage()?.removeItem(key);
    },
  };
}

export function listPersistentCollections(): PersistentCollectionRegistration[] {
  return [...registry.values()].sort((first, second) => first.name.localeCompare(second.name));
}

export function readPersistentCollection<T = unknown>(name: string): T[] {
  const registration = registry.get(name) ?? registerCollection({ name });
  migrateLegacyKeys<T>(registration.key, registration.legacyKeys);
  return parseRecords<T>(storage()?.getItem(registration.key) ?? null);
}

export function writePersistentCollection<T = unknown>(name: string, records: T[]): void {
  const registration = registry.get(name) ?? registerCollection({ name });
  storage()?.setItem(registration.key, JSON.stringify(records));
}

export function clearPersistentCollection(name: string): void {
  const registration = registry.get(name) ?? registerCollection({ name });
  storage()?.removeItem(registration.key);
  for (const legacyKey of registration.legacyKeys) storage()?.removeItem(legacyKey);
}

export function exportPersistentCollections(options?: { includeSensitive?: boolean }) {
  return Object.fromEntries(
    listPersistentCollections()
      .filter((collection) => collection.exportable)
      .filter((collection) => options?.includeSensitive || !collection.sensitive)
      .map((collection) => [collection.name, readPersistentCollection(collection.name)]),
  );
}

export function importPersistentCollections(collections: Record<string, unknown[] | undefined>): void {
  Object.entries(collections).forEach(([name, records]) => {
    if (Array.isArray(records)) writePersistentCollection(name, records);
  });
}

export function getPersistenceBackendInfo(): PersistenceBackendInfo {
  const hasTauri = typeof window !== "undefined" && "__TAURI__" in window;
  return {
    type: "browser-local",
    namespace: DATA_NAMESPACE,
    sqliteReady: false,
    tauriReady: hasTauri,
    collections: listPersistentCollections(),
  };
}
