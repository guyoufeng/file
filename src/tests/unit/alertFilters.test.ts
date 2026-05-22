import { describe, expect, it } from 'vitest'
import { filterAlerts, getAlertDeviceContext } from '../../services/alerts/alertFilters'
import { sampleProject } from '../../services/backend/data'

describe('alert filters', () => {
  it('filters alerts by level and status', () => {
    const alerts = filterAlerts(sampleProject.alerts, sampleProject.devices, {
      level: 'critical',
      status: 'acknowledged',
    })

    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts.every((alert) => alert.level === 'critical' && alert.status === 'acknowledged')).toBe(true)
  })

  it('filters alerts by rack id through related devices', () => {
    const device = sampleProject.devices[0]
    const alerts = filterAlerts(sampleProject.alerts, sampleProject.devices, { rackId: device.rackId })

    expect(alerts.every((alert) => sampleProject.devices.find((item) => item.id === alert.deviceId)?.rackId === device.rackId)).toBe(true)
  })

  it('resolves alert device context', () => {
    const alert = sampleProject.alerts[0]
    const context = getAlertDeviceContext(alert, sampleProject.devices, sampleProject.racks, sampleProject.rooms)

    expect(context.device?.id).toBe(alert.deviceId)
    expect(context.location).toContain('529数据中心')
  })
})
