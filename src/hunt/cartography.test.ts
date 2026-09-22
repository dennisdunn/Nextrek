import { describe, expect, it } from 'vitest'
import {
  createSectors,
  getSectorByName,
  getSectorContaining,
  HUB_RADIUS,
  REGION_NAMES,
  RING_NAMES,
  sectorsInRing,
} from './cartography'

describe('sectorsInRing', () => {
  it('the innermost ring is half the baseline resolution', () => {
    expect(sectorsInRing(0, 6)).toBe(REGION_NAMES.length / 2)
  })

  it('the outer half of the rings is double the baseline resolution', () => {
    // 6 rings: outer half is rings 3, 4, 5
    expect(sectorsInRing(3, 6)).toBe(REGION_NAMES.length * 2)
    expect(sectorsInRing(4, 6)).toBe(REGION_NAMES.length * 2)
    expect(sectorsInRing(5, 6)).toBe(REGION_NAMES.length * 2)
  })

  it('the remaining inner rings stay at baseline resolution', () => {
    expect(sectorsInRing(1, 6)).toBe(REGION_NAMES.length)
    expect(sectorsInRing(2, 6)).toBe(REGION_NAMES.length)
  })

  it('the outer-half boundary moves with the total ring count, so adding rings needs no changes here', () => {
    // 8 rings: outer half is the top 4 (indices 4-7), not the same indices as with 6 rings
    expect(sectorsInRing(2, 8)).toBe(REGION_NAMES.length)
    expect(sectorsInRing(4, 8)).toBe(REGION_NAMES.length * 2)
  })
})

describe('createSectors', () => {
  const sectors = createSectors()
  const totalCount = [0, 1, 2, 3, 4, 5].reduce((sum, ring) => sum + sectorsInRing(ring, 6), 0)

  it('produces sectorsInRing(ring) sectors summed across every ring', () => {
    expect(sectors.length).toBe(totalCount)
  })

  it('innermost sector of the first region starts at the hub, not the pole', () => {
    const s = getSectorByName(sectors, 'Aldebaran I')
    expect(s.arc.inner.r).toBeCloseTo(HUB_RADIUS)
    expect(s.arc.inner.theta).toBeCloseTo(0)
  })

  it('outermost sector of the last region reaches the rim at 2*PI', () => {
    // Ring VI is in the finer (32-way) outer half, so Vega's slice there is split a/b
    const s = getSectorByName(sectors, 'Vega VI-b')
    expect(s.arc.outer.r).toBeCloseTo(RING_NAMES.length + HUB_RADIUS)
    expect(s.arc.outer.theta).toBeCloseTo(2 * Math.PI)
  })

  it('ring boundaries are one unit wide each, offset from the pole by the hub radius', () => {
    for (let ring = 0; ring < RING_NAMES.length; ring++) {
      const s = sectors.find((sector) => sector.ring === ring && sector.region === 0)!
      expect(s.arc.inner.r).toBeCloseTo(HUB_RADIUS + ring)
      expect(s.arc.outer.r).toBeCloseTo(HUB_RADIUS + ring + 1)
    }
  })

  it('Ring I is coarsened to 8 sectors, named after every other baseline region', () => {
    const ringI = sectors.filter((s) => s.ring === 0)
    expect(ringI.length).toBe(8)
    expect(ringI.map((s) => s.name)).toEqual([
      'Aldebaran I',
      'Antares I',
      'Betelgeuse I',
      'Capella I',
      'Pollux I',
      'Regulus I',
      'Sagittarius I',
      'Spica I',
    ])
  })

  it('Ring IV is bisected to 32 sectors, each baseline region split into an a/b pair', () => {
    const ringIV = sectors.filter((s) => s.ring === 3)
    expect(ringIV.length).toBe(32)
    expect(getSectorByName(sectors, 'Aldebaran IV-a').region).toBe(0)
    expect(getSectorByName(sectors, 'Aldebaran IV-b').region).toBe(1)
    expect(getSectorByName(sectors, 'Altair IV-a').region).toBe(2)
  })

  it('Ring II is untouched - plain names at baseline resolution', () => {
    const ringII = sectors.filter((s) => s.ring === 1)
    expect(ringII.length).toBe(REGION_NAMES.length)
    expect(getSectorByName(sectors, 'Aldebaran II').region).toBe(0)
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

  it('the pole itself is inside the hub gap - no sector contains it', () => {
    expect(() => getSectorContaining(sectors, { r: 0, theta: 0 })).toThrow()
    expect(() => getSectorContaining(sectors, { r: HUB_RADIUS - 0.01, theta: 0 })).toThrow()
  })

  it('finds the innermost real sector just past the hub gap', () => {
    expect(getSectorContaining(sectors, { r: HUB_RADIUS + 0.01, theta: 0 }).name).toBe('Aldebaran I')
  })

  it('finds a sector near the outer rim', () => {
    const s = getSectorContaining(sectors, { r: RING_NAMES.length - 0.1, theta: 6.0 })
    expect(s.ring).toBe(RING_NAMES.length - 1)
  })
})
