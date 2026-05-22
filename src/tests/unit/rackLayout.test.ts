import { describe, expect, it } from 'vitest'
import { sampleProject } from '../../services/backend/data'
import { getRackTileStats, getRoomOptions } from '../../features/rack-overview/layout'

describe('rack layout helpers', () => {
  it('returns the expected room selector options', () => {
    expect(getRoomOptions(sampleProject.rooms).map((room) => room.name)).toEqual([
      '529数据中心',
      '99数据中心',
      '308数据中心',
      '杭州数据中心',
      '越南C7数据中心',
    ])
  })

  it('counts devices, alerts, and capacity for a rack tile', () => {
    const rack = sampleProject.racks[0]
    const stats = getRackTileStats(rack, sampleProject.devices, sampleProject.alerts)

    expect(stats.deviceCount).toBe(4)
    expect(stats.capacityText).toBe('16U / 48U')
    expect(stats.alertCount).toBeGreaterThanOrEqual(0)
  })
})
