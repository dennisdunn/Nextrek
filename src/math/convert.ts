import type { Polar, Rect } from './types'

export function polar2rect(point: Polar): Rect {
  return {
    x: point.r * Math.cos(point.theta),
    y: point.r * Math.sin(point.theta),
  }
}
