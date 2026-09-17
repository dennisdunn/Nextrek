import { describe, expect, it } from 'vitest'
import { sectorId } from './cartography'
import { createGalaxy } from './galaxy'
import { knownSectors, sensedAnomalies, sensedHostiles } from './sensors'

describe('knownSectors', () => {
  it('unions visited and scanned sectors', () => {
    const visited = new Set([sectorId(0, 0), sectorId(1, 0)])
    const scanned = new Set([sectorId(5, 3)])
    const known = knownSectors(visited, scanned)

    expect(known.has(sectorId(0, 0))).toBe(true)
    expect(known.has(sectorId(1, 0))).toBe(true)
    expect(known.has(sectorId(5, 3))).toBe(true)
    expect(known.size).toBe(3)
  })

  it('does not reveal a sector that is neither visited nor scanned', () => {
    const known = knownSectors(new Set([sectorId(0, 0)]), new Set())
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

describe('sensedAnomalies', () => {
  it('reports only neighboring sectors with an anomaly, never the whole galaxy', () => {
    const galaxy = createGalaxy({ anomalyDensity: 0 })
    const home = sectorId(0, 0)
    const neighbor = galaxy.neighbors(home)[0]
    const nonNeighbor = sectorId(8, 3)
    galaxy.setNode(neighbor, { ...galaxy.getNode(neighbor)!, anomaly: { kind: 'barrier' } })
    galaxy.setNode(nonNeighbor, { ...galaxy.getNode(nonNeighbor)!, anomaly: { kind: 'barrier' } })

    const sensed = sensedAnomalies(galaxy, home)
    expect(sensed).toContain(neighbor)
    expect(sensed).not.toContain(nonNeighbor)
  })

  it('is empty when no neighbor has an anomaly', () => {
    const galaxy = createGalaxy({ anomalyDensity: 0 })
    expect(sensedAnomalies(galaxy, sectorId(0, 0))).toEqual([])
  })
})
