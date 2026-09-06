import type { Polar } from './types'
import { polar2rect, rect2polar } from './convert'
import { normalizeAngle } from './util'
import * as VectorRect from './vectorRect'

export function sum(a: Polar, b: Polar): Polar {
  return rect2polar(VectorRect.sum(polar2rect(a), polar2rect(b)))
}

export function diff(a: Polar, b: Polar): Polar {
  return rect2polar(VectorRect.diff(polar2rect(a), polar2rect(b)))
}

export function negate(a: Polar): Polar {
  return { r: a.r, theta: normalizeAngle(a.theta + Math.PI) }
}

export function magnitude(a: Polar): number {
  return a.r
}

export function scale(a: Polar, scalar: number): Polar {
  return { ...a, r: a.r * scalar }
}

export function dot(a: Polar, b: Polar): number {
  return VectorRect.dot(polar2rect(a), polar2rect(b))
}

/** Straight-line (chord) distance between two polar points. */
export function distance(a: Polar, b: Polar): number {
  return magnitude(diff(a, b))
}
