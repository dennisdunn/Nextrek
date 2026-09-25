import { entityExists, query } from 'bitecs'
import { HOSTILE_FIRE_COOLDOWN_MS, HOSTILE_WEAPON_DAMAGE, HOSTILE_WEAPON_SPEED } from '../../balance'
import { spawnProjectile } from '../spawn'
import type { KillWorld } from '../world'

export { HOSTILE_FIRE_COOLDOWN_MS, HOSTILE_WEAPON_DAMAGE, HOSTILE_WEAPON_SPEED }

/** Aims from (fromX,fromY) toward (toX,toY) in the same heading convention as headingToVelocity (0 = up, clockwise). */
function headingTo(fromX: number, fromY: number, toX: number, toY: number): number {
  const dx = toX - fromX
  const dy = toY - fromY
  const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI
  return ((degrees % 360) + 360) % 360
}

export interface HostileAiOptions {
  /** All default to today's fixed balance.ts values - a difficulty preset overrides them (see game/GameShell.tsx). */
  damage?: number
  cooldownMs?: number
  speed?: number
}

/** Every hostile takes a shot at the player once its cooldown expires - the reason shields have anything to absorb. */
export function hostileAiSystem(world: KillWorld, playerEid: number, opts: HostileAiOptions = {}): void {
  if (!entityExists(world, playerEid)) return
  const { Position, FireCooldown } = world.components
  const damage = opts.damage ?? HOSTILE_WEAPON_DAMAGE
  const cooldownMs = opts.cooldownMs ?? HOSTILE_FIRE_COOLDOWN_MS
  const speed = opts.speed ?? HOSTILE_WEAPON_SPEED

  for (const eid of query(world, [Position, FireCooldown, world.components.Hostile])) {
    FireCooldown[eid] -= world.time.delta
    if (FireCooldown[eid] > 0) continue

    const heading = headingTo(Position.x[eid], Position.y[eid], Position.x[playerEid], Position.y[playerEid])
    spawnProjectile(world, { x: Position.x[eid], y: Position.y[eid], heading, owner: eid, damage, speed })
    FireCooldown[eid] = cooldownMs
  }
}
