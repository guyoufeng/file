import type { Device, Rack } from '../../types/domain'
import type { DeviceImportRow, ImportValidationResult, ValidatedImportRow } from '../../types/import'
import { getEndU, validateUPosition } from '../rack/uPosition'

export function validateImportRows(
  rows: DeviceImportRow[],
  racks: Rack[],
  existingDevices: Device[],
): ImportValidationResult {
  const assetNos = new Set(existingDevices.map((device) => device.assetNo).filter(Boolean))
  const serialNumbers = new Set(existingDevices.map((device) => device.serialNumber).filter(Boolean))

  const validatedRows = rows.map((row): ValidatedImportRow => {
    const errors: string[] = []
    const warnings: string[] = []
    const rack = racks.find((item) => item.name === row.rackName)

    if (!row.computerName?.trim()) errors.push('计算机名不能为空')
    if (!rack) errors.push('机柜不存在')
    if (!validateUPosition(row.startU, row.heightU, rack?.heightU ?? 48)) errors.push('U位范围无效')
    if (row.assetNo && assetNos.has(row.assetNo)) errors.push('固定资产编号重复')
    if (row.serialNumber && serialNumbers.has(row.serialNumber)) errors.push('SN号重复')

    if (rack && hasImportUConflict(row, rack.id, existingDevices)) {
      errors.push('同一机柜同一安装面 U 位冲突')
    }

    if (!row.owner) warnings.push('责任人为空')
    if (!row.purpose) warnings.push('用途为空')
    if (!row.warrantyExpireAt) warnings.push('维保到期时间为空')
    if (!row.operatingSystem) warnings.push('操作系统为空')
    if (!row.hardwareSpec) warnings.push('硬件配置为空')
    if (!row.businessIp) warnings.push('业务IP为空')
    if (!row.managementIp) warnings.push('带外IP为空')

    return {
      row,
      rackId: rack?.id,
      errors,
      warnings,
    }
  })

  return {
    totalRows: rows.length,
    importableRows: validatedRows.filter((row) => row.errors.length === 0).length,
    errorRows: validatedRows.filter((row) => row.errors.length > 0).length,
    warningRows: validatedRows.filter((row) => row.errors.length === 0 && row.warnings.length > 0).length,
    newDevices: validatedRows.filter((row) => row.errors.length === 0).length,
    skippedDuplicateDevices: validatedRows.filter((row) =>
      row.errors.some((error) => error === '固定资产编号重复' || error === 'SN号重复'),
    ).length,
    rows: validatedRows,
  }
}

function hasImportUConflict(row: DeviceImportRow, rackId: string, devices: Device[]): boolean {
  const endU = getEndU(row.startU, row.heightU)
  return devices.some((device) => {
    if (device.rackId !== rackId || device.side !== row.side) {
      return false
    }
    return row.startU <= device.endU && endU >= device.startU
  })
}
