import { UndoGraph } from '../graph/UndoGraph'
import { buildGridEdges } from '../graph/gridTopology'
import { createSectors, REGION_NAMES, RING_NAMES, sectorId, type Sector } from './cartography'

export interface SectorData extends Sector {
  hostile: boolean
}

export type Galaxy = UndoGraph<SectorData, undefined>

const width = REGION_NAMES.length
const height = RING_NAMES.length

/**
 * Normal space: the region axis (angular) wraps around the galaxy, the
 * ring axis (radial - center to rim) does not. Orthogonal moves only:
 * slow, deliberate travel.
 */
export function normalSpaceEdges() {
  return buildGridEdges({ width, height, wrapX: true, wrapY: false, neighborhood: 'vonNeumann' })
}

/**
 * Warp space: both axes wrap and diagonal jumps are allowed, so any
 * sector is reachable from any other in one or two hops - fast travel.
 */
export function warpSpaceEdges() {
  return buildGridEdges({ width, height, wrapX: true, wrapY: true, neighborhood: 'moore' })
}

export interface CreateGalaxyOptions {
  /** Fraction of non-home sectors seeded with a hostile, in [0, 1]. */
  hostileDensity?: number
  rng?: () => number
  homeSector?: { region: number; ring: number }
}

export function createGalaxy(options: CreateGalaxyOptions = {}): Galaxy {
  const { hostileDensity = 0.12, rng = Math.random, homeSector = { region: 0, ring: 0 } } = options
  const sectors = createSectors()
  const nodes: [string, SectorData][] = sectors.map((s) => {
    const isHome = s.region === homeSector.region && s.ring === homeSector.ring
    return [sectorId(s.region, s.ring), { ...s, hostile: !isHome && rng() < hostileDensity }]
  })
  return new UndoGraph<SectorData, undefined>(nodes, normalSpaceEdges())
}

/** Engage warp drive: push the fast toroidal/Moore edge-set. Undo() to disengage. */
export function engageWarp(galaxy: Galaxy): void {
  galaxy.replaceEdges(warpSpaceEdges())
}

/** Disengage warp drive, falling back to normal space. Returns false if warp was not engaged. */
export function disengageWarp(galaxy: Galaxy): boolean {
  return galaxy.undo()
}
