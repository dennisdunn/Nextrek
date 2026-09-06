import { addComponent, hasComponent, query } from 'bitecs'
import type { KillWorld } from '../world'

/** Count down time-to-live and mark expired entities (projectiles) dead. */
export function ageoutSystem(world: KillWorld): void {
  const { Ttl, Dead } = world.components
  for (const eid of query(world, [Ttl])) {
    Ttl[eid] -= world.time.delta
    if (Ttl[eid] <= 0 && !hasComponent(world, eid, Dead)) {
      Dead[eid] = 1
      addComponent(world, eid, Dead)
    }
  }
}
