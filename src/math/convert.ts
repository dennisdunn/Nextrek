import type { Bounds, Polar, Rect } from './types'
import * as VectorRect from './vectorRect'
import { normalizeAngle } from './util'

export function deg2rad(degree: number): number {
  return (degree * Math.PI) / 180
}

export function rad2deg(radian: number): number {
  return (radian * 180) / Math.PI
}

export function rect2polar(point: Rect): Polar {
  return {
    r: Math.sqrt(point.x ** 2 + point.y ** 2),
    theta: normalizeAngle(Math.atan2(point.y, point.x)),
  }
}

export function polar2rect(point: Polar): Rect {
  return {
    x: point.r * Math.cos(point.theta),
    y: point.r * Math.sin(point.theta),
  }
}

/** Convert a canvas-space pixel coordinate (origin top-left, y down) into polar coordinates centered on the canvas. */
export function canvas2polar(point: Rect, bounds: Bounds): Polar {
  let p = VectorRect.diff(point, { x: bounds.width / 2, y: bounds.height / 2 })
  p = VectorRect.scaleXY(p, { x: 2 / bounds.width, y: -2 / bounds.height })
  return rect2polar(p)
}

/** Convert a polar coordinate centered on the canvas into a canvas-space pixel coordinate. */
export function polar2canvas(point: Polar, bounds: Bounds): Rect {
  let p = polar2rect(point)
  p = VectorRect.scaleXY(p, { x: bounds.width / 2, y: -bounds.height / 2 })
  p = VectorRect.sum(p, { x: bounds.width / 2, y: bounds.height / 2 })
  return p
}
