import type { Device, Rack, Room } from '../../types/domain'

export interface DeviceSearchResult {
  device: Device
  rack: Rack | undefined
  room: Room | undefined
  location: string
  matchedText: string
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

export function searchDevices(query: string, devices: Device[], racks: Rack[], rooms: Room[]): DeviceSearchResult[] {
  const keyword = normalize(query)
  if (!keyword) {
    return []
  }

  return devices
    .map((device) => {
      const rack = racks.find((item) => item.id === device.rackId)
      const room = rooms.find((item) => item.id === rack?.roomId)
      const fields = [
        device.computerName,
        device.businessIp,
        device.managementIp,
        ...device.ips,
        device.assetNo,
        device.serialNumber,
        device.purpose,
        device.owner,
        device.vendor,
        device.model,
        device.operatingSystem,
        device.hardwareSpec,
        device.warrantyExpireAt,
        rack?.name,
      ].filter(Boolean) as string[]
      const matchedText = fields.find((field) => normalize(field).includes(keyword))

      if (!matchedText) {
        return null
      }

      return {
        device,
        rack,
        room,
        location: [room?.name, rack?.name, `${device.startU}U-${device.endU}U`].filter(Boolean).join(' / '),
        matchedText,
      }
    })
    .filter((result): result is DeviceSearchResult => result !== null)
}
