import { describe, expect, it } from 'vitest'
import { sectorId } from './cartography'
import { createGalaxy, disengageWarp, engageWarp } from './galaxy'

describe('createGalaxy', () => {
  it('seeds all 64 sectors', () => {
    const galaxy = createGalaxy({ rng: () => 0 })
    expect(galaxy.nodes.size).toBe(64)
  })

  it('never seeds a hostile in the home sector', () => {
    const galaxy = createGalaxy({ rng: () => 0, hostileDensity: 1 })
    expect(galaxy.getNode(sectorId(0, 0))?.hostile).toBe(false)
  })

  it('home sector has orthogonal neighbors only in normal space', () => {
    const galaxy = createGalaxy()
    const neighbors = galaxy.neighbors(sectorId(0, 0))
    // wraps around the region axis (15) and steps out one ring (0,1); no diagonal, no inward wrap
    expect(neighbors.sort()).toEqual([sectorId(0, 1), sectorId(1, 0), sectorId(15, 0)].sort())
  })
})

describe('warp drive', () => {
  it('engaging warp reaches far more sectors in one hop', () => {
    const galaxy = createGalaxy()
    const before = galaxy.neighbors(sectorId(0, 0)).length
    engageWarp(galaxy)
    const after = galaxy.neighbors(sectorId(0, 0)).length
    expect(after).toBeGreaterThan(before)
  })

  it('disengaging pops back to normal space connectivity', () => {
    const galaxy = createGalaxy()
    const before = galaxy.neighbors(sectorId(0, 0)).sort()
    engageWarp(galaxy)
    expect(disengageWarp(galaxy)).toBe(true)
    expect(galaxy.neighbors(sectorId(0, 0)).sort()).toEqual(before)
  })

  it('disengaging with no warp engaged is a no-op', () => {
    const galaxy = createGalaxy()
    expect(disengageWarp(galaxy)).toBe(false)
  })
})
