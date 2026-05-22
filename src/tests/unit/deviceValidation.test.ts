import { describe, expect, it } from 'vitest'
import { hasUConflict, validateDeviceForm } from '../../services/assets/deviceValidation'
import { sampleProject } from '../../services/backend/data'

describe('device validation', () => {
  it('requires core device fields', () => {
    const result = validateDeviceForm({
      computerName: '',
      roomId: '',
      rackId: '',
      side: 'front',
      startU: 0,
      heightU: 0,
      categoryId: '',
      subtype: '',
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('计算机名不能为空')
    expect(result.errors).toContain('机柜不能为空')
  })

  it('detects U conflicts on the same rack and side', () => {
    const existing = sampleProject.devices[0]

    expect(
      hasUConflict(
        {
          rackId: existing.rackId,
          side: existing.side,
          startU: existing.startU + 1,
          heightU: 1,
        },
        sampleProject.devices,
      ),
    ).toBe(true)
  })
})
