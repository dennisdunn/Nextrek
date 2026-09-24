import { entityExists } from 'bitecs'
import { useEffect, useRef } from 'react'
import { PLAYER_FIRE_COOLDOWN_MS, STAR_DISTANCE_FROM_CENTER } from '../balance'
import { bindInput, createInputState, inputSystem } from './input'
import {
  BASE_HULL_HEALTH,
  BASE_WEAPON_DAMAGE,
  loadoutFromEnergy,
  PHASER_COST_PER_SHOT,
  PHASER_DAMAGE_PER_LEVEL,
  TORPEDO_COOLDOWN_MS,
  TORPEDO_DAMAGE,
  TORPEDO_SPEED,
  TORPEDO_TTL_MS,
} from './loadout'
import { spawnHazard, spawnHostile, spawnPlayer, spawnProjectile } from './spawn'
import { ageoutSystem } from './systems/ageout'
import { boundarySystem } from './systems/boundary'
import { collisionSystem } from './systems/collision'
import { hazardSystem } from './systems/hazard'
import { homingSystem } from './systems/homing'
import { hostileAiSystem } from './systems/hostileAi'
import { physicsSystem } from './systems/physics'
import { pruneSystem } from './systems/prune'
import { renderSystem } from './systems/render'
import { createKillWorld, type KillWorld } from './world'

export type KillOutcome = 'victory' | 'defeat'

export interface CombatResult {
  outcome: KillOutcome
  /** Whatever shield/phaser energy the ship had left when combat ended - what the hunt phase gets to refund. */
  leftoverShieldEnergy: number
  leftoverPhaserEnergy: number
  /** Always all 0 on victory; each surviving hostile's hull otherwise - see galaxy.ts's applyCombatResult. */
  hostileHealthsRemaining: number[]
  /** Hull damage taken this encounter - what the hunt phase converts into ship-system wear (see subsystems.ts). */
  hullDamageTaken: number
  /** How many torpedoes are left in the game-wide inventory after this encounter. */
  torpedoesRemaining: number
}

/** Reported every tick so the hunt phase can persist a fled pack's damage without waiting for onResolved. */
export interface LiveCombatState {
  hostileHealthsRemaining: number[]
  shieldEnergy: number
  phaserEnergy: number
  hullDamageTaken: number
  torpedoesRemaining: number
}

export interface KillPhaseProps {
  /** Identifies this encounter (the sector it's happening in) - the world is only (re)built when this changes. */
  encounterId: string
  /** Starting hull health for each hostile in the pack - a wounded one carries this over instead of spawning at full health. */
  hostileHealths: number[]
  /** Engineering's shield/phaser allocation (0-100), live for the duration of the fight, not just at the start. */
  shieldLevel: number
  phaserLevel: number
  /** Torpedoes left in the game-wide inventory at the start of this encounter. */
  torpedoesRemaining: number
  /** Health of the torpedo tubes (0-100) - 0 means offline, otherwise scales the reload cooldown. */
  torpedoTubesHealth: number
  /** Whether this sector has a star to avoid during the fight. */
  hasStarHazard: boolean
  /** True whenever Tactical isn't the visible tab - freezes the fight rather than running it out of sight. */
  paused: boolean
  onResolved: (result: CombatResult) => void
  onLiveUpdate: (state: LiveCombatState) => void
}

const WIDTH = 640
const HEIGHT = 480
const MAX_FRAME_MS = 50 // clamp long pauses (tab switch) so physics doesn't jump

/**
 * Mirrors hunt/subsystems.ts's degradedCostMultiplier (1x at full health, up
 * to 2x fully offline) - duplicated locally rather than imported, since
 * kill/ and hunt/ are kept independent of each other (see game/GameShell.tsx,
 * the one intentional bridge between the two).
 */
function degradedCooldownMultiplier(health: number): number {
  return 2 - Math.max(0, Math.min(100, health)) / 100
}

/** Nearest still-alive hostile to (x, y) - what a torpedo locks onto when fired. */
function nearestAliveHostile(world: KillWorld, hostileEids: number[], x: number, y: number): number | undefined {
  let best: number | undefined
  let bestDistSq = Infinity
  for (const eid of hostileEids) {
    if (!entityExists(world, eid)) continue
    const dx = world.components.Position.x[eid] - x
    const dy = world.components.Position.y[eid] - y
    const distSq = dx * dx + dy * dy
    if (distSq < bestDistSq) {
      bestDistSq = distSq
      best = eid
    }
  }
  return best
}

