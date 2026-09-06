import type { KillWorld } from './world'

export interface InputState {
  left: boolean
  right: boolean
  thrust: boolean
  fire: boolean
}

export function createInputState(): InputState {
  return { left: false, right: false, thrust: false, fire: false }
}

const KEY_MAP: Record<string, keyof InputState> = {
  ArrowLeft: 'left',
  a: 'left',
  A: 'left',
  ArrowRight: 'right',
  d: 'right',
  D: 'right',
  ArrowUp: 'thrust',
  w: 'thrust',
  W: 'thrust',
  ' ': 'fire',
}

/** Wire keyboard events into a mutable InputState. Returns an unsubscribe function. */
export function bindInput(state: InputState): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    const key = KEY_MAP[e.key]
    if (key) {
      state[key] = true
      e.preventDefault()
    }
  }
  const onKeyUp = (e: KeyboardEvent) => {
    const key = KEY_MAP[e.key]
    if (key) {
      state[key] = false
      e.preventDefault()
    }
  }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
  }
}

const ROTATION_SPEED = 220 // degrees/sec
const THRUST_ACCEL = 180 // px/sec^2
const MAX_SPEED = 260 // px/sec
const DRAG = 0.35 // fraction of velocity bled off per second - arcade feel, not true inertia

/** Apply player steering/thrust for one tick. Firing is handled by the caller (needs a cooldown + spawn access). */
export function inputSystem(world: KillWorld, playerEid: number, input: InputState): void {
  const { Heading, Velocity } = world.components
  const dt = world.time.delta / 1000

  if (input.left) Heading[playerEid] -= ROTATION_SPEED * dt
  if (input.right) Heading[playerEid] += ROTATION_SPEED * dt
  Heading[playerEid] = ((Heading[playerEid] % 360) + 360) % 360

  if (input.thrust) {
    const rad = (Heading[playerEid] * Math.PI) / 180
    Velocity.x[playerEid] += Math.sin(rad) * THRUST_ACCEL * dt
    Velocity.y[playerEid] += -Math.cos(rad) * THRUST_ACCEL * dt
  }

  Velocity.x[playerEid] *= 1 - DRAG * dt
  Velocity.y[playerEid] *= 1 - DRAG * dt

  const speed = Math.hypot(Velocity.x[playerEid], Velocity.y[playerEid])
  if (speed > MAX_SPEED) {
    const scale = MAX_SPEED / speed
    Velocity.x[playerEid] *= scale
    Velocity.y[playerEid] *= scale
  }
}
