import type { Alert } from '../../types/domain'
import { sampleProject } from './data'
import { invokeCommand } from './invoke'

export async function getAlerts(deviceId?: string): Promise<Alert[]> {
  try {
    const alerts = await invokeCommand<Alert[]>('get_alerts', { deviceId })
    if (alerts.length > 0) {
      return alerts
    }
    return deviceId ? sampleProject.alerts.filter((alert) => alert.deviceId === deviceId) : sampleProject.alerts
  } catch {
    return deviceId ? sampleProject.alerts.filter((alert) => alert.deviceId === deviceId) : sampleProject.alerts
  }
}
