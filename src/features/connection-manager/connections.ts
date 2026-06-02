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

const STORAGE_KEY = "qf-ai-dcim.connectionRecords";

function storage() {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function readRecords(): ManagedConnection[] {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ManagedConnection[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecords(records: ManagedConnection[]) {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(records));
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

