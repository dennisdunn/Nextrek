import type { AnomalyKind } from '../graph/anomalies'
import type { Edge, NodeId } from '../graph/UndoGraph'
import type { GalaxyEdgeData } from './warpNetwork'

export interface AnomalyPlacement {
  kind: AnomalyKind
  /** The paired sector on the other end of a conduit. Unused for barrier/gate. */
  link?: NodeId
}

const KINDS: AnomalyKind[] = ['barrier', 'gate', 'conduit']

/**
 * Decide where subspace anomalies go when a galaxy is generated. Pure and
 * deterministic given `rng`, so it's testable without a real graph -
 * `neighborsOf` is the only graph fact it needs, to keep a conduit's pair
 * from linking sectors that were already adjacent (the "shortcut" would do
 * nothing).
 *
 * A conduit is always a matched pair: picking the kind for `id` also
 * assigns its partner sector, pointing back at `id`, in the same pass - so
 * an id already claimed by an earlier pairing is skipped rather than
 * re-rolled.
 */
export function pickAnomalyPlacements(
  allIds: NodeId[],
  excludeId: NodeId,
  density: number,
  rng: () => number,
  neighborsOf: (id: NodeId) => NodeId[],
): Map<NodeId, AnomalyPlacement> {
  const placements = new Map<NodeId, AnomalyPlacement>()

  for (const id of allIds) {
    if (id === excludeId) continue
    if (placements.has(id)) continue
    if (rng() >= density) continue
    const kind = KINDS[Math.floor(rng() * KINDS.length)]

    if (kind === 'barrier' || kind === 'gate') {
      placements.set(id, { kind })
      continue
    }

    // conduit: pair with some other, not-yet-claimed sector that isn't
    // already a neighbor - and never with excludeId (home), which stays
    // fully insulated from anomaly effects, not just from having one
    // seeded directly on it
    const neighbors = neighborsOf(id)
    const candidates = allIds.filter(
      (other) =>
        other !== id && other !== excludeId && !neighbors.includes(other) && !placements.has(other),
    )
    if (candidates.length === 0) continue
    const other = candidates[Math.floor(rng() * candidates.length)]
    placements.set(id, { kind: 'conduit', link: other })
    placements.set(other, { kind: 'conduit', link: id })
  }

  return placements
}

function hasEdge(edges: readonly Edge<GalaxyEdgeData>[], from: NodeId, to: NodeId): boolean {
  return edges.some((e) => e.from === from && e.to === to)
}

/**
 * Fold anomaly placements directly into a plain edge array, before any
 * UndoGraph exists. World generation must never push onto the graph's
 * undo stack - that stack means "the most recent in-play mutation" (right
 * now, warp engage/disengage), and if seeding pushed onto it too, a
 * disengageWarp() called before ever engaging warp would silently pop
 * (and revert) a hazard that was never a stack entry to begin with. Baking
 * anomalies into the initial edge set sidesteps the whole problem: the
 * graph starts with an empty undo stack, exactly like a fresh Hunt the
 * Wumpus map has its pits and bats already placed with nothing to undo.
 */
export function applyAnomalyPlacements(
  edges: readonly Edge<GalaxyEdgeData>[],
  placements: ReadonlyMap<NodeId, AnomalyPlacement>,
): Edge<GalaxyEdgeData>[] {
  let next = [...edges]
  for (const [id, placement] of placements) {
    switch (placement.kind) {
      // Both barrier and gate are dormant until the player actually walks
      // into them - see useGalaxy.ts's moveTo(), which is where each one's
      // effect (sever barrier's own inbound edges / redirect elsewhere for
      // gate) actually happens. Neither touches the graph at world-gen, so
      // both sectors are ordinary, walkable space until then.
      case 'barrier':
      case 'gate':
        break
      case 'conduit': {
        const other = placement.link!
        // Tagged so moveTo can tell "arrived via this shortcut" (a safe
        // landing) apart from wandering in the ordinary, front-door way
        // (which activates the conduit and redirects you to `other`
        // instead) - see moveTo's viaConduit check.
        if (!hasEdge(next, id, other)) next.push({ from: id, to: other, data: { viaConduit: true } })
        if (!hasEdge(next, other, id)) next.push({ from: other, to: id, data: { viaConduit: true } })
        break
      }
    }
  }
  return next
}
