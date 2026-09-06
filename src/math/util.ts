export function between(lower: number, value: number, upper: number): boolean {
  return lower <= value && value < upper
}

export function clamp(lower: number, value: number, upper: number): number {
  return value < lower ? lower : value > upper ? upper : value
}

const TWO_PI = 2 * Math.PI

/** Normalize an angle in radians to [0, 2*PI). */
export function normalizeAngle(theta: number): number {
  const wrapped = theta % TWO_PI
  return wrapped < 0 ? wrapped + TWO_PI : wrapped
}