export function KillPhase({
  encounterId,
  hostileHealths,
  shieldLevel,
  phaserLevel,
  torpedoesRemaining,
  torpedoTubesHealth,
  hasStarHazard,
  paused,
  onResolved,
  onLiveUpdate,
}: KillPhaseProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hudRef = useRef<HTMLParagraphElement | null>(null)
  const pausedRef = useRef(paused)
  const levelsRef = useRef({ shieldLevel, phaserLevel })
  const worldRef = useRef<KillWorld | null>(null)
  const playerEidRef = useRef<number | null>(null)

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  // Engineering can be adjusted mid-fight - push the new levels straight
  // into the running world's energy pools instead of waiting for (or
  // forcing) a world rebuild, which would reset position/velocity/health.
  useEffect(() => {
    levelsRef.current = { shieldLevel, phaserLevel }
    const world = worldRef.current
    const playerEid = playerEidRef.current
    if (world && playerEid !== null && entityExists(world, playerEid)) {
      world.components.ShieldEnergy[playerEid] = Math.max(0, shieldLevel)
      world.components.PhaserEnergy[playerEid] = Math.max(0, phaserLevel)
    }
  }, [shieldLevel, phaserLevel])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const world = createKillWorld()
    worldRef.current = world
    const startingLoadout = loadoutFromEnergy(levelsRef.current.shieldLevel, levelsRef.current.phaserLevel)
    const playerEid = spawnPlayer(world, {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      health: BASE_HULL_HEALTH,
      shieldEnergy: startingLoadout.shieldEnergy,
      phaserEnergy: startingLoadout.phaserEnergy,
    })
    playerEidRef.current = playerEid
    const hostileEids = hostileHealths.map((health) =>
      spawnHostile(world, { x: Math.random() * WIDTH, y: Math.random() * HEIGHT, health }),
    )
    if (hasStarHazard) {
      const angle = Math.random() * Math.PI * 2
      spawnHazard(world, {
        x: WIDTH / 2 + Math.cos(angle) * STAR_DISTANCE_FROM_CENTER,
        y: HEIGHT / 2 + Math.sin(angle) * STAR_DISTANCE_FROM_CENTER,
      })
    }

    const input = createInputState()
    const unbindInput = bindInput(input)

    let raf = 0
    let resolved = false
    let fireCooldown = 0
    let torpedoCooldown = 0
    let torpedoesLeft = torpedoesRemaining
    // Last known values before the entity might vanish (defeat removes it) -
    // what gets reported back as "leftover" for the hunt phase to refund.
    let leftoverShieldEnergy = startingLoadout.shieldEnergy
    let leftoverPhaserEnergy = startingLoadout.phaserEnergy
    // Last known hull value before the entity might vanish (defeat removes
    // it) - BASE_HULL_HEALTH minus this is what gets reported as damage
    // taken, for the hunt phase to convert into ship-system wear.
    let lastHullHealth = BASE_HULL_HEALTH
    world.time.then = performance.now()

    const tick = (now: number) => {
      if (pausedRef.current) {
        // Keeps the clock from jumping forward when the fight resumes.
        world.time.then = now
        raf = requestAnimationFrame(tick)
        return
      }

      const delta = Math.min(now - world.time.then, MAX_FRAME_MS)
      world.time.delta = delta
      world.time.elapsed += delta
      world.time.then = now
      fireCooldown = Math.max(0, fireCooldown - delta)
      torpedoCooldown = Math.max(0, torpedoCooldown - delta)

      // Tracks the live phaser allocation, not just what it was when the fight started.
      const weaponDamage = BASE_WEAPON_DAMAGE + Math.max(0, levelsRef.current.phaserLevel) * PHASER_DAMAGE_PER_LEVEL

      const playerAlive = entityExists(world, playerEid)
      if (!resolved && playerAlive) {
        inputSystem(world, playerEid, input)
        if (
          input.fire &&
          fireCooldown === 0 &&
          world.components.PhaserEnergy[playerEid] >= PHASER_COST_PER_SHOT
        ) {
          fireCooldown = PLAYER_FIRE_COOLDOWN_MS
          world.components.PhaserEnergy[playerEid] -= PHASER_COST_PER_SHOT
          spawnProjectile(world, {
            x: world.components.Position.x[playerEid],
            y: world.components.Position.y[playerEid],
            heading: world.components.Heading[playerEid],
            owner: playerEid,
            damage: weaponDamage,
          })
        }
        if (input.torpedo && torpedoCooldown === 0 && torpedoesLeft > 0 && torpedoTubesHealth > 0) {
          const target = nearestAliveHostile(
            world,
            hostileEids,
            world.components.Position.x[playerEid],
            world.components.Position.y[playerEid],
          )
          if (target !== undefined) {
            torpedoCooldown = TORPEDO_COOLDOWN_MS * degradedCooldownMultiplier(torpedoTubesHealth)
            torpedoesLeft -= 1
            spawnProjectile(world, {
              x: world.components.Position.x[playerEid],
              y: world.components.Position.y[playerEid],
              heading: world.components.Heading[playerEid],
              owner: playerEid,
              damage: TORPEDO_DAMAGE,
              speed: TORPEDO_SPEED,
              ttl: TORPEDO_TTL_MS,
              homingTarget: target,
            })
          }
        }
      }

      hostileAiSystem(world, playerEid)
      homingSystem(world)
      physicsSystem(world)
      boundarySystem(world, { width: WIDTH, height: HEIGHT })
      hazardSystem(world)
      collisionSystem(world)
      ageoutSystem(world)

      if (entityExists(world, playerEid)) {
        leftoverShieldEnergy = world.components.ShieldEnergy[playerEid]
        leftoverPhaserEnergy = world.components.PhaserEnergy[playerEid]
        lastHullHealth = world.components.Health[playerEid]
      }
      const hostileHealthsRemaining = hostileEids.map((eid) =>
        entityExists(world, eid) ? Math.max(0, world.components.Health[eid]) : 0,
      )
      const allHostilesDown = hostileHealthsRemaining.every((health) => health <= 0)
      const hullDamageTaken = Math.max(0, BASE_HULL_HEALTH - lastHullHealth)

      pruneSystem(world)
      renderSystem(world, ctx, WIDTH, HEIGHT)

      onLiveUpdate({
        hostileHealthsRemaining,
        shieldEnergy: Math.max(0, leftoverShieldEnergy),
        phaserEnergy: Math.max(0, leftoverPhaserEnergy),
        hullDamageTaken,
        torpedoesRemaining: torpedoesLeft,
      })

      if (hudRef.current) {
        const hull = entityExists(world, playerEid)
          ? Math.max(0, Math.round(world.components.Health[playerEid]))
          : 0
        const aliveCount = hostileHealthsRemaining.filter((health) => health > 0).length
        const totalHostileHealth = hostileHealthsRemaining.reduce((sum, health) => sum + health, 0)
        hudRef.current.textContent = `Hull ${hull}/${Math.round(BASE_HULL_HEALTH)} · Hostiles ${aliveCount}/${hostileEids.length} (${Math.round(totalHostileHealth)} hull) · Torpedoes ${torpedoesLeft}`
      }

      if (!resolved) {
        if (!entityExists(world, playerEid)) {
          resolved = true
          onResolved({
            outcome: 'defeat',
            leftoverShieldEnergy,
            leftoverPhaserEnergy,
            hostileHealthsRemaining,
            hullDamageTaken,
            torpedoesRemaining: torpedoesLeft,
          })
        } else if (allHostilesDown) {
          resolved = true
          onResolved({
            outcome: 'victory',
            leftoverShieldEnergy,
            leftoverPhaserEnergy,
            hostileHealthsRemaining: hostileHealthsRemaining.map(() => 0),
            hullDamageTaken,
            torpedoesRemaining: torpedoesLeft,
          })
        }
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      unbindInput()
      worldRef.current = null
      playerEidRef.current = null
    }
    // Deliberately keyed on encounterId, hostileHealths, hasStarHazard,
    // torpedoesRemaining, and torpedoTubesHealth - all fixed for the
    // encounter's lifetime, none of them ever change mid-fight (unlike
    // shieldLevel/phaserLevel, which are live-synced above instead of
    // rebuilding the world).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId, hostileHealths, hasStarHazard, torpedoesRemaining, torpedoTubesHealth, onResolved, onLiveUpdate])

  const aliveCount = hostileHealths.filter((health) => health > 0).length
  const totalHostileHealth = hostileHealths.reduce((sum, health) => sum + health, 0)

  return (
    <div className="kill-phase">
      <p ref={hudRef} className="kill-hud">
        Hull {Math.round(BASE_HULL_HEALTH)}/{Math.round(BASE_HULL_HEALTH)} · Hostiles {aliveCount}/
        {hostileHealths.length} ({Math.round(totalHostileHealth)} hull) · Torpedoes {torpedoesRemaining}
      </p>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="kill-canvas" />
      <p className="kill-hint">
        Arrows / WASD to steer and thrust, Space to fire, Enter/T for a homing torpedo
        {hasStarHazard ? ' - avoid the star' : ''}. Switch to Sciences and pick a sector to disengage.
      </p>
    </div>
  )
}
