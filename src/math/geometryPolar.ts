import type { BoundingArc, Polar } from './types'
import { between } from './util'

export function contains(bounds: BoundingArc, point: Polar): boolean {
  return (
    between(bounds.inner.r, point.r, bounds.outer.r) &&
    between(bounds.inner.theta, point.theta, bounds.outer.theta)
  )
}
