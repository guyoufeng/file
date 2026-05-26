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
