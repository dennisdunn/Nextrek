import { entityExists, query } from 'bitecs'
import { useEffect, useRef } from 'react'
import { bindInput, createInputState, inputSystem } from './input'
import { loadoutFromEnergy } from './loadout'
import { spawnHostile, spawnPlayer, spawnProjectile } from './spawn'
import { ageoutSystem } from './systems/ageout'
import { boundarySystem } from './systems/boundary'
import { collisionSystem } from './systems/collision'
import { physicsSystem } from './systems/physics'
import { pruneSystem } from './systems/prune'
import { renderSystem } from './systems/render'
import { createKillWorld } from './world'

export type KillOutcome = 'victory' | 'defeat'

export interface KillPhaseProps {
  sectorName: string
  /** Engineering's shield/phaser allocation (0-100) carried over from the hunt phase. */
  shieldLevel: number
  phaserLevel: number
  hostileCount?: number
  onResolved: (outcome: KillOutcome) => void
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
    })
    for (let i = 0; i < hostileCount; i++) {
      spawnHostile(world, { x: Math.random() * WIDTH, y: Math.random() * HEIGHT })
    }

    const input = createInputState()
    const unbindInput = bindInput(input)

    let raf = 0
    let resolved = false
    let fireCooldown = 0
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
        if (input.fire && fireCooldown === 0) {
          fireCooldown = FIRE_COOLDOWN_MS
          spawnProjectile(world, {
            x: world.components.Position.x[playerEid],
            y: world.components.Position.y[playerEid],
            heading: world.components.Heading[playerEid],
            owner: playerEid,
            damage: loadout.weaponDamage,
          })
        }
      }

      physicsSystem(world)
      boundarySystem(world, { width: WIDTH, height: HEIGHT })
      collisionSystem(world)
      ageoutSystem(world)
      pruneSystem(world)
      renderSystem(world, ctx, WIDTH, HEIGHT)

      if (hudRef.current) {
        const hull = playerAlive ? Math.max(0, Math.round(world.components.Health[playerEid])) : 0
        hudRef.current.textContent = `Hull ${hull}/${Math.round(loadout.hullHealth)} · Phasers ${Math.round(loadout.weaponDamage)} dmg`
      }

      if (!resolved) {
        const hostilesAlive = query(world, [world.components.Hostile]).length
        if (!entityExists(world, playerEid)) {
          resolved = true
          onResolved('defeat')
        } else if (hostilesAlive === 0) {
          resolved = true
          onResolved('victory')
        }
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      unbindInput()
    }
  }, [hostileCount, loadout.hullHealth, loadout.weaponDamage, onResolved])

  return (
    <div className="kill-phase">
      <h2>Red alert: {sectorName}</h2>
      <p ref={hudRef} className="kill-hud">
        Hull {Math.round(loadout.hullHealth)}/{Math.round(loadout.hullHealth)} · Phasers{' '}
        {Math.round(loadout.weaponDamage)} dmg
      </p>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="kill-canvas" />
      <p className="kill-hint">Arrows / WASD to steer and thrust, Space to fire.</p>
    </div>
  )
}
