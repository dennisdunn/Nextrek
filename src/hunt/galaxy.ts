import type { Edge, NodeId } from '../graph/UndoGraph'
import { UndoGraph } from '../graph/UndoGraph'
import { buildGridEdges } from '../graph/gridTopology'
import { applyAnomalyPlacements, pickAnomalyPlacements, type AnomalyPlacement } from './anomalySeeding'
import { createSectors, REGION_NAMES, RING_NAMES, sectorId, type Sector } from './cartography'
import { buildWarpEdges, type GalaxyEdgeData } from './warpNetwork'

export interface SectorData extends Sector {
  hostile: boolean
  anomaly?: AnomalyPlacement
}

export type Galaxy = UndoGraph<SectorData, GalaxyEdgeData>

const width = REGION_NAMES.length
const height = RING_NAMES.length

/** How far (in impulse hops) a single warp jump can reach. */
export const WARP_RADIUS = 3

/**
 * Impulse space: the region axis (angular) wraps around the galaxy, the
 * ring axis (radial - center to rim) does not. Moore neighborhood - up to
 * 8 adjacent sectors (orthogonal + diagonal) - one hop at a time.
 */
export function normalSpaceEdges() {
  return buildGridEdges({ width, height, wrapX: true, wrapY: false, neighborhood: 'moore' })
}

/**
 * Grid adjacency alone, independent of the graph's current live edge
 * state - what the ship's passive short-range sensors always reach,
 * regardless of whether warp happens to be engaged right now (see
 * sensors.ts's sensedHostiles/sensedAnomalies). Deliberately ignores
 * anomaly mutations too: that's about which lanes are open for travel,
 * not what your sensors can physically see next door.
 */
export function impulseNeighbors(id: NodeId): NodeId[] {
  return normalSpaceEdges()
    .filter((e) => e.from === id)
    .map((e) => e.to)
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

  // edges never actually carry `.data` here (only a pushed warp network
  // does) - the cast just satisfies the graph's edge-data type, which
  // exists for warp's per-edge distance, not for base/anomaly edges.
  return new UndoGraph<SectorData, GalaxyEdgeData>(nodes, edges as unknown as Edge<GalaxyEdgeData>[])
}

/**
 * Engage warp drive: push a shortcut network reaching every sector within
 * WARP_RADIUS impulse-hops of wherever you are, each edge carrying its
 * hop-distance so a jump's energy cost can scale with how far it actually
 * goes (see ship.ts's moveCost). Computed from the graph's current edges,
 * so it must be called while still in impulse space. Undo() to disengage.
 */
export function engageWarp(galaxy: Galaxy): void {
  const allIds = [...galaxy.nodes.keys()]
  galaxy.replaceEdges(buildWarpEdges(galaxy.edges, allIds, WARP_RADIUS))
}

/** Disengage warp drive, falling back to normal space. Returns false if warp was not engaged. */
export function disengageWarp(galaxy: Galaxy): boolean {
  return galaxy.undo()
}
