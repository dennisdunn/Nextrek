import { query } from 'bitecs'
import { markDead, type KillWorld } from '../world'

/** Count down time-to-live and mark expired entities (projectiles) dead. */
export function ageoutSystem(world: KillWorld): void {
  const { Ttl } = world.components
  for (const eid of query(world, [Ttl])) {
    Ttl[eid] -= world.time.delta
    if (Ttl[eid] <= 0) markDead(world, eid)
  }
}
