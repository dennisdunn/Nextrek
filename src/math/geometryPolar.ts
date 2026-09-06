import type { BoundingArc, BoundingCircle, Polar } from './types'
import { between } from './util'
import * as VectorPolar from './vectorPolar'

export function contains(bounds: BoundingArc, point: Polar): boolean {
  return (
    between(bounds.inner.r, point.r, bounds.outer.r) &&
    between(bounds.inner.theta, point.theta, bounds.outer.theta)
  )
}

export function within(bounds: BoundingCircle, point: Polar): boolean {
  return distance(bounds.center, point) < bounds.radius
}

export function distance(a: Polar, b: Polar): number {
  return VectorPolar.distance(a, b)
}
