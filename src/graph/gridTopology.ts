import type { NodeId } from './UndoGraph'

/** Node-id format shared by every rectangular/polar grid coordinate pair in the graph layer. */
export function gridNodeId(x: number, y: number): NodeId {
  return `${x},${y}`
}
