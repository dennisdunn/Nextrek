import { describe, expect, it } from 'vitest'
import { RING_NAMES, sectorId, sectorsInRing } from './cartography'
import {
  applyCombatResult,
  createGalaxy,
  disengageWarp,
  engageWarp,
  MAX_HOSTILES_PER_SECTOR,
  WARP_RADIUS,
  type SectorData,
} from './galaxy'

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

  it('a hostile sector gets at least one hostile', () => {
    const galaxy = createGalaxy({ rng: () => 0, anomalyDensity: 0, hostileDensity: 1 })
    for (const [id, sector] of galaxy.nodes) {
      if (id === sectorId(0, 0)) continue
      expect(sector.hostileCount).toBe(1)
    }
  })

  it('a hostile sector can get up to MAX_HOSTILES_PER_SECTOR hostiles', () => {
    const galaxy = createGalaxy({ rng: () => 0.99, hostileDensity: 1 })
    for (const [id, sector] of galaxy.nodes) {
      if (id === sectorId(0, 0)) continue
      expect(sector.hostileCount).toBe(MAX_HOSTILES_PER_SECTOR)
    }
  })

  it('a non-hostile sector has no hostiles', () => {
    const galaxy = createGalaxy({ rng: () => 0, hostileDensity: 0 })
    for (const [, sector] of galaxy.nodes) {
      expect(sector.hostileCount).toBe(0)
    }
  })

  it('never seeds a star hazard without a hostile there to fight - it would be inert', () => {
    const galaxy = createGalaxy({ rng: () => 0, anomalyDensity: 0, hostileDensity: 0, starHazardDensity: 1 })
    for (const [, sector] of galaxy.nodes) {
      expect(sector.hasStarHazard).toBe(false)
    }
  })

  it('never seeds a star hazard in the home sector, even at density 1', () => {
    const galaxy = createGalaxy({ rng: () => 0, starHazardDensity: 1 })
    expect(galaxy.getNode(sectorId(0, 0))?.hasStarHazard).toBe(false)
  })

  it('never seeds a star hazard in an anomaly sector, even at density 1', () => {
    let i = 0
    const rng = () => [0, 0.1][i++ % 2]
    const galaxy = createGalaxy({ rng, anomalyDensity: 1, hostileDensity: 0, starbaseDensity: 0, starHazardDensity: 1 })
    for (const [id, sector] of galaxy.nodes) {
      if (id === sectorId(0, 0)) continue
      expect(sector.anomaly).toBeDefined()
      expect(sector.hasStarHazard).toBe(false)
    }
  })

  it('never seeds a star hazard in a starbase sector, even at density 1', () => {
    const galaxy = createGalaxy({
      rng: () => 0,
      anomalyDensity: 0,
      hostileDensity: 0,
      starbaseDensity: 1,
      starHazardDensity: 1,
    })
    for (const [id, sector] of galaxy.nodes) {
      if (id === sectorId(0, 0)) continue
      expect(sector.starbase).toBe(true)
      expect(sector.hasStarHazard).toBe(false)
    }
  })

  it('a star hazard can share a sector with a hostile', () => {
    const galaxy = createGalaxy({
      rng: () => 0,
      anomalyDensity: 0,
      hostileDensity: 1,
      starbaseDensity: 0,
      starHazardDensity: 1,
    })
    for (const [id, sector] of galaxy.nodes) {
      if (id === sectorId(0, 0)) continue
      expect(sector.hostile).toBe(true)
      expect(sector.hasStarHazard).toBe(true)
    }
  })

  it('home sector has 6 Moore neighbors: 2 same-ring (Ring I is only 8-wide) plus 4 fanning out into the 16-wide Ring II', () => {
    const galaxy = createGalaxy()
    const neighbors = galaxy.neighbors(sectorId(0, 0))
    // Ring I is coarsened to 8 sectors, so home's same-ring neighbors wrap
    // mod 8; Ring II is still baseline (16, k=2), so home's sector fans out
    // to the 2 sectors directly under it plus one across each of its two edges.
    expect(neighbors.sort()).toEqual(
      [sectorId(1, 0), sectorId(7, 0), sectorId(15, 1), sectorId(0, 1), sectorId(1, 1), sectorId(2, 1)].sort(),
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

describe('applyCombatResult', () => {
  const woundedPack: SectorData = {
    name: 'Test I',
    region: 0,
    ring: 0,
    arc: { inner: { r: 0, theta: 0 }, outer: { r: 1, theta: 1 } },
    hostile: true,
    hostileCount: 2,
    starbase: false,
    hasStarHazard: false,
  }

  it('clears the hostile once every one of them is out of health', () => {
    const next = applyCombatResult(woundedPack, [0, 0])
    expect(next.hostile).toBe(false)
    expect(next.hostileCount).toBe(0)
    expect(next.hostileHealths).toBeUndefined()
  })

  it('clears the hostile if health somehow drops below zero across the board', () => {
    const next = applyCombatResult(woundedPack, [-5, 0])
    expect(next.hostile).toBe(false)
  })

  it('persists remaining health per hostile while at least one survives', () => {
    const next = applyCombatResult(woundedPack, [12, 0])
    expect(next.hostile).toBe(true)
    expect(next.hostileHealths).toEqual([12, 0])
    // the pack's original size is untouched - a dead one still "was here"
    expect(next.hostileCount).toBe(2)
  })

  it('does not mutate the sector passed in', () => {
    applyCombatResult(woundedPack, [12, 0])
    expect(woundedPack.hostileHealths).toBeUndefined()
  })
})
