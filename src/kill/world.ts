import { createWorld } from 'bitecs'

/**
 * bitECS world for the tactical (Asteroids-style) kill phase. Components
 * are plain typed arrays (SoA) keyed by entity id, per bitECS 0.4 idioms -
 * no schema classes, just data.
 */
export function createKillWorld() {
  return createWorld({
    components: {
      Position: { x: [] as number[], y: [] as number[] },
      Velocity: { x: [] as number[], y: [] as number[] },
      Heading: [] as number[],
      Radius: [] as number[],
      Health: [] as number[],
      Weapon: [] as number[],
      /** Entity id of whoever fired this projectile, so it never collides with its own source. */
      Owner: [] as number[],
      Ttl: [] as number[],
      Player: [] as number[],
      Hostile: [] as number[],
      WrapBoundary: [] as number[],
      Dead: [] as number[],
    },
    time: {
      delta: 0,
      elapsed: 0,
      then: 0,
    },
  })
}

export type KillWorld = ReturnType<typeof createKillWorld>
