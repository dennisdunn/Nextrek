import type { AnomalyKind } from '../graph/anomalies'
import type { Edge, NodeId } from '../graph/UndoGraph'

export interface AnomalyPlacement {
  kind: AnomalyKind
  /**
   * The sector this one is linked to: the blocked-return direction for a
   * chamber, the far end for a conduit/gate. Unused for a barrier - it just
   * cuts off its own approaches.
   */
  link?: NodeId
}

const KINDS: AnomalyKind[] = ['chamber', 'barrier', 'conduit', 'gate']

/**
 * Decide where subspace anomalies go when a galaxy is generated. Pure and
 * deterministic given `rng`, so it's testable without a real graph -
 * `neighborsOf` is the only graph fact it needs, for two reasons: a
 * chamber's blocked direction must be a real neighbor (you can only be
 * trapped going back the way you came), and a conduit/gate's far end must
 * NOT already be a neighbor (otherwise the "shortcut" links two sectors
 * that were already adjacent and does nothing).
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
    if (rng() >= density) continue
    const kind = KINDS[Math.floor(rng() * KINDS.length)]

    if (kind === 'barrier') {
      placements.set(id, { kind })
      continue
    }

    if (kind === 'chamber') {
      const neighbors = neighborsOf(id)
      if (neighbors.length === 0) continue
      placements.set(id, { kind, link: neighbors[Math.floor(rng() * neighbors.length)] })
      continue
    }

    // conduit or gate: link to some sector that isn't already a neighbor -
    // and never to excludeId (home), which stays fully insulated from
    // anomaly effects, not just from having one seeded directly on it
    const neighbors = neighborsOf(id)
    const candidates = allIds.filter(
      (other) => other !== id && other !== excludeId && !neighbors.includes(other),
    )
    if (candidates.length === 0) continue
    placements.set(id, { kind, link: candidates[Math.floor(rng() * candidates.length)] })
  }

  return placements
}

function hasEdge(edges: readonly Edge<undefined>[], from: NodeId, to: NodeId): boolean {
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
  edges: readonly Edge<undefined>[],
  placements: ReadonlyMap<NodeId, AnomalyPlacement>,
): Edge<undefined>[] {
  let next = [...edges]
  for (const [id, placement] of placements) {
    switch (placement.kind) {
      // A barrier is dormant until a subspace scan actually reveals it -
      // see useGalaxy.ts's subspaceScan(), which pushes the edge-stripping
      // mutation onto the live graph at that point. Until then the sector
      // is ordinary, walkable space, so world-gen leaves its edges alone.
      case 'barrier':
        break
      case 'chamber': {
        const entry = placement.link!
        if (!hasEdge(next, entry, id)) next.push({ from: entry, to: id })
        next = next.filter((e) => !(e.from === id && e.to === entry))
        break
      }
      case 'conduit': {
        const other = placement.link!
        if (!hasEdge(next, id, other)) next.push({ from: id, to: other })
        if (!hasEdge(next, other, id)) next.push({ from: other, to: id })
        break
      }
      case 'gate': {
        const other = placement.link!
        if (!hasEdge(next, id, other)) next.push({ from: id, to: other })
        break
      }
    }
  }
  return next
}
