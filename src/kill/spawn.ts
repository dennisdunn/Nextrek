import { addComponent, addEntity } from 'bitecs'
import type { KillWorld } from './world'

export interface SpawnShipOptions {
  x: number
  y: number
  heading?: number
  radius?: number
  health?: number
}

function headingToVelocity(heading: number, speed: number): { x: number; y: number } {
  const rad = (heading * Math.PI) / 180
  return { x: speed * Math.sin(rad), y: -speed * Math.cos(rad) }
}

export function spawnPlayer(world: KillWorld, opts: SpawnShipOptions): number {
  const eid = addEntity(world)
  const { Position, Velocity, Heading, Radius, Health, WrapBoundary, Player } = world.components
  addComponent(world, eid, Position)
  addComponent(world, eid, Velocity)
  addComponent(world, eid, Heading)
  addComponent(world, eid, Radius)
  addComponent(world, eid, Health)
  addComponent(world, eid, WrapBoundary)
  addComponent(world, eid, Player)

  Position.x[eid] = opts.x
  Position.y[eid] = opts.y
  Velocity.x[eid] = 0
  Velocity.y[eid] = 0
  Heading[eid] = opts.heading ?? 0
  Radius[eid] = opts.radius ?? 14
  Health[eid] = opts.health ?? 100
  Player[eid] = 1
  return eid
}

export function spawnHostile(world: KillWorld, opts: SpawnShipOptions): number {
  const eid = addEntity(world)
  const { Position, Velocity, Heading, Radius, Health, WrapBoundary, Hostile } = world.components
  addComponent(world, eid, Position)
  addComponent(world, eid, Velocity)
  addComponent(world, eid, Heading)
  addComponent(world, eid, Radius)
  addComponent(world, eid, Health)
  addComponent(world, eid, WrapBoundary)
  addComponent(world, eid, Hostile)

  const heading = opts.heading ?? Math.random() * 360
  const { x: vx, y: vy } = headingToVelocity(heading, 40 + Math.random() * 40)
  Position.x[eid] = opts.x
  Position.y[eid] = opts.y
  Heading[eid] = heading
  Velocity.x[eid] = vx
  Velocity.y[eid] = vy
  Radius[eid] = opts.radius ?? 16
  Health[eid] = opts.health ?? 40
  Hostile[eid] = 1
  return eid
}

export interface FireOptions {
  x: number
  y: number
  heading: number
  /** Entity id of the ship firing this shot - excluded from its own collision checks. */
  owner: number
  speed?: number
  damage?: number
  ttl?: number
  radius?: number
}

export function spawnProjectile(world: KillWorld, opts: FireOptions): number {
  const eid = addEntity(world)
  const { Position, Velocity, Radius, Weapon, Owner, Ttl } = world.components
  addComponent(world, eid, Position)
  addComponent(world, eid, Velocity)
  addComponent(world, eid, Radius)
  addComponent(world, eid, Weapon)
  addComponent(world, eid, Owner)
  addComponent(world, eid, Ttl)

  const { x: vx, y: vy } = headingToVelocity(opts.heading, opts.speed ?? 320)
  Position.x[eid] = opts.x
  Position.y[eid] = opts.y
  Velocity.x[eid] = vx
  Velocity.y[eid] = vy
  Radius[eid] = opts.radius ?? 3
  Weapon[eid] = opts.damage ?? 20
  Owner[eid] = opts.owner
  Ttl[eid] = opts.ttl ?? 1200
  return eid
}
