export type ChangeEventType =
  | "rack_mount"
  | "rack_unmount"
  | "maintenance"
  | "cabling"
  | "software"
  | "configuration"
  | "inspection"
  | "other";

export type ChangeEventStatus = "planned" | "in_progress" | "completed" | "reviewed" | "cancelled";

export interface ChangeEvent {
  id: string;
  title: string;
  type: ChangeEventType;
  status: ChangeEventStatus;
  roomId?: string;
  roomName?: string;
  rackId?: string;
  rackName?: string;
  deviceId?: string;
  deviceName?: string;
  businessIp?: string;
  operator: string;
  changedAt: string;
  content: string;
  impact?: string;
  result?: string;
  relatedConnectionId?: string;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}

export type ChangeEventInput = Omit<ChangeEvent, "id" | "createdAt" | "updatedAt">;

const STORAGE_KEY = "qf-ai-dcim.changeEvents";

function storage() {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function readRecords(): ChangeEvent[] {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ChangeEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecords(records: ChangeEvent[]) {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(records));
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `change-event-${crypto.randomUUID()}`;
  }
  return `change-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function includesKeyword(value: unknown, keyword: string): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).toLowerCase().includes(keyword);
  }
  if (Array.isArray(value)) return value.some((item) => includesKeyword(item, keyword));
  if (typeof value === "object") return Object.values(value).some((item) => includesKeyword(item, keyword));
  return false;
}

export function getChangeEvents(): ChangeEvent[] {
  return readRecords().sort((first, second) => second.changedAt.localeCompare(first.changedAt));
}

export function createChangeEvent(input: ChangeEventInput): ChangeEvent {
  const now = new Date().toISOString();
  const record: ChangeEvent = {
    ...input,
    attachments: input.attachments ?? [],
    id: createId(),
    createdAt: now,
    updatedAt: now,
  };
  writeRecords([record, ...readRecords()]);
  return record;
}

export function updateChangeEvent(
  id: string,
  patch: Partial<ChangeEventInput>,
): ChangeEvent | undefined {
  const records = readRecords();
  const existing = records.find((item) => item.id === id);
  if (!existing) return undefined;
  const updated: ChangeEvent = {
    ...existing,
    ...patch,
    attachments: patch.attachments ?? existing.attachments,
    updatedAt: new Date().toISOString(),
  };
  writeRecords(records.map((item) => (item.id === id ? updated : item)));
  return updated;
}

export function deleteChangeEvent(id: string) {
  writeRecords(readRecords().filter((item) => item.id !== id));
}

export function searchChangeEvents(keyword: string, records = getChangeEvents()): ChangeEvent[] {
  const keywords = keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return records;
  return records.filter((record) => keywords.every((item) => includesKeyword(record, item)));
}

export function getDeviceChangeEvents(deviceId: string): ChangeEvent[] {
  return getChangeEvents().filter((event) => event.deviceId === deviceId);
}
