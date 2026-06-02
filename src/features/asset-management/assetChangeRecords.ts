import type { ChangeRecord } from "../../types/domain";

const STORAGE_KEY = "qf-ai-dcim.assetChangeRecords";

function storage() {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function readRecords(): ChangeRecord[] {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ChangeRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecords(records: ChangeRecord[]) {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(records));
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `change-${crypto.randomUUID()}`;
  }
  return `change-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getDeviceChangeRecords(deviceId: string): ChangeRecord[] {
  return readRecords()
    .filter((record) => record.deviceId === deviceId)
    .sort((first, second) => second.changedAt.localeCompare(first.changedAt));
}

export function addDeviceChangeRecord(input: Omit<ChangeRecord, "id">): ChangeRecord {
  const record: ChangeRecord = {
    ...input,
    id: createId(),
  };
  writeRecords([record, ...readRecords()]);
  return record;
}
