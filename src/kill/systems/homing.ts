import { entityExists, query } from 'bitecs'
import { HOMING_TURN_RATE } from '../../balance'
import type { KillWorld } from '../world'

export { HOMING_TURN_RATE }

/** Aims from (fromX,fromY) toward (toX,toY) in the same heading convention as spawn.ts's headingToVelocity (0 = up, clockwise). */
function headingTo(fromX: number, fromY: number, toX: number, toY: number): number {
  const degrees = (Math.atan2(toX - fromX, -(toY - fromY)) * 180) / Math.PI
  return ((degrees % 360) + 360) % 360
}

/**
 * Curves a homing torpedo's velocity toward its target each tick, without
 * changing its speed - a guided weapon, not a teleporting one. A target
 * that's gone (destroyed by something else first) just leaves the torpedo
 * flying straight until it ages out (see systems/ageout.ts).
 */
export function homingSystem(world: KillWorld): void {
  const { Position, Velocity, Homing, HomingTarget } = world.components
  const dt = world.time.delta / 1000

  for (const eid of query(world, [Position, Velocity, Homing, HomingTarget])) {
    const targetId = HomingTarget[eid]
    if (!entityExists(world, targetId)) continue

    const speed = Math.hypot(Velocity.x[eid], Velocity.y[eid])
    if (speed === 0) continue

    const currentHeading = (Math.atan2(Velocity.x[eid], -Velocity.y[eid]) * 180) / Math.PI
    const desiredHeading = headingTo(Position.x[eid], Position.y[eid], Position.x[targetId], Position.y[targetId])

    const diff = ((desiredHeading - currentHeading + 540) % 360) - 180
    const maxTurn = HOMING_TURN_RATE * dt
    const newHeading = currentHeading + Math.max(-maxTurn, Math.min(maxTurn, diff))

    const rad = (newHeading * Math.PI) / 180
    Velocity.x[eid] = speed * Math.sin(rad)
    Velocity.y[eid] = -speed * Math.cos(rad)
  }
}
