import { describe, expect, it } from 'vitest'
import { RING_NAMES, sectorId, sectorsInRing } from './cartography'
import { createGalaxy, disengageWarp, engageWarp, WARP_RADIUS } from './galaxy'

const TOTAL_SECTORS = Array.from({ length: RING_NAMES.length }, (_, ring) => sectorsInRing(ring, RING_NAMES.length)).reduce(
  (a, b) => a + b,
  0,
)

describe('createGalaxy', () => {
  it('seeds every sector in the galaxy', () => {
    const galaxy = createGalaxy({ rng: () => 0 })
    expect(galaxy.nodes.size).toBe(TOTAL_SECTORS)
  })

  it('never seeds a hostile in the home sector', () => {
    const galaxy = createGalaxy({ rng: () => 0, hostileDensity: 1 })
    expect(galaxy.getNode(sectorId(0, 0))?.hostile).toBe(false)
  })

  it('never seeds a hostile in a barrier sector, even at density 1', () => {
    // cyclic [density-check, kind-pick]: 0 always passes the density roll,
    // 0.1 * 3 = 0.3 -> KINDS[0] = 'barrier' - every non-home sector becomes one
    let i = 0
    const rng = () => [0, 0.1][i++ % 2]
    const galaxy = createGalaxy({ rng, anomalyDensity: 1, hostileDensity: 1 })
    for (const [id, sector] of galaxy.nodes) {
      if (id === sectorId(0, 0)) continue
      expect(sector.anomaly?.kind).toBe('barrier')
      expect(sector.hostile).toBe(false)
    }
  })

  it('never seeds a hostile in a gate sector, even at density 1', () => {
    // 0.4 * 3 = 1.2 -> KINDS[1] = 'gate'
    let i = 0
    const rng = () => [0, 0.4][i++ % 2]
    const galaxy = createGalaxy({ rng, anomalyDensity: 1, hostileDensity: 1 })
    for (const [id, sector] of galaxy.nodes) {
      if (id === sectorId(0, 0)) continue
      expect(sector.anomaly?.kind).toBe('gate')
      expect(sector.hostile).toBe(false)
    }
  })

  it('never seeds a starbase in the home sector, even at density 1', () => {
    const galaxy = createGalaxy({ rng: () => 0, anomalyDensity: 0, hostileDensity: 0, starbaseDensity: 1 })
    expect(galaxy.getNode(sectorId(0, 0))?.starbase).toBe(false)
  })

  it('never seeds a starbase in an anomaly sector, even at density 1', () => {
    // cyclic [density-check, kind-pick]: 0.1 * 3 = 0.3 -> KINDS[0] = 'barrier'
    let i = 0
    const rng = () => [0, 0.1][i++ % 2]
    const galaxy = createGalaxy({ rng, anomalyDensity: 1, hostileDensity: 0, starbaseDensity: 1 })
    for (const [id, sector] of galaxy.nodes) {
      if (id === sectorId(0, 0)) continue
      expect(sector.anomaly?.kind).toBe('barrier')
      expect(sector.starbase).toBe(false)
    }
  })

  it('never seeds a starbase in a hostile sector, even at density 1', () => {
    const galaxy = createGalaxy({ rng: () => 0, anomalyDensity: 0, hostileDensity: 1, starbaseDensity: 1 })
    for (const [id, sector] of galaxy.nodes) {
      if (id === sectorId(0, 0)) continue
      expect(sector.hostile).toBe(true)
      expect(sector.starbase).toBe(false)
    }
  })

  it('seeds a starbase on every eligible sector at density 1', () => {
    const galaxy = createGalaxy({ rng: () => 0, anomalyDensity: 0, hostileDensity: 0, starbaseDensity: 1 })
    for (const [id, sector] of galaxy.nodes) {
      if (id === sectorId(0, 0)) continue
      expect(sector.starbase).toBe(true)
    }
  })

  it('home sector has 8 Moore neighbors: 2 same-ring (Ring I is only 4-wide) plus 6 fanning out into the 16-wide Ring II', () => {
    const galaxy = createGalaxy()
    const neighbors = galaxy.neighbors(sectorId(0, 0))
    // Ring I is coarsened to 4 sectors, so home's same-ring neighbors wrap
    // mod 4; Ring II is still baseline (16), so home's quadrant fans out to
    // the 4 sectors directly under it plus one across each of its two edges.
    expect(neighbors.sort()).toEqual(
      [
        sectorId(1, 0),
        sectorId(3, 0),
        sectorId(15, 1),
        sectorId(0, 1),
        sectorId(1, 1),
        sectorId(2, 1),
        sectorId(3, 1),
        sectorId(4, 1),
      ].sort(),
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
    // WARP_RADIUS rings straight out - reachable in exactly that many
    // impulse hops (one ring per hop), never in one.
    const farTarget = sectorId(0, WARP_RADIUS)
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
