import type { Edge, NodeId } from '../graph/UndoGraph'
import { UndoGraph } from '../graph/UndoGraph'
import { buildPolarGridEdges } from '../graph/polarTopology'
import { applyAnomalyPlacements, pickAnomalyPlacements, type AnomalyPlacement } from './anomalySeeding'
import { createSectors, RING_NAMES, sectorId, sectorsInRing, type Sector } from './cartography'
import { buildWarpEdges, type GalaxyEdgeData } from './warpNetwork'

/** A sector can hold a small pack of hostiles, not just a lone one - up to this many, fixed at seeding. */
export const MAX_HOSTILES_PER_SECTOR = 3

export interface SectorData extends Sector {
  hostile: boolean
  /** How many hostiles are (or were) here - fixed at seeding, independent of how many have since died. 0 when !hostile. */
  hostileCount: number
  /**
   * Remaining health per hostile, index-aligned - undefined means "never
   * engaged," so the kill phase spawns hostileCount of them at its own
   * default health instead of resetting a wounded pack back to full.
   */
  hostileHealths?: number[]
  anomaly?: AnomalyPlacement
  starbase: boolean
  /** A star to avoid during any encounter here - heavy, continuous damage to anything (or anyone's shot) that touches it. */
  hasStarHazard: boolean
}

/**
 * Fold a kill-phase encounter's outcome back into the sector it happened
 * in. A pack with every hostile out of health is gone for good; otherwise
 * their remaining health carries over, so leaving a fight unfinished (by
 * fleeing or losing) doesn't quietly reset it back to full.
 */
export function applyCombatResult(sector: SectorData, hostileHealthsRemaining: number[]): SectorData {
  if (hostileHealthsRemaining.every((health) => health <= 0)) {
    return { ...sector, hostile: false, hostileCount: 0, hostileHealths: undefined }
  }
  return { ...sector, hostileHealths: hostileHealthsRemaining }
}

export type Galaxy = UndoGraph<SectorData, GalaxyEdgeData>

/** How far (in impulse hops) a single warp jump can reach. */
export const WARP_RADIUS = 3

/**
 * Impulse space: angularly wraps around the galaxy (it's a full circle),
 * never radially (there's no ring before the innermost or after the
 * outermost). Moore neighborhood - up to 8 adjacent sectors - one hop at a
 * time, generalized in polarTopology.ts to handle rings whose angular
 * resolution differs from their neighbors (see cartography.ts's
 * sectorsInRing).
 */
export function normalSpaceEdges() {
  const totalRings = RING_NAMES.length
  const sectorsPerRing = Array.from({ length: totalRings }, (_, ring) => sectorsInRing(ring, totalRings))
  return buildPolarGridEdges(sectorsPerRing)
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

/**
 * A uniformly random valid sector - region picked within whatever angular
 * resolution its ring actually has (see cartography.ts's sectorsInRing),
 * not the baseline count. Used to place the player somewhere new each
 * mission rather than always the same fixed sector; createGalaxy's own
 * home-exclusion logic (see the `isHome` checks below) takes care of
 * keeping whichever sector this picks free of hostiles/anomalies/starbases.
 */
export function randomHomeSector(rng: () => number = Math.random): { region: number; ring: number } {
  const totalRings = RING_NAMES.length
  const ring = Math.floor(rng() * totalRings)
  const region = Math.floor(rng() * sectorsInRing(ring, totalRings))
  return { region, ring }
}

export interface CreateGalaxyOptions {
  /** Fraction of non-home sectors seeded with a hostile, in [0, 1]. */
  hostileDensity?: number
  /** Fraction of non-home sectors seeded with a subspace anomaly, in [0, 1]. */
  anomalyDensity?: number
  /** Fraction of eligible (non-home, non-hostile, non-anomaly) sectors seeded with a starbase, in [0, 1]. */
  starbaseDensity?: number
  /** Fraction of hostile sectors (not otherwise complicated by an anomaly) that also get a star hazard, in [0, 1]. */
  starHazardDensity?: number
  rng?: () => number
  homeSector?: { region: number; ring: number }
}

export function createGalaxy(options: CreateGalaxyOptions = {}): Galaxy {
  const {
    hostileDensity = 0.12,
    anomalyDensity = 0.08,
    starbaseDensity = 0.05,
    starHazardDensity = 0.1,
    rng = Math.random,
    homeSector = { region: 0, ring: 0 },
  } = options
  const sectors = createSectors()
  const homeId = sectorId(homeSector.region, homeSector.ring)
  const allIds = sectors.map((s) => sectorId(s.region, s.ring))
  const baseEdges = normalSpaceEdges()
  const neighborsOf = (id: NodeId) => baseEdges.filter((e) => e.from === id).map((e) => e.to)

  const anomalyPlacements = pickAnomalyPlacements(allIds, homeId, anomalyDensity, rng, neighborsOf)
  // Base grid edges never actually carry `.data` - the cast just satisfies
  // applyAnomalyPlacements' edge-data type, which exists for a conduit's
  // viaConduit tag and a warp edge's distance, neither of which apply here.
  const edges = applyAnomalyPlacements(baseEdges as unknown as Edge<GalaxyEdgeData>[], anomalyPlacements)

  const nodes: [string, SectorData][] = sectors.map((s) => {
    const id = sectorId(s.region, s.ring)
    const isHome = id === homeId
    const anomaly = anomalyPlacements.get(id)
    // Barrier and gate are navigational hazards, not combat ones - keep
    // the two concerns separate rather than layering a hostile encounter
    // onto a sector the player is already treating as a hazard to react
    // to. A conduit sector can still have one - see moveTo's conduit
    // handling for why that's actually safe.
    const noHostile = anomaly?.kind === 'barrier' || anomaly?.kind === 'gate'
    const hostile = !isHome && !noHostile && rng() < hostileDensity
    const hostileCount = hostile ? 1 + Math.floor(rng() * MAX_HOSTILES_PER_SECTOR) : 0
    // A starbase is a safe haven, not a hazard - never share a sector with
    // an anomaly (of any kind) or a hostile.
    const starbase = !isHome && !anomaly && !hostile && rng() < starbaseDensity
    // A star hazard only ever complicates an existing hostile encounter -
    // that's the point, dodge the star while fighting. It's never a
    // standalone hazard with nothing to fight (the hunt phase has no way
    // to make that matter - stars only exist inside a kill-phase arena),
    // and never shares a sector with an anomaly (already its own kind of
    // complication) - `hostile` already rules out a starbase sector too.
    const hasStarHazard = hostile && !anomaly && rng() < starHazardDensity
    return [id, { ...s, hostile, hostileCount, anomaly, starbase, hasStarHazard }]
  })

  return new UndoGraph<SectorData, GalaxyEdgeData>(nodes, edges)
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
