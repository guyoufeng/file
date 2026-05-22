export interface ImportColumnMapping {
  sourceColumn: string
  targetField: string
  required: boolean
}

export interface ImportPreviewRow {
  rowIndex: number
  values: Record<string, string>
  issues: string[]
}

export interface DeviceImportRow {
  rowIndex: number
  computerName: string
  rackName: string
  side: 'front' | 'rear'
  startU: number
  heightU: number
  categoryId: string
  subtype: string
  businessIp?: string
  managementIp?: string
  purpose?: string
  owner?: string
  vendor?: string
  model?: string
  serialNumber?: string
  assetNo?: string
  warrantyExpireAt?: string
  hardwareSpec?: string
  operatingSystem?: string
}

export interface RackImportRow {
  rowIndex: number
  roomName: string
  rackName: string
  rackType?: string
  rowName?: string
  columnIndex?: number
  heightU?: number
}

export interface ValidatedImportRow {
  row: DeviceImportRow
  rackId?: string
  errors: string[]
  warnings: string[]
}

export interface ImportValidationResult {
  totalRows: number
  importableRows: number
  errorRows: number
  warningRows: number
  newDevices: number
  skippedDuplicateDevices: number
  rows: ValidatedImportRow[]
}
