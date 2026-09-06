import { addComponent, hasComponent, query } from 'bitecs'
import type { KillWorld } from '../world'

function markDead(world: KillWorld, eid: number): void {
  const { Dead } = world.components
  if (hasComponent(world, eid, Dead)) return
  Dead[eid] = 1
  addComponent(world, eid, Dead)
}

/** Projectile (Weapon) vs. hull (Health) collisions - torpedo/phaser hits from trek2, ported to bitECS. */
export function collisionSystem(world: KillWorld): void {
  const { Position, Radius, Health, Weapon, Owner, Dead } = world.components
  const weapons = query(world, [Position, Radius, Weapon])
  const hulls = query(world, [Position, Radius, Health])

  for (const weaponId of weapons) {
    if (hasComponent(world, weaponId, Dead)) continue
    const owner = hasComponent(world, weaponId, Owner) ? Owner[weaponId] : -1
    for (const hullId of hulls) {
      if (hullId === weaponId || hullId === owner || hasComponent(world, hullId, Dead)) continue
      const dx = Position.x[weaponId] - Position.x[hullId]
      const dy = Position.y[weaponId] - Position.y[hullId]
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance <= Radius[weaponId] + Radius[hullId]) {
        Health[hullId] -= Weapon[weaponId]
        markDead(world, weaponId)
        if (Health[hullId] <= 0) markDead(world, hullId)
      }
    }
  }
}
