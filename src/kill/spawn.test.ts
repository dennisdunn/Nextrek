import { describe, expect, it } from 'vitest'
import { spawnProjectile } from './spawn'
import { createKillWorld } from './world'

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
