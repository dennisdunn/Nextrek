import { query } from 'bitecs'
import type { KillWorld } from '../world'

export interface Bounds {
  width: number
  height: number
}

/** Screen-wrap any entity tagged WrapBoundary (ships, hostiles - classic Asteroids wraparound). */
export function boundarySystem(world: KillWorld, bounds: Bounds): void {
  const { Position, WrapBoundary } = world.components
  for (const eid of query(world, [Position, WrapBoundary])) {
    if (Position.x[eid] < 0) Position.x[eid] += bounds.width
    else if (Position.x[eid] > bounds.width) Position.x[eid] -= bounds.width
    if (Position.y[eid] < 0) Position.y[eid] += bounds.height
    else if (Position.y[eid] > bounds.height) Position.y[eid] -= bounds.height
  }
}
