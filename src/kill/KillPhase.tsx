import { entityExists } from 'bitecs'
import { useEffect, useRef } from 'react'
import { bindInput, createInputState, inputSystem } from './input'
import { BASE_HULL_HEALTH, BASE_WEAPON_DAMAGE, loadoutFromEnergy, PHASER_COST_PER_SHOT, PHASER_DAMAGE_PER_LEVEL } from './loadout'
import { spawnHostile, spawnPlayer, spawnProjectile } from './spawn'
import { ageoutSystem } from './systems/ageout'
import { boundarySystem } from './systems/boundary'
import { collisionSystem } from './systems/collision'
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
  /** Always 0 on victory; the hostile's surviving hull otherwise - see galaxy.ts's applyCombatResult. */
  hostileHealthRemaining: number
  /** Hull damage taken this encounter - what the hunt phase converts into ship-system wear (see subsystems.ts). */
  hullDamageTaken: number
}

/** Reported every tick so the hunt phase can persist a fled hostile's damage without waiting for onResolved. */
export interface LiveCombatState {
  hostileHealth: number
  shieldEnergy: number
  phaserEnergy: number
  hullDamageTaken: number
}

export interface KillPhaseProps {
  /** Identifies this encounter (the sector it's happening in) - the world is only (re)built when this changes. */
  encounterId: string
  /** Starting hull health for the hostile - a wounded one carries this over instead of spawning at full health. */
  hostileHealth: number
  /** Engineering's shield/phaser allocation (0-100), live for the duration of the fight, not just at the start. */
  shieldLevel: number
  phaserLevel: number
  /** True whenever Tactical isn't the visible tab - freezes the fight rather than running it out of sight. */
  paused: boolean
  onResolved: (result: CombatResult) => void
  onLiveUpdate: (state: LiveCombatState) => void
}

const WIDTH = 640
const HEIGHT = 480
const FIRE_COOLDOWN_MS = 250
const MAX_FRAME_MS = 50 // clamp long pauses (tab switch) so physics doesn't jump

export function KillPhase({
  encounterId,
  hostileHealth,
  shieldLevel,
  phaserLevel,
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
    const hostileEid = spawnHostile(world, {
      x: Math.random() * WIDTH,
      y: Math.random() * HEIGHT,
      health: hostileHealth,
    })

    const input = createInputState()
    const unbindInput = bindInput(input)

    let raf = 0
    let resolved = false
    let fireCooldown = 0
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
          fireCooldown = FIRE_COOLDOWN_MS
          world.components.PhaserEnergy[playerEid] -= PHASER_COST_PER_SHOT
          spawnProjectile(world, {
            x: world.components.Position.x[playerEid],
            y: world.components.Position.y[playerEid],
            heading: world.components.Heading[playerEid],
            owner: playerEid,
            damage: weaponDamage,
          })
        }
      }

      hostileAiSystem(world, playerEid)
      physicsSystem(world)
      boundarySystem(world, { width: WIDTH, height: HEIGHT })
      collisionSystem(world)
      ageoutSystem(world)

      if (entityExists(world, playerEid)) {
        leftoverShieldEnergy = world.components.ShieldEnergy[playerEid]
        leftoverPhaserEnergy = world.components.PhaserEnergy[playerEid]
        lastHullHealth = world.components.Health[playerEid]
      }
      const hostileHealthRemaining = entityExists(world, hostileEid)
        ? Math.max(0, world.components.Health[hostileEid])
        : 0
      const hullDamageTaken = Math.max(0, BASE_HULL_HEALTH - lastHullHealth)

      pruneSystem(world)
      renderSystem(world, ctx, WIDTH, HEIGHT)

      onLiveUpdate({
        hostileHealth: hostileHealthRemaining,
        shieldEnergy: Math.max(0, leftoverShieldEnergy),
        phaserEnergy: Math.max(0, leftoverPhaserEnergy),
        hullDamageTaken,
      })

      if (hudRef.current) {
        const hull = entityExists(world, playerEid)
          ? Math.max(0, Math.round(world.components.Health[playerEid]))
          : 0
        hudRef.current.textContent = `Hull ${hull}/${Math.round(BASE_HULL_HEALTH)} · Hostile hull ${Math.round(hostileHealthRemaining)}`
      }

      if (!resolved) {
        if (!entityExists(world, playerEid)) {
          resolved = true
          onResolved({ outcome: 'defeat', leftoverShieldEnergy, leftoverPhaserEnergy, hostileHealthRemaining, hullDamageTaken })
        } else if (hostileHealthRemaining <= 0) {
          resolved = true
          onResolved({
            outcome: 'victory',
            leftoverShieldEnergy,
            leftoverPhaserEnergy,
            hostileHealthRemaining: 0,
            hullDamageTaken,
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
    // Deliberately keyed on encounterId alone (plus the hostile's starting
    // health, fixed for the encounter's lifetime) - shieldLevel/phaserLevel
    // changes are live-synced above instead of rebuilding the world, and
    // hostileHealth's initial value is read via levelsRef/startingLoadout
    // at mount time, not tracked as a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId, hostileHealth, onResolved, onLiveUpdate])

  return (
    <div className="kill-phase">
      <p ref={hudRef} className="kill-hud">
        Hull {Math.round(BASE_HULL_HEALTH)}/{Math.round(BASE_HULL_HEALTH)} · Hostile hull {Math.round(hostileHealth)}
      </p>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="kill-canvas" />
      <p className="kill-hint">
        Arrows / WASD to steer and thrust, Space to fire. Switch to Sciences and pick a sector to disengage.
      </p>
    </div>
  )
}
