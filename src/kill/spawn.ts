import { addComponent, addEntity } from 'bitecs'
import {
  HOSTILE_DRIFT_SPEED_MAX,
  HOSTILE_DRIFT_SPEED_MIN,
  HOSTILE_FIRE_STAGGER_MS,
  HOSTILE_HITBOX_RADIUS,
  PHASER_BOLT_SPEED,
  PHASER_BOLT_TTL_MS,
  PLAYER_HITBOX_RADIUS,
  PROJECTILE_RADIUS,
  STAR_HAZARD_RADIUS,
} from '../balance'
import { BASE_HULL_HEALTH, BASE_WEAPON_DAMAGE, HOSTILE_HULL_HEALTH } from './loadout'
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

export interface SpawnPlayerOptions extends SpawnShipOptions {
  shieldEnergy?: number
  phaserEnergy?: number
}

export function spawnPlayer(world: KillWorld, opts: SpawnPlayerOptions): number {
  const eid = addEntity(world)
  const { Position, Velocity, Heading, Radius, Health, WrapBoundary, Player, ShieldEnergy, PhaserEnergy } =
    world.components
  addComponent(world, eid, Position)
  addComponent(world, eid, Velocity)
  addComponent(world, eid, Heading)
  addComponent(world, eid, Radius)
  addComponent(world, eid, Health)
  addComponent(world, eid, WrapBoundary)
  addComponent(world, eid, Player)
  addComponent(world, eid, ShieldEnergy)
  addComponent(world, eid, PhaserEnergy)

  Position.x[eid] = opts.x
  Position.y[eid] = opts.y
  Velocity.x[eid] = 0
  Velocity.y[eid] = 0
  Heading[eid] = opts.heading ?? 0
  Radius[eid] = opts.radius ?? PLAYER_HITBOX_RADIUS
  Health[eid] = opts.health ?? BASE_HULL_HEALTH
  Player[eid] = 1
  ShieldEnergy[eid] = Math.max(0, opts.shieldEnergy ?? 0)
  PhaserEnergy[eid] = Math.max(0, opts.phaserEnergy ?? 0)
  return eid
}

export function spawnHostile(world: KillWorld, opts: SpawnShipOptions): number {
  const eid = addEntity(world)
  const { Position, Velocity, Heading, Radius, Health, WrapBoundary, Hostile, FireCooldown } = world.components
  addComponent(world, eid, Position)
  addComponent(world, eid, Velocity)
  addComponent(world, eid, Heading)
  addComponent(world, eid, Radius)
  addComponent(world, eid, Health)
  addComponent(world, eid, WrapBoundary)
  addComponent(world, eid, Hostile)
  addComponent(world, eid, FireCooldown)

  const heading = opts.heading ?? Math.random() * 360
  const driftSpeed = HOSTILE_DRIFT_SPEED_MIN + Math.random() * (HOSTILE_DRIFT_SPEED_MAX - HOSTILE_DRIFT_SPEED_MIN)
  const { x: vx, y: vy } = headingToVelocity(heading, driftSpeed)
  Position.x[eid] = opts.x
  Position.y[eid] = opts.y
  Heading[eid] = heading
  Velocity.x[eid] = vx
  Velocity.y[eid] = vy
  Radius[eid] = opts.radius ?? HOSTILE_HITBOX_RADIUS
  Health[eid] = opts.health ?? HOSTILE_HULL_HEALTH
  Hostile[eid] = 1
  // staggered so a pack of hostiles doesn't volley in perfect sync
  FireCooldown[eid] = Math.random() * HOSTILE_FIRE_STAGGER_MS
  return eid
}

export interface SpawnHazardOptions {
  x: number
  y: number
  radius?: number
}

/** A star: static, indestructible, and dangerous to anything that touches it - see systems/hazard.ts. */
export function spawnHazard(world: KillWorld, opts: SpawnHazardOptions): number {
  const eid = addEntity(world)
  const { Position, Radius, Hazard } = world.components
  addComponent(world, eid, Position)
  addComponent(world, eid, Radius)
  addComponent(world, eid, Hazard)
  Position.x[eid] = opts.x
  Position.y[eid] = opts.y
  Radius[eid] = opts.radius ?? STAR_HAZARD_RADIUS
  Hazard[eid] = 1
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
  /** Entity id to steer toward each tick (see systems/homing.ts) - a torpedo lock, absent for an ordinary phaser bolt. */
  homingTarget?: number
}

export function spawnProjectile(world: KillWorld, opts: FireOptions): number {
  const eid = addEntity(world)
  const { Position, Velocity, Radius, Weapon, Owner, Ttl, Homing, HomingTarget } = world.components
  addComponent(world, eid, Position)
  addComponent(world, eid, Velocity)
  addComponent(world, eid, Radius)
  addComponent(world, eid, Weapon)
  addComponent(world, eid, Owner)
  addComponent(world, eid, Ttl)

  const { x: vx, y: vy } = headingToVelocity(opts.heading, opts.speed ?? PHASER_BOLT_SPEED)
  Position.x[eid] = opts.x
  Position.y[eid] = opts.y
  Velocity.x[eid] = vx
  Velocity.y[eid] = vy
  Radius[eid] = opts.radius ?? PROJECTILE_RADIUS
  Weapon[eid] = opts.damage ?? BASE_WEAPON_DAMAGE
  Owner[eid] = opts.owner
  Ttl[eid] = opts.ttl ?? PHASER_BOLT_TTL_MS
  if (opts.homingTarget !== undefined) {
    addComponent(world, eid, Homing)
    addComponent(world, eid, HomingTarget)
    Homing[eid] = 1
    HomingTarget[eid] = opts.homingTarget
  }
  return eid
}
