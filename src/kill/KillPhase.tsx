import { entityExists, query } from 'bitecs'
import { useEffect, useRef } from 'react'
import { bindInput, createInputState, inputSystem } from './input'
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
  hostileCount?: number
  onResolved: (outcome: KillOutcome) => void
}

const WIDTH = 640
const HEIGHT = 480
const FIRE_COOLDOWN_MS = 250
const MAX_FRAME_MS = 50 // clamp long pauses (tab switch) so physics doesn't jump

export function KillPhase({ sectorName, hostileCount = 1, onResolved }: KillPhaseProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const world = createKillWorld()
    const playerEid = spawnPlayer(world, { x: WIDTH / 2, y: HEIGHT / 2 })
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
          })
        }
      }

      physicsSystem(world)
      boundarySystem(world, { width: WIDTH, height: HEIGHT })
      collisionSystem(world)
      ageoutSystem(world)
      pruneSystem(world)
      renderSystem(world, ctx, WIDTH, HEIGHT)

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
  }, [hostileCount, onResolved])

  return (
    <div className="kill-phase">
      <h2>Red alert: {sectorName}</h2>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="kill-canvas" />
      <p className="kill-hint">Arrows / WASD to steer and thrust, Space to fire.</p>
    </div>
  )
}
