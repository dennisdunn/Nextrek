import { describe, expect, it } from 'vitest'
import { contains } from './geometryPolar'

describe('contains', () => {
  const arc = {
    inner: { r: 0, theta: 0 },
    outer: { r: 1, theta: Math.PI },
  }

  it('contains a point inside the arc', () => {
    expect(contains(arc, { r: 0.5, theta: Math.PI / 2 })).toBe(true)
  })

  it('excludes a point outside the arc radius', () => {
    expect(contains(arc, { r: 1.5, theta: Math.PI / 2 })).toBe(false)
  })
})
