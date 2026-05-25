import type { Alert } from '../../types/domain'
import { sampleProject } from './data'
import { invokeCommand } from './invoke'

function readLocalAlerts(): Alert[] | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem('qf-ai-dcim.alerts')
  if (!raw) return null

  try {
    return JSON.parse(raw) as Alert[]
  } catch {
    return null
  }
}

export async function getAlerts(deviceId?: string): Promise<Alert[]> {
  try {
    const alerts = await invokeCommand<Alert[]>('get_alerts', { deviceId })
    if (alerts.length > 0) {
      return alerts
    }
    return deviceId ? sampleProject.alerts.filter((alert) => alert.deviceId === deviceId) : sampleProject.alerts
  } catch {
    const localAlerts = readLocalAlerts()
    if (localAlerts) {
      return deviceId ? localAlerts.filter((alert) => alert.deviceId === deviceId) : localAlerts
    }
    return deviceId ? sampleProject.alerts.filter((alert) => alert.deviceId === deviceId) : sampleProject.alerts
  }
}
