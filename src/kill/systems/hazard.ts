import { addComponent, hasComponent, query } from 'bitecs'
import type { KillWorld } from '../world'

/** Continuous hull damage per second of contact - close to a full-health ship's hull in under 2 seconds. Bypasses shields; a star isn't weapon fire. */
export const STAR_DAMAGE_PER_SECOND = 60

function markDead(world: KillWorld, eid: number): void {
  const { Dead } = world.components
  if (hasComponent(world, eid, Dead)) return
  Dead[eid] = 1
  addComponent(world, eid, Dead)
}

/**
 * A star hazard doesn't move and can't be destroyed - anything that
 * touches it takes heavy, continuous damage (any ship, player or
 * hostile), and any stray shot that touches it is destroyed outright.
 * The same "avoid it" pressure a sun exerts in the original game.
 */
export function hazardSystem(world: KillWorld): void {
  const { Position, Radius, Health, Weapon, Hazard, Dead } = world.components
  const hazards = query(world, [Position, Radius, Hazard])
  if (hazards.length === 0) return

  const dtSeconds = world.time.delta / 1000
  const ships = query(world, [Position, Radius, Health])
  const weapons = query(world, [Position, Radius, Weapon])

  for (const hazardId of hazards) {
    const hx = Position.x[hazardId]
    const hy = Position.y[hazardId]
    const hr = Radius[hazardId]

    for (const shipId of ships) {
      if (hasComponent(world, shipId, Dead)) continue
      const dx = Position.x[shipId] - hx
      const dy = Position.y[shipId] - hy
      if (Math.hypot(dx, dy) > hr + Radius[shipId]) continue
      Health[shipId] -= STAR_DAMAGE_PER_SECOND * dtSeconds
      if (Health[shipId] <= 0) markDead(world, shipId)
    }

    for (const weaponId of weapons) {
      if (hasComponent(world, weaponId, Dead)) continue
      const dx = Position.x[weaponId] - hx
      const dy = Position.y[weaponId] - hy
      if (Math.hypot(dx, dy) <= hr + Radius[weaponId]) markDead(world, weaponId)
    }
  }
}
