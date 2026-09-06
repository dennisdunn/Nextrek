import type { Edge, NodeId } from './UndoGraph'

export type Neighborhood = 'vonNeumann' | 'moore'

export interface GridTopologyOptions {
  width: number
  height: number
  /** Wrap left/right edges of the grid into each other. */
  wrapX?: boolean
  /** Wrap top/bottom edges of the grid into each other. */
  wrapY?: boolean
  neighborhood: Neighborhood
}

const VON_NEUMANN_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

const MOORE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  ...VON_NEUMANN_OFFSETS,
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

export function gridNodeId(x: number, y: number): NodeId {
  return `${x},${y}`
}

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size
}

/**
 * Build an edge-set for a rectangular grid of `width` x `height` nodes.
 * Boundary connectivity (wrapX/wrapY) and neighborhood connectivity
 * (vonNeumann/moore) are independent axes, per the design brief: mix and
 * match to get a flat map, a cylinder (wraps one axis), a torus (wraps
 * both), with orthogonal-only or orthogonal+diagonal movement.
 */
export function buildGridEdges(opts: GridTopologyOptions): Edge<undefined>[] {
  const { width, height, wrapX = false, wrapY = false, neighborhood } = opts
  const offsets = neighborhood === 'moore' ? MOORE_OFFSETS : VON_NEUMANN_OFFSETS
  const edges: Edge<undefined>[] = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = gridNodeId(x, y)
      for (const [dx, dy] of offsets) {
        let nx = x + dx
        let ny = y + dy
        if (nx < 0 || nx >= width) {
          if (!wrapX) continue
          nx = wrap(nx, width)
        }
        if (ny < 0 || ny >= height) {
          if (!wrapY) continue
          ny = wrap(ny, height)
        }
        edges.push({ from, to: gridNodeId(nx, ny) })
      }
    }
  }
  return edges
}
