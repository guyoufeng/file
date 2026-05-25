import * as XLSX from "xlsx";
import type { Device, Rack } from "../../types/domain";
import type {
  DeviceImportRow,
  ImportValidationResult,
  RackImportRow,
} from "../../types/import";
import { validateImportRows } from "./importValidator";

type SheetRow = Record<string, string | number | undefined>;

export interface ParsedImportWorkbook {
  racks: RackImportRow[];
  devices: DeviceImportRow[];
}

export function parseDeviceImportWorkbook(
  buffer: ArrayBuffer,
): ParsedImportWorkbook {
  const workbook = XLSX.read(buffer, { type: "array" });
  const deviceRows = readSheet(workbook, "设备清单");
  const fallbackRows =
    deviceRows.length > 0 ? deviceRows : readFirstSheet(workbook);

  return {
    racks: parseRackRows(readSheet(workbook, "机柜清单")),
    devices: parseDeviceRows(fallbackRows),
  };
}

export function parseAndValidateDeviceWorkbook(
  buffer: ArrayBuffer,
  racks: Rack[],
  devices: Device[],
): ImportValidationResult {
  const parsed = parseDeviceImportWorkbook(buffer);
  return validateImportRows(parsed.devices, racks, devices);
}

function readSheet(workbook: XLSX.WorkBook, sheetName: string): SheetRow[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: "" });
}

function readFirstSheet(workbook: XLSX.WorkBook): SheetRow[] {
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  return readSheet(workbook, firstSheetName);
}

function parseRackRows(rows: SheetRow[]): RackImportRow[] {
  return rows.map((row, index) => ({
    rowIndex: index + 2,
    roomName: text(row["机房"]),
    rackName: text(row["机柜名称"]),
    rackType: text(row["机柜类型"]),
    rowName: text(row["排"]),
    columnIndex: numberValue(row["列"]),
    heightU: numberValue(row["U数"]),
  }));
}

function parseDeviceRows(rows: SheetRow[]): DeviceImportRow[] {
  return rows
    .map((row, index) => parseDeviceRow(row, index))
    .filter(
      (row) =>
        row.rackName || row.computerName || row.businessIp || row.purpose,
    );
}

function parseDeviceRow(row: SheetRow, index: number): DeviceImportRow {
  const rackName = firstText(row, ["所属机柜", "机柜号"]);
  const purpose = firstText(row, ["用途", "类型"]);
  const model = firstText(row, ["型号", "资产说明"]);
  const position = parseUPosition(firstText(row, ["机柜位置"]));
  const category = normalizeCategory(
    firstText(row, ["设备大类", "资产大类", "分组"]),
    purpose,
    model,
  );
  const subtype =
    firstText(row, ["设备子类型"]) || inferSubtype(category, purpose);
  const computerName =
    firstText(row, ["计算机名"]) ||
    buildDisplayName(rackName, subtype || purpose || model || "未命名设备");

  return {
    rowIndex: index + 2,
    computerName,
    rackName,
    side:
      firstText(row, ["安装面"]) === "背面" ||
      firstText(row, ["安装面"]).toLowerCase() === "rear"
        ? "rear"
        : "front",
    startU: numberValue(row["起始U位"]) ?? position.startU,
    heightU: numberValue(row["高度U"]) ?? position.heightU,
    categoryId: category,
    subtype,
    businessIp: firstText(row, ["业务IP", "IP"]),
    managementIp: firstText(row, ["带外IP", "外接管理口"]),
    purpose,
    owner: text(row["责任人"]),
    vendor: text(row["厂商"]),
    model,
    serialNumber: firstText(row, ["SN号", "维保号"]),
    assetNo: firstText(row, ["固定资产编号", "固定资产号"]),
    warrantyExpireAt: firstText(row, ["维保到期", "服务器维保"]),
    hardwareSpec: text(row["硬件配置"]),
    operatingSystem: text(row["操作系统"]),
  };
}

function firstText(row: SheetRow, keys: string[]): string {
  for (const key of keys) {
    const value = text(row[key]);
    if (value) return value;
  }
  return "";
}

function parseUPosition(value: string): { startU: number; heightU: number } {
  const positions = value.match(/\d+/g)?.map(Number) ?? [];
  if (positions.length === 1) {
    return { startU: positions[0], heightU: 1 };
  }
  if (positions.length >= 2) {
    const startU = Math.min(positions[0], positions[1]);
    return { startU, heightU: Math.abs(positions[1] - positions[0]) + 1 };
  }
  return { startU: 0, heightU: 0 };
}

function normalizeCategory(value: string, purpose: string, model: string): string {
  const explicit = value.trim().toLowerCase();
  if (explicit) {
    if (/server|服务器|物理机|数据库|虚拟化|超融合/.test(explicit)) return "server";
    if (/storage|存储|san|nas/.test(explicit)) return "storage";
    if (/network|交换机|网络|路由/.test(explicit)) return "network";
    if (/security|安全|防火墙|waf/.test(explicit)) return "security";
    if (/facility|精密空调|列头柜|ups|pdu|基础设施/.test(explicit)) return "facility";
    if (/patch|配线|理线|odf|mdf/.test(explicit)) return "patching";
    return "other";
  }

  const text = `${purpose} ${model}`.toLowerCase();
  if (/精密空调|列头柜|ups|pdu|供电/.test(text)) return "facility";
  if (/防火墙|waf|安全/.test(text)) return "security";
  if (/配线|odf|mdf|patch/.test(text)) return "patching";
  if (/交换机|路由|防火墙|网络/.test(text)) return "network";
  if (/存储|dd6300|nas|san|备份/.test(text)) return "storage";
  return "server";
}

function inferSubtype(category: string, purpose: string): string {
  if (category === "facility") {
    if (purpose.includes("精密空调")) return "精密空调";
    if (purpose.includes("列头柜")) return "列头柜";
    return "基础设施";
  }
  if (category === "patching") return "配线架";
  if (category === "network") return "网络设备";
  if (category === "storage") return "存储设备";
  if (/数据库|db/i.test(purpose)) return "数据库服务器";
  if (/zstack|虚拟化|超融合/i.test(purpose)) return "虚拟化服务器";
  return "物理服务器";
}

function buildDisplayName(rackName: string, label: string): string {
  return [rackName, label].filter(Boolean).join("-");
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function numberValue(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
