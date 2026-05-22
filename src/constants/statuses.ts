import type { DeviceStatus } from '../types/domain'

export const deviceStatusLabels: Record<DeviceStatus, string> = {
  normal: '正常',
  alert: '告警',
  offline: '离线',
  maintenance: '维护中',
  disabled: '停用',
  standby: '备用',
  pending_install: '待上架',
  pending_remove: '待下架',
  retired: '已退役',
}
