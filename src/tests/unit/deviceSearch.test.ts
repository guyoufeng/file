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

  it('finds devices by model operating system and hardware spec', () => {
    const target = sampleProject.devices[0]

    expect(searchDevices(target.model ?? '', sampleProject.devices, sampleProject.racks, sampleProject.rooms)[0]?.device.id).toBe(target.id)
    expect(searchDevices(target.operatingSystem ?? '', sampleProject.devices, sampleProject.racks, sampleProject.rooms).length).toBeGreaterThan(0)
    expect(searchDevices('256GB RAM', sampleProject.devices, sampleProject.racks, sampleProject.rooms).length).toBeGreaterThan(0)
  })

  it('searches every imported device string field including metadata', () => {
    const target = {
      ...sampleProject.devices[0],
      computerName: 'cnsmffluxdb1',
      businessIp: '192.168.129.200',
      owner: '张文军',
      metadata: {
        importedRemark: '实际资产表中的特殊备注',
      },
    }

    expect(searchDevices('cnsmffluxdb1', [target], sampleProject.racks, sampleProject.rooms)[0]?.device.id).toBe(target.id)
    expect(searchDevices('张文军', [target], sampleProject.racks, sampleProject.rooms)[0]?.device.id).toBe(target.id)
    expect(searchDevices('特殊备注', [target], sampleProject.racks, sampleProject.rooms)[0]?.device.id).toBe(target.id)
  })
})
