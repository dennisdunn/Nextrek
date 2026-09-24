import { addComponent, addEntity, entityExists } from 'bitecs'
import { describe, expect, it } from 'vitest'
import { createKillWorld } from '../world'
import { hazardSystem, STAR_DAMAGE_PER_SECOND } from './hazard'

function spawnStar(world: ReturnType<typeof createKillWorld>, radius = 40) {
  const { Position, Radius, Hazard } = world.components
  const eid = addEntity(world)
  addComponent(world, eid, Position)
  addComponent(world, eid, Radius)
  addComponent(world, eid, Hazard)
  Position.x[eid] = 0
  Position.y[eid] = 0
  Radius[eid] = radius
  Hazard[eid] = 1
  return eid
}

function spawnShip(world: ReturnType<typeof createKillWorld>, x: number, health: number) {
  const { Position, Radius, Health } = world.components
  const eid = addEntity(world)
  addComponent(world, eid, Position)
  addComponent(world, eid, Radius)
  addComponent(world, eid, Health)
  Position.x[eid] = x
  Position.y[eid] = 0
  Radius[eid] = 10
  Health[eid] = health
  return eid
}

function spawnShot(world: ReturnType<typeof createKillWorld>, x: number) {
  const { Position, Radius, Weapon } = world.components
  const eid = addEntity(world)
  addComponent(world, eid, Position)
  addComponent(world, eid, Radius)
  addComponent(world, eid, Weapon)
  Position.x[eid] = x
  Position.y[eid] = 0
  Radius[eid] = 3
  Weapon[eid] = 10
  return eid
}

describe('hazardSystem', () => {
  it('does nothing when there is no hazard in the world', () => {
    const world = createKillWorld()
    const ship = spawnShip(world, 0, 100)
    world.time.delta = 1000
    hazardSystem(world)
    expect(world.components.Health[ship]).toBe(100)
  })

  it('damages a ship overlapping the star, scaled by elapsed time', () => {
    const world = createKillWorld()
    spawnStar(world)
    const ship = spawnShip(world, 30, 100) // well within the 40px radius + 10px ship radius
    world.time.delta = 500 // half a second

    hazardSystem(world)

    expect(world.components.Health[ship]).toBeCloseTo(100 - STAR_DAMAGE_PER_SECOND * 0.5)
  })

  it('leaves a ship outside the star untouched', () => {
    const world = createKillWorld()
    spawnStar(world)
    const ship = spawnShip(world, 500, 100)
    world.time.delta = 1000

    hazardSystem(world)

    expect(world.components.Health[ship]).toBe(100)
  })

  it('marks a ship dead once the star drops its health to zero or below', () => {
    const world = createKillWorld()
    spawnStar(world)
    const ship = spawnShip(world, 0, 10)
    world.time.delta = 1000

    hazardSystem(world)

    expect(world.components.Dead[ship]).toBe(1)
  })

  it('destroys a projectile that drifts into the star', () => {
    const world = createKillWorld()
    spawnStar(world)
    const shot = spawnShot(world, 10)
    world.time.delta = 16

    hazardSystem(world)

    expect(world.components.Dead[shot]).toBe(1)
  })

  it('leaves a projectile outside the star alone', () => {
    const world = createKillWorld()
    spawnStar(world)
    const shot = spawnShot(world, 500)
    world.time.delta = 16

    hazardSystem(world)

    expect(world.components.Dead[shot]).toBeFalsy()
  })

  it('damages every ship overlapping it, hostile or player alike', () => {
    const world = createKillWorld()
    spawnStar(world)
    const a = spawnShip(world, 10, 100)
    const b = spawnShip(world, -10, 100)
    world.time.delta = 1000

    hazardSystem(world)

    expect(world.components.Health[a]).toBeLessThan(100)
    expect(world.components.Health[b]).toBeLessThan(100)
    expect(entityExists(world, a)).toBe(true)
    expect(entityExists(world, b)).toBe(true)
  })
})
