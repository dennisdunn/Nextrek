import { addComponent, addEntity } from 'bitecs'
import { describe, expect, it } from 'vitest'
import { createKillWorld } from '../world'
import { homingSystem } from './homing'

function spawnTracker(world: ReturnType<typeof createKillWorld>, x: number, y: number, vx: number, vy: number) {
  const { Position, Velocity } = world.components
  const eid = addEntity(world)
  addComponent(world, eid, Position)
  addComponent(world, eid, Velocity)
  Position.x[eid] = x
  Position.y[eid] = y
  Velocity.x[eid] = vx
  Velocity.y[eid] = vy
  return eid
}

function makeHoming(world: ReturnType<typeof createKillWorld>, eid: number, targetId: number) {
  const { Homing, HomingTarget } = world.components
  addComponent(world, eid, Homing)
  addComponent(world, eid, HomingTarget)
  Homing[eid] = 1
  HomingTarget[eid] = targetId
}

describe('homingSystem', () => {
  it('curves velocity toward a target directly to its side without changing speed', () => {
    const world = createKillWorld()
    // torpedo heading "up" (0, -100); target due "east" of it - a 90 degree turn needed.
    const torpedo = spawnTracker(world, 0, 0, 0, -100)
    const target = spawnTracker(world, 100, 0, 0, 0)
    makeHoming(world, torpedo, target)

    world.time.delta = 100
    homingSystem(world)

    const { Velocity } = world.components
    const speed = Math.hypot(Velocity.x[torpedo], Velocity.y[torpedo])
    expect(speed).toBeCloseTo(100, 5)
    // turned toward the target (positive x), not fully there in one 100ms tick
    expect(Velocity.x[torpedo]).toBeGreaterThan(0)
  })

  it('eventually points straight at a stationary target given enough ticks', () => {
    const world = createKillWorld()
    const torpedo = spawnTracker(world, 0, 0, 0, -100)
    const target = spawnTracker(world, 100, 0, 0, 0)
    makeHoming(world, torpedo, target)

    for (let i = 0; i < 50; i++) {
      world.time.delta = 100
      homingSystem(world)
    }

    const { Velocity } = world.components
    expect(Velocity.x[torpedo]).toBeCloseTo(100, 1)
    expect(Velocity.y[torpedo]).toBeCloseTo(0, 1)
  })

  it('leaves velocity untouched once the target no longer exists', () => {
    const world = createKillWorld()
    const torpedo = spawnTracker(world, 0, 0, 0, -100)
    const missingTargetId = 9999
    makeHoming(world, torpedo, missingTargetId)

    world.time.delta = 100
    homingSystem(world)

    const { Velocity } = world.components
    expect(Velocity.x[torpedo]).toBe(0)
    expect(Velocity.y[torpedo]).toBe(-100)
  })

  it('ignores entities without the Homing tag', () => {
    const world = createKillWorld()
    const plain = spawnTracker(world, 0, 0, 0, -100)
    spawnTracker(world, 100, 0, 0, 0)

    world.time.delta = 100
    homingSystem(world)

    expect(world.components.Velocity.x[plain]).toBe(0)
    expect(world.components.Velocity.y[plain]).toBe(-100)
  })
})
