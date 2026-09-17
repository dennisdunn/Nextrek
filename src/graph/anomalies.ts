import type { NodeId } from './UndoGraph'
import { UndoGraph } from './UndoGraph'

/**
 * Subspace anomalies: gameplay "shenanigans" expressed as edge mutations
 * pushed onto an UndoGraph. Each one is a single logical event - a single
 * graph.undo() call cleanly removes it, however many edges it touched.
 */

export type AnomalyKind = 'barrier' | 'gate' | 'conduit'

function hasEdge<N, E>(graph: UndoGraph<N, E>, from: NodeId, to: NodeId): boolean {
  return graph.edges.some((e) => e.from === from && e.to === to)
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
