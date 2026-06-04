import { createPersistentCollection } from "../../services/persistence/unifiedPersistence";

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
export type AccessRecordImportRow = Partial<AccessRecordInput> & Record<string, unknown>;

const STORAGE_KEY = "qf-ai-dcim.accessRecords";
const accessRecordCollection = createPersistentCollection<AccessRecord>({
  name: "operations.accessRecords",
  legacyKeys: [STORAGE_KEY],
});

function readRecords(): AccessRecord[] {
  return accessRecordCollection.read();
}

function writeRecords(records: AccessRecord[]) {
  accessRecordCollection.write(records);
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

function valueText(row: AccessRecordImportRow, fields: string[]): string {
  for (const field of fields) {
    const value = row[field];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function excelSerialToDate(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86400 * 1000));
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 1) {
    return excelSerialToDate(value).toISOString().slice(0, 10);
  }
  const text = String(value ?? "").trim();
  if (!text) return "";
  const chinese = text.match(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/);
  if (chinese) {
    return `${chinese[1]}-${chinese[2].padStart(2, "0")}-${chinese[3].padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  const normalized = text.replace(/[./]/g, "-");
  return /^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)
    ? normalized
        .split("-")
        .map((part, index) => (index === 0 ? part : part.padStart(2, "0")))
        .join("-")
    : "";
}

function normalizeTime(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(11, 16);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const dayFraction = value > 1 ? value % 1 : value;
    const totalMinutes = Math.round(dayFraction * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  const text = String(value ?? "").trim();
  if (!text) return "";
  const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) return `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
  return text;
}

function splitAttachments(value: string): string[] {
  return value
    .split(/[，,、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeImportRow(row: AccessRecordImportRow): AccessRecordInput | undefined {
  const date =
    normalizeDate(row.date) ||
    normalizeDate(row["日期"]) ||
    normalizeDate(row["进入日期"]);
  const unit = valueText(row, ["unit", "单位", "公司", "施工单位", "维保单位", "地点"]) || "未填写单位";
  const visitorName =
    valueText(row, ["visitorName", "人员", "姓名", "进入人员", "联系人", "工程师"]) || unit;
  const enterTime = normalizeTime(row.enterTime ?? row["进入时间"] ?? row["入场时间"]);
  const leaveTime = normalizeTime(row.leaveTime ?? row["离开时间"] ?? row["出场时间"]);
  if (!date || !enterTime) return undefined;

  const assetNo = valueText(row, ["固定资产编号", "资产编号", "assetNo"]);
  const assetDescription = valueText(row, ["资产说明", "服务器", "设备", "deviceName"]);
  const ip = valueText(row, ["IP地址", "业务IP", "ip", "businessIp"]);
  const deviceName = [assetNo, assetDescription, ip].filter(Boolean).join(" / ") || undefined;
  const reason = valueText(row, ["reason", "事由", "进入事由", "维修事由"]);
  const faultDescription = valueText(row, ["faultDescription", "故障", "故障描述", "事由"]);
  const result = valueText(row, ["result", "处理结果", "结果", "用途描述"]);
  const repairFlag = String(row.isServerRepair ?? row["物理机维修"] ?? "");
  const isServerRepair =
    Boolean(row.isServerRepair) ||
    /是|true|1|维修|服务器|物理机|故障/i.test(repairFlag) ||
    Boolean(assetNo || assetDescription || ip);

  return {
    date,
    unit,
    visitorName,
    enterTime,
    leaveTime: leaveTime || undefined,
    reason,
    isServerRepair,
    deviceId: valueText(row, ["deviceId", "设备ID"]) || undefined,
    deviceName,
    faultDescription: faultDescription || undefined,
    result: result || undefined,
    attachments: row.attachments ?? splitAttachments(valueText(row, ["附件", "照片"])),
  };
}

export function normalizeAccessRecordImportRows(rows: AccessRecordImportRow[]): AccessRecordInput[] {
  return rows
    .map(normalizeImportRow)
    .filter((row): row is AccessRecordInput => Boolean(row));
}

export function importAccessRecords(rows: AccessRecordImportRow[]): AccessRecord[] {
  return normalizeAccessRecordImportRows(rows).map((row) => createAccessRecord(row));
}
