import { createPersistentCollection } from "../../services/persistence/unifiedPersistence";

export interface VirtualServer {
  id: string;
  name: string;
  platform: "ZStack" | "VMware" | "Other";
  businessIp?: string;
  os?: string;
  purpose?: string;
  owner?: string;
  hostDeviceId?: string;
  hostDeviceName?: string;
  status: "running" | "stopped" | "warning" | "unknown";
}

export type VirtualServerInput = Omit<VirtualServer, "id"> & { id?: string };

export interface VirtualServerMutationResult {
  ok: boolean;
  message: string;
  servers: VirtualServer[];
}

interface VirtualServerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const storageKey = "qf-ai-dcim.virtualServers";
const virtualServerCollection = createPersistentCollection<VirtualServer>({
  name: "operations.virtualServers",
  legacyKeys: [storageKey],
});

export const sampleVirtualServers: VirtualServer[] = [
  {
    id: "vm-mes-app-01",
    name: "MES-VM-APP-01",
    platform: "ZStack",
    businessIp: "192.168.129.51",
    os: "Rocky Linux 9",
    purpose: "MES应用服务",
    owner: "张文军",
    hostDeviceId: "dev-001",
    hostDeviceName: "QF-SRV-001",
    status: "running",
  },
  {
    id: "vm-report-01",
    name: "REPORT-VM-01",
    platform: "ZStack",
    businessIp: "192.168.129.88",
    os: "Windows Server 2022",
    purpose: "报表服务",
    owner: "王五",
    hostDeviceId: "dev-002",
    hostDeviceName: "QF-SRV-002",
    status: "warning",
  },
];

export function filterVirtualServers(
  servers: VirtualServer[],
  keyword: string,
): VirtualServer[] {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return servers;

  return servers.filter((server) =>
    [
      server.name,
      server.businessIp,
      server.os,
      server.purpose,
      server.owner,
      server.hostDeviceName,
      server.platform,
    ]
      .filter(Boolean)
      .some((field) => field!.toLowerCase().includes(normalized)),
  );
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function addVirtualServer(
  servers: VirtualServer[],
  input: VirtualServerInput,
): VirtualServerMutationResult {
  const name = input.name.trim();
  if (!name) {
    return { ok: false, message: "虚拟机名不能为空", servers };
  }

  const businessIp = input.businessIp?.trim();
  if (
    businessIp &&
    servers.some((server) => server.businessIp?.trim() === businessIp)
  ) {
    return { ok: false, message: `业务IP已存在：${businessIp}`, servers };
  }

  const id = input.id?.trim() || `vm-${normalizeId(name)}`;
  if (servers.some((server) => server.id === id || server.name === name)) {
    return { ok: false, message: `虚拟机已存在：${name}`, servers };
  }

  return {
    ok: true,
    message: `已录入虚拟服务器：${name}`,
    servers: [
      ...servers,
      {
        ...input,
        id,
        name,
        businessIp,
        purpose: input.purpose?.trim(),
        owner: input.owner?.trim(),
        hostDeviceName: input.hostDeviceName?.trim(),
        os: input.os?.trim(),
      },
    ],
  };
}

function getDefaultStorage(): VirtualServerStorage | undefined {
  if (typeof localStorage === "undefined") return undefined;
  return localStorage;
}

export function loadVirtualServers(
  storage: VirtualServerStorage | undefined = getDefaultStorage(),
): VirtualServer[] {
  if (!storage) return sampleVirtualServers;
  if (storage === getDefaultStorage()) {
    const records = virtualServerCollection.read();
    return records.length > 0 ? records : sampleVirtualServers;
  }
  const raw = storage.getItem(storageKey);
  if (!raw) return sampleVirtualServers;

  try {
    const parsed = JSON.parse(raw) as VirtualServer[];
    return Array.isArray(parsed) ? parsed : sampleVirtualServers;
  } catch {
    return sampleVirtualServers;
  }
}

export function saveVirtualServers(
  servers: VirtualServer[],
  storage: VirtualServerStorage | undefined = getDefaultStorage(),
): void {
  if (storage === getDefaultStorage()) {
    virtualServerCollection.write(servers);
    return;
  }
  storage?.setItem(storageKey, JSON.stringify(servers));
}
