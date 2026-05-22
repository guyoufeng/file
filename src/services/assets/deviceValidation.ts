import type { Device, DeviceSide } from '../../types/domain'
import { getEndU, validateUPosition } from '../rack/uPosition'

export interface DeviceFormValue {
  id?: string
  computerName?: string
  roomId?: string
  rackId?: string
  side?: DeviceSide
  startU?: number
  heightU?: number
  categoryId?: string
  subtype?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateDeviceForm(value: DeviceFormValue): ValidationResult {
  const errors: string[] = []

  if (!value.computerName?.trim()) errors.push('计算机名不能为空')
  if (!value.roomId?.trim()) errors.push('机房不能为空')
  if (!value.rackId?.trim()) errors.push('机柜不能为空')
  if (!value.side) errors.push('安装面不能为空')
  if (!value.categoryId?.trim()) errors.push('设备大类不能为空')
  if (!value.subtype?.trim()) errors.push('设备子类型不能为空')
  if (!validateUPosition(value.startU ?? 0, value.heightU ?? 0)) errors.push('U位范围无效')

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function hasUConflict(value: DeviceFormValue, devices: Device[]): boolean {
  if (!value.rackId || !value.side || !value.startU || !value.heightU) {
    return false
  }

  const endU = getEndU(value.startU, value.heightU)

  return devices.some((device) => {
    if (device.id === value.id || device.rackId !== value.rackId || device.side !== value.side) {
      return false
    }

    return value.startU! <= device.endU && endU >= device.startU
  })
}
