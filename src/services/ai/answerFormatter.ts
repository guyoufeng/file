import type { Alert, Device, Rack, Room } from '../../types/domain'

export interface AnswerSource {
  label: string
  queriedAt: string
}

export function sourceFooter(source: AnswerSource): string {
  return `\n\n数据来源：${source.label}\n查询时间：${source.queriedAt}`
}

export function formatDeviceLocationAnswer(device: Device, rack: Rack | undefined, room: Room | undefined, alerts: Alert[]): string {
  const activeAlerts = alerts.filter((alert) => alert.deviceId === device.id && alert.status !== 'recovered')
  return [
    `设备：${device.computerName || device.name}`,
    `业务IP：${device.businessIp || '-'}`,
    `用途：${device.purpose || '-'}`,
    `责任人：${device.owner || '-'}`,
    `位置：${room?.name || '-'} / ${rack?.name || '-'} / ${device.side === 'front' ? '正面' : '背面'} ${device.startU}U-${device.endU}U`,
    `状态：${device.status}`,
    `活动告警：${activeAlerts.length} 条`,
  ].join('\n')
}
