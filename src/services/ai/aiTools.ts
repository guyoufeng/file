import type { Alert, Device, Rack, Room } from '../../types/domain'
import { formatDeviceLocationAnswer, sourceFooter } from './answerFormatter'

export type AiToolName =
  | 'search_devices'
  | 'get_device_detail'
  | 'locate_device'
  | 'list_rack_devices'
  | 'list_room_devices'
  | 'list_alert_devices'
  | 'summarize_room_status'

export interface AiToolResult {
  toolName: AiToolName
  answer: string
  relatedDeviceId?: string
  relatedRoomId?: string
  relatedRackId?: string
}

export function runDeterministicAiQuery(
  question: string,
  rooms: Room[],
  racks: Rack[],
  devices: Device[],
  alerts: Alert[],
): AiToolResult {
  const queriedAt = new Date().toLocaleString('zh-CN', { hour12: false })
  const normalized = question.toLowerCase()
  const ip = question.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/)?.[0]

  if (ip) {
    const device = devices.find((item) => item.businessIp === ip || item.managementIp === ip || item.ips.includes(ip))
    if (device) {
      const rack = racks.find((item) => item.id === device.rackId)
      const room = rooms.find((item) => item.id === rack?.roomId)
      return {
        toolName: 'locate_device',
        relatedDeviceId: device.id,
        relatedRackId: rack?.id,
        relatedRoomId: room?.id,
        answer:
          formatDeviceLocationAnswer(device, rack, room, alerts) +
          sourceFooter({ label: '本地资产库、机柜库、告警库', queriedAt }),
      }
    }
  }

  const rack = racks.find((item) => normalized.includes(item.name.toLowerCase()))
  if (rack) {
    const room = rooms.find((item) => item.id === rack.roomId)
    const rackDevices = devices.filter((device) => device.rackId === rack.id)
    const lines = rackDevices
      .slice(0, 12)
      .map((device) => `- ${device.computerName || device.name} / ${device.businessIp || '-'} / ${device.purpose || '-'}`)
    return {
      toolName: 'list_rack_devices',
      relatedRackId: rack.id,
      relatedRoomId: room?.id,
      answer:
        `机柜：${room?.name || '-'} / ${rack.name}\n设备数量：${rackDevices.length} 台\n${lines.join('\n')}` +
        sourceFooter({ label: '本地资产库、机柜库', queriedAt }),
    }
  }

  const room = rooms.find((item) => normalized.includes(item.name.toLowerCase()))
  if (room) {
    const roomRackIds = new Set(racks.filter((rack) => rack.roomId === room.id).map((rack) => rack.id))
    const roomDevices = devices.filter((device) => roomRackIds.has(device.rackId))
    return {
      toolName: 'list_room_devices',
      relatedRoomId: room.id,
      answer:
        `机房：${room.name}\n机柜数量：${roomRackIds.size} 个\n设备数量：${roomDevices.length} 台` +
        sourceFooter({ label: '本地资产库、机房库', queriedAt }),
    }
  }

  const activeAlerts = alerts.filter((alert) => alert.status !== 'recovered')
  return {
    toolName: 'summarize_room_status',
    answer:
      `当前平台已纳管 ${rooms.length} 个机房、${racks.length} 个机柜、${devices.length} 台设备，活动告警 ${activeAlerts.length} 条。` +
      sourceFooter({ label: '本地资产库、告警库', queriedAt }),
  }
}
