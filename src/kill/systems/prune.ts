import { query, removeEntity } from 'bitecs'
import type { KillWorld } from '../world'

/** Remove every entity marked Dead by an earlier system this tick. */
export function pruneSystem(world: KillWorld): void {
  const { Dead } = world.components
  for (const eid of query(world, [Dead])) {
    if (Dead[eid]) removeEntity(world, eid)
  }
}
