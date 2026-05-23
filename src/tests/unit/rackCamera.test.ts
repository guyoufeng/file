import { describe, expect, it } from 'vitest'
import { getDefaultRackCameraPose } from '../../services/three/rackCamera'

describe('rack camera pose', () => {
  it('uses a closer left-front display angle for the 3d overview', () => {
    const pose = getDefaultRackCameraPose(13.8, 12.4, false)

    expect(pose.position.x).toBeCloseTo(16.688, 3)
    expect(pose.position.y).toBe(5.8)
    expect(pose.position.z).toBeCloseTo(14.276, 3)
    expect(pose.target.y).toBe(1.45)
  })
})
