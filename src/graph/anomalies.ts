import type { NodeId } from './UndoGraph'
import { UndoGraph } from './UndoGraph'

/**
 * Subspace anomalies: gameplay "shenanigans" expressed as edge mutations
 * pushed onto an UndoGraph. Each one is a single logical event - a single
 * graph.undo() call cleanly removes it, however many edges it touched.
 */

/**
 * Chamber: enterable from `entry`, but the return edge is removed, so the
 * only way in is not a way back out (asymmetric edges). Any other
 * pre-existing outgoing edges from `target` still work as exits.
 */
export function chamber<N, E>(
  graph: UndoGraph<N, E>,
  entry: NodeId,
  target: NodeId,
  edgeData?: E,
): void {
  graph.transaction(() => {
    graph.addEdge({ from: entry, to: target, data: edgeData })
    graph.removeEdges((e) => e.from === target && e.to === entry)
  })
}

/**
 * Well: a trap node with every outgoing edge stripped away. Still reachable,
 * never escapable (until someone Undo()s the anomaly).
 */
export function well<N, E>(graph: UndoGraph<N, E>, nodeId: NodeId): void {
  graph.removeEdges((e) => e.from === nodeId)
}

/**
 * Conduit: two widely-separated nodes become direct neighbors of each
 * other, bidirectionally.
 */
export function conduit<N, E>(
  graph: UndoGraph<N, E>,
  a: NodeId,
  b: NodeId,
  edgeData?: E,
): void {
  graph.transaction(() => {
    graph.addEdge({ from: a, to: b, data: edgeData })
    graph.addEdge({ from: b, to: a, data: edgeData })
  })
}

/**
 * Gate: like a conduit, but one-directional - `from` gains a shortcut to
 * `to`, with no edge back.
 */
export function gate<N, E>(
  graph: UndoGraph<N, E>,
  from: NodeId,
  to: NodeId,
  edgeData?: E,
): void {
  graph.addEdge({ from, to, data: edgeData })
}
