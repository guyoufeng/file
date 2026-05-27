import type { Alert, AlertLevel, Device, Rack, RackType } from '../../types/domain'
import { getRackTypeColor } from '../rack/rackTypePresentation'

const alertPriority: Record<AlertLevel, number> = {
  info: 1,
  warning: 2,
  critical: 3,
}

export interface RackVisualState {
  color: string
  emissive: string
  alertLevel: AlertLevel | null
  opacity: number
}

export function rackTypeColor(type: RackType): string {
  return getRackTypeColor(type)
}

export function getRackVisualState(rack: Rack, devices: Device[], alerts: Alert[]): RackVisualState {
  const rackDeviceIds = new Set(devices.filter((device) => device.rackId === rack.id).map((device) => device.id))
  const activeAlertLevels = alerts
    .filter((alert) => rackDeviceIds.has(alert.deviceId) && alert.status !== 'recovered' && alert.status !== 'closed')
    .map((alert) => alert.level)
    .sort((a, b) => alertPriority[b] - alertPriority[a])
  const alertLevel = activeAlertLevels[0] ?? null

  if (alertLevel === 'critical') {
    return { color: '#ef4444', emissive: '#7f1d1d', alertLevel, opacity: 1 }
  }

  if (alertLevel === 'warning') {
    return { color: '#f59e0b', emissive: '#78350f', alertLevel, opacity: 1 }
  }

  return {
    color: rackTypeColor(rack.type),
    emissive: rack.type === 'empty' ? '#0f172a' : '#020617',
    alertLevel: null,
    opacity: rack.type === 'empty' ? 0.54 : 0.92,
  }
}
