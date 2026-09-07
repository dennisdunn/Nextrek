import { entityExists, query } from 'bitecs'
import { useEffect, useRef } from 'react'
import { bindInput, createInputState, inputSystem } from './input'
import { loadoutFromEnergy, PHASER_COST_PER_SHOT } from './loadout'
import { spawnHostile, spawnPlayer, spawnProjectile } from './spawn'
import { ageoutSystem } from './systems/ageout'
import { boundarySystem } from './systems/boundary'
import { collisionSystem } from './systems/collision'
import { hostileAiSystem } from './systems/hostileAi'
import { physicsSystem } from './systems/physics'
import { pruneSystem } from './systems/prune'
import { renderSystem } from './systems/render'
import { createKillWorld } from './world'

export type KillOutcome = 'victory' | 'defeat'

export interface CombatResult {
  outcome: KillOutcome
  /** Whatever shield/phaser energy the ship had left when combat ended - what the hunt phase gets to refund. */
  leftoverShieldEnergy: number
  leftoverPhaserEnergy: number
}

export interface KillPhaseProps {
  sectorName: string
  /** Engineering's shield/phaser allocation (0-100) carried over from the hunt phase. */
  shieldLevel: number
  phaserLevel: number
  hostileCount?: number
  onResolved: (result: CombatResult) => void
}

const WIDTH = 640
const HEIGHT = 480
const FIRE_COOLDOWN_MS = 250
const MAX_FRAME_MS = 50 // clamp long pauses (tab switch) so physics doesn't jump

export function KillPhase({
  sectorName,
  shieldLevel,
  phaserLevel,
  hostileCount = 1,
  onResolved,
}: KillPhaseProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hudRef = useRef<HTMLParagraphElement | null>(null)
  const loadout = loadoutFromEnergy(shieldLevel, phaserLevel)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const world = createKillWorld()
    const playerEid = spawnPlayer(world, {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      health: loadout.hullHealth,
      shieldEnergy: loadout.shieldEnergy,
      phaserEnergy: loadout.phaserEnergy,
    })
    for (let i = 0; i < hostileCount; i++) {
      spawnHostile(world, { x: Math.random() * WIDTH, y: Math.random() * HEIGHT })
    }

    const input = createInputState()
    const unbindInput = bindInput(input)

    let raf = 0
    let resolved = false
    let fireCooldown = 0
    // Last known values before the entity might vanish (defeat removes it) -
    // what gets reported back as "leftover" for the hunt phase to refund.
    let leftoverShieldEnergy = loadout.shieldEnergy
    let leftoverPhaserEnergy = loadout.phaserEnergy
    world.time.then = performance.now()

    const tick = (now: number) => {
      const delta = Math.min(now - world.time.then, MAX_FRAME_MS)
      world.time.delta = delta
      world.time.elapsed += delta
      world.time.then = now
      fireCooldown = Math.max(0, fireCooldown - delta)

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
            damage: loadout.weaponDamage,
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
      }

      pruneSystem(world)
      renderSystem(world, ctx, WIDTH, HEIGHT)

      if (hudRef.current) {
        const hull = entityExists(world, playerEid)
          ? Math.max(0, Math.round(world.components.Health[playerEid]))
          : 0
        hudRef.current.textContent = `Hull ${hull}/${Math.round(loadout.hullHealth)} · Shields ${Math.max(0, Math.round(leftoverShieldEnergy))} · Phasers ${Math.max(0, Math.round(leftoverPhaserEnergy))}`
      }

      if (!resolved) {
        const hostilesAlive = query(world, [world.components.Hostile]).length
        if (!entityExists(world, playerEid)) {
          resolved = true
          onResolved({ outcome: 'defeat', leftoverShieldEnergy, leftoverPhaserEnergy })
        } else if (hostilesAlive === 0) {
          resolved = true
          onResolved({ outcome: 'victory', leftoverShieldEnergy, leftoverPhaserEnergy })
        }
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      unbindInput()
    }
  }, [hostileCount, loadout.hullHealth, loadout.shieldEnergy, loadout.phaserEnergy, loadout.weaponDamage, onResolved])

  return (
    <div className="kill-phase">
      <h2>Red alert: {sectorName}</h2>
      <p ref={hudRef} className="kill-hud">
        Hull {Math.round(loadout.hullHealth)}/{Math.round(loadout.hullHealth)} · Shields{' '}
        {Math.round(loadout.shieldEnergy)} · Phasers {Math.round(loadout.phaserEnergy)}
      </p>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="kill-canvas" />
      <p className="kill-hint">Arrows / WASD to steer and thrust, Space to fire.</p>
    </div>
  )
}
