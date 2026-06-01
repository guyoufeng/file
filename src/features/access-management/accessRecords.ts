export interface AccessRecord {
  id: string;
  date: string;
  unit: string;
  visitorName: string;
  enterTime: string;
  leaveTime?: string;
  reason: string;
  isServerRepair: boolean;
  deviceId?: string;
  deviceName?: string;
  faultDescription?: string;
  result?: string;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}

export type AccessRecordInput = Omit<AccessRecord, "id" | "createdAt" | "updatedAt">;

const STORAGE_KEY = "qf-ai-dcim.accessRecords";

function storage() {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function readRecords(): AccessRecord[] {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AccessRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecords(records: AccessRecord[]) {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(records));
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `access-${crypto.randomUUID()}`;
  }
  return `access-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

export function getAccessRecords(): AccessRecord[] {
  return readRecords().sort((first, second) =>
    `${second.date} ${second.enterTime}`.localeCompare(`${first.date} ${first.enterTime}`),
  );
}

export function createAccessRecord(input: AccessRecordInput): AccessRecord {
  const now = new Date().toISOString();
  const record: AccessRecord = {
    ...input,
    id: createId(),
    attachments: input.attachments ?? [],
    createdAt: now,
    updatedAt: now,
  };
  writeRecords([record, ...readRecords()]);
  return record;
}

export function updateAccessRecord(id: string, patch: Partial<AccessRecordInput>): AccessRecord | undefined {
  const records = readRecords();
  const existing = records.find((item) => item.id === id);
  if (!existing) return undefined;
  const updated: AccessRecord = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeRecords(records.map((item) => (item.id === id ? updated : item)));
  return updated;
}

export function deleteAccessRecord(id: string) {
  writeRecords(readRecords().filter((item) => item.id !== id));
}

export function searchAccessRecords(keyword: string, records = getAccessRecords()): AccessRecord[] {
  const keywords = keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return records;
  return records.filter((record) => keywords.every((item) => includesKeyword(record, item)));
}

export function importAccessRecords(rows: Array<Partial<AccessRecordInput>>): AccessRecord[] {
  return rows
    .filter((row) => row.date && row.unit && row.visitorName && row.enterTime)
    .map((row) =>
      createAccessRecord({
        date: row.date!,
        unit: row.unit!,
        visitorName: row.visitorName!,
        enterTime: row.enterTime!,
        leaveTime: row.leaveTime,
        reason: row.reason ?? "",
        isServerRepair: Boolean(row.isServerRepair),
        deviceId: row.deviceId,
        deviceName: row.deviceName,
        faultDescription: row.faultDescription,
        result: row.result,
        attachments: row.attachments ?? [],
      }),
    );
}
