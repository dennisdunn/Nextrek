import { entityExists, query } from 'bitecs'
import { spawnProjectile } from '../spawn'
import type { KillWorld } from '../world'

export const HOSTILE_FIRE_COOLDOWN_MS = 1500
export const HOSTILE_WEAPON_DAMAGE = 8
export const HOSTILE_WEAPON_SPEED = 220

/** Aims from (fromX,fromY) toward (toX,toY) in the same heading convention as headingToVelocity (0 = up, clockwise). */
function headingTo(fromX: number, fromY: number, toX: number, toY: number): number {
  const dx = toX - fromX
  const dy = toY - fromY
  const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI
  return ((degrees % 360) + 360) % 360
}

/** Every hostile takes a shot at the player once its cooldown expires - the reason shields have anything to absorb. */
export function hostileAiSystem(world: KillWorld, playerEid: number): void {
  if (!entityExists(world, playerEid)) return
  const { Position, FireCooldown } = world.components

  for (const eid of query(world, [Position, FireCooldown, world.components.Hostile])) {
    FireCooldown[eid] -= world.time.delta
    if (FireCooldown[eid] > 0) continue

    const heading = headingTo(Position.x[eid], Position.y[eid], Position.x[playerEid], Position.y[playerEid])
    spawnProjectile(world, {
      x: Position.x[eid],
      y: Position.y[eid],
      heading,
      owner: eid,
      damage: HOSTILE_WEAPON_DAMAGE,
      speed: HOSTILE_WEAPON_SPEED,
    })
    FireCooldown[eid] = HOSTILE_FIRE_COOLDOWN_MS
  }
}
