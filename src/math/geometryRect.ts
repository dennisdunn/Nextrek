import type { BoundingBox, Rect } from './types'
import { between } from './util'
import * as VectorRect from './vectorRect'

export function contains(bounds: BoundingBox, point: Rect): boolean {
  return (
    between(bounds.lowerLeft.x, point.x, bounds.upperRight.x) &&
    between(bounds.lowerLeft.y, point.y, bounds.upperRight.y)
  )
}

export function distance(a: Rect, b: Rect): number {
  return VectorRect.magnitude(VectorRect.diff(a, b))
}
