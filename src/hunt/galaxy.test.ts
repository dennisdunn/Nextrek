import { describe, expect, it } from 'vitest'
import { REGION_NAMES, RING_NAMES, sectorId } from './cartography'
import { createGalaxy, disengageWarp, engageWarp, WARP_RADIUS } from './galaxy'

describe('createGalaxy', () => {
  it('seeds every sector in the galaxy', () => {
    const galaxy = createGalaxy({ rng: () => 0 })
    expect(galaxy.nodes.size).toBe(REGION_NAMES.length * RING_NAMES.length)
  })

  it('never seeds a hostile in the home sector', () => {
    const galaxy = createGalaxy({ rng: () => 0, hostileDensity: 1 })
    expect(galaxy.getNode(sectorId(0, 0))?.hostile).toBe(false)
  })

  it('home sector has up to 8 Moore neighbors in impulse space, minus the missing inward ring', () => {
    const galaxy = createGalaxy()
    const neighbors = galaxy.neighbors(sectorId(0, 0))
    // wraps around the region axis (15) and steps out one ring (0,1);
    // diagonals included; no inward wrap since ring -1 doesn't exist
    expect(neighbors.sort()).toEqual(
      [sectorId(1, 0), sectorId(15, 0), sectorId(0, 1), sectorId(1, 1), sectorId(15, 1)].sort(),
    )
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

  it('reaches a sector WARP_RADIUS hops away that impulse cannot reach directly', () => {
    const galaxy = createGalaxy()
    const farTarget = sectorId(WARP_RADIUS, 0)
    expect(galaxy.neighbors(sectorId(0, 0))).not.toContain(farTarget)
    engageWarp(galaxy)
    expect(galaxy.neighbors(sectorId(0, 0))).toContain(farTarget)
  })

  it('every warp edge from a sector carries its impulse-hop distance', () => {
    const galaxy = createGalaxy()
    engageWarp(galaxy)
    for (const edge of galaxy.outgoingEdges(sectorId(0, 0))) {
      expect(edge.data?.distance).toBeGreaterThanOrEqual(1)
      expect(edge.data?.distance).toBeLessThanOrEqual(WARP_RADIUS)
    }
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
