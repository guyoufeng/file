import { describe, expect, it } from 'vitest'
import { getEndU } from '../../services/rack/uPosition'

describe('u position', () => {
  it('computes endU from startU and heightU', () => {
    expect(getEndU(25, 4)).toBe(28)
  })
})
