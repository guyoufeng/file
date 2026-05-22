import type { Alert, AlertLevel, AlertStatus, Device, Rack, Room } from '../../types/domain'

export interface AlertFilters {
  roomId?: string
  rackId?: string
  deviceId?: string
  level?: AlertLevel | 'all'
  status?: AlertStatus | 'all'
}

export interface AlertDeviceContext {
  device: Device | undefined
  rack: Rack | undefined
  room: Room | undefined
  location: string
}

export function filterAlerts(alerts: Alert[], devices: Device[], filters: AlertFilters): Alert[] {
  return alerts.filter((alert) => {
    const device = devices.find((item) => item.id === alert.deviceId)
    if (filters.deviceId && alert.deviceId !== filters.deviceId) return false
    if (filters.rackId && device?.rackId !== filters.rackId) return false
    if (filters.level && filters.level !== 'all' && alert.level !== filters.level) return false
    if (filters.status && filters.status !== 'all' && alert.status !== filters.status) return false
    return true
  })
}

export function filterAlertsWithContext(
  alerts: Alert[],
  devices: Device[],
  racks: Rack[],
  rooms: Room[],
  filters: AlertFilters,
): Alert[] {
  return filterAlerts(alerts, devices, filters).filter((alert) => {
    if (!filters.roomId) return true
    const context = getAlertDeviceContext(alert, devices, racks, rooms)
    return context.room?.id === filters.roomId
  })
}

export function getAlertDeviceContext(alert: Alert, devices: Device[], racks: Rack[], rooms: Room[]): AlertDeviceContext {
  const device = devices.find((item) => item.id === alert.deviceId)
  const rack = racks.find((item) => item.id === device?.rackId)
  const room = rooms.find((item) => item.id === rack?.roomId)
  return {
    device,
    rack,
    room,
    location: [room?.name, rack?.name, device ? `${device.startU}U-${device.endU}U` : undefined].filter(Boolean).join(' / '),
  }
}
