import { afterEach, describe, expect, it, vi } from 'vitest'
import { PLAYER_SPAWN_STAR_CLEARANCE_DEG } from '../balance'
import { pickPlayerSpawnHeading, spawnProjectile } from './spawn'
import { createKillWorld } from './world'

function angularDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

describe('pickPlayerSpawnHeading', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a heading in [0, 360) with no star hazard', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const heading = pickPlayerSpawnHeading(null)
    expect(heading).toBeGreaterThanOrEqual(0)
    expect(heading).toBeLessThan(360)
  })

  it('never lands within the clearance arc of the star, across the full random range', () => {
    const starAngleRad = Math.PI / 3 // arbitrary
    const headingToStar = ((starAngleRad * 180) / Math.PI + 90 + 360) % 360
    for (const draw of [0, 0.25, 0.5, 0.75, 0.999999]) {
      vi.spyOn(Math, 'random').mockReturnValue(draw)
      const heading = pickPlayerSpawnHeading(starAngleRad)
      expect(angularDistance(heading, headingToStar)).toBeGreaterThanOrEqual(PLAYER_SPAWN_STAR_CLEARANCE_DEG)
    }
  })
})

describe('spawnProjectile', () => {
  it('spawns an ordinary bolt with no Homing tag by default', () => {
    const world = createKillWorld()
    const eid = spawnProjectile(world, { x: 0, y: 0, heading: 0, owner: 1 })

    expect(world.components.Homing[eid]).toBeFalsy()
  })

  it('tags a torpedo as homing when a target is given', () => {
    const world = createKillWorld()
    const targetId = 42
    const eid = spawnProjectile(world, { x: 0, y: 0, heading: 0, owner: 1, homingTarget: targetId })

    expect(world.components.Homing[eid]).toBe(1)
    expect(world.components.HomingTarget[eid]).toBe(targetId)
  })
})
