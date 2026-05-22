import { describe, expect, it } from 'vitest'
import { searchDevices } from '../../services/search/deviceSearch'
import { sampleProject } from '../../services/backend/data'

describe('device search', () => {
  it('finds a device by business IP', () => {
    const target = sampleProject.devices[10]
    const results = searchDevices(target.businessIp ?? '', sampleProject.devices, sampleProject.racks, sampleProject.rooms)

    expect(results[0]?.device.id).toBe(target.id)
  })

  it('finds a device by serial number', () => {
    const target = sampleProject.devices[42]
    const results = searchDevices(target.serialNumber ?? '', sampleProject.devices, sampleProject.racks, sampleProject.rooms)

    expect(results[0]?.device.id).toBe(target.id)
    expect(results[0]?.location).toContain('529数据中心')
  })
})
