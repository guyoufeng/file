import type { Alert } from '../../types/domain'
import { sampleProject } from './data'
import { invokeCommand } from './invoke'

export async function getAlerts(deviceId?: string): Promise<Alert[]> {
  try {
    return await invokeCommand<Alert[]>('get_alerts', { deviceId })
  } catch {
    return deviceId ? sampleProject.alerts.filter((alert) => alert.deviceId === deviceId) : sampleProject.alerts
  }
}
