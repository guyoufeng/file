import type { Device } from "../../types/domain";
import { createPersistentCollection } from "../../services/persistence/unifiedPersistence";

export type ConnectionDirection =
  | "front_to_rear"
  | "rear_to_front"
  | "same_side"
  | "uplink"
  | "oob";

export type ConnectionStatus = "active" | "planned" | "disabled";

export interface ManagedConnection {
  id: string;
  sourceDeviceId: string;
  sourceDeviceName: string;
  sourcePortName: string;
  targetDeviceId: string;
  targetDeviceName: string;
  targetPortName: string;
  cableNo?: string;
  cableType?: string;
  direction: ConnectionDirection;
  status: ConnectionStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ManagedConnectionInput = Omit<ManagedConnection, "id" | "createdAt" | "updatedAt">;

export interface ConnectionNodePosition {
  x: number;
  y: number;
}

export interface SavedConnectionView {
  id: string;
  name: string;
  selectedDeviceIds: string[];
  keyword: string;
  zoom: number;
  nodePositions: Record<string, ConnectionNodePosition>;
  createdAt: string;
  updatedAt: string;
}

export type SavedConnectionViewInput = Omit<SavedConnectionView, "id" | "createdAt" | "updatedAt">;

export interface ConnectionNodeLinkSummary {
  recordId: string;
  localPort: string;
  peerDeviceId: string;
  peerDeviceName: string;
  peerPort: string;
  cableNo?: string;
  cableType?: string;
  status: ConnectionStatus;
  notes?: string;
}

export interface ConnectionNodeSummary {
  id: string;
  name: string;
  role: "server" | "switch";
  subtitle: string;
  links: ConnectionNodeLinkSummary[];
}

const STORAGE_KEY = "qf-ai-dcim.connectionRecords";
const DEMO_SEEDED_KEY = "qf-ai-dcim.connectionRecords.demoSeeded";
const VIEW_STORAGE_KEY = "qf-ai-dcim.connectionViews";
const connectionCollection = createPersistentCollection<ManagedConnection>({
  name: "connections.records",
  legacyKeys: [STORAGE_KEY],
});
const viewCollection = createPersistentCollection<SavedConnectionView>({
  name: "connections.views",
  legacyKeys: [VIEW_STORAGE_KEY],
});

function storage() {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function readRecords(): ManagedConnection[] {
  return connectionCollection.read();
}

function writeRecords(records: ManagedConnection[]) {
  connectionCollection.write(records);
}

function readViews(): SavedConnectionView[] {
  return viewCollection.read();
}

function writeViews(views: SavedConnectionView[]) {
  viewCollection.write(views);
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `connection-${crypto.randomUUID()}`;
  }
  return `connection-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function includesKeyword(value: unknown, keyword: string): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" || typeof value === "number") {
    return String(value).toLowerCase().includes(keyword);
  }
  if (Array.isArray(value)) return value.some((item) => includesKeyword(item, keyword));
  if (typeof value === "object") return Object.values(value).some((item) => includesKeyword(item, keyword));
  return false;
}

export function getConnectionRecords(): ManagedConnection[] {
  return readRecords().sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}

function buildDemoConnection(device: Device, index: number): ManagedConnection {
  const switchIndex = index % 2 === 0 ? "A" : "B";
  const switchName = switchIndex === "A" ? "SW-529-CORE-A" : "SW-529-ACCESS-B";
  const targetPort = switchIndex === "A" ? `GE1/0/${index + 1}` : `GE2/0/${index + 1}`;
  const now = new Date(Date.UTC(2026, 5, 2, 8, index, 0)).toISOString();
  return {
    id: `demo-connection-${device.id}-${index}`,
    sourceDeviceId: device.id,
    sourceDeviceName: device.computerName || device.name,
    sourcePortName: index % 3 === 0 ? "bond0" : index % 3 === 1 ? "eth0" : "iDRAC",
    targetDeviceId: `demo-switch-${switchIndex.toLowerCase()}`,
    targetDeviceName: switchName,
    targetPortName: targetPort,
    cableNo: `CAB-529-${String(index + 1).padStart(3, "0")}`,
    cableType: index % 3 === 2 ? "管理网铜缆" : "万兆光纤",
    direction: index % 3 === 2 ? "oob" : "uplink",
    status: "active",
    notes: `${device.businessIp || "无业务IP"} 演示链路，后续可替换为真实接线数据。`,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildConnectionNodeSummaries(records: ManagedConnection[]): ConnectionNodeSummary[] {
  const nodes = new Map<string, ConnectionNodeSummary>();

  function ensureNode(id: string, name: string, role: "server" | "switch") {
    const existing = nodes.get(id);
    if (existing) return existing;
    const next: ConnectionNodeSummary = {
      id,
      name,
      role,
      subtitle: "",
      links: [],
    };
    nodes.set(id, next);
    return next;
  }

  for (const record of records) {
    const source = ensureNode(record.sourceDeviceId, record.sourceDeviceName, "server");
    const target = ensureNode(record.targetDeviceId, record.targetDeviceName, "switch");
    source.links.push({
      recordId: record.id,
      localPort: record.sourcePortName,
      peerDeviceId: record.targetDeviceId,
      peerDeviceName: record.targetDeviceName,
      peerPort: record.targetPortName,
      cableNo: record.cableNo,
      cableType: record.cableType,
      status: record.status,
      notes: record.notes,
    });
    target.links.push({
      recordId: record.id,
      localPort: record.targetPortName,
      peerDeviceId: record.sourceDeviceId,
      peerDeviceName: record.sourceDeviceName,
      peerPort: record.sourcePortName,
      cableNo: record.cableNo,
      cableType: record.cableType,
      status: record.status,
      notes: record.notes,
    });
  }

  for (const node of nodes.values()) {
    const portCount = new Set(node.links.map((link) => link.localPort)).size;
    node.subtitle =
      node.role === "switch"
        ? `${node.links.length} 条链路 / ${portCount} 个端口`
        : node.links[0]?.localPort ?? "未录入端口";
    node.links.sort((first, second) => first.localPort.localeCompare(second.localPort, "zh-CN", { numeric: true }));
  }

  return [...nodes.values()].sort((first, second) => first.name.localeCompare(second.name));
}

export function ensureDemoConnectionRecords(devices: Device[] = []): ManagedConnection[] {
  const current = readRecords();
  const seeded = storage()?.getItem(DEMO_SEEDED_KEY);
  if (seeded) return getConnectionRecords();
  if (current.length > 0) {
    storage()?.setItem(DEMO_SEEDED_KEY, "manual-existing");
    return getConnectionRecords();
  }

  const sourceDevices = devices
    .filter((device) => device.computerName || device.businessIp || device.name)
    .slice(0, 24);
  const demoRecords = sourceDevices.map((device, index) => buildDemoConnection(device, index));
  writeRecords(demoRecords);
  storage()?.setItem(DEMO_SEEDED_KEY, "demo");
  return getConnectionRecords();
}

export function createConnectionRecord(input: ManagedConnectionInput): ManagedConnection {
  const now = new Date().toISOString();
  const record: ManagedConnection = {
    ...input,
    id: createId(),
    createdAt: now,
    updatedAt: now,
  };
  writeRecords([record, ...readRecords()]);
  return record;
}

export function updateConnectionRecord(
  id: string,
  patch: Partial<ManagedConnectionInput>,
): ManagedConnection | undefined {
  const records = readRecords();
  const existing = records.find((item) => item.id === id);
  if (!existing) return undefined;
  const updated: ManagedConnection = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeRecords(records.map((item) => (item.id === id ? updated : item)));
  return updated;
}

export function deleteConnectionRecord(id: string) {
  writeRecords(readRecords().filter((item) => item.id !== id));
}

export function searchConnectionRecords(keyword: string, records = getConnectionRecords()): ManagedConnection[] {
  const keywords = keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return records;
  return records.filter((record) => keywords.every((item) => includesKeyword(record, item)));
}

export function getSavedConnectionViews(): SavedConnectionView[] {
  return readViews().sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}

export function saveConnectionView(input: SavedConnectionViewInput): SavedConnectionView {
  const now = new Date().toISOString();
  const view: SavedConnectionView = {
    ...input,
    id: createId().replace("connection-", "connection-view-"),
    createdAt: now,
    updatedAt: now,
  };
  writeViews([view, ...readViews()]);
  return view;
}

export function updateConnectionView(
  id: string,
  patch: Partial<SavedConnectionViewInput>,
): SavedConnectionView | undefined {
  const views = readViews();
  const existing = views.find((view) => view.id === id);
  if (!existing) return undefined;
  const updated: SavedConnectionView = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeViews(views.map((view) => (view.id === id ? updated : view)));
  return updated;
}

export function deleteConnectionView(id: string) {
  writeViews(readViews().filter((view) => view.id !== id));
}
