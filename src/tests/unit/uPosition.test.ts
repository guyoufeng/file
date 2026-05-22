import { describe, expect, it } from 'vitest'
import { getDeviceBlockHeight, getDeviceBlockY, getEndU, validateUPosition } from '../../services/rack/uPosition'

describe('u position helpers', () => {
  it('computes endU from startU and heightU', () => {
    expect(getEndU(25, 4)).toBe(28)
  })

  it('validates U position inside a 48U rack', () => {
    expect(validateUPosition(1, 1)).toBe(true)
    expect(validateUPosition(45, 4)).toBe(true)
    expect(validateUPosition(46, 4)).toBe(false)
    expect(validateUPosition(0, 1)).toBe(false)
  })

  it('maps higher U positions closer to the top of the canvas', () => {
    expect(getDeviceBlockY(45, 4, 48, 10)).toBe(0)
    expect(getDeviceBlockY(1, 1, 48, 10)).toBe(470)
    expect(getDeviceBlockHeight(4, 10)).toBe(40)
  })
})
