import type { Edge, NodeId } from '../graph/UndoGraph'

export interface GalaxyEdgeData {
  /** Hop-count this edge represents under the impulse topology it was computed from - only set on warp-network edges. */
  distance?: number
  /**
   * True on a conduit's own shortcut edge - lets moveTo tell "arrived via
   * the conduit link" apart from ordinary grid adjacency into a conduit
   * sector, since only the former is a safe landing (see anomalySeeding.ts
   * and useGalaxy.ts's moveTo).
   */
  viaConduit?: boolean
}

/**
 * BFS out to `radius` hops from every sector, over `baseEdges` (the
 * graph's current impulse topology - already reflecting any anomaly
 * mutations, since a barrier's severed entry or a conduit's shortcut should
 * shape warp reach too), producing a direct edge carrying its hop-distance
 * to every sector within range.
 *
 * This is what engaging warp pushes: a shortcut network scoped to a
 * radius around wherever you are, not the whole galaxy - so a jump's cost
 * can scale with how far it actually goes, and the map's geography still
 * matters even once you've scanned most of it.
 */
export function buildWarpEdges(
  baseEdges: readonly Edge<unknown>[],
  allIds: readonly NodeId[],
  radius: number,
): Edge<GalaxyEdgeData>[] {
  const adjacency = new Map<NodeId, NodeId[]>()
  for (const id of allIds) adjacency.set(id, [])
  for (const e of baseEdges) adjacency.get(e.from)?.push(e.to)

  const edges: Edge<GalaxyEdgeData>[] = []
  for (const source of allIds) {
    const distances = new Map<NodeId, number>([[source, 0]])
    const queue: NodeId[] = [source]
    let head = 0
    while (head < queue.length) {
      const current = queue[head++]
      const currentDistance = distances.get(current)!
      if (currentDistance >= radius) continue
      for (const neighbor of adjacency.get(current) ?? []) {
        if (distances.has(neighbor)) continue
        distances.set(neighbor, currentDistance + 1)
        queue.push(neighbor)
      }
    }
    for (const [target, distance] of distances) {
      if (target === source) continue
      edges.push({ from: source, to: target, data: { distance } })
    }
  }
  return edges
}
