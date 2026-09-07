import { addComponent, addEntity, entityExists } from 'bitecs'
import { describe, expect, it } from 'vitest'
import { createKillWorld } from '../world'
import { ageoutSystem } from './ageout'
import { boundarySystem } from './boundary'
import { collisionSystem } from './collision'
import { physicsSystem } from './physics'
import { pruneSystem } from './prune'

describe('physicsSystem', () => {
  it('integrates position from velocity over the elapsed time', () => {
    const world = createKillWorld()
    const { Position, Velocity } = world.components
    const eid = addEntity(world)
    addComponent(world, eid, Position)
    addComponent(world, eid, Velocity)
    Position.x[eid] = 0
    Position.y[eid] = 0
    Velocity.x[eid] = 100
    Velocity.y[eid] = -50

    world.time.delta = 1000 // 1 second
    physicsSystem(world)

    expect(Position.x[eid]).toBeCloseTo(100)
    expect(Position.y[eid]).toBeCloseTo(-50)
  })
})

describe('boundarySystem', () => {
  it('wraps a WrapBoundary entity that drifts past the right edge', () => {
    const world = createKillWorld()
    const { Position, WrapBoundary } = world.components
    const eid = addEntity(world)
    addComponent(world, eid, Position)
    addComponent(world, eid, WrapBoundary)
    Position.x[eid] = 105
    Position.y[eid] = 50

    boundarySystem(world, { width: 100, height: 100 })

    expect(Position.x[eid]).toBeCloseTo(5)
  })

  it('leaves entities without the WrapBoundary tag untouched', () => {
    const world = createKillWorld()
    const { Position } = world.components
    const eid = addEntity(world)
    addComponent(world, eid, Position)
    Position.x[eid] = 999

    boundarySystem(world, { width: 100, height: 100 })

    expect(Position.x[eid]).toBe(999)
  })
})

describe('ageoutSystem + pruneSystem', () => {
  it('marks an expired entity dead and prune removes it', () => {
    const world = createKillWorld()
    const { Ttl } = world.components
    const eid = addEntity(world)
    addComponent(world, eid, Ttl)
    Ttl[eid] = 10

    world.time.delta = 20
    ageoutSystem(world)
    expect(entityExists(world, eid)).toBe(true)

    pruneSystem(world)
    expect(entityExists(world, eid)).toBe(false)
  })

  it('does not touch an entity with time remaining', () => {
    const world = createKillWorld()
    const { Ttl } = world.components
    const eid = addEntity(world)
    addComponent(world, eid, Ttl)
    Ttl[eid] = 1000

    world.time.delta = 20
    ageoutSystem(world)
    pruneSystem(world)

    expect(entityExists(world, eid)).toBe(true)
  })
})

describe('collisionSystem', () => {
  function spawnHull(worldArg: ReturnType<typeof createKillWorld>, x: number, health: number) {
    const { Position, Radius, Health } = worldArg.components
    const eid = addEntity(worldArg)
    addComponent(worldArg, eid, Position)
    addComponent(worldArg, eid, Radius)
    addComponent(worldArg, eid, Health)
    Position.x[eid] = x
    Position.y[eid] = 0
    Radius[eid] = 10
    Health[eid] = health
    return eid
  }

  function spawnWeapon(worldArg: ReturnType<typeof createKillWorld>, x: number, damage: number) {
    const { Position, Radius, Weapon } = worldArg.components
    const eid = addEntity(worldArg)
    addComponent(worldArg, eid, Position)
    addComponent(worldArg, eid, Radius)
    addComponent(worldArg, eid, Weapon)
    Position.x[eid] = x
    Position.y[eid] = 0
    Radius[eid] = 3
    Weapon[eid] = damage
    return eid
  }

  it('damages an overlapping hull and marks the weapon dead', () => {
    const world = createKillWorld()
    const hull = spawnHull(world, 0, 50)
    const weapon = spawnWeapon(world, 5, 20)

    collisionSystem(world)

    expect(world.components.Health[hull]).toBe(30)
    expect(world.components.Dead[weapon]).toBe(1)
    expect(world.components.Dead[hull]).toBeFalsy()
  })

  it('marks the hull dead once health drops to zero or below', () => {
    const world = createKillWorld()
    const hull = spawnHull(world, 0, 15)
    spawnWeapon(world, 5, 20)

    collisionSystem(world)

    expect(world.components.Dead[hull]).toBe(1)
  })

  it('does not collide entities that are out of range', () => {
    const world = createKillWorld()
    const hull = spawnHull(world, 0, 50)
    const weapon = spawnWeapon(world, 100, 20)

    collisionSystem(world)

    expect(world.components.Health[hull]).toBe(50)
    expect(world.components.Dead[weapon]).toBeFalsy()
  })

  it('does not let a projectile hit the hull that fired it, even spawned at zero distance', () => {
    const world = createKillWorld()
    const { Position, Radius, Health, Weapon, Owner } = world.components
    const firer = spawnHull(world, 0, 100)
    const weapon = addEntity(world)
    addComponent(world, weapon, Position)
    addComponent(world, weapon, Radius)
    addComponent(world, weapon, Weapon)
    addComponent(world, weapon, Owner)
    Position.x[weapon] = 0
    Position.y[weapon] = 0
    Radius[weapon] = 3
    Weapon[weapon] = 20
    Owner[weapon] = firer

    collisionSystem(world)

    expect(Health[firer]).toBe(100)
    expect(world.components.Dead[weapon]).toBeFalsy()
  })

  it('still hits a different hull even when the projectile has an owner', () => {
    const world = createKillWorld()
    const firer = spawnHull(world, -500, 100)
    const target = spawnHull(world, 0, 40)
    const { Position, Radius, Weapon, Owner } = world.components
    const weapon = addEntity(world)
    addComponent(world, weapon, Position)
    addComponent(world, weapon, Radius)
    addComponent(world, weapon, Weapon)
    addComponent(world, weapon, Owner)
    Position.x[weapon] = 5
    Position.y[weapon] = 0
    Radius[weapon] = 3
    Weapon[weapon] = 20
    Owner[weapon] = firer

    collisionSystem(world)

    expect(world.components.Health[target]).toBe(20)
    expect(world.components.Dead[weapon]).toBe(1)
  })

  it('absorbs damage from ShieldEnergy before it reaches Health', () => {
    const world = createKillWorld()
    const hull = spawnHull(world, 0, 100)
    addComponent(world, hull, world.components.ShieldEnergy)
    world.components.ShieldEnergy[hull] = 50
    spawnWeapon(world, 5, 20)

    collisionSystem(world)

    expect(world.components.ShieldEnergy[hull]).toBe(30)
    expect(world.components.Health[hull]).toBe(100)
  })

  it('spills only the overflow to Health once shields run out', () => {
    const world = createKillWorld()
    const hull = spawnHull(world, 0, 100)
    addComponent(world, hull, world.components.ShieldEnergy)
    world.components.ShieldEnergy[hull] = 15
    spawnWeapon(world, 5, 20)

    collisionSystem(world)

    expect(world.components.ShieldEnergy[hull]).toBe(0)
    expect(world.components.Health[hull]).toBe(95)
  })

  it('a hull with no ShieldEnergy component takes damage on the hull directly, as before', () => {
    const world = createKillWorld()
    const hull = spawnHull(world, 0, 100)
    spawnWeapon(world, 5, 20)

    collisionSystem(world)

    expect(world.components.Health[hull]).toBe(80)
  })
})
