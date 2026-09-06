import { describe, expect, it } from 'vitest'
import { sectorId } from './cartography'
import { createGalaxy } from './galaxy'
import { knownSectors, sensedHostiles } from './sensors'

describe('knownSectors', () => {
  it('includes the current position, its neighbors, and prior visits', () => {
    const galaxy = createGalaxy()
    const home = sectorId(0, 0)
    const known = knownSectors(galaxy, home, new Set([sectorId(5, 3)]))

    expect(known.has(home)).toBe(true)
    expect(known.has(sectorId(5, 3))).toBe(true)
    for (const n of galaxy.neighbors(home)) {
      expect(known.has(n)).toBe(true)
    }
  })

  it('excludes sectors that are neither visited nor adjacent', () => {
    const galaxy = createGalaxy()
    const home = sectorId(0, 0)
    const known = knownSectors(galaxy, home, new Set())
    // far side of the galaxy, not a neighbor of home in normal space
    expect(known.has(sectorId(8, 3))).toBe(false)
  })
})

describe('sensedHostiles', () => {
  it('reports only neighboring hostiles, never the whole galaxy', () => {
    const galaxy = createGalaxy({ hostileDensity: 1, rng: () => 0.99 })
    // force one specific neighbor hostile, one non-neighbor hostile
    const home = sectorId(0, 0)
    const neighbor = galaxy.neighbors(home)[0]
    const nonNeighbor = sectorId(8, 3)
    galaxy.setNode(neighbor, { ...galaxy.getNode(neighbor)!, hostile: true })
    galaxy.setNode(nonNeighbor, { ...galaxy.getNode(nonNeighbor)!, hostile: true })

    const sensed = sensedHostiles(galaxy, home)
    expect(sensed).toContain(neighbor)
    expect(sensed).not.toContain(nonNeighbor)
  })
})
