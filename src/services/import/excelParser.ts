import * as XLSX from 'xlsx'
import type { Device, Rack } from '../../types/domain'
import type { DeviceImportRow, ImportValidationResult, RackImportRow } from '../../types/import'
import { validateImportRows } from './importValidator'

type SheetRow = Record<string, string | number | undefined>

export interface ParsedImportWorkbook {
  racks: RackImportRow[]
  devices: DeviceImportRow[]
}

export function parseDeviceImportWorkbook(buffer: ArrayBuffer): ParsedImportWorkbook {
  const workbook = XLSX.read(buffer, { type: 'array' })
  return {
    racks: parseRackRows(readSheet(workbook, '机柜清单')),
    devices: parseDeviceRows(readSheet(workbook, '设备清单')),
  }
}

export function parseAndValidateDeviceWorkbook(
  buffer: ArrayBuffer,
  racks: Rack[],
  devices: Device[],
): ImportValidationResult {
  const parsed = parseDeviceImportWorkbook(buffer)
  return validateImportRows(parsed.devices, racks, devices)
}

function readSheet(workbook: XLSX.WorkBook, sheetName: string): SheetRow[] {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: '' })
}

function parseRackRows(rows: SheetRow[]): RackImportRow[] {
  return rows.map((row, index) => ({
    rowIndex: index + 2,
    roomName: text(row['机房']),
    rackName: text(row['机柜名称']),
    rackType: text(row['机柜类型']),
    rowName: text(row['排']),
    columnIndex: numberValue(row['列']),
    heightU: numberValue(row['U数']),
  }))
}

function parseDeviceRows(rows: SheetRow[]): DeviceImportRow[] {
  return rows.map((row, index) => ({
    rowIndex: index + 2,
    computerName: text(row['计算机名']),
    rackName: text(row['所属机柜']),
    side: text(row['安装面']) === '背面' || text(row['安装面']).toLowerCase() === 'rear' ? 'rear' : 'front',
    startU: numberValue(row['起始U位']) ?? 0,
    heightU: numberValue(row['高度U']) ?? 0,
    categoryId: text(row['设备大类']) || 'server',
    subtype: text(row['设备子类型']),
    businessIp: text(row['业务IP']),
    managementIp: text(row['带外IP']),
    purpose: text(row['用途']),
    owner: text(row['责任人']),
    vendor: text(row['厂商']),
    model: text(row['型号']),
    serialNumber: text(row['SN号']),
    assetNo: text(row['固定资产编号']),
    warrantyExpireAt: text(row['维保到期']),
    hardwareSpec: text(row['硬件配置']),
    operatingSystem: text(row['操作系统']),
  }))
}

function text(value: unknown): string {
  return String(value ?? '').trim()
}

function numberValue(value: unknown): number | undefined {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}
