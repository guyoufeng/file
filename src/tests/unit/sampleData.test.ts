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

  it('keeps the example project json versioned', () => {
    const examplePath = fileURLToPath(new URL('../../../examples/v0.1-sample-project.json', import.meta.url))
    const example = JSON.parse(readFileSync(examplePath, 'utf-8')) as { schemaVersion?: string }

    expect(example.schemaVersion).toBe('0.1.0')
  })
})
