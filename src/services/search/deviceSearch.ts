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

function collectSearchableText(value: unknown): string[] {
  if (value === null || value === undefined) {
    return []
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return [String(value)]
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectSearchableText)
  }
  if (typeof value === 'object') {
    return Object.values(value).flatMap(collectSearchableText)
  }
  return []
}

export function searchDevices(query: string, devices: Device[], racks: Rack[], rooms: Room[]): DeviceSearchResult[] {
  const keyword = normalize(query)
  if (!keyword) {
    return []
  }
  const keywords = keyword
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)

  return devices
    .map((device) => {
      const rack = racks.find((item) => item.id === device.rackId)
      const room = rooms.find((item) => item.id === rack?.roomId)
      const fields = [
        ...collectSearchableText(device),
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
      const normalizedFields = fields.map(normalize)
      const matchedText = fields.find((field) => normalize(field).includes(keyword))
      const matchedByAllKeywords =
        keywords.length > 1 &&
        keywords.every((item) => normalizedFields.some((field) => field.includes(item)))

      if (!matchedText && !matchedByAllKeywords) {
        return null
      }

      return {
        device,
        rack,
        room,
        location: [room?.name, rack?.name, `${device.startU}U-${device.endU}U`].filter(Boolean).join(' / '),
        matchedText: matchedText ?? keywords.join(' + '),
      }
    })
    .filter((result): result is DeviceSearchResult => result !== null)
}
