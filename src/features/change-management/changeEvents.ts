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
export type ChangeEventImportRow = Record<string, unknown>;

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

function rowText(row: ChangeEventImportRow, fields: string[]): string {
  for (const field of fields) {
    const value = row[field];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function normalizeChangeType(value: string): ChangeEventType {
  if (/上架/.test(value)) return "rack_mount";
  if (/下架/.test(value)) return "rack_unmount";
  if (/接线|端口|线缆/.test(value)) return "cabling";
  if (/软件|安装/.test(value)) return "software";
  if (/配置|调整/.test(value)) return "configuration";
  if (/巡检|复核/.test(value)) return "inspection";
  if (/维修|维护|故障/.test(value)) return "maintenance";
  return "other";
}

function normalizeChangeStatus(value: string): ChangeEventStatus {
  if (/计划/.test(value)) return "planned";
  if (/进行/.test(value)) return "in_progress";
  if (/复核/.test(value)) return "reviewed";
  if (/取消/.test(value)) return "cancelled";
  return "completed";
}

function normalizeChangedAt(value: string): string {
  const raw = value.trim();
  if (!raw) return new Date().toISOString();
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function splitAttachments(value: string): string[] {
  return value
    .split(/[,\s，、]+/)
    .map((item) => item.trim())
    .filter(Boolean);
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

export function importChangeEventsFromRows(rows: ChangeEventImportRow[]): ChangeEvent[] {
  const imported: ChangeEvent[] = [];
  for (const row of rows) {
    const title = rowText(row, ["变更标题", "标题", "title"]);
    if (!title) continue;
    const typeText = rowText(row, ["变更类型", "类型", "type"]);
    const statusText = rowText(row, ["状态", "status"]);
    imported.push(
      createChangeEvent({
        title,
        type: normalizeChangeType(typeText),
        status: normalizeChangeStatus(statusText),
        roomName: rowText(row, ["机房", "roomName", "room"]),
        rackName: rowText(row, ["机柜", "rackName", "rack"]),
        deviceName: rowText(row, ["设备名称", "设备", "计算机名", "deviceName", "device"]),
        businessIp: rowText(row, ["业务IP", "IP", "ip", "businessIp"]),
        operator: rowText(row, ["操作人", "operator"]) || "admin",
        changedAt: normalizeChangedAt(rowText(row, ["变更时间", "时间", "changedAt"])),
        content: rowText(row, ["变更内容", "内容", "content"]) || "未填写变更内容",
        impact: rowText(row, ["影响范围", "影响", "impact"]),
        result: rowText(row, ["处理结果", "结果", "result"]),
        attachments: splitAttachments(rowText(row, ["附件", "照片", "attachments"])),
      }),
    );
  }
  return imported;
}
