import { describe, expect, it } from 'vitest'
import Geometry from './geometry'

describe('Geometry.Rect', () => {
  const bounds = { lowerLeft: { x: 0, y: 0 }, upperRight: { x: 10, y: 10 } }

  it('contains a point inside the box', () => {
    expect(Geometry.Rect.contains(bounds, { x: 5, y: 5 })).toBe(true)
  })

  it('excludes a point outside the box', () => {
    expect(Geometry.Rect.contains(bounds, { x: 15, y: 5 })).toBe(false)
  })

  it('measures distance between two points', () => {
    expect(Geometry.Rect.distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5)
  })
})

describe('Geometry.Polar', () => {
  const arc = {
    inner: { r: 0, theta: 0 },
    outer: { r: 1, theta: Math.PI },
  }

  it('contains a point inside the arc', () => {
    expect(Geometry.Polar.contains(arc, { r: 0.5, theta: Math.PI / 2 })).toBe(true)
  })

  it('excludes a point outside the arc radius', () => {
    expect(Geometry.Polar.contains(arc, { r: 1.5, theta: Math.PI / 2 })).toBe(false)
  })

  it('within a bounding circle', () => {
    const circle = { center: { r: 0, theta: 0 }, radius: 2 }
    expect(Geometry.Polar.within(circle, { r: 1, theta: 0 })).toBe(true)
    expect(Geometry.Polar.within(circle, { r: 3, theta: 0 })).toBe(false)
  })
})
