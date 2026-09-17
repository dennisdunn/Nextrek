import type { NodeId } from '../graph/UndoGraph'
import { UndoGraph } from '../graph/UndoGraph'
import { buildGridEdges } from '../graph/gridTopology'
import { applyAnomalyPlacements, pickAnomalyPlacements, type AnomalyPlacement } from './anomalySeeding'
import { createSectors, REGION_NAMES, RING_NAMES, sectorId, type Sector } from './cartography'

export interface SectorData extends Sector {
  hostile: boolean
  anomaly?: AnomalyPlacement
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
  /** Fraction of non-home sectors seeded with a subspace anomaly, in [0, 1]. */
  anomalyDensity?: number
  rng?: () => number
  homeSector?: { region: number; ring: number }
}

export function createGalaxy(options: CreateGalaxyOptions = {}): Galaxy {
  const {
    hostileDensity = 0.12,
    anomalyDensity = 0.08,
    rng = Math.random,
    homeSector = { region: 0, ring: 0 },
  } = options
  const sectors = createSectors()
  const homeId = sectorId(homeSector.region, homeSector.ring)
  const allIds = sectors.map((s) => sectorId(s.region, s.ring))
  const baseEdges = normalSpaceEdges()
  const neighborsOf = (id: NodeId) => baseEdges.filter((e) => e.from === id).map((e) => e.to)

  const anomalyPlacements = pickAnomalyPlacements(allIds, homeId, anomalyDensity, rng, neighborsOf)
  const edges = applyAnomalyPlacements(baseEdges, anomalyPlacements)

  const nodes: [string, SectorData][] = sectors.map((s) => {
    const id = sectorId(s.region, s.ring)
    const isHome = id === homeId
    return [
      id,
      { ...s, hostile: !isHome && rng() < hostileDensity, anomaly: anomalyPlacements.get(id) },
    ]
  })

  return new UndoGraph<SectorData, undefined>(nodes, edges)
}

/** Engage warp drive: push the fast toroidal/Moore edge-set. Undo() to disengage. */
export function engageWarp(galaxy: Galaxy): void {
  galaxy.replaceEdges(warpSpaceEdges())
}

/** Disengage warp drive, falling back to normal space. Returns false if warp was not engaged. */
export function disengageWarp(galaxy: Galaxy): boolean {
  return galaxy.undo()
}
