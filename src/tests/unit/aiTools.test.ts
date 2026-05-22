import { describe, expect, it } from 'vitest'
import { runDeterministicAiQuery } from '../../services/ai/aiTools'
import { sampleProject } from '../../services/backend/data'

describe('ai tools', () => {
  it('locates a device by business IP', () => {
    const device = sampleProject.devices[10]
    const result = runDeterministicAiQuery(
      `IP 为 ${device.businessIp} 的服务器在哪里？`,
      sampleProject.rooms,
      sampleProject.racks,
      sampleProject.devices,
      sampleProject.alerts,
    )

    expect(result.toolName).toBe('locate_device')
    expect(result.answer).toContain(device.businessIp!)
    expect(result.answer).toContain(device.computerName!)
    expect(result.answer).toContain('数据来源')
  })

  it('lists devices by rack name', () => {
    const rack = sampleProject.racks[0]
    const result = runDeterministicAiQuery(
      `${rack.name} 里面有哪些服务器？`,
      sampleProject.rooms,
      sampleProject.racks,
      sampleProject.devices,
      sampleProject.alerts,
    )

    expect(result.toolName).toBe('list_rack_devices')
    expect(result.answer).toContain(rack.name)
    expect(result.relatedRackId).toBe(rack.id)
  })
})
