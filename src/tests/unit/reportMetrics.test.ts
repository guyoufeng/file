import { describe, expect, it } from 'vitest'
import { buildReportMetrics } from '../../services/report/reportMetrics'
import { sampleProject } from '../../services/backend/data'

describe('report metrics', () => {
  it('counts sample project inventory and alerts', () => {
    const metrics = buildReportMetrics(
      sampleProject.rooms,
      sampleProject.racks,
      sampleProject.devices,
      sampleProject.alerts,
    )

    expect(metrics.roomCount).toBe(5)
    expect(metrics.rackCount).toBe(52)
    expect(metrics.deviceCount).toBe(208)
    expect(metrics.alertCount).toBe(12)
  })

  it('builds category, status, and capacity summaries', () => {
    const metrics = buildReportMetrics(
      sampleProject.rooms,
      sampleProject.racks,
      sampleProject.devices,
      sampleProject.alerts,
    )

    expect(metrics.categoryCounts.server).toBe(208)
    expect(metrics.statusCounts.normal).toBeGreaterThan(0)
    expect(metrics.rackCapacityRank[0].usedU).toBeGreaterThan(0)
    expect(metrics.rackCapacityRank[0].usageRate).toBeGreaterThan(0)
  })
})
