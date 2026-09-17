import type { NodeId } from './UndoGraph'
import { UndoGraph } from './UndoGraph'

/**
 * Subspace anomalies: gameplay "shenanigans" expressed as edge mutations
 * pushed onto an UndoGraph. Each one is a single logical event - a single
 * graph.undo() call cleanly removes it, however many edges it touched.
 */

export type AnomalyKind = 'chamber' | 'barrier' | 'conduit' | 'gate'

function hasEdge<N, E>(graph: UndoGraph<N, E>, from: NodeId, to: NodeId): boolean {
  return graph.edges.some((e) => e.from === from && e.to === to)
}

/**
 * Chamber: enterable from `entry`, but the return edge is removed, so the
 * only way in is not a way back out (asymmetric edges). Any other
 * pre-existing outgoing edges from `target` still work as exits. If
 * `entry` and `target` are already adjacent (the usual case when this is
 * seeded onto an existing map rather than hand-placed), the existing edge
 * is reused instead of adding a duplicate.
 */
export function chamber<N, E>(
  graph: UndoGraph<N, E>,
  entry: NodeId,
  target: NodeId,
  edgeData?: E,
): void {
  graph.transaction(() => {
    if (!hasEdge(graph, entry, target)) {
      graph.addEdge({ from: entry, to: target, data: edgeData })
    }
    graph.removeEdges((e) => e.from === target && e.to === entry)
  })
}

/**
 * Barrier: a node with every incoming edge stripped away. Nothing can route
 * into it any more, but anyone already inside (or leaving via one of its own
 * outgoing edges) is unaffected - it blocks entry, not exit.
 */
export function barrier<N, E>(graph: UndoGraph<N, E>, nodeId: NodeId): void {
  graph.removeEdges((e) => e.to === nodeId)
}

/**
 * Conduit: two widely-separated nodes become direct neighbors of each
 * other, bidirectionally. Skips adding either direction that's already
 * present.
 */
export function conduit<N, E>(
  graph: UndoGraph<N, E>,
  a: NodeId,
  b: NodeId,
  edgeData?: E,
): void {
  graph.transaction(() => {
    if (!hasEdge(graph, a, b)) graph.addEdge({ from: a, to: b, data: edgeData })
    if (!hasEdge(graph, b, a)) graph.addEdge({ from: b, to: a, data: edgeData })
  })
}

/**
 * Gate: like a conduit, but one-directional - `from` gains a shortcut to
 * `to`, with no edge back. Skips adding the edge if it already exists.
 */
export function gate<N, E>(
  graph: UndoGraph<N, E>,
  from: NodeId,
  to: NodeId,
  edgeData?: E,
): void {
  if (!hasEdge(graph, from, to)) {
    graph.addEdge({ from, to, data: edgeData })
  }
}
