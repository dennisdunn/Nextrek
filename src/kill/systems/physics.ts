import { query } from 'bitecs'
import type { KillWorld } from '../world'

/** Integrate position from velocity. */
export function physicsSystem(world: KillWorld): void {
  const { Position, Velocity } = world.components
  const dtSeconds = world.time.delta / 1000
  for (const eid of query(world, [Position, Velocity])) {
    Position.x[eid] += Velocity.x[eid] * dtSeconds
    Position.y[eid] += Velocity.y[eid] * dtSeconds
  }
}
