import type { Alert, Device, Rack, Room } from '../../types/domain'

export interface RackTileStats {
  deviceCount: number
  alertCount: number
  usedU: number
  capacityText: string
}

const roomOrder = ['529数据中心', '99数据中心', '308数据中心', '杭州数据中心', '越南C7数据中心']

export function getRoomOptions(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) => {
    const leftIndex = roomOrder.indexOf(a.name)
    const rightIndex = roomOrder.indexOf(b.name)
    const leftOrder = leftIndex >= 0 ? leftIndex : roomOrder.length
    const rightOrder = rightIndex >= 0 ? rightIndex : roomOrder.length

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    return rooms.indexOf(a) - rooms.indexOf(b)
  })
}

export function getRackTileStats(rack: Rack, devices: Device[], alerts: Alert[]): RackTileStats {
  const rackDevices = devices.filter((device) => device.rackId === rack.id)
  const rackDeviceIds = new Set(rackDevices.map((device) => device.id))
  const alertCount = alerts.filter((alert) => rackDeviceIds.has(alert.deviceId) && alert.status !== 'recovered').length
  const usedU = rackDevices.reduce((total, device) => total + device.heightU, 0)

  return {
    deviceCount: rackDevices.length,
    alertCount,
    usedU,
    capacityText: `${usedU}U / ${rack.heightU}U`,
  }
}

export function getRoomRacks(room: Room | undefined, racks: Rack[]): Rack[] {
  if (!room) {
    return []
  }

  return racks
    .filter((rack) => rack.roomId === room.id)
    .sort((a, b) => {
      const rowCompare = (a.rowName ?? '').localeCompare(b.rowName ?? '', 'zh-Hans-CN')
      if (rowCompare !== 0) {
        return rowCompare
      }
      return (a.columnIndex ?? 0) - (b.columnIndex ?? 0)
    })
}
