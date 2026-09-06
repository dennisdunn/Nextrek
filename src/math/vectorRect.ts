import type { Rect } from './types'

export function sum(a: Rect, b: Rect): Rect {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function negate(a: Rect): Rect {
  return { x: -a.x, y: -a.y }
}

export function diff(a: Rect, b: Rect): Rect {
  return sum(a, negate(b))
}

export function magnitude(a: Rect): number {
  return Math.sqrt(a.x ** 2 + a.y ** 2)
}

export function scale(a: Rect, scalar: number): Rect {
  return { x: a.x * scalar, y: a.y * scalar }
}

export function scaleXY(a: Rect, b: Rect): Rect {
  return { x: a.x * b.x, y: a.y * b.y }
}

export function dot(a: Rect, b: Rect): number {
  return a.x * b.x + a.y * b.y
}
