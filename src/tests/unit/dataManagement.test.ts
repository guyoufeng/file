import { describe, expect, it } from 'vitest'
import { sampleProject } from '../../services/backend/data'
import { getProjectSummary, validateProjectJson } from '../../services/backend/data'

describe('system data management', () => {
  it('summarizes exported project data for review before import', () => {
    const summary = getProjectSummary({
      schemaVersion: '0.1.0',
      exportedAt: '2026-05-22T00:00:00.000Z',
      data: sampleProject,
    })

    expect(summary.roomCount).toBe(5)
    expect(summary.rackCount).toBe(52)
    expect(summary.deviceCount).toBe(208)
    expect(summary.alertCount).toBe(12)
  })

  it('validates project json schema and required collections', () => {
    const result = validateProjectJson({
      schemaVersion: '0.1.0',
      exportedAt: '2026-05-22T00:00:00.000Z',
      data: sampleProject,
    })

    expect(result.valid).toBe(true)
    expect(validateProjectJson({ schemaVersion: '0.0.1', data: {} }).valid).toBe(false)
  })
})
