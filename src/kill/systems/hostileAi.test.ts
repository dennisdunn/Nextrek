import { query } from 'bitecs'
import { describe, expect, it } from 'vitest'
import { spawnHostile, spawnPlayer } from '../spawn'
import { createKillWorld } from '../world'
import { HOSTILE_FIRE_COOLDOWN_MS, hostileAiSystem } from './hostileAi'

describe('hostileAiSystem', () => {
  it('does not fire while its cooldown has time left', () => {
    const world = createKillWorld()
    const player = spawnPlayer(world, { x: 0, y: 0 })
    const hostile = spawnHostile(world, { x: 100, y: 0 })
    world.components.FireCooldown[hostile] = 1000

    world.time.delta = 100
    hostileAiSystem(world, player)

    expect(query(world, [world.components.Weapon]).length).toBe(0)
  })

  it('fires a projectile at the player once its cooldown expires, then resets the cooldown', () => {
    const world = createKillWorld()
    const player = spawnPlayer(world, { x: 0, y: 0 })
    const hostile = spawnHostile(world, { x: 100, y: 0 })
    world.components.FireCooldown[hostile] = 10

    world.time.delta = 20
    hostileAiSystem(world, player)

    const shots = query(world, [world.components.Weapon])
    expect(shots.length).toBe(1)
    expect(world.components.Owner[shots[0]]).toBe(hostile)
    expect(world.components.FireCooldown[hostile]).toBe(HOSTILE_FIRE_COOLDOWN_MS)
  })

  it('aims the shot toward the player', () => {
    const world = createKillWorld()
    // player due "east" of the hostile in screen space (heading 90)
    const player = spawnPlayer(world, { x: 100, y: 0 })
    const hostile = spawnHostile(world, { x: 0, y: 0 })
    world.components.FireCooldown[hostile] = 0

    hostileAiSystem(world, player)

    const [shot] = query(world, [world.components.Weapon])
    expect(world.components.Velocity.x[shot]).toBeGreaterThan(0)
    expect(world.components.Velocity.y[shot]).toBeCloseTo(0, 5)
  })

  it('does nothing once the player is gone (an unknown entity id)', () => {
    const world = createKillWorld()
    const hostile = spawnHostile(world, { x: 0, y: 0 })
    world.components.FireCooldown[hostile] = 0

    const removedPlayerEid = 9999
    expect(() => hostileAiSystem(world, removedPlayerEid)).not.toThrow()
    expect(query(world, [world.components.Weapon]).length).toBe(0)
  })
})
