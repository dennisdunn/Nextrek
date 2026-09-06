import { describe, expect, it } from 'vitest'
import { createSectors, getSectorByName, getSectorContaining, REGION_NAMES, RING_NAMES } from './cartography'

describe('createSectors', () => {
  const sectors = createSectors()

  it('produces 16 regions x 4 rings = 64 sectors', () => {
    expect(sectors.length).toBe(REGION_NAMES.length * RING_NAMES.length)
  })

  it('innermost sector of the first region starts at the pole', () => {
    const s = getSectorByName(sectors, 'Aldebaran I')
    expect(s.arc.inner.r).toBeCloseTo(0)
    expect(s.arc.inner.theta).toBeCloseTo(0)
  })

  it('outermost sector of the last region reaches the rim at 2*PI', () => {
    const s = getSectorByName(sectors, 'Vega IV')
    expect(s.arc.outer.r).toBeCloseTo(1)
    expect(s.arc.outer.theta).toBeCloseTo(2 * Math.PI)
  })
})

describe('getSectorByName', () => {
  const sectors = createSectors()

  it('finds a sector by name', () => {
    expect(getSectorByName(sectors, 'Aldebaran I').name).toBe('Aldebaran I')
  })

  it('throws for an unknown name', () => {
    expect(() => getSectorByName(sectors, 'Aldebaran LX')).toThrow()
  })
})

describe('getSectorContaining', () => {
  const sectors = createSectors()

  it('finds the sector containing the pole', () => {
    expect(getSectorContaining(sectors, { r: 0, theta: 0 }).name).toBe('Aldebaran I')
  })

  it('finds a sector near the outer rim', () => {
    const s = getSectorContaining(sectors, { r: 0.9, theta: 6.0 })
    expect(s.ring).toBe(RING_NAMES.length - 1)
  })
})
