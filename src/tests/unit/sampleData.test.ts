import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sampleProject } from '../../services/backend/data'

describe('sample project data', () => {
  it('contains the v0.1 target topology scale', () => {
    expect(sampleProject.rooms.length).toBe(5)
    expect(sampleProject.racks.length).toBeGreaterThanOrEqual(50)
    expect(sampleProject.devices.length).toBeGreaterThanOrEqual(200)
    expect(sampleProject.alerts.length).toBeGreaterThanOrEqual(10)
    expect(sampleProject.alerts.length).toBeLessThanOrEqual(20)
  })

  it('models 529 data center as two Huawei modules with A/B/C/D rack rows', () => {
    const rackNames = sampleProject.racks.filter((rack) => rack.roomId === 'room-nj-529').map((rack) => rack.name)
    const rowNames = [...new Set(sampleProject.racks.filter((rack) => rack.roomId === 'room-nj-529').map((rack) => rack.rowName))]

    expect(sampleProject.rooms.find((room) => room.id === 'room-nj-529')?.microModules?.map((module) => module.name)).toEqual([
      '529华为模块1',
      '529华为模块2',
    ])
    expect(rowNames).toEqual(['A排', 'B排', 'C排', 'D排'])
    expect(rackNames).toContain('529-A1')
    expect(rackNames).toContain('529-B10')
    expect(rackNames).toContain('529-C1')
    expect(rackNames).toContain('529-D10')
    expect(rackNames).not.toContain('529-A1-01')
  })

  it('keeps the example project json versioned', () => {
    const examplePath = fileURLToPath(new URL('../../../examples/v0.1-sample-project.json', import.meta.url))
    const example = JSON.parse(readFileSync(examplePath, 'utf-8')) as { schemaVersion?: string }

    expect(example.schemaVersion).toBe('0.1.0')
  })
})
