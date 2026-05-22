import type { Alert, Device, Rack, Room } from '../../types/domain'

export interface RackCapacityMetric {
  rackId: string
  rackName: string
  usedU: number
  totalU: number
  usageRate: number
}

export interface ReportMetrics {
  roomCount: number
  rackCount: number
  deviceCount: number
  alertCount: number
  offlineCount: number
  expiringWarrantyCount: number
  categoryCounts: Record<string, number>
  statusCounts: Record<string, number>
  rackCapacityRank: RackCapacityMetric[]
}

export function buildReportMetrics(rooms: Room[], racks: Rack[], devices: Device[], alerts: Alert[]): ReportMetrics {
  const activeAlerts = alerts.filter((alert) => alert.status !== 'recovered' && alert.status !== 'closed')
  const categoryCounts = countBy(devices, (device) => device.categoryId)
  const statusCounts = countBy(devices, (device) => device.status)
  const rackCapacityRank = racks
    .map((rack) => {
      const usedU = devices.filter((device) => device.rackId === rack.id).reduce((total, device) => total + device.heightU, 0)
      return {
        rackId: rack.id,
        rackName: rack.name,
        usedU,
        totalU: rack.heightU,
        usageRate: rack.heightU > 0 ? usedU / rack.heightU : 0,
      }
    })
    .sort((a, b) => b.usageRate - a.usageRate)

  return {
    roomCount: rooms.length,
    rackCount: racks.length,
    deviceCount: devices.length,
    alertCount: activeAlerts.length,
    offlineCount: devices.filter((device) => device.status === 'offline').length,
    expiringWarrantyCount: devices.filter((device) => isWarrantyExpiring(device.warrantyExpireAt)).length,
    categoryCounts,
    statusCounts,
    rackCapacityRank,
  }
}

function countBy<T>(items: T[], getKey: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = getKey(item)
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
}

function isWarrantyExpiring(dateText?: string): boolean {
  if (!dateText) return false
  const date = new Date(dateText)
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  const oneYearLater = new Date(now)
  oneYearLater.setFullYear(now.getFullYear() + 1)
  return date >= now && date <= oneYearLater
}
